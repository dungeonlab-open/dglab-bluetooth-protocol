## SOCKET 控制 - 开源控制端 (v2)

### 说明

SOCKET 控制功能，是 DG-LAB APP 通过 WebSocket 服务连接到外部第三方控制端，控制端通过 SOCKET 向 APP 发送数据指令使郊狼进行脉冲输出的功能。开发者可以通过网页、游戏、脚本或其他终端在局域网环境或公网环境中对郊狼进行控制。

该功能仅支持 **郊狼脉冲主机 3.0**

### 设计方案

N(APP 终端) ↔ SOCKET 服务 ↔ N(第三方终端) 的 **N 对 N** 模式，方便开发者制作的控制端可以同时多人使用。

项目分为两部分：
- **前端控制部分** — 逻辑控制、数据展示、行为操作、指令数据生成等
- **WebSocket 后端部分** — 关系绑定、消息验证、数据转发、波形队列管理等

### 项目结构

```
socket/
├── README.md                    # 本文档
├── Quick Experience Guide.md    # 快速体验指南
├── 快速体验.md
├── QA/                          # 常见问题
│   ├── Websocket_open_source_QA_Chinese.txt
│   └── Websocket_open_source_QA_English.txt
├── v2/                          # ✅ 推荐使用
│   ├── backend/                 # WebSocket 后端 (Node.js)
│   │   ├── src/
│   │   │   ├── index.js         # 主入口，启动服务器 & 消息路由
│   │   │   ├── config.js        # 配置管理（支持 .env 环境变量）
│   │   │   ├── connection.js    # 连接管理（注册、配对、断开）
│   │   │   ├── message.js       # 消息处理（验证、转发、强度/波形）
│   │   │   ├── timer.js         # 定时器管理（波形消息队列发送）
│   │   │   └── logger.js        # 日志模块（winston）
│   │   └── package.json
│   └── frontend/                # 前端控制页面 (HTML+CSS+JS)
│       ├── index.html
│       ├── index.js
│       ├── index.css
│       └── wsConnection.js      # WebSocket 通信核心
└── v1/                          # ⚠️ 旧版（不推荐使用，仅供参考）
```

### 快速开始

#### 1. 启动后端

```bash
cd socket/v2/backend
npm install
npm start          # 生产模式
# 或
npm run dev        # 开发模式（自动重启）
```

默认监听端口 `9999`，可通过 `.env` 文件配置：

| 变量                          | 默认值 | 说明                     |
| ----------------------------- | ------ | ------------------------ |
| `PORT`                        | 9999   | WebSocket 服务端口       |
| `HEARTBEAT_INTERVAL`          | 60000  | 心跳间隔（毫秒）         |
| `DEFAULT_PUNISHMENT_TIME`     | 1      | 波形发送频率（每秒次数） |
| `DEFAULT_PUNISHMENT_DURATION` | 5      | 波形默认持续时间（秒）   |
| `LOG_LEVEL`                   | info   | 日志级别                 |

#### 2. 打开前端

用浏览器打开 `socket/v2/frontend/index.html`，修改 `wsConnection.js` 中的 WebSocket 地址为你的实际服务器地址。

#### 3. 连接 APP

1. 打开 DG-LAB APP → SOCKET 功能
2. 前端页面右上角的【连接】点击后会显示二维码
3. APP 打开SOCKET控制后，点击连接服务器，扫描二维码即可完成配对

---

### 消息格式总则

所有消息均为 **JSON 格式**，统一包含以下字段：

```json
{ "type": "xxx", "clientId": "xxx", "targetId": "xxx", "message": "xxx" }
```

| 字段       | 说明                       |
| ---------- | -------------------------- |
| `type`     | 消息类型（见下方详细说明） |
| `clientId` | 第三方终端 ID（网页端）    |
| `targetId` | APP 端 ID                  |
| `message`  | 消息内容 / 指令            |

> ⚠️ JSON 数据的字符最大长度为 **1950**，超过该长度 APP 会丢弃该消息
>
> ⚠️ 除初始连接时服务端返回 clientId 的消息 `targetId` 可为空外，其他所有消息必须包含以上 4 个字段且 value 不为空
>
> ⚠️ SOCKET 服务生成的 ID 必须保证唯一，推荐使用 UUID v4

---

