# JSA D1 MCP 服务

把 JSA 的 Cloudflare D1 数据库以 MCP 工具的形式暴露给 AI Agent —— Agent 既能直接查数据回答业务问题，也能在授权后代为改数据。

>【新需求106】第4 项实现。

---

## 为什么不是直接给 Agent 一个数据库连接

生产库里是真实学生数据，一条`DELETE FROM students` 就能造成不可逆损失。所以这个 MCP 的重点不是"能读写"，而是**在能读写的前提下把危险动作全部拦住**。

安全模型分六层：

| # | 防线 | 说明 |
| --- | --- | --- |
| 1 | **默认只读** | 不设 `JSA_MCP_ALLOW_WRITE=true` 时，任何写语句直接拒绝 |
| 2 | **二次确认** | 即便开了写模式，每次写调用还必须传 `confirm: true`；不传只做预演并返回**预计影响行数** |
| 3 | **DDL 永久禁令** | `DROP` / `ALTER` / `CREATE` / `TRUNCATE` / `ATTACH` / `PRAGMA` / 事务控制语句无论如何都不放行。schema 变更只能走 `workers/migration-*.sql` 人工执行 |
| 4 | **单语句 + 强制 WHERE** | 拒绝分号拼接（堵 `SELECT 1; DROP TABLE students`）；`UPDATE`/`DELETE` 必须带 `WHERE`，杜绝全表操作 |
| 5 | **表白名单** | 写操作只能落在业务表上；`update_student` 进一步限定到字段白名单，身份类字段（学号/账号/启用状态）完全不可改 |
| 6 | **脱敏 + 审计** | 密码哈希、token 等列在返回前替换为 `***REDACTED***`；所有写操作写入本地审计日志 |

另外：所有 SQL 值都走 D1 的**参数绑定**（`?` + `params`），不做字符串插值，从根上避免注入。凭据只从环境变量读取，代码里不含任何密钥。

---

## 安装

```bash
cd mcp
npm install
```

## 配置

```bash
cp .env.example .env
# 编辑 .env，填入 CLOUDFLARE_API_TOKEN
```

Token 创建路径：Cloudflare Dashboard → My Profile → API Tokens → Create Token → Custom token，权限选**Account → D1 → Edit**。

建议单独为 MCP 建一个 Token，不要复用其它用途的，方便随时吊销。

## 自检

接入 Agent 之前先跑一次，确认变量齐全、Token 权限够、连的是预期的库：

```bash
cd mcp
set -a && source .env && set +a && npm run doctor
```

正常输出会打印目标环境、写模式、学生/老师/报考记录数量，以及需求106 新增列是否已就位。

---

## 接入Agent

在 MCP 客户端的配置文件里加入（以 CodeBuddy / Claude Desktop 的 `mcpServers` 格式为例）：

```json
{
  "mcpServers": {
    "jsa-db": {
      "command": "node",
      "args": ["/Users/pengpjiang/JSA/mcp/src/index.js"],
      "env": {
        "CLOUDFLARE_ACCOUNT_ID": "784c09d5f05a8e5754657f1365345e02",
        "CLOUDFLARE_API_TOKEN": "<你的 Token>",
        "D1_DATABASE_ID": "9e0f50c0-e85b-4eef-a5e8-f5461965d823",
        "D1_DATABASE_ID_STAGING": "ec330b28-9f0a-4e8a-9bfc-3550eb311903",
        "JSA_MCP_TARGET": "staging",
        "JSA_MCP_ALLOW_WRITE": "false"
      }
    }
  }
}
```

**上手建议**：先用 `JSA_MCP_TARGET=staging` + 只读把流程跑顺，确认 Agent 的行为符合预期后再考虑切生产；即使切了生产，也建议日常保持 `JSA_MCP_ALLOW_WRITE=false`，只在确实要改数据时临时开启。

---

## 工具清单

