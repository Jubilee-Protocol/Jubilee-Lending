// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title FirstFruitsFund
 * @dev Receives 10% of all gross protocol revenue (the "First Fruits Tithe").
 *
 * This fund is governed by the Jubilee Council (initially a multisig)
 * and is dedicated to supporting whitelisted charitable organizations
 * and faith-based initiatives.
 *
 * Whitepaper (Section 5.1):
 *   "Before any revenue is distributed to token holders or the treasury,
 *    10% of all gross protocol revenue is automatically tithed to the
 *    First Fruits Fund."
 */
contract FirstFruitsFund is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public whitelistedRecipients;

    event RecipientWhitelisted(address indexed recipient, bool status);
    event FundsReceived(address indexed token, uint256 amount);
    event FundsDisbursed(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @notice Whitelist or remove a charitable recipient.
     */
    function setRecipient(address recipient, bool status) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        whitelistedRecipients[recipient] = status;
        emit RecipientWhitelisted(recipient, status);
    }

    /**
     * @notice Called by FeeCollector to deposit the 10% tithe.
     */
    function receiveTithe(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit FundsReceived(token, amount);
    }

    /**
     * @notice Disburse funds to a whitelisted charitable organization.
     */
    function disburse(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        require(whitelistedRecipients[recipient], "Recipient not whitelisted");
        require(amount > 0, "Amount must be > 0");
        IERC20(token).safeTransfer(recipient, amount);
        emit FundsDisbursed(token, recipient, amount);
    }

    /**
     * @notice View the balance of a specific token held by this fund.
     */
    function balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
