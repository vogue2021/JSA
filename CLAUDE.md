# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 重要：查看最新需求

> **开始开发前，请先阅读 `REQUIREMENTS.md` 文件！**
> 
> 该文件由 Obsidian 知识库同步而来，包含：
> - 当前迭代目标
> - 待办需求 (按优先级排序)
> - 已完成功能
> - 特别说明和约束
> 
> 路径：`/Users/jiangpeng/JSA/REQUIREMENTS.md`

---

## Project Overview

Japan Study Abroad Application (日本留学考学助手) - A comprehensive React-based application for managing Japanese university applications. The system supports three user roles (student, teacher, admin) with distinct permissions and workflows.

## Technology Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons
- **Backend**: Express.js + Node.js
- **Database**: Knex.js ORM with SQLite (development) / MySQL (production)
- **Authentication**: JWT tokens + bcrypt password hashing
- **State Management**: React hooks with localStorage persistence
- **API Communication**: Fetch API with custom wrapper (src/services/api.js)

## Development Commands

```bash
# Install dependencies (both frontend and backend)
npm install
cd backend && npm install && cd ..

# Start backend server (MUST start first)
cd backend && npm start
# Backend runs on: http://localhost:3001

# Start frontend development server (in another terminal)
npm run dev
# Frontend runs on: http://localhost:3000 (configured in vite.config.js)

# Backend database migrations
cd backend
npm run migrate              # Run migrations
npm run migrate:rollback     # Rollback last migration
npm run migrate:make <name>  # Create new migration

# Build for production
npm run build

# Preview production build
npm run preview
```

## ⚠️ IMPORTANT: Server Configuration

**Frontend and Backend Port Configuration:**
- **Backend**: Always runs on port **3001** (configured in backend/.env)
- **Frontend**: Runs on port **3000** by default (vite.config.js:8), but may auto-select **3002** if 3000 is occupied
- **CORS Configuration**: Backend `.env` file MUST have `FRONTEND_URL` matching the actual frontend URL

**If you get "Failed to fetch" or CORS errors:**
1. Check which port frontend is actually running on (check terminal output)
2. Update `backend/.env` to set `FRONTEND_URL=http://localhost:<actual-port>`
3. Restart backend server after changing .env
4. Check backend startup logs to verify CORS origin configuration

## Architecture Overview

### Frontend Structure (src/App.jsx - 3406 lines)

The application is a monolithic single-file React component with three main sections:

1. **ErrorBoundary Component (lines 12-64)**: React error boundary for graceful error handling
   - Catches React errors and displays user-friendly error screen
   - Provides options to reload or clear localStorage

2. **AuthPage Component (lines 66-495)**: Authentication UI with role-based login/registration
   - Three user types: student, teacher, admin
   - Students can self-register using pre-assigned student IDs from studentList
   - Teachers/Admins can only login (no self-registration)
   - Mock verification code for registration: '123456'
   - Built-in test accounts displayed on login screen

3. **MainApp Component (lines 497-3330)**: Core application with three main views
   - **TimelineView**: Event management (exams, deadlines, material preparation)
   - **SchoolsView**: University application tracking with progress visualization
   - **ChecklistView**: Material preparation tracking (general + school-specific)
   - Tab-based navigation with mobile-responsive design
   - Modal-based editing for all CRUD operations
   - Student selector for teachers/admins
   - Real-time synchronization between schools, events, and materials

4. **JapanStudyApp Root Component (lines 3331-3406)**: Top-level state and routing
   - Manages authentication state (user login/logout)
   - Maintains allUsers array (user accounts database)
   - Maintains studentList array (student information)
   - Persists state to localStorage
   - Routes between AuthPage and MainApp based on login state

### Backend Architecture (backend/server.js)

Express.js REST API server with comprehensive middleware:
- **Port**: 3001 (configured in .env)
- **Security**: Helmet (headers), CORS (origin-based), rate limiting, session management
- **Middleware**: compression, morgan logging, express-session, body parser
- **Authentication**: JWT tokens (middleware/auth.js), bcrypt password hashing
- **Database**: Knex.js query builder with SQLite (dev) or MySQL (production)

