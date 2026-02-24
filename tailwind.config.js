/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      colors: {
        // 主题色 - 通过 CSS 变量引用（语义化颜色）
        themed: {
          // 文字
          primary: 'var(--theme-text-primary)',
          secondary: 'var(--theme-text-secondary)',
          muted: 'var(--theme-text-muted)',
          inverse: 'var(--theme-text-inverse)',
          // 强调
          accent: 'var(--theme-accent-primary)',
          'accent-hover': 'var(--theme-accent-primary-hover)',
          success: 'var(--theme-accent-success)',
          warning: 'var(--theme-accent-warning)',
          danger: 'var(--theme-accent-danger)',
          // 背景/表面
          surface: 'var(--theme-surface-solid)',
          elevated: 'var(--theme-bg-elevated)',
          // 图标
          'icon-primary': 'var(--theme-icon-primary)',
          'icon-secondary': 'var(--theme-icon-secondary)',
          'icon-muted': 'var(--theme-icon-muted)',
          'icon-active': 'var(--theme-icon-active)',
          // 图表
          'chart-primary': 'var(--theme-chart-line-primary)',
          'chart-secondary': 'var(--theme-chart-line-secondary)',
          'chart-positive': 'var(--theme-chart-positive)',
          'chart-negative': 'var(--theme-chart-negative)',
        },
      },
      borderRadius: {
        'glass': 'var(--theme-radius-card)',
        'glass-btn': 'var(--theme-radius-button)',
        'glass-input': 'var(--theme-radius-input)',
      },
      backdropBlur: {
        'glass': 'var(--theme-blur)',
        'glass-heavy': 'var(--theme-blur-heavy)',
      },
      boxShadow: {
        'glass': 'var(--theme-shadow)',
        'glass-hover': 'var(--theme-shadow-hover)',
        'glass-inner': 'var(--theme-shadow-inner)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.4s ease-out',
        'stagger-in': 'staggerIn 0.4s ease-out both',
        'glow-pulse': 'pulseGlow 3s ease-in-out infinite',
        'float': 'glowFloat 8s ease-in-out infinite alternate',
        'float-slow': 'glowFloat 12s ease-in-out infinite alternate-reverse',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        staggerIn: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        glowFloat: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(20px, -15px) scale(1.1)' },
          '100%': { transform: 'translate(-10px, 10px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
}