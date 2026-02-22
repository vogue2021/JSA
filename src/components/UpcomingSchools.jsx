import React, { useState, useMemo } from 'react';
import {
  School, Calendar, ChevronLeft, ChevronRight, MapPin, Award,
  ExternalLink, Users, ChevronDown, ChevronUp, BookOpen, Search
} from 'lucide-react';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const DIFFICULTY_COLORS = {
  '极难': 'bg-red-100 text-red-700',
  '难': 'bg-orange-100 text-orange-700',
  '普通': 'bg-blue-100 text-blue-700',
  '容易': 'bg-green-100 text-green-700',
};

const TYPE_COLORS = {
  '国立': 'bg-blue-500',
  '公立': 'bg-green-500',
  '私立': 'bg-purple-500',
};

const UpcomingSchools = ({ studentList, currentStudent, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedSchoolId, setExpandedSchoolId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

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

    // 从 applicationStartDate / applicationEndDate 解析
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
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">近期可报学校</h2>
          <p className="text-gray-500 text-sm mt-1">根据学校信息库的出愿时间，按月份展示近期可报考学校</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索学校..."
              className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none w-48"
            />
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-blue-600">{schoolDb.length}</div>
          <div className="text-xs text-blue-500">信息库总数</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-green-600">{totalUpcoming}</div>
          <div className="text-xs text-green-500">近6月可报</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-purple-600">
            {filteredMonthsData[0]?.schools.length || 0}
          </div>
          <div className="text-xs text-purple-500">本月可报</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl text-center">
          <div className="text-2xl font-bold text-orange-600">
            {filteredMonthsData[1]?.schools.length || 0}
          </div>
          <div className="text-xs text-orange-500">下月可报</div>
        </div>
      </div>

      {/* 月份导航 */}
      <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-800">
            {year}年 {MONTH_NAMES[month]} ~ {year + Math.floor((month + 5) / 12)}年 {MONTH_NAMES[(month + 5) % 12]}
          </h3>
          <button
            onClick={goToday}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition"
          >
            回到当月
          </button>
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 时间线展示 */}
      <div className="relative">
        {/* 左侧时间线 */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 hidden sm:block" />

        <div className="space-y-8">
          {filteredMonthsData.map((md, idx) => {
            const isCurrentMonth = md.month === new Date().getMonth() && md.year === new Date().getFullYear();
            return (
              <div key={`${md.year}-${md.month}`} className="relative">
                {/* 月份节点 */}
                <div className="flex items-center gap-4 mb-4">
                  <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md ${
                    isCurrentMonth ? 'bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-blue-200' : 'bg-gray-400'
                  }`}>
                    {md.month + 1}月
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isCurrentMonth ? 'text-blue-600' : 'text-gray-700'}`}>
                      {md.year}年{MONTH_NAMES[md.month]}
                      {isCurrentMonth && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">当前</span>}
                    </h3>
                    <p className="text-sm text-gray-500">
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
                      const difficultyClass = DIFFICULTY_COLORS[school.difficulty] || 'bg-gray-100 text-gray-700';
                      const typeColor = TYPE_COLORS[school.type] || 'bg-gray-500';

                      return (
                        <div
                          key={school.id}
                          className="bg-white rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden"
                          onClick={() => setExpandedSchoolId(isExpanded ? null : `${md.year}-${md.month}-${school.id}`)}
                        >
                          <div className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${typeColor}`} />
                                  <h4 className="font-bold text-gray-800 truncate">{school.name}</h4>
                                  {school.nameJa && (
                                    <span className="text-xs text-gray-400 truncate hidden sm:inline">{school.nameJa}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                  {school.location && (
                                    <span className="flex items-center gap-1"><MapPin size={12} />{school.location}</span>
                                  )}
                                  {school.ranking && (
                                    <span className="flex items-center gap-1"><Award size={12} />排名 {school.ranking}</span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${difficultyClass}`}>
                                    {school.difficulty || '普通'}
                                  </span>
                                </div>
                                {school.applicationPeriods && school.applicationPeriods.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {school.applicationPeriods.map((p, i) => (
                                      <span key={i} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                                        <Calendar size={10} className="inline mr-1" />{p}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {relatedStudents.length > 0 && (
                                  <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                                    <Users size={12} />{relatedStudents.length}
                                  </span>
                                )}
                                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                              </div>
                            </div>
                          </div>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="border-t bg-gray-50 p-4 space-y-3 animate-fade-in" onClick={e => e.stopPropagation()}>
                              {/* 重要日期 */}
                              <div>
                                <h5 className="text-xs font-semibold text-gray-500 mb-2">重要日期</h5>
                                <div className="grid grid-cols-2 gap-2">
                                  {school.applicationStartDate && (
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-gray-400">出愿开始</div>
                                      <div className="text-sm font-semibold text-gray-700">{school.applicationStartDate}</div>
                                    </div>
                                  )}
                                  {school.applicationEndDate && (
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-gray-400">出愿截止</div>
                                      <div className="text-sm font-semibold text-red-600">{school.applicationEndDate}</div>
                                    </div>
                                  )}
                                  {school.examDate && (
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-gray-400">考试日期</div>
                                      <div className="text-sm font-semibold text-blue-600">{school.examDate}</div>
                                    </div>
                                  )}
                                  {school.resultDate && (
                                    <div className="bg-white rounded-lg p-2 text-center">
                                      <div className="text-xs text-gray-400">合格发表</div>
                                      <div className="text-sm font-semibold text-green-600">{school.resultDate}</div>
                                    </div>
                                  )}
                                  {!school.applicationStartDate && !school.applicationEndDate && !school.examDate && !school.resultDate && (
                                    <div className="col-span-2 text-xs text-gray-400 text-center py-2">暂未设置具体日期</div>
                                  )}
                                </div>
                              </div>

                              {/* 录取信息 */}
                              <div className="flex items-center gap-4 text-sm">
                                {school.acceptanceRate && (
                                  <span className="text-gray-600">录取率: <strong>{school.acceptanceRate}</strong></span>
                                )}
                                {school.requirements && (
                                  <span className="text-gray-600">要求: {school.requirements}</span>
                                )}
                              </div>

                              {/* 专业列表 */}
                              {school.programs && school.programs.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold text-gray-500 mb-1">招生研究科</h5>
                                  <div className="flex flex-wrap gap-1">
                                    {school.programs.map((p, i) => (
                                      <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 相关学生 */}
                              {relatedStudents.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold text-gray-500 mb-2">
                                    <Users size={12} className="inline mr-1" />已申请该校的学生 ({relatedStudents.length})
                                  </h5>
                                  <div className="flex flex-wrap gap-2">
                                    {relatedStudents.map((s, i) => (
                                      <div key={i} className="flex items-center gap-1.5 bg-white border rounded-lg px-3 py-1.5">
                                        <span className="text-lg">{s.avatar}</span>
                                        <div>
                                          <div className="text-sm font-medium text-gray-700">{s.name}</div>
                                          <div className="text-xs text-gray-400">{s.studentId} {s.subject && `· ${s.subject}`}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 链接 */}
                              <div className="flex gap-2">
                                {school.website && (
                                  <a
                                    href={school.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition"
                                  >
                                    <ExternalLink size={12} />官网
                                  </a>
                                )}
                                {school.requirementsUrl && (
                                  <a
                                    href={school.requirementsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-green-500 hover:text-green-700 transition"
                                  >
                                    <BookOpen size={12} />募集要项
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sm:ml-16 bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <BookOpen size={32} className="mx-auto text-yellow-400 mb-2" />
          <p className="text-yellow-700 font-medium">学校信息库暂无数据</p>
          <p className="text-yellow-500 text-sm mt-1">请先在"学校信息库"页面添加学校信息，并填写出愿时间段</p>
        </div>
      )}
    </div>
  );
};

export default UpcomingSchools;
