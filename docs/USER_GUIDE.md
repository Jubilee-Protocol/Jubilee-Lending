# Jubilee Lending User Guide

Welcome to Jubilee Lending on Base Sepolia Testnet!

## What is Jubilee Lending?

Jubilee Lending is an interest-free lending protocol where:
- You deposit yield-bearing collateral (jBTCi, jETHs, etc.)
- You borrow jUSDi stablecoins against your collateral
- Your collateral automatically generates yield
- That yield automatically pays down your debt

**No interest. No liquidation stress. Just yield.**

## How to Use

### 1. Connect Wallet
- Use MetaMask, Rabby, or any Web3 wallet
- Switch to **Base Sepolia Testnet** (Chain ID: 84532)
- Get testnet ETH from [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)

### 2. Deposit Collateral
- Go to the **Mint** tab
- Select your collateral asset
- Enter the amount to deposit
- Click "Deposit" and confirm the transaction

### 3. Borrow jUSDi
- Switch to the **Borrow** tab
- Enter your Loan ID (shown after deposit)
- Enter the amount to borrow
- Click "Borrow jUSDi"

### 4. Repay (Optional)
- Switch to the **Repay** tab
- Enter your Loan ID
- Enter the amount to repay
- Click "Repay Loan"

## Key Concepts

### Health Factor
Your loan health is calculated as:
```
Health Factor = (Collateral Value × Collateral Factor) / Debt
```
- **Above 1.0**: Safe
- **Below 1.0**: Liquidatable

### Collateral Factors
| Asset | Factor |
|-------|--------|
| jBTCi | 75% |
| jETHs | 70% |
| jUSDi | 85% |

### JUBL Boost
Stake JUBL tokens to increase your collateral factor by up to 10%!

## Testnet Addresses

| Contract | Address |
|----------|---------|
| JubileeLending | 0xD9A27A8183d1de0A20d4343Fe63aA119EDa80f00 |
| jUSDi | 0x6dD08492E3532C15Abe9c0aDa7565b136b398Ba7 |
| CollateralManager | 0x0cdE481F3Bf3CBf8f0048DBe16F7477913e6700A |

## Need Help?

- Discord: [Coming Soon]
- Docs: [Coming Soon]
- Twitter: [@JubileeProtocol](https://twitter.com/jubileeprotocol)

---

*Building the Liberty Layer. One block at a time.*
