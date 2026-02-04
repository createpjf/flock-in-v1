# FLock IN V1

An OpenClaw skill for FLock API Platform setup, following the Farcaster Agent pattern.

## Features

- **Wallet Generation** — Creates ETH wallet for FLock registration
- **Balance Checking** — Monitors funding on Ethereum and Base
- **Credential Management** — Saves wallet and API key securely
- **Plugin Management** — Auto-installs `@openclawd/flock` plugin
- **Model Switching** — Switch between FLock models on demand

## Quick Start

```
/flock-setup
```

Or use natural language:
- "setup flock"
- "switch to deepseek"
- "use the coding model"

## Complete Setup Flow

1. **Generate wallet** — Agent creates new ETH wallet
2. **Request funding** — User sends ~$0.50 ETH to wallet
3. **Check balance** — Agent verifies funds arrived
4. **Create API key** — User logs into platform.flock.io with wallet, creates key
5. **Save credentials** — Agent stores wallet + API key
6. **Configure OpenClaw** — Save to environment or config
7. **Verify** — Test with `openclaw chat --model flock/kimi-k2.5 "test"`

## Why Wallet-Based Setup?

FLock uses wallet-based authentication for its dashboard. By generating a dedicated wallet:

- Agent owns the wallet credentials
- Human funds it once
- Wallet can be used for future logins
- Credentials stored locally (like Farcaster Agent)

## Available Models

| Model | Price (in/out per 1M tokens) |
|-------|------------------------------|
| Qwen3 235B Thinking | $0.23 / $2.30 |
| Qwen3 235B Finance | $0.23 / $2.30 |
| Kimi K2 Thinking | $0.60 / $2.50 |
| Qwen3 30B Instruct | $0.20 / $0.80 |
| Qwen3 235B Instruct | $0.70 / $2.80 |
| Qwen3 30B Coding | $0.20 / $0.80 |
| DeepSeek V3.2 | $0.28 / $0.42 |
| MiniMax M2.1 | $0.30 / $1.20 |

## Commands

| Command | Description |
|---------|-------------|
| `/flock-setup` | Full setup flow |
| `/flock` | Switch models |

## Scripts

```bash
cd scripts/

# Generate new wallet
node generate-wallet.js

# Check balance
node check-balance.js <address>

# Manage credentials
node credentials.js save <api_key> [wallet] [pk]
node credentials.js get
node credentials.js path
```

## Credentials Storage

Credentials are saved to:
- `~/.openclaw/flock-credentials.json` (if OpenClaw installed)
- `./flock-credentials.json` (fallback)

**Security Warning**: Credentials are stored as plain text JSON. For production, implement secure storage.

## Requirements

- Node.js + npm
- OpenClaw CLI
- ~$0.50 ETH (for wallet funding)

## Related

- [Farcaster Agent](https://github.com/rishavmukherji/farcaster-agent) — Pattern inspiration
- [FLock API Platform](https://platform.flock.io)
- [FLock Documentation](https://docs.flock.io/flock-products/api-platform/getting-started)
