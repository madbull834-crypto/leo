import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DECIMALS = 6;
const units = (value: string) => ethers.utils.parseUnits(value, DECIMALS);

async function main() {
  if (network.config.chainId !== 97) {
    throw new Error(`Refusing deployment: expected BSC Testnet chain 97, got ${network.config.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer configured. Set PRIVATE_KEY in contracts/.env");
  }

  const nativeBalance = await deployer.getBalance();
  console.log(`Network:  BSC Testnet (${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`tBNB:     ${ethers.utils.formatEther(nativeBalance)}`);
  if (nativeBalance.isZero()) {
    throw new Error("Deployer has no tBNB for gas");
  }

  const tokenFactory = await ethers.getContractFactory("TestUSDT");
  const token = await tokenFactory.deploy();
  await token.deployed();
  console.log(`Test USDT: ${token.address}`);

  const lioFactory = await ethers.getContractFactory("TheLio");
  const minimumInvestment = units("100");
  const lio = await lioFactory.deploy(deployer.address, token.address, minimumInvestment);
  await lio.deployed();
  console.log(`TheLio:   ${lio.address}`);

  const treasuryFunding = units("500000");
  await (await token.mint(deployer.address, treasuryFunding)).wait();
  await (await token.approve(lio.address, treasuryFunding)).wait();
  await (await lio.fundTreasury(treasuryFunding)).wait();
  console.log(`Treasury funded: ${ethers.utils.formatUnits(treasuryFunding, DECIMALS)} tUSDT`);

  const artifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/TheLio.sol/TheLio.json"), "utf8"),
  );
  const outDir = path.join(__dirname, "../../frontend/config");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "TheLio.abi.json"), JSON.stringify(artifact.abi, null, 2));

  const deployment = {
    chainId: 97,
    network: "bscTestnet",
    address: lio.address,
    treasury: deployer.address,
    paymentAsset: token.address,
    paymentAssetSymbol: "tUSDT",
    paymentAssetDecimals: DECIMALS,
    minimumInvestment: minimumInvestment.toString(),
    treasuryFunding: treasuryFunding.toString(),
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org",
    explorerUrl: "https://testnet.bscscan.com",
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, "deployment.json"), JSON.stringify(deployment, null, 2));
  fs.mkdirSync(path.join(__dirname, "../deployments"), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, "../deployments/bsc-testnet.json"),
    JSON.stringify(deployment, null, 2),
  );

  console.log(`Explorer: https://testnet.bscscan.com/address/${lio.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
