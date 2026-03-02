/**
 * Cloudflare Pages Function
 * 将所有 /api/* 请求代理到 Cloudflare Workers
 * 
 * 路由：/api/[[path]] → Workers API
 * 
 * 环境变量 API_BACKEND_URL：
 *   - 生产环境：https://jsa-api.jiangpeng527.workers.dev（默认值）
 *   - 测试环境：https://jsa-api-staging.jiangpeng527.workers.dev
 *   需要在 Cloudflare Dashboard → Pages → 项目设置 → 环境变量 中配置
 */

const DEFAULT_WORKERS_URL = 'https://jsa-api.jiangpeng527.workers.dev';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 从环境变量获取后端 API 地址，未配置时使用默认值（生产）
  const workersUrl = env.API_BACKEND_URL || DEFAULT_WORKERS_URL;

  // 构建目标 URL：将请求路径转发到 Workers
  const targetUrl = workersUrl + url.pathname + url.search;

  // 转发请求，保留所有 headers、method、body
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  });

  try {
    const response = await fetch(newRequest);

    // 返回 Workers 的响应，添加 CORS headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '代理请求失败', detail: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 处理 OPTIONS 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
