// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IJubileeLending {
    struct Loan {
        uint256 id;
        address borrower;
        address collateralAsset;
        uint256 collateralAmount;
        uint256 borrowedAmount;
        bool active;
    }
    function loans(
        uint256 id
    ) external view returns (uint256, address, address, uint256, uint256, bool);
    function liquidateLoan(
        uint256 loanId,
        address liquidator,
        uint256 debtToRepay
    ) external returns (uint256 collateralToLiquidator);
}

interface ICollateralManager {
    function getCollateralValue(
        address asset,
        uint256 amount
    ) external view returns (uint256);
    function calculateHealthFactor(
        uint256 borrowedValue,
        uint256 collateralValue,
        uint256 collateralFactor
    ) external pure returns (uint256);
    function collateralFactors(address asset) external view returns (uint256);
    function getBoostedCollateralFactor(
        address user,
        address asset
    ) external view returns (uint256);
}

/**
 * @title LiquidationEngine
 * @dev Health factor monitoring and liquidation execution.
 */
contract LiquidationEngine is Ownable {
    IJubileeLending public lendingContract;
    ICollateralManager public collateralManager;
    uint256 public constant MIN_HEALTH_FACTOR = 1e18; // 1.0
    uint256 public constant LIQUIDATION_BONUS = 0.05e18; // 5% bonus for liquidators

    event Liquidated(
        uint256 indexed loanId,
        address indexed liquidator,
        uint256 amountLiquidated,
        uint256 collateralSeized
    );

    constructor(address _lendingContract, address _collateralManager) {
        lendingContract = IJubileeLending(_lendingContract);
        collateralManager = ICollateralManager(_collateralManager);
    }

    function liquidate(uint256 loanId, uint256 debtToRepay) external {
        (
            ,
            address borrower,
            address collateralAsset,
            uint256 collateralAmount,
            uint256 borrowedAmount,
            bool active
        ) = lendingContract.loans(loanId);
        require(active, "Loan not active");
        require(borrowedAmount > 0, "No debt to liquidate");

        uint256 collateralValue = collateralManager.getCollateralValue(
            collateralAsset,
            collateralAmount
        );
        // C-03 FIX: Use getBoostedCollateralFactor to respect JUBL staking boost
        uint256 collateralFactor = collateralManager.getBoostedCollateralFactor(
            borrower,
            collateralAsset
        );
        uint256 healthFactor = collateralManager.calculateHealthFactor(
            borrowedAmount,
            collateralValue,
            collateralFactor
        );

        require(healthFactor < MIN_HEALTH_FACTOR, "Loan is healthy");

        // Call lending contract to execute liquidation
        uint256 collateralSeized = lendingContract.liquidateLoan(
            loanId,
            msg.sender,
            debtToRepay
        );

        emit Liquidated(loanId, msg.sender, debtToRepay, collateralSeized);
    }
}
