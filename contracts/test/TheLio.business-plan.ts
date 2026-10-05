import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("TheLio business plan", function () {
  async function deploy() {
    const [admin, alice, bob, carol] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TheLio");
    const lio = await upgrades.deployProxy(
      factory,
      [admin.address, ethers.constants.AddressZero, 100],
      { kind: "transparent", initializer: "initialize" },
    );
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

    const treasuryBefore = await ethers.provider.getBalance(admin.address);
    const protocolBefore = await ethers.provider.getBalance(lio.address);
    await expect(lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 }))
      .to.emit(lio, "InvestmentAllocatedToTreasury")
      .withArgs(alice.address, admin.address, ethers.constants.AddressZero, 1_000, 500, anyValue);
    await lio.connect(bob).activateInvestor(admin.address, 500_000, { value: 500_000 });
    expect((await lio.getUserProfile(alice.address)).principal).to.equal(1_000);
    expect((await lio.getUserProfile(bob.address)).principal).to.equal(500_000);
    // The root treasury receives its 50% allocation plus its 5% referral reward.
    expect((await ethers.provider.getBalance(admin.address)).sub(treasuryBefore)).to.equal(275_550);
    expect((await ethers.provider.getBalance(lio.address)).sub(protocolBefore)).to.equal(225_450);
  });

  it("pays exactly one 5% direct reward and tracks direct business", async function () {
    const { lio, admin, alice } = await deploy();
    const before = await ethers.provider.getBalance(admin.address);
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });

    const referrer = await lio.getUserProfile(admin.address);
    expect(referrer.directRewards).to.equal(50);
    expect(referrer.claimableBalance).to.equal(0);
    expect(await ethers.provider.getBalance(admin.address)).to.equal(before.add(550));
    expect(await lio.directBusiness(admin.address)).to.equal(1_000);
    expect(await lio.directRewardIssued(alice.address)).to.equal(true);
  });

  it("uses treasury as the root and only permits active non-root referrers", async function () {
    const { lio, admin, alice, bob, carol } = await deploy();

    expect(await lio.isReferralEligible(admin.address)).to.equal(true);
    expect(await lio.isReferralEligible(carol.address)).to.equal(false);
    await expect(
      lio.connect(alice).activateInvestor(carol.address, 1_000, { value: 1_000 }),
    ).to.be.revertedWith("LioReferral: referrer must be active");

    // A missing referrer resolves to the treasury root.
    await lio.connect(alice).activateInvestor(ethers.constants.AddressZero, 1_000, { value: 1_000 });
    expect(await lio.referrerOf(alice.address)).to.equal(admin.address);
    expect(await lio.isReferralEligible(alice.address)).to.equal(true);

    await lio.connect(bob).activateInvestor(alice.address, 1_000, { value: 1_000 });
    expect(await lio.referrerOf(bob.address)).to.equal(alice.address);
  });

  it("accepts deposits without prefunding and lets the deployer fund payouts when required", async function () {
    const [admin, alice] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TheLio");
    const lio = await upgrades.deployProxy(
      factory,
      [admin.address, ethers.constants.AddressZero, 100],
      { kind: "transparent", initializer: "initialize" },
    );
    await lio.deployed();

    // 50% goes to treasury and the root also receives the 5% referral reward.
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });
    expect(await ethers.provider.getBalance(lio.address)).to.equal(450);
    expect(await lio.treasuryBalance()).to.equal(450);
    expect(await lio.totalLiabilities()).to.equal(1_000);

    // ROI is still based on the full 1,000 deposit. At the default 8%, the
    // gross ROI is 80 and the user receives 76 after the 5% claim deduction.
    await network.provider.send("evm_increaseTime", [30 * 86_400]);
    await network.provider.send("evm_mine");
    await lio.connect(alice).claimForUser(alice.address);
    expect((await lio.getUserProfile(alice.address)).roiClaimed).to.equal(80);
    expect(await lio.treasuryBalance()).to.equal(374);

    await network.provider.send("evm_increaseTime", [153 * 86_400]);
    await network.provider.send("evm_mine");
    await expect(lio.connect(alice).withdrawPrincipal()).to.be.revertedWith(
      "LioCore: insufficient treasury",
    );

    // Anyone may add funds, so the deployer can top up exactly when required.
    await lio.fundTreasury(626, { value: 626 });
    await lio.connect(alice).withdrawPrincipal();
    expect(await ethers.provider.getBalance(lio.address)).to.equal(0);
    expect(await lio.treasuryBalance()).to.equal(0);
    expect(await lio.totalLiabilities()).to.equal(0);
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

  it("prorates ROI per second and allows consecutive claims", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 100_000_000, { value: 100_000_000 });
    const activated = await lio.getUserProfile(alice.address);

    await network.provider.send("evm_setNextBlockTimestamp", [activated.activationTimestamp.toNumber() + 1]);
    await lio.connect(alice).claimForUser(alice.address);
    expect((await lio.getUserProfile(alice.address)).roiClaimed).to.equal(3);

    await network.provider.send("evm_setNextBlockTimestamp", [activated.activationTimestamp.toNumber() + 2]);
    await lio.connect(alice).claimForUser(alice.address);
    expect((await lio.getUserProfile(alice.address)).roiClaimed).to.equal(6);

    // Frequent claims preserve fractional accrual and still collect exactly
    // the cumulative 5% deduction over a complete 30-day month.
    await network.provider.send("evm_setNextBlockTimestamp", [
      activated.activationTimestamp.toNumber() + (30 * 86_400),
    ]);
    await lio.connect(alice).claimForUser(alice.address);
    const profile = await lio.getUserProfile(alice.address);
    expect(profile.roiClaimed).to.equal(8_000_000);
    expect(profile.totalClaimed).to.equal(7_600_000);
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

  it("matches the six weekly reward tiers in the LIOX plan", async function () {
    const { lio, admin, alice } = await deploy();

    // TOTAL team business -> weekly reward, straight from the plan's table.
    // Each tier is reached on a 50/50 leg split of the total.
    const plan = [
      { total: 5_000, reward: 25 },
      { total: 10_000, reward: 50 },
      { total: 25_000, reward: 110 },
      { total: 50_000, reward: 150 },
      { total: 100_000, reward: 300 },
      { total: 200_000, reward: 750 },
    ];

    for (const [index, row] of plan.entries()) {
      const tier = await lio.weeklyTiers(index);
      expect(tier.threshold, `tier ${index + 1} threshold`).to.equal(row.total);
      expect(tier.reward, `tier ${index + 1} reward`).to.equal(row.reward);
      expect(tier.enabled).to.equal(true);
    }

    // The 6th tier must actually be reachable - computeCurrentTier caps the loop.
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });
    await lio.updateUserBusiness(alice.address, 100_000, 100_000, 0);
    expect(await lio.getCurrentTier(alice.address)).to.equal(6);

    const before = await ethers.provider.getBalance(lio.address);
    await lio.connect(alice).claimWeeklyForUser(alice.address);
    expect(before.sub(await ethers.provider.getBalance(lio.address))).to.equal(750);
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
    const lio = await upgrades.deployProxy(
      lioFactory,
      [admin.address, token.address, 100_000_000],
      { kind: "transparent", initializer: "initialize" },
    );
    await lio.deployed();

    await token.mint(admin.address, 100_000_000);
    await token.mint(alice.address, 100_000_000);
    await token.approve(lio.address, 100_000_000);
    await lio.fundTreasury(100_000_000);
    await token.connect(alice).approve(lio.address, 100_000_000);
    const adminBefore = await token.balanceOf(admin.address);
    await lio.connect(alice).activateInvestor(admin.address, 100_000_000);

    expect((await lio.weeklyTiers(0)).threshold).to.equal(5_000_000_000);
    expect(await token.balanceOf(admin.address)).to.equal(adminBefore.add(55_000_000));
    expect(await token.balanceOf(lio.address)).to.equal(145_000_000);
    expect((await lio.getUserProfile(alice.address)).principal).to.equal(100_000_000);
  });

  it("provides a six-decimal test USDT faucet for test-network investors", async function () {
    const [, alice] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("TestUSDT");
    const token = await tokenFactory.deploy();
    await token.deployed();

    expect(await token.name()).to.equal("Test USDT");
    expect(await token.symbol()).to.equal("tUSDT");
    expect(await token.decimals()).to.equal(6);

    await token.connect(alice).faucet();
    expect(await token.balanceOf(alice.address)).to.equal(10_000_000_000);
  });

  it("upgrades through ProxyAdmin while preserving state and enforcing ownership", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 1_000, { value: 1_000 });

    const proxyAddress = lio.address;
    const implementationBefore = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    const v2Factory = await ethers.getContractFactory("TheLioV2");
    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    const proxyAdmin = new ethers.Contract(
      proxyAdminAddress,
      ["function owner() view returns (address)", "function upgrade(address proxy, address implementation)"],
      admin,
    );
    expect(await proxyAdmin.owner()).to.equal(admin.address);

    const upgraded = await upgrades.upgradeProxy(proxyAddress, v2Factory, { kind: "transparent" });
    await upgraded.deployed();
    const implementationAfter = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    expect(upgraded.address).to.equal(proxyAddress);
    expect(implementationAfter).not.to.equal(implementationBefore);
    expect(await upgraded.version()).to.equal(2);
    expect((await upgraded.getUserProfile(alice.address)).principal).to.equal(1_000);
    expect(await upgraded.businessUnit()).to.equal(1);

    await expect(proxyAdmin.connect(alice).upgrade(proxyAddress, implementationAfter)).to.be.revertedWith(
      "Ownable: caller is not the owner",
    );

    const implementation = v2Factory.attach(implementationAfter);
    await expect(
      implementation.initialize(admin.address, ethers.constants.AddressZero, 100),
    ).to.be.reverted;
  });

  it("stops every user payout path while paused and still accepts treasury funding", async function () {
    const { lio, admin, alice } = await deploy();
    await lio.connect(alice).activateInvestor(admin.address, 5_000, { value: 5_000 });
    await lio.updateUserBusiness(alice.address, 2_500, 2_500, 0);
    await network.provider.send("evm_increaseTime", [183 * 86_400]);
    await network.provider.send("evm_mine");
    await lio.pause();

    await expect(lio.connect(alice).claimForUser(alice.address)).to.be.revertedWith("Pausable: paused");
    await expect(lio.connect(alice).claimWeeklyForUser(alice.address)).to.be.revertedWith("Pausable: paused");
    await expect(lio.connect(alice).claimMonthlyInvestment(alice.address, 1)).to.be.revertedWith("Pausable: paused");
    await expect(lio.connect(alice).withdrawPrincipal()).to.be.revertedWith("Pausable: paused");
    await expect(lio.fundTreasury(100, { value: 100 })).not.to.be.reverted;
  });
});
