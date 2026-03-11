const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 储存已连接的用户及其标识
const clients = new Map();

// 存储消息关系
const relations = new Map();

const punishmentDuration = 5; //默认发送时间1秒

const punishmentTime = 1; // 默认一秒发送1次

// 存储客户端和发送计时器关系
const clientTimers = new Map();

// 定义心跳消息
const heartbeatMsg = {
    type: "heartbeat",
    clientId: "",
    targetId: "",
    message: "200"
};

// 定义定时器
let heartbeatInterval;

const wss = new WebSocket.Server({ port: 9999 });

wss.on('connection', function connection(ws) {
    // 生成唯一的标识符
    const clientId = uuidv4();

    console.log('新的 WebSocket 连接已建立，标识符为:', clientId);

    //存储
    clients.set(clientId, ws);

    // 发送标识符给客户端（格式固定，双方都必须获取才可以进行后续通信：比如浏览器和APP）
    ws.send(JSON.stringify({ type: 'bind', clientId, message: 'targetId', targetId: '' }));

    // 监听发信
    ws.on('message', function incoming(message) {
        console.log("收到消息：" + message)
        let data = null;
        try {
            data = JSON.parse(message);
        }
        catch (e) {
            // 非JSON数据处理
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '403' }))
            return;
        }

        // 非法消息来源拒绝
        if (clients.get(data.clientId) !== ws && clients.get(data.targetId) !== ws) {
            ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '404' }))
            return;
        }

        if (data.type && data.clientId && data.message && data.targetId) {
            // 优先处理绑定关系
            const { clientId, targetId, message, type } = data;
            switch (data.type) {
                case "bind":
                    // 服务器下发绑定关系
                    if (clients.has(clientId) && clients.has(targetId)) {
                        // relations的双方都不存在这俩id
                        if (![clientId, targetId].some(id => relations.has(id) || [...relations.values()].includes(id))) {
                            relations.set(clientId, targetId)
                            const client = clients.get(clientId);
                            const sendData = { clientId, targetId, message: "200", type: "bind" }
                            ws.send(JSON.stringify(sendData));
                            client.send(JSON.stringify(sendData));
                        }
                        else {
                            const data = { type: "bind", clientId, targetId, message: "400" }
                            ws.send(JSON.stringify(data))
                            return;
                        }
                    } else {
                        const sendData = { clientId, targetId, message: "401", type: "bind" }
                        ws.send(JSON.stringify(sendData));
                        return;
                    }
                    break;
                case 1:
                case 2:
                case 3:
                    // 服务器下发APP强度调节
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(targetId)) {
                        const client = clients.get(targetId);
                        const sendType = data.type - 1;
                        const sendChannel = data.channel ? data.channel : 1;
                        const sendStrength = data.type >= 3 ? data.strength : 1 //增加模式强度改成1
                        const msg = "strength-" + sendChannel + "+" + sendType + "+" + sendStrength;
                        const sendData = { type: "msg", clientId, targetId, message: msg }
                        client.send(JSON.stringify(sendData));
                    }
                    break;
                case 4:
                    // 服务器下发指定APP强度
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(targetId)) {
                        const client = clients.get(targetId);
                        const sendData = { type: "msg", clientId, targetId, message }
                        client.send(JSON.stringify(sendData));
                    }
                    break;
                case "clientMsg":
                    // 服务端下发给客户端的消息
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (!data.channel) {
                        // 240531.现在必须指定通道(允许一次只覆盖一个正在播放的波形)
                        const data = { type: "error", clientId, targetId, message: "406-channel is empty" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(targetId)) {
                        //消息体 默认最少一个消息
                        let sendtime = data.time ? data.time : punishmentDuration; // AB通道的执行时间
                        const target = clients.get(targetId); //发送目标
                        const sendData = { type: "msg", clientId, targetId, message: "pulse-" + data.message }
                        let totalSends = punishmentTime * sendtime;
                        const timeSpace = 1000 / punishmentTime;

                        if (clientTimers.has(clientId + "-" + data.channel)) {
                            // A通道计时器尚未工作完毕, 清除计时器且发送清除APP队列消息，延迟150ms重新发送新数据
                            // 新消息覆盖旧消息逻辑
                            console.log("通道" + data.channel + "覆盖消息发送中，总消息数：" + totalSends + "持续时间A：" + sendtime)
                            ws.send("当前通道" + data.channel + "有正在发送的消息，覆盖之前的消息")

                            const timerId = clientTimers.get(clientId + "-" + data.channel);
                            clearInterval(timerId); // 清除定时器
                            clientTimers.delete(clientId + "-" + data.channel); // 清除 Map 中的对应项

                            // 发送APP波形队列清除指令
                            switch (data.channel) {
                                case "A":
                                    const clearDataA = { clientId, targetId, message: "clear-1", type: "msg" }
                                    target.send(JSON.stringify(clearDataA));
                                    break;

                                case "B":
                                    const clearDataB = { clientId, targetId, message: "clear-2", type: "msg" }
                                    target.send(JSON.stringify(clearDataB));
                                    break;
                                default:
                                    break;
                            }

                            setTimeout(() => {
                                delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
                            }, 150);
                        } 
                        else {
                            // 不存在未发完的消息 直接发送
                            delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
                            console.log("通道" + data.channel +"消息发送中，总消息数：" + totalSends + "持续时间：" + sendtime)
                        }
                    } else {
                        console.log(`未找到匹配的客户端，clientId: ${clientId}`);
                        const sendData = { clientId, targetId, message: "404", type: "msg" }
                        ws.send(JSON.stringify(sendData));
                    }
                    break;
                default:
                    // 未定义的普通消息
                    if (relations.get(clientId) !== targetId) {
                        const data = { type: "bind", clientId, targetId, message: "402" }
                        ws.send(JSON.stringify(data))
                        return;
                    }
                    if (clients.has(clientId)) {
                        const client = clients.get(clientId);
                        const sendData = { type, clientId, targetId, message }
                        client.send(JSON.stringify(sendData));
                    } else {
                        // 未找到匹配的客户端
                        const sendData = { clientId, targetId, message: "404", type: "msg" }
                        ws.send(JSON.stringify(sendData));
                    }
                    break;
            }
        }
    });

    ws.on('close', function close() {
        // 连接关闭时，清除对应的 clientId 和 WebSocket 实例
        console.log('WebSocket 连接已关闭');
        // 遍历 clients Map，找到并删除对应的 clientId 条目
        let clientId = '';
        clients.forEach((value, key) => {
            if (value === ws) {
                // 拿到断开的客户端id
                clientId = key;
            }
        });
        console.log("断开的client id:" + clientId)
        relations.forEach((value, key) => {
            if (key === clientId) {
                //网页断开 通知app
                let appid = relations.get(key)
                let appClient = clients.get(appid)
                const data = { type: "break", clientId, targetId: appid, message: "209" }
                appClient.send(JSON.stringify(data))
                appClient.close(); // 关闭当前 WebSocket 连接
                relations.delete(key); // 清除关系
                console.log("对方掉线，关闭" + appid);
            }
            else if (value === clientId) {
                // app断开 通知网页
                let webClient = clients.get(key)
                const data = { type: "break", clientId: key, targetId: clientId, message: "209" }
                webClient.send(JSON.stringify(data))
                webClient.close(); // 关闭当前 WebSocket 连接
                relations.delete(key); // 清除关系
                console.log("对方掉线，关闭" + clientId);
            }
        })
        clients.delete(clientId); //清除ws客户端
        console.log("已清除" + clientId + " ,当前size: " + clients.size)
    });

    ws.on('error', function (error) {
        // 错误处理
        console.error('WebSocket 异常:', error.message);
        // 在此通知用户异常，通过 WebSocket 发送消息给双方
        let clientId = '';
        // 查找当前 WebSocket 实例对应的 clientId
        for (const [key, value] of clients.entries()) {
            if (value === ws) {
                clientId = key;
                break;
            }
        }
        if (!clientId) {
            console.error('无法找到对应的 clientId');
            return;
        }
        // 构造错误消息
        const errorMessage = 'WebSocket 异常: ' + error.message;

        relations.forEach((value, key) => {
            // 遍历关系 Map，找到并通知没掉线的那一方
            if (key === clientId) {
                // 通知app
                let appid = relations.get(key)
                let appClient = clients.get(appid)
                const data = { type: "error", clientId: clientId, targetId: appid, message: "500" }
                appClient.send(JSON.stringify(data))
            }
            if (value === clientId) {
                // 通知网页
                let webClient = clients.get(key)
                const data = { type: "error", clientId: key, targetId: clientId, message: errorMessage }
                webClient.send(JSON.stringify(data))
            }
        })
    });

    // 启动心跳定时器（如果尚未启动）
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            // 遍历 clients Map（大于0个链接），向每个客户端发送心跳消息
            if (clients.size > 0) {
                console.log(relations.size, clients.size, '发送心跳消息：' + new Date().toLocaleString());
                clients.forEach((client, clientId) => {
                    heartbeatMsg.clientId = clientId;
                    heartbeatMsg.targetId = relations.get(clientId) || '';
                    client.send(JSON.stringify(heartbeatMsg));
                });
            }
        }, 60 * 1000); // 每分钟发送一次心跳消息
    }
});

function delaySendMsg(clientId, client, target, sendData, totalSends, timeSpace, channel) {
    // 发信计时器 通道会分别发送不同的消息和不同的数量 必须等全部发送完才会取消这个消息 新消息可以覆盖
    target.send(JSON.stringify(sendData)); //立即发送一次通道的消息
    totalSends--;
    if (totalSends > 0) {
        return new Promise((resolve, reject) => {
            // 按频率发送消息给特定的客户端
            const timerId = setInterval(() => {
                if (totalSends > 0) {
                    target.send(JSON.stringify(sendData));
                    totalSends--;
                }
                // 如果达到发送次数上限，则停止定时器
                if (totalSends <= 0) {
                    clearInterval(timerId);
                    client.send("发送完毕")
                    clientTimers.delete(clientId); // 删除对应的定时器
                    resolve();
                }
            }, timeSpace); // 每隔频率倒数触发一次定时器

            // 存储clientId与其对应的timerId和通道
            clientTimers.set(clientId + "-" + channel, timerId);
        });
    }
}


