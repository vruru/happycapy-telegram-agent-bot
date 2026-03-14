# HappyCapy Telegram Agent Bot

A full-featured Telegram bot that brings the HappyCapy AI Agent experience to Telegram. It provides the same capabilities as the web interface: AI-powered conversations with tool calling, multi-model support, session management, desktop management, and more.

## Features

- **AI Agent with Tool Calling** — Execute bash commands, read/write/edit files, search files and the web
- **Multi-Model Support** — Switch between Claude, GPT, Gemini, Grok, and more (synced from HappyCapy platform)
- **Session Management** — Create, switch, and delete conversation sessions
- **Desktop Management** — Switch between HappyCapy workspaces (desktops), create and rename them
- **Skills System** — Enable/disable AI skills (web search, image generation, PDF/Office processing, etc.)
- **Agent Teams Mode** — Toggle team collaboration mode for complex tasks
- **Interrupt & Supplement** — Send messages during processing to add context or cancel tasks
- **Internationalization** — Chinese and English interface, auto-detected from Telegram language
- **Usage Statistics** — Track API calls, tool executions, tokens used, by model
- **Platform Sync** — Conversations sync to HappyCapy cloud for web viewing
- **Whitelist Access Control** — Only authorized Telegram users can use the bot
- **Auto-Restart** — Supervisor-managed with conflict detection and backoff

## Requirements

- [HappyCapy](https://happycapy.ai) platform (provides the AI Gateway and workspace environment)
- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Setup

### Automatic (via HappyCapy skill installer)

Install the **HappyCapy Telegram Agent Bot** skill on your HappyCapy desktop, then tell the assistant:

> Set up the Telegram bot with token `YOUR_BOT_TOKEN` and my user ID `YOUR_TELEGRAM_ID`

### Manual

1. Clone this repository into your HappyCapy workspace:
   ```bash
   git clone https://github.com/vruru/happycapy-telegram-agent-bot.git /home/node/telegram-bot
   cd /home/node/telegram-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the setup script (auto-detects AI Gateway key):
   ```bash
   node src/setup.js "YOUR_BOT_TOKEN" "YOUR_TELEGRAM_USER_ID"
   ```

   Or manually copy `.env.example` to `.env` and fill in your values.

4. Start the bot:
   ```bash
   npm start
   ```

   For production with auto-restart:
   ```bash
   bash run.sh
   ```

### Getting Your Telegram User ID

Send a message to [@userinfobot](https://t.me/userinfobot) on Telegram to get your numeric user ID.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Reset and show welcome message |
| `/help` | Show all available commands |
| `/model` | Switch AI model |
| `/skills` | Enable/disable skills |
| `/agentteams` | Toggle Agent Teams mode |
| `/new [name]` | Create a new session |
| `/sessions` | Switch between sessions |
| `/desktops` | Manage workspaces |
| `/settings` | Open settings menu |
| `/stop` | Stop current task |
| `/clear` | Clear session history |
| `/usage` | View usage statistics |
| `/lang` | Switch language (中文/English) |
| `/version` | Show version info |
| `/restart` | Restart the bot |

## Architecture

```
src/
├── bot.js              # Main entry — Telegraf setup, agent loop, message handling
├── commands.js         # All /commands and inline keyboard callback handlers
├── config.js           # Centralized configuration with auto-detection
├── desktop-api.js      # Desktop (workspace) management API
├── executor.js         # Tool execution engine (bash, file ops, search, web)
├── i18n.js             # Internationalization (zh/en)
├── model-sync.js       # Syncs available models from HappyCapy platform
├── platform-sync.js    # Cloud & local platform synchronization
├── setup.js            # First-time setup script
├── skills-registry.js  # Skill definitions and prompt composition
├── state.js            # Session, ProcessingContext, UserState classes
├── state-store.js      # Persistent state storage (disk)
├── tools.js            # Tool definitions and system prompt builder
└── usage-store.js      # Usage statistics persistence
```

## Configuration

All configuration is via environment variables (`.env` file). See [.env.example](.env.example) for all options.

Key variables:
- `BOT_TOKEN` — Telegram bot token (required)
- `AUTHORIZED_USERS` — Comma-separated allowed user IDs (required)
- `AI_GATEWAY_API_KEY` — Auto-detected on HappyCapy platform

## License

ISC
