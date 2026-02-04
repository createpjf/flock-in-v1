/**
 * Payment History Tracker
 * @module flock-in/payment-tracker
 *
 * Silently records all x402 payments for auditing and debugging.
 * Users don't see this data unless they explicitly query it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Payment record structure
 */
export interface PaymentRecord {
  /** Unique payment ID */
  id: string;
  /** Blockchain transaction hash */
  transactionHash: string;
  /** Payment timestamp */
  timestamp: number;
  /** Amount paid in USD */
  amount: string;
  /** Model used */
  model: string;
  /** Network (base, base-sepolia) */
  network: string;
  /** Token usage */
  tokens: {
    input: number;
    output: number;
  };
}

/**
 * Payment history summary
 */
export interface PaymentSummary {
  /** Total amount spent */
  totalSpent: string;
  /** Total number of payments */
  totalPayments: number;
  /** Payments in last 24 hours */
  last24h: {
    count: number;
    amount: string;
  };
  /** Most used model */
  topModel?: string;
}

const HISTORY_FILE = 'flock-payment-history.json';
const MAX_RECORDS = 1000;

/**
 * Get payment history file path
 */
function getHistoryPath(): string {
  // Prefer OpenClaw directory
  const openclawDir = path.join(os.homedir(), '.openclaw');
  if (fs.existsSync(openclawDir)) {
    return path.join(openclawDir, HISTORY_FILE);
  }
  // Fallback to current directory
  return path.join(process.cwd(), HISTORY_FILE);
}

/**
 * Load payment history from disk
 */
function loadHistory(): PaymentRecord[] {
  const historyPath = getHistoryPath();
  if (!fs.existsSync(historyPath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Save payment history to disk
 */
function saveHistory(history: PaymentRecord[]): void {
  const historyPath = getHistoryPath();
  const dir = path.dirname(historyPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Trim to max records
  const trimmed = history.slice(-MAX_RECORDS);

  fs.writeFileSync(historyPath, JSON.stringify(trimmed, null, 2));
}

/**
 * Generate unique payment ID
 */
function generatePaymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `pay_${timestamp}_${random}`;
}

/**
 * Record a payment (silent, no output)
 *
 * @param payment - Payment data to record
 */
export async function recordPayment(
  payment: Omit<PaymentRecord, 'id'>
): Promise<void> {
  const history = loadHistory();

  history.push({
    id: generatePaymentId(),
    ...payment,
  });

  saveHistory(history);
}

/**
 * Get payment history
 *
 * @param limit - Maximum records to return (default: 50)
 * @returns Recent payments, newest first
 */
export async function getPaymentHistory(
  limit = 50
): Promise<PaymentRecord[]> {
  const history = loadHistory();
  return history.slice(-limit).reverse();
}

/**
 * Get total amount spent
 *
 * @returns Total spent in USD (e.g., "12.3456")
 */
export async function getTotalSpent(): Promise<string> {
  const history = loadHistory();
  const total = history.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
  return total.toFixed(4);
}

/**
 * Get payment summary statistics
 *
 * @returns Summary of payment activity
 */
export async function getPaymentSummary(): Promise<PaymentSummary> {
  const history = loadHistory();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  // Calculate totals
  const totalSpent = history.reduce(
    (sum, p) => sum + parseFloat(p.amount || '0'),
    0
  );

  // Last 24 hours
  const last24h = history.filter((p) => p.timestamp > dayAgo);
  const last24hAmount = last24h.reduce(
    (sum, p) => sum + parseFloat(p.amount || '0'),
    0
  );

  // Top model
  const modelCounts: Record<string, number> = {};
  for (const p of history) {
    modelCounts[p.model] = (modelCounts[p.model] || 0) + 1;
  }
  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    totalSpent: totalSpent.toFixed(4),
    totalPayments: history.length,
    last24h: {
      count: last24h.length,
      amount: last24hAmount.toFixed(4),
    },
    topModel,
  };
}

/**
 * Clear payment history
 * (For testing/debugging only)
 */
export async function clearPaymentHistory(): Promise<void> {
  const historyPath = getHistoryPath();
  if (fs.existsSync(historyPath)) {
    fs.unlinkSync(historyPath);
  }
}

/**
 * Get payment history file path
 * (For debugging)
 */
export function getPaymentHistoryPath(): string {
  return getHistoryPath();
}
