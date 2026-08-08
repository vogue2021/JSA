//【新需求106】安全闸门验证脚本
//
// 这不是单元测试框架下的测试，而是一个可独立运行的断言脚本 ——
// 目的是让"闸门到底拦不拦得住"这件事可被随时复验，而不是靠读代码相信。
//
// 用法：node mcp/src/guard.test.js
// 不需要任何环境变量，不连接数据库。

import {
  assertReadable, assertWritable, classify,
  buildImpactCountSql, redactRows, extractWriteTable,
} from './guard.js';

let pass = 0;
let fail = 0;

function expectReject(label, fn, expectPattern) {
  try {
    fn();
    console.log(`  ❌ ${label} —— 应该被拒绝，但通过了`);
    fail++;
  } catch (err) {
    if (expectPattern && !expectPattern.test(err.message)) {
      console.log(`  ❌ ${label} ——拒绝原因不符：${err.message}`);
      fail++;
      return;
    }
    console.log(`  ✅ ${label}`);
    pass++;
  }
}

function expectPass(label, fn) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    pass++;
  } catch (err) {
    console.log(`  ❌ ${label} —— 应该通过，但被拒绝：${err.message}`);
    fail++;
  }
}

function expectEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}\n     实际: ${a}\n     期望: ${e}`);
    fail++;
  }
}

console.log('\n═══ 只读通道 (query) ═══');
expectPass('普通 SELECT', () => assertReadable('SELECT * FROM students WHERE student_id = ?'));
expectPass('WITH ... SELECT', () => assertReadable('WITH t AS (SELECT 1 AS a) SELECT * FROM t'));
expectPass('EXPLAIN', () => assertReadable('EXPLAIN SELECT * FROM students'));
expectReject('写语句走只读通道', () => assertReadable('UPDATE students SET name = ?'), /只读查询/);
expectReject('分号拼接多语句', () => assertReadable('SELECT 1; DROP TABLE students'), /一条语句/);
expectReject('CTE 里藏写操作', () => assertReadable('WITH t AS (SELECT 1) DELETE FROM students WHERE 1=1'), /CTE/);
expectReject('DROP', () => assertReadable('DROP TABLE students'), /禁止执行 DROP/);
expectReject('PRAGMA', () => assertReadable('PRAGMA table_info(students)'), /禁止执行 PRAGMA/);
expectReject('空 SQL', () => assertReadable('   '), /为空/);
expectReject('注释伪装后仍是 DROP', () => assertReadable('-- harmless\n DROP TABLE students'), /禁止执行 DROP/);

console.log('\n═══ 写通道 (execute) —— 只读模式下 ═══');
delete process.env.JSA_MCP_ALLOW_WRITE;
expectReject('只读模式拒绝 UPDATE', () => assertWritable("UPDATE students SET name = ? WHERE student_id = ?"), /写操作已被禁用/);
expectReject('只读模式拒绝 DELETE', () => assertWritable('DELETE FROM students WHERE student_id = ?'), /写操作已被禁用/);

console.log('\n═══ 写通道 (execute) —— 写模式开启后 ═══');
process.env.JSA_MCP_ALLOW_WRITE = 'true';
expectPass('带 WHERE 的 UPDATE', () => assertWritable('UPDATE students SET name = ? WHERE student_id = ?'));
expectPass('带 WHERE 的 DELETE', () => assertWritable('DELETE FROM schools WHERE id = ?'));
expectPass('INSERT', () => assertWritable('INSERT INTO events (student_id, title) VALUES (?, ?)'));
expectReject('全表 UPDATE', () => assertWritable('UPDATE students SET name = ?'), /必须带 WHERE/);
expectReject('全表 DELETE', () => assertWritable('DELETE FROM students'), /必须带 WHERE/);
expectReject('写模式下 DROP 依然禁止', () => assertWritable('DROP TABLE students'), /禁止执行 DROP/);
expectReject('写模式下 ALTER 依然禁止', () => assertWritable('ALTER TABLE students ADD COLUMN x TEXT'), /禁止执行 ALTER/);
expectReject('非白名单表', () => assertWritable('UPDATE sqlite_master SET name = ? WHERE 1=1'), /不在可写白名单/);
expectReject('只读语句走写通道', () => assertWritable('SELECT 1'), /只读语句/);
expectReject('写通道也拦多语句', () => assertWritable("UPDATE students SET name='a' WHERE student_id='1'; DROP TABLE students"), /一条语句/);

console.log('\n═══ 表名解析 ═══');
expectEqual('INSERT INTO', extractWriteTable('INSERT INTO students (a) VALUES (?)'), 'students');
expectEqual('UPDATE', extractWriteTable('UPDATE  schools SET a = ?'), 'schools');
expectEqual('DELETE FROM', extractWriteTable('DELETE FROM  events WHERE id = ?'), 'events');
expectEqual('带引号表名', extractWriteTable('UPDATE "students" SET a = ?'), 'students');

console.log('\n═══ 影响行数预估 SQL 改写 ═══');
expectEqual('DELETE 改写',
  buildImpactCountSql('DELETE FROM students WHERE teacher_id = ?'),
  'SELECT COUNT(*) AS affected FROM students WHERE teacher_id = ?');
expectEqual('UPDATE 改写（SET 含多列）',
  buildImpactCountSql('UPDATE students SET name = ?, email = ? WHERE student_id = ?'),
  'SELECT COUNT(*) AS affected FROM students WHERE student_id = ?');
expectEqual('INSERT 无法预估', buildImpactCountSql('INSERT INTO students (a) VALUES (?)'), null);

console.log('\n═══ 敏感列脱敏 ═══');
expectEqual('password 被脱敏',
  redactRows([{ id: 'u1', email: 'a@b.com', password: 'hash123' }]),
  [{ id: 'u1', email: 'a@b.com', password: '***REDACTED***' }]);
expectEqual('大写列名同样脱敏',
  redactRows([{ TOKEN: 'abc' }]),
  [{ TOKEN: '***REDACTED***' }]);
expectEqual('null 不误改为脱敏标记',
  redactRows([{ password: null }]),
  [{ password: null }]);

console.log('\n═══ 语句分类 ═══');
expectEqual('SELECT → read', classify('SELECT 1').kind, 'read');
expectEqual('UPDATE → write', classify('UPDATE students SET a=1 WHERE b=2').kind, 'write');
expectEqual('DROP → forbidden', classify('DROP TABLE x').kind, 'forbidden');
expectEqual('REPLACE → forbidden', classify('REPLACE INTO students VALUES (1)').kind, 'forbidden');

console.log(`\n═══ 结果：${pass} 通过 / ${fail} 失败 ═══\n`);
process.exit(fail === 0 ? 0 : 1);
