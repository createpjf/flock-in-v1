/**
 * Balance checking utilities for FLock
 * @module flock-in/balance
 */

import { JsonRpcProvider, formatEther } from 'ethers';

/**
 * Supported blockchain networks
 */
export const CHAINS = {
  ethereum: {
    name: 'Ethereum',
    rpc: 'https://eth.llamarpc.com',
    chainId: 1,
    symbol: 'ETH',
  },
  base: {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    chainId: 8453,
    symbol: 'ETH',
  },
  optimism: {
    name: 'Optimism',
    rpc: 'https://mainnet.optimism.io',
    chainId: 10,
    symbol: 'ETH',
  },
} as const;

export type ChainName = keyof typeof CHAINS;

/**
 * Balance result for a single chain
 */
export interface ChainBalance {
  /** Chain name */
  chain: string;
  /** Chain ID */
  chainId: number;
  /** Balance in ETH (formatted) */
  balance: string;
  /** Raw balance in wei */
  balanceWei: string;
  /** Whether the wallet has any funds */
  hasFunds: boolean;
  /** Error message if check failed */
  error?: string;
}

/**
 * Combined balance results
 */
export interface BalanceResult {
  /** Address that was checked */
  address: string;
  /** Balances by chain name */
  balances: Record<string, ChainBalance>;
  /** Total balance across all chains in ETH */
  totalBalance: string;
  /** Whether any chain has funds */
  hasFunds: boolean;
  /** Timestamp of check */
  checkedAt: string;
}

/**
 * Options for balance checking
 */
export interface CheckBalanceOptions {
  /** Specific chains to check (default: all) */
  chains?: ChainName[];
  /** Custom RPC URLs */
  customRpcs?: Partial<Record<ChainName, string>>;
  /** Timeout per chain in ms (default: 10000) */
  timeout?: number;
}

/**
 * Check balance on a single chain
 */
async function checkSingleChain(
  address: string,
  chainName: ChainName,
  rpcUrl?: string,
  timeout = 10000
): Promise<ChainBalance> {
  const chain = CHAINS[chainName];
  const rpc = rpcUrl || chain.rpc;

  try {
    const provider = new JsonRpcProvider(rpc, chain.chainId, {
      staticNetwork: true,
    });

    // Add timeout
    const balancePromise = provider.getBalance(address);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    const balance = await Promise.race([balancePromise, timeoutPromise]);

    return {
      chain: chain.name,
      chainId: chain.chainId,
      balance: formatEther(balance),
      balanceWei: balance.toString(),
      hasFunds: balance > 0n,
    };
  } catch (error) {
    return {
      chain: chain.name,
      chainId: chain.chainId,
      balance: '0',
      balanceWei: '0',
      hasFunds: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check wallet balance on multiple chains
 *
 * @example
 * ```typescript
 * import { checkBalance } from 'flock-in';
 *
 * const result = await checkBalance('0x...');
 * console.log(result.balances.ethereum.balance); // '0.5'
 * console.log(result.hasFunds); // true
 * ```
 *
 * @param address - Ethereum address to check
 * @param options - Check options
 * @returns Balance information for all chains
 */
export async function checkBalance(
  address: string,
  options: CheckBalanceOptions = {}
): Promise<BalanceResult> {
  const chainsToCheck = options.chains || (Object.keys(CHAINS) as ChainName[]);
  const timeout = options.timeout || 10000;

  // Check all chains in parallel
  const results = await Promise.all(
    chainsToCheck.map((chainName) =>
      checkSingleChain(
        address,
        chainName,
        options.customRpcs?.[chainName],
        timeout
      )
    )
  );

  // Build balances map
  const balances: Record<string, ChainBalance> = {};
  let totalWei = 0n;

  for (let i = 0; i < chainsToCheck.length; i++) {
    const chainName = chainsToCheck[i];
    const result = results[i];
    balances[chainName] = result;
    if (!result.error) {
      totalWei += BigInt(result.balanceWei);
    }
  }

  return {
    address,
    balances,
    totalBalance: formatEther(totalWei),
    hasFunds: totalWei > 0n,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Wait for wallet to be funded
 *
 * @example
 * ```typescript
 * import { waitForFunding } from 'flock-in';
 *
 * console.log('Waiting for funds...');
 * const result = await waitForFunding('0x...', { minBalance: '0.01' });
 * console.log('Funded!', result);
 * ```
 *
 * @param address - Address to monitor
 * @param options - Waiting options
 * @returns Balance result once funded
 */
export async function waitForFunding(
  address: string,
  options: {
    /** Minimum balance in ETH (default: '0.001') */
    minBalance?: string;
    /** Check interval in ms (default: 5000) */
    interval?: number;
    /** Maximum wait time in ms (default: 600000 = 10 min) */
    maxWait?: number;
    /** Chains to check (default: ['ethereum', 'base']) */
    chains?: ChainName[];
    /** Callback on each check */
    onCheck?: (result: BalanceResult) => void;
  } = {}
): Promise<BalanceResult> {
  const minBalance = options.minBalance || '0.001';
  const interval = options.interval || 5000;
  const maxWait = options.maxWait || 600000;
  const chains = options.chains || ['ethereum', 'base'];

  const minWei = BigInt(Math.floor(parseFloat(minBalance) * 1e18));
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const result = await checkBalance(address, { chains });

    if (options.onCheck) {
      options.onCheck(result);
    }

    // Check if any chain has sufficient balance
    for (const balance of Object.values(result.balances)) {
      if (BigInt(balance.balanceWei) >= minWei) {
        return result;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for funding after ${maxWait}ms`);
}
