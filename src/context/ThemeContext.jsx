import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

// ==================== 默认主题 Tokens ====================

const lightTokens = {
  mode: 'light',
  colors: {
    // 背景（按需求文档浅色推荐值）
    bg: {
      base: '#F6F8FB',
      elevated: '#FFFFFF',
      glass: 'rgba(255, 255, 255, 0.7)',
      overlay: 'rgba(0, 0, 0, 0.1)',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    // 向后兼容的 surface 别名
    surface: {
      glass: 'rgba(255, 255, 255, 0.72)',
      glassHover: 'rgba(255, 255, 255, 0.85)',
      solid: '#FFFFFF',
    },
    // 文字颜色（按需求文档浅色推荐值）
    text: {
      primary: '#1E293B',
      secondary: '#475569',
      muted: '#94A3B8',
      inverse: '#FFFFFF',
      accent: '#F97316',
    },
    // 图标颜色
    icon: {
      primary: '#1E293B',
      secondary: '#64748B',
      muted: '#CBD5E1',
      active: '#6366f1', // var(--accent-color)
    },
    // 边框
    border: {
      hairline: 'rgba(255, 255, 255, 0.5)',
      subtle: 'rgba(0, 0, 0, 0.06)',
      strong: 'rgba(0, 0, 0, 0.12)',
    },
    // 组件颜色
    component: {
      card: 'rgba(255, 255, 255, 0.6)',
      cardHover: 'rgba(255, 255, 255, 0.8)',
      buttonPrimary: '#6366f1',
      buttonPrimaryText: '#FFFFFF',
      buttonSecondary: 'rgba(0, 0, 0, 0.04)',
      sidebar: 'rgba(255, 255, 255, 0.7)',
      sidebarActive: 'rgba(99, 102, 241, 0.08)',
    },
    // 强调色
    accent: {
      primary: '#6366f1',
      primaryHover: '#4f46e5',
      secondary: '#8b5cf6',
      success: '#16A34A',
      warning: '#F97316',
      danger: '#DC2626',
    },
    // 图表颜色（按需求文档浅色推荐值）
    chart: {
      linePrimary: '#F97316',
      lineSecondary: '#0EA5E9',
      positive: '#16A34A',
      negative: '#DC2626',
      grid: 'rgba(0, 0, 0, 0.05)',
      tooltipBg: '#FFFFFF',
    },
  },
  opacity: {
    glassAlpha: 0.72,
    overlayAlpha: 0.4,
  },
  blur: {
    backdropBlur: 20,
    heavyBlur: 40,
  },
  radius: {
    card: 20,
    button: 12,
    input: 10,
  },
  shadow: {
    elevation: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
    elevationHover: '0 16px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.06)',
    innerHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
  },
};

const darkTokens = {
  mode: 'dark',
  colors: {
    // 背景（按需求文档深色推荐值）
    bg: {
      base: '#0F1117',
      elevated: '#151922',
      glass: 'rgba(255, 255, 255, 0.06)',
      overlay: 'rgba(0, 0, 0, 0.4)',
      gradient: 'linear-gradient(135deg, #1a1a3e 0%, #2d1b4e 100%)',
    },
    // 向后兼容的 surface 别名
    surface: {
      glass: 'rgba(255, 255, 255, 0.05)',
      glassHover: 'rgba(255, 255, 255, 0.08)',
      solid: '#151922',
    },
    // 文字颜色（按需求文档深色推荐值 — 偏冷白 #F5F7FA 更高级）
    text: {
      primary: '#F5F7FA',
      secondary: '#C4CBD6',
      muted: '#8B93A7',
      inverse: '#111111',
      accent: '#F59E0B',
    },
    // 图标颜色
    icon: {
      primary: 'rgba(255, 255, 255, 0.9)',
      secondary: 'rgba(255, 255, 255, 0.6)',
      muted: 'rgba(255, 255, 255, 0.3)',
      active: '#818cf8', // var(--accent-color)
    },
    // 边框
    border: {
      hairline: 'rgba(255, 255, 255, 0.08)',
      subtle: 'rgba(255, 255, 255, 0.08)',
      strong: 'rgba(255, 255, 255, 0.2)',
    },
    // 组件颜色（玻璃卡片）
    component: {
      card: 'rgba(255, 255, 255, 0.05)',
      cardHover: 'rgba(255, 255, 255, 0.08)',
      buttonPrimary: '#818cf8',
      buttonPrimaryText: '#111111',
      buttonSecondary: 'rgba(255, 255, 255, 0.08)',
      sidebar: 'rgba(255, 255, 255, 0.04)',
      sidebarActive: 'rgba(129, 140, 248, 0.12)',
    },
    // 强调色
    accent: {
      primary: '#818cf8',
      primaryHover: '#6366f1',
      secondary: '#a78bfa',
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
    },
    // 图表颜色（按需求文档深色推荐值）
    chart: {
      linePrimary: '#F59E0B',
      lineSecondary: '#22D3EE',
      positive: '#22C55E',
      negative: '#EF4444',
      grid: 'rgba(255, 255, 255, 0.06)',
      tooltipBg: '#1C2230',
    },
  },
  opacity: {
    glassAlpha: 0.55,
    overlayAlpha: 0.6,
  },
  blur: {
    backdropBlur: 24,
    heavyBlur: 48,
  },
  radius: {
    card: 20,
    button: 12,
    input: 10,
  },
  shadow: {
    elevation: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
    elevationHover: '0 16px 48px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.25)',
    innerHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  },
};

// ==================== 默认背景配置 ====================

const defaultBackgroundPresets = {
  aurora: {
    name: '极光',
    type: 'mixed',
    layers: [
      { kind: 'linearGradient', colors: ['#0f0f23', '#1a1a3e'], angle: 135 },
      { kind: 'radialGlow', color: 'rgba(99, 102, 241, 0.3)', x: 0.2, y: 0.3, size: 0.6, blur: 120 },
      { kind: 'radialGlow', color: 'rgba(139, 92, 246, 0.25)', x: 0.8, y: 0.7, size: 0.5, blur: 100 },
      { kind: 'radialGlow', color: 'rgba(16, 185, 129, 0.15)', x: 0.5, y: 0.1, size: 0.4, blur: 80 },
      { kind: 'noise', intensity: 0.03, scale: 1, opacity: 0.4 },
    ],
  },
  sunset: {
    name: '日落',
    type: 'mixed',
    layers: [
      { kind: 'linearGradient', colors: ['#1a0a2e', '#2d1b4e', '#4a1942'], angle: 160 },
      { kind: 'radialGlow', color: 'rgba(245, 158, 11, 0.25)', x: 0.7, y: 0.2, size: 0.5, blur: 100 },
      { kind: 'radialGlow', color: 'rgba(239, 68, 68, 0.2)', x: 0.3, y: 0.6, size: 0.6, blur: 120 },
      { kind: 'noise', intensity: 0.02, scale: 1, opacity: 0.3 },
    ],
  },
  ocean: {
    name: '深海',
    type: 'mixed',
    layers: [
      { kind: 'linearGradient', colors: ['#0a1628', '#0f2540', '#0d3b66'], angle: 180 },
      { kind: 'radialGlow', color: 'rgba(59, 130, 246, 0.3)', x: 0.4, y: 0.4, size: 0.7, blur: 140 },
      { kind: 'radialGlow', color: 'rgba(6, 182, 212, 0.2)', x: 0.8, y: 0.8, size: 0.4, blur: 100 },
      { kind: 'noise', intensity: 0.02, scale: 1, opacity: 0.3 },
    ],
  },
  minimal_light: {
    name: '简约浅色',
    type: 'gradient',
    layers: [
      { kind: 'linearGradient', colors: ['#f0f4f8', '#e8edf5', '#f5f0ff'], angle: 135 },
      { kind: 'radialGlow', color: 'rgba(99, 102, 241, 0.08)', x: 0.3, y: 0.2, size: 0.6, blur: 120 },
      { kind: 'radialGlow', color: 'rgba(139, 92, 246, 0.06)', x: 0.7, y: 0.8, size: 0.5, blur: 100 },
    ],
  },
  minimal_dark: {
    name: '简约深色',
    type: 'gradient',
    layers: [
      { kind: 'linearGradient', colors: ['#111827', '#1f2937'], angle: 135 },
      { kind: 'radialGlow', color: 'rgba(99, 102, 241, 0.1)', x: 0.5, y: 0.5, size: 0.8, blur: 150 },
    ],
  },
  sakura: {
    name: '樱花',
    type: 'mixed',
    layers: [
      { kind: 'linearGradient', colors: ['#fdf2f8', '#fce7f3', '#f5f0ff'], angle: 135 },
      { kind: 'radialGlow', color: 'rgba(236, 72, 153, 0.12)', x: 0.2, y: 0.3, size: 0.5, blur: 100 },
      { kind: 'radialGlow', color: 'rgba(168, 85, 247, 0.08)', x: 0.8, y: 0.7, size: 0.4, blur: 80 },
      { kind: 'noise', intensity: 0.015, scale: 1, opacity: 0.2 },
    ],
  },
};

// ==================== 默认动效配置 ====================

const defaultMotionConfig = {
  transitions: {
    fast: 150,
    normal: 250,
    slow: 400,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // easeOutExpo
  },
  hover: {
    lift: 4, // px
    shadowBoost: 1.5,
    glassAlphaBoost: 0.1,
  },
  parallax: {
    backgroundStrength: 0.02,
    enabled: false,
  },
  reducedMotion: false,
};

// ==================== CSS变量生成 ====================

const generateCSSVariables = (tokens, bgPreset, motionConfig) => {
  const vars = {
    // === 背景 ===
    '--theme-bg-base': tokens.colors.bg.base,
    '--theme-bg-elevated': tokens.colors.bg.elevated,
    '--theme-bg-glass': tokens.colors.bg.glass,
    '--theme-bg-overlay': tokens.colors.bg.overlay,
    '--theme-bg-gradient': tokens.colors.bg.gradient,
    // === Surface（向后兼容） ===
    '--theme-surface-glass': tokens.colors.surface.glass,
    '--theme-surface-glass-hover': tokens.colors.surface.glassHover,
    '--theme-surface-solid': tokens.colors.surface.solid,
    // === 文字 ===
    '--theme-text-primary': tokens.colors.text.primary,
    '--theme-text-secondary': tokens.colors.text.secondary,
    '--theme-text-muted': tokens.colors.text.muted,
    '--theme-text-inverse': tokens.colors.text.inverse,
    '--theme-text-accent': tokens.colors.text.accent,
    // === 图标 ===
    '--theme-icon-primary': tokens.colors.icon.primary,
    '--theme-icon-secondary': tokens.colors.icon.secondary,
    '--theme-icon-muted': tokens.colors.icon.muted,
    '--theme-icon-active': tokens.colors.icon.active,
    // === 边框 ===
    '--theme-border-hairline': tokens.colors.border.hairline,
    '--theme-border-subtle': tokens.colors.border.subtle,
    '--theme-border-strong': tokens.colors.border.strong,
    // === 组件 ===
    '--theme-component-card': tokens.colors.component.card,
    '--theme-component-card-hover': tokens.colors.component.cardHover,
    '--theme-component-btn-primary': tokens.colors.component.buttonPrimary,
    '--theme-component-btn-primary-text': tokens.colors.component.buttonPrimaryText,
    '--theme-component-btn-secondary': tokens.colors.component.buttonSecondary,
    '--theme-component-sidebar': tokens.colors.component.sidebar,
    '--theme-component-sidebar-active': tokens.colors.component.sidebarActive,
    // === 强调色 ===
    '--theme-accent-primary': tokens.colors.accent.primary,
    '--theme-accent-primary-hover': tokens.colors.accent.primaryHover,
    '--theme-accent-secondary': tokens.colors.accent.secondary,
    '--theme-accent-success': tokens.colors.accent.success,
    '--theme-accent-warning': tokens.colors.accent.warning,
    '--theme-accent-danger': tokens.colors.accent.danger,
    // === 图表 ===
    '--theme-chart-line-primary': tokens.colors.chart.linePrimary,
    '--theme-chart-line-secondary': tokens.colors.chart.lineSecondary,
    '--theme-chart-positive': tokens.colors.chart.positive,
    '--theme-chart-negative': tokens.colors.chart.negative,
    '--theme-chart-grid': tokens.colors.chart.grid,
    '--theme-chart-tooltip-bg': tokens.colors.chart.tooltipBg,
    // === 透明度 ===
    '--theme-glass-alpha': tokens.opacity.glassAlpha,
    '--theme-overlay-alpha': tokens.opacity.overlayAlpha,
    // === 模糊 ===
    '--theme-blur': `${tokens.blur.backdropBlur}px`,
    '--theme-blur-heavy': `${tokens.blur.heavyBlur}px`,
    // === 圆角 ===
    '--theme-radius-card': `${tokens.radius.card}px`,
    '--theme-radius-button': `${tokens.radius.button}px`,
    '--theme-radius-input': `${tokens.radius.input}px`,
    // === 阴影 ===
    '--theme-shadow': tokens.shadow.elevation,
    '--theme-shadow-hover': tokens.shadow.elevationHover,
    '--theme-shadow-inner': tokens.shadow.innerHighlight,
    // === 动效 ===
    '--theme-transition-fast': `${motionConfig.transitions.fast}ms`,
    '--theme-transition-normal': `${motionConfig.transitions.normal}ms`,
    '--theme-transition-slow': `${motionConfig.transitions.slow}ms`,
    '--theme-easing': motionConfig.transitions.easing,
    '--theme-hover-lift': `${motionConfig.hover.lift}px`,
  };
  return vars;
};

// ==================== 背景CSS生成 ====================

const generateBackgroundCSS = (preset) => {
  if (!preset || !preset.layers) return {};

  const backgrounds = [];
  const gradients = preset.layers.filter(l => l.kind === 'linearGradient');
  const glows = preset.layers.filter(l => l.kind === 'radialGlow');

  // 渐变层
  gradients.forEach(g => {
    const colorStops = g.colors.join(', ');
    backgrounds.push(`linear-gradient(${g.angle}deg, ${colorStops})`);
  });

  // 光斑层（用 radial-gradient 实现）
  glows.forEach(g => {
    const posX = (g.x * 100).toFixed(0);
    const posY = (g.y * 100).toFixed(0);
    const size = (g.size * 100).toFixed(0);
    backgrounds.push(`radial-gradient(${size}% ${size}% at ${posX}% ${posY}%, ${g.color}, transparent)`);
  });

  return {
    background: backgrounds.reverse().join(', '),
  };
};

// ==================== ThemeProvider ====================

export const ThemeProvider = ({ children }) => {
  // 主题模式：light / dark / auto
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('theme-mode') || 'light';
  });

  // 当前生效的模式（auto 会根据系统偏好解析）
  const [resolvedMode, setResolvedMode] = useState('light');

  // 背景预设 key
  const [backgroundPreset, setBackgroundPreset] = useState(() => {
    return localStorage.getItem('theme-bg-preset') || 'minimal_light';
  });

  // 自定义背景（用户可覆盖预设）
  const [customBackground, setCustomBackground] = useState(null);

  // 动效配置
  const [motionConfig, setMotionConfig] = useState(() => {
    const saved = localStorage.getItem('theme-motion');
    return saved ? JSON.parse(saved) : defaultMotionConfig;
  });

  // 玻璃拟态强度（0-100）
  const [glassIntensity, setGlassIntensity] = useState(() => {
    return parseInt(localStorage.getItem('theme-glass-intensity') || '70');
  });

  // 是否启用玻璃拟态效果
  const [glassEnabled, setGlassEnabled] = useState(() => {
    return localStorage.getItem('theme-glass-enabled') !== 'false';
  });

  // 监听系统深浅色偏好
  useEffect(() => {
    if (mode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedMode(mq.matches ? 'dark' : 'light');
      const handler = (e) => setResolvedMode(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      setResolvedMode(mode);
    }
  }, [mode]);

  // 监听系统减少动效偏好
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setMotionConfig(prev => ({ ...prev, reducedMotion: true }));
    }
  }, []);

  // 当模式切换时，自动匹配适合的背景预设
  useEffect(() => {
    const currentBg = backgroundPreset;
    if (resolvedMode === 'dark' && (currentBg === 'minimal_light' || currentBg === 'sakura')) {
      setBackgroundPreset('aurora');
    } else if (resolvedMode === 'light' && (currentBg === 'aurora' || currentBg === 'minimal_dark' || currentBg === 'sunset' || currentBg === 'ocean')) {
      setBackgroundPreset('minimal_light');
    }
  }, [resolvedMode]);

  // 持久化
  useEffect(() => { localStorage.setItem('theme-mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('theme-bg-preset', backgroundPreset); }, [backgroundPreset]);
  useEffect(() => { localStorage.setItem('theme-motion', JSON.stringify(motionConfig)); }, [motionConfig]);
  useEffect(() => { localStorage.setItem('theme-glass-intensity', glassIntensity.toString()); }, [glassIntensity]);
  useEffect(() => { localStorage.setItem('theme-glass-enabled', glassEnabled.toString()); }, [glassEnabled]);

  // 计算当前 tokens
  const tokens = useMemo(() => {
    const base = resolvedMode === 'dark' ? { ...darkTokens } : { ...lightTokens };
    // 根据 glassIntensity 调整玻璃效果强度
    const intensity = glassIntensity / 100;
    base.opacity.glassAlpha = resolvedMode === 'dark'
      ? 0.3 + intensity * 0.4
      : 0.5 + intensity * 0.4;
    base.blur.backdropBlur = Math.round(8 + intensity * 32);
    return base;
  }, [resolvedMode, glassIntensity]);

  // 获取背景样式
  const bgPreset = useMemo(() => {
    return customBackground || defaultBackgroundPresets[backgroundPreset] || defaultBackgroundPresets.minimal_light;
  }, [backgroundPreset, customBackground]);

  const backgroundStyle = useMemo(() => generateBackgroundCSS(bgPreset), [bgPreset]);

  // 注入 CSS 变量到 :root
  useEffect(() => {
    const vars = generateCSSVariables(tokens, bgPreset, motionConfig);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 设置 data-theme 属性
    root.setAttribute('data-theme', resolvedMode);

    // body 类名
    if (resolvedMode === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
  }, [tokens, bgPreset, motionConfig, resolvedMode]);

  const isDark = resolvedMode === 'dark';

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'auto' : 'light');
  }, []);

  // 恢复所有外观设置到默认值
  const resetToDefaults = useCallback(() => {
    setMode('light');
    setBackgroundPreset('minimal_light');
    setCustomBackground(null);
    setMotionConfig(defaultMotionConfig);
    setGlassIntensity(70);
    setGlassEnabled(true);
  }, []);

  const value = useMemo(() => ({
    // 模式
    mode, setMode, resolvedMode, isDark, toggleMode,
    // Tokens
    tokens,
    // 背景
    backgroundPreset, setBackgroundPreset,
    backgroundPresets: defaultBackgroundPresets,
    customBackground, setCustomBackground,
    backgroundStyle,
    // 动效
    motionConfig, setMotionConfig,
    // 玻璃效果
    glassIntensity, setGlassIntensity,
    glassEnabled, setGlassEnabled,
    // 重置
    resetToDefaults,
  }), [mode, resolvedMode, isDark, toggleMode, tokens, backgroundPreset,
       customBackground, backgroundStyle, motionConfig, glassIntensity, glassEnabled, resetToDefaults]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
