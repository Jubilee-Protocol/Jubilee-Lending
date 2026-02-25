// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IChoiceYield {
    function depositRevenue(address asset, uint256 amount) external;
}

interface IFirstFruitsFund {
    function receiveTithe(address token, uint256 amount) external;
}

/**
 * @title FeeCollector
 * @dev Collects all protocol fees and splits them:
 *   - 10% → FirstFruitsFund (charitable tithe)
 *   - 90% → ChoiceYield (staker revenue sharing)
 *
 * Whitepaper (Section 5.1):
 *   "Before any revenue is distributed to token holders or the treasury,
 *    10% of all gross protocol revenue is automatically tithed to the
 *    First Fruits Fund."
 */
contract FeeCollector is Ownable {
    using SafeERC20 for IERC20;

    IChoiceYield public choiceYield;
    IFirstFruitsFund public firstFruitsFund;

    uint256 public constant TITHE_BPS = 1000; // 10% in basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    event FeesCollected(
        address indexed asset,
        uint256 total,
        uint256 tithe,
        uint256 toStakers
    );
    event ChoiceYieldUpdated(address indexed choiceYield);
    event FirstFruitsFundUpdated(address indexed firstFruitsFund);

    constructor(address _choiceYield, address _firstFruitsFund) {
        choiceYield = IChoiceYield(_choiceYield);
        firstFruitsFund = IFirstFruitsFund(_firstFruitsFund);
    }

    function setChoiceYield(address _choiceYield) external onlyOwner {
        choiceYield = IChoiceYield(_choiceYield);
        emit ChoiceYieldUpdated(_choiceYield);
    }

    function setFirstFruitsFund(address _firstFruitsFund) external onlyOwner {
        firstFruitsFund = IFirstFruitsFund(_firstFruitsFund);
        emit FirstFruitsFundUpdated(_firstFruitsFund);
    }

    /**
     * @notice Collect fees and split between FirstFruits (10%) and ChoiceYield (90%).
     * @param asset The token being collected as fees.
     * @param amount The total fee amount.
     */
    function collectFees(address asset, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        // Pull fees from sender
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate split
        uint256 titheAmount = (amount * TITHE_BPS) / BPS_DENOMINATOR;
        uint256 stakerAmount = amount - titheAmount;

        // Send 10% to First Fruits Fund
        if (titheAmount > 0 && address(firstFruitsFund) != address(0)) {
            IERC20(asset).safeApprove(address(firstFruitsFund), 0);
            IERC20(asset).safeApprove(address(firstFruitsFund), titheAmount);
            firstFruitsFund.receiveTithe(asset, titheAmount);
        }

        // Send 90% to ChoiceYield for staker distribution
        if (stakerAmount > 0 && address(choiceYield) != address(0)) {
            IERC20(asset).safeApprove(address(choiceYield), 0);
            IERC20(asset).safeApprove(address(choiceYield), stakerAmount);
            choiceYield.depositRevenue(asset, stakerAmount);
        }

        emit FeesCollected(asset, amount, titheAmount, stakerAmount);
    }

    /**
     * @notice Emergency withdrawal of accidentally sent tokens.
     */
    function withdrawToken(address asset, uint256 amount) external onlyOwner {
        IERC20(asset).safeTransfer(msg.sender, amount);
    }
}
