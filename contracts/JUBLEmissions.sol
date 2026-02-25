// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title JUBLEmissions
 * @dev Distributes staking rewards on a logarithmic decay schedule.
 *
 * 25% of JUBL supply (250M tokens) is allocated for staking rewards.
 * Emissions halve each year for 4-5 years, rewarding early participants.
 *
 * Year 1: ~125M tokens
 * Year 2: ~62.5M tokens
 * Year 3: ~31.25M tokens
 * Year 4: ~15.625M tokens
 * Year 5: ~15.625M tokens (remaining supply)
 *
 * Rewards are distributed per-second to stakers via JUBLBoost.
 */

interface IJUBL {
    function mint(address to, uint256 amount) external;
    function remainingMintableSupply() external view returns (uint256);
}

interface IJUBLBoost {
    function stakedJUBL(address user) external view returns (uint256);
    function totalStaked() external view returns (uint256);
}

contract JUBLEmissions is Ownable, ReentrancyGuard {
    IJUBL public jubl;
    IJUBLBoost public jublBoost;

    uint256 public constant TOTAL_EMISSION = 250_000_000 * 1e18; // 250M tokens
    uint256 public constant YEAR = 365 days;

    uint256 public emissionStart;
    uint256 public totalEmitted;

    // Reward accounting (similar to Synthetix RewardsDistributor)
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event RewardsClaimed(address indexed user, uint256 amount);
    event EmissionsStarted(uint256 timestamp);

    constructor(address _jubl, address _jublBoost) {
        require(_jubl != address(0), "Invalid JUBL"); // JH-02
        require(_jublBoost != address(0), "Invalid JUBLBoost"); // JH-02
        jubl = IJUBL(_jubl);
        jublBoost = IJUBLBoost(_jublBoost);
    }

    /**
     * @notice Start emissions. Can only be called once.
     */
    function startEmissions() external onlyOwner {
        require(emissionStart == 0, "Already started");
        emissionStart = block.timestamp;
        lastUpdateTime = block.timestamp;
        emit EmissionsStarted(block.timestamp);
    }

    /**
     * @notice Returns the current emission rate per second based on halving schedule.
     */
    function currentEmissionRate() public view returns (uint256) {
        if (emissionStart == 0) return 0;

        uint256 elapsed = block.timestamp - emissionStart;
        uint256 yearNumber = elapsed / YEAR; // 0-indexed year

        // Year 1 rate: 125M / YEAR seconds
        // Each subsequent year halves
        uint256 yearlyEmission = TOTAL_EMISSION / 2; // 125M for year 1

        for (uint256 i = 0; i < yearNumber && i < 4; i++) {
            yearlyEmission = yearlyEmission / 2;
        }

        // After year 4, remaining tokens distributed evenly over year 5
        if (yearNumber >= 4) {
            uint256 remaining = TOTAL_EMISSION - totalEmitted;
            if (remaining == 0) return 0;
            yearlyEmission = remaining; // distribute what's left over the final year
        }

        return yearlyEmission / YEAR; // per-second rate
    }

    /**
     * @notice Update reward accounting. Call before any stake/unstake.
     */
    function updateReward(address user) public {
        // RT-06 FIX: Only JUBLBoost or the user themselves can update rewards
        require(
            msg.sender == address(jublBoost) ||
                msg.sender == user ||
                msg.sender == owner(),
            "Unauthorized"
        );
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (user != address(0)) {
            rewards[user] = earned(user);
            userRewardPerTokenPaid[user] = rewardPerTokenStored;
        }
    }

    /**
     * @notice Calculate current reward per token.
     */
    function rewardPerToken() public view returns (uint256) {
        uint256 totalStaked = jublBoost.totalStaked();
        if (totalStaked == 0 || emissionStart == 0) {
            return rewardPerTokenStored;
        }

        uint256 elapsed = block.timestamp - lastUpdateTime;
        uint256 rate = currentEmissionRate();

        return rewardPerTokenStored + ((elapsed * rate * 1e18) / totalStaked);
    }

    /**
     * @notice Calculate earned rewards for a user.
     */
    function earned(address user) public view returns (uint256) {
        uint256 staked = jublBoost.stakedJUBL(user);
        return
            (staked * (rewardPerToken() - userRewardPerTokenPaid[user])) /
            1e18 +
            rewards[user];
    }

    /**
     * @notice Claim accumulated staking rewards.
     */
    function claim() external nonReentrant {
        updateReward(msg.sender);

        uint256 reward = rewards[msg.sender];
        require(reward > 0, "Nothing to claim");

        rewards[msg.sender] = 0;

        // Check we don't exceed total emission allocation
        uint256 remaining = TOTAL_EMISSION - totalEmitted;
        if (reward > remaining) {
            reward = remaining;
        }

        totalEmitted += reward;
        jubl.mint(msg.sender, reward);

        emit RewardsClaimed(msg.sender, reward);
    }

    /**
     * @notice Returns total remaining emission allocation.
     */
    function remainingEmission() external view returns (uint256) {
        return TOTAL_EMISSION - totalEmitted;
    }
}
