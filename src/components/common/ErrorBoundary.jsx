import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, confirmClear: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  // 仅清理本应用命名空间的 key（jsa_ 前缀），不影响其他应用数据
  clearAppData() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('jsa_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-bg-base, #fef2f2)' }}>
          <div className="max-w-md w-full p-8 rounded-lg shadow-lg" style={{ background: 'var(--theme-surface-solid, #fff)', border: '1px solid var(--theme-border-subtle, #e5e7eb)' }}>
            <h1 className="text-2xl font-bold text-red-600 mb-4">出错了</h1>
            <p className="mb-4" style={{ color: 'var(--theme-text-secondary, #4b5563)' }}>应用程序遇到了错误。请尝试刷新页面。</p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm" style={{ color: 'var(--theme-text-muted, #6b7280)' }}>错误详情</summary>
              <pre className="mt-2 text-xs p-2 rounded overflow-auto" style={{ background: 'var(--theme-bg-elevated, #f3f4f6)', color: 'var(--theme-text-secondary, #4b5563)' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                刷新页面
              </button>
              {!this.state.confirmClear ? (
                <button
                  onClick={() => this.setState({ confirmClear: true })}
                  className="w-full px-4 py-2 rounded hover:opacity-80"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  清除应用缓存并重试
                </button>
              ) : (
                <div className="p-3 rounded" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-sm text-red-600 mb-2">⚠️ 此操作将清除本应用的缓存数据（不影响其他网站），确认继续？</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => this.clearAppData()}
                      className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    >
                      确认清除
                    </button>
                    <button
                      onClick={() => this.setState({ confirmClear: false })}
                      className="flex-1 px-3 py-1.5 rounded text-sm"
                      style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--theme-text-secondary, #4b5563)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
