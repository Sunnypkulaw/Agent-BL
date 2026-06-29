// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title PaymentOracle
 * @notice Immutable attestations that bind an x402 settlement to the AI report
 *         it unlocked.
 *
 * The USDC transfer is settled by the x402 facilitator. An authorised AgentBL
 * attestor then records the original settlement transaction together with the
 * canonical PaidReportEnvelope hash. Payment never changes a risk score; this
 * contract only proves provenance and payment.
 */
contract PaymentOracle {
    error NotOwner(address caller);
    error UnauthorizedAttestor(address caller);
    error ZeroAddress();
    error ZeroHash();
    error ZeroAmount();
    error DuplicateReceipt(bytes32 receiptId);
    error DuplicatePaymentTransaction(bytes32 paymentTxHash);
    error UnknownReceipt(bytes32 receiptId);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AttestorUpdated(address indexed attestor, bool allowed);

    /**
     * @notice A complete audit link from x402 USDC settlement to AI report.
     * @param receiptId Stable idempotency key for this attestation
     * @param reportHash SHA-256 hash from the PaidReportEnvelope
     * @param caseIdHash Hash of the trade-finance case id
     * @param paymentTxHash Original facilitator USDC settlement transaction hash
     * @param payer Wallet that authorised the USDC transfer
     * @param asset ERC-20 asset used for payment (USDC on Injective)
     * @param amount Amount in the asset's smallest unit
     * @param attestor Authorised backend wallet that submitted the evidence
     * @param timestamp Block timestamp of the attestation
     */
    event PaymentAttested(
        bytes32 indexed receiptId,
        bytes32 indexed reportHash,
        bytes32 indexed caseIdHash,
        bytes32 paymentTxHash,
        address payer,
        address asset,
        uint256 amount,
        address attestor,
        uint256 timestamp
    );

    struct PaymentAttestation {
        bytes32 reportHash;
        bytes32 caseIdHash;
        bytes32 paymentTxHash;
        address payer;
        address asset;
        uint256 amount;
        address attestor;
        uint256 timestamp;
    }

    address public owner;
    uint256 public attestationCount;

    mapping(address => bool) public isAttestor;
    mapping(bytes32 => PaymentAttestation) private _attestations;
    mapping(bytes32 => bool) public paymentTransactionAttested;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier onlyAttestor() {
        if (!isAttestor[msg.sender]) revert UnauthorizedAttestor(msg.sender);
        _;
    }

    constructor() {
        owner = msg.sender;
        isAttestor[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AttestorUpdated(msg.sender, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        isAttestor[newOwner] = true;
        emit OwnershipTransferred(previousOwner, newOwner);
        emit AttestorUpdated(newOwner, true);
    }

    function setAttestor(address attestor, bool allowed) external onlyOwner {
        if (attestor == address(0)) revert ZeroAddress();
        isAttestor[attestor] = allowed;
        emit AttestorUpdated(attestor, allowed);
    }

    /**
     * @notice Bind a settled x402 payment to one canonical paid AI report.
     * @dev Both receipt id and original payment transaction are replay guarded.
     */
    function attestPayment(
        bytes32 receiptId,
        bytes32 reportHash,
        bytes32 caseIdHash,
        bytes32 paymentTxHash,
        address payer,
        address asset,
        uint256 amount
    ) external onlyAttestor returns (bytes32) {
        if (
            receiptId == bytes32(0) ||
            reportHash == bytes32(0) ||
            caseIdHash == bytes32(0) ||
            paymentTxHash == bytes32(0)
        ) revert ZeroHash();
        if (payer == address(0) || asset == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (_attestations[receiptId].timestamp != 0) revert DuplicateReceipt(receiptId);
        if (paymentTransactionAttested[paymentTxHash]) {
            revert DuplicatePaymentTransaction(paymentTxHash);
        }

        uint256 timestamp = block.timestamp;
        _attestations[receiptId] = PaymentAttestation({
            reportHash: reportHash,
            caseIdHash: caseIdHash,
            paymentTxHash: paymentTxHash,
            payer: payer,
            asset: asset,
            amount: amount,
            attestor: msg.sender,
            timestamp: timestamp
        });
        paymentTransactionAttested[paymentTxHash] = true;
        attestationCount += 1;

        emit PaymentAttested(
            receiptId,
            reportHash,
            caseIdHash,
            paymentTxHash,
            payer,
            asset,
            amount,
            msg.sender,
            timestamp
        );
        return receiptId;
    }

    function hasAttestation(bytes32 receiptId) external view returns (bool) {
        return _attestations[receiptId].timestamp != 0;
    }

    function getAttestation(bytes32 receiptId) external view returns (PaymentAttestation memory) {
        PaymentAttestation memory attestation = _attestations[receiptId];
        if (attestation.timestamp == 0) revert UnknownReceipt(receiptId);
        return attestation;
    }
}
