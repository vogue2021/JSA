/**
 * 数据导出工具
 * 支持 Excel(CSV)、PDF、ICS 格式导出
 */
import { SCHOOL_STATUS_LABELS, EVENT_TYPE_LABELS } from '../constants/schoolProcess';

// 【新需求77-A】学校数去重统计：同一学校的多个学部（併願）算 1 所学校
// 优先使用 nameJa 兜底 name，去掉首尾空白后做集合去重；schools 缺失/空数组返回 0
const countDistinctSchools = (schools) => {
  if (!Array.isArray(schools) || schools.length === 0) return 0;
  const set = new Set();
  schools.forEach(s => {
    if (!s) return;
    const key = String(s.name || s.nameJa || '').trim();
    if (key) set.add(key);
  });
  return set.size;
};

// CSV 导出（兼容 Excel）
export const exportToCSV = (data, filename) => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const csv = BOM + data;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

// 学生信息导出为 CSV/Excel
export const exportStudentToCSV = (student, studentData) => {
  const rows = [];
  rows.push(['学生信息导出', '', '', '']);
  rows.push(['']);
  rows.push(['基本信息']);
  rows.push(['姓名', student.name || '']);
  rows.push(['学号', student.studentId || '']);
  rows.push(['邮箱', student.email || '']);
  rows.push(['生日', student.birthday || '']);
  rows.push(['目标学位', student.targetLevel || '']);
  rows.push(['毕业高中', student.highSchool || '']);
  rows.push(['在读语言学校', student.languageSchool || '']);
  rows.push(['']);

  rows.push(['成绩记录']);
  rows.push(['日语成绩 (JLPT)', student.jlptScore || '']);
  rows.push(['英语成绩', student.englishScore || '']);
  rows.push(['']);

  if (student.ejuScores && student.ejuScores.length > 0) {
    rows.push(['EJU成绩记录']);
    // 【新需求98】理科综合拆分为物理/化学/生物；总分自动计算（日语+数学+文综或理综）
    rows.push(['考试月份', '总分', '日语', '日语记述', '数学', '物理', '化学', '生物', '文综', '理综(旧)']);
    const calcTotal = (s) => {
      const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
      const scienceSum = n(s.physics) + n(s.chemistry) + n(s.biology);
      const sciencePart = scienceSum > 0 ? scienceSum : n(s.science);
      return n(s.japanese) + n(s.math) + sciencePart + n(s.generalSubjects);
    };
    student.ejuScores.forEach(s => {
      const hasNew = s.physics || s.chemistry || s.biology;
      const total = hasNew || s.generalSubjects || s.japanese || s.math ? calcTotal(s) : (s.totalScore ?? calcTotal(s));
      rows.push([
        s.date || '',
        total,
        s.japanese || '',
        s.descriptive || '',
        s.math || '',
        s.physics || '',
        s.chemistry || '',
        s.biology || '',
        s.generalSubjects || '',
        hasNew ? '' : (s.science || ''),
      ]);
    });
    rows.push(['']);
  }

  const schools = studentData?.schools || [];
  if (schools.length > 0) {
    rows.push(['志愿学校']);
    // 【新需求88】导出时新增"出愿截止类型"列（消印 / 必着 / 当面受付）
    rows.push(['学校名称', '类型', '学部/专业', '状态', '出愿开始', '出愿截止', '出愿截止类型', '考试日期', '合格发表']);
    schools.forEach(s => {
      rows.push([s.name, s.type, s.program, getStatusText(s.status),
        s.applicationStartDate, s.applicationEndDate, s.deadlineType || '', s.examDate, s.resultDate]);
    });
    rows.push(['']);
  }

  const checklist = studentData?.checklist || {};
  if (checklist.general && checklist.general.length > 0) {
    rows.push(['通用材料清单']);
    rows.push(['材料名称', '截止日期', '状态', '审核人', '审核日期']);
    checklist.general.forEach(m => {
      rows.push([m.item, m.deadline, m.completed ? '已完成' : '未完成', m.checkedBy || '', m.checkedAt || '']);
    });
    rows.push(['']);
  }

  if (checklist.schoolSpecific) {
    Object.entries(checklist.schoolSpecific).forEach(([schoolName, materials]) => {
      if (materials.length > 0) {
        rows.push([`${schoolName} - 专用材料`]);
        rows.push(['材料名称', '截止日期', '状态', '审核人', '审核日期']);
        materials.forEach(m => {
          rows.push([m.item, m.deadline, m.completed ? '已完成' : '未完成', m.checkedBy || '', m.checkedAt || '']);
        });
        rows.push(['']);
      }
    });
  }

  if (student.followUpNotes) {
    rows.push(['跟进备注']);
    rows.push([student.followUpNotes]);
  }

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  exportToCSV(csv, `学生信息_${student.name}_${student.studentId}`);
};

