// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPausable {
    function pause() external;
    function unpause() external;
}

/**
 * @title EmergencyModule
 * @dev Circuit breakers and emergency pause management.
 */
contract EmergencyModule is AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address[] public managedContracts;

    event ContractAdded(address indexed target);
    event EmergencyPauseTriggered(address indexed account);
    event EmergencyUnpauseTriggered(address indexed account);

    constructor(address admin) {
        require(admin != address(0), "Invalid admin"); // L-01
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function addManagedContract(address target) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Caller is not an admin"
        );
        managedContracts.push(target);
        emit ContractAdded(target);
    }

    function emergencyPauseAll() external {
        require(hasRole(PAUSER_ROLE, msg.sender), "Caller is not a pauser");
        for (uint256 i = 0; i < managedContracts.length; i++) {
            IPausable(managedContracts[i]).pause();
        }
        emit EmergencyPauseTriggered(msg.sender);
    }

    function emergencyUnpauseAll() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Caller is not an admin"
        );
        for (uint256 i = 0; i < managedContracts.length; i++) {
            IPausable(managedContracts[i]).unpause();
        }
        emit EmergencyUnpauseTriggered(msg.sender);
    }
}
