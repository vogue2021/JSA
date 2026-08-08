#!/usr/bin/env node
//【新需求106】MCP 连通性自检
//
// 在把 MCP 接到 Agent 之前，先用它确认：环境变量齐不齐、Token 权限够不够、连的是哪个库。
// 这是纯只读脚本，不会修改任何数据。
//
// 用法：
//   cd mcp
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... D1_DATABASE_ID=... npm run doctor

import { createClientFromEnv } from './d1Client.js';
import { isWriteEnabled, WRITABLE_TABLES } from './guard.js';

function line(label, value) {
  console.log(`  ${label.padEnd(22)} ${value}`);
}

async function main() {
  console.log('\n═══ JSA D1 MCP 自检 ═══\n');

  let client;
  try {
    client = createClientFromEnv();
  } catch (err) {
    console.error(`❌ 环境变量校验失败：${err.message}\n`);
    console.error('请参考 mcp/.env.example 配置以下变量：');
    console.error('  CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / D1_DATABASE_ID\n');
    process.exit(1);
  }

  console.log('▸ 配置');
  line('目标环境', client.envLabel);
  line('数据库 ID 后 6 位', '…' + String(client.databaseId).slice(-6));
  line('写模式', isWriteEnabled() ? '已开启 (read-write)' : '关闭 (read-only)');
  line('可写表白名单', [...WRITABLE_TABLES].join(', '));

  console.log('\n▸ 连通性');
  try {
    const { results } = await client.run('SELECT 1 ASok');
    line('D1 查询', results[0]?.ok === 1 ? '✅ 通过' : '⚠️ 返回异常');
  } catch (err) {
    console.error(`  ❌ 失败：${err.message}\n`);
    process.exit(1);
  }

  console.log('\n▸ 业务数据抽样');
  try {
    const { results } = await client.run(`
      SELECT
        (SELECT COUNT(*) FROM students WHERE is_active = 1) AS students,
        (SELECT COUNT(*) FROM teachers) AS teachers,
        (SELECT COUNT(*) FROM schools) AS applications
    `);
    const r = results[0] || {};
    line('在读学生', r.students);
    line('老师', r.teachers);
    line('报考记录', r.applications);
  } catch (err) {
    console.error(`  ⚠️ 业务表读取失败：${err.message}`);
    console.error('  （连通性正常但读不到业务表，请确认 D1_DATABASE_ID 指向的是 JSA 的库）');
    process.exit(1);
  }

  console.log('\n▸ 需求106 新增列');
  try {
    const { results } = await client.run('PRAGMA table_info("students")');
    const cols = results.map(c => c.name);
    line('score_none_flags', cols.includes('score_none_flags') ? '✅ 已存在' : '❌ 缺失，请先执行 migration-needs106.sql');
    line('target_level', cols.includes('target_level') ? '✅ 已存在' : '❌ 缺失');
  } catch (err) {
    console.error(`  ⚠️ 无法读取表结构：${err.message}`);
  }

  console.log('\n✅ 自检完成\n');
}

main().catch(err => {
  console.error(`\n❌ 自检异常：${err.message}\n`);
  process.exit(1);
});
