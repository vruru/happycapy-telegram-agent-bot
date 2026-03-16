#!/bin/bash
# Auto-check and start telegram_bot
# Usage: bash check-and-start.sh

set -e

CONF="/etc/supervisord.conf"
BOT_DIR="/home/node/telegram-bot"

echo "=== Telegram Bot Startup Check ==="

# Step 1: Check if telegram_bot config exists in supervisord.conf
if ! grep -q "^\[program:telegram_bot\]" "$CONF" 2>/dev/null; then
  echo "❌ telegram_bot config NOT found in supervisord.conf"
  echo "🔧 Running ensure-supervisor.sh to inject config..."
  cd "$BOT_DIR"
  bash ensure-supervisor.sh
  echo "✅ Config injected and bot started"
  exit 0
fi

echo "✅ telegram_bot config exists in supervisord.conf"

# Step 2: Check if process is running
STATUS=$(supervisorctl status telegram_bot | awk '{print $2}')

if [ "$STATUS" != "RUNNING" ]; then
  echo "❌ telegram_bot is $STATUS"
  echo "🔧 Starting telegram_bot..."
  supervisorctl start telegram_bot
  sleep 2
  supervisorctl status telegram_bot
  echo "✅ telegram_bot started"
else
  echo "✅ telegram_bot is already RUNNING"
  supervisorctl status telegram_bot
fi
