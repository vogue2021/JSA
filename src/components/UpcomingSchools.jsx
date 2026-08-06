import React, { useState, useMemo, useEffect } from 'react';
import {
  School, Calendar, ChevronLeft, ChevronRight, MapPin,
  ExternalLink, Users, BookOpen, Search, X, FileText, AlertTriangle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { schoolDatabaseAPI } from '../services/api';
// 【新需求102】校内考撞期检测（与学校页面 / 监管台共用同一套判定口径）
import {
  detectExamConflicts, getSchoolConflicts, isExamLikeLabel,
  buildExamDateIndex, findConflictsAgainstIndex, normalizeDate,
} from '../utils/examConflictUtils';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const TYPE_COLORS = {
  '国立': 'bg-blue-500',
  '公立': 'bg-green-500',
  '私立': 'bg-purple-500',
};

const UpcomingSchools = ({ studentList, studentData, currentStudent, user }) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailSchool, setDetailSchool] = useState(null); // 弹窗展示学校详情
  const [searchQuery, setSearchQuery] = useState('');
  // 【新需求95】高才加分校筛选：all | only
  const [filterTalentBonus, setFilterTalentBonus] = useState('all');
  // 【新需求102】撞期筛选：all | conflict（只看与当前学生已报志愿校撞期的学校）
  const [filterConflict, setFilterConflict] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // 玻璃卡片通用样式
  const glassCardStyle = glassEnabled ? {
    background: tokens.colors.surface.glass,
    backdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    WebkitBackdropFilter: `blur(${tokens.blur.backdropBlur}px)`,
    border: `1px solid ${tokens.colors.border.hairline}`,
    boxShadow: `${tokens.shadow.elevation}, ${tokens.shadow.innerHighlight}`,
    borderRadius: `${tokens.radius.card}px`,
  } : {
    background: tokens.colors.surface.solid,
    border: `1px solid ${tokens.colors.border.subtle}`,
    borderRadius: `${tokens.radius.card}px`,
  };

  // 从 API 加载学校信息库数据（与 SchoolDatabase 组件数据源一致）
  const [schoolDb, setSchoolDb] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  useEffect(() => {
    const loadSchoolDb = async () => {
      try {
        setDbLoading(true);
        const data = await schoolDatabaseAPI.getAll();
        if (Array.isArray(data)) {
          setSchoolDb(data);
        }
      } catch (err) {
        console.warn('加载学校信息库失败:', err);
        setSchoolDb([]);
      } finally {
        setDbLoading(false);
      }
    };
    loadSchoolDb();
  }, []);

  // 解析出愿开始时间，仅基于出愿开始时间判断是否在指定月份可报考
  const parseSchoolMonths = (school) => {
    const months = new Set();

    // 从 importantDates / important_dates 多组日期中仅提取 applicationStartDate
    const importantDates = school.importantDates || school.important_dates;
    if (importantDates && Array.isArray(importantDates)) {
      importantDates.forEach(dateGroup => {
        const startDate = dateGroup.applicationStartDate || dateGroup.application_start_date;
        if (startDate) {
          const d = new Date(startDate);
          if (!isNaN(d)) months.add(d.getMonth());
        }
      });
    }

    // 兼容旧数据的单组日期字段
    const singleStart = school.applicationStartDate || school.application_start_date;
    if (singleStart) {
      const d = new Date(singleStart);
      if (!isNaN(d)) months.add(d.getMonth());
    }

    return months;
  };

  // 获取当月及接下来几个月可报考的学校
  const getSchoolsForMonth = (targetMonth) => {
    return schoolDb.filter(school => {
      const schoolMonths = parseSchoolMonths(school);
      return schoolMonths.has(targetMonth);
    });
  };

  // 生成近6个月的数据
  const monthsData = useMemo(() => {
    const result = [];
    for (let i = 0; i < 6; i++) {
      const m = (month + i) % 12;
      const y = year + Math.floor((month + i) / 12);
      const schools = getSchoolsForMonth(m);
      result.push({ month: m, year: y, schools });
    }
    return result;
  }, [month, year, schoolDb, dbLoading]);

  // ─── 【新需求102】校内考撞期检测 ──────────────────────────────────────────
  // 撞期基准 = "当前学生已报的志愿校"。老师在这个页面选校时，最需要立刻知道的是：
  //   "如果给这个学生报这所学校，校内考会不会和他已经报的学校撞在同一天"。
  // studentData 由 App.jsx 传入，只包含已加载的学生（通常就是当前选中学生）。
  const plannedSchools = useMemo(() => {
    if (!studentData) return [];
    const key = currentStudent?.studentId || 'default';
    return studentData[key]?.schools || studentData['default']?.schools || [];
  }, [studentData, currentStudent?.studentId]);

  const plannedIndex = useMemo(() => buildExamDateIndex(plannedSchools), [plannedSchools]);

  // ① 候选校 × 已报志愿校：{ [schoolDbId]: [{date, label, others}] }
  //   excludeSchoolName 排除"该校本身已被这个学生报过"的情况，避免自己和自己撞
  const conflictWithPlanned = useMemo(() => {
    const map = {};
    schoolDb.forEach((s) => {
      const hits = findConflictsAgainstIndex(s, plannedIndex, { excludeSchoolName: s.name });
      if (hits.length > 0) map[s.id] = hits;
    });
    return map;
  }, [schoolDb, plannedIndex]);

  // ② 候选校之间：当前 6 个月窗口内，哪些信息库学校的考试日期彼此撞在同一天
  //   （考试日期是绝对日期，跨月份分组也可能相撞，所以统一去重后一次性检测）
  const candidateConflicts = useMemo(() => {
    const seen = new Set();
    const list = [];
    monthsData.forEach(md => md.schools.forEach((s) => {
      if (!seen.has(s.id)) { seen.add(s.id); list.push(s); }
    }));
    return detectExamConflicts(list);
  }, [monthsData]);

  // 搜索过滤
  const filteredMonthsData = useMemo(() => {
    // 无搜索 & 无高才加分筛选 & 无撞期筛选 → 直接返回
    if (!searchQuery && filterTalentBonus === 'all' && filterConflict === 'all') return monthsData;
    return monthsData.map(md => ({
      ...md,
      schools: md.schools.filter(s => {
        const matchSearch = !searchQuery
          || s.name.includes(searchQuery)
          || s.nameJa?.includes(searchQuery)
          || s.location?.includes(searchQuery);
        // 【新需求95】高才加分校筛选
        const matchTalent = filterTalentBonus === 'all' || (filterTalentBonus === 'only' && !!s.isTalentBonus);
        // 【新需求102】只看与已报志愿校撞期的学校
        const matchConflict = filterConflict === 'all' || (conflictWithPlanned[s.id]?.length > 0);
        return matchSearch && matchTalent && matchConflict;
      }),
    }));
  }, [monthsData, searchQuery, filterTalentBonus, filterConflict, conflictWithPlanned]);

  // 当前窗口内"与已报志愿校撞期"的学校数（统计卡用）
  const plannedConflictCount = useMemo(() => {
    const seen = new Set();
    filteredMonthsData.forEach(md => md.schools.forEach((s) => {
      if (conflictWithPlanned[s.id]?.length > 0) seen.add(s.id);
    }));
    return seen.size;
  }, [filteredMonthsData, conflictWithPlanned]);

  // 获取相关学生信息（已申请该学校的学生）—— 从 props 中的 studentData 获取
  const getStudentsForSchool = (schoolName) => {
    const result = [];
    if (!studentList || !studentData) return result;

    studentList.forEach(student => {
      const key = student.studentId || 'default';
      const data = studentData[key];
      if (!data) return;
      const studentSchools = data.schools || [];
      if (studentSchools.some(s => s.name === schoolName)) {
        result.push({
          name: student.name,
          studentId: student.studentId,
          avatar: student.avatar || '👤',
          subject: student.subject,
        });
      }
    });
    return result;
  };

  const totalUpcoming = filteredMonthsData.reduce((sum, md) => sum + md.schools.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold" style={{ color: tokens.colors.text.primary }}>近期可报学校</h2>
          <p className="text-sm mt-1" style={{ color: tokens.colors.text.muted }}>根据学校信息库的出愿时间，按月份展示近期可报考学校</p>
          {/* 【新需求94】添加提示，让用户知道学校卡片可以点击查看详情 */}
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.accent.primary }}>
            <ExternalLink size={12} />
            点击任意学校卡片可查看详细报考信息（重要日期、认证需求、募集要项等）
          </p>
          {/* 【新需求102】撞期基准说明：让老师清楚红色徽章是跟谁比出来的 */}
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.text.muted }}>
            <AlertTriangle size={12} style={{ color: '#dc2626' }} />
            撞期基准：
            <span className="font-medium" style={{ color: tokens.colors.text.secondary }}>
              {currentStudent?.name || '当前学生'}
            </span>
            已报 {plannedSchools.length} 所志愿校（红=与已报同日考试，橙=候选校之间同日考试）
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 【新需求102】只看撞期学校 */}
          <button
            type="button"
            onClick={() => setFilterConflict(filterConflict === 'conflict' ? 'all' : 'conflict')}
            className="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
            style={{
              background: filterConflict === 'conflict'
                ? (isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.1)')
                : (isDark ? 'rgba(255,255,255,0.06)' : '#fff'),
              border: `1px solid ${filterConflict === 'conflict' ? 'rgba(239,68,68,0.4)' : tokens.colors.border.subtle}`,
              color: filterConflict === 'conflict' ? '#dc2626' : tokens.colors.text.secondary,
            }}
            title="只显示与当前学生已报志愿校考试撞期的学校">
            <AlertTriangle size={14} />
            {filterConflict === 'conflict' ? '仅撞期学校' : '撞期筛选'}
          </button>
          {/* 【新需求95】高才加分校筛选 */}
          <button
            type="button"
            onClick={() => setFilterTalentBonus(filterTalentBonus === 'only' ? 'all' : 'only')}
            className="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
            style={{
              background: filterTalentBonus === 'only'
                ? (isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)')
                : (isDark ? 'rgba(255,255,255,0.06)' : '#fff'),
              border: `1px solid ${filterTalentBonus === 'only' ? 'rgba(245,158,11,0.35)' : tokens.colors.border.subtle}`,
              color: filterTalentBonus === 'only' ? '#f59e0b' : tokens.colors.text.secondary,
            }}
            title="仅显示高才加分校">
            ⭐ {filterTalentBonus === 'only' ? '仅高才加分校' : '高才加分校'}
          </button>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: tokens.colors.text.muted }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索学校..."
              className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-48"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                border: `1px solid ${tokens.colors.border.subtle}`,
                color: tokens.colors.text.primary,
              }}
            />
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { value: schoolDb.length, label: '信息库总数', color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.12)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
          { value: totalUpcoming, label: '近6月可报', color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)' },
          { value: filteredMonthsData[0]?.schools.length || 0, label: '本月可报', color: '#a855f7', bg: isDark ? 'rgba(168,85,247,0.12)' : 'linear-gradient(135deg, #faf5ff, #f3e8ff)' },
          { value: filteredMonthsData[1]?.schools.length || 0, label: '下月可报', color: '#f97316', bg: isDark ? 'rgba(249,115,22,0.12)' : 'linear-gradient(135deg, #fff7ed, #ffedd5)' },
          // 【新需求102】与已报志愿校撞期的候选校数量
          { value: plannedConflictCount, label: '与已报撞期', color: '#dc2626', bg: isDark ? 'rgba(239,68,68,0.12)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)' },
        ].map((card, i) => (
          <div key={i} className="p-4 rounded-xl text-center" style={{
            background: card.bg,
            border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none',
          }}>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs" style={{ color: isDark ? `${card.color}cc` : `${card.color}` }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 月份导航 */}
      <div className="flex items-center justify-between rounded-xl p-4" style={glassCardStyle}>
        <button onClick={prevMonth} className="p-2 rounded-lg transition"
          style={{ color: tokens.colors.text.secondary }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold" style={{ color: tokens.colors.text.primary }}>
            {year}年 {MONTH_NAMES[month]} ~ {year + Math.floor((month + 5) / 12)}年 {MONTH_NAMES[(month + 5) % 12]}
          </h3>
          <button onClick={goToday}
            className="text-xs px-2 py-1 rounded-md transition"
            style={{ background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(59,130,246,0.1)', color: tokens.colors.accent.primary }}>
            回到当月
          </button>
        </div>
        <button onClick={nextMonth} className="p-2 rounded-lg transition"
          style={{ color: tokens.colors.text.secondary }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 时间线展示 */}
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 hidden sm:block" style={{ background: tokens.colors.border.subtle }} />

        <div className="space-y-8">
          {filteredMonthsData.map((md, idx) => {
            const isCurrentMonth = md.month === new Date().getMonth() && md.year === new Date().getFullYear();
            return (
              <div key={`${md.year}-${md.month}`} className="relative">
                {/* 月份节点 */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md ${
                    isCurrentMonth ? 'bg-gradient-to-br from-blue-500 to-purple-600 ring-4' : ''
                  }`} style={{
                    ...(!isCurrentMonth ? { background: isDark ? 'rgba(255,255,255,0.15)' : '#9ca3af' } : {}),
                    ...(isCurrentMonth ? { boxShadow: `0 0 0 4px ${isDark ? 'rgba(96,165,250,0.2)' : '#bfdbfe'}` } : {}),
                  }}>
                    {md.month + 1}月
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: isCurrentMonth ? tokens.colors.accent.primary : tokens.colors.text.secondary }}>
                      {md.year}年{MONTH_NAMES[md.month]}
                      {isCurrentMonth && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: isDark ? 'rgba(99,102,241,0.15)' : '#dbeafe', color: tokens.colors.accent.primary }}>
                          当前
                        </span>
                      )}
                    </h3>
                    <p className="text-sm" style={{ color: tokens.colors.text.muted }}>
                      {md.schools.length > 0 ? `${md.schools.length} 所学校可报考` : '暂无可报考学校'}
                    </p>
                  </div>
                </div>

                {/* 学校卡片列表 */}
                {md.schools.length > 0 ? (
                  <div className="sm:ml-16 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {md.schools.map(school => {
                      const relatedStudents = getStudentsForSchool(school.name);
                      const typeColor = TYPE_COLORS[school.type] || 'bg-gray-500';
                      // 【新需求102】两类撞期：① 与当前学生已报志愿校 ② 与其他候选校
                      const plannedHits = conflictWithPlanned[school.id] || [];
                      const candidateHits = getSchoolConflicts(candidateConflicts, school);
                      // 撞期学校左侧加色条：红（与已报撞期）优先于橙（候选校之间撞期）
                      //注意要拼进 hover 前后的 boxShadow，否则鼠标移出后色条会被冲掉
                      const conflictBar = plannedHits.length > 0
                        ? 'inset 3px 0 0 0 #dc2626'
                        : candidateHits.length > 0 ? 'inset 3px 0 0 0 #f97316' : '';
                      const baseShadow = [glassCardStyle.boxShadow, conflictBar].filter(Boolean).join(', ') || 'none';
                      const hoverShadow = [tokens.shadow.elevationHover, conflictBar].filter(Boolean).join(', ');

                      return (
                        <div key={school.id}
                          className="rounded-xl overflow-hidden transition cursor-pointer"
                          style={{
                            ...glassCardStyle,
                            transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
                            boxShadow: baseShadow,
                          }}
                          onClick={() => setDetailSchool(school)}
                          title={`点击查看 ${school.name} 的详细报考信息`}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = hoverShadow;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = baseShadow;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div className="p-3">
                            {/* 【新需求93】精简卡片：默认只显示学校基础信息（名称、地区、类型），点击弹窗查看具体报考信息 */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${typeColor}`} />
                                <h4 className="font-semibold truncate" style={{ color: tokens.colors.text.primary }}>{school.name}</h4>
                                {(school.nameJa || school.name_ja) && (
                                  <span className="text-xs truncate hidden md:inline" style={{ color: tokens.colors.text.muted }}>{school.nameJa || school.name_ja}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {school.location && (
                                  <span className="hidden sm:flex items-center gap-1 text-xs" style={{ color: tokens.colors.text.muted }}>
                                    <MapPin size={11} />{school.location}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.secondary }}>
                                  {school.type}
                                </span>
                                {/* 【新需求95】高才加分校徽章 */}
                                {school.isTalentBonus && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{ background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                                    title="高才加分校：学生申请可获得附加加分">
                                    ⭐
                                  </span>
                                )}
                                {/* 【新需求102】与当前学生已报志愿校撞期（红色，最高优先级） */}
                                {plannedHits.length > 0 && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                                    style={{ background: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.4)' }}
                                    title={plannedHits.map(h => `${h.date}（${h.label}）与已报 ${h.others.map(o => `${o.schoolName}·${o.label}`).join('、')} 同日`).join('\n')}>
                                    <AlertTriangle size={11} />
                                    <span className="hidden sm:inline">撞期</span>
                                    {plannedHits.length}
                                  </span>
                                )}
                                {/* 【新需求102】候选校之间同日考试（橙色，提示"这两所只能选一所"）*/}
                                {plannedHits.length === 0 && candidateHits.length > 0 && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                                    style={{ background: isDark ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.12)', color: '#ea580c', border: '1px solid rgba(249,115,22,0.35)' }}
                                    title={candidateHits.map(h => `${h.date}（${h.label}）与 ${h.others.map(o => `${o.schoolName}·${o.label}`).join('、')} 同日考试`).join('\n')}>
                                    <AlertTriangle size={11} />
                                    <span className="hidden sm:inline">同日</span>
                                    {new Set(candidateHits.flatMap(h => h.others.map(o => o.schoolName))).size}
                                  </span>
                                )}
                                {user.role !== 'student' && relatedStudents.length > 0 && (
                                  <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                                    style={{ background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                    <Users size={11} />{relatedStudents.length}
                                  </span>
                                )}
                                {/* 【新需求94】明确的"详情"提示，让用户知道卡片可点击 */}
                                <span className="hidden sm:flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', color: tokens.colors.accent.primary }}>
                                  详情<ExternalLink size={11} />
                                </span>
                                <ExternalLink size={13} className="sm:hidden" style={{ color: tokens.colors.accent.primary }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sm:ml-16 rounded-xl p-6 text-center text-sm"
                    style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb', color: tokens.colors.text.muted }}>
                    本月暂无可报考学校
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 无数据提示 */}
      {!dbLoading && schoolDb.length === 0 && (
        <div className="rounded-xl p-6 text-center"
          style={{ background: isDark ? 'rgba(234,179,8,0.08)' : '#fefce8', border: `1px solid ${isDark ? 'rgba(234,179,8,0.2)' : '#fef08a'}` }}>
          <BookOpen size={32} className="mx-auto mb-2" style={{ color: isDark ? '#fbbf24' : '#ca8a04' }} />
          <p className="font-medium" style={{ color: isDark ? '#fbbf24' : '#a16207' }}>学校信息库暂无数据</p>
          <p className="text-sm mt-1" style={{ color: isDark ? '#fde68a' : '#ca8a04' }}>请先在"学校信息库"页面添加学校信息，并填写出愿时间段</p>
        </div>
      )}
      {/* 学校详情弹窗 */}
      {detailSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ backgroundColor: `rgba(0,0,0,${isDark ? '0.6' : '0.4'})`, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setDetailSchool(null)}>
          <div className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto animate-scale-in"
            style={{
              background: glassEnabled ? tokens.colors.surface.glass : (isDark ? tokens.colors.surface.solid : '#fff'),
              backdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
              WebkitBackdropFilter: glassEnabled ? `blur(${tokens.blur.backdropBlur}px)` : 'none',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
              boxShadow: glassEnabled ? tokens.shadow.elevation : '0 20px 60px rgba(0,0,0,0.3)',
            }} onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div className="p-5" style={{ borderBottom: `1px solid ${tokens.colors.border.hairline}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${TYPE_COLORS[detailSchool.type] || 'bg-gray-500'}`} />
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: tokens.colors.text.primary }}>{detailSchool.name}</h3>
                {(detailSchool.nameJa || detailSchool.name_ja) && <p className="text-xs" style={{ color: tokens.colors.text.muted }}>{detailSchool.nameJa || detailSchool.name_ja}</p>}
                  </div>
                </div>
                <button onClick={() => setDetailSchool(null)} className="p-1.5 rounded-lg transition" style={{ color: tokens.colors.text.muted }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: tokens.colors.text.muted }}>
                {detailSchool.location && <span className="flex items-center gap-1"><MapPin size={12} />{detailSchool.location}</span>}
                <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.secondary }}>{detailSchool.type}</span>
                {/* 【新需求95】高才加分校徽章 */}
                {detailSchool.isTalentBonus && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{ background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                    title="高才加分校：学生申请可获得附加加分">
                    ⭐ 高才加分校
                  </span>
                )}
                {detailSchool.acceptanceRate && <span>录取率: {detailSchool.acceptanceRate}</span>}
              </div>
            </div>
            {/* 内容 */}
            <div className="p-5 space-y-4">
              {/* 认证需求 */}
              {(() => {
                const xc = detailSchool.xuexinCert || detailSchool.xuexin_cert;
                const oc = detailSchool.overseasCert || detailSchool.overseas_cert;
                if (!xc && !oc) return null;
                return (
                <div>
                  <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>认证需求</h5>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: xc === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4') : xc === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : (isDark ? 'rgba(234,179,8,0.12)' : '#fefce8'), color: xc === '是' ? '#22c55e' : xc === '否' ? '#ef4444' : '#eab308' }}>
                      学信网认证: {xc || '不确定'}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: oc === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4') : oc === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : (isDark ? 'rgba(234,179,8,0.12)' : '#fefce8'), color: oc === '是' ? '#22c55e' : oc === '否' ? '#ef4444' : '#eab308' }}>
                      海外认证: {oc || '不确定'}
                    </span>
                  </div>
                </div>
                );
              })()}
              {/* 【新需求102】撞期提示块：进详情就能确认这所学校的考试会不会撞车 */}
              {(() => {
                const pHits = conflictWithPlanned[detailSchool.id] || [];
                const cHits = getSchoolConflicts(candidateConflicts, detailSchool);
                if (pHits.length === 0 && cHits.length === 0) return null;
                const Block = ({ hits, color, bgDark, bgLight, title, tip }) => (
                  <div className="rounded-lg p-3 text-xs" style={{
                    background: isDark ? bgDark : bgLight,
                    border: `1px solid ${color}55`,
                  }}>
                    <div className="font-semibold flex items-center gap-1.5 mb-1" style={{ color }}>
                      <AlertTriangle size={13} /> {title}
                    </div>
                    {hits.map((h, i) => (
                      <div key={`${h.date}-${i}`} style={{ color: tokens.colors.text.secondary }}>
                        <span className="font-medium" style={{ color }}>{h.date}</span>
                        {` ${h.label} ↔ `}
                        {h.others.map(o => `${o.schoolName}（${o.label}）`).join('、')}
                      </div>
                    ))}
                    <div className="mt-1" style={{ color: tokens.colors.text.muted }}>{tip}</div>
                  </div>
                );
                return (
                  <div className="space-y-2">
                    {pHits.length > 0 && (
                      <Block
                        hits={pHits} color="#dc2626"
                        bgDark="rgba(239,68,68,0.12)" bgLight="rgba(239,68,68,0.07)"
                        title={`与 ${currentStudent?.name || '当前学生'} 已报志愿校撞期（${pHits.length} 处）`}
                        tip="同一天只能参加一所学校的考试，报名前请先确认取舍。"
                      />
                    )}
                    {cHits.length > 0 && (
                      <Block
                        hits={cHits} color="#ea580c"
                        bgDark="rgba(249,115,22,0.12)" bgLight="rgba(249,115,22,0.07)"
                        title={`与其他可报学校同日考试（${cHits.length} 处）`}
                        tip="这些学校的考试撞在同一天，给同一名学生排考时只能选其中一所。"
                      />
                    )}
                  </div>
                );
              })()}

              {/* 重要日期 */}
              <div>
                <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>重要日期</h5>
                {(() => {
                  //【新需求102】该校所有撞期日期集合 → 用于把对应考试日期格子标红
                  const conflictDateMap = new Map();
                  [...(conflictWithPlanned[detailSchool.id] || [])].forEach(h => {
                    conflictDateMap.set(h.date, { color: '#dc2626', others: h.others });
                  });
                  getSchoolConflicts(candidateConflicts, detailSchool).forEach(h => {
                    // 已被"与已报撞期"标红的日期优先保留红色
                    if (!conflictDateMap.has(h.date)) {
                      conflictDateMap.set(h.date, { color: '#ea580c', others: h.others });
                    }
                  });
                  // 考试类日期格子样式：撞期 → 高亮底色 + 描边；否则用原样式
                  const examCell = (rawDate, baseStyle) => {
                    const hit = conflictDateMap.get(normalizeDate(rawDate));
                    if (!hit) return { style: baseStyle, color: null, title: '' };
                    return {
                      style: {
                        background: `${hit.color}22`,
                        border: `1px solid ${hit.color}77`,
                      },
                      color: hit.color,
                      title: `与 ${hit.others.map(o => `${o.schoolName}（${o.label}）`).join('、')} 同日`,
                    };
                  };
                  const dates = detailSchool.importantDates || detailSchool.important_dates;
                  if (dates && dates.length > 0) {
                    return dates.map((dg, gi) => {
                      const asd = dg.applicationStartDate || dg.application_start_date;
                      const aed = dg.applicationEndDate || dg.application_end_date;
                      const ed = dg.examDate || dg.exam_date;
                      const rd = dg.resultDate || dg.result_date;
                      // 【新需求46】一审/二审/自定义日期
                      const fxd = dg.firstExamDate || dg.first_exam_date;
                      const frd = dg.firstResultDate || dg.first_result_date;
                      const sxd = dg.secondExamDate || dg.second_exam_date;
                      const srd = dg.secondResultDate || dg.second_result_date;
                      const customDates = Array.isArray(dg.customDates) ? dg.customDates.filter(cd => cd && cd.label && cd.date) : [];
                      if (!asd && !aed && !ed && !rd && !fxd && !frd && !sxd && !srd && customDates.length === 0) return null;
                      const cellStyle = { background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' };
                      return (
                        <div key={gi} className="mb-3">
                          <div className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.secondary }}>{dg.label || `第${gi+1}审`}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {asd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿开始</div><div className="text-sm font-semibold" style={{ color: tokens.colors.text.secondary }}>{asd}</div></div>}
                            {aed && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿截止</div><div className="text-sm font-semibold" style={{ color: '#ef4444' }}>{aed}</div>{dg.deadlineType && <div className="text-xs mt-0.5" style={{ color: tokens.colors.text.muted }}>{dg.deadlineType}</div>}</div>}
                            {/* 【新需求102】考试类日期若撞期 → 格子高亮 + ⚠ + hover 说明与谁同日 */}
                            {fxd && (() => { const c = examCell(fxd, cellStyle); return (
                              <div className="rounded-lg p-2.5 text-center" style={c.style} title={c.title}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: c.color || tokens.colors.text.muted }}>
                                  一审考试{c.color && <AlertTriangle size={10} />}
                                </div>
                                <div className="text-sm font-semibold" style={{ color: c.color || '#0ea5e9' }}>{fxd}</div>
                              </div>
                            ); })()}
                            {frd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>一审发表</div><div className="text-sm font-semibold" style={{ color: '#14b8a6' }}>{frd}</div></div>}
                            {sxd && (() => { const c = examCell(sxd, cellStyle); return (
                              <div className="rounded-lg p-2.5 text-center" style={c.style} title={c.title}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: c.color || tokens.colors.text.muted }}>
                                  二审考试{c.color && <AlertTriangle size={10} />}
                                </div>
                                <div className="text-sm font-semibold" style={{ color: c.color || '#ec4899' }}>{sxd}</div>
                              </div>
                            ); })()}
                            {srd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>二审发表</div><div className="text-sm font-semibold" style={{ color: '#d946ef' }}>{srd}</div></div>}
                            {ed && (() => { const c = examCell(ed, cellStyle); return (
                              <div className="rounded-lg p-2.5 text-center" style={c.style} title={c.title}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: c.color || tokens.colors.text.muted }}>
                                  考试日期{c.color && <AlertTriangle size={10} />}
                                </div>
                                <div className="text-sm font-semibold" style={{ color: c.color || '#3b82f6' }}>{ed}</div>
                              </div>
                            ); })()}
                            {rd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>合格发表</div><div className="text-sm font-semibold" style={{ color: '#22c55e' }}>{rd}</div></div>}
                            {customDates.map((cd, i) => {
                              // 只有"考试类"自定义日期才参与撞期高亮（书类提交等非考试项不标记）
                              const c = isExamLikeLabel(cd.label)
                                ? examCell(cd.date, cellStyle)
                                : { style: cellStyle, color: null, title: '' };
                              return (
                                <div key={`c-${i}`} className="rounded-lg p-2.5 text-center" style={c.style} title={c.title}>
                                  <div className="text-xs flex items-center justify-center gap-1" style={{ color: c.color || tokens.colors.text.muted }}>
                                    {cd.label}{c.color && <AlertTriangle size={10} />}
                                  </div>
                                  <div className="text-sm font-semibold" style={{ color: c.color || '#8b5cf6' }}>{cd.date}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  }
                  return <p className="text-xs text-center py-3" style={{ color: tokens.colors.text.muted }}>暂未设置具体日期</p>;
                })()}
              </div>
              {/* 录取信息 */}
              {detailSchool.acceptanceRate && (
                <div className="flex items-center gap-4 text-sm" style={{ color: tokens.colors.text.secondary }}>
                  <span>录取率: <strong>{detailSchool.acceptanceRate}</strong></span>
                </div>
              )}
              {/* 【新需求87】申请要求（支持换行显示） */}
              {detailSchool.requirements && (
                <div>
                  <h5 className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.muted }}>申请要求</h5>
                  <p className="text-sm whitespace-pre-line" style={{ color: tokens.colors.text.secondary }}>{detailSchool.requirements}</p>
                </div>
              )}
              {/* 【新需求87】备注（支持换行显示） */}
              {detailSchool.notes && (
                <div>
                  <h5 className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.muted }}>备注</h5>
                  <p className="text-sm whitespace-pre-line" style={{ color: tokens.colors.text.secondary }}>{detailSchool.notes}</p>
                </div>
              )}
              {/* 招生学部 */}
              {detailSchool.programs && detailSchool.programs.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.muted }}>招生学部</h5>
                  <div className="flex flex-wrap gap-1">
                    {detailSchool.programs.map((p, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: isDark ? '#93c5fd' : '#2563eb' }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* 所需材料 */}
              {detailSchool.requiredMaterials && detailSchool.requiredMaterials.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>
                    <FileText size={12} className="inline mr-1" />所需材料
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {detailSchool.requiredMaterials.map((m, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
                        <FileText size={10} />{m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* 已申请该校的学生 - 仅老师和管理员可见 */}
              {user.role !== 'student' && (() => {
                const students = getStudentsForSchool(detailSchool.name);
                return students.length > 0 ? (
                  <div>
                    <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>
                      <Users size={12} className="inline mr-1" />已申请该校的学生 ({students.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {students.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${tokens.colors.border.subtle}` }}>
                          <span className="text-lg">{s.avatar}</span>
                          <div>
                            <div className="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>{s.name}</div>
                            <div className="text-xs" style={{ color: tokens.colors.text.muted }}>{s.studentId} {s.subject && `· ${s.subject}`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {/* 募集要项链接 */}
              {detailSchool.requirementsUrl && (
                <a href={detailSchool.requirementsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm transition"
                  style={{ color: tokens.colors.accent.success }}>
                  <BookOpen size={14} />查看募集要项 <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpcomingSchools;
