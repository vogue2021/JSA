// 【新需求99】管理员监管页面
// 【新需求101】① 改为权限化：管理员 + 被授予 view_supervision 权限的老师均可访问
//              ② 增加"校内考撞期"检测列，把同一学生名下不同学校考试日期撞在同一天的情况标红
// 【新需求103】增加"按大学维度"视图
// 【新需求106】① 基础信息列去掉「邮箱 / 电话」，追加「项目套餐 / 毕业高中 / 学籍」（直接展示实际值）
//              ② 成绩列支持第三态「无」—— 老师在学生信息页明确标记"无相关成绩"后，这里显示「无」而不是红叉
// 按老师维度切换，Excel 风格表格：
//   每行 = 学生
//   列 = 基础信息 / 成绩录入完整度 / 考试撞期 / 报考学校 & 每校申请状态
// 用于日常监管：一眼看出哪个老师带的学生资料还没录、成绩还没登、报考进度到哪一步、考试是否撞期。
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, GraduationCap, RefreshCw, Search, Download,
  Check, X as XIcon, AlertCircle, ChevronDown, ChevronRight,
  School as SchoolIcon, ClipboardList, Filter, AlertTriangle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { studentsAPI, teachersAPI, schoolsAPI } from '../services/api';
// 【新需求101】校内考撞期检测（纯计算工具，与学校页面共用同一套口径）
import { detectExamConflicts, getSchoolConflicts, collectExamDates, formatConflictSummary } from '../utils/examConflictUtils';
// 【新需求106】项目套餐历史名称 → 现行名称的规范化（与学生信息页共用同一套映射）
import { getPackageDisplayName } from '../utils/packageUtils';
// 【新需求106】"确认无相关成绩"三态口径（与学生信息页共用，避免口径漂移）
import { normalizeScoreNoneFlags, resolveScoreState } from '../utils/scoreNoneUtils';

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

// 【新需求106】基础信息核查项调整：
//   去掉「邮箱 / 电话」（监管场景不关心联系方式是否填了），
//   追加「项目套餐 / 毕业高中 / 学籍信息」这三项签约与背景关键信息。
//   项目套餐、毕业高中、学籍信息在表格里直接展示**实际值**（比打勾更有监管价值），
//   语言学校沿用 ✔/✘ 的录入状态口径。
function checkBasicInfo(s) {
  const items = [
    { key: 'packageName', label: '项目套餐', value: s.packageName || '', ok: !!(s.packageName && String(s.packageName).trim()) },
    { key: 'highSchool', label: '毕业高中', value: s.highSchool || '', ok: !!(s.highSchool && String(s.highSchool).trim()) },
    { key: 'hasChinaHighSchoolRecord', label: '学籍信息', value: s.hasChinaHighSchoolRecord || '', ok: !!(s.hasChinaHighSchoolRecord && String(s.hasChinaHighSchoolRecord).trim()) },
    { key: 'languageSchool', label: '语言学校', value: s.languageSchool || '', ok: !!(s.languageSchool && String(s.languageSchool).trim()) },
  ];
  const done = items.filter(i => i.ok).length;
  return { items, done, total: items.length };
}

// 判断成绩是否录入（3 项：JLPT / EJU / 英语）
// 【新需求106】三态口径：
//   has= 确实录了成绩            → 显示 ✔
//   none = 没成绩，但老师**明确标记了「无」** → 显示「无」
//   其余 = 尚未确认                → 显示 ✘
// 明确标记「无」同样算"已确认"，计入完整度 —— 否则没有考试成绩的学生完整度永远无法达标。
function checkScores(s) {
  const flags = normalizeScoreNoneFlags(s.scoreNoneFlags);
  const items = [
    { key: 'jlpt', label: 'JLPT', ...resolveScoreState(Array.isArray(s.jlptScores) ? s.jlptScores.length > 0 : !!s.jlptScore, flags, 'jlpt') },
    { key: 'eju', label: 'EJU', ...resolveScoreState(Array.isArray(s.ejuScores) && s.ejuScores.length > 0, flags, 'eju') },
    { key: 'eng', label: '英语', ...resolveScoreState(Array.isArray(s.englishScores) ? s.englishScores.length > 0 : !!s.englishScore, flags, 'english') },
  ];
  const done = items.filter(i => i.ok).length;
  return { items, done, total: items.length };
}

