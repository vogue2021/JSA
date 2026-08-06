// 【新需求99】管理员监管页面
// 管理员专属，按老师维度切换，Excel 风格表格：
//   每行 = 学生
//   列 = 基础信息录入完整度 / 成绩录入完整度 / 报考学校 & 每校申请状态
// 用于日常监管：一眼看出哪个老师带的学生资料还没录、成绩还没登、报考进度到哪一步。
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, GraduationCap, RefreshCw, Search, Download,
  Check, X as XIcon, AlertCircle, ChevronDown, ChevronRight,
  School as SchoolIcon, ClipboardList, Filter
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { studentsAPI, teachersAPI, schoolsAPI } from '../services/api';

// 学校申请状态 → 中文文案 + 颜色
const STATUS_MAP = {
  not_started: { label: '未开始', bg: '#e5e7eb', fg: '#374151' },
  preparing:   { label: '准备中', bg: '#dbeafe', fg: '#1e40af' },
  applied:     { label: '出愿完成', bg: '#dcfce7', fg: '#166534' },
  submitted:   { label: '邮寄完成', bg: '#fed7aa', fg: '#9a3412' },
  admitted:    { label: '已合格',   bg: '#fef3c7', fg: '#92400e' },
  rejected:    { label: '未合格',   bg: '#fee2e2', fg: '#991b1b' },
};

const statusPill = (status) => STATUS_MAP[status] || { label: status || '未知', bg: '#e5e7eb', fg: '#374151' };

// 判断基础信息是否录入（3 项核心字段：邮箱 / 电话 / 语言学校）
function checkBasicInfo(s) {
  const items = [
    { key: 'email', label: '邮箱', ok: !!(s.email && String(s.email).trim()) },
    { key: 'phone', label: '电话', ok: !!(s.phone && String(s.phone).trim()) },
    { key: 'languageSchool', label: '语言学校', ok: !!(s.languageSchool && String(s.languageSchool).trim()) },
  ];
  const done = items.filter(i => i.ok).length;
  return { items, done, total: items.length };
}

// 判断成绩是否录入（3 项：JLPT / EJU / 英语）
function checkScores(s) {
  const jlpt = Array.isArray(s.jlptScores) ? s.jlptScores.length > 0 : !!s.jlptScore;
  const eju  = Array.isArray(s.ejuScores)  && s.ejuScores.length > 0;
  const eng  = Array.isArray(s.englishScores) ? s.englishScores.length > 0 : !!s.englishScore;
  const items = [
    { key: 'jlpt', label: 'JLPT', ok: jlpt },
    { key: 'eju',  label: 'EJU',  ok: eju  },
    { key: 'eng',  label: '英语', ok: eng  },
  ];
  const done = items.filter(i => i.ok).length;
  return { items, done, total: items.length };
}

