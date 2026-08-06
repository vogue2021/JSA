import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  School, Calendar, ChevronLeft, ChevronRight, MapPin,
  ExternalLink, Users, BookOpen, Search, X, FileText, AlertTriangle, AlertCircle
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

/**
 * 【新需求103】考试日期撞期红色叹号
 * 需求原话：点开学校卡片之后，那个学校的考试日期处显示一个红色叹号，
 *   鼠标悬停叹号时显示与它撞期的学校名称。
 *
 * 实现要点：
 * 1. 不用原生 title —— 有 ~1s 延迟、样式不可控、多行会被截断。
 * 2. tooltip 走 React Portal + position:fixed —— 详情弹窗本身是 `max-h-[85vh] overflow-y-auto`
 *    的滚动容器，普通 absolute tooltip 会被容器裁掉；挂到 body 上就不会。
 * 3. 自动翻转：下方空间不足时改为在上方显示。
 * 4. 同时绑定 onClick（阻止冒泡，避免误关弹窗）以支持触屏点按查看。
 */
const ExamConflictMark = ({ conflict, isDark, tokens }) => {
  const anchorRef = useRef(null);
  const [tip, setTip] = useState(null); // { top, left, placement }

  const openTip = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ESTIMATED_H = 150; // tooltip 估算高度，用于判断是否需要翻转
    const placeBelow = r.bottom + ESTIMATED_H < window.innerHeight;
    setTip({
      top: placeBelow ? r.bottom + 6 : r.top - 6,
      left: r.left + r.width / 2,
      placement: placeBelow ? 'below' : 'above',
    });
  };
  const closeTip = () => setTip(null);

  const planned = conflict?.planned || [];
  const candidate = conflict?.candidate || [];
  if (planned.length === 0 && candidate.length === 0) return null;

  // 同一所学校可能因为多个考试字段重复出现，按 学校名+考试类型 去重
  const dedupe = (list) => {
    const seen = new Set();
    return list.filter((o) => {
      const k = `${o.schoolName}|${o.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const plannedList = dedupe(planned);
  const candidateList = dedupe(candidate);

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
        className="inline-flex items-center justify-center"
        style={{ color: '#dc2626', lineHeight: 0 }}
        aria-label="考试日期撞期，查看撞期学校"
      >
        <AlertCircle size={14} strokeWidth={2.5} />
      </button>
      {tip && createPortal(
        <div
          className="px-2.5 py-2 rounded-lg text-left"
          style={{
            position: 'fixed',
            top: tip.top,
            left: tip.left,
            transform: tip.placement === 'below' ? 'translateX(-50%)' : 'translate(-50%, -100%)',
            zIndex: 9999,
            minWidth: 180,
            maxWidth: 280,
            pointerEvents: 'none',
            background: isDark ? 'rgba(17,17,27,0.97)' : 'rgba(255,255,255,0.99)',
            border: `1px solid ${isDark ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
          }}
        >
          <div className="text-xs font-semibold mb-1 whitespace-nowrap" style={{ color: '#dc2626' }}>
            该日期考试撞期
          </div>
          {plannedList.length > 0 && (
            <div className="mb-1">
              <div className="text-[11px] mb-0.5" style={{ color: tokens.colors.text.muted }}>该生已报志愿校：</div>
              {plannedList.map((o, i) => (
                <div key={`p-${i}`} className="text-xs" style={{ color: tokens.colors.text.primary }}>
                  • {o.schoolName}
                  <span style={{ color: tokens.colors.text.muted }}>（{o.label}）</span>
                </div>
              ))}
            </div>
          )}
          {candidateList.length > 0 && (
            <div>
              <div className="text-[11px] mb-0.5" style={{ color: tokens.colors.text.muted }}>其他可报学校：</div>
              {candidateList.map((o, i) => (
                <div key={`c-${i}`} className="text-xs" style={{ color: tokens.colors.text.secondary }}>
                  • {o.schoolName}
                  <span style={{ color: tokens.colors.text.muted }}>（{o.label}）</span>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

const UpcomingSchools = ({ studentList, studentData, currentStudent, user }) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailSchool, setDetailSchool] = useState(null); // 弹窗展示学校详情
  const [searchQuery, setSearchQuery] = useState('');
  // 【新需求95】高才加分校筛选：all | only
  const [filterTalentBonus, setFilterTalentBonus] = useState('all');

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
    // 无搜索 & 无高才加分筛选 → 直接返回
    if (!searchQuery && filterTalentBonus === 'all') return monthsData;
    return monthsData.map(md => ({
      ...md,
      schools: md.schools.filter(s => {
        const matchSearch = !searchQuery
          || s.name.includes(searchQuery)
          || s.nameJa?.includes(searchQuery)
          || s.location?.includes(searchQuery);
        // 【新需求95】高才加分校筛选
        const matchTalent = filterTalentBonus === 'all' || (filterTalentBonus === 'only' && !!s.isTalentBonus);
        return matchSearch && matchTalent;
      }),
    }));
  }, [monthsData, searchQuery, filterTalentBonus]);

  // 【新需求103】把某所学校的撞期结果整理成 date → { planned: [], candidate: [] }
  //   供详情弹窗在对应考试日期旁挂红色叹号（不再在卡片上做徽章/筛选）
  const buildConflictByDate = (school) => {
    const map = new Map();
    const ensure = (date) => {
      if (!map.has(date)) map.set(date, { planned: [], candidate: [] });
      return map.get(date);
    };
    (conflictWithPlanned[school.id] || []).forEach((h) => {
      ensure(h.date).planned.push(...h.others);
    });
    getSchoolConflicts(candidateConflicts, school).forEach((h) => {
      ensure(h.date).candidate.push(...h.others);
    });
    return map;
  };

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
          {/* 【新需求103】撞期改为"点开卡片后在考试日期旁显示红色叹号"，这里只做一句轻提示 */}
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: tokens.colors.text.muted }}>
            <AlertTriangle size={12} style={{ color: '#dc2626' }} />
            若考试日期与其他学校撞期，详情弹窗对应日期会出现红色叹号，悬停可查看撞期学校
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { value: schoolDb.length, label: '信息库总数', color: '#3b82f6', bg: isDark ? 'rgba(59,130,246,0.12)' : 'linear-gradient(135deg, #eff6ff, #dbeafe)' },
          { value: totalUpcoming, label: '近6月可报', color: '#22c55e', bg: isDark ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)' },
          { value: filteredMonthsData[0]?.schools.length || 0, label: '本月可报', color: '#a855f7', bg: isDark ? 'rgba(168,85,247,0.12)' : 'linear-gradient(135deg, #faf5ff, #f3e8ff)' },
          { value: filteredMonthsData[1]?.schools.length || 0, label: '下月可报', color: '#f97316', bg: isDark ? 'rgba(249,115,22,0.12)' : 'linear-gradient(135deg, #fff7ed, #ffedd5)' },
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

                      return (
                        <div key={school.id}
                          className="rounded-xl overflow-hidden transition cursor-pointer"
                          style={{
                            ...glassCardStyle,
                            transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
                          }}
                          onClick={() => setDetailSchool(school)}
                          title={`点击查看 ${school.name} 的详细报考信息`}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = tokens.shadow.elevationHover;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = glassCardStyle.boxShadow || 'none';
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
              {/* 重要日期 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold" style={{ color: tokens.colors.text.muted }}>重要日期</h5>
                  {/* 【新需求103】撞期基准说明（叹号是跟谁比出来的） */}
                  <span className="text-[11px]" style={{ color: tokens.colors.text.muted }}>
                    撞期基准：{currentStudent?.name || '当前学生'} 已报 {plannedSchools.length} 所志愿校
                  </span>
                </div>
                {(() => {
                  // 【新需求103】该校每个撞期日期 → { planned: [...], candidate: [...] }
                  //   考试日期格子保持原样式，只在标题右侧挂一个红色叹号，hover 显示撞期学校名
                  const conflictByDate = buildConflictByDate(detailSchool);
                  const markFor = (rawDate) => conflictByDate.get(normalizeDate(rawDate)) || null;
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
                            {/* 【新需求103】考试类日期若撞期 → 标题右侧红色叹号，悬停显示撞期学校名*/}
                            {fxd && (
                              <div className="rounded-lg p-2.5 text-center" style={cellStyle}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: tokens.colors.text.muted }}>
                                  一审考试<ExamConflictMark conflict={markFor(fxd)} isDark={isDark} tokens={tokens} />
                                </div>
                                <div className="text-sm font-semibold" style={{ color: '#0ea5e9' }}>{fxd}</div>
                              </div>
                            )}
                            {frd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>一审发表</div><div className="text-sm font-semibold" style={{ color: '#14b8a6' }}>{frd}</div></div>}
                            {sxd && (
                              <div className="rounded-lg p-2.5 text-center" style={cellStyle}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: tokens.colors.text.muted }}>
                                  二审考试<ExamConflictMark conflict={markFor(sxd)} isDark={isDark} tokens={tokens} />
                                </div>
                                <div className="text-sm font-semibold" style={{ color: '#ec4899' }}>{sxd}</div>
                              </div>
                            )}
                            {srd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>二审发表</div><div className="text-sm font-semibold" style={{ color: '#d946ef' }}>{srd}</div></div>}
                            {ed && (
                              <div className="rounded-lg p-2.5 text-center" style={cellStyle}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: tokens.colors.text.muted }}>
                                  考试日期<ExamConflictMark conflict={markFor(ed)} isDark={isDark} tokens={tokens} />
                                </div>
                                <div className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{ed}</div>
                              </div>
                            )}
                            {rd && <div className="rounded-lg p-2.5 text-center" style={cellStyle}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>合格发表</div><div className="text-sm font-semibold" style={{ color: '#22c55e' }}>{rd}</div></div>}
                            {customDates.map((cd, i) => (
                              <div key={`c-${i}`} className="rounded-lg p-2.5 text-center" style={cellStyle}>
                                <div className="text-xs flex items-center justify-center gap-1" style={{ color: tokens.colors.text.muted }}>
                                  {cd.label}
                                  {/* 只有"考试类"自定义日期才挂叹号（书类提交等非考试项不标记） */}
                                  {isExamLikeLabel(cd.label) && (
                                    <ExamConflictMark conflict={markFor(cd.date)} isDark={isDark} tokens={tokens} />
                                  )}
                                </div>
                                <div className="text-sm font-semibold" style={{ color: '#8b5cf6' }}>{cd.date}</div>
                              </div>
                            ))}
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
