/**
 * Agent Service - FLock Model Switcher
 *
 * Provides model listing and switching capabilities for agents.
 *
 * @module flock-model-switcher/agent-service
 */

import {
  getCredentials,
  saveCredentials,
  switchModel,
  getCurrentModel,
  MODELS,
  type FlockCredentials,
  type ModelId,
} from '../src/index.js';

/**
 * Agent context provided by runtime
 */
export interface AgentContext {
  /** Send message to user */
  send: (message: string) => Promise<void>;
  /** Prompt user for input */
  prompt: (question: string) => Promise<string>;
  /** Environment variables */
  env: Record<string, string | undefined>;
}

/**
 * FLock Model Switcher Agent Service
 *
 * Handles model listing and switching within the agent runtime.
 */
export class FlockModelSwitcher {
  private ctx: AgentContext;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
  }

  /**
   * Check if FLOCK_API_KEY is configured.
   * If not, guide user to get one.
   */
  async ensureApiKey(): Promise<boolean> {
    const apiKey = this.ctx.env.FLOCK_API_KEY;
    if (apiKey) {
      return true;
    }

    const creds = await getCredentials();
    if (creds?.apiKey) {
      return true;
    }

    await this.ctx.send(
      `FLock API key not configured. Get one:\n\n` +
      `1. Go to https://platform.flock.io\n` +
      `2. Log in (wallet connect or email)\n` +
      `3. Navigate to "API Keys" section\n` +
      `4. Click "Create API Key"\n` +
      `5. Copy the key (shown only once!)\n\n` +
      `Paste your API key here:`
    );

    const key = await this.ctx.prompt('API key:');
    if (key && key.trim()) {
      await saveCredentials({ apiKey: key.trim() });
      await this.ctx.send('FLock API key configured.');
      return true;
    }

    return false;
  }

  /**
   * List all available models
   */
  async listModels(): Promise<void> {
    const currentModel = await getCurrentModel();

    let message = 'Which FLock model?\n\n';

    message += 'Reasoning:\n';
    message += `  1. Qwen3 235B Thinking         — $0.23/$2.30  (flock/qwen3-235b-a22b-thinking-2507)\n`;
    message += `  2. Qwen3 235B Finance          — $0.23/$2.30  (flock/qwen3-235b-a22b-thinking-qwfin)\n`;
    message += `  3. Kimi K2 Thinking            — $0.60/$2.50  (flock/kimi-k2-thinking)\n\n`;

    message += 'Instruct:\n';
    message += `  4. Qwen3 30B Instruct          — $0.20/$0.80  (flock/qwen3-30b-a3b-instruct-2507)\n`;
    message += `  5. Qwen3 235B Instruct         — $0.70/$2.80  (flock/qwen3-235b-a22b-instruct-2507)\n`;
    message += `  6. Qwen3 30B Coding            — $0.20/$0.80  (flock/qwen3-30b-a3b-instruct-coding)\n\n`;

    message += 'Other:\n';
    message += `  7. DeepSeek V3.2               — $0.28/$0.42  (flock/deepseek-v3.2)\n`;
    message += `  8. MiniMax M2.1                — $0.30/$1.20  (flock/minimax-m2.1)\n\n`;

    message += `Current: ${currentModel}\n`;
    message += 'Reply with number or model name.';

    await this.ctx.send(message);
  }

  /**
   * Switch to a different model
   */
  async switchToModel(modelId?: string): Promise<void> {
    if (!modelId) {
      await this.listModels();
      const selected = await this.ctx.prompt('Enter model ID:');
      modelId = selected.trim();
    }

    // Handle numeric selection
    const numberMap: Record<string, string> = {
      '1': 'qwen3-235b-thinking',
      '2': 'qwen3-235b-finance',
      '3': 'kimi-k2-thinking',
      '4': 'qwen3-30b-instruct',
      '5': 'qwen3-235b-instruct',
      '6': 'qwen3-30b-coding',
      '7': 'deepseek-v3.2',
      '8': 'minimax-m2.1',
    };

    if (modelId in numberMap) {
      modelId = numberMap[modelId];
    }

    if (!(modelId in MODELS)) {
      await this.ctx.send(`Unknown model: ${modelId}`);
      return;
    }

    await switchModel(modelId);
    await this.ctx.send(`Switched to flock/${modelId}.`);
  }

  /**
   * Get current model
   */
  async showCurrentModel(): Promise<void> {
    const model = await getCurrentModel();
    const info = MODELS[model as ModelId];
    if (info) {
      await this.ctx.send(`Current model: ${model} (${info.description})`);
    } else {
      await this.ctx.send(`Current model: ${model}`);
    }
  }
}

/**
 * Create model switcher instance
 */
export function createModelSwitcher(ctx: AgentContext): FlockModelSwitcher {
  return new FlockModelSwitcher(ctx);
}

export default FlockModelSwitcher;
