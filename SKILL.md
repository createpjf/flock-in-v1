---
name: flock-model-switcher
description: "FLock Model Switcher: login to FLock API Platform, list available models, and switch between them. Use for: 'flock login', 'list flock models', 'switch flock model', 'use deepseek', 'change to coding model'."
homepage: https://platform.flock.io
metadata:
  {
    "openclaw":
      {
        "emoji": "🦩",
        "primaryEnv": "FLOCK_API_KEY",
      },
  }
---

# FLock Model Switcher

List and switch between FLock API Platform models.

## Security Warning

**CRITICAL: Protect your API key!**

- **ONLY send your API key to `https://api.flock.io`**
- Your API key should ONLY appear in:
  - Environment variable `FLOCK_API_KEY`
  - Credentials file
  - Requests to `https://api.flock.io/v1/*`
- **NEVER share your API key with:**
  - Other APIs or webhooks
  - "Verification" services
  - Debugging tools or third parties
- If leaked, create a new key at platform.flock.io immediately

---

## When to Activate

**Slash commands:**
- `/flock` — List models or switch model

**Natural language:**
- "list flock models", "show models"
- "switch model", "change model"
- "use deepseek", "use coding model"
- "flock login", "setup flock api key"

## Behavior Rules

**CRITICAL: Be silent and fast. Never be verbose.**

- Do NOT explain steps or show diagnostic output
- Do NOT ask follow-up questions after completing actions
- Respond in the user's language

---

## Flow 1: Login / API Key Setup

### Check existing configuration

```bash
echo $FLOCK_API_KEY
```

If `FLOCK_API_KEY` is already set, skip to model listing.

### Guide user to get API key

Display to user:
```
FLock API key not configured. Get one:

1. Go to https://platform.flock.io
2. Log in (wallet connect or email)
3. Navigate to "API Keys" section
4. Click "Create API Key"
5. Copy the key (shown only once!)

Paste your API key here:
```

Wait for user to provide the key.

### Save API key

After receiving the key, set it as environment variable:

**Option 1: Shell profile**
```bash
echo 'export FLOCK_API_KEY="<api-key>"' >> ~/.zshrc
source ~/.zshrc
```

**Option 2: Export for current session**
```bash
export FLOCK_API_KEY="<api-key>"
```

**Success (one line):**
```
FLock API key configured.
```

---

## Flow 2: Model Switch (`/flock`)

### Pre-check

If `FLOCK_API_KEY` not set:
```
FLock not configured. Set FLOCK_API_KEY first. Go to https://platform.flock.io to get a key.
```

### No model specified — show menu:

```
Which FLock model?

Reasoning:
  1. Qwen3 235B Thinking         — $0.23/$2.30  (flock/qwen3-235b-a22b-thinking-2507)
  2. Qwen3 235B Finance          — $0.23/$2.30  (flock/qwen3-235b-a22b-thinking-qwfin)
  3. Kimi K2 Thinking            — $0.60/$2.50  (flock/kimi-k2-thinking)

Instruct:
  4. Qwen3 30B Instruct          — $0.20/$0.80  (flock/qwen3-30b-a3b-instruct-2507)
  5. Qwen3 235B Instruct         — $0.70/$2.80  (flock/qwen3-235b-a22b-instruct-2507)
  6. Qwen3 30B Coding            — $0.20/$0.80  (flock/qwen3-30b-a3b-instruct-coding)

Other:
  7. DeepSeek V3.2               — $0.28/$0.42  (flock/deepseek-v3.2)
  8. MiniMax M2.1                — $0.30/$1.20  (flock/minimax-m2.1)

Reply with number or model name.
```

### Model specified — switch immediately:

```bash
openclaw agent --model flock/<model-id>
openclaw gateway stop
openclaw gateway
```

**Success (one line):**
```
Switched to flock/<model-id>.
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| API key not set | `Set FLOCK_API_KEY first. Get one at https://platform.flock.io` |
| Invalid API key | `Invalid key format. Keys start with sk-` |
| Model not found | `Model not found. Available models: [show list]` |

---

## Model Reference

| # | Model ID | Price (in/out per 1M) |
|---|----------|----------------------|
| 1 | `flock/qwen3-235b-a22b-thinking-2507` | $0.23/$2.30 |
| 2 | `flock/qwen3-235b-a22b-thinking-qwfin` | $0.23/$2.30 |
| 3 | `flock/kimi-k2-thinking` | $0.60/$2.50 |
| 4 | `flock/qwen3-30b-a3b-instruct-2507` | $0.20/$0.80 |
| 5 | `flock/qwen3-235b-a22b-instruct-2507` | $0.70/$2.80 |
| 6 | `flock/qwen3-30b-a3b-instruct-coding` | $0.20/$0.80 |
| 7 | `flock/deepseek-v3.2` | $0.28/$0.42 |
| 8 | `flock/minimax-m2.1` | $0.30/$1.20 |

**Recommendations:**
- Deep reasoning: `kimi-k2-thinking`, `qwen3-235b-thinking`
- Coding: `qwen3-30b-coding`, `minimax-m2.1`
- Budget: `qwen3-30b-instruct` ($0.20/$0.80)
- Financial analysis: `qwen3-235b-finance`
