## 灵猫边缘控制传感器

### 蓝牙特性

| 服务 UUID | 特征 UUID | 属性     | 名称          | 大小（Byte） | 说明             |
|---------|---------|--------|-------------|----------|----------------|
| 0x180C  | 0x150A  | 写      | WRITE       | 最长 20 字节 | 所有的指令都在改特性输入   |
| 0x180C  | 0x150B  | 通知     | NOTIFY      | 最长 20 字节 | 所有的回应消息都在该特性返回 |
| 0x180A  | 0x1500  | 读 / 通知 | READ/NOTIFY | 1 字节     | 电量信息           |

> 基础 UUID：0000`xxxx`\-0000\-1000\-8000\-00805f9b34fb \(将 xxxx 替换为服务 / 特性 UUID\)

### 蓝牙名称

灵猫边缘控制传感器：`47L124000`

> Tip：设备开机后若搜索不到设备，请连按5次 设备开机按钮，屏幕中蓝牙图标变为黄色即可搜索

### 蓝牙指令

灵猫所有的指令都通过 180C \-\> 150A 的特性写入

#### B0 指令

B0 指令可开启 灵猫 主动上报 气压值（17 字节指令），在 0x180C \-\> 0x150B 可接收到 上报的气压值

```
0xB0 (1byte 指令 HEAD) + 01 (1byte 指示灯颜色) + D0 (1byte 启动气压上报) + 64 (1byte 固定写入) + 00000000000000000000000000 (13bytes 填充 00 占位)
```

#### 66 指令

66 指令可对设备进行 气压读值重置 / 屏幕显示方向翻转 的操作（12 字节指令）

```
0x66 (1byte 指令 HEAD) + 000000000000000000 (9bytes 填充 00 占位) + 01/03 (1byte 设定屏幕显示方向) + 02 (1byte 气压读值重置)
```

1. 设置气压读值重置（写入该条指令即可重置气压读值）

    ```
    0x660000000000000000000002
    ```

2. 设置屏幕显示方向，建议您将当前屏幕显示方向值进行记录，需要切换显示方向时，修改记录值即可

    ```TypeScript
    var screenRotate = 1;
    
    function setScreenRotate () {
        screenRotate = screenRotate === 1? 3 : 1;
    }
    
    // 写入该条指令即可 翻转屏幕显示方向
    `0x660000000000000000000${screenRotate}00`
    ```

### 蓝牙回应消息

灵猫所有的数据回调都通过 0x180C\-\>0x150B 的特性 Notify 返回，请在成功连接传感器后对该特性绑定 Notify

#### D0 消息

灵猫上报的气压值信息，每 100ms 上报当前气压值 \(17 字节消息 \)

```
1byte 指示灯颜色
    ↓↓
0xD0xxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ↑↑              ↑↑↑↑
1byte 消息 HEAD   2bytes 气压值
```

```TypeScript
const pressureBytes = "0xD0xxxxxxxxxxxxxx1603xxxxxxxxxx".substring(18,22)
const pressureDataView = new DataView(hex2ByteArray(pressureBytes));
const pressureValue = pressureDataView.getInt16(0, true) / 100; // 单位：kPa
console.log(`bytes = ${pressureBytes}, pressure = ${pressureValue}`);
// bytes = 1603, pressure = 7.9
// bytes = A806, pressure = 17.04
```