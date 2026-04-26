import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * 新用户引导组件（需求42）
 *
 * 使用方式：
 *   <OnboardingTour
 *     steps={[
 *       { target: '[data-tour="sidebar"]', title: '...', content: '...', placement: 'right' },
 *       ...
 *     ]}
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     storageKey="jsa_onboarding_done_v1"
 *   />
 *
 * 特性：
 *   - 遮罩层 + 聚焦高亮（通过 SVG mask 镂空）
 *   - 自动根据 placement 计算 tooltip 位置（上/下/左/右/center）
 *   - 支持滚动到可见区域
 *   - 首次完成后写入 localStorage，避免再次弹出
 *   - 可通过 open prop 外部手动重新打开
 *   - 目标元素不存在时自动跳过该步或以居中模式展示
 */
export default function OnboardingTour({
  steps = [],
  open,
  onClose,
  storageKey = 'jsa_onboarding_done_v1',
  onFinish,
}) {
  const { tokens, isDark } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null); // 聚焦目标的位置
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  const tooltipRef = useRef(null);

  // 打开/重置
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  // 视口尺寸
  useEffect(() => {
    if (!open) return;
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', () => {
      // 重新测量
      measure();
    }, true);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const measure = useCallback(() => {
    if (!open) return;
    const step = steps[stepIndex];
    if (!step) return;

    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }

    // 滚动到可见
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {}

    // 稍等滚动完成再测量
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    });
  }, [open, steps, stepIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, viewport]);

  // 键盘支持
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, steps.length]);

  const markDone = () => {
    try {
      localStorage.setItem(storageKey, '1');
      localStorage.setItem(`${storageKey}_at`, new Date().toISOString());
    } catch {}
  };

  const handleNext = () => {
    if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
    else handleFinish();
  };
  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };
  const handleSkip = () => {
    markDone();
    onClose?.();
  };
  const handleFinish = () => {
    markDone();
    onFinish?.();
    onClose?.();
  };

  if (!open || steps.length === 0) return null;
  const step = steps[stepIndex];
  if (!step) return null;

  // 计算 tooltip 位置
  const TOOLTIP_W = 360;
  const TOOLTIP_MAX_H = 320;
  const GAP = 14;
  const { w: vw, h: vh } = viewport;

  let tipStyle = {};
  const placement = step.placement || (rect ? 'auto' : 'center');

  if (!rect || placement === 'center') {
    // 居中展示（欢迎/结束页）
    tipStyle = {
      top: Math.max(80, vh / 2 - TOOLTIP_MAX_H / 2),
      left: Math.max(20, vw / 2 - TOOLTIP_W / 2),
      width: Math.min(TOOLTIP_W, vw - 40),
    };
  } else {
    // 围绕 rect 计算
    let finalPlacement = placement;
    if (placement === 'auto') {
      // 自动选择空间最大的方向
      const spaceBelow = vh - (rect.top + rect.height);
      const spaceAbove = rect.top;
      const spaceRight = vw - (rect.left + rect.width);
      const spaceLeft = rect.left;
      const max = Math.max(spaceBelow, spaceAbove, spaceRight, spaceLeft);
      if (max === spaceBelow) finalPlacement = 'bottom';
      else if (max === spaceAbove) finalPlacement = 'top';
      else if (max === spaceRight) finalPlacement = 'right';
      else finalPlacement = 'left';
    }

    let top = 0, left = 0;
    switch (finalPlacement) {
      case 'top':
        top = rect.top - TOOLTIP_MAX_H - GAP;
        left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
        break;
      case 'bottom':
        top = rect.top + rect.height + GAP;
        left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - TOOLTIP_MAX_H / 2;
        left = rect.left - TOOLTIP_W - GAP;
        break;
      case 'right':
      default:
        top = rect.top + rect.height / 2 - TOOLTIP_MAX_H / 2;
        left = rect.left + rect.width + GAP;
        break;
    }
    // 防止溢出
    top = Math.max(16, Math.min(top, vh - 120));
    left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));
    tipStyle = { top, left, width: Math.min(TOOLTIP_W, vw - 32) };
  }

  // 高亮框 padding
  const PAD = 6;
  const hiRect = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const bgColor = isDark ? 'rgba(20,20,40,0.95)' : 'rgba(255,255,255,0.98)';
  const textPrimary = tokens?.colors?.text?.primary || (isDark ? '#f5f5f5' : '#111827');
  const textSecondary = tokens?.colors?.text?.secondary || (isDark ? '#cbd5e1' : '#4b5563');
  const accent = tokens?.colors?.accent?.primary || '#6366f1';
  const borderColor = tokens?.colors?.border?.subtle || (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');

  const total = steps.length;
  const progressPct = ((stepIndex + 1) / total) * 100;

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      aria-label="新用户引导"
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
    >
      {/* 遮罩层：用 SVG 做镂空高亮 */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
        }}
        onClick={handleSkip}
      >
        <defs>
          <mask id="jsa-onboarding-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hiRect && (
              <rect
                x={hiRect.left}
                y={hiRect.top}
                width={hiRect.width}
                height={hiRect.height}
                rx="10"
                ry="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#jsa-onboarding-mask)"
        />
        {/* 高亮边框 */}
        {hiRect && (
          <rect
            x={hiRect.left}
            y={hiRect.top}
            width={hiRect.width}
            height={hiRect.height}
            rx="10"
            ry="10"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
          />
        )}
      </svg>

      {/* Tooltip 卡片 */}
      <div
        ref={tooltipRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          ...tipStyle,
          background: bgColor,
          color: textPrimary,
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          boxShadow: isDark
            ? '0 20px 40px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 20px 40px -12px rgba(0,0,0,0.18)',
          padding: 20,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          maxHeight: TOOLTIP_MAX_H,
          overflow: 'auto',
        }}
      >
        {/* 顶部：进度 + 关闭 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: textSecondary }}>
            <Sparkles size={14} style={{ color: accent }} />
            <span>
              第 {stepIndex + 1} / {total} 步
            </span>
          </div>
          <button
            onClick={handleSkip}
            title="跳过引导"
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* 标题 */}
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: textPrimary }}>
          {step.title}
        </div>

        {/* 正文 */}
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: textSecondary, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {step.content}
        </div>

        {/* 进度条 */}
        <div
          style={{
            height: 3,
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: accent,
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: textSecondary,
              cursor: 'pointer',
              fontSize: 12.5,
              padding: '6px 8px',
            }}
          >
            跳过
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'transparent',
                  border: `1px solid ${borderColor}`,
                  color: textPrimary,
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} /> 上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: accent,
                border: 'none',
                color: '#fff',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 12.5,
                cursor: 'pointer',
                boxShadow: `0 4px 12px -4px ${accent}`,
              }}
            >
              {stepIndex === total - 1 ? (
                <>
                  <Check size={14} /> 开始使用
                </>
              ) : (
                <>
                  下一步 <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
