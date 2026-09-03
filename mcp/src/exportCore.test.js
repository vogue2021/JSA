//【新需求110】导出内核验证脚本
//
// 与 guard.test.js 同一形态：不依赖测试框架、不连网络、不碰数据库，
// 直接 `node mcp/src/exportCore.test.js` 即可复验。
//
// 重点验证三类容易出错、且一旦出错后果严重的地方：
//   1. JSON 流式写出的括号闭合 —— 写坏了就是一份不可解析的废备份
//   2. 输出路径安全校验 —— 写错位置就是把学生隐私推上 git
//   3. 计数核对 —— 漏行必须被发现，不能静默产出"看起来正常"的残缺备份

import assert from 'node:assert';
import path from 'node:path';

import {
  isInternalTable, isValidTableName, quoteIdent, pickRowidAlias,
  buildKeysetQuery, buildOffsetQuery, buildCountQuery, stripRowid,
  defaultExportFileName, assertSafeOutputPath, buildVerification,
  formatBytes, parseEnvFile, JsonExportWriter,
  EXPORT_FORMAT, EXPORT_VERSION,
} from './exportCore.js';

let pass = 0;
let fail = 0;

function t(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    pass++;
  } catch (err) {
    console.log(`  ❌ ${label} —— ${err.message}`);
    fail++;
  }
}

function tReject(label, fn, pattern) {
  try {
    fn();
    console.log(`  ❌ ${label} —— 应该抛错，但通过了`);
    fail++;
  } catch (err) {
    if (pattern && !pattern.test(err.message)) {
      console.log(`  ❌ ${label} —— 报错信息不符：${err.message}`);
      fail++;
      return;
    }
    console.log(`  ✅ ${label}`);
    pass++;
  }
}

const REPO = '/tmp/fake-repo';
const ALLOWED = ['workers/backups'];

console.log('\n═══ 需求110 导出内核验证 ═══\n');

// ─── 1. 表名与标识符 ────────────────────────────────────────────────────────
console.log('▸ 表名与标识符');

t('sqlite_ 前缀识别为内部表', () => {
  assert.strictEqual(isInternalTable('sqlite_sequence'), true);
});
t('_cf_ 前缀识别为内部表', () => {
  assert.strictEqual(isInternalTable('_cf_METADATA'), true);
});
t('d1_ 前缀识别为内部表', () => {
  assert.strictEqual(isInternalTable('d1_migrations'), true);
});
t('业务表不被误判为内部表', () => {
  assert.strictEqual(isInternalTable('students'), false);
});
t('合法表名通过校验', () => {
  assert.strictEqual(isValidTableName('school_database'), true);
});
t('带空格/引号的表名不合法', () => {
  assert.strictEqual(isValidTableName('students; DROP'), false);
  assert.strictEqual(isValidTableName('"students"'), false);
});
t('quoteIdent 加双引号', () => {
  assert.strictEqual(quoteIdent('students'), '"students"');
});
tReject('quoteIdent 拒绝注入型表名', () => quoteIdent('students" ; DROP TABLE users --'), /非法的表名/);

// ─── 2. rowid 别名与分页 SQL ────────────────────────────────────────────────
console.log('\n▸ rowid 别名与分页 SQL');

t('默认 rowid 别名为 __rowid__', () => {
  assert.strictEqual(pickRowidAlias(['id', 'name']), '__rowid__');
});
t('表里真有 __rowid__ 列时自动避让（不覆盖真实数据）', () => {
  assert.strictEqual(pickRowidAlias(['id', '__rowid__']), '__rowid_1__');
  assert.strictEqual(pickRowidAlias(['__rowid__', '__rowid_1__']), '__rowid_2__');
});
t('别名避让不区分大小写', () => {
  assert.strictEqual(pickRowidAlias(['__ROWID__']), '__rowid_1__');
});
t('keyset 查询用 rowid 游标而非 OFFSET', () => {
  const sql = buildKeysetQuery('students', '__rowid__', 500);
  assert.match(sql, /WHERE rowid > \?/);
  assert.match(sql, /ORDER BY rowid/);
  assert.match(sql, /LIMIT \?/);
  assert.ok(!/OFFSET/i.test(sql), 'keyset 查询不应出现 OFFSET');
});
t('分页 SQL 里没有内插的字面量（值全走绑定）', () => {
  const sql = buildKeysetQuery('students', '__rowid__', 500);
  assert.ok(!sql.includes('500'), 'limit 不应被内插进 SQL');
  assert.strictEqual((sql.match(/\?/g) || []).length, 2);
});
t('OFFSET 兜底查询两个占位符', () => {
  const sql = buildOffsetQuery('students', 100);
  assert.strictEqual((sql.match(/\?/g) || []).length, 2);
});
t('COUNT 查询表名被引号包裹', () => {
  assert.strictEqual(buildCountQuery('students'), 'SELECT COUNT(*) AS n FROM "students"');
});

// ─── 3. rowid 剥离 ──────────────────────────────────────────────────────────
console.log('\n▸ rowid 剥离');

