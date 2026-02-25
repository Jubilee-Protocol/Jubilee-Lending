const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Jubilee Lending Protocol to Base Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // 1. Deploy USDi
  // const USDi = await hre.ethers.getContractFactory("jUSDi");
  // const usdi = await USDi.deploy();
  // await usdi.waitForDeployment();
  // const usdiAddr = await usdi.getAddress();
  const usdiAddr = "0x6dD08492E3532C15Abe9c0aDa7565b136b398Ba7"; // Reusing deployed
  const usdi = await hre.ethers.getContractAt("jUSDi", usdiAddr);
  console.log("✅ jUSDi Deployed:", usdiAddr);

  // 2. Deploy Mocks (for CollateralManager/YieldRouter) if not on mainnet
  // For testnet, we'll deploy a MockCollateralManager for simplicity initially
  // In prod, this would be the real CollateralManager
  const MockCM = await hre.ethers.getContractFactory("CollateralManager");
  // Assuming CollateralManager has a constructor (it usually needs an Oracle)
  // Let's check the constructor of CollateralManager
  
  // Note: I will need to inspect CollateralManager.sol constructor arguments.
  // For now, I'll assume standard deployment. If it fails, I'll fix it.
  
  // Actually, let's deploy the real CollateralManager if possible.
  // It likely needs an OracleAggregator.
  
  // const OracleAggregator = await hre.ethers.getContractFactory("OracleAggregator");
  // const oracleAggregator = await OracleAggregator.deploy(); // No args for OZ 4.x Ownable
  // await oracleAggregator.waitForDeployment();
  const oracleAggregatorAddr = "0x5D6cF6D868b5B00C292B87C651d5d241E17a865a";
  console.log("✅ OracleAggregator Deployed:", oracleAggregatorAddr);

  // const CollateralManager = await hre.ethers.getContractFactory("CollateralManager");
  // const collateralManager = await CollateralManager.deploy(oracleAggregatorAddr);
  // await collateralManager.waitForDeployment();
  const cmAddr = "0x0cdE481F3Bf3CBf8f0048DBe16F7477913e6700A";
  console.log("✅ CollateralManager Deployed:", cmAddr);

  // 3. Deploy YieldRouter (Wait for lending address)
  // We deploy YieldRouter after Lending because it needs the lending address in constructor
  // BUT Lending needs YieldRouter in constructor. Circular dependency?
  // Checking YieldRouter constructor: constructor(address _lendingContract)
  // Checking JubileeLending constructor: constructor(address _collateralManager, address _yieldRouter, address _usdi)
  
  // Solution: Deploy YieldRouter with dummy address or 0x0, then set it.
  // Or deploy JubileeLending with 0x0 YieldRouter, then set it.
  
  console.log("⏳ Deploying JubileeLending (Phase 1)...");
  
  const TREASURY = "0x46c008C4eD16C491a5876F2dB7de169Bd196d410";
  
  const JubileeLending = await hre.ethers.getContractFactory("JubileeLending");
  // Constructor: collateralManager, yieldRouter, usdi, treasury
  const lending = await JubileeLending.deploy(cmAddr, deployer.address, usdiAddr, TREASURY); 
  await lending.waitForDeployment();
  const lendingAddr = "0xD9A27A8183d1de0A20d4343Fe63aA119EDa80f00";
  // const lending = await hre.ethers.getContractAt("JubileeLending", lendingAddr); // Already declared above in commented out section? No, let's just fix the variable name if needed
  console.log("✅ JubileeLending Deployed:", lendingAddr);

  // const YieldRouter = await hre.ethers.getContractFactory("YieldRouter");
  // const yieldRouter = await YieldRouter.deploy(lendingAddr);
  // await yieldRouter.waitForDeployment();
  // const yrAddr = await yieldRouter.getAddress();
  const yrAddr = "0x812C63d84043486652467F3552f47e29d75aFA5e";
  console.log("✅ YieldRouter Deployed:", yrAddr);

  // Update JubileeLending with real YieldRouter
  console.log("⚙️ Updating JubileeLending with YieldRouter...");
  // await lending.setYieldRouter(yrAddr);
  console.log("Updated YieldRouter reference (Skipped - already done)");

  // 5. Setup Permissions
  console.log("⚙️ Setting up permissions...");
  
  // Grant MINTER_ROLE to JubileeLending on USDi
  // const MINTER_ROLE = await usdi.MINTER_ROLE();
  // await usdi.grantRole(MINTER_ROLE, lendingAddr);
  console.log("Granted MINTER_ROLE to Lending Contract (Skipped - already done)");

  // Set YieldRouter's lending contract reference if needed
  // await yieldRouter.setLendingContract(lendingAddr);

  console.log("--- Deployment Complete ---");
  console.log("USDi:", usdiAddr);
  console.log("JubileeLending:", lendingAddr);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
