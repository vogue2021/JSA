import React, { useState, useEffect } from 'react';
import { Calendar, Clock, School, FileText, CheckSquare, Plus, ChevronRight, AlertCircle, Edit, Users, LogOut, Save, X, User, Shield, UserPlus, ArrowRight } from 'lucide-react';

const JapanStudyApp = () => {
  // 用户角色：'student', 'teacher', 'admin'
  const [userRole, setUserRole] = useState('student');
  const [activeTab, setActiveTab] = useState('timeline');
  const [isEditing, setIsEditing] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showTransferStudent, setShowTransferStudent] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);

  // 当前登录的老师ID（模拟）
  const [currentTeacherId, setCurrentTeacherId] = useState(1);

  // 当前查看的学生
  const [currentStudent, setCurrentStudent] = useState({
    id: 1,
    name: '张三',
    studentId: '2024001',
    targetCountry: '日本',
    targetLevel: '修士',
    email: 'zhangsan@example.com',
    parentEmails: ['parent1@example.com', 'parent2@example.com'],
    teacherId: 1, // 负责的老师ID
    materials: {
      general: [
        { id: 1, name: '毕业证书(日文翻译+公证)', completed: true },
        { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
        { id: 3, name: '护照复印件', completed: false },
        { id: 4, name: 'JLPT成绩单', completed: true }
      ],
      schoolSpecific: {
        '东京大学': [
          { id: 1, name: '志望理由书(800字)', completed: true },
          { id: 2, name: '研究计划书(2000字)', completed: false },
          { id: 3, name: '推荐信(2封,封缄)', completed: false },
          { id: 4, name: '英语成绩(TOEFL/IELTS)', completed: true }
        ],
        '京都大学': [
          { id: 1, name: '志望理由书(600字)', completed: true },
          { id: 2, name: '研究计划书(1500字)', completed: true },
          { id: 3, name: '推荐信(1封)', completed: true },
          { id: 4, name: '英语成绩', completed: false }
        ],
        '早稻田大学': [
          { id: 1, name: '申请表', completed: true },
          { id: 2, name: '研究计划概要', completed: false }
        ]
      }
    }
  });

  // 所有老师数据（admin可见）
  const [teachers] = useState([
    { id: 1, name: '王老师', email: 'wang@example.com', studentCount: 3 },
    { id: 2, name: '李老师', email: 'li@example.com', studentCount: 2 },
    { id: 3, name: '赵老师', email: 'zhao@example.com', studentCount: 4 }
  ]);

  // 所有学生数据（包含不同老师的学生）
  const [allStudents, setAllStudents] = useState([
    {
      id: 1,
      name: '张三',
      studentId: '2024001',
      progress: 65,
      urgentTasks: 2,
      teacherId: 1,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: true },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
          { id: 3, name: '护照复印件', completed: false },
          { id: 4, name: 'JLPT成绩单', completed: true }
        ]
      }
    },
    {
      id: 2,
      name: '李四',
      studentId: '2024002',
      progress: 45,
      urgentTasks: 4,
      teacherId: 1,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: false },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
          { id: 3, name: '护照复印件', completed: true },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ]
      }
    },
    {
      id: 3,
      name: '王五',
      studentId: '2024003',
      progress: 80,
      urgentTasks: 1,
      teacherId: 1,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: true },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: true },
          { id: 3, name: '护照复印件', completed: true },
          { id: 4, name: 'JLPT成绩单', completed: true }
        ]
      }
    },
    {
      id: 4,
      name: '赵六',
      studentId: '2024004',
      progress: 30,
      urgentTasks: 5,
      teacherId: 2,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: false },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: true },
          { id: 3, name: '护照复印件', completed: false },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ]
      }
    },
    {
      id: 5,
      name: '钱七',
      studentId: '2024005',
      progress: 55,
      urgentTasks: 2,
      teacherId: 2,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: true },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: true },
          { id: 3, name: '护照复印件', completed: false },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ]
      }
    }
  ]);

  // 根据权限获取可见的学生列表
  const getVisibleStudents = () => {
    if (userRole === 'admin') {
      return allStudents; // Admin可以看到所有学生
    } else if (userRole === 'teacher') {
      return allStudents.filter(s => s.teacherId === currentTeacherId); // 老师只能看到自己的学生
    } else {
      return []; // 学生看不到学生列表
    }
  };

  const upcomingEvents = [
    { id: 1, type: 'exam', title: 'JLPT N1考试', date: '2025-12-07', daysLeft: 59, category: '日语考试', urgent: false, notes: '需要达到130分以上' },
    { id: 2, type: 'deadline', title: '东京大学出愿截止', date: '2025-11-15', daysLeft: 37, category: '出愿', urgent: true, notes: '记得提前准备材料' },
    { id: 3, type: 'exam', title: 'EJU考试(理科)', date: '2025-11-09', daysLeft: 31, category: '留考', urgent: true, notes: '目标分数700+' },
    { id: 4, type: 'contact', title: '京都大学教授邮件跟进', date: '2025-10-15', daysLeft: 6, category: '研究室联系', urgent: false, notes: '询问研究室招生情况' },
  ];

  // 计算学校材料准备进度
  const calculateSchoolProgress = (schoolName) => {
    const generalMaterials = currentStudent.materials?.general || [];
    const schoolMaterials = currentStudent.materials?.schoolSpecific?.[schoolName] || [];
    const allMaterials = [...generalMaterials, ...schoolMaterials];

    if (allMaterials.length === 0) return { completed: 0, total: 0 };

    const completed = allMaterials.filter(m => m.completed).length;
    return { completed, total: allMaterials.length };
  };

  const [schools, setSchools] = useState(() => {
    return [
      {
        id: 1,
        name: '东京大学',
        type: '国立',
        program: '工学研究科',
        status: 'preparing',
        deadline: '2025-11-15',
        examDate: '2025-12-20',
        teacherNotes: '重点院校，需要JLPT N1和EJU高分'
      },
      {
        id: 2,
        name: '京都大学',
        type: '国立',
        program: '情报学研究科',
        status: 'contacted',
        deadline: '2025-11-20',
        examDate: '2026-01-10',
        teacherNotes: '已联系田中教授，等待回复'
      },
      {
        id: 3,
        name: '早稻田大学',
        type: '私立',
        program: '基干理工学研究科',
        status: 'preparing',
        deadline: '2025-10-31',
        examDate: '2025-11-25',
        teacherNotes: '保底院校，英语成绩要求较低'
      },
    ].map(school => ({
      ...school,
      tasks: calculateSchoolProgress(school.name)
    }));
  });

  // 当材料清单更新时，更新学校的进度
  useEffect(() => {
    setSchools(prevSchools =>
      prevSchools.map(school => ({
        ...school,
        tasks: calculateSchoolProgress(school.name)
      }))
    );
  }, [currentStudent.materials]);

  const getStatusColor = (status) => {
    const colors = {
      preparing: 'bg-blue-100 text-blue-700',
      contacted: 'bg-green-100 text-green-700',
      submitted: 'bg-purple-100 text-purple-700',
      admitted: 'bg-yellow-100 text-yellow-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusText = (status) => {
    const texts = {
      preparing: '准备中',
      contacted: '已联系',
      submitted: '已提交',
      admitted: '已合格',
    };
    return texts[status] || '未开始';
  };

  const getTypeColor = (type) => {
    const colors = {
      exam: 'bg-red-50 border-red-200',
      deadline: 'bg-orange-50 border-orange-200',
      contact: 'bg-blue-50 border-blue-200',
      document: 'bg-green-50 border-green-200',
    };
    return colors[type] || 'bg-gray-50 border-gray-200';
  };

  // 处理材料清单勾选
  const handleMaterialToggle = (materialType, materialId, schoolName = null) => {
    setCurrentStudent(prev => {
      const newStudent = { ...prev };
      if (materialType === 'general') {
        newStudent.materials.general = newStudent.materials.general.map(m =>
          m.id === materialId ? { ...m, completed: !m.completed } : m
        );
      } else if (schoolName && newStudent.materials.schoolSpecific[schoolName]) {
        newStudent.materials.schoolSpecific[schoolName] =
          newStudent.materials.schoolSpecific[schoolName].map(m =>
            m.id === materialId ? { ...m, completed: !m.completed } : m
          );
      }

      // 同步更新allStudents中的数据
      setAllStudents(prevStudents =>
        prevStudents.map(s =>
          s.id === newStudent.id ? { ...s, materials: newStudent.materials } : s
        )
      );

      return newStudent;
    });
  };

  // 添加新学生
  const handleAddStudent = (studentData) => {
    const newStudent = {
      id: Math.max(...allStudents.map(s => s.id)) + 1,
      ...studentData,
      progress: 0,
      urgentTasks: 0,
      teacherId: currentTeacherId,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: false },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
          { id: 3, name: '护照复印件', completed: false },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ],
        schoolSpecific: {}
      }
    };
    setAllStudents(prev => [...prev, newStudent]);
    setShowAddStudent(false);
  };

  // 转移学生给其他老师
  const handleTransferStudent = (studentId, newTeacherId) => {
    setAllStudents(prev =>
      prev.map(s =>
        s.id === studentId ? { ...s, teacherId: newTeacherId } : s
      )
    );
    // 如果转移的是当前学生，切换到其他学生
    if (currentStudent.id === studentId) {
      const remainingStudents = getVisibleStudents().filter(s => s.id !== studentId);
      if (remainingStudents.length > 0) {
        setCurrentStudent(remainingStudents[0]);
      }
    }
    setShowTransferStudent(false);
  };

  // 学生列表弹窗 (老师/Admin专用)
  const StudentListModal = () => {
    const visibleStudents = getVisibleStudents();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">
                {userRole === 'admin' ? '所有学生' : '我的学生'}
              </h3>
              {userRole === 'admin' && (
                <p className="text-sm text-gray-500 mt-1">共 {visibleStudents.length} 名学生</p>
              )}
            </div>
            <button onClick={() => setShowStudentList(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {visibleStudents.map(student => {
              const teacher = teachers.find(t => t.id === student.teacherId);
              return (
                <div
                  key={student.id}
                  onClick={() => {
                    const fullStudent = allStudents.find(s => s.id === student.id);
                    setCurrentStudent({
                      ...fullStudent,
                      targetCountry: '日本',
                      targetLevel: '修士',
                      email: `${fullStudent.name.toLowerCase()}@example.com`,
                      parentEmails: ['parent1@example.com', 'parent2@example.com']
                    });
                    setShowStudentList(false);
                  }}
                  className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">{student.name}</div>
                      <div className="text-sm text-gray-500">{student.studentId}</div>
                      {userRole === 'admin' && teacher && (
                        <div className="text-xs text-blue-600 mt-1">负责老师: {teacher.name}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {student.urgentTasks > 0 && (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                          {student.urgentTasks}个紧急
                        </span>
                      )}
                      {userRole === 'admin' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentStudent(student);
                            setShowTransferStudent(true);
                            setShowStudentList(false);
                          }}
                          className="mt-2 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 block"
                        >
                          转移
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">整体进度</span>
                    <span className="font-semibold">{student.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t">
            <button
              onClick={() => {
                setShowStudentList(false);
                setShowAddStudent(true);
              }}
              className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              添加新学生
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 添加学生弹窗
  const AddStudentModal = () => {
    const [newStudent, setNewStudent] = useState({
      name: '',
      studentId: '',
      email: '',
      targetLevel: '修士'
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="font-bold text-lg mb-4">添加新学生</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学生姓名</label>
              <input
                type="text"
                value={newStudent.name}
                onChange={(e) => setNewStudent(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入学生姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学号</label>
              <input
                type="text"
                value={newStudent.studentId}
                onChange={(e) => setNewStudent(prev => ({ ...prev, studentId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入学号"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="student@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申请层次</label>
              <select
                value={newStudent.targetLevel}
                onChange={(e) => setNewStudent(prev => ({ ...prev, targetLevel: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="学部">学部</option>
                <option value="修士">修士</option>
                <option value="博士">博士</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                if (newStudent.name && newStudent.studentId) {
                  handleAddStudent(newStudent);
                }
              }}
              disabled={!newStudent.name || !newStudent.studentId}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              确认添加
            </button>
            <button
              onClick={() => setShowAddStudent(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 学生转移弹窗
  const TransferStudentModal = () => {
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const availableTeachers = teachers.filter(t => t.id !== currentStudent.teacherId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="font-bold text-lg mb-4">转移学生</h3>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              将 <span className="font-semibold">{currentStudent.name}</span> 转移给其他老师负责
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <label className="block text-sm font-medium text-gray-700">选择接收老师:</label>
            {availableTeachers.map(teacher => (
              <label
                key={teacher.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="teacher"
                  value={teacher.id}
                  onChange={() => setSelectedTeacher(teacher.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium">{teacher.name}</div>
                  <div className="text-sm text-gray-500">
                    {teacher.email} · 负责 {teacher.studentCount} 名学生
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (selectedTeacher) {
                  handleTransferStudent(currentStudent.id, selectedTeacher);
                }
              }}
              disabled={!selectedTeacher}
              className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowRight size={18} />
              确认转移
            </button>
            <button
              onClick={() => setShowTransferStudent(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 编辑表单组件 (老师专用)
  const EditEventForm = ({ event }) => (
    <div className="mt-3 p-3 bg-white border-2 border-blue-300 rounded-lg space-y-2">
      <input 
        type="text" 
        defaultValue={event.title}
        className="w-full px-3 py-2 border rounded-lg"
        placeholder="事项标题"
      />
      <input 
        type="date" 
        defaultValue={event.date}
        className="w-full px-3 py-2 border rounded-lg"
      />
      <textarea 
        defaultValue={event.notes}
        className="w-full px-3 py-2 border rounded-lg"
        placeholder="备注说明"
        rows="2"
      />
      <div className="flex gap-2">
        <button className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 flex items-center justify-center gap-1">
          <Save size={16} />
          保存
        </button>
        <button 
          onClick={() => setIsEditing(false)}
          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-semibold hover:bg-gray-300"
        >
          取消
        </button>
      </div>
    </div>
  );

  // 时间线页面
  const TimelineView = () => (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">考学进度概览</h2>
        <p className="text-blue-100">
          {userRole === 'teacher' || userRole === 'admin'
            ? `正在查看: ${currentStudent.name} (${currentStudent.studentId})`
            : `你有 ${upcomingEvents.filter(e => e.urgent).length} 个紧急事项需要关注`
          }
        </p>
      </div>

      <div className="space-y-3">
        {upcomingEvents.map(event => (
          <div key={event.id} className={`border-2 rounded-lg p-4 ${getTypeColor(event.type)} transition hover:shadow-md`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-1 bg-white rounded">{event.category}</span>
                  {event.urgent && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle size={14} />
                      紧急
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-lg mb-1">{event.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{event.date}</p>
                {event.notes && (
                  <p className="text-sm text-gray-700 bg-white bg-opacity-70 p-2 rounded">
                    📝 {event.notes}
                  </p>
                )}
              </div>
              <div className="text-right ml-3">
                <div className={`text-2xl font-bold ${event.daysLeft <= 10 ? 'text-red-600' : 'text-gray-700'}`}>
                  {event.daysLeft}
                </div>
                <div className="text-xs text-gray-500">天后</div>
                {(userRole === 'teacher' || userRole === 'admin') && (
                  <button className="mt-2 p-1 bg-white rounded hover:bg-gray-100">
                    <Edit size={16} />
                  </button>
                )}
              </div>
            </div>
            {isEditing && (userRole === 'teacher' || userRole === 'admin') && <EditEventForm event={event} />}
          </div>
        ))}
      </div>

      {(userRole === 'teacher' || userRole === 'admin') && (
        <button className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2">
          <Plus size={20} />
          为该学生添加新事项
        </button>
      )}
    </div>
  );

  // 学校管理页面
  const SchoolsView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">志愿学校</h2>
        {(userRole === 'teacher' || userRole === 'admin') && (
          <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition flex items-center gap-2">
            <Plus size={16} />
            添加学校
          </button>
        )}
      </div>

      <div className="space-y-3">
        {schools.map(school => (
          <div key={school.id} className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{school.name}</h3>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{school.type}</span>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(school.status)}`}>
                    {getStatusText(school.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{school.program}</p>
              </div>
              {(userRole === 'teacher' || userRole === 'admin') && (
                <button className="p-1 hover:bg-gray-100 rounded">
                  <Edit size={18} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-orange-50 p-2 rounded">
                <div className="text-xs text-gray-600">出愿截止</div>
                <div className="font-semibold text-sm">{school.deadline}</div>
              </div>
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-xs text-gray-600">考试日期</div>
                <div className="font-semibold text-sm">{school.examDate}</div>
              </div>
            </div>

            {(userRole === 'teacher' || userRole === 'admin') && school.teacherNotes && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <div className="text-xs text-gray-600 mb-1">老师备注:</div>
                <div className="text-gray-700">{school.teacherNotes}</div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">材料准备进度</span>
              <span className="text-sm font-semibold">{school.tasks.completed}/{school.tasks.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${school.tasks.total > 0 ? (school.tasks.completed / school.tasks.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 材料清单页面
  const ChecklistView = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">材料清单</h2>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <FileText size={18} />
          通用材料
        </h3>
        <div className="space-y-2">
          {currentStudent.materials?.general?.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 p-2 rounded ${
                userRole === 'student' ? '' : 'hover:bg-gray-50 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={item.completed}
                disabled={userRole === 'student'}
                onChange={() => {
                  if (userRole !== 'student') {
                    handleMaterialToggle('general', item.id);
                  }
                }}
              />
              <span className={item.completed ? 'line-through text-gray-400' : ''}>
                {item.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {Object.entries(currentStudent.materials?.schoolSpecific || {}).map(([schoolName, materials]) => (
        <div key={schoolName} className="bg-white border-2 border-gray-200 rounded-lg p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <School size={18} />
            {schoolName}专用材料
          </h3>
          <div className="space-y-2">
            {materials.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded ${
                  userRole === 'student' ? '' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={item.completed}
                  disabled={userRole === 'student'}
                  onChange={() => {
                    if (userRole !== 'student') {
                      handleMaterialToggle('schoolSpecific', item.id, schoolName);
                    }
                  }}
                />
                <span className={item.completed ? 'line-through text-gray-400' : ''}>
                  {item.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const tabs = [
    { id: 'timeline', label: '时间线', icon: Clock },
    { id: 'schools', label: '学校', icon: School },
    { id: 'checklist', label: '材料', icon: CheckSquare },
  ];

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-800">日本留学考学助手</h1>
              <p className="text-sm text-gray-500">
                {userRole === 'admin' ? '超级管理员' :
                 userRole === 'teacher' ? '老师管理端' : '学生查看端'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(userRole === 'teacher' || userRole === 'admin') && (
                <button
                  onClick={() => setShowStudentList(true)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  <Users size={20} />
                </button>
              )}
              <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                <User size={20} />
              </button>
            </div>
          </div>

          {/* 角色切换 (仅演示用) */}
          <div className="flex gap-2">
            <button
              onClick={() => setUserRole('student')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                userRole === 'student'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              学生
            </button>
            <button
              onClick={() => setUserRole('teacher')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                userRole === 'teacher'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              老师
            </button>
            <button
              onClick={() => setUserRole('admin')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                userRole === 'admin'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Shield size={16} className="inline mr-1" />
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        {activeTab === 'timeline' && <TimelineView />}
        {activeTab === 'schools' && <SchoolsView />}
        {activeTab === 'checklist' && <ChecklistView />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t max-w-md mx-auto">
        <div className="flex justify-around p-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg flex-1 transition ${
                  isActive
                    ? userRole === 'admin'
                      ? 'text-red-600 bg-red-50'
                      : userRole === 'teacher'
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 弹窗 */}
      {showStudentList && <StudentListModal />}
      {showAddStudent && <AddStudentModal />}
      {showTransferStudent && <TransferStudentModal />}
    </div>
  );
};

export default JapanStudyApp;