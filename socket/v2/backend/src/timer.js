const logger = require('./logger');

class TimerManager {
  constructor() {
    // 存储格式：clientId-channel -> { timerId, remaining, message, targetWs, channel, sourceWs }
    this.timers = new Map();
  }
  
  /**
   * 发送消息队列
   * @param {string} clientId 
   * @param {string} channel 
   * @param {WebSocket} targetWs - 目标 WebSocket 连接
   * @param {object} message 
   * @param {number} totalSends - 总发送次数
   * @param {number} timeSpace - 发送间隔（毫秒）
   * @param {WebSocket} sourceWs - 消息来源 WebSocket（用于通知）
   */
  sendMessage(clientId, channel, targetWs, message, totalSends, timeSpace, sourceWs) {
    const timerKey = `${clientId}-${channel}`;
    
    // 检查是否已有该通道的定时器在运行
    if (this.timers.has(timerKey)) {
      // 有正在运行的定时器，需要先清除（覆盖旧消息）
      logger.info(`[${timerKey}] 清除现有定时器，准备发送新消息`);
      
      const oldTask = this.timers.get(timerKey);
      this.clearTimer(clientId, channel, oldTask.sourceWs);
      
      // 发送清除 APP 队列指令
      const clearMessage = {
        type: 'msg',
        clientId: clientId,
        targetId: oldTask.message.targetId,
        message: `clear-${channel === 'A' ? '1' : '2'}`
      };
      
      try {
        targetWs.send(JSON.stringify(clearMessage));
      } catch (err) {
        logger.error(`发送清除指令失败：${err.message}`);
      }
      
      // 延迟 150ms 再发送新消息，避免队列指令晚于波形数据执行
      setTimeout(() => {
        this._startSending(clientId, channel, targetWs, message, totalSends, timeSpace, sourceWs);
      }, 150);
      
      // 通知客户端正在覆盖
      if (sourceWs && sourceWs.readyState === 1) {
        try {
          sourceWs.send(JSON.stringify({
            type: 'notify',
            clientId,
            targetId: '',
            message: `当前通道${channel}有正在发送的消息，覆盖之前的消息`
          }));
        } catch (err) {
          logger.error(`发送覆盖通知失败：${err.message}`);
        }
      }
      
      return;
    }
    
    // 不存在未发完的消息，直接开始发送
    this._startSending(clientId, channel, targetWs, message, totalSends, timeSpace, sourceWs);
  }
  
  /**
   * 内部方法：启动发送消息
   * @private
   */
  _startSending(clientId, channel, targetWs, message, totalSends, timeSpace, sourceWs) {
    const timerKey = `${clientId}-${channel}`;
    
    // 创建定时器任务
    const timerTask = {
      clientId,
      channel,
      targetWs,
      sourceWs,
      message: JSON.parse(JSON.stringify(message)), // 深拷贝
      remaining: totalSends,
      timeSpace,
      timerId: null,
      startedAt: new Date()
    };
    
    // 立即发送第一条消息
    this._safeSend(targetWs, message);
    timerTask.remaining--;
    
    logger.info(`[${timerKey}] 消息发送中，剩余次数：${timerTask.remaining}`);
    
    // 如果还有剩余次数，启动定时器
    if (timerTask.remaining > 0) {
      const timerId = setInterval(() => {
        // 检查目标连接是否还存在
        if (targetWs.readyState !== 1) { // 1 = OPEN
          logger.warn(`[${timerKey}] 目标连接已断开，停止发送`);
          clearInterval(timerId);
          this.timers.delete(timerKey);
          return;
        }
        
        this._safeSend(targetWs, message);
        timerTask.remaining--;
        
        if (timerTask.remaining <= 0) {
          logger.info(`[${timerKey}] 消息发送完毕`);
          clearInterval(timerId);
          this.timers.delete(timerKey);
          
          // 通知客户端发送完毕（保持 JSON 格式）
          if (sourceWs && sourceWs.readyState === 1) {
            try {
              sourceWs.send(JSON.stringify({
                type: 'notify',
                clientId,
                targetId: timerTask.message.targetId,
                message: '发送完毕'
              }));
            } catch (err) {
              logger.error(`发送完成通知失败：${err.message}`);
            }
          }
        }
      }, timeSpace);
      
      timerTask.timerId = timerId;
      this.timers.set(timerKey, timerTask);
    } else {
      logger.info(`[${timerKey}] 消息已发送完成（仅 1 条）`);
      
      // 通知客户端发送完毕
      if (sourceWs && sourceWs.readyState === 1) {
        try {
          sourceWs.send(JSON.stringify({
            type: 'notify',
            clientId,
            targetId: timerTask.message.targetId,
            message: '发送完毕'
          }));
        } catch (err) {
          logger.error(`发送完成通知失败：${err.message}`);
        }
      }
    }
  }
  
  /**
   * 清除指定通道的所有定时器
   * @param {string} clientId 
   * @param {string} channel 
   * @param {WebSocket} sourceWs - 来源 WebSocket（用于通知）
   */
  clearTimer(clientId, channel, sourceWs) {
    const timerKey = `${clientId}-${channel}`;
    const timerTask = this.timers.get(timerKey);
    
    if (timerTask) {
      // 先发送清除指令
      const clearMessage = {
        type: 'msg',
        clientId: clientId,
        targetId: timerTask.message.targetId,
        message: `clear-${channel === 'A' ? '1' : '2'}`
      };
      this._safeSend(timerTask.targetWs, clearMessage);
      
      // 清除定时器
      if (timerTask.timerId) {
        clearInterval(timerTask.timerId);
      }
      
      this.timers.delete(timerKey);
      logger.debug(`[${timerKey}] 定时器已清除`);
    }
  }
  
  /**
   * 清除指定客户端的所有定时器
   * @param {string} clientId 
   */
  clearClientTimers(clientId) {
    const keysToDelete = [];
    
    for (const [key, task] of this.timers.entries()) {
      if (key.startsWith(`${clientId}-`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      const task = this.timers.get(key);
      if (task && task.timerId) {
        clearInterval(task.timerId);
      }
      this.timers.delete(key);
    });
    
    logger.info(`[${clientId}] 清除了 ${keysToDelete.length} 个定时器`);
  }
  
  /**
   * 安全发送消息
   * @private
   * @param {WebSocket} ws 
   * @param {object} message 
   */
  _safeSend(ws, message) {
    if (ws && ws.readyState === 1) { // 1 = OPEN
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        logger.error(`发送消息失败：${err.message}`);
      }
    }
  }
  
  /**
   * 获取定时器统计
   * @returns {object}
   */
  getStats() {
    return {
      activeTimers: this.timers.size,
      timers: Array.from(this.timers.entries()).map(([key, task]) => ({
        key,
        clientId: task.clientId,
        channel: task.channel,
        remaining: task.remaining,
        startedAt: task.startedAt
      }))
    };
  }
  
  /**
   * 清理所有定时器（用于服务关闭）
   */
  cleanupAll() {
    for (const [key, task] of this.timers.entries()) {
      if (task.timerId) {
        clearInterval(task.timerId);
      }
    }
    this.timers.clear();
    logger.info('所有定时器已清理');
  }
}

module.exports = new TimerManager();
