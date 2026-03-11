const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const connectionManager = require('./connection');
const messageRouter = require('./message');
const timerManager = require('./timer');
const config = require('./config');
const logger = require('./logger');

// 启动 WebSocket 服务器
const wss = new WebSocket.Server({
  port: config.server.port,
  clientTracking: true
});

logger.info(`WebSocket 服务器启动，监听端口：${config.server.port}`);

// 心跳定时器
let heartbeatInterval = null;

wss.on('connection', (ws, req) => {
  // 生成唯一 ID
  const clientId = uuidv4();

  const clientIp = req.socket.remoteAddress || 'unknown';
  logger.info(`新 WebSocket 连接：${clientId} from ${clientIp}`);

  // 注册连接（类型暂时标记为 unknown，绑定后再确定）
  connectionManager.register(ws, clientId, 'unknown');

  // 发送绑定消息，告知客户端它的 ID
  const bindMsg = {
    type: 'bind',
    clientId,
    targetId: '',
    message: 'targetId'
  };

  try {
    ws.send(JSON.stringify(bindMsg));
  } catch (err) {
    logger.error(`发送初始绑定消息失败：${err.message}`);
  }

  // 处理客户端消息
  ws.on('message', (rawMessage) => {
    const message = rawMessage.toString('utf8');
    logger.debug(`收到消息 [${clientId}]: ${message}`);

    // 验证消息格式
    const { valid, code, data } = messageRouter.validate(message);

    if (!valid) {
      const errorResponse = {
        type: 'msg',
        clientId: '',
        targetId: '',
        message: String(code)
      };
      try {
        ws.send(JSON.stringify(errorResponse));
      } catch (err) {
        logger.error(`发送错误响应失败：${err.message}`);
      }
      return;
    }

    // 验证消息来源（防止消息伪造）
    // v1 兼容：发送者的 ws 必须匹配 clientId 或 targetId 其中之一
    if (!messageRouter.validateSource(data.clientId, ws) &&
      !messageRouter.validateSource(data.targetId, ws)) {
      const errorResponse = {
        type: 'msg',
        clientId: '',
        targetId: '',
        message: '404'
      };
      try {
        ws.send(JSON.stringify(errorResponse));
      } catch (err) {
        logger.error(`发送错误响应失败：${err.message}`);
      }
      return;
    }

    // 根据消息类型路由处理
    switch (data.type) {
      case 'bind':
        handleBind(data, ws);
        break;

      case 1:
      case 2:
      case 3:
        handleStrengthAdjust(data, ws);
        break;

      case 4:
        handleCustomStrength(data, ws);
        break;

      case 'clientMsg':
        handleClientMessage(data, ws);
        break;

      default:
        forwardMessage(data, ws);
    }
  });

  // 处理连接关闭
  ws.on('close', (code, reason) => {
    logger.info(`连接关闭 [${clientId}]: code=${code}, reason=${reason.toString()}`);

    // 清除该客户端的所有定时器
    timerManager.clearClientTimers(clientId);

    // 断开连接并清理配对关系
    connectionManager.disconnect(clientId);
  });

  // 处理连接错误
  ws.on('error', (error) => {
    logger.error(`WebSocket 异常 [${clientId}]: ${error.message}`);

    // 查找配对的另一端并通知
    const pairId = connectionManager.getPair(clientId);
    if (pairId) {
      const pairClient = connectionManager.getClient(pairId);
      if (pairClient && pairClient.ws && pairClient.ws.readyState === WebSocket.OPEN) {
        const errorMsg = {
          type: 'error',
          clientId: clientId,
          targetId: pairId,
          message: '500'
        };
        try {
          pairClient.ws.send(JSON.stringify(errorMsg));
        } catch (err) {
          logger.error(`发送错误消息失败：${err.message}`);
        }
      }
    }
  });

  // 启动全局心跳定时器（仅启动一次）
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      sendHeartbeats();
    }, config.server.heartbeatInterval);
    logger.info(`心跳定时器已启动，间隔：${config.server.heartbeatInterval}ms`);
  }
});

