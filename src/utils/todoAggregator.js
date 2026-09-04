//【新需求109】每日待办聚合
//
// 需求原话：
//   「学生页面可以看到近期的重要待办事项，比如时间线和材料的截止日期都可以在这个页面确认到。
//     就是一个学生每天都可以知道当天有什么事情要做的功能。
//     老师和管理员的页面也需要有这样一个页面……但是不需要一个学生一个学生的切换，
//     直接显示哪个学生的任务情况，但是比如说如果是学校报名，考试时间的话会有学生重叠，
//     这个时候需要设计一下 UI，一个任务的 UI 设计，需要考虑多个学生的任务。」
//
// 本模块负责把三类来源揉成一份统一的待办列表：
//   1. events    —— 时间线事件（保存学校时已展开的出愿/考试/发表）
//   2. materials —— 材料清单项的 deadline
//   3. schools   —— 学校自身的日期端，用于**补齐 events 里缺的那些**
//
// ⚠️ 为什么必须从 schools 补：App.jsx 保存学校时只把 4 个日期展开成了 events
//   （出愿开始/出愿截止/考试/合格发表），而 `一审/二审考试`、`一审/二审发表`、
//   `customDates`（自定义日期）**从未进入时间线**。如果这个页面只读 events，
//   学生就会漏掉一审二审这类关键日程 —— 那这个功能就失去了意义。
//
// 「同一任务多学生」的处理：老师端按 `任务指纹`（日期 + 任务种类 + 学校 + 标题）分组，
//   同一件事只呈现一行，把涉及的学生聚成数组挂在 students 字段上。

/** 待办种类。顺序即同日内的展示优先级（越前越紧要） */
export const TODO_KINDS = {
  APPLICATION_END: 'application_end',   // 出愿截止 —— 错过即失去报考资格
  EXAM: 'exam',                         // 考试（含一审/二审）
  MATERIAL: 'material',                 // 材料截止
  APPLICATION_START: 'application_start',// 出愿开始
  RESULT: 'result',                     // 合格发表
  OTHER: 'other',                        // 其它自定义事项
};

const KIND_META = {
  [TODO_KINDS.APPLICATION_END]: { label: '出愿截止', color: '#ea580c', weight: 0 },
  [TODO_KINDS.EXAM]: { label: '考试', color: '#2563eb', weight: 1 },
  [TODO_KINDS.MATERIAL]: { label: '材料截止', color: '#7c3aed', weight: 2 },
  [TODO_KINDS.APPLICATION_START]: { label: '出愿开始', color: '#16a34a', weight: 3 },
  [TODO_KINDS.RESULT]: { label: '合格发表', color: '#c026d3', weight: 4 },
  [TODO_KINDS.OTHER]: { label: '待办', color: '#64748b', weight: 5 },
};

export function getKindMeta(kind) {
  return KIND_META[kind] || KIND_META[TODO_KINDS.OTHER];
}

/**
 * 归一为 YYYY-MM-DD；无法解析返回 ''。
 *
 * ⚠️ 线上真实数据里存在**区间格式**的日期，例如 "2026-09-11~2026-10-10"
 *   （学校的考试期/出愿期录入成了一个区间）。这里的前缀正则会取**区间起始日**，
 *   语义上正确（"这件事从哪天开始"就是待办要提醒的时间点），且不会丢条目。
 *   有测试锁定这个行为，不要改成严格全串匹配 —— 那会让这类事项直接消失。
 */
export function normalizeDay(value) {
  if (!value) return '';
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * 原始日期是否为区间（含 ~ 或 ～）。UI 上需要把完整区间显示出来，
 * 否则用户只看到起始日会误以为是单日事项。
 */
export function isDateRange(value) {
  return /[~～]/.test(String(value || ''));
}

/** 本地时区的今天（不要用 toISOString —— 它按 UTC 算，日本时区会差一天） */
export function todayStr(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * 剩余天数（按**日历日**差，不是 24 小时差）。
 * 用 Date.UTC 归一到零点再相减，避免"今天 23:00 看明天的事显示 0 天"这类偏差。
 */
export function daysUntil(dayStr, now = new Date()) {
  const day = normalizeDay(dayStr);
  if (!day) return null;
  const [y, m, d] = day.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - base) / 86400000);
}

