// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title JUBL
 * @dev The Jubilee Protocol governance and utility token.
 *
 * Fixed supply of 1,000,000,000 (1B) tokens.
 * Role-based minting restricted to authorized contracts (e.g., JUBLEmissions).
 * Burnable by any holder.
 *
 * Allocation (minted via authorized contracts or constructor):
 * - 25% Staking Rewards (via JUBLEmissions)
 * - 20% Community & Ecosystem
 * - 15% Team & Advisors (via JUBLVesting)
 * - 15% Treasury
 * - 10% Liquidity
 * - 10% Early Supporters
 * - 5% First Fruits Fund
 */
contract JUBL is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1 Billion

    /// @notice Tracks total tokens ever minted (including burned tokens)
    uint256 public totalMinted;

    error ExceedsMaxSupply();

    constructor(address treasury) ERC20("Jubilee Token", "JUBL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Initial allocation to treasury for distribution
        // Team/advisor tokens should be sent to JUBLVesting contract
        // Staking rewards should be sent to JUBLEmissions contract
        uint256 initialMint = 750_000_000 * 1e18; // 75% (everything except staking rewards)
        _mintWithCap(treasury, initialMint);
    }

    /**
     * @notice Mint tokens to an address (restricted to MINTER_ROLE).
     * @dev Used by JUBLEmissions for staking reward distribution.
     * @param to Recipient address.
     * @param amount Amount to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mintWithCap(to, amount);
    }

    /**
     * @dev Internal mint that enforces the hard cap.
     */
    function _mintWithCap(address to, uint256 amount) internal {
        if (totalMinted + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        totalMinted += amount;
        _mint(to, amount);
    }

    /**
     * @notice Returns the remaining mintable supply.
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }
}
