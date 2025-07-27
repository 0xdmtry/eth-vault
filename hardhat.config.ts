import {HardhatUserConfig, task} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import express from "express";
import cors from "cors";
import deploymentInfo from "./deployment-info.json";
import {VestingVault__factory} from "./typechain-types";

task("start-api", "Starts the API server for the VestingVault")
    .setAction(async (taskArgs, hre) => {
        const {ethers} = hre;
        const app = express();
        app.use(cors());
        app.use(express.json());

        const PORT = 3000;
        const provider = hre.ethers.provider;

        const vaultContract = VestingVault__factory.connect(
            deploymentInfo.vaultAddress,
            provider
        );

        console.log(`API server connected to VestingVault at ${vaultContract.target}`);
        console.log(`Beneficiary for testing: ${deploymentInfo.beneficiaryAddress}`);

        app.get("/vested/:beneficiary", async (req, res) => {
            try {
                const {beneficiary} = req.params;
                const vestedAmount = await vaultContract.vestedOf(beneficiary);
                res.json({beneficiary, vested: ethers.formatEther(vestedAmount)});
            } catch (error: any) {
                res.status(500).json({error: error.message});
            }
        });

        app.get("/grant/:beneficiary", async (req, res) => {
            try {
                const {beneficiary} = req.params;
                const grant = await vaultContract.grants(beneficiary);
                res.json({
                    beneficiary,
                    total: ethers.formatEther(grant.total),
                    claimed: ethers.formatEther(grant.claimed),
                    start: new Date(Number(grant.start) * 1000).toISOString(),
                    cliff: new Date(Number(grant.cliff) * 1000).toISOString(),
                    duration: Number(grant.duration),
                });
            } catch (error: any) {
                res.status(500).json({error: error.message});
            }
        });

        app.post("/claim", async (req, res) => {
            try {
                const {beneficiaryAddress} = req.body;
                if (!beneficiaryAddress) {
                    return res.status(400).json({error: "beneficiaryAddress is required"});
                }
                const beneficiarySigner = await ethers.getImpersonatedSigner(beneficiaryAddress);
                const tx = await vaultContract.connect(beneficiarySigner).claim();
                await tx.wait();
                res.json({success: true, txHash: tx.hash});
            } catch (error: any) {
                res.status(500).json({error: error.reason || error.message});
            }
        });

        app.listen(PORT, () => {
            console.log(`\nServer is running on http://localhost:${PORT}`);
        });

        await new Promise(() => {
        });
    });

const config: HardhatUserConfig = {
    solidity: "0.8.28",
};

export default config;