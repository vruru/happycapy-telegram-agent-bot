import { Markup } from 'telegraf';
import { getUserState } from './state.js';
import { getModels } from './tools.js';
import { AVAILABLE_SKILLS } from './skills-registry.js';
import { listDesktops, createDesktop, deleteDesktop, renameDesktop } from './desktop-api.js';
import { t } from './i18n.js';
import { getUsageStats } from './usage-store.js';

// ── /model ──────────────────────────────────────────────────
function buildModelButtons(currentModelId) {
  return getModels().map(m => {
    const check = m.id === currentModelId ? '✅ ' : '';
    const desc = m.desc ? ` - ${m.desc}` : '';
    return [Markup.button.callback(`${check}${m.emoji} ${m.name}${desc}`, `model:${m.id}`)];
  });
}

export function handleModelCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  return ctx.reply(t(L, 'model_select'), Markup.inlineKeyboard(buildModelButtons(session.model)));
}

export async function handleModelCallback(ctx, userId, modelId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  session.setModel(modelId);
  state._save();

  const model = getModels().find(m => m.id === modelId);
  await ctx.answerCbQuery(t(L, 'model_switched', { name: model?.name || modelId }));
  await ctx.editMessageText(t(L, 'model_select'), Markup.inlineKeyboard(buildModelButtons(modelId)));
}

// ── /skills ─────────────────────────────────────────────────
export function handleSkillsCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();

  const buttons = AVAILABLE_SKILLS.map(s => {
    const active = session.activeSkills.has(s.id);
    const label = `${active ? '✅' : '⬜'} ${s.emoji} ${s.name}`;
    return [Markup.button.callback(label, `skill:toggle:${s.id}`)];
  });
  buttons.push([Markup.button.callback(t(L, 'btn_done'), 'skill:done')]);

  return ctx.reply(t(L, 'skills_title'), Markup.inlineKeyboard(buttons));
}

export async function handleSkillToggleCallback(ctx, userId, skillId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  session.toggleSkill(skillId);
  state._save();

  const skill = AVAILABLE_SKILLS.find(s => s.id === skillId);
  const nowActive = session.activeSkills.has(skillId);
  const msg = nowActive
    ? t(L, 'skill_activated', { name: skill?.name || skillId })
    : t(L, 'skill_deactivated', { name: skill?.name || skillId });
  await ctx.answerCbQuery(msg);

  // Rebuild keyboard
  const buttons = AVAILABLE_SKILLS.map(s => {
    const active = session.activeSkills.has(s.id);
    const label = `${active ? '✅' : '⬜'} ${s.emoji} ${s.name}`;
    return [Markup.button.callback(label, `skill:toggle:${s.id}`)];
  });
  buttons.push([Markup.button.callback(t(L, 'btn_done'), 'skill:done')]);

  await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
}

export async function handleSkillDoneCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  const activeList = Array.from(session.activeSkills)
    .map(id => AVAILABLE_SKILLS.find(s => s.id === id))
    .filter(Boolean)
    .map(s => `${s.emoji} ${s.name}`)
    .join(', ');

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    activeList ? t(L, 'skills_done_active', { list: activeList }) : t(L, 'skills_done_none')
  );
}

// ── /stop ───────────────────────────────────────────────────
export function handleStopCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  if (!state.isProcessing) {
    return ctx.reply(t(L, 'stop_nothing'));
  }
  state.stopProcessing();
  return ctx.reply(t(L, 'stop_done'));
}

// ── /new ────────────────────────────────────────────────────
export function handleNewCommand(ctx, userId) {
  const name = ctx.message.text.replace(/^\/new\s*/, '').trim() || null;
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.createSession(name);
  return ctx.reply(t(L, 'new_session_created', { name: session.name }));
}

