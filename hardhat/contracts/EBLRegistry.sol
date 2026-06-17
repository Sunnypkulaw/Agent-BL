// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EBLRegistry (WEB3-1)
/// @notice Minimal electronic bill of lading registry: mint, pledge, release.
/// @dev Aligns with docs/contracts.md §3. Not an NFT marketplace.
contract EBLRegistry {
    address public owner;
    uint256 public nextEblId = 1;

    mapping(uint256 => address) private _holder;
    mapping(uint256 => address) private _pledgedTo;
    mapping(uint256 => bytes32) private _metadataHash;

    event EBLMinted(uint256 indexed eblId, bytes32 indexed metadataHash, address indexed holder);
    event EBLPledged(uint256 indexed eblId, address indexed pool, address indexed holder);
    event EBLPledgeReleased(uint256 indexed eblId, address indexed pool, address indexed holder);

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
        eblId = nextEblId++;
        _holder[eblId] = holder;
        _metadataHash[eblId] = metadataHash;
        emit EBLMinted(eblId, metadataHash, holder);
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
}
