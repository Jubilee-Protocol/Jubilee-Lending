#!/bin/bash
# Batch verify all Jubilee Lending contracts on BaseScan

NETWORK="baseSepolia"

echo "═══════════════════════════════════════════════════"
echo "  BaseScan Contract Verification"
echo "═══════════════════════════════════════════════════"

verify() {
    local name=$1
    local addr=$2
    shift 2
    echo ""
    echo "── Verifying $name ($addr) ──"
    npx hardhat verify --network $NETWORK $addr "$@" 2>&1 | tail -3
}

# Mock tokens (no constructor args)
verify "MockERC20 (wBTC)" 0xD53e527DBD3De0aD80879DBB328B5716b7A35fA8 "Wrapped BTC" "wBTC"
verify "MockERC20 (jUSDi)" 0xaebc0456Bdb46C4C278Ff9d6Dd96fF98D73CCc21 "Jubilee USD Index" "jUSDi"
verify "MockERC20 (JUBL Mock)" 0xc05031b4282d2306430AD2b7eF18F80902aF976F "Jubilee Token" "JUBL"

# Oracle
verify "MockV3Aggregator" 0x3D47C9D9FAB0fb2B367c40071202e940cB96d07E 8 6000000000000

# Core contracts
verify "OracleAggregator" 0x06a524f5087E1491aD5d0E86732B74e8874358c4
verify "CollateralManager" 0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA 0x06a524f5087E1491aD5d0E86732B74e8874358c4
verify "JubileeLending" 0x1b55eF520AEf9c2657C99343738641dCC92a840F 0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA 0x0000000000000000000000000000000000000000 0xaebc0456Bdb46C4C278Ff9d6Dd96fF98D73CCc21 0x0cC95b9b4CDBBAe45d78FBa16237528343d7B79e
verify "YieldRouter" 0xdaA1036227a5695E92c427c494E47Ba641434334 0x1b55eF520AEf9c2657C99343738641dCC92a840F
verify "LiquidationEngine" 0x58B83cc548E3811c63C75331C3f919116c832F2E 0x1b55eF520AEf9c2657C99343738641dCC92a840F 0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA

# JUBL staking
verify "JUBLBoost" 0xccF8535A89F352c30593FDe48e1caD2275f879f0 0xc05031b4282d2306430AD2b7eF18F80902aF976F
verify "JUBLEmissions" 0x79a5717c35C2669816Fee86aD9a43120255D604F 0xc05031b4282d2306430AD2b7eF18F80902aF976F 0xccF8535A89F352c30593FDe48e1caD2275f879f0

# Revenue
verify "ChoiceYield" 0x56420dE894faC21080e18fD3D7AebBb692F241B1 0xccF8535A89F352c30593FDe48e1caD2275f879f0
verify "FirstFruitsFund" 0xe297E5c4408e6f9bebdb2180F4d68E38c3915014
verify "FeeCollector" 0x4AA60050377fC6519AaC76633599141BbeD16bfB 0x56420dE894faC21080e18fD3D7AebBb692F241B1 0xe297E5c4408e6f9bebdb2180F4d68E38c3915014

# Governance
verify "EmergencyModule" 0x68da820EfDb3Af6bb68F4Fb0Ff9368921eD12957 0x0cC95b9b4CDBBAe45d78FBa16237528343d7B79e
verify "JubileeTimelock" 0xdaA2cA1a36D6eAE8Ef94307777A1cDa6152C421c 86400 0x0cC95b9b4CDBBAe45d78FBa16237528343d7B79e

# Real JUBL token
verify "JUBL (Real)" 0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1 0x0cC95b9b4CDBBAe45d78FBa16237528343d7B79e
verify "JUBLVesting" 0xf5Df68EA3C22FEAbcD4DAe826cdCB905EDd12e54 0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Verification Complete ✅"
echo "═══════════════════════════════════════════════════"
