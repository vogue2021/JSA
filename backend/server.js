// Main Server File
// 主服务器文件

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const schoolRoutes = require('./routes/schools');
const eventRoutes = require('./routes/events');
const materialRoutes = require('./routes/materials');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 604800000 // 7 days
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: '请求过于频繁，请稍后再试'
});

app.use('/api/', limiter);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/students', authenticateToken, studentRoutes);
app.use('/api/teachers', authenticateToken, teacherRoutes);
// 临时移除认证，便于演示 - 生产环境需要加上 authenticateToken
app.use('/api/schools', schoolRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/materials', materialRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Japan Study Abroad Application API',
    version: '1.0.0',
    description: '日本留学考学助手后端API',
    documentation: '/api/docs'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: '404',
    message: '请求的资源不存在'
  });
});

// Database connection check
const db = require('./config/db');
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch((err) => {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  });

// Start server
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Japan Study Abroad Application Backend   ║
║         日本留学考学助手后端服务              ║
╠════════════════════════════════════════════╣
║   Server running on port: ${PORT}            ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}   ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    db.destroy(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;