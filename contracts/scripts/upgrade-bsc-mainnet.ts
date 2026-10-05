import { ethers, network, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  BSC_MAINNET_CHAIN_ID,
  loadMainnetConfig,
  signerAddress,
  waitFor,
} from "./lib/mainnet";

const UPGRADE_CONFIRMATION = "UPGRADE_THE_LIOX_ON_BSC_MAINNET";
const EXPECTED_PROXY = "0x3C97360716E3Df6976Dd1cF93d537579041253C6";
const EXPECTED_TREASURY_ALLOCATION_BPS = 5_000;
const EIP_170_MAX_RUNTIME_BYTES = 24_576;

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (network.name !== "bscMainnet" || chainId !== BSC_MAINNET_CHAIN_ID) {
    throw new Error(`Refusing upgrade: expected bscMainnet chain 56, got ${network.name} chain ${chainId}`);
  }

  const config = loadMainnetConfig();
  const deploymentPath = path.join(__dirname, "../deployments/bsc-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (ethers.utils.getAddress(deployment.address) !== EXPECTED_PROXY) {
    throw new Error(`Refusing unexpected proxy: ${deployment.address}`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set MAINNET_DEPLOYER_PRIVATE_KEY");
  const deployerAddress = await signerAddress(deployer);
  if (deployerAddress !== config.expectedDeployer) {
    throw new Error(`Deployer mismatch: expected ${config.expectedDeployer}, got ${deployerAddress}`);
  }
  const deployerBalance = await deployer.getBalance();
  if (deployerBalance.isZero()) throw new Error("Deployer has no BNB for gas");
  if (await ethers.provider.getCode(deployment.address) === "0x") throw new Error("Proxy has no code");

  const implementationBefore = await upgrades.erc1967.getImplementationAddress(deployment.address);
  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(deployment.address);
  if (implementationBefore.toLowerCase() !== deployment.implementation.toLowerCase()) {
    throw new Error(`Implementation mismatch: chain=${implementationBefore} file=${deployment.implementation}`);
  }
  if (proxyAdminAddress.toLowerCase() !== deployment.proxyAdmin.toLowerCase()) {
    throw new Error(`ProxyAdmin mismatch: chain=${proxyAdminAddress} file=${deployment.proxyAdmin}`);
  }

  const proxyAdmin = new ethers.Contract(
    proxyAdminAddress,
    ["function owner() view returns (address)"],
    ethers.provider,
  );
  const proxyAdminOwner = ethers.utils.getAddress(await proxyAdmin.owner());
  if (proxyAdminOwner !== deployerAddress || proxyAdminOwner !== config.proxyAdminOwner) {
    throw new Error(`ProxyAdmin owner mismatch: ${proxyAdminOwner}`);
  }

  const current = await ethers.getContractAt("TheLio", deployment.address);
  const snapshot = {
    treasury: ethers.utils.getAddress(await current.treasury()),
    paymentAsset: ethers.utils.getAddress(await current.paymentAsset()),
    minimumInvestment: (await current.minimumInvestment()).toString(),
    treasuryBalance: (await current.treasuryBalance()).toString(),
    totalLiabilities: (await current.totalLiabilities()).toString(),
    paused: await current.isPaused(),
  };
  if (snapshot.treasury !== config.treasury) throw new Error("Live treasury does not match configuration");
  if (snapshot.paymentAsset !== config.paymentAsset) throw new Error("Live payment asset does not match configuration");

  const factory = await ethers.getContractFactory("TheLio", deployer);
  await upgrades.validateUpgrade(deployment.address, factory, { kind: "transparent" });
  const [implementationGas, gasPrice] = await Promise.all([
    deployer.estimateGas(factory.getDeployTransaction()),
    ethers.provider.getGasPrice(),
  ]);
  const estimatedRequiredBalance = implementationGas.add(250_000).mul(gasPrice).mul(2);
  if (deployerBalance.lt(estimatedRequiredBalance)) {
    throw new Error(
      `Insufficient BNB safety margin: have ${ethers.utils.formatEther(deployerBalance)}, `
      + `require approximately ${ethers.utils.formatEther(estimatedRequiredBalance)}`,
    );
  }
  const artifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../artifacts/contracts/TheLio.sol/TheLio.json"),
    "utf8",
  ));
  const runtimeBytes = (artifact.deployedBytecode.length - 2) / 2;
  if (runtimeBytes > EIP_170_MAX_RUNTIME_BYTES) {
    throw new Error(`Implementation runtime is ${runtimeBytes} bytes; EIP-170 maximum is ${EIP_170_MAX_RUNTIME_BYTES}`);
  }

  console.log(`Network:               BSC Mainnet (${chainId})`);
  console.log(`Proxy:                 ${deployment.address}`);
  console.log(`Current implementation:${implementationBefore}`);
  console.log(`ProxyAdmin:            ${proxyAdminAddress}`);
  console.log(`ProxyAdmin owner:      ${proxyAdminOwner}`);
  console.log(`Treasury/root:         ${snapshot.treasury}`);
  console.log(`Deployer BNB:          ${ethers.utils.formatEther(deployerBalance)}`);
  console.log(`Gas safety estimate:   ${ethers.utils.formatEther(estimatedRequiredBalance)} BNB`);
  console.log(`Runtime bytes:         ${runtimeBytes}/${EIP_170_MAX_RUNTIME_BYTES}`);
  console.log(`Paused:                ${snapshot.paused}`);

  if (process.env.MAINNET_UPGRADE_DRY_RUN === "true") {
    console.log("Dry run complete: storage layout and ownership checks passed; no transaction sent.");
    return;
  }
  if (process.env.MAINNET_UPGRADE_CONFIRMATION !== UPGRADE_CONFIRMATION) {
    throw new Error(`Set MAINNET_UPGRADE_CONFIRMATION=${UPGRADE_CONFIRMATION} to authorize the upgrade`);
  }

  const upgraded = await upgrades.upgradeProxy(deployment.address, factory, { kind: "transparent" });
  const receipt = await waitFor(upgraded.deployTransaction, config.confirmations);
  const implementationAfter = await upgrades.erc1967.getImplementationAddress(deployment.address);
  if (implementationAfter.toLowerCase() === implementationBefore.toLowerCase()) {
    throw new Error("Upgrade did not change the implementation address");
  }

  const verified = await ethers.getContractAt("TheLio", deployment.address);
  if (!(await verified.TREASURY_ALLOCATION_BPS()).eq(EXPECTED_TREASURY_ALLOCATION_BPS)) {
    throw new Error("Post-upgrade treasury allocation is not 50%");
  }
  if (!(await verified.isReferralEligible(config.treasury))) {
    throw new Error("Post-upgrade treasury is not the referral root");
  }
  const after = {
    treasury: ethers.utils.getAddress(await verified.treasury()),
    paymentAsset: ethers.utils.getAddress(await verified.paymentAsset()),
    minimumInvestment: (await verified.minimumInvestment()).toString(),
    treasuryBalance: (await verified.treasuryBalance()).toString(),
    totalLiabilities: (await verified.totalLiabilities()).toString(),
    paused: await verified.isPaused(),
  };
  if (JSON.stringify(after) !== JSON.stringify(snapshot)) {
    throw new Error(`State changed unexpectedly during upgrade: before=${JSON.stringify(snapshot)} after=${JSON.stringify(after)}`);
  }

  const history = Array.isArray(deployment.previousImplementations)
    ? deployment.previousImplementations
    : [];
  const updatedDeployment = {
    ...deployment,
    implementation: implementationAfter,
    previousImplementations: [...history, implementationBefore],
    upgradeTransaction: receipt.transactionHash,
    upgradedAt: new Date().toISOString(),
  };
  fs.writeFileSync(deploymentPath, `${JSON.stringify(updatedDeployment, null, 2)}\n`);
  fs.writeFileSync(
    path.join(__dirname, "../../frontend/config/TheLio.abi.json"),
    `${JSON.stringify(artifact.abi, null, 2)}\n`,
  );

  console.log(`Upgrade confirmed:     ${receipt.transactionHash}`);
  console.log(`New implementation:    ${implementationAfter}`);
  console.log(`Explorer: https://bscscan.com/tx/${receipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
