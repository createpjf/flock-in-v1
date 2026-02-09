/**
 * Credential management for FLock Model Switcher
 * Stores API key and current model selection.
 * @module flock-model-switcher/credentials
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
 */
export function getCredentialsPath(options: CredentialsOptions = {}): string {
  if (options.storagePath) {
    return options.storagePath;
  }

  const openclawDir = path.join(os.homedir(), '.openclaw');
  if (fs.existsSync(openclawDir)) {
    return path.join(openclawDir, CREDENTIALS_FILE);
  }

  return path.join(process.cwd(), CREDENTIALS_FILE);
}

/**
 * Load saved credentials
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
 */
export async function saveCredentials(
  credentials: Partial<FlockCredentials>,
  options: CredentialsOptions = {}
): Promise<string> {
  const credPath = getCredentialsPath(options);
  const dir = path.dirname(credPath);

  if (options.createDir !== false && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing: FlockCredentials = {};
  if (fs.existsSync(credPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  const merged: FlockCredentials = {
    ...existing,
    ...credentials,
    updatedAt: new Date().toISOString(),
  };

  if (!merged.createdAt) {
    merged.createdAt = merged.updatedAt;
  }

  fs.writeFileSync(credPath, JSON.stringify(merged, null, 2), { mode: 0o600 });

  return credPath;
}

/**
 * Delete stored credentials
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
 */
export async function hasCredentials(
  options: CredentialsOptions = {}
): Promise<boolean> {
  const creds = await getCredentials(options);
  return !!creds?.apiKey;
}

/**
 * Update the current model selection
 */
export async function switchModel(
  model: string,
  options: CredentialsOptions = {}
): Promise<void> {
  await saveCredentials({ model }, options);
}

/**
 * Get current model selection
 */
export async function getCurrentModel(
  options: CredentialsOptions = {}
): Promise<string> {
  const creds = await getCredentials(options);
  return creds?.model || 'deepseek-v3.2';
}
