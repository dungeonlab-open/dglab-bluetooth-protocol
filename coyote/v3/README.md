## Coyote Stimulator V3

[简体中文](README_CN.md)

### Bluetooth Characteristics

| Service UUID | Characteristic UUID | Properties | Name | Size | Description |
| --- | --- | --- | --- | --- | --- |
| 0x180C | 0x150A | Write | WRITE | Up to 20 bytes | All commands are written here |
| 0x180C | 0x150B | Notify | NOTIFY | Up to 20 bytes | All response messages are returned here |
| 0x180A | 0x1500 | Read / Notify | READ/NOTIFY | 1 byte | Battery level |

> Base UUID: `0000xxxx-0000-1000-8000-00805f9b34fb`. Replace `xxxx` with the service or characteristic UUID.

### Bluetooth Names

Stimulator 3.0: `47L121000`

Wireless sensor: `47L120100`

### Overview

Coyote contains two independent pulse generators, one for each channel (A and B). Each generator is controlled by its channel intensity and Pulse data. Six parameters determine its output: channel intensity, channel intensity soft limit, Pulse frequency, Pulse intensity, Frequency Balance Parameter 1, and Frequency Balance Parameter 2.

### Bluetooth Commands

Unlike V2, this protocol does not require byte-order conversion.

#### B0 Command

The B0 command updates channel intensity and Pulse data. Send this 20-byte command every 100 ms. Both channels are included in the same command.

```
0xB0 (1-byte command header) + sequence number (4 bits) + intensity interpretation mode (4 bits) + channel A intensity setting (1 byte) + channel B intensity setting (1 byte) + 4 channel A Pulse frequency values (4 bytes) + 4 channel A Pulse intensity values (4 bytes) + 4 channel B Pulse frequency values (4 bytes) + 4 channel B Pulse intensity values (4 bytes)
```

##### Sequence Number

The sequence number ranges from `0b0000` to `0b1111`. When changing channel intensity, use a nonzero sequence number to request a B1 response containing the updated intensities and the same sequence number on characteristic `0x150B`. Set it to `0b0000` if no intensity response is needed.

When changing intensity with a nonzero sequence number, wait for a B1 response with the matching sequence number before making another intensity change.

##### Intensity Interpretation Mode

The upper two bits specify how to interpret channel A's intensity setting; the lower two bits specify the mode for channel B.

| Bits | Behavior |
| --- | --- |
| 0b00 | Leave the channel unchanged; ignore its intensity setting. |
| 0b01 | Increase by the setting. For example, 15 adds 15 to the current intensity. |
| 0b10 | Decrease by the setting. For example, 17 subtracts 17 from the current intensity. |
| 0b11 | Set an absolute intensity. For example, 32 sets the channel to 32. |

Each example below starts with both channels at intensity 10:

| Mode | A setting | B setting | Resulting A intensity | Resulting B intensity |
| --- | --- | --- | --- | --- |
| 0b0000 | 5 | 8 | 10 | 10 |
| 0b0100 | 5 | 8 | 15 | 10 |
| 0b0010 | 5 | 8 | 10 | 2 |
| 0b0011 | 5 | 8 | 10 | 8 |
| 0b0110 | 5 | 8 | 15 | 2 |
| 0b1101 | 5 | 8 | 5 | 18 |

##### Channel Intensity Setting

Each setting is one byte, with a valid range of 0–200. Out-of-range settings are treated as 0. Each channel's absolute intensity range is also 0–200.

Each example below starts with channel A at intensity 10:

| Mode | A setting | Resulting A intensity |
| --- | --- | --- |
| 0b0100 | 195 | 200 |
| 0b1000 | 20 | 0 |
| 0b0100 | 201 | 10 |
| 0b1100 | 201 | 0 |

##### Channel Pulse Frequency and Intensity

Each Pulse frequency value occupies one byte and ranges from 10 to 240. Each Pulse intensity value occupies one byte and ranges from 0 to 100.

Every B0 command contains four frequency/intensity pairs per channel. Each pair represents 25 ms of output, so four pairs cover 100 ms. If any value for a channel is out of range, the device discards all four pairs for that channel.

Your application can use Pulse frequency values from 10 to 1000, then convert them to the transmitted range as follows:

```
Input range: 10–1000
pulseFrequency = when (inputValue) {
    in 10..100 -> {
        inputValue
    }
    in 101..600 -> {
        (inputValue - 100)/5 + 100
    }
    in 601..1000 -> {
        (inputValue - 600)/10 + 200
    }
    else -> {
        10
    }
}
```

For example, for channel A:

1. Frequencies `{10,10,20,30}` and intensities `{0,5,10,50}` produce normal output.
2. Frequencies `{10,10,20,30}` and intensities `{0,5,10,101}` cause all four pairs to be discarded, producing no output.

