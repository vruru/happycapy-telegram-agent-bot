import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { tools } from './tools.js';
import { syncModels } from './model-sync.js';
import { executeTool } from './executor.js';
import { getUserState, initUserState } from './state.js';
import {
  handleStartCommand, handleHelpCommand, handleModelCommand,
  handleSkillsCommand, handleStopCommand, handleNewCommand,
  handleSessionsCommand, handleUsageCommand, handleSettingsCommand,
  handleVersionCommand, handleDesktopsCommand, handleLangCommand,
  handleAgentTeamsCommand, processPendingRename,
  routeCallback, BOT_VERSION, BOT_BUILD_DATE
} from './commands.js';
import {
  BOT_TOKEN, AI_GATEWAY_API_KEY, AI_GATEWAY_URL,
  AUTHORIZED_USERS, MAX_AGENT_TURNS, MAX_AUTO_CONTINUES, AI_TIMEOUT_MS,
  CANCEL_KEYWORDS, validateConfig
} from './config.js';
import { t } from './i18n.js';
import { recordApiCall, recordToolExec, recordMessage } from './usage-store.js';
import { syncToCloud } from './platform-sync.js';
import { listDesktops } from './desktop-api.js';

// ── Validate configuration ──────────────────────────────────
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.warn('⚠️ Configuration warnings:');
  configErrors.forEach(e => console.warn(`   - ${e}`));
}

const bot = new Telegraf(BOT_TOKEN);

// ── Auth middleware ──────────────────────────────────────────
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (AUTHORIZED_USERS.size > 0 && !AUTHORIZED_USERS.has(userId)) {
    return; // Silent drop
  }
  // Initialize user state with language detection
  initUserState(userId, ctx.from?.language_code);
  return next();
});

// ── Status message (editable real-time status) ──────────────
class StatusMessage {
  constructor(ctx) {
    this.ctx = ctx;
    this.messageId = null;
    this.chatId = ctx.chat.id;
    this.currentText = '';
    this.pendingText = null;
    this.lastEditTime = 0;
    this.throttleTimer = null;
    this.typingInterval = null;
    // Minimum interval between edits (ms) — Telegram allows ~30 edits/min
    this.MIN_EDIT_INTERVAL = 2000;
    // Start typing indicator
    ctx.sendChatAction('typing').catch(() => {});
    this.typingInterval = setInterval(() => {
      ctx.sendChatAction('typing').catch(() => {});
    }, 3000);
  }

  async update(text) {
    if (text === this.currentText) return;

    // First message: send immediately (no throttle)
    if (!this.messageId) {
      this.currentText = text;
      try {
        const msg = await this.ctx.reply(text);
        this.messageId = msg.message_id;
        this.lastEditTime = Date.now();
      } catch (err) {
        console.error('Status send error:', err.message);
      }
      return;
    }

    // Subsequent edits: throttle to MIN_EDIT_INTERVAL
    const elapsed = Date.now() - this.lastEditTime;
    if (elapsed >= this.MIN_EDIT_INTERVAL) {
      // Enough time passed, edit immediately
      await this._doEdit(text);
    } else {
      // Too soon — schedule a deferred edit
      this.pendingText = text;
      if (!this.throttleTimer) {
        this.throttleTimer = setTimeout(async () => {
          this.throttleTimer = null;
          if (this.pendingText && this.pendingText !== this.currentText) {
            await this._doEdit(this.pendingText);
            this.pendingText = null;
          }
        }, this.MIN_EDIT_INTERVAL - elapsed);
      }
    }
  }

  async _doEdit(text) {
    this.currentText = text;
    this.lastEditTime = Date.now();
    try {
      await this.ctx.telegram.editMessageText(
        this.chatId, this.messageId, null, text
      );
    } catch (err) {
      if (err.message?.includes('Too Many Requests')) {
        // Back off on 429
        const retryAfter = parseInt(err.parameters?.retry_after || '5', 10);
        this.MIN_EDIT_INTERVAL = Math.min(this.MIN_EDIT_INTERVAL + 1000, 10000);
        console.warn(`Status edit 429 — backing off to ${this.MIN_EDIT_INTERVAL}ms`);
      } else if (!err.message?.includes('message is not modified')) {
        console.error('Status edit error:', err.message);
      }
    }
  }

