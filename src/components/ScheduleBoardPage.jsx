//【新需求120 第2项】考务日程看板（仅 admin）
//
// 需求原话：
//   「作为一个权限，只给 admin 账号的功能，新增加一个页面，按照每天的维度去显示
//     数据库里面的学校，哪些要报名了，哪些要考试了。也就是为了清晰的知道哪些学校
//     需要报名，哪些学校需要考试。目的是方便安排考试的上课时间。」
//
// 设计判断：
//   1. admin 专属 —— 页面组件与菜单入口双重门禁；数据复用 GET /api/todos
//      （admin 本来就是全量范围，无需新增后端接口）
//   2. 只收两类事：考试（蓝）与 报名（橙）—— 发表日不需要排课，不收录
//   3. 同一学校同一事项跨学生合并成一行，学生姓名并排展示
//   4. 默认看未来 30 天，可切 7/14/90 天

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarRange, RefreshCw, AlertTriangle, GraduationCap, FileText, Shield,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { todosAPI } from '../services/api';
import { buildDailySchedule, summarizeSchedule, SCHEDULE_CATEGORY } from '../utils/dailySchedule';

const RANGE_OPTIONS = [
  { value: 7, label: '未来 7 天' },
  { value: 14, label: '未来 14 天' },
  { value: 30, label: '未来 30 天' },
  { value: 90, label: '未来 90 天' },
];

const CATEGORY_META = {
  [SCHEDULE_CATEGORY.EXAM]: { label: '考试', color: '#2563eb', Icon: GraduationCap },
  [SCHEDULE_CATEGORY.APPLY]: { label: '报名', color: '#ea580c', Icon: FileText },
};

