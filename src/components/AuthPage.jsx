import React, { useState } from 'react';
import {
  Calendar, School, FileText,
  User, GraduationCap, Mail, Lock, ArrowRight, Shield,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { logAction, LOG_CATEGORIES } from '../utils/logService';

/**
 * 登录页面组件（从 App.jsx 拆分）
 * Props:
 *   onLogin(userData)  - 登录成功回调
 *   allUsers           - 用户列表（用于本地验证）
 */
const AuthPage = ({ onLogin, allUsers }) => {
  const { isDark, tokens, backgroundStyle, glassEnabled } = useTheme();

  const [userType, setUserType] = useState('student'); // 'student', 'teacher', 'admin'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email) newErrors.email = '请输入邮箱';
    else if (!validateEmail(formData.email)) newErrors.email = '邮箱格式不正确';
    if (!formData.password) newErrors.password = '请输入密码';
    else if (formData.password.length < 6) newErrors.password = '密码至少6位';

    if (Object.keys(newErrors).length === 0) {
      const user = allUsers.find(u =>
        u.email === formData.email &&
        u.password === formData.password &&
        u.role === userType
      );
      if (user) {
        const userData = {
          role: user.role,
          name: user.name,
          email: user.email,
          studentId: user.studentId || null,
          teacherId: user.teacherId || null,
          isAdmin: user.role === 'admin',
        };

        // 尝试从后端获取真实 JWT token（用于后端 API 鉴权）
        // 后端不可用时降级为纯本地登录，不影响现有功能
        try {
          const resp = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email, password: formData.password }),
          });
          if (resp.ok) {
            const result = await resp.json();
            if (result.token) {
              localStorage.setItem('authToken', result.token);
            }
          }
        } catch {
          // 后端不可用，清除旧 token，继续本地登录
          localStorage.removeItem('authToken');
        }

        logAction(LOG_CATEGORIES.AUTH, `用户登录: ${user.name} (${user.role})`, { email: user.email });
        onLogin(userData);
        return;
      } else {
        newErrors.password = '邮箱或密码错误';
      }
    }
    setErrors(newErrors);
  };

  const roleConfig = {
    student: { color: '#3b82f6', rgb: '59,130,246', label: '学生', icon: <User size={20} /> },
    teacher: { color: '#8b5cf6', rgb: '139,92,246', label: '老师', icon: <GraduationCap size={20} /> },
    admin:   { color: '#ef4444', rgb: '239,68,68',  label: '管理员', icon: <Shield size={20} /> },
  };
  const current = roleConfig[userType];

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
          <div className="mb-8 relative z-10">
            <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <GraduationCap size={64} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">日本留学考学助手</h1>
            <p className="text-center" style={{ color: 'rgba(255,255,255,0.8)' }}>
              专业的日本留学申请管理平台<br/>
              让留学之路更加清晰高效
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

          {/* 角色选择 */}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2" size={20} style={{ color: tokens.colors.text.muted }} />
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.email ? 'border-red-500' : ''}`}
                  style={{ borderColor: errors.email ? undefined : (isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db'), background: isDark ? 'rgba(255,255,255,0.06)' : '#fff', color: tokens.colors.text.primary }}
                  placeholder="your@email.com" />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: tokens.colors.text.secondary }}>密码</label>
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
              className="w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              style={{
                background: isDark ? `rgba(${current.rgb},0.15)` : `rgba(${current.rgb},0.1)`,
                color: current.color,
                backdropFilter: 'blur(8px)',
                border: `1px solid ${isDark ? `rgba(${current.rgb},0.2)` : `rgba(${current.rgb},0.15)`}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `rgba(${current.rgb},${isDark ? 0.25 : 0.18})`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `rgba(${current.rgb},${isDark ? 0.15 : 0.1})`; }}
            >
              登录 <ArrowRight size={20} />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
              账号由管理员统一创建，如需账号请联系管理员
            </p>
          </div>

          {/* 测试账号提示 */}
          <div className="mt-6 p-4 rounded-xl text-xs"
            style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${tokens.colors.border.subtle}`, color: tokens.colors.text.secondary }}>
            <p className="font-semibold mb-2">测试账号：</p>
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
                <p>张三: zhangsan@student.jsa.com / stu2024001</p>
                <p>李四: lisi@student.jsa.com / stu2024002</p>
                <p>王五: wangwu@student.jsa.com / stu2024003</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
