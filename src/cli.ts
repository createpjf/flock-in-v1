#!/usr/bin/env node
/**
 * FLock Model Switcher CLI
 *
 * Lists and switches between FLock API Platform models.
 *
 * @module flock-model-switcher/cli
 */

import {
  getCredentials,
  saveCredentials,
  deleteCredentials,
  switchModel,
  getCurrentModel,
  getCredentialsPath,
  MODELS,
} from './index.js';

const HELP = `
FLock Model Switcher

Usage:
  flock-in <command> [options]

Commands:
  models          List available models
  switch <model>  Switch to a model
  current         Show current model
  creds           Manage credentials
  help            Show this help

Examples:
  flock-in models
  flock-in switch deepseek-v3.2
  flock-in current
  flock-in creds save <api_key>
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  switch (command) {
    // ===== MODELS =====
    case 'models': {
      const currentModel = await getCurrentModel();
      console.log('Available Models:\n');
      for (const [id, model] of Object.entries(MODELS)) {
        const marker = id === currentModel ? ' (current)' : '';
        console.log(`  ${id}${marker}`);
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

    // ===== CURRENT =====
    case 'current': {
      const model = await getCurrentModel();
      console.log(model);
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
              apiKey: creds.apiKey
                ? `${creds.apiKey.slice(0, 8)}...`
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
