import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = path.join(__dirname, '..', 'usage-data.json');

// Default structure
function makeDefault() {
  return {
    totalApiCalls: 0,
    totalTokens: 0,
    totalToolExecutions: {},
    totalMessages: 0,
    byModel: {},        // { "anthropic/claude-sonnet-4.6": { calls: N, tokens: N } }
    firstTracked: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
    cache = JSON.parse(raw);
  } catch {
    cache = makeDefault();
    save();
  }
  return cache;
}

function save() {
  if (!cache) return;
  cache.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('Failed to save usage data:', err.message);
  }
}

/**
 * Record an API call.
 * @param {string} model  - model ID used
 * @param {number} tokens - total tokens from this call
 */
export function recordApiCall(model, tokens = 0) {
  const data = load();
  data.totalApiCalls++;
  data.totalTokens += tokens;

  if (model) {
    if (!data.byModel[model]) data.byModel[model] = { calls: 0, tokens: 0 };
    data.byModel[model].calls++;
    data.byModel[model].tokens += tokens;
  }

  save();
}

/**
 * Record a tool execution.
 * @param {string} toolName
 */
export function recordToolExec(toolName) {
  const data = load();
  data.totalToolExecutions[toolName] = (data.totalToolExecutions[toolName] || 0) + 1;
  save();
}

/**
 * Record a user message.
 */
export function recordMessage() {
  const data = load();
  data.totalMessages++;
  save();
}

/**
 * Get all persisted usage stats.
 */
export function getUsageStats() {
  return load();
}
