//【新需求109】每日待办页面
//
// 需求原话：
//   「学生页面可以看到近期的重要待办事项，比如时间线和材料的截止日期都可以在这个页面确认到。
//     就是一个学生每天都可以知道当天有什么事情要做的功能，可以单独创建一个页面。
//     老师和管理员的页面也需要有这样一个页面，目的是为了方便老师和管理员管理学生的任务，
//     但是不需要一个学生一个学生的切换，直接显示哪个学生的任务情况，
//     但是比如说如果是学校报名，考试时间的话会有学生重叠，这个时候需要设计一下 UI，
//     一个任务的 UI 设计，需要考虑多个学生的任务。」
//
// 两种形态共用一套数据与组件：
//   · 学生端 —— 只有自己的事，卡片不显示学生名（都是自己，显示反而是噪音）
//   · 老师/管理员端 —— 跨学生聚合。**同一件事只占一行**，涉及的学生以头像标签形式
//     并排展示在卡片内；这正是需求里"学生重叠时的 UI"要解决的问题。
//
// 关键设计判断：
//   1. 不做"学生切换器"—— 需求明确说"不需要一个学生一个学生的切换"
//   2. 【新需求112 第2项】**今天的任务置顶**、逾期未完成的事项收纳到**底部**（仍显示、不隐藏），
//      页面侧重点是"今天该做什么"
//   3. 【新需求112 第3项】材料类与时间线事件类待办都支持就地标注完成
//      （材料走 PUT /materials/:id/status，事件走 PUT /events/:id/toggle）；
//      school 补齐项（未展开成事件的一审/二审等日期端）没有持久化位置，保持只读

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListChecks, RefreshCw, AlertTriangle, Calendar, Users, Search,
  Check, ExternalLink, ChevronDown, ChevronRight, Filter, School as SchoolIcon, Zap,
  Bell, Clock,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { todosAPI, materialsAPI, eventsAPI } from '../services/api';
import {
  buildTodoItems, groupTodosByTask, bucketTodos, summarizeTodos, filterByHorizon,
  getKindMeta, TODO_KINDS, todayStr, buildSchoolTimeline,
} from '../utils/todoAggregator';
import { SCHOOL_STATUS_LABELS } from '../constants/schoolProcess';