// ── /sessions ───────────────────────────────────────────────
export function handleSessionsCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const sessions = Array.from(state.sessions.values())
    .sort((a, b) => b.lastActive - a.lastActive);

  if (sessions.length === 0) {
    return ctx.reply(t(L, 'sessions_empty'));
  }

  const buttons = sessions.map(s => {
    const check = s.id === state.currentSessionId ? '✅ ' : '';
    const msgs = s.messageHistory.length - 1; // Exclude system message
    const label = `${check}${s.name} (${t(L, 'sessions_msgs', { n: msgs })})`;
    return [Markup.button.callback(label, `session:switch:${s.id}`)];
  });
  buttons.push([
    Markup.button.callback(t(L, 'btn_new_session'), 'session:new'),
    Markup.button.callback(t(L, 'btn_delete'), 'session:delete_menu')
  ]);

  return ctx.reply(t(L, 'sessions_title'), Markup.inlineKeyboard(buttons));
}

export async function handleSessionSwitchCallback(ctx, userId, sessionId) {
  const state = getUserState(userId);
  const L = state.lang;
  if (state.switchSession(sessionId)) {
    const session = state.getCurrentSession();
    await ctx.answerCbQuery(t(L, 'session_switched', { name: session.name }));
    await ctx.editMessageText(t(L, 'session_switched', { name: session.name }));
  } else {
    await ctx.answerCbQuery(t(L, 'session_not_found'));
  }
}

export async function handleSessionNewCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.createSession();
  await ctx.answerCbQuery(t(L, 'session_created', { name: session.name }));
  await ctx.editMessageText(t(L, 'session_created', { name: session.name }));
}

export async function handleSessionDeleteMenuCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const sessions = Array.from(state.sessions.values())
    .filter(s => s.id !== state.currentSessionId); // Can't delete current

  if (sessions.length === 0) {
    await ctx.answerCbQuery(t(L, 'session_only_current'));
    return;
  }

  const buttons = sessions.map(s => {
    return [Markup.button.callback(`🗑️ ${s.name}`, `session:delete:${s.id}`)];
  });
  buttons.push([Markup.button.callback(t(L, 'btn_cancel'), 'session:cancel')]);

  await ctx.answerCbQuery();
  await ctx.editMessageText(t(L, 'sessions_delete_title'), Markup.inlineKeyboard(buttons));
}

export async function handleSessionDeleteCallback(ctx, userId, sessionId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.sessions.get(sessionId);
  const name = session?.name || t(L, 'unnamed');
  if (state.deleteSession(sessionId)) {
    await ctx.answerCbQuery(t(L, 'session_deleted', { name }));
    await ctx.editMessageText(t(L, 'session_deleted', { name }));
  } else {
    await ctx.answerCbQuery(t(L, 'session_delete_fail'));
  }
}

// ── /usage ──────────────────────────────────────────────────
export function handleUsageCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const stats = getUsageStats();

  // Format tokens
  const tokensStr = stats.totalTokens > 0
    ? formatNumber(stats.totalTokens)
    : 'N/A';

  // Total tool executions
  const totalTools = Object.values(stats.totalToolExecutions).reduce((a, b) => a + b, 0);

  // Top tools
  const topTools = Object.entries(stats.totalToolExecutions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tool, count]) => `  ${tool}: ${count}`)
    .join('\n') || t(L, 'usage_none');

  // Model breakdown
  const modelBreakdown = Object.entries(stats.byModel)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 5)
    .map(([model, data]) => {
      const name = model.split('/').pop();
      return `  ${name}: ${data.calls} ${L === 'zh' ? '次' : 'calls'}, ${formatNumber(data.tokens)} tokens`;
    })
    .join('\n') || t(L, 'usage_none');

  // Tracking period
  const since = new Date(stats.firstTracked).toLocaleDateString(
    L === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai' }
  );

  const text =
    `${t(L, 'usage_title')}\n\n` +
    `${t(L, 'usage_api_calls', { n: stats.totalApiCalls })}\n` +
    `${t(L, 'usage_tool_execs', { n: totalTools })}\n` +
    `${t(L, 'usage_messages', { n: stats.totalMessages })}\n` +
    `${t(L, 'usage_tokens', { n: tokensStr })}\n\n` +
    `${t(L, 'usage_by_model')}\n${modelBreakdown}\n\n` +
    `${t(L, 'usage_top_tools')}\n${topTools}\n\n` +
    `${t(L, 'usage_since', { date: since })}`;

  return ctx.reply(text);
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// ── /agentteams ────────────────────────────────────────────
export function handleAgentTeamsCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  const enabled = session.agentTeams;

  const buttons = [
    [Markup.button.callback(
      enabled ? t(L, 'agent_teams_on') : t(L, 'agent_teams_off'),
      'agentteams:toggle'
    )]
  ];

  const text = `${t(L, 'agent_teams_label')}\n\n${t(L, 'agent_teams_desc')}`;
  return ctx.reply(text, Markup.inlineKeyboard(buttons));
}

export async function handleAgentTeamsToggleCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const session = state.getCurrentSession();
  const newValue = !session.agentTeams;
  session.setAgentTeams(newValue);
  state._save();

  const msg = newValue ? t(L, 'agent_teams_enabled') : t(L, 'agent_teams_disabled');
  await ctx.answerCbQuery(msg);

  const buttons = [
    [Markup.button.callback(
      newValue ? t(L, 'agent_teams_on') : t(L, 'agent_teams_off'),
      'agentteams:toggle'
    )]
  ];

  await ctx.editMessageText(
    `${t(L, 'agent_teams_label')}\n\n${t(L, 'agent_teams_desc')}`,
    Markup.inlineKeyboard(buttons)
  );
}

// ── /settings ───────────────────────────────────────────────
export function handleSettingsCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const buttons = [
    [Markup.button.callback(t(L, 'settings_model'), 'settings:model')],
    [Markup.button.callback(t(L, 'settings_skills'), 'settings:skills')],
    [Markup.button.callback(t(L, 'settings_agent_teams'), 'settings:agent_teams')],
    [Markup.button.callback(t(L, 'settings_sessions'), 'settings:sessions')],
    [Markup.button.callback(t(L, 'settings_desktops'), 'settings:desktops')],
    [Markup.button.callback(t(L, 'settings_usage'), 'settings:usage')],
    [Markup.button.callback(t(L, 'settings_close'), 'settings:close')]
  ];

  return ctx.reply(t(L, 'settings_title'), Markup.inlineKeyboard(buttons));
}

export async function handleSettingsCallback(ctx, userId, action) {
  await ctx.answerCbQuery();

  switch (action) {
    case 'model':
      return handleModelCommand(ctx, userId);
    case 'skills':
      return handleSkillsCommand(ctx, userId);
    case 'agent_teams':
      return handleAgentTeamsCommand(ctx, userId);
    case 'sessions':
      return handleSessionsCommand(ctx, userId);
    case 'desktops':
      return handleDesktopsCommand(ctx, userId);
    case 'usage':
      return handleUsageCommand(ctx, userId);
    case 'close':
      return ctx.deleteMessage();
  }
}

// ── /desktops ──────────────────────────────────────────────
export async function handleDesktopsCommand(ctx, userId) {
  try {
    const state = getUserState(userId);
    const L = state.lang;
    const desktops = await listDesktops();
    const activeId = state.activeDesktop?.id;

    if (desktops.length === 0) {
      const buttons = [[Markup.button.callback(t(L, 'btn_new_desktop'), 'desktop:new')]];
      const noDesktopMsg = activeId
        ? t(L, 'desktops_none_active')
        : t(L, 'desktops_none');
      return ctx.reply(noDesktopMsg, Markup.inlineKeyboard(buttons));
    }

    const buttons = desktops.map(d => {
      const check = d.id === activeId ? '✅ ' : '';
      const label = d.title || t(L, 'unnamed');
      return [Markup.button.callback(
        `${check}🖥️ ${label}`,
        `desktop:switch:${d.id}`
      )];
    });
    buttons.push([
      Markup.button.callback(t(L, 'btn_new_desktop'), 'desktop:new'),
      Markup.button.callback(t(L, 'btn_rename'), 'desktop:rename_menu'),
      Markup.button.callback(t(L, 'btn_delete'), 'desktop:delete_menu')
    ]);

    const currentInfo = activeId
      ? t(L, 'desktops_current', { name: state.activeDesktop.title })
      : t(L, 'desktops_default');

    return ctx.reply(
      `${t(L, 'desktops_title')}\n${currentInfo}\n${t(L, 'desktop_title_hint')}\n\n${t(L, 'desktops_select')}`,
      Markup.inlineKeyboard(buttons)
    );
  } catch (err) {
    console.error('Desktop list error:', err);
    const state = getUserState(userId);
    return ctx.reply(t(state.lang, 'desktop_list_error', { error: err.message }));
  }
}

