const { ethers } = require("hardhat");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function deployContract(name, args = []) {
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args);
    const tx = contract.deploymentTransaction();
    await tx.wait(1);
    await delay(5000);
    return contract;
}

async function sendTx(txPromise) {
    const tx = await txPromise;
    await tx.wait(1);
    await delay(4000);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("═══════════════════════════════════════════════════");
    console.log("  Jubilee Lending — Base Sepolia V2 (RESUME #2)");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    const JUBL_TESTNET = "0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1";

    // All previously deployed contracts
    const EXISTING = {
        wBTC: "0x2815d17EbF603899aae2917fF12C519D4dFE6Fec",
        jUSDi: "0x3c2F7D11508F7C7D9E41eD38fa33CbEcd55f4A66",
        OracleAggregator: "0xba231f0ac0E64BAddaFDA14c5c9aA46F00Dc46cB",
        BTCOracle: "0xef1318f2cb63122c2eaCe1d27c8CC779276967d9",
        CollateralManager: "0x7038573cf240F91D3aE2aC1bfF9E93bb38C6861F",
    };

    const wbtc = await ethers.getContractAt("MockERC20", EXISTING.wBTC);
    const jusdi = await ethers.getContractAt("jUSDi", EXISTING.jUSDi);
    const oracleAggregator = await ethers.getContractAt("OracleAggregator", EXISTING.OracleAggregator);
    const collateralManager = await ethers.getContractAt("CollateralManager", EXISTING.CollateralManager);

    console.log("  ✔ Attached to 5 existing contracts");

    const deployed = { ...EXISTING, JUBL: JUBL_TESTNET };
    const btcPriceUSD = 85000;

    // ─── 3. Continue: Core Lending ───────────────────────────────
    console.log("\n── Step 3: Core Lending (continued) ──");

    const jubileeLending = await deployContract("JubileeLending", [
        collateralManager.target,
        ethers.ZeroAddress,
        EXISTING.jUSDi,
        deployer.address
    ]);
    deployed.JubileeLending = jubileeLending.target;
    console.log("  JubileeLending:", jubileeLending.target);

    const yieldRouter = await deployContract("YieldRouter", [jubileeLending.target]);
    deployed.YieldRouter = yieldRouter.target;
    console.log("  YieldRouter:", yieldRouter.target);

    const liquidationEngine = await deployContract("LiquidationEngine", [jubileeLending.target, collateralManager.target]);
    deployed.LiquidationEngine = liquidationEngine.target;
    console.log("  LiquidationEngine:", liquidationEngine.target);

    // ─── 4. JUBL Staking ─────────────────────────────────────────
    console.log("\n── Step 4: JUBL Staking ──");

    const jublBoost = await deployContract("JUBLBoost", [JUBL_TESTNET]);
    deployed.JUBLBoost = jublBoost.target;
    console.log("  JUBLBoost:", jublBoost.target);

    const jublEmissions = await deployContract("JUBLEmissions", [JUBL_TESTNET, jublBoost.target]);
    deployed.JUBLEmissions = jublEmissions.target;
    console.log("  JUBLEmissions:", jublEmissions.target);

    // ─── 5. Revenue System ───────────────────────────────────────
    console.log("\n── Step 5: Revenue System ──");

    const choiceYield = await deployContract("ChoiceYield", [jublBoost.target]);
    deployed.ChoiceYield = choiceYield.target;
    console.log("  ChoiceYield:", choiceYield.target);

    const firstFruitsFund = await deployContract("FirstFruitsFund");
    deployed.FirstFruitsFund = firstFruitsFund.target;
    console.log("  FirstFruitsFund:", firstFruitsFund.target);

    const feeCollector = await deployContract("FeeCollector", [choiceYield.target, firstFruitsFund.target]);
    deployed.FeeCollector = feeCollector.target;
    console.log("  FeeCollector:", feeCollector.target);

    // ─── 6. Governance ───────────────────────────────────────────
    console.log("\n── Step 6: Governance ──");

    const emergencyModule = await deployContract("EmergencyModule", [deployer.address]);
    deployed.EmergencyModule = emergencyModule.target;
    console.log("  EmergencyModule:", emergencyModule.target);

    const timelock = await deployContract("JubileeTimelock", [86400, deployer.address]);
    deployed.JubileeTimelock = timelock.target;
    console.log("  JubileeTimelock (24hr):", timelock.target);

    // ─── 7. Wire Everything ──────────────────────────────────────
    console.log("\n── Step 7: Cross-Wiring ──");

    await sendTx(oracleAggregator.setOracleConfig(
        EXISTING.wBTC, EXISTING.BTCOracle, ethers.ZeroAddress, ethers.ZeroHash, 500
    ));
    console.log("  ✔ Oracle: wBTC → MockV3Aggregator ($85K)");

    await sendTx(collateralManager.setCollateralFactor(EXISTING.wBTC, ethers.parseEther("0.75")));
    console.log("  ✔ Collateral: wBTC @ 75% LTV");

    await sendTx(jubileeLending.setYieldRouter(yieldRouter.target));
    console.log("  ✔ Lending → YieldRouter");

    await sendTx(jubileeLending.setLiquidationEngine(liquidationEngine.target));
    console.log("  ✔ Lending → LiquidationEngine");

    await sendTx(collateralManager.setJUBLBoost(jublBoost.target));
    console.log("  ✔ CollateralManager → JUBLBoost");

    await sendTx(jublBoost.setLendingContract(jubileeLending.target));
    console.log("  ✔ JUBLBoost → LendingContract");

    await sendTx(jublBoost.setChoiceYield(choiceYield.target));
    console.log("  ✔ JUBLBoost → ChoiceYield");

    await sendTx(jublBoost.setEmissions(jublEmissions.target));
    console.log("  ✔ JUBLBoost → Emissions");

    await sendTx(choiceYield.addRewardAsset(EXISTING.jUSDi));
    console.log("  ✔ ChoiceYield: jUSDi registered");

    await sendTx(choiceYield.setFeeCollector(feeCollector.target));
    console.log("  ✔ ChoiceYield → FeeCollector (RT-05)");

    await sendTx(emergencyModule.addManagedContract(jubileeLending.target));
    console.log("  ✔ Emergency: JubileeLending managed");

    // Grant jUSDi MINTER_ROLE to JubileeLending
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await sendTx(jusdi.grantRole(MINTER_ROLE, jubileeLending.target));
    console.log("  ✔ jUSDi: MINTER_ROLE → JubileeLending");

    // ─── 8. Seed Test Tokens ─────────────────────────────────────
    console.log("\n── Step 8: Seed Test Tokens ──");

    await sendTx(wbtc.mint(deployer.address, ethers.parseUnits("100", 18)));
    console.log("  ✔ Minted 100 wBTC to deployer");

    await sendTx(jusdi.mint(jubileeLending.target, ethers.parseUnits("1000000", 18)));
    console.log("  ✔ Minted 1M jUSDi to lending pool");

    // ─── 9. Summary ──────────────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  DEPLOYMENT COMPLETE ✅ (V2 — Real Oracles)");
    console.log("  BTC Price (Chainlink):", `$${btcPriceUSD.toLocaleString()}`);
    console.log("  Remaining ETH:", endBalance);
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 Contract Addresses:");
    console.log(JSON.stringify(deployed, null, 2));

    // Save deployment
    const fs = require("fs");
    const path = require("path");
    const outDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "baseSepolia-v2.json");
    fs.writeFileSync(outPath, JSON.stringify({
        network: "baseSepolia",
        chainId: 84532,
        version: "v2-real-oracles",
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        oracle: { BTC_USD: CHAINLINK_BTC_USD },
        contracts: deployed
    }, null, 2));
    console.log(`\n💾 Saved to ${outPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
