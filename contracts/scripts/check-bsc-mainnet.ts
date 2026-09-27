import { ethers, network, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { BSC_MAINNET_CHAIN_ID } from "./lib/mainnet";

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (network.name !== "bscMainnet" || chainId !== BSC_MAINNET_CHAIN_ID) {
    throw new Error(`Expected bscMainnet chain 56, got ${network.name} chain ${chainId}`);
  }
  const deploymentPath = path.join(__dirname, "../deployments/bsc-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (await ethers.provider.getCode(deployment.address) === "0x") throw new Error("Proxy has no code");

  const lio = await ethers.getContractAt("TheLio", deployment.address);
  const implementation = await upgrades.erc1967.getImplementationAddress(deployment.address);
  const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(deployment.address);
  if (implementation.toLowerCase() !== deployment.implementation.toLowerCase()) throw new Error("Implementation mismatch");
  if (proxyAdminAddress.toLowerCase() !== deployment.proxyAdmin.toLowerCase()) throw new Error("ProxyAdmin mismatch");
  if ((await lio.paymentAsset()).toLowerCase() !== deployment.paymentAsset.toLowerCase()) throw new Error("Payment asset mismatch");
  if ((await lio.treasury()).toLowerCase() !== deployment.treasury.toLowerCase()) throw new Error("Treasury mismatch");
  if (!(await lio.minimumInvestment()).eq(deployment.minimumInvestment)) throw new Error("Minimum investment mismatch");
  if (!(await lio.planConfigurationLocked())) throw new Error("Plan configuration is not locked");

  const roles: Record<string, string> = {
    DEFAULT_ADMIN_ROLE: ethers.constants.HashZero,
    OPERATOR_ROLE: await lio.OPERATOR_ROLE(),
    REWARD_MANAGER_ROLE: await lio.REWARD_MANAGER_ROLE(),
    PAUSER_ROLE: await lio.PAUSER_ROLE(),
    TREASURY_ROLE: await lio.TREASURY_ROLE(),
  };
  for (const [name, role] of Object.entries(roles)) {
    if (!(await lio.hasRole(role, deployment.roles[name]))) throw new Error(`${name} holder mismatch`);
  }
  const proxyAdmin = new ethers.Contract(proxyAdminAddress, ["function owner() view returns (address)"], ethers.provider);
  if ((await proxyAdmin.owner()).toLowerCase() !== deployment.proxyAdminOwner.toLowerCase()) {
    throw new Error("ProxyAdmin owner mismatch");
  }
  console.log(`BSC mainnet deployment verified: ${deployment.address}`);
  console.log(`Implementation: ${implementation}`);
  console.log(`ProxyAdmin:     ${proxyAdminAddress}`);
  console.log(`Paused:         ${await lio.isPaused()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
