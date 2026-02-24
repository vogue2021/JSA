import React, { useState, useMemo } from 'react';
import {
  School, Calendar, ChevronLeft, ChevronRight, MapPin,
  ExternalLink, Users, ChevronDown, ChevronUp, BookOpen, Search
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const TYPE_COLORS = {
  '国立': 'bg-blue-500',
  '公立': 'bg-green-500',
  '私立': 'bg-purple-500',
};

const UpcomingSchools = ({ studentList, currentStudent, user }) => {
  const { isDark, tokens, glassEnabled } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedSchoolId, setExpandedSchoolId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // 从学校信息库获取数据
  const schoolDb = useMemo(() => {
    try {
      const saved = localStorage.getItem('schoolDatabase');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, []);

  // 解析出愿时间段，判断是否在指定月份有活动
  const parseSchoolMonths = (school) => {
    const months = new Set();

    // 从 importantDates 多组日期解析
    if (school.importantDates && Array.isArray(school.importantDates)) {
      school.importantDates.forEach(dateGroup => {
        if (dateGroup.applicationStartDate) {
          const d = new Date(dateGroup.applicationStartDate);
          if (!isNaN(d)) months.add(d.getMonth());
        }
        if (dateGroup.applicationEndDate) {
          const d = new Date(dateGroup.applicationEndDate);
          if (!isNaN(d)) months.add(d.getMonth());
        }
        if (dateGroup.examDate) {
          const d = new Date(dateGroup.examDate);
          if (!isNaN(d)) months.add(d.getMonth());
        }
        if (dateGroup.resultDate) {
          const d = new Date(dateGroup.resultDate);
          if (!isNaN(d)) months.add(d.getMonth());
        }
      });
    }

    // 兼容旧数据的单组日期字段
    if (school.applicationStartDate) {
      const d = new Date(school.applicationStartDate);
      if (!isNaN(d)) months.add(d.getMonth());
    }
    if (school.applicationEndDate) {
      const d = new Date(school.applicationEndDate);
      if (!isNaN(d)) months.add(d.getMonth());
    }
    if (school.examDate) {
      const d = new Date(school.examDate);
      if (!isNaN(d)) months.add(d.getMonth());
    }
    if (school.resultDate) {
      const d = new Date(school.resultDate);
      if (!isNaN(d)) months.add(d.getMonth());
    }

    // 从 applicationPeriods 文本解析月份
    if (school.applicationPeriods && Array.isArray(school.applicationPeriods)) {
      school.applicationPeriods.forEach(period => {
        const monthMatches = period.match(/(\d{1,2})月/g);
        if (monthMatches) {
          monthMatches.forEach(m => {
            const num = parseInt(m.replace('月', ''));
            if (num >= 1 && num <= 12) months.add(num - 1);
          });
        }
      });
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
  }, [month, year, schoolDb]);

  // 搜索过滤
  const filteredMonthsData = useMemo(() => {
    if (!searchQuery) return monthsData;
    return monthsData.map(md => ({
      ...md,
      schools: md.schools.filter(s =>
        s.name.includes(searchQuery) || s.nameJa?.includes(searchQuery) || s.location?.includes(searchQuery)
      ),
    }));
  }, [monthsData, searchQuery]);

  // 获取相关学生信息（已申请该学校的学生）
  const getStudentsForSchool = (schoolName) => {
    const result = [];
    if (!studentList) return result;

    studentList.forEach(student => {
      try {
        const key = student.studentId || 'default';
        const savedData = localStorage.getItem(`studentData_${key}`);
        if (!savedData) return;
        const data = JSON.parse(savedData);
        const studentSchools = data.schools || [];
        if (studentSchools.some(s => s.name === schoolName)) {
          result.push({
            name: student.name,
            studentId: student.studentId,
            avatar: student.avatar || '👤',
            subject: student.subject,
          });
        }
      } catch {}
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
        </div>
        <div className="flex items-center gap-2">
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
                      const isExpanded = expandedSchoolId === `${md.year}-${md.month}-${school.id}`;
                      const relatedStudents = getStudentsForSchool(school.name);
                      const typeColor = TYPE_COLORS[school.type] || 'bg-gray-500';

                      return (
                        <div key={school.id}
                          className="rounded-xl overflow-hidden transition cursor-pointer"
                          style={{
                            ...glassCardStyle,
                            transition: 'all 250ms cubic-bezier(0.16,1,0.3,1)',
                          }}
                          onClick={() => setExpandedSchoolId(isExpanded ? null : `${md.year}-${md.month}-${school.id}`)}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = tokens.shadow.elevationHover}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = glassCardStyle.boxShadow || 'none'}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${typeColor}`} />
                                  <h4 className="font-bold truncate" style={{ color: tokens.colors.text.primary }}>{school.name}</h4>
                                  {school.nameJa && (
                                    <span className="text-xs truncate hidden sm:inline" style={{ color: tokens.colors.text.muted }}>{school.nameJa}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs mb-2" style={{ color: tokens.colors.text.muted }}>
                                  {school.location && (
                                    <span className="flex items-center gap-1"><MapPin size={12} />{school.location}</span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.secondary }}>
                                    {school.type}
                                  </span>
                                </div>
                                {school.applicationPeriods && school.applicationPeriods.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {school.applicationPeriods.map((p, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: isDark ? 'rgba(249,115,22,0.12)' : '#fff7ed', color: isDark ? '#fdba74' : '#ea580c' }}>
                                        <Calendar size={10} className="inline mr-1" />{p}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {relatedStudents.length > 0 && (
                                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                                    style={{ background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                    <Users size={12} />{relatedStudents.length}
                                  </span>
                                )}
                                {isExpanded
                                  ? <ChevronUp size={16} style={{ color: tokens.colors.text.muted }} />
                                  : <ChevronDown size={16} style={{ color: tokens.colors.text.muted }} />}
                              </div>
                            </div>
                          </div>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="p-4 space-y-3 animate-fade-in" onClick={e => e.stopPropagation()}
                              style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                              {/* 重要日期 */}
                              <div>
                                <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>重要日期</h5>
                                {school.importantDates && school.importantDates.length > 0 ? (
                                  school.importantDates.map((dateGroup, gi) => {
                                    const hasAny = dateGroup.applicationStartDate || dateGroup.applicationEndDate || dateGroup.examDate || dateGroup.resultDate;
                                    if (!hasAny) return null;
                                    return (
                                      <div key={gi} className="mb-2">
                                        <div className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.secondary }}>{dateGroup.label || `第${gi+1}审`}</div>
                                        <div className="grid grid-cols-2 gap-2">
                                          {dateGroup.applicationStartDate && (
                                            <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
                                              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿开始</div>
                                              <div className="text-sm font-semibold" style={{ color: tokens.colors.text.secondary }}>{dateGroup.applicationStartDate}</div>
                                            </div>
                                          )}
                                          {dateGroup.applicationEndDate && (
                                            <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
                                              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿截止</div>
                                              <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>{dateGroup.applicationEndDate}</div>
                                            </div>
                                          )}
                                          {dateGroup.examDate && (
                                            <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
                                              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>考试日期</div>
                                              <div className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{dateGroup.examDate}</div>
                                            </div>
                                          )}
                                          {dateGroup.resultDate && (
                                            <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
                                              <div className="text-xs" style={{ color: tokens.colors.text.muted }}>合格发表</div>
                                              <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>{dateGroup.resultDate}</div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    {school.applicationStartDate && (
                                      <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                                        <div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿开始</div>
                                        <div className="text-sm font-semibold" style={{ color: tokens.colors.text.secondary }}>{school.applicationStartDate}</div>
                                      </div>
                                    )}
                                    {school.applicationEndDate && (
                                      <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                                        <div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿截止</div>
                                        <div className="text-sm font-semibold" style={{ color: '#ef4444' }}>{school.applicationEndDate}</div>
                                      </div>
                                    )}
                                    {school.examDate && (
                                      <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                                        <div className="text-xs" style={{ color: tokens.colors.text.muted }}>考试日期</div>
                                        <div className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{school.examDate}</div>
                                      </div>
                                    )}
                                    {school.resultDate && (
                                      <div className="rounded-lg p-2 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }}>
                                        <div className="text-xs" style={{ color: tokens.colors.text.muted }}>合格发表</div>
                                        <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>{school.resultDate}</div>
                                      </div>
                                    )}
                                    {!school.applicationStartDate && !school.applicationEndDate && !school.examDate && !school.resultDate && (
                                      <div className="col-span-2 text-xs text-center py-2" style={{ color: tokens.colors.text.muted }}>暂未设置具体日期</div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 录取信息 */}
                              <div className="flex items-center gap-4 text-sm" style={{ color: tokens.colors.text.secondary }}>
                                {school.acceptanceRate && <span>录取率: <strong>{school.acceptanceRate}</strong></span>}
                                {school.requirements && <span>要求: {school.requirements}</span>}
                              </div>

                              {/* 专业列表 */}
                              {school.programs && school.programs.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.muted }}>招生研究科</h5>
                                  <div className="flex flex-wrap gap-1">
                                    {school.programs.map((p, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 相关学生 */}
                              {relatedStudents.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>
                                    <Users size={12} className="inline mr-1" />已申请该校的学生 ({relatedStudents.length})
                                  </h5>
                                  <div className="flex flex-wrap gap-2">
                                    {relatedStudents.map((s, i) => (
                                      <div key={i} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                                        style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: `1px solid ${tokens.colors.border.subtle}` }}>
                                        <span className="text-lg">{s.avatar}</span>
                                        <div>
                                          <div className="text-sm font-medium" style={{ color: tokens.colors.text.primary }}>{s.name}</div>
                                          <div className="text-xs" style={{ color: tokens.colors.text.muted }}>{s.studentId} {s.subject && `· ${s.subject}`}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 链接 */}
                              {school.requirementsUrl && (
                                <a href={school.requirementsUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs transition"
                                  style={{ color: tokens.colors.accent.success }}>
                                  <BookOpen size={12} />募集要项 <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
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
      {schoolDb.length === 0 && (
        <div className="rounded-xl p-6 text-center"
          style={{ background: isDark ? 'rgba(234,179,8,0.08)' : '#fefce8', border: `1px solid ${isDark ? 'rgba(234,179,8,0.2)' : '#fef08a'}` }}>
          <BookOpen size={32} className="mx-auto mb-2" style={{ color: isDark ? '#fbbf24' : '#ca8a04' }} />
          <p className="font-medium" style={{ color: isDark ? '#fbbf24' : '#a16207' }}>学校信息库暂无数据</p>
          <p className="text-sm mt-1" style={{ color: isDark ? '#fde68a' : '#ca8a04' }}>请先在"学校信息库"页面添加学校信息，并填写出愿时间段</p>
        </div>
      )}
    </div>
  );
};

export default UpcomingSchools;