/**
 * 处理绑定请求
 */
function handleBind(data, ws) {
  const result = messageRouter.handleBind(data, ws);
  logger.debug(`绑定请求 [${data.clientId}]: code=${result.code}`);
}

/**
 * 处理强度调节（type 1,2,3）
 */
function handleStrengthAdjust(data, ws) {
  const result = messageRouter.handleStrengthAdjust(data, ws);

  if (!result.success) {
    const errorResponse = {
      type: 'error',
      clientId: data.clientId,
      targetId: data.targetId,
      message: result.code
    };
    try {
      ws.send(JSON.stringify(errorResponse));
    } catch (err) {
      logger.error(`发送错误响应失败：${err.message}`);
    }
  }
}

/**
 * 处理指定强度（type 4）
 */
function handleCustomStrength(data, ws) {
  const result = messageRouter.handleCustomStrength(data, ws);

  if (!result.success) {
    const errorResponse = {
      type: 'error',
      clientId: data.clientId,
      targetId: data.targetId,
      message: result.code
    };
    try {
      ws.send(JSON.stringify(errorResponse));
    } catch (err) {
      logger.error(`发送错误响应失败：${err.message}`);
    }
  }
}

/**
 * 处理客户端消息（波形数据等）
 */
function handleClientMessage(data, ws) {
  const result = messageRouter.handleClientMessage(data, ws, timerManager);

  if (!result.success) {
    const errorResponse = {
      type: data.type === 'clientMsg' ? 'error' : 'bind',
      clientId: data.clientId,
      targetId: data.targetId,
      message: result.code
    };
    try {
      ws.send(JSON.stringify(errorResponse));
    } catch (err) {
      logger.error(`发送错误响应失败：${err.message}`);
    }
  }
}

/**
 * 转发普通消息
 */
function forwardMessage(data, ws) {
  const result = messageRouter.forwardMessage(data, ws);

  if (!result.success) {
    const errorResponse = {
      type: 'msg',
      clientId: data.clientId,
      targetId: data.targetId,
      message: result.code
    };
    try {
      ws.send(JSON.stringify(errorResponse));
    } catch (err) {
      logger.error(`发送错误响应失败：${err.message}`);
    }
  }
}

/**
 * 向所有客户端发送心跳
 */
function sendHeartbeats() {
  const heartbeatMsg = {
    type: 'heartbeat',
    clientId: '',
    targetId: '',
    message: '200'
  };

  const stats = connectionManager.getStats();
  logger.debug(`发送心跳，当前连接数：${stats.totalConnections}, 配对数：${stats.pairedConnections}`);

  connectionManager.forEachClient((clientId, clientInfo) => {
    if (clientInfo.ws && clientInfo.ws.readyState === WebSocket.OPEN) {
      try {
        heartbeatMsg.clientId = clientId;
        heartbeatMsg.targetId = connectionManager.getPair(clientId) || '';
        clientInfo.ws.send(JSON.stringify(heartbeatMsg));

        // 更新心跳时间
        connectionManager.updateHeartbeat(clientId);
      } catch (err) {
        logger.error(`发送心跳失败 [${clientId}]: ${err.message}`);
      }
    }
  });
}

// 优雅关闭
function gracefulShutdown(signal) {
  logger.info(`收到 ${signal}，正在关闭服务器...`);

  // 清理所有定时器
  timerManager.cleanupAll();

  // 清除心跳定时器
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // 关闭所有客户端连接
  wss.clients.forEach((ws) => {
    try {
      ws.close(1001, 'Server shutting down');
    } catch (err) {
      logger.error(`关闭客户端连接失败：${err.message}`);
    }
  });

  // 关闭服务器
  wss.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error(`未捕获的异常：${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未处理的 Promise rejection: ${reason}`);
});

logger.info('服务器启动完成');
