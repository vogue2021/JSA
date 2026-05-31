/**
 * 【新需求90】出愿截止类型反向提取小工具单测
 *
 * 这里只测一个内联小函数的等价实现，确保正则不会误伤其它事件标题。
 * 实际函数定义在 src/App.jsx 内（loadStudentDataFromAPI 中），保持一致即可。
 */
import { describe, it, expect } from 'vitest';

const extractDeadlineType = (title) => {
  if (!title || typeof title !== 'string') return '';
  const m = title.match(/出愿截止[（(]([^）)]+)[）)]\s*$/);
  return m ? m[1].trim() : '';
};

describe('extractDeadlineType（出愿截止类型反向提取）', () => {
  it('中文圆括号 - 消印有效', () => {
    expect(extractDeadlineType('早稲田大学 出愿截止（消印有效）')).toBe('消印有效');
  });
  it('中文圆括号 - 必着', () => {
    expect(extractDeadlineType('東京大学 出愿截止（必着）')).toBe('必着');
  });
  it('中文圆括号 - 当面受付', () => {
    expect(extractDeadlineType('京都大学 出愿截止（当面受付）')).toBe('当面受付');
  });
  it('英文圆括号也兼容', () => {
    expect(extractDeadlineType('A大学 出愿截止(消印有効)')).toBe('消印有効');
  });
  it('没有后缀返回空', () => {
    expect(extractDeadlineType('A大学 出愿截止')).toBe('');
  });
  it('其它事件标题不会误命中', () => {
    expect(extractDeadlineType('A大学 入学考试')).toBe('');
    expect(extractDeadlineType('A大学 合格发表')).toBe('');
    expect(extractDeadlineType('A大学 出愿开始')).toBe('');
  });
  it('"出愿截止"在中间但不是后缀，不命中', () => {
    expect(extractDeadlineType('A大学 出愿截止前最后提醒')).toBe('');
  });
  it('空/非字符串安全', () => {
    expect(extractDeadlineType('')).toBe('');
    expect(extractDeadlineType(null)).toBe('');
    expect(extractDeadlineType(undefined)).toBe('');
    expect(extractDeadlineType(123)).toBe('');
  });
});