// 材料清单导出为可打印 HTML/PDF
export const exportChecklistToPDF = (student, checklist, schools) => {
  const html = generateChecklistHTML(student, checklist, schools);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
};

// 时间线（事件）导出为可打印 HTML/PDF
// 需求 61-①：时间线页面原来的"导出材料清单 (PDF)"错误地导出了材料清单内容，
// 这里新增真正导出"时间线事件列表"的函数，供时间线导出菜单调用。
export const exportTimelineToPDF = (student, events, schools) => {
  const html = generateTimelineHTML(student, events, schools);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
};

const generateTimelineHTML = (student, events, schools) => {
  // 按日期升序排序
  const sorted = Array.isArray(events)
    ? [...events].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      })
    : [];

  // 按"category"分组（考试 / 出愿 / 合格发表 / 其他）
  const groups = {};
  sorted.forEach(ev => {
    const key = ev.category || getEventTypeText(ev.type) || '其他';
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });

  const categoryIcon = {
    '考试': '📝',
    '出愿': '📨',
    '合格发表': '🎉',
    '面试': '💬',
    '其他': '📌',
  };

  let groupsHTML = '';
  Object.entries(groups).forEach(([cat, list]) => {
    groupsHTML += `
      <h2>${categoryIcon[cat] || '📌'} ${cat} <span class="count">(${list.length})</span></h2>
      <table>
        <thead>
          <tr>
            <th style="width:110px">日期</th>
            <th>事项</th>
            <th style="width:90px">距今</th>
            <th style="width:70px">状态</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(ev => {
            const daysLeft = Number.isFinite(ev.daysLeft) ? ev.daysLeft : '-';
            const daysText = daysLeft === '-' ? '-' :
              daysLeft === 0 ? '今天' :
              daysLeft > 0 ? `剩 ${daysLeft} 天` : `过期 ${Math.abs(daysLeft)} 天`;
            const daysClass = daysLeft !== '-' && daysLeft <= 7 && daysLeft >= 0 ? 'urgent' : '';
            const status = ev.completed ? '✓ 完成' : (ev.urgent ? '紧急' : '待办');
            const notesHTML = ev.notes ? `<div class="notes">${escapeHTML(ev.notes)}</div>` : '';
            // 【新需求89 子任务3】出愿截止类型独立显示为徽章，避免只藏在标题后缀里容易被忽略
            const dlBadge = ev.deadlineType
              ? `<div class="dl-type">出愿截止类型：${escapeHTML(ev.deadlineType)}</div>`
              : '';
            return `
              <tr class="${ev.completed ? 'done' : ''}">
                <td>${ev.date || '-'}</td>
                <td><strong>${escapeHTML(ev.title || '-')}</strong>${dlBadge}${notesHTML}</td>
                <td class="${daysClass}">${daysText}</td>
                <td>${status}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  });

  if (!groupsHTML) {
    groupsHTML = '<p class="empty">暂无时间线事项</p>';
  }

  return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>考学时间线 - ${student.name}</title>
