import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import fetch from 'node-fetch';

import { WORKSPACE_BASE } from './config.js';

const execAsync = promisify(exec);

const DEFAULT_WORKSPACE = WORKSPACE_BASE;

// Execute a tool call with dynamic workspace context
export async function executeTool(toolName, toolInput, workspaceRoot = DEFAULT_WORKSPACE) {
  console.log(`🔧 Executing tool: ${toolName}`, JSON.stringify(toolInput).substring(0, 150));

  try {
    let result;

    switch (toolName) {
      case 'bash':
        result = await executeBash(toolInput.command, workspaceRoot);
        break;
      case 'read_file':
        result = await readFile(toolInput.path, workspaceRoot);
        break;
      case 'write_file':
        result = await writeFile(toolInput.path, toolInput.content, workspaceRoot);
        break;
      case 'edit_file':
        result = await editFile(toolInput.path, toolInput.old_string, toolInput.new_string, workspaceRoot);
        break;
      case 'list_files':
        result = await listFiles(toolInput.pattern, toolInput.directory || workspaceRoot);
        break;
      case 'search_files':
        result = await searchFiles(toolInput.pattern, toolInput.path || workspaceRoot, toolInput.file_pattern, workspaceRoot);
        break;
      case 'web_search':
        result = await webSearch(toolInput.query);
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    console.log(`✅ Tool done: ${toolName}`);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Tool failed: ${toolName}`, error.message);
    return { success: false, error: error.message };
  }
}

async function executeBash(command, cwd) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 60000
    });
    return stdout || stderr || 'Command executed successfully (no output)';
  } catch (error) {
    throw new Error(`Command failed: ${error.message}\n${error.stderr || ''}`);
  }
}

async function readFile(filePath, workspaceRoot) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const content = await fs.readFile(absolutePath, 'utf-8');
  return content;
}

async function writeFile(filePath, content, workspaceRoot) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf-8');
  return `File written successfully: ${filePath}`;
}

async function editFile(filePath, oldString, newString, workspaceRoot) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  let content = await fs.readFile(absolutePath, 'utf-8');
  if (!content.includes(oldString)) {
    throw new Error(`String not found in file: "${oldString.substring(0, 50)}..."`);
  }
  content = content.replace(oldString, newString);
  await fs.writeFile(absolutePath, content, 'utf-8');
  return `File edited successfully: ${filePath}`;
}

async function listFiles(pattern, directory) {
  const files = await glob(pattern, { cwd: directory, absolute: false, nodir: true });
  return files.length > 0
    ? `Found ${files.length} files:\n${files.join('\n')}`
    : 'No files found matching pattern';
}

async function searchFiles(pattern, searchPath, filePattern, workspaceRoot) {
  const grepInclude = filePattern ? `--include="${filePattern}"` : '';
  const command = `grep -r ${grepInclude} -n "${pattern}" "${searchPath}" 2>/dev/null || echo "No matches found"`;
  const result = await executeBash(command, workspaceRoot);
  return result;
}

async function webSearch(query) {
  return `Web search for "${query}" - This feature requires integration with a web search API.`;
}
