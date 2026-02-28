/**
 * 数据导出工具
 * 支持 Excel(CSV)、PDF、ICS 格式导出
 */

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
    rows.push(['考试日期', '总分', '日语', '数学', '理科', '综合科目']);
    student.ejuScores.forEach(s => {
      rows.push([s.date, s.totalScore, s.japanese || '', s.math || '', s.science || '', s.generalSubjects || '']);
    });
    rows.push(['']);
  }

  const schools = studentData?.schools || [];
  if (schools.length > 0) {
    rows.push(['志愿学校']);
    rows.push(['学校名称', '类型', '研究科', '状态', '出愿开始', '出愿截止', '考试日期', '合格发表']);
    schools.forEach(s => {
      rows.push([s.name, s.type, s.program, getStatusText(s.status),
        s.applicationStartDate, s.applicationEndDate, s.examDate, s.resultDate]);
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
    <span><strong>目标学校数:</strong> ${schools?.length || 0}</span>
  </div>
  ${generalHTML}
  ${schoolHTML}
  <div class="footer">日本留学考学助手 - JSA | 打印时间: ${new Date().toLocaleString('zh-CN')}</div>
</body></html>`;
};

// 时间线事件导出为 ICS 日历格式
export const exportEventsToICS = (events, studentName) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JSA//Japan Study App//CN',
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
  const texts = { preparing: '准备中', applied: '已出愿', submitted: '已提交', admitted: '已合格' };
  return texts[status] || '未知';
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
