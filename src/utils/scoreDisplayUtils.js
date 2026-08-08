//【新需求107】成绩展示口径
//
// 背景：监管台原先只显示"有没有成绩"（✔/无/✘），看不到具体分数 ——
//   监管者想知道"这个学生日语到什么水平了""EJU 够不够报某所学校"，
//   必须点进每个学生的详情页才能看到，效率很低。
//
// 【新需求108 修正】107曾把分数直接铺在监管台单元格里，但这让表格变宽、
//   也削弱了"一眼扫出谁还没录"的核心用途。108 改为：单元格回到「是否录入」，
//   已录入时在对勾旁给一个问号，悬停问号用浮窗按年度展示明细。
//   因此当前的分工是：
//     · groupScoresByYear —— 监管台问号浮窗（界面主用）
//     · formatXxxHistory  —— CSV 导出的「全部记录」列
//     · formatXxxSummary / pickBestXxx —— 摘要口径。界面已不直接使用，
//       但仍通过 getScoreDisplay().summary 对外保留：这是一套完整且有测试覆盖的
//       口径实现，后续若需要在别处（如学生列表、报表）显示"最好成绩"可直接复用。
//       ⚠️ 不要因为"界面没用到"就删掉——删掉等于丢失下面这几条口径判断。
//
// 取值口径（重要，直接影响监管判断）：
//   · JLPT   —— 取**最高级别**（N1 > N2 > … > N5）；同级别内取最高分
//   · EJU    —— 取**总分最高**的一次（总分口径见 calcEjuTotal）
//   · 英语   ——TOEFL/IELTS/TOEIC 分值体系互不可比，**按类型分别取最高分**，不做跨类型比较
//
// 之所以取"最好成绩"而不是"最近成绩"：报考时递交的是最好成绩，监管关心的也是这个。
// 完整历史（含每次考试日期）通过 tooltip 呈现，不丢信息。

/**
 * EJU 总分。
 *【新需求98】的口径，原先内嵌在 StudentProfile 里，
 * 【新需求107】抽到这里以便监管台复用 —— 两处必须完全一致，否则同一个学生在两个页面看到不同总分。
 *   - 日语（不含记述）+ 数学
 *   - 理科：物理 + 化学 + 生物（学生只选2 科，未填按 0 计）
 *   - 文科：文综
 *   - 兼容旧数据：无物理/化学/生物但有 science 字段时，用 science
 */
export function calcEjuTotal(score) {
  if (!score || typeof score !== 'object') return 0;
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const jp = num(score.japanese);
  const math = num(score.math);
  const scienceSum = num(score.physics) + num(score.chemistry) + num(score.biology);
  const legacyScience = num(score.science);
  const general = num(score.generalSubjects);
  const sciencePart = scienceSum > 0 ? scienceSum : legacyScience;
  return jp + math + sciencePart + general;
}

/** 日期显示到月份（EJU / JLPT 都是按月次的考试） */
function toMonth(d) {
  return d ? String(d).slice(0, 7) : '';
}

/**
 * 转数字用于**显示**。
 * 注意与 calcEjuTotal 内部的 num() 区别：
 *   - 这里空字符串 / null / undefined 一律返回 null，表示"未填"
 *     （JS 的 Number('') === 0 是个坑，会让未填分数被显示成 "N2 0"）
 *   - calcEjuTotal 里未填按 0 计，因为总分累加时缺考科目本就是 0 分
 */
function toNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ─── JLPT ────────────────────────────────────────────────────────────────────

/** N1 → 1，N5 → 5；无法识别返回 99（排最后） */
function jlptLevelRank(level) {
  const m = /N\s*([1-5])/i.exec(String(level || ''));
  return m ? Number(m[1]) : 99;
}

/**
 * 取最高级别、同级别取最高分的那一条。
 * @returns {{level: string, score: number|null, date: string}|null}
 */
export function pickBestJlpt(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(s => s && (s.level || s.score));
  if (list.length === 0) return null;
  return list.slice().sort((a, b) => {
    const ra = jlptLevelRank(a.level);
    const rb = jlptLevelRank(b.level);
    if (ra !== rb) return ra - rb;                       // 级别越高（数字越小）越靠前
    return (toNum(b.score) ?? -1) - (toNum(a.score) ?? -1); // 同级别分数高的靠前
  })[0];
}

/** 单元格短文本，如 "N1 160"；只有级别没分数时只显示级别 */
export function formatJlptSummary(scores) {
  const best = pickBestJlpt(scores);
  if (!best) return '';
  const score = toNum(best.score);
  return best.level
    ? (score != null ? `${best.level} ${score}` : String(best.level))
    : (score != null ? String(score) : '');
}

// ─── EJU ─────────────────────────────────────────────────────────────────────

/**
 * 取总分最高的一次。
 * 注意：totalScore 字段在历史数据里可能缺失或过时，这里一律用 calcEjuTotal 实时算，
 * 只在所有科目分都为空时才回退到存量totalScore。
 */
