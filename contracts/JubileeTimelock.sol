// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title JubileeTimelock
 * @dev Simple timelock controller for admin operations.
 *
 * M-01 Fix: All sensitive admin operations should go through this timelock.
 * Operations must be queued and can only be executed after DELAY has passed.
 *
 * Deploy this, then transfer ownership of all admin contracts to this timelock.
 */
contract JubileeTimelock is AccessControl {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint256 public constant MIN_DELAY = 24 hours;
    uint256 public delay;

    struct Operation {
        address target;
        bytes data;
        uint256 readyTimestamp;
        bool executed;
    }

    mapping(bytes32 => Operation) public operations;

    event OperationQueued(
        bytes32 indexed opId,
        address indexed target,
        uint256 readyTimestamp
    );
    event OperationExecuted(bytes32 indexed opId, address indexed target);
    event OperationCancelled(bytes32 indexed opId);
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);

    constructor(uint256 _delay, address admin) {
        require(_delay >= MIN_DELAY, "Delay too short");
        require(admin != address(0), "Invalid admin");
        delay = _delay;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }

    /**
     * @notice Queue an admin operation for future execution.
     */
    function queue(
        address target,
        bytes calldata data,
        bytes32 salt
    ) external onlyRole(PROPOSER_ROLE) returns (bytes32) {
        bytes32 opId = keccak256(abi.encode(target, data, salt));
        require(operations[opId].readyTimestamp == 0, "Already queued");

        uint256 readyAt = block.timestamp + delay;
        operations[opId] = Operation({
            target: target,
            data: data,
            readyTimestamp: readyAt,
            executed: false
        });

        emit OperationQueued(opId, target, readyAt);
        return opId;
    }

    /**
     * @notice Execute a queued operation after the delay has passed.
     */
    function execute(bytes32 opId) external onlyRole(EXECUTOR_ROLE) {
        Operation storage op = operations[opId];
        require(op.readyTimestamp > 0, "Not queued");
        require(!op.executed, "Already executed");
        require(block.timestamp >= op.readyTimestamp, "Not ready");

        op.executed = true;

        (bool success, ) = op.target.call(op.data);
        require(success, "Execution failed");

        emit OperationExecuted(opId, op.target);
    }

    /**
     * @notice Cancel a queued (not yet executed) operation.
     */
    function cancel(bytes32 opId) external onlyRole(PROPOSER_ROLE) {
        Operation storage op = operations[opId];
        require(op.readyTimestamp > 0, "Not queued");
        require(!op.executed, "Already executed");

        delete operations[opId];
        emit OperationCancelled(opId);
    }

    /**
     * @notice Update the timelock delay (requires going through the timelock itself).
     */
    function setDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDelay >= MIN_DELAY, "Delay too short");
        emit DelayUpdated(delay, newDelay);
        delay = newDelay;
    }

    /**
     * @notice Check if an operation is ready.
     */
    function isReady(bytes32 opId) external view returns (bool) {
        Operation storage op = operations[opId];
        return
            op.readyTimestamp > 0 &&
            !op.executed &&
            block.timestamp >= op.readyTimestamp;
    }
}
