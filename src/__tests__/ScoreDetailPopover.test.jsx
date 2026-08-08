//【新需求108】成绩明细问号浮窗的组件行为测试
//
// 重点验证三件容易出错的事：
// 1. 没有可展示明细时**不渲染问号** —— 否则用户点开一个空浮窗，比不给问号更糟
// 2. 悬停/点击才出现浮窗，且内容按年度分组
// 3. 浮窗通过 Portal 挂到 document.body —— 监管台表格是 overflow-x-auto 容器，
//    挂在表格内部会被裁切，这是需求103已经踩过的坑

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScoreDetailPopover from '../components/ScoreDetailPopover';

// 组件只用到 tokens 里的少数颜色，给一个最小可用的假 tokens
const tokens = {
  colors: {
    text: { primary: '#111', secondary: '#444', muted: '#888' },
  },
};

const renderPopover = (student, scoreKey = 'jlpt', label = 'JLPT') =>
  render(
    <ScoreDetailPopover
      student={student}
      scoreKey={scoreKey}
      label={label}
      isDark={false}
      tokens={tokens}
    />
  );

describe('ScoreDetailPopover', () => {
  it('无成绩明细时不渲染问号按钮', () => {
    const { container } = renderPopover({ jlptScores: [] });
    expect(container.querySelector('button')).toBeNull();
  });

  it('有成绩时渲染问号按钮', () => {
    const { container } = renderPopover({
      jlptScores: [{ date: '2025-07', level: 'N1', score: 160 }],
    });
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toContain('JLPT');
  });

  it('默认不显示浮窗，悬停后才出现并按年度分组', () => {
    const student = {
      jlptScores: [
        { date: '2025-07', level: 'N1', score: 160 },
        { date: '2024-12', level: 'N2', score: 140 },
      ],
    };
    const { container } = renderPopover(student);
    // 未交互时不应有浮窗内容
    expect(screen.queryByText('JLPT 成绩记录')).toBeNull();

    fireEvent.mouseEnter(container.querySelector('button'));
    expect(screen.getByText('JLPT 成绩记录')).toBeInTheDocument();
    expect(screen.getByText('2025 年')).toBeInTheDocument();
    expect(screen.getByText('2024 年')).toBeInTheDocument();
    expect(screen.getByText('N1 160 分')).toBeInTheDocument();

    fireEvent.mouseLeave(container.querySelector('button'));
    expect(screen.queryByText('JLPT 成绩记录')).toBeNull();
  });

  it('浮窗挂在 document.body 上（Portal），不会被表格的 overflow 容器裁切', () => {
    const { container } = renderPopover({
      jlptScores: [{ date: '2025-07', level: 'N1', score: 160 }],
    });
    fireEvent.mouseEnter(container.querySelector('button'));
    const panel = screen.getByText('JLPT 成绩记录').closest('div[style]');
    expect(panel).not.toBeNull();
    // 关键断言：浮窗不在组件自身的 DOM 子树里
    expect(container.contains(panel)).toBe(false);
    expect(document.body.contains(panel)).toBe(true);
  });

  it('点击可切换显示（触屏没有 hover，必须支持点按）', () => {
    const { container } = renderPopover({
      jlptScores: [{ date: '2025-07', level: 'N1', score: 160 }],
    });
    const btn = container.querySelector('button');
    fireEvent.click(btn);
    expect(screen.getByText('JLPT 成绩记录')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('JLPT 成绩记录')).toBeNull();
  });

  it('EJU 浮窗显示总分与各科分项', () => {
    const { container } = renderPopover(
      { ejuScores: [{ date: '2025-11', japanese: 320, math: 170, generalSubjects: 160 }] },
      'eju', 'EJU'
    );
    fireEvent.mouseEnter(container.querySelector('button'));
    expect(screen.getByText('总分 650')).toBeInTheDocument();
    expect(screen.getByText(/日语 320/)).toBeInTheDocument();
  });
});
