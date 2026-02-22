// Database Connection Module
// 数据库连接模块

const knex = require('knex');
const dbConfig = require('./database');

// Get environment-specific configuration
const environment = process.env.NODE_ENV || 'development';
const config = dbConfig[environment];

if (!config) {
  throw new Error(`No database configuration found for environment: ${environment}`);
}

// Create database connection
const db = knex(config);

// Test connection on initialization
db.raw('SELECT 1')
  .then(() => {
    console.log(`Database connected successfully in ${environment} mode`);
  })
  .catch((err) => {
    console.error('Database connection error:', err.message);
  });

module.exports = db;