- To output a Pulse on only one channel, include at least one invalid value in the other channel's data, such as a Pulse intensity above 100.

#### BF Command

> **⚠️ BF takes effect immediately and has no response. Send BF to set the soft limits after every reconnection to prevent unexpected soft-limit values.**

The 7-byte BF command sets the channel intensity soft limits, Pulse frequency balance parameters, and Pulse intensity balance parameters.

```
0xBF (1-byte command header) + channel A/B intensity soft limits (2 bytes) + channel A/B Pulse frequency balance parameters (2 bytes) + channel A/B Pulse intensity balance parameters (2 bytes)
```

##### Channel Intensity Soft Limit

The soft limit caps the maximum channel intensity and persists across power cycles. Valid values are 0–200; out-of-range values leave the existing limit unchanged.

For example, with limits of 150 for A and 30 for B, the intensities remain within 0–150 and 0–30 respectively, whether changed using a Wheel or a B0 command. Channel intensity cannot exceed its soft limit.

##### Frequency Balance Parameter 1

The Pulse frequency balance parameter adjusts the relative sensation of low- and high-frequency Pulses at a fixed channel intensity. Higher values produce a stronger throbbing sensation at low frequencies. It ranges from 0 to 255 and persists across power cycles.

##### Frequency Balance Parameter 2

The Pulse intensity balance parameter adjusts pulse width and the relative sensation of different frequencies at a fixed channel intensity. Higher values make low-frequency Pulses feel stronger. It ranges from 0 to 255 and persists across power cycles.

### Bluetooth Response Messages

All stimulator data is returned through notifications on `0x180C -> 0x150B`. Subscribe to this characteristic after connecting.

#### B1 Message

When channel intensity changes, the device immediately returns the current intensities in a B1 message. For a change caused by B0, the response uses the sequence number from that command; otherwise, the sequence number is 0.

```
0xB1 (1-byte command header) + sequence number (1 byte) + actual channel A intensity (1 byte) + actual channel B intensity (1 byte)
```

#### BE Message (Deprecated)

### More Examples

Unlike V2, V3 combines both channels' intensities and Pulse data in a single B0 command:

> Data = command header + sequence number + intensity interpretation mode + channel A intensity setting + channel B intensity setting + channel A Pulse frequencies {x,x,x,x} + channel A Pulse intensities {x,x,x,x} + channel B Pulse frequencies {x,x,x,x} + channel B Pulse intensities {x,x,x,x}

#### No.1: Continuous Pulse Output on A, Without Changing Channel Intensity

```
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000000A0A0A0A000A141E0000000000000065)
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000000F0F0F0F28323C460000000000000065)
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000001E1E1E1E505A64640000000000000065)
4-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}(HEX:0xB0000000283C5064645A5A5A0000000000000065)
...
```

#### No.2: Continuous Pulse Output on A, Starting at Intensity 10

```
1-> 0xB0+0b0000+0b0100+5+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00405000A0A0A0A000A141E0000000000000065)
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000000F0F0F0F28323C460000000000000065)
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000001E1E1E1E505A64640000000000000065)
4-> 0xB0+0b0001+0b0100+10+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}(HEX:0xB0140A00283C5064645A5A5A0000000000000065)
...
```

Step 1 adds 5 to channel A, bringing its intensity to 15. No intensity response is returned on 150B because the sequence number is 0.

Step 4 adds 10 to channel A, bringing its intensity to 25. The device returns channel A intensity 25 with sequence number 1 on 150B.

#### No.3: Continuous Pulse Output on A, Starting at Intensity 10

```
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000000A0A0A0A000A141E0000000000000065)
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000000F0F0F0F28323C460000000000000065)
3-> Flick channel A's Wheel upward once, then release it.
4-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{0,0,0,0}+{0,0,0,101}(HEX:0xB00000001E1E1E1E505A64640000000000000065)
5-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{100,90,90,90}+{0,0,0,0}+{0,0,0,101}(HEX:0xB0000000283C5064645A5A5A0000000000000065)
...
```

In step 3, flicking channel A's Wheel upward once and releasing it adds 1 to the intensity. The device returns channel A intensity 11 with sequence number 0 on 150B.

#### No.4: Continuous Pulse Output on Both Channels, Without Changing Intensity

```
1-> 0xB0+0b0000+0b0000+0+0+{10,10,10,10}+{0,10,20,30}+{10,10,10,10}+{0,0,0,0}(HEX:0xB00000000A0A0A0A000A141E0A0A0A0A00000000)
2-> 0xB0+0b0000+0b0000+0+0+{15,15,15,15}+{40,50,60,70}+{10,10,10,10}+{10,10,10,10}(HEX:0xB00000000F0F0F0F28323C460A0A0A0A0A0A0A0A)
3-> 0xB0+0b0000+0b0000+0+0+{30,30,30,30}+{80,90,100,100}+{10,10,10,10}+{0,0,0,10}(HEX:0xB00000001E1E1E1E505A64640A0A0A0A0000000A)
4-> 0xB0+0b0000+0b0000+0+0+{40,60,80,100}+{0,90,90,90}+{10,10,10,10}+{0,0,0,10}(HEX:0xB0000000283C5064005A5A5A0A0A0A0A0000000A)
...
```

