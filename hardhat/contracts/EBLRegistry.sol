// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EBLRegistry V2 (WEB3-12/13/14)
/// @notice Unique-cargo eBL registry with structured metadata, endorsement,
///         transfer history and pledge-aware custody controls.
contract EBLRegistry {
    struct EBLMetadata {
        string vessel;
        string voyage;
        string portOfLoading;
        string portOfDischarge;
        string cargo;
        uint256 quantity;
        string quantityUnit;
        string hsCode;
        uint256 declaredValueUsdE6;
        string incoterms;
        bool mletr;
        bool eucp;
        bool dcsa;
    }

    struct TransferRecord {
        address from;
        address to;
        address endorser;
        bytes32 endorsementHash;
        uint64 timestamp;
    }

    address public owner;
    uint256 public nextEblId = 1;

    mapping(uint256 => address) private _holder;
    mapping(uint256 => address) private _pledgedTo;
    mapping(uint256 => bytes32) private _metadataHash;
    mapping(uint256 => bytes32) private _cargoHash;
    mapping(bytes32 => uint256) private _cargoEblId;
    mapping(uint256 => EBLMetadata) private _metadata;
    mapping(uint256 => TransferRecord[]) private _transferHistory;

    event EBLMinted(uint256 indexed eblId, bytes32 indexed metadataHash, address indexed holder);
    event EBLPledged(uint256 indexed eblId, address indexed pool, address indexed holder);
    event EBLPledgeReleased(uint256 indexed eblId, address indexed pool, address indexed holder);
    event EBLMintedV2(
        uint256 indexed eblId,
        bytes32 indexed cargoHash,
        bytes32 indexed metadataHash,
        address holder
    );
    event EBLTransferred(uint256 indexed eblId, address indexed from, address indexed to);
    event EBLEndorsed(
        uint256 indexed eblId,
        address indexed from,
        address indexed to,
        bytes32 endorsementHash
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function mintEBL(bytes32 metadataHash, address holder) external onlyOwner returns (uint256 eblId) {
        require(metadataHash != bytes32(0), "metadataHash=0");
        require(holder != address(0), "holder=0");
        bytes32 legacyCargoHash = keccak256(abi.encodePacked("legacy", metadataHash, holder, nextEblId));
        EBLMetadata memory emptyMetadata;
        eblId = _mint(legacyCargoHash, metadataHash, holder, emptyMetadata);
    }

    function mintEBLV2(
        bytes32 cargoHash,
        bytes32 metadataHash,
        address holder,
        EBLMetadata calldata metadata
    ) external onlyOwner returns (uint256 eblId) {
        require(cargoHash != bytes32(0), "cargoHash=0");
        require(metadataHash != bytes32(0), "metadataHash=0");
        require(holder != address(0), "holder=0");
        require(bytes(metadata.cargo).length > 0, "cargo empty");
        require(metadata.quantity > 0, "quantity=0");
        require(bytes(metadata.hsCode).length > 0, "hsCode empty");
        eblId = _mint(cargoHash, metadataHash, holder, metadata);
    }

    function _mint(
        bytes32 cargoHash,
        bytes32 metadataHash,
        address holder,
        EBLMetadata memory metadata
    ) internal returns (uint256 eblId) {
        require(_cargoEblId[cargoHash] == 0, "cargo already registered");
        eblId = nextEblId++;
        _holder[eblId] = holder;
        _metadataHash[eblId] = metadataHash;
        _cargoHash[eblId] = cargoHash;
        _cargoEblId[cargoHash] = eblId;
        _metadata[eblId] = metadata;
        _transferHistory[eblId].push(TransferRecord({
            from: address(0),
            to: holder,
            endorser: owner,
            endorsementHash: bytes32(0),
            timestamp: uint64(block.timestamp)
        }));
        emit EBLMinted(eblId, metadataHash, holder);
        emit EBLMintedV2(eblId, cargoHash, metadataHash, holder);
    }

    function pledge(uint256 eblId, address pool) external {
        require(_holder[eblId] != address(0), "ebl missing");
        require(_pledgedTo[eblId] == address(0), "already pledged");
        require(pool != address(0), "pool=0");
        require(msg.sender == _holder[eblId] || msg.sender == owner, "not authorized");
        _pledgedTo[eblId] = pool;
        emit EBLPledged(eblId, pool, _holder[eblId]);
    }

    function releasePledge(uint256 eblId) external {
        address pool = _pledgedTo[eblId];
        require(pool != address(0), "not pledged");
        require(msg.sender == pool || msg.sender == owner, "not authorized");
        _pledgedTo[eblId] = address(0);
        emit EBLPledgeReleased(eblId, pool, _holder[eblId]);
    }

    function holderOf(uint256 eblId) external view returns (address) {
        return _holder[eblId];
    }

    function pledgedTo(uint256 eblId) external view returns (address) {
        return _pledgedTo[eblId];
    }

    function metadataHashOf(uint256 eblId) external view returns (bytes32) {
        return _metadataHash[eblId];
    }

    function cargoHashOf(uint256 eblId) external view returns (bytes32) {
        return _cargoHash[eblId];
    }

    function isUnique(bytes32 cargoHash) external view returns (bool) {
        return cargoHash != bytes32(0) && _cargoEblId[cargoHash] == 0;
    }

    function eblIdForCargo(bytes32 cargoHash) external view returns (uint256) {
        return _cargoEblId[cargoHash];
    }

    function metadataOf(uint256 eblId) external view returns (EBLMetadata memory) {
        require(_holder[eblId] != address(0), "ebl missing");
        return _metadata[eblId];
    }

    function transfer(uint256 eblId, address to) external {
        _transfer(eblId, to, bytes32(0), false);
    }

    function endorse(uint256 eblId, address to, bytes32 endorsementHash) external {
        require(endorsementHash != bytes32(0), "endorsementHash=0");
        _transfer(eblId, to, endorsementHash, true);
    }

    function _transfer(uint256 eblId, address to, bytes32 endorsementHash, bool endorsed) internal {
        address from = _holder[eblId];
        require(from != address(0), "ebl missing");
        require(msg.sender == from, "not holder");
        require(to != address(0), "to=0");
        require(to != from, "same holder");
        require(_pledgedTo[eblId] == address(0), "ebl pledged");
        _holder[eblId] = to;
        _transferHistory[eblId].push(TransferRecord({
            from: from,
            to: to,
            endorser: msg.sender,
            endorsementHash: endorsementHash,
            timestamp: uint64(block.timestamp)
        }));
        emit EBLTransferred(eblId, from, to);
        if (endorsed) emit EBLEndorsed(eblId, from, to, endorsementHash);
    }

    function getTransferHistory(uint256 eblId) external view returns (TransferRecord[] memory) {
        require(_holder[eblId] != address(0), "ebl missing");
        return _transferHistory[eblId];
    }
}
