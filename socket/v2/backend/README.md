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

| 变量                          | 默认值 | 说明                              |
| ----------------------------- | ------ | --------------------------------- |
| `PORT`                        | 9999   | WebSocket 服务端口                |
| `HEARTBEAT_INTERVAL`          | 60000  | 心跳间隔（毫秒）                  |
| `DEFAULT_PUNISHMENT_TIME`     | 1      | 默认消息频率（每秒次数）          |
| `DEFAULT_PUNISHMENT_DURATION` | 5      | 默认消息持续时间（秒）            |
| `LOG_LEVEL`                   | info   | 日志级别（error/warn/info/debug） |
| `VERBOSE`                     | false  | 是否启用详细日志                  |

## 日志

日志文件存储在 `logs/` 目录：

- `combined.log` - 所有日志
- `error.log` - 仅错误日志

日志会自动轮转，保留最近 10 个文件，每个最大 10MB。

## 协议

完整协议请参考项目根目录的 `README.md` 文件。
