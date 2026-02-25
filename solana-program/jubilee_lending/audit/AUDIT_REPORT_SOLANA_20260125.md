# Jubilee Lending (Solana) - Audit Report

**Date:** 2026-01-25
**Auditor:** Antigravity (Mercenary Mode)
**Subject:** `jubilee_lending` (Solana Program)

---

## 1. Executive Summary

| Component | Score | Risk Level |
|-----------|-------|------------|
| `lib.rs` Logic | 85/100 | Medium |
| `Access Control` | 90/100 | Low |
| `Math Safety` | 80/100 | Medium |

**Overall Score: 85/100 (WARNING)**
*Threshold: 92/100*

**Verdict:** ⚠️ **FIX BEFORE DEPLOYMENT**

---

## 2. Findings

### 🚨 Critical Vulnerabilities (Must Fix)

#### [C-01] Missing Oracle Integration in Borrow
**File:** `lib.rs` -> `borrow`
**Description:** The borrow function currently uses **hardcoded mock prices** (`collateral_price_usd = 2000`).
```rust
let collateral_price_usd = 2000;
```
**Risk:** Users can borrow funds based on a fake price. If the real price of ETH drops to $1000, the protocol will be instantly insolvent.
**Remediation:** Integrate **Pyth Network** `PriceUpdateAccount` to fetch real-time on-chain prices.

#### [C-02] Precision Loss in LTV Calculation
**File:** `lib.rs` -> `borrow`
**Description:** The math:
```rust
let max_borrow_value = collateral_value
    .checked_mul(reserve.collateral_factor_bps).unwrap()
    .checked_div(10000).unwrap();
```
While fundamentally correct, it relies on `u64`. If asset decimals differ (e.g. USDC is 6 decimals, SOL is 9), simply multiplying amounts will lead to massive errors.
**Risk:** Borrowing 1 USDC (1e6) against 1 SOL (1e9) might be miscalculated by orders of magnitude.
**Remediation:** Normalization logic is required. Convert all amounts to a standard precision (e.g. 1e18 or USD value with 18 decimals) before comparing.

### ⚠️ Medium Vulnerabilities

#### [M-01] Missing "Repay" Instruction
**File:** `lib.rs`
**Description:** There is no function to repay the loan.
**Risk:** User funds are locked in a debt position forever (unless they are liquidated).
**Remediation:** Implement `repay_loan`.

---

## 3. Recommendations

1.  **Implement Pyth:** Add `pyth-sdk-solana` and pass Oracle accounts to `borrow`.
2.  **Decimal Normalization:** Store `decimals` in the `Reserve` account and normalize math.
3.  **Add Repay:** Close the loop.

---

*“Code is law, but bugs are loopholes.”*
