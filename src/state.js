import crypto from 'crypto';
import { getSystemPrompt, tools, getModels } from './tools.js';
import { WORKSPACE_BASE } from './config.js';
import { detectLang, t } from './i18n.js';
import { loadUserState, debouncedSave } from './state-store.js';

// ── Global state ────────────────────────────────────────────
const userStates = new Map();

export function getUserState(userId) {
  return userStates.get(userId);
}

export function initUserState(userId, languageCode) {
  if (!userStates.has(userId)) {
    const saved = loadUserState(userId);
    const state = new UserState(userId, languageCode, saved);
    userStates.set(userId, state);
  }
  return userStates.get(userId);
}

// ── Session ─────────────────────────────────────────────────
export class Session {
  constructor(name = null, workspaceRoot, desktopName) {
    this.id = crypto.randomUUID();
    this.name = name || `Session ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    this.created = Date.now();
    this.lastActive = Date.now();
    const models = getModels();
    const defaultModel = models.find(m => m.name.includes('Sonnet 4.6'));
    this.model = defaultModel ? defaultModel.id : models[0]?.id || 'anthropic/claude-sonnet-4.6';
    this.activeSkills = new Set();
    this.agentTeams = false;
    this.messageHistory = [];
    this.usage = { apiCalls: 0, toolExecutions: {}, tokensUsed: 0 };
    // Desktop context for system prompt
    this._workspaceRoot = workspaceRoot || WORKSPACE_BASE;
    this._desktopName = desktopName || 'default';
    this._rebuildSystemPrompt();
  }

  /**
   * Restore a session from saved data (disk).
   */
  static fromSaved(data, workspaceRoot, desktopName) {
    const session = new Session(data.name, workspaceRoot, desktopName);
    session.id = data.id;
    session.created = data.created || Date.now();
    session.lastActive = data.lastActive || Date.now();
    session.model = data.model || session.model;
    session.activeSkills = new Set(data.activeSkills || []);
    session.agentTeams = data.agentTeams || false;
    // Rebuild system prompt first, then append saved history
    session._rebuildSystemPrompt();
    if (data.messageHistory && data.messageHistory.length > 0) {
      session.messageHistory.push(...data.messageHistory);
    }
    return session;
  }

  _rebuildSystemPrompt() {
    const prompt = getSystemPrompt(this.activeSkills, this._workspaceRoot, this._desktopName, this.agentTeams);
    if (this.messageHistory.length === 0) {
      this.messageHistory.push({ role: 'system', content: prompt });
    } else {
      this.messageHistory[0] = { role: 'system', content: prompt };
    }
  }

  updateDesktopContext(workspaceRoot, desktopName) {
    this._workspaceRoot = workspaceRoot;
    this._desktopName = desktopName;
    this._rebuildSystemPrompt();
  }

  setModel(modelId) {
    this.model = modelId;
  }

  setAgentTeams(enabled) {
    this.agentTeams = enabled;
    this._rebuildSystemPrompt();
  }

  toggleSkill(skillId) {
    if (this.activeSkills.has(skillId)) {
      this.activeSkills.delete(skillId);
    } else {
      this.activeSkills.add(skillId);
    }
    this._rebuildSystemPrompt();
  }

  addMessage(message) {
    this.messageHistory.push(message);
    this.lastActive = Date.now();
  }

  clearHistory() {
    this.messageHistory = [];
    this._rebuildSystemPrompt();
  }

  trackUsage(apiCall = false, toolName = null, tokens = 0) {
    if (apiCall) this.usage.apiCalls++;
    if (toolName) {
      this.usage.toolExecutions[toolName] = (this.usage.toolExecutions[toolName] || 0) + 1;
    }
    if (tokens) this.usage.tokensUsed += tokens;
  }

  trimHistory() {
    const maxMessages = 31;
    if (this.messageHistory.length > maxMessages) {
      const systemMsg = this.messageHistory[0];
      const recent = this.messageHistory.slice(-(maxMessages - 1));
      this.messageHistory = [systemMsg, ...recent];
    }
  }
}

// ── ProcessingContext ────────────────────────────────────────
export class ProcessingContext {
  constructor() {
    this.abortController = new AbortController();
    this.pendingMessages = [];
    this.isProcessing = true;
    this.startTime = Date.now();
  }

  abort() {
    this.abortController.abort();
    this.isProcessing = false;
  }

  get signal() {
    return this.abortController.signal;
  }

  addPendingMessage(text) {
    this.pendingMessages.push(text);
  }

  hasPending() {
    return this.pendingMessages.length > 0;
  }

  consumePending() {
    const msgs = [...this.pendingMessages];
    this.pendingMessages = [];
    return msgs;
  }
}

// ── UserState ───────────────────────────────────────────────
export class UserState {
  constructor(userId, languageCode, saved = null) {
    this.userId = userId;
    this.sessions = new Map();
    this.currentSessionId = null;
    this.processingContext = null;
    this.activeDesktop = null;

    if (saved) {
      // ── Restore from disk ──
      this.lang = saved.lang || detectLang(languageCode);
      this.activeDesktop = saved.activeDesktop || null;

      // Restore sessions
      if (saved.sessions && saved.sessions.length > 0) {
        for (const sData of saved.sessions) {
          const session = Session.fromSaved(sData, this.workspaceRoot, this.desktopName);
          this.sessions.set(session.id, session);
        }
        this.currentSessionId = saved.currentSessionId;
        // Validate currentSessionId exists
        if (!this.sessions.has(this.currentSessionId)) {
          this.currentSessionId = this.sessions.keys().next().value;
        }
      } else {
        this.createSession(t(this.lang, 'default_session_name'));
      }

      console.log(`📂 Restored state for user ${userId}: ${this.sessions.size} sessions, lang=${this.lang}`);
    } else {
      // ── Fresh state ──
      this.lang = detectLang(languageCode);
      this.createSession(t(this.lang, 'default_session_name'));
    }
  }

  _save() {
    debouncedSave(this.userId, this);
  }

  setLang(lang) {
    this.lang = lang;
    this._save();
  }

  get isProcessing() {
    return this.processingContext?.isProcessing === true;
  }

  get workspaceRoot() {
    return this.activeDesktop?.workspaceRoot || WORKSPACE_BASE;
  }

  get desktopName() {
    return this.activeDesktop?.title || 'default';
  }

  setDesktop(desktopId, title) {
    if (!desktopId) {
      this.activeDesktop = null;
    } else {
      const workspaceRoot = `${WORKSPACE_BASE}/${desktopId}/workspace`;
      this.activeDesktop = { id: desktopId, title, workspaceRoot };
    }
    const session = this.getCurrentSession();
    if (session) {
      session.updateDesktopContext(this.workspaceRoot, this.desktopName);
    }
    this._save();
  }

  getCurrentSession() {
    return this.sessions.get(this.currentSessionId);
  }

  createSession(name = null) {
    const session = new Session(name, this.workspaceRoot, this.desktopName);
    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
    this._save();
    return session;
  }

  switchSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
      this._save();
      return true;
    }
    return false;
  }

  deleteSession(sessionId) {
    if (sessionId === this.currentSessionId) return false;
    const result = this.sessions.delete(sessionId);
    if (result) this._save();
    return result;
  }

  /**
   * Save after a conversation turn (message history changed).
   */
  saveAfterTurn() {
    this._save();
  }

  startProcessing() {
    const ctx = new ProcessingContext();
    this.processingContext = ctx;
    return ctx;
  }

  stopProcessing() {
    if (this.processingContext) {
      this.processingContext.abort();
      this.processingContext = null;
    }
  }

  finishProcessing() {
    if (this.processingContext) {
      this.processingContext.isProcessing = false;
      this.processingContext = null;
    }
  }
}
