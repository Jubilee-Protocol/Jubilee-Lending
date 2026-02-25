import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("Jubilee Protocol Integration Tests", function () {
    let jubl, jublBoost, choiceYield, feeCollector, firstFruitsFund;
    let jubileeLending, collateralManager, oracleAggregator, yieldRouter;
    let usdi, wbtc;
    let btcOracle;
    let owner, user1, charity;

    beforeEach(async function () {
        [owner, user1, charity] = await ethers.getSigners();

        // ── Deploy Mocks ──
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        usdi = await MockERC20.deploy("Jubilee USD Index", "jUSDi");
        wbtc = await MockERC20.deploy("Wrapped BTC", "wBTC");
        jubl = await MockERC20.deploy("Jubilee Token", "JUBL");

        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        btcOracle = await MockV3Aggregator.deploy(8, 6000000000000n); // $60,000

        // ── Deploy Oracle ──
        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        oracleAggregator = await OracleAggregator.deploy();
        await oracleAggregator.setOracleConfig(wbtc.target, btcOracle.target, ethers.ZeroAddress, ethers.ZeroHash, 500);

        // ── Deploy Collateral Manager ──
        const CollateralManager = await ethers.getContractFactory("CollateralManager");
        collateralManager = await CollateralManager.deploy(oracleAggregator.target);
        await collateralManager.setCollateralFactor(wbtc.target, ethers.parseEther("0.75"));

        // ── Deploy JUBL Boost ──
        const JUBLBoost = await ethers.getContractFactory("JUBLBoost");
        jublBoost = await JUBLBoost.deploy(jubl.target);
        await collateralManager.setJUBLBoost(jublBoost.target);

        // ── Deploy Lending ──
        const JubileeLending = await ethers.getContractFactory("JubileeLending");
        jubileeLending = await JubileeLending.deploy(collateralManager.target, ethers.ZeroAddress, usdi.target, owner.address);

        // ── Deploy YieldRouter ──
        const YieldRouter = await ethers.getContractFactory("YieldRouter");
        yieldRouter = await YieldRouter.deploy(jubileeLending.target);
        await jubileeLending.setYieldRouter(yieldRouter.target);

        // ── Deploy Liquidation Engine ──
        const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
        const liquidationEngine = await LiquidationEngine.deploy(jubileeLending.target, collateralManager.target);
        await jubileeLending.setLiquidationEngine(liquidationEngine.target);

        // ── Deploy Revenue System ──
        // First Fruits Fund
        const FirstFruitsFund = await ethers.getContractFactory("FirstFruitsFund");
        firstFruitsFund = await FirstFruitsFund.deploy();

        // ChoiceYield
        const ChoiceYield = await ethers.getContractFactory("ChoiceYield");
        choiceYield = await ChoiceYield.deploy(jublBoost.target);

        // FeeCollector
        const FeeCollector = await ethers.getContractFactory("FeeCollector");
        feeCollector = await FeeCollector.deploy(choiceYield.target, firstFruitsFund.target);

        // Cross-wire
        await jublBoost.setLendingContract(jubileeLending.target);
        await jublBoost.setChoiceYield(choiceYield.target);

        // Register jUSDi as a reward asset in ChoiceYield (H-05: no auto-add)
        await choiceYield.addRewardAsset(usdi.target);

        // Mint tokens
        await wbtc.mint(user1.address, ethers.parseUnits("10", 18));
        await jubl.mint(user1.address, ethers.parseUnits("5000", 18));
        await usdi.mint(jubileeLending.target, ethers.parseUnits("1000000", 18));
    });

    describe("Full Lending Lifecycle", function () {
        it("Should complete deposit → borrow → repay → withdraw cycle", async function () {
            // 1. Deposit 1 BTC as collateral
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));

            // 2. Borrow $30,000 jUSDi
            const borrowAmount = ethers.parseUnits("30000", 18);
            await jubileeLending.connect(user1).borrow(1, borrowAmount);
            expect(await usdi.balanceOf(user1.address)).to.equal(borrowAmount);

            // 3. Repay $15,000
            const repayAmount = ethers.parseUnits("15000", 18);
            await usdi.connect(user1).approve(jubileeLending.target, repayAmount);
            await jubileeLending.connect(user1).repay(1, repayAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(borrowAmount - repayAmount);

            // 4. Repay remaining
            await usdi.connect(user1).approve(jubileeLending.target, repayAmount);
            await jubileeLending.connect(user1).repay(1, repayAmount);

            // 5. Withdraw all collateral
            await jubileeLending.connect(user1).withdrawCollateral(1, ethers.parseUnits("1", 18));
            expect(await wbtc.balanceOf(user1.address)).to.equal(ethers.parseUnits("10", 18));
        });

        it("Should allow yield-based auto-repayment via YieldRouter", async function () {
            // Setup loan
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).borrow(1, ethers.parseUnits("20000", 18));

            // Simulate yield: mint jUSDi to YieldRouter (as if claimYield returned it)
            const yieldAmount = ethers.parseUnits("5000", 18);
            await usdi.mint(yieldRouter.target, yieldAmount);

            // Apply yield repayment
            await yieldRouter.routeYieldToRepayment(1, yieldAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(ethers.parseUnits("15000", 18));
        });
    });

    describe("JUBL Boost with Lending", function () {
        it("Should allow higher borrow with JUBL staking", async function () {
            // Deposit 1 BTC ($60,000)
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));

            // Without boost: CF = 75%, max borrow = $45,000
            // Try $48,000 → should fail
            await expect(jubileeLending.connect(user1).borrow(1, ethers.parseUnits("48000", 18)))
                .to.be.revertedWith("Insufficient health factor");

            // Stake 5000 JUBL (+10% max boost = CF 85%)
            await jubl.connect(user1).approve(jublBoost.target, ethers.parseUnits("5000", 18));
            await jublBoost.connect(user1).stake(ethers.parseUnits("5000", 18));

            // Now $48,000 should succeed
            await jubileeLending.connect(user1).borrow(1, ethers.parseUnits("48000", 18));

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(ethers.parseUnits("48000", 18));
        });

        it("Should prevent unstaking if it would make loan unhealthy", async function () {
            // Stake, deposit, borrow near max
            await jubl.connect(user1).approve(jublBoost.target, ethers.parseUnits("5000", 18));
            await jublBoost.connect(user1).stake(ethers.parseUnits("5000", 18));

            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).borrow(1, ethers.parseUnits("50000", 18));

            // Try to unstake → should revert
            await expect(jublBoost.connect(user1).unstake(ethers.parseUnits("5000", 18)))
                .to.be.revertedWith("Unstaking would cause liquidatability");
        });
    });

    describe("Revenue Distribution (First Fruits + Choice Yield)", function () {
        it("Should split fees: 10% to FirstFruits, 90% to ChoiceYield", async function () {
            const feeAmount = ethers.parseUnits("10000", 18);
            await usdi.mint(owner.address, feeAmount);
            await usdi.approve(feeCollector.target, feeAmount);

            await feeCollector.collectFees(usdi.target, feeAmount);

            // 10% = 1000 jUSDi to FirstFruitsFund
            expect(await usdi.balanceOf(firstFruitsFund.target)).to.equal(ethers.parseUnits("1000", 18));

            // 90% = 9000 jUSDi to ChoiceYield
            expect(await usdi.balanceOf(choiceYield.target)).to.equal(ethers.parseUnits("9000", 18));
        });

        it("Should allow stakers to claim Choice Yield rewards", async function () {
            // User stakes JUBL
            await jubl.connect(user1).approve(jublBoost.target, ethers.parseUnits("5000", 18));
            await jublBoost.connect(user1).stake(ethers.parseUnits("5000", 18));

            // Protocol generates fees
            const feeAmount = ethers.parseUnits("10000", 18);
            await usdi.mint(owner.address, feeAmount);
            await usdi.approve(feeCollector.target, feeAmount);
            await feeCollector.collectFees(usdi.target, feeAmount);

            // User claims rewards (should get 90% = 9000 since they're the only staker)
            const pendingBefore = await choiceYield.calculateReward(user1.address, usdi.target);
            expect(pendingBefore).to.equal(ethers.parseUnits("9000", 18));

            await choiceYield.connect(user1).claimReward(usdi.target);
            expect(await usdi.balanceOf(user1.address)).to.equal(ethers.parseUnits("9000", 18));
        });

        it("Should allow FirstFruits to disburse to whitelisted charities", async function () {
            // Generate fees
            const feeAmount = ethers.parseUnits("10000", 18);
            await usdi.mint(owner.address, feeAmount);
            await usdi.approve(feeCollector.target, feeAmount);
            await feeCollector.collectFees(usdi.target, feeAmount);

            // Whitelist charity
            await firstFruitsFund.setRecipient(charity.address, true);

            // Disburse 500 jUSDi to charity
            await firstFruitsFund.disburse(usdi.target, charity.address, ethers.parseUnits("500", 18));
            expect(await usdi.balanceOf(charity.address)).to.equal(ethers.parseUnits("500", 18));
        });

        it("Should reject disbursement to non-whitelisted address", async function () {
            const feeAmount = ethers.parseUnits("1000", 18);
            await usdi.mint(owner.address, feeAmount);
            await usdi.approve(feeCollector.target, feeAmount);
            await feeCollector.collectFees(usdi.target, feeAmount);

            await expect(firstFruitsFund.disburse(usdi.target, charity.address, 100))
                .to.be.revertedWith("Recipient not whitelisted");
        });
    });
});
