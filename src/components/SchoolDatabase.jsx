import React, { useState, useEffect, useRef } from 'react';
import {
  School, Plus, Edit, Trash2, Search, Save, X, ExternalLink,
  BookOpen, MapPin, ChevronDown, ChevronUp, Upload, Download, FileText, Calendar, Award
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getDefaultSchools } from '../data/defaultSchools';
import { schoolDatabaseAPI } from '../services/api';

// CSV 格式说明
const CSV_FORMAT_HELP = `CSV文件格式说明：
第一行为表头，字段用逗号分隔。支持的字段：
name（必填）,type,location,acceptanceRate,requirements,notes,programs,xuexinCert,overseasCert,requirementsUrl

其中 programs 用分号(;)分隔多个值。xuexinCert 和 overseasCert 可填：是/否/不确定。
重要日期通过页面录入，CSV暂不支持导入多组日期。
示例：
name,type,location,programs,xuexinCert,overseasCert
東京大学,国立,东京都文京区,工学研究科;理学研究科,是,是`;

const emptyForm = {
  name: '', type: '国立', location: '',
  programs: [], requirements: '', notes: '',
  acceptanceRate: '',
  xuexinCert: '不确定', overseasCert: '不确定',
  importantDates: [], // 支持多组日期（一审、二审等）
  requirementsUrl: '',
  requiredMaterials: [], // 所需材料列表
};

