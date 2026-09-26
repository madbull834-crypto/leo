import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("TheLio business plan", function () {
  async function deploy() {
    const [admin, alice, bob, carol] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TheLio");
    const lio = await factory.deploy(admin.address, ethers.constants.AddressZero, 100);
    await lio.deployed();
    await lio.fundTreasury(1_000_000, { value: 1_000_000 });
    return { lio, admin, alice, bob, carol };
  }

  it("collects the investment, enforces the $100 minimum, and has no maximum", async function () {
    const { lio, admin, alice, bob } = await deploy();

    await expect(
      lio.connect(alice).activateInvestor(admin.address, 99, { value: 99 }),
    ).to.be.revertedWith("LioInvestment: below minimum");
    await expect(
      lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 999 }),
    ).to.be.revertedWith("LioCore: incorrect native value");

    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });
    await lio.connect(bob).activateInvestor(admin.address, 500_000, { value: 500_000 });
    expect((await lio.getUserProfile(alice.address)).principal).to.equal(1_000);
    expect((await lio.getUserProfile(bob.address)).principal).to.equal(500_000);
  });

  it("pays exactly one 5% direct reward and tracks direct business", async function () {
    const { lio, admin, alice } = await deploy();
    const before = await ethers.provider.getBalance(admin.address);
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });

    const referrer = await lio.getUserProfile(admin.address);
    expect(referrer.directRewards).to.equal(50);
    expect(referrer.claimableBalance).to.equal(0);
    expect(await ethers.provider.getBalance(admin.address)).to.equal(before.add(50));
    expect(await lio.directBusiness(admin.address)).to.equal(1_000);
    expect(await lio.directRewardIssued(alice.address)).to.equal(true);
  });

  it("supports an assigned monthly ROI from 8% through 32% and deducts 5%", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });
    await lio.setUserMonthlyRoi(alice.address, 3_200);
    expect(await lio.getSelectedMonthlyRoi(alice.address)).to.equal(3_200);
    await expect(lio.setUserMonthlyRoi(alice.address, 3_201)).to.be.revertedWith(
      "LioROI: rate out of range",
    );

    await network.provider.send("evm_increaseTime", [30 * 86_400]);
    await network.provider.send("evm_mine");
    const before = await ethers.provider.getBalance(lio.address);
    await lio.connect(alice).claimForUser(alice.address);
    const after = await ethers.provider.getBalance(lio.address);

    expect(before.sub(after)).to.equal(304); // 320 gross - 5% fee
    const profile = await lio.getUserProfile(alice.address);
    expect(profile.roiClaimed).to.equal(320);
    expect(profile.totalClaimed).to.equal(304);
    await expect(lio.connect(alice).claimMonthlyInvestment(alice.address, 1)).to.be.revertedWith(
      "LioROI: nothing to claim",
    );
  });

  it("requires matched left and right business and pays once per week", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });

    await lio.updateUserBusiness(alice.address, 5_000, 0, 0);
    expect(await lio.getCurrentTier(alice.address)).to.equal(0);
    await lio.updateUserBusiness(alice.address, 2_500, 2_500, 0);
    expect(await lio.getCurrentTier(alice.address)).to.equal(1);

    const before = await ethers.provider.getBalance(lio.address);
    await lio.connect(alice).claimWeeklyForUser(alice.address);
    expect(before.sub(await ethers.provider.getBalance(lio.address))).to.equal(25);
    await expect(lio.connect(alice).claimWeeklyForUser(alice.address)).to.be.revertedWith(
      "LioTeamRewards: already claimed for week",
    );
  });

  it("locks and then returns principal after six months", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });
    await expect(lio.connect(alice).withdrawPrincipal()).to.be.revertedWith(
      "LioInvestment: principal locked",
    );

    await network.provider.send("evm_increaseTime", [183 * 86_400]);
    await network.provider.send("evm_mine");
    const before = await ethers.provider.getBalance(lio.address);
    await lio.connect(alice).withdrawPrincipal();
    expect(before.sub(await ethers.provider.getBalance(lio.address))).to.equal(1_000);
    expect((await lio.getUserProfile(alice.address)).active).to.equal(false);
  });

  it("protects fresh-business data and awards each expense tier only once", async function () {
    const { lio, alice, bob } = await deploy();
    await expect(lio.connect(bob).updateFreshBusiness(alice.address, 100_000)).to.be.reverted;

    await lio.updateUserBusiness(alice.address, 0, 0, 100_000);
    await lio.qualifyExpenseBenefit(alice.address);
    await lio.qualifyExpenseBenefit(alice.address);
    expect(await lio.claimedExpenseBenefit(alice.address)).to.equal(5_000);
    expect((await lio.getUserProfile(alice.address)).claimableBalance).to.equal(5_000);
    const before = await ethers.provider.getBalance(lio.address);
    await lio.connect(alice).withdrawRewards();
    expect(before.sub(await ethers.provider.getBalance(lio.address))).to.equal(5_000);
  });

  it("configures the four tour targets and qualifies from direct business only", async function () {
    const { lio, admin, alice } = await deploy();
    expect((await lio.tourRewards(0)).target).to.equal(10_000);
    expect((await lio.tourRewards(1)).target).to.equal(25_000);
    expect((await lio.tourRewards(2)).target).to.equal(50_000);
    expect((await lio.tourRewards(3)).target).to.equal(100_000);

    await lio.connect(alice).activateInvestor(admin.address, 10_000, { value: 10_000 });
    await lio.qualifyTourReward(admin.address, 0);
    expect(await lio.tourQualified(admin.address, 0)).to.equal(true);
    await expect(lio.qualifyTourReward(admin.address, 0)).to.be.revertedWith(
      "LioBenefits: already qualified",
    );
  });

  it("scales dollar requirements and moves a six-decimal ERC20", async function () {
    const [admin, alice] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("MockPaymentToken");
    const token = await tokenFactory.deploy();
    await token.deployed();
    const lioFactory = await ethers.getContractFactory("TheLio");
    const lio = await lioFactory.deploy(admin.address, token.address, 100_000_000);
    await lio.deployed();

    await token.mint(admin.address, 100_000_000);
    await token.mint(alice.address, 100_000_000);
    await token.approve(lio.address, 100_000_000);
    await lio.fundTreasury(100_000_000);
    await token.connect(alice).approve(lio.address, 100_000_000);
    const adminBefore = await token.balanceOf(admin.address);
    await lio.connect(alice).activateInvestor(admin.address, 100_000_000);

    expect((await lio.weeklyTiers(0)).threshold).to.equal(5_000_000_000);
    expect(await token.balanceOf(admin.address)).to.equal(adminBefore.add(5_000_000));
    expect((await lio.getUserProfile(alice.address)).principal).to.equal(100_000_000);
  });
});
