import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("JubileeLending Unit Tests", function () {
    let jubileeLending, collateralManager, yieldRouter, oracleAggregator, healthFactorCalculator;
    let usdi, wbtc, weth;
    let btcOracle, ethOracle;
    let owner, user1, user2, liquidator;

    beforeEach(async function () {
        [owner, user1, user2, liquidator] = await ethers.getSigners();

        // Deploy Mocks
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        usdi = await MockERC20.deploy("Jubilee USD Index", "jUSDi");
        wbtc = await MockERC20.deploy("Wrapped BTC", "wBTC");
        weth = await MockERC20.deploy("Wrapped ETH", "wETH");

        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        // BTC Price: $60,000 (8 decimals)
        btcOracle = await MockV3Aggregator.deploy(8, 6000000000000n);
        // ETH Price: $3,000 (8 decimals)
        ethOracle = await MockV3Aggregator.deploy(8, 300000000000n);

        // Deploy Supporting Contracts
        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        oracleAggregator = await OracleAggregator.deploy();

        await oracleAggregator.setOracleConfig(wbtc.target, btcOracle.target, ethers.ZeroAddress, ethers.ZeroHash, 500);
        await oracleAggregator.setOracleConfig(weth.target, ethOracle.target, ethers.ZeroAddress, ethers.ZeroHash, 500);

        const CollateralManager = await ethers.getContractFactory("CollateralManager");
        collateralManager = await CollateralManager.deploy(oracleAggregator.target);

        const YieldRouter = await ethers.getContractFactory("YieldRouter");
        // Need lending contract address, so deploy it next

        const JubileeLending = await ethers.getContractFactory("JubileeLending");
        jubileeLending = await JubileeLending.deploy(collateralManager.target, ethers.ZeroAddress, usdi.target, owner.address);

        yieldRouter = await YieldRouter.deploy(jubileeLending.target);
        await jubileeLending.setYieldRouter(yieldRouter.target);

        const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
        const liquidationEngine = await LiquidationEngine.deploy(jubileeLending.target, collateralManager.target);
        await jubileeLending.setLiquidationEngine(liquidationEngine.target);

        // Set Collateral Factors: BTC = 75%, ETH = 70%
        await collateralManager.setCollateralFactor(wbtc.target, ethers.parseEther("0.75"));
        await collateralManager.setCollateralFactor(weth.target, ethers.parseEther("0.70"));

        // Mint tokens to users
        await wbtc.mint(user1.address, ethers.parseUnits("10", 18));
        await weth.mint(user2.address, ethers.parseUnits("100", 18));
        await usdi.mint(jubileeLending.target, ethers.parseUnits("1000000", 18));
    });

    describe("Collateral Deposit", function () {
        it("Should allow users to deposit supported collateral", async function () {
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await expect(jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18)))
                .to.emit(jubileeLending, "LoanCreated")
                .withArgs(1, user1.address, wbtc.target, ethers.parseUnits("1", 18));

            const loan = await jubileeLending.loans(1);
            expect(loan.borrower).to.equal(user1.address);
            expect(loan.collateralAmount).to.equal(ethers.parseUnits("1", 18));
        });

        it("Should fail for unsupported collateral", async function () {
            const FakeToken = await ethers.getContractFactory("MockERC20");
            const fake = await FakeToken.deploy("Fake", "FK");
            await fake.mint(user1.address, 100);
            await fake.connect(user1).approve(jubileeLending.target, 100);

            await expect(jubileeLending.connect(user1).depositCollateral(fake.target, 100))
                .to.be.revertedWith("Unsupported asset");
        });
    });

    describe("Borrowing", function () {
        beforeEach(async function () {
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));
        });

        it("Should allow borrowing within health factor limits", async function () {
            // 1 BTC = $60,000. CF = 75%. Max borrow = $45,000.
            const borrowAmount = ethers.parseUnits("40000", 18);
            await jubileeLending.connect(user1).borrow(1, borrowAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(borrowAmount);
            expect(await usdi.balanceOf(user1.address)).to.equal(borrowAmount);
        });

        it("Should fail if borrowing exceeds health factor", async function () {
            // 1 BTC = $60,000. Max borrow = $45,000. Try $46,000.
            const borrowAmount = ethers.parseUnits("46000", 18);
            await expect(jubileeLending.connect(user1).borrow(1, borrowAmount))
                .to.be.revertedWith("Insufficient health factor");
        });
    });

    describe("Repayment", function () {
        const borrowAmount = ethers.parseUnits("20000", 18);

        beforeEach(async function () {
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).borrow(1, borrowAmount);
            await usdi.connect(user1).approve(jubileeLending.target, borrowAmount);
        });

        it("Should allow manual repayment", async function () {
            const repayAmount = ethers.parseUnits("10000", 18);
            await jubileeLending.connect(user1).repay(1, repayAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(borrowAmount - repayAmount);
        });

        it("Should allow yield repayment via YieldRouter", async function () {
            const yieldAmount = ethers.parseUnits("5000", 18);
            // Mint USDi to YieldRouter so it can repay (simulating claimYield)
            await usdi.mint(yieldRouter.target, yieldAmount);

            await yieldRouter.connect(owner).routeYieldToRepayment(1, yieldAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.borrowedAmount).to.equal(borrowAmount - yieldAmount);
        });
    });

    describe("Collateral Withdrawal", function () {
        const depositAmount = ethers.parseUnits("1", 18);
        const borrowAmount = ethers.parseUnits("30000", 18);

        beforeEach(async function () {
            await wbtc.connect(user1).approve(jubileeLending.target, depositAmount);
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, depositAmount);
            await jubileeLending.connect(user1).borrow(1, borrowAmount);
        });

        it("Should allow withdrawal if health factor permits", async function () {
            // 1 BTC = $60,000. Borrowed = $30,000. 
            // Required Collateral Value = $30,000 / 0.75 = $40,000.
            // Current Collateral Value = $60,000.
            // Can withdraw up to $20,000 worth of BTC. 
            // $20,000 / $60,000 = 0.333 BTC. Try 0.1 BTC.
            const withdrawAmount = ethers.parseUnits("0.1", 18);
            await jubileeLending.connect(user1).withdrawCollateral(1, withdrawAmount);

            const loan = await jubileeLending.loans(1);
            expect(loan.collateralAmount).to.equal(depositAmount - withdrawAmount);
        });

        it("Should fail withdrawal if it violates health factor", async function () {
            // Try to withdraw 0.5 BTC. Remaining = 0.5 BTC = $30,000.
            // $30,000 * 0.75 = $22,500. Borrowed = $30,000. HF < 1.0.
            const withdrawAmount = ethers.parseUnits("0.5", 18);
            await expect(jubileeLending.connect(user1).withdrawCollateral(1, withdrawAmount))
                .to.be.revertedWith("Withdrawal would violate health factor");
        });
    });

    describe("Liquidation", function () {
        let liquidationEngine;

        beforeEach(async function () {
            const LiquidationEngine = await ethers.getContractFactory("LiquidationEngine");
            liquidationEngine = await LiquidationEngine.deploy(jubileeLending.target, collateralManager.target);
            await jubileeLending.setLiquidationEngine(liquidationEngine.target);

            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));
            // Borrow max possible ($45,000)
            await jubileeLending.connect(user1).borrow(1, ethers.parseUnits("45000", 18));
        });

        it("Should allow liquidation when health factor < 1.0", async function () {
            // Drop BTC price from $60,000 to $50,000
            // 1 BTC = $50,000. Borrowed = $45,000. CF = 75%.
            // Debt = $45,000. Bonus = 5% ($2,250). Total value to seize = $47,250.
            // Collateral price = $50,000.
            // Expected BTC seizure = 47,250 / 50,000 = 0.945 BTC.
            await btcOracle.updatePrice(5000000000000n);

            await usdi.mint(liquidator.address, ethers.parseUnits("45000", 18));
            await usdi.connect(liquidator).approve(jubileeLending.target, ethers.parseUnits("45000", 18));

            const expectedSeizure = ethers.parseUnits("0.954", 18);

            // Calculate expected seizure: (debt * (1 + bonus)) / price = (45000 * 1.05) / 50000 = 0.945 BTC
            // But contract may have slight rounding differences
            await liquidationEngine.connect(liquidator).liquidate(1, ethers.parseUnits("45000", 18));

            const loan = await jubileeLending.loans(1);
            expect(loan.active).to.be.true; // Remained active because collateral > 0

            const liquidatorBalance = await wbtc.balanceOf(liquidator.address);
            expect(liquidatorBalance).to.be.closeTo(ethers.parseUnits("0.945", 18), ethers.parseUnits("0.01", 18));
        });

        it("Should fail liquidation if health factor >= 1.0", async function () {
            await usdi.mint(liquidator.address, ethers.parseUnits("45000", 18));
            await usdi.connect(liquidator).approve(jubileeLending.target, ethers.parseUnits("45000", 18));

            await expect(liquidationEngine.connect(liquidator).liquidate(1, ethers.parseUnits("45000", 18)))
                .to.be.revertedWith("Loan is healthy");
        });
    });

    describe("JUBL Boost", function () {
        let jubl, jublBoost;

        beforeEach(async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            jubl = await MockERC20.deploy("Jubilee Token", "JUBL");

            const JUBLBoost = await ethers.getContractFactory("JUBLBoost");
            jublBoost = await JUBLBoost.deploy(jubl.target);
            await collateralManager.setJUBLBoost(jublBoost.target);

            await jubl.mint(user1.address, ethers.parseUnits("5000", 18));
            await jubl.connect(user1).approve(jublBoost.target, ethers.parseUnits("5000", 18));
        });

        it("Should increase health factor after staking JUBL", async function () {
            await wbtc.connect(user1).approve(jubileeLending.target, ethers.parseUnits("1", 18));
            await jubileeLending.connect(user1).depositCollateral(wbtc.target, ethers.parseUnits("1", 18));

            // Before boost: Max borrow $45,000
            // Try to borrow $48,000 -> should fail
            await expect(jubileeLending.connect(user1).borrow(1, ethers.parseUnits("48000", 18)))
                .to.be.revertedWith("Insufficient health factor");

            // Stake 2000 JUBL (+4% CF = 79%)
            // 1 BTC = $60,000 * 0.79 = $47,400. Still fails for $48,000.
            await jublBoost.connect(user1).stake(ethers.parseUnits("2000", 18));

            // Stake 5000 JUBL (+10% CF = 85%)
            // 1 BTC = $60,000 * 0.85 = $51,000. Should allow $48,000.
            await jublBoost.connect(user1).stake(ethers.parseUnits("3000", 18));

            await expect(jubileeLending.connect(user1).borrow(1, ethers.parseUnits("48000", 18)))
                .to.emit(jubileeLending, "Borrowed");
        });
    });
});
