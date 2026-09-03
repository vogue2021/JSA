//【新需求110】D1 全库 JSON 导出 —— 纯逻辑内核（无 fs / 无网络，可单测）
//
// 为什么把逻辑单独拆出来：
//   导出脚本天然要碰网络与文件系统，如果把 SQL 拼装、分页游标、路径安全校验、
//   计数核对全都写在 CLI 里，就只能"跑一次看看对不对"。
//   这里只做纯计算，全部可以用单元测试锁定；exportDb.js 只负责 IO 编排。
//
// 安全相关的三个点也都落在本文件，便于集中 review：
//   1. 表名只允许合法标识符 + 双引号包裹（表名来自 sqlite_master，但仍不放过）
//   2. 分页游标值走绑定参数，绝不内插
//   3. 输出路径做越界与"是否会被 git 追踪"校验 —— 导出文件含真实学生隐私，
//      绝不能因为写错路径就被 commit 进仓库

import path from 'node:path';

export const EXPORT_FORMAT = 'jsa-d1-export';
export const EXPORT_VERSION = 1;

/** 单次 D1 查询拉取的行数。D1 REST 单响应有体积上限，太大容易被截断或超时。 */
export const DEFAULT_CHUNK = 500;
export const MAX_CHUNK = 2000;

/** sqlite 内部表 / Cloudflare 内部表，不属于业务数据 */
export function isInternalTable(name) {
  const n = String(name || '');
  return n.startsWith('sqlite_') || n.startsWith('_cf_') || n.startsWith('d1_');
}

export function isValidTableName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || ''));
}

/** 表名加双引号。非法标识符直接抛错，不做"尽力清洗"——清洗过的名字反而掩盖问题。 */
export function quoteIdent(name) {
  if (!isValidTableName(name)) {
    throw new Error(`非法的表名：${JSON.stringify(String(name))}`);
  }
  return `"${name}"`;
}

/**
 * 为 rowid 选一个不与真实列冲突的别名。
 * 直接写死 `__rowid` 的话，万一某张表真有这个列，导出结果就会被覆盖掉。
 */
export function pickRowidAlias(columns = []) {
  const taken = new Set((columns || []).map(c => String(c).toLowerCase()));
  let alias = '__rowid__';
  let i = 0;
  while (taken.has(alias.toLowerCase())) {
    i += 1;
    alias = `__rowid_${i}__`;
  }
  return alias;
}

/**
 * 游标（keyset）分页查询。
 * 用 rowid > ? 而不是 LIMIT/OFFSET：OFFSET 在大表上是 O(n)，而且没有稳定
 * ORDER BY 时翻页会重复/漏行。rowid 天然唯一且单调，是最可靠的游标。
 */
export function buildKeysetQuery(table, alias, limit) {
  const t = quoteIdent(table);
  const a = quoteIdent(alias);
  return `SELECT rowid AS ${a}, * FROM ${t} WHERE rowid > ? ORDER BY rowid LIMIT ?`;
}

/**
 * 兜底分页（表没有 rowid 时，例如 WITHOUT ROWID 表）。
 * 没有稳定排序键，只能靠 OFFSET；调用方需要知道这条路径的可靠性较低。
 */
export function buildOffsetQuery(table, limit) {
  return `SELECT * FROM ${quoteIdent(table)} LIMIT ? OFFSET ?`;
}

export function buildCountQuery(table) {
  return `SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`;
}

/** 从结果行里摘掉 rowid 辅助列，同时返回游标值 */
export function stripRowid(row, alias) {
  if (!row || typeof row !== 'object') return { row, cursor: null };
  const { [alias]: cursor, ...rest } = row;
  return { row: rest, cursor: cursor ?? null };
}

/** 导出文件名：带环境与时间戳，避免多次导出互相覆盖 */
export function defaultExportFileName(target, date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const env = String(target || 'unknown').replace(/[^a-z0-9-]/gi, '');
  return `d1-export-${env}-${stamp}.json`;
}

/**
 * 输出路径安全校验。
 *
 * 导出文件里是 143 名真实学生的姓名、邮箱、电话 —— 一旦落在会被 git 追踪的目录，
 * 下一次 `git add .` 就把隐私数据推上了远端，且历史无法轻易清除。
 * 所以默认只允许写在已被 .gitignore 的备份目录，或仓库之外。
 *
 * @param {string} outPath        期望的输出路径（可为相对路径）
 * @param {object} opts
 * @param {string} opts.repoRoot  仓库根目录
 * @param {string[]} opts.allowedRoots 仓库内允许写入的目录（须已 gitignore）
 * @param {boolean} [opts.force]  显式放行仓库内的其它位置
 * @returns {{ path: string, insideRepo: boolean, warning: string|null }}
 */