const ScheduleBoardPage = () => {
  const { isDark, tokens } = useTheme();
  const { user } = useApp();
  const isAdmin = user?.role === 'admin';

  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(30);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // days 参数只影响 events 窗口；本页只用 schools/students（schools 不受窗口限制）
      const data = await todosAPI.getAll({ days: 365 });
      setRaw(data || null);
    } catch (err) {
      console.error('[考务日程] 加载失败:', err);
      setError(err?.message || '加载失败，请检查网络');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const days = useMemo(() => {
    if (!raw) return [];
    const list = buildDailySchedule({
      schools: raw.schools || [],
      students: raw.students || [],
      days: range,
    });
    if (categoryFilter === 'all') return list;
    return list
      .map(d => ({ ...d, items: d.items.filter(it => it.category === categoryFilter) }))
      .filter(d => d.items.length > 0);
  }, [raw, range, categoryFilter]);

  const stats = useMemo(() => summarizeSchedule(days), [days]);

  // ─── 权限门禁（双保险：菜单入口在 App.jsx 已隐藏，这里再挡直接访问）───────
  if (!isAdmin) {
    return (
      <div className="glass-panel p-10 text-center rounded-2xl">
        <Shield size={36} className="mx-auto mb-3" style={{ color: tokens.colors.text.muted }} />
        <div className="text-sm" style={{ color: tokens.colors.text.muted }}>考务日程仅管理员可见</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel p-10 text-center rounded-2xl">
        <RefreshCw size={28} className="mx-auto mb-3 animate-spin" style={{ color: tokens.colors.text.muted }} />
        <div className="text-sm" style={{ color: tokens.colors.text.muted }}>正在汇总全校考务日程…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center rounded-2xl">
        <AlertTriangle size={36} className="mx-auto mb-3" style={{ color: '#dc2626' }} />
        <div className="text-sm mb-4" style={{ color: tokens.colors.text.secondary }}>{error}</div>
        <button onClick={load}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
          重新加载
        </button>
      </div>
    );
  }

  const statCard = (label, value, color) => (
    <div className="glass-panel p-3 rounded-xl flex-1 min-w-[104px]">
      <div className="text-xs mb-1" style={{ color: tokens.colors.text.muted }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <CalendarRange size={20} />
              考务日程
            </h2>
            <p className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>
              按天看全校哪些学校要报名、哪些学校要考试 · 用于安排上课时间
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {RANGE_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setRange(o.value)}
                className="px-2 py-1 rounded-md text-xs font-medium transition"
                style={{
                  background: range === o.value
                    ? (isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.14)')
                    : 'transparent',
                  color: range === o.value ? (isDark ? '#93c5fd' : '#2563eb') : tokens.colors.text.muted,
                }}>
                {o.label}
              </button>
            ))}
            <button onClick={load} title="刷新"
              className="p-2 rounded-lg transition"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.secondary }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="flex gap-3 flex-wrap">
        {statCard('有日程的天数', stats.days, tokens.colors.text.primary)}
        {statCard('考试场次', stats.examCount, '#2563eb')}
        {statCard('报名事项', stats.applyCount, '#ea580c')}
        {statCard('涉及学校', stats.schoolCount, '#7c3aed')}
      </div>

      {/* 类别筛选 */}
      <div className="glass-panel p-3 rounded-xl flex items-center gap-2 flex-wrap">
        {[{ id: 'all', label: '全部' },
          { id: SCHEDULE_CATEGORY.EXAM, label: '只看考试' },
          { id: SCHEDULE_CATEGORY.APPLY, label: '只看报名' }].map(o => (
          <button key={o.id} onClick={() => setCategoryFilter(o.id)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition"
            style={{
              background: categoryFilter === o.id
                ? (isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.14)')
                : 'transparent',
              color: categoryFilter === o.id ? (isDark ? '#93c5fd' : '#2563eb') : tokens.colors.text.muted,
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {/* 按天渲染 */}
      {days.length === 0 ? (
        <div className="glass-panel p-10 text-center rounded-2xl">
          <CalendarRange size={36} className="mx-auto mb-3" style={{ color: tokens.colors.text.muted, opacity: 0.5 }} />
          <div className="text-sm" style={{ color: tokens.colors.text.muted }}>
            未来 {range} 天没有{categoryFilter === SCHEDULE_CATEGORY.EXAM ? '考试' : categoryFilter === SCHEDULE_CATEGORY.APPLY ? '报名' : ''}日程
          </div>
        </div>
      ) : (
        days.map(day => (
          <div key={day.date} className="glass-panel p-4 rounded-2xl">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-sm font-bold" style={{ color: tokens.colors.text.primary }}>
                {day.date} {day.weekday}
              </span>
              {day.isToday && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: isDark ? 'rgba(234,88,12,0.25)' : 'rgba(234,88,12,0.12)', color: '#ea580c' }}>
                  今天
                </span>
              )}
              {day.isTomorrow && (
                <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: isDark ? 'rgba(217,119,6,0.22)' : 'rgba(217,119,6,0.10)', color: '#d97706' }}>
                  明天
                </span>
              )}
              {!day.isToday && !day.isTomorrow && (
                <span className="text-[11px]" style={{ color: tokens.colors.text.muted }}>{day.daysLeft} 天后</span>
              )}
              <span className="text-[11px] ml-auto" style={{ color: tokens.colors.text.muted }}>
                {day.items.length} 项
              </span>
            </div>
            <div className="space-y-1.5">
              {day.items.map((it, ii) => {
                const meta = CATEGORY_META[it.category];
                return (
                  <div key={`${it.schoolName}|${it.program}|${it.label}|${ii}`}
                    className="flex items-center gap-2 flex-wrap px-2 py-1.5 rounded-lg"
                    style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap inline-flex items-center gap-1"
                      style={{ background: `${meta.color}1f`, color: meta.color }}>
                      <meta.Icon size={10} />
                      {it.label}{it.deadlineType ? `·${it.deadlineType}` : ''}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: tokens.colors.text.primary }}>
                      {it.schoolName}
                    </span>
                    {it.program && (
                      <span className="text-xs" style={{ color: tokens.colors.text.muted }}>{it.program}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1 flex-wrap">
                      {it.students.map(s => (
                        <span key={s.studentId}
                          className="text-[11px] px-1.5 py-0.5 rounded-full"
                          style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: tokens.colors.text.secondary }}>
                          {s.studentName}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ScheduleBoardPage;
