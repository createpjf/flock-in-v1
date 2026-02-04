/**
 * x402 Payment Client for FLock API
 * @module flock-in/x402-client
 *
 * Handles automatic x402 payment processing for API requests.
 * Uses EIP-3009 (TransferWithAuthorization) for gasless USDC transfers.
 */

import { Wallet } from 'ethers';

/**
 * x402 Client configuration
 */
export interface X402ClientConfig {
  /** Wallet private key for signing payments */
  privateKey: string;
  /** Network to use (default: 'base') */
  network?: 'base' | 'base-sepolia';
  /** Maximum payment per request in USD (default: 0.10) */
  maxPaymentUsd?: number;
  /** FLock API base URL */
  apiBaseUrl?: string;
}

/**
 * Payment proof returned after successful payment
 */
export interface PaymentProof {
  /** Transaction hash on blockchain */
  transactionHash: string;
  /** Amount paid in USD */
  amount: string;
  /** Network used */
  network: string;
  /** Timestamp of payment */
  timestamp: number;
}

/**
 * Chat completion request
 */
export interface ChatRequest {
  /** Model ID */
  model: string;
  /** Messages array */
  messages: Array<{ role: string; content: string }>;
  /** Enable streaming (not yet supported) */
  stream?: boolean;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  max_tokens?: number;
}

/**
 * Chat completion response
 */
export interface ChatResponse {
  /** Response ID */
  id: string;
  /** Object type */
  object: string;
  /** Created timestamp */
  created: number;
  /** Model used */
  model: string;
  /** Choices array */
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  /** Token usage */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Payment proof (if x402 was used) */
  payment?: PaymentProof;
}

/**
 * Payment requirement from 402 response
 */
interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  requiredDecimals: number;
  description?: string;
}

/**
 * x402 Payment Client
 *
 * Automatically handles 402 Payment Required responses from FLock API.
 * Creates EIP-3009 authorization signatures for USDC payments.
 *
 * @example
 * ```typescript
 * const client = new X402Client({
 *   privateKey: '0x...',
 * });
 *
 * const response = await client.chat({
 *   model: 'deepseek-v3.2',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * console.log(response.choices[0].message.content);
 * // Payment handled automatically, no user intervention needed
 * ```
 */
export class X402Client {
  private wallet: Wallet;
  private config: Required<X402ClientConfig>;

  constructor(config: X402ClientConfig) {
    this.config = {
      network: 'base',
      maxPaymentUsd: 0.10,
      apiBaseUrl: 'https://api.flock.io/v1',
      ...config,
    };

    this.wallet = new Wallet(config.privateKey);
  }

  /**
   * Get wallet address
   */
  get address(): string {
    return this.wallet.address;
  }

  /**
   * Send a chat completion request with automatic x402 payment
   *
   * @param request - Chat request
   * @returns Chat response with optional payment proof
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = `${this.config.apiBaseUrl}/chat/completions`;

    // First attempt - may return 402
    const response = await this.makeRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    return response;
  }

  /**
   * Make HTTP request with x402 payment handling
   */
  private async makeRequest(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<ChatResponse> {
    const response = await fetch(url, options);

    // Handle 402 Payment Required
    if (response.status === 402) {
      if (retryCount >= 3) {
        throw new Error('Payment failed after 3 attempts');
      }

      const paymentHeader = response.headers.get('X-PAYMENT-REQUIRED');
      if (!paymentHeader) {
        throw new Error('402 response missing X-PAYMENT-REQUIRED header');
      }

      // Parse payment requirement
      const requirement = this.parsePaymentRequirement(paymentHeader);

      // Validate payment amount
      const amountUsd = parseFloat(requirement.maxAmountRequired) / 1e6;
      if (amountUsd > this.config.maxPaymentUsd) {
        throw new Error(
          `Payment amount $${amountUsd} exceeds max $${this.config.maxPaymentUsd}`
        );
      }

      // Create payment signature
      const paymentPayload = await this.createPaymentSignature(requirement);

      // Retry with payment header
      const newOptions = {
        ...options,
        headers: {
          ...Object.fromEntries(
            Object.entries(options.headers || {})
          ),
          'X-PAYMENT': paymentPayload,
        },
      };

      return this.makeRequest(url, newOptions, retryCount + 1);
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    // Parse successful response
    const data = await response.json();

    // Extract payment proof if present
    const paymentResponse = response.headers.get('X-PAYMENT-RESPONSE');
    if (paymentResponse) {
      try {
        const proofData = JSON.parse(atob(paymentResponse));
        data.payment = {
          transactionHash: proofData.transactionHash || proofData.txHash,
          amount: proofData.amount || '0',
          network: this.config.network,
          timestamp: Date.now(),
        };
      } catch {
        // Ignore payment proof parsing errors
      }
    }

    return data;
  }

  /**
   * Parse payment requirement from header
   */
  private parsePaymentRequirement(header: string): PaymentRequirement {
    try {
      const decoded = atob(header);
      return JSON.parse(decoded);
    } catch {
      throw new Error('Invalid payment requirement header');
    }
  }

  /**
   * Create EIP-3009 payment signature
   */
  private async createPaymentSignature(
    requirement: PaymentRequirement
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const nonce = this.generateNonce();

    // Create payment payload
    const payload = {
      scheme: requirement.scheme || 'exact',
      network: `eip155:${this.config.network === 'base' ? '8453' : '84532'}`,
      amount: requirement.maxAmountRequired,
      resource: requirement.resource,
      payTo: requirement.payTo,
      payer: this.wallet.address,
      validAfter: now.toString(),
      validBefore: (now + 60).toString(), // 1 minute validity
      nonce,
    };

    // Sign the payload
    const message = JSON.stringify(payload);
    const signature = await this.wallet.signMessage(message);

    // Create signed payload
    const signedPayload = {
      ...payload,
      signature,
    };

    return btoa(JSON.stringify(signedPayload));
  }

  /**
   * Generate random nonce for payment
   */
  private generateNonce(): string {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      // Fallback for Node.js
      for (let i = 0; i < 32; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * List available models
   */
  async listModels(): Promise<Array<{ id: string; name: string }>> {
    const response = await fetch(`${this.config.apiBaseUrl}/models`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = await response.json();
    return data.data || data;
  }
}

/**
 * Create a new x402 client
 *
 * @param config - Client configuration
 * @returns Configured client instance
 */
export function createX402Client(config: X402ClientConfig): X402Client {
  return new X402Client(config);
}
