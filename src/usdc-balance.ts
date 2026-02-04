/**
 * USDC Balance Checking for Base Network
 * @module flock-in/usdc-balance
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { base, baseSepolia } from 'viem/chains';

/**
 * USDC contract addresses by network
 */
export const USDC_CONTRACTS = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

/**
 * ERC-20 ABI for balance checking
 */
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

/**
 * USDC balance result
 */
export interface USDCBalanceResult {
  /** Wallet address */
  address: string;
  /** Human-readable balance (e.g., "10.50") */
  balance: string;
  /** Raw balance in smallest units (6 decimals) */
  balanceRaw: bigint;
  /** Has minimum balance for transactions (>= $0.01) */
  hasMinimum: boolean;
  /** Network checked */
  network: 'base' | 'base-sepolia';
}

/**
 * RPC endpoints by network
 */
const RPC_URLS = {
  base: 'https://mainnet.base.org',
  'base-sepolia': 'https://sepolia.base.org',
} as const;

/**
 * Check USDC balance on Base network
 *
 * @example
 * ```typescript
 * const result = await checkUSDCBalance('0x1234...');
 * if (result.hasMinimum) {
 *   console.log(`Balance: $${result.balance}`);
 * }
 * ```
 *
 * @param address - Wallet address to check
 * @param network - Network to check (default: 'base')
 * @returns Balance result
 */
export async function checkUSDCBalance(
  address: string,
  network: 'base' | 'base-sepolia' = 'base'
): Promise<USDCBalanceResult> {
  const client = createPublicClient({
    chain: network === 'base' ? base : baseSepolia,
    transport: http(RPC_URLS[network]),
  });

  try {
    const balanceRaw = await client.readContract({
      address: USDC_CONTRACTS[network] as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    });

    // USDC has 6 decimals
    const balance = (Number(balanceRaw) / 1e6).toFixed(2);

    return {
      address,
      balance,
      balanceRaw,
      hasMinimum: balanceRaw >= 10000n, // $0.01 minimum
      network,
    };
  } catch (error) {
    // Return zero balance on error (network issues, etc.)
    return {
      address,
      balance: '0.00',
      balanceRaw: 0n,
      hasMinimum: false,
      network,
    };
  }
}

/**
 * Wait for wallet to be funded with USDC
 *
 * @param address - Wallet address to monitor
 * @param options - Wait options
 * @returns Final balance result
 */
export async function waitForUSDCFunding(
  address: string,
  options: {
    network?: 'base' | 'base-sepolia';
    minBalance?: string;
    maxWait?: number;
    pollInterval?: number;
    onCheck?: (result: USDCBalanceResult) => void;
  } = {}
): Promise<USDCBalanceResult> {
  const {
    network = 'base',
    minBalance = '0.01',
    maxWait = 600000, // 10 minutes
    pollInterval = 5000, // 5 seconds
    onCheck,
  } = options;

  const minBalanceRaw = BigInt(Math.floor(parseFloat(minBalance) * 1e6));
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const result = await checkUSDCBalance(address, network);

    if (onCheck) {
      onCheck(result);
    }

    if (result.balanceRaw >= minBalanceRaw) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Return last check result even if timeout
  return checkUSDCBalance(address, network);
}
