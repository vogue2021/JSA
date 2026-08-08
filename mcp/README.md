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

- **无事务回滚**。D1 的 REST query接口不支持 `BEGIN`/`COMMIT`，因此写操作一旦 `confirm` 执行就无法回滚。这也是为什么要有预演 + 影响行数预估这一步。重大变更前请先`npx wrangler d1 export` 备份。
- **`INSERT` 无法预估影响行数**。预演只能对带 `WHERE` 的 `UPDATE`/`DELETE` 生效。
- **schema 变更不走 MCP**。这是刻意的设计，不是缺失—— 建表改表必须留在 `workers/migration-*.sql` 里，才能被 git 追踪、被 review。