Example of handling sequence numbers and intensity input for channel A:

```
isInputAllowed = true (whether intensity input is currently allowed)
accumulatedStrengthValueA = 0 (accumulated channel A intensity change not yet written)
deviceStrengthValueA = 0 (current channel A intensity on the stimulator)
orderNo = 0 (sequence number)
inputOrderNo = 0 (sequence number written in B0)
strengthParsingMethod = 0b0000 (intensity interpretation mode)
strengthSettingValueA = 0 (channel A intensity setting)

Function to process channel A intensity data
fun strengthDataProcessingA ():Unit {
    if (isInputAllowed == true) {
         strengthParsingMethod = if (accumulatedStrengthValueA > 0){
             0b0100
         } else if (accumulatedStrengthValueA < 0){
             0b1000
         } else {
             0b0000
         }
         orderNo += 1
         inputOrderNo = orderNo
         isInputAllowed = false
         strengthSettingValueA = abs (accumulatedStrengthValueA)(absolute value)
         accumulatedStrengthValueA = 0
     } else {
         orderNo = 0
         strengthParsingMethod = 0b0000
         strengthSettingValueA = 0
     }
}
Function to handle channel A intensity responses
fun strengthDataCallback (returnOrderNo : Int,returnStrengthValueA : Int):Unit {
    //returnOrderNo returned input sequence number
    //returnStrengthValueA returned current channel A intensity

    deviceStrengthValueA = returnStrengthValueA
    if (returnOrderNo == inputNo){
         isInputAllowed = true
         strengthParsingMethod = 0b0000
         strengthSettingValueA = 0
         inputOrderNo = 0
     }
}
Set channel A intensity to 0
fun strengthZero ():Unit {
    strengthParsingMethod = 0b1100
    strengthSettingValueA = 0
    orderNo = 1
    inputOrderNo = orderNo
}
```

The following steps are chronological; the step numbers do not represent specific timestamps:

```
1 -> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
2 -> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0001) + strengthParsingMethod (0b0100) + strengthSettingValueA (1) + ......)
3 -> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0000) + strengthParsingMethod (0b0000) + strengthSettingValueA (1) + ......)
3 -> 150B returns channel A intensity
     BLE NOTIFY 150B (0xB1 + returnOrderNo (1) + returnStrengthValueA (1) + ......)
     returned sequence number = 1, returned channel A intensity = 1
     strengthDataCallback (1,1)
4 -> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
5 -> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 2)
6 -> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 3)
7 -> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0001) + strengthParsingMethod (0b0100) + strengthSettingValueA (3) + ......)
8 -> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 1)
9 -> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0000) + strengthParsingMethod (0b0000) + strengthSettingValueA (0) + ......)
10-> 150B returns channel A intensity
     BLE NOTIFY 150B (0xB1 + returnOrderNo (1) + returnStrengthValueA (4) + ......)
     returned sequence number = 1, returned channel A intensity = 4
     strengthDataCallback (1,4)
11-> Press the channel A intensity '+' button
     accumulatedStrengthValueA += 1 (value = 2)
12-> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0001) + strengthParsingMethod (0b0100) + strengthSettingValueA (2) + ......)
13-> Press the channel A intensity '-' button
     accumulatedStrengthValueA -= 1 (value = -1)
14-> 150B returns channel A intensity
     BLE NOTIFY 150B (0xB1 + returnOrderNo (1) + returnStrengthValueA (6) + ......)
     returned sequence number = 1, returned channel A intensity = 6
     strengthDataCallback (1,6)
15-> (100ms cycle) B0 prepare to write
     strengthDataProcessingA ()
     BLE WRITE 150A (0xB0 + orderNo (0b0010) + strengthParsingMethod (0b1000) + strengthSettingValueA (1) + ......)
16-> 150B returns channel A intensity
     BLE NOTIFY 150B (0xB1 + returnOrderNo (2) + returnStrengthValueA (5) + ......)
     returned sequence number = 2, returned channel A intensity = 5
     strengthDataCallback (1,5)
17-> (100ms cycle) B0 prepare to write
     strengthZero ()
     BLE WRITE 150A (0xB0 + orderNo (0b0001) + strengthParsingMethod (0b1100) + strengthSettingValueA (0) + ......)
18-> 150B returns channel A intensity
     BLE NOTIFY 150B (0xB1 + returnOrderNo (1) + returnStrengthValueA (0) + ......)
     returned sequence number = 1, returned channel A intensity = 0
     strengthDataCallback (1,0)
......
```
