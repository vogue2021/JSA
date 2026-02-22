# Japan Study Abroad Application Backend
# 日本留学考学助手后端

## 项目概述 / Project Overview

This is the backend API server for the Japan Study Abroad Application System. It provides RESTful APIs for managing students, teachers, schools, events, and materials.

## 技术栈 / Tech Stack

- Node.js + Express.js
- MySQL/MariaDB (Production Database)
- JWT Authentication
- Knex.js (Query Builder)
- Bcrypt (Password Hashing)
- Joi (Input Validation)

## 安装步骤 / Installation

### 1. 安装依赖 / Install Dependencies

```bash
cd backend
npm install
```

### 2. 配置环境变量 / Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your database credentials
```

### 3. 设置数据库 / Setup Database

#### Option A: Using MySQL

```bash
# Create database
mysql -u root -p < database/schema.sql

# Run migrations
npm run migrate

# Seed initial data (optional)
npm run seed
```

#### Option B: Using Docker

```bash
# Run MySQL in Docker
docker run -d \
  --name mysql-japanstudy \
  -e MYSQL_ROOT_PASSWORD=yourpassword \
  -e MYSQL_DATABASE=japan_study_app \
  -p 3306:3306 \
  mysql:8.0

# Wait for MySQL to start, then run schema
docker exec -i mysql-japanstudy mysql -uroot -pyourpassword japan_study_app < database/schema.sql
```

### 4. 启动服务器 / Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API 端点 / API Endpoints

### Authentication 认证

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Student registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/change-password` - Change password

### Users 用户管理

- `GET /api/users` - Get all users (Admin only)
- `POST /api/users/teacher` - Create teacher account (Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Students 学生管理

- `GET /api/students` - Get students (filtered by role)
- `POST /api/students` - Create student (Admin only)
- `GET /api/students/:id` - Get student details
- `PUT /api/students/:id` - Update student
- `POST /api/students/:id/transfer` - Transfer student to another teacher

### Schools 学校管理

- `GET /api/schools/:studentId` - Get schools for a student
- `POST /api/schools` - Add school
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

### Events 事件管理

- `GET /api/events/:studentId` - Get events for a student
- `POST /api/events` - Create event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Materials 材料管理

- `GET /api/materials/:studentId` - Get materials for a student
- `POST /api/materials` - Add material
- `PUT /api/materials/:id` - Update material status
- `DELETE /api/materials/:id` - Delete material

## 数据库架构 / Database Schema

```
users (用户表)
├── id (PK)
├── email
├── password
├── role
└── name

students (学生表)
├── student_id (PK)
├── user_id (FK -> users)
├── teacher_id (FK -> teachers)
├── name
├── email
└── has_account

teachers (老师表)
├── teacher_id (PK)
└── user_id (FK -> users)

schools (学校表)
├── id (PK)
├── student_id (FK -> students)
├── name
├── type
└── status

events (事件表)
├── id (PK)
├── student_id (FK -> students)
├── school_id (FK -> schools)
├── title
└── date

materials (材料表)
├── id (PK)
├── student_id (FK -> students)
├── school_id (FK -> schools)
├── name
└── completed
```

## 部署 / Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name japan-study-backend

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using Docker

```bash
# Build Docker image
docker build -t japan-study-backend .

# Run container
docker run -d \
  --name japan-study-backend \
  -p 3001:3001 \
  --env-file .env \
  japan-study-backend
```

### Using Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 安全配置 / Security Configuration

1. **Environment Variables**: Never commit `.env` file
2. **HTTPS**: Use SSL certificates in production
3. **Rate Limiting**: Configured to prevent abuse
4. **CORS**: Restricted to frontend domain
5. **Helmet**: Security headers enabled
6. **Password Hashing**: Using bcrypt with salt rounds

## 备份策略 / Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p japan_study_app > backup_$DATE.sql
gzip backup_$DATE.sql
# Upload to cloud storage or backup server
```

## 监控 / Monitoring

- Health check endpoint: `GET /api/health`
- Logs location: `./logs/`
- Use monitoring tools like:
  - New Relic
  - DataDog
  - PM2 Monitoring

## 故障排除 / Troubleshooting

### Database Connection Issues
```bash
# Check MySQL service
systemctl status mysql

# Test connection
mysql -u root -p -e "SELECT 1"
```

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Permission Issues
```bash
# Fix file permissions
chmod -R 755 .
chmod 600 .env
```

## 测试账号 / Test Accounts

- **Admin**: admin@jsa.com / admin123
- **Teacher**: wang@school.com / wang123
- **Student**: zhangsan@example.com / zhang123

## 支持 / Support

For issues and questions, please create an issue on GitHub or contact the development team.

## License

MIT