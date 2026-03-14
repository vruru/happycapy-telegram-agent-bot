// ── Internationalization ─────────────────────────────────────
// Detects language from Telegram's language_code (e.g. 'zh-hans', 'en', 'ja')
// Falls back to Chinese for zh-*, English for everything else.

const zh = {
  // Startup
  startup_title: 'HappyCapy Agent Bot 已启动',
  startup_body: '版本: v{version}\n作者: @dafeitg\n启动时间: {time}\n默认模型: Sonnet 4.6\n可用工具: {toolCount} 个\n\n发送消息即可开始对话，/help 查看所有命令。',

  // /start
  start_greeting: '你好 {name}!',
  start_intro: '我是 HappyCapy Agent，拥有完整的工作能力：\n\n- 执行命令、安装软件\n- 创建/编辑/读取文件和项目\n- 搜索文件和代码\n- 搜索网络获取信息\n- 操作 Git/GitHub\n- 以及更多...\n\n使用 /help 查看所有命令\n使用 /settings 进入设置菜单\n\n直接发送消息即可开始！',

  // /help
  help_title: 'HappyCapy Agent v{version}',
  help_body: '可用命令：\n\n🤖 模型与设置\n/model - 切换 AI 模型\n/settings - 打开设置菜单\n\n🛠️ 技能管理\n/skills - 激活/停用技能\n\n👥 Agent Teams\n/agentteams - 开启/关闭团队协作模式\n\n💾 会话管理\n/new [名称] - 创建新会话\n/sessions - 切换会话\n/clear - 清除当前会话历史\n\n🖥️ 桌面管理\n/desktops - 管理桌面（新建/查看/删除）\n\n⚙️ 控制\n/stop - 停止当前处理\n/restart - 重启机器人\n/usage - 查看使用统计\n/version - 查看版本号\n/lang - 切换界面语言\n\n📖 帮助\n/start - 重新开始\n/help - 显示此帮助\n\n💡 处理过程中发送新消息可以补充信息，发送"取消"或 /stop 可终止任务',

  // /version
  version_title: 'HappyCapy Agent Bot',
  version_body: '版本: v{version}\n作者: @dafeitg\n构建日期: {buildDate}\n默认引擎: Sonnet 4.6 (AI Gateway)\n框架: Telegraf 4.x',

  // /model
  model_select: '选择 AI 模型：',
  model_switched: '已切换到 {name}',

  // /skills
  skills_title: '管理技能（点击切换）：',
  skill_activated: '{name}: 已激活',
  skill_deactivated: '{name}: 已停用',
  skills_done_active: '已激活技能: {list}',
  skills_done_none: '当前未激活任何技能',
  btn_done: '完成',

  // /sessions
  sessions_empty: '暂无会话。使用 /new 创建新会话。',
  sessions_title: '选择会话：',
  sessions_msgs: '{n}条',
  session_switched: '已切换到: {name}',
  session_created: '已创建并切换到新会话: {name}',
  session_not_found: '会话不存在',
  session_deleted: '已删除会话: {name}',
  session_delete_fail: '无法删除当前会话',
  session_only_current: '只有当前会话，无法删除',
  sessions_delete_title: '选择要删除的会话：',
  btn_new_session: '➕ 新建会话',
  btn_delete: '🗑️ 删除',
  btn_cancel: '取消',

  // /new
  new_session_created: '已创建新会话: {name}',
  default_session_name: '默认会话',

  // /desktops
  desktops_none_active: '平台暂无桌面。',
  desktops_none: '平台暂无桌面，当前在系统默认目录工作。',
  desktops_title: '🖥️ 桌面管理',
  desktops_current: '当前桌面: {name}',
  desktops_default: '当前: 系统默认目录',
  desktops_select: '点击切换桌面：',
  desktop_switched: '已切换到: {name}',
  desktop_not_found: '桌面不存在',
  desktop_switch_fail: '切换失败',
  desktop_created: '已创建新桌面并切换',
  desktop_created_detail: '名称: {name}\n工作目录: {path}\n\n现在发送的所有命令都在此桌面下执行。',
  desktop_create_fail: '创建失败',
  desktop_no_deletable: '没有可删除的桌面',
  desktops_delete_title: '选择要删除的桌面：',
  desktop_deleted: '已删除桌面: {name}',
  desktop_delete_fail: '删除失败',
  desktop_list_error: '获取桌面列表失败: {error}',
  btn_new_desktop: '➕ 新建桌面',
  btn_rename: '✏️ 重命名',
  desktop_work_dir: '工作目录: {path}',
  desktop_rename_title: '选择要重命名的桌面：',
  desktop_rename_prompt: '请回复新的桌面名称（当前: {name}）：',
  desktop_renamed: '已重命名为: {name}',
  desktop_rename_fail: '重命名失败',
  desktop_title_hint: '(桌面名称为本地推断，可点击"重命名"设置)',

  // Agent Teams
  agent_teams_label: '👥 Agent Teams',
  agent_teams_on: '👥 Agent Teams: ✅ 已开启',
  agent_teams_off: '👥 Agent Teams: ⬜ 已关闭',
  agent_teams_enabled: 'Agent Teams 已开启',
  agent_teams_disabled: 'Agent Teams 已关闭',
  agent_teams_desc: '开启后 AI 将以团队协作模式工作：自动分解任务、系统化执行、深度研究、多重验证。',

  // /settings
  settings_title: '⚙️ 设置',
  settings_model: '🤖 模型设置',
  settings_skills: '🛠️ 技能管理',
  settings_agent_teams: '👥 Agent Teams',
  settings_sessions: '💾 会话管理',
  settings_desktops: '🖥️ 桌面管理',
  settings_usage: '📊 使用统计',
  settings_close: '❌ 关闭',

  // /usage
  usage_title: '📊 使用统计',
  usage_api_calls: 'API 调用: {n}',
  usage_tool_execs: '工具执行: {n}',
  usage_messages: '用户消息: {n}',
  usage_tokens: 'Tokens: {n}',
  usage_by_model: '按模型:',
  usage_top_tools: 'Top 工具:',
  usage_none: '  暂无',
  usage_since: '统计自: {date}',

  // /stop
  stop_nothing: '当前没有正在处理的任务。',
  stop_done: '已停止当前处理。',

  // /clear
  clear_done: '当前会话历史已清除。',

  // /restart
  restart_msg: '正在重启机器人，请稍候...',

  // Processing
  status_thinking: '🧠 思考中...',
  status_analyzing: '🧠 分析结果...',
  status_exec: '⚙️ 执行: {cmd}',
  status_read: '📖 读取: {file}',
  status_write: '✏️ 写入: {file}',
  status_edit: '✏️ 编辑: {file}',
  status_search: '🌐 搜索: {query}',
  status_receiving_file: '📥 接收文件...',
  status_receiving_photo: '📥 接收图片...',
  processing_busy: '当前有任务在处理中，请稍候或发送 /stop 取消。',
  processing_cancelled: '已取消当前任务。',
  processing_supplement: '已收到补充信息，会在当前步骤完成后处理。',
  processing_interrupted: '处理已中断',
  processing_error: '处理出错: {error}',
  processing_file_error: '文件处理出错: {error}',
  processing_photo_error: '图片处理出错: {error}',
  processing_max_turns: '（已达到最大执行轮次 200 轮。如需继续请发消息。）',

  // Tool status
  tool_bash: '⚙️ 执行命令...',
  tool_read_file: '📖 读取文件...',
  tool_write_file: '✏️ 写入文件...',
  tool_edit_file: '✏️ 编辑文件...',
  tool_list_files: '📂 搜索文件...',
  tool_search_files: '🔍 搜索内容...',
  tool_web_search: '🌐 搜索网络...',
  tool_message_user: '💬 发送消息...',

  // /lang
  lang_select: '选择界面语言：',
  lang_switched: '已切换到: 中文',
  lang_current: '当前语言: 中文',

  // Common
  unknown_action: '未知操作',
  fetch_fail: '获取失败',
  unnamed: '未命名',
};