| 工具 | 读/写 | 用途 |
| --- | --- | --- |
| `db_info` | 读 | 查看当前连的哪个库、是否可写、哪些表可写、哪些列会脱敏。**建议每次写操作前先调一次** |
| `list_tables` | 读 | 列出所有业务表及行数 |
| `describe_table` | 读 | 查看表字段结构 |
| `query` | 读 | 执行任意只读 SQL（`SELECT` / `WITH` / `EXPLAIN`） |
| `execute` | **写** | 执行 `INSERT` / `UPDATE` / `DELETE` |
| `list_students` | 读 | 结构化查学生列表（按姓名/学号/老师/学位/文理筛选），自动排除停用与孤儿数据 |
| `get_student` | 读 | 单个学生完整档案：基本信息 + 报考学校 + 材料 + 事件 |
| `update_student` | **写** | 按字段白名单更新单个学生（比手写 UPDATE 安全，天然限定单行） |
| `stats_overview` | 读 | 业务总览：学生/老师/报考数、申请状态分布、目标学位分布 |

优先用结构化工具（`list_students` / `get_student` / `update_student`），它们已经内置了正确的过滤口径（例如与后端 `ORPHAN_GUARD` 一致的孤儿学生排除）；`query` / `execute` 留给结构化工具覆盖不到的场景。

---

## 使用示例

Agent 侧的自然语言请求 → 实际调用：

### 「帮我看看今年有多少学生报了早稻田」

```text
query
  sql: SELECT s.name, s.student_id, sc.program, sc.status
       FROM schools sc JOIN students s ON s.student_id = sc.student_id
       WHERE sc.name LIKE ? AND s.is_active = 1
  params: ["%早稻田%"]
```

### 「把 2026084 的目标学位改成学部」

```text
update_student
  student_id: "2026084"
  fields: { "target_level": "学部" }
        → 返回 dry_run 预演
update_student
  student_id: "2026084"
  fields: { "target_level": "学部" }
  confirm: true
        → 真正写入 + 审计留痕
```

### 危险操作会被直接拒绝

```text
execute  sql: DELETE FROM students
  → ❌ DELETE 必须带 WHERE 条件（拒绝全表操作）

execute  sql: DROP TABLE students
  → ❌ 禁止执行 DROP 语句（建表/改表类操作请走迁移脚本人工执行）

query    sql: SELECT 1; DROP TABLE students
  → ❌ 一次只允许执行一条语句（检测到分号拼接的多条语句）

query    sql: SELECT email, password FROM users LIMIT 1
  → 正常返回，但 password 字段值为 ***REDACTED***
```

---

## 全库导出到 JSON（需求110）

把整个 D1 数据库的**全部数据**导出成一个 JSON 文件，用于备份、离线分析、环境间数据比对。

```bash
cd mcp

npm run export                        # 生产库 → workers/backups/d1-export-production-<时间戳>.json
npm run export:staging                # 测试库
npm run export -- --redact            # 敏感列脱敏（用于对外分享）
npm run export -- --tables students,schools
npm run export -- --out /tmp/a.json   # 指定路径
npm run export -- --stdout            # 输出到标准输出（可接管道）
npm run export -- --help
```

不需要手动 `source .env`——脚本会自己读 `mcp/.env`（已有的 `process.env` 优先，便于 CI 覆盖）。

### 输出结构

```jsonc
{
  "meta": {              // 环境、时间、行数预期、是否脱敏
    "format": "jsa-d1-export", "version": 1,
    "target": "production", "exported_at": "…", "redacted": false,
    "table_count": 15, "expected_row_total": 10056
  },
  "schema": {
    "tables": { "students": [ { "name": "…", "type": "…", "pk": true } ] },
    "ddl":    [ { "type": "table", "name": "students", "sql": "CREATE TABLE …" } ]
  },
  "tables": {
    "students": [ { /* 一行一条记录 */ } ],
    "audit_logs": []     // 空表是 []，不是 null、不是缺键
  },
  "verification": {      // 逐表比对"导出前 COUNT(*)"与"实际写出行数"
    "ok": true, "tables": { "students": { "expected": 143, "exported": 143, "ok": true } },
    "mismatches": [], "paging": { "students": "rowid" }, "duration_ms": 4231
  }
}
```

