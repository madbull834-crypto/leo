import { ethers, network, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  BSC_MAINNET_CHAIN_ID,
  MAINNET_CONFIRMATION,
  inspectPaymentAsset,
  loadMainnetConfig,
  signerAddress,
  waitFor,
} from "./lib/mainnet";

const ROLE_NAMES = [
  "DEFAULT_ADMIN_ROLE",
  "OPERATOR_ROLE",
  "REWARD_MANAGER_ROLE",
  "PAUSER_ROLE",
  "TREASURY_ROLE",
] as const;

async function main() {
  const actualChainId = (await ethers.provider.getNetwork()).chainId;
  if (network.name !== "bscMainnet" || actualChainId !== BSC_MAINNET_CHAIN_ID) {
    throw new Error(`Refusing deployment: expected bscMainnet chain 56, got ${network.name} chain ${actualChainId}`);
  }
  if (process.env.MAINNET_DEPLOY_CONFIRMATION !== MAINNET_CONFIRMATION) {
    throw new Error(`Set MAINNET_DEPLOY_CONFIRMATION=${MAINNET_CONFIRMATION} to authorize deployment`);
  }

  const deploymentPath = path.join(__dirname, "../deployments/bsc-mainnet.json");
  const pendingPath = path.join(__dirname, "../deployments/bsc-mainnet.pending.json");
  if (fs.existsSync(deploymentPath)) {
    throw new Error(`Refusing to overwrite existing deployment record: ${deploymentPath}`);
  }
  if (fs.existsSync(pendingPath)) {
    throw new Error(`A previous deployment needs manual review before retrying: ${pendingPath}`);
  }

  const config = loadMainnetConfig();
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set MAINNET_DEPLOYER_PRIVATE_KEY");
  const deployerAddress = await signerAddress(deployer);
  if (deployerAddress !== config.expectedDeployer) {
    throw new Error(
      `Deployer key mismatch: expected ${config.expectedDeployer}, got ${deployerAddress}`,
    );
  }
  const nativeBalance = await deployer.getBalance();
  if (nativeBalance.isZero()) throw new Error("Mainnet deployer has no BNB for gas");

  const token = await inspectPaymentAsset(ethers.provider, config.paymentAsset);
  const factory = await ethers.getContractFactory("TheLio");
  await upgrades.validateImplementation(factory, { kind: "transparent" });

  console.log(`Network:       BSC Mainnet (${actualChainId})`);
  console.log(`Deployer:      ${deployerAddress}`);
  console.log(`Deployer BNB:  ${ethers.utils.formatEther(nativeBalance)}`);
  console.log(`Payment asset: ${token.name} (${token.symbol}) at ${config.paymentAsset}`);
  console.log(`Minimum:       100 ${token.symbol}`);

  const lio = await upgrades.deployProxy(
    factory,
    [config.treasury, config.paymentAsset, token.minimumInvestment],
    { kind: "transparent", initializer: "initialize" },
  );
  await waitFor(lio.deployTransaction, config.confirmations);

  const implementation = await upgrades.erc1967.getImplementationAddress(lio.address);
  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(lio.address);
  console.log(`TheLio proxy:          ${lio.address}`);
  console.log(`TheLio implementation: ${implementation}`);
  console.log(`ProxyAdmin:            ${proxyAdminAddress}`);

  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({
    status: "pending-role-handoff",
    chainId: BSC_MAINNET_CHAIN_ID,
    address: lio.address,
    implementation,
    proxyAdmin: proxyAdminAddress,
    deployer: deployerAddress,
    deploymentTransaction: lio.deployTransaction.hash,
    createdAt: new Date().toISOString(),
  }, null, 2));

  console.log("Pausing protocol for controlled launch");
  await waitFor(await lio.pause(), config.confirmations);

  const roleRecipients: Record<(typeof ROLE_NAMES)[number], string> = {
    DEFAULT_ADMIN_ROLE: config.defaultAdmin,
    OPERATOR_ROLE: config.operator,
    REWARD_MANAGER_ROLE: config.rewardManager,
    PAUSER_ROLE: config.pauser,
    TREASURY_ROLE: config.treasuryRole,
  };
  const roleIds: Record<string, string> = {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    OPERATOR_ROLE: await lio.OPERATOR_ROLE(),
    REWARD_MANAGER_ROLE: await lio.REWARD_MANAGER_ROLE(),
    PAUSER_ROLE: await lio.PAUSER_ROLE(),
    TREASURY_ROLE: await lio.TREASURY_ROLE(),
  };

  console.log("Granting production roles:");
  for (const roleName of ROLE_NAMES) {
    const recipient = roleRecipients[roleName];
    if (!(await lio.hasRole(roleIds[roleName], recipient))) {
      console.log(`- ${roleName} -> ${recipient}`);
      await waitFor(await lio.grantRole(roleIds[roleName], recipient), config.confirmations);
    }
  }

  // Remove the ephemeral deployer only after the new default admin is active.
  for (const roleName of [...ROLE_NAMES].reverse()) {
    if (roleRecipients[roleName] !== deployerAddress && await lio.hasRole(roleIds[roleName], deployerAddress)) {
      console.log(`- deployer renounces ${roleName}`);
      await waitFor(await lio.renounceRole(roleIds[roleName], deployerAddress), config.confirmations);
    }
  }

  const proxyAdmin = new ethers.Contract(
    proxyAdminAddress,
    ["function owner() view returns (address)", "function transferOwnership(address newOwner)"],
    deployer,
  );
  if (ethers.utils.getAddress(await proxyAdmin.owner()) !== config.proxyAdminOwner) {
    console.log(`Transferring ProxyAdmin ownership -> ${config.proxyAdminOwner}`);
    await waitFor(await proxyAdmin.transferOwnership(config.proxyAdminOwner), config.confirmations);
  }

  for (const roleName of ROLE_NAMES) {
    if (!(await lio.hasRole(roleIds[roleName], roleRecipients[roleName]))) {
      throw new Error(`Post-deploy role verification failed for ${roleName}`);
    }
  }
  if (ethers.utils.getAddress(await proxyAdmin.owner()) !== config.proxyAdminOwner) {
    throw new Error("Post-deploy ProxyAdmin ownership verification failed");
  }
  if (!(await lio.isPaused())) throw new Error("Post-deploy pause verification failed");

  const artifact = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../artifacts/contracts/TheLio.sol/TheLio.json"), "utf8",
  ));
  const deployment = {
    status: "complete-paused",
    chainId: BSC_MAINNET_CHAIN_ID,
    network: "bscMainnet",
    address: lio.address,
    implementation,
    proxyAdmin: proxyAdminAddress,
    proxyAdminOwner: config.proxyAdminOwner,
    treasury: config.treasury,
    paymentAsset: config.paymentAsset,
    paymentAssetSymbol: token.symbol,
    paymentAssetDecimals: token.decimals,
    minimumInvestment: token.minimumInvestment.toString(),
    roles: roleRecipients,
    rpcUrl: config.publicRpcUrl,
    explorerUrl: "https://bscscan.com",
    deployer: deployerAddress,
    deploymentTransaction: lio.deployTransaction.hash,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(pendingPath, JSON.stringify(deployment, null, 2));
  fs.renameSync(pendingPath, deploymentPath);
  const frontendDir = path.join(__dirname, "../../frontend/config");
  fs.writeFileSync(path.join(frontendDir, "TheLio.abi.json"), JSON.stringify(artifact.abi, null, 2));
  fs.writeFileSync(path.join(frontendDir, "deployment.json"), JSON.stringify(deployment, null, 2));
  console.log(`Deployment record: ${deploymentPath}`);
  console.log(`Explorer: https://bscscan.com/address/${lio.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
