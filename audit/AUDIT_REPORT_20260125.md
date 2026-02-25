# Jubilee Lending Audit Report

**Date:** 2026-01-25
**Auditor:** Antigravity (Mercenary Mode)
**Subject:** `JubileeLending` Protocol

---

## 1. Executive Summary

| Contract | Score | Risk Level |
|----------|-------|------------|
| `JubileeLending.sol` | 85/100 | Medium |
| `CollateralManager.sol` | 92/100 | Low |
| `LiquidationEngine.sol` | 90/100 | Low |
| `YieldRouter.sol` | 88/100 | Medium |

**Overall Score: 89/100 (WARNING)**
*Threshold: 92/100*

**Verdict:** ⚠️ **FIX BEFORE MAINNET**

---

## 2. Findings

### 🚨 Critical Vulnerabilities (Must Fix)

#### [C-01] Untrusted External Call in `getCollateralValue`
**Contract:** `CollateralManager.sol`
**Description:** `getCollateralValue` calls `oracleAggregator.getLatestPrice(asset)`. While `OracleAggregator` has `onlyOwner` protection on setting sources, there is no validation that the `oracleAggregator` itself is a trusted contract in `CollateralManager`. If the owner sets a malicious aggregator, they can rug all users by manipulating prices.
**Remediation:** While `onlyOwner` mitigates this, consider immutable oracle references or a DAO timelock for updates. (Accepted Risk for MVP, but flagged).

#### [C-02] Liquidation Logic Flaw (Insolvency Risk)
**Contract:** `JubileeLending.sol` -> `liquidateLoan`
**Description:** The function calculates `collateralToLiquidator` based on the current price. If the price drops rapidly (Flash Crash) and the health factor is extremely low (e.g., < 0.5), `valueToSeize` might exceed `loan.collateralAmount`.
The code handles this: `if (collateralToLiquidator > loan.collateralAmount) collateralToLiquidator = loan.collateralAmount;`
**Risk:** This means the protocol accepts **Bad Debt**. The liquidator pays off the *full* `debtToRepay` but receives *less* collateral than it's worth. Liquidators will **revert** this transaction because it's a loss for them. The loan stays insolvent forever.
**Remediation:** Allow partial liquidations or a "Bad Debt Fund" to cover the difference. Liquidators should only repay up to what the collateral covers (minus bonus).

### ⚠️ Medium Vulnerabilities

#### [M-01] Yield Router Permissioning
**Contract:** `YieldRouter.sol`
**Description:** `routeYieldToRepayment` is public. Anyone can call it.
**Risk:** An attacker could call it with `yieldAmount = 0` or tiny amounts to spam events, or potentially mess with repayment timing if `yieldRepaymentRate` changes dynamically.
**Remediation:** Add `onlyKeeper` or `onlyOwner` modifier, or ensure `yieldAmount > minThreshold`.

#### [M-02] No Stale Price Check in CollateralManager
**Contract:** `CollateralManager.sol`
**Description:** It trusts `oracleAggregator` blindly. If the aggregator returns a stale price (even if the aggregator *internal* check passes, usually 24h is too long for crypto), the protocol could lend against old prices.
**Remediation:** Enforce stricter freshness checks (e.g., 1 hour or 10 minutes) directly in `CollateralManager` or ensure `OracleAggregator` is strictly configured.

---

## 3. Recommendations

1.  **Fix Liquidation Incentives:** Liquidators must profit. If `collateral < debt + bonus`, allow liquidating `collateral / (1 + bonus)` amount of debt, not the full debt.
2.  **Stricter Oracles:** 24 hours is too long for volatile assets. Lower to 1 hour heartbeat.
3.  **Events:** Add more granular events for `YieldRouter`.

---

*“Security is not a destination, it’s a journey.”*
