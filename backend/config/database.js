// Database Configuration
// 数据库配置文件

module.exports = {
  // Development environment configuration
  development: {
    client: 'sqlite3',
    connection: {
      filename: process.env.DB_FILENAME || './database.sqlite'
    },
    useNullAsDefault: true,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  // Production environment configuration
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      ssl: {
        rejectUnauthorized: false
      }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: './migrations'
    }
  },

  // Test environment configuration
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    useNullAsDefault: true
  }
};

// Alternative configuration using environment-based selection
const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const config = module.exports[env];

  if (!config) {
    throw new Error(`No database configuration found for environment: ${env}`);
  }

  return config;
};

module.exports.getConfig = getConfig;