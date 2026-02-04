#!/usr/bin/env node
/**
 * FLock IN CLI
 * @module flock-in/cli
 */

import {
  generateWallet,
  checkBalance,
  getCredentials,
  saveCredentials,
  deleteCredentials,
  switchModel,
  getCredentialsPath,
  X402Client,
  MODELS,
} from './index.js';

const HELP = `
FLock IN - Autonomous FLock API Platform Setup

Usage:
  flock-in <command> [options]

Commands:
  setup           Full setup wizard
  wallet          Generate new wallet
  balance <addr>  Check wallet balance
  creds           Manage credentials
  models          List available models
  switch <model>  Switch to a model
  chat <message>  Send chat message (x402)
  help            Show this help

Credential Commands:
  creds get       Show saved credentials
  creds path      Show credentials file path
  creds delete    Delete credentials

Examples:
  flock-in wallet
  flock-in balance 0x1234...
  flock-in switch deepseek-v3.2
  flock-in chat "Hello, world!"

Environment Variables:
  FLOCK_API_KEY            API key for traditional auth
  FLOCK_WALLET_PRIVATE_KEY Private key for x402 payments
  FLOCK_DEFAULT_MODEL      Default model (deepseek-v3.2)
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'wallet': {
      const wallet = await generateWallet();
      console.log(JSON.stringify(wallet, null, 2));
      console.log(`\nFund this address with ~$0.50 ETH or USDC`);
      break;
    }

    case 'balance': {
      const address = args[1];
      if (!address) {
        console.error('Usage: flock-in balance <address>');
        process.exit(1);
      }
      const result = await checkBalance(address);
      console.log(JSON.stringify(result, null, 2));
      if (result.hasFunds) {
        console.log(`\nFunds detected: ${result.totalBalance} ETH total`);
      } else {
        console.log('\nNo funds detected');
      }
      break;
    }

    case 'creds': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'get': {
          const creds = await getCredentials();
          if (creds) {
            // Mask private key
            const masked = {
              ...creds,
              privateKey: creds.privateKey
                ? `${creds.privateKey.slice(0, 10)}...`
                : undefined,
            };
            console.log(JSON.stringify(masked, null, 2));
          } else {
            console.log('No credentials found');
          }
          break;
        }
        case 'path': {
          console.log(getCredentialsPath());
          break;
        }
        case 'delete': {
          const deleted = await deleteCredentials();
          console.log(deleted ? 'Credentials deleted' : 'No credentials to delete');
          break;
        }
        case 'save': {
          const apiKey = args[2];
          const wallet = args[3];
          const privateKey = args[4];
          if (!apiKey) {
            console.error('Usage: flock-in creds save <api_key> [wallet] [private_key]');
            process.exit(1);
          }
          const path = await saveCredentials({
            apiKey,
            wallet,
            privateKey,
          });
          console.log(`Credentials saved to: ${path}`);
          break;
        }
        default:
          console.log('Credential commands: get, path, delete, save');
      }
      break;
    }

    case 'models': {
      console.log('Available FLock Models:\n');
      for (const [id, model] of Object.entries(MODELS)) {
        console.log(`  ${id}`);
        console.log(`    ${model.name} - ${model.description}`);
        console.log(`    Pricing: $${model.pricing.input}/$${model.pricing.output} per 1M tokens`);
        console.log();
      }
      break;
    }

    case 'switch': {
      const model = args[1];
      if (!model) {
        console.error('Usage: flock-in switch <model>');
        console.error('Run "flock-in models" to see available models');
        process.exit(1);
      }
      if (!(model in MODELS)) {
        console.error(`Unknown model: ${model}`);
        console.error('Run "flock-in models" to see available models');
        process.exit(1);
      }
      await switchModel(model);
      console.log(`Switched to model: ${model}`);
      break;
    }

    case 'chat': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: flock-in chat <message>');
        process.exit(1);
      }

      // Get credentials
      const creds = await getCredentials();
      const privateKey = creds?.privateKey || process.env.FLOCK_WALLET_PRIVATE_KEY;

      if (!privateKey) {
        console.error('No wallet configured. Run "flock-in wallet" first.');
        process.exit(1);
      }

      const model = creds?.model || process.env.FLOCK_DEFAULT_MODEL || 'deepseek-v3.2';

      console.log(`Using model: ${model}`);
      console.log('Sending request with x402 payment...\n');

      const client = new X402Client({ privateKey });
      const response = await client.chat({
        model,
        messages: [{ role: 'user', content: message }],
      });

      console.log(response.choices[0]?.message?.content || 'No response');
      console.log(`\nTokens: ${response.usage?.total_tokens || 'N/A'}`);
      break;
    }

    case 'setup': {
      console.log('FLock Setup Wizard\n');

      // Step 1: Check existing config
      const existing = await getCredentials();
      if (existing?.apiKey || existing?.privateKey) {
        console.log('Existing configuration found.');
        console.log('Delete with: flock-in creds delete\n');
      }

      // Step 2: Generate wallet
      console.log('Step 1: Generating wallet...');
      const wallet = await generateWallet();
      console.log(`  Address: ${wallet.address}`);
      console.log(`  Private Key: ${wallet.privateKey.slice(0, 10)}...`);

      // Step 3: Save wallet
      await saveCredentials({
        wallet: wallet.address,
        privateKey: wallet.privateKey,
      });
      console.log('  Saved to credentials\n');

      // Step 4: Instructions
      console.log('Step 2: Fund your wallet');
      console.log(`  Send ~$0.50 of ETH or USDC to:`);
      console.log(`  ${wallet.address}\n`);

      console.log('Step 3: Choose authentication method\n');

      console.log('  Option A: x402 (Autonomous)');
      console.log('    - Fund wallet with USDC on Base network');
      console.log('    - Payments happen automatically per request');
      console.log('    - Run: flock-in chat "test message"\n');

      console.log('  Option B: API Key (Traditional)');
      console.log('    1. Go to https://platform.flock.io');
      console.log('    2. Connect with wallet above');
      console.log('    3. Create API key');
      console.log('    4. Run: flock-in creds save <api_key>\n');

      console.log('Setup complete! Check balance with:');
      console.log(`  flock-in balance ${wallet.address}`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "flock-in help" for usage');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
