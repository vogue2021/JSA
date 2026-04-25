import React, { useState } from 'react';
import {
  Calendar, School, FileText,
  User, GraduationCap, Mail, Lock, ArrowRight, Shield, Globe,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { logAction, LOG_CATEGORIES } from '../utils/logService';

/**
 * 登录页面组件（从 App.jsx 拆分）
 * 默认显示学生/老师/管理员角色选择器，始终可见
 * - 学生入口：支持邮箱或明学手机号登录（不含@时自动走明学 API）
 * - 老师/管理员入口：仅支持邮箱登录
 * Props:
 *   onLogin(userData, token)  - 登录成功回调
 */
const AuthPage = ({ onLogin }) => {
  const { isDark, tokens, backgroundStyle, glassEnabled } = useTheme();

  const [userType, setUserType] = useState('student'); // 'student', 'teacher', 'admin'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // 判断当前输入是否是邮箱格式
  const isEmailInput = formData.email.includes('@');
  // 学生角色且输入非邮箱 → 走明学登录
  const isMingxueLogin = userType === 'student' && !isEmailInput && formData.email.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email) newErrors.email = userType === 'student' ? '请输入邮箱或手机号' : '请输入邮箱';
    if (!formData.password) newErrors.password = '请输入密码';
    else if (formData.password.length < 4) newErrors.password = '密码至少4位';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const resp = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const result = await resp.json();

      if (!resp.ok || !result.success) {
        if (result.code === 'ACCOUNT_DISABLED') {
          alert('⚠️ 账号已被禁用，请联系管理员');
        }
        setErrors({ password: result.message || '邮箱/用户名或密码错误' });
        return;
      }

      // 验证角色是否匹配（明学用户名登录角色固定为 student，无需额外验证）
      if (!isMingxueLogin && result.user.role !== userType) {
        setErrors({ password: `该账号不是${roleConfig[userType].label}账号，请切换角色` });
        return;
      }

      const userData = {
        id: result.user.id,
        role: result.user.role,
        name: result.user.name,
        email: result.user.email,
        studentId: result.user.studentId || null,
        teacherId: result.user.teacherId || null,
        isAdmin: result.user.role === 'admin',
      };

      const loginType = isMingxueLogin ? '明学账号登录' : '邮箱登录';
      logAction(LOG_CATEGORIES.AUTH, `${loginType}: ${userData.name} (${userData.role})`, { email: userData.email });
      onLogin(userData, result.token);
    } catch (err) {
      setErrors({ password: '网络错误，请检查网络连接后重试' });
      console.error('登录失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const roleConfig = {
    student: { color: '#3b82f6', rgb: '59,130,246', label: '学生', icon: <User size={20} /> },
    teacher: { color: '#8b5cf6', rgb: '139,92,246', label: '老师', icon: <GraduationCap size={20} /> },
    admin:   { color: '#ef4444', rgb: '239,68,68',  label: '管理员', icon: <Shield size={20} /> },
  };
  const current = roleConfig[userType];
  // 按钮颜色：跟随角色色，明学用户名登录时保持学生蓝色
  const buttonColor = current;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 themed-bg noise-overlay" style={backgroundStyle}>
      {/* 背景光斑 */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="animate-glow-float absolute rounded-full" style={{
          width: '50vw', height: '50vw', top: '5%', left: '-5%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)',
          filter: 'blur(80px)',
        }} />
        <div className="animate-glow-float-slow absolute rounded-full" style={{
          width: '40vw', height: '40vw', bottom: '10%', right: '-5%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div className="animate-glow-float absolute rounded-full" style={{
          width: '30vw', height: '30vw', top: '50%', left: '60%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)',
          filter: 'blur(50px)', animationDelay: '4s',
        }} />
      </div>

      <div className="max-w-5xl w-full grid lg:grid-cols-2 rounded-2xl overflow-hidden relative z-10 animate-scale-in"
        style={{
          background: glassEnabled ? tokens.colors.surface.glass : tokens.colors.surface.solid,
          backdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
          WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.heavyBlur}px)` : 'none',
          border: `1px solid ${tokens.colors.border.hairline}`,
          boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
        }}>
        {/* 左侧装饰面板 */}
        <div className="hidden lg:flex flex-col justify-center items-center p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))',
          }} />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-40 h-40 rounded-full animate-pulse-glow" style={{
              top: '15%', right: '10%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
            }} />
            <div className="absolute w-32 h-32 rounded-full animate-pulse-glow" style={{
              bottom: '20%', left: '5%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)',
              animationDelay: '1.5s',
            }} />
          </div>
          <div className="mb-8 relative z-10 flex flex-col items-center">
            <div className="w-32 h-32 rounded-2xl flex items-center justify-center mb-6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', padding: '12px' }}>
              <img src="/mingxue-logo.png" alt="明学义塾" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl font-bold mb-4">明学义塾升学系统</h1>
            <p className="text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>
              专业的日本升学申请管理平台<br/>
              让升学之路更加清晰高效
            </p>
          </div>
          <div className="space-y-4 w-full max-w-sm relative z-10">
            {[
              { icon: <Calendar size={24} />, label: '智能时间线管理' },
              { icon: <School size={24} />, label: '多校申请追踪' },
              { icon: <FileText size={24} />, label: '材料清单管理' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl p-3 transition-all"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧登录表单 */}
        <div className="p-8 lg:p-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: tokens.colors.text.primary }}>欢迎回来</h2>
            <p style={{ color: tokens.colors.text.secondary }}>登录您的账号继续管理留学申请</p>
          </div>

          {/* 角色选择 — 始终显示 */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" style={{ color: tokens.colors.text.secondary }}>我是</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(roleConfig).map(([type, cfg]) => (
                <button key={type} type="button" onClick={() => setUserType(type)}
                  className="p-3 rounded-xl border-2 transition flex items-center justify-center gap-2"
                  style={{
                    borderColor: userType === type ? cfg.color : tokens.colors.border.subtle,
                    background: userType === type ? (isDark ? `rgba(${cfg.rgb},0.1)` : `rgba(${cfg.rgb},0.06)`) : 'transparent',
                    color: userType === type ? cfg.color : tokens.colors.text.secondary,
                  }}>
                  {cfg.icon}
                  <span className="font-medium">{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 学生角色输入用户名时，显示明学提示 */}
          {isMingxueLogin && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Globe size={16} />
              <span>检测到明学手机号，将使用明学账号验证登录</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱或用户名 */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>
                {userType === 'student' ? '邮箱或手机号' : '邮箱'}
              </label>
              <div className="relative">
                {(userType === 'student' && !isEmailInput)
                  ? <User className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                  : <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                }
                <input type="text" value={formData.email}
                  onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setErrors({}); }}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.email ? 'border-red-500' : ''}`}
                  style={{ borderColor: errors.email ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                  placeholder={userType === 'student' ? 'your@email.com 或 明学手机号' : 'your@email.com'} />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>{isMingxueLogin ? '验证码' : '密码'}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                <input type="password" value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.password ? 'border-red-500' : ''}`}
                  style={{ borderColor: errors.password ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                  placeholder="••••••••" />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <button type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              style={{
                background: isDark ? `rgba(${buttonColor.rgb},0.15)` : `rgba(${buttonColor.rgb},0.1)`,
                color: buttonColor.color,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${isDark ? `rgba(${buttonColor.rgb},0.2)` : `rgba(${buttonColor.rgb},0.15)`}`,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = `rgba(${buttonColor.rgb},${isDark ? 0.25 : 0.18})`; }}
              onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = `rgba(${buttonColor.rgb},${isDark ? 0.15 : 0.1})`; }}
            >
              {isLoading ? '登录中...' : <>登录 <ArrowRight size={20} /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
              {userType === 'student'
                ? '支持邮箱或明学手机号登录，首次明学登录自动创建系统账号'
                : '账号由管理员统一创建，如需账号请联系管理员'}
            </p>
          </div>

          {/* 测试账号提示 —— 仅非生产环境显示（需求37：正式环境隐藏） */}
          {(() => {
            const appEnv = import.meta.env.VITE_APP_ENV;
            const isProduction = !appEnv || appEnv === 'production';
            if (isProduction) return null;
            return (
              <div className="mt-6 p-4 rounded-xl text-xs"
                style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${tokens.colors.border.subtle}`, color: tokens.colors.text.secondary }}>
                <p className="font-semibold mb-2">测试账号（数据存储于 Cloudflare D1）：</p>
                {userType === 'admin' && <p>邮箱: admin@jsa.com 密码: admin123</p>}
                {userType === 'teacher' && (
                  <>
                    <p className="font-medium mb-1" style={{ color: tokens.colors.text.muted }}>升学老师：</p>
                    <p>王老师: wang@school.com / wang123</p>
                    <p>李老师: li@school.com / li123</p>
                    <p>张老师: zhang@school.com / zhang123</p>
                    <p>陈老师: chen@school.com / chen123</p>
                    <p>赵老师: zhao@school.com / zhao123</p>
                    <p className="font-medium mt-2 mb-1" style={{ color: tokens.colors.text.muted }}>学管老师：</p>
                    <p>高老师: gao@school.com / gao123</p>
                    <p>林老师: lin@school.com / lin123</p>
                  </>
                )}
                {userType === 'student' && (
                  <>
                    <p className="font-medium mb-1" style={{ color: tokens.colors.text.muted }}>邮箱登录：</p>
                    <p>张三: zhangsan@student.jsa.com / stu2024001</p>
                    <p>李四: lisi@student.jsa.com / stu2024002</p>
                    <p>王五: wangwu@student.jsa.com / stu2024003</p>
                    <p className="font-medium mt-2 mb-1" style={{ color: tokens.colors.text.muted }}>明学手机号登录：</p>
                    <p>输入明学手机号和验证码即可</p>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