<style>
  body { font-family: "Microsoft YaHei", "Helvetica Neue", sans-serif; max-width: 860px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { text-align: center; color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 16px; }
  h2 { color: #4b5563; margin-top: 26px; border-left: 4px solid #3b82f6; padding-left: 10px; }
  h2 .count { font-size: 13px; color: #9ca3af; font-weight: normal; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: #f9fafb; padding: 16px; border-radius: 8px; }
  .info span { font-size: 14px; }
  .info strong { color: #374151; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
  tr.done td { color: #9ca3af; text-decoration: line-through; }
  td.urgent { color: #dc2626; font-weight: 600; }
  .notes { font-size: 12px; color: #6b7280; margin-top: 4px; }
  /* 【新需求89 子任务3】出愿截止类型徽章 */
  .dl-type { display: inline-block; margin-top: 4px; padding: 1px 6px; font-size: 11px; color: #b91c1c; background: #fee2e2; border: 1px solid #fecaca; border-radius: 4px; }
  .empty { text-align: center; padding: 40px; color: #9ca3af; }
  .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print { body { padding: 0; } .no-print { display: none; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head><body>
  <h1>考学时间线</h1>
  <div class="info">
    <span><strong>学生姓名:</strong> ${escapeHTML(student.name || '')}</span>
    <span><strong>学号:</strong> ${escapeHTML(String(student.studentId || ''))}</span>
    <span><strong>打印日期:</strong> ${new Date().toLocaleDateString('zh-CN')}</span>
    <span><strong>目标学校数:</strong> ${countDistinctSchools(schools)}</span>
    <span><strong>事件总数:</strong> ${sorted.length}</span>
    <span><strong>未完成:</strong> ${sorted.filter(e => !e.completed).length}</span>
  </div>
  ${groupsHTML}
  <div class="footer">明学义塾升学系统 | 打印时间: ${new Date().toLocaleString('zh-CN')}</div>
</body></html>`;
};

// HTML 转义（防止备注里含 <、& 等字符破坏模板）
const escapeHTML = (s) => {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// 将文本写入剪贴板（navigator.clipboard 优先，降级到 textarea+execCommand）
const writeToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
};

// 需求 61-②-A：时间线页面内容 → 纯文本，方便微信转发
export const copyTimelineToText = async (student, events) => {
  const sorted = Array.isArray(events)
    ? [...events].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      })
    : [];

  const lines = [];
  lines.push(`📅 ${student.name || ''} 的考学时间线`);
  lines.push(`打印日期: ${new Date().toLocaleDateString('zh-CN')}`);
  lines.push(`共 ${sorted.length} 项，未完成 ${sorted.filter(e => !e.completed).length} 项`);
  lines.push('');

  const groups = {};
  sorted.forEach(ev => {
    const key = ev.category || getEventTypeText(ev.type) || '其他';
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });

  const icon = {
    '考试': '📝',
    '出愿': '📨',
    '合格发表': '🎉',
    '面试': '💬',
    '其他': '📌',
  };

  Object.entries(groups).forEach(([cat, list]) => {
    lines.push(`${icon[cat] || '📌'} 【${cat}】`);
    list.forEach(ev => {
      const daysLeft = Number.isFinite(ev.daysLeft) ? ev.daysLeft : null;
      const daysText = daysLeft === null ? '' :
        daysLeft === 0 ? '（今天）' :
        daysLeft > 0 ? `（剩 ${daysLeft} 天）` : `（已过 ${Math.abs(daysLeft)} 天）`;
      const mark = ev.completed ? '✅' : (ev.urgent ? '⚠️' : '•');
      lines.push(`  ${mark} ${ev.date || '待定'} ${ev.title || ''} ${daysText}`);
      // 【新需求89 子任务3】出愿截止类型独立一行，复制到微信后依然明显
      if (ev.deadlineType) lines.push(`      出愿截止类型: ${ev.deadlineType}`);
      if (ev.notes) lines.push(`      备注: ${ev.notes}`);
    });
    lines.push('');
  });

  lines.push('—— 明学义塾升学系统');
  const text = lines.join('\n');
  const ok = await writeToClipboard(text);
  return { ok, text };
};

// 需求 61-②-B：材料清单内容 → 纯文本，方便微信转发
export const copyChecklistToText = async (student, checklist, schools) => {
  const lines = [];
  lines.push(`📋 ${student.name || ''} 的材料准备清单`);
  lines.push(`打印日期: ${new Date().toLocaleDateString('zh-CN')}`);
  // 【新需求77-A】併願多学部 → 仍按 1 所学校计数
  const distinctSchoolCount = countDistinctSchools(schools);
  if (distinctSchoolCount) lines.push(`目标学校数: ${distinctSchoolCount}`);
  lines.push('');

  const renderGroup = (title, items) => {
    lines.push(`【${title}】(${items.filter(i => i.completed).length}/${items.length})`);
    if (!items.length) {
      lines.push('  （无）');
    } else {
      items.forEach(m => {
        const mark = m.completed ? '☑' : '☐';
        const deadline = m.deadline ? ` — 截止 ${m.deadline}` : '';
        lines.push(`  ${mark} ${m.item || m.name || ''}${deadline}`);
      });
    }
    lines.push('');
  };

  if (checklist?.general?.length) {
    renderGroup('通用材料', checklist.general);
  }
  if (checklist?.schoolSpecific) {
    Object.entries(checklist.schoolSpecific).forEach(([name, mats]) => {
      if (mats && mats.length) renderGroup(`${name} - 专用材料`, mats);
    });
  }

  if (lines.length === 4) {
    lines.push('（暂无材料清单内容）');
  }
  lines.push('—— 明学义塾升学系统');
  const text = lines.join('\n');
  const ok = await writeToClipboard(text);
  return { ok, text };
};

const generateChecklistHTML = (student, checklist, schools) => {
  let generalHTML = '';
  if (checklist.general && checklist.general.length > 0) {
    generalHTML = `
      <h2>通用材料</h2>
      <table>
        <thead><tr><th style="width:40px"></th><th>材料名称</th><th>截止日期</th><th>状态</th></tr></thead>
        <tbody>
          ${checklist.general.map(m => `
            <tr>
              <td style="text-align:center">${m.completed ? '☑' : '☐'}</td>
              <td>${m.item}</td>
              <td>${m.deadline || '-'}</td>
              <td>${m.completed ? '已完成' : '未完成'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  let schoolHTML = '';
  if (checklist.schoolSpecific) {
    Object.entries(checklist.schoolSpecific).forEach(([name, materials]) => {
      if (materials.length > 0) {
        schoolHTML += `
          <h2>${name} - 专用材料</h2>
          <table>
            <thead><tr><th style="width:40px"></th><th>材料名称</th><th>截止日期</th><th>状态</th></tr></thead>
            <tbody>
              ${materials.map(m => `
                <tr>
                  <td style="text-align:center">${m.completed ? '☑' : '☐'}</td>
                  <td>${m.item}</td>
                  <td>${m.deadline || '-'}</td>
                  <td>${m.completed ? '已完成' : '未完成'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    });
  }

  return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>材料清单 - ${student.name}</title>
<style>
  body { font-family: "Microsoft YaHei", "Helvetica Neue", sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { text-align: center; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
  h2 { color: #4b5563; margin-top: 24px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: #f9fafb; padding: 16px; border-radius: 8px; }
  .info span { font-size: 14px; }
  .info strong { color: #374151; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 600; }
  .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
  <h1>材料准备清单</h1>
  <div class="info">
    <span><strong>学生姓名:</strong> ${student.name}</span>
    <span><strong>学号:</strong> ${student.studentId}</span>
    <span><strong>打印日期:</strong> ${new Date().toLocaleDateString('zh-CN')}</span>
    <span><strong>目标学校数:</strong> ${countDistinctSchools(schools)}</span>
  </div>
  ${generalHTML}
  ${schoolHTML}
  <div class="footer">明学义塾升学系统 | 打印时间: ${new Date().toLocaleString('zh-CN')}</div>
</body></html>`;
};

// 时间线事件导出为 ICS 日历格式
export const exportEventsToICS = (events, studentName) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MingxueYishu//Academic Pathway App//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${studentName}的考学日程`,
  ];

  events.forEach(event => {
    const dateStr = event.date.replace(/-/g, '');
    const uid = `${event.id}@jsa-app`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${dateStr}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    if (event.notes) lines.push(`DESCRIPTION:${escapeICS(event.notes)}`);
    lines.push(`CATEGORIES:${event.category || event.type}`);
    if (event.urgent) lines.push('PRIORITY:1');
    lines.push(`STATUS:${event.completed ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, `考学日程_${studentName}.ics`);
};

// ICS 字符串转义
const escapeICS = (str) => {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
};

const getStatusText = (status) => {
  return SCHOOL_STATUS_LABELS[status] || '未知';
};

// 事件类型文本（供导出使用）
export const getEventTypeText = (type) => {
  return EVENT_TYPE_LABELS[type] || type || '其他';
};

// 通用下载函数
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
