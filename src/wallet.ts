/**
 * Wallet generation utilities for FLock
 * @module flock-in/wallet
 */

import { Wallet } from 'ethers';

/**
 * Generated wallet information
 */
export interface WalletInfo {
  /** Ethereum address (0x...) */
  address: string;
  /** Private key (0x...) - keep secret! */
  privateKey: string;
  /** Mnemonic phrase (optional, 12 words) */
  mnemonic?: string;
}

/**
 * Options for wallet generation
 */
export interface GenerateWalletOptions {
  /** Include mnemonic phrase in output (default: false) */
  includeMnemonic?: boolean;
}

/**
 * Generate a new Ethereum wallet for FLock registration
 *
 * @example
 * ```typescript
 * import { generateWallet } from 'flock-in';
 *
 * const wallet = await generateWallet();
 * console.log(wallet.address);    // 0x...
 * console.log(wallet.privateKey); // 0x...
 * ```
 *
 * @param options - Generation options
 * @returns Wallet information with address and private key
 */
export async function generateWallet(
  options: GenerateWalletOptions = {}
): Promise<WalletInfo> {
  const wallet = Wallet.createRandom();

  const result: WalletInfo = {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };

  if (options.includeMnemonic && wallet.mnemonic) {
    result.mnemonic = wallet.mnemonic.phrase;
  }

  return result;
}

/**
 * Import wallet from private key
 *
 * @example
 * ```typescript
 * import { importWallet } from 'flock-in';
 *
 * const wallet = importWallet('0x...');
 * console.log(wallet.address);
 * ```
 *
 * @param privateKey - Private key (with or without 0x prefix)
 * @returns Wallet information
 */
export function importWallet(privateKey: string): WalletInfo {
  // Ensure 0x prefix
  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new Wallet(pk);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Validate an Ethereum address
 *
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate a private key
 *
 * @param privateKey - Private key to validate
 * @returns True if valid private key format
 */
export function isValidPrivateKey(privateKey: string): boolean {
  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  return /^0x[a-fA-F0-9]{64}$/.test(pk);
}
