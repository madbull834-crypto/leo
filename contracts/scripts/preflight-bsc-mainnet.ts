import { ethers, network, upgrades } from "hardhat";
import { BSC_MAINNET_CHAIN_ID, inspectPaymentAsset, loadMainnetConfig } from "./lib/mainnet";

async function main() {
  const actualChainId = (await ethers.provider.getNetwork()).chainId;
  if (network.name !== "bscMainnet" || actualChainId !== BSC_MAINNET_CHAIN_ID) {
    throw new Error(`Refusing preflight: expected bscMainnet chain 56, got ${network.name} chain ${actualChainId}`);
  }

  const config = loadMainnetConfig();
  const token = await inspectPaymentAsset(ethers.provider, config.paymentAsset);
  const factory = await ethers.getContractFactory("TheLio");
  await upgrades.validateImplementation(factory, { kind: "transparent" });

  console.log("BSC mainnet preflight passed");
  console.log(`Payment asset: ${token.name} (${token.symbol}), ${token.decimals} decimals`);
  console.log(`Payment token: ${config.paymentAsset}`);
  console.log(`Minimum:       ${token.minimumInvestment.toString()} base units (100 ${token.symbol})`);
  console.log(`Deployer:      ${config.expectedDeployer}`);
  console.log(`Treasury:      ${config.treasury}`);
  console.log(`Default admin: ${config.defaultAdmin}`);
  console.log(`Proxy owner:   ${config.proxyAdminOwner}`);
  console.log("No transaction was broadcast.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