export function assertSafeOutputPath(outPath, { repoRoot, allowedRoots = [], force = false } = {}) {
  if (!outPath || !String(outPath).trim()) throw new Error('输出路径不能为空');
  if (!repoRoot) throw new Error('缺少 repoRoot');

  const abs = path.resolve(String(outPath));
  const root = path.resolve(repoRoot);

  if (!/\.json$/i.test(abs)) {
    throw new Error(`输出文件必须以 .json 结尾：${abs}`);
  }

  const rel = path.relative(root, abs);
  const insideRepo = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);

  if (!insideRepo) {
    // 仓库之外由用户自行负责，只提示不拦
    return { path: abs, insideRepo: false, warning: '输出路径在仓库之外，请自行确保该位置不会被同步或分享。' };
  }

  const allowed = allowedRoots.some(dir => {
    const r = path.relative(path.resolve(root, dir), abs);
    return r !== '' && !r.startsWith('..') && !path.isAbsolute(r);
  });

  if (!allowed && !force) {
    throw new Error(
      `拒绝写入 ${abs}\n` +
      `该位置在仓库内但未被 .gitignore 覆盖，导出文件含真实学生隐私数据，可能被误提交。\n` +
      `请改用：${allowedRoots.join(' 或 ')}，或确认风险后加 --force。`
    );
  }

  return {
    path: abs,
    insideRepo: true,
    warning: allowed ? null 
      : '⚠️ 已通过 --force 写入仓库内非忽略目录，请务必确认该文件不会被 git 提交。',
  };
}

/**
 * 计数核对：把"导出前 COUNT(*)"与"实际写出行数"逐表比对。
 * 一份对不上数的备份比没有备份更危险 —— 它会让人误以为数据是全的。
 */
export function buildVerification(expectedMap, actualMap) {
  const tables = {};
  const mismatches = [];
  for (const table of Object.keys(expectedMap)) {
    const expected = expectedMap[table] ?? 0;
    const exported = actualMap[table] ?? 0;
    const ok = expected === exported;
    tables[table] = { expected, exported, ok };
    if (!ok) mismatches.push({ table, expected, exported });
  }
  return { ok: mismatches.length === 0, tables, mismatches };
}

export function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 极简 .env 解析（不引入 dotenv 依赖，也绝不 eval）。
 * 只做：跳过空行/注释 → 按第一个 = 切分 → 去掉包裹引号。
 */
export function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * 流式 JSON 写出器。
 *
 * 为什么不 JSON.stringify(整个库)：生产库上万行、含大段 JSON 文本字段，
 * 一次性构造字符串会把整份数据同时驻留内存两遍（对象 + 字符串）。
 * 这里边拉边写，内存占用只与单个分页批次相关。
 *
 * 版式取舍：顶层结构缩进 2 空格便于人读，每行一条记录（compact），
 * 既控制体积又让 diff / grep 可用。
 */
export class JsonExportWriter {
  /** @param {(chunk: string) => void} sink */
  constructor(sink) {
    if (typeof sink !== 'function') throw new Error('sink 必须是函数');
    this.sink = sink;
    this.state = 'init';
    this.rootFirst = true;
    this.tableFirst = true;
    this.rowFirst = true;
    this.currentTable = null;
  }

  _w(s) { this.sink(s); }

  _rootComma() {
    if (this.rootFirst) { this.rootFirst = false; return ''; }
    return ',';
  }

  begin() {
    if (this.state !== 'init') throw new Error('begin 只能调用一次');
    this._w('{');
    this.state = 'root';
  }

  /** 写一个完整的顶层 section（值一次性序列化，适用于 meta / schema / verification） */
  section(key, value) {
    if (this.state !== 'root') throw new Error('section 只能在根层调用');
    const body = JSON.stringify(value ?? null, null, 2)
      .split('\n')
      .join('\n  ');
    this._w(`${this._rootComma()}\n  ${JSON.stringify(String(key))}: ${body}`);
  }

  beginTables(key = 'tables') {
    if (this.state !== 'root') throw new Error('beginTables 只能在根层调用');
    this._w(`${this._rootComma()}\n  ${JSON.stringify(key)}: {`);
    this.state = 'tables';
    this.tableFirst = true;
  }

  beginTable(name) {
    if (this.state !== 'tables') throw new Error('beginTable 需在 beginTables 之后调用');
    this._w(`${this.tableFirst ? '' : ','}\n    ${JSON.stringify(String(name))}: [`);
    this.tableFirst = false;
    this.state = 'table';
    this.rowFirst = true;
    this.currentTable = name;
  }

  writeRows(rows) {
    if (this.state !== 'table') throw new Error('writeRows 需在 beginTable 之后调用');
    for (const row of rows || []) {
      this._w(`${this.rowFirst ? '' : ','}\n      ${JSON.stringify(row)}`);
      this.rowFirst = false;
    }
  }

  endTable() {
    if (this.state !== 'table') throw new Error('endTable 状态不匹配');
    this._w(this.rowFirst ? ']' : '\n    ]');
    this.state = 'tables';
    this.currentTable = null;
  }

  endTables() {
    if (this.state !== 'tables') throw new Error('endTables 状态不匹配');
    this._w(this.tableFirst ? '}' : '\n  }');
    this.state = 'root';
  }

  end() {
    if (this.state !== 'root') throw new Error(`JSON 未闭合，当前状态：${this.state}`);
    this._w('\n}\n');
    this.state = 'done';
  }
}
