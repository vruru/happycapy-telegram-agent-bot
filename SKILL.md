---
name: happycapy-telegram-agent-bot
description: Install and configure a full-featured Telegram bot that brings HappyCapy AI Agent capabilities to Telegram. Use when the user wants to set up a Telegram bot, control their HappyCapy workspace via Telegram, or asks about Telegram integration. Provides AI agent with tool calling, multi-model support, session management, desktop management, skills toggle, i18n, and cloud sync.
---

# HappyCapy Telegram Agent Bot

A Telegram bot that mirrors the HappyCapy web experience: AI conversations with tool calling, multi-model switching, session/desktop management, and more.

## Installation

Run the install script to clone, install dependencies, and register with supervisord:

```bash
bash ~/.claude/skills/happycapy-telegram-agent-bot/scripts/install.sh
```

## Setup

After installation, the user must provide two values:

1. **Bot Token** - Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. **Telegram User ID** - Get from [@userinfobot](https://t.me/userinfobot) on Telegram

Then run:

```bash
cd /home/node/telegram-bot && node src/setup.js "BOT_TOKEN_HERE" "USER_ID_HERE"
```

Start the bot:

```bash
cd /home/node/telegram-bot && bash run.sh &
```

Or register with supervisord for auto-start on boot:

```bash
bash /home/node/telegram-bot/ensure-supervisor.sh
```

## Features

- AI agent with tool calling (bash, file ops, search, web search)
- Multi-model support (Claude, GPT, Gemini, Grok - synced from platform)
- Session management (create, switch, delete conversations)
- Desktop/workspace management (switch, create, rename, delete)
- Skills toggle (web search, image gen, PDF, Office processing, etc.)
- Agent Teams mode for complex task decomposition
- Interrupt and supplement messages during AI processing
- Chinese/English interface (auto-detected from Telegram language)
- Usage statistics (API calls, tokens, tool usage, by model)
- Cloud sync to HappyCapy web UI
- Whitelist access control via Telegram user IDs
- Auto-restart with polling conflict detection

## Bot Commands

`/start` `/help` `/model` `/skills` `/agentteams` `/new` `/sessions` `/desktops` `/settings` `/stop` `/clear` `/usage` `/lang` `/version` `/restart`

## Troubleshooting

- Bot won't start: Check `.env` has valid `BOT_TOKEN` and `AUTHORIZED_USERS`
- AI fails: Verify `AI_GATEWAY_API_KEY` auto-detection works (re-run setup.js)
- Restart: `supervisorctl restart telegram_bot`
- Logs: `supervisorctl tail -f telegram_bot`
