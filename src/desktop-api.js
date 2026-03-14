import fetch from 'node-fetch';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { PLATFORM_API_BASE, WORKSPACE_BASE } from './config.js';

const API_BASE = PLATFORM_API_BASE;

// ── Local title store (persistent on JuiceFS) ────────────────
// The cloud stores desktop titles in its DB (inaccessible to bot).
// We keep a local mapping so bot users can read/set titles.
const TITLES_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'desktop-titles.json');

let _titleCache = null;

function loadTitles() {
  if (_titleCache) return _titleCache;
  try {
    _titleCache = JSON.parse(fsSync.readFileSync(TITLES_FILE, 'utf-8'));
  } catch {
    _titleCache = {};
  }
  return _titleCache;
}

function saveTitles(titles) {
  _titleCache = titles;
  try {
    fsSync.writeFileSync(TITLES_FILE, JSON.stringify(titles, null, 2));
  } catch (err) {
    console.error('Failed to save desktop titles:', err.message);
  }
}

function getLocalTitle(desktopId) {
  return loadTitles()[desktopId] || null;
}

function setLocalTitle(desktopId, title) {
  const titles = loadTitles();
  titles[desktopId] = title;
  saveTitles(titles);
}

// ── Desktop listing ──────────────────────────────────────────

/**
 * List all desktops (web-created + locally-created).
 */
export async function listDesktops() {
  const [apiSessions, diskDirs] = await Promise.all([
    fetchApiSessions(),
    scanWorkspaceDirs()
  ]);

  const apiIds = new Set(apiSessions.map(s => s.id));
  const desktops = [];

  // 1. Cloud workspaces (UUID format) not in local API
  for (const dirName of diskDirs) {
    if (isUUID(dirName) && !apiIds.has(dirName)) {
      desktops.push({
        id: dirName,
        title: getLocalTitle(dirName) || await inferTitle(dirName),
        createdAt: null,
        updatedAt: null,
        source: 'cloud',
      });
    }
  }

  // 2. API-registered sessions
  for (const s of apiSessions) {
    const localTitle = getLocalTitle(s.id);
    desktops.push({
      id: s.id,
      title: localTitle || s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      source: isUUID(s.id) ? 'cloud' : 'api',
    });
  }

  // 3. Orphaned disk dirs with content
  for (const dirName of diskDirs) {
    if (!apiIds.has(dirName) && !isUUID(dirName)) {
      if (await workspaceHasContent(dirName)) {
        desktops.push({
          id: dirName,
          title: getLocalTitle(dirName) || `Local ${dirName.substring(0, 12)}`,
          createdAt: null,
          updatedAt: null,
          source: 'local',
        });
      }
    }
  }

  return desktops;
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);
}

/**
 * Infer a title from workspace contents.
 */
async function inferTitle(dirName) {
  const wsPath = path.join(WORKSPACE_BASE, dirName, 'workspace');
  try {
    const entries = await fs.readdir(wsPath);
    const userFiles = entries.filter(e =>
      !['claude.md', 'outputs', 'uploads', '.claude', 'tmp', '.git'].includes(e)
        && !e.startsWith('.')
    );
    if (userFiles.length > 0) {
      const hint = userFiles.slice(0, 3).join(', ');
      return `Desktop ${dirName.substring(0, 8)} (${hint})`;
    }
  } catch {}
  return `Desktop ${dirName.substring(0, 8)}`;
}

async function workspaceHasContent(dirName) {
  const wsPath = path.join(WORKSPACE_BASE, dirName, 'workspace');
  try {
    const entries = await fs.readdir(wsPath);
    return entries.some(e =>
      !['claude.md', 'outputs', 'uploads', '.claude', 'tmp'].includes(e)
    );
  } catch {
    return false;
  }
}

async function fetchApiSessions() {
  try {
    const res = await fetch(API_BASE);
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    console.error('Failed to fetch API sessions:', err.message);
    return [];
  }
}

async function scanWorkspaceDirs() {
  try {
    const entries = await fs.readdir(WORKSPACE_BASE, { withFileTypes: true });
    const dirs = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const wsPath = path.join(WORKSPACE_BASE, entry.name, 'workspace');
        try { await fs.access(wsPath); dirs.push(entry.name); } catch {}
      }
    }
    return dirs;
  } catch (err) {
    console.error('Failed to scan workspace dirs:', err.message);
    return [];
  }
}

// ── CRUD operations ──────────────────────────────────────────

export async function createDesktop(title) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  const data = await res.json();
  if (data.session) {
    setLocalTitle(data.session.id, title);
  }
  return data.session;
}

export async function deleteDesktop(sessionId) {
  const res = await fetch(`${API_BASE}/${sessionId}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    const titles = loadTitles();
    delete titles[sessionId];
    saveTitles(titles);
  }
  return data.success === true;
}

/**
 * Rename a desktop. Updates local title store + platform API if applicable.
 */
export async function renameDesktop(sessionId, title) {
  // Always save locally (works for all desktop types)
  setLocalTitle(sessionId, title);

  // Also try platform API (works for API-registered sessions)
  try {
    await fetch(`${API_BASE}/${sessionId}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
  } catch {}

  return true;
}
