/**
 * Jubilee Lending Keeper Bot
 * 
 * A simple Node.js script to periodically harvest yield and apply to loans.
 * Run with: node scripts/keeper.js
 * 
 * Requires:
 * - PRIVATE_KEY env variable (keeper wallet)
 * - BASE_SEPOLIA_RPC_URL env variable
 */

require("dotenv").config();
const { ethers } = require("ethers");

// Contract ABIs (simplified)
const YIELD_ROUTER_ABI = [
    "function harvestAndApply(uint256 loanId, address collateralAsset) external",
    "function routeYieldToRepayment(uint256 loanId, uint256 yieldAmount) external",
    "function keepers(address) view returns (bool)"
];

const LENDING_ABI = [
    "function loanCounter() view returns (uint256)",
    "function loans(uint256) view returns (uint256 id, address borrower, address collateralAsset, uint256 collateralAmount, uint256 borrowedAmount, bool active)"
];

// Configuration
const CONFIG = {
    YIELD_ROUTER: "0x812C63d84043486652467F3552f47e29d75aFA5e",
    LENDING: "0xD9A27A8183d1de0A20d4343Fe63aA119EDa80f00",
    INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    COLLATERAL_ASSETS: [
        // Add your supported collateral addresses here
    ]
};

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log(`Keeper bot started with address: ${wallet.address}`);

    const yieldRouter = new ethers.Contract(CONFIG.YIELD_ROUTER, YIELD_ROUTER_ABI, wallet);
    const lending = new ethers.Contract(CONFIG.LENDING, LENDING_ABI, provider);

    // Verify keeper status
    const isKeeper = await yieldRouter.keepers(wallet.address);
    if (!isKeeper) {
        console.error("⚠️  WARNING: This wallet is not registered as a keeper!");
        console.error("Run: yieldRouter.setKeeper(your_address, true) from owner");
    }

    async function harvestAllLoans() {
        console.log(`[${new Date().toISOString()}] Starting harvest cycle...`);

        try {
            const loanCount = await lending.loanCounter();
            console.log(`Total loans: ${loanCount}`);

            for (let i = 1; i <= loanCount; i++) {
                const loan = await lending.loans(i);

                if (loan.active && loan.borrowedAmount > 0n) {
                    console.log(`Processing loan #${i} (debt: ${ethers.formatUnits(loan.borrowedAmount, 18)} jUSDi)`);

                    try {
                        const tx = await yieldRouter.harvestAndApply(i, loan.collateralAsset, {
                            gasLimit: 500000n
                        });
                        console.log(`  TX sent: ${tx.hash}`);
                        await tx.wait();
                        console.log(`  ✅ Harvest complete for loan #${i}`);
                    } catch (err) {
                        console.log(`  ⚠️ Skipped loan #${i}: ${err.reason || err.message}`);
                    }
                }
            }
        } catch (err) {
            console.error(`Harvest cycle failed: ${err.message}`);
        }

        console.log(`[${new Date().toISOString()}] Harvest cycle complete. Next run in ${CONFIG.INTERVAL_MS / 1000}s`);
    }

    // Run immediately
    await harvestAllLoans();

    // Then run on interval
    setInterval(harvestAllLoans, CONFIG.INTERVAL_MS);
}

main().catch(console.error);
