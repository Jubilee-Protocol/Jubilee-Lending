# 🔴 Red Team Audit — JUBL Token Ecosystem

**Conducted by**: Jubilee Labs (Internal Red Team)  
**Date**: February 25, 2026  
**Scope**: JUBL.sol, JUBLVesting.sol, JUBLEmissions.sol, JUBLBoost.sol, ChoiceYield.sol  
**Methodology**: Adversarial hacker mindset — "How do I drain value?"

---

## Executive Summary

| Severity | Exploits Found |
|----------|---------------|
| 🔴 Critical | 2 |
| 🟠 High | 2 |
| 🟡 Medium | 2 |

---

## 🔴 CRITICAL EXPLOITS

### RT-01: Emission Reward Theft via Flash Stake
**Contract**: `JUBLBoost.sol` + `JUBLEmissions.sol`  
**Attack Playbook**:

```
1. Attacker acquires large JUBL (e.g., via flash loan or whale purchase)
2. Calls JUBLBoost.stake(1,000,000 JUBL)
   → emissions.updateReward(attacker) snapshots near-zero rewards
   → totalStaked increases massively
3. Waits a few blocks (rewards accrue proportional to stake)
4. Calls JUBLEmissions.claim()
   → Receives disproportionate share of emission rewards
5. Calls JUBLBoost.unstake(1,000,000 JUBL)
   → Gets all JUBL back + emission rewards
```

**Impact**: Attacker dilutes legitimate stakers' rewards. With flash loans, cost is near-zero.

**Root Cause**: No minimum stake duration. `updateReward` is called before stake change, but there's no time-weighted loyalty mechanism.

**Fix**: Add a minimum stake duration (e.g., 7 days) before rewards become claimable, or implement a warmup period.

---

### RT-02: Choice Yield Siphon via Stake-Claim-Unstake
**Contract**: `ChoiceYield.sol` + `JUBLBoost.sol`  
**Attack Playbook**:

```
1. Attacker stakes massive JUBL just before FeeCollector.collectFees()
   → rewardPerTokenStored hasn't been updated yet with new stake
2. FeeCollector.collectFees() → ChoiceYield.depositRevenue()
   → rewardPerTokenStored += (amount * 1e18) / totalStaked
   → Attacker's large stake dilutes existing stakers' rewards
3. Attacker calls claimAllRewards()
   → Gets majority share of revenue
4. Unstakes immediately
```

**Impact**: Protocol revenue goes to an opportunistic whale instead of loyal stakers.

**Root Cause**: Same as RT-01 — no time-lock on claiming, combined with `depositRevenue` using a snapshot of `totalStaked` at deposit time.

**Fix**: Implement a warmup period — newly staked tokens don't earn `ChoiceYield` for N days.

---

## 🟠 HIGH EXPLOITS

### RT-03: `JUBL.sol` Admin Can Mint Retroactively via MINTER_ROLE
**Contract**: `JUBL.sol:36-37`  
**Attack Playbook**:

```
1. Deployer has DEFAULT_ADMIN_ROLE + MINTER_ROLE from constructor
2. Deployer grants MINTER_ROLE to an arbitrary address
3. That address mints remaining 250M JUBL (staking allocation) to themselves
4. Now they have the entire staking reward pool without staking
```

**Impact**: Complete token inflation control by admin. Trusted-deployer assumption.

**Root Cause**: `MINTER_ROLE` is not restricted to the `JUBLEmissions` contract. Anyone with `DEFAULT_ADMIN_ROLE` can grant `MINTER_ROLE` to any address.

**Fix**: After deployment, renounce `MINTER_ROLE` from deployer and restrict `DEFAULT_ADMIN_ROLE` to timelock. Only `JUBLEmissions` should hold `MINTER_ROLE`.

---

### RT-04: `JUBLBoost.unstake()` Checks Health AFTER State Change
**Contract**: `JUBLBoost.sol:110-119`

```solidity
stakedJUBL[msg.sender] -= amount;  // State change FIRST
totalStaked -= amount;              // State change FIRST

if (address(lendingContract) != address(0)) {
    require(lendingContract.isHealthy(msg.sender), "...");  // Check AFTER
}
```

**Attack**: Not directly exploitable for theft, but violates CEI pattern. If `isHealthy()` calls back into any contract that reads `stakedJUBL`, it sees the reduced amount. Currently safe because `isHealthy` is a view function, but future changes could introduce reentrancy.

**Fix**: Move the health check before state changes, or add `nonReentrant`.

---

## 🟡 MEDIUM EXPLOITS

### RT-05: `ChoiceYield.depositRevenue` is Permissionless
**Contract**: `ChoiceYield.sol:87`

Anyone can call `depositRevenue()` (not just `FeeCollector`). While the asset must be registered, this means anyone can deposit revenue and manipulate `rewardPerTokenStored` in unexpected ways (e.g. donate dust to trigger rounding issues, or front-run legitimate deposits).

**Fix**: Add `onlyFeeCollector` modifier or restrict caller.

---

### RT-06: `JUBLEmissions.updateReward()` is Public and Unrestricted
**Contract**: `JUBLEmissions.sol:100`

Anyone can call `updateReward(anyAddress)` at any time. While this doesn't directly steal funds, it allows an attacker to force-update another user's reward snapshot to a manipulated `rewardPerTokenStored`, potentially locking them into an unfavorable rate.

**Fix**: Restrict to `onlyJUBLBoost` or make `updateReward(user)` only callable by the user themselves or authorized contracts.

---

## Recommended Fixes (Priority Order)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| 1 | **RT-01** Flash stake | Add `MIN_STAKE_DURATION` (7 days) to JUBLBoost | 30 min |
| 2 | **RT-02** Revenue siphon | Warmup period for ChoiceYield rewards | 30 min |
| 3 | **RT-03** Admin mint | Renounce MINTER_ROLE after granting to Emissions; restrict via timelock | 15 min |
| 4 | **RT-04** CEI violation | Add `nonReentrant` to unstake + reorder checks | 15 min |
| 5 | **RT-05** Permissionless deposit | Add caller restriction to `depositRevenue` | 10 min |
| 6 | **RT-06** Public updateReward | Restrict to JUBLBoost only | 10 min |