export async function handleDesktopSwitchCallback(ctx, userId, desktopId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktops = await listDesktops();
    const d = desktops.find(x => x.id === desktopId);
    if (!d) {
      await ctx.answerCbQuery(t(L, 'desktop_not_found'));
      return;
    }

    // Switch desktop — changes workspace root for all tools
    state.setDesktop(d.id, d.title);
    await ctx.answerCbQuery(t(L, 'desktop_switched', { name: d.title }));

    // Rebuild keyboard with updated checkmark
    const buttons = desktops.map(dd => {
      const check = dd.id === desktopId ? '✅ ' : '';
      return [Markup.button.callback(
        `${check}🖥️ ${dd.title || t(L, 'unnamed')}`,
        `desktop:switch:${dd.id}`
      )];
    });
    buttons.push([
      Markup.button.callback(t(L, 'btn_new_desktop'), 'desktop:new'),
      Markup.button.callback(t(L, 'btn_rename'), 'desktop:rename_menu'),
      Markup.button.callback(t(L, 'btn_delete'), 'desktop:delete_menu')
    ]);

    await ctx.editMessageText(
      `${t(L, 'desktops_title')}\n${t(L, 'desktops_current', { name: d.title })}\n${t(L, 'desktop_work_dir', { path: state.workspaceRoot })}\n\n${t(L, 'desktops_select')}`,
      Markup.inlineKeyboard(buttons)
    );
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'desktop_switch_fail'));
    console.error('Desktop switch error:', err);
  }
}

export async function handleDesktopNewCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktopName = L === 'zh'
      ? `桌面 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`
      : `Desktop ${new Date().toLocaleString('en-US')}`;
    const desktop = await createDesktop(desktopName);

    // Auto-switch to the new desktop
    state.setDesktop(desktop.id, desktop.title);

    await ctx.answerCbQuery(t(L, 'desktop_created'));
    await ctx.editMessageText(
      `${t(L, 'desktop_created')}\n\n` +
      t(L, 'desktop_created_detail', { name: desktop.title, path: state.workspaceRoot })
    );
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'desktop_create_fail'));
    console.error('Desktop create error:', err);
  }
}

export async function handleDesktopDeleteMenuCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktops = await listDesktops();
    const activeId = state.activeDesktop?.id;

    // Can only delete API-registered desktops that aren't the active one
    const deletable = desktops.filter(d => d.id !== activeId && d.source === 'api');
    if (deletable.length === 0) {
      await ctx.answerCbQuery(t(L, 'desktop_no_deletable'));
      return;
    }

    const buttons = deletable.map(d =>
      [Markup.button.callback(`🗑️ ${d.title || t(L, 'unnamed')}`, `desktop:delete:${d.id}`)]
    );
    buttons.push([Markup.button.callback(t(L, 'btn_cancel'), 'desktop:back')]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(t(L, 'desktops_delete_title'), Markup.inlineKeyboard(buttons));
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'fetch_fail'));
  }
}

