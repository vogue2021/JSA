import React, { useState, useMemo, useEffect } from 'react';
import {
  School, Calendar, ChevronLeft, ChevronRight, MapPin,
  ExternalLink, Users, BookOpen, Search, X, FileText
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { schoolDatabaseAPI } from '../services/api';

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
                          onMouseEnter={e => e.currentTarget.style.boxShadow = tokens.shadow.elevationHover}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = glassCardStyle.boxShadow || 'none'}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${typeColor}`} />
                                  <h4 className="font-bold truncate" style={{ color: tokens.colors.text.primary }}>{school.name}</h4>
                    {(school.nameJa || school.name_ja) && (
                                    <span className="text-xs truncate hidden sm:inline" style={{ color: tokens.colors.text.muted }}>{school.nameJa || school.name_ja}</span>
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
                                {((school.xuexinCert || school.xuexin_cert) || (school.overseasCert || school.overseas_cert)) && (
                                  <div className="flex flex-wrap gap-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ background: (school.xuexinCert || school.xuexin_cert) === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4') : (school.xuexinCert || school.xuexin_cert) === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : (isDark ? 'rgba(234,179,8,0.12)' : '#fefce8'), color: (school.xuexinCert || school.xuexin_cert) === '是' ? '#22c55e' : (school.xuexinCert || school.xuexin_cert) === '否' ? '#ef4444' : '#eab308' }}>
                                      学信网:{(school.xuexinCert || school.xuexin_cert) || '不确定'}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full"
                                      style={{ background: (school.overseasCert || school.overseas_cert) === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4') : (school.overseasCert || school.overseas_cert) === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2') : (isDark ? 'rgba(234,179,8,0.12)' : '#fefce8'), color: (school.overseasCert || school.overseas_cert) === '是' ? '#22c55e' : (school.overseasCert || school.overseas_cert) === '否' ? '#ef4444' : '#eab308' }}>
                                      海外认证:{(school.overseasCert || school.overseas_cert) || '不确定'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {user.role !== 'student' && relatedStudents.length > 0 && (
                                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                                    style={{ background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', color: isDark ? '#93c5fd' : '#2563eb' }}>
                                    <Users size={12} />{relatedStudents.length}
                                  </span>
                                )}
                                <ExternalLink size={14} style={{ color: tokens.colors.text.muted }} />
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
                <h5 className="text-xs font-semibold mb-2" style={{ color: tokens.colors.text.muted }}>重要日期</h5>
                {(() => {
                  const dates = detailSchool.importantDates || detailSchool.important_dates;
                  if (dates && dates.length > 0) {
                    return dates.map((dg, gi) => {
                      const asd = dg.applicationStartDate || dg.application_start_date;
                      const aed = dg.applicationEndDate || dg.application_end_date;
                      const ed = dg.examDate || dg.exam_date;
                      const rd = dg.resultDate || dg.result_date;
                      if (!asd && !aed && !ed && !rd) return null;
                      return (
                        <div key={gi} className="mb-3">
                          <div className="text-xs font-semibold mb-1" style={{ color: tokens.colors.text.secondary }}>{dg.label || `第${gi+1}审`}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {asd && <div className="rounded-lg p-2.5 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿开始</div><div className="text-sm font-semibold" style={{ color: tokens.colors.text.secondary }}>{asd}</div></div>}
                            {aed && <div className="rounded-lg p-2.5 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>出愿截止</div><div className="text-sm font-semibold" style={{ color: '#ef4444' }}>{aed}</div></div>}
                            {ed && <div className="rounded-lg p-2.5 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>考试日期</div><div className="text-sm font-semibold" style={{ color: '#3b82f6' }}>{ed}</div></div>}
                            {rd && <div className="rounded-lg p-2.5 text-center" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}><div className="text-xs" style={{ color: tokens.colors.text.muted }}>合格发表</div><div className="text-sm font-semibold" style={{ color: '#22c55e' }}>{rd}</div></div>}
                          </div>
                        </div>
                      );
                    });
                  }
                  return <p className="text-xs text-center py-3" style={{ color: tokens.colors.text.muted }}>暂未设置具体日期</p>;
                })()}
              </div>
              {/* 录取信息 */}
              {(detailSchool.acceptanceRate || detailSchool.requirements) && (
                <div className="flex items-center gap-4 text-sm" style={{ color: tokens.colors.text.secondary }}>
                  {detailSchool.acceptanceRate && <span>录取率: <strong>{detailSchool.acceptanceRate}</strong></span>}
                  {detailSchool.requirements && <span>要求: {detailSchool.requirements}</span>}
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
