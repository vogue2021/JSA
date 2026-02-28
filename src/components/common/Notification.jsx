import React from 'react';
import { CheckSquare, AlertCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

const Notification = () => {
  const { notification } = useApp();
  const { isDark, tokens, glassEnabled } = useTheme();

  if (!notification) return null;

  const { message, type } = notification;
  const isSuccess = type === 'success';

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slide-up">
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl"
        style={{
          background: glassEnabled
            ? (isDark ? 'rgba(30,30,50,0.85)' : 'rgba(255,255,255,0.9)')
            : (isDark ? tokens.colors.surface.solid : '#fff'),
          backdropFilter: glassEnabled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: glassEnabled ? 'blur(16px)' : 'none',
          border: `1px solid ${isSuccess
            ? (isDark ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.4)')
            : (isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.4)')}`,
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 8px 32px rgba(0,0,0,0.1)',
        }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
          background: isSuccess
            ? (isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)')
            : (isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)'),
        }}>
          {isSuccess
            ? <CheckSquare size={16} style={{ color: '#22c55e' }} />
            : <AlertCircle size={16} style={{ color: '#ef4444' }} />
          }
        </div>
        <span className="font-medium text-sm" style={{ color: tokens.colors.text.primary }}>{message}</span>
      </div>
    </div>
  );
};

export default Notification;