/** 事件标题/类别 → 待办种类 */
function classifyEvent(ev) {
  const title = String(ev.title || '');
  const category = String(ev.category || '');
  if (/出愿截止|出願締切/.test(title)) return TODO_KINDS.APPLICATION_END;
  if (/出愿开始|出願開始/.test(title)) return TODO_KINDS.APPLICATION_START;
  if (category === '合格发表' || /合格発表|合格发表|结果发表/.test(title)) return TODO_KINDS.RESULT;
  if (ev.type === 'exam' || category === '考试' || /考试|試験|面接|面试/.test(title)) return TODO_KINDS.EXAM;
  if (category === '出愿') return TODO_KINDS.APPLICATION_END;
  return TODO_KINDS.OTHER;
}

/** 自定义日期标签 → 种类（复用与撞期检测一致的"考试类"判断口径） */
function classifyCustomLabel(label) {
  const s = String(label || '');
  if (/截止|締切|提交|deadline/i.test(s)) return TODO_KINDS.APPLICATION_END;
  if (/考试|試験|面接|面试|一审|二审|審査|筆記|口述/.test(s)) return TODO_KINDS.EXAM;
  if (/发表|発表|结果/.test(s)) return TODO_KINDS.RESULT;
  return TODO_KINDS.OTHER;
}

/**
 * 从事件标题反向提取「出愿截止类型」（消印有効 / 必着 / 当面受付）。
 *
 * 【新需求88/90】这个类型**没有独立的数据库列** —— events 表里根本没落库，
 * 而是把类型拼在标题后缀里（如"早稲田 出愿截止（消印有効）"）。
 * 这与 App.jsx 里 extractDeadlineType 的口径完全一致，此处不能改成读 e.deadline_type
 * （那一列不存在，SELECT 它会直接报 `no such column`）。
 *
 * 只匹配"出愿截止（XXX）"结尾的形式，避免误伤"出愿截止前注意事项"这类自定义标题。
 */
export function extractDeadlineTypeFromTitle(title) {
  if (!title || typeof title !== 'string') return '';
  const m = title.match(/出愿截止[（(]([^）)]+)[）)]\s*$/);
  return m ? m[1].trim() : '';
}

/** 兼容后端下划线与前端驼峰两种字段名 */
function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

/**
 * 把原始数据展开成"每个学生 × 每个日期"的扁平待办项。
 *
 * @param {object} input
 * @param {Array} input.events
 * @param {Array} input.materials
 * @param {Array} input.schools
 * @param {Array} input.students   [{ student_id, name, teacher_id }]
 * @param {Date}  [input.now]
 * @returns {Array} 扁平待办项
 */
