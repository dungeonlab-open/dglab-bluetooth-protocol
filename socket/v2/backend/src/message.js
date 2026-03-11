const connectionManager = require('./connection');
const config = require('./config');
const logger = require('./logger');

class MessageRouter {
  constructor() {
    this.connectionManager = connectionManager;
  }

  /**
   * 验证消息格式
   * @param {string} rawMessage 
   * @returns {object}
   */
  validate(rawMessage) {
    let data = null;
    try {
      data = JSON.parse(rawMessage);
    } catch (e) {
      return {
        valid: false,
        code: '403',
        message: '消息格式错误：期望 JSON 格式',
        data: null
      };
    }

    // 所有消息必须包含 type, clientId, targetId, message
    if (!data.type || !data.clientId || !data.message || !data.targetId) {
      return {
        valid: false,
        code: '404',
        message: '消息缺少必需字段',
        data: null
      };
    }

    return {
      valid: true,
      data
    };
  }

  /**
   * 验证消息来源合法性（防止消息伪造）
   * @param {string} clientId - 消息中的 clientId
   * @param {WebSocket} ws - 当前 WebSocket 连接
   * @returns {boolean}
   */
  validateSource(clientId, ws) {
    const clientInfo = this.connectionManager.getClient(clientId);
    return clientInfo && clientInfo.ws === ws;
  }

  /**
   * 处理绑定请求
   * @param {object} data 
   * @param {WebSocket} ws 
   * @returns {object}
   */
  handleBind(data, ws) {
    const { clientId, targetId } = data;

    // 验证消息来源
    // 验证消息来源（发送者的 ws 必须匹配 clientId 或 targetId）
    if (!this.validateSource(clientId, ws) && !this.validateSource(targetId, ws)) {
      return {
        success: false,
        code: '404',
        message: '非法消息来源'
      };
    }

    // 执行配对
    const result = this.connectionManager.pair(clientId, targetId);

    if (result.success) {
      // 向双方发送绑定成功消息
      const bindMessage = {
        type: 'bind',
        clientId,
        targetId,
        message: '200'
      };

      // 发送给发起方（APP）
      try {
        ws.send(JSON.stringify(bindMessage));
      } catch (err) {
        logger.error(`发送绑定消息失败：${err.message}`);
      }

      // 发送给另一方（网页端）— clientId 是网页端 ID
      const otherClient = this.connectionManager.getClient(clientId);
      if (otherClient && otherClient.ws && otherClient.ws !== ws) {
        try {
          otherClient.ws.send(JSON.stringify(bindMessage));
        } catch (err) {
          logger.error(`发送绑定消息失败：${err.message}`);
        }
      }
    }

    return result;
  }

  /**
   * 处理强度调节消息
   * @param {object} data 
   * @param {WebSocket} ws 
   * @returns {object}
   */
  handleStrengthAdjust(data, ws) {
    const { clientId, targetId, type, channel, strength } = data;

    // 验证配对关系
    if (!this.connectionManager.isPaired(clientId, targetId)) {
      return {
        success: false,
        code: '402',
        message: '配对关系无效'
      };
    }

    // 构造强度调整消息（type 1,2,3 对应减少、增加、归零）
    const sendType = parseInt(type) - 1;
    const sendChannel = channel || 1;
    const sendStrength = parseInt(type) >= 3 ? (strength || 0) : 1;

    const strengthMessage = `strength-${sendChannel}+${sendType}+${sendStrength}`;

    const targetClient = this.connectionManager.getClient(targetId);
    if (targetClient && targetClient.ws) {
      try {
        targetClient.ws.send(JSON.stringify({
          type: 'msg',
          clientId,
          targetId,
          message: strengthMessage
        }));
        logger.debug(`强度调整：${strengthMessage}`);
      } catch (err) {
        logger.error(`发送强度消息失败：${err.message}`);
        return {
          success: false,
          code: '500',
          message: '发送失败'
        };
      }
    }

    return {
      success: true,
      code: '200',
      message: '强度调整已发送'
    };
  }

  /**
   * 处理指定强度消息
   * @param {object} data 
   * @param {WebSocket} ws 
   * @returns {object}
   */
  handleCustomStrength(data, ws) {
    const { clientId, targetId, message } = data;

    // 验证配对关系
    if (!this.connectionManager.isPaired(clientId, targetId)) {
      return {
        success: false,
        code: '402',
        message: '配对关系无效'
      };
    }

    const targetClient = this.connectionManager.getClient(targetId);
    if (targetClient && targetClient.ws) {
      try {
        targetClient.ws.send(JSON.stringify({
          type: 'msg',
          clientId,
          targetId,
          message
        }));
      } catch (err) {
        logger.error(`发送强度消息失败：${err.message}`);
        return {
          success: false,
          code: '500',
          message: '发送失败'
        };
      }
    }

    return {
      success: true,
      code: '200',
      message: '自定义强度已发送'
    };
  }

  /**
   * 处理客户端消息（波形数据等）
   * @param {object} data 
   * @param {WebSocket} ws 
   * @param {object} timerManager - 定时器管理器
   * @returns {object}
   */
  handleClientMessage(data, ws, timerManager) {
    const { clientId, targetId, channel, message, time } = data;

    // 验证配对关系
    if (!this.connectionManager.isPaired(clientId, targetId)) {
      return {
        success: false,
        code: '402',
        message: '配对关系无效'
      };
    }

    // 必须指定通道
    if (!channel) {
      return {
        success: false,
        code: '406',
        message: 'channel is empty',
      };
    }

    const targetClient = this.connectionManager.getClient(targetId);
    if (!targetClient || !targetClient.ws) {
      return {
        success: false,
        code: '404',
        message: '目标客户端不存在'
      };
    }

    // 计算发送参数
    const sendTime = time || config.message.defaultPunishmentDuration;
    const totalSends = config.message.defaultPunishmentTime * sendTime;
    const timeSpace = 1000 / config.message.defaultPunishmentTime;

    const pulseMessage = {
      type: 'msg',
      clientId,
      targetId,
      message: `pulse-${message}`
    };

    // 使用定时器管理器发送消息
    timerManager.sendMessage(clientId, channel, targetClient.ws, pulseMessage, totalSends, timeSpace, ws);

    logger.info(`[${clientId}] 波形消息已发送：通道${channel}, 次数${totalSends}, 时长${sendTime}s`);

    return {
      success: true,
      code: '200',
      message: '消息已排队发送',
      details: {
        channel,
        totalSends,
        sendTime
      }
    };
  }

  /**
   * 通用消息转发
   * @param {object} data 
   * @param {WebSocket} ws 
   * @returns {object}
   */
  forwardMessage(data, ws) {
    const { clientId, targetId, type, message } = data;

    // 验证配对关系
    if (!this.connectionManager.isPaired(clientId, targetId)) {
      return {
        success: false,
        code: '402',
        message: '配对关系无效'
      };
    }

    // v1 兼容：默认消息转发给 clientId（网页端）
    // 场景：APP 收到强度下发后，回复的消息需要转发回网页端
    const client = this.connectionManager.getClient(clientId);
    if (client && client.ws) {
      try {
        client.ws.send(JSON.stringify({
          type,
          clientId,
          targetId,
          message
        }));
      } catch (err) {
        logger.error(`转发消息失败：${err.message}`);
        return {
          success: false,
          code: '500',
          message: '发送失败'
        };
      }
    } else {
      return {
        success: false,
        code: '404',
        message: '目标客户端不存在'
      };
    }

    return {
      success: true,
      code: '200',
      message: '消息已转发'
    };
  }
}

module.exports = new MessageRouter();
