/**
 * Agent Service - Integration layer for OpenClaw
 *
 * This module provides the agent-level integration between
 * the flock-in skill and OpenClaw's agent runtime.
 *
 * @module flock-in/agent-service
 */

import {
  generateWallet,
  checkBalance,
  waitForFunding,
  getCredentials,
  saveCredentials,
  switchModel,
  X402Client,
  MODELS,
  type FlockCredentials,
  type BalanceResult,
  type ModelId,
} from '../src/index.js';

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
  authMethod?: 'x402' | 'apiKey';
  model?: string;
  error?: string;
}

/**
 * FLock Agent Service
 *
 * Handles the full lifecycle of FLock API setup and usage within
 * the OpenClaw agent runtime.
 */
export class FlockAgentService {
  private ctx: AgentContext;
  private client: X402Client | null = null;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
  }

  /**
   * Execute full setup flow
   *
   * 1. Check existing configuration
   * 2. Generate wallet
   * 3. Wait for funding
   * 4. Configure credentials
   * 5. Verify setup
   */
  async setup(): Promise<SetupResult> {
    try {
      // Step 1: Check existing config
      const existing = await getCredentials();
      if (existing?.apiKey || existing?.privateKey) {
        await this.ctx.send(
          'Existing FLock configuration found. Use `/flock` to switch models.'
        );
        return {
          success: true,
          wallet: existing.wallet,
          authMethod: existing.apiKey ? 'apiKey' : 'x402',
          model: existing.model,
        };
      }

      // Step 2: Generate wallet
      await this.ctx.send('Generating new wallet for FLock...');
      const wallet = await generateWallet();

      await this.ctx.send(
        `Wallet created!\n\nAddress: \`${wallet.address}\`\n\n` +
          `Please send ~$0.50 of ETH or USDC to this address.`
      );

      // Step 3: Wait for funding
      await this.ctx.send('Waiting for funds...');

      const funded = await waitForFunding(wallet.address, {
        minBalance: '0.001',
        maxWait: 600000, // 10 minutes
        onCheck: async (result) => {
          if (!result.hasFunds) {
            // Silent check, don't spam user
          }
        },
      });

      const fundedChain = Object.entries(funded.balances).find(
        ([, b]) => b.hasFunds
      );
      await this.ctx.send(
        `Funds detected on ${fundedChain?.[0] || 'unknown'}: ${fundedChain?.[1]?.balance || '?'} ETH`
      );

      // Step 4: Determine auth method
      await this.ctx.send(
        'Choose authentication method:\n' +
          '1. **x402** - Pay per request with USDC (autonomous)\n' +
          '2. **API Key** - Traditional API key from platform.flock.io'
      );

      const choice = await this.ctx.prompt('Enter 1 or 2:');
      const useX402 = choice.trim() === '1';

      if (useX402) {
        // x402 setup
        await saveCredentials({
          wallet: wallet.address,
          privateKey: wallet.privateKey,
          model: 'deepseek-v3.2',
        });

        await this.ctx.send(
          'x402 payment configured! You can now use FLock models with automatic micropayments.'
        );

        return {
          success: true,
          wallet: wallet.address,
          authMethod: 'x402',
          model: 'deepseek-v3.2',
        };
      } else {
        // API Key setup
        await this.ctx.send(
          'Please:\n' +
            '1. Go to https://platform.flock.io\n' +
            `2. Connect with wallet: \`${wallet.address}\`\n` +
            '3. Create an API key\n' +
            '4. Paste the API key below'
        );

        const apiKey = await this.ctx.prompt('Enter API key:');

        await saveCredentials({
          apiKey: apiKey.trim(),
          wallet: wallet.address,
          privateKey: wallet.privateKey,
          model: 'deepseek-v3.2',
        });

        await this.ctx.send('API key saved! FLock is now configured.');

        return {
          success: true,
          wallet: wallet.address,
          authMethod: 'apiKey',
          model: 'deepseek-v3.2',
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.ctx.send(`Setup failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Switch to a different model
   */
  async switchToModel(modelId?: string): Promise<void> {
    if (!modelId) {
      // Show model picker
      let message = 'Available models:\n\n';
      for (const [id, model] of Object.entries(MODELS)) {
        message += `• **${id}** - ${model.description} ($${model.pricing.input}/$${model.pricing.output}/1M tokens)\n`;
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
    const model = MODELS[modelId as ModelId];
    await this.ctx.send(`Switched to ${model.name}`);
  }

  /**
   * Check wallet balance
   */
  async checkWalletBalance(): Promise<BalanceResult | null> {
    const creds = await getCredentials();
    if (!creds?.wallet) {
      await this.ctx.send('No wallet configured. Run `/flock-setup` first.');
      return null;
    }

    const result = await checkBalance(creds.wallet);

    let message = `Balance for \`${creds.wallet}\`:\n\n`;
    for (const [chain, balance] of Object.entries(result.balances)) {
      message += `• ${chain}: ${balance.balance} ETH${balance.error ? ` (error: ${balance.error})` : ''}\n`;
    }
    message += `\nTotal: ${result.totalBalance} ETH`;

    await this.ctx.send(message);
    return result;
  }

  /**
   * Get or create x402 client
   */
  async getClient(): Promise<X402Client | null> {
    if (this.client) return this.client;

    const creds = await getCredentials();
    const privateKey = creds?.privateKey || this.ctx.env.FLOCK_WALLET_PRIVATE_KEY;

    if (!privateKey) {
      await this.ctx.send('No wallet configured for x402. Run `/flock-setup` first.');
      return null;
    }

    this.client = new X402Client({ privateKey });
    return this.client;
  }

  /**
   * Send a chat message using x402
   */
  async chat(message: string): Promise<string | null> {
    const client = await this.getClient();
    if (!client) return null;

    const creds = await getCredentials();
    const model = creds?.model || 'deepseek-v3.2';

    try {
      const response = await client.chat({
        model,
        messages: [{ role: 'user', content: message }],
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.ctx.send(`Chat error: ${msg}`);
      return null;
    }
  }
}

/**
 * Create agent service instance
 */
export function createAgentService(ctx: AgentContext): FlockAgentService {
  return new FlockAgentService(ctx);
}

export default FlockAgentService;