const en = {
  // Startup
  startup_title: 'HappyCapy Agent Bot Started',
  startup_body: 'Version: v{version}\nAuthor: @dafeitg\nStarted: {time}\nDefault Model: Sonnet 4.6\nAvailable Tools: {toolCount}\n\nSend a message to start chatting. /help for all commands.',

  // /start
  start_greeting: 'Hi {name}!',
  start_intro: "I'm HappyCapy Agent with full capabilities:\n\n- Execute commands, install packages\n- Create/edit/read files and projects\n- Search files and code\n- Search the web\n- Git/GitHub operations\n- And more...\n\nUse /help for all commands\nUse /settings to open settings\n\nJust send a message to begin!",

  // /help
  help_title: 'HappyCapy Agent v{version}',
  help_body: 'Available commands:\n\n🤖 Model & Settings\n/model - Switch AI model\n/settings - Open settings\n\n🛠️ Skills\n/skills - Enable/disable skills\n\n👥 Agent Teams\n/agentteams - Toggle team collaboration mode\n\n💾 Sessions\n/new [name] - Create new session\n/sessions - Switch sessions\n/clear - Clear current session\n\n🖥️ Desktops\n/desktops - Manage desktops\n\n⚙️ Control\n/stop - Stop current task\n/restart - Restart bot\n/usage - View usage stats\n/version - View version\n/lang - Switch language\n\n📖 Help\n/start - Reset\n/help - Show this help\n\n💡 Send messages during processing to add context. Send "stop" or /stop to cancel.',

  // /version
  version_title: 'HappyCapy Agent Bot',
  version_body: 'Version: v{version}\nAuthor: @dafeitg\nBuild: {buildDate}\nEngine: Sonnet 4.6 (AI Gateway)\nFramework: Telegraf 4.x',

  // /model
  model_select: 'Select AI model:',
  model_switched: 'Switched to {name}',

  // /skills
  skills_title: 'Manage skills (tap to toggle):',
  skill_activated: '{name}: Enabled',
  skill_deactivated: '{name}: Disabled',
  skills_done_active: 'Active skills: {list}',
  skills_done_none: 'No skills enabled',
  btn_done: 'Done',

  // /sessions
  sessions_empty: 'No sessions. Use /new to create one.',
  sessions_title: 'Select session:',
  sessions_msgs: '{n} msgs',
  session_switched: 'Switched to: {name}',
  session_created: 'Created and switched to: {name}',
  session_not_found: 'Session not found',
  session_deleted: 'Deleted session: {name}',
  session_delete_fail: 'Cannot delete current session',
  session_only_current: 'Only one session, cannot delete',
  sessions_delete_title: 'Select session to delete:',
  btn_new_session: '➕ New Session',
  btn_delete: '🗑️ Delete',
  btn_cancel: 'Cancel',

  // /new
  new_session_created: 'Created new session: {name}',
  default_session_name: 'Default',

  // /desktops
  desktops_none_active: 'No desktops found.',
  desktops_none: 'No desktops found. Working in system default directory.',
  desktops_title: '🖥️ Desktop Manager',
  desktops_current: 'Current: {name}',
  desktops_default: 'Current: System default',
  desktops_select: 'Tap to switch:',
  desktop_switched: 'Switched to: {name}',
  desktop_not_found: 'Desktop not found',
  desktop_switch_fail: 'Switch failed',
  desktop_created: 'New desktop created',
  desktop_created_detail: 'Name: {name}\nWorkspace: {path}\n\nAll commands now run in this desktop.',
  desktop_create_fail: 'Creation failed',
  desktop_no_deletable: 'No desktops to delete',
  desktops_delete_title: 'Select desktop to delete:',
  desktop_deleted: 'Deleted desktop: {name}',
  desktop_delete_fail: 'Delete failed',
  desktop_list_error: 'Failed to list desktops: {error}',
  btn_new_desktop: '➕ New Desktop',
  btn_rename: '✏️ Rename',
  desktop_work_dir: 'Workspace: {path}',
  desktop_rename_title: 'Select desktop to rename:',
  desktop_rename_prompt: 'Reply with the new name (current: {name}):',
  desktop_renamed: 'Renamed to: {name}',
  desktop_rename_fail: 'Rename failed',
  desktop_title_hint: '(Titles are locally inferred. Use Rename to set custom names.)',

  // Agent Teams
  agent_teams_label: '👥 Agent Teams',
  agent_teams_on: '👥 Agent Teams: ✅ On',
  agent_teams_off: '👥 Agent Teams: ⬜ Off',
  agent_teams_enabled: 'Agent Teams enabled',
  agent_teams_disabled: 'Agent Teams disabled',
  agent_teams_desc: 'When enabled, AI works in team mode: task decomposition, systematic execution, deep research, multi-step verification.',

  // /settings
  settings_title: '⚙️ Settings',
  settings_model: '🤖 Model',
  settings_skills: '🛠️ Skills',
  settings_agent_teams: '👥 Agent Teams',
  settings_sessions: '💾 Sessions',
  settings_desktops: '🖥️ Desktops',
  settings_usage: '📊 Usage',
  settings_close: '❌ Close',

  // /usage
  usage_title: '📊 Usage Stats',
  usage_api_calls: 'API Calls: {n}',
  usage_tool_execs: 'Tool Executions: {n}',
  usage_messages: 'User Messages: {n}',
  usage_tokens: 'Tokens: {n}',
  usage_by_model: 'By Model:',
  usage_top_tools: 'Top Tools:',
  usage_none: '  None',
  usage_since: 'Since: {date}',

  // /stop
  stop_nothing: 'No task is currently running.',
  stop_done: 'Task stopped.',

  // /clear
  clear_done: 'Session history cleared.',

  // /restart
  restart_msg: 'Restarting bot, please wait...',

  // Processing
  status_thinking: '🧠 Thinking...',
  status_analyzing: '🧠 Analyzing...',
  status_exec: '⚙️ Running: {cmd}',
  status_read: '📖 Reading: {file}',
  status_write: '✏️ Writing: {file}',
  status_edit: '✏️ Editing: {file}',
  status_search: '🌐 Searching: {query}',
  status_receiving_file: '📥 Receiving file...',
  status_receiving_photo: '📥 Receiving photo...',
  processing_busy: 'A task is running. Wait or send /stop to cancel.',
  processing_cancelled: 'Task cancelled.',
  processing_supplement: 'Got it. Will process after current step.',
  processing_interrupted: 'Processing interrupted',
  processing_error: 'Error: {error}',
  processing_file_error: 'File error: {error}',
  processing_photo_error: 'Photo error: {error}',
  processing_max_turns: '(Max 200 turns reached. Send another message to continue.)',

  // Tool status
  tool_bash: '⚙️ Running command...',
  tool_read_file: '📖 Reading file...',
  tool_write_file: '✏️ Writing file...',
  tool_edit_file: '✏️ Editing file...',
  tool_list_files: '📂 Listing files...',
  tool_search_files: '🔍 Searching...',
  tool_web_search: '🌐 Web search...',
  tool_message_user: '💬 Sending message...',

  // /lang
  lang_select: 'Select language:',
  lang_switched: 'Switched to: English',
  lang_current: 'Current language: English',

  // Common
  unknown_action: 'Unknown action',
  fetch_fail: 'Fetch failed',
  unnamed: 'Unnamed',
};

const LANGS = { zh, en };

/**
 * Detect language from Telegram language_code.
 * Returns 'zh' for Chinese, 'en' for everything else.
 */
export function detectLang(languageCode) {
  if (languageCode && languageCode.startsWith('zh')) return 'zh';
  return 'en';
}

/**
 * Get translated string. Supports {param} interpolation.
 * Usage: t(lang, 'model_switched', { name: 'Opus' })
 */
export function t(lang, key, params = {}) {
  const dict = LANGS[lang] || LANGS.en;
  let str = dict[key] ?? LANGS.en[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}