export function buildTodoItems({ events = [], materials = [], schools = [], students = [], now = new Date() }) {
  const nameOf = new Map();
  students.forEach(s => {
    const id = pick(s, 'student_id', 'studentId');
    if (id) nameOf.set(String(id), pick(s, 'name') || String(id));
  });
  const studentName = (id) => nameOf.get(String(id)) || String(id || '');

  const items = [];
  const push = (o) => {
    const day = normalizeDay(o.date);
    if (!day) return;
    const left = daysUntil(day, now);
    items.push({
      ...o,
      date: day,
      // 保留原始文本：线上存在 "2026-09-11~2026-10-10" 这类区间，
      // date 只取起始日用于排序/分桶，UI 需要用它显示完整区间
      dateRaw: String(o.date || ''),
      isRange: isDateRange(o.date),
      daysLeft: left,
      overdue: left < 0 && !o.completed,
      studentName: studentName(o.studentId),
    });
  };

  // ─── 1. events ───────────────────────────────────────────────────────────
  // 记录已被 events 覆盖的 (学校, 日期) 组合，供第 3 步去重
  const covered = new Set();
  events.forEach(ev => {
    const studentId = pick(ev, 'student_id', 'studentId');
    const day = normalizeDay(pick(ev, 'date'));
    const schoolId = pick(ev, 'school_id', 'schoolId');
    if (day && schoolId) covered.add(`${schoolId}|${day}`);
    const title = pick(ev, 'title') || '待办事项';
    push({
      source: 'event',
      sourceId: ev.id,
      kind: classifyEvent(ev),
      title,
      date: pick(ev, 'date'),
      studentId,
      schoolId: schoolId || null,
      completed: Boolean(Number(pick(ev, 'completed') || 0)),
      notes: pick(ev, 'notes'),
      // events 表没有 deadline_type 列，类型信息在标题后缀里，从标题提取
      deadlineType: extractDeadlineTypeFromTitle(title),
    });
  });

  // ─── 2. materials ────────────────────────────────────────────────────────
  // 【新需求111 第1项】材料标题原本只有"护照复印件"这类裸名，在跨校聚合的每日待办里
  //   完全分不清是哪所学校的材料。这里用 school_id 反查校名，作为副标题挂在 subtitle 上，
  //   供 UI 展示（不并入 title，以免破坏"同名材料跨学生合并成一行"的指纹口径）。
  const schoolNameById = new Map();
  schools.forEach(sc => {
    const sid = pick(sc, 'id');
    const nm = pick(sc, 'name');
    if (sid && nm) schoolNameById.set(String(sid), nm);
  });
  materials.forEach(m => {
    const schoolId = pick(m, 'school_id', 'schoolId') || null;
    push({
      source: 'material',
      sourceId: m.id,
      kind: TODO_KINDS.MATERIAL,
      title: pick(m, 'item') || '材料',
      subtitle: schoolId ? (schoolNameById.get(String(schoolId)) || '') : '',
      date: pick(m, 'deadline'),
      studentId: pick(m, 'student_id', 'studentId'),
      schoolId,
      completed: Boolean(Number(pick(m, 'completed') || 0)),
      materialType: pick(m, 'type'),
      url: pick(m, 'url'),
    });
  });

  // ─── 3. schools：补齐 events 没覆盖到的日期端 ────────────────────────────
  //   重点是一审/二审与 customDates —— 它们从来没被写进 events。
  schools.forEach(sc => {
    const studentId = pick(sc, 'student_id', 'studentId');
    const schoolId = pick(sc, 'id');
    const schoolName = pick(sc, 'name');
    const extra = (() => {
      const e = sc.extra_dates || sc.extraDates || {};
      if (typeof e === 'string') {
        try { return JSON.parse(e || '{}'); } catch { return {}; }
      }
      return e && typeof e === 'object' ? e : {};
    })();

    const addIfUncovered = (date, kind, label) => {
      const day = normalizeDay(date);
      if (!day) return;
      // 同一学校同一天已有 event → 视为已覆盖，避免重复条目
      if (covered.has(`${schoolId}|${day}`)) return;
      push({
        source: 'school',
        sourceId: `${schoolId}-${kind}-${day}`,
        kind,
        title: `${schoolName} ${label}`,
        date: day,
        studentId,
        schoolId: schoolId || null,
        completed: false,
        schoolStatus: pick(sc, 'status'),
        // 【新需求88】出愿截止类型存在 extra_dates 里（无独立列），
        //   它决定实际寄送时间，只有"出愿截止"这一项需要展示
        deadlineType: kind === TODO_KINDS.APPLICATION_END
          ? (extra.deadlineType || '')
          : '',
      });
    };

    // 主日期端（多数已在 events 里，这里只兜漏）
    addIfUncovered(pick(sc, 'application_start_date', 'applicationStartDate'), TODO_KINDS.APPLICATION_START, '出愿开始');
    addIfUncovered(pick(sc, 'application_end_date', 'applicationEndDate'), TODO_KINDS.APPLICATION_END, '出愿截止');
    addIfUncovered(pick(sc, 'exam_date', 'examDate'), TODO_KINDS.EXAM, '考试');
    addIfUncovered(pick(sc, 'result_date', 'resultDate'), TODO_KINDS.RESULT, '合格发表');
    // 一审 / 二审 —— events 从未展开过这几项
    addIfUncovered(extra.firstExamDate, TODO_KINDS.EXAM, '一审考试');
    addIfUncovered(extra.firstResultDate, TODO_KINDS.RESULT, '一审发表');
    addIfUncovered(extra.secondExamDate, TODO_KINDS.EXAM, '二审考试');
    addIfUncovered(extra.secondResultDate, TODO_KINDS.RESULT, '二审发表');
    // 自定义日期
    (Array.isArray(extra.customDates) ? extra.customDates : []).forEach(cd => {
      if (cd && cd.label && cd.date) {
        addIfUncovered(cd.date, classifyCustomLabel(cd.label), cd.label);
      }
    });
  });

  return items;
}