一并导出 `schema.ddl`，所以这份 JSON 不只是数据快照，**具备重建整库的信息**。

### 几个刻意的设计

| 点 | 原因 |
| --- | --- |
| **rowid 游标分页**，不用 `LIMIT/OFFSET` | OFFSET 在大表上是 O(n)，且没有稳定 `ORDER BY` 时翻页会重复/漏行。rowid 唯一且单调，是最可靠的游标。`WITHOUT ROWID` 表自动退回 OFFSET 并在 `verification.paging` 里标注 |
| **流式写出**，不 `JSON.stringify(整库)` | 一次性构造会让整份数据同时以对象和字符串两种形态驻留内存。现在内存只与单个批次相关 |
| **先写 `.partial`，回读解析成功后才改名** | 半截/损坏的备份最要命 —— 必须在它取得正式文件名之前被发现 |
| **逐表计数核对，不一致以退出码 2 结束** | 一份对不上数的备份比没有备份更危险，它会让人误以为数据是全的 |
| **默认只许写 `workers/backups/`** | 该目录已被 `.gitignore`。导出物含 143 名真实学生的姓名/邮箱/电话，落在会被 git 追踪的位置，下一次 `git add .` 就把隐私推上远端且历史难清。写别处需 `--force` 并会打警告 |
| **文件权限收紧为 `0600`** | 同机其它用户无法读取 |
| **默认不脱敏** | 备份的用途是恢复，脱敏后就恢复不了账号。要对外分享时才加 `--redact` |

### 与 `wrangler d1 export` 的分工

| | 产物 | 适合 |
| --- | --- | --- |
| `wrangler d1 export` | `.sql` | 直接灌回数据库 |
| `npm run export` | `.json` | 程序读取、环境间比对、数据分析、喂给脚本/Agent |

两者互补，重大变更前建议都做一份。

### 导出结果自检

```bash
cd mcp && npm test     # guard.test.js（36 项）+ exportCore.test.js（47 项）
```

---

## 审计日志

写操作（含被拒绝的尝试）逐条落在 `mcp/logs/audit-YYYY-MM-DD.log`，每行一条 JSON：

```json
{"ts":"2026-08-08T07:12:33.921Z","tool":"update_student","target":"production",
 "outcome":"ok","sql":"UPDATE students SET target_level = ?, updated_at = datetime('now') WHERE student_id = ?",
 "params":["str(len=2)","str(len=7)"],"changes":1,"rowsWritten":1,"error":null}
```

参数只记录类型与长度（`str(len=7)`），不落原值—— 避免审计日志本身变成隐私泄露源。日志写在本地文件而非数据库，这样 Agent 无法通过 MCP 篡改自己的操作记录。

`logs/` 与 `.env` 均已加入 `.gitignore`。

---

## 已知边界

- **无事务回滚**。D1 的 REST query接口不支持 `BEGIN`/`COMMIT`，因此写操作一旦 `confirm` 执行就无法回滚。这也是为什么要有预演 + 影响行数预估这一步。重大变更前请先 `npm run export` 或 `npx wrangler d1 export` 备份。
- **`INSERT` 无法预估影响行数**。预演只能对带 `WHERE` 的 `UPDATE`/`DELETE` 生效。
- **schema 变更不走 MCP**。这是刻意的设计，不是缺失—— 建表改表必须留在 `workers/migration-*.sql` 里，才能被 git 追踪、被 review。
- **导出不是原子快照**。D1 REST 无法开只读事务，逐表分页期间若有并发写入，`verification` 会报计数不一致（此时重跑即可）。它是"接近一致"的备份，不是数据库级 snapshot。
