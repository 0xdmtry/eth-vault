import {expect} from "chai";
import {ethers} from "hardhat";
import {time} from "@nomicfoundation/hardhat-network-helpers";
import type {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import type {VestingVault, MockERC20} from "../typechain-types";

describe("VestingVault", function () {
    let owner: HardhatEthersSigner;
    let beneficiary: HardhatEthersSigner;
    let token: MockERC20;
    let vault: VestingVault;

    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const GRANT_AMOUNT = ethers.parseEther("1000");

    beforeEach(async function () {
        [owner, beneficiary] = await ethers.getSigners();

        const TokenFactory = await ethers.getContractFactory("MockERC20");
        token = await TokenFactory.deploy();
        await token.waitForDeployment();

        const VaultFactory = await ethers.getContractFactory("VestingVault");
        vault = await VaultFactory.deploy(token);
        await vault.waitForDeployment();

        await token.mint(await vault.getAddress(), GRANT_AMOUNT);
    });

    it("Should add a grant correctly", async function () {
        const cliffSeconds = 30 * 24 * 60 * 60; // 30 days
        const durationSeconds = ONE_YEAR_IN_SECS;

        await expect(vault.addGrant(beneficiary.address, GRANT_AMOUNT, cliffSeconds, durationSeconds))
            .to.emit(vault, "GrantAdded")
            .withArgs(beneficiary.address, GRANT_AMOUNT);

        const grant = await vault.grants(beneficiary.address);
        expect(grant.total).to.equal(GRANT_AMOUNT);
    });

    it("Should not allow claiming before the cliff", async function () {
        const cliffSeconds = 30 * 24 * 60 * 60; // 30 days
        await vault.addGrant(beneficiary.address, GRANT_AMOUNT, cliffSeconds, ONE_YEAR_IN_SECS);

        await time.increase(cliffSeconds - 100);

        await expect(vault.connect(beneficiary).claim()).to.be.revertedWith("VestingVault: no vested tokens to claim");
    });

    it("Should allow claiming a portion of tokens after the cliff", async function () {
        const cliffSeconds = 30 * 24 * 60 * 60; // 30 days
        const durationSeconds = ONE_YEAR_IN_SECS;
        await vault.addGrant(beneficiary.address, GRANT_AMOUNT, cliffSeconds, durationSeconds);

        const halfwayTime = durationSeconds / 2;
        await time.increase(halfwayTime);

        const vestedAmount = await vault.vestedOf(beneficiary.address);
        expect(vestedAmount).to.be.closeTo(GRANT_AMOUNT / 2n, ethers.parseEther("1"));

        await expect(vault.connect(beneficiary).claim()).to.emit(vault, "TokensClaimed");

        const balance = await token.balanceOf(beneficiary.address);

        expect(balance).to.be.closeTo(vestedAmount, ethers.parseEther("0.1"));
    });

    it("Should allow claiming all tokens after the duration ends", async function () {
        const cliffSeconds = 0;
        const durationSeconds = ONE_YEAR_IN_SECS;
        await vault.addGrant(beneficiary.address, GRANT_AMOUNT, cliffSeconds, durationSeconds);

        await time.increase(durationSeconds + 1);

        const vestedAmount = await vault.vestedOf(beneficiary.address);
        expect(vestedAmount).to.equal(GRANT_AMOUNT);

        await vault.connect(beneficiary).claim();
        const balance = await token.balanceOf(beneficiary.address);
        expect(balance).to.equal(GRANT_AMOUNT);

        await expect(vault.connect(beneficiary).claim()).to.be.revertedWith("VestingVault: no new tokens to claim");
    });
});