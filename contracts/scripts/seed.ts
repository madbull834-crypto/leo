import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Builds a small but realistic network on the local chain so the dashboard has
// genuine on-chain data to visualise: several investors with different
// principals, unbalanced binary legs, real accrued ROI (via time travel) and a
// funded treasury.
//
// Safe to re-run: every step checks current state first.

interface SeedInvestor {
  index: number;
  principal: number;
  left: number;
  right: number;
  fresh: number;
}

// Volumes are chosen to land investors on different weekly tiers (thresholds
// are 5k / 10k / 25k / 50k / 200k) and different expense tiers (10k / 25k /
// 50k / 100k), so the tier ladder and progress meters show a real spread.
const INVESTORS: SeedInvestor[] = [
  { index: 1, principal: 25_000, left: 140_000, right: 95_000, fresh: 120_000 },
  { index: 2, principal: 10_000, left: 32_000, right: 18_000, fresh: 44_000 },
  { index: 3, principal: 5_000, left: 9_000, right: 4_500, fresh: 16_000 },
  { index: 4, principal: 2_000, left: 2_500, right: 1_200, fresh: 6_000 },
];

const DAYS_TO_ADVANCE = 95; // > 3 accrual months, still inside the 183-day lock
const TREASURY_FUNDING = 500_000;

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../frontend/config/deployment.json"),
      "utf8",
    ),
  );

  const signers = await ethers.getSigners();
  const admin = signers[0];
  const theLio = await ethers.getContractAt("TheLio", deployment.address);

  console.log(`TheLio: ${deployment.address}`);
  console.log(`Admin:  ${admin.address}\n`);

  // 1. Fund the demo so seeded investors can exercise every payout path while
  //    each activation pays its 5% direct commission immediately.
  const treasuryBalance = await theLio.treasuryBalance();
  if (treasuryBalance.isZero()) {
    await (await theLio.fundTreasury(TREASURY_FUNDING, { value: TREASURY_FUNDING })).wait();
    console.log(`[treasury] funded ${TREASURY_FUNDING.toLocaleString()}\n`);
  }

  // 2. Activate investors. Each is referred by the admin so the direct-referral
  //    reward (5%) is paid immediately and remains visible in lifetime totals.
  for (const investor of INVESTORS) {
    const signer = signers[investor.index];
    const active = await theLio.isUserActive(signer.address);
    if (active) {
      console.log(`[skip] ${signer.address} already active`);
      continue;
    }
    await (
      await theLio
        .connect(signer)
        .activateInvestor(admin.address, investor.principal, { value: investor.principal })
    ).wait();
    console.log(
      `[activate] ${signer.address} principal=${investor.principal.toLocaleString()}`,
    );
  }

  // 3. Push binary-leg and fresh business volumes (requires OPERATOR_ROLE).
  for (const investor of INVESTORS) {
    const signer = signers[investor.index];
    await (
      await theLio.updateUserBusiness(
        signer.address,
        investor.left,
        investor.right,
        investor.fresh,
      )
    ).wait();
    console.log(
      `[volume]   ${signer.address} left=${investor.left.toLocaleString()} right=${investor.right.toLocaleString()} fresh=${investor.fresh.toLocaleString()}`,
    );
  }

  // 4. Advance the chain so the continuously prorated ROI is visible.
  await network.provider.send("evm_increaseTime", [DAYS_TO_ADVANCE * 86_400]);
  await network.provider.send("evm_mine", []);
  console.log(`[time]     advanced ${DAYS_TO_ADVANCE} days`);

  // 5. Accrue ROI and qualify benefits for everyone.
  for (const investor of INVESTORS) {
    const signer = signers[investor.index];
    await (await theLio.accrueROI(signer.address)).wait();
    await (await theLio.qualifyExpenseBenefit(signer.address)).wait();
    await (await theLio.accrueWeeklyReward(signer.address)).wait();
    const profile = await theLio.getUserProfile(signer.address);
    const tier = await theLio.getCurrentTier(signer.address);
    console.log(
      `[accrue]   ${signer.address} tier=${tier} roiAccrued=${profile.roiAccrued.toString()} teamRewards=${profile.teamRewards.toString()}`,
    );
  }

  // 6. Have one investor claim, so claimed-vs-accrued is not uniformly zero.
  const claimer = signers[INVESTORS[0].index];
  const claimerProfile = await theLio.getUserProfile(claimer.address);
  if (claimerProfile.roiClaimed.isZero()) {
    await (await theLio.connect(claimer).claimForUser(claimer.address)).wait();
    console.log(`[claim]    ${claimer.address} claimed ROI`);
  }

  const adminProfile = await theLio.getUserProfile(admin.address);
  console.log(
    `\n[admin]    directRewards=${adminProfile.directRewards.toString()}`,
  );
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
