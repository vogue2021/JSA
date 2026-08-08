//【新需求106】SQL 安全闸门
//
// 把"生产数据库读写权限"交给 AI Agent 是高风险操作，本模块是唯一的守门人。
// 设计原则：默认拒绝，逐项放开。
//
// 五道闸门：
//   1. 单语句限制  —— 拒绝分号拼接的多语句，堵住 "SELECT 1; DROP TABLE students"
//   2. 语句分类    —— 只认识 SELECT/WITH/EXPLAIN（读）与 INSERT/UPDATE/DELETE（写），其余一律拒绝
//   3. DDL 永久禁令—— DROP/ALTER/CREATE/TRUNCATE/ATTACH/PRAGMA/VACUUM 等无论如何都不放行
//   4. 写开关      —— 未设置 JSA_MCP_ALLOW_WRITE=true 时，任何写语句直接拒绝
//   5. WHERE 强制  —— UPDATE/DELETE 必须带WHERE，堵住全表误改误删
//
// 另外：结果集里的敏感列（密码哈希、token）统一脱敏，避免 Agent 把凭据读走并写进日志/对话。

// 无论读写开关如何都禁止的语句前缀
const FORBIDDEN_KEYWORDS = [
  'drop', 'alter', 'create', 'truncate', 'attach', 'detach',
  'pragma', 'vacuum', 'reindex', 'analyze', 'begin', 'commit',
  'rollback', 'savepoint', 'release', 'replace',
];

const READ_KEYWORDS = ['select', 'with', 'explain'];
const WRITE_KEYWORDS = ['insert', 'update', 'delete'];

// 结果集中需要脱敏的列名（小写匹配）
const SENSITIVE_COLUMNS = new Set([
  'password', 'password_hash', 'passwd', 'token', 'api_token',
  'refresh_token', 'access_token', 'secret', 'private_key',
]);

/** 允许操作的业务表白名单。未列入的表（含 sqlite 内部表）不允许写。 */
export const WRITABLE_TABLES = new Set([
  'students', 'teachers', 'schools', 'materials', 'events',
  'deadline_reminders', 'users', 'messages', 'notifications',
]);

/**
 * 去掉 SQL 里的注释与字符串字面量，只留下"骨架"用于关键字判定。
 * 这样 "-- drop table" 或 '/* drop *\/' 或 "'DROP'" 这种伪装不会误判，
 * 反过来也防止攻击者把危险关键字藏进注释后的真实语句里。
 */
function skeleton(sql) {
  let s = String(sql);
  // 块注释
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // 行注释
  s = s.replace(/--[^\n]*/g, ' ');
  // 单引号字符串（含 '' 转义）
  s = s.replace(/'(?:[^']|'')*'/g, "''");
  // 双引号标识符保留内容会影响表名解析，这里保留原样
  return s.trim();
}

/**
 * 判断是否为多语句。
 * 骨架里去掉结尾分号后，若仍存在分号，即视为多语句。
 */
function isMultiStatement(skel) {
  const body = skel.replace(/;\s*$/, '');
  return body.includes(';');
}

/**
 * 提取语句操作的主表名（用于白名单校验）。
 * 只处理 INSERT INTO x / UPDATE x / DELETE FROM x 这三种写语句形态。
 */
