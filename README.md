# Jubilee Lending

[![Built on Base](https://img.shields.io/badge/Built%20on-Base-blue)](https://base.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.33-363636)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-21%2F21%20Passing-brightgreen)](test/)
[![Audit](https://img.shields.io/badge/Audit-20%2F20%20Fixed-brightgreen)](docs/AUDIT_REPORT.md)
[![Donate Crypto](https://img.shields.io/badge/Donate-Crypto-f7931a?logo=bitcoin&logoColor=white)](https://commerce.coinbase.com/checkout/122a2979-e559-44b9-bb9d-2ff0c6a3025b)

> Self-repaying, interest-free loans backed by yield-bearing collateral. Borrow jUSDi against jBTCi and jETHs — your collateral's yield pays your debt automatically.

**Website**: https://jubileeprotocol.xyz  
**Whitepaper**: [Jubilee Protocol v3](docs/WHITEPAPER.md)  
**Contract**: [`0x1b55eF520AEf9c2657C99343738641dCC92a840F`](https://sepolia.basescan.org/address/0x1b55eF520AEf9c2657C99343738641dCC92a840F)  
**Status**: 🟢 **LIVE on Base Sepolia** — Deployed Feb 25, 2026

---

## Overview

Jubilee Lending is the non-custodial, over-collateralized lending engine of the Jubilee Protocol. Deposit yield-bearing index tokens (jBTCi, jETHs) as collateral, borrow jUSDi at **0% interest**, and let your collateral's yield auto-repay your debt over time.

### How It Works

```
1. Deposit jBTCi/jETHs as collateral
2. Borrow jUSDi (up to 50% LTV, boosted to 70% with $JUBL staking)
3. Your collateral generates yield → YieldRouter applies it to your debt
4. Loan shrinks automatically. No liquidation risk if you stay healthy.
```

---

## Key Features

- 🏦 **Self-Repaying Loans** — Collateral yield automatically reduces your debt via `YieldRouter`
- 💰 **0% Interest** — No borrowing fees, ever
- 📈 **$JUBL LTV Boost** — Stake $JUBL to increase borrowing power from 50% → 70% LTV
- 🛡️ **Dual Oracle** — Chainlink primary + Pyth validation with per-asset heartbeats
- ⚡ **Partial Liquidation** — Only the unhealthy portion is liquidated, not the entire position
- 🙏 **First Fruits Tithe** — 10% of all protocol revenue goes to charitable causes
- ⏳ **24hr Timelock** — All admin operations require a 24-hour delay
- 🚨 **Emergency Module** — Circuit breakers with role-based pause/unpause

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Jubilee Lending                        │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Deposit  │  Borrow  │  Repay   │ Withdraw │  Liquidate   │
│ Collat.  │  jUSDi   │  Manual  │ Collat.  │  Unhealthy   │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬───────┘
     │          │          │          │             │
┌────▼──────────▼──────────▼──────────▼─────────────▼──────┐
│              CollateralManager + JUBLBoost                │
│         (Health Factor + Dollar-Value LTV Boost)          │
└────┬─────────────────────────────────────────┬───────────┘
     │                                         │
┌────▼────┐  ┌────────────┐  ┌─────────────────▼──────────┐
│ Oracle  │  │ YieldRouter│  │      Revenue Pipeline       │
│ Aggreg. │  │ (Auto-Pay) │  │ FeeCollector → 10% Tithe   │
│ CL+Pyth │  │            │  │              → 90% Stakers  │
└─────────┘  └────────────┘  └─────────────────────────────┘
```

---

## Security

- **Audit Score**: 20/20 findings remediated ✅
- **Critical**: 4/4 fixed — Reentrancy, access control, LTV exploit, liquidation logic
- **High**: 5/5 fixed — SafeERC20, emissions sync, gas DoS prevention
- **Medium**: 6/6 fixed — Timelock, oracle staleness, CF cap
- **Low**: 5/5 fixed — Zero-address checks, event indexing
- See [docs/AUDIT_REPORT.md](docs/AUDIT_REPORT.md) for the full report

---

## Contract Addresses

### Base Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| JubileeLending | [`0x1b55eF520AEf9c2657C99343738641dCC92a840F`](https://sepolia.basescan.org/address/0x1b55eF520AEf9c2657C99343738641dCC92a840F) |
| CollateralManager | [`0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA`](https://sepolia.basescan.org/address/0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA) |
| OracleAggregator | [`0x06a524f5087E1491aD5d0E86732B74e8874358c4`](https://sepolia.basescan.org/address/0x06a524f5087E1491aD5d0E86732B74e8874358c4) |
| LiquidationEngine | [`0x58B83cc548E3811c63C75331C3f919116c832F2E`](https://sepolia.basescan.org/address/0x58B83cc548E3811c63C75331C3f919116c832F2E) |
| YieldRouter | [`0xdaA1036227a5695E92c427c494E47Ba641434334`](https://sepolia.basescan.org/address/0xdaA1036227a5695E92c427c494E47Ba641434334) |
| JUBLBoost | [`0xccF8535A89F352c30593FDe48e1caD2275f879f0`](https://sepolia.basescan.org/address/0xccF8535A89F352c30593FDe48e1caD2275f879f0) |
| JUBLEmissions | [`0x79a5717c35C2669816Fee86aD9a43120255D604F`](https://sepolia.basescan.org/address/0x79a5717c35C2669816Fee86aD9a43120255D604F) |
| ChoiceYield | [`0x56420dE894faC21080e18fD3D7AebBb692F241B1`](https://sepolia.basescan.org/address/0x56420dE894faC21080e18fD3D7AebBb692F241B1) |
| FeeCollector | [`0x4AA60050377fC6519AaC76633599141BbeD16bfB`](https://sepolia.basescan.org/address/0x4AA60050377fC6519AaC76633599141BbeD16bfB) |
| FirstFruitsFund | [`0xe297E5c4408e6f9bebdb2180F4d68E38c3915014`](https://sepolia.basescan.org/address/0xe297E5c4408e6f9bebdb2180F4d68E38c3915014) |
| EmergencyModule | [`0x68da820EfDb3Af6bb68F4Fb0Ff9368921eD12957`](https://sepolia.basescan.org/address/0x68da820EfDb3Af6bb68F4Fb0Ff9368921eD12957) |
| JubileeTimelock | [`0xdaA2cA1a36D6eAE8Ef94307777A1cDa6152C421c`](https://sepolia.basescan.org/address/0xdaA2cA1a36D6eAE8Ef94307777A1cDa6152C421c) |

---

## Repository Structure

```
JubileeLending/
├── contracts/
│   ├── JubileeLending.sol        # Core lending logic
│   ├── CollateralManager.sol     # Multi-asset collateral + LTV
│   ├── JUBLBoost.sol             # $JUBL staking for LTV boost
│   ├── LiquidationEngine.sol     # Partial liquidation execution
│   ├── HealthFactorCalculator.sol # HF math library
│   ├── OracleAggregator.sol      # Dual oracle (Chainlink + Pyth)
│   ├── YieldRouter.sol           # Auto-repayment from yield
│   ├── FeeCollector.sol          # Revenue split (10/90)
│   ├── FirstFruitsFund.sol       # Charitable tithe
│   ├── ChoiceYield.sol           # Multi-asset staker rewards
│   ├── JubileeTimelock.sol       # 24hr admin timelock
│   ├── EmergencyModule.sol       # Circuit breakers
│   ├── jUSDi.sol                 # Stablecoin (borrow asset)
│   └── test/
│       ├── MockERC20.sol
│       └── MockV3Aggregator.sol
├── test/
│   ├── JubileeLending.test.js    # 13 unit tests
│   ├── JubileeLending.exploits.test.js  # 2 exploit tests
│   └── Integration.test.js      # 8 integration tests
├── scripts/
│   └── deploy.js
├── docs/
│   ├── AUDIT_REPORT.md
│   └── USER_GUIDE.md
└── README.md
```

---

## Quick Start

```bash
# Install
npm install

# Compile contracts
npx hardhat compile

# Run all tests (21/21)
npx hardhat test

# Deploy to Base Sepolia
npx hardhat run scripts/deploy.js --network baseSepolia
```

---

## Test Suite

```
  Jubilee Protocol Integration Tests
    ✔ Deposit → Borrow → Repay → Withdraw cycle
    ✔ Yield-based auto-repayment via YieldRouter
    ✔ Higher borrow with JUBL staking
    ✔ Prevent unstaking if loan becomes unhealthy
    ✔ 10% tithe to FirstFruits, 90% to ChoiceYield
    ✔ Stakers claim Choice Yield rewards
    ✔ Disburse to whitelisted charities
    ✔ Reject non-whitelisted disbursement

  JubileeLending Exploit Tests
    ✔ JUBL Unstaking health check
    ✔ Fair Liquidation Seizure

  JubileeLending Unit Tests
    ✔ Collateral deposit / unsupported reject
    ✔ Borrow within / exceeding limits
    ✔ Manual repay / yield repay
    ✔ Withdrawal / health factor enforcement
    ✔ Liquidation / healthy loan rejection
    ✔ JUBL Boost health factor

  21 passing ✅
```

---

## Built By

**[Jubilee Labs](https://jubileelabs.xyz)** • Deployed on **[Base](https://base.org)**

## License

This project is licensed under the [MIT License](LICENSE).

---

*"Seek first the Kingdom of God!"* — Matthew 6:33
