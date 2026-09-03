#!/usr/bin/env node
//【新需求110】把 D1 数据库的全部数据导出到一个 JSON 文件
//
// 用法（在 mcp/ 目录下）：
//   npm run export                       生产库 → workers/backups/d1-export-production-<时间戳>.json
//   npm run export -- --target staging   导出测试库
//   npm run export -- --out /tmp/a.json  指定输出路径
//   npm run export -- --tables students,schools
//   npm run export -- --redact           密码哈希等敏感列脱敏（用于对外分享）
//   npm run export -- --stdout           输出到标准输出（便于管道）
//
// 设计要点：
//   · 只读。全程不含任何写语句
//   · 逐表 keyset（rowid）游标分页，边拉边写，内存不随库体积增长
//   · 导出前后逐表比对 COUNT(*)，对不上数就以非 0 退出 —— 一份对不上数的备份比没有更危险
//   · 同时导出 sqlite_master 的 DDL，使这份 JSON 具备"可重建"能力，而不只是数据快照
//   · 默认拒绝写入仓库内未被 gitignore 的位置（导出文件含真实学生隐私）
//
// 与 `wrangler d1 export` 的分工：wrangler 产出 .sql（适合直接灌库），
// 本脚本产出结构化 JSON（适合程序读取、比对、做数据分析），两者互补。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { D1Client } from './d1Client.js';
import { redactRows } from './guard.js';
import {
  EXPORT_FORMAT, EXPORT_VERSION, DEFAULT_CHUNK, MAX_CHUNK,
  isInternalTable, isValidTableName, quoteIdent, pickRowidAlias,
  buildKeysetQuery, buildOffsetQuery, buildCountQuery, stripRowid,
  defaultExportFileName, assertSafeOutputPath, buildVerification,
  formatBytes, parseEnvFile, JsonExportWriter,
} from './exportCore.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MCP_DIR = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(MCP_DIR, '..');
// 仓库内唯一允许落盘的目录：已在 .gitignore 中（workers/backups/）
const ALLOWED_OUT_DIRS = ['workers/backups'];

// stdout 在 --stdout 模式下是数据通道，所有进度信息一律走 stderr
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

// ─── 参数解析 ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opt = {
    target: null, out: null, tables: null,
    chunk: DEFAULT_CHUNK, force: false, redact: false, stdout: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`参数 ${a} 缺少值`);
      return v;
    };
    switch (a) {
      case '--target': opt.target = String(next()).toLowerCase(); break;
      case '--out': case '-o': opt.out = next(); break;
      case '--tables': opt.tables = String(next()).split(',').map(s => s.trim()).filter(Boolean); break;
      case '--chunk': opt.chunk = Number(next()); break;
      case '--force': opt.force = true; break;
      case '--redact': opt.redact = true; break;
      case '--stdout': opt.stdout = true; break;
      case '--help': case '-h': opt.help = true; break;
      default:
        throw new Error(`未知参数：${a}（用 --help 查看用法）`);
    }
  }
  if (opt.target && !['production', 'staging'].includes(opt.target)) {
    throw new Error(`--target 只能是 production 或 staging，收到：${opt.target}`);
  }
  if (!Number.isFinite(opt.chunk) || opt.chunk < 1 || opt.chunk > MAX_CHUNK) {
    throw new Error(`--chunk 必须是 1~${MAX_CHUNK} 之间的整数`);
  }
  opt.chunk = Math.floor(opt.chunk);
  if (opt.tables) {
    const bad = opt.tables.filter(t => !isValidTableName(t));
    if (bad.length) throw new Error(`表名不合法：${bad.join(', ')}`);
  }
  return opt;
}

function printHelp() {
  log(`
【新需求110】D1 全库 JSON 导出

  node src/exportDb.js [选项]

  --target <production|staging>  目标库，缺省取 JSA_MCP_TARGET（默认 production）
  --out <file.json>             输出路径，缺省 workers/backups/d1-export-<env>-<时间戳>.json
  --tables a,b,c                只导出指定表（缺省全部业务表）
  --chunk <n>                   单次拉取行数，默认 ${DEFAULT_CHUNK}，上限 ${MAX_CHUNK}
  --redact                      对密码哈希 / token 等敏感列脱敏（导出物将不可用于恢复账号）
  --force                       允许写入仓库内未被 gitignore 的位置（不推荐）
  --stdout                      写到标准输出而非文件
`);
}

// ─── 环境变量装载 ────────────────────────────────────────────────────────────
// 直接 node 运行时不必手动 source .env；已存在的 process.env 优先，便于 CI 覆盖。
function loadEnvFile() {
  const envPath = path.join(MCP_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
  }
}

function createClient(target) {
  const databaseId = target === 'staging'
    ? (process.env.D1_DATABASE_ID_STAGING || process.env.D1_DATABASE_ID)
    : process.env.D1_DATABASE_ID;
  return new D1Client({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    databaseId,
    envLabel: target,
  });
}