  async remove() {
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    if (this.messageId) {
      try {
        await this.ctx.telegram.deleteMessage(this.chatId, this.messageId);
      } catch {}
      this.messageId = null;
    }
  }

  stop() {
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
  }
}

// ── Send long messages ──────────────────────────────────────
async function sendLongMessage(ctx, text) {
  if (!text || text.trim().length === 0) return;
  const MAX = 4000;
  if (text.length <= MAX) {
    await ctx.reply(text);
    return;
  }
  const lines = text.split('\n');
  let chunk = '';
  for (const line of lines) {
    if ((chunk + '\n' + line).length > MAX) {
      if (chunk.length > 0) await ctx.reply(chunk);
      if (line.length > MAX) {
        for (let i = 0; i < line.length; i += MAX) await ctx.reply(line.substring(i, i + MAX));
        chunk = '';
      } else {
        chunk = line;
      }
    } else {
      chunk = chunk.length > 0 ? chunk + '\n' + line : line;
    }
  }
  if (chunk.length > 0) await ctx.reply(chunk);
}

// ── Call AI Gateway ─────────────────────────────────────────
async function callAI(messages, model, toolDefs, abortSignal) {
  const openaiTools = toolDefs.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema }
  }));

  const body = { model, messages, tools: openaiTools, max_tokens: 4096 };

  console.log(`📡 AI Gateway (model: ${model}, msgs: ${messages.length})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  // Listen for external abort
  const onAbort = () => controller.abort();
  abortSignal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ AI Gateway ${response.status}: ${errText.substring(0, 300)}`);
      throw new Error(`AI Gateway ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ AI: finish=${data.choices?.[0]?.finish_reason}, tools=${data.choices?.[0]?.message?.tool_calls?.length || 0}`);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('INTERRUPTED');
    throw err;
  } finally {
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

// ── Agent loop ──────────────────────────────────────────────
async function agentLoop(ctx, userId, userMessage, status) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  const procCtx = state.startProcessing();

  // Track message start index for platform sync
  const syncStartIndex = session.messageHistory.length;

  session.addMessage({ role: 'user', content: userMessage });
  recordMessage();

  // Total turn budget = MAX_AGENT_TURNS * (1 + MAX_AUTO_CONTINUES)
  // e.g. 50 * 4 = 200 total turns max
  let totalTurns = 0;
  const totalBudget = MAX_AGENT_TURNS * (1 + MAX_AUTO_CONTINUES);

  try {
    while (totalTurns < totalBudget) {
      if (procCtx.signal.aborted) throw new Error('INTERRUPTED');

      totalTurns++;
      console.log(`🔄 Turn ${totalTurns}/${totalBudget} for ${userId}`);

      await status.update(t(L, 'status_thinking'));

      const data = await callAI(session.messageHistory, session.model, tools, procCtx.signal);
      const tokens = data.usage?.total_tokens || 0;
      session.trackUsage(true, null, tokens);
      recordApiCall(session.model, tokens);

      const message = data.choices[0].message;
      session.addMessage(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (procCtx.signal.aborted) throw new Error('INTERRUPTED');

          const toolName = toolCall.function.name;
          let toolInput;
          try { toolInput = JSON.parse(toolCall.function.arguments); }
          catch { toolInput = {}; }

          console.log(`🔧 ${toolName}`, JSON.stringify(toolInput).substring(0, 150));
          session.trackUsage(false, toolName);
          recordToolExec(toolName);

          // Update status with specific tool info
          let statusText = t(L, `tool_${toolName}`) || `🔧 ${toolName}...`;
          if (toolName === 'bash' && toolInput.command) {
            const cmd = toolInput.command.substring(0, 40);
            statusText = t(L, 'status_exec', { cmd: cmd + (toolInput.command.length > 40 ? '...' : '') });
          } else if (toolName === 'read_file' && toolInput.path) {
            statusText = t(L, 'status_read', { file: toolInput.path.split('/').pop() });
          } else if (toolName === 'write_file' && toolInput.path) {
            statusText = t(L, 'status_write', { file: toolInput.path.split('/').pop() });
          } else if (toolName === 'edit_file' && toolInput.path) {
            statusText = t(L, 'status_edit', { file: toolInput.path.split('/').pop() });
          } else if (toolName === 'web_search' && toolInput.query) {
            statusText = t(L, 'status_search', { query: toolInput.query.substring(0, 30) });
          }
          await status.update(statusText);

          let resultContent;
          try {
            if (toolName === 'message_user') {
              await ctx.reply(toolInput.text || '');
              resultContent = 'Message sent to user.';
            } else {
              const result = await executeTool(toolName, toolInput, state.workspaceRoot);
              resultContent = result.success
                ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
                : `Error: ${result.error}`;
            }
          } catch (err) {
            resultContent = `Error: ${err.message}`;
          }

          if (resultContent.length > 15000) {
            resultContent = resultContent.substring(0, 15000) + '\n... (truncated)';
          }

          session.addMessage({ role: 'tool', tool_call_id: toolCall.id, content: resultContent });
        }

        if (procCtx.hasPending()) {
          const pending = procCtx.consumePending();
          session.addMessage({ role: 'user', content: `[supplement] ${pending.join('\n')}` });
        }

        await status.update(t(L, 'status_analyzing'));

      } else {
        const finalText = message.content || '';

        if (procCtx.hasPending()) {
          const pending = procCtx.consumePending();
          session.addMessage({ role: 'user', content: `[supplement] ${pending.join('\n')}` });
          continue;
        }

        session.trimHistory();
        return finalText;
      }
    }

    session.trimHistory();
    return t(L, 'processing_max_turns');

  } finally {
    state.finishProcessing();
    state.saveAfterTurn();

    // Sync new messages to platform (cloud + local)
    const newMessages = session.messageHistory.slice(syncStartIndex);
    if (newMessages.length > 0) {
      // Fire-and-forget cloud sync
      syncToCloud(newMessages, state.activeDesktop).catch(err =>
        console.error('[Sync] Cloud sync error:', err.message)
      );
    }
  }
}