const DailyTodoPage = () => {
  const { isDark, tokens } = useTheme();
  const { user, showNotification } = useApp();
  const isStudent = user?.role === 'student';

  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 老师端：只看自己负责的学生（默认开启 —— 老师最关心自己的学生）
  const [onlyMine, setOnlyMine] = useState(user?.role === 'teacher');
  const [keyword, setKeyword] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [hideDone, setHideDone] = useState(true);
  // 【新需求111 第1项】关注视野：默认只看最近 3 天，避免"一股脑全显示"没有侧重点。
  //   逾期未完成不受此限制（见 filterByHorizon），始终保留在列表中。null = 查看全部。
  const [horizon, setHorizon] = useState(3);
  const [expanded, setExpanded] = useState(() => new Set());
  // 就地勾选后的本地覆盖，避免为了一个勾选重新拉取整页数据
  const [localDone, setLocalDone] = useState(() => new Map());
  // 【新需求120 第1项】分区折叠：内容多时一屏看不完、下滑不到底部。
  //   默认只展开「今天 / 明天」（每日待办的侧重点），其余分区折叠为标题行，点击展开。
  //   折叠的分区标题会显示条数；含预约提醒的折叠分区额外标出，防止提醒被折没。
  const [collapsedBuckets, setCollapsedBuckets] = useState(() => new Set(['week', 'month', 'later', 'overdue']));
  // 各学校时间线区块同样可折叠（默认展开——它是 116 的核心内容）
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const toggleBucket = (id) => {
    setCollapsedBuckets(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await todosAPI.getAll({
        days: 90,
        scope: onlyMine && user?.role === 'teacher' ? 'mine' : undefined,
      });
      setRaw(data || null);
    } catch (err) {
      console.error('[每日待办] 加载失败:', err);
      // 【新需求109 参考上次故障教训】不静默失败：把原因显示出来
      const msg = err?.status === 403
        ? '无权查看待办数据，请联系管理员'
        : (err?.status === 401 ? '登录状态已失效，请重新登录' : (err?.message || '加载失败，请检查网络'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [onlyMine, user?.role]);

  useEffect(() => { load(); }, [load]);

  // ─── 聚合 ─────────────────────────────────────────────────────────────────
  const tasks = useMemo(() => {
    if (!raw) return [];
    const items = buildTodoItems({
      events: raw.events || [],
      materials: raw.materials || [],
      schools: raw.schools || [],
      students: raw.students || [],
    });
    // 应用本地勾选覆盖
    const patched = items.map(it => {
      const key = `${it.source}:${it.sourceId}`;
      return localDone.has(key) ? { ...it, completed: localDone.get(key) } : it;
    });
    return groupTodosByTask(patched);
  }, [raw, localDone]);

  // 【新需求116 第1项】各学校时间线一览（数据与主列表同源，不受视野/筛选影响）
  const schoolTimelines = useMemo(
    () => buildSchoolTimeline(raw?.schools || []),
    [raw]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    // 先按关注视野收窄（逾期未完成始终保留），再套用其余筛选
    const inHorizon = filterByHorizon(tasks, horizon);
    return inHorizon.filter(t => {
      // 【新需求116 第2项】预约提醒只给学生看；老师端看它就是噪音
      if (t.kind === TODO_KINDS.REMINDER && !isStudent) return false;
      if (hideDone && t.allDone) return false;
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (!kw) return true;
      if (String(t.title).toLowerCase().includes(kw)) return true;
      if (String(t.subtitle || '').toLowerCase().includes(kw)) return true;
      // 老师端允许按学生姓名/学号搜索
      return t.students.some(s =>
        String(s.studentName).toLowerCase().includes(kw)
        || String(s.studentId).toLowerCase().includes(kw));
    });
  }, [tasks, keyword, kindFilter, hideDone, horizon, isStudent]);

  const buckets = useMemo(() => bucketTodos(filtered), [filtered]);
  const summary = useMemo(() => summarizeTodos(filtered), [filtered]);
  // 视野之外仍有多少未完成任务（用于"查看全部"入口的提示数字）
  const hiddenCount = useMemo(() => {
    if (horizon == null) return 0;
    const shownKeys = new Set(filterByHorizon(tasks, horizon).map(t => t.key));
    return tasks.filter(t => !t.allDone && !shownKeys.has(t.key)).length;
  }, [tasks, horizon]);

  // ─── 待办就地标注完成 ────────────────────────────────────────────────────
  // 【新需求112 第3项】原来只有材料可勾选；现在**时间线事件**也可以在这里快速标注完成
  //   （需求原话：「里面的待办项希望可以编辑，比如完成了可以在这里快速标注一下」）。
  //   · material → PUT /materials/:id/status（幂等，传目标值）
  //   · event    → PUT /events/:id/toggle（翻转；当前值已知，翻转即得目标值）
  //   · school 补齐项没有持久化位置，不可勾选（渲染层已拦截）
  const canToggle = (source) => source === 'material' || source === 'event';

  const toggleTodo = async (task, stu) => {
    if (!canToggle(stu.source)) return;
    const next = !stu.completed;
    const key = `${stu.source}:${stu.sourceId}`;
    // 乐观更新
    setLocalDone(prev => new Map(prev).set(key, next));
    try {
      if (stu.source === 'material') {
        // 【新需求114】必须传 role（'student'/'teacher'/'admin'），与材料页勾选口径一致。
        //   之前传的是 user.name（学生姓名），材料页按 checkedBy === 'student' 二元判断，
        //   学生姓名不等于 'student' → 一律显示成"老师勾选"，张冠李戴。
        await materialsAPI.updateStatus(stu.sourceId, next, user?.role || '');
      } else {
        await eventsAPI.toggleComplete(stu.sourceId);
      }
      showNotification?.(next ? '已标记完成' : '已取消完成', 'success');
    } catch (err) {
      // 失败回滚，不能让界面显示一个没落库的状态
      setLocalDone(prev => {
        const m = new Map(prev);
        m.delete(key);
        return m;
      });
      showNotification?.(`更新失败：${err?.message || '请重试'}`, 'error');
    }
  };

  const toggleExpand = (key) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  // ─── 渲染helpers ─────────────────────────────────────────────────────────
  const statCard = (label, value, color) => (
    <div className="glass-panel p-3 rounded-xl flex-1 min-w-[104px]">
      <div className="text-xs mb-1" style={{ color: tokens.colors.text.muted }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );

  const kindBadge = (kind, deadlineType) => {
    const meta = getKindMeta(kind);
    return (
      <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
        style={{ background: `${meta.color}1f`, color: meta.color }}>
        {meta.label}{deadlineType ? `·${deadlineType}` : ''}
      </span>
    );
  };

  /** 剩余天数徽章：逾期红、今天橙、3 天内黄、其余灰 */
  const dayBadge = (task) => {
    const d = task.daysLeft;
    let text, color;
    if (task.overdue && !task.allDone) { text = `逾期 ${Math.abs(d)} 天`; color = '#dc2626'; }
    else if (d === 0) { text = '今天'; color = '#ea580c'; }
    else if (d === 1) { text = '明天'; color = '#d97706'; }
    else if (d > 1 && d <= 3) { text = `${d} 天后`; color = '#d97706'; }
    else if (d > 3) { text = `${d} 天后`; color = tokens.colors.text.muted; }
    else { text = '已过期'; color = tokens.colors.text.muted; }
    return (
      <span className="text-xs font-bold whitespace-nowrap" style={{ color }}>{text}</span>
    );
  };

  /**
   * 学生标签组 —— 需求里"一个任务涉及多个学生"的 UI 落点。
   * 少量学生直接平铺；超过 6 个时折叠，避免一个任务把整屏占满。
   */
  const studentChips = (task) => {
    const isOpen = expanded.has(task.key);
    const list = isOpen ? task.students : task.students.slice(0, 6);
    const rest = task.students.length - list.length;
    const canCheck = canToggle(task.source);
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {list.map((s) => (
          <button
            key={`${s.studentId}-${s.sourceId}`}
            type="button"
            onClick={canCheck ? () => toggleTodo(task, s) : undefined}
            title={canCheck
              ? (s.completed ? `${s.studentName}：已完成，点击取消` : `${s.studentName}：点击标记完成`)
              : `${s.studentName}（${s.studentId}）`}
            className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition"
            style={{
              background: s.completed
                ? (isDark ? 'rgba(22,163,74,0.22)' : 'rgba(22,163,74,0.12)')
                : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
              color: s.completed ? '#16a34a' : tokens.colors.text.secondary,
              textDecoration: s.completed ? 'line-through' : 'none',
              cursor: canCheck ? 'pointer' : 'default',
            }}
          >
            {s.completed && <Check size={10} />}
            {s.studentName}
          </button>
        ))}
        {rest > 0 && (
          <button type="button" onClick={() => toggleExpand(task.key)}
            className="text-xs underline" style={{ color: tokens.colors.text.muted }}>
            +{rest} 更多
          </button>
        )}
        {isOpen && task.students.length > 6 && (
          <button type="button" onClick={() => toggleExpand(task.key)}
            className="text-xs underline" style={{ color: tokens.colors.text.muted }}>
            收起
          </button>
        )}
      </div>
    );
  };

  const taskRow = (task) => {
    const meta = getKindMeta(task.kind);
    const danger = task.overdue && !task.allDone;
    return (
      <div key={task.key} className="glass-card p-3 rounded-xl"
        style={{
          boxShadow: danger ? 'inset 3px 0 0 0 #dc2626' : `inset 3px 0 0 0 ${meta.color}66`,
          opacity: task.allDone ? 0.6 : 1,
        }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {kindBadge(task.kind, task.deadlineType)}
              <span className="font-semibold text-sm" style={{
                color: tokens.colors.text.primary,
                textDecoration: task.allDone ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>
              {/* 【新需求116 第2项】预约提醒的副标题是提示文案，用铃铛+高亮样式，
                  与材料条目的"所属学校"副标题区分开 */}
              {task.subtitle && (
                task.kind === TODO_KINDS.REMINDER ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: isDark ? 'rgba(13,148,136,0.20)' : 'rgba(13,148,136,0.12)', color: isDark ? '#2dd4bf' : '#0f766e' }}>
                    <Bell size={10} />{task.subtitle}
                  </span>
                ) : (
                  /* 【新需求111 第1项】材料条目补显所属学校，跨校聚合时才分得清 */
                  <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded"
                    style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.muted }}>
                    <SchoolIcon size={10} />{task.subtitle}
                  </span>
                )
              )}
              {task.url && (
                <a href={task.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: '#3b82f6' }}>
                  链接 <ExternalLink size={10} />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: tokens.colors.text.muted }}>
              {/* 线上存在 "2026-09-11~2026-10-10" 这类区间日期，要完整显示，
                  否则只看到起始日会被误认为单日事项 */}
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} />{task.isRange ? task.dateRaw : task.date}
              </span>
              {dayBadge(task)}
              {/* 学生端不显示"1 人"这种无意义信息 */}
              {!isStudent && (
                <span className="inline-flex items-center gap-1">
                  <Users size={11} />
                  {task.doneCount}/{task.totalCount} 完成
                </span>
              )}
            </div>
          </div>
          {/* 学生端：材料/事件类给一个勾选按钮；老师端：学生标签本身就是勾选入口 */}
          {isStudent ? (
            canToggle(task.source) ? (
              <button type="button"
                onClick={() => toggleTodo(task, task.students[0])}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 flex-shrink-0"
                style={{
                  background: task.allDone
                    ? (isDark ? 'rgba(22,163,74,0.22)' : 'rgba(22,163,74,0.12)')
                    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                  color: task.allDone ? '#16a34a' : tokens.colors.text.secondary,
                }}>
                <Check size={12} />{task.allDone ? '已完成' : '标记完成'}
              </button>
            ) : null
          ) : (
            <div className="flex-shrink-0 max-w-[52%]">{studentChips(task)}</div>
          )}
        </div>
      </div>
    );
  };

  // ─── 主体 ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="glass-panel p-10 text-center rounded-2xl">
        <RefreshCw size={28} className="mx-auto mb-3 animate-spin" style={{ color: tokens.colors.text.muted }} />
        <div className="text-sm" style={{ color: tokens.colors.text.muted }}>正在汇总待办事项…</div>
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

  const kindOptions = [
    { id: 'all', label: '全部' },
    { id: TODO_KINDS.APPLICATION_END, label: '出愿截止' },
    { id: TODO_KINDS.EXAM, label: '考试' },
    { id: TODO_KINDS.MATERIAL, label: '材料' },
    { id: TODO_KINDS.APPLICATION_START, label: '出愿开始' },
    { id: TODO_KINDS.RESULT, label: '合格发表' },
    // 【新需求116 第2项】预约提醒只有学生端会出现，老师端不给这个筛选项
    ...(isStudent ? [{ id: TODO_KINDS.REMINDER, label: '预约提醒' }] : []),
  ];

  // 【新需求111 第1项】关注视野选项。默认 3 天 —— 需求明确"显示最近 3 天"。
  const horizonOptions = [
    { value: 3, label: '最近 3 天' },
    { value: 7, label: '本周' },
    { value: 30, label: '本月' },
    { value: null, label: '全部' },
  ];

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: tokens.colors.text.primary }}>
              <ListChecks size={20} />
              {isStudent ? '我的待办' : '学生待办总览'}
            </h2>
            <p className="text-xs mt-1" style={{ color: tokens.colors.text.muted }}>
              {todayStr()} · {horizon != null ? `聚焦最近 ${horizon} 天 · 今天的事在最上面` : '显示全部待办'}
              {!isStudent && raw?.students ? ` · 覆盖 ${raw.students.length} 名学生` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {user?.role === 'teacher' && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded-lg"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.secondary }}>
                <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="w-3.5 h-3.5" />
                只看我负责的学生
              </label>
            )}
            <button onClick={load} title="刷新"
              className="p-2 rounded-lg transition"
              style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: tokens.colors.text.secondary }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡：今天的事是这页的主角，给唯一的高亮大卡 */}
      <div className="flex gap-3 flex-wrap">
        <div className="glass-panel p-3 rounded-xl flex-1 min-w-[104px]"
          style={{
            boxShadow: `0 0 0 2px ${isDark ? 'rgba(234,88,12,0.55)' : 'rgba(234,88,12,0.40)'}`,
            background: isDark
              ? 'linear-gradient(135deg, rgba(234,88,12,0.16), rgba(234,88,12,0.04))'
              : 'linear-gradient(135deg, rgba(255,247,237,1), rgba(255,255,255,0))',
          }}>
          <div className="text-xs mb-1 flex items-center gap-1 font-semibold" style={{ color: '#ea580c' }}>
            <Zap size={11} />今天要做
          </div>
          <div className="text-3xl font-bold" style={{ color: '#ea580c' }}>{summary.today}</div>
        </div>
        {statCard('明天', summary.tomorrow, '#d97706')}
        {statCard('7 天内', summary.week, '#d97706')}
        {statCard('已逾期', summary.overdue, '#dc2626')}
        {statCard('已完成', summary.done, '#16a34a')}
      </div>

      {/* 筛选栏 */}
      <div className="glass-panel p-3 rounded-xl flex items-center gap-2 flex-wrap">
        {/* 【新需求111 第1项】关注视野切换：默认最近 3 天 */}
        <div className="flex items-center gap-1 flex-wrap">
          <Calendar size={13} style={{ color: tokens.colors.text.muted }} />
          {horizonOptions.map(o => (
            <button key={String(o.value)} onClick={() => setHorizon(o.value)}
              className="px-2 py-1 rounded-md text-xs font-medium transition"
              style={{
                background: horizon === o.value
                  ? (isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.14)')
                  : 'transparent',
                color: horizon === o.value ? (isDark ? '#93c5fd' : '#2563eb') : tokens.colors.text.muted,
              }}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: tokens.colors.text.muted }} />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder={isStudent ? '搜索待办内容' : '搜索待办 / 学生姓名 / 学号'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${tokens.colors.border.subtle}`,
              color: tokens.colors.text.primary,
            }}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={13} style={{ color: tokens.colors.text.muted }} />
          {kindOptions.map(o => (
            <button key={o.id} onClick={() => setKindFilter(o.id)}
              className="px-2 py-1 rounded-md text-xs font-medium transition"
              style={{
                background: kindFilter === o.id
                  ? (isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.14)')
                  : 'transparent',
                color: kindFilter === o.id ? (isDark ? '#93c5fd' : '#2563eb') : tokens.colors.text.muted,
              }}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: tokens.colors.text.secondary }}>
          <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} className="w-3.5 h-3.5" />
          隐藏已完成
        </label>
      </div>

      {/* 待办列表（按时间桶分区） */}
      {buckets.length === 0 ? (
        <div className="glass-panel p-10 text-center rounded-2xl">
          <ListChecks size={36} className="mx-auto mb-3" style={{ color: tokens.colors.text.muted, opacity: 0.5 }} />
          <div className="text-sm" style={{ color: tokens.colors.text.muted }}>
            {tasks.length === 0
              ? (isStudent ? '近期没有待办事项，保持关注老师的安排' : '所选范围内暂无待办事项')
              : (horizon != null && hiddenCount > 0
                ? `最近 ${horizon} 天内没有待办`
                : '没有符合当前筛选条件的待办')}
          </div>
          {/* 视野内为空但视野外还有事时，给一个明确的展开入口 */}
          {horizon != null && hiddenCount > 0 && (
            <button onClick={() => setHorizon(null)}
              className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
              查看全部（还有 {hiddenCount} 项）
            </button>
          )}
        </div>
      ) : (
        <>
          {buckets.map(bucket => {
            // 【新需求112 第2项】侧重点设计：
            //   · 今天 —— 全场唯一的高亮分区（描边 + 渐变底 + 更大标题），视线第一落点
            //   · 已逾期 —— 统一收纳在列表最底部（bucketTodos 的顺序保证），
            //     红色标题仍在但不再抢占首屏
            const isToday = bucket.id === 'today';
            const isOverdue = bucket.id === 'overdue';
            // 【新需求120 第1项】分区折叠
            const isCollapsed = collapsedBuckets.has(bucket.id);
            const reminderCount = bucket.items.filter(t => t.kind === TODO_KINDS.REMINDER).length;
            return (
              <div key={bucket.id}
                className={isToday ? 'glass-panel p-3 rounded-2xl space-y-2' : 'space-y-2'}
                style={isToday ? {
                  boxShadow: `0 0 0 2px ${isDark ? 'rgba(234,88,12,0.50)' : 'rgba(234,88,12,0.35)'}`,
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(234,88,12,0.10), rgba(234,88,12,0.02))'
                    : 'linear-gradient(180deg, rgba(255,247,237,0.9), rgba(255,255,255,0))',
                } : undefined}>
                <button type="button" onClick={() => toggleBucket(bucket.id)}
                  className="w-full flex items-center gap-2 px-1 text-left"
                  title={isCollapsed ? '点击展开' : '点击收起'}>
                  {isCollapsed ? <ChevronRight size={14} style={{ color: tokens.colors.text.muted }} />
                    : <ChevronDown size={14} style={{ color: tokens.colors.text.muted }} />}
                  {isToday && <Zap size={14} style={{ color: '#ea580c' }} />}
                  <span className={`${isToday ? 'text-base' : 'text-sm'} font-bold`} style={{
                    color: isOverdue ? '#dc2626'
                      : isToday ? '#ea580c' : tokens.colors.text.secondary,
                  }}>
                    {isToday ? '今天要做' : bucket.label}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    color: tokens.colors.text.muted,
                  }}>
                    {bucket.items.length}
                  </span>
                  {/* 折叠时若含预约提醒，必须标出来 —— 116/118 的提醒不能被折没 */}
                  {isCollapsed && reminderCount > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                      style={{ background: isDark ? 'rgba(13,148,136,0.20)' : 'rgba(13,148,136,0.12)', color: isDark ? '#2dd4bf' : '#0f766e' }}>
                      <Bell size={10} />含 {reminderCount} 条提醒
                    </span>
                  )}
                  {isOverdue && !isCollapsed && (
                    <span className="text-xs" style={{ color: '#dc2626' }}>
                      已过期但未完成，确认后可就地勾选完成
                    </span>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {bucket.items.map(taskRow)}
                  </div>
                )}
              </div>
            );
          })}
          {/* 【新需求111 第1项】视野已收窄时，底部提示还有多少被折叠的未来待办 */}
          {horizon != null && hiddenCount > 0 && (
            <div className="text-center pt-1">
              <button onClick={() => setHorizon(null)}
                className="text-xs underline" style={{ color: tokens.colors.text.muted }}>
                {horizon} 天之后还有 {hiddenCount} 项待办，点击查看全部
              </button>
            </div>
          )}
        </>
      )}

      {/* 【新需求116 第1项】各学校时间线一览（学生端）。
          主列表按日期聚合且默认聚焦最近 3 天，一所学校的完整日程
          （出愿开始/截止、考试、合格发表、一审/二审、自定义日期）在这里按学校维度看全。
          老师端的需求已由上方"跨学生聚合的待办列表"覆盖，不再重复一个巨大矩阵。 */}
      {isStudent && schoolTimelines.length > 0 && (
        <div className="glass-panel p-4 rounded-2xl space-y-3">
          <button type="button" onClick={() => setTimelineCollapsed(v => !v)}
            className="w-full flex items-center gap-2 flex-wrap text-left"
            title={timelineCollapsed ? '点击展开' : '点击收起'}>
            {timelineCollapsed ? <ChevronRight size={14} style={{ color: tokens.colors.text.muted }} />
              : <ChevronDown size={14} style={{ color: tokens.colors.text.muted }} />}
            <Clock size={15} style={{ color: tokens.colors.text.secondary }} />
            <span className="text-sm font-bold" style={{ color: tokens.colors.text.primary }}>各学校时间线</span>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>
              每所学校的出愿 / 考试 / 发表等全部关键日期（{schoolTimelines.length} 所）
            </span>
          </button>
          {!timelineCollapsed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schoolTimelines.map(st => (
              <div key={st.schoolId}
                className="p-3 rounded-xl space-y-1.5"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  opacity: st.allPast ? 0.55 : 1,
                }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: tokens.colors.text.primary }}>{st.name}</span>
                  {st.program && (
                    <span className="text-[11px]" style={{ color: tokens.colors.text.muted }}>{st.program}</span>
                  )}
                  {st.status && SCHOOL_STATUS_LABELS[st.status] && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded"
                      style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: tokens.colors.text.muted }}>
                      {SCHOOL_STATUS_LABELS[st.status]}
                    </span>
                  )}
                  {!st.allPast && st.nextDaysLeft !== null && (
                    <span className="text-[11px] font-semibold ml-auto" style={{ color: st.nextDaysLeft === 0 ? '#ea580c' : '#d97706' }}>
                      最近：{st.nextDaysLeft === 0 ? '今天' : st.nextDaysLeft === 1 ? '明天' : `${st.nextDaysLeft} 天后`}
                    </span>
                  )}
                  {st.allPast && (
                    <span className="text-[11px] ml-auto" style={{ color: tokens.colors.text.muted }}>日程已全部结束</span>
                  )}
                </div>
                <div className="space-y-1">
                  {st.milestones.map((m, mi) => {
                    const meta = getKindMeta(m.kind);
                    const past = m.daysLeft !== null && m.daysLeft < 0;
                    const isNext = !st.allPast && m.date === st.nextDate;
                    return (
                      <div key={`${m.label}-${m.date}-${mi}`}
                        className="flex items-center gap-2 text-xs px-1.5 py-1 rounded"
                        style={{
                          background: isNext ? (isDark ? 'rgba(234,88,12,0.12)' : 'rgba(234,88,12,0.07)') : 'transparent',
                          opacity: past ? 0.55 : 1,
                        }}>
                        <span className="px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
                          style={{ background: `${meta.color}1f`, color: meta.color, fontSize: 11 }}>
                          {m.label}{m.deadlineType ? `·${m.deadlineType}` : ''}
                        </span>
                        <span style={{ color: tokens.colors.text.secondary }}>
                          {m.isRange ? m.dateRaw : m.date}
                        </span>
                        <span className="ml-auto whitespace-nowrap" style={{ color: past ? tokens.colors.text.muted : (m.daysLeft === 0 ? '#ea580c' : tokens.colors.text.muted), fontWeight: m.daysLeft === 0 ? 700 : 400 }}>
                          {past ? `已过 ${Math.abs(m.daysLeft)} 天`
                            : m.daysLeft === 0 ? '今天'
                            : m.daysLeft === 1 ? '明天'
                            : `${m.daysLeft} 天后`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyTodoPage;
