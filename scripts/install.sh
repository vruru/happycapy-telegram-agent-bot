#!/bin/bash
# HappyCapy Telegram Agent Bot — Installer
# Clones the repo, installs deps, and registers with supervisord.

set -e

INSTALL_DIR="/home/node/telegram-bot"
REPO_URL="https://github.com/vruru/happycapy-telegram-agent-bot.git"

echo "=== HappyCapy Telegram Agent Bot Installer ==="

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Existing installation found, pulling latest..."
  cd "$INSTALL_DIR" && git pull origin main
else
  if [ -d "$INSTALL_DIR" ] && [ "$(ls -A $INSTALL_DIR/src 2>/dev/null)" ]; then
    echo "Existing non-git installation found at $INSTALL_DIR"
    echo "Skipping clone — using existing files."
  else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
fi

cd "$INSTALL_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Copy .env.example if no .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template — you must configure it before starting."
  echo ""
  echo "Required: Run setup with your Telegram bot token and user ID:"
  echo "  node src/setup.js \"YOUR_BOT_TOKEN\" \"YOUR_TELEGRAM_USER_ID\""
  echo ""
  echo "Get bot token from @BotFather on Telegram"
  echo "Get your user ID from @userinfobot on Telegram"
else
  echo ".env already exists, keeping current configuration."
fi

# Register with supervisord
echo "Registering with supervisord..."
bash ensure-supervisor.sh 2>/dev/null || true

echo ""
echo "=== Installation complete ==="
echo "Next steps:"
echo "  1. Run: node src/setup.js \"BOT_TOKEN\" \"USER_ID\""
echo "  2. Start: bash run.sh"
