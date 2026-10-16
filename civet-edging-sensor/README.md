## Civet Edging Sensor

[简体中文](README_CN.md)

### Bluetooth Characteristics

| Service UUID | Characteristic UUID | Properties    | Name        | Size           | Description                             |
|--------------|---------------------|---------------|-------------|----------------|-----------------------------------------|
| 0x180C       | 0x150A              | Write         | WRITE       | Up to 24 bytes | All commands are written here           |
| 0x180C       | 0x150B              | Notify        | NOTIFY      | Up to 20 bytes | All response messages are returned here |
| 0x180A       | 0x1500              | Read / Notify | READ/NOTIFY | 1 byte         | Battery level                           |

> Base UUID: `0000xxxx-0000-1000-8000-00805f9b34fb`. Replace `xxxx` with the service or characteristic UUID.

### Bluetooth Name

Civet Edging Sensor: `47L124000`

> If the powered-on device does not appear during discovery, press the power button five times in succession. The Bluetooth icon turns yellow when the device is discoverable.

### Bluetooth Commands

Write all Civet commands to characteristic `0x150A` in service `0x180C`.

### Notifications

All Civet data, including pressure updates, is returned through notifications on `0x180C -> 0x150B`. Subscribe to this characteristic after connecting.

#### 50 Command

The 50 command starts or stops pressure reporting (17 bytes). Pressure reports are received on `0x180C -> 0x150B`.

```
0x50 (1-byte command header) + 01 (1-byte indicator color) + D0/00 (1 byte: D0 starts pressure reporting; 00 stops it) + 0000000000000000000000000000 (14 bytes of 00 padding)
```

#### D0 Message

Civet reports the current pressure every 100 ms (17-byte message).

```
1-byte indicator color (for example, 01 = yellow)
     ↓↓
0xD0 xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx
  ↑↑                      ↑↑↑↑
1-byte message header  2-byte pressure value (bytes 8 and 9)
```

```TypeScript
// Example pressure conversion
const pressureBytes = "0xD001xxxxxxxxxxxx1603xxxxxxxxxx".substring(18,22)
const pressureDataView = new DataView(hex2ByteArray(pressureBytes));
const pressureValue = pressureDataView.getInt16(0, true) / 100; // Unit: kPa
console.log(`bytes = ${pressureBytes}, pressure = ${pressureValue}`);
// bytes = 1603, pressure = 7.9
// bytes = A806, pressure = 17.04
```

#### 66 Command

The 66 command resets the pressure reading or flips the display orientation (13-byte command).

```
0x66 (1-byte command header) + 000000000000000000 (9 bytes of 00 padding) + 01/03 (1-byte display orientation; use 00 when only resetting pressure to zero) + 0002 (int16 pressure reset; use 0000 when only changing orientation)
```

1. Reset the pressure reading by writing:

    ```
    0x66000000000000000000000002
    ```

2. Change the display orientation. Keep track of the current orientation and toggle the stored value when needed:

    ```TypeScript
    var screenRotate = 1;

    function setScreenRotate () {
        screenRotate = screenRotate === 1? 3 : 1;
    }

    // Write this command to flip the display orientation.
    `0x660000000000000000000${screenRotate}0000`
    ```
