# FLock Model Switcher

A skill that teaches agents how to log in to the FLock API Platform, list available models, and switch between them.

## What This Does

- **Login**: Guides users to get a FLock API key from [platform.flock.io](https://platform.flock.io)
- **List Models**: Shows all available FLock inference models with pricing
- **Switch Models**: Changes the active model for FLock API requests

## Quick Start

### 1. Get Your API Key

1. Go to [platform.flock.io](https://platform.flock.io)
2. Log in (wallet connect or email)
3. Navigate to "API Keys"
4. Create and copy your key

### 2. Set API Key

```bash
export FLOCK_API_KEY="your-api-key"
```

### 3. Use

```
/flock                    # Show model list
/flock deepseek-v3.2      # Switch to a model
```

## Available Models

| Model | ID | Price (in/out per 1M tokens) | Best For |
|-------|----|-----------------------------|----------|
| DeepSeek V3.2 | `deepseek-v3.2` | $0.28 / $0.42 | General, cost-effective |
| Qwen3 30B Coding | `qwen3-30b-coding` | $0.20 / $0.80 | Code generation |
| Qwen3 30B Instruct | `qwen3-30b-instruct` | $0.20 / $0.80 | Instructions |
| Qwen3 235B Instruct | `qwen3-235b-instruct` | $0.70 / $2.80 | Complex reasoning |
| Qwen3 235B Thinking | `qwen3-235b-thinking` | $0.23 / $2.30 | Deep analysis |
| Qwen3 235B Finance | `qwen3-235b-finance` | $0.23 / $2.30 | Financial analysis |
| Kimi K2 Thinking | `kimi-k2-thinking` | $0.60 / $2.50 | Extended thinking |
| MiniMax M2.1 | `minimax-m2.1` | $0.30 / $1.20 | Balanced |

## Natural Language Triggers

```
"list flock models"       → Show model list
"switch to deepseek"      → Change model to DeepSeek V3.2
"use the coding model"    → Switch to Qwen3 30B Coding
"flock login"             → Guide API key setup
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/flock` | List models or switch model |

## Environment Variables

```bash
FLOCK_API_KEY=sk-...              # API key (required)
FLOCK_DEFAULT_MODEL=deepseek-v3.2 # Default model (optional)
```

## Related Resources

- [FLock API Platform](https://platform.flock.io) — Dashboard & API keys
- [FLock Documentation](https://docs.flock.io/flock-products/api-platform/getting-started)

## License

MIT
