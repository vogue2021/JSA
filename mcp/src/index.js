#!/usr/bin/env node
//【新需求106】JSA D1 数据库 MCP 服务
//
// 作用：把 JSA 的生产（或测试）D1 数据库以 MCP 工具的形式暴露给 AI Agent，
//让 Agent 既能直接查数据回答业务问题，也能在授权后代为改数据。
//
// 安全模型（详见 guard.js 与 README.md）：
//   · 默认只读。写操作需显式设置 JSA_MCP_ALLOW_WRITE=true
//   · 写操作还需在调用时传 confirm=true，否则只返回预演结果（含影响行数预估）
//   · DDL（建表/改表/删表）永久禁止，schema 变更只能走迁移脚本人工执行
//   · UPDATE/DELETE 必须带 WHERE，且目标表须在白名单内
//   · 一次只能执行一条语句，杜绝分号拼接
//   · 密码哈希等敏感列在返回前统一脱敏
//   · 所有写操作写入本地审计日志
//
// 采用 SDK 的低层 Server API + 手写 JSON Schema：不绑定 zod 版本，长期更稳。

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createClientFromEnv } from './d1Client.js';
import {
  assertReadable, assertWritable, buildImpactCountSql,
  redactRows, isWriteEnabled, sensitiveColumnList, WRITABLE_TABLES,
} from './guard.js';
import { audit } from './audit.js';

// ─── 学生表可通过结构化工具更新的字段白名单 ──────────────────────────────────
// 故意排除 student_id / user_id / has_account / is_active 等身份与状态字段：
// 它们牵涉账号级联与权限，必须走业务接口，不允许 Agent 直接改库。
const STUDENT_UPDATABLE = {
  name: 'text', email: 'text', phone: 'text', birthday: 'text',
  high_school: 'text', language_school: 'text', lang_school_shift: 'text',
  subject: 'text', package_name: 'text', package_end_date: 'text',
  teacher_id: 'text', academic_advisor_id: 'text', consultant_id: 'text',
  has_china_high_school_record: 'text', target_level: 'text',
  jlpt_score: 'text', english_score: 'text',
  // 【新需求106】"确认无相关成绩"标记（JSON 字符串）
  score_none_flags: 'json',
  follow_up_notes: 'json', tags: 'json',
  jlpt_scores: 'json', english_scores: 'json', eju_scores: 'json',
  overseas_certifications: 'json',
};

const client = createClientFromEnv();
const TARGET = client.envLabel;

