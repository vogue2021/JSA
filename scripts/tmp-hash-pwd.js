// 临时脚本 - 生成 PBKDF2 密码哈希（与 workers/src/routes/auth.js 一致）
// 用法: node scripts/tmp-hash-pwd.js <password>
// 使用后请立即删除

const { webcrypto } = require('crypto');
const subtle = webcrypto.subtle;

(async () => {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: node scripts/tmp-hash-pwd.js <password>');
    process.exit(1);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const hash = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);
  const b64 = Buffer.from(combined).toString('base64');

  // 自校验：模拟 verifyPassword
  const c2 = Uint8Array.from(Buffer.from(b64, 'base64'));
  const s2 = c2.slice(0, 16);
  const st2 = c2.slice(16);
  const km2 = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const h2 = new Uint8Array(await subtle.deriveBits(
    { name: 'PBKDF2', salt: s2, iterations: 100000, hash: 'SHA-256' },
    km2, 256
  ));
  const ok = st2.length === h2.length && st2.every((b, i) => b === h2[i]);

  console.log('HASH=' + b64);
  console.log('VERIFY=' + ok);
})();
