/**
 * x402 Payment Protocol client for FLock API
 * @module flock-in/x402
 *
 * x402 is an open payment protocol that enables pay-per-request API access
 * using cryptocurrency micropayments. It uses HTTP 402 Payment Required
 * responses to negotiate payments.
 *
 * @see https://www.x402.org/
 * @see https://github.com/coinbase/x402
 */

import { Wallet, type Provider } from 'ethers';

/**
 * x402 payment configuration
 */
export interface X402Config {
  /** Private key for signing payments */
  privateKey: string;
  /** Network to use for payments (default: 'base') */
  network?: 'base' | 'ethereum' | 'optimism';
  /** Maximum amount willing to pay per request in USD (default: 0.10) */
  maxPaymentUsd?: number;
  /** FLock API base URL */
  apiBaseUrl?: string;
}

/**
 * x402 payment requirement from server
 */
export interface PaymentRequirement {
  /** Payment scheme (e.g., 'exact') */
  scheme: string;
  /** Network for payment */
  network: string;
  /** Amount in smallest unit */
  maxAmountRequired: string;
  /** Payment resource */
  resource: string;
  /** Payment description */
  description: string;
  /** Recipient address */
  payTo: string;
  /** Required token (e.g., USDC address) */
  requiredDecimals: number;
  /** Token address */
  token?: string;
  /** Extra data */
  extra?: Record<string, unknown>;
}

/**
 * x402 payment response
 */
export interface PaymentResponse {
  /** Whether payment was successful */
  success: boolean;
  /** Transaction hash if payment was made */
  transactionHash?: string;
  /** Amount paid */
  amountPaid?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * FLock chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * FLock chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Default FLock API URL
 */
const FLOCK_API_URL = 'https://api.flock.io/v1';

/**
 * Network RPC URLs
 */
const NETWORK_RPCS: Record<string, string> = {
  base: 'https://mainnet.base.org',
  ethereum: 'https://eth.llamarpc.com',
  optimism: 'https://mainnet.optimism.io',
};

/**
 * x402 Payment Client for FLock API
 *
 * Enables autonomous API access through micropayments without traditional API keys.
 *
 * @example
 * ```typescript
 * import { X402Client } from 'flock-in';
 *
 * const client = new X402Client({
 *   privateKey: process.env.WALLET_PRIVATE_KEY!,
 *   network: 'base',
 * });
 *
 * const response = await client.chat({
 *   model: 'deepseek-v3.2',
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * ```
 */
export class X402Client {
  private wallet: Wallet;
  private config: Required<X402Config>;

  constructor(config: X402Config) {
    this.config = {
      privateKey: config.privateKey,
      network: config.network || 'base',
      maxPaymentUsd: config.maxPaymentUsd || 0.1,
      apiBaseUrl: config.apiBaseUrl || FLOCK_API_URL,
    };

    this.wallet = new Wallet(this.config.privateKey);
  }

