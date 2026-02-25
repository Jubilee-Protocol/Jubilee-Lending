// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IJUBLBoost {
    function stakedJUBL(address user) external view returns (uint256);
    function totalStaked() external view returns (uint256);
}

/**
 * @title ChoiceYield
 * @dev Revenue distribution for $JUBL stakers with asset choice.
 *
 * Whitepaper (Section 5.3):
 *   "Users can call claimRewards() to receive their share. They have the
 *    flexibility to claim their rewards in jBTCi, jETHs, or a proportional
 *    mix of both."
 *
 * Revenue flows in from FeeCollector (the 90% after First Fruits Tithe).
 * Rewards accrue per-token-staked using Synthetix-style accounting.
 */
contract ChoiceYield is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error OnlyJUBLBoost();

    IJUBLBoost public jublBoost;
    address public feeCollector; // RT-05: restrict depositRevenue caller

    // Supported reward assets (e.g., jBTCi, jETHs)
    address[] public rewardAssets;
    mapping(address => bool) public isRewardAsset;

    // Per-asset reward accounting
    mapping(address => uint256) public rewardPerTokenStored;
    mapping(address => mapping(address => uint256))
        public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public rewards;

    event RevenueReceived(address indexed asset, uint256 amount);
    event RewardClaimed(
        address indexed user,
        address indexed asset,
        uint256 amount
    );
    event RewardAssetAdded(address indexed asset);
    event RewardAssetRemoved(address indexed asset);

    constructor(address _jublBoost) {
        require(_jublBoost != address(0), "Invalid JUBLBoost"); // L-02
        jublBoost = IJUBLBoost(_jublBoost);
    }

    modifier onlyJUBLBoost() {
        if (msg.sender != address(jublBoost)) revert OnlyJUBLBoost();
        _;
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function addRewardAsset(address asset) external onlyOwner {
        require(!isRewardAsset[asset], "Already added");
        rewardAssets.push(asset);
        isRewardAsset[asset] = true;
        emit RewardAssetAdded(asset);
    }

    function setJUBLBoost(address _jublBoost) external onlyOwner {
        jublBoost = IJUBLBoost(_jublBoost);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
    }

    // ─── Reward Accounting ───────────────────────────────────────────

    /**
     * @notice Called by JUBLBoost before stake/unstake to snapshot rewards.
     */
    function updateReward(address user) external onlyJUBLBoost {
        _updateAllRewards(user);
    }

    /**
     * @notice Called by FeeCollector to deposit revenue for distribution.
     */
    function depositRevenue(address asset, uint256 amount) external {
        // RT-05 FIX: Only FeeCollector can deposit revenue
        require(
            feeCollector == address(0) || msg.sender == feeCollector,
            "Only FeeCollector"
        );
        // H-05 FIX: Only accept registered reward assets (no auto-add)
        require(isRewardAsset[asset], "Asset not registered");
        require(amount > 0, "Amount must be > 0");

        uint256 totalStaked = jublBoost.totalStaked();
        if (totalStaked > 0) {
            rewardPerTokenStored[asset] += (amount * 1e18) / totalStaked;
        }

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit RevenueReceived(asset, amount);
    }

    // ─── Claiming ────────────────────────────────────────────────────

    /**
     * @notice Claim rewards for a specific asset.
     */
    function claimReward(address asset) external nonReentrant {
        _updateAllRewards(msg.sender);
        uint256 reward = rewards[asset][msg.sender];
        if (reward > 0) {
            rewards[asset][msg.sender] = 0;
            IERC20(asset).safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, asset, reward);
        }
    }

    /**
     * @notice Claim all rewards across all assets at once.
     */
    function claimAllRewards() external nonReentrant {
        _updateAllRewards(msg.sender);
        for (uint256 i = 0; i < rewardAssets.length; i++) {
            address asset = rewardAssets[i];
            uint256 reward = rewards[asset][msg.sender];
            if (reward > 0) {
                rewards[asset][msg.sender] = 0;
                IERC20(asset).safeTransfer(msg.sender, reward);
                emit RewardClaimed(msg.sender, asset, reward);
            }
        }
    }

    // ─── View ────────────────────────────────────────────────────────

    /**
     * @notice View pending rewards for a user across all assets.
     */
    function pendingRewards(
        address user
    )
        external
        view
        returns (address[] memory assets, uint256[] memory amounts)
    {
        assets = rewardAssets;
        amounts = new uint256[](rewardAssets.length);
        for (uint256 i = 0; i < rewardAssets.length; i++) {
            amounts[i] = calculateReward(user, rewardAssets[i]);
        }
    }

    function calculateReward(
        address user,
        address asset
    ) public view returns (uint256) {
        uint256 staked = jublBoost.stakedJUBL(user);
        return
            (staked *
                (rewardPerTokenStored[asset] -
                    userRewardPerTokenPaid[asset][user])) /
            1e18 +
            rewards[asset][user];
    }

    function getRewardAssetCount() external view returns (uint256) {
        return rewardAssets.length;
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _updateAllRewards(address user) internal {
        for (uint256 i = 0; i < rewardAssets.length; i++) {
            address asset = rewardAssets[i];
            rewards[asset][user] = calculateReward(user, asset);
            userRewardPerTokenPaid[asset][user] = rewardPerTokenStored[asset];
        }
    }
}