// ── Message intent classification ───────────────────────────
function isCancelIntent(text) {
  const lower = text.toLowerCase().trim();
  return CANCEL_KEYWORDS.some(kw => lower === kw || lower === `/${kw}`);
}

// ── Handle incoming text with interrupt support ─────────────
async function handleTextMessage(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const state = getUserState(userId);
  const L = state.lang;

  // Check for pending rename action (desktop rename text input)
  if (await processPendingRename(ctx, userId)) return;

  if (state.isProcessing) {
    if (isCancelIntent(text)) {
      state.stopProcessing();
      await ctx.reply(t(L, 'processing_cancelled'));
      return;
    }
    state.processingContext.addPendingMessage(text);
    await ctx.reply(t(L, 'processing_supplement'));
    return;
  }

  const status = new StatusMessage(ctx);
  try {
    const response = await agentLoop(ctx, userId, text, status);
    await status.remove();
    await sendLongMessage(ctx, response);
  } catch (error) {
    await status.remove();
    if (error.message === 'INTERRUPTED') return;
    console.error('Agent error:', error);
    await ctx.reply(t(L, 'processing_error', { error: error.message }));
  } finally {
    status.stop();
  }
}

// ── Handle document uploads ─────────────────────────────────
async function handleDocument(ctx) {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const L = state.lang;

  if (state.isProcessing) {
    await ctx.reply(t(L, 'processing_busy'));
    return;
  }

  const status = new StatusMessage(ctx);
  try {
    await status.update(t(L, 'status_receiving_file'));

    const file = ctx.message.document;
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const fileName = file.file_name || 'uploaded_file';
    const savePath = path.join(state.workspaceRoot, 'uploads', fileName);

    const response = await fetch(fileLink.href);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.join(state.workspaceRoot, 'uploads'), { recursive: true });
    await fs.writeFile(savePath, buffer);

    const caption = ctx.message.caption || '';
    const msg = `User uploaded file: ${fileName} (saved to ${savePath})\n${caption ? `User note: ${caption}` : 'Please analyze this file.'}`;

    const aiResponse = await agentLoop(ctx, userId, msg, status);
    await status.remove();
    await sendLongMessage(ctx, aiResponse);
  } catch (error) {
    await status.remove();
    if (error.message === 'INTERRUPTED') return;
    console.error('File error:', error);
    await ctx.reply(t(L, 'processing_file_error', { error: error.message }));
  } finally {
    status.stop();
  }
}

