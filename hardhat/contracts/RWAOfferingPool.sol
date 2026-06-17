// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IEBLRegistry {
    function holderOf(uint256 eblId) external view returns (address);
}

interface IRWATokenMintable {
    function mint(uint256 poolId, address investor, uint256 amount) external;
}

/// @title RWAOfferingPool (WEB3-3 / WEB3-8)
/// @notice eBL-backed RWA offering state machine: create, subscribe, reprice, pause, settle.
/// @dev Aligns with docs/contracts.md §5. Consumes AI pricing actions; does not compute risk.
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

    // Action codes, docs/contracts.md §2.3 (keyed by pricing_action).
    uint8 public constant OPEN_OFFERING = 0;
    uint8 public constant OPEN_WITH_WARNING = 1;
    uint8 public constant REPRICE_DOWN = 2;
    uint8 public constant PAUSE_OFFERING = 3;
    uint8 public constant FREEZE_POOL = 4;
    uint8 public constant TRIGGER_LIQUIDATION = 5;

    address public owner;
    address public oracle;
    IEBLRegistry public eblRegistry;
    IRWATokenMintable public rwaToken;
    uint256 public nextPoolId = 1;

    struct Offering {
        uint256 eblId;
        uint256 tokenSupply;
        uint256 issuePrice;
        uint256 targetRedemptionValue;
        uint256 subscribed;
        OfferingState state;
        bool exists;
    }

    mapping(uint256 => Offering) public offerings;
    mapping(address => bool) public permissionedInvestor;

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
    event OfferingStateChanged(uint256 indexed poolId, OfferingState oldState, OfferingState newState, uint8 action);
    event OfferingSettled(uint256 indexed poolId, uint256 repaymentAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address eblRegistry_, address rwaToken_) {
        owner = msg.sender;
        eblRegistry = IEBLRegistry(eblRegistry_);
        rwaToken = IRWATokenMintable(rwaToken_);
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
    }

    function setPermissionedInvestor(address investor, bool allowed) external onlyOwner {
        permissionedInvestor[investor] = allowed;
    }

    function createOffering(
        uint256 eblId,
        uint256 tokenSupply,
        uint256 issuePrice,
        uint256 targetRedemptionValue
    ) external onlyOwner returns (uint256 poolId) {
        require(issuePrice > 0, "issuePrice=0");
        require(tokenSupply > 0, "supply=0");
        require(eblRegistry.holderOf(eblId) != address(0), "ebl missing");

        poolId = nextPoolId++;
        offerings[poolId] = Offering({
            eblId: eblId,
            tokenSupply: tokenSupply,
            issuePrice: issuePrice,
            targetRedemptionValue: targetRedemptionValue,
            subscribed: 0,
            state: OfferingState.Open,
            exists: true
        });

        emit OfferingCreated(poolId, eblId, tokenSupply, issuePrice, targetRedemptionValue);
        emit OfferingStateChanged(poolId, OfferingState.Created, OfferingState.Open, OPEN_OFFERING);
    }

    function subscribe(uint256 poolId, uint256 amount) external {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(o.state == OfferingState.Open || o.state == OfferingState.Repriced, "not open");
        require(permissionedInvestor[msg.sender], "not permissioned");
        require(amount > 0, "amount=0");
        require(o.subscribed + amount <= o.tokenSupply, "exceeds supply");

        o.subscribed += amount;
        uint256 paidAmount = amount * o.issuePrice;
        rwaToken.mint(poolId, msg.sender, amount);
        emit Subscribed(poolId, msg.sender, amount, paidAmount);
    }

    function pauseOffering(uint256 poolId) external {
        require(msg.sender == owner || msg.sender == oracle, "not authorized");
        _changeState(poolId, OfferingState.Paused, PAUSE_OFFERING);
        emit OfferingPaused(poolId, bytes32(0));
    }

    /// @notice Apply an AI pricing action coming from the RiskPricingOracle.
    function applyPricingAction(
        uint256 poolId,
        uint256 newIssuePrice,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external {
        require(msg.sender == oracle || msg.sender == owner, "not authorized");
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        require(evidenceHash != bytes32(0), "evidenceHash=0");

        if (action == REPRICE_DOWN || action == OPEN_WITH_WARNING) {
            if (newIssuePrice > 0 && newIssuePrice != o.issuePrice) {
                uint256 oldPrice = o.issuePrice;
                o.issuePrice = newIssuePrice;
                emit OfferingRepriced(poolId, oldPrice, newIssuePrice, evidenceHash, quoteHash);
            }
        }

        if (action == PAUSE_OFFERING || action == FREEZE_POOL) {
            emit OfferingPaused(poolId, evidenceHash);
        }

        _changeState(poolId, _stateForAction(action), action);
    }

    function settle(uint256 poolId, uint256 repaymentAmount) external onlyOwner {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        o.state = OfferingState.Repaid;
        emit OfferingSettled(poolId, repaymentAmount);
    }

    function stateOf(uint256 poolId) external view returns (OfferingState) {
        return offerings[poolId].state;
    }

    function issuePriceOf(uint256 poolId) external view returns (uint256) {
        return offerings[poolId].issuePrice;
    }

    function _changeState(uint256 poolId, OfferingState newState, uint8 action) internal {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");
        OfferingState oldState = o.state;
        o.state = newState;
        emit OfferingStateChanged(poolId, oldState, newState, action);
    }

    function _stateForAction(uint8 action) internal pure returns (OfferingState) {
        if (action == OPEN_OFFERING) return OfferingState.Open;
        if (action == OPEN_WITH_WARNING) return OfferingState.Open;
        if (action == REPRICE_DOWN) return OfferingState.Repriced;
        if (action == PAUSE_OFFERING) return OfferingState.Paused;
        if (action == FREEZE_POOL) return OfferingState.Frozen;
        if (action == TRIGGER_LIQUIDATION) return OfferingState.Liquidation;
        revert("bad action");
    }
}
