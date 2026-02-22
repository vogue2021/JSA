import React, { useState, useEffect } from 'react';
import { Calendar, Clock, School, FileText, CheckSquare, Plus, ChevronRight, AlertCircle, Edit, Users, LogOut, Save, X, User, Shield, UserPlus, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react';

const JapanStudyApp = () => {
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginView, setLoginView] = useState('login'); // 'login', 'register'
  const [currentUser, setCurrentUser] = useState(null);

  // 用户账号数据库
  const [users, setUsers] = useState([
    // 管理员账号
    {
      id: 'admin1',
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      name: '系统管理员',
      email: 'admin@jsa.com'
    },
    // 老师账号
    {
      id: 'teacher1',
      username: 'wang',
      password: 'wang123',
      role: 'teacher',
      teacherId: 1,
      name: '王老师',
      email: 'wang@example.com'
    },
    {
      id: 'teacher2',
      username: 'li',
      password: 'li123',
      role: 'teacher',
      teacherId: 2,
      name: '李老师',
      email: 'li@example.com'
    },
    // 学生账号（已注册）
    {
      id: 'student1',
      username: 'zhangsan',
      password: 'zhang123',
      role: 'student',
      studentId: '2024001',
      name: '张三',
      email: 'zhangsan@example.com'
    }
  ]);

  // 所有老师数据
  const [teachers, setTeachers] = useState([
    { id: 1, name: '王老师', email: 'wang@example.com', username: 'wang' },
    { id: 2, name: '李老师', email: 'li@example.com', username: 'li' },
    { id: 3, name: '赵老师', email: 'zhao@example.com', username: 'zhao' }
  ]);

  // 所有学生数据
  const [allStudents, setAllStudents] = useState([
    {
      id: 1,
      name: '张三',
      studentId: '2024001',
      hasAccount: true, // 是否已注册账号
      targetCountry: '日本',
      targetLevel: '修士',
      email: 'zhangsan@example.com',
      parentEmails: ['parent1@example.com', 'parent2@example.com'],
      progress: 65,
      urgentTasks: 2,
      teacherId: 1,
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
      },
      schools: [
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
        }
      ]
    },
    {
      id: 2,
      name: '李四',
      studentId: '2024002',
      hasAccount: false,
      targetCountry: '日本',
      targetLevel: '学部',
      email: 'lisi@example.com',
      parentEmails: ['parent3@example.com', 'parent4@example.com'],
      progress: 45,
      urgentTasks: 4,
      teacherId: 1,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: false },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
          { id: 3, name: '护照复印件', completed: true },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ],
        schoolSpecific: {}
      },
      schools: []
    }
  ]);

  // UI状态
  const [activeTab, setActiveTab] = useState('timeline');
  const [isEditing, setIsEditing] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showTransferStudent, setShowTransferStudent] = useState(false);

  // 当前查看的学生
  const [currentStudent, setCurrentStudent] = useState(null);

  // 生成学号
  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const existingIds = allStudents.map(s => parseInt(s.studentId));
    const maxId = Math.max(...existingIds, year * 1000);
    return String(maxId + 1);
  };

  // 根据登录用户初始化当前学生
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      if (currentUser.role === 'student') {
        // 学生登录后查看自己的信息
        const student = allStudents.find(s => s.studentId === currentUser.studentId);
        if (student) {
          setCurrentStudent(student);
        }
      } else if (currentUser.role === 'teacher' || currentUser.role === 'admin') {
        // 老师/管理员默认查看第一个学生
        const visibleStudents = getVisibleStudents();
        if (visibleStudents.length > 0) {
          setCurrentStudent(visibleStudents[0]);
        }
      }
    }
  }, [isLoggedIn, currentUser]);

  // 根据权限获取可见的学生列表
  const getVisibleStudents = () => {
    if (!currentUser) return [];

    if (currentUser.role === 'admin') {
      return allStudents;
    } else if (currentUser.role === 'teacher') {
      return allStudents.filter(s => s.teacherId === currentUser.teacherId);
    } else {
      return [];
    }
  };

  // 登录页面组件
  const LoginPage = () => {
    const [loginData, setLoginData] = useState({
      username: '',
      password: ''
    });
    const [registerData, setRegisterData] = useState({
      studentId: '',
      username: '',
      password: '',
      confirmPassword: '',
      email: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // 处理登录
    const handleLogin = () => {
      const user = users.find(u =>
        u.username === loginData.username &&
        u.password === loginData.password
      );

      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        setError('');
      } else {
        setError('用户名或密码错误');
      }
    };

    // 处理学生注册
    const handleRegister = () => {
      // 验证学号
      const student = allStudents.find(s => s.studentId === registerData.studentId);

      if (!student) {
        setError('学号不存在，请联系管理员');
        return;
      }

      if (student.hasAccount) {
        setError('该学号已被注册');
        return;
      }

      // 验证密码
      if (registerData.password !== registerData.confirmPassword) {
        setError('两次密码输入不一致');
        return;
      }

      if (registerData.password.length < 6) {
        setError('密码长度至少6位');
        return;
      }

      // 检查用户名是否已存在
      if (users.find(u => u.username === registerData.username)) {
        setError('用户名已存在');
        return;
      }

      // 创建新用户
      const newUser = {
        id: `student${users.length + 1}`,
        username: registerData.username,
        password: registerData.password,
        role: 'student',
        studentId: registerData.studentId,
        name: student.name,
        email: registerData.email
      };

      setUsers(prev => [...prev, newUser]);

      // 更新学生账号状态
      setAllStudents(prev => prev.map(s =>
        s.studentId === registerData.studentId
          ? { ...s, hasAccount: true, email: registerData.email }
          : s
      ));

      // 自动登录
      setCurrentUser(newUser);
      setIsLoggedIn(true);
      setError('');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <School size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">日本留学考学助手</h1>
            <p className="text-gray-500 mt-2">
              {loginView === 'login' ? '登录您的账号' : '学生注册'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {loginView === 'login' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <div className="relative">
                  <User size={20} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={loginData.username}
                    onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入用户名"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
              >
                登录
              </button>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-600">
                  学生首次登录？
                  <button
                    onClick={() => {
                      setLoginView('register');
                      setError('');
                    }}
                    className="text-blue-500 hover:text-blue-600 font-semibold ml-1"
                  >
                    注册账号
                  </button>
                </p>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
                <p className="font-semibold mb-2">测试账号：</p>
                <p>管理员: admin / admin123</p>
                <p>老师: wang / wang123</p>
                <p>学生: zhangsan / zhang123</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学号</label>
                <input
                  type="text"
                  value={registerData.studentId}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, studentId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入管理员提供的学号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={registerData.username}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="设置登录用户名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="至少6位密码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                <input
                  type="password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="再次输入密码"
                />
              </div>

              <button
                onClick={handleRegister}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
              >
                注册
              </button>

              <div className="text-center pt-2">
                <button
                  onClick={() => {
                    setLoginView('login');
                    setError('');
                  }}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  ← 返回登录
                </button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p>提示：学号由管理员创建学生时自动生成，请联系管理员获取。</p>
                <p className="mt-1">测试学号：2024002（李四，未注册）</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 其他事件和功能
  const upcomingEvents = [
    { id: 1, type: 'exam', title: 'JLPT N1考试', date: '2025-12-07', daysLeft: 59, category: '日语考试', urgent: false, notes: '需要达到130分以上' },
    { id: 2, type: 'deadline', title: '东京大学出愿截止', date: '2025-11-15', daysLeft: 37, category: '出愿', urgent: true, notes: '记得提前准备材料' },
    { id: 3, type: 'exam', title: 'EJU考试(理科)', date: '2025-11-09', daysLeft: 31, category: '留考', urgent: true, notes: '目标分数700+' },
    { id: 4, type: 'contact', title: '京都大学教授邮件跟进', date: '2025-10-15', daysLeft: 6, category: '研究室联系', urgent: false, notes: '询问研究室招生情况' },
  ];

  // 计算学校材料准备进度
  const calculateSchoolProgress = (schoolName) => {
    if (!currentStudent) return { completed: 0, total: 0 };

    const generalMaterials = currentStudent?.materials?.general || [];
    const schoolMaterials = currentStudent?.materials?.schoolSpecific?.[schoolName] || [];
    const allMaterials = [...generalMaterials, ...schoolMaterials];

    if (allMaterials.length === 0) return { completed: 0, total: 0 };

    const completed = allMaterials.filter(m => m.completed).length;
    return { completed, total: allMaterials.length };
  };

  // 获取当前学生的学校列表（带材料进度）
  const getSchoolsWithProgress = () => {
    if (!currentStudent?.schools) return [];

    return currentStudent.schools.map(school => ({
      ...school,
      tasks: calculateSchoolProgress(school.name)
    }));
  };

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
    if (currentUser?.role === 'student') return; // 学生不能修改

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

  // 添加新学生（只有管理员可以）
  const handleAddStudent = (studentData) => {
    if (currentUser?.role !== 'admin') return;

    const newStudentId = generateStudentId();
    const newStudent = {
      id: Math.max(...allStudents.map(s => s.id), 0) + 1,
      ...studentData,
      studentId: newStudentId,
      hasAccount: false,
      targetCountry: '日本',
      progress: 0,
      urgentTasks: 0,
      materials: {
        general: [
          { id: 1, name: '毕业证书(日文翻译+公证)', completed: false },
          { id: 2, name: '成绩单(日文翻译+公证)', completed: false },
          { id: 3, name: '护照复印件', completed: false },
          { id: 4, name: 'JLPT成绩单', completed: false }
        ],
        schoolSpecific: {}
      },
      schools: [],
      parentEmails: []
    };

    setAllStudents(prev => [...prev, newStudent]);
    setShowAddStudent(false);
  };

  // 转移学生给其他老师（只有管理员可以）
  const handleTransferStudent = (studentId, newTeacherId) => {
    if (currentUser?.role !== 'admin') return;

    setAllStudents(prev =>
      prev.map(s =>
        s.id === studentId ? { ...s, teacherId: newTeacherId } : s
      )
    );

    // 如果转移的是当前学生，切换到其他学生
    if (currentStudent?.id === studentId) {
      const remainingStudents = getVisibleStudents().filter(s => s.id !== studentId);
      if (remainingStudents.length > 0) {
        setCurrentStudent(remainingStudents[0]);
      }
    }
    setShowTransferStudent(false);
  };

  // 学生列表弹窗
  const StudentListModal = () => {
    const visibleStudents = getVisibleStudents();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">
                {currentUser?.role === 'admin' ? '所有学生' : '我的学生'}
              </h3>
              {currentUser?.role === 'admin' && (
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
                    setCurrentStudent(student);
                    setShowStudentList(false);
                  }}
                  className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">{student.name}</div>
                      <div className="text-sm text-gray-500">
                        {student.studentId}
                        {!student.hasAccount && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">未注册</span>
                        )}
                      </div>
                      {currentUser?.role === 'admin' && teacher && (
                        <div className="text-xs text-blue-600 mt-1">负责老师: {teacher.name}</div>
                      )}
                    </div>
                    <div className="text-right">
                      {student.urgentTasks > 0 && (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                          {student.urgentTasks}个紧急
                        </span>
                      )}
                      {currentUser?.role === 'admin' && (
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

          {currentUser?.role === 'admin' && (
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
          )}
        </div>
      </div>
    );
  };

  // 添加学生弹窗（仅管理员）
  const AddStudentModal = () => {
    const [newStudent, setNewStudent] = useState({
      name: '',
      email: '',
      targetLevel: '修士',
      teacherId: 1
    });

    const newStudentId = generateStudentId();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="font-bold text-lg mb-4">添加新学生</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学号（自动生成）</label>
              <input
                type="text"
                value={newStudentId}
                disabled
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分配老师</label>
              <select
                value={newStudent.teacherId}
                onChange={(e) => setNewStudent(prev => ({ ...prev, teacherId: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <p>学号 <span className="font-semibold">{newStudentId}</span> 将自动生成。</p>
            <p className="mt-1">学生需要使用此学号进行账号注册。</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                if (newStudent.name) {
                  handleAddStudent(newStudent);
                }
              }}
              disabled={!newStudent.name}
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
    const availableTeachers = teachers.filter(t => t.id !== currentStudent?.teacherId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h3 className="font-bold text-lg mb-4">转移学生</h3>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              将 <span className="font-semibold">{currentStudent?.name}</span> 转移给其他老师负责
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
                  <div className="text-sm text-gray-500">{teacher.email}</div>
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

  // 主应用界面
  const MainApp = () => {
    // 时间线页面
    const TimelineView = () => (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">考学进度概览</h2>
          <p className="text-blue-100">
            {currentUser?.role === 'teacher' || currentUser?.role === 'admin'
              ? `正在查看: ${currentStudent?.name} (${currentStudent?.studentId})`
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
                      {event.notes}
                    </p>
                  )}
                </div>
                <div className="text-right ml-3">
                  <div className={`text-2xl font-bold ${event.daysLeft <= 10 ? 'text-red-600' : 'text-gray-700'}`}>
                    {event.daysLeft}
                  </div>
                  <div className="text-xs text-gray-500">天后</div>
                  {currentUser?.role !== 'student' && (
                    <button className="mt-2 p-1 bg-white rounded hover:bg-gray-100">
                      <Edit size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentUser?.role !== 'student' && (
          <button className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2">
            <Plus size={20} />
            为该学生添加新事项
          </button>
        )}
      </div>
    );

    // 学校管理页面
    const SchoolsView = () => {
      const schools = getSchoolsWithProgress();

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">志愿学校</h2>
            {currentUser?.role !== 'student' && (
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
                  {currentUser?.role !== 'student' && (
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

                {currentUser?.role !== 'student' && school.teacherNotes && (
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
    };

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
            {currentStudent?.materials?.general?.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded ${
                  currentUser?.role === 'student' ? '' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={item.completed}
                  disabled={currentUser?.role === 'student'}
                  onChange={() => {
                    if (currentUser?.role !== 'student') {
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

        {Object.entries(currentStudent?.materials?.schoolSpecific || {}).map(([schoolName, materials]) => (
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
                    currentUser?.role === 'student' ? '' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={item.completed}
                    disabled={currentUser?.role === 'student'}
                    onChange={() => {
                      if (currentUser?.role !== 'student') {
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
                  {currentUser?.role === 'admin' ? '超级管理员' :
                   currentUser?.role === 'teacher' ? `${currentUser.name}` :
                   `${currentUser?.name} (${currentUser?.studentId})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentUser?.role !== 'student' && (
                  <button
                    onClick={() => setShowStudentList(true)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    <Users size={20} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsLoggedIn(false);
                    setCurrentUser(null);
                    setCurrentStudent(null);
                  }}
                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  title="退出登录"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>

            {currentUser?.role === 'student' && currentStudent && (
              <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                负责老师: {teachers.find(t => t.id === currentStudent.teacherId)?.name || '未分配'}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pb-24">
          {!currentStudent ? (
            <div className="text-center py-12 text-gray-500">
              <p>暂无学生信息</p>
            </div>
          ) : (
            <>
              {activeTab === 'timeline' && <TimelineView />}
              {activeTab === 'schools' && <SchoolsView />}
              {activeTab === 'checklist' && <ChecklistView />}
            </>
          )}
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
                      ? currentUser?.role === 'admin'
                        ? 'text-red-600 bg-red-50'
                        : currentUser?.role === 'teacher'
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

  // 主渲染
  return isLoggedIn ? <MainApp /> : <LoginPage />;
};

export default JapanStudyApp;