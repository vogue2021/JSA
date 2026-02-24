import React, { useState } from 'react';
import { X, Sun, Moon, Monitor, Palette, Sparkles, Sliders, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeCustomizer = ({ onClose }) => {
  const {
    mode, setMode, isDark, tokens,
    backgroundPreset, setBackgroundPreset, backgroundPresets, backgroundStyle,
    motionConfig, setMotionConfig,
    glassIntensity, setGlassIntensity,
    glassEnabled, setGlassEnabled,
  } = useTheme();

  const [activeSection, setActiveSection] = useState('mode');

  const sections = [
    { id: 'mode', label: '主题模式', icon: Sun },
    { id: 'background', label: '背景', icon: Palette },
    { id: 'glass', label: '玻璃效果', icon: Sparkles },
    { id: 'motion', label: '动效', icon: Sliders },
  ];

  const modeOptions = [
    { id: 'light', label: '浅色', icon: Sun, desc: '明亮清新' },
    { id: 'dark', label: '深色', icon: Moon, desc: '护眼暗色' },
    { id: 'auto', label: '跟随系统', icon: Monitor, desc: '自动切换' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: `rgba(0,0,0, ${isDark ? '0.7' : '0.4'})`, backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl animate-scale-in"
        style={{
          background: isDark ? 'rgba(30, 30, 60, 0.9)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(40px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: isDark
            ? '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 24px 80px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.1)' }}>
              <Palette size={18} style={{ color: tokens.colors.accent.primary }} />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: tokens.colors.text.primary }}>外观设置</h3>
              <p className="text-xs" style={{ color: tokens.colors.text.muted }}>自定义界面主题和效果</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl transition-all hover:scale-105"
            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.muted }}>
            <X size={18} />
          </button>
        </div>

        {/* 分类导航 */}
        <div className="flex gap-1 px-6 py-3" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive ? (isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.1)') : 'transparent',
                  color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
                }}>
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 内容区 */}
        <div className="overflow-y-auto px-6 py-4 space-y-4" style={{ maxHeight: 'calc(85vh - 160px)' }}>

          {/* 主题模式 */}
          {activeSection === 'mode' && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: tokens.colors.text.secondary }}>选择主题模式</p>
              <div className="grid grid-cols-3 gap-3">
                {modeOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = mode === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setMode(opt.id)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                      style={{
                        background: isActive
                          ? (isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.1)')
                          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                        border: `2px solid ${isActive ? tokens.colors.accent.primary : 'transparent'}`,
                        color: isActive ? tokens.colors.accent.primary : tokens.colors.text.secondary,
                      }}>
                      <Icon size={24} />
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px]" style={{ color: tokens.colors.text.muted }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* 快速预览 */}
              <div className="mt-4 p-4 rounded-xl" style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
              }}>
                <p className="text-xs mb-3" style={{ color: tokens.colors.text.muted }}>效果预览</p>
                <div className="flex gap-3">
                  <div className="flex-1 h-16 rounded-xl transition-all" style={{
                    background: tokens.colors.surface.glass,
                    backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
                    border: `1px solid ${tokens.colors.border.hairline}`,
                    boxShadow: tokens.shadow.elevation,
                  }} />
                  <div className="flex-1 h-16 rounded-xl transition-all" style={{
                    background: tokens.colors.surface.glass,
                    backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
                    border: `1px solid ${tokens.colors.border.hairline}`,
                    boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* 背景设置 */}
          {activeSection === 'background' && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: tokens.colors.text.secondary }}>选择背景主题</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(backgroundPresets).map(([key, preset]) => {
                  const isActive = backgroundPreset === key;
                  const previewBg = {};
                  const gradientLayer = preset.layers.find(l => l.kind === 'linearGradient');
                  if (gradientLayer) {
                    previewBg.background = `linear-gradient(${gradientLayer.angle}deg, ${gradientLayer.colors.join(', ')})`;
                  }
                  return (
                    <button key={key} onClick={() => setBackgroundPreset(key)}
                      className="relative overflow-hidden rounded-xl h-20 transition-all"
                      style={{
                        ...previewBg,
                        border: `2px solid ${isActive ? tokens.colors.accent.primary : 'transparent'}`,
                        boxShadow: isActive ? `0 0 0 2px ${tokens.colors.accent.primary}40` : 'none',
                      }}>
                      {/* 光斑预览 */}
                      {preset.layers.filter(l => l.kind === 'radialGlow').map((g, i) => (
                        <div key={i} className="absolute rounded-full"
                          style={{
                            left: `${g.x * 100}%`, top: `${g.y * 100}%`,
                            width: `${g.size * 100}%`, height: `${g.size * 100}%`,
                            background: g.color, filter: `blur(${g.blur / 4}px)`,
                            transform: 'translate(-50%, -50%)',
                          }} />
                      ))}
                      <div className="absolute inset-x-0 bottom-0 p-2 text-center">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(0,0,0,0.3)', color: '#fff',
                            backdropFilter: 'blur(4px)',
                          }}>
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 玻璃效果 */}
          {activeSection === 'glass' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: tokens.colors.text.secondary }}>玻璃拟态效果</p>
                <button onClick={() => setGlassEnabled(!glassEnabled)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: glassEnabled
                      ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)')
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    color: glassEnabled ? tokens.colors.accent.success : tokens.colors.text.muted,
                  }}>
                  {glassEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  {glassEnabled ? '已开启' : '已关闭'}
                </button>
              </div>

              {glassEnabled && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: tokens.colors.text.muted }}>模糊强度</span>
                      <span className="text-xs font-mono" style={{ color: tokens.colors.accent.primary }}>{glassIntensity}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" value={glassIntensity}
                      onChange={e => setGlassIntensity(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${tokens.colors.accent.primary} ${glassIntensity}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} ${glassIntensity}%)`,
                      }}
                    />
                  </div>

                  {/* 实时预览 */}
                  <div className="relative h-32 rounded-xl overflow-hidden" style={backgroundStyle}>
                    <div className="absolute inset-4 rounded-xl flex items-center justify-center transition-all"
                      style={{
                        background: tokens.colors.surface.glass,
                        backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
                        border: `1px solid ${tokens.colors.border.hairline}`,
                        boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
                      }}>
                      <div className="text-center">
                        <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>玻璃卡片</div>
                        <div className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>实时预览效果</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 动效设置 */}
          {activeSection === 'motion' && (
            <div className="space-y-4">
              <p className="text-sm font-medium" style={{ color: tokens.colors.text.secondary }}>动效配置</p>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>悬浮上浮高度</span>
                    <span className="text-xs font-mono" style={{ color: tokens.colors.accent.primary }}>{motionConfig.hover.lift}px</span>
                  </div>
                  <input
                    type="range" min="0" max="12" value={motionConfig.hover.lift}
                    onChange={e => setMotionConfig(prev => ({
                      ...prev,
                      hover: { ...prev.hover, lift: parseInt(e.target.value) }
                    }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${tokens.colors.accent.primary} ${(motionConfig.hover.lift / 12) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} ${(motionConfig.hover.lift / 12) * 100}%)`,
                    }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>过渡速度</span>
                    <span className="text-xs font-mono" style={{ color: tokens.colors.accent.primary }}>{motionConfig.transitions.normal}ms</span>
                  </div>
                  <input
                    type="range" min="100" max="600" step="50" value={motionConfig.transitions.normal}
                    onChange={e => setMotionConfig(prev => ({
                      ...prev,
                      transitions: { ...prev.transitions, normal: parseInt(e.target.value) }
                    }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${tokens.colors.accent.primary} ${((motionConfig.transitions.normal - 100) / 500) * 100}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} ${((motionConfig.transitions.normal - 100) / 500) * 100}%)`,
                    }}
                  />
                </div>

                {/* 动效预览 */}
                <div className="flex gap-3 pt-2">
                  <div className="flex-1 p-4 rounded-xl text-center cursor-pointer glass-card"
                    style={{
                      background: tokens.colors.surface.glass,
                      border: `1px solid ${tokens.colors.border.hairline}`,
                      transition: `all ${motionConfig.transitions.normal}ms ${motionConfig.transitions.easing}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = `translateY(-${motionConfig.hover.lift}px)`;
                      e.currentTarget.style.boxShadow = tokens.shadow.elevationHover;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>悬浮试试</span>
                  </div>
                  <div className="flex-1 p-4 rounded-xl text-center cursor-pointer"
                    style={{
                      background: tokens.colors.surface.glass,
                      border: `1px solid ${tokens.colors.border.hairline}`,
                      transition: `all ${motionConfig.transitions.normal}ms ${motionConfig.transitions.easing}`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = `translateY(-${motionConfig.hover.lift}px)`;
                      e.currentTarget.style.background = tokens.colors.surface.glassHover;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = tokens.colors.surface.glass;
                    }}>
                    <span className="text-xs" style={{ color: tokens.colors.text.muted }}>我也可以</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                <div>
                  <span className="text-sm" style={{ color: tokens.colors.text.secondary }}>减少动效</span>
                  <p className="text-[10px]" style={{ color: tokens.colors.text.muted }}>跟随系统无障碍设置</p>
                </div>
                <button onClick={() => setMotionConfig(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }))}
                  className="w-10 h-5 rounded-full relative transition-all"
                  style={{
                    background: motionConfig.reducedMotion ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                  }}>
                  <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                    style={{ left: motionConfig.reducedMotion ? '22px' : '2px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
