// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./HealthFactorCalculator.sol";

interface IJUBLBoost {
    function getBoost(address user) external view returns (uint256);
    function getBoost(
        address user,
        uint256 collateralValue
    ) external view returns (uint256);
}

interface IOracleAggregator {
    function getLatestPrice(address asset) external view returns (uint256);
}

/**
 * @title CollateralManager
 * @dev Multi-asset collateral tracking and valuation.
 */
contract CollateralManager is Ownable {
    using HealthFactorCalculator for uint256;

    mapping(address => uint256) public collateralFactors; // Base LTV in 1e18 (e.g., 0.5e18 = 50%)
    uint256 public constant MAX_COLLATERAL_FACTOR = 0.95e18; // M-05: 95% cap
    IJUBLBoost public jublBoost;
    IOracleAggregator public oracleAggregator;

    event CollateralFactorUpdated(address indexed asset, uint256 newFactor);
    event OracleAggregatorUpdated(address indexed oracleAggregator);
    event JUBLBoostUpdated(address indexed jublBoost);

    constructor(address _oracleAggregator) {
        require(_oracleAggregator != address(0), "Invalid oracle"); // L-01
        oracleAggregator = IOracleAggregator(_oracleAggregator);
    }

    function setCollateralFactor(
        address asset,
        uint256 factor
    ) external onlyOwner {
        require(asset != address(0), "Invalid asset"); // L-01
        require(factor <= MAX_COLLATERAL_FACTOR, "Factor exceeds max"); // M-05
        collateralFactors[asset] = factor;
        emit CollateralFactorUpdated(asset, factor);
    }

    function setOracleAggregator(address _oracleAggregator) external onlyOwner {
        oracleAggregator = IOracleAggregator(_oracleAggregator);
        emit OracleAggregatorUpdated(_oracleAggregator);
    }

    function setJUBLBoost(address _jublBoost) external onlyOwner {
        jublBoost = IJUBLBoost(_jublBoost);
        emit JUBLBoostUpdated(_jublBoost);
    }

    /**
     * @notice Returns the effective collateral factor (Base LTV + JUBL Boost).
     * @dev Uses dollar-value based boost when collateral value context is available.
     */
    function getBoostedCollateralFactor(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 baseFactor = collateralFactors[asset];
        if (address(jublBoost) == address(0)) return baseFactor;

        // Use the legacy getBoost(user) for backward compat
        uint256 boost = jublBoost.getBoost(user);
        return baseFactor + boost;
    }

    function getCollateralValue(
        address asset,
        uint256 amount
    ) public view returns (uint256) {
        uint256 price = oracleAggregator.getLatestPrice(asset);
        // Assuming price is in 8 decimals, adjusting to 1e18
        return (amount * price) / 1e8;
    }

    function calculateHealthFactor(
        uint256 borrowedValue,
        uint256 collateralValue,
        uint256 collateralFactor
    ) public pure returns (uint256) {
        return
            HealthFactorCalculator.calculate(
                borrowedValue,
                collateralValue,
                collateralFactor
            );
    }
}
