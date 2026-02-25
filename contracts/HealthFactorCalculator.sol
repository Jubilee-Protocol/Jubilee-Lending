// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

/**
 * @title HealthFactorCalculator
 * @dev Library or contract for calculating and monitoring health factors.
 */
library HealthFactorCalculator {
    /**
     * @dev Calculates the health factor of a loan.
     * HF = (Collateral Value * Collateral Factor) / Borrowed Value
     * @param borrowedValue The total borrowed value (in 1e18).
     * @param collateralValue The total collateral value (in 1e18).
     * @param collateralFactor The collateral factor (in 1e18, 0.75e18 = 75%).
     * @return The health factor (in 1e18).
     */
    function calculate(
        uint256 borrowedValue,
        uint256 collateralValue,
        uint256 collateralFactor
    ) internal pure returns (uint256) {
        if (borrowedValue == 0) return type(uint256).max;

        uint256 adjustedCollateral = (collateralValue * collateralFactor) /
            1e18;
        return (adjustedCollateral * 1e18) / borrowedValue;
    }

    function isHealthy(uint256 healthFactor) internal pure returns (bool) {
        return healthFactor >= 1e18;
    }
}