t('导出行里不残留 rowid 辅助列', () => {
  const { row, cursor } = stripRowid({ __rowid__: 42, id: 1, name: '张三' }, '__rowid__');
  assert.deepStrictEqual(row, { id: 1, name: '张三' });
  assert.strictEqual(cursor, 42);
});
t('rowid 为 0 时游标仍能取到（不被当成缺失）', () => {
  const { cursor } = stripRowid({ __rowid__: 0, id: 1 }, '__rowid__');
  assert.strictEqual(cursor, 0);
});
t('业务列名与别名同名时只剥掉别名那一份', () => {
  const alias = pickRowidAlias(['__rowid__']);
  const { row } = stripRowid({ [alias]: 7, __rowid__: 'business-value' }, alias);
  assert.deepStrictEqual(row, { __rowid__: 'business-value' });
});

// ─── 4. 文件名 ──────────────────────────────────────────────────────────────
console.log('\n▸ 文件名');

t('文件名含环境与本地时间戳', () => {
  const name = defaultExportFileName('production', new Date(2026, 8, 3, 9, 5, 7));
  assert.strictEqual(name, 'd1-export-production-20260903-090507.json');
});
t('文件名用本地时间而非 UTC（避免与日本时区差一天）', () => {
  // 本地 2026-01-01 00:30 在 UTC 下是前一天，若用 toISOString 会得到 20251231
  const name = defaultExportFileName('staging', new Date(2026, 0, 1, 0, 30, 0));
  assert.ok(name.includes('20260101'), `期望包含 20260101，实际 ${name}`);
});
t('环境名中的异常字符被剔除', () => {
  const name = defaultExportFileName('prod/../etc', new Date(2026, 0, 1, 0, 0, 0));
  assert.ok(!name.includes('/'), '文件名不应含路径分隔符');
});

// ─── 5. 输出路径安全（重点）────────────────────────────────────────────────
console.log('\n▸ 输出路径安全');

t('允许写入已 gitignore 的备份目录', () => {
  const r = assertSafeOutputPath(path.join(REPO, 'workers/backups/a.json'), { repoRoot: REPO, allowedRoots: ALLOWED });
  assert.strictEqual(r.insideRepo, true);
  assert.strictEqual(r.warning, null);
});
tReject('拒绝写入仓库根目录（会被 git add . 带走）',
  () => assertSafeOutputPath(path.join(REPO, 'dump.json'), { repoRoot: REPO, allowedRoots: ALLOWED }),
  /未被 \.gitignore 覆盖/);
tReject('拒绝写入 src 目录',
  () => assertSafeOutputPath(path.join(REPO, 'src/data.json'), { repoRoot: REPO, allowedRoots: ALLOWED }),
  /未被 \.gitignore 覆盖/);
t('--force 可放行仓库内其它位置，但必须带警告', () => {
  const r = assertSafeOutputPath(path.join(REPO, 'dump.json'), { repoRoot: REPO, allowedRoots: ALLOWED, force: true });
  assert.ok(r.warning, '强制写入必须返回警告');
});
t('仓库外路径放行并提示', () => {
  const r = assertSafeOutputPath('/tmp/elsewhere/a.json', { repoRoot: REPO, allowedRoots: ALLOWED });
  assert.strictEqual(r.insideRepo, false);
  assert.ok(r.warning);
});
tReject('非 .json 后缀被拒绝',
  () => assertSafeOutputPath(path.join(REPO, 'workers/backups/a.sql'), { repoRoot: REPO, allowedRoots: ALLOWED }),
  /必须以 \.json 结尾/);
tReject('空路径被拒绝',
  () => assertSafeOutputPath('', { repoRoot: REPO, allowedRoots: ALLOWED }),
  /不能为空/);
t('备份目录内的子目录也允许', () => {
  const r = assertSafeOutputPath(path.join(REPO, 'workers/backups/2026/a.json'), { repoRoot: REPO, allowedRoots: ALLOWED });
  assert.strictEqual(r.insideRepo, true);
});
tReject('用 .. 绕出备份目录后仍被拦住',
  () => assertSafeOutputPath(path.join(REPO, 'workers/backups/../../leak.json'), { repoRoot: REPO, allowedRoots: ALLOWED }),
  /未被 \.gitignore 覆盖/);

// ─── 6. 计数核对（重点）────────────────────────────────────────────────────
console.log('\n▸ 计数核对');

t('全部一致时通过', () => {
  const v = buildVerification({ students: 143, schools: 625 }, { students: 143, schools: 625 });
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.mismatches.length, 0);
});
t('漏行被判定为失败（不能静默产出残缺备份）', () => {
  const v = buildVerification({ students: 143 }, { students: 140 });
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.mismatches, [{ table: 'students', expected: 143, exported: 140 }]);
});
t('空表（0 行）算一致，不误报', () => {
  const v = buildVerification({ audit_logs: 0 }, { audit_logs: 0 });
  assert.strictEqual(v.ok, true);
});
t('表完全没导出（undefined）按 0 计并报不一致', () => {
  const v = buildVerification({ students: 5 }, {});
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.tables.students.exported, 0);
});

