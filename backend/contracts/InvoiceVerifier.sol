// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title InvoiceVerifier
 * @dev Smart contract for storing and verifying invoice hashes on blockchain
 * This is a Proof of Concept for InvoNest document verification system
 */
contract InvoiceVerifier {
    
    // Structure to store invoice hash information
    struct InvoiceRecord {
        uint256 timestamp;
        string metadata;
        bool exists;
    }
    
    // Mapping from invoice hash to invoice record
    mapping(string => InvoiceRecord) public invoiceHashes;
    
    // Array to store all invoice hashes for enumeration
    string[] public allInvoiceHashes;
    
    // Events
    event InvoiceHashStored(
        string indexed invoiceHash,
        string metadata,
        uint256 timestamp,
        address indexed submitter
    );
    
    event InvoiceHashVerified(
        string indexed invoiceHash,
        bool exists,
        uint256 timestamp
    );
    
    // Owner of the contract
    address public owner;
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Constructor
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Store an invoice hash with metadata
     * @param _invoiceHash The hash of the invoice to store
     * @param _metadata JSON string containing invoice metadata
     * @return The index of the stored hash
     */
    function storeInvoiceHash(
        string memory _invoiceHash,
        string memory _metadata
    ) public returns (uint256) {
        require(bytes(_invoiceHash).length > 0, "Invoice hash cannot be empty");
        require(!invoiceHashes[_invoiceHash].exists, "Invoice hash already exists");
        
        // Store the invoice record
        invoiceHashes[_invoiceHash] = InvoiceRecord({
            timestamp: block.timestamp,
            metadata: _metadata,
            exists: true
        });
        
        // Add to the array for enumeration
        allInvoiceHashes.push(_invoiceHash);
        
        // Emit event
        emit InvoiceHashStored(_invoiceHash, _metadata, block.timestamp, msg.sender);
        
        return allInvoiceHashes.length - 1;
    }
    
    /**
     * @dev Verify if an invoice hash exists and get its information
     * @param _invoiceHash The hash to verify
     * @return exists Whether the hash exists
     * @return timestamp When the hash was stored
     * @return metadata The metadata associated with the hash
     */
    function verifyInvoiceHash(
        string memory _invoiceHash
    ) public view returns (bool exists, uint256 timestamp, string memory metadata) {
        InvoiceRecord memory record = invoiceHashes[_invoiceHash];
        return (record.exists, record.timestamp, record.metadata);
    }
    
    /**
     * @dev Get the total number of stored invoice hashes
     * @return The total count
     */
    function getTotalInvoiceHashes() public view returns (uint256) {
        return allInvoiceHashes.length;
    }
    
    /**
     * @dev Get an invoice hash by index
     * @param _index The index of the hash to retrieve
     * @return The invoice hash at the given index
     */
    function getInvoiceHashByIndex(uint256 _index) public view returns (string memory) {
        require(_index < allInvoiceHashes.length, "Index out of bounds");
        return allInvoiceHashes[_index];
    }
    
    /**
     * @dev Get invoice record by hash
     * @param _invoiceHash The hash to look up
     * @return The complete invoice record
     */
    function getInvoiceRecord(
        string memory _invoiceHash
    ) public view returns (InvoiceRecord memory) {
        return invoiceHashes[_invoiceHash];
    }
    
    /**
     * @dev Batch verify multiple invoice hashes
     * @param _invoiceHashes Array of hashes to verify
     * @return results Array of verification results
     */
    function batchVerifyInvoiceHashes(
        string[] memory _invoiceHashes
    ) public view returns (bool[] memory results) {
        results = new bool[](_invoiceHashes.length);
        
        for (uint256 i = 0; i < _invoiceHashes.length; i++) {
            results[i] = invoiceHashes[_invoiceHashes[i]].exists;
        }
        
        return results;
    }
    
    /**
     * @dev Get all invoice hashes (use with caution for large datasets)
     * @return Array of all stored invoice hashes
     */
    function getAllInvoiceHashes() public view returns (string[] memory) {
        return allInvoiceHashes;
    }
    
    /**
     * @dev Get invoice hashes within a time range
     * @param _startTime Start timestamp
     * @param _endTime End timestamp
     * @return Array of invoice hashes within the time range
     */
    function getInvoiceHashesByTimeRange(
        uint256 _startTime,
        uint256 _endTime
    ) public view returns (string[] memory) {
        require(_startTime <= _endTime, "Invalid time range");
        
        // First pass: count matching hashes
        uint256 count = 0;
        for (uint256 i = 0; i < allInvoiceHashes.length; i++) {
            uint256 timestamp = invoiceHashes[allInvoiceHashes[i]].timestamp;
            if (timestamp >= _startTime && timestamp <= _endTime) {
                count++;
            }
        }
        
        // Second pass: collect matching hashes
        string[] memory result = new string[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allInvoiceHashes.length; i++) {
            uint256 timestamp = invoiceHashes[allInvoiceHashes[i]].timestamp;
            if (timestamp >= _startTime && timestamp <= _endTime) {
                result[index] = allInvoiceHashes[i];
                index++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Emergency function to transfer ownership
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be zero address");
        owner = _newOwner;
    }
    
    /**
     * @dev Get contract information
     * @return contractOwner The owner address
     * @return totalHashes Total number of stored hashes
     * @return contractBalance Contract balance in wei
     */
    function getContractInfo() public view returns (
        address contractOwner,
        uint256 totalHashes,
        uint256 contractBalance
    ) {
        return (owner, allInvoiceHashes.length, address(this).balance);
    }
    
    /**
     * @dev Fallback function to receive Ether
     */
    receive() external payable {
        // Contract can receive Ether
    }
    
    /**
     * @dev Withdraw contract balance (only owner)
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}
