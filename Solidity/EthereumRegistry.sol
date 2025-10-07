// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Travelon Blockchain Registry
/// @notice Stores immutable hashes for tourists, alerts, and audit logs
/// @dev Suitable for private or consortium Ethereum networks

contract TravelonRegistry {

    address public immutable owner; 
    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }
    struct Tourist {
        uint256 id;          
        string name;         
        string kycType;      
        bytes32 kycHash;     
        bool approved;       
        uint256 timestamp;   
    }

    uint256 public touristCount = 0;
    mapping(uint256 => Tourist) public tourists;

    event TouristRegistered(uint256 indexed touristId, string name, bytes32 kycHash);
    event TouristApprovalUpdated(uint256 indexed touristId, bool approved);

    /// @notice Register a new tourist
    function registerTourist(
        string calldata _name,
        string calldata _kycType,
        bytes32 _kycHash,
        bool _approved
    ) external onlyOwner returns (uint256) {
        touristCount++;
        tourists[touristCount] = Tourist(
            touristCount,
            _name,
            _kycType,
            _kycHash,
            _approved,
            block.timestamp
        );
        emit TouristRegistered(touristCount, _name, _kycHash);
        return touristCount;
    }

    /// @notice Update tourist approval
    function updateApproval(uint256 _touristId, bool _approved) external onlyOwner {
        require(_touristId > 0 && _touristId <= touristCount, "Invalid tourist ID");
        tourists[_touristId].approved = _approved;
        emit TouristApprovalUpdated(_touristId, _approved);
    }

    /// @notice Verify tourist KYC hash
    function verifyTouristKYC(uint256 _touristId, bytes32 _kycHash) external view returns (bool) {
        require(_touristId > 0 && _touristId <= touristCount, "Invalid tourist ID");
        return tourists[_touristId].kycHash == _kycHash;
    }

    struct Alert {
        uint256 alertId;
        uint256 touristId;
        bytes32 alertHash;   
        uint256 timestamp;
    }

    uint256 public alertCount = 0;
    mapping(uint256 => Alert) public alerts;

    event AlertLogged(uint256 indexed alertId, uint256 indexed touristId, bytes32 alertHash);

    /// @notice Log a critical alert (SOS, geofence breach)
    function logAlert(uint256 _touristId, bytes32 _alertHash) external onlyOwner returns (uint256) {
        require(_touristId > 0 && _touristId <= touristCount, "Invalid tourist ID");
        alertCount++;
        alerts[alertCount] = Alert(alertCount, _touristId, _alertHash, block.timestamp);
        emit AlertLogged(alertCount, _touristId, _alertHash);
        return alertCount;
    }

    /// @notice Verify an alert hash
    function verifyAlert(uint256 _alertId, bytes32 _alertHash) external view returns (bool) {
        require(_alertId > 0 && _alertId <= alertCount, "Invalid alert ID");
        return alerts[_alertId].alertHash == _alertHash;
    }

    struct Agency {
        uint256 agencyId;
        string name;
        bool approved;
        uint256 timestamp;
    }

    uint256 public agencyCount = 0;
    mapping(uint256 => Agency) public agencies;

    event AgencyRegistered(uint256 indexed agencyId, string name, bool approved);

    /// @notice Register a travel agency
    function registerAgency(string calldata _name, bool _approved) external onlyOwner returns (uint256) {
        agencyCount++;
        agencies[agencyCount] = Agency(agencyCount, _name, _approved, block.timestamp);
        emit AgencyRegistered(agencyCount, _name, _approved);
        return agencyCount;
    }

    /// @notice Update agency approval
    function updateAgencyApproval(uint256 _agencyId, bool _approved) external onlyOwner {
        require(_agencyId > 0 && _agencyId <= agencyCount, "Invalid agency ID");
        agencies[_agencyId].approved = _approved;
        emit AgencyRegistered(_agencyId, agencies[_agencyId].name, _approved);
    }
}