const AdminSupervisionPage = () => {
  const { tokens, isDark } = useTheme();
  const { user, showNotification } = useApp();

  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  // schoolsByStudent: { [studentId]: [{id,name,type,status,program,...}, ...] }
  const [schoolsByStudent, setSchoolsByStudent] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // 筛选/切换
  const [selectedTeacher, setSelectedTeacher] = useState('all'); // 'all' | teacher_id | 'unassigned'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 学生信息完整度过滤
  const [expandedRows, setExpandedRows] = useState(new Set()); // 展开显示学校详情的行

  // 仅 admin 访问
  if (user?.role !== 'admin') {
    return (
      <div className="glass-panel p-8 text-center rounded-2xl">
        <AlertCircle size={48} className="mx-auto mb-3" style={{ color: tokens.colors.text.muted }} />
        <div style={{ color: tokens.colors.text.secondary }}>
          该页面仅供管理员查看
        </div>
      </div>
    );
  }

  // 加载数据：老师 + 学生 + 每个学生的学校
  const loadAll = useCallback(async () => {
    setLoading(true);
    setProgress({ done: 0, total: 0 });
    try {
      const [teachersData, studentsData] = await Promise.all([
        teachersAPI.getAll().catch(() => []),
        studentsAPI.getAll().catch(() => []),
      ]);
      const teacherArr = Array.isArray(teachersData) ? teachersData : [];
      const studentArr = Array.isArray(studentsData) ? studentsData : [];
      setTeachers(teacherArr);
      setStudents(studentArr);

      // 批量拉取每个学生的报考学校（并发上限 6，避免打爆 Workers）
      const concurrency = 6;
      const buckets = {};
      let done = 0;
      setProgress({ done: 0, total: studentArr.length });
      for (let i = 0; i < studentArr.length; i += concurrency) {
        const slice = studentArr.slice(i, i + concurrency);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(slice.map(async (stu) => {
          try {
            const data = await schoolsAPI.getByStudent(stu.studentId);
            buckets[stu.studentId] = Array.isArray(data) ? data.map(s => ({
              id: s.id,
              name: s.name,
              nameJa: s.name_ja || '',
              type: s.type || '',
              program: s.program || '',
              status: s.status || 'not_started',
              applicationEndDate: s.application_end_date || '',
            })) : [];
          } catch {
            buckets[stu.studentId] = [];
          } finally {
            done += 1;
            setProgress({ done, total: studentArr.length });
          }
        }));
      }
      setSchoolsByStudent(buckets);
    } catch (e) {
      console.error('监管页面加载失败:', e);
      showNotification?.('数据加载失败，请重试', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // 按 teacher_id 分组学生（升学老师 teacherId 为主口径；未分配走 unassigned）
  const teacherToStudents = useMemo(() => {
    const map = {};
    for (const t of teachers) {
      if (t.teacher_id) map[t.teacher_id] = [];
    }
    map['__unassigned__'] = [];
    for (const s of students) {
      const tid = s.teacherId || '';
      if (tid && map[tid]) {
        map[tid].push(s);
      } else {
        map['__unassigned__'].push(s);
      }
    }
    return map;
  }, [teachers, students]);

  // 当前 tab 下要展示的学生
  const filteredStudents = useMemo(() => {
    let list;
    if (selectedTeacher === 'all') {
      list = students;
    } else if (selectedTeacher === 'unassigned') {
      list = teacherToStudents['__unassigned__'] || [];
    } else {
      list = teacherToStudents[selectedTeacher] || [];
    }
    // 搜索
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    // 完整度筛选
    if (statusFilter !== 'all') {
      list = list.filter(s => {
        const info = checkBasicInfo(s);
        const scr = checkScores(s);
        const totalDone = info.done + scr.done;
        const totalMax = info.total + scr.total;
        if (statusFilter === 'complete') return totalDone === totalMax;
        if (statusFilter === 'partial')  return totalDone > 0 && totalDone < totalMax;
        if (statusFilter === 'empty')    return totalDone === 0;
        return true;
      });
    }
    // 排序：按老师 → 学号
    return [...list].sort((a, b) => {
      const ta = a.teacherId || 'zzz';
      const tb = b.teacherId || 'zzz';
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a.studentId || '').localeCompare(String(b.studentId || ''));
    });
  }, [students, teacherToStudents, selectedTeacher, searchQuery, statusFilter]);

  // 老师名映射
  const teacherNameById = useMemo(() => {
    const m = {};
    for (const t of teachers) {
      if (t.teacher_id) m[t.teacher_id] = t.name;
    }
    return m;
  }, [teachers]);

  // 汇总卡片数据
  const summary = useMemo(() => {
    let infoComplete = 0, scoreComplete = 0, hasSchool = 0;
    for (const s of filteredStudents) {
      const i = checkBasicInfo(s);
      const c = checkScores(s);
      if (i.done === i.total) infoComplete++;
      if (c.done === c.total) scoreComplete++;
      if ((schoolsByStudent[s.studentId] || []).length > 0) hasSchool++;
    }
    return {
      total: filteredStudents.length,
      infoComplete,
      scoreComplete,
      hasSchool,
    };
  }, [filteredStudents, schoolsByStudent]);

  // 切换展开
  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // 导出 CSV
  const exportCsv = () => {
    const rows = [];
    rows.push([
      '负责老师', '学生姓名', '学号', '文理科',
      '邮箱√', '电话√', '语言学校√',
      'JLPT√', 'EJU√', '英语√',
      '报考学校数', '报考学校（学校 | 状态 | 类型）'
    ]);
    for (const s of filteredStudents) {
      const info = checkBasicInfo(s);
      const scr = checkScores(s);
      const schools = schoolsByStudent[s.studentId] || [];
      const schoolCell = schools.map(sc =>
        `${sc.name}${sc.program ? '('+sc.program+')' : ''} | ${statusPill(sc.status).label} | ${sc.type}`
      ).join(' ； ');
      rows.push([
        teacherNameById[s.teacherId] || '（未分配）',
        s.name || '',
        s.studentId || '',
        s.subject || '',
        info.items[0].ok ? '✔' : '',
        info.items[1].ok ? '✔' : '',
        info.items[2].ok ? '✔' : '',
        scr.items[0].ok ? '✔' : '',
        scr.items[1].ok ? '✔' : '',
        scr.items[2].ok ? '✔' : '',
        schools.length,
        schoolCell,
      ]);
    }
    const csv = rows.map(r => r.map(cell => {
      const v = cell == null ? '' : String(cell);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');
    // BOM + 换行修复 Excel 中文乱码
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `监管台_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification?.('已导出监管数据 CSV', 'success');
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  const okIcon = <Check size={14} style={{ color: '#16a34a' }} />;
  const noIcon = <XIcon size={14} style={{ color: '#dc2626' }} />;

  const TeacherTab = ({ id, label, count, active, onClick }) => (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5"
      style={{
        background: active
          ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)')
          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
        color: active ? (isDark ? '#c7d2fe' : '#4338ca') : tokens.colors.text.secondary,
        border: `1px solid ${active ? (isDark ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.35)') : 'transparent'}`,
      }}
    >
      {label}
      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
        background: active ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)') : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
        color: tokens.colors.text.muted,
      }}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} style={{ color: tokens.colors.text.primary }} />
            <h2 className="text-lg font-semibold" style={{ color: tokens.colors.text.primary }}>
              监管台
            </h2>
            <span className="text-xs px-2 py-0.5 rounded" style={{
              background: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
              color: isDark ? '#c7d2fe' : '#4338ca',
            }}>管理员</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={loading || filteredStudents.length === 0}
              className="btn-press px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                color: isDark ? '#6ee7b7' : '#065f46',
                border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)'}`,
              }}
            >
              <Download size={14} />
              导出 CSV
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className="btn-press px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: tokens.colors.text.secondary,
                border: `1px solid ${tokens.colors.border.subtle}`,
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
        </div>

        {/* 汇总卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>学生数</div>
            <div className="text-xl font-bold" style={{ color: tokens.colors.text.primary }}>{summary.total}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>基础信息完整</div>
            <div className="text-xl font-bold" style={{ color: isDark ? '#86efac' : '#166534' }}>
              {summary.infoComplete}<span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}> / {summary.total}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>成绩已录入</div>
            <div className="text-xl font-bold" style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}>
              {summary.scoreComplete}<span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}> / {summary.total}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>已添加志愿校</div>
            <div className="text-xl font-bold" style={{ color: isDark ? '#fde047' : '#a16207' }}>
              {summary.hasSchool}<span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}> / {summary.total}</span>
            </div>
          </div>
        </div>

        {/* 按老师维度切换 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs" style={{ color: tokens.colors.text.muted }}>
            <GraduationCap size={14} />
            <span>按老师筛选：</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <TeacherTab id="all" label="全部" count={students.length}
              active={selectedTeacher === 'all'} onClick={() => setSelectedTeacher('all')} />
            {teachers.map(t => (
              <TeacherTab
                key={t.teacher_id}
                id={t.teacher_id}
                label={t.name}
                count={(teacherToStudents[t.teacher_id] || []).length}
                active={selectedTeacher === t.teacher_id}
                onClick={() => setSelectedTeacher(t.teacher_id)}
              />
            ))}
            <TeacherTab
              id="unassigned"
              label="未分配"
              count={(teacherToStudents['__unassigned__'] || []).length}
              active={selectedTeacher === 'unassigned'}
              onClick={() => setSelectedTeacher('unassigned')}
            />
          </div>
        </div>

        {/* 搜索/筛选 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tokens.colors.text.muted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索姓名 / 学号 / 邮箱"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${tokens.colors.border.subtle}`,
                color: tokens.colors.text.primary,
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter size={14} style={{ color: tokens.colors.text.muted }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${tokens.colors.border.subtle}`,
                color: tokens.colors.text.primary,
              }}
            >
              <option value="all">全部录入状态</option>
              <option value="complete">全部录入完整</option>
              <option value="partial">部分录入</option>
              <option value="empty">尚未录入</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
            正在加载学生报考数据（{progress.done}/{progress.total}）…
          </div>
        )}
      </div>

      {/* Excel 风格表格 */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                <th className="px-2 py-2 text-left w-8"></th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  负责老师
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  学生
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  文理
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  邮箱
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  电话
                </th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  语言学校
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  JLPT
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  EJU
                </th>
                <th className="px-3 py-2 text-center font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  英语
                </th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  报考学校 & 状态
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm" style={{ color: tokens.colors.text.muted }}>
                    暂无匹配的学生
                  </td>
                </tr>
              )}
              {filteredStudents.map((s) => {
                const info = checkBasicInfo(s);
                const scr = checkScores(s);
                const schools = schoolsByStudent[s.studentId] || [];
                const isExpanded = expandedRows.has(s.studentId);
                const teacherName = teacherNameById[s.teacherId] || '（未分配）';
                return (
                  <React.Fragment key={s.studentId}>
                    <tr
                      className="hover:bg-opacity-50 transition-colors"
                      style={{
                        borderTop: `1px solid ${tokens.colors.border.subtle}`,
                      }}
                    >
                      <td className="px-2 py-2 align-middle">
                        {schools.length > 0 && (
                          <button
                            onClick={() => toggleExpand(s.studentId)}
                            className="p-0.5 rounded hover:bg-white/10"
                            title="展开学校详情"
                          >
                            {isExpanded
                              ? <ChevronDown size={14} style={{ color: tokens.colors.text.secondary }} />
                              : <ChevronRight size={14} style={{ color: tokens.colors.text.muted }} />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                        {teacherName}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium" style={{ color: tokens.colors.text.primary }}>{s.name || '-'}</div>
                        <div className="text-xs" style={{ color: tokens.colors.text.muted }}>{s.studentId || ''}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: tokens.colors.text.muted }}>
                        {s.subject || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">{info.items[0].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{info.items[1].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{info.items[2].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{scr.items[0].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{scr.items[1].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{scr.items[2].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2">
                        {schools.length === 0 ? (
                          <span className="text-xs" style={{ color: tokens.colors.text.muted }}>
                            <SchoolIcon size={12} className="inline mr-1" />
                            暂无
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {schools.slice(0, isExpanded ? schools.length : 3).map((sc) => {
                              const p = statusPill(sc.status);
                              return (
                                <span
                                  key={sc.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs whitespace-nowrap"
                                  style={{ background: p.bg, color: p.fg }}
                                  title={`${sc.name}${sc.program ? '（' + sc.program + '）' : ''} · ${sc.type} · ${p.label}`}
                                >
                                  {sc.name}
                                  <span className="opacity-70">·</span>
                                  {p.label}
                                </span>
                              );
                            })}
                            {!isExpanded && schools.length > 3 && (
                              <button
                                onClick={() => toggleExpand(s.studentId)}
                                className="text-xs underline"
                                style={{ color: tokens.colors.text.muted }}
                              >
                                +{schools.length - 3} 更多
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && schools.length > 0 && (
                      <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
                        <td></td>
                        <td colSpan={10} className="px-3 py-2">
                          <div className="text-xs mb-1" style={{ color: tokens.colors.text.muted }}>
                            报考学校明细（{schools.length}）
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ color: tokens.colors.text.muted }}>
                                  <th className="px-2 py-1 text-left font-normal">学校</th>
                                  <th className="px-2 py-1 text-left font-normal">研究科/专业</th>
                                  <th className="px-2 py-1 text-left font-normal">类型</th>
                                  <th className="px-2 py-1 text-left font-normal">出愿截止</th>
                                  <th className="px-2 py-1 text-left font-normal">状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schools.map((sc) => {
                                  const p = statusPill(sc.status);
                                  return (
                                    <tr key={sc.id}>
                                      <td className="px-2 py-1" style={{ color: tokens.colors.text.primary }}>
                                        {sc.name}
                                        {sc.nameJa && <span className="ml-1 opacity-60">({sc.nameJa})</span>}
                                      </td>
                                      <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>
                                        {sc.program || '-'}
                                      </td>
                                      <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>
                                        {sc.type || '-'}
                                      </td>
                                      <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>
                                        {sc.applicationEndDate || '-'}
                                      </td>
                                      <td className="px-2 py-1">
                                        <span className="px-1.5 py-0.5 rounded" style={{ background: p.bg, color: p.fg }}>
                                          {p.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 图例 */}
      <div className="glass-panel p-3 rounded-2xl">
        <div className="text-xs mb-2" style={{ color: tokens.colors.text.muted }}>状态图例：</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded text-xs" style={{ background: v.bg, color: v.fg }}>
              {v.label}
            </span>
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: tokens.colors.text.muted }}>
          <Check size={12} className="inline mr-1" style={{ color: '#16a34a' }} />= 已录入 &nbsp;
          <XIcon size={12} className="inline mr-1" style={{ color: '#dc2626' }} />= 未录入
        </div>
      </div>
    </div>
  );
};

export default AdminSupervisionPage;
