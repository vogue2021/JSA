//【新需求106】Cloudflare D1 REST API 客户端
//
// 为什么走 REST API 而不是 wrangler：
//   MCP 服务需要在任意 Agent 进程里被拉起，不能依赖本机装了 wrangler、
//   也不能依赖 wrangler 的交互式 OAuth 登录态。REST API 只需一个 API Token。
//
// 安全约束：
//   - 所有凭据仅从环境变量读取，代码里不存任何密钥（see .env.example）
//   - 目标 URL 由固定常量拼装，account/database id 只做格式校验后填入路径，
//     不接受调用方传入完整 URL —— 避免 SSRF
//   - 一切 SQL 参数走 D1 的 params 绑定，绝不做字符串插值

const API_ROOT = 'https://api.cloudflare.com/client/v4';

// Cloudflare 的 account id / database id 都是 32 位 hex 或标准 UUID
const ID_PATTERN = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class D1Client {
  /**
   * @param {object} cfg
   * @param {string} cfg.accountId
   * @param {string} cfg.apiToken
   * @param {string} cfg.databaseId
   * @param {string} cfg.envLabel  'production' | 'staging'，仅用于日志与提示
   */
  constructor({ accountId, apiToken, databaseId, envLabel }) {
    if (!ID_PATTERN.test(String(accountId ||''))) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID缺失或格式不合法');
    }
    if (!ID_PATTERN.test(String(databaseId || ''))) {
      throw new Error('D1_DATABASE_ID 缺失或格式不合法');
    }
    if (!apiToken || String(apiToken).length < 20) {
      throw new Error('CLOUDFLARE_API_TOKEN 缺失或格式不合法');
    }
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.databaseId = databaseId;
    this.envLabel = envLabel || 'unknown';
  }

  get endpoint() {
    return `${API_ROOT}/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
  }

  /**
   * 执行一条 SQL。params 通过 D1 的绑定参数传递，不做字符串拼接。
   * @param {string} sql
   * @param {Array<string|number|null>} params
   * @returns {Promise<{results: object[], meta: object}>}
   */
  async run(sql, params = []) {
    let res;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      });
    } catch (err) {
      throw new Error(`无法连接 Cloudflare API：${err.message}`);
    }

    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Cloudflare API 返回了非 JSON 响应（HTTP ${res.status}）：${text.slice(0, 300)}`);
    }

    if (!res.ok || payload.success === false) {
      const detail = (payload.errors || [])
        .map(e => `[${e.code}] ${e.message}`)
        .join('; ') || `HTTP ${res.status}`;
      // 权限类错误单独给出可操作提示
      if (/7403|not authorized|Authentication/i.test(detail)) {
        throw new Error(
          `D1 访问被拒绝：${detail}\n` +
          '请确认 CLOUDFLARE_API_TOKEN 具备该账号下 D1 的 Edit 权限，且 D1_DATABASE_ID 属于同一账号。'
        );
      }
      throw new Error(`D1 执行失败：${detail}`);
    }

    // D1 query 接口返回 result: [{ results, success, meta }]
    const first = Array.isArray(payload.result) ? payload.result[0] : null;
    return {
      results: (first && Array.isArray(first.results)) ? first.results : [],
      meta: (first && first.meta)? first.meta : {},
    };
  }
}

/**
 * 从环境变量装配客户端。
 * JSA_MCP_TARGET 决定连哪个库：production（默认）| staging
 */
export function createClientFromEnv() {
  const target = (process.env.JSA_MCP_TARGET || 'production').toLowerCase();
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
