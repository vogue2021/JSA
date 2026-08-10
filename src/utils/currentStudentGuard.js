//【新需求109】currentStudent 归属守卫 与 加载失败分类
//
// 线上故障：学生账号登录后学校/事件/材料全空，老师端却正常，数据库数据完好。
//
// 根因是两处存储生命周期不一致 + 恢复缓存时不校验归属：
//   · `user`存 sessionStorage —— 关标签页即失效
//   · `currentStudent` 存 localStorage   —— 持久保留
// 于是"老师登录并选过学生 X → 直接关浏览器（未点登出，logout 才会清缓存）→ 学生 Y 登录"
// 这条很常见的路径下，学生 Y 恢复出了别人的 currentStudent(X)：
//   前端请求 /schools/student/X → 后端 `isStudent(user) && user.studentId !== X` 判定越权 403
//   → 前端把错误就地吞掉 → 界面一片空白，且没有任何提示。
//
// 抽到这里而不是留在 App.jsx 内联，是为了能被单元测试覆盖 ——
// App.jsx 有 7000+ 行、依赖极重，无法在测试里整体渲染。

const STORAGE_KEY = 'currentStudent';

/** 学生角色的默认档案（无可用缓存时使用） */
function buildSelfProfile(user) {
  return {
    id: 1,
    name: user?.name,
    studentId: user?.studentId,
    email: user?.email,
    targetCountry: '日本',
    // 【新需求106】默认学位为「学部」
    targetLevel: '学部',
    avatar: '👨‍🎓',
    teacherId: user?.teacherId,
  };
}

/**
 * 判断一份 currentStudent 缓存是否"不属于当前登录的学生"。
 *
 * 仅对 student 角色生效 —— 老师/管理员本来就需要切换查看不同学生。
 * 当 user.studentId 尚未就绪（异步恢复中）时返回 false：
 * 此时无法判断归属，宁可放过也不要误删好数据。
 */
export function isForeignStudentCache(user, cached) {
  if (!user || user.role !== 'student') return false;
  if (!user.studentId) return false;
  if (!cached || cached.studentId === undefined || cached.studentId === null) return true;
  // 学号在不同来源可能是数字或字符串，统一按字符串比较
  return String(cached.studentId) !== String(user.studentId);
}

/**
 * 计算初始 currentStudent：能用缓存就用，属于他人则丢弃并锁定为本人。
 * @param {object} user 当前登录用户
 * @param {Storage} [storage] 便于测试注入，默认 localStorage
 */
export function resolveInitialCurrentStudent(user, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  let cached = null;
  if (store) {
    const raw = store.getItem(STORAGE_KEY);
    if (raw) {
      try {
        cached = JSON.parse(raw);
      } catch {
        cached = null;
      }
    }
  }

  if (cached) {
    if (isForeignStudentCache(user, cached)) {
      console.warn(
        '[currentStudent] 检测到与当前登录学生不匹配的缓存，已丢弃。'
        +` 缓存学号=${cached.studentId}，本人学号=${user?.studentId}`
      );
      store?.removeItem(STORAGE_KEY);
    } else {
      return cached;
    }
  }

  if (user?.role === 'student') return buildSelfProfile(user);

  // 老师/管理员：保持原有的占位默认值，真实选择由学生选择器驱动
  return {
    id: 1,
    name: '张三',
    studentId: '2024001',
    targetCountry: '日本',
    targetLevel: '学部',
    email: 'zhangsan@example.com',
    avatar: '👨‍🎓',
    teacherId: user?.teacherId || 'teacher_1',
  };
}

/** 学生角色的自我档案（运行时纠偏用） */
export function buildSelfCurrentStudent(user) {
  return buildSelfProfile(user);
}

/**
 * 把"加载学生数据时各接口的失败"归类成一条可展示、可行动的提示。
 *
 * 为什么需要它：原先三个请求各自挂 `.catch(() => [])`，403 被就地吞掉，
 * 界面上"越权"和"该学生确实没数据"完全无法区分 —— 这正是本次故障难以定位的原因。
 *
 * @param {Array<{label: string, status?: number, code?: string}>} failures
 * @returns {{kind: 'forbidden'|'expired'|'network', message: string}|null}
 */
export function classifyLoadFailure(failures) {
  if (!Array.isArray(failures) || failures.length === 0) return null;

  const isExpired = (f) => f.status === 401 || f.code === 'ACCOUNT_DELETED';
  const isForbidden = (f) => f.status === 403 || f.code === 'PERMISSION_DENIED';

  // 登录失效优先级最高：其它错误多半是它的连带结果
  if (failures.some(isExpired)) {
    return { kind: 'expired', message: '登录状态已失效，请重新登录' };
  }

  const forbidden = failures.filter(isForbidden);
  if (forbidden.length > 0) {
    const names = forbidden.map(f => f.label).join('、');
    return {
      kind: 'forbidden',
      message: `无权查看该学生的${names}数据。`
        + '若你是学生本人看到此提示，请退出登录后重新登录以刷新身份信息。',
    };
  }

  const names = failures.map(f => f.label).join('、');
  return { kind: 'network', message: `${names}数据加载失败，请检查网络后重试` };
}
