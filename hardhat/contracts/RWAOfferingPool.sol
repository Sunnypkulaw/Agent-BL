// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IEBLRegistry {
    function holderOf(uint256 eblId) external view returns (address);
    function pledgedTo(uint256 eblId) external view returns (address);
}

interface IRWATokenMintable {
    function mint(uint256 poolId, address investor, uint256 amount) external;
}

interface IInvestorComplianceGate {
    function isEligible(address investor, uint256 poolId) external view returns (bool);
}

/// @title RWAOfferingPool (WEB3-3/8/15/16)
/// @notice eBL-backed RWA offering state machine with autonomous executors,
///         emergency human stop and a testnet/production investor access switch.
contract RWAOfferingPool {
    enum OfferingState {
        Created,
        Priced,
        Open,
        Subscribed,
        Funded,
        InTransit,
        Repriced,
        Paused,
        Frozen,
        Repaid,
        Redeemed,
        Liquidation,
        Cancelled
    }

    enum AccessMode {
        Permissionless,
        ComplianceGated
    }

    uint8 public constant OPEN_OFFERING = 0;
    uint8 public constant OPEN_WITH_WARNING = 1;
    uint8 public constant REPRICE_DOWN = 2;
    uint8 public constant PAUSE_OFFERING = 3;
    uint8 public constant FREEZE_POOL = 4;
    uint8 public constant TRIGGER_LIQUIDATION = 5;
    uint8 public constant RESUME_OFFERING = 6;
    uint8 public constant SETTLE_OFFERING = 7;
    uint8 public constant EMERGENCY_PAUSE = 8;

    address public owner;
    address public oracle;
    IEBLRegistry public eblRegistry;
    IRWATokenMintable public rwaToken;
    IInvestorComplianceGate public complianceGate;
    AccessMode public accessMode = AccessMode.Permissionless;
    bool public emergencyStopped;
    uint256 public nextPoolId = 1;

    struct Offering {
        uint256 eblId;
        uint256 tokenSupply;
        uint256 issuePrice;
        uint256 targetRedemptionValue;
        uint256 subscribed;
        uint256 repaymentAmount;
        bytes32 paymentProof;
        bytes32 arrivalProof;
        OfferingState state;
        bool exists;
    }

    mapping(uint256 => Offering) public offerings;
    mapping(uint256 => OfferingState) private _stateBeforePause;
    mapping(address => bool) public agentExecutor;

    event OfferingCreated(
        uint256 indexed poolId,
        uint256 indexed eblId,
        uint256 tokenSupply,
        uint256 issuePrice,
        uint256 targetRedemptionValue
    );
    event Subscribed(uint256 indexed poolId, address indexed investor, uint256 amount, uint256 paidAmount);
    event OfferingRepriced(
        uint256 indexed poolId,
        uint256 oldIssuePrice,
        uint256 newIssuePrice,
        bytes32 evidenceHash,
        bytes32 quoteHash
    );
    event OfferingPaused(uint256 indexed poolId, bytes32 evidenceHash);
    event OfferingResumed(uint256 indexed poolId, OfferingState restoredState, bytes32 evidenceHash);
    event OfferingStateChanged(uint256 indexed poolId, OfferingState oldState, OfferingState newState, uint8 action);
    event SettlementProofRecorded(uint256 indexed poolId, bytes32 paymentProof, bytes32 arrivalProof);
    event OfferingSettled(uint256 indexed poolId, uint256 repaymentAmount, bytes32 paymentProof, bytes32 arrivalProof);
    event AgentExecutorSet(address indexed executor, bool allowed);
    event EmergencyStopSet(bool stopped, address indexed operator, bytes32 reasonHash);
    event AccessModeSet(AccessMode mode);
    event ComplianceGateSet(address indexed gate);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == owner || agentExecutor[msg.sender], "not executor");
        _;
    }

    modifier whenOperational() {
        require(!emergencyStopped, "emergency stopped");
        _;
    }

    constructor(address eblRegistry_, address rwaToken_) {
        require(eblRegistry_ != address(0) && rwaToken_ != address(0), "dependency=0");
        owner = msg.sender;
        eblRegistry = IEBLRegistry(eblRegistry_);
        rwaToken = IRWATokenMintable(rwaToken_);
    }

    function setOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "oracle=0");
        oracle = oracle_;
    }

    function setAgentExecutor(address executor, bool allowed) external onlyOwner {
        require(executor != address(0), "executor=0");
        agentExecutor[executor] = allowed;
        emit AgentExecutorSet(executor, allowed);
    }

    function setEmergencyStop(bool stopped, bytes32 reasonHash) external onlyOwner {
        require(emergencyStopped != stopped, "unchanged");
        emergencyStopped = stopped;
        emit EmergencyStopSet(stopped, msg.sender, reasonHash);
    }

    /// @notice Human-only pool pause that remains available during a global stop.
    function emergencyPause(uint256 poolId, bytes32 reasonHash) external onlyOwner {
        _pause(poolId, reasonHash, EMERGENCY_PAUSE);
    }

    function setComplianceGate(address gate) external onlyOwner {
        require(gate != address(0) && gate.code.length > 0, "invalid gate");
        complianceGate = IInvestorComplianceGate(gate);
        emit ComplianceGateSet(gate);
    }

    function setAccessMode(AccessMode mode) external onlyOwner {
        if (mode == AccessMode.ComplianceGated) require(address(complianceGate) != address(0), "gate missing");
        accessMode = mode;
        emit AccessModeSet(mode);
    }

    function isInvestorEligible(address investor, uint256 poolId) public view returns (bool) {
        if (accessMode == AccessMode.Permissionless) return investor != address(0);
        return address(complianceGate) != address(0) && complianceGate.isEligible(investor, poolId);
    }

    function createOffering(
        uint256 eblId,
        uint256 tokenSupply,
        uint256 issuePrice,
        uint256 targetRedemptionValue
    ) external onlyOwner whenOperational returns (uint256 poolId) {
        require(issuePrice > 0, "issuePrice=0");
        require(tokenSupply > 0, "supply=0");
        require(targetRedemptionValue >= issuePrice, "redemption<price");
        require(eblRegistry.holderOf(eblId) != address(0), "ebl missing");
        require(eblRegistry.pledgedTo(eblId) == address(this), "ebl not pledged to pool");

        poolId = nextPoolId++;
        offerings[poolId] = Offering({
            eblId: eblId,
            tokenSupply: tokenSupply,
            issuePrice: issuePrice,
            targetRedemptionValue: targetRedemptionValue,
            subscribed: 0,
            repaymentAmount: 0,
            paymentProof: bytes32(0),
            arrivalProof: bytes32(0),
            state: OfferingState.Open,
            exists: true
        });

        emit OfferingCreated(poolId, eblId, tokenSupply, issuePrice, targetRedemptionValue);
        emit OfferingStateChanged(poolId, OfferingState.Created, OfferingState.Open, OPEN_OFFERING);
    }

    function subscribe(uint256 poolId, uint256 amount) external whenOperational {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(
            o.state == OfferingState.Open || o.state == OfferingState.Repriced || o.state == OfferingState.Subscribed,
            "not open"
        );
        require(isInvestorEligible(msg.sender, poolId), "not eligible");
        require(amount > 0, "amount=0");
        require(o.subscribed + amount <= o.tokenSupply, "exceeds supply");

        o.subscribed += amount;
        uint256 paidAmount = amount * o.issuePrice;
        rwaToken.mint(poolId, msg.sender, amount);
        emit Subscribed(poolId, msg.sender, amount, paidAmount);

        OfferingState next = o.subscribed == o.tokenSupply ? OfferingState.Funded : OfferingState.Subscribed;
        if (o.state != next) _changeState(poolId, next, OPEN_OFFERING);
    }

    function markInTransit(uint256 poolId, bytes32 departureProof) external onlyExecutor whenOperational {
        require(departureProof != bytes32(0), "departureProof=0");
        Offering storage o = offerings[poolId];
        require(o.state == OfferingState.Funded || o.state == OfferingState.Subscribed, "not funded");
        _changeState(poolId, OfferingState.InTransit, OPEN_OFFERING);
    }

    function pauseOffering(uint256 poolId, bytes32 evidenceHash) external whenOperational {
        require(msg.sender == owner || msg.sender == oracle || agentExecutor[msg.sender], "not authorized");
        _pause(poolId, evidenceHash, PAUSE_OFFERING);
    }

    function resumeOffering(uint256 poolId, bytes32 evidenceHash) external onlyExecutor whenOperational {
        _resume(poolId, evidenceHash);
    }

    function recordImporterPayment(
        uint256 poolId,
        bytes32 paymentProof,
        uint256 repaymentAmount
    ) external onlyExecutor whenOperational {
        Offering storage o = offerings[poolId];
        require(_canSettleFrom(o.state), "bad settlement state");
        require(paymentProof != bytes32(0), "paymentProof=0");
        require(repaymentAmount > 0, "repayment=0");
        require(o.paymentProof == bytes32(0), "payment already recorded");
        o.paymentProof = paymentProof;
        o.repaymentAmount = repaymentAmount;
        emit SettlementProofRecorded(poolId, o.paymentProof, o.arrivalProof);
    }

    function recordCargoArrival(uint256 poolId, bytes32 arrivalProof) external onlyExecutor whenOperational {
        Offering storage o = offerings[poolId];
        require(_canSettleFrom(o.state), "bad settlement state");
        require(arrivalProof != bytes32(0), "arrivalProof=0");
        require(o.arrivalProof == bytes32(0), "arrival already recorded");
        o.arrivalProof = arrivalProof;
        emit SettlementProofRecorded(poolId, o.paymentProof, o.arrivalProof);
    }

    function settle(uint256 poolId, uint256 repaymentAmount) external onlyExecutor whenOperational {
        Offering storage o = offerings[poolId];
        require(_canSettleFrom(o.state), "bad settlement state");
        require(o.paymentProof != bytes32(0) && o.arrivalProof != bytes32(0), "settlement proof missing");
        require(repaymentAmount > 0 && repaymentAmount == o.repaymentAmount, "repayment mismatch");
        _changeState(poolId, OfferingState.Repaid, SETTLE_OFFERING);
        emit OfferingSettled(poolId, repaymentAmount, o.paymentProof, o.arrivalProof);
    }

    /// @notice Apply an AI pricing action coming from RiskPricingOracle.
    function applyPricingAction(
        uint256 poolId,
        uint256 newIssuePrice,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external whenOperational {
        require(msg.sender == oracle || msg.sender == owner, "not authorized");
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(evidenceHash != bytes32(0), "evidenceHash=0");

        if (action == RESUME_OFFERING) {
            _resume(poolId, evidenceHash);
            return;
        }
        if (action == PAUSE_OFFERING) {
            _pause(poolId, evidenceHash, action);
            return;
        }
        if (action == FREEZE_POOL) {
            require(_isActive(o.state) || o.state == OfferingState.Paused, "illegal transition");
            _changeState(poolId, OfferingState.Frozen, action);
            emit OfferingPaused(poolId, evidenceHash);
            return;
        }
        if (action == TRIGGER_LIQUIDATION) {
            require(_isActive(o.state) || o.state == OfferingState.Paused || o.state == OfferingState.Frozen, "illegal transition");
            _changeState(poolId, OfferingState.Liquidation, action);
            return;
        }
        require(action == OPEN_OFFERING || action == OPEN_WITH_WARNING || action == REPRICE_DOWN, "bad action");
        require(_isActive(o.state), "illegal transition");

        if (newIssuePrice > 0 && newIssuePrice != o.issuePrice) {
            uint256 oldPrice = o.issuePrice;
            o.issuePrice = newIssuePrice;
            emit OfferingRepriced(poolId, oldPrice, newIssuePrice, evidenceHash, quoteHash);
        }
        if (action == REPRICE_DOWN && o.state != OfferingState.Repriced) {
            _changeState(poolId, OfferingState.Repriced, action);
        }
    }

    function stateOf(uint256 poolId) external view returns (OfferingState) {
        return offerings[poolId].state;
    }

    function issuePriceOf(uint256 poolId) external view returns (uint256) {
        return offerings[poolId].issuePrice;
    }

    function settlementProofs(uint256 poolId) external view returns (bytes32 paymentProof, bytes32 arrivalProof) {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        return (o.paymentProof, o.arrivalProof);
    }

    function _pause(uint256 poolId, bytes32 evidenceHash, uint8 action) internal {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(_isActive(o.state), "illegal transition");
        _stateBeforePause[poolId] = o.state;
        _changeState(poolId, OfferingState.Paused, action);
        emit OfferingPaused(poolId, evidenceHash);
    }

    function _resume(uint256 poolId, bytes32 evidenceHash) internal {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(o.state == OfferingState.Paused, "not paused");
        OfferingState restored = _stateBeforePause[poolId];
        require(_isActive(restored), "resume state invalid");
        _changeState(poolId, restored, RESUME_OFFERING);
        emit OfferingResumed(poolId, restored, evidenceHash);
    }

    function _changeState(uint256 poolId, OfferingState newState, uint8 action) internal {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        OfferingState oldState = o.state;
        require(oldState != newState, "duplicate state");
        o.state = newState;
        emit OfferingStateChanged(poolId, oldState, newState, action);
    }

    function _isActive(OfferingState state) internal pure returns (bool) {
        return state == OfferingState.Open
            || state == OfferingState.Subscribed
            || state == OfferingState.Funded
            || state == OfferingState.InTransit
            || state == OfferingState.Repriced;
    }

    function _canSettleFrom(OfferingState state) internal pure returns (bool) {
        return _isActive(state);
    }
}
