// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IJubileeLending {
    function applyYieldRepayment(uint256 loanId, uint256 amount) external;
    function jUSDi() external view returns (address);
}

interface IJIndex {
    function claimYield() external returns (uint256);
}

/**
 * @title YieldRouter
 * @dev Route collateral yield to loan repayment.
 */
contract YieldRouter is Ownable, ReentrancyGuard {
    IJubileeLending public lendingContract;
    mapping(address => address) public yieldSources; // Asset -> Index Contract
    uint256 public yieldRepaymentRate; // Percentage of yield to apply to debt (e.g., 100%)

    event YieldApplied(uint256 indexed loanId, uint256 amount);
    event YieldSourceSet(address indexed asset, address indexed source);

    constructor(address _lendingContract) {
        lendingContract = IJubileeLending(_lendingContract);
        yieldRepaymentRate = 1e18; // Default 100%
    }

    function setYieldSource(address asset, address source) external onlyOwner {
        yieldSources[asset] = source;
        emit YieldSourceSet(asset, source);
    }

    function setYieldRepaymentRate(uint256 rate) external onlyOwner {
        require(rate <= 1e18, "Rate cannot exceed 100%");
        yieldRepaymentRate = rate;
    }

    // Simplified yield routing logic matching whitepaper spec
    function routeYield(
        address user,
        uint256 loanId,
        uint256 yieldAmount
    ) public onlyOwner nonReentrant {
        // This function matches the conceptual spec:
        // function routeYield(address user, uint256 yieldAmount) external onlyVault

        // In our implementation, we route by loanId (which maps to user)
        // Access control: Should be callable by the Vaults/Indexes when they harvest

        uint256 amountToApply = (yieldAmount * yieldRepaymentRate) / 1e18;

        // Approve lending contract to take the jUSDi (assuming yield is converted to jUSDi before calling this)
        address jusdi = address(
            IJubileeLending(address(lendingContract)).jUSDi()
        );

        // Check allowance
        if (
            IERC20(jusdi).allowance(address(this), address(lendingContract)) <
            amountToApply
        ) {
            IERC20(jusdi).approve(address(lendingContract), type(uint256).max);
        }

        lendingContract.applyYieldRepayment(loanId, amountToApply);

        emit YieldApplied(loanId, amountToApply);
    }

    // Original function kept for backward compat with deployed contracts
    function routeYieldToRepayment(
        uint256 loanId,
        uint256 yieldAmount
    ) external onlyOwner {
        routeYield(address(0), loanId, yieldAmount);
    }

    // Function to trigger yield collection from index and application to loan
    function harvestAndApply(
        uint256 loanId,
        address collateralAsset
    ) external onlyOwner nonReentrant {
        address source = yieldSources[collateralAsset];
        require(source != address(0), "No yield source");

        uint256 claimedYield = IJIndex(source).claimYield();
        if (claimedYield > 0) {
            this.routeYieldToRepayment(loanId, claimedYield);
        }
    }
}
