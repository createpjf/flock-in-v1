/**
 * Credential management for FLock
 * @module flock-in/credentials
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * FLock credentials structure
 */
export interface FlockCredentials {
  /** FLock API key */
  apiKey?: string;
  /** Wallet address */
  wallet?: string;
  /** Private key for wallet */
  privateKey?: string;
  /** Current model selection */
  model?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

/**
 * Credentials storage options
 */
export interface CredentialsOptions {
  /** Custom storage path */
  storagePath?: string;
  /** Create directory if not exists (default: true) */
  createDir?: boolean;
}

/**
 * Default credential file name
 */
const CREDENTIALS_FILE = 'flock-credentials.json';

/**
 * Get the default credentials storage path
 *
 * Priority:
 * 1. OpenClaw directory (~/.openclaw/)
 * 2. Current working directory
 *
 * @returns Path to credentials file
 */
export function getCredentialsPath(options: CredentialsOptions = {}): string {
  if (options.storagePath) {
    return options.storagePath;
  }

  // Check for OpenClaw directory
  const openclawDir = path.join(os.homedir(), '.openclaw');
  if (fs.existsSync(openclawDir)) {
    return path.join(openclawDir, CREDENTIALS_FILE);
  }

  // Fallback to current directory
  return path.join(process.cwd(), CREDENTIALS_FILE);
}

/**
 * Load saved credentials
 *
 * @example
 * ```typescript
 * import { getCredentials } from 'flock-in';
 *
 * const creds = await getCredentials();
 * if (creds?.apiKey) {
 *   console.log('API key found');
 * }
 * ```
 *
 * @param options - Storage options
 * @returns Credentials or null if not found
 */
export async function getCredentials(
  options: CredentialsOptions = {}
): Promise<FlockCredentials | null> {
  const credPath = getCredentialsPath(options);

  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(credPath, 'utf8');
    return JSON.parse(content) as FlockCredentials;
  } catch {
    return null;
  }
}

/**
 * Save credentials (merges with existing)
 *
 * @example
 * ```typescript
 * import { saveCredentials } from 'flock-in';
 *
 * await saveCredentials({
 *   apiKey: 'flock_...',
 *   wallet: '0x...',
 *   privateKey: '0x...',
 * });
 * ```
 *
 * @param credentials - Credentials to save
 * @param options - Storage options
 * @returns Path where credentials were saved
 */
export async function saveCredentials(
  credentials: Partial<FlockCredentials>,
  options: CredentialsOptions = {}
): Promise<string> {
  const credPath = getCredentialsPath(options);
  const dir = path.dirname(credPath);

  // Create directory if needed
  if (options.createDir !== false && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing credentials
  let existing: FlockCredentials = {};
  if (fs.existsSync(credPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  // Merge credentials
  const merged: FlockCredentials = {
    ...existing,
    ...credentials,
    updatedAt: new Date().toISOString(),
  };

  if (!merged.createdAt) {
    merged.createdAt = merged.updatedAt;
  }

  // Write with restricted permissions (owner read/write only)
  fs.writeFileSync(credPath, JSON.stringify(merged, null, 2), { mode: 0o600 });

  return credPath;
}

/**
 * Delete stored credentials
 *
 * @param options - Storage options
 * @returns True if deleted, false if didn't exist
 */
export async function deleteCredentials(
  options: CredentialsOptions = {}
): Promise<boolean> {
  const credPath = getCredentialsPath(options);

  if (!fs.existsSync(credPath)) {
    return false;
  }

  fs.unlinkSync(credPath);
  return true;
}

/**
 * Check if credentials are configured
 *
 * @param options - Storage options
 * @returns True if API key or private key is set
 */
export async function hasCredentials(
  options: CredentialsOptions = {}
): Promise<boolean> {
  const creds = await getCredentials(options);
  return !!(creds?.apiKey || creds?.privateKey);
}

/**
 * Update the current model selection
 *
 * @example
 * ```typescript
 * import { switchModel } from 'flock-in';
 *
 * await switchModel('deepseek-v3.2');
 * ```
 *
 * @param model - Model ID to switch to
 * @param options - Storage options
 */
export async function switchModel(
  model: string,
  options: CredentialsOptions = {}
): Promise<void> {
  await saveCredentials({ model }, options);
}

/**
 * Get current model selection
 *
 * @param options - Storage options
 * @returns Current model ID or default
 */
export async function getCurrentModel(
  options: CredentialsOptions = {}
): Promise<string> {
  const creds = await getCredentials(options);
  return creds?.model || 'deepseek-v3.2';
}