**API Routes** (all prefixed with /api):
- `/auth` - Login, registration, token verification, password change
- `/users` - User CRUD (admin-only teacher creation)
- `/students` - Student management, teacher assignment
- `/teachers` - Teacher-specific operations
- `/schools` - School CRUD operations by student
- `/events` - Timeline event management
- `/materials` - Material checklist management

**Key Files**:
- `backend/config/db.js` - Database connection via Knex
- `backend/routes/*.js` - Route handlers for each resource
- `backend/middleware/auth.js` - JWT authentication middleware
- `backend/middleware/errorHandler.js` - Centralized error handling

## User Role System

### Student Role
- **Permissions**: Read-only access to personal data
- **Registration**: Can self-register using pre-assigned student ID from studentList
- **Features**: View personal timeline, application status, material checklist
- **Data Access**: Only sees their own events, schools, and materials

### Teacher Role
- **Permissions**: Full CRUD for assigned students only
- **Assignment**: Each teacher has a teacherId, sees only students with matching teacherId
- **Features**:
  - Switch between assigned students
  - Edit events, schools, materials for their students
  - Progress tracking and notes
  - Cannot create other teacher accounts

### Admin Role
- **Permissions**: System-wide access and management
- **Exclusive Features**:
  - Create teacher accounts
  - Manage all students across all teachers
  - Transfer students between teachers
  - Full system configuration access
- **Data Access**: Can view and edit all data regardless of teacher assignment

## Key Data Flows

### Authentication Flow
1. User selects role type on login page (student/teacher/admin tabs)
2. Students can register with valid student ID (validated against studentList)
3. Teachers/Admins login with credentials (stored in allUsers array)
4. Successful login stores user object in localStorage (key: 'user')
5. MainApp checks user.role for permission-based UI rendering

### Student-Teacher Assignment
1. Students created with pre-assigned teacherId in studentList
2. Teachers filter students by matching user.teacherId === student.teacherId
3. Admin sees all students via user.role === 'admin' check
4. Student transfer updates studentId.teacherId and syncs to localStorage

### School-Event-Material Synchronization
When adding/editing schools, automatic synchronization occurs:
1. **School → Events**: Important dates (application deadline, exam date, interview date) auto-create timeline events
2. **School → Materials**: Required materials defined per school auto-populate school-specific checklist
3. **Deletion Cascade**: Deleting school removes associated events and school-specific materials
4. **Progress Calculation**: School progress = (completed materials / total materials) × 100

Functions handling sync:
- `syncSchoolDatesToTimeline()` - Creates/updates events from school dates
- `syncSchoolMaterialsToChecklist()` - Adds school materials to checklist
- Called automatically in school add/edit/delete handlers

## API Integration Pattern

The app uses a hybrid architecture:
- **Current**: Frontend uses mock data stored in React state + localStorage
- **Backend Ready**: API service layer exists (src/services/api.js) with full CRUD methods
- **Backend Routes**: Fully implemented but currently unused by frontend

To switch from mock to real API:
1. Replace useState initialization with API calls in useEffect
2. Replace state setters with API calls (schoolsAPI, eventsAPI, materialsAPI)
3. Backend already implements:
   - GET /api/schools/student/:studentId
   - POST /api/schools (create)
   - PUT /api/schools/:id (update)
   - DELETE /api/schools/:id (delete)
   - Similar patterns for events and materials

## Component Communication Patterns

### Modal Management
Each feature has dedicated modal components defined within MainApp:
- EventModal, SchoolModal, MaterialModal, StudentModal, TeacherModal
- Modal visibility controlled by boolean state: showEventModal, showSchoolModal, etc.
- Edit mode determined by presence of editing* state (editingEvent, editingSchool, etc.)
- null = create mode, object = edit mode
- Modals receive onSave and onClose callbacks for state updates

### Data Persistence Strategy
**localStorage Keys**:
- `'user'` - Current authenticated user object
- `'registeredUsers'` - Array of all registered user accounts (allUsers)
- `'studentList'` - Array of student information with teacherId assignments
- `'currentStudent'` - Selected student for teacher/admin view

