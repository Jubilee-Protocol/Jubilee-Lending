// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GrantsModule
 * @notice Quarterly grant distribution based on community votes.
 */
contract GrantsModule is Ownable {
    
    struct Grant {
        uint256 id;
        address recipient;
        uint256 amount;
        string description;
        bool approved;
        bool distributed;
    }

    mapping(uint256 => Grant) public grants;
    uint256 public grantCounter;
    
    IERC20 public paymentToken; // e.g. jUSDi

    event GrantProposed(uint256 indexed id, address indexed recipient, uint256 amount);
    event GrantApproved(uint256 indexed id);
    event GrantDistributed(uint256 indexed id, uint256 amount);

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
    }

    function proposeGrant(address recipient, uint256 amount, string memory description) external {
        grantCounter++;
        grants[grantCounter] = Grant({
            id: grantCounter,
            recipient: recipient,
            amount: amount,
            description: description,
            approved: false,
            distributed: false
        });
        emit GrantProposed(grantCounter, recipient, amount);
    }

    function approveGrant(uint256 id) external onlyOwner {
        require(grants[id].id != 0, "Grant does not exist");
        grants[id].approved = true;
        emit GrantApproved(id);
    }

    function distributeGrant(uint256 id) external {
        Grant storage grant = grants[id];
        require(grant.approved, "Not approved");
        require(!grant.distributed, "Already distributed");

        grant.distributed = true;
        paymentToken.transfer(grant.recipient, grant.amount);
        
        emit GrantDistributed(id, grant.amount);
    }
}
