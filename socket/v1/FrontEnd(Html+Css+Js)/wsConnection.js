var connectionId = ""; // 从接口获取的连接标识符

var targetWSId = ""; // 发送目标

var fangdou = 500; //500毫秒防抖

var fangdouSetTimeOut; // 防抖定时器

let followAStrength = false; //跟随AB软上限

let followBStrength = false;

var wsConn = null; // 全局ws链接

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

const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`
}

function connectWs() {
    wsConn = new WebSocket("ws://12.34.56.78:9999/");
    //wsConn = new WebSocket("ws://localhost:9999/");
    wsConn.onopen = function (event) {
        console.log("WebSocket连接已建立");
    };

    wsConn.onmessage = function (event) {
        var message = null;
        try {
            message = JSON.parse(event.data);
        }
        catch (e) {
            console.log(event.data);
            return;
        }

        // 根据 message.type 进行不同的处理
        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    //初次连接获取网页wsid
                    connectionId = message.clientId; // 获取 clientId
                    console.log("收到clientId：" + message.clientId);
                    qrcodeImg.clear();
                    qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://12.34.56.78:9999/" + connectionId);
                    //qrcodeImg.makeCode("https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://192.168.3.235:9999/" + connectionId);
                }
                else {
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
                    console.log("收到targetId: " + message.targetId + "msg: " + message.message);
                    hideqrcode();
                }
                break;
            case 'break':
                //对方断开
                if (message.targetId != targetWSId)
                    return;
                showToast("对方已断开，code:" + message.message)
                location.reload();
                break;
            case 'error':
                if (message.targetId != targetWSId)
                    return;
                console.log(message); // 输出错误信息到控制台
                showToast(message.message); // 弹出错误提示框，显示错误消息
                break;
            case 'msg':
                // 定义一个空数组来存储结果
                const result = [];
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    result.push({ type: "strength", numbers });
                    document.getElementById("channel-a").innerText = numbers[0];
                    document.getElementById("channel-b").innerText = numbers[1];
                    document.getElementById("soft-a").innerText = numbers[2];
                    document.getElementById("soft-b").innerText = numbers[3];

                    if (followAStrength && numbers[2] !== numbers[0]) {
                        //开启跟随软上限  当收到和缓存不同的软上限值时触发自动设置
                        softAStrength = numbers[2]; // 保存 避免重复发信
                        const data1 = { type: 4, message: `strength-1+2+${numbers[2]}` }
                        sendWsMsg(data1);
                    }
                    if (followBStrength && numbers[3] !== numbers[1]) {
                        softBStrength = numbers[3]
                        const data2 = { type: 4, message: `strength-2+2+${numbers[3]}` }
                        sendWsMsg(data2);
                    }
                }
                else if (message.message.includes("feedback")) {
                    showSuccessToast(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                //心跳包
                console.log("收到心跳");
                if (targetWSId !== '') {
                    // 已连接上
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';

                    // 1秒后将颜色设置回 #ffe99d
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                console.log("收到其他消息：" + JSON.stringify(message)); // 输出其他类型的消息到控制台
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("WebSocket连接发生错误");
        // 在这里处理连接错误的情况
    };

    wsConn.onclose = function (event) {
        showToast("连接已断开");
    };
}

// 自动链接
connectWs();

function sendWsMsg(messageObj) {
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type'))
        messageObj.type = "msg";
    wsConn.send(JSON.stringify((messageObj)));
}

function toggleSwitch(id) {
    const element = document.getElementById(id);
    element.classList.toggle("switch-on");
    element.classList.toggle("switch-off");
}

function addOrIncrease(type, channelIndex, strength) {
    // 1 减少一  2 增加一  3 设置到
    // channel:1-A    2-B
    // 获取当前频道元素和当前值
    const channelElement = document.getElementById(channelIndex === 1 ? "channel-a" : "channel-b");
    let currentValue = parseInt(channelElement.innerText);

    // 如果是设置操作
    if (type === 3) {
        currentValue = 0; //固定为0
    }
    // 减少一
    else if (type === 1) {
        currentValue = Math.max(currentValue - strength, 0);
    }
    // 增加一
    else if (type === 2) {
        currentValue = Math.min(currentValue + strength, 200);
    }

    // 构造消息对象并发送
    const data = { type, strength: currentValue, message: "set channel", channel: channelIndex };
    console.log(data)
    sendWsMsg(data);
}

function clearAB(channelIndex) {
    const data = { type: 4, message: "clear-" + channelIndex }
    sendWsMsg(data);
}

function autoAddStrength(channelId, inputId, currentId, follow) {
    // 检查是否开启跟随软上限
    if (!follow) {
        let addStrength = parseInt(document.getElementById(inputId).value, 10);
        let currentStrength = parseInt(document.getElementById(currentId).innerText, 10);
        let setTo = addStrength + currentStrength;
        if (addStrength > 0) {
            const data = { type: 4, message: `strength-${channelId}+2+${setTo}` }
            sendWsMsg(data);
        }
    }
}

function sendCustomMsg() {
    if (fangdouSetTimeOut) {
        return;
    }

    autoAddStrength(1, "failed-a", "channel-a", followAStrength); // 给A通道加强度
    autoAddStrength(2, "failed-b", "channel-b", followBStrength); // 给B通道加强度

    const selectA = document.getElementById("wave-a").value;
    const selectB = document.getElementById("wave-b").value;
    const timeA = parseInt(document.getElementById("time-a").value, 10);
    const timeB = parseInt(document.getElementById("time-b").value, 10);

    const msg1 = `A:${waveData[selectA]}`;
    const msg2 = `B:${waveData[selectB]}`;

    const dataA = { type: "clientMsg", message: msg1, time: timeA, channel: "A" }
    const dataB = { type: "clientMsg", message: msg2, time: timeB, channel: "B" }
    sendWsMsg(dataA)
    sendWsMsg(dataB)

    fangdouSetTimeOut = setTimeout(() => {
        clearTimeout(fangdouSetTimeOut);
        fangdouSetTimeOut = null;
    }, fangdou);

}

function showToast(message) {
    let notyf = new Notyf();
    // Display a success notification
    //notyf.success(message);

    notyf.error(message);
}

function showSuccessToast(message) {
    let notyf = new Notyf();
    notyf.success(message);
}

function toggleSwitch(id) {
    // 获取开关元素 并切换开关状态
    const container = document.getElementById(id);
    container.classList.toggle('on');
    const switch1State = container.classList.contains('on');
    followAStrength = id === 'toggle1' ? switch1State : followAStrength;
    followBStrength = id === 'toggle2' ? switch1State : followBStrength;

    const currentStrength = parseInt(document.getElementById(id === 'toggle1' ? 'channel-a' : 'channel-b').innerText);
    const currentSoft = parseInt(document.getElementById(id === 'toggle1' ? 'soft-a' : 'soft-b').innerText);

    console.log(switch1State + '@' + currentStrength + '@' + currentSoft)

    if (switch1State && currentStrength !== currentSoft) {
        //马上判断是否和软上限符合
        console.log('不符合 马上变化')
        const channel = id === 'toggle1' ? 1 : 2;
        const data = { type: 4, message: `strength-${channel}+2+${currentSoft}` }
        sendWsMsg(data);
    }
}

function connectOrDisconn() {
    // 如果未连接则显示二维码
    if (wsConn && targetWSId === '') {
        showqrcode();
        return;
    } else {
        wsConn.close();
        showToast("已断开连接");
        location.reload();
    }
}