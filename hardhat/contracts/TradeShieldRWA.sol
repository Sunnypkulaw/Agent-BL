// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TradeShieldRWA — self-contained, permissionless demo contract for the
///        browser (MetaMask) flow of the TradeShield dashboard.
/// @notice One transaction tokenizes an electronic Bill of Lading into an RWA
///         offering and mints the per-pool RWA balance to the caller, anchoring
///         the AI Pricing & Risk Agent's decision on-chain (issue price, risk
///         score, action, quote/evidence hashes). A second function reprices an
///         offering when an in-transit risk event arrives (View ② event buttons).
/// @dev    Deliberately NOT the full role-gated protocol (see EBLRegistry /
///         RWAOfferingPool / RiskPricingOracle for that). This is a single,
///         dependency-free, ungated contract so ANY wallet can drive the whole
///         demo on Sepolia and produce a real, auditable transaction. Prices are
///         carried as USD * 1e6 (e.g. 0.848 USD => 848000). 1 RWA = 1.00 USD is a
///         TARGET redemption value, not a guarantee.
contract TradeShieldRWA {
    /// @dev Mirrors docs/contracts.md §2.3 / the off-chain pricing_action codes.
    enum Action {
        OPEN_OFFERING,        // 0
        OPEN_WITH_WARNING,    // 1
        REPRICE_DOWN,         // 2
        PAUSE_OFFERING,       // 3
        FREEZE_POOL,          // 4
        TRIGGER_LIQUIDATION   // 5
    }

    struct Offering {
        address creator;             // who tokenized the eBL
        string  blId;                // electronic Bill of Lading id (e.g. "EBL-2026-CU-04417")
        uint256 issuePriceE6;        // RWA issue price, USD * 1e6
        uint256 tokenSupply;         // AI-recommended max token supply
        uint256 minted;              // RWA minted so far
        uint256 collateralValueUsd;  // AI-verified collateral value (whole USD)
        uint32  riskScoreBps;        // total trade-risk score, basis points
        uint8   riskLevel;           // 0 LOW / 1 MEDIUM / 2 WARNING / 3 CRITICAL
        bytes32 quoteHash;           // anchors the offering TERMS
        bytes32 evidenceHash;        // anchors the pricing INPUTS (valuation/risk/docs)
        bool    exists;
    }

    uint256 public nextPoolId = 1;
    mapping(uint256 => Offering) public offerings;
    mapping(uint256 => mapping(address => uint256)) public rwaBalance;

    event Tokenized(
        uint256 indexed poolId,
        address indexed creator,
        string  blId,
        uint256 issuePriceE6,
        uint256 tokenSupply,
        uint256 mintedAmount,
        uint256 collateralValueUsd,
        uint32  riskScoreBps,
        uint8   riskLevel,
        bytes32 quoteHash,
        bytes32 evidenceHash
    );

    event Repriced(
        uint256 indexed poolId,
        uint256 oldIssuePriceE6,
        uint256 newIssuePriceE6,
        uint8   action,
        uint32  newRiskScoreBps,
        uint8   newRiskLevel,
        bytes32 evidenceHash,
        string  reason
    );

    /// @notice Tokenize an eBL into an RWA offering and mint RWA to the caller.
    /// @param financingUsd Cash (whole USD) the merchant wants to raise now. The
    ///        minted RWA = financingUsd / issuePrice, capped at tokenSupply.
    /// @return poolId The new offering id.
    /// @return mintedAmount RWA tokens minted to msg.sender.
    function tokenize(
        string calldata blId,
        uint256 issuePriceE6,
        uint256 tokenSupply,
        uint256 financingUsd,
        uint256 collateralValueUsd,
        uint32  riskScoreBps,
        uint8   riskLevel,
        bytes32 quoteHash,
        bytes32 evidenceHash
    ) external returns (uint256 poolId, uint256 mintedAmount) {
        require(issuePriceE6 > 0, "issuePrice=0");
        require(tokenSupply > 0, "supply=0");

        // RWA = financing / issue price. financingUsd is whole USD, issuePriceE6
        // is USD*1e6, so (financingUsd * 1e6) / issuePriceE6 yields whole tokens.
        mintedAmount = (financingUsd * 1e6) / issuePriceE6;
        if (mintedAmount > tokenSupply) mintedAmount = tokenSupply;

        poolId = nextPoolId++;
        offerings[poolId] = Offering({
            creator: msg.sender,
            blId: blId,
            issuePriceE6: issuePriceE6,
            tokenSupply: tokenSupply,
            minted: mintedAmount,
            collateralValueUsd: collateralValueUsd,
            riskScoreBps: riskScoreBps,
            riskLevel: riskLevel,
            quoteHash: quoteHash,
            evidenceHash: evidenceHash,
            exists: true
        });
        rwaBalance[poolId][msg.sender] = mintedAmount;

        emit Tokenized(
            poolId,
            msg.sender,
            blId,
            issuePriceE6,
            tokenSupply,
            mintedAmount,
            collateralValueUsd,
            riskScoreBps,
            riskLevel,
            quoteHash,
            evidenceHash
        );
    }

    /// @notice Reprice an offering when an in-transit risk event arrives.
    /// @dev Ungated for the demo: the dashboard's "simulate in-transit risk"
    ///      buttons can anchor the AI's new price/risk on-chain.
    function reprice(
        uint256 poolId,
        uint256 newIssuePriceE6,
        uint8   action,
        uint32  newRiskScoreBps,
        uint8   newRiskLevel,
        bytes32 evidenceHash,
        string calldata reason
    ) external {
        Offering storage o = offerings[poolId];
        require(o.exists, "pool missing");

        uint256 old = o.issuePriceE6;
        if (newIssuePriceE6 > 0) o.issuePriceE6 = newIssuePriceE6;
        o.riskScoreBps = newRiskScoreBps;
        o.riskLevel = newRiskLevel;
        o.evidenceHash = evidenceHash;

        emit Repriced(poolId, old, o.issuePriceE6, action, newRiskScoreBps, newRiskLevel, evidenceHash, reason);
    }

    function balanceOf(uint256 poolId, address who) external view returns (uint256) {
        return rwaBalance[poolId][who];
    }

    function offeringOf(uint256 poolId) external view returns (Offering memory) {
        return offerings[poolId];
    }
}
