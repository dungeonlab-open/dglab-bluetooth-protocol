# 爪印无线按钮蓝牙协议说明

本文整理 `dungeonctl/src/pawprints.rs` 中已经实现的爪印无线按钮蓝牙控制内容，便于按照同一协议在其他语言或项目中接入。

## 蓝牙特性

| 服务 UUID | 特性 UUID | 属性 | 名称 | 说明 |
| :-------: | :-------: | :--: | :--: | :--- |
| 0x180C | 0x150A | 写 | WRITE | 写入设置、初始化、灯光等控制指令 |
| 0x180C | 0x150B | 通知 | NOTIFY | 返回按钮、姿态、调试等通知数据 |

> 基础 UUID：0000`xxxx`-0000-1000-8000-00805f9b34fb（将 xxxx 替换为服务或特性 UUID）

## 蓝牙名称

爪印无线按钮目前可匹配的广播名称：

- `47L120100`
- `47L120300`

## 初始化

连接设备并发现服务后，订阅 `0x150B` 通知特性，然后向 `0x150A` 写入默认设置包：

```text
50 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

该数据也是 `dungeonctl` 中 `Settings::default()` 的字节形式：

- 第 1 字节 `0x50`：设置指令头
- 第 2 字节 `0x01`：selector，原始 App 中也称为 `colorFrom`
- 第 3 字节 `0x00`：不启用触发模式
- 第 4 至 17 字节：保留为 `0x00`

## 设置指令

设置指令固定为 17 字节，写入 `0x150A`，格式如下：

```text
0x50 + selector + mode + mode data...
```

### 清除触发行为

```text
50 ss 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

`ss` 为 selector。

### 按钮触发模式

```text
50 ss 01 button_id event para_speed para_cancel_down para_down_speed para_increase 00 00 00 00 00 00 00 00
```

- `event = 0x00`：按下时触发
- `event = 0x01`：松开时触发

### 组合触发模式

```text
50 ss 02 short_click_id 00 long_click_id acceleration_id acceleration_mode comparison threshold_or_window... para_mapping debouncing cancel_debouncing
```

`acceleration_mode`：

- `0x00`：整体加速度阈值，后续为 `comparison + u16 threshold`
- `0x01`：旋转/角度阈值，后续为 `comparison + u16 threshold`
- `0x02`：固定 XYZ 窗口，后续为 `x_low x_high y_low y_high z_low z_high`

`comparison` 为 `0x00` 或 `0x01`，表示阈值比较方向。

### 外部电压检测模式

```text
50 ss 0F out_voltage_id pullup lower_threshold upper_threshold para_mapping 00 00 00 00 00 00 00 00 00
```

- `pullup = 0x00`：不启用内部上拉
- `pullup = 0x01`：启用内部上拉

外部电压检测的硬件说明和示例见[外部电压检测的解释与使用示例](../extvoltageinput/README.md)。

### 姿态数据流模式

```text
50 ss FF 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

该模式来自隐藏测试界面，用于请求姿态/运动数据流。

## 设置按钮灯光颜色

爪印按钮的灯光使用独立的短指令写入 `0x150A`：

```text
70 color
```

`color` 为 `0x00` 到 `0x08`。目前原始 App 与 `dungeonctl` 只暴露这 9 个原始值，没有稳定的颜色名称映射，因此建议在应用中以“颜色 0”到“颜色 8”或实际测试后的本地名称展示。

Rust 示例：

```rust
use dungeonctl::pawprints::{LedColor, PawPrints};

let pawprints = PawPrints::connect().await?;
pawprints.set_led_color(LedColor::Value3).await?;
```

## 通知数据

所有通知从 `0x150B` 返回。

### 按下通知

```text
5A selector 01 01
```

### 松开通知

```text
5B selector 01
```

### 状态通知

13 字节状态包：

```text
bottom_first bottom_second top overall[2] rotation[2] x[2] y[2] z[2]
```

其中 `overall`、`rotation`、`x`、`y`、`z` 均为大端有符号 16 位整数。

### 运动通知

```text
48 sound[2] x[2] y[2] z[2]
```

`sound`、`x`、`y`、`z` 均为大端有符号 16 位整数。

### 调试通知

```text
F1 00 xd[2] xu[2] yd[2] yu[2] zd[2] zu[2]
```

各阈值均为大端有符号 16 位整数。

