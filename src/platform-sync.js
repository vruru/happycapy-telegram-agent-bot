import fetch from 'node-fetch';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { WORKSPACE_BASE } from './config.js';

// ── Cloud API config ────────────────────────────────────────
const WORKER_BASE = process.env.AGENT_WORKER_BASE_URL || 'https://happycapy.ai';
const WORKER_SECRET = process.env.AGENT_WORKER_SECRET || process.env.CAPY_SECRET || '';
const SANDBOX_ID = process.env.FLY_APP_NAME || '';
const CLOUD_URL = `${WORKER_BASE}/api/agent/claude/messages`;

// Session data directory (platform format)
const DATA_DIR = path.join('/home/node/data/sessions');

// ── Detect default workspace UUID ────────────────────────────
let _defaultWorkspaceId = null;

function getDefaultWorkspaceId() {
  if (_defaultWorkspaceId) return _defaultWorkspaceId;
  try {
    const entries = fs.readdirSync(WORKSPACE_BASE, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('sess_')) {
        // UUID-format directories are cloud-created workspaces
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(entry.name)) {
          _defaultWorkspaceId = entry.name;
          break;
        }
      }
    }
  } catch {}
  return _defaultWorkspaceId;
}

/**
 * Get the cloud session ID for a given desktop/workspace.
 * Cloud sessions use workspace UUIDs, not sess_... IDs.
 */
export function getCloudSessionId(activeDesktop) {
  if (activeDesktop?.id) {
    // Desktop IDs are already workspace UUIDs
    return activeDesktop.id;
  }
  return getDefaultWorkspaceId();
}

/**
 * Convert an OpenAI-format message to Claude SDK JSONL format.
 */
function toSdkMessage(msg, sessionId) {
  const uuid = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const base = {
    parentUuid: null,
    isSidechain: false,
    userType: 'external',
    cwd: `${WORKSPACE_BASE}/${sessionId || 'default'}/workspace`,
    sessionId: uuid,
    version: '2.1.62',
    uuid,
    timestamp,
    permissionMode: 'bypassPermissions',
  };

  if (msg.role === 'user') {
    return {
      ...base,
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
      },
    };
  }

  if (msg.role === 'assistant') {
    const content = [];
    if (msg.content) {
      content.push({ type: 'text', text: msg.content });
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        });
      }
    }
    return {
      ...base,
      type: 'assistant',
      message: {
        id: crypto.randomUUID(),
        model: 'claude-sonnet-4.6',
        role: 'assistant',
        stop_reason: msg.tool_calls ? 'tool_use' : 'end_turn',
        type: 'message',
        content,
      },
    };
  }

  if (msg.role === 'tool') {
    return {
      ...base,
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        }],
      },
    };
  }

  return null;
}

/**
 * Post a single SDK message to the cloud.
 */
async function postToCloud(cloudSessionId, sdkMessage) {
  if (!WORKER_SECRET || !SANDBOX_ID || !cloudSessionId) return false;

  try {
    const res = await fetch(CLOUD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_SECRET}`,
        'X-Sandbox-Id': SANDBOX_ID,
      },
      body: JSON.stringify({
        sessionId: cloudSessionId,
        sdkMessage,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[PlatformSync] Cloud post failed: ${res.status} ${text.substring(0, 100)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[PlatformSync] Cloud post error:', err.message);
    return false;
  }
}

/**
 * Sync new messages from the agent loop to the cloud.
 * Only syncs user messages and final assistant text responses (skips tool noise).
 * Call this after each agent loop completes.
 *
 * @param {Array} messages - New messages to sync (OpenAI format, excluding system prompt)
 * @param {object|null} activeDesktop - The user's active desktop
 */
export async function syncToCloud(messages, activeDesktop) {
  const cloudSessionId = getCloudSessionId(activeDesktop);
  if (!cloudSessionId) {
    console.log('[PlatformSync] No cloud session ID available, skipping sync');
    return;
  }

  // Filter: only sync user messages and final assistant text responses
  const toSync = messages.filter(msg => {
    if (msg.role === 'system') return false;
    if (msg.role === 'user') return true;
    // Only sync assistant messages with text content (not tool calls)
    if (msg.role === 'assistant' && msg.content && !msg.tool_calls) return true;
    return false;
  });

  let synced = 0;
  for (const msg of toSync) {
    const sdkMsg = toSdkMessage(msg, cloudSessionId);
    if (!sdkMsg) continue;

    const ok = await postToCloud(cloudSessionId, sdkMsg);
    if (ok) synced++;
  }

  if (synced > 0) {
    console.log(`[PlatformSync] Synced ${synced} messages to cloud session ${cloudSessionId.substring(0, 8)}...`);
  }
}

/**
 * Write events to local platform session storage.
 * This ensures sessions show up in the local REST API.
 */
export function writeLocalEvents(platformSessionId, events) {
  if (!platformSessionId) return;

  const sessionDir = path.join(DATA_DIR, platformSessionId);
  const sessionFile = path.join(sessionDir, 'session.json');

  try {
    let sessionData;
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    } catch {
      fs.mkdirSync(sessionDir, { recursive: true });
      sessionData = {
        id: platformSessionId,
        title: 'Telegram Bot',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        eventCount: 0,
        events: [],
      };
    }

    for (const event of events) {
      sessionData.events.push(event);
    }
    sessionData.eventCount = sessionData.events.length;
    sessionData.updatedAt = new Date().toISOString();

    fs.writeFileSync(sessionFile, JSON.stringify(sessionData));

    // Also update sessions.json index
    updateSessionsIndex(platformSessionId, sessionData);
  } catch (err) {
    console.error('[PlatformSync] Local write error:', err.message);
  }
}

function updateSessionsIndex(sessionId, sessionData) {
  const indexFile = path.join(DATA_DIR, 'sessions.json');
  try {
    let sessions = [];
    try {
      sessions = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    } catch {}

    const idx = sessions.findIndex(s => s.id === sessionId);
    const entry = {
      id: sessionId,
      title: sessionData.title,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      eventCount: sessionData.eventCount,
    };

    if (idx >= 0) {
      sessions[idx] = entry;
    } else {
      sessions.push(entry);
    }

    fs.writeFileSync(indexFile, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error('[PlatformSync] Index update error:', err.message);
  }
}

/**
 * Convert messages to platform event format and write locally.
 */
export function syncToLocal(messages, platformSessionId, sessionTitle) {
  if (!platformSessionId) return;

  const events = [];
  const now = new Date().toISOString();

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    const id = crypto.randomUUID();

    if (msg.role === 'user') {
      events.push({
        id,
        parent_id: null,
        type: 'message',
        data: { role: 'user', content: msg.content, images: [] },
        created_at: now,
        updated_at: now,
      });
    } else if (msg.role === 'assistant') {
      const content = msg.content || '';
      const tool_calls = msg.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: tc.function.arguments,
      })) || [];

      events.push({
        id,
        parent_id: null,
        type: 'message',
        data: { role: 'assistant', content, tool_calls },
        created_at: now,
        updated_at: now,
      });
    } else if (msg.role === 'tool') {
      events.push({
        id,
        parent_id: null,
        type: 'message',
        data: {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        },
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (events.length > 0) {
    writeLocalEvents(platformSessionId, events);
  }
}
