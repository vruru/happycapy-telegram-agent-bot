// Skills registry — each skill adds context to the system prompt
// so the AI knows what capabilities are available and how to use them.

export const AVAILABLE_SKILLS = [
  {
    id: 'web-search',
    name: 'Web 搜索',
    emoji: '🔍',
    promptAddition: `你可以使用 web_search 工具搜索互联网获取最新信息、新闻、文档等。`
  },
  {
    id: 'generate-image',
    name: '图片生成',
    emoji: '🎨',
    promptAddition: `你可以通过 bash 调用图片生成 API。使用 curl 调用 AI Gateway 的图片生成接口。`
  },
  {
    id: 'generate-video',
    name: '视频生成',
    emoji: '🎬',
    promptAddition: `你可以通过 bash 调用视频生成 API 来创建视频内容。`
  },
  {
    id: 'pdf',
    name: 'PDF 处理',
    emoji: '📄',
    promptAddition: `你可以处理 PDF 文件：提取文本、创建 PDF、合并拆分等。使用 bash 安装和调用相关 Python 库（pypdf, pdfplumber, reportlab）。`
  },
  {
    id: 'docx',
    name: 'Word 文档',
    emoji: '📝',
    promptAddition: `你可以处理 Word (.docx) 文件：创建、编辑、提取文本、添加批注等。`
  },
  {
    id: 'pptx',
    name: 'PPT 演示',
    emoji: '📊',
    promptAddition: `你可以处理 PowerPoint (.pptx) 文件：创建演示文稿、编辑内容、添加备注等。`
  },
  {
    id: 'xlsx',
    name: 'Excel 表格',
    emoji: '📈',
    promptAddition: `你可以处理 Excel (.xlsx) 文件：创建表格、分析数据、公式计算、图表生成等。`
  },
  {
    id: 'capymail',
    name: '邮件发送',
    emoji: '📧',
    promptAddition: `你可以通过 bash 调用 send-email 命令发送邮件。格式: send-email --to <收件人> --subject "<主题>" --body "<内容>"`
  },
  {
    id: 'comprehensive-researcher',
    name: '深度研究',
    emoji: '🔬',
    promptAddition: `你可以进行深度研究，使用多个来源交叉验证，生成带引用的结构化研究报告。`
  },
  {
    id: 'frontend-design',
    name: '前端设计',
    emoji: '🎯',
    promptAddition: `你可以创建高质量的前端界面：网站、着陆页、仪表盘、React 组件等。`
  }
];

// Get prompt additions for active skills
export function getSkillPromptAdditions(activeSkillIds) {
  if (!activeSkillIds || activeSkillIds.size === 0) return '';

  const additions = [];
  for (const id of activeSkillIds) {
    const skill = AVAILABLE_SKILLS.find(s => s.id === id);
    if (skill) {
      additions.push(`- ${skill.name}: ${skill.promptAddition}`);
    }
  }

  if (additions.length === 0) return '';

  return `\n\n已激活的技能:\n${additions.join('\n')}`;
}