const AdminSupervisionPage = () => {
  const { tokens, isDark } = useTheme();
  const { user, showNotification, hasPermission } = useApp();

  // 【新需求101】访问权限：管理员始终可看；老师需被勾选 view_supervision
  const canView = user?.role === 'admin'
    || (user?.role === 'teacher' && hasPermission?.('view_supervision'));
  // 数据范围：管理员 / 拥有 view_all_students 的老师可按任意老师维度切换；
  //   普通被授权老师只能看自己负责的学生（后端 /students 已强制按teacher_id 过滤，前端同步收敛UI）
  const canSeeAllTeachers = user?.role === 'admin' || hasPermission?.('view_all_students');

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
  // 【新需求103】视图维度：teacher = 按老师看学生；university = 按大学看报考学生
  const [viewMode, setViewMode] = useState('teacher');
  const [expandedUniversities, setExpandedUniversities] = useState(new Set());

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
            buckets[stu.studentId] = Array.isArray(data) ? data.map(s => {
              // 【新需求101】extra_dates 里藏着一审/二审/自定义日期，撞期检测必须一起带出来
              let extra = {};
              const rawExtra = s.extra_dates;
              if (rawExtra && typeof rawExtra === 'object') extra = rawExtra;
              else if (typeof rawExtra === 'string' && rawExtra.trim()) {
                try { extra = JSON.parse(rawExtra) || {}; } catch { extra = {}; }
              }
              return {
                id: s.id,
                name: s.name,
                nameJa: s.name_ja || '',
                type: s.type || '',
                program: s.program || '',
                status: s.status || 'not_started',
                applicationEndDate: s.application_end_date || '',
                // 考试类日期（撞期检测数据源）
                examDate: s.exam_date || '',
                firstExamDate: extra.firstExamDate || '',
                secondExamDate: extra.secondExamDate || '',
                customDates: Array.isArray(extra.customDates) ? extra.customDates : [],
              };
            }) : [];
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
    // 无权限时不发起任何请求
    if (!canView) return;
    loadAll();
  }, [canView, loadAll]);

  // 【新需求101】非全量范围的老师：后端 /students 已按 teacher_id / academic_advisor_id /
  //   consultant_id 收敛过数据，前端只要保持 'all' 视图即可（若强制切到自己的 teacher_id，
  //   会漏掉"我是学管/顾问但不是升学老师"的那部分学生）。
  useEffect(() => {
    if (!canSeeAllTeachers) setSelectedTeacher('all');
  }, [canSeeAllTeachers]);

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

  // 当前 tab 下要展示的学生（仅按老师维度收敛，搜索/完整度筛选在下一层做）
  const teacherScopedStudents = useMemo(() => {
    if (selectedTeacher === 'all') return students;
    if (selectedTeacher === 'unassigned') return teacherToStudents['__unassigned__'] || [];
    return teacherToStudents[selectedTeacher] || [];
  }, [students, teacherToStudents, selectedTeacher]);

  // 当前 tab 下要展示的学生
  const filteredStudents = useMemo(() => {
    let list = teacherScopedStudents;
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
  }, [teacherScopedStudents, searchQuery, statusFilter]);

  // 老师名映射
  const teacherNameById = useMemo(() => {
    const m = {};
    for (const t of teachers) {
      if (t.teacher_id) m[t.teacher_id] = t.name;
    }
    return m;
  }, [teachers]);

  // 【新需求101】逐个学生做校内考撞期检测：{ [studentId]: conflictResult }
  //   口径与学校页面完全一致（同一学生名下 >=2 所不同学校的考试日期落在同一天）
  const conflictByStudent = useMemo(() => {
    const map = {};
    for (const [studentId, list] of Object.entries(schoolsByStudent)) {
      map[studentId] = detectExamConflicts(list);
    }
    return map;
  }, [schoolsByStudent]);

  // 【新需求103】按大学维度聚合：某所大学都有哪些学生报考了
  //   数据源与老师视图一致（同一份 schoolsByStudent），只是换了个聚合键：学校名。
  //   同一学生在同一所大学报了多个学部 → 学部各占一行，但"报考人数"按学生去重。
  const universityGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const map = new Map(); // schoolName -> group
    for (const stu of teacherScopedStudents) {
      const list = schoolsByStudent[stu.studentId] || [];
      const conflict = conflictByStudent[stu.studentId];
      for (const sc of list) {
        const name = (sc.name || '(未命名学校)').trim();
        if (!map.has(name)) {
          map.set(name, {
            name,
            nameJa: sc.nameJa || '',
            type: sc.type || '',
            rows: [],
            studentIds: new Set(),
            statusCount: {},
            conflictRows: 0,
          });
        }
        const g = map.get(name);
        if (sc.nameJa && !g.nameJa) g.nameJa = sc.nameJa;
        if (sc.type && !g.type) g.type = sc.type;
        const scConflicts = getSchoolConflicts(conflict, sc);
        g.rows.push({
          key: `${stu.studentId}-${sc.id}`,
          studentId: stu.studentId,
          studentName: stu.name || '-',
          subject: stu.subject || '',
          teacherName: teacherNameById[stu.teacherId] || '（未分配）',
          program: sc.program || '',
          status: sc.status || 'not_started',
          applicationEndDate: sc.applicationEndDate || '',
          examDates: collectExamDates(sc),
          conflictDates: new Set(scConflicts.map(c => c.date)),
          conflicts: scConflicts,
        });
        g.studentIds.add(stu.studentId);
        g.statusCount[sc.status || 'not_started'] = (g.statusCount[sc.status || 'not_started'] || 0) + 1;
        if (scConflicts.length > 0) g.conflictRows += 1;
      }
    }
    let groups = Array.from(map.values()).map(g => ({
      ...g,
      studentCount: g.studentIds.size,
      rows: g.rows.sort((a, b) =>
        a.teacherName.localeCompare(b.teacherName)
        || String(a.studentName).localeCompare(String(b.studentName))),
    }));
    // 搜索：大学名 / 日文名 / 该校下任一学生姓名或学号
    if (q) {
      groups = groups.filter(g =>
        g.name.toLowerCase().includes(q)
        || (g.nameJa || '').toLowerCase().includes(q)
        || g.rows.some(r =>
          String(r.studentName).toLowerCase().includes(q)
          || String(r.studentId).toLowerCase().includes(q))
      );
    }
    // 报考人数多的排前面，人数相同按学校名
    return groups.sort((a, b) => b.studentCount - a.studentCount || a.name.localeCompare(b.name));
  }, [teacherScopedStudents, schoolsByStudent, conflictByStudent, teacherNameById, searchQuery]);

  // 汇总卡片数据
  const summary = useMemo(() => {
    let infoComplete = 0, scoreComplete = 0, hasSchool = 0, conflictStudents = 0;
    for (const s of filteredStudents) {
      const i = checkBasicInfo(s);
      const c = checkScores(s);
      if (i.done === i.total) infoComplete++;
      if (c.done === c.total) scoreComplete++;
      if ((schoolsByStudent[s.studentId] || []).length > 0) hasSchool++;
      if (conflictByStudent[s.studentId]?.hasConflict) conflictStudents++;
    }
    return {
      total: filteredStudents.length,
      infoComplete,
      scoreComplete,
      hasSchool,
      conflictStudents,
    };
  }, [filteredStudents, schoolsByStudent, conflictByStudent]);

  // 切换展开
  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // 【新需求103】大学分组展开/收起
  const toggleUniversity = (name) => {
    setExpandedUniversities(prev => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  };

  // 导出 CSV
  const exportCsv = () => {
    const rows = [];
    rows.push([
      '负责老师', '学生姓名', '学号', '文理科',
      // 【新需求106】邮箱√/电话√ 两列去掉，改为直接导出项目套餐/毕业高中/学籍信息的实际值
      '项目套餐', '毕业高中', '学籍信息', '语言学校√',
      // 【新需求106】成绩列由「√/空」两态改为「✔ / 无 / 空」三态
      'JLPT', 'EJU', '英语',
      '报考学校数', '报考学校（学校 | 状态 | 类型）',
      // 【新需求101】撞期信息随导出一起带走，方便线下排考
      '考试撞期数', '撞期明细（日期：学校(考试类型)）'
    ]);
    // 【新需求106】成绩三态导出口径：有成绩 → ✔；已确认无相关成绩 → 无；未确认 → 空
    const scoreText = (item) => (item.has ? '✔' : (item.none ? '无' : ''));
    for (const s of filteredStudents) {
      const info = checkBasicInfo(s);
      const scr = checkScores(s);
      const schools = schoolsByStudent[s.studentId] || [];
      const conflict = conflictByStudent[s.studentId];
      const schoolCell = schools.map(sc =>
        `${sc.name}${sc.program ? '('+sc.program+')' : ''} | ${statusPill(sc.status).label} | ${sc.type}`
      ).join(' ； ');
      rows.push([
        teacherNameById[s.teacherId] || '（未分配）',
        s.name || '',
        s.studentId || '',
        s.subject || '',
        info.items[0].value ? getPackageDisplayName(info.items[0].value) : '',
        info.items[1].value,
        info.items[2].value,
        info.items[3].ok ? '✔' : '',
        scoreText(scr.items[0]),
        scoreText(scr.items[1]),
        scoreText(scr.items[2]),
        schools.length,
        schoolCell,
        conflict?.conflictDateCount || 0,
        formatConflictSummary(conflict),
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

  // 【新需求103】按大学维度导出 CSV
  const exportUniversityCsv = () => {
    const rows = [];
    rows.push([
      '大学', '日文名', '类型', '报考人数',
      '学生姓名', '学号', '文理科', '负责老师',
      '研究科/学部', '申请状态', '出愿截止', '考试日期', '撞期'
    ]);
    for (const g of universityGroups) {
      for (const r of g.rows) {
        rows.push([
          g.name,
          g.nameJa || '',
          g.type || '',
          g.studentCount,
          r.studentName,
          r.studentId,
          r.subject,
          r.teacherName,
          r.program,
          statusPill(r.status).label,
          r.applicationEndDate,
          r.examDates.map(d => `${d.label}:${d.date}`).join(' / '),
          r.conflicts.length > 0
            ? r.conflicts.map(c => `${c.date}↔${c.others.map(o => o.schoolName).join('、')}`).join('；')
            : '',
        ]);
      }
    }
    const csv = rows.map(r => r.map(cell => {
      const v = cell == null ? '' : String(cell);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `监管台_按大学_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification?.('已导出按大学维度的监管数据 CSV', 'success');
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  // 【新需求101】权限守卫放在所有 Hook 之后，避免条件式提前 return 破坏 Hook 调用顺序
  if (!canView) {
    return (
      <div className="glass-panel p-8 text-center rounded-2xl">
        <AlertCircle size={48} className="mx-auto mb-3" style={{ color: tokens.colors.text.muted }} />
        <div style={{ color: tokens.colors.text.secondary }}>
          该页面需要「监管台」权限，请联系管理员开通
        </div>
      </div>
    );
  }

  const okIcon = <Check size={14} style={{ color: '#16a34a' }} />;
  const noIcon = <XIcon size={14} style={{ color: '#dc2626' }} />;
  // 【新需求106】"确认无相关成绩"的第三态：既不是绿勾（有成绩），也不是红叉（没录）
  const noneText = (
    <span className="text-xs px-1.5 py-0.5 rounded" style={{
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      color: tokens.colors.text.muted,
    }}>无</span>
  );
  // 成绩单元格：有成绩 → ✔；已确认无 → 「无」；未确认 → ✘
  const scoreCell = (item) => (item.has ? okIcon : (item.none ? noneText : noIcon));
  // 文本型单元格：空值统一显示灰色占位，避免与"已录入"混淆
  const textCell = (v) => (v && String(v).trim())
    ? <span style={{ color: tokens.colors.text.primary }}>{v}</span>
    : <span style={{ color: tokens.colors.text.muted }}>-</span>;

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
            }}>{user?.role === 'admin' ? '管理员' : (canSeeAllTeachers ? '老师·全部学生' : '老师·我的学生')}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 【新需求103】视图维度切换：按老师 / 按大学 */}
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.colors.border.subtle}` }}>
              {[
                { id: 'teacher', label: '按老师', icon: GraduationCap },
                { id: 'university', label: '按大学', icon: SchoolIcon },
              ].map(v => {
                const VIcon = v.icon;
                const active = viewMode === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id)}
                    className="px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-all"
                    style={{
                      background: active
                        ? (isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.12)')
                        : 'transparent',
                      color: active ? (isDark ? '#c7d2fe' : '#4338ca') : tokens.colors.text.secondary,
                    }}
                  >
                    <VIcon size={14} />
                    {v.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={viewMode === 'university' ? exportUniversityCsv : exportCsv}
              disabled={loading || (viewMode === 'university' ? universityGroups.length === 0 : filteredStudents.length === 0)}
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
        {viewMode === 'teacher' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
          {/* 【新需求101】考试撞期学生数 */}
          <div className="p-3 rounded-lg" style={{
            background: summary.conflictStudents > 0
              ? (isDark ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.08)')
              : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
            border: summary.conflictStudents > 0 ? `1px solid ${isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.25)'}` : '1px solid transparent',
          }}>
            <div className="text-xs flex items-center gap-1" style={{ color: tokens.colors.text.muted }}>
              <AlertTriangle size={12} /> 考试撞期
            </div>
            <div className="text-xl font-bold" style={{ color: summary.conflictStudents > 0 ? '#dc2626' : tokens.colors.text.primary }}>
              {summary.conflictStudents}<span className="text-sm font-normal" style={{ color: tokens.colors.text.muted }}> / {summary.total}</span>
            </div>
          </div>
        </div>
        )}

        {/* 【新需求103】按大学维度的汇总卡 */}
        {viewMode === 'university' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>涉及大学数</div>
            <div className="text-xl font-bold" style={{ color: tokens.colors.text.primary }}>{universityGroups.length}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>报考记录数</div>
            <div className="text-xl font-bold" style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}>
              {universityGroups.reduce((n, g) => n + g.rows.length, 0)}
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.06)' }}>
            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>最热门大学</div>
            <div className="text-sm font-bold truncate" style={{ color: isDark ? '#86efac' : '#166534' }}>
              {universityGroups[0] ? `${universityGroups[0].name}（${universityGroups[0].studentCount} 人）` : '-'}
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{
            background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)',
            border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div className="text-xs flex items-center gap-1" style={{ color: tokens.colors.text.muted }}>
              <AlertTriangle size={12} /> 撞期报考记录
            </div>
            <div className="text-xl font-bold" style={{ color: '#dc2626' }}>
              {universityGroups.reduce((n, g) => n + g.conflictRows, 0)}
            </div>
          </div>
        </div>
        )}

        {/* 按老师维度切换 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs" style={{ color: tokens.colors.text.muted }}>
            <GraduationCap size={14} />
            <span>按老师筛选：</span>
          </div>
          {/* 【新需求101】没有"查看所有学生"权限的老师只呈现自己这一维度*/}
          {!canSeeAllTeachers ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TeacherTab id="self" label="我的学生" count={students.length} active onClick={() => {}} />
              <span className="text-xs" style={{ color: tokens.colors.text.muted }}>
                （仅显示您负责的学生，如需查看全部请联系管理员开通「查看所有学生」）
              </span>
            </div>
          ) : (
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
          )}
        </div>

        {/* 搜索/筛选 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tokens.colors.text.muted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={viewMode === 'university' ? '搜索大学名 / 学生姓名 / 学号' : '搜索姓名 / 学号'}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${tokens.colors.border.subtle}`,
                color: tokens.colors.text.primary,
              }}
            />
          </div>
          {/* 完整度筛选只对"按老师"视图有意义 */}
          {viewMode === 'teacher' && (
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
          )}
        </div>

        {loading && (
          <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
            正在加载学生报考数据（{progress.done}/{progress.total}）…
          </div>
        )}
      </div>

      {/* Excel 风格表格 */}
      {viewMode === 'teacher' && (
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
                {/* 【新需求106】移除「邮箱 / 电话」，追加「项目套餐 / 毕业高中 / 学籍」并直接展示实际值 */}
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  项目套餐
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  毕业高中
                </th>
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  学籍
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
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  英语
                </th>
                {/* 【新需求101】考试撞期列 */}
                <th className="px-3 py-2 text-center font-semibold whitespace-nowrap" style={{ color: tokens.colors.text.secondary }}>
                  考试撞期
                </th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: tokens.colors.text.secondary }}>
                  报考学校 & 状态
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && !loading && (
                <tr>
                  {/* 【新需求106】列数由 12 增至 13（移除邮箱/电话 2 列，追加套餐/高中/学籍 3 列） */}
                  <td colSpan={13} className="py-8 text-center text-sm" style={{ color: tokens.colors.text.muted }}>
                    暂无匹配的学生
                  </td>
                </tr>
              )}
              {filteredStudents.map((s) => {
                const info = checkBasicInfo(s);
                const scr = checkScores(s);
                const schools = schoolsByStudent[s.studentId] || [];
                const conflict = conflictByStudent[s.studentId];
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
                      {/* 【新需求106】项目套餐 / 毕业高中 / 学籍 直接展示实际值；语言学校保持录入状态口径 */}
                      <td className="px-3 py-2 whitespace-nowrap" title={info.items[0].value}>
                        {textCell(info.items[0].value ? getPackageDisplayName(info.items[0].value) : '')}
                      </td>
                      <td className="px-3 py-2 max-w-[10rem] truncate" title={info.items[1].value}>
                        {textCell(info.items[1].value)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">{textCell(info.items[2].value)}</td>
                      <td className="px-3 py-2 text-center">{info.items[3].ok ? okIcon : noIcon}</td>
                      <td className="px-3 py-2 text-center">{scoreCell(scr.items[0])}</td>
                      <td className="px-3 py-2 text-center">{scoreCell(scr.items[1])}</td>
                      <td className="px-3 py-2 text-center">{scoreCell(scr.items[2])}</td>
                      {/* 【新需求101】撞期标记：>=2 所不同学校考试同日 → 标红并提示明细 */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {conflict?.hasConflict ? (
                          <button
                            onClick={() => toggleExpand(s.studentId)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
                            style={{ background: 'rgba(239,68,68,0.14)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.35)' }}
                            title={formatConflictSummary(conflict)}
                          >
                            <AlertTriangle size={12} />
                            {conflict.conflictDateCount} 处
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: tokens.colors.text.muted }}>
                            {schools.length > 1 ? '无' : '-'}
                          </span>
                        )}
                      </td>
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
                        <td colSpan={12} className="px-3 py-2">
                          {/* 【新需求101】撞期汇总条：按日期列出当天全部撞在一起的学校 */}
                          {conflict?.hasConflict && (
                            <div className="mb-2 p-2 rounded-lg text-xs" style={{
                              background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)',
                              border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.22)'}`,
                            }}>
                              <div className="font-semibold flex items-center gap-1 mb-1" style={{ color: '#dc2626' }}>
                                <AlertTriangle size={12} />
                                校内考撞期 {conflict.conflictDateCount} 处（同一天需要去2 所以上学校考试，必须调整）
                              </div>
                              {conflict.conflictDates.map(({ date, entries }) => (
                                <div key={date} style={{ color: tokens.colors.text.secondary }}>
                                  <span className="font-medium" style={{ color: '#dc2626' }}>{date}</span>
                                  {' — '}
                                  {entries.map(e => `${e.schoolName}（${e.label}）`).join('、')}
                                </div>
                              ))}
                            </div>
                          )}
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
                                  <th className="px-2 py-1 text-left font-normal">考试日期</th>
                                  <th className="px-2 py-1 text-left font-normal">状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schools.map((sc) => {
                                  const p = statusPill(sc.status);
                                  const scConflicts = getSchoolConflicts(conflict, sc);
                                  const conflictDates = new Set(scConflicts.map(c => c.date));
                                  const examDates = collectExamDates(sc);
                                  return (
                                    <tr key={sc.id}>
                                      <td className="px-2 py-1" style={{ color: tokens.colors.text.primary }}>
                                        {sc.name}
                                        {sc.nameJa && <span className="ml-1 opacity-60">({sc.nameJa})</span>}
                                        {scConflicts.length > 0 && (
                                          <AlertTriangle size={11} className="inline ml-1" style={{ color: '#dc2626' }} />
                                        )}
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
                                      {/* 【新需求101】考试日期列：撞期的日期标红加粗 */}
                                      <td className="px-2 py-1">
                                        {examDates.length === 0 ? (
                                          <span style={{ color: tokens.colors.text.muted }}>-</span>
                                        ) : (
                                          <div className="flex flex-wrap gap-1">
                                            {examDates.map((d, di) => {
                                              const hit = conflictDates.has(d.date);
                                              return (
                                                <span
                                                  key={`${d.date}-${di}`}
                                                  className="px-1.5 py-0.5 rounded whitespace-nowrap"
                                                  style={hit
                                                    ? { background: 'rgba(239,68,68,0.14)', color: '#dc2626', fontWeight: 600, border: '1px solid rgba(239,68,68,0.35)' }
                                                    : { color: tokens.colors.text.secondary }}
                                                  title={hit
                                                    ? `与其他学校同日：${scConflicts.filter(c => c.date === d.date).flatMap(c => c.others.map(o => `${o.schoolName}(${o.label})`)).join('、')}`
                                                    : ''}
                                                >
                                                  {d.label}: {d.date}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
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
      )}

      {/* 【新需求103】按大学维度视图：某所大学都有哪些学生报考了 */}
      {viewMode === 'university' && (
      <div className="glass-panel rounded-2xl overflow-hidden">
        {universityGroups.length === 0 && !loading && (
          <div className="py-8 text-center text-sm" style={{ color: tokens.colors.text.muted }}>
            暂无报考记录
          </div>
        )}
        <div className="divide-y" style={{ borderColor: tokens.colors.border.subtle }}>
          {universityGroups.map((g) => {
            const opened = expandedUniversities.has(g.name);
            return (
              <div key={g.name} style={{ borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
                {/* 大学汇总行 */}
                <button
                  onClick={() => toggleUniversity(g.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: opened ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}
                >
                  {opened
                    ? <ChevronDown size={16} className="flex-shrink-0" style={{ color: tokens.colors.text.secondary }} />
                    : <ChevronRight size={16} className="flex-shrink-0" style={{ color: tokens.colors.text.muted }} />}
                  <SchoolIcon size={16} className="flex-shrink-0" style={{ color: tokens.colors.accent.primary }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: tokens.colors.text.primary }}>{g.name}</span>
                      {g.nameJa && <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{g.nameJa}</span>}
                      {g.type && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                          color: tokens.colors.text.secondary,
                        }}>{g.type}</span>
                      )}
                      {g.conflictRows > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                          style={{ background: 'rgba(239,68,68,0.14)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.35)' }}
                          title="该校下有报考记录的考试日期与该生其他志愿校撞期">
                          <AlertTriangle size={11} /> 撞期 {g.conflictRows}
                        </span>
                      )}
                    </div>
                    {/* 各申请状态分布 */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {Object.entries(g.statusCount).map(([st, n]) => {
                        const p = statusPill(st);
                        return (
                          <span key={st} className="text-xs px-1.5 py-0.5 rounded" style={{ background: p.bg, color: p.fg }}>
                            {p.label} {n}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold" style={{ color: tokens.colors.text.primary }}>{g.studentCount}</div>
                    <div className="text-xs" style={{ color: tokens.colors.text.muted }}>
                      人报考{g.rows.length !== g.studentCount ? ` · ${g.rows.length} 条` : ''}
                    </div>
                  </div>
                </button>

                {/* 展开：该大学下的学生明细 */}
                {opened && (
                  <div className="px-4 pb-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ color: tokens.colors.text.muted }}>
                          <th className="px-2 py-1 text-left font-normal">学生</th>
                          <th className="px-2 py-1 text-left font-normal">文理</th>
                          <th className="px-2 py-1 text-left font-normal">负责老师</th>
                          <th className="px-2 py-1 text-left font-normal">研究科/学部</th>
                          <th className="px-2 py-1 text-left font-normal">出愿截止</th>
                          <th className="px-2 py-1 text-left font-normal">考试日期</th>
                          <th className="px-2 py-1 text-left font-normal">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const p = statusPill(r.status);
                          return (
                            <tr key={r.key} style={{ borderTop: `1px solid ${tokens.colors.border.hairline}` }}>
                              <td className="px-2 py-1 whitespace-nowrap">
                                <span style={{ color: tokens.colors.text.primary }}>{r.studentName}</span>
                                <span className="ml-1" style={{ color: tokens.colors.text.muted }}>{r.studentId}</span>
                              </td>
                              <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>{r.subject || '-'}</td>
                              <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>{r.teacherName}</td>
                              <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>{r.program || '-'}</td>
                              <td className="px-2 py-1" style={{ color: tokens.colors.text.secondary }}>{r.applicationEndDate || '-'}</td>
                              <td className="px-2 py-1">
                                {r.examDates.length === 0 ? (
                                  <span style={{ color: tokens.colors.text.muted }}>-</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {r.examDates.map((d, di) => {
                                      const hit = r.conflictDates.has(d.date);
                                      return (
                                        <span key={`${d.date}-${di}`}
                                          className="px-1.5 py-0.5 rounded whitespace-nowrap"
                                          style={hit
                                            ? { background: 'rgba(239,68,68,0.14)', color: '#dc2626', fontWeight: 600, border: '1px solid rgba(239,68,68,0.35)' }
                                            : { color: tokens.colors.text.secondary }}
                                          title={hit
                                            ? `该生同日还有：${r.conflicts.filter(c => c.date === d.date).flatMap(c => c.others.map(o => `${o.schoolName}(${o.label})`)).join('、')}`
                                            : ''}
                                        >
                                          {d.label}: {d.date}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                <span className="px-1.5 py-0.5 rounded" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
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
        {viewMode === 'teacher' && (
        <div className="text-xs mt-2" style={{ color: tokens.colors.text.muted }}>
          <Check size={12} className="inline mr-1" style={{ color: '#16a34a' }} />= 已录入 &nbsp;
          <XIcon size={12} className="inline mr-1" style={{ color: '#dc2626' }} />= 未录入
        </div>
        )}
        {viewMode === 'university' && (
        <div className="text-xs mt-2" style={{ color: tokens.colors.text.muted }}>
          点击任意大学行可展开该校下全部报考学生（含负责老师 / 学部 / 出愿截止 / 考试日期 / 申请状态）
        </div>
        )}
        {/* 【新需求101】撞期口径说明 */}
        <div className="text-xs mt-1 flex items-start gap-1" style={{ color: tokens.colors.text.muted }}>
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <span>
            = 校内考撞期：同一学生名下【2 所及以上不同学校】的考试类日期（校内考 / 一审 / 二审 / 面试等自定义考试日）落在同一天。
            同一所学校内部多个考试日期同天不计为撞期。
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdminSupervisionPage;
