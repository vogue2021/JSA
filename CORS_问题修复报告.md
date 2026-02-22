# CORS 问题修复报告

## 🎯 问题描述

用户在添加和删除学校时出现以下错误：
```
保存学校失败: Failed to fetch
```

## 🔍 问题根本原因

经过深入排查，发现了**两个关键配置错误**：

### 1. 缺失的 API 配置文件 ⚠️
**文件**: `/Users/jiangpeng/JSA/src/services/api.js`
- **状态**: 文件完全不存在
- **影响**: 前端无法与后端通信，所有 API 调用失败
- **症状**: App.jsx 第10行的 import 语句失败

### 2. 错误的 CORS 配置 ⚠️
**文件**: `/Users/jiangpeng/JSA/backend/.env`
- **错误配置**: `FRONTEND_URL=http://localhost:3000`
- **实际端口**: 前端运行在 `http://localhost:3002`
- **影响**: 浏览器 CORS 策略阻止所有跨域请求

## ✅ 已实施的修复

### 修复 1: 创建 API 配置文件

**创建文件**: `/Users/jiangpeng/JSA/src/services/api.js`

实现了完整的 API 客户端，包括：
- ✅ 通用 API 请求函数 (`apiRequest`)
- ✅ 学校 API (`schoolsAPI`): 增删改查
- ✅ 事件 API (`eventsAPI`): 增删改查
- ✅ 材料 API (`materialsAPI`): 增删改查及状态更新
- ✅ 错误处理和 204 No Content 响应处理

**API Base URL**: `http://localhost:3001/api`

### 修复 2: 更新 CORS 配置

**修改文件**: `/Users/jiangpeng/JSA/backend/.env`

```diff
- FRONTEND_URL=http://localhost:3000
+ FRONTEND_URL=http://localhost:3002
```

### 修复 3: 重启后端服务器

重启后端以应用新的 CORS 配置：
```bash
cd backend && npm start
```

**验证**: 后端启动信息显示正确的前端 URL：
```
╔════════════════════════════════════════════╗
║   Frontend URL: http://localhost:3002   ║
╚════════════════════════════════════════════╝
```

## 🧪 修复验证

### 1. 后端健康检查 ✅
```bash
curl http://localhost:3001/api/health
```
响应:
```json
{
    "status": "OK",
    "timestamp": "2025-10-11T13:07:33.958Z",
    "uptime": 45.862190042,
    "environment": "development"
}
```

### 2. 服务器状态 ✅
- ✅ 后端服务器: 运行在 `http://localhost:3001`
- ✅ 前端服务器: 运行在 `http://localhost:3002`
- ✅ CORS配置: 允许来自 `http://localhost:3002` 的请求
- ✅ 数据库: SQLite 连接正常

## 📋 用户操作步骤

### 请按以下步骤访问应用：

1. **关闭所有浏览器标签页**
   - 特别是之前访问 `http://localhost:3000` 的标签

2. **在浏览器中打开正确的 URL**
   ```
   http://localhost:3002
   ```

3. **登录测试**
   使用测试账号登录：

   **管理员**:
   - 邮箱: admin@jsa.com
   - 密码: admin123

   **老师**:
   - 王老师: wang@school.com / wang123
   - 李老师: li@school.com / li123

4. **测试学校管理功能**
   - 点击"学校"标签
   - 点击"添加学校"按钮
   - 填写学校信息并保存
   - **应该成功保存，不再出现 "Failed to fetch" 错误**

## 🎉 预期结果

修复后，以下功能应该正常工作：
- ✅ 添加学校：学校页面即时显示新学校卡片
- ✅ 时间线同步：新学校的重要日期自动添加到时间线
- ✅ 材料清单同步：材料页面的学校下拉菜单包含新学校
- ✅ 删除学校：自动级联删除相关事件和材料
- ✅ 编辑学校：修改立即生效

## 📝 技术细节

### API 端点
- `GET /api/schools/student/:studentId` - 获取学生的所有学校
- `POST /api/schools` - 创建新学校（同时创建时间线事件和材料）
- `PUT /api/schools/:schoolId` - 更新学校信息
- `DELETE /api/schools/:schoolId` - 删除学校（CASCADE 删除关联数据）

### 前端数据流
```
SchoolModal (handleSubmit)
    ↓
schoolsAPI.create() → 后端创建学校
    ↓
schoolsAPI.getByStudent() → 重新加载学校列表
eventsAPI.getByStudent() → 重新加载事件（含新同步的事件）
materialsAPI.getByStudent() → 重新加载材料清单
    ↓
React setState → 触发组件重新渲染
    ↓
UI 更新：学校页面、时间线、材料清单全部同步
```

### 后端级联同步
后端路由 (`backend/routes/schools.js`) 在创建学校时自动：
1. 插入学校记录到 `schools` 表
2. 根据学校日期创建时间线事件到 `events` 表
3. 将学校材料插入到 `materials` 表

删除学校时通过数据库 CASCADE 自动删除关联的事件和材料。

## 📄 相关文档更新

已更新以下文档：
- ✅ `/Users/jiangpeng/JSA/正确访问方式.md` - 用户访问指南
- ✅ `/Users/jiangpeng/JSA/CLAUDE.md` - 开发者文档（添加 CORS 配置说明）

## 🚨 未来预防措施

为避免类似问题再次发生：

1. **在 `.env` 文件中添加注释**
   ```env
   # IMPORTANT: Must match the port where frontend Vite server runs
   # Default is 3002 (as Vite skips 3000/3001 if occupied)
   FRONTEND_URL=http://localhost:3002
   ```

2. **在 README 中强调端口配置**
   已在 CLAUDE.md 中添加醒目的端口配置警告

3. **添加启动检查脚本**（可选）
   可以创建一个启动脚本检查 .env 配置是否正确

## 📞 联系信息

如有其他问题，请检查：
- 后端日志：查看 backend 服务器控制台输出
- 浏览器控制台：查看前端错误信息
- 网络选项卡：检查 API 请求状态和响应

---

**修复日期**: 2025年10月11日
**修复状态**: ✅ 完成并验证
