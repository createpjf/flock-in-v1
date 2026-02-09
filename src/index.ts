/**
 * FLock Model Switcher
 *
 * A skill for listing and switching between FLock API Platform models.
 *
 * @packageDocumentation
 * @module flock-model-switcher
 */

// Credential management
export {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  hasCredentials,
  switchModel,
  getCurrentModel,
  getCredentialsPath,
  type FlockCredentials,
  type CredentialsOptions,
} from './credentials.js';

/**
 * Available FLock models
 */
export const MODELS = {
  'deepseek-v3.2': {
    name: 'DeepSeek V3.2',
    description: 'General purpose, cost-effective',
    pricing: { input: 0.28, output: 0.42 },
  },
  'qwen3-30b-coding': {
    name: 'Qwen3 30B Coding',
    description: 'Code generation',
    pricing: { input: 0.2, output: 0.8 },
  },
  'qwen3-30b-instruct': {
    name: 'Qwen3 30B Instruct',
    description: 'Instruction following',
    pricing: { input: 0.2, output: 0.8 },
  },
  'qwen3-235b-instruct': {
    name: 'Qwen3 235B Instruct',
    description: 'Complex reasoning',
    pricing: { input: 0.7, output: 2.8 },
  },
  'qwen3-235b-thinking': {
    name: 'Qwen3 235B Thinking',
    description: 'Deep analysis',
    pricing: { input: 0.23, output: 2.3 },
  },
  'qwen3-235b-finance': {
    name: 'Qwen3 235B Finance',
    description: 'Financial analysis',
    pricing: { input: 0.23, output: 2.3 },
  },
  'kimi-k2-thinking': {
    name: 'Kimi K2 Thinking',
    description: 'Extended thinking',
    pricing: { input: 0.6, output: 2.5 },
  },
  'minimax-m2.1': {
    name: 'MiniMax M2.1',
    description: 'Balanced performance',
    pricing: { input: 0.3, output: 1.2 },
  },
} as const;

export type ModelId = keyof typeof MODELS;

/**
 * Package version
 */
export const VERSION = '1.0.0';
