require('dotenv').config();

module.exports = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 9999,
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  },

  // 消息配置
  message: {
    defaultPunishmentTime: parseInt(process.env.DEFAULT_PUNISHMENT_TIME) || 1,
    defaultPunishmentDuration: parseInt(process.env.DEFAULT_PUNISHMENT_DURATION) || 5,
  },

  // 日志配置
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    verbose: process.env.VERBOSE === 'true',
  },

  // 心跳消息模板
  heartbeat: {
    type: 'heartbeat',
    clientId: '',
    targetId: '',
    message: '200',
  },
};
