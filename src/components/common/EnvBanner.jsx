import React from 'react';

/**
 * 环境标识横幅
 * 仅在非生产环境（如 staging）时显示醒目的横幅，提醒当前为测试环境
 */
const EnvBanner = () => {
  const env = import.meta.env.VITE_APP_ENV;

  // 生产环境或未设置时不显示
  if (!env || env === 'production') return null;

  const envLabels = {
    staging: '🧪 测试环境',
    development: '🔧 开发环境',
  };

  const label = envLabels[env] || `⚙️ ${env}`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: env === 'staging'
          ? 'linear-gradient(90deg, #f59e0b, #d97706)'
          : 'linear-gradient(90deg, #3b82f6, #2563eb)',
        color: '#fff',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 600,
        padding: '3px 0',
        letterSpacing: '1px',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {label} — 此环境仅供测试，数据与线上互相独立
    </div>
  );
};

export default EnvBanner;
