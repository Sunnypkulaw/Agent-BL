// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IRWAOfferingPoolActions {
    function applyPricingAction(
        uint256 poolId,
        uint256 newIssuePrice,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external;
}

/// @title RiskPricingOracle (WEB3-4 / WEB3-7 / WEB3-9)
/// @notice Records AI pricing + risk signals on-chain and forwards the action to the pool.
/// @dev Aligns with docs/contracts.md §6. evidence/quote hashes are persisted and emitted.
contract RiskPricingOracle {
    address public owner;
    IRWAOfferingPoolActions public pool;

    mapping(address => bool) private _updaters;
    mapping(uint256 => bytes32) private _latestQuoteHash;
    mapping(uint256 => bytes32) private _latestEvidenceHash;

    event PricingUpdated(
        uint256 indexed poolId,
        uint256 issuePrice,
        uint8 riskLevel,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash,
        address indexed updater
    );
    event UpdaterSet(address indexed updater, bool allowed);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address pool_) {
        owner = msg.sender;
        pool = IRWAOfferingPoolActions(pool_);
        _updaters[msg.sender] = true;
        emit UpdaterSet(msg.sender, true);
    }

    function setUpdater(address updater, bool allowed) external onlyOwner {
        require(updater != address(0), "updater=0");
        _updaters[updater] = allowed;
        emit UpdaterSet(updater, allowed);
    }

    function isUpdater(address updater) external view returns (bool) {
        return _updaters[updater];
    }

    /// @notice Push AI pricing/risk result. Emits PricingUpdated and triggers pool state change.
    function updatePricing(
        uint256 poolId,
        uint256 issuePrice,
        uint8 riskLevel,
        uint8 action,
        bytes32 evidenceHash,
        bytes32 quoteHash
    ) external {
        require(_updaters[msg.sender], "not updater");
        require(issuePrice > 0, "issuePrice=0");
        require(evidenceHash != bytes32(0), "evidenceHash=0");

        _latestQuoteHash[poolId] = quoteHash;
        _latestEvidenceHash[poolId] = evidenceHash;

        emit PricingUpdated(poolId, issuePrice, riskLevel, action, evidenceHash, quoteHash, msg.sender);

        pool.applyPricingAction(poolId, issuePrice, action, evidenceHash, quoteHash);
    }

    function latestQuoteHash(uint256 poolId) external view returns (bytes32) {
        return _latestQuoteHash[poolId];
    }

    function latestEvidenceHash(uint256 poolId) external view returns (bytes32) {
        return _latestEvidenceHash[poolId];
    }
}