export async function handleDesktopDeleteCallback(ctx, userId, desktopId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktops = await listDesktops();
    const d = desktops.find(x => x.id === desktopId);
    const name = d?.title || t(L, 'unnamed');

    const success = await deleteDesktop(desktopId);
    if (success) {
      await ctx.answerCbQuery(t(L, 'desktop_deleted', { name }));
      await ctx.editMessageText(t(L, 'desktop_deleted', { name }));
    } else {
      await ctx.answerCbQuery(t(L, 'desktop_delete_fail'));
    }
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'desktop_delete_fail'));
  }
}

// ── Desktop rename (pending state + handlers) ───────────
// Tracks pending rename operations: userId → { desktopId, desktopTitle }
export const pendingRenames = new Map();

export async function handleDesktopRenameMenuCallback(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktops = await listDesktops();
    if (desktops.length === 0) {
      await ctx.answerCbQuery(t(L, 'desktops_none'));
      return;
    }

    const buttons = desktops.map(d =>
      [Markup.button.callback(`✏️ ${d.title || t(L, 'unnamed')}`, `desktop:rename:${d.id}`)]
    );
    buttons.push([Markup.button.callback(t(L, 'btn_cancel'), 'desktop:back')]);

    await ctx.answerCbQuery();
    await ctx.editMessageText(t(L, 'desktop_rename_title'), Markup.inlineKeyboard(buttons));
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'fetch_fail'));
  }
}

export async function handleDesktopRenameCallback(ctx, userId, desktopId) {
  const state = getUserState(userId);
  const L = state.lang;
  try {
    const desktops = await listDesktops();
    const d = desktops.find(x => x.id === desktopId);
    const currentTitle = d?.title || t(L, 'unnamed');

    // Store pending rename
    pendingRenames.set(userId, { desktopId, desktopTitle: currentTitle });

    await ctx.answerCbQuery();
    // Delete the inline keyboard message first, then send a new message
    // with force_reply (editMessageText doesn't support force_reply)
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply(
      t(L, 'desktop_rename_prompt', { name: currentTitle }),
      { reply_markup: { force_reply: true, selective: true } }
    );
  } catch (err) {
    await ctx.answerCbQuery(t(L, 'desktop_rename_fail'));
  }
}

/**
 * Process the text reply for a pending rename.
 * Called from bot.js when a pending rename exists.
 * Returns true if handled, false if not a rename.
 */
export async function processPendingRename(ctx, userId) {
  if (!pendingRenames.has(userId)) return false;

  const { desktopId, desktopTitle } = pendingRenames.get(userId);
  pendingRenames.delete(userId);

  const newTitle = ctx.message.text.trim();
  if (!newTitle) return true; // empty input, just consume it

  const state = getUserState(userId);
  const L = state.lang;

  try {
    await renameDesktop(desktopId, newTitle);

    // Update active desktop title if this is the current one
    if (state.activeDesktop?.id === desktopId) {
      state.setDesktop(desktopId, newTitle);
    }

    await ctx.reply(t(L, 'desktop_renamed', { name: newTitle }));
  } catch (err) {
    console.error('Rename error:', err);
    await ctx.reply(t(L, 'desktop_rename_fail'));
  }

  return true;
}

// ── /version ────────────────────────────────────────────────
export const BOT_VERSION = '2.6.0';
export const BOT_BUILD_DATE = '2026-03-14';

export function handleVersionCommand(ctx) {
  const userId = ctx.from?.id;
  const state = getUserState(userId);
  const L = state?.lang || 'en';
  return ctx.reply(
    `${t(L, 'version_title')}\n` +
    t(L, 'version_body', { version: BOT_VERSION, buildDate: BOT_BUILD_DATE })
  );
}

// ── /help ───────────────────────────────────────────────────
export function handleHelpCommand(ctx) {
  const userId = ctx.from?.id;
  const state = getUserState(userId);
  const L = state?.lang || 'en';
  return ctx.reply(
    `${t(L, 'help_title', { version: BOT_VERSION })}\n\n` +
    t(L, 'help_body')
  );
}