/**
 * 任务指纹：决定"哪些学生的事项算同一件事"。
 * 同一天 + 同种类 + 同标题 → 合并为一行。
 *
 * ⚠️ **不能把 schoolId 纳入指纹**（最初实现的 bug，用 staging 真实数据才发现）：
 *   每个学生的志愿校是各自独立的一行记录，两个学生报同一所早稻田会有
 *   **不同的 school_id**（实测 32 与 26）。把 schoolId 纳入指纹会导致
 *   "早稻田大学 一审发表" 被拆成两条 —— 而需求要的恰恰是这种情况下合并：
 *   「如果是学校报名，考试时间的话会有学生重叠……一个任务的 UI 设计，
 *     需要考虑多个学生的任务」。
 *
 *   标题里已含学校名（"早稻田大学 一审发表"），所以 (日期 + 种类 + 标题)
 *   足以唯一标识一件事，也天然把不同学校区分开。
 *
 * 为什么必须含标题而不只用 (日期, 种类)：同一天可能有多所学校的出愿截止，
 * 它们是不同的事不能糊在一起；材料按标题分组则能把
 * "10 个学生都要交毕业证明" 正确聚成一条。
 *
 * 【新需求111 第1项】材料还需并入 subtitle（校名）：同一天两所学校都要"护照复印件"，
 *   若只按标题合并会把不同学校的同名材料错误糊成一条。events/school 类的标题里
 *   已含校名，subtitle 为空，指纹与旧版完全一致，不影响既有的跨学生合并行为。
 */
export function todoFingerprint(item) {
  return [item.date, item.kind, item.title, item.subtitle || ''].join('|');
}

/**
 * 按任务指纹分组，输出"一个任务一行、内含多个学生"的结构。
 * @returns {Array<{key, date, kind, title, daysLeft, overdue, students: Array, doneCount, totalCount}>}
 */
export function groupTodosByTask(items) {
  const map = new Map();
  for (const it of items) {
    const key = todoFingerprint(it);
    if (!map.has(key)) {
      map.set(key, {
        key,
        date: it.date,
        // 区间日期的原始文本，UI 用它显示 "2026-09-11~2026-10-10"
        dateRaw: it.dateRaw || it.date,
        isRange: !!it.isRange,
        kind: it.kind,
        title: it.title,
        subtitle: it.subtitle || '',
        daysLeft: it.daysLeft,
        overdue: it.overdue,
        schoolId: it.schoolId,
        source: it.source,
        deadlineType: it.deadlineType || '',
        url: it.url || '',
        students: [],
      });
    }
    const g = map.get(key);
    // 同一学生在同一任务里只出现一次。
    // 实测原因：一个学生可能对同一所学校有**多条志愿校记录**（如早稻田的不同学部，
    // school_id 26 与 27），它们的一审发表日期相同 → 会给同一学生生成两条同名待办。
    // 若不去重，卡片上会出现"刘七, 刘七"这种重复标签，且 N/M 计数虚高。
    const existing = g.students.find(s => String(s.studentId) === String(it.studentId));
    if (existing) {
      // 只要该生在任一条记录里已完成，就视为完成（避免重复记录把进度拉低）
      if (it.completed) existing.completed = true;
    } else {
      g.students.push({
        studentId: it.studentId,
        studentName: it.studentName,
        completed: it.completed,
        sourceId: it.sourceId,
        source: it.source,
      });
    }
    // 只要有一个学生的这项还没完成，整个任务就算未完成（老师需要看到还有谁没做）
    if (!it.completed) g.overdue = g.overdue || it.overdue;
  }

  const groups = [...map.values()];
  groups.forEach(g => {
    g.totalCount = g.students.length;
    g.doneCount = g.students.filter(s => s.completed).length;
    g.allDone = g.totalCount > 0 && g.doneCount === g.totalCount;
    // 学生名按字典序，避免每次渲染顺序抖动
    g.students.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName), 'zh'));
  });
  return sortTodos(groups);
}

