// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaymentOracle
 * @notice On-chain audit trail for x402 payments made by the AI Agent.
 *
 * When the AgentBL AI purchases premium risk intel or valuation data through
 * the x402 protocol, every payment is logged on-chain. This contract:
 *   - Records PaymentEvidenceLogged events (immutable audit trail)
 *   - Stores response hashes for downstream verification
 *   - Provides a lookup table for payment-by-payment tracing
 *
 * Designed for Injective Testnet (chainId 1439), compatible with any EVM chain.
 * Mirrors the RugRumble Arena's PaymentEvidenceLogged pattern while adding
 * AgentBL-specific fields: quoteHash, evidenceHash, and pricing action.
 *
 * Deploy alongside the existing AgentBLRWA and RiskPricingOracle on Injective.
 */
contract PaymentOracle {
    /// @notice Emitted when the AI Agent pays for premium intel via x402
    /// @param requestId Monotonically increasing request counter
    /// @param payer Address that paid (White Agent wallet)
    /// @param serviceId x402 service identifier (e.g. "premium-risk")
    /// @param amountMicrousd Payment amount in micro-USDC (6 decimals)
    /// @param paymentRef On-chain payment reference (tx hash or facilitator ref)
    /// @param responseHash keccak256 of the unlocked intel/valuation payload
    /// @param quoteHash keccak256 of the resulting PricingQuote (if pricing was affected)
    /// @param evidenceHash keccak256 of the full evidence graph
    /// @param pricingAction Action the AI took after consuming paid intel
    event PaymentEvidenceLogged(
        uint256 indexed requestId,
        address indexed payer,
        string serviceId,
        uint256 amountMicrousd,
        string paymentRef,
        bytes32 responseHash,
        bytes32 quoteHash,
        bytes32 evidenceHash,
        string pricingAction
    );

    /// @notice Emitted when a batch of x402 purchases is recorded at once
    event BatchPaymentEvidenceLogged(
        uint256 indexed fromRequestId,
        uint256 count,
        uint256 totalMicrousd
    );

    /// @notice Tracks the number of payments recorded
    uint256 public requestCount;

    /// @notice Payment records by request ID
    mapping(uint256 => PaymentRecord) public payments;

    /// @notice Per-service total spend (serviceId => totalMicrousd)
    mapping(string => uint256) public serviceSpend;

    struct PaymentRecord {
        address payer;
        string serviceId;
        uint256 amountMicrousd;
        string paymentRef;
        bytes32 responseHash;
        bytes32 quoteHash;
        bytes32 evidenceHash;
        string pricingAction;
        uint256 timestamp;
    }

    /**
     * @notice Log a single x402 payment evidence entry.
     * @dev Callable by the backend after facilitator settlement succeeds.
     */
    function logPaymentEvidence(
        address payer,
        string calldata serviceId,
        uint256 amountMicrousd,
        string calldata paymentRef,
        bytes32 responseHash,
        bytes32 quoteHash,
        bytes32 evidenceHash,
        string calldata pricingAction
    ) external returns (uint256 requestId) {
        requestCount += 1;
        requestId = requestCount;

        payments[requestId] = PaymentRecord({
            payer: payer,
            serviceId: serviceId,
            amountMicrousd: amountMicrousd,
            paymentRef: paymentRef,
            responseHash: responseHash,
            quoteHash: quoteHash,
            evidenceHash: evidenceHash,
            pricingAction: pricingAction,
            timestamp: block.timestamp
        });

        serviceSpend[serviceId] += amountMicrousd;

        emit PaymentEvidenceLogged(
            requestId,
            payer,
            serviceId,
            amountMicrousd,
            paymentRef,
            responseHash,
            quoteHash,
            evidenceHash,
            pricingAction
        );
    }

    /**
     * @notice Batch-log multiple x402 payment evidence entries in one tx.
     * @dev Gas-efficient when the AI purchases multiple intel services for one pricing decision.
     */
    function logBatchPaymentEvidence(
        address payer,
        string[] calldata serviceIds,
        uint256[] calldata amountsMicrousd,
        string[] calldata paymentRefs,
        bytes32[] calldata responseHashes,
        bytes32 quoteHash,
        bytes32 evidenceHash,
        string calldata pricingAction
    ) external returns (uint256 fromRequestId) {
        require(
            serviceIds.length == amountsMicrousd.length &&
            amountsMicrousd.length == paymentRefs.length &&
            paymentRefs.length == responseHashes.length,
            "PaymentOracle: array length mismatch"
        );
        require(serviceIds.length > 0, "PaymentOracle: empty batch");

        fromRequestId = requestCount + 1;
        uint256 totalMicrousd = 0;

        for (uint256 i = 0; i < serviceIds.length; i++) {
            requestCount += 1;
            totalMicrousd += amountsMicrousd[i];

            payments[requestCount] = PaymentRecord({
                payer: payer,
                serviceId: serviceIds[i],
                amountMicrousd: amountsMicrousd[i],
                paymentRef: paymentRefs[i],
                responseHash: responseHashes[i],
                quoteHash: quoteHash,
                evidenceHash: evidenceHash,
                pricingAction: pricingAction,
                timestamp: block.timestamp
            });

            serviceSpend[serviceIds[i]] += amountsMicrousd[i];

            emit PaymentEvidenceLogged(
                requestCount,
                payer,
                serviceIds[i],
                amountsMicrousd[i],
                paymentRefs[i],
                responseHashes[i],
                quoteHash,
                evidenceHash,
                pricingAction
            );
        }

        emit BatchPaymentEvidenceLogged(fromRequestId, serviceIds.length, totalMicrousd);
    }

    /**
     * @notice Get the total spend for a specific x402 service.
     */
    function getServiceSpend(string calldata serviceId) external view returns (uint256) {
        return serviceSpend[serviceId];
    }

    /**
     * @notice Get a payment record by request ID.
     */
    function getPayment(uint256 requestId) external view returns (PaymentRecord memory) {
        require(requestId > 0 && requestId <= requestCount, "PaymentOracle: invalid requestId");
        return payments[requestId];
    }
}