**Persistence Pattern**:
```javascript
// Save on change
useEffect(() => {
  localStorage.setItem('key', JSON.stringify(data));
}, [data]);

// Load on mount
const [data, setData] = useState(() => {
  const saved = localStorage.getItem('key');
  return saved ? JSON.parse(saved) : defaultValue;
});
```

### State Management Architecture
- **No global state library**: Uses React useState + props drilling
- **Top-level state**: JapanStudyApp manages user, allUsers, studentList
- **Component-level state**: MainApp manages events, schools, checklist, modals
- **Student context**: currentStudent state passed down to all views
- **Sync triggers**: State updates trigger automatic re-renders and localStorage sync

## Testing Accounts

### Admin Account
- Email: admin@jsa.com
- Password: admin123
- Access: All features, all students

### Teacher Accounts
- Wang: wang@school.com / wang123 (teacherId: 'teacher_1')
- Li: li@school.com / li123 (teacherId: 'teacher_2')
- Access: Only assigned students

### Student Account
- Zhang San: zhangsan@example.com / zhang123 (studentId: '2024001')
- Access: Read-only personal data

### Test Registration
- Unregistered student ID: 2024002 (李四)
- Use for testing student self-registration flow
- Verification code: 123456

## Important Implementation Details

### Dynamic User Creation
- Students self-register by selecting unused studentId from studentList
- Registration creates new user in allUsers array with role='student'
- Student data already exists in studentList with pre-assigned teacherId
- Teacher accounts can ONLY be created by admin through account management UI
- Student IDs auto-generated in format: YYYY### (e.g., 2024001, 2024002)

### Permission Checks
Look for these conditional patterns in MainApp component:
```javascript
// Teacher or Admin permissions
{(user.role === 'teacher' || user.role === 'admin') && (
  <button>Add Event</button>
)}

// Admin-only features
{user.role === 'admin' && (
  <button>Create Teacher</button>
)}

// Student filtering by teacher
const filteredStudents = user.role === 'admin'
  ? studentList
  : studentList.filter(s => s.teacherId === user.teacherId);
```

### Mobile Responsiveness
- Breakpoint: `window.innerWidth < 768`
- Desktop: Tab navigation in header
- Mobile: Bottom navigation bar + hamburger menu
- State: `isMobile` tracked via useEffect + resize listener
- Conditional rendering: Different layouts for mobile vs desktop

### Event Urgency System
Events categorized by days remaining:
- **Expired**: daysLeft < 0 (red, "已过期")
- **Urgent**: 0 <= daysLeft <= 7 (red, "紧急")
- **Soon**: 7 < daysLeft <= 30 (orange, "即将到来")
- **Normal**: daysLeft > 30 (gray)
- Urgent count shown in header bell icon notification

## Common Modification Patterns

### Adding New User Permissions
Permission checks are inline conditionals throughout MainApp. Key locations:
- Around line 2176-2187: Add event button visibility
- Around line 2196-2207: Add school button visibility
- Around line 2324-2341: Material management buttons
- Pattern: `{(user.role === 'teacher' || user.role === 'admin') && <Button />}`

### Modifying Data Models
Mock data structures defined in MainApp initialization:
- Events array (~line 565): {id, title, date, type, category, studentId, completed, notes}
- Schools array (~line 572): {id, name, location, type, major, status, deadline, examDate, notes, materials, studentId}
- Checklist object (~line 622): {general: [...], schoolSpecific: {...}}

To add new fields:
1. Update mock data initialization
2. Update modal form JSX with new input fields
3. Update save handler to include new fields
4. Update display components to show new fields

### Backend API Migration
To connect frontend to backend APIs:
1. Import API functions: `import { schoolsAPI } from './services/api'`
2. Replace mock data loading with API calls:
```javascript
useEffect(() => {
  async function loadSchools() {
    const data = await schoolsAPI.getByStudent(currentStudent.studentId);
    setSchools(data);
  }
  loadSchools();
}, [currentStudent]);
```
3. Replace state updates with API calls in handlers
4. Add error handling and loading states