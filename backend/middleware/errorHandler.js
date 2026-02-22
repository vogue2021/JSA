// Error Handler Middleware
// 错误处理中间件

const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/combined.log'
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Prepare error response
  const errorResponse = {
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? {} : {
      message: err.message,
      stack: err.stack
    }
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    errorResponse.message = '数据验证失败';
    errorResponse.errors = err.errors;
    return res.status(400).json(errorResponse);
  }

  if (err.name === 'UnauthorizedError') {
    errorResponse.message = '未授权访问';
    return res.status(401).json(errorResponse);
  }

  if (err.name === 'JsonWebTokenError') {
    errorResponse.message = '令牌无效';
    return res.status(401).json(errorResponse);
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse.message = '令牌已过期';
    return res.status(401).json(errorResponse);
  }

  if (err.code === 'ER_DUP_ENTRY') {
    errorResponse.message = '数据已存在';
    return res.status(409).json(errorResponse);
  }

  // Default error response
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;