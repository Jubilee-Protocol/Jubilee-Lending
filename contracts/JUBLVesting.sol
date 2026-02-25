// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title JUBLVesting
 * @dev Token vesting contract for team, advisors, and early supporters.
 *
 * Supports:
 * - Configurable cliff period (tokens locked until cliff ends)
 * - Linear vesting after cliff
 * - Owner can create vesting schedules
 * - Beneficiaries claim vested tokens themselves
 */
contract JUBLVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        uint256 totalAmount; // Total tokens allocated
        uint256 released; // Tokens already claimed
        uint256 startTime; // Vesting start timestamp
        uint256 cliffDuration; // Cliff period in seconds
        uint256 vestingDuration; // Total vesting period (including cliff)
        bool revocable; // Can the owner revoke unvested tokens?
        bool revoked; // Has this been revoked?
    }

    IERC20 public immutable jubl;

    mapping(address => VestingSchedule) public schedules;
    address[] public beneficiaries;

    uint256 public totalAllocated;

    event ScheduleCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 cliff,
        uint256 duration
    );
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(address indexed beneficiary, uint256 unvestedAmount);

    constructor(address _jubl) {
        require(_jubl != address(0), "Invalid JUBL"); // L-01
        jubl = IERC20(_jubl);
    }

    /**
     * @notice Creates a vesting schedule for a beneficiary.
     * @param beneficiary Address receiving the vested tokens.
     * @param amount Total tokens to vest.
     * @param cliffDuration Cliff period in seconds (e.g., 365 days).
     * @param vestingDuration Total vesting duration including cliff (e.g., 4 years).
     * @param revocable Whether the owner can revoke unvested tokens.
     */
    function createSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be > 0");
        require(vestingDuration >= cliffDuration, "Vesting < cliff");
        // JH-01 FIX: Prevent overwriting active schedules
        VestingSchedule storage existing = schedules[beneficiary];
        require(
            existing.totalAmount == 0 ||
                existing.revoked ||
                _vestedAmount(existing) == existing.totalAmount,
            "Active schedule exists"
        );

        schedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            released: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false
        });

        beneficiaries.push(beneficiary);
        totalAllocated += amount;

        // Transfer tokens into this contract to back the vesting
        jubl.safeTransferFrom(msg.sender, address(this), amount);

        emit ScheduleCreated(
            beneficiary,
            amount,
            cliffDuration,
            vestingDuration
        );
    }

    /**
     * @notice Claim vested tokens.
     */
    function release() external nonReentrant {
        VestingSchedule storage schedule = schedules[msg.sender];
        require(schedule.totalAmount > 0, "No schedule");
        require(!schedule.revoked, "Schedule revoked");

        uint256 vested = _vestedAmount(schedule);
        uint256 claimable = vested - schedule.released;
        require(claimable > 0, "Nothing to release");

        schedule.released += claimable;
        jubl.safeTransfer(msg.sender, claimable);

        emit TokensReleased(msg.sender, claimable);
    }

    /**
     * @notice Revoke a vesting schedule (only if revocable). Unvested tokens return to owner.
     */
    function revoke(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = schedules[beneficiary];
        require(schedule.revocable, "Not revocable");
        require(!schedule.revoked, "Already revoked");

        uint256 vested = _vestedAmount(schedule);
        uint256 unvested = schedule.totalAmount - vested;

        // JL-02 FIX: Auto-release vested tokens to beneficiary
        uint256 claimable = vested - schedule.released;
        if (claimable > 0) {
            schedule.released += claimable;
            jubl.safeTransfer(beneficiary, claimable);
            emit TokensReleased(beneficiary, claimable);
        }

        schedule.revoked = true;
        totalAllocated -= unvested;

        if (unvested > 0) {
            jubl.safeTransfer(owner(), unvested);
        }

        emit ScheduleRevoked(beneficiary, unvested);
    }

    /**
     * @notice Returns the amount currently releasable for a beneficiary.
     */
    function releasable(address beneficiary) external view returns (uint256) {
        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.revoked) return 0;
        return _vestedAmount(schedule) - schedule.released;
    }

    function _vestedAmount(
        VestingSchedule storage schedule
    ) internal view returns (uint256) {
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0; // Still in cliff
        }

        if (block.timestamp >= schedule.startTime + schedule.vestingDuration) {
            return schedule.totalAmount; // Fully vested
        }

        // Linear vesting
        uint256 elapsed = block.timestamp - schedule.startTime;
        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }
}
