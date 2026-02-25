const hre = require("hardhat");

async function main() {
  console.log("🔮 Configuring Oracles on Base Sepolia...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Signer:", deployer.address);

  // Addresses from Deployment Log
  const ORACLE_AGGREGATOR = "0x5D6cF6D868b5B00C292B87C651d5d241E17a865a";
  const COLLATERAL_MANAGER = "0x0cdE481F3Bf3CBf8f0048DBe16F7477913e6700A";

  // Chainlink Feeds (Base Sepolia)
  const FEEDS = {
    BTC: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    ETH: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    USDC: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  };

  // Mock Asset Addresses (We need to deploy mocks if we don't have them, 
  // or use the real testnet tokens. For now, let's deploy mocks to represent jBTCi/jETHs)
  
  // 1. Deploy Mocks for jBTCi and jETHs to test with
  // const MockToken = await hre.ethers.getContractFactory("jUSDi"); // Reusing ERC20 template
  
  console.log("Deploying Mock Assets...");
  // const jBTCi = await MockToken.deploy(); // "jUSDi" name but used as BTC placeholder
  // await jBTCi.waitForDeployment();
  // const jBTCiAddr = await jBTCi.getAddress();
  const jBTCiAddr = "0xf02059BE004bd82136988BB072644D32E01B476c";
  console.log("✅ Mock jBTCi:", jBTCiAddr);

  // const jETHs = await MockToken.deploy();
  // await jETHs.waitForDeployment();
  // const jETHsAddr = await jETHs.getAddress();
  const jETHsAddr = "0xD4d5eAB2980bf232DBb4c2cD13939D35F86d73dC";
  console.log("✅ Mock jETHs:", jETHsAddr);

  // 2. Configure OracleAggregator
  const oracleAggregator = await hre.ethers.getContractAt("OracleAggregator", ORACLE_AGGREGATOR);

  console.log("Setting Oracle Feeds...");
  
  // Set BTC Feed for jBTCi
  // await oracleAggregator.setOracles(jBTCiAddr, FEEDS.BTC, FEEDS.BTC);
  console.log(`Set Price Feed for jBTCi (${jBTCiAddr}) -> BTC Feed (Skipped - already done)`);

  // Set ETH Feed for jETHs
  // await oracleAggregator.setOracles(jETHsAddr, FEEDS.ETH, FEEDS.ETH);
  console.log(`Set Price Feed for jETHs (${jETHsAddr}) -> ETH Feed (Skipped - already done)`);

  // 3. Configure Collateral Factors
  const collateralManager = await hre.ethers.getContractAt("CollateralManager", COLLATERAL_MANAGER);
  
  console.log("Setting Collateral Factors...");
  // 75% LTV for BTC, 80% for ETH
  // await collateralManager.setCollateralFactor(jBTCiAddr, hre.ethers.parseEther("0.75"));
  console.log("Set LTV for jBTCi: 75% (Skipped - already done)");
  
  await collateralManager.setCollateralFactor(jETHsAddr, hre.ethers.parseEther("0.80"));
  console.log("Set LTV for jETHs: 80%");

  console.log("--- Oracle Configuration Complete ---");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
