//【新需求109】学生端看不到自己数据的回归测试
//
// 线上故障复盘：
//   学生账号 wu081418@gmail.com（学号2026091）登录后学校/事件/材料全为空，
//   但老师端能正常看到该生的 7 所学校。数据库侧数据完好（7 学校 / 35 事件 / 59 材料）。
//
// 根因是两处存储的生命周期不一致 + 恢复时不校验归属：
//   · `user`存sessionStorage —— 关标签页即失效
//   · `currentStudent` 存 localStorage   —— 持久保留
//   于是"老师登录并选过学生 X → 直接关浏览器（没点登出）→ 学生 Y 登录"这条路径下，
//   学生 Y 会恢复出别人的 currentStudent(X)，前端去请求 /schools/student/X，
//   后端判定越权返回 403，而前端把错误就地吞掉 → 表现为一片空白且毫无提示。
//
// 这里测的是修复后的**纯逻辑**（不渲染整个 App —— App.jsx 有 7000+ 行、依赖极重）：
//   1. resolveInitialCurrentStudent：恢复缓存时的归属校验
//   2. classifyLoadFailure       ：把接口失败分类成可提示的原因
// 两个函数从 utils/currentStudentGuard.js 导出，App.jsx 直接引用同一实现。

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveInitialCurrentStudent,
  classifyLoadFailure,
} from '../utils/currentStudentGuard';

const teacher = { role: 'teacher', teacherId: 't1', name: '王老师' };
const studentSelf = {
  role: 'student', studentId: '2026091', name: '吴以凡',
  email: 'wu081418@gmail.com', teacherId: 'teacher_1778938440541',
};

describe('resolveInitialCurrentStudent —— 缓存归属校验', () => {
  beforeEach(() => localStorage.clear());

  it('线上故障场景：学生登录时命中他人残留缓存 → 必须丢弃并锁定为本人', () => {
    // 老师此前选过别的学生，残留在 localStorage
    localStorage.setItem('currentStudent', JSON.stringify({ studentId: '2026004', name: '王大锤' }));

    const result = resolveInitialCurrentStudent(studentSelf);

    expect(result.studentId).toBe('2026091');
    expect(result.name).toBe('吴以凡');
    // 脏缓存要被清掉，否则下次刷新又会命中
    expect(localStorage.getItem('currentStudent')).toBeNull();
  });

  it('学生自己的缓存要保留（含老师选过的其它字段，不能无谓重置）', () => {
    localStorage.setItem('currentStudent', JSON.stringify({
      studentId: '2026091', name: '吴以凡', subject: '文科',
    }));

    const result = resolveInitialCurrentStudent(studentSelf);

    expect(result.studentId).toBe('2026091');
    expect(result.subject).toBe('文科');
  });

  it('老师/管理员不受限制 —— 他们本来就要切换查看不同学生', () => {
    localStorage.setItem('currentStudent', JSON.stringify({ studentId: '2026004', name: '王大锤' }));

    const result = resolveInitialCurrentStudent(teacher);

    expect(result.studentId).toBe('2026004');
    expect(localStorage.getItem('currentStudent')).not.toBeNull();
  });

  it('无缓存时，学生落到自己的默认档案', () => {
    const result = resolveInitialCurrentStudent(studentSelf);
    expect(result.studentId).toBe('2026091');
    expect(result.email).toBe('wu081418@gmail.com');
  });

  it('学号类型不一致（数字 vs 字符串）不应误判为他人缓存', () => {
    localStorage.setItem('currentStudent', JSON.stringify({ studentId: 2026091, name: '吴以凡' }));
    const result = resolveInitialCurrentStudent({ ...studentSelf, studentId: '2026091' });
    // 未被清除即说明比较做了字符串归一
    expect(String(result.studentId)).toBe('2026091');
    expect(localStorage.getItem('currentStudent')).not.toBeNull();
  });

  it('user.studentId 尚未就绪时不误删缓存（避免时序竞争把好数据清掉）', () => {
    localStorage.setItem('currentStudent', JSON.stringify({ studentId: '2026091' }));
    const result = resolveInitialCurrentStudent({ role: 'student', studentId: null });
    expect(localStorage.getItem('currentStudent')).not.toBeNull();
    expect(result.studentId).toBe('2026091');
  });

  it('缓存是坏 JSON 时不抛异常，回退到本人默认档案', () => {
    localStorage.setItem('currentStudent', '{坏掉的 json');
    const result = resolveInitialCurrentStudent(studentSelf);
    expect(result.studentId).toBe('2026091');
  });
});

describe('classifyLoadFailure —— 让静默失败变得可见', () => {
  it('403 识别为越权，并给出"重新登录"这一可行动建议', () => {
    const r = classifyLoadFailure([{ label: '学校', status: 403 }]);
    expect(r.kind).toBe('forbidden');
    expect(r.message).toContain('学校');
    expect(r.message).toContain('重新登录');
  });

  it('后端错误码 PERMISSION_DENIED 同样识别为越权', () => {
    expect(classifyLoadFailure([{ label: '学校', code: 'PERMISSION_DENIED' }]).kind).toBe('forbidden');
  });

  it('401 / ACCOUNT_DELETED 优先按登录失效处理', () => {
    expect(classifyLoadFailure([{ label: '事件', status: 401 }]).kind).toBe('expired');
    expect(classifyLoadFailure([
      { label: '学校', status: 403 },
      { label: '事件', status: 401 },
    ]).kind).toBe('expired');
  });

  it('其它错误归为网络类，并列出失败的数据项', () => {
    const r = classifyLoadFailure([{ label: '事件', status: 500 }, { label: '材料', status: 502 }]);
    expect(r.kind).toBe('network');
    expect(r.message).toContain('事件');
    expect(r.message).toContain('材料');
  });

  it('无失败时返回 null（不能打扰用户）', () => {
    expect(classifyLoadFailure([])).toBeNull();
    expect(classifyLoadFailure(undefined)).toBeNull();
  });
});
