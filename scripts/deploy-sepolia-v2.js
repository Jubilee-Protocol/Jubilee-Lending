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
    await delay(3000);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("═══════════════════════════════════════════════════");
    console.log("  Jubilee Lending — Base Sepolia V2 (Real Oracles)");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ──────────────────────────────────────
    //  Real Chainlink Feeds (Base Sepolia)
    // ──────────────────────────────────────
    const CHAINLINK = {
        BTC_USD: "0x0FB99723aEe6F420BEAd13E6bBb79cdA26AD9fDA",
        ETH_USD: "0x4ADc67faE2a8116D0a5a8baeE51D8B9362B2b83a",
    };

    // Real JUBL testnet token (deployed Feb 25)
    const JUBL_TESTNET = "0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1";

    const deployed = {};

    // ─── 1. Deploy Tokens ────────────────────────────────────────
    console.log("── Step 1: Tokens ──");

    // Mock wBTC (no real testnet wBTC exists)
    const wbtc = await deployContract("MockERC20", ["Wrapped BTC", "wBTC"]);
    deployed.wBTC = wbtc.target;
    console.log("  wBTC (mock):", wbtc.target);

    // Real jUSDi with role-based minting
    const jusdi = await deployContract("jUSDi");
    deployed.jUSDi = jusdi.target;
    console.log("  jUSDi (real):", jusdi.target);

    // Attach to existing JUBL testnet token
    const jubl = await ethers.getContractAt("MockERC20", JUBL_TESTNET);
    deployed.JUBL = JUBL_TESTNET;
    console.log("  JUBL (existing):", JUBL_TESTNET);

    // ─── 2. Oracle (Real Chainlink) ──────────────────────────────
    console.log("\n── Step 2: Oracle (Real Chainlink) ──");

    const oracleAggregator = await deployContract("OracleAggregator");
    deployed.OracleAggregator = oracleAggregator.target;
    console.log("  OracleAggregator:", oracleAggregator.target);

    // Verify Chainlink feed is returning data
    const btcFeed = await ethers.getContractAt("AggregatorV3Interface", CHAINLINK.BTC_USD);
    const [, btcPrice, , btcTimestamp] = await btcFeed.latestRoundData();
    const btcPriceUSD = Number(btcPrice) / 1e8;
    const feedAge = Math.floor(Date.now() / 1000) - Number(btcTimestamp);
    console.log(`  ✔ Chainlink BTC/USD: $${btcPriceUSD.toLocaleString()} (${feedAge}s old)`);

    // ─── 3. Core Lending ─────────────────────────────────────────
    console.log("\n── Step 3: Core Lending ──");

    const collateralManager = await deployContract("CollateralManager", [oracleAggregator.target]);
    deployed.CollateralManager = collateralManager.target;
    console.log("  CollateralManager:", collateralManager.target);

    const jubileeLending = await deployContract("JubileeLending", [
        collateralManager.target,
        ethers.ZeroAddress,        // YieldRouter set later
        jusdi.target,
        deployer.address           // Treasury
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

    // Oracle: wBTC → real Chainlink BTC/USD
    await sendTx(oracleAggregator.setOracleConfig(
        wbtc.target,
        CHAINLINK.BTC_USD,
        ethers.ZeroAddress,
        ethers.ZeroHash,
        500 // 5% max deviation
    ));
    console.log("  ✔ Oracle: wBTC → Chainlink BTC/USD (REAL)");

    await sendTx(collateralManager.setCollateralFactor(wbtc.target, ethers.parseEther("0.75")));
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

    await sendTx(choiceYield.addRewardAsset(jusdi.target));
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

    // Seed jUSDi lending pool via MINTER_ROLE (deployer still has it)
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
        oracles: {
            BTC_USD: CHAINLINK.BTC_USD,
            ETH_USD: CHAINLINK.ETH_USD,
        },
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