const SchoolDatabase = () => {
  const { showNotification } = useApp();
  const { isDark, tokens, glassEnabled } = useTheme();

  // 玻璃卡片通用样式
  const gcs = glassEnabled ? {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showCsvHelp, setShowCsvHelp] = useState(false);
  const fileInputRef = useRef(null);

  // 学校信息库数据 - 优先从 D1 API 加载，localStorage 作为缓存
  const [schoolDb, setSchoolDb] = useState(() => {
    const saved = localStorage.getItem('schoolDatabase');
    if (saved) return JSON.parse(saved);
    return getDefaultSchools();
  });
  const [dbLoading, setDbLoading] = useState(true);

  // 从 D1 API 加载学校信息库
  useEffect(() => {
    const loadFromAPI = async () => {
      try {
        setDbLoading(true);
        const data = await schoolDatabaseAPI.getAll();
        if (Array.isArray(data)) {
          setSchoolDb(data);
          // 成功时同步到 localStorage 作为缓存
          localStorage.setItem('schoolDatabase', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('从 API 加载学校信息库失败:', err);
        // 加载失败时不回退到 localStorage，保持空状态并提示
        if (showNotification) showNotification('学校信息库加载失败，请检查网络后刷新重试');
      } finally {
        setDbLoading(false);
      }
    };
    loadFromAPI();
  }, []);

  // 同步到 localStorage（缓存）
  useEffect(() => {
    if (!dbLoading) {
      localStorage.setItem('schoolDatabase', JSON.stringify(schoolDb));
    }
  }, [schoolDb, dbLoading]);

  const [formData, setFormData] = useState({ ...emptyForm });
  const [newProgram, setNewProgram] = useState('');
  const [newMaterial, setNewMaterial] = useState('');

  const filteredSchools = schoolDb.filter(s => {
    const matchSearch = s.name.includes(searchQuery) || s.location?.includes(searchQuery);
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

  const handleSave = async () => {
    if (!formData.name) return;
    try {
      if (editingSchool) {
        const updated = await schoolDatabaseAPI.update(editingSchool.id, formData);
        setSchoolDb(prev => prev.map(s => s.id === editingSchool.id ? (updated || { ...formData, id: editingSchool.id }) : s));
        if (showNotification) showNotification('学校信息已更新');
      } else {
        const created = await schoolDatabaseAPI.create(formData);
        setSchoolDb(prev => [...prev, created || { ...formData, id: Date.now() }]);
        if (showNotification) showNotification('学校已添加到信息库');
      }
    } catch (err) {
      console.error('保存学校信息失败:', err);
      if (showNotification) showNotification(`保存失败: ${err.message || '请重试'}`);
      return; // 不降级到本地，避免数据源不一致
    }
    setShowAddModal(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('确定要删除这个学校信息吗？')) {
      try {
        await schoolDatabaseAPI.delete(id);
        setSchoolDb(prev => prev.filter(s => s.id !== id));
        if (showNotification) showNotification('学校信息已删除');
      } catch (err) {
        console.error('API 删除失败:', err);
        if (showNotification) showNotification(`删除失败: ${err.message || '请重试'}`);
      }
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
        if (h === 'programs') {
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
    reader.onload = async (evt) => {
      try {
        const parsed = parseCSV(evt.target.result);
        if (parsed.length === 0) {
          if (showNotification) showNotification('CSV文件为空或格式不正确');
          return;
        }
        // 通过 API 批量导入
        try {
          const result = await schoolDatabaseAPI.batchImport(parsed);
          // 重新从 API 加载
          const data = await schoolDatabaseAPI.getAll();
          if (Array.isArray(data)) setSchoolDb(data);
          const failCount = result?.failed?.length || 0;
          if (showNotification) showNotification(`成功导入 ${result?.count || parsed.length} 所学校${failCount > 0 ? `，${failCount} 条失败` : ''}`);
        } catch (apiErr) {
          console.error('批量导入 API 失败:', apiErr);
          if (showNotification) showNotification(`批量导入失败: ${apiErr.message || '请重试'}`);
        }
      } catch (err) {
        if (showNotification) showNotification('CSV解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 导出 CSV 模板
  const downloadTemplate = () => {
    const headers = 'name,nameJa,type,location,website,ranking,difficulty,acceptanceRate,requirements,notes,programs,xuexinCert,overseasCert,applicationStartDate,applicationEndDate,examDate,resultDate,requirementsUrl';
    const example = '东京大学,東京大学,国立,东京都文京区,https://www.u-tokyo.ac.jp/,1,极难,约10%,日语N1 + EJU高分,顶级院校,工学研究科;理学研究科,是,是,,,,https://www.u-tokyo.ac.jp/ja/admissions/index.html';
    const csv = '\uFEFF' + headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'school_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 标题区域 */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold mb-1" style={{ color: tokens.colors.text.primary }}>学校信息库</h2>
          <p className="text-sm" style={{ color: tokens.colors.text.muted }}>管理和维护学校信息数据库</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-themed-elevated text-themed-primary rounded-lg hover:bg-themed-elevated transition text-sm">
            <Download size={14} /> 下载CSV模板
          </button>
          <button onClick={() => setShowCsvHelp(!showCsvHelp)}
            className="flex items-center gap-2 px-3 py-2 bg-themed-elevated text-themed-primary rounded-lg hover:bg-themed-elevated transition text-sm">
            <FileText size={14} /> 格式说明
          </button>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm cursor-pointer"
            style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            <Upload size={14} /> 批量导入CSV
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
          </label>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm"
            style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)'}>
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
      <div className="glass-panel p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" size={18} />
          <input type="text" placeholder="搜索学校名称、地点..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', '国立', '公立', '私立'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: filterType === t ? tokens.colors.accent.primary : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                color: filterType === t ? tokens.colors.text.inverse : tokens.colors.text.secondary,
                border: filterType === t ? 'none' : `1px solid ${tokens.colors.border.subtle}`,
              }}>
              {t === 'all' ? '全部' : t}
            </button>
          ))}
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }}>
              <School size={18} style={{ color: '#3b82f6' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>总学校数</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schoolDb.length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)' }}>
              <Award size={18} style={{ color: '#22c55e' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>国立</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schoolDb.filter(s => s.type === '国立').length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)' }}>
              <BookOpen size={18} style={{ color: '#a855f7' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>公立</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schoolDb.filter(s => s.type === '公立').length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' }}>
              <MapPin size={18} style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs" style={{ color: tokens.colors.text.muted }}>私立</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: tokens.colors.text.primary }}>{schoolDb.filter(s => s.type === '私立').length}</div>
        </div>
      </div>

      {/* 学校列表 */}
      <div className="space-y-4">
        {filteredSchools.map(school => (
          <div key={school.id} className="glass-panel overflow-hidden">
            <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === school.id ? null : school.id)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-bold text-lg">{school.name}</h3>
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: tokens.colors.text.secondary }}>{school.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-themed-secondary flex-wrap">
                    {school.location && <span className="flex items-center gap-1"><MapPin size={14} /> {school.location}</span>}
                    {school.acceptanceRate && <span className="flex items-center gap-1"><Award size={14} /> 录取率: {school.acceptanceRate}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); openEdit(school); }} className="p-2 hover:bg-themed-elevated rounded-lg"><Edit size={16} /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(school.id); }} className="p-2 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                  {expandedId === school.id ? <ChevronUp size={20} className="text-themed-muted" /> : <ChevronDown size={20} className="text-themed-muted" />}
                </div>
              </div>
            </div>
            {expandedId === school.id && (
              <div className="border-t p-4 sm:p-5 space-y-4 animate-fade-in" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb', borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-themed-secondary mb-2">开设学部</h5>
                    <div className="flex flex-wrap gap-2">
                      {(school.programs || []).map((p, i) => (
                        <span key={i} className="px-3 py-1 rounded-full text-xs" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>{p}</span>
                      ))}
                      {(!school.programs || school.programs.length === 0) && <span className="text-xs text-themed-muted">暂无</span>}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-themed-secondary mb-2">认证需求</h5>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: school.xuexinCert === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)') : school.xuexinCert === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)') : (isDark ? 'rgba(234,179,8,0.12)' : 'rgba(234,179,8,0.08)'), color: school.xuexinCert === '是' ? '#22c55e' : school.xuexinCert === '否' ? '#ef4444' : '#eab308' }}>
                        学信网认证: {school.xuexinCert || '不确定'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: school.overseasCert === '是' ? (isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)') : school.overseasCert === '否' ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)') : (isDark ? 'rgba(234,179,8,0.12)' : 'rgba(234,179,8,0.08)'), color: school.overseasCert === '是' ? '#22c55e' : school.overseasCert === '否' ? '#ef4444' : '#eab308' }}>
                        海外认证: {school.overseasCert || '不确定'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* 重要日期（多组） */}
                {school.importantDates && school.importantDates.length > 0 && school.importantDates.some(d => d.applicationStartDate || d.applicationEndDate || d.examDate || d.resultDate) && (
                  <div>
                    <h5 className="text-sm font-medium text-themed-secondary mb-2">重要日期</h5>
                    {school.importantDates.map((dateGroup, gi) => (
                      (dateGroup.applicationStartDate || dateGroup.applicationEndDate || dateGroup.examDate || dateGroup.resultDate) && (
                        <div key={gi} className="mb-2">
                          <div className="text-xs font-semibold text-themed-secondary mb-1">{dateGroup.label || `第${gi+1}审`}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {dateGroup.applicationStartDate && (
                              <div className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                                <Calendar size={12} /> 出愿开始: {dateGroup.applicationStartDate}
                              </div>
                            )}
                            {dateGroup.applicationEndDate && (
                              <div className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                                <Calendar size={12} /> 出愿截止: {dateGroup.applicationEndDate}
                              </div>
                            )}
                            {dateGroup.examDate && (
                              <div className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)', color: '#f97316' }}>
                                <Calendar size={12} /> 考试日期: {dateGroup.examDate}
                              </div>
                            )}
                            {dateGroup.resultDate && (
                              <div className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', color: '#22c55e' }}>
                                <Calendar size={12} /> 合格发表: {dateGroup.resultDate}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
                {school.requirements && (
                  <div><h5 className="text-sm font-medium text-themed-secondary mb-1">申请要求</h5><p className="text-sm text-themed-primary">{school.requirements}</p></div>
                )}
                {/* 所需材料 */}
                {school.requiredMaterials && school.requiredMaterials.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-themed-secondary mb-2">所需材料</h5>
                    <div className="flex flex-wrap gap-2">
                      {school.requiredMaterials.map((m, i) => (
                        <span key={i} className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
                          <FileText size={12} />{m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {school.notes && (
                  <div><h5 className="text-sm font-medium text-themed-secondary mb-1">备注</h5><p className="text-sm text-themed-primary">{school.notes}</p></div>
                )}
                {school.requirementsUrl && (
                  <div>
                    <a href={school.requirementsUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700">
                      <FileText size={14} /> 募集要项 <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {filteredSchools.length === 0 && (
          <div className="text-center py-12 text-themed-muted"><School size={48} className="mx-auto mb-4 text-themed-muted" /><p>暂无学校信息</p></div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-themed-surface rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-themed-surface z-10">
              <h3 className="font-bold text-lg">{editingSchool ? '编辑学校信息' : '录入新学校'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-themed-elevated rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium mb-1">学校名称*</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
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
                  <label className="block text-sm font-medium mb-1">录取率</label>
                  <input type="text" value={formData.acceptanceRate} onChange={e => setFormData({...formData, acceptanceRate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg" placeholder="例: 约10%" />
                </div>
              </div>

              {/* 募集要项URL */}
              <div>
                <label className="block text-sm font-medium mb-1">募集要项URL</label>
                <input type="url" value={formData.requirementsUrl || ''} onChange={e => setFormData({...formData, requirementsUrl: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" placeholder="学校官方招生信息链接" />
              </div>

              {/* 重要日期（可添加多组，支持一审、二审等） */}
              <div className="p-4 bg-themed-elevated rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-themed-primary flex items-center gap-2"><Calendar size={16} /> 重要日期</h4>
                  <button type="button" onClick={() => {
                    const dates = formData.importantDates || [];
                    const nextLabel = dates.length === 0 ? '一审' : dates.length === 1 ? '二审' : `第${dates.length + 1}审`;
                    setFormData({...formData, importantDates: [...dates, { id: Date.now(), label: nextLabel, applicationStartDate: '', applicationEndDate: '', examDate: '', resultDate: '' }]});
                  }} className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600">
                    <Plus size={14} /> 添加日期组
                  </button>
                </div>
                {(!formData.importantDates || formData.importantDates.length === 0) && (
                  <p className="text-xs text-themed-muted text-center py-2">暂无日期组，点击上方按钮添加（如一审、二审等）</p>
                )}
                {(formData.importantDates || []).map((dateGroup, gi) => (
                  <div key={dateGroup.id || gi} className="p-3 bg-themed-surface rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <input type="text" value={dateGroup.label || ''}
                        onChange={e => {
                          const dates = [...(formData.importantDates || [])];
                          dates[gi] = { ...dates[gi], label: e.target.value };
                          setFormData({...formData, importantDates: dates});
                        }}
                        className="px-2 py-1 border rounded text-sm font-medium w-32" placeholder="例：一审" />
                      <button type="button" onClick={() => {
                        setFormData({...formData, importantDates: (formData.importantDates || []).filter((_, i) => i !== gi)});
                      }} className="p-1 hover:bg-red-50 text-red-500 rounded"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-themed-secondary">出愿开始日期</label>
                        <input type="date" value={dateGroup.applicationStartDate || ''}
                          onChange={e => {
                            const dates = [...(formData.importantDates || [])];
                            dates[gi] = { ...dates[gi], applicationStartDate: e.target.value };
                            setFormData({...formData, importantDates: dates});
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-themed-secondary">出愿截止日期</label>
                        <input type="date" value={dateGroup.applicationEndDate || ''}
                          onChange={e => {
                            const dates = [...(formData.importantDates || [])];
                            dates[gi] = { ...dates[gi], applicationEndDate: e.target.value };
                            setFormData({...formData, importantDates: dates});
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-themed-secondary">考试日期</label>
                        <input type="date" value={dateGroup.examDate || ''}
                          onChange={e => {
                            const dates = [...(formData.importantDates || [])];
                            dates[gi] = { ...dates[gi], examDate: e.target.value };
                            setFormData({...formData, importantDates: dates});
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-themed-secondary">合格发表日期</label>
                        <input type="date" value={dateGroup.resultDate || ''}
                          onChange={e => {
                            const dates = [...(formData.importantDates || [])];
                            dates[gi] = { ...dates[gi], resultDate: e.target.value };
                            setFormData({...formData, importantDates: dates});
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 研究科 */}
              <div>
                <label className="block text-sm font-medium mb-1">开设学部</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.programs || []).map((p, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>
                      {p} <button onClick={() => setFormData({...formData, programs: formData.programs.filter((_, idx) => idx !== i)})} className="hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newProgram} onChange={e => setNewProgram(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="输入学部名称" onKeyDown={e => {
                      if (e.key === 'Enter' && newProgram.trim()) { e.preventDefault(); setFormData({...formData, programs: [...(formData.programs || []), newProgram.trim()]}); setNewProgram(''); }
                    }} />
                  <button type="button" onClick={() => { if (newProgram.trim()) { setFormData({...formData, programs: [...(formData.programs || []), newProgram.trim()]}); setNewProgram(''); }}}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"><Plus size={16} /></button>
                </div>
              </div>

              {/* 认证需求 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">学信网认证</label>
                  <select value={formData.xuexinCert || '不确定'} onChange={e => setFormData({...formData, xuexinCert: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="是">是 ✅</option><option value="否">否 ❌</option><option value="不确定">不确定 ❓</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">海外认证</label>
                  <select value={formData.overseasCert || '不确定'} onChange={e => setFormData({...formData, overseasCert: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                    <option value="是">是 ✅</option><option value="否">否 ❌</option><option value="不确定">不确定 ❓</option>
                  </select>
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

              {/* 所需材料 */}
              <div>
                <label className="block text-sm font-medium mb-1">所需材料</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formData.requiredMaterials || []).map((m, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs flex items-center gap-1" style={{ background: isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
                      {m} <button onClick={() => setFormData({...formData, requiredMaterials: formData.requiredMaterials.filter((_, idx) => idx !== i)})} className="hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newMaterial} onChange={e => setNewMaterial(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="输入所需材料名称（如毕业证明、成绩单等）" onKeyDown={e => {
                      if (e.key === 'Enter' && newMaterial.trim()) { e.preventDefault(); setFormData({...formData, requiredMaterials: [...(formData.requiredMaterials || []), newMaterial.trim()]}); setNewMaterial(''); }
                    }} />
                  <button type="button" onClick={() => { if (newMaterial.trim()) { setFormData({...formData, requiredMaterials: [...(formData.requiredMaterials || []), newMaterial.trim()]}); setNewMaterial(''); }}}
                    className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600"><Plus size={16} /></button>
                </div>
              </div>
            </div>
            <div className="p-6 flex gap-3 sticky bottom-0" style={{ borderTop: `1px solid ${tokens.colors.border.subtle}`, background: tokens.colors.surface.solid }}>
              <button onClick={handleSave} className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 font-medium">
                {editingSchool ? '保存修改' : '添加学校'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg font-medium transition" style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: tokens.colors.text.primary }}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolDatabase;
