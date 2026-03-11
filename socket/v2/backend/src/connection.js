const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

class ConnectionManager {
  constructor() {
    // 存储所有连接：clientId -> { ws, type, createdAt, lastHeartbeat, isAlive }
    this.connections = new Map();
    
    // 存储配对关系：webSocketId -> appSocketId
    this.pairings = new Map();
    
    // 反向映射：appSocketId -> webSocketId
    this.reversePairings = new Map();
  }
  
  /**
   * 注册新连接
   * @param {WebSocket} ws - WebSocket 实例
   * @param {string} clientId - 客户端 ID（已生成）
   * @param {string} type - 连接类型 'web' 或 'app'
   */
  register(ws, clientId, type = 'unknown') {
    this.connections.set(clientId, {
      ws,
      type,
      createdAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true
    });
    
    logger.info(`[${type}] 新连接建立：${clientId}`);
  }
  
  /**
   * 获取连接信息
   * @param {string} clientId 
   * @returns {object|null}
   */
  getClient(clientId) {
    return this.connections.get(clientId) || null;
  }
  
  /**
   * 检查连接是否存在
   * @param {string} clientId 
   * @returns {boolean}
   */
  hasClient(clientId) {
    return this.connections.has(clientId);
  }
  
  /**
   * 配对两个连接（web ↔ app）
   * @param {string} webClientId - Web 端 clientId
   * @param {string} appClientId - App 端 clientId
   * @returns {object} 配对结果
   */
  pair(webClientId, appClientId) {
    // 检查双方是否都已连接
    if (!this.hasClient(webClientId) || !this.hasClient(appClientId)) {
      return {
        success: false,
        code: '401',
        message: '客户端未连接'
      };
    }
    
    // 检查是否任何一方已有配对
    if (this.pairings.has(webClientId) || this.reversePairings.has(appClientId)) {
      return {
        success: false,
        code: '400',
        message: '客户端已被配对，请先解除当前配对'
      };
    }
    
    // 创建配对关系
    this.pairings.set(webClientId, appClientId);
    this.reversePairings.set(appClientId, webClientId);
    
    logger.info(`配对成功：${webClientId} ↔ ${appClientId}`);
    
    return {
      success: true,
      code: '200',
      message: '配对成功',
      webClientId,
      appClientId
    };
  }
  
  /**
   * 解除配对
   * @param {string} clientId - 可以是 web 端或 app 端 clientId
   * @returns {object}
   */
  unpair(clientId) {
    // 查找 web 端的配对
    let appClientId = this.pairings.get(clientId);
    let webClientId = clientId;
    
    // 如果是 app 端，反向查找
    if (!appClientId) {
      webClientId = this.reversePairings.get(clientId);
      appClientId = clientId;
    }
    
    if (appClientId && webClientId) {
      this.pairings.delete(webClientId);
      this.reversePairings.delete(appClientId);
      logger.info(`解除配对：${webClientId} ↔ ${appClientId}`);
      return {
        success: true,
        code: '200',
        message: '配对已解除'
      };
    }
    
    return {
      success: false,
      code: '404',
      message: '未找到配对关系'
    };
  }
  
  /**
   * 获取配对的另一端
   * @param {string} clientId 
   * @returns {string|null}
   */
  getPair(clientId) {
    return this.pairings.get(clientId) || this.reversePairings.get(clientId) || null;
  }
  
  /**
   * 检查配对关系是否有效
   * @param {string} clientId - 发起方
   * @param {string} targetId - 目标方
   * @returns {boolean}
   */
  isPaired(clientId, targetId) {
    return this.pairings.get(clientId) === targetId || 
           this.reversePairings.get(clientId) === targetId;
  }
  
  /**
   * 断开连接并清理
   * @param {string} clientId 
   * @returns {object}
   */
  disconnect(clientId) {
    const clientInfo = this.connections.get(clientId);
    
    if (!clientInfo) {
      logger.warn(`尝试断开不存在的连接：${clientId}`);
      return { success: false, code: '404' };
    }
    
    // 如果是配对状态，先解除配对
    const pairId = this.getPair(clientId);
    if (pairId) {
      logger.info(`[${clientId}] 断开，关联配对：${pairId}`);
      
      // 通知配对的另一端
      const pairedClient = this.connections.get(pairId);
      if (pairedClient && pairedClient.ws && pairedClient.ws.readyState === 1) { // 1 = OPEN
        // 发送断开通知
        try {
          pairedClient.ws.send(JSON.stringify({
            type: 'break',
            clientId,
            targetId: pairId,
            message: '209'
          }));
        } catch (err) {
          logger.error(`发送断开通知失败：${err.message}`);
        }
        
        // 关闭配对另一端的连接
        try {
          pairedClient.ws.close(1000, 'partner_disconnected');
        } catch (err) {
          logger.error(`关闭配对连接失败：${pairId}`, err);
        }
      }
      
      this.unpair(clientId);
    }
    
    // 关闭当前连接
    try {
      clientInfo.ws.close(1000, 'client_disconnect');
    } catch (err) {
      logger.error(`断开连接失败：${clientId}`, err);
    }
    
    // 从存储中删除
    this.connections.delete(clientId);
    
    logger.info(`[断开] ${clientId}，剩余连接数：${this.connections.size}`);
    
    return { success: true, code: '200' };
  }
  
  /**
   * 更新心跳时间
   * @param {string} clientId 
   */
  updateHeartbeat(clientId) {
    const clientInfo = this.connections.get(clientId);
    if (clientInfo) {
      clientInfo.lastHeartbeat = new Date();
      clientInfo.isAlive = true;
    }
  }
  
  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      pairedConnections: this.pairings.size,
      unpairedConnections: this.connections.size - this.pairings.size * 2
    };
  }
  
  /**
   * 清理过期连接（超过指定秒数没有心跳）
   * @param {number} timeout - 超时时间（秒）
   * @returns {number} 清理的连接数
   */
  cleanupExpired(timeout = 300) {
    const expiredCount = [];
    const now = Date.now();
    
    for (const [clientId, clientInfo] of this.connections.entries()) {
      const age = (now - clientInfo.lastHeartbeat) / 1000;
      if (age > timeout) {
        expiredCount.push(clientId);
        logger.warn(`连接过期：${clientId} (${age.toFixed(0)}s)`);
      }
    }
    
    expiredCount.forEach(clientId => this.disconnect(clientId));
    return expiredCount.length;
  }
  
  /**
   * 遍历所有客户端
   * @param {function} callback - (clientId, clientInfo) => void
   */
  forEachClient(callback) {
    this.connections.forEach((clientInfo, clientId) => {
      callback(clientId, clientInfo);
    });
  }
}

module.exports = new ConnectionManager();
