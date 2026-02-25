# Pre-Mainnet Hardening Checklist

## 1. Timelock Ownership Transfer

After external audit passes, transfer contract ownership to the JubileeTimelock (24hr delay) backed by a Safe multisig.

```bash
# Step 1: Deploy Safe multisig (2-of-3 or 3-of-5)
# Step 2: Set multisig as JubileeTimelock proposer + executor
# Step 3: Transfer each contract's ownership:

JubileeLending.transferOwnership(TIMELOCK_ADDRESS)
CollateralManager.transferOwnership(TIMELOCK_ADDRESS)
OracleAggregator.transferOwnership(TIMELOCK_ADDRESS)
JUBLBoost.transferOwnership(TIMELOCK_ADDRESS)
JUBLEmissions.transferOwnership(TIMELOCK_ADDRESS)
ChoiceYield.transferOwnership(TIMELOCK_ADDRESS)
FeeCollector.transferOwnership(TIMELOCK_ADDRESS)
EmergencyModule (keep separate admin — needs instant response)
```

## 2. External Audit Scope

**Recommended auditors**: Trail of Bits, OpenZeppelin, Halborn, Zellic

**In-scope contracts** (18 total):
- Core: JubileeLending, CollateralManager, LiquidationEngine, OracleAggregator, YieldRouter
- Token: JUBL, JUBLVesting, JUBLEmissions, JUBLBoost
- Revenue: ChoiceYield, FeeCollector, FirstFruitsFund
- Governance: EmergencyModule, JubileeTimelock, HealthFactorCalculator

**Out-of-scope**: Mock contracts, deployment scripts, frontend

## 3. Immunefi Bug Bounty

| Severity | Reward |
|----------|--------|
| Critical | $10,000 - $50,000 |
| High     | $5,000 - $10,000 |
| Medium   | $1,000 - $5,000 |
| Low      | $500 - $1,000 |

**In-scope**: All production contracts on Base mainnet
**Out-of-scope**: Testnet deployments, known issues in AUDIT_REPORT.md

## 4. Monitoring & Alerting

- **Forta Bot**: Monitor for unusual borrow/liquidation patterns
- **OZ Defender**: Automated pause if health factor drops below threshold
- **PagerDuty**: Alert core team on EmergencyModule triggers

## 5. Resolved Security Findings

| Finding | Status |
|---------|--------|
| C-01 through C-04 | ✅ Fixed |
| H-01 through H-05 | ✅ Fixed (H-04 `addCollateral` now implemented) |
| M-01 through M-06 | ✅ Fixed |
| L-01 through L-05 | ✅ Fixed |
| JH-01, JH-02 | ✅ Fixed |
| RT-01 through RT-06 | ✅ Fixed |
