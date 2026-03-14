import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_URL } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '..', 'models-cache.json');
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

// Emoji mapping by model name keyword
const EMOJI_MAP = {
  'opus 4.6': '🧠', 'opus 4.5': '💎',
  'sonnet 4.6': '⚡', 'sonnet 4.5': '✨',
  'haiku': '💨', 'minimax': '💰',
  'gpt': '🤖', 'gemini': '🔷', 'grok': '🚀'
};

// Chinese description mapping
const DESC_MAP = {
  'Latest and most capable model': '最新最强模型',
  'Most capable for complex work': '复杂任务首选',
  'Best for everyday tasks': '日常任务最佳',
  'Fastest for quick answers': '快速回答',
  'Best value for cost efficiency': '性价比最高'
};

// Convert frontend model ID to AI Gateway format
// e.g. "claude-opus-4-6" → "anthropic/claude-opus-4.6"
// e.g. "MiniMax-M2.5" → "minimax/MiniMax-M2.5"
function toGatewayId(frontendId) {
  if (frontendId.toLowerCase().startsWith('claude')) {
    // Claude models: add anthropic/ prefix, convert version hyphen to dot
    const converted = frontendId.replace(/(\d+)-(\d+)$/, '$1.$2');
    return `anthropic/${converted}`;
  }
  if (frontendId.toLowerCase().startsWith('minimax')) {
    return `minimax/${frontendId}`;
  }
  if (frontendId.toLowerCase().startsWith('gpt')) {
    return `openai/${frontendId}`;
  }
  if (frontendId.toLowerCase().startsWith('gemini')) {
    return `google/${frontendId}`;
  }
  // Fallback: return as-is
  return frontendId;
}

function getEmoji(name) {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return '🤖';
}

function getDesc(engDesc) {
  return DESC_MAP[engDesc] || engDesc;
}

// Fetch models from the web platform's frontend bundle
async function fetchModelsFromPlatform() {
  // Step 1: Get the main page to find the JS bundle filename
  const htmlRes = await fetch(PLATFORM_URL, { timeout: 10000 });
  const html = await htmlRes.text();

  const match = html.match(/assets\/index-[^"]+\.js/);
  if (!match) throw new Error('Cannot find frontend bundle URL');

  // Step 2: Fetch the JS bundle and extract MODELS array
  const bundleUrl = `${PLATFORM_URL}/${match[0]}`;
  const jsRes = await fetch(bundleUrl, { timeout: 15000 });
  const js = await jsRes.text();

  const modelsMatch = js.match(/MODELS\s*=\s*\[(.*?)\]/);
  if (!modelsMatch) throw new Error('Cannot find MODELS in bundle');

  // Step 3: Parse the minified JS object array
  const raw = modelsMatch[1];
  const models = [];
  const itemRegex = /\{name:"([^"]+)",model:"([^"]+)",description:"([^"]+)",freeAllowed:(!0|!1|true|false)\}/g;
  let m;
  while ((m = itemRegex.exec(raw)) !== null) {
    models.push({
      id: toGatewayId(m[2]),
      name: m[1],
      emoji: getEmoji(m[1]),
      desc: getDesc(m[3])
    });
  }

  if (models.length === 0) throw new Error('Parsed 0 models from bundle');
  return models;
}

// Load cached models from disk
async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Save models to disk cache
async function saveCache(models) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(models, null, 2));
}

// ── Public API ──────────────────────────────────────────────

let cachedModels = null;
let lastSync = 0;

export async function syncModels() {
  try {
    const models = await fetchModelsFromPlatform();
    cachedModels = models;
    lastSync = Date.now();
    await saveCache(models);
    console.log(`✅ 模型同步成功: ${models.map(m => m.name).join(', ')}`);
    return models;
  } catch (err) {
    console.error(`⚠️ 模型同步失败: ${err.message}`);
    // Try disk cache
    if (!cachedModels) {
      const diskCache = await loadCache();
      if (diskCache) {
        cachedModels = diskCache;
        console.log('📁 使用磁盘缓存模型');
      }
    }
    return cachedModels;
  }
}

export function getAvailableModels() {
  // Trigger background sync if stale
  if (Date.now() - lastSync > SYNC_INTERVAL) {
    syncModels().catch(() => {});
  }
  return cachedModels;
}

export function getDefaultModelId() {
  if (cachedModels && cachedModels.length > 0) {
    // Default to Sonnet 4.6 if available, otherwise first model
    const sonnet = cachedModels.find(m => m.name.includes('Sonnet 4.6'));
    return sonnet ? sonnet.id : cachedModels[0].id;
  }
  return 'anthropic/claude-sonnet-4.6';
}
