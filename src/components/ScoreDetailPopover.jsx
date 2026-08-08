//【新需求108】成绩详情问号浮窗
//
// 需求原话：「监管台的成绩信息不是希望直接显示，词条上面还是显示是否录入。
//   录入的情况下，对勾旁边加一个问号，鼠标悬停显示录入的各年度具体成绩，通过小浮窗展示。」
//
// 这是对【新需求107】的修正：107 把分数直接铺在单元格里，导致表格变宽、
// 一眼扫不出"谁还没录"。108 回到"是否录入"为主视图，具体分数收进按需展开的浮窗。
//
// 实现要点（沿用【新需求103】ExamConflictMark 的经验）：
// 1. 不用原生 title —— 有~1s 延迟、样式不可控、多行会被截断，做不出"按年度分组"的排版。
// 2. 浮窗走 React Portal + position:fixed —— 监管台表格外层是 `overflow-x-auto`
//    的滚动容器，普通 absolute 浮窗会被容器裁掉；挂到 body 上就不会。
// 3. 自动翻转 + 水平夹取：靠近视口下边缘时改为向上弹出；靠近左右边缘时把浮窗拉回视口内。
// 4. 同时绑定 onClick（阻止冒泡）以支持触屏点按查看 —— 触屏没有 hover。

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { groupScoresByYear } from '../utils/scoreDisplayUtils';

const POPOVER_WIDTH = 260;
// 浮窗估算高度，仅用于判断是否需要向上翻转；宁可偏大，避免贴底被裁
const ESTIMATED_H = 220;

const ScoreDetailPopover = ({ student, scoreKey, label, isDark, tokens }) => {
  const anchorRef = useRef(null);
  const [tip, setTip] = useState(null); // { top, left, placement }

  const groups = groupScoresByYear(student, scoreKey);
  // 没有任何可展示的明细就不渲染问号 —— 避免出现点开是空的问号
  if (groups.length === 0) return null;

  const openTip = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const placeBelow = r.bottom + ESTIMATED_H < window.innerHeight;
    // 水平方向夹取：浮窗以锚点为中心，但不能越出视口左右边界
    const half = POPOVER_WIDTH / 2;
    const centerX = r.left + r.width / 2;
    const clampedX = Math.min(
      Math.max(centerX, half + 8),
      window.innerWidth - half - 8
    );
    setTip({
      top: placeBelow ? r.bottom + 6 : r.top - 6,
      left: clampedX,
      placement: placeBelow ? 'below' : 'above',
    });
  };
  const closeTip = () => setTip(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={openTip}
        onMouseLeave={closeTip}
        onFocus={openTip}
        onBlur={closeTip}
        onClick={(e) => { e.stopPropagation(); if (tip) closeTip(); else openTip(); }}
        className="inline-flex items-center justify-center align-middle"
        style={{ color: tokens.colors.text.muted, lineHeight: 0, cursor: 'help' }}
        aria-label={`查看${label}各年度具体成绩`}
      >
        <HelpCircle size={13} strokeWidth={2.2} />
      </button>
      {tip && createPortal(
        <div
          className="px-3 py-2.5 rounded-lg text-left"
          style={{
            position: 'fixed',
            top: tip.top,
            left: tip.left,
            transform: tip.placement === 'below' ? 'translateX(-50%)' : 'translate(-50%, -100%)',
            zIndex: 9999,
            width: POPOVER_WIDTH,
            maxHeight: '60vh',
            overflowY: 'auto',
            pointerEvents: 'none',
            background: isDark ? 'rgba(17,17,27,0.97)' : 'rgba(255,255,255,0.99)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
          }}
        >
          <div
            className="text-xs font-semibold mb-1.5 pb-1.5"
            style={{
              color: tokens.colors.text.primary,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            {label} 成绩记录
          </div>
          {groups.map(({ year, items }) => (
            <div key={year} className="mb-1.5 last:mb-0">
              <div className="text-[11px] font-semibold mb-0.5" style={{ color: isDark ? '#93c5fd' : '#2563eb' }}>
                {/^\d{4}$/.test(year) ? `${year} 年` : year}
              </div>
              {items.map((it, i) => (
                <div key={i} className="mb-0.5 last:mb-0">
                  <div className="text-xs flex items-baseline gap-1.5">
                    <span className="flex-shrink-0" style={{ color: tokens.colors.text.muted, minWidth: 42 }}>
                      {it.when}
                    </span>
                    <span className="font-semibold" style={{ color: tokens.colors.text.primary }}>
                      {it.main}
                    </span>
                  </div>
                  {it.detail && (
                    <div className="text-[11px] leading-snug pl-[50px]" style={{ color: tokens.colors.text.secondary }}>
                      {it.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default ScoreDetailPopover;
