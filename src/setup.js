#!/usr/bin/env node
// ── HappyCapy Telegram Bot Setup ─────────────────────────────
// Usage: node src/setup.js <BOT_TOKEN> <AUTHORIZED_USER_IDS>
//
// This script is meant to be called by the installing assistant.
// It auto-detects AI_GATEWAY_API_KEY and writes the .env file.
//
// Example:
//   node src/setup.js "1234567890:ABCdef..." "123456789"
//   node src/setup.js "1234567890:ABCdef..." "123456789,987654321"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');

const botToken = process.argv[2];
const authorizedUsers = process.argv[3];

if (!botToken || !authorizedUsers) {
  console.error('Usage: node src/setup.js <BOT_TOKEN> <AUTHORIZED_USER_IDS>');
  console.error('  BOT_TOKEN: Get from @BotFather on Telegram');
  console.error('  AUTHORIZED_USER_IDS: Comma-separated Telegram user IDs');
  process.exit(1);
}

// Auto-detect AI_GATEWAY_API_KEY from Claude process
function detectApiKey() {
  // Check current env first
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;

  try {
    const pids = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d));
    for (const pid of pids) {
      try {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
        if (!cmd.includes('claude') || cmd.includes('bot.js') || cmd.includes('setup.js')) continue;
        const env = fs.readFileSync(`/proc/${pid}/environ`, 'utf-8');
        const entry = env.split('\0').find(e => e.startsWith('AI_GATEWAY_API_KEY='));
        if (entry) return entry.split('=').slice(1).join('=');
      } catch { /* skip */ }
    }
  } catch { /* /proc not available */ }

  return '';
}

const apiKey = detectApiKey();
if (!apiKey) {
  console.error('ERROR: Could not auto-detect AI_GATEWAY_API_KEY.');
  console.error('Make sure this is running on the HappyCapy platform.');
  process.exit(1);
}

// Write .env
const envContent = `BOT_TOKEN=${botToken}\nAI_GATEWAY_API_KEY=${apiKey}\nAUTHORIZED_USERS=${authorizedUsers}\n`;
fs.writeFileSync(ENV_PATH, envContent);

console.log('Setup complete!');
console.log(`  .env written to: ${ENV_PATH}`);
console.log(`  BOT_TOKEN: ${botToken.substring(0, 10)}...`);
console.log(`  AI_GATEWAY_API_KEY: auto-detected (${apiKey.substring(0, 8)}...)`);
console.log(`  AUTHORIZED_USERS: ${authorizedUsers}`);
console.log('');
console.log('Restart the bot: supervisorctl restart telegram_bot');
