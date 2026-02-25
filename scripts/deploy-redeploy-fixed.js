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
    console.log("  Redeploy Fixed Contracts (RT fixes)");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Existing contracts that DON'T need redeployment
    const EXISTING = {
        JUBL_Mock: "0xc05031b4282d2306430AD2b7eF18F80902aF976F",
        JUBL_Real: "0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1",
        jUSDi: "0xaebc0456Bdb46C4C278Ff9d6Dd96fF98D73CCc21",
        JubileeLending: "0x1b55eF520AEf9c2657C99343738641dCC92a840F",
        CollateralManager: "0xe1B0D9F7225e68B769d1EFd3e63ee47753812ECA",
        FirstFruitsFund: "0xe297E5c4408e6f9bebdb2180F4d68E38c3915014",
    };

    // Attach to existing contracts we need to re-wire
    const collateralManager = await ethers.getContractAt("CollateralManager", EXISTING.CollateralManager);

    const deployed = {};

    // ─── 1. Redeploy JUBLBoost (RT-01, RT-04 fixes) ─────────────
    console.log("── Step 1: Redeploy JUBLBoost ──");
    const jublBoost = await deployContract("JUBLBoost", [EXISTING.JUBL_Mock]);
    deployed.JUBLBoost = jublBoost.target;
    console.log("  JUBLBoost:", jublBoost.target);

    // ─── 2. Redeploy JUBLEmissions (RT-06 fix) ──────────────────
    console.log("\n── Step 2: Redeploy JUBLEmissions ──");
    const jublEmissions = await deployContract("JUBLEmissions", [EXISTING.JUBL_Mock, jublBoost.target]);
    deployed.JUBLEmissions = jublEmissions.target;
    console.log("  JUBLEmissions:", jublEmissions.target);

    // ─── 3. Redeploy ChoiceYield (RT-02, RT-05 fixes) ────────────
    console.log("\n── Step 3: Redeploy ChoiceYield ──");
    const choiceYield = await deployContract("ChoiceYield", [jublBoost.target]);
    deployed.ChoiceYield = choiceYield.target;
    console.log("  ChoiceYield:", choiceYield.target);

    // ─── 4. Re-wire everything ───────────────────────────────────
    console.log("\n── Step 4: Re-wire ──");

    await sendTx(jublBoost.setLendingContract(EXISTING.JubileeLending));
    console.log("  ✔ JUBLBoost → LendingContract");

    await sendTx(jublBoost.setChoiceYield(choiceYield.target));
    console.log("  ✔ JUBLBoost → ChoiceYield");

    await sendTx(jublBoost.setEmissions(jublEmissions.target));
    console.log("  ✔ JUBLBoost → Emissions");

    await sendTx(collateralManager.setJUBLBoost(jublBoost.target));
    console.log("  ✔ CollateralManager → JUBLBoost");

    await sendTx(choiceYield.addRewardAsset(EXISTING.jUSDi));
    console.log("  ✔ ChoiceYield: jUSDi registered");

    // ─── 5. Summary ──────────────────────────────────────────────
    const endBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  REDEPLOYMENT COMPLETE ✅");
    console.log("  Remaining ETH:", endBalance);
    console.log("═══════════════════════════════════════════════════\n");

    console.log("📋 New Contract Addresses:");
    console.log(JSON.stringify(deployed, null, 2));

    // Update deployment file
    const fs = require("fs");
    const path = require("path");
    const outPath = path.join(__dirname, "../deployments/baseSepolia.json");
    const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    existing.contracts.JUBLBoost = deployed.JUBLBoost;
    existing.contracts.JUBLEmissions = deployed.JUBLEmissions;
    existing.contracts.ChoiceYield = deployed.ChoiceYield;
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