// ─── 7. 流式 JSON 写出（重点）──────────────────────────────────────────────
console.log('\n▸ 流式 JSON 写出');

function collect(fn) {
  let buf = '';
  const w = new JsonExportWriter(s => { buf += s; });
  fn(w);
  return buf;
}

t('完整结构可被 JSON.parse 解析', () => {
  const text = collect(w => {
    w.begin();
    w.section('meta', { format: EXPORT_FORMAT, version: EXPORT_VERSION });
    w.beginTables('tables');
    w.beginTable('students');
    w.writeRows([{ id: 1, name: '张三' }, { id: 2, name: '李四' }]);
    w.endTable();
    w.beginTable('audit_logs');
    w.endTable();
    w.endTables();
    w.section('verification', { ok: true });
    w.end();
  });
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.meta.format, EXPORT_FORMAT);
  assert.strictEqual(parsed.tables.students.length, 2);
  assert.deepStrictEqual(parsed.tables.audit_logs, []);
  assert.strictEqual(parsed.verification.ok, true);
});

t('空表输出 []，不是 null 也不是缺键', () => {
  const text = collect(w => {
    w.begin();
    w.beginTables();
    w.beginTable('empty');
    w.endTable();
    w.endTables();
    w.end();
  });
  assert.deepStrictEqual(JSON.parse(text).tables, { empty: [] });
});

t('分多批写入同一张表时行序与内容保持', () => {
  const text = collect(w => {
    w.begin();
    w.beginTables();
    w.beginTable('t');
    w.writeRows([{ i: 1 }, { i: 2 }]);
    w.writeRows([{ i: 3 }]);
    w.writeRows([]);
    w.writeRows([{ i: 4 }]);
    w.endTable();
    w.endTables();
    w.end();
  });
  assert.deepStrictEqual(JSON.parse(text).tables.t.map(r => r.i), [1, 2, 3, 4]);
});

t('中文 / 引号 / 换行 / null 正确转义', () => {
  const row = { name: '田中 "太郎"', note: '第一行\n第二行\t制表', nil: null, num: 0 };
  const text = collect(w => {
    w.begin();
    w.beginTables();
    w.beginTable('t');
    w.writeRows([row]);
    w.endTable();
    w.endTables();
    w.end();
  });
  assert.deepStrictEqual(JSON.parse(text).tables.t[0], row);
});

t('一张表都没有时 tables 为空对象', () => {
  const text = collect(w => { w.begin(); w.beginTables(); w.endTables(); w.end(); });
  assert.deepStrictEqual(JSON.parse(text).tables, {});
});

t('每行记录独占一行（便于 grep / diff）', () => {
  const text = collect(w => {
    w.begin();
    w.beginTables();
    w.beginTable('t');
    w.writeRows([{ i: 1 }, { i: 2 }]);
    w.endTable();
    w.endTables();
    w.end();
  });
  const rowLines = text.split('\n').filter(l => l.trim().startsWith('{"i"'));
  assert.strictEqual(rowLines.length, 2);
});

tReject('未闭合表就 end 会报错（防止产出半截 JSON）', () => {
  const w = new JsonExportWriter(() => {});
  w.begin();
  w.beginTables();
  w.beginTable('t');
  w.end();
}, /未闭合|状态/);

tReject('beginTable 之前 writeRows 会报错', () => {
  const w = new JsonExportWriter(() => {});
  w.begin();
  w.writeRows([{ a: 1 }]);
}, /beginTable/);

tReject('begin 不可重复调用', () => {
  const w = new JsonExportWriter(() => {});
  w.begin();
  w.begin();
}, /只能调用一次/);

// ─── 8. 杂项 ────────────────────────────────────────────────────────────────
console.log('\n▸ 杂项');

t('formatBytes 分档正确', () => {
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(2048), '2.0 KB');
  assert.strictEqual(formatBytes(5 * 1024 * 1024), '5.00 MB');
});
t('parseEnvFile 跳过注释与空行', () => {
  const env = parseEnvFile('# 注释\n\nA=1\nB = two \n');
  assert.deepStrictEqual(env, { A: '1', B: 'two' });
});
t('parseEnvFile 去掉包裹引号但保留值内的等号', () => {
  const env = parseEnvFile('TOKEN="ab=cd"\nX=\'y\'');
  assert.strictEqual(env.TOKEN, 'ab=cd');
  assert.strictEqual(env.X, 'y');
});
t('parseEnvFile 忽略非法键名（不污染 process.env）', () => {
  const env = parseEnvFile('1BAD=x\nfoo-bar=y\nGOOD=z');
  assert.deepStrictEqual(Object.keys(env), ['GOOD']);
});

// ─── 汇总 ───────────────────────────────────────────────────────────────────
console.log(`\n═══ 结果：${pass} 通过 / ${fail} 失败 ═══\n`);
process.exit(fail === 0 ? 0 : 1);
