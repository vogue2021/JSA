import React, { useState, useEffect } from 'react';
import {
  User, Edit, Save, X, Camera, GraduationCap, School, BookOpen,
  Calendar, FileText, Plus, Trash2, Mail, Clock
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const StudentProfile = ({ student, studentData, onBack, onUpdate }) => {
  const { user, studentList, setStudentList, showNotification } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

  // 根据当前 student prop 获取最新信息
  const studentInfo = studentList.find(s => s.studentId === student.studentId) || student;

  const [formData, setFormData] = useState({
    name: studentInfo.name || '',
    birthday: studentInfo.birthday || '',
    highSchool: studentInfo.highSchool || '',
    languageSchool: studentInfo.languageSchool || '',
    jlptScore: studentInfo.jlptScore || '',
    englishScore: studentInfo.englishScore || '',
    ejuScores: studentInfo.ejuScores || [],
    followUpNotes: studentInfo.followUpNotes || [],
    photo: studentInfo.photo || '',
    email: studentInfo.email || student.email || '',
    targetLevel: studentInfo.targetLevel || student.targetLevel || '修士',
  });

  // 切换学生时重新初始化 formData
  useEffect(() => {
    const info = studentList.find(s => s.studentId === student.studentId) || student;
    setFormData({
      name: info.name || '',
      birthday: info.birthday || '',
      highSchool: info.highSchool || '',
      languageSchool: info.languageSchool || '',
      jlptScore: info.jlptScore || '',
      englishScore: info.englishScore || '',
      ejuScores: info.ejuScores || [],
      followUpNotes: Array.isArray(info.followUpNotes) ? info.followUpNotes : (info.followUpNotes ? [{ id: Date.now(), content: info.followUpNotes, date: new Date().toISOString().split('T')[0], author: '' }] : []),
      photo: info.photo || '',
      email: info.email || student.email || '',
      targetLevel: info.targetLevel || student.targetLevel || '修士',
    });
    setIsEditing(false);
    setActiveSection('basic');
  }, [student.studentId]);

  const [newEjuScore, setNewEjuScore] = useState({
    date: '', totalScore: '', japanese: '', math: '', science: '', generalSubjects: ''
  });

  // 新备注输入
  const [newNote, setNewNote] = useState('');

  const canEdit = user.role === 'teacher' || user.role === 'admin';

  const handleSave = () => {
    setStudentList(prev => prev.map(s =>
      s.studentId === student.studentId ? { ...s, ...formData } : s
    ));
    setIsEditing(false);
    if (showNotification) showNotification('学生信息已保存');
    if (onUpdate) onUpdate({ ...studentInfo, ...formData });
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      const note = {
        id: Date.now(),
        content: newNote.trim(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        author: user.name,
        role: user.role,
      };
      const updatedNotes = [note, ...(formData.followUpNotes || [])];
      setFormData({ ...formData, followUpNotes: updatedNotes });
      setNewNote('');
      // 自动保存备注
      setStudentList(prev => prev.map(s =>
        s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
      ));
      if (showNotification) showNotification('备注已添加');
    }
  };

  const handleDeleteNote = (noteId) => {
    if (window.confirm('确定要删除这条备注吗？')) {
      const updatedNotes = formData.followUpNotes.filter(n => n.id !== noteId);
      setFormData({ ...formData, followUpNotes: updatedNotes });
      setStudentList(prev => prev.map(s =>
        s.studentId === student.studentId ? { ...s, followUpNotes: updatedNotes } : s
      ));
    }
  };

  const handleAddEjuScore = () => {
    if (newEjuScore.date && newEjuScore.totalScore) {
      const updated = [...formData.ejuScores, { ...newEjuScore, id: Date.now() }];
      setFormData({ ...formData, ejuScores: updated });
      setNewEjuScore({ date: '', totalScore: '', japanese: '', math: '', science: '', generalSubjects: '' });
    }
  };

  const handleRemoveEjuScore = (id) => {
    setFormData({ ...formData, ejuScores: formData.ejuScores.filter(s => s.id !== id) });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const schools = studentData?.schools || [];
  const events = studentData?.events || [];
  const checklist = studentData?.checklist || { general: [], schoolSpecific: {} };

  const totalMaterials = (checklist.general?.length || 0) +
    Object.values(checklist.schoolSpecific || {}).reduce((sum, arr) => sum + arr.length, 0);
  const completedMaterials = (checklist.general?.filter(i => i.completed).length || 0) +
    Object.values(checklist.schoolSpecific || {}).reduce((sum, arr) => sum + arr.filter(i => i.completed).length, 0);

  const sections = [
    { id: 'basic', label: '基本信息', icon: User },
    { id: 'scores', label: '成绩记录', icon: BookOpen },
    { id: 'progress', label: '申请进度', icon: School },
    { id: 'notes', label: '跟进备注', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">学生详情</h2>
        {canEdit && !isEditing && (
          <button onClick={() => setIsEditing(true)} className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            <Edit size={16} /> 编辑信息
          </button>
        )}
        {isEditing && (
          <div className="ml-auto flex gap-2">
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
              <Save size={16} /> 保存
            </button>
            <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
              <X size={16} /> 取消
            </button>
          </div>
        )}
      </div>

      {/* 头部个人卡片 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* 照片 */}
          <div className="relative flex-shrink-0">
            {formData.photo ? (
              <img src={formData.photo} alt={formData.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white/30" />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 flex items-center justify-center text-3xl sm:text-4xl border-4 border-white/30">
                {studentInfo.avatar || '👨‍🎓'}
              </div>
            )}
            {isEditing && (
              <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full cursor-pointer shadow-lg">
                <Camera size={16} className="text-gray-600" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-bold">{formData.name || studentInfo.name}</h3>
            <p className="text-blue-100 mt-1">学号: {student.studentId}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-blue-100">
              {formData.email && <span className="flex items-center gap-1"><Mail size={14} /> {formData.email}</span>}
              {formData.targetLevel && <span className="flex items-center gap-1"><GraduationCap size={14} /> 目标: {formData.targetLevel}</span>}
            </div>
          </div>
          {/* 统计数据 */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold">{schools.length}</div>
              <div className="text-xs text-blue-100">志愿学校</div>
            </div>
            <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold">{events.filter(e => !e.completed).length}</div>
              <div className="text-xs text-blue-100">待办事项</div>
            </div>
            <div className="bg-white/20 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xl sm:text-2xl font-bold">{totalMaterials > 0 ? Math.round(completedMaterials / totalMaterials * 100) : 0}%</div>
              <div className="text-xs text-blue-100">材料进度</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {sections.map(sec => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeSection === sec.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={18} />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* Basic Info Section */}
      {activeSection === 'basic' && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><User size={20} /> 基本信息</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoField label="姓名" value={formData.name} editing={isEditing}
              onChange={v => setFormData({...formData, name: v})} />
            <InfoField label="生日" value={formData.birthday} editing={isEditing} type="date"
              onChange={v => setFormData({...formData, birthday: v})} />
            <InfoField label="邮箱" value={formData.email} editing={isEditing} type="email"
              onChange={v => setFormData({...formData, email: v})} />
            <InfoField label="目标学位" value={formData.targetLevel} editing={isEditing} type="select"
              options={['学部', '修士', '博士']}
              onChange={v => setFormData({...formData, targetLevel: v})} />
            <InfoField label="毕业高中" value={formData.highSchool} editing={isEditing}
              placeholder="请输入毕业高中名称"
              onChange={v => setFormData({...formData, highSchool: v})} />
            <InfoField label="在读语言学校" value={formData.languageSchool} editing={isEditing}
              placeholder="请输入语言学校名称"
              onChange={v => setFormData({...formData, languageSchool: v})} />
          </div>
        </div>
      )}

      {/* Scores Section */}
      {activeSection === 'scores' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><BookOpen size={20} /> 语言成绩</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="日语成绩 (JLPT)" value={formData.jlptScore} editing={isEditing}
                placeholder="例: N1 145分"
                onChange={v => setFormData({...formData, jlptScore: v})} />
              <InfoField label="英语成绩" value={formData.englishScore} editing={isEditing}
                placeholder="例: TOEFL 90 / IELTS 6.5"
                onChange={v => setFormData({...formData, englishScore: v})} />
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar size={20} /> EJU 成绩记录
            </h4>

            {formData.ejuScores.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">考试日期</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">总分</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">日语</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">数学</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">理科/综合</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">文综</th>
                      {isEditing && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.ejuScores.map(score => (
                      <tr key={score.id} className="border-t">
                        <td className="px-3 py-2">{score.date}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">{score.totalScore}</td>
                        <td className="px-3 py-2">{score.japanese || '-'}</td>
                        <td className="px-3 py-2">{score.math || '-'}</td>
                        <td className="px-3 py-2">{score.science || '-'}</td>
                        <td className="px-3 py-2">{score.generalSubjects || '-'}</td>
                        {isEditing && (
                          <td className="px-3 py-2">
                            <button onClick={() => handleRemoveEjuScore(score.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {formData.ejuScores.length === 0 && !isEditing && (
              <p className="text-gray-400 text-center py-6">暂无 EJU 成绩记录</p>
            )}

            {isEditing && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-600 mb-3">添加 EJU 成绩</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <input type="date" value={newEjuScore.date}
                    onChange={e => setNewEjuScore({...newEjuScore, date: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="考试日期" />
                  <input type="number" value={newEjuScore.totalScore}
                    onChange={e => setNewEjuScore({...newEjuScore, totalScore: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="总分" />
                  <input type="number" value={newEjuScore.japanese}
                    onChange={e => setNewEjuScore({...newEjuScore, japanese: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="日语" />
                  <input type="number" value={newEjuScore.math}
                    onChange={e => setNewEjuScore({...newEjuScore, math: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="数学" />
                  <input type="number" value={newEjuScore.science}
                    onChange={e => setNewEjuScore({...newEjuScore, science: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="理科" />
                  <input type="number" value={newEjuScore.generalSubjects}
                    onChange={e => setNewEjuScore({...newEjuScore, generalSubjects: e.target.value})}
                    className="px-3 py-2 border rounded-lg text-sm" placeholder="综合科目" />
                </div>
                <button onClick={handleAddEjuScore}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                  <Plus size={16} /> 添加成绩
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Section */}
      {activeSection === 'progress' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><School size={20} /> 申请学校概览</h4>
            {schools.length > 0 ? (
              <div className="space-y-3">
                {schools.map(school => (
                  <div key={school.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div>
                      <div className="font-semibold">{school.name}</div>
                      <div className="text-sm text-gray-500">{school.program} - {school.type}</div>
                    </div>
                    <StatusBadge status={school.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-6">暂无申请学校</p>
            )}
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={20} /> 材料准备进度</h4>
            <div className="space-y-4">
              <ProgressBar
                label="通用材料"
                completed={checklist.general?.filter(i => i.completed).length || 0}
                total={checklist.general?.length || 0}
                color="blue"
              />
              {Object.entries(checklist.schoolSpecific || {}).map(([name, materials]) => (
                <ProgressBar
                  key={name}
                  label={name}
                  completed={materials.filter(i => i.completed).length}
                  total={materials.length}
                  color="green"
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Clock size={20} /> 近期事项</h4>
            {events.filter(e => !e.completed).slice(0, 5).length > 0 ? (
              <div className="space-y-2">
                {events.filter(e => !e.completed).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{event.type === 'exam' ? '📝' : event.type === 'deadline' ? '⏰' : '✉️'}</span>
                      <div>
                        <div className="font-medium text-sm">{event.title}</div>
                        <div className="text-xs text-gray-500">{event.date}</div>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${
                      event.daysLeft <= 7 ? 'text-red-600' : event.daysLeft <= 30 ? 'text-orange-600' : 'text-gray-600'
                    }`}>
                      {event.daysLeft <= 0 ? '已过期' : `${event.daysLeft}天`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-6">暂无待办事项</p>
            )}
          </div>
        </div>
      )}

      {/* Notes Section - 改为按条追加的形式 */}
      {activeSection === 'notes' && (
        <div className="space-y-4">
          {/* 添加新备注 */}
          {canEdit && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
              <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus size={20} /> 添加备注</h4>
              <div className="flex gap-3">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                  placeholder="输入跟进备注内容..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddNote();
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-400">Ctrl/Cmd + Enter 快速提交</span>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
                >
                  <Plus size={16} /> 添加备注
                </button>
              </div>
            </div>
          )}

          {/* 备注列表 */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText size={20} /> 跟进备注
              <span className="text-sm font-normal text-gray-400">
                ({Array.isArray(formData.followUpNotes) ? formData.followUpNotes.length : 0} 条)
              </span>
            </h4>
            {Array.isArray(formData.followUpNotes) && formData.followUpNotes.length > 0 ? (
              <div className="space-y-3">
                {formData.followUpNotes.map(note => (
                  <div key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm">
                          {note.content}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{note.date} {note.time || ''}</span>
                          {note.author && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                              note.role === 'admin' ? 'bg-red-50 text-red-600 border border-red-200' :
                              note.role === 'teacher' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                              'bg-blue-50 text-blue-600 border border-blue-200'
                            }`}>
                              <User size={12} />
                              {note.author}
                              {note.role === 'admin' && ' (管理员)'}
                              {note.role === 'teacher' && ' (老师)'}
                              {note.role === 'student' && ' (学生)'}
                            </span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-12">暂无跟进备注</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoField = ({ label, value, editing, onChange, type = 'text', placeholder, options }) => {
  if (editing) {
    if (type === 'select') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `请输入${label}`}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <div className="text-gray-800 font-medium">{value || '-'}</div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    preparing: { label: '准备中', color: 'bg-blue-100 text-blue-700' },
    contacted: { label: '已联系', color: 'bg-green-100 text-green-700' },
    submitted: { label: '已提交', color: 'bg-purple-100 text-purple-700' },
    admitted: { label: '已合格', color: 'bg-yellow-100 text-yellow-700' },
  };
  const { label, color } = config[status] || { label: '未知', color: 'bg-gray-100 text-gray-700' };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>;
};

const ProgressBar = ({ label, completed, total, color = 'blue' }) => {
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;
  const gradients = {
    blue: 'from-blue-500 to-purple-500',
    green: 'from-green-500 to-blue-500',
  };
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <span className="text-sm font-bold">{completed}/{total} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`bg-gradient-to-r ${gradients[color]} h-2.5 rounded-full transition-all`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default StudentProfile;
