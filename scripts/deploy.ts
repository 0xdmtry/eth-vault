import {ethers} from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const [deployer, beneficiary] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const tokenFactory = await ethers.getContractFactory("MockERC20");
    const token = await tokenFactory.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("MockERC20 deployed to:", tokenAddress);

    const vaultFactory = await ethers.getContractFactory("VestingVault");
    const vault = await vaultFactory.deploy(tokenAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("VestingVault deployed to:", vaultAddress);

    const vaultSupply = ethers.parseEther("10000000");
    await token.mint(vaultAddress, vaultSupply);
    console.log(`Minted ${ethers.formatEther(vaultSupply)} MTK to the VestingVault.`);

    console.log("Seeding a test grant...");
    const grantAmount = ethers.parseEther("5000");
    const cliff = 60; // 1 minute
    const duration = 300; // 5 minutes

    await vault.addGrant(beneficiary.address, grantAmount, cliff, duration);
    console.log(`Grant for 5000 tokens added for beneficiary:`, beneficiary.address);

    const deploymentInfo = {
        tokenAddress: tokenAddress,
        vaultAddress: vaultAddress,
        deployerAddress: deployer.address,
        beneficiaryAddress: beneficiary.address,
    };

    fs.writeFileSync(
        path.join(__dirname, "../deployment-info.json"),
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\nDeployment info saved to deployment-info.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});