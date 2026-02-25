# JUBL Token — Security Audit Report

**Scope**: `JUBL.sol` (72 lines), `JUBLVesting.sol` (165 lines), `JUBLEmissions.sol` (164 lines)  
**Date**: February 25, 2026

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 3 |
| 🔵 Low | 3 |

---

## 🟠 High Findings

### JH-01: `JUBLVesting.createSchedule` Overwrites Existing Schedule
**Contract**: `JUBLVesting.sol:73`  
**Risk**: Previous M-04 fix removed the `require(schedules[beneficiary].totalAmount == 0)` check to allow multiple vesting rounds. But the mapping still uses `address → single schedule`, so calling `createSchedule` twice for the same address **overwrites** the first schedule, losing unvested tokens.

```solidity
// Line 73: This overwrites any existing schedule
schedules[beneficiary] = VestingSchedule({ ... });
```

**Fix**: Either:
- **(A)** Use a schedule ID system: `mapping(uint256 => VestingSchedule)` + counter
- **(B)** Accumulate: require the previous schedule to be fully vested/revoked before creating a new one

### JH-02: `JUBLEmissions` Missing Zero-Address Checks in Constructor
**Contract**: `JUBLEmissions.sol:53-56`  
**Risk**: If `_jubl` or `_jublBoost` are zero addresses, the contract becomes permanently broken — `claim()` will call `mint()` on `address(0)` which reverts.

```solidity
constructor(address _jubl, address _jublBoost) {
    // No validation!
    jubl = IJUBL(_jubl);
    jublBoost = IJUBLBoost(_jublBoost);
}
```

---

## 🟡 Medium Findings

### JM-01: `currentEmissionRate()` Uses Stale `totalEmitted`
**Contract**: `JUBLEmissions.sol:87`  
**Risk**: After year 4, `currentEmissionRate()` uses `totalEmitted` to calculate remaining tokens. But `totalEmitted` only updates on `claim()`. If no one claims for a while, the rate calculation is based on stale data, potentially over-distributing.

### JM-02: Unbounded `beneficiaries` Array in Vesting
**Contract**: `JUBLVesting.sol:83`  
**Risk**: Each `createSchedule` pushes to the `beneficiaries` array. It never shrinks. If many schedules are created, `getBeneficiaryCount()` remains accurate but any iteration over the array could hit gas limits.

### JM-03: `JUBLEmissions.claim()` Can Be Frontrun
**Contract**: `JUBLEmissions.sol:137`  
**Risk**: A user about to claim can be frontrun by another user's `claim()` which updates `totalEmitted`, potentially reducing the claimer's reward via the `remaining` cap on line 147.

---

## 🔵 Low Findings

### JL-01: `JUBL.totalMinted` Tracks Minted Not Circulating
**Contract**: `JUBL.sol:31`  
**Risk**: `totalMinted` counts tokens ever minted (including burned). If significant tokens are burned, `remainingMintableSupply()` understates what's available. This is by design (`MAX_SUPPLY` as a hard ceiling), but could be confusing.

### JL-02: `JUBLVesting.revoke()` Doesn't Release Vested Tokens
**Contract**: `JUBLVesting.sol:118`  
**Risk**: When revoking, vested tokens remain in the contract until the beneficiary calls `release()`. If the beneficiary loses their key, vested tokens are locked forever. Consider auto-releasing vested tokens during revocation.

### JL-03: No `EmissionsStarted` Event Indexed Field
**Contract**: `JUBLEmissions.sol:51`  
**Risk**: The `EmissionsStarted` event has no indexed fields, making it harder to filter in event logs.

---

## Recommended Fixes (Priority Order)

1. **JH-01** — Add check: `require(schedules[beneficiary].totalAmount == 0 || schedules[beneficiary].revoked || _vestedAmount(schedules[beneficiary]) == schedules[beneficiary].totalAmount, "Active schedule exists")`
2. **JH-02** — Add `require(_jubl != address(0))` and `require(_jublBoost != address(0))` to constructor
3. **JL-02** — Auto-release vested tokens in `revoke()` before returning unvested
