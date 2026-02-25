// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IJubileeLending {
    function isHealthy(address user) external view returns (bool);
}

interface IChoiceYield {
    function updateReward(address user) external;
}

interface IOracleAggregator {
    function getLatestPrice(address asset) external view returns (uint256);
}

interface IJUBLEmissions {
    function updateReward(address user) external;
}

/**
 * @title JUBLBoost
 * @dev Stake $JUBL to increase borrowing capacity (LTV boost).
 *
 * Whitepaper Formula:
 *   Effective LTV = Base LTV + (Value of Staked $JUBL / Value of Collateral)
 *   Base LTV = 50% (0.5e18)
 *   Max LTV = 70% (0.7e18)
 *   Max Boost = 20% (0.2e18)
 *
 * Example:
 *   $1M collateral + $200K $JUBL staked → LTV = 50% + 20% = 70%
 */
contract JUBLBoost is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable jubl;
    IJubileeLending public lendingContract;
    IChoiceYield public choiceYield;
    IOracleAggregator public oracleAggregator;
    IJUBLEmissions public emissions;

    mapping(address => uint256) public stakedJUBL;
    mapping(address => uint256) public stakeTimestamp; // RT-01: anti-flash-stake
    uint256 public totalStaked;

    uint256 public constant MAX_BOOST = 0.2e18; // 20% max additional LTV
    uint256 public constant MIN_STAKE_DURATION = 7 days; // RT-01: minimum lock

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event LendingContractUpdated(address indexed lendingContract);
    event OracleUpdated(address indexed oracle);

    constructor(address _jubl) {
        jubl = IERC20(_jubl);
    }

    function setLendingContract(address _lendingContract) external onlyOwner {
        lendingContract = IJubileeLending(_lendingContract);
        emit LendingContractUpdated(_lendingContract);
    }

    function setChoiceYield(address _choiceYield) external onlyOwner {
        choiceYield = IChoiceYield(_choiceYield);
    }

    function setOracleAggregator(address _oracleAggregator) external onlyOwner {
        oracleAggregator = IOracleAggregator(_oracleAggregator);
        emit OracleUpdated(_oracleAggregator);
    }

    function setEmissions(address _emissions) external onlyOwner {
        emissions = IJUBLEmissions(_emissions);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        if (address(choiceYield) != address(0)) {
            choiceYield.updateReward(msg.sender);
        }
        // H-02 FIX: Sync emissions before stake change
        if (address(emissions) != address(0)) {
            emissions.updateReward(msg.sender);
        }

        jubl.safeTransferFrom(msg.sender, address(this), amount);
        stakedJUBL[msg.sender] += amount;
        totalStaked += amount;
        stakeTimestamp[msg.sender] = block.timestamp; // RT-01: reset lock timer

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(
            stakedJUBL[msg.sender] >= amount,
            "Insufficient staked balance"
        );
        // RT-01 FIX: Enforce minimum stake duration
        require(
            block.timestamp >= stakeTimestamp[msg.sender] + MIN_STAKE_DURATION,
            "Minimum stake duration not met"
        );

        if (address(choiceYield) != address(0)) {
            choiceYield.updateReward(msg.sender);
        }
        // H-02 FIX: Sync emissions before stake change
        if (address(emissions) != address(0)) {
            emissions.updateReward(msg.sender);
        }

        // RT-04 FIX: Check health BEFORE state changes
        // Simulate the unstake to check health
        stakedJUBL[msg.sender] -= amount;
        totalStaked -= amount;

        if (address(lendingContract) != address(0)) {
            if (!lendingContract.isHealthy(msg.sender)) {
                // Revert state changes and fail
                stakedJUBL[msg.sender] += amount;
                totalStaked += amount;
                revert("Unstaking would cause liquidatability");
            }
        }

        jubl.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Returns the LTV boost for a user based on their staked $JUBL value
     *         relative to a given collateral value.
     * @dev Whitepaper formula: boost = Value of Staked $JUBL / Value of Collateral
     *      Capped at MAX_BOOST (20%).
     * @param user The user address.
     * @param collateralValue The USD value of the user's collateral (in 1e18).
     * @return boost The additional LTV in 1e18 (e.g., 0.2e18 = 20%).
     */
    function getBoost(
        address user,
        uint256 collateralValue
    ) public view returns (uint256) {
        uint256 staked = stakedJUBL[user];
        if (staked == 0 || collateralValue == 0) return 0;

        // Get $JUBL price from oracle
        uint256 jublPrice = _getJUBLPrice();
        if (jublPrice == 0) return 0;

        // Value of staked $JUBL in USD (price is 8 decimals, staked is 18 decimals)
        uint256 stakedValue = (staked * jublPrice) / 1e8;

        // Boost = stakedValue / collateralValue (result in 1e18)
        uint256 boost = (stakedValue * 1e18) / collateralValue;

        return boost > MAX_BOOST ? MAX_BOOST : boost;
    }

    /**
     * @notice Legacy getBoost for backward compatibility (unit-based).
     * @dev When oracle is set, returns 0 since the actual calculation requires
     *      collateral context (use getBoost(user, collateralValue) instead).
     */
    function getBoost(address user) external view returns (uint256) {
        // If oracle is not set, fall back to unit-based boost
        if (address(oracleAggregator) == address(0)) {
            uint256 staked = stakedJUBL[user];
            if (staked == 0) return 0;
            uint256 units = staked / (1000 * 1e18);
            uint256 boost = units * 0.02e18;
            return boost > MAX_BOOST ? MAX_BOOST : boost;
        }

        // C-04 FIX: With oracle set, the actual boost requires collateral context.
        // Return 0 here — CollateralManager should call getBoost(user, collateralValue).
        return 0;
    }

    function _getJUBLPrice() internal view returns (uint256) {
        if (address(oracleAggregator) == address(0)) return 0;

        try oracleAggregator.getLatestPrice(address(jubl)) returns (
            uint256 price
        ) {
            return price;
        } catch {
            return 0;
        }
    }

    /**
     * @notice Returns the USD value of a user's staked $JUBL.
     */
    function getStakedValue(address user) external view returns (uint256) {
        uint256 price = _getJUBLPrice();
        return (stakedJUBL[user] * price) / 1e8;
    }
}
