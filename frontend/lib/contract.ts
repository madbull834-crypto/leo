import { BrowserProvider, Contract, JsonRpcProvider, type Signer } from 'ethers';
import abi from '../config/TheLio.abi.json';
import deployment from '../config/deployment.json';

export const RPC_URL: string = (deployment as { rpcUrl?: string }).rpcUrl ?? 'http://127.0.0.1:8545';
export const THE_LIO_ABI = abi;
export const DEPLOYMENT = deployment;
export const CONTRACT_ADDRESS: string = deployment.address;

/** Read-only provider pointed at the local Hardhat node. */
export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

export function getReadContract(): Contract {
  return new Contract(CONTRACT_ADDRESS, THE_LIO_ABI, getReadProvider());
}

export function getWriteContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, THE_LIO_ABI, signer);
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

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).ethereum);
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
