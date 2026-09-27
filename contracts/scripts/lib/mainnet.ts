import { BigNumber, Contract, Signer, ethers } from "ethers";

export const BSC_MAINNET_CHAIN_ID = 56;
export const MAINNET_CONFIRMATION = "DEPLOY_THE_LIOX_TO_BSC_MAINNET";

export type MainnetConfig = {
  expectedDeployer: string;
  paymentAsset: string;
  treasury: string;
  defaultAdmin: string;
  operator: string;
  rewardManager: string;
  pauser: string;
  treasuryRole: string;
  proxyAdminOwner: string;
  publicRpcUrl: string;
  confirmations: number;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function address(name: string): string {
  const value = required(name);
  if (!ethers.utils.isAddress(value) || value === ethers.constants.AddressZero) {
    throw new Error(`${name} must be a non-zero address`);
  }
  return ethers.utils.getAddress(value);
}

export function loadMainnetConfig(): MainnetConfig {
  required("BSC_MAINNET_RPC_URL");
  const confirmations = Number(process.env.MAINNET_CONFIRMATIONS || "5");
  if (!Number.isInteger(confirmations) || confirmations < 2) {
    throw new Error("MAINNET_CONFIRMATIONS must be an integer of at least 2");
  }

  return {
    expectedDeployer: address("MAINNET_EXPECTED_DEPLOYER_ADDRESS"),
    paymentAsset: address("MAINNET_PAYMENT_ASSET"),
    treasury: address("MAINNET_TREASURY_ADDRESS"),
    defaultAdmin: address("MAINNET_DEFAULT_ADMIN_ADDRESS"),
    operator: address("MAINNET_OPERATOR_ADDRESS"),
    rewardManager: address("MAINNET_REWARD_MANAGER_ADDRESS"),
    pauser: address("MAINNET_PAUSER_ADDRESS"),
    treasuryRole: address("MAINNET_TREASURY_ROLE_ADDRESS"),
    proxyAdminOwner: address("MAINNET_PROXY_ADMIN_OWNER"),
    publicRpcUrl: required("BSC_MAINNET_PUBLIC_RPC_URL"),
    confirmations,
  };
}

export async function inspectPaymentAsset(
  provider: ethers.providers.Provider,
  paymentAsset: string,
): Promise<{ decimals: number; symbol: string; name: string; minimumInvestment: BigNumber }> {
  if ((await provider.getCode(paymentAsset)) === "0x") {
    throw new Error(`MAINNET_PAYMENT_ASSET has no contract code: ${paymentAsset}`);
  }
  const token = new Contract(
    paymentAsset,
    [
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)",
    ],
    provider,
  );
  const [decimalsRaw, symbol, name] = await Promise.all([
    token.decimals(), token.symbol(), token.name(),
  ]);
  if (symbol.toLowerCase() === "tusdt" || name.toLowerCase().includes("test usdt")) {
    throw new Error(`Refusing test payment token on mainnet: ${name} (${symbol})`);
  }
  const decimals = Number(decimalsRaw);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Unsupported payment-token decimals: ${decimalsRaw.toString()}`);
  }
  return {
    decimals,
    symbol,
    name,
    minimumInvestment: ethers.utils.parseUnits("100", decimals),
  };
}

export async function waitFor(tx: ethers.providers.TransactionResponse, confirmations: number) {
  console.log(`  tx ${tx.hash}`);
  return tx.wait(confirmations);
}

export async function signerAddress(signer: Signer): Promise<string> {
  return ethers.utils.getAddress(await signer.getAddress());
}
