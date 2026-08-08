//【新需求106】审计日志
//
// 任何经过 MCP 的写操作都必须留痕 —— 出了问题要能回答"谁在什么时候改了什么"。
// 日志落在本地文件（默认 mcp/logs/），不写数据库，避免"审计日志本身也被 Agent 改掉"。

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = join(HERE, '..', 'logs');

function logDir() {
  return process.env.JSA_MCP_LOG_DIR || DEFAULT_LOG_DIR;
}

/**
 * 参数可能含隐私（姓名/邮箱），这里只记录类型与长度摘要，不落原值。
 * 真正需要溯源时结合 SQL 与时间点即可定位。
 */
function summarizeParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map(p => {
    if (p === null || p === undefined) return 'null';
    if (typeof p === 'number') return `num(${p})`;
    if (typeof p === 'boolean') return `bool(${p})`;
    const s = String(p);
    return `str(len=${s.length})`;
  });
}

/**
 * @param {object} entry
 * @param {string} entry.tool     工具名
 * @param {string} entry.target   production | staging
 * @param {string} entry.sql
 * @param {Array} entry.params
 * @param {string} entry.outcome  ok | rejected | error
 * @param {object} [entry.meta]   D1 返回的 meta（changes 等）
 * @param {string} [entry.error]
 */
export async function audit(entry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    tool: entry.tool,
    target: entry.target,
    outcome: entry.outcome,
    sql: String(entry.sql || '').replace(/\s+/g, ' ').slice(0, 1000),
    params: summarizeParams(entry.params),
    changes: entry.meta?.changes ?? null,
    rowsRead: entry.meta?.rows_read ?? null,
    rowsWritten: entry.meta?.rows_written ?? null,
    error: entry.error || null,
  });

  try {
    const dir = logDir();
    await mkdir(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    await appendFile(join(dir, `audit-${day}.log`), line + '\n', 'utf8');
  } catch (err) {
    // 审计失败不能阻断业务，但要在 stderr 留下痕迹（stdout 是 MCP 协议通道，绝不能污染）
    process.stderr.write(`[jsa-d1-mcp] 审计日志写入失败: ${err.message}\n`);
  }
}
