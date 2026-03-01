/**
 * Cloudflare Pages Function
 * 将所有 /api/* 请求代理到 Cloudflare Workers
 * 
 * 路由：/api/[[path]] → https://jsa-api.jiangpeng527.workers.dev/api/[[path]]
 */

const WORKERS_URL = 'https://jsa-api.jiangpeng527.workers.dev';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 构建目标 URL：将请求路径转发到 Workers
  const targetUrl = WORKERS_URL + url.pathname + url.search;

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
