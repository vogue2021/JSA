import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
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
              <button
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                清除数据并重新开始
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