// ── Handle photo uploads ────────────────────────────────────
async function handlePhoto(ctx) {
  const userId = ctx.from.id;
  const state = getUserState(userId);
  const L = state.lang;

  if (state.isProcessing) {
    await ctx.reply(t(L, 'processing_busy'));
    return;
  }

  const status = new StatusMessage(ctx);
  try {
    await status.update(t(L, 'status_receiving_photo'));

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    const fileName = `photo_${Date.now()}.jpg`;
    const savePath = path.join(state.workspaceRoot, 'uploads', fileName);

    const response = await fetch(fileLink.href);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.join(state.workspaceRoot, 'uploads'), { recursive: true });
    await fs.writeFile(savePath, buffer);

    const caption = ctx.message.caption || '';
    const msg = `User uploaded a photo (saved to ${savePath})\n${caption ? `User note: ${caption}` : 'Please analyze this image.'}`;

    const aiResponse = await agentLoop(ctx, userId, msg, status);
    await status.remove();
    await sendLongMessage(ctx, aiResponse);
  } catch (error) {
    await status.remove();
    if (error.message === 'INTERRUPTED') return;
    console.error('Photo error:', error);
    await ctx.reply(t(L, 'processing_photo_error', { error: error.message }));
  } finally {
    status.stop();
  }
}

// ── Register commands ───────────────────────────────────────
bot.command('start', (ctx) => handleStartCommand(ctx, ctx.from.id));
bot.command('help', (ctx) => handleHelpCommand(ctx));
bot.command('model', (ctx) => handleModelCommand(ctx, ctx.from.id));
bot.command('skills', (ctx) => handleSkillsCommand(ctx, ctx.from.id));
bot.command('stop', (ctx) => handleStopCommand(ctx, ctx.from.id));
bot.command('new', (ctx) => handleNewCommand(ctx, ctx.from.id));
bot.command('sessions', (ctx) => handleSessionsCommand(ctx, ctx.from.id));
bot.command('usage', (ctx) => handleUsageCommand(ctx, ctx.from.id));
bot.command('settings', (ctx) => handleSettingsCommand(ctx, ctx.from.id));
bot.command('desktops', (ctx) => handleDesktopsCommand(ctx, ctx.from.id));
bot.command('version', (ctx) => handleVersionCommand(ctx));
bot.command('lang', (ctx) => handleLangCommand(ctx, ctx.from.id));
bot.command('agentteams', (ctx) => handleAgentTeamsCommand(ctx, ctx.from.id));
bot.command('restart', async (ctx) => {
  const state = getUserState(ctx.from.id);
  await ctx.reply(t(state.lang, 'restart_msg'));
  console.log('🔄 Restart requested by user');
  // Stop polling gracefully, then exit with code 42 (restart signal)
  bot.stop('RESTART');
  setTimeout(() => process.exit(42), 1000);
});
bot.command('clear', (ctx) => {
  const state = getUserState(ctx.from.id);
  state.getCurrentSession().clearHistory();
  state.saveAfterTurn();
  ctx.reply(t(state.lang, 'clear_done'));
});

// ── Callback query handler ──────────────────────────────────
bot.on('callback_query', (ctx) => {
  const userId = ctx.from.id;
  return routeCallback(ctx, userId);
});

// ── Message handlers ────────────────────────────────────────
bot.on('text', handleTextMessage);
bot.on('document', handleDocument);
bot.on('photo', handlePhoto);

// ── Error handling ──────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`Bot error (${ctx.updateType}):`, err);
});

