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
    console.log("  Jubilee Lending — Resume Deployment (Step 4+)");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Already deployed contracts (from previous run)
    const deployed = {
        wBTC: "0xD53e527DBD3De0aD80879DBB328B5716b7A35fA8",
        jUSDi: "0xaebc0456Bdb46C4C278Ff9d6Dd96fF98D73CCc21",
        JUBL: "0xc05031b4282d2306430AD2b7eF18F80902aF976F",
        BTCOracle: "0x3D47C9D9FAB0fb2B367c40071202e940cB96d07E",
        OracleAggregator: "0x06a524f5087E1491aD5d0E86732B74e8874358c4",
        CollateralManager: "0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA",
        JubileeLending: "0x1b55eF520AEf9c2657C99343738641dCC92a840F",
        YieldRouter: "0xdaA1036227a5695E92c427c494E47Ba641434334",
        LiquidationEngine: "0x58B83cc548E3811c63C75331C3f919116c832F2E",
        JUBLBoost: "0xccF8535A89F352c30593FDe48e1caD2275f879f0"
    };

    // Attach to existing contracts
    const wbtc = await ethers.getContractAt("MockERC20", deployed.wBTC);
    const jusdi = await ethers.getContractAt("MockERC20", deployed.jUSDi);
    const jubl = await ethers.getContractAt("MockERC20", deployed.JUBL);
    const oracleAggregator = await ethers.getContractAt("OracleAggregator", deployed.OracleAggregator);
    const collateralManager = await ethers.getContractAt("CollateralManager", deployed.CollateralManager);
    const jubileeLending = await ethers.getContractAt("JubileeLending", deployed.JubileeLending);
    const yieldRouter = await ethers.getContractAt("YieldRouter", deployed.YieldRouter);
    const jublBoost = await ethers.getContractAt("JUBLBoost", deployed.JUBLBoost);

    console.log("✔ Attached to 10 existing contracts\n");

    // ─── Resume: Deploy remaining contracts ──────────────────────
    console.log("── Step 4 (resume): JUBLEmissions ──");
    const jublEmissions = await deployContract("JUBLEmissions", [deployed.JUBL, deployed.JUBLBoost]);
    deployed.JUBLEmissions = jublEmissions.target;
    console.log("  JUBLEmissions:", jublEmissions.target);

    console.log("\n── Step 5: Revenue System ──");
    const choiceYield = await deployContract("ChoiceYield", [deployed.JUBLBoost]);
    deployed.ChoiceYield = choiceYield.target;
    console.log("  ChoiceYield:", choiceYield.target);

    const firstFruitsFund = await deployContract("FirstFruitsFund");
    deployed.FirstFruitsFund = firstFruitsFund.target;
    console.log("  FirstFruitsFund:", firstFruitsFund.target);

    const feeCollector = await deployContract("FeeCollector", [choiceYield.target, firstFruitsFund.target]);
    deployed.FeeCollector = feeCollector.target;
    console.log("  FeeCollector:", feeCollector.target);

    console.log("\n── Step 6: Governance ──");
    const emergencyModule = await deployContract("EmergencyModule", [deployer.address]);
    deployed.EmergencyModule = emergencyModule.target;
    console.log("  EmergencyModule:", emergencyModule.target);

    const timelock = await deployContract("JubileeTimelock", [86400, deployer.address]);
    deployed.JubileeTimelock = timelock.target;
    console.log("  JubileeTimelock (24hr):", timelock.target);

    // ─── 7. Wire Everything ──────────────────────────────────────
    console.log("\n── Step 7: Cross-Wiring ──");

    await sendTx(oracleAggregator.setOracleConfig(deployed.wBTC, deployed.BTCOracle, ethers.ZeroAddress, ethers.ZeroHash, 500));
    console.log("  ✔ Oracle: wBTC → BTC feed");

    await sendTx(collateralManager.setCollateralFactor(deployed.wBTC, ethers.parseEther("0.75")));
    console.log("  ✔ Collateral: wBTC @ 75% LTV");

    await sendTx(jubileeLending.setYieldRouter(deployed.YieldRouter));
    console.log("  ✔ Lending: YieldRouter set");

    await sendTx(jubileeLending.setLiquidationEngine(deployed.LiquidationEngine));
    console.log("  ✔ Lending: LiquidationEngine set");

    await sendTx(collateralManager.setJUBLBoost(deployed.JUBLBoost));
    console.log("  ✔ CollateralManager: JUBLBoost set");

    await sendTx(jublBoost.setLendingContract(deployed.JubileeLending));
    console.log("  ✔ JUBLBoost: LendingContract set");

    await sendTx(jublBoost.setChoiceYield(choiceYield.target));
    console.log("  ✔ JUBLBoost: ChoiceYield set");

    await sendTx(jublBoost.setEmissions(jublEmissions.target));
    console.log("  ✔ JUBLBoost: Emissions set");

    await sendTx(choiceYield.addRewardAsset(deployed.jUSDi));
    console.log("  ✔ ChoiceYield: jUSDi registered");

    await sendTx(emergencyModule.addManagedContract(deployed.JubileeLending));
    console.log("  ✔ Emergency: JubileeLending managed");

    // ─── 8. Mint Test Tokens ─────────────────────────────────────
    console.log("\n── Step 8: Mint Test Tokens ──");

    await sendTx(wbtc.mint(deployer.address, ethers.parseUnits("100", 18)));
    console.log("  ✔ Minted 100 wBTC to deployer");

    await sendTx(jusdi.mint(deployed.JubileeLending, ethers.parseUnits("1000000", 18)));
    console.log("  ✔ Minted 1M jUSDi to lending pool");

    await sendTx(jubl.mint(deployer.address, ethers.parseUnits("100000", 18)));
    console.log("  ✔ Minted 100K JUBL to deployer");

    // ─── 9. Output Summary ───────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  DEPLOYMENT COMPLETE ✅");
    console.log("  Remaining balance:", endBalance, "ETH");
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 All Contract Addresses:");
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