  /**
   * Get the wallet address used for payments
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Make a payment-enabled request to FLock API
   *
   * @param endpoint - API endpoint (e.g., '/chat/completions')
   * @param options - Fetch options
   * @returns Response from API
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;

    // First request - may receive 402 Payment Required
    let response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle 402 Payment Required
    if (response.status === 402) {
      const paymentHeader = response.headers.get('X-Payment-Required');
      if (!paymentHeader) {
        throw new Error('402 response missing X-Payment-Required header');
      }

      // Parse payment requirement
      const paymentReq = this.parsePaymentRequirement(paymentHeader);

      // Create and sign payment
      const paymentSignature = await this.createPaymentSignature(paymentReq);

      // Retry with payment
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': paymentSignature,
          ...options.headers,
        },
      });
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Parse payment requirement from header
   */
  private parsePaymentRequirement(header: string): PaymentRequirement {
    try {
      // Header is base64-encoded JSON
      const decoded = Buffer.from(header, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch {
      // Try parsing as plain JSON
      return JSON.parse(header);
    }
  }

  /**
   * Create payment signature for x402
   */
  private async createPaymentSignature(
    requirement: PaymentRequirement
  ): Promise<string> {
    // Validate payment amount
    const amountUsd = parseFloat(requirement.maxAmountRequired) / 1e6; // USDC has 6 decimals
    if (amountUsd > this.config.maxPaymentUsd) {
      throw new Error(
        `Payment amount $${amountUsd} exceeds max $${this.config.maxPaymentUsd}`
      );
    }

    // Create payment payload
    const payload = {
      scheme: requirement.scheme,
      network: this.config.network,
      amount: requirement.maxAmountRequired,
      resource: requirement.resource,
      payTo: requirement.payTo,
      payer: this.wallet.address,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2),
    };

    // Sign the payload
    const message = JSON.stringify(payload);
    const signature = await this.wallet.signMessage(message);

    // Encode as base64 for header
    const paymentPayload = {
      ...payload,
      signature,
    };

    return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
  }

  /**
   * Send a chat completion request
   *
   * @example
   * ```typescript
   * const response = await client.chat({
   *   model: 'deepseek-v3.2',
   *   messages: [
   *     { role: 'system', content: 'You are a helpful assistant.' },
   *     { role: 'user', content: 'Hello!' },
   *   ],
   * });
   *
   * console.log(response.choices[0].message.content);
   * ```
   *
   * @param request - Chat completion request
   * @returns Chat completion response
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * List available models
   */
  async listModels(): Promise<{ data: Array<{ id: string; name: string }> }> {
    return this.request('/models', { method: 'GET' });
  }
}

/**
 * Create an x402-enabled fetch function
 *
 * This wraps the standard fetch API to automatically handle x402 payments.
 *
 * @example
 * ```typescript
 * import { createX402Fetch } from 'flock-in';
 *
 * const x402Fetch = createX402Fetch({
 *   privateKey: process.env.WALLET_PRIVATE_KEY!,
 * });
 *
 * // Use like normal fetch - payments handled automatically
 * const response = await x402Fetch('https://api.flock.io/v1/chat/completions', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     model: 'deepseek-v3.2',
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   }),
 * });
 * ```
 *
 * @param config - x402 configuration
 * @returns Wrapped fetch function
 */
export function createX402Fetch(config: X402Config): typeof fetch {
  const client = new X402Client(config);

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const isFlockApi = url.includes('flock.io') || url.includes('api.flock');

    if (!isFlockApi) {
      // Not a FLock API request, use normal fetch
      return fetch(input, init);
    }

    // Extract endpoint from URL
    const urlObj = new URL(url);
    const endpoint = urlObj.pathname.replace('/v1', '');

    try {
      const result = await client.request(endpoint, init);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * Check if x402 dependencies are available
 *
 * @returns True if @x402/fetch and @x402/evm are installed
 */
export async function hasX402Dependencies(): Promise<boolean> {
  try {
    await import('@x402/fetch');
    await import('@x402/evm');
    return true;
  } catch {
    return false;
  }
}

/**
 * Estimate payment cost for a chat request
 *
 * @param model - Model ID
 * @param inputTokens - Estimated input tokens
 * @param outputTokens - Estimated output tokens
 * @returns Estimated cost in USD
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  // Pricing per million tokens (from README)
  const pricing: Record<string, { input: number; output: number }> = {
    'deepseek-v3.2': { input: 0.28, output: 0.42 },
    'qwen3-30b-coding': { input: 0.2, output: 0.8 },
    'qwen3-30b-instruct': { input: 0.2, output: 0.8 },
    'qwen3-235b-instruct': { input: 0.7, output: 2.8 },
    'qwen3-235b-thinking': { input: 0.23, output: 2.3 },
    'qwen3-235b-finance': { input: 0.23, output: 2.3 },
    'kimi-k2-thinking': { input: 0.6, output: 2.5 },
    'minimax-m2.1': { input: 0.3, output: 1.2 },
  };

  const modelPricing = pricing[model] || pricing['deepseek-v3.2'];
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}