export function extractWriteTable(skel) {
  const s = skel.replace(/\s+/g, ' ').trim();
  let m = /^insert\s+into\s+["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/i.exec(s);
  if (m) return m[1].toLowerCase();
  m = /^update\s+["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/i.exec(s);
  if (m) return m[1].toLowerCase();
  m = /^delete\s+from\s+["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/i.exec(s);
  if (m) return m[1].toLowerCase();
  return null;
}

/**
 * SQL 分类：read | write | forbidden
 */
export function classify(sql) {
  const skel = skeleton(sql);
  if (!skel) return { kind: 'forbidden', reason: 'SQL 为空' };
  if (isMultiStatement(skel)) {
    return { kind: 'forbidden', reason: '一次只允许执行一条语句（检测到分号拼接的多条语句）' };
  }

  const firstWord = (skel.match(/^[A-Za-z]+/) || [''])[0].toLowerCase();

  if (FORBIDDEN_KEYWORDS.includes(firstWord)) {
    return { kind: 'forbidden', reason: `禁止执行 ${firstWord.toUpperCase()} 语句（建表/改表/事务控制类操作请走迁移脚本人工执行）` };
  }
  if (READ_KEYWORDS.includes(firstWord)) {
    // WITH 有可能是 "WITH x AS (...) DELETE ..." 这种写法，需要二次确认
    if (firstWord === 'with' && /\b(insert|update|delete)\b/i.test(skel)) {
      return { kind: 'forbidden', reason: 'CTE 中包含写操作，请改用明确的 INSERT/UPDATE/DELETE 语句' };
    }
    return { kind: 'read', skel };
  }
  if (WRITE_KEYWORDS.includes(firstWord)) {
    return { kind: 'write', skel, verb: firstWord };
  }
  return { kind: 'forbidden', reason: `无法识别的语句类型：${firstWord.toUpperCase()}` };
}

/** 写操作是否被环境变量放开 */
export function isWriteEnabled() {
  return String(process.env.JSA_MCP_ALLOW_WRITE || '').toLowerCase() === 'true';
}

/**
 * 只读通道校验。
 * @throws {Error} 不合法时抛出
 */
export function assertReadable(sql) {
  const c = classify(sql);
  if (c.kind === 'read') return c;
  if (c.kind === 'write') {
    throw new Error('query 工具只能执行只读查询，写操作请使用 execute 工具');
  }
  throw new Error(c.reason);
}

/**
 * 写通道校验。
 * @throws {Error} 不合法时抛出
 */
export function assertWritable(sql) {
  const c = classify(sql);
  if (c.kind === 'read') {
    throw new Error('这是一条只读语句，请使用 query 工具');
  }
  if (c.kind === 'forbidden') throw new Error(c.reason);

  if (!isWriteEnabled()) {
    throw new Error(
      '写操作已被禁用。当前 MCP 以只读模式运行。\n' +
      '如确需写入，请在 MCP 配置的 env 中设置 JSA_MCP_ALLOW_WRITE=true 后重启 MCP 服务。'
    );
  }

  // UPDATE / DELETE 必须带 WHERE
  if ((c.verb === 'update' || c.verb === 'delete') && !/\bwhere\b/i.test(c.skel)) {
    throw new Error(
      `${c.verb.toUpperCase()} 必须带 WHERE 条件（拒绝全表操作）。` +
      '如确需影响全表，请拆成明确条件分批执行。'
    );
  }

  // 表白名单
  const table = extractWriteTable(c.skel);
  if (!table) {
    throw new Error('无法解析目标表名，出于安全考虑拒绝执行');
  }
  if (!WRITABLE_TABLES.has(table)) {
    throw new Error(`表 ${table} 不在可写白名单内。可写表：${[...WRITABLE_TABLES].join(', ')}`);
  }

  return { ...c, table };
}

/**
 * 把 UPDATE / DELETE 改写为等价的 COUNT 查询，用于执行前预估影响行数。
 * 解析不了就返回 null —— 调用方需据此提示"无法预估"，而不是当作0。
 */
export function buildImpactCountSql(sql) {
  const skel = skeleton(sql).replace(/\s+/g, ' ').trim();
  let m = /^delete\s+from\s+(["'`]?[A-Za-z_][A-Za-z0-9_]*["'`]?)\s+where\s+([\s\S]+?);?$/i.exec(skel);
  if (m) return `SELECT COUNT(*) AS affected FROM ${m[1]} WHERE ${m[2]}`;

  // UPDATE 的 SET 子句里可能出现逗号和函数，用最后一个独立的 WHERE 切分
  m = /^update\s+(["'`]?[A-Za-z_][A-Za-z0-9_]*["'`]?)\s+set\s+([\s\S]+)$/i.exec(skel);
  if (m) {
    const rest = m[2];
    const idx = rest.toLowerCase().lastIndexOf(' where ');
    if (idx === -1) return null;
    const cond = rest.slice(idx + 7).replace(/;\s*$/, '');
    if (!cond.trim()) return null;
    return `SELECT COUNT(*) AS affected FROM ${m[1]} WHERE ${cond}`;
  }
  return null;
}

/**
 * 结果集脱敏：敏感列一律替换为 '***REDACTED***'。
 * Agent 没有任何正当理由需要看到密码哈希，而一旦读出就会进入对话上下文/日志。
 */
export function redactRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = SENSITIVE_COLUMNS.has(String(k).toLowerCase()) && v != null
        ? '***REDACTED***'
        : v;
    }
    return out;
  });
}

/** 供工具描述使用的敏感列清单 */
export function sensitiveColumnList() {
  return [...SENSITIVE_COLUMNS];
}