// ── Startup notification ─────────────────────────────────────
async function notifyStartup() {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const toolCount = tools.length;

  for (const userId of AUTHORIZED_USERS) {
    try {
      // Use user's saved language if available, otherwise default to 'zh'
      const state = getUserState(userId);
      const L = state?.lang || 'zh';
      const msg =
        `${t(L, 'startup_title')}\n\n` +
        t(L, 'startup_body', { version: BOT_VERSION, time: now, toolCount });
      await bot.telegram.sendMessage(userId, msg);
    } catch (err) {
      // User may not have started the bot yet, or chat doesn't exist
      console.log(`Startup notify to ${userId} failed: ${err.message}`);
    }
  }
}

// ── Launch ──────────────────────────────────────────────────
async function start(retries = 3) {
  console.log('🤖 Starting HappyCapy Agent Bot...');
  try {
    // Sync models from platform
    await syncModels();

    // Delete webhook first, then start polling separately
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Webhook cleared');

    // Register command menu for Telegram autocomplete
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Reset / 重新开始' },
      { command: 'help', description: 'Help / 帮助' },
      { command: 'model', description: 'Switch AI model / 切换模型' },
      { command: 'skills', description: 'Manage skills / 技能管理' },
      { command: 'new', description: 'New session / 新建会话' },
      { command: 'sessions', description: 'Switch session / 切换会话' },
      { command: 'desktops', description: 'Manage desktops / 桌面管理' },
      { command: 'settings', description: 'Settings / 设置' },
      { command: 'stop', description: 'Stop task / 停止任务' },
      { command: 'clear', description: 'Clear history / 清除历史' },
      { command: 'usage', description: 'Usage stats / 使用统计' },
      { command: 'agentteams', description: 'Agent Teams toggle / 团队模式' },
      { command: 'lang', description: 'Switch language / 切换语言' },
      { command: 'version', description: 'Version / 版本' },
      { command: 'restart', description: 'Restart bot / 重启' },
    ]);

    // Auto-assign cloud desktop for users without one
    try {
      const desktops = await listDesktops();
      const cloudDesktop = desktops.find(d => d.source === 'cloud');
      if (cloudDesktop) {
        for (const userId of AUTHORIZED_USERS) {
          // Ensure user state is initialized
          initUserState(userId, 'zh');
          const state = getUserState(userId);
          if (state && !state.activeDesktop) {
            state.setDesktop(cloudDesktop.id, cloudDesktop.title);
            console.log(`📎 Auto-assigned desktop "${cloudDesktop.title}" to user ${userId}`);
          }
        }
      }
    } catch (err) {
      console.log('Desktop auto-assign skipped:', err.message);
    }

    // Start polling (non-blocking)
    bot.startPolling();
    console.log('✅ Agent Bot is running!');
    console.log('🔧 Tools:', tools.map(t => t.name).join(', '));

    // Keep-alive heartbeat: light CPU activity every 2 minutes to prevent
    // sandbox from being reclaimed due to idle CPU detection
    setInterval(() => {
      const t = Date.now();
      for (let i = 0; i < 1000; i++) Math.sqrt(t + i);
    }, 120_000);

    // Notify authorized users that the bot is online
    await notifyStartup();
  } catch (err) {
    // Handle 409 conflict (previous polling session still active)
    if (err.response?.error_code === 409 || err.message?.includes('409')) {
      if (retries > 0) {
        console.log(`⚠️ Polling conflict, retrying in 5s... (${retries} retries left)`);
        await new Promise(r => setTimeout(r, 5000));
        return start(retries - 1);
      }
    }
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

// Catch unhandled polling errors (409 conflict during runtime)
// Exit code 43 = polling conflict (distinct from 42 = user restart)
process.on('uncaughtException', (err) => {
  if (err.response?.error_code === 409) {
    console.log('⚠️ Polling conflict detected — another instance may be running.');
    bot.stop('CONFLICT');
    setTimeout(() => process.exit(43), 2000);
    return;
  }
  console.error('Uncaught exception:', err);
  process.exit(1);
});

start();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
