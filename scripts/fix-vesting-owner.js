const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const TREASURY = "0x46c008C4eD16C491a5876F2dB7de169Bd196d410";
    const VESTING = "0x3560B663e5618E5842c9C7C1435c429da4DDeC4d";

    console.log("Completing JUBLVesting ownership transfer...");
    console.log("Deployer:", deployer.address);

    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 8453n) {
        console.error("Wrong network!");
        process.exit(1);
    }

    const vesting = await ethers.getContractAt("JUBLVesting", VESTING);
    const currentOwner = await vesting.owner();
    console.log("Current owner:", currentOwner);

    if (currentOwner.toLowerCase() === deployer.address.toLowerCase()) {
        const tx = await vesting.transferOwnership(TREASURY);
        await tx.wait(1);
        console.log("✔ JUBLVesting ownership transferred to:", TREASURY);
    } else {
        console.log("Already transferred or deployer is not owner");
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
