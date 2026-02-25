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
    console.log("  JUBL Token — Base Sepolia Deployment");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Existing contracts from lending deployment
    const EXISTING = {
        JUBLBoost: "0xccF8535A89F352c30593FDe48e1caD2275f879f0",
        JUBLEmissions: "0x79a5717c35C2669816Fee86aD9a43120255D604F",
        ChoiceYield: "0x56420dE894faC21080e18fD3D7AebBb692F241B1"
    };

    const deployed = {};

    // ─── 1. Deploy JUBL Token ────────────────────────────────────
    console.log("── Step 1: Deploy JUBL Token ──");
    const jubl = await deployContract("JUBL", [deployer.address]); // treasury = deployer for testnet
    deployed.JUBL = jubl.target;
    console.log("  JUBL:", jubl.target);
    console.log("  Supply:", ethers.formatUnits(await jubl.totalSupply(), 18), "JUBL");
    console.log("  Treasury balance:", ethers.formatUnits(await jubl.balanceOf(deployer.address), 18), "JUBL");

    // ─── 2. Deploy JUBLVesting ───────────────────────────────────
    console.log("\n── Step 2: Deploy JUBLVesting ──");
    const vesting = await deployContract("JUBLVesting", [jubl.target]);
    deployed.JUBLVesting = vesting.target;
    console.log("  JUBLVesting:", vesting.target);

    // ─── 3. Grant MINTER_ROLE to JUBLEmissions ───────────────────
    console.log("\n── Step 3: Wire JUBL Token ──");

    // Grant MINTER_ROLE to existing JUBLEmissions contract
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await sendTx(jubl.grantRole(MINTER_ROLE, EXISTING.JUBLEmissions));
    console.log("  ✔ MINTER_ROLE granted to JUBLEmissions");

    // RT-03 FIX: Renounce MINTER_ROLE from deployer
    await sendTx(jubl.renounceRole(MINTER_ROLE, deployer.address));
    console.log("  ✔ MINTER_ROLE renounced from deployer (RT-03 fix)");

    // ─── 4. Seed Test Tokens ─────────────────────────────────────
    console.log("\n── Step 4: Seed Test Tokens ──");

    // Send JUBL to JUBLBoost for staking tests
    await sendTx(jubl.transfer(deployer.address, ethers.parseUnits("100000", 18)));
    console.log("  ✔ 100K JUBL retained by deployer for testing");

    // ─── 5. Summary ──────────────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  JUBL TOKEN DEPLOYMENT COMPLETE ✅");
    console.log("  Remaining ETH balance:", endBalance);
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 JUBL Contract Addresses:");
    console.log(JSON.stringify(deployed, null, 2));

    // Update deployment file
    const fs = require("fs");
    const path = require("path");
    const outPath = path.join(__dirname, "../deployments/baseSepolia.json");
    const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    existing.contracts.JUBL_Real = deployed.JUBL;
    existing.contracts.JUBLVesting = deployed.JUBLVesting;
    existing.timestamp = new Date().toISOString();
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
    console.log(`\n💾 Updated ${outPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
