// ── Centralized Configuration ────────────────────────────────
// User-provided:  BOT_TOKEN, AUTHORIZED_USERS  (via .env)
// Auto-detected:  AI_GATEWAY_API_KEY           (from platform Claude process)
// Platform defaults: everything else
//
// Setup: the installing assistant runs `node src/setup.js` which
// auto-detects the API key and writes .env with user-provided values.

import fs from 'fs';

// ── Auto-detect AI_GATEWAY_API_KEY ────────────────────────────
// The key is injected by the platform into the Claude process.
// We try: 1) env var / .env  2) scan /proc for the claude process environ
function detectApiKey() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;

  try {
    const pids = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d));
    for (const pid of pids) {
      try {
        const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
        if (!cmd.includes('claude') || cmd.includes('bot.js')) continue;
        const env = fs.readFileSync(`/proc/${pid}/environ`, 'utf-8');
        const entry = env.split('\0').find(e => e.startsWith('AI_GATEWAY_API_KEY='));
        if (entry) return entry.split('=').slice(1).join('=');
      } catch { /* skip inaccessible */ }
    }
  } catch { /* /proc not available */ }

  return '';
}

// Bot identity
export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const AI_GATEWAY_API_KEY = detectApiKey();
export const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai-gateway.happycapy.ai/api/v1/chat/completions';

// Access control — comma-separated Telegram user IDs
// e.g. AUTHORIZED_USERS=123456789,987654321
const rawUsers = process.env.AUTHORIZED_USERS || '';
export const AUTHORIZED_USERS = new Set(
  rawUsers.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
);

// Platform paths (standard HappyCapy layout — rarely need changing)
export const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/home/node/a0/workspace';
export const PLATFORM_API_BASE = process.env.PLATFORM_API_BASE || 'http://localhost:3001/api/sessions';
export const PLATFORM_URL = process.env.PLATFORM_URL || 'https://happycapy.ai';

// Agent behaviour
export const MAX_AGENT_TURNS = parseInt(process.env.MAX_AGENT_TURNS || '50', 10);
export const MAX_AUTO_CONTINUES = parseInt(process.env.MAX_AUTO_CONTINUES || '3', 10);
export const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '120000', 10);

// Cancel keywords
export const CANCEL_KEYWORDS = ['取消', '停止', 'stop', 'cancel', '算了', '不用了', '别做了'];

// Validate critical config on import
export function validateConfig() {
  const errors = [];
  if (!BOT_TOKEN) errors.push('BOT_TOKEN is required — get it from @BotFather on Telegram');
  if (!AI_GATEWAY_API_KEY) errors.push('AI_GATEWAY_API_KEY not detected — platform Claude process may not be running');
  if (AUTHORIZED_USERS.size === 0) errors.push('AUTHORIZED_USERS is empty — bot will reject all messages');
  return errors;
}
