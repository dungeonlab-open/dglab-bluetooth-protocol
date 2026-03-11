# DG-LAB WebSocket 服务器 - 重构版

这是一个模块化重构的 WebSocket 消息中继服务，用于 DG-LAB APP 和第三方控制端之间的通信。

## 架构

```
src/
├── index.js      # 主入口，启动 WebSocket 服务器
├── config.js     # 配置管理（支持环境变量）
├── logger.js     # 日志模块（使用 winston）
├── connection.js # 连接管理（注册、配对、断开）
├── message.js    # 消息路由（验证、转发）
└── timer.js      # 定时器管理（波形消息队列发送）
```

## 安装依赖

```bash
npm install
```

## 运行

### 开发模式（自动重启）

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

### 使用 PM2（推荐）

```bash
pm2 start src/index.js --name dg-lab-socket
pm2 logs dg-lab-socket
pm2 save  # 保存进程列表
```

## 环境变量配置

复制 `.env.example` 为 `.env` 并修改：

```bash
cp .env.example .env
```

### 配置项

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 9999 | WebSocket 服务端口 |
| `HEARTBEAT_INTERVAL` | 60000 | 心跳间隔（毫秒） |
| `DEFAULT_PUNISHMENT_TIME` | 1 | 默认消息频率（每秒次数） |
| `DEFAULT_PUNISHMENT_DURATION` | 5 | 默认消息持续时间（秒） |
| `LOG_LEVEL` | info | 日志级别（error/warn/info/debug） |
| `VERBOSE` | false | 是否启用详细日志 |

## 日志

日志文件存储在 `logs/` 目录：

- `combined.log` - 所有日志
- `error.log` - 仅错误日志

日志会自动轮转，保留最近 10 个文件，每个最大 10MB。

## 协议

完整协议请参考项目根目录的 `README.md` 文件。

## 改进点（相比原代码）

1. ✅ **模块化**：各功能拆分为独立模块，代码更清晰易维护
2. ✅ **配置外部化**：所有配置项支持环境变量，无需修改代码
3. ✅ **结构化日志**：使用 winston 提供时间戳、级别、日志文件轮转
4. ✅ **修复 bug**：定时器 key 不一致问题已修复
5. ✅ **连接状态检查**：发送消息前检查 `ws.readyState === OPEN`
6. ✅ **优雅关闭**：支持 SIGTERM/SIGINT 信号，清理定时器和连接
7. ✅ **错误处理**：更完善的 try-catch 和未捕获异常处理
8. ✅ **代码注释**：所有公共方法都有 JSDoc 注释

## 测试

```bash
npm test  # 运行单元测试（如果有）
npm run lint  # 代码风格检查
```

## 注意事项

1. 重构后的代码使用 **ws** 库，与原版保持一致
2. 消息协议完全兼容原版，前端无需修改
3. 配对逻辑和定时器行为与原版一致
4. 建议先在测试环境运行，确认无问题后再部署生产环境