export function pickBestEju(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(Boolean);
  if (list.length === 0) return null;
  const withTotal = list.map(s => {
    const computed = calcEjuTotal(s);
    const total = computed > 0 ? computed : (toNum(s.totalScore) ?? 0);
    return { ...s, _total: total };
  });
  return withTotal.sort((a, b) => b._total - a._total)[0];
}

/** 单元格短文本：总分 + 日语分，如 "690（日 180）" */
export function formatEjuSummary(scores) {
  const best = pickBestEju(scores);
  if (!best) return '';
  const jp = toNum(best.japanese);
  return jp != null ? `${best._total}（日 ${jp}）` : String(best._total);
}

// ─── 英语 ────────────────────────────────────────────────────────────────────

/**
 * 按考试类型分组，每类取最高分。
 * TOEFL 120 分制、IELTS 9 分制、TOEIC 990 分制彼此不可比，绝不能混在一起取最大值。
 * @returns {Array<{type: string, score: number|null, date: string}>} 按分数降序、类型名稳定排序
 */
export function pickBestEnglishByType(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(s => s && (s.type || s.score));
  if (list.length === 0) return [];
  const byType = new Map();
  for (const s of list) {
    const type = String(s.type || '其他');
    const cur = byType.get(type);
    const score = toNum(s.score);
    if (!cur || (score ?? -1) > (toNum(cur.score) ?? -1)) {
      byType.set(type, { type, score: s.score, date: s.date || '' });
    }
  }
  // 同一学生一般只有 1~2 种类型，按类型名排序保证渲染稳定（不因数据顺序抖动）
  return [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * 单元格短文本，如 "TOEFL 95"；有多种类型时显示第一种并追加 "+N"，完整内容看 tooltip。
 */
export function formatEnglishSummary(scores) {
  const list = pickBestEnglishByType(scores);
  if (list.length === 0) return '';
  const head = list[0];
  const text = head.score != null && head.score !== ''
    ? `${head.type} ${head.score}`
    : head.type;
  return list.length > 1 ? `${text} +${list.length - 1}` : text;
}

// ─── 完整历史（tooltip 用）───────────────────────────────────────────────────

/** JLPT 全部历史，按级别→分数排序，每行一条 */
export function formatJlptHistory(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(s => s && (s.level || s.score));
  if (list.length === 0) return '';
  return list.slice()
    .sort((a, b) => jlptLevelRank(a.level) - jlptLevelRank(b.level))
    .map(s => `${toMonth(s.date) || '日期未填'}　${s.level || '级别未填'}　${s.score ?? '-'} 分`)
    .join('\n');
}

/** EJU 全部历史，含各科分项*/
export function formatEjuHistory(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(Boolean);
  if (list.length === 0) return '';
  const parts = [
    ['japanese', '日语'], ['descriptive', '记述'], ['math', '数学'],
    ['physics', '物理'], ['chemistry', '化学'], ['biology', '生物'],
    ['generalSubjects', '文综'], ['science', '理综(旧)'],
  ];
  return list.map(s => {
    const detail = parts
      .filter(([k]) => s[k] !== '' && s[k] != null)
      .map(([k, label]) => `${label} ${s[k]}`)
      .join('　');
    const total = calcEjuTotal(s) > 0 ? calcEjuTotal(s) : (toNum(s.totalScore) ?? 0);
    return `${toMonth(s.date) || '日期未填'}　总分 ${total}${detail ? '\n　' + detail : ''}`;
  }).join('\n');
}

/** 英语全部历史 */
export function formatEnglishHistory(scores) {
  const list = (Array.isArray(scores) ? scores : []).filter(s => s && (s.type || s.score));
  if (list.length === 0) return '';
  return list.slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .map(s => `${s.date || '日期未填'}　${s.type || '类型未填'}　${s.score ?? '-'}`)
    .join('\n');
}

/**
 * 三类成绩统一入口：给定学生对象与成绩类别，返回摘要与历史。
 * @param {object} student 学生对象（驼峰字段）
 * @param {'jlpt'|'eju'|'english'} key
 * @returns {{summary: string, history: string}}
 */
export function getScoreDisplay(student, key) {
  if (!student) return { summary: '', history: '' };
  if (key === 'jlpt') {
    const arr = Array.isArray(student.jlptScores) ? student.jlptScores : [];
    // 兼容只存了旧单值字段 jlptScore（形如 "N1-160"）的历史数据
    if (arr.length === 0 && student.jlptScore) {
      return { summary: String(student.jlptScore).replace('-', ' '), history: String(student.jlptScore) };
    }
    return { summary: formatJlptSummary(arr), history: formatJlptHistory(arr) };
  }
  if (key === 'eju') {
    const arr = Array.isArray(student.ejuScores) ? student.ejuScores : [];
    return { summary: formatEjuSummary(arr), history: formatEjuHistory(arr) };
  }
  const arr = Array.isArray(student.englishScores) ? student.englishScores : [];
  if (arr.length === 0 && student.englishScore) {
    return { summary: String(student.englishScore), history: String(student.englishScore) };
  }
  return { summary: formatEnglishSummary(arr), history: formatEnglishHistory(arr) };
}

// ─── 按年度分组（【新需求108】浮窗展示用）─────────────────────────────────────
//
// 需求108 要求"鼠标悬停显示录入的各年度具体成绩"，所以这里返回**结构化数据**
// 而不是上面那些纯文本 —— 浮窗需要按年度分区渲染，纯字符串没法做分组样式。

const YEAR_UNKNOWN = '年份未填';

/** 从 'YYYY-MM' / 'YYYY-MM-DD' 提取年份；取不到返回占位符 */
function pickYear(date) {
  const m = /^(\d{4})/.exec(String(date || ''));
  return m ? m[1] : YEAR_UNKNOWN;
}

/** 年内的时间标签：有「日」显示 MM-DD，只有月显示 MM 月 */
function pickWhen(date) {
  const s = String(date || '');
  const md = /^\d{4}-(\d{2})-(\d{2})/.exec(s);
  if (md) return `${md[1]}-${md[2]}`;
  const m = /^\d{4}-(\d{2})/.exec(s);
  return m ? `${m[1]}月` : '—';
}

/**把条目数组按年份分组，年份降序（最近的排前面），未填年份排最后 */
function groupByYear(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!map.has(e.year)) map.set(e.year, []);
    map.get(e.year).push(e);
  }
  return [...map.entries()]
    .map(([year, items]) => ({ year, items }))
    .sort((a, b) => {
      if (a.year === YEAR_UNKNOWN) return 1;
      if (b.year === YEAR_UNKNOWN) return -1;
      return b.year.localeCompare(a.year);
    });
}

