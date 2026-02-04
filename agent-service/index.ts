/**
 * Agent Service - Integration layer for OpenClaw
 *
 * This module provides the agent-level integration between
 * the flock-in skill and OpenClaw's agent runtime.
 *
 * Design principle: Minimize user interaction.
 * Only show wallet address when funding is needed.
 * All payment processing is silent.
 *
 * @module flock-in/agent-service
 */

import {
  generateWallet,
  getCredentials,
  saveCredentials,
  switchModel,
  MODELS,
  type FlockCredentials,
  type ModelId,
} from '../src/index.js';

import { X402Client } from '../src/x402-client.js';
import { checkUSDCBalance, type USDCBalanceResult } from '../src/usdc-balance.js';
import { recordPayment, getTotalSpent } from '../src/payment-tracker.js';

/**
 * Agent context provided by OpenClaw runtime
 */
export interface AgentContext {
  /** Send message to user */
  send: (message: string) => Promise<void>;
  /** Prompt user for input */
  prompt: (question: string) => Promise<string>;
  /** Execute shell command */
  exec: (command: string) => Promise<{ stdout: string; stderr: string }>;
  /** Environment variables */
  env: Record<string, string | undefined>;
}

/**
 * Setup result
 */
export interface SetupResult {
  success: boolean;
  wallet?: string;
  balance?: string;
  needsFunding?: boolean;
  error?: string;
}

/**
 * Chat result
 */
export interface ChatResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * FLock Agent Service
 *
 * Handles the full lifecycle of FLock API setup and usage within
 * the OpenClaw agent runtime.
 *
 * Key design: Agent-friendly, minimal user interaction.
 * - Automatic wallet generation
 * - Silent payment processing
 * - Only prompt when funding is needed
 */
export class FlockAgentService {
  private ctx: AgentContext;
  private x402Client: X402Client | null = null;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
  }

  /**
   * Silent initialization - called automatically before any operation.
   * Only shows output when user action is needed (funding).
   *
   * @returns true if ready to use, false if funding needed
   */
  private async ensureReady(): Promise<boolean> {
    const creds = await getCredentials();

    // Already configured with funds
    if (creds?.privateKey) {
      const balance = await checkUSDCBalance(creds.wallet!);
      if (balance.hasMinimum) {
        return true; // Silent pass - user sees nothing
      }
      // Insufficient funds - show minimal prompt
      await this.showFundingPrompt(creds.wallet!, balance.balance);
      return false;
    }

    // First time - generate wallet silently, then show funding prompt
    const wallet = await generateWallet();
    await saveCredentials({
      wallet: wallet.address,
      privateKey: wallet.privateKey,
      model: 'deepseek-v3.2',
    });
    await this.showFundingPrompt(wallet.address, '0.00');
    return false;
  }

  /**
   * Show minimal funding prompt.
   * This is the ONLY setup-related output users see.
   */
  private async showFundingPrompt(
    address: string,
    balance: string
  ): Promise<void> {
    await this.ctx.send(
      `💳 FLock 支付钱包\n\n` +
        `地址: ${address}\n` +
        `余额: $${balance} USDC\n` +
        `网络: Base\n\n` +
        `请发送 USDC 后重试`
    );
  }

  /**
   * Chat with automatic silent payment.
   * Users only see the response content, not payment details.
   *
   * @param message - User message
   * @returns Response content or null if funding needed
   */
  async chat(message: string): Promise<string | null> {
    // Silent check/initialization
    if (!(await this.ensureReady())) {
      return null; // Funding prompt already shown
    }

    const creds = await getCredentials();

    // Initialize client if needed
    if (!this.x402Client) {
      this.x402Client = new X402Client({
        privateKey: creds!.privateKey!,
      });
    }

    try {
      const model = creds!.model || 'deepseek-v3.2';

      // Make request - payment handled internally
      const result = await this.x402Client.chat({
        model,
        messages: [{ role: 'user', content: message }],
      });

      // Silent payment recording (no output)
      if (result.payment) {
        await recordPayment({
          transactionHash: result.payment.transactionHash,
          timestamp: result.payment.timestamp,
          amount: result.payment.amount,
          model,
          network: result.payment.network,
          tokens: {
            input: result.usage?.prompt_tokens || 0,
            output: result.usage?.completion_tokens || 0,
          },
        });
      }

      // Return only content - no payment info shown
      return result.choices[0]?.message?.content || null;
    } catch (error) {
      // Check if it's a balance issue
      if (
        error instanceof Error &&
        (error.message.includes('insufficient') ||
          error.message.includes('balance'))
      ) {
        const balance = await checkUSDCBalance(creds!.wallet!);
        await this.showFundingPrompt(creds!.wallet!, balance.balance);
        return null;
      }
      // For other errors, show brief message
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.ctx.send(`Error: ${msg}`);
      return null;
    }
  }

  /**
   * Switch to a different model (silent unless showing picker)
   */
  async switchToModel(modelId?: string): Promise<void> {
    if (!modelId) {
      // Show model picker only when no model specified
      let message = 'Available models:\n\n';
      for (const [id, model] of Object.entries(MODELS)) {
        message += `• **${id}** - ${model.description}\n`;
      }
      await this.ctx.send(message);

      const selected = await this.ctx.prompt('Enter model ID:');
      modelId = selected.trim();
    }

    if (!(modelId in MODELS)) {
      await this.ctx.send(`Unknown model: ${modelId}`);
      return;
    }

    await switchModel(modelId);
    // Silent confirmation - don't spam user
  }

  /**
   * Get wallet info (only when user explicitly requests)
   */
  async getWalletInfo(): Promise<{
    address: string;
    balance: string;
    totalSpent: string;
  } | null> {
    const creds = await getCredentials();
    if (!creds?.wallet) {
      return null;
    }

    const balance = await checkUSDCBalance(creds.wallet);
    const totalSpent = await getTotalSpent();

    return {
      address: creds.wallet,
      balance: balance.balance,
      totalSpent,
    };
  }

  /**
   * Show wallet details (only when user explicitly asks)
   */
  async showWallet(): Promise<void> {
    const info = await this.getWalletInfo();
    if (!info) {
      // First time - generate wallet
      await this.ensureReady();
      return;
    }

    await this.ctx.send(
      `💳 Wallet\n\n` +
        `Address: ${info.address}\n` +
        `Balance: $${info.balance} USDC\n` +
        `Total Spent: $${info.totalSpent}`
    );
  }
}

/**
 * Create agent service instance
 */
export function createAgentService(ctx: AgentContext): FlockAgentService {
  return new FlockAgentService(ctx);
}

export default FlockAgentService;
