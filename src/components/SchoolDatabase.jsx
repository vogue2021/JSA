import React, { useState, useEffect, useRef } from 'react';
import {
  School, Plus, Edit, Trash2, Search, Save, X, ExternalLink,
  BookOpen, MapPin, Award, Globe, ChevronDown, ChevronUp, Upload, Download, FileText, Calendar
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// CSV 格式说明
const CSV_FORMAT_HELP = `CSV文件格式说明：
第一行为表头，字段用逗号分隔。支持的字段：
name（必填）,nameJa,type,location,website,ranking,difficulty,acceptanceRate,requirements,notes,programs,applicationPeriods,applicationStartDate,applicationEndDate,examDate,resultDate,requirementsUrl

其中 programs 和 applicationPeriods 用分号(;)分隔多个值。
示例：
name,nameJa,type,location,ranking,difficulty,programs,applicationPeriods
东京大学,東京大学,国立,东京都文京区,1,极难,工学研究科;理学研究科,秋季(10月-11月);春季(1月-2月)`;

const emptyForm = {
  name: '', nameJa: '', type: '国立', location: '', website: '',
  ranking: '', programs: [], requirements: '', notes: '',
  difficulty: '普通', acceptanceRate: '', applicationPeriods: [],
  applicationStartDate: '', applicationEndDate: '', examDate: '', resultDate: '',
  requirementsUrl: '',
};

const SchoolDatabase = () => {
  const { showNotification } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showCsvHelp, setShowCsvHelp] = useState(false);
  const fileInputRef = useRef(null);

  // 学校信息库数据
  const [schoolDb, setSchoolDb] = useState(() => {
    const saved = localStorage.getItem('schoolDatabase');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 1, name: '东京大学', nameJa: '東京大学', type: '国立', location: '东京都文京区',
        website: 'https://www.u-tokyo.ac.jp/', ranking: 1,
        programs: ['工学研究科', '理学研究科', '情报理工学研究科', '经济学研究科', '法学政治学研究科'],
        requirements: '日语N1 + EJU高分 + 校内考', notes: '顶级院校，竞争激烈',
        difficulty: '极难', acceptanceRate: '约10%',
        applicationPeriods: ['秋季(10月-11月)', '春季(1月-2月)'],
        applicationStartDate: '', applicationEndDate: '', examDate: '', resultDate: '',
        requirementsUrl: 'https://www.u-tokyo.ac.jp/ja/admissions/index.html',
      },
      {
        id: 2, name: '京都大学', nameJa: '京都大学', type: '国立', location: '京都府京都市',
        website: 'https://www.kyoto-u.ac.jp/', ranking: 2,
        programs: ['情报学研究科', '工学研究科', '理学研究科', '经济学研究科'],
        requirements: '日语N1 + EJU高分 + 研究计划', notes: '自由学风，重视研究能力',
        difficulty: '极难', acceptanceRate: '约12%',
        applicationPeriods: ['秋季(9月-10月)'],
        applicationStartDate: '', applicationEndDate: '', examDate: '', resultDate: '',
        requirementsUrl: '',
      },
      {
        id: 3, name: '早稻田大学', nameJa: '早稲田大学', type: '私立', location: '东京都新宿区',
        website: 'https://www.waseda.jp/', ranking: 5,
        programs: ['基干理工学研究科', '创造理工学研究科', '商学研究科', '国际交流研究科'],
        requirements: '日语N2以上 + EJU成绩', notes: '知名度高，留学生项目丰富',
        difficulty: '难', acceptanceRate: '约20%',
        applicationPeriods: ['秋季(9月-10月)', '春季(1月-2月)'],
        applicationStartDate: '', applicationEndDate: '', examDate: '', resultDate: '',
        requirementsUrl: '',
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('schoolDatabase', JSON.stringify(schoolDb));
  }, [schoolDb]);

  const [formData, setFormData] = useState({ ...emptyForm });
  const [newProgram, setNewProgram] = useState('');
  const [newPeriod, setNewPeriod] = useState('');

  const filteredSchools = schoolDb.filter(s => {
    const matchSearch = s.name.includes(searchQuery) || s.nameJa?.includes(searchQuery) || s.location?.includes(searchQuery);
    const matchType = filterType === 'all' || s.type === filterType;
    return matchSearch && matchType;
  });

  const openEdit = (school) => {
    setEditingSchool(school);
    setFormData({ ...emptyForm, ...school });
    setShowAddModal(true);
  };

  const openAdd = () => {
    setEditingSchool(null);
    setFormData({ ...emptyForm });
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!formData.name) return;
    if (editingSchool) {
      setSchoolDb(prev => prev.map(s => s.id === editingSchool.id ? { ...formData, id: editingSchool.id } : s));
      if (showNotification) showNotification('学校信息已更新');
    } else {
      setSchoolDb(prev => [...prev, { ...formData, id: Date.now() }]);
      if (showNotification) showNotification('学校已添加到信息库');
    }
    setShowAddModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('确定要删除这个学校信息吗？')) {
      setSchoolDb(prev => prev.filter(s => s.id !== id));
      if (showNotification) showNotification('学校信息已删除');
    }
  };

  // CSV 解析
  const parseCSV = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      values.push(current.trim());

      const obj = { ...emptyForm, id: Date.now() + i };
      headers.forEach((h, idx) => {
        const val = values[idx] || '';
        if (h === 'programs' || h === 'applicationPeriods') {
          obj[h] = val ? val.split(';').map(v => v.trim()).filter(v => v) : [];
        } else if (h === 'ranking') {
          obj[h] = val ? parseInt(val) || '' : '';
        } else {
          obj[h] = val;
        }
      });
      if (obj.name) results.push(obj);
    }
    return results;
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = parseCSV(evt.target.result);
        if (parsed.length === 0) {
          if (showNotification) showNotification('CSV文件为空或格式不正确');
          return;
        }
        setSchoolDb(prev => [...prev, ...parsed]);
        if (showNotification) showNotification(`成功导入 ${parsed.length} 所学校`);
      } catch (err) {
        if (showNotification) showNotification('CSV解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 导出 CSV 模板
  const downloadTemplate = () => {
    const headers = 'name,nameJa,type,location,website,ranking,difficulty,acceptanceRate,requirements,notes,programs,applicationPeriods,applicationStartDate,applicationEndDate,examDate,resultDate,requirementsUrl';
    const example = '东京大学,東京大学,国立,东京都文京区,https://www.u-tokyo.ac.jp/,1,极难,约10%,日语N1 + EJU高分,顶级院校,工学研究科;理学研究科,秋季(10月-11月);春季(1月-2月),,,,https://www.u-tokyo.ac.jp/ja/admissions/index.html';
    const csv = '\uFEFF' + headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'school_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const getDifficultyColor = (d) => {
    const m = { '极难': 'bg-red-100 text-red-700', '难': 'bg-orange-100 text-orange-700', '普通': 'bg-blue-100 text-blue-700', '容易': 'bg-green-100 text-green-700' };
    return m[d] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">学校信息库</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
            <Download size={14} /> 下载CSV模板
          </button>
          <button onClick={() => setShowCsvHelp(!showCsvHelp)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
            <FileText size={14} /> 格式说明
          </button>
          <label className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm cursor-pointer">
            <Upload size={14} /> 批量导入CSV
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">
            <Plus size={16} /> 录入学校
          </button>
        </div>
      </div>

      {showCsvHelp && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-amber-800">CSV文件格式说明</h4>
            <button onClick={() => setShowCsvHelp(false)} className="p-1 hover:bg-amber-100 rounded"><X size={16} /></button>
          </div>
          <pre className="whitespace-pre-wrap text-amber-700 text-xs">{CSV_FORMAT_HELP}</pre>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="搜索学校名称、地点..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', '国立', '公立', '私立'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filterType === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'all' ? '全部' : t}
            </button>
          ))}
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{schoolDb.length}</div>
          <div className="text-xs text-blue-500">总学校数</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{schoolDb.filter(s => s.type === '国立').length}</div>
          <div className="text-xs text-green-500">国立</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600">{schoolDb.filter(s => s.type === '公立').length}</div>
          <div className="text-xs text-purple-500">公立</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-600">{schoolDb.filter(s => s.type === '私立').length}</div>
          <div className="text-xs text-orange-500">私立</div>
        </div>
      </div>

      {/* 学校列表 */}
      <div className="space-y-4">
        {filteredSchools.map(school => (
          <div key={school.id} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200">
            <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === school.id ? null : school.id)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-bold text-lg">{school.name}</h3>
                    {school.nameJa && <span className="text-sm text-gray-500">{school.nameJa}</span>}
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{school.type}</span>
                    {school.difficulty && <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDifficultyColor(school.difficulty)}`}>{school.difficulty}</span>}
                    {school.ranking && <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">#{school.ranking}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                    {school.location && <span className="flex items-center gap-1"><MapPin size={14} /> {school.location}</span>}
                    {school.acceptanceRate && <span className="flex items-center gap-1"><Award size={14} /> 录取率: {school.acceptanceRate}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); openEdit(school); }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit size={16} /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(school.id); }} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                  {expandedId === school.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>
            </div>
            {expandedId === school.id && (
              <div className="border-t p-4 sm:p-5 bg-gray-50 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-500 mb-2">开设研究科/学部</h5>
                    <div className="flex flex-wrap gap-2">
                      {(school.programs || []).map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{p}</span>
                      ))}
                      {(!school.programs || school.programs.length === 0) && <span className="text-xs text-gray-400">暂无</span>}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-500 mb-2">出愿时间</h5>
                    <div className="flex flex-wrap gap-2">
                      {(school.applicationPeriods || []).map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs">{p}</span>
                      ))}
                      {(!school.applicationPeriods || school.applicationPeriods.length === 0) && <span className="text-xs text-gray-400">暂无</span>}
                    </div>
                  </div>
                </div>
                {/* 重要日期 */}
                {(school.applicationStartDate || school.applicationEndDate || school.examDate || school.resultDate) && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-500 mb-2">重要日期</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {school.applicationStartDate && (
                        <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          <Calendar size={12} /> 出愿开始: {school.applicationStartDate}
                        </div>
                      )}
                      {school.applicationEndDate && (
                        <div className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                          <Calendar size={12} /> 出愿截止: {school.applicationEndDate}
                        </div>
                      )}
                      {school.examDate && (
                        <div className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                          <Calendar size={12} /> 考试日期: {school.examDate}
                        </div>
                      )}
                      {school.resultDate && (
                        <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                          <Calendar size={12} /> 合格发表: {school.resultDate}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {school.requirements && (
                  <div><h5 className="text-sm font-medium text-gray-500 mb-1">申请要求</h5><p className="text-sm text-gray-700">{school.requirements}</p></div>
                )}
                {school.notes && (
                  <div><h5 className="text-sm font-medium text-gray-500 mb-1">备注</h5><p className="text-sm text-gray-700">{school.notes}</p></div>
                )}
                <div className="flex flex-wrap gap-3">
                  {school.website && (
                    <a href={school.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                      <Globe size={14} /> 学校官网 <ExternalLink size={12} />
                    </a>
                  )}
                  {school.requirementsUrl && (
                    <a href={school.requirementsUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700">
                      <FileText size={14} /> 募集要项 <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredSchools.length === 0 && (
          <div className="text-center py-12 text-gray-400"><School size={48} className="mx-auto mb-4 text-gray-300" /><p>暂无学校信息</p></div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg">{editingSchool ? '编辑学校信息' : '录入新学校'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">学校名称 (中文) *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="例: 东京大学" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">学校名称 (日文)</label>
                  <input type="text" value={formData.nameJa} onChange={e => setFormData({...formData, nameJa: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="例: 東京大学" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">学校类型</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="国立">国立</option><option value="公立">公立</option><option value="私立">私立</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">地点</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="例: 东京都文京区" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">排名</label>
                  <input type="number" value={formData.ranking} onChange={e => setFormData({...formData, ranking: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="日本排名" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">难度</label>
                  <select value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="极难">极难</option><option value="难">难</option><option value="普通">普通</option><option value="容易">容易</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">录取率</label>
                  <input type="text" value={formData.acceptanceRate} onChange={e => setFormData({...formData, acceptanceRate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="例: 约10%" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">官网链接</label>
                  <input type="url" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
                </div>
              </div>

              {/* 募集要项URL */}
              <div>
                <label className="block text-sm font-medium mb-1">募集要项URL</label>
                <input type="url" value={formData.requirementsUrl || ''} onChange={e => setFormData({...formData, requirementsUrl: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" placeholder="学校官方招生信息链接" />
              </div>

              {/* 重要日期 */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm text-gray-700 flex items-center gap-2"><Calendar size={16} /> 重要日期</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">出愿开始日期</label>
                    <input type="date" value={formData.applicationStartDate || ''} onChange={e => setFormData({...formData, applicationStartDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">出愿截止日期</label>
                    <input type="date" value={formData.applicationEndDate || ''} onChange={e => setFormData({...formData, applicationEndDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">考试日期</label>
                    <input type="date" value={formData.examDate || ''} onChange={e => setFormData({...formData, examDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">合格发表日期</label>
                    <input type="date" value={formData.resultDate || ''} onChange={e => setFormData({...formData, resultDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>
              </div>

              {/* 研究科 */}
              <div>
                <label className="block text-sm font-medium mb-1">开设研究科/学部</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.programs || []).map((p, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      {p} <button onClick={() => setFormData({...formData, programs: formData.programs.filter((_, idx) => idx !== i)})} className="hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newProgram} onChange={e => setNewProgram(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="输入研究科名称" onKeyDown={e => {
                      if (e.key === 'Enter' && newProgram.trim()) { e.preventDefault(); setFormData({...formData, programs: [...(formData.programs || []), newProgram.trim()]}); setNewProgram(''); }
                    }} />
                  <button type="button" onClick={() => { if (newProgram.trim()) { setFormData({...formData, programs: [...(formData.programs || []), newProgram.trim()]}); setNewProgram(''); }}}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"><Plus size={16} /></button>
                </div>
              </div>

              {/* 出愿时间 */}
              <div>
                <label className="block text-sm font-medium mb-1">出愿时间（文字描述）</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.applicationPeriods || []).map((p, i) => (
                    <span key={i} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs flex items-center gap-1">
                      {p} <button onClick={() => setFormData({...formData, applicationPeriods: formData.applicationPeriods.filter((_, idx) => idx !== i)})} className="hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newPeriod} onChange={e => setNewPeriod(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="例: 秋季(10月-11月)" onKeyDown={e => {
                      if (e.key === 'Enter' && newPeriod.trim()) { e.preventDefault(); setFormData({...formData, applicationPeriods: [...(formData.applicationPeriods || []), newPeriod.trim()]}); setNewPeriod(''); }
                    }} />
                  <button type="button" onClick={() => { if (newPeriod.trim()) { setFormData({...formData, applicationPeriods: [...(formData.applicationPeriods || []), newPeriod.trim()]}); setNewPeriod(''); }}}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"><Plus size={16} /></button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">申请要求</label>
                <textarea value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" rows="2" placeholder="例: 日语N1 + EJU高分 + 校内考" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" rows="2" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-white">
              <button onClick={handleSave} className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-medium">
                {editingSchool ? '保存修改' : '添加学校'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolDatabase;