// ─── 元数据读取 ──────────────────────────────────────────────────────────────
async function fetchTableList(client) {
  const { results } = await client.run(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name"
  );
  return results
    .filter(r => !isInternalTable(r.name))
    .filter(r => isValidTableName(r.name));
}

async function fetchSchema(client) {
  const { results } = await client.run(
    "SELECT type, name, tbl_name, sql FROM sqlite_master " +
    "WHERE type IN ('table','index','view','trigger') ORDER BY type, name"
  );
  return results.filter(r => !isInternalTable(r.name) && !isInternalTable(r.tbl_name || ''));
}

async function fetchColumns(client, table) {
  const { results } = await client.run(`PRAGMA table_info(${quoteIdent(table)})`);
  return results.map(c => ({
    name: c.name, type: c.type, notnull: !!c.notnull, default: c.dflt_value, pk: !!c.pk,
  }));
}

async function fetchCount(client, table) {
  const { results } = await client.run(buildCountQuery(table));
  return Number(results[0]?.n ?? 0);
}

// ─── 逐表导出 ────────────────────────────────────────────────────────────────
/**
 * keyset 分页拉取整表并写入 writer。
 * 若表不支持 rowid（WITHOUT ROWID），退回 LIMIT/OFFSET。
 * @returns {Promise<{rows:number, paging:'rowid'|'offset'}>}
 */
