/**
 * 【新需求89 子任务1】学生列表拼音搜索单测
 * 覆盖：全拼、首字母简拼、中文模糊、空 query、非 ASCII query
 */
import { describe, it, expect } from 'vitest';
import { toPinyin, toPinyinInitials, matchByPinyin } from '../utils/pinyinUtils';

describe('pinyinUtils.toPinyin', () => {
  it('张三 → zhangsan', () => {
    expect(toPinyin('张三')).toBe('zhangsan');
  });
  it('李四 → lisi', () => {
    expect(toPinyin('李四')).toBe('lisi');
  });
  it('王小明 → wangxiaoming', () => {
    expect(toPinyin('王小明')).toBe('wangxiaoming');
  });
  it('字典外字符（含字母）原样转小写', () => {
    expect(toPinyin('Tom 张')).toBe('tom zhang');
  });
});

describe('pinyinUtils.toPinyinInitials', () => {
  it('张三 → zs', () => {
    expect(toPinyinInitials('张三')).toBe('zs');
  });
  it('王小明 → wxm', () => {
    expect(toPinyinInitials('王小明')).toBe('wxm');
  });
});

describe('pinyinUtils.matchByPinyin', () => {
  it('全拼命中: 输入 zhang 命中"张三"', () => {
    expect(matchByPinyin('张三', 'zhang')).toBe(true);
  });
  it('全拼命中: 输入 san 命中"张三"', () => {
    expect(matchByPinyin('张三', 'san')).toBe(true);
  });
  it('首字母简拼命中: 输入 zs 命中"张三"', () => {
    expect(matchByPinyin('张三', 'zs')).toBe(true);
  });
  it('首字母简拼命中: 输入 wxm 命中"王小明"', () => {
    expect(matchByPinyin('王小明', 'wxm')).toBe(true);
  });
  it('中文模糊命中', () => {
    expect(matchByPinyin('王小明', '小明')).toBe(true);
  });
  it('空 query 视为匹配', () => {
    expect(matchByPinyin('张三', '')).toBe(true);
  });
  it('未命中返回 false', () => {
    expect(matchByPinyin('李四', 'zhang')).toBe(false);
  });
  it('text 为空返回 false', () => {
    expect(matchByPinyin('', 'zs')).toBe(false);
  });
  it('大小写不敏感', () => {
    expect(matchByPinyin('张三', 'ZHANG')).toBe(true);
    expect(matchByPinyin('张三', 'ZS')).toBe(true);
  });
  it('常见姓氏映射正确', () => {
    expect(toPinyin('陈')).toBe('chen');
    expect(toPinyin('沈')).toBe('shen');
    expect(toPinyin('李')).toBe('li');
    expect(toPinyin('王')).toBe('wang');
    expect(toPinyin('赵')).toBe('zhao');
    expect(toPinyin('刘')).toBe('liu');
    expect(toPinyin('黄')).toBe('huang');
    expect(toPinyin('吴')).toBe('wu');
    expect(toPinyin('周')).toBe('zhou');
    expect(toPinyin('徐')).toBe('xu');
    expect(toPinyin('孙')).toBe('sun');
  });
});
