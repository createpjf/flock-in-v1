#!/usr/bin/env node
/**
 * FLock IN CLI
 *
 * Design: Agent-friendly, minimal output.
 * - chat: Only outputs response content
 * - wallet/payments: Optional detail queries
 *
 * @module flock-in/cli
 */

import {
  generateWallet,
  getCredentials,
  saveCredentials,
  deleteCredentials,
  switchModel,
  getCredentialsPath,
  MODELS,
} from './index.js';

import { X402Client } from './x402-client.js';
import { checkUSDCBalance } from './usdc-balance.js';
import { getPaymentHistory, getTotalSpent, getPaymentSummary } from './payment-tracker.js';

const HELP = `
FLock IN - Autonomous FLock API Platform

Usage:
  flock-in <command> [options]

Commands:
  chat <message>  Send chat message (x402 auto-payment)
  wallet          Show wallet address and balance
  payments        Show payment history
  models          List available models
  switch <model>  Switch to a model
  creds           Manage credentials
  help            Show this help

Examples:
  flock-in chat "What is AI?"
  flock-in wallet
  flock-in payments

Payment is automatic via x402 protocol.
No API key needed - just fund your wallet with USDC on Base.
`;

/**
 * Show funding prompt (only output users see when setup needed)
 */
function showFundingPrompt(address: string, balance: string): void {
  console.log(`💳 FLock 支付钱包\n`);
  console.log(`地址: ${address}`);
  console.log(`余额: $${balance} USDC`);
  console.log(`网络: Base\n`);
  console.log(`请发送 USDC 后重试`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  switch (command) {
    // ===== CHAT (Agent-friendly: only output response) =====
    case 'chat': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: flock-in chat <message>');
        process.exit(1);
      }

      // Get or create credentials
      let creds = await getCredentials();

      if (!creds?.privateKey) {
        // First time - generate wallet silently
        const wallet = await generateWallet();
        await saveCredentials({
          wallet: wallet.address,
          privateKey: wallet.privateKey,
          model: 'deepseek-v3.2',
        });
        creds = await getCredentials();
      }

      // Check USDC balance
      const balance = await checkUSDCBalance(creds!.wallet!);

      if (!balance.hasMinimum) {
        showFundingPrompt(creds!.wallet!, balance.balance);
        process.exit(1);
      }

      // Send request (silent payment handling)
      const client = new X402Client({ privateKey: creds!.privateKey! });
      const model = creds!.model || 'deepseek-v3.2';

      try {
        const response = await client.chat({
          model,
          messages: [{ role: 'user', content: message }],
        });

        // Output ONLY the response content
        console.log(response.choices[0]?.message?.content || '');
      } catch (error) {
        if (error instanceof Error && error.message.includes('insufficient')) {
          showFundingPrompt(creds!.wallet!, '0.00');
          process.exit(1);
        }
        throw error;
      }
      break;
    }

    // ===== WALLET (Optional detail query) =====
    case 'wallet': {
      let creds = await getCredentials();

      if (!creds?.wallet) {
        // First time - generate wallet
        const wallet = await generateWallet();
        await saveCredentials({
          wallet: wallet.address,
          privateKey: wallet.privateKey,
          model: 'deepseek-v3.2',
        });
        creds = await getCredentials();
      }

      const balance = await checkUSDCBalance(creds!.wallet!);
      const totalSpent = await getTotalSpent();

      console.log(`💳 Wallet\n`);
      console.log(`Address: ${creds!.wallet}`);
      console.log(`Balance: $${balance.balance} USDC`);
      console.log(`Total Spent: $${totalSpent}`);
      console.log(`Network: Base`);
      break;
    }

    // ===== PAYMENTS (Optional detail query) =====
    case 'payments': {
      const limit = args[1] ? parseInt(args[1]) : 10;
      const history = await getPaymentHistory(limit);
      const summary = await getPaymentSummary();

      console.log(`📊 Payment History\n`);
      console.log(`Total Spent: $${summary.totalSpent}`);
      console.log(`Total Payments: ${summary.totalPayments}`);
      console.log(`Last 24h: ${summary.last24h.count} payments ($${summary.last24h.amount})\n`);

      if (history.length === 0) {
        console.log('No payments yet');
      } else {
        console.log('Recent Payments:');
        for (const p of history) {
          const date = new Date(p.timestamp).toISOString().slice(0, 19).replace('T', ' ');
          console.log(`  ${date} | $${p.amount} | ${p.model}`);
        }
      }
      break;
    }

    // ===== MODELS =====
    case 'models': {
      console.log('Available Models:\n');
      for (const [id, model] of Object.entries(MODELS)) {
        console.log(`  ${id}`);
        console.log(`    ${model.description}`);
        console.log(`    $${model.pricing.input}/$${model.pricing.output} per 1M tokens\n`);
      }
      break;
    }

    // ===== SWITCH =====
    case 'switch': {
      const model = args[1];
      if (!model) {
        console.error('Usage: flock-in switch <model>');
        console.error('Run "flock-in models" for available models');
        process.exit(1);
      }
      if (!(model in MODELS)) {
        console.error(`Unknown model: ${model}`);
        process.exit(1);
      }
      await switchModel(model);
      console.log(`Switched to: ${model}`);
      break;
    }

    // ===== CREDS =====
    case 'creds': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'get': {
          const creds = await getCredentials();
          if (creds) {
            const masked = {
              ...creds,
              privateKey: creds.privateKey
                ? `${creds.privateKey.slice(0, 10)}...`
                : undefined,
            };
            console.log(JSON.stringify(masked, null, 2));
          } else {
            console.log('No credentials');
          }
          break;
        }
        case 'path': {
          console.log(getCredentialsPath());
          break;
        }
        case 'delete': {
          const deleted = await deleteCredentials();
          console.log(deleted ? 'Deleted' : 'Nothing to delete');
          break;
        }
        case 'save': {
          const apiKey = args[2];
          if (!apiKey) {
            console.error('Usage: flock-in creds save <api_key>');
            process.exit(1);
          }
          await saveCredentials({ apiKey });
          console.log('Saved');
          break;
        }
        default:
          console.log('Commands: get, path, delete, save');
      }
      break;
    }

    default:
      console.error(`Unknown: ${command}`);
      console.log('Run "flock-in help" for usage');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