### 消息流程概览

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│  前端     │  ──→    │  WebSocket   │  ──→    │  APP     │
│ (网页端)  │  ←──    │    服务端     │  ←──    │ (DG-LAB) │
└──────────┘         └──────────────┘         └──────────┘
```

#### 连接配对流程

```
1. 前端连接 WS 服务               → 服务端分配 clientId 返回给前端
2. 前端生成二维码（含 WS 地址 + clientId）
3. APP 扫码后连接 WS 服务          → 服务端分配 targetId 返回给 APP
4. APP 发送 bind 请求（clientId + targetId）
5. 服务端建立配对关系              → 向双方发送绑定成功消息 (message: "200")
6. 配对完成，双方可以开始通信
```

#### 强度控制流程

```
前端                    服务端                     APP
 │                        │                         │
 │  type:1/2/3            │                         │
 │  (减少/增加/设置强度)     │                         │
 │───────────────────────→│                         │
 │                        │  type:"msg"             │
 │                        │  strength-通道+模式+数值  │
 │                        │────────────────────────→│
 │                        │                         │
 │                        │  type:"msg"             │
 │                        │  strength-A强度+B强度    │
 │                        │  +A上限+B上限（回传）     │
 │                        │←────────────────────────│
 │  type:任意(APP原始类型)  │                         │
 │  strength-...(转发)     │                         │
 │←────────────────────── │                         │
```

#### 波形发送流程

```
前端                    服务端                     APP
 │                        │                         │
 │  type:"clientMsg"      │                         │
 │  channel:"A"/"B"       │                         │
 │  message:"A:波形数据"   │                         │
 │───────────────────────→│                         │
 │                        │  type:"msg"             │
 │                        │  pulse-A:波形数据        │
 │                        │  (按频率定时发送)         │
 │                        │────────────────────────→│
 │                        │────────────────────────→│
 │                        │  ... (重复至 time 期满)   │
```

---

### 前端 → 服务端 消息格式

前端发送的消息由服务端转换为 APP 协议格式后转发给 APP。

> ⚠️ **前端协议的消息不能直接发送给 APP**，APP 无法解析

#### 强度减少 (type: 1)

```json
{ "type": 1, "channel": 1, "message": "set channel", "clientId": "xxx", "targetId": "xxx" }
```
- `channel`: `1` = A 通道，`2` = B 通道
- 服务端转换后发给 APP: `strength-通道+0+1`（减少 1）

#### 强度增加 (type: 2)

```json
{ "type": 2, "channel": 1, "message": "set channel", "clientId": "xxx", "targetId": "xxx" }
```
- 服务端转换后发给 APP: `strength-通道+1+1`（增加 1）

#### 强度设置到指定值 (type: 3)

```json
{ "type": 3, "channel": 2, "strength": 35, "message": "set channel", "clientId": "xxx", "targetId": "xxx" }
```
- `strength`: 目标强度值（0 ~ 200）
- 服务端转换后发给 APP: `strength-通道+2+目标值`（设为指定值）

#### 直接转发 APP 指令 (type: 4)

```json
{ "type": 4, "message": "clear-1", "clientId": "xxx", "targetId": "xxx" }
```
- `message` 内容直接作为 APP 指令转发（如 `clear-1` 清空 A 通道波形队列）

#### 发送波形 (type: "clientMsg")

```json
{ "type": "clientMsg", "channel": "A", "time": 5, "message": "A:[\"0A0A0A0A64646464\",...]", "clientId": "xxx", "targetId": "xxx" }
```
- `channel`: `"A"` 或 `"B"`
- `time`: 波形持续发送时长（秒），默认 5 秒
- `message`: `通道:波形HEX数组JSON`
- 服务端会加上 `pulse-` 前缀后按频率定时发送给 APP

---

### 服务端 → APP 消息格式

服务端发给 APP 的消息统一为 `type: "msg"` 格式：

```json
{ "type": "msg", "clientId": "xxx", "targetId": "xxx", "message": "指令内容" }
```

#### 强度操作指令

`message`: `strength-通道+模式+数值`

| 字段 | 说明                                     |
| ---- | ---------------------------------------- |
| 通道 | `1` = A 通道，`2` = B 通道               |
| 模式 | `0` = 减少，`1` = 增加，`2` = 设为指定值 |
| 数值 | 0 ~ 200                                  |

举例：
- `strength-1+1+5` → A 通道强度 +5
- `strength-2+2+0` → B 通道强度归零
- `strength-1+2+35` → A 通道强度设为 35

> ⚠️ 指令必须严格按照协议编写，非法指令会被 APP 丢弃

#### 波形操作指令

`message`: `pulse-通道:["HEX波形数据",...]`

- 通道: `A` 或 `B`
- 波形数据: 8 字节 HEX 格式，每条代表 100ms
- 数组最大长度 100（10 秒数据），APP 波形队列最大缓存 500 条（50 秒）
- 波形数据详情参考 socket/DG_WAVES_V2_V3_simple.js 中 **expectedV3** 内容

> 💡 为保证波形输出连续性，建议发送间隔略小于波形数据时长

#### 清空波形队列

`message`: `clear-通道`

- `clear-1` → 清空 A 通道波形队列
- `clear-2` → 清空 B 通道波形队列

> 💡 建议清空指令下发后稍等片刻再发送新波形数据，避免网络延迟导致数据丢失

---

### APP → 服务端 → 前端 消息格式

APP 发送的消息由服务端转发给前端。

#### 强度回传

APP 通道强度或上限变化时，自动上报当前状态。服务端会将该消息**转发给前端**。

`message`: `strength-A强度+B强度+A上限+B上限`

```json
{ "type": "msg", "clientId": "xxx", "targetId": "xxx", "message": "strength-11+7+100+35" }
```

解释：A 通道强度=11，B 通道强度=7，A 通道上限=100，B 通道上限=35（值范围 0 ~ 200）

#### APP 反馈按钮

APP 用户点击反馈图标时上报。服务端将该消息**转发给前端**。

`message`: `feedback-角标`

| 角标 | 位置            |
| ---- | --------------- |
| 0~4  | A 通道 5 个按钮 |
| 5~9  | B 通道 5 个按钮 |

---

### 服务端 → 前端 控制消息

#### 绑定消息 (type: "bind")

```json
// 初次连接 - 分配 clientId（targetId 为空）
{ "type": "bind", "clientId": "uuid-v4", "targetId": "", "message": "targetId" }

