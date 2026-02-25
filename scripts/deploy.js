const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy Tokens
    const USDi = await ethers.deployContract("USDi");
    await USDi.waitForDeployment();
    console.log("USDi deployed to:", USDi.target);

    const JUBL = await ethers.deployContract("JUBL");
    await JUBL.waitForDeployment();
    console.log("JUBL deployed to:", JUBL.target);

    // 2. Deploy Oracle Aggregator
    const OracleAggregator = await ethers.deployContract("OracleAggregator");
    await OracleAggregator.waitForDeployment();
    console.log("OracleAggregator deployed to:", OracleAggregator.target);

    // 3. Deploy Collateral Manager
    const CollateralManager = await ethers.deployContract("CollateralManager", [OracleAggregator.target]);
    await CollateralManager.waitForDeployment();
    console.log("CollateralManager deployed to:", CollateralManager.target);

    // 4. Deploy Jubilee Lending
    const JubileeLending = await ethers.deployContract("JubileeLending", [
        CollateralManager.target,
        ethers.ZeroAddress, // Will set YieldRouter later
        USDi.target
    ]);
    await JubileeLending.waitForDeployment();
    console.log("JubileeLending deployed to:", JubileeLending.target);

    // 5. Deploy Yield Router
    const YieldRouter = await ethers.deployContract("YieldRouter", [JubileeLending.target]);
    await YieldRouter.waitForDeployment();
    console.log("YieldRouter deployed to:", YieldRouter.target);
    await JubileeLending.setYieldRouter(YieldRouter.target);

    // 6. Deploy Liquidation Engine
    const LiquidationEngine = await ethers.deployContract("LiquidationEngine", [
        JubileeLending.target,
        CollateralManager.target
    ]);
    await LiquidationEngine.waitForDeployment();
    console.log("LiquidationEngine deployed to:", LiquidationEngine.target);
    await JubileeLending.setLiquidationEngine(LiquidationEngine.target);

    // 7. Deploy Reward System
    const JUBLBoost = await ethers.deployContract("JUBLBoost", [JUBL.target]);
    await JUBLBoost.waitForDeployment();
    console.log("JUBLBoost deployed to:", JUBLBoost.target);
    await JUBLBoost.setLendingContract(JubileeLending.target);
    await CollateralManager.setJUBLBoost(JUBLBoost.target);

    const ChoiceYield = await ethers.deployContract("ChoiceYield", [JUBLBoost.target]);
    await ChoiceYield.waitForDeployment();
    console.log("ChoiceYield deployed to:", ChoiceYield.target);
    await JUBLBoost.setChoiceYield(ChoiceYield.target);

    // 8. Deploy Emergency Module
    const EmergencyModule = await ethers.deployContract("EmergencyModule", [deployer.address]);
    await EmergencyModule.waitForDeployment();
    console.log("EmergencyModule deployed to:", EmergencyModule.target);
    await EmergencyModule.addManagedContract(JubileeLending.target);

    // 9. Grant Minter Role to JubileeLending
    const MINTER_ROLE = await USDi.MINTER_ROLE();
    await USDi.grantRole(MINTER_ROLE, JubileeLending.target);
    console.log("Granted USDi Minter role to JubileeLending");

    console.log("\nDeployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