// ── /start ──────────────────────────────────────────────────
export function handleStartCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  // Reset to new default session
  state.sessions.clear();
  state.createSession(t(L, 'default_session_name'));

  const firstName = ctx.from.first_name || (L === 'zh' ? '朋友' : 'friend');
  return ctx.reply(
    `${t(L, 'start_greeting', { name: firstName })}\n\n` +
    t(L, 'start_intro')
  );
}

// ── /lang ──────────────────────────────────────────────────
export function handleLangCommand(ctx, userId) {
  const state = getUserState(userId);
  const L = state.lang;
  const buttons = [
    [Markup.button.callback(`${L === 'zh' ? '✅ ' : ''}🇨🇳 中文`, 'lang:zh')],
    [Markup.button.callback(`${L === 'en' ? '✅ ' : ''}🇬🇧 English`, 'lang:en')]
  ];
  return ctx.reply(t(L, 'lang_select'), Markup.inlineKeyboard(buttons));
}

export async function handleLangCallback(ctx, userId, lang) {
  const state = getUserState(userId);
  state.setLang(lang);
  const L = lang;
  await ctx.answerCbQuery(t(L, 'lang_switched'));

  const buttons = [
    [Markup.button.callback(`${L === 'zh' ? '✅ ' : ''}🇨🇳 中文`, 'lang:zh')],
    [Markup.button.callback(`${L === 'en' ? '✅ ' : ''}🇬🇧 English`, 'lang:en')]
  ];
  await ctx.editMessageText(t(L, 'lang_select'), Markup.inlineKeyboard(buttons));
}

// ── Callback router ─────────────────────────────────────────
export async function routeCallback(ctx, userId) {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('model:')) {
    return handleModelCallback(ctx, userId, data.slice(6));
  }
  if (data.startsWith('skill:toggle:')) {
    return handleSkillToggleCallback(ctx, userId, data.slice(13));
  }
  if (data === 'skill:done') {
    return handleSkillDoneCallback(ctx, userId);
  }
  if (data.startsWith('session:switch:')) {
    return handleSessionSwitchCallback(ctx, userId, data.slice(15));
  }
  if (data === 'session:new') {
    return handleSessionNewCallback(ctx, userId);
  }
  if (data === 'session:delete_menu') {
    return handleSessionDeleteMenuCallback(ctx, userId);
  }
  if (data.startsWith('session:delete:')) {
    return handleSessionDeleteCallback(ctx, userId, data.slice(15));
  }
  if (data === 'session:cancel') {
    await ctx.answerCbQuery();
    return ctx.deleteMessage();
  }
  if (data.startsWith('settings:')) {
    return handleSettingsCallback(ctx, userId, data.slice(9));
  }
  // Desktop callbacks
  if (data === 'desktop:new') {
    return handleDesktopNewCallback(ctx, userId);
  }
  if (data.startsWith('desktop:switch:')) {
    return handleDesktopSwitchCallback(ctx, userId, data.slice(15));
  }
  if (data === 'desktop:delete_menu') {
    return handleDesktopDeleteMenuCallback(ctx, userId);
  }
  if (data.startsWith('desktop:delete:')) {
    return handleDesktopDeleteCallback(ctx, userId, data.slice(15));
  }
  if (data === 'desktop:rename_menu') {
    return handleDesktopRenameMenuCallback(ctx, userId);
  }
  if (data.startsWith('desktop:rename:')) {
    return handleDesktopRenameCallback(ctx, userId, data.slice(15));
  }
  if (data === 'desktop:back') {
    // Go back to desktop list
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    return handleDesktopsCommand(ctx, userId);
  }

  // Agent Teams callback
  if (data === 'agentteams:toggle') {
    return handleAgentTeamsToggleCallback(ctx, userId);
  }

  // Lang callbacks
  if (data.startsWith('lang:')) {
    return handleLangCallback(ctx, userId, data.slice(5));
  }

  const state = getUserState(userId);
  await ctx.answerCbQuery(t(state?.lang || 'en', 'unknown_action'));
}