/** 排序：日期升序 → 种类权重 → 标题。逾期项始终排最前 */
export function sortTodos(list) {
  return list.slice().sort((a, b) => {
    const ao = a.overdue && !a.allDone ? 0 : 1;
    const bo = b.overdue && !b.allDone ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const aw = getKindMeta(a.kind).weight;
    const bw = getKindMeta(b.kind).weight;
    if (aw !== bw) return aw - bw;
    return String(a.title).localeCompare(String(b.title), 'zh');
  });
}

/** 时间范围分桶。
 * 【新需求112 第2项】展示顺序调整：**今天的任务放最顶部**（每日待办的重点就是当天要做什么），
 *   已逾期未完成的事项统一收纳到**最底部** —— 仍然显示、永不消失（需求109 的教训），
 *   但不再抢占首屏视线。数组顺序即页面渲染顺序。 */
export const TIME_BUCKETS = [
  { id: 'today', label: '今天', match: (d, item) => d === 0 && !(item.overdue && !item.allDone) },
  { id: 'tomorrow', label: '明天', match: (d, item) => d === 1 && !(item.overdue && !item.allDone) },
  { id: 'week', label: '7 天内', match: (d, item) => d >= 2 && d <= 7 && !(item.overdue && !item.allDone) },
  { id: 'month', label: '30 天内', match: (d, item) => d >= 8 && d <= 30 && !(item.overdue && !item.allDone) },
  { id: 'later', label: '更远', match: (d, item) => d > 30 && !(item.overdue && !item.allDone) },
  { id: 'overdue', label: '已逾期', match: (d, item) => item.overdue && !item.allDone },
];

/**
 * 【新需求111 第1项】按"关注视野（horizon）"过滤任务。
 *
 * 需求原话：「每日待办里面显示的应该是最近 3 天的待办，不要一股脑全显示了，
 *   不然没有侧重点。」—— 生产库实测 90 天窗口下管理员有 4800+ 条原始待办，
 *   确实淹没重点。
 *
 * 但**逾期未完成的事绝不能因此消失**（这是【新需求109】用真实故障换来的教训：
 *   待办页最怕的就是"日期过了就从列表里不见了"）。所以过滤规则是：
 *     · 逾期且未完成 → 永远保留，不受 horizon 限制
 *     · 其余 → 只保留 daysLeft 在 [0, horizonDays] 内的
 *
 * horizonDays = null / <0 表示"不限制"（展示全部），供"查看全部"入口使用。
 *
 * @param {Array} tasks         groupTodosByTask 的输出
 * @param {number|null} horizonDays  关注天数，默认 3
 * @returns {Array}
 */
export function filterByHorizon(tasks, horizonDays = 3) {
  if (horizonDays == null || horizonDays < 0) return tasks;
  return tasks.filter(t => {
    if (t.overdue && !t.allDone) return true;       // 逾期未完成：始终保留
    if (t.daysLeft == null) return false;
    return t.daysLeft >= 0 && t.daysLeft <= horizonDays;
  });
}

/**
 * 把任务分到时间桶里。
 * @returns {Array<{id, label, items}>} 只返回非空桶
 */
export function bucketTodos(tasks) {
  const buckets = TIME_BUCKETS.map(b => ({ id: b.id, label: b.label, items: [] }));
  const indexOf = new Map(TIME_BUCKETS.map((b, i) => [b.id, i]));
  for (const t of tasks) {
    const d = t.daysLeft;
    const hit = TIME_BUCKETS.find(b => b.match(d, t));
    const idx = indexOf.get((hit || TIME_BUCKETS[TIME_BUCKETS.length - 1]).id);
    buckets[idx].items.push(t);
  }
  return buckets.filter(b => b.items.length > 0);
}

/** 统计卡数据 */
export function summarizeTodos(tasks) {
  const pending = tasks.filter(t => !t.allDone);
  return {
    total: tasks.length,
    overdue: pending.filter(t => t.overdue).length,
    today: pending.filter(t => t.daysLeft === 0).length,
    // 【新需求112 第2项】统计卡新增"明天"一格
    tomorrow: pending.filter(t => t.daysLeft === 1).length,
    week: pending.filter(t => t.daysLeft >= 0 && t.daysLeft <= 7).length,
    done: tasks.filter(t => t.allDone).length,
  };
}
