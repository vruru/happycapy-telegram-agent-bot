import { getSkillPromptAdditions } from './skills-registry.js';
import { getAvailableModels } from './model-sync.js';
import { WORKSPACE_BASE } from './config.js';

// ── Available models (dynamic, synced from platform) ────────
const FALLBACK_MODELS = [
  { id: 'anthropic/claude-sonnet-4.6', name: 'Sonnet 4.6', emoji: '⚡', desc: '日常任务最佳' }
];

export function getModels() {
  return getAvailableModels() || FALLBACK_MODELS;
}

// ── Tool definitions ────────────────────────────────────────
export const tools = [
  {
    name: "bash",
    description: "Execute bash commands on the server. Use this to run system commands, install packages, manage files, etc. Returns the command output.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The bash command to execute" }
      },
      required: ["command"]
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file from the filesystem. Returns the file content.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to read" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to write" },
        content: { type: "string", description: "Content to write to the file" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_file",
    description: "Edit a file by replacing a specific string with new content. The old_string must exist exactly in the file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to the file to edit" },
        old_string: { type: "string", description: "The exact string to replace" },
        new_string: { type: "string", description: "The new string to replace with" }
      },
      required: ["path", "old_string", "new_string"]
    }
  },
  {
    name: "list_files",
    description: "List files matching a glob pattern (e.g., '*.js', 'src/**/*.ts'). Returns array of file paths.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern to match files" },
        directory: { type: "string", description: "Directory to search in (optional, defaults to workspace root)" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "search_files",
    description: "Search for text patterns in files using regex. Returns matching files and line numbers.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Path to search in (file or directory)" },
        file_pattern: { type: "string", description: "Optional glob pattern to filter files (e.g., '*.js')" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for current information using AI-powered search. Returns search results with summaries.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "message_user",
    description: "Send an intermediate status message to the user via Telegram. Use this to provide progress updates during long-running tasks.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The status message to send to the user" }
      },
      required: ["text"]
    }
  }
];

// ── Dynamic system prompt ───────────────────────────────────
function buildBasePrompt(workspaceRoot, desktopName) {
  return `You are HappyCapy, an AI agent accessible through Telegram.

You have FULL access to tools and capabilities:
- Execute bash commands (bash)
- Read and write files (read_file, write_file, edit_file)
- Search and list files (list_files, search_files)
- Search the web (web_search)
- Send progress updates to user (message_user)

IMPORTANT CAPABILITIES:
- You can create projects, write code, manage files
- You can install packages, run commands, execute scripts
- You can search the web for current information
- You can use git commands (clone, commit, push, etc.)
- You maintain conversation history and context

CONTEXT: User is communicating via Telegram
- Keep responses clear and well-formatted
- For long outputs, summarize key points
- When showing code or file contents, use proper formatting
- If a task will take time, use message_user to send progress updates

CURRENT DESKTOP: ${desktopName || 'default'}
WORKING DIRECTORY: ${workspaceRoot}

You are a fully capable AI agent - use your tools to complete tasks effectively.`;
}

export function getSystemPrompt(activeSkills, workspaceRoot, desktopName, agentTeams = false) {
  const base = buildBasePrompt(
    workspaceRoot || WORKSPACE_BASE,
    desktopName
  );
  const skillAdditions = getSkillPromptAdditions(activeSkills);
  const teamAdditions = agentTeams ? getAgentTeamsPrompt() : '';
  return base + skillAdditions + teamAdditions;
}

function getAgentTeamsPrompt() {
  return `

AGENT TEAMS MODE: ENABLED
You are operating in Agent Teams mode. Apply these enhanced behaviors:

1. TASK DECOMPOSITION: Break complex tasks into clear sub-tasks. List them before starting.
2. SYSTEMATIC EXECUTION: Work through each sub-task methodically. Report progress after each step.
3. DEEP RESEARCH: For research tasks, use multiple sources and cross-verify information.
4. QUALITY CHECKS: After completing work, review and verify the results before reporting.
5. PROGRESS UPDATES: Use message_user to send progress updates during long-running tasks.
6. PARALLEL THINKING: When a task has independent parts, plan them all upfront, then execute efficiently.

Work like a coordinated team: plan first, execute systematically, verify results.`;
}