// 配对成功
{ "type": "bind", "clientId": "xxx", "targetId": "xxx", "message": "200" }

// 配对失败
{ "type": "bind", "clientId": "xxx", "targetId": "xxx", "message": "400" }
```

#### 断开通知 (type: "break")

```json
{ "type": "break", "clientId": "xxx", "targetId": "xxx", "message": "209" }
```

#### 错误消息 (type: "error")

```json
{ "type": "error", "clientId": "xxx", "targetId": "xxx", "message": "402" }
```

#### 心跳包 (type: "heartbeat")

```json
{ "type": "heartbeat", "clientId": "xxx", "targetId": "xxx", "message": "200" }
```

默认每 60 秒发送一次，可通过 `HEARTBEAT_INTERVAL` 环境变量配置。

---

### 终端二维码协议

第三方终端的二维码必须按照以下格式生成，否则 APP 无法识别：

```
https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://你的服务器地址:端口/终端ID
```

规则：
1. 必须包含 APP 官网下载地址: `https://www.dungeon-lab.com/app-download.php`
2. 必须包含标签: `DGLAB-SOCKET`
3. 必须包含 SOCKET 服务地址 + 终端 ID，中间不得有额外路径
4. 有且仅有 **两个 `#`** 分隔以上三部分
5. 不可包含其他多余内容

✅ 正确: `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://ws.example.com/xxxx-xxxx-xxxx`

❌ 错误: `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#wss://ws.example.com/path/xxxx-xxxx-xxxx`

---

### 错误码

| 错误码 | 说明                             |
| ------ | -------------------------------- |
| 200    | 成功                             |
| 209    | 对方客户端已断开                 |
| 210    | 二维码中没有有效的 clientID      |
| 211    | 连接成功但服务器未下发 APP 端 ID |
| 400    | 此 ID 已被其他客户端绑定         |
| 401    | 要绑定的目标客户端不存在         |
| 402    | 收信方和寄信方不是绑定关系       |
| 403    | 发送的内容不是标准 JSON 对象     |
| 404    | 未找到收信人（离线）             |
| 405    | 下发的 message 长度大于 1950     |
| 406    | 缺少 channel 字段                |
| 500    | 服务器内部异常                   |

---

### 相关资源

- [快速体验指南](Quick%20Experience%20Guide.md)
- [常见问题 (中文)](QA/Websocket_open_source_QA_Chinese.txt)
- [常见问题 (English)](QA/Websocket_open_source_QA_English.txt)
- [郊狼 V3 蓝牙协议](../coyote/v3/README_V3.md)
- [波形数据简易说明](DG_WAVES_V2_V3_simple.js)

> 如有问题，请咨询 service@dungeon-lab.com
