const winston = require('winston');
const config = require('./config');

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}${stack ? `\n${stack}` : ''}`;
  })
);

// 日志传输配置
const transports = [
  // 控制台输出
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  // 文件日志 - 所有级别
  new winston.transports.File({
    filename: 'logs/combined.log',
    maxSize: 10240, // 10MB
    maxFiles: 10,
    format: logFormat
  }),
  // 错误日志单独文件
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxSize: 10240,
    maxFiles: 10,
    format: logFormat
  })
];

// 创建日志实例
const logger = winston.createLogger({
  level: config.logger.level,
  transports
});

// 开发环境下输出更详细的日志
if (config.logger.verbose) {
  logger.level = 'debug';
}

module.exports = logger;
