var connectionId = ""; // 从服务器获取的连接标识符
var targetWSId = ""; // 发送目标的WebSocket标识符
var fangdou = 500; // 500ms防抖
var fangdouSetTimeOut; // 防抖定时器
let followAStrength = false; // 跟随A通道软上限
let followBStrength = false; // 跟随B通道软上限
var wsConn = null; // 全局ws链接

// APP按钮反馈消息映射
const feedBackMsg = {
    "feedback-0": "A通道：○",
    "feedback-1": "A通道：△",
    "feedback-2": "A通道：□",
    "feedback-3": "A通道：☆",
    "feedback-4": "A通道：⬡",
    "feedback-5": "B通道：○",
    "feedback-6": "B通道：△",
    "feedback-7": "B通道：□",
    "feedback-8": "B通道：☆",
    "feedback-9": "B通道：⬡",
}

// 预设波形数据
const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`
}

/*
 * ========== 消息格式说明 (v2) ==========
 *
 * 所有消息统一格式: { type, clientId, targetId, message, ...extras }
 *
 * --- 前端 → 服务端 ---
 * type 1   : 强度减少1    extras: { channel: 1|2 }
 * type 2   : 强度增加1    extras: { channel: 1|2 }
 * type 3   : 强度设置到   extras: { channel: 1|2, strength: 目标值 }
 * type 4   : 直接转发APP  message 为 APP 协议原始指令 (如 "clear-1")
 * clientMsg: 发送波形     extras: { channel: "A"|"B", time: 秒数 }
 *                         message 为 "通道前缀:波形数据"
 *
 * --- 服务端 → 前端 ---
 * bind     : 绑定相关 (初始分配clientId / 配对结果)
 * msg      : APP转发消息 (strength / feedback / pulse 等)
 * break    : 对方断开连接
 * error    : 错误信息
 * heartbeat: 心跳包
 * =======================================
 */

function connectWs() {
    //wsConn = new WebSocket("ws://12.34.56.78:9999/");
    wsConn = new WebSocket("ws://10.31.1.183:9999/");
    wsConn.onopen = function (event) {
        console.log("WebSocket连接已建立");
    };

    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        }
        catch (e) {
            // 服务端可能发送非JSON的纯文本消息(如 "发送完毕")
            console.log(event.data);
            return;
        }

        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    // 初次连接 — 服务端分配 clientId
                    connectionId = message.clientId;
                    console.log("收到clientId：" + message.clientId);
                    qrcodeImg.clear();
                    //qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://12.34.56.78:9999/" + connectionId);
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://10.31.1.183:9999/" + connectionId);
                }
                else {
                    // 配对结果
                    if (message.clientId != connectionId) {
                        alert('收到不正确的target消息' + message.message)
                        return;
                    }
                    targetWSId = message.targetId;
                    document.getElementById("status").innerText = "已连接";
                    document.getElementById("status").classList.remove("red");
                    document.getElementById("status-light").classList.remove("red");
                    document.getElementById("status-btn").innerText = "断开";
                    document.getElementById("status-btn").classList.add("red-background");
                    console.log("收到targetId: " + message.targetId + " msg: " + message.message);
                    hideqrcode();
                }
                break;
            case 'break':
                // 对方断开连接
                if (message.targetId != targetWSId)
                    return;
                showToast("对方已断开，code:" + message.message)
                location.reload();
                break;
            case 'error':
                if (message.targetId != targetWSId)
                    return;
                console.log(message);
                showToast(message.message);
                break;
            case 'msg':
                if (message.message.includes("strength")) {
                    // APP回传的强度数据: strength-{A强度}-{B强度}-{A软上限}-{B软上限}
                    const numbers = message.message.match(/\d+/g).map(Number);
                    document.getElementById("channel-a").innerText = numbers[0];
                    document.getElementById("channel-b").innerText = numbers[1];
                    document.getElementById("soft-a").innerText = numbers[2];
                    document.getElementById("soft-b").innerText = numbers[3];

                    // 跟随软上限: 当软上限与当前强度不一致时，自动设置强度到软上限
                    if (followAStrength && numbers[2] !== numbers[0]) {
                        sendWsMsg({ type: 3, channel: 1, strength: numbers[2], message: "set channel" });
                    }
                    if (followBStrength && numbers[3] !== numbers[1]) {
                        sendWsMsg({ type: 3, channel: 2, strength: numbers[3], message: "set channel" });
                    }
                }
                else if (message.message.includes("feedback")) {
                    // APP按钮反馈
                    showSuccessToast(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                console.log("收到心跳");
                if (targetWSId !== '') {
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                console.log("收到其他消息：" + JSON.stringify(message));
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("WebSocket连接发生错误");
    };

    wsConn.onclose = function (event) {
        showToast("连接已断开");
    };
}

// 自动连接
connectWs();

/**
 * 统一消息发送 — 自动填充 clientId 和 targetId
 * @param {Object} messageObj - 消息对象，必须包含 type 和 message 字段
 */
function sendWsMsg(messageObj) {
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    wsConn.send(JSON.stringify(messageObj));
}

/**
 * 强度控制 — 统一使用 type 1/2/3，由服务端构造 APP 协议指令
 * @param {number} type - 1:减少1 2:增加1 3:设置到指定值
 * @param {number} channelIndex - 1:A通道 2:B通道
 */
function addOrIncrease(type, channelIndex) {
    if (type === 3) {
        // 强度置0
        sendWsMsg({ type: 3, channel: channelIndex, strength: 0, message: "set channel" });
    } else {
        // type 1/2: 减少/增加1，具体数值由服务端处理
        sendWsMsg({ type, channel: channelIndex, message: "set channel" });
    }
}

/**
 * 清除通道波形队列 — 使用 type 4 直接转发 APP 指令
 * @param {number} channelIndex - 1:A通道 2:B通道
 */
function clearAB(channelIndex) {
    sendWsMsg({ type: 4, message: "clear-" + channelIndex });
}

/**
 * 失败时自动增加强度 — 使用 type 3 设置到目标值
 * @param {number} channelId - 1:A通道 2:B通道
 * @param {string} inputId - 增加量下拉菜单的DOM id
 * @param {string} currentId - 当前强度显示的DOM id
 * @param {boolean} follow - 是否开启了跟随软上限(开启则跳过)
 */
function autoAddStrength(channelId, inputId, currentId, follow) {
    if (!follow) {
        let addStrength = parseInt(document.getElementById(inputId).value, 10);
        let currentStrength = parseInt(document.getElementById(currentId).innerText, 10);
        let setTo = addStrength + currentStrength;
        if (addStrength > 0) {
            sendWsMsg({ type: 3, channel: channelId, strength: setTo, message: "set channel" });
        }
    }
}

/**
 * 发送波形数据 — 使用 clientMsg 类型，服务端会加上 "pulse-" 前缀后转发给 APP
 */
function sendCustomMsg() {
    if (fangdouSetTimeOut) {
        return;
    }

    autoAddStrength(1, "failed-a", "channel-a", followAStrength);
    autoAddStrength(2, "failed-b", "channel-b", followBStrength);

    const selectA = document.getElementById("wave-a").value;
    const selectB = document.getElementById("wave-b").value;
    const timeA = parseInt(document.getElementById("time-a").value, 10);
    const timeB = parseInt(document.getElementById("time-b").value, 10);

    sendWsMsg({ type: "clientMsg", message: `A:${waveData[selectA]}`, time: timeA, channel: "A" });
    sendWsMsg({ type: "clientMsg", message: `B:${waveData[selectB]}`, time: timeB, channel: "B" });

    fangdouSetTimeOut = setTimeout(() => {
        clearTimeout(fangdouSetTimeOut);
        fangdouSetTimeOut = null;
    }, fangdou);
}

function showToast(message) {
    let notyf = new Notyf();
    notyf.error(message);
}

function showSuccessToast(message) {
    let notyf = new Notyf();
    notyf.success(message);
}

/**
 * 切换跟随软上限开关
 * 开启后，当收到的软上限与当前强度不一致时，自动设置强度到软上限
 */
function toggleSwitch(id) {
    const container = document.getElementById(id);
    container.classList.toggle('on');
    const switchState = container.classList.contains('on');
    followAStrength = id === 'toggle1' ? switchState : followAStrength;
    followBStrength = id === 'toggle2' ? switchState : followBStrength;

    const currentStrength = parseInt(document.getElementById(id === 'toggle1' ? 'channel-a' : 'channel-b').innerText);
    const currentSoft = parseInt(document.getElementById(id === 'toggle1' ? 'soft-a' : 'soft-b').innerText);

    if (switchState && currentStrength !== currentSoft) {
        // 开启时立即同步到软上限 — 使用 type 3 设置强度
        console.log('软上限同步已开启');
        const channel = id === 'toggle1' ? 1 : 2;
        sendWsMsg({ type: 3, channel, strength: currentSoft, message: "set channel" });
    }
}

function connectOrDisconn() {
    if (wsConn && targetWSId === '') {
        showqrcode();
        return;
    } else {
        wsConn.close();
        showToast("已断开连接");
        location.reload();
    }
}