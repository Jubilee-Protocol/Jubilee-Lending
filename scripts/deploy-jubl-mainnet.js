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
    const TREASURY = "0x46c008C4eD16C491a5876F2dB7de169Bd196d410"; // Safe multisig on Base

    console.log("═══════════════════════════════════════════════════");
    console.log("  🚀 JUBL Token — Base MAINNET Deployment");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Treasury:", TREASURY);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Safety check
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "(chainId:", network.chainId.toString(), ")");
    if (network.chainId !== 8453n) {
        console.error("❌ WRONG NETWORK! Expected Base mainnet (chainId 8453)");
        process.exit(1);
    }
    console.log("✔ Confirmed: Base Mainnet\n");

    const deployed = {};

    // ─── 1. Deploy JUBL Token ────────────────────────────────────
    console.log("── Step 1: Deploy JUBL Token ──");
    console.log("  Minting 750M JUBL to treasury:", TREASURY);
    const jubl = await deployContract("JUBL", [TREASURY]);
    deployed.JUBL = jubl.target;
    console.log("  ✔ JUBL:", jubl.target);
    console.log("  Supply:", ethers.formatUnits(await jubl.totalSupply(), 18), "JUBL");

    // ─── 2. Deploy JUBLVesting ───────────────────────────────────
    console.log("\n── Step 2: Deploy JUBLVesting ──");
    const vesting = await deployContract("JUBLVesting", [jubl.target]);
    deployed.JUBLVesting = vesting.target;
    console.log("  ✔ JUBLVesting:", vesting.target);

    // ─── 3. Renounce deployer MINTER_ROLE ────────────────────────
    console.log("\n── Step 3: Security Hardening ──");
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

    // Renounce MINTER_ROLE from deployer (RT-03 fix)
    await sendTx(jubl.renounceRole(MINTER_ROLE, deployer.address));
    console.log("  ✔ MINTER_ROLE renounced from deployer");

    // Transfer DEFAULT_ADMIN_ROLE to treasury (multisig)
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    await sendTx(jubl.grantRole(DEFAULT_ADMIN_ROLE, TREASURY));
    console.log("  ✔ DEFAULT_ADMIN_ROLE granted to multisig");

    await sendTx(jubl.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address));
    console.log("  ✔ DEFAULT_ADMIN_ROLE renounced from deployer");

    // Transfer JUBLVesting ownership to multisig
    await sendTx(vesting.transferOwnership(TREASURY));
    console.log("  ✔ JUBLVesting ownership → multisig");

    // ─── 4. Summary ──────────────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  🎉 JUBL TOKEN MAINNET DEPLOYMENT COMPLETE ✅");
    console.log("  Gas cost:", (0.00121 - parseFloat(endBalance)).toFixed(6), "ETH");
    console.log("  Remaining balance:", endBalance, "ETH");
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 Mainnet Contract Addresses:");
    console.log(JSON.stringify(deployed, null, 2));

    console.log("\n🔒 Ownership:");
    console.log("  JUBL admin:", TREASURY, "(multisig)");
    console.log("  JUBL minter: NONE (renounced — will be granted to JUBLEmissions later)");
    console.log("  JUBLVesting owner:", TREASURY, "(multisig)");

    // Save deployment
    const fs = require("fs");
    const path = require("path");
    const outDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "baseMainnet.json");
    const deployment = {
        network: "base",
        chainId: 8453,
        deployer: deployer.address,
        treasury: TREASURY,
        timestamp: new Date().toISOString(),
        contracts: deployed,
    };
    fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
    console.log(`\n💾 Saved to ${outPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
