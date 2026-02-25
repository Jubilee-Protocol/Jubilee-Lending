const { ethers } = require("hardhat");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function deployContract(name, args = []) {
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args);
    const tx = contract.deploymentTransaction();
    await tx.wait(1);
    await delay(3000);
    return contract;
}

async function sendTx(txPromise) {
    const tx = await txPromise;
    await tx.wait(1);
    await delay(2000);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("═══════════════════════════════════════════════════");
    console.log("  Jubilee Lending — Base Sepolia Deployment");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
    console.log("");

    const deployed = {};

    // ─── 1. Deploy Mock Tokens ───────────────────────────────────
    console.log("── Step 1: Mock Tokens ──");

    const wbtc = await deployContract("MockERC20", ["Wrapped BTC", "wBTC"]);
    deployed.wBTC = wbtc.target;
    console.log("  wBTC:", wbtc.target);

    const jusdi = await deployContract("MockERC20", ["Jubilee USD Index", "jUSDi"]);
    deployed.jUSDi = jusdi.target;
    console.log("  jUSDi:", jusdi.target);

    const jubl = await deployContract("MockERC20", ["Jubilee Token", "JUBL"]);
    deployed.JUBL = jubl.target;
    console.log("  JUBL:", jubl.target);

    // ─── 2. Deploy Oracle ────────────────────────────────────────
    console.log("\n── Step 2: Oracle ──");

    const btcOracle = await deployContract("MockV3Aggregator", [8, 6000000000000n]);
    deployed.BTCOracle = btcOracle.target;
    console.log("  BTC Oracle ($60K):", btcOracle.target);

    const oracleAggregator = await deployContract("OracleAggregator");
    deployed.OracleAggregator = oracleAggregator.target;
    console.log("  OracleAggregator:", oracleAggregator.target);

    // ─── 3. Deploy Core Lending ──────────────────────────────────
    console.log("\n── Step 3: Core Lending ──");

    const collateralManager = await deployContract("CollateralManager", [oracleAggregator.target]);
    deployed.CollateralManager = collateralManager.target;
    console.log("  CollateralManager:", collateralManager.target);

    const jubileeLending = await deployContract("JubileeLending", [
        collateralManager.target,
        ethers.ZeroAddress,
        jusdi.target,
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

    // ─── 4. Deploy JUBL Staking ──────────────────────────────────
    console.log("\n── Step 4: JUBL Staking ──");

    const jublBoost = await deployContract("JUBLBoost", [jubl.target]);
    deployed.JUBLBoost = jublBoost.target;
    console.log("  JUBLBoost:", jublBoost.target);

    const jublEmissions = await deployContract("JUBLEmissions", [jubl.target, jublBoost.target]);
    deployed.JUBLEmissions = jublEmissions.target;
    console.log("  JUBLEmissions:", jublEmissions.target);

    // ─── 5. Deploy Revenue System ────────────────────────────────
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

    // ─── 6. Deploy Governance ────────────────────────────────────
    console.log("\n── Step 6: Governance ──");

    const emergencyModule = await deployContract("EmergencyModule", [deployer.address]);
    deployed.EmergencyModule = emergencyModule.target;
    console.log("  EmergencyModule:", emergencyModule.target);

    const timelock = await deployContract("JubileeTimelock", [86400, deployer.address]);
    deployed.JubileeTimelock = timelock.target;
    console.log("  JubileeTimelock (24hr):", timelock.target);

    // ─── 7. Wire Everything ──────────────────────────────────────
    console.log("\n── Step 7: Cross-Wiring ──");

    await sendTx(oracleAggregator.setOracleConfig(wbtc.target, btcOracle.target, ethers.ZeroAddress, ethers.ZeroHash, 500));
    console.log("  ✔ Oracle: wBTC → BTC feed");

    await sendTx(collateralManager.setCollateralFactor(wbtc.target, ethers.parseEther("0.75")));
    console.log("  ✔ Collateral: wBTC @ 75% LTV");

    await sendTx(jubileeLending.setYieldRouter(yieldRouter.target));
    console.log("  ✔ Lending: YieldRouter set");

    await sendTx(jubileeLending.setLiquidationEngine(liquidationEngine.target));
    console.log("  ✔ Lending: LiquidationEngine set");

    await sendTx(collateralManager.setJUBLBoost(jublBoost.target));
    console.log("  ✔ CollateralManager: JUBLBoost set");

    await sendTx(jublBoost.setLendingContract(jubileeLending.target));
    console.log("  ✔ JUBLBoost: LendingContract set");

    await sendTx(jublBoost.setChoiceYield(choiceYield.target));
    console.log("  ✔ JUBLBoost: ChoiceYield set");

    await sendTx(jublBoost.setEmissions(jublEmissions.target));
    console.log("  ✔ JUBLBoost: Emissions set");

    await sendTx(choiceYield.addRewardAsset(jusdi.target));
    console.log("  ✔ ChoiceYield: jUSDi registered");

    await sendTx(emergencyModule.addManagedContract(jubileeLending.target));
    console.log("  ✔ Emergency: JubileeLending managed");

    // ─── 8. Mint Test Tokens ─────────────────────────────────────
    console.log("\n── Step 8: Mint Test Tokens ──");

    await sendTx(wbtc.mint(deployer.address, ethers.parseUnits("100", 18)));
    console.log("  ✔ Minted 100 wBTC to deployer");

    await sendTx(jusdi.mint(jubileeLending.target, ethers.parseUnits("1000000", 18)));
    console.log("  ✔ Minted 1M jUSDi to lending pool");

    await sendTx(jubl.mint(deployer.address, ethers.parseUnits("100000", 18)));
    console.log("  ✔ Minted 100K JUBL to deployer");

    // ─── 9. Output Summary ───────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  DEPLOYMENT COMPLETE ✅");
    console.log("  Remaining balance:", endBalance, "ETH");
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 Contract Addresses:");
    console.log(JSON.stringify(deployed, null, 2));

    const fs = require("fs");
    const path = require("path");
    const outDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "baseSepolia.json");
    fs.writeFileSync(outPath, JSON.stringify({
        network: "baseSepolia",
        chainId: 84532,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
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