async function dumpTable(client, writer, table, { chunk, redact, columns }) {
  const alias = pickRowidAlias(columns.map(c => c.name));
  let total = 0;

  // ① 优先 rowid 游标
  let cursor = 0;
  let paging = 'rowid';
  let rowidUsable = true;

  for (;;) {
    let batch;
    try {
      const r = await client.run(buildKeysetQuery(table, alias, chunk), [cursor, chunk]);
      batch = r.results;
    } catch (err) {
      if (total === 0 && /rowid/i.test(err.message)) {
        // 表没有 rowid，切换兜底方案
        rowidUsable = false;
        break;
      }
      throw new Error(`导出表 ${table} 失败（已写出 ${total} 行）：${err.message}`);
    }

    if (batch.length === 0) break;

    const rows = [];
    for (const raw of batch) {
      const { row, cursor: c } = stripRowid(raw, alias);
      if (c != null) cursor = c;
      rows.push(row);
    }
    writer.writeRows(redact ? redactRows(rows) : rows);
    total += rows.length;

    if (batch.length < chunk) break;
  }

  // ② 兜底：OFFSET 分页
  if (!rowidUsable) {
    paging = 'offset';
    let offset = 0;
    for (;;) {
      let batch;
      try {
        const r = await client.run(buildOffsetQuery(table, chunk), [chunk, offset]);
        batch = r.results;
      } catch (err) {
        throw new Error(`导出表 ${table} 失败（OFFSET 分页，已写出 ${total} 行）：${err.message}`);
      }
      if (batch.length === 0) break;
      writer.writeRows(redact ? redactRows(batch) : batch);
      total += batch.length;
      offset += batch.length;
      if (batch.length < chunk) break;
    }
  }

  return { rows: total, paging };
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { printHelp(); return; }

  loadEnvFile();
  const target = opt.target || (process.env.JSA_MCP_TARGET || 'production').toLowerCase();
  const client = createClient(target);

  // 输出目标
  let outPath = null;
  let warning = null;
  if (!opt.stdout) {
    const defaultPath = path.join(REPO_ROOT, ALLOWED_OUT_DIRS[0], defaultExportFileName(target));
    const checked = assertSafeOutputPath(opt.out || defaultPath, {
      repoRoot: REPO_ROOT,
      allowedRoots: ALLOWED_OUT_DIRS,
      force: opt.force,
    });
    outPath = checked.path;
    warning = checked.warning;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  }

  log('');
  log('═══ D1 全库 JSON 导出 ═══');
  log(`  目标环境      ${target}${target === 'production' ? '  ⚠️ 生产库' : ''}`);
  log(`  数据库 ID     …${String(client.databaseId).slice(-6)}`);
  log(`  脱敏          ${opt.redact ? '开启（导出物不可用于恢复账号密码）' : '关闭（含完整密码哈希，请妥善保管）'}`);
  log(`  输出          ${opt.stdout ? '<stdout>' : outPath}`);
  if (warning) log(`  ⚠️ ${warning}`);
  log('');

  // 1. 表清单
  const allTables = await fetchTableList(client);
  let tables = allTables.map(t => t.name);
  if (opt.tables) {
    const missing = opt.tables.filter(t => !tables.includes(t));
    if (missing.length) throw new Error(`以下表在数据库中不存在：${missing.join(', ')}`);
    tables = opt.tables;
  }
  if (tables.length === 0) throw new Error('数据库中没有可导出的业务表');
  log(`▸ 待导出 ${tables.length} 张表：${tables.join(', ')}`);

  // 2. 导出前计数（用于结束时核对）
  const expected = {};
  for (const t of tables) expected[t] = await fetchCount(client, t);
  const expectedTotal = Object.values(expected).reduce((a, b) => a + b, 0);
  log(`▸ 预期总行数 ${expectedTotal}`);

  // 3. schema + 列信息
  const schema = await fetchSchema(client);
  const columnsByTable = {};
  for (const t of tables) columnsByTable[t] = await fetchColumns(client, t);

  // 4. 流式写出
  const tmpPath = outPath ? `${outPath}.partial` : null;
  const fd = tmpPath ? fs.openSync(tmpPath, 'w') : null;
  let bytes = 0;
  const sink = (chunk) => {
    const buf = Buffer.from(chunk, 'utf8');
    bytes += buf.length;
    if (fd !== null) fs.writeSync(fd, buf);
    else process.stdout.write(buf);
  };

  const startedAt = new Date();
  const writer = new JsonExportWriter(sink);
  const actual = {};
  const pagingByTable = {};

  try {
    writer.begin();
    writer.section('meta', {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      target,
      database_id: client.databaseId,
      exported_at: startedAt.toISOString(),
      exported_by: 'mcp/src/exportDb.js',
      redacted: opt.redact,
      table_count: tables.length,
      expected_row_total: expectedTotal,
      note: opt.redact
        ? '敏感列已脱敏为 ***REDACTED***，此文件不能用于恢复账号密码。'
        : '此文件包含完整业务数据（含密码哈希与学生个人信息），属于机密材料，禁止提交到代码仓库或对外分享。',
    });
    writer.section('schema', {
      tables: columnsByTable,
      ddl: schema.map(s => ({ type: s.type, name: s.name, tbl_name: s.tbl_name, sql: s.sql })),
    });

    writer.beginTables('tables');
    for (const t of tables) {
      writer.beginTable(t);
      const r = await dumpTable(client, writer, t, {
        chunk: opt.chunk, redact: opt.redact, columns: columnsByTable[t],
      });
      writer.endTable();
      actual[t] = r.rows;
      pagingByTable[t] = r.paging;
      const flag = r.rows === expected[t] ? '✓' : '✗';
      log(`  ${flag} ${t.padEnd(22)} ${String(r.rows).padStart(6)} / ${expected[t]}`
        + (r.paging === 'offset' ? '  (offset 分页)' : ''));
    }
    writer.endTables();

    const verification = buildVerification(expected, actual);
    writer.section('verification', {
      ...verification,
      paging: pagingByTable,
      duration_ms: Date.now() - startedAt.getTime(),
    });
    writer.end();

    if (fd !== null) fs.closeSync(fd);

    // 5. 落盘校验：先解析一遍确认 JSON 合法，再原子改名
    //    半截/损坏的备份最要命 —— 必须在改成正式名字之前发现
    if (tmpPath) {
      const text = fs.readFileSync(tmpPath, 'utf8');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error(`导出文件不是合法 JSON（已保留 ${tmpPath} 供排查）：${err.message}`);
      }
      const parsedTotal = Object.values(parsed.tables || {})
        .reduce((a, rows) => a + (Array.isArray(rows) ? rows.length : 0), 0);
      const exportedTotal = Object.values(actual).reduce((a, b) => a + b, 0);
      if (parsedTotal !== exportedTotal) {
        throw new Error(`回读行数 ${parsedTotal} 与写出行数 ${exportedTotal} 不一致，导出文件可疑`);
      }
      fs.renameSync(tmpPath, outPath);
      // 备份含隐私，收紧权限到仅所有者可读写
      try { fs.chmodSync(outPath, 0o600); } catch { /* 某些文件系统不支持，忽略 */ }
    }

    log('');
    if (!verification.ok) {
      log('❌ 计数核对失败，以下表导出行数与数据库不一致：');
      for (const m of verification.mismatches) {
        log(`   ${m.table}: 期望 ${m.expected}，实际 ${m.exported}`);
      }
      log('   （导出期间数据被并发修改也会造成差异，建议重跑一次确认）');
      process.exitCode = 2;
    } else {
      log(`✅ 导出完成：${tables.length} 张表 / ${Object.values(actual).reduce((a, b) => a + b, 0)} 行 / ${formatBytes(bytes)}`);
    }
    if (outPath) log(`   文件：${outPath}`);
    if (!opt.redact) log('   ⚠️ 该文件含密码哈希与学生个人信息，请勿提交仓库、勿通过聊天工具传输。');
    log('');
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* 已关闭 */ } }
    if (tmpPath && fs.existsSync(tmpPath)) {
      // 保留 .partial 便于排查，但明确告知它不是可用备份
      log(`⚠️ 已中断，未完成的文件保留在：${tmpPath}（不是可用备份）`);
    }
    throw err;
  }
}

main().catch(err => {
  log(`\n❌ 导出失败：${err.message}\n`);
  process.exit(1);
});
