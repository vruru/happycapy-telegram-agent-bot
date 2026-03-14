import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'user-data');

// Ensure data directory exists
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function filePath(userId) {
  return path.join(DATA_DIR, `${userId}.json`);
}

/**
 * Save user state to disk.
 * Extracts only serializable, important data.
 */
export function saveUserState(userId, userState) {
  const sessions = [];
  for (const [id, s] of userState.sessions) {
    // Save message history excluding the system prompt (index 0, rebuilt on load)
    const history = s.messageHistory.slice(1);
    sessions.push({
      id: s.id,
      name: s.name,
      created: s.created,
      lastActive: s.lastActive,
      model: s.model,
      activeSkills: Array.from(s.activeSkills),
      agentTeams: s.agentTeams,
      messageHistory: history,
    });
  }

  const data = {
    lang: userState.lang,
    activeDesktop: userState.activeDesktop,
    currentSessionId: userState.currentSessionId,
    sessions,
    savedAt: Date.now(),
  };

  try {
    fs.writeFileSync(filePath(userId), JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save state for ${userId}:`, err.message);
  }
}

/**
 * Load user state from disk.
 * Returns null if no saved state exists.
 */
export function loadUserState(userId) {
  try {
    const raw = fs.readFileSync(filePath(userId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Debounced save ─────────────────────────────────────────
const saveTimers = new Map();

/**
 * Schedule a debounced save (300ms).
 * Prevents excessive disk writes during rapid changes.
 */
export function debouncedSave(userId, userState) {
  if (saveTimers.has(userId)) clearTimeout(saveTimers.get(userId));
  saveTimers.set(userId, setTimeout(() => {
    saveTimers.delete(userId);
    saveUserState(userId, userState);
  }, 300));
}
