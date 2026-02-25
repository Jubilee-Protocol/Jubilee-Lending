const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Jubilee Lending Protocol (Full Suite) to Base Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // --- EXISTING DEPLOYMENTS (Hardcoded to avoid redeploy cost) ---
  const usdiAddr = "0x6dD08492E3532C15Abe9c0aDa7565b136b398Ba7"; 
  const oracleAggregatorAddr = "0x5D6cF6D868b5B00C292B87C651d5d241E17a865a";
  const cmAddr = "0x0cdE481F3Bf3CBf8f0048DBe16F7477913e6700A";
  const lendingAddr = "0xD9A27A8183d1de0A20d4343Fe63aA119EDa80f00"; 
  const yrAddr = "0x812C63d84043486652467F3552f47e29d75aFA5e";
  const TREASURY = "0x46c008C4eD16C491a5876F2dB7de169Bd196d410";
  
  // Mock Assets (from oracle config)
  const jBTCiAddr = "0xf02059BE004bd82136988BB072644D32E01B476c";
  const jETHsAddr = "0xD4d5eAB2980bf232DBb4c2cD13939D35F86d73dC";

  console.log("✅ Using existing core contracts.");

  // --- NEW INFRASTRUCTURE (Governance & Revenue) ---
  console.log("⏳ Deploying Governance & Revenue Contracts...");

  // 1. Deploy Mock JUBL Token
  console.log("Deploying Mock JUBL...");
  const MockToken = await hre.ethers.getContractFactory("jUSDi"); 
  const jublToken = await MockToken.deploy();
  await jublToken.waitForDeployment();
  const jublAddr = await jublToken.getAddress();
  console.log("✅ Mock JUBL Token:", jublAddr);

  // 2. Deploy ChoiceYield
  console.log("Deploying ChoiceYield...");
  const ChoiceYield = await hre.ethers.getContractFactory("ChoiceYield");
  const choiceYield = await ChoiceYield.deploy(jublAddr, jBTCiAddr, jETHsAddr, hre.ethers.ZeroAddress);
  await choiceYield.waitForDeployment();
  const choiceYieldAddr = await choiceYield.getAddress();
  console.log("✅ ChoiceYield Deployed:", choiceYieldAddr);

  // 3. Deploy FeeCollector
  console.log("Deploying FeeCollector...");
  const FeeCollector = await hre.ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(choiceYieldAddr, TREASURY);
  await feeCollector.waitForDeployment();
  const feeCollectorAddr = await feeCollector.getAddress();
  console.log("✅ FeeCollector Deployed:", feeCollectorAddr);

  // 4. Deploy JUBLBoost
  console.log("Deploying JUBLBoost...");
  const JUBLBoost = await hre.ethers.getContractFactory("JUBLBoost");
  const jublBoost = await JUBLBoost.deploy(jublAddr);
  await jublBoost.waitForDeployment();
  const boostAddr = await jublBoost.getAddress();
  console.log("✅ JUBLBoost Deployed:", boostAddr);

  // 5. Wire Contracts Together
  console.log("⚙️ Wiring Infrastructure...");
  
  // Connect JUBLBoost to CollateralManager
  const collateralManager = await hre.ethers.getContractAt("CollateralManager", cmAddr);
  await collateralManager.setJUBLBoost(boostAddr);
  console.log("Connected Boost to CollateralManager");

  console.log("--- Deployment Complete ---");
  console.log("JUBL Token:", jublAddr);
  console.log("ChoiceYield:", choiceYieldAddr);
  console.log("FeeCollector:", feeCollectorAddr);
  console.log("JUBLBoost:", boostAddr);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
