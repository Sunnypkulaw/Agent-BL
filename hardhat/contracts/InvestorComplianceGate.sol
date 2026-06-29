// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title InvestorComplianceGate
/// @notice Replaceable production eligibility module for RWAOfferingPool.
/// @dev The pool depends only on isEligible(), so a KYC/AML or ZK gate can be
///      substituted without redeploying the pool's state machine.
contract InvestorComplianceGate {
    address public owner;
    mapping(address => bool) private _globalEligibility;
    mapping(uint256 => mapping(address => bool)) private _poolEligibility;
    mapping(uint256 => mapping(address => bool)) private _hasPoolOverride;

    event EligibilitySet(address indexed investor, bool eligible);
    event PoolEligibilitySet(uint256 indexed poolId, address indexed investor, bool eligible);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setEligible(address investor, bool eligible) external onlyOwner {
        require(investor != address(0), "investor=0");
        _globalEligibility[investor] = eligible;
        emit EligibilitySet(investor, eligible);
    }

    function setPoolEligible(uint256 poolId, address investor, bool eligible) external onlyOwner {
        require(investor != address(0), "investor=0");
        _hasPoolOverride[poolId][investor] = true;
        _poolEligibility[poolId][investor] = eligible;
        emit PoolEligibilitySet(poolId, investor, eligible);
    }

    function isEligible(address investor, uint256 poolId) external view returns (bool) {
        if (_hasPoolOverride[poolId][investor]) return _poolEligibility[poolId][investor];
        return _globalEligibility[investor];
    }
}
