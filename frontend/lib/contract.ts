import { BrowserProvider, Contract, JsonRpcProvider, type Signer } from 'ethers';
import abi from '../config/TheLio.abi.json';
import deployment from '../config/deployment.json';

export const RPC_URL: string = (deployment as { rpcUrl?: string }).rpcUrl ?? 'http://127.0.0.1:8545';
export const THE_LIO_ABI = abi;
export const DEPLOYMENT = deployment;
export const CONTRACT_ADDRESS: string = deployment.address;
export const PAYMENT_ASSET_DECIMALS: number =
  (deployment as { paymentAssetDecimals?: number }).paymentAssetDecimals ?? 0;
export const PAYMENT_ASSET_SYMBOL: string =
  (deployment as { paymentAssetSymbol?: string }).paymentAssetSymbol ?? 'units';
export const DEPLOYMENT_CHAIN_ID = Number((deployment as { chainId: number }).chainId);
export const IS_TESTNET = DEPLOYMENT_CHAIN_ID === 97;
export const NETWORK_LABEL = DEPLOYMENT_CHAIN_ID === 56
  ? 'BSC Mainnet'
  : DEPLOYMENT_CHAIN_ID === 97
    ? 'BSC Testnet'
    : `Chain ${DEPLOYMENT_CHAIN_ID}`;

const PAYMENT_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function faucet()',
];

/** Read-only provider for the network recorded in deployment.json. */
export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

export function getReadContract(): Contract {
  return new Contract(CONTRACT_ADDRESS, THE_LIO_ABI, getReadProvider());
}

export function getWriteContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, THE_LIO_ABI, signer);
}

export function getPaymentToken(address: string, runner: Signer | JsonRpcProvider): Contract {
  return new Contract(address, PAYMENT_TOKEN_ABI, runner);
}

/**
 * Hardhat's node keeps its dev accounts unlocked, so a JsonRpcSigner can send
 * transactions without a browser wallet. That keeps the local demo runnable
 * with no MetaMask setup.
 */
export async function getLocalSigner(address: string): Promise<Signer> {
  const provider = getReadProvider();
  return provider.getSigner(address);
}

export async function listLocalAccounts(): Promise<string[]> {
  const provider = getReadProvider();
  return provider.send('eth_accounts', []);
}

/** Optional browser-wallet path, used when window.ethereum is present. */
export async function getBrowserSigner(): Promise<Signer> {
  const injected = (window as any).ethereum;
  if (!injected) {
    throw new Error('No injected wallet found');
  }
  const provider = new BrowserProvider(injected);
  await provider.send('eth_requestAccounts', []);
  return provider.getSigner();
}

export async function listBrowserAccounts(requestAccess = false): Promise<string[]> {
  const injected = (window as any).ethereum;
  if (!injected) return [];
  return injected.request({
    method: requestAccess ? 'eth_requestAccounts' : 'eth_accounts',
  });
}

export async function ensureDeploymentNetwork(): Promise<void> {
  const injected = (window as any).ethereum;
  if (!injected) throw new Error('Install MetaMask or another browser wallet to continue');

  const chainId = DEPLOYMENT_CHAIN_ID;
  const chainIdHex = `0x${chainId.toString(16)}`;
  try {
    await injected.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    if (error?.code !== 4902 || (chainId !== 56 && chainId !== 97)) throw error;
    const isMainnet = chainId === 56;
    await injected.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainIdHex,
        chainName: isMainnet ? 'BNB Smart Chain' : 'BSC Testnet',
        nativeCurrency: {
          name: isMainnet ? 'BNB' : 'Test BNB',
          symbol: isMainnet ? 'BNB' : 'tBNB',
          decimals: 18,
        },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [isMainnet ? 'https://bscscan.com' : 'https://testnet.bscscan.com'],
      }],
    });
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).ethereum);
}

/** True when the dApp is opened in a regular mobile browser rather than a wallet browser. */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Opens this exact route in MetaMask's mobile dApp browser. Mobile Safari and
 * Chrome cannot inject an EIP-1193 provider themselves, so a wallet handoff is
 * required before accounts or transactions can be requested.
 */
export function openInMobileWallet(): void {
  if (typeof window === 'undefined') return;

  const dappLocation = [
    window.location.host,
    window.location.pathname,
    window.location.search,
    window.location.hash,
  ].join('');

  window.location.assign(`https://metamask.app.link/dapp/${dappLocation}`);
}

/** Surfaces the Solidity revert reason instead of an opaque ethers error. */
export function decodeError(error: unknown): string {
  const err = error as any;
  return (
    err?.reason ??
    err?.shortMessage ??
    err?.info?.error?.message ??
    err?.data?.message ??
    err?.message ??
    'Transaction failed'
  );
}
