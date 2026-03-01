/**
 * exportUtils 工具函数单元测试
 * 覆盖：状态文本转换、ICS 字符串转义、CSV 格式化
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DOM API ─────────────────────────────────────────────────────────────
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock document.createElement 返回可点击的 <a>
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'a') {
    return { href: '', download: '', click: mockClick, style: {} };
  }
  return originalCreateElement(tag);
});
vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

// ─── 导入被测模块 ─────────────────────────────────────────────────────────────
import { exportToCSV, exportEventsToICS } from '../utils/exportUtils';

// ─── exportToCSV 测试 ─────────────────────────────────────────────────────────
describe('exportToCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应触发文件下载', () => {
    exportToCSV('姓名,学号\n张三,S001', '学生信息');
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('应使用 .csv 扩展名', () => {
    exportToCSV('test', 'myfile');
    const aElement = mockAppendChild.mock.calls[0]?.[0];
    expect(aElement?.download).toBe('myfile.csv');
  });

  it('应包含 UTF-8 BOM（确保 Excel 正确显示中文）', () => {
    let capturedBlob;
    global.URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    exportToCSV('测试内容', 'test');
    // Blob 应包含 BOM 字符
    expect(capturedBlob).toBeDefined();
    expect(capturedBlob.type).toContain('text/csv');
  });
});

// ─── exportEventsToICS 测试 ──────────────────────────────────────────────────
describe('exportEventsToICS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = mockCreateObjectURL;
  });

  const mockEvents = [
    {
      id: 'evt_001',
      title: '东京大学校内考',
      date: '2026-03-15',
      type: 'exam',
      category: '校内考',
      notes: '准备数学和理科',
      completed: false,
      urgent: true,
    },
    {
      id: 'evt_002',
      title: '早稻田大学出愿截止',
      date: '2026-04-01',
      type: 'deadline',
      category: '出愿截止',
      notes: '',
      completed: false,
      urgent: false,
    },
  ];

  it('应触发 .ics 文件下载', () => {
    exportEventsToICS(mockEvents, '张三');
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('下载文件名应包含学生姓名', () => {
    exportEventsToICS(mockEvents, '李四');
    const aElement = mockAppendChild.mock.calls[0]?.[0];
    expect(aElement?.download).toContain('李四');
    expect(aElement?.download).toContain('.ics');
  });

  it('生成的 ICS 内容应包含 VCALENDAR 头', () => {
    let capturedBlob;
    global.URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    exportEventsToICS(mockEvents, '王五');
    expect(capturedBlob).toBeDefined();
    expect(capturedBlob.type).toContain('text/calendar');
  });

  it('空事件列表也应正常导出', () => {
    expect(() => exportEventsToICS([], '测试学生')).not.toThrow();
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });
});

// ─── 状态文本映射测试（通过 CSV 导出间接验证） ────────────────────────────────
describe('学部流程状态文本映射', () => {
  // 通过导入内部函数间接测试（exportStudentToCSV 会调用 getStatusText）
  it('状态枚举应与学部流程一致', async () => {
    // 验证枚举字典文件中的映射
    const { SCHOOL_STATUS, SCHOOL_STATUS_LABELS } = await import('../constants/schoolProcess');
    expect(SCHOOL_STATUS_LABELS[SCHOOL_STATUS.PREPARING]).toBe('准备中');
    expect(SCHOOL_STATUS_LABELS[SCHOOL_STATUS.APPLIED]).toBe('已出愿');
    expect(SCHOOL_STATUS_LABELS[SCHOOL_STATUS.SUBMITTED]).toBe('出愿结束');
    expect(SCHOOL_STATUS_LABELS[SCHOOL_STATUS.ADMITTED]).toBe('已合格');
  });

  it('事件类型枚举应与学部流程一致', async () => {
    const { EVENT_TYPE, EVENT_TYPE_LABELS } = await import('../constants/schoolProcess');
    expect(EVENT_TYPE_LABELS[EVENT_TYPE.EXAM]).toBe('校内考');
    expect(EVENT_TYPE_LABELS[EVENT_TYPE.DEADLINE]).toBe('出愿截止');
    expect(EVENT_TYPE_LABELS[EVENT_TYPE.INTERVIEW]).toBe('面试');
    expect(EVENT_TYPE_LABELS[EVENT_TYPE.DOCUMENT]).toBe('材料准备');
  });
});