/**
 * 【新需求108】把某一类成绩整理成"按年度分组"的结构，供浮窗渲染。
 * @param {object} student
 * @param {'jlpt'|'eju'|'english'} key
 * @returns {Array<{year: string, items: Array<{when: string, main: string, detail: string}>}>}
 *   main   = 该次考试的核心结果（级别+分 / 总分 / 类型+分）
 *   detail = 补充信息（目前只有 EJU 的各科分项）
 */
export function groupScoresByYear(student, key) {
  if (!student) return [];

  if (key === 'jlpt') {
    const arr = Array.isArray(student.jlptScores) ? student.jlptScores : [];
    if (arr.length === 0) {
      // 兼容只有旧单值字段的历史数据：年份未知，但分数不该丢
      if (student.jlptScore) {
        return [{ year: YEAR_UNKNOWN, items: [{ when: '—', main: String(student.jlptScore).replace('-', ' '), detail: '' }] }];
      }
      return [];
    }
    const entries = arr
      .filter(s => s && (s.level || s.score))
      .map(s => {
        const score = toNum(s.score);
        return {
          year: pickYear(s.date),
          when: pickWhen(s.date),
          main: s.level
            ? (score != null ? `${s.level} ${score} 分` : String(s.level))
            : (score != null ? `${score} 分` : '—'),
          detail: '',
          _sort: String(s.date || ''),
        };
      })
      // 年内按时间倒序
      .sort((a, b) => b._sort.localeCompare(a._sort));
    return groupByYear(entries);
  }

  if (key === 'eju') {
    const arr = Array.isArray(student.ejuScores) ? student.ejuScores : [];
    const subjects = [
      ['japanese', '日语'], ['descriptive', '记述'], ['math', '数学'],
      ['physics', '物理'], ['chemistry', '化学'], ['biology', '生物'],
      ['generalSubjects', '文综'], ['science', '理综(旧)'],
    ];
    const entries = arr.filter(Boolean).map(s => {
      const computed = calcEjuTotal(s);
      const total = computed > 0 ? computed : (toNum(s.totalScore) ?? 0);
      const detail = subjects
        .filter(([k]) => s[k] !== '' && s[k] != null)
        .map(([k, label]) => `${label} ${s[k]}`)
        .join('　');
      return {
        year: pickYear(s.date),
        when: pickWhen(s.date),
        main: `总分 ${total}`,
        detail,
        _sort: String(s.date || ''),
      };
    }).sort((a, b) => b._sort.localeCompare(a._sort));
    return groupByYear(entries);
  }

  const arr = Array.isArray(student.englishScores) ? student.englishScores : [];
  if (arr.length === 0) {
    if (student.englishScore) {
      return [{ year: YEAR_UNKNOWN, items: [{ when: '—', main: String(student.englishScore), detail: '' }] }];
    }
    return [];
  }
  const entries = arr
    .filter(s => s && (s.type || s.score))
    .map(s => {
      const score = toNum(s.score);
      return {
        year: pickYear(s.date),
        when: pickWhen(s.date),
        main: s.type
          ? (score != null ? `${s.type}　${score}` : String(s.type))
          : (score != null ? String(score) : '—'),
        detail: '',
        _sort: String(s.date || ''),
      };
    })
    .sort((a, b) => b._sort.localeCompare(a._sort));
  return groupByYear(entries);
}
