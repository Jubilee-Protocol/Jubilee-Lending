const { ethers } = require("hardhat");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendTx(label, txPromise) {
    const tx = await txPromise;
    const receipt = await tx.wait(1);
    console.log(`  ✔ ${label} (gas: ${receipt.gasUsed.toString()})`);
    await delay(3000);
    return receipt;
}

async function main() {
    const [deployer] = await ethers.getSigners();

    // V2 deployment addresses
    const ADDRS = {
        wBTC: "0x2815d17EbF603899aae2917fF12C519D4dFE6Fec",
        jUSDi: "0x3c2F7D11508F7C7D9E41eD38fa33CbEcd55f4A66",
        JUBL: "0xEB70EFca1B973A06699B019677af0ed20B1Dd9F1",
        CollateralManager: "0x7038573cf240F91D3aE2aC1bfF9E93bb38C6861F",
        JubileeLending: "0x308BdECdF60339De562ADC6b097fEc166e8F5c08",
        JUBLBoost: "0x978E766eBd39Ff68bcfcC1f354c43793134ba4d1",
    };

    const wbtc = await ethers.getContractAt("MockERC20", ADDRS.wBTC);
    const jusdi = await ethers.getContractAt("jUSDi", ADDRS.jUSDi);
    const lending = await ethers.getContractAt("JubileeLending", ADDRS.JubileeLending);
    const cm = await ethers.getContractAt("CollateralManager", ADDRS.CollateralManager);

    console.log("═══════════════════════════════════════════════════");
    console.log("  Jubilee Lending — E2E Test (Base Sepolia V2)");
    console.log("═══════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Check test token balances
    const wbtcBal = await wbtc.balanceOf(deployer.address);
    const jusdiBal = await jusdi.balanceOf(lending.target);
    console.log("  wBTC balance:", ethers.formatUnits(wbtcBal, 18), "wBTC");
    console.log("  jUSDi in pool:", ethers.formatUnits(jusdiBal, 18), "jUSDi\n");

    // ─── 1. Deposit Collateral ───────────────────────────────────
    console.log("── Test 1: Deposit 1 wBTC as Collateral ──");
    const depositAmt = ethers.parseUnits("1", 18);
    await sendTx("Approve wBTC", wbtc.approve(lending.target, depositAmt));
    await sendTx("Deposit 1 wBTC", lending.depositCollateral(ADDRS.wBTC, depositAmt));

    // Get actual loan ID
    const loanId = await lending.loanCounter();
    console.log(`  Loan ID: ${loanId}`);

    // Check collateral value
    const collValue = await cm.getCollateralValue(ADDRS.wBTC, depositAmt);
    console.log(`  Collateral value: $${ethers.formatUnits(collValue, 8)}`);

    // ─── 2. Borrow jUSDi ─────────────────────────────────────────
    console.log("\n── Test 2: Borrow 30,000 jUSDi ──");
    const borrowAmt = ethers.parseUnits("30000", 18);
    await sendTx("Borrow 30K jUSDi", lending.borrow(loanId, borrowAmt));

    const jusdiUserBal = await jusdi.balanceOf(deployer.address);
    console.log(`  jUSDi received: ${ethers.formatUnits(jusdiUserBal, 18)}`);

    // Check health factor
    const loan = await lending.loans(loanId);
    const cv = await cm.getCollateralValue(loan.collateralAsset, loan.collateralAmount);
    const cf = await cm.getBoostedCollateralFactor(deployer.address, loan.collateralAsset);
    const hf = await cm.calculateHealthFactor(loan.borrowedAmount, cv, cf);
    console.log(`  Health Factor: ${ethers.formatEther(hf)}`);

    // ─── 3. Repay Partial ────────────────────────────────────────
    console.log("\n── Test 3: Repay 10,000 jUSDi ──");
    const repayAmt = ethers.parseUnits("10000", 18);
    await sendTx("Approve jUSDi", jusdi.approve(lending.target, repayAmt));
    await sendTx("Repay 10K jUSDi", lending.repay(loanId, repayAmt));

    const loanAfterRepay = await lending.loans(loanId);
    console.log(`  Remaining debt: ${ethers.formatUnits(loanAfterRepay.borrowedAmount, 18)} jUSDi`);

    // ─── 4. Add Collateral (H-04 fix) ────────────────────────────
    console.log("\n── Test 4: Add 0.5 wBTC Collateral (H-04) ──");
    const addAmt = ethers.parseUnits("0.5", 18);
    await sendTx("Approve wBTC", wbtc.approve(lending.target, addAmt));
    await sendTx("Add 0.5 wBTC collateral", lending.addCollateral(loanId, addAmt));

    const loanAfterAdd = await lending.loans(loanId);
    console.log(`  New collateral: ${ethers.formatUnits(loanAfterAdd.collateralAmount, 18)} wBTC`);

    // ─── 5. Full Repay & Withdraw ────────────────────────────────
    console.log("\n── Test 5: Full Repay & Withdraw ──");
    const remainingDebt = loanAfterAdd.borrowedAmount;
    await sendTx("Approve remaining jUSDi", jusdi.approve(lending.target, remainingDebt));
    await sendTx("Repay remaining debt", lending.repay(loanId, remainingDebt));

    const loanAfterFull = await lending.loans(loanId);
    console.log(`  Debt after full repay: ${ethers.formatUnits(loanAfterFull.borrowedAmount, 18)} jUSDi`);

    // Withdraw all collateral
    await sendTx("Withdraw all collateral", lending.withdrawCollateral(loanId, loanAfterFull.collateralAmount));
    console.log("  ✔ All collateral withdrawn");

    // ─── 6. Summary ──────────────────────────────────────────────
    const finalWbtc = await wbtc.balanceOf(deployer.address);
    const finalJusdi = await jusdi.balanceOf(deployer.address);

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  E2E TEST COMPLETE ✅");
    console.log("═══════════════════════════════════════════════════");
    console.log("  wBTC balance:", ethers.formatUnits(finalWbtc, 18));
    console.log("  jUSDi balance:", ethers.formatUnits(finalJusdi, 18));
    console.log("  Remaining ETH:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ E2E Test failed:", error.message || error);
        process.exit(1);
    });
