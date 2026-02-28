/**
 * 共享的默认学校信息库数据
 * 被 SchoolDatabase.jsx 和 UpcomingSchools.jsx 共同使用
 */

export const getDefaultSchools = () => [
  {
    id: 1, name: '東京大学', nameJa: '東京大学', type: '国立', location: '东京都文京区',
    programs: ['工学研究科', '理学研究科', '情报理工学研究科', '经济学研究科', '法学政治学研究科'],
    requirements: '日语N1 + EJU高分 + 校内考', notes: '顶级院校，竞争激烈',
    acceptanceRate: '约10%', difficulty: '★★★★★', ranking: 1,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '秋季入试', applicationStartDate: '2026-07-01', applicationEndDate: '2026-07-31', examDate: '2026-08-25', resultDate: '2026-09-10' },
      { id: 2, label: '春季入试', applicationStartDate: '2026-12-01', applicationEndDate: '2027-01-15', examDate: '2027-02-10', resultDate: '2027-02-28' },
    ],
    requirementsUrl: 'https://www.u-tokyo.ac.jp/ja/admissions/index.html',
  },
  {
    id: 2, name: '京都大学', nameJa: '京都大学', type: '国立', location: '京都府京都市',
    programs: ['情报学研究科', '工学研究科', '理学研究科', '经济学研究科'],
    requirements: '日语N1 + EJU高分 + 研究计划', notes: '自由学风，重视研究能力',
    acceptanceRate: '约12%', difficulty: '★★★★★', ranking: 2,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '一般入试', applicationStartDate: '2026-06-15', applicationEndDate: '2026-07-15', examDate: '2026-08-20', resultDate: '2026-09-05' },
    ],
    requirementsUrl: 'https://www.kyoto-u.ac.jp/ja/admissions',
  },
  {
    id: 3, name: '早稲田大学', nameJa: '早稲田大学', type: '私立', location: '东京都新宿区',
    programs: ['基干理工学研究科', '创造理工学研究科', '商学研究科', '国际交流研究科'],
    requirements: '日语N2以上 + EJU成绩', notes: '知名度高，留学生项目丰富',
    acceptanceRate: '约20%', difficulty: '★★★★', ranking: 5,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '秋季入试', applicationStartDate: '2026-05-01', applicationEndDate: '2026-06-15', examDate: '2026-07-10', resultDate: '2026-07-25' },
      { id: 2, label: '春季入试', applicationStartDate: '2026-10-01', applicationEndDate: '2026-11-15', examDate: '2026-12-10', resultDate: '2026-12-25' },
    ],
    requirementsUrl: 'https://www.waseda.jp/inst/admission/',
  },
  {
    id: 4, name: '大阪大学', nameJa: '大阪大学', type: '国立', location: '大阪府吹田市',
    programs: ['工学研究科', '基础工学研究科', '情报科学研究科', '经济学研究科'],
    requirements: '日语N1 + EJU + 校内考', notes: '关西地区顶级院校，理工科强势',
    acceptanceRate: '约15%', difficulty: '★★★★☆', ranking: 3,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '一般入试', applicationStartDate: '2026-05-15', applicationEndDate: '2026-06-30', examDate: '2026-08-05', resultDate: '2026-08-20' },
    ],
    requirementsUrl: 'https://www.osaka-u.ac.jp/ja/admissions',
  },
  {
    id: 5, name: '東北大学', nameJa: '東北大学', type: '国立', location: '宫城县仙台市',
    programs: ['工学研究科', '情报科学研究科', '理学研究科', '经济学研究科'],
    requirements: '日语N1 + EJU成绩', notes: '旧帝大之一，研究实力雄厚',
    acceptanceRate: '约18%', difficulty: '★★★★', ranking: 4,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '春季入试', applicationStartDate: '2026-03-01', applicationEndDate: '2026-04-15', examDate: '2026-05-20', resultDate: '2026-06-05' },
      { id: 2, label: '秋季入试', applicationStartDate: '2026-08-01', applicationEndDate: '2026-09-15', examDate: '2026-10-15', resultDate: '2026-10-30' },
    ],
    requirementsUrl: '',
  },
  {
    id: 6, name: '慶應義塾大学', nameJa: '慶應義塾大学', type: '私立', location: '东京都港区',
    programs: ['理工学研究科', '商学研究科', '经济学研究科', '政策与媒体研究科'],
    requirements: '日语N2以上 + EJU/英语成绩', notes: '私立双雄之一，校友资源丰富',
    acceptanceRate: '约18%', difficulty: '★★★★', ranking: 6,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '一般入试', applicationStartDate: '2026-06-01', applicationEndDate: '2026-07-10', examDate: '2026-08-15', resultDate: '2026-09-01' },
    ],
    requirementsUrl: 'https://www.keio.ac.jp/ja/admissions/',
  },
  {
    id: 7, name: '名古屋大学', nameJa: '名古屋大学', type: '国立', location: '爱知县名古屋市',
    programs: ['工学研究科', '情报学研究科', '理学研究科', '国际开发研究科'],
    requirements: '日语N1 + EJU成绩', notes: '中部地区最高学府，诺贝尔奖辈出',
    acceptanceRate: '约16%', difficulty: '★★★★', ranking: 7,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '春季入试', applicationStartDate: '2026-04-01', applicationEndDate: '2026-05-15', examDate: '2026-06-20', resultDate: '2026-07-05' },
      { id: 2, label: '秋季入试', applicationStartDate: '2026-10-01', applicationEndDate: '2026-11-15', examDate: '2026-12-15', resultDate: '2027-01-10' },
    ],
    requirementsUrl: '',
  },
  {
    id: 8, name: '九州大学', nameJa: '九州大学', type: '国立', location: '福冈县福冈市',
    programs: ['工学研究科', '系统情报科学研究科', '经济学研究科', '综合理工学研究科'],
    requirements: '日语N2以上 + EJU成绩', notes: '九州地区顶尖院校，国际化程度高',
    acceptanceRate: '约20%', difficulty: '★★★☆', ranking: 8,
    xuexinCert: '是', overseasCert: '是',
    importantDates: [
      { id: 1, label: '春季入试', applicationStartDate: '2026-02-15', applicationEndDate: '2026-03-31', examDate: '2026-04-25', resultDate: '2026-05-10' },
      { id: 2, label: '秋季入试', applicationStartDate: '2026-07-01', applicationEndDate: '2026-08-15', examDate: '2026-09-10', resultDate: '2026-09-25' },
    ],
    requirementsUrl: '',
  },
];

/**
 * 获取学校信息库数据（优先 localStorage，无数据时使用默认并写入）
 */
export const getSchoolDatabase = () => {
  try {
    const saved = localStorage.getItem('schoolDatabase');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  // localStorage 无数据，使用默认数据并写入
  const defaults = getDefaultSchools();
  localStorage.setItem('schoolDatabase', JSON.stringify(defaults));
  return defaults;
};