// ─── 工具定义 ────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'db_info',
    description:
      '查看当前 MCP 连接的数据库环境与安全模式。建议在任何写操作前先调用一次，' +
      '确认自己连的是 staging 还是 production。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_tables',
    description: '列出数据库中所有业务表及其行数。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'describe_table',
    description: '查看某张表的字段结构（列名、类型、默认值、是否可空）。',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string', description: '表名，如 students' } },
      required: ['table'],
      additionalProperties: false,
    },
  },
  {
    name: 'query',
    description:
      '执行只读 SQL 查询（SELECT / WITH / EXPLAIN）。参数请用? 占位并通过 params 传入，' +
      '不要把值拼进 SQL 字符串。密码等敏感列会自动脱敏。',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: '一条只读 SQL，禁止分号拼接多条' },
        params: {
          type: 'array',
          description: 'SQL 中 ? 占位符对应的绑定参数，按顺序排列',
          items: { type: ['string', 'number', 'null'] },
        },
        limit: { type: 'number', description: '返回行数上限，默认 200，最大 1000' },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
  {
    name: 'execute',
    description:
      '执行写 SQL（INSERT / UPDATE / DELETE）。需要满足：① 服务以可写模式启动；' +
      '②调用时传 confirm=true。不传 confirm 时只做预演并返回预计影响行数，不会真正写库。' +
      'UPDATE/DELETE 必须带 WHERE。禁止任何建表/改表/删表操作。',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: '一条写 SQL，禁止分号拼接多条' },
        params: {
          type: 'array',
          description: 'SQL 中 ? 占位符对应的绑定参数，按顺序排列',
          items: { type: ['string', 'number', 'null'] },
        },
        confirm: { type: 'boolean', description: '置为 true 才真正执行；缺省为预演' },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_students',
    description:
      '结构化查询学生列表（推荐优先用这个而不是手写 SQL）。自动排除已停用学生与孤儿数据。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '按姓名 / 学号 / 邮箱模糊搜索' },
        teacher_id: { type: 'string', description: '按负责老师（升学老师）筛选' },
        target_level: { type: 'string', description: '目标学位：学部 / 修士 / 博士' },
        subject: { type: 'string', description: '文理科：文科 / 理科' },
        limit: { type: 'number', description: '返回行数上限，默认 100，最大 500' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_student',
    description:
      '获取单个学生的完整档案：基本信息 + 报考学校 + 材料 + 事件。传学号（student_id）。',
    inputSchema: {
      type: 'object',
      properties: { student_id: { type: 'string', description: '学号，如 2026084' } },
      required: ['student_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_student',
    description:
      '按字段白名单更新单个学生（比手写 UPDATE 安全，天然限定单行）。' +
      '同样需要可写模式 + confirm=true。身份类字段（学号/账号/启用状态）不允许通过此工具修改。',
    inputSchema: {
      type: 'object',
      properties: {
        student_id: { type: 'string', description: '学号' },
        fields: {
          type: 'object',
          description:
            '要更新的字段，键名用数据库列名。可用字段：' + Object.keys(STUDENT_UPDATABLE).join(', '),
        },
        confirm: { type: 'boolean', description: '置为 true 才真正执行；缺省为预演' },
      },
      required: ['student_id', 'fields'],
      additionalProperties: false,
    },
  },
  {
    name: 'stats_overview',
    description: '业务总览统计：学生数、老师数、报考学校数、各申请状态分布、目标学位分布。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

// ─── 工具实现 ────────────────────────────────────────────────────────────────

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function fail(message) {
  return { content: [{ type: 'text', text: `❌ ${message}` }], isError: true };
}

function clampLimit(v, def, max) {
  const n = Number.isFinite(v) ? Math.floor(v) : def;
  return Math.max(1, Math.min(n, max));
}

async function toolDbInfo() {
  const writable = isWriteEnabled();
  return ok({
    target: TARGET,
    database_id_suffix: '…' + String(client.databaseId).slice(-6),
    mode: writable ? 'read-write' : 'read-only',
    write_enabled: writable,
    writable_tables: [...WRITABLE_TABLES],
    redacted_columns: sensitiveColumnList(),
    notes: [
      TARGET === 'production'
        ? '⚠️ 当前连接的是【生产库】，写操作会影响真实业务数据。'
        : '当前连接的是测试库。',
      writable
        ? '写操作已启用，但每次写仍需传 confirm=true。'
        : '写操作已禁用。需要写入请设置 JSA_MCP_ALLOW_WRITE=true 并重启 MCP 服务。',
      'DDL（建表/改表/删表）在任何模式下都被禁止，schema 变更请走workers/migration-*.sql。',
    ],
  });
}

async function toolListTables() {
  const { results } = await client.run(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
  );
  const tables = [];
  for (const row of results) {
    // 表名来自 sqlite_master，不是用户输入，可安全内插；且已被上面的过滤限定
    const { results: cnt } = await client.run(`SELECT COUNT(*) AS n FROM "${row.name}"`);
    tables.push({ table: row.name, rows: cnt[0]?.n ?? 0 });
  }
  return ok({ target: TARGET, table_count: tables.length, tables });
}

async function toolDescribeTable(args) {
  const table = String(args.table || '').trim();
  // 只允许合法标识符，杜绝把任意片段带进 PRAGMA
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    return fail('表名不合法（只允许字母、数字、下划线）');
  }
  // 先确认表存在，避免 PRAGMA 静默返回空导致误判
  const { results: exists } = await client.run(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [table]
  );
  if (exists.length === 0) return fail(`表 ${table} 不存在`);

  const { results } = await client.run(`PRAGMA table_info("${table}")`);
  return ok({
    table,
    columns: results.map(c => ({
      name: c.name, type: c.type,
      notnull: !!c.notnull, default: c.dflt_value, pk: !!c.pk,
    })),
  });
}

async function toolQuery(args) {
  const sql = String(args.sql || '');
  const params = Array.isArray(args.params) ? args.params : [];
  const limit = clampLimit(args.limit, 200, 1000);

  try {
    assertReadable(sql);
  } catch (err) {
    await audit({ tool: 'query', target: TARGET, sql, params, outcome: 'rejected', error: err.message });
    return fail(err.message);
  }

  const { results, meta } = await client.run(sql, params);
  const truncated = results.length > limit;
  return ok({
    target: TARGET,
    row_count: results.length,
    truncated,
    rows: redactRows(truncated ? results.slice(0, limit) : results),
    meta: { rows_read: meta.rows_read, duration_ms: meta.duration },
  });
}

async function toolExecute(args) {
  const sql = String(args.sql || '');
  const params = Array.isArray(args.params) ? args.params : [];
  const confirm = args.confirm === true;

  let checked;
  try {
    checked = assertWritable(sql);
  } catch (err) {
    await audit({ tool: 'execute', target: TARGET, sql, params, outcome: 'rejected', error: err.message });
    return fail(err.message);
  }

  // 预演：估算影响行数，不写库
  if (!confirm) {
    let estimate = null;
    let estimateNote = '该语句类型无法预估影响行数（例如 INSERT）。';
    const countSql = buildImpactCountSql(sql);
    if (countSql) {
      try {
        const { results } = await client.run(countSql, params);
        estimate = results[0]?.affected ?? null;
        estimateNote = '预估基于与写语句相同的 WHERE 条件。';
      } catch (err) {
        estimateNote = `影响行数预估失败：${err.message}`;
      }
    }
    return ok({
      dry_run: true,
      target: TARGET,
      table: checked.table,
      verb: checked.verb,
      estimated_affected_rows: estimate,
      note: estimateNote,
      next_step: '确认无误后，用完全相同的 sql 与 params 再调一次并传 confirm: true。',
    });
  }

  try {
    const { meta } = await client.run(sql, params);
    await audit({ tool: 'execute', target: TARGET, sql, params, outcome: 'ok', meta });
    return ok({
      dry_run: false,
      target: TARGET,
      table: checked.table,
      changes: meta.changes ?? null,
      rows_written: meta.rows_written ?? null,
      duration_ms: meta.duration ?? null,
    });
  } catch (err) {
    await audit({ tool: 'execute', target: TARGET, sql, params, outcome: 'error', error: err.message });
    return fail(err.message);
  }
}

// 与后端 students.js 的ORPHAN_GUARD 保持一致：
// 【新需求105】user_id 有值但在 users 表里查不到的记录属于"账号已删除"的孤儿，不应算有效学生。
const ORPHAN_GUARD =
  " AND (user_id IS NULL OR user_id = '' OR user_id IN (SELECT id FROM users))";

async function toolListStudents(args) {
  const limit = clampLimit(args.limit, 100, 500);
  let sql = 'SELECT student_id, name, email, phone, teacher_id, subject, target_level, '
    + 'package_name, high_school, language_school, has_china_high_school_record, '
    + 'score_none_flags, has_account, created_at '
    + 'FROM students WHERE is_active = 1' + ORPHAN_GUARD;
  const params = [];

  if (args.keyword) {
    sql += ' AND (name LIKE ? OR student_id LIKE ? OR email LIKE ?)';
    const kw = `%${args.keyword}%`;
    params.push(kw, kw, kw);
  }
  if (args.teacher_id) { sql += ' AND teacher_id = ?'; params.push(args.teacher_id); }
  if (args.target_level) { sql += ' AND target_level = ?'; params.push(args.target_level); }
  if (args.subject) { sql += ' AND subject = ?'; params.push(args.subject); }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await client.run(sql, params);
  return ok({ target: TARGET, row_count: results.length, students: redactRows(results) });
}

async function toolGetStudent(args) {
  const sid = String(args.student_id || '').trim();
  if (!sid) return fail('student_id 不能为空');

  const { results: base } = await client.run(
    'SELECT * FROM students WHERE student_id = ? LIMIT 1', [sid]
  );
  if (base.length === 0) return fail(`未找到学号为 ${sid} 的学生`);

  const [schools, materials, events] = await Promise.all([
    client.run('SELECT * FROM schools WHERE student_id = ? ORDER BY exam_date', [sid]),
    client.run('SELECT * FROM materials WHERE student_id = ?', [sid]),
    client.run('SELECT * FROM events WHERE student_id = ? ORDER BY date DESC LIMIT 100', [sid]),
  ]);

  return ok({
    target: TARGET,
    student: redactRows(base)[0],
    schools: schools.results,
    materials: materials.results,
    events: events.results,
  });
}

async function toolUpdateStudent(args) {
  const sid = String(args.student_id || '').trim();
  const fields = (args.fields && typeof args.fields === 'object' && !Array.isArray(args.fields))
    ? args.fields : null;
  const confirm = args.confirm === true;

  if (!sid) return fail('student_id 不能为空');
  if (!fields || Object.keys(fields).length === 0) return fail('fields 不能为空');

  const unknown = Object.keys(fields).filter(k => !(k in STUDENT_UPDATABLE));
  if (unknown.length > 0) {
    return fail(
      `以下字段不允许通过本工具修改：${unknown.join(', ')}。\n` +
      `可用字段：${Object.keys(STUDENT_UPDATABLE).join(', ')}`
    );
  }

  if (!isWriteEnabled()) {
    const msg = '写操作已被禁用。当前 MCP 以只读模式运行，请设置 JSA_MCP_ALLOW_WRITE=true 后重启。';
    await audit({ tool: 'update_student', target: TARGET, sql: `UPDATE students(${sid})`, params: [], outcome: 'rejected', error: msg });
    return fail(msg);
  }

  const { results: exists } = await client.run(
    'SELECT student_id, name FROM students WHERE student_id = ? LIMIT 1', [sid]
  );
  if (exists.length === 0) return fail(`未找到学号为 ${sid} 的学生`);

  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    // JSON 类字段允许直接传对象/数组，这里统一序列化
    params.push(STUDENT_UPDATABLE[k] === 'json' && typeof v !== 'string'
      ? JSON.stringify(v ?? null)
      : v);
  }
  sets.push("updated_at = datetime('now')");
  const sql = `UPDATE students SET ${sets.join(', ')} WHERE student_id = ?`;
  params.push(sid);

  if (!confirm) {
    return ok({
      dry_run: true,
      target: TARGET,
      student: exists[0],
      will_update: Object.keys(fields),
      estimated_affected_rows: 1,
      next_step: '确认无误后再调一次并传 confirm: true。',
    });
  }

  try {
    const { meta } = await client.run(sql, params);
    await audit({ tool: 'update_student', target: TARGET, sql, params, outcome: 'ok', meta });
    return ok({
      dry_run: false, target: TARGET,
      student_id: sid, updated_fields: Object.keys(fields),
      changes: meta.changes ?? null,
    });
  } catch (err) {
    await audit({ tool: 'update_student', target: TARGET, sql, params, outcome: 'error', error: err.message });
    return fail(err.message);
  }
}

async function toolStatsOverview() {
  const { results } = await client.run(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE is_active = 1) AS active_students,
      (SELECT COUNT(*) FROM students WHERE is_active = 1 AND has_account = 1) AS students_with_account,
      (SELECT COUNT(*) FROM teachers) AS teachers,
      (SELECT COUNT(*) FROM schools) AS school_applications,
      (SELECT COUNT(DISTINCT name) FROM schools) AS distinct_universities,
      (SELECT COUNT(*) FROM materials) AS materials,
      (SELECT COUNT(*) FROM events) AS events
  `);
  const [byStatus, byLevel] = await Promise.all([
    client.run('SELECT status, COUNT(*) AS n FROM schools GROUP BY status ORDER BY n DESC'),
    client.run('SELECT target_level, COUNT(*) AS n FROM students WHERE is_active = 1 GROUP BY target_level ORDER BY n DESC'),
  ]);
  return ok({
    target: TARGET,
    totals: results[0] || {},
    application_status_distribution: byStatus.results,
    target_level_distribution: byLevel.results,
  });
}

const HANDLERS = {
  db_info: toolDbInfo,
  list_tables: toolListTables,
  describe_table: toolDescribeTable,
  query: toolQuery,
  execute: toolExecute,
  list_students: toolListStudents,
  get_student: toolGetStudent,
  update_student: toolUpdateStudent,
  stats_overview: toolStatsOverview,
};

// ─── 启动 ────────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'jsa-d1-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const handler = HANDLERS[name];
  if (!handler) return fail(`未知工具：${name}`);
  try {
    return await handler(args || {});
  } catch (err) {
    // 任何未预期异常都要转成工具错误返回，不能让进程崩掉
    return fail(err.message || String(err));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout 是 MCP 协议通道，启动信息只能写 stderr
process.stderr.write(
  `[jsa-d1-mcp] 已启动 |目标: ${TARGET} | 模式: ${isWriteEnabled() ? 'read-write' : 'read-only'}\n`
);
