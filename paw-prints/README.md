# Pawprint Wireless Button Sensor 1.1

[简体中文](README_CN.md)

## Bluetooth Characteristics

| Service UUID | Characteristic UUID | Properties | Name   | Size           | Description                             |
|--------------|---------------------|------------|--------|----------------|-----------------------------------------|
| 0x180C       | 0x150A              | Write      | WRITE  | Up to 20 bytes | All commands are written here           |
| 0x180C       | 0x150B              | Notify     | NOTIFY | Up to 20 bytes | All response messages are returned here |

> Base UUID: `0000xxxx-0000-1000-8000-00805f9b34fb`. Replace `xxxx` with the service or characteristic UUID.

## Bluetooth Name

Pawprint Wireless Button Sensor V1.1: `47L120300`

> 1. After powering on the device, press and hold the button. The device becomes discoverable when its three shoulder lights alternate between white and blue.
> 2. A device named `47L120100` is a V1.0 unit. In the DG-LAB 3.0 app, go to **Settings → Update Accessory Firmware** and follow the instructions to update it to V1.1.

## Bluetooth Commands

Write all Pawprint commands to characteristic `0x150A` in service `0x180C`.

### 50 Command

The 50 command sets the main indicator color and interaction trigger mode, or enables/disables automatic state reporting (17 bytes).

> Send a 50 command immediately after connecting, or Pawprint may disconnect. Start with the no-trigger mode if a trigger mode has not yet been selected.

```
0x50 (1-byte command header) + xx (1-byte indicator color) + xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (15-byte trigger mode configuration)
```

#### Trigger Mode Configuration Layout

```
xx (1-byte trigger mode) + xxxxxxxxxxxxxxxxxxxxxxxxxxxx (14-byte trigger settings)
```

| Trigger mode | Description                                          |
|--------------|------------------------------------------------------|
| 0x00         | No trigger                                           |
| 0x03         | Random reaction trigger                              |
| 0x04         | Probability trigger                                  |
| 0x0F         | External voltage detection trigger                   |
| 0x05         | Press/release trigger and acceleration/angle trigger |

#### No-Trigger Mode

Send a 50 command immediately after connecting. Use this mode until you have selected a trigger mode.

**Trigger settings**

```
0x00 (1-byte trigger mode) + 0000000000000000000000000000 (14 bytes of 00 padding)
```

#### Accessory Interaction Trigger Modes

The following settings configure the five trigger modes available for accessory interactions in the app.

##### Random Reaction Trigger

Pawprint turns its shoulder lights green after a random delay within the configured range. If the button is pressed within the reaction time, the lights turn off and the device prepares for the next green light. Otherwise, it triggers the configured event and flashes the shoulder lights red. Pressing the button while the event is active clears the trigger and prepares for the next green light.

**Trigger settings**

> See [Parameter](#parameter) for the meaning of parameter values.

```
0x03 (1-byte trigger mode) +
xx (1-byte trigger event ID) +
xxxxxxxx (4-byte random delay range before the green light) +
xxxx (2-byte reaction time) +
xx (1-byte parameter increase rate while active) +
xx (1-byte parameter decrease on deactivation) +
xx (1-byte continuous parameter decrease rate after deactivation) +
xx (1-byte parameter increase on activation) +
000000 (3 bytes of 00 padding)
```

| Field                                                 | Size    | Range   | Description                                                                                                                                                                                                                              |
|-------------------------------------------------------|---------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Trigger event ID                                      | 1 byte  | 1–24    | Included in the event report if the button is not pressed within the reaction time.                                                                                                                                                      |
| Random green-light delay                              | 4 bytes | 1–65535 | Two 2-byte bounds define the random delay range, in seconds, before the shoulder lights turn green.                                                                                                                                      |
| Reaction time                                         | 2 bytes | 1–65535 | Time in seconds to press the button after the lights turn green. Pawprint reports a trigger event if this expires.                                                                                                                       |
| Parameter increase on activation                      | 1 byte  | 0–255   | Immediately adds this amount to the parameter and includes the updated value in the activation report.                                                                                                                                   |
| Parameter increase rate while active                  | 1 byte  | 0–120   | Encodes the time to increase from 0 to 255. Values 0 or >120 disable continuous increases; 1–60 mean 1–60 seconds; 61–120 mean 1–60 minutes. Pawprint reports each parameter change. For example, 40 means 40 seconds, or 6.375 units/s. |
| Parameter decrease on deactivation                    | 1 byte  | 0–255   | Immediately subtracts this amount when the trigger clears and reports the updated parameter.                                                                                                                                             |
| Continuous parameter decrease rate after deactivation | 1 byte  | 0–120   | Encodes the time to decrease from 255 to 0. Values 0 or >120 disable continuous decreases; 1–60 mean 1–60 seconds; 61–120 mean 1–60 minutes. Pawprint reports each parameter change. For example, 40 means 40 seconds, or 6.375 units/s. |

```TypeScript
// Random reaction trigger: event ID = 7; green-light delay = 30–50 seconds;
// reaction time = 10 seconds; parameter +20 on activation;
// increase time = 20 seconds (12.75/s); parameter -50 on deactivation;
// subsequent decrease time = 20 seconds (12.75/s).
HEX = `50010307001E0032000A14143214000000`
```

##### Probability Trigger

Each press can trigger one of up to six configured events, according to their probabilities. The probabilities do not have to add up to 100%; the unassigned probability represents no event. When an event is triggered, the shoulder lights briefly flash in multiple colors, then stop and clear the trigger after 1 second. Unless the configured probabilities guarantee an event, a press may produce no event.

**Trigger settings**

```
0x04 (1-byte trigger mode) +
xx (1-byte event x1 ID) + xx (1-byte x1 probability) +
xx (1-byte event x2 ID) + xx (1-byte x2 probability) +
xx (1-byte event x3 ID) + xx (1-byte x3 probability) +
xx (1-byte event x4 ID) + xx (1-byte x4 probability) +
xx (1-byte event x5 ID) + xx (1-byte x5 probability) +
xx (1-byte event x6 ID) + xx (1-byte x6 probability) +
xxxx (2-byte cooldown)
```

| Field               | Size    | Range                      | Description                                                                                                                                                                                                                                                      |
|---------------------|---------|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Event ID            | 1 byte  | 1–24                       | Up to six distinct IDs. Fill unused slots with 0x00. When a press triggers an event, Pawprint reports its ID.                                                                                                                                                    |
| Trigger probability | 1 byte  | Sum of all six values ≤200 | Values 0–200 map to 0–100%, in 0.5% increments. A probability is ignored if its event ID is invalid; unused slots need no probability setting. If the total exceeds 200, Pawprint removes the excess starting at x6, then x5, and so on until the total is ≤200. |
| Cooldown            | 2 bytes | 0–65535                    | Duration in seconds after every trigger attempt, including attempts that produce no event. Presses cannot trigger another attempt during cooldown. The shoulder lights remain white until cooldown ends, then turn off.                                          |

```TypeScript
// Event 5: 60 (30%); event 2: 80 (40%); cooldown: 600 seconds.
HEX = `500104053C025000000000000000000258`

// Event 1: 20 (10%); event 8: 30 (15%); event 11: 40 (20%);
// event 4: 50 (25%); event 5: 70 (35%); event 6: 70 (35%);
// cooldown: 600 seconds.
HEX = `5001040114081E0B280432054606460258`
// The total is 20+30+40+50+70+70 = 280, exceeding 200.
// Event 6 is reduced to 0 (0%), leaving 210.
// Event 5 is then reduced to 60 (30%), leaving 200.
// The resulting configuration is equivalent to:
HEX = `5001040114081E0B280432053C06000258`
```

##### External Voltage Detection Trigger

This mode uses an external voltage signal to trigger an event. It reuses the CC1 pin of the 6-pin Type-C charging port as the voltage input (measurement range: 0–2.1 V; hardware voltage limit: 3.0 V). **Do not charge the button while using this mode, and observe connection polarity.** See [External Voltage Detection: Explanation and Examples](extvoltageinput/README.md) for DIY guidance.

**Trigger settings**

> See [Parameter](#parameter) for the meaning of parameter values.

```
0x0F (1-byte trigger mode) +
xx (1-byte trigger event ID) +
xx (1-byte internal pull-up setting: high level / high impedance) +
xxxx (2-byte target voltage range) +
xx (1-byte parameter mapping range) +
000000000000000000 (9 bytes of 00 padding)
```

| Field                   | Size    | Range | Description                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|-------------------------|---------|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Trigger event ID        | 1 byte  | 1–24  | Included in the event report when the voltage is outside the target range.                                                                                                                                                                                                                                                                                                                                                                            |
| Internal pull-up        | 1 byte  | 0–1   | 0: high level; 1: high impedance. High level enables an internal 3.3 V pull-up through a 10 kΩ resistor, with a 4.8 kΩ resistor to ground. With no external resistor, the input is approximately 1.07 V. Connect a variable resistor between the detection pin and ground to detect resistance changes.                                                                                                                                               |
| Target voltage range    | 2 bytes | 0–255 | Lower and upper bounds, one byte each. Values 0–255 map to 0.00–2.10 V. Voltage = `input <= 232 ? Round(input / 8) * 0.07 V : 2.1 V`.                                                                                                                                                                                                                                                                                                                 |
| Parameter mapping range | 1 byte  | 0–255 | Values 0–255 map to 0.00–2.10 V. For a target range of 0.49–1.47 V and a mapping range of 0.49 V, the parameter is 0 at the upper bound (1.47 V), reaching its maximum at ≥1.96 V (1.47 + 0.49 V). The same applies below the lower bound (0.49 V). For voltages X closer than 0.49 V to either bound (0 < X < 0.49 or 1.47 < X < 1.96), the parameter maps linearly to 0–2.1. Formula: parameter = (X − parameter mapping range value) / 0.49 * 2.1. |

```TypeScript
// External voltage trigger: event ID = 7; high-level mode;
// target voltage range = 1.3–1.8 V; parameter mapping range = 0.8 V.
HEX = `50010F070098D058000000000000000000`
```

##### Press/Release Trigger and Acceleration/Angle Trigger

Pawprint V1.1 supports using press/release detection and acceleration/angle detection together, so both are configured in a single command.

In press/release mode, Pawprint reports an event when the selected button state is detected. The shoulder lights flash white while the trigger is active.

Acceleration/angle detection has two mutually exclusive submodes:

1. **Acceleration:** Reports an event when acceleration is above or below the configured threshold. The shoulder lights flash white while active.
2. **Angle:** Reports an event when an X, Y, or Z angle is outside its configured range. The shoulder lights flash white while active. Automatic detection can determine the current XYZ threshold ranges.

**Trigger settings**

> See [Parameter](#parameter) for the meaning of parameter values.

```
0x05 (1-byte trigger mode) +
xx (1-byte press/release event ID) +
xx (1-byte packed settings: press/release mode + acceleration/angle submode + activation debounce + deactivation debounce) +
xx (1-byte press/release parameter increase rate while active) +
xx (1-byte press/release parameter decrease on deactivation) +
xx (1-byte press/release parameter decrease rate after deactivation) +
xx (1-byte press/release parameter increase on activation) +
xx (1-byte acceleration/angle event ID) +
xxxxxxxxxxxx (6-byte acceleration threshold settings or XYZ angle threshold ranges) +
xx (1-byte acceleration/angle parameter mapping range)
```

| Field                                                    | Size    | Range                | Description                                                                                                                                                                                                               |
|----------------------------------------------------------|---------|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Press/release event ID                                   | 1 byte  | 1–24                 | A valid ID enables press/release detection. Included in the activation report.                                                                                                                                            |
| Packed settings: press/release mode (highest bit)        | 1 bit   | 0–1                  | 0b0: trigger on press; 0b1: trigger on release.                                                                                                                                                                           |
| Packed settings: acceleration/angle submode              | 1 bit   | 0–1                  | 0b0: acceleration; 0b1: angle.                                                                                                                                                                                            |
| Packed settings: activation debounce                     | 3 bits  | 0–7                  | Values 0–7 map to 0–0.7 seconds. The reading must remain outside the threshold range for this long before activation is reported.                                                                                         |
| Packed settings: deactivation debounce (lowest bits)     | 3 bits  | 0–7                  | Values 0–7 map to 0–0.7 seconds. The reading must remain inside the threshold range for this long before deactivation is reported.                                                                                        |
| Press/release parameter increase rate while active       | 1 byte  | 0–120                | Time to rise from 0 to 255. Values 0 or >120 disable continuous increases; 1–60 mean 1–60 seconds; 61–120 mean 1–60 minutes. Each change is reported. For example, 40 means 40 seconds (6.375 units/s).                   |
| Press/release parameter decrease on deactivation         | 1 byte  | 0–255                | Immediately subtracts this amount when the trigger clears and reports the updated parameter.                                                                                                                              |
| Press/release parameter decrease rate after deactivation | 1 byte  | 0–120                | Time to fall from 255 to 0. Values 0 or >120 disable continuous decreases; 1–60 mean 1–60 seconds; 61–120 mean 1–60 minutes. Each change is reported. For example, 40 means 40 seconds (6.375 units/s).                   |
| Press/release parameter increase on activation           | 1 byte  | 0–255                | Immediately adds this amount on activation and includes the updated value in the report.                                                                                                                                  |
| Acceleration/angle event ID                              | 1 byte  | 1–24                 | A valid ID enables acceleration/angle detection. Included in the activation report.                                                                                                                                       |
| Acceleration threshold settings                          | 6 bytes | Acceleration submode | 1-byte detection mode: 0x00 triggers below the threshold; 0x01 triggers above it. Next: a 2-byte threshold, range 0–400. Detection applies to overall motion, without a specified direction. Final 3 bytes: 0x00 padding. |
| XYZ angle threshold ranges                               | 6 bytes | Angle submode        | Two bytes per axis, in X, Y, Z order: 1-byte lower bound and 1-byte upper bound, each in −128–127. See the rules below.                                                                                                   |
| Acceleration/angle parameter mapping range               | 1 byte  | 0–255                | For example, with activation above an acceleration threshold of 10 and a mapping range of 20, the parameter is 0 at 10, 255 at ≥30, and `(X-10) / 20 * 255` for 10 < X < 30.                                              |

Angle threshold rules, applied independently to each axis:

1. Equal lower and upper bounds disable detection on that axis.
2. A lower bound of −128 enables only the check for values above the upper bound.
3. An upper bound of 127 enables only the check for values below the lower bound.
4. A range of −128 to 127 disables detection on that axis.

```TypeScript
// 1. Press/release: event ID = 20; trigger on release;
// parameter +20 on activation; increase time = 20 seconds (12.75/s);
// parameter -50 on deactivation; decrease time = 20 seconds (12.75/s).
// 2. Acceleration: event ID = 10; trigger above threshold 100;
// activation debounce = 3 (0.3 s); deactivation debounce = 6 (0.6 s);
// parameter mapping range = 100.
// 3. Angle: event ID = 5; X range = [10, 50]; Y = [20, 30]; Z = [40, 60];
// parameter mapping range = 120; activation debounce = 3 (0.3 s);
// deactivation debounce = 6 (0.6 s); parameter mapping range = 100.

// Enable configuration 1.
HEX = `50010514${Number.parseInt ('10000000', 2).toString (16)} 143214140000000000000000`
// Enable configuration 2.
HEX = `50010500${Number.parseInt ('00011110', 2).toString (16)} 000000000A01006400000064`
// Enable configuration 3.
HEX = `50010500${Number.parseInt ('01011110', 2).toString (16)} 00000000050A32141E283C78`
// Enable configurations 1 and 2.
HEX = `50010514${Number.parseInt ('10011110', 2).toString (16)} 143214140A01006400000064`
// Enable configurations 1 and 3.
HEX = `50010514${Number.parseInt ('11011110', 2).toString (16)} 14321414050A32141E283C78`
// Configurations 2 and 3 are mutually exclusive acceleration/angle submodes.
```

#### Raw Sensor Data Mode

The following mode automatically reports sensor data every 100 ms.

##### D0 Mode

Reports the main indicator color, button press/release state, acceleration, X/Y/Z angles, and external voltage every 100 Ms. Use these readings to implement your own trigger logic.

**Mode settings**

```
0xD0 (1-byte trigger mode) + 01 + 00000000000000000000000000 (13 bytes of 00 padding)
```

### 5F Command

> See [Parameter](#parameter) for the meaning of parameter values.

Resets the current trigger mode's parameter to 0. If the mode has multiple parameters, all are reset. Trigger activation states are unaffected.

```
0x5F (1-byte command header)
```

### 60 Command

Starts automatic detection of the current variation ranges of the X, Y, and Z angles.

```
0x60 (1-byte command header)
```

> 1. Pawprint immediately stops the current trigger mode and starts automatic detection.
> 2. The shoulder lights stay green for a 3-second preparation phase, then yellow for a 10-second measurement phase. When the lights turn off, an F1 message reports the results.
> 3. For posture-holding interactions using angle mode, adopt the desired posture during preparation and hold it as steadily as possible during measurement to minimize the threshold ranges.

### 70 Command

Sets a steady shoulder-light color or configures flashing.

```
// Set the shoulder lights to a specified color.
0x70 (1-byte command header) + xx (1-byte color)
// Configure flashing.
0x70 (1-byte command header) + xx (1-byte color 1) + xx (1-byte color 2) + xx (1-byte flashing speed: 0x01 = slow; 0x02 = fast; 0x03 = stop)
```

## Bluetooth Response Messages

All Pawprint data is returned through notifications on `0x180C -> 0x150B`. Subscribe to this characteristic after connecting.

### 51 Message

Sent after a 50 command is written or when the battery level changes.

```
0x51 (1-byte message header) + xx (1-byte main indicator color) + xx (1-byte device type: Pawprint V1.1 = 0x03) + xx (1-byte battery level)
```

### 5A Message

Sent immediately when an event becomes active.

```
0x5A (1-byte message header) + xx (1-byte main indicator color) + xx (1-byte trigger event ID) + xx (1-byte parameter value)
```

### 5B Message

Sent immediately when an event is deactivated.

```
0x5B (1-byte message header) + xx (1-byte main indicator color) + xx (1-byte trigger event ID)
```

### 5C Message

Sent immediately when the parameter associated with a trigger event changes.

```
0x5C (1-byte message header) + xx (1-byte main indicator color) + xx (1-byte trigger event ID) + xx (1-byte parameter value)
```

### D0 Message

Sent every 100 ms while D0 mode is enabled.

```
0xD0 (1-byte message header) +
xx (1-byte main indicator color) +
xx (1-byte sequence number) +
xx (1-byte button state: 0x00 = released; any other value = pressed) +
xx (1-byte acceleration) +
xx (1-byte X-axis angle) +
xx (1-byte Y-axis angle) +
xx (1-byte Z-axis angle) +
xx (1-byte external voltage)
```

### F1 Message

Reports the automatically detected XYZ angle threshold ranges.

```
0xF1 (1-byte message header) +
0x61 (1-byte fixed value) +
xxxxxxxx (4-byte X-axis threshold range: 2-byte lower bound, 2-byte upper bound) +
xxxxxxxx (4-byte Y-axis threshold range: 2-byte lower bound, 2-byte upper bound) +
xxxxxxxx (4-byte Z-axis threshold range: 2-byte lower bound, 2-byte upper bound) +
```

> 1. Each threshold is a signed 2-byte value.
> 2. Divide each reported threshold by 2 before using it.
> 3. Clamp the divided values to the valid range of −128 to 127.

## Additional Notes

### Parameter

In addition to an active/inactive state, a trigger has a **parameter** ranging from 0 to 255.

This parameter represents the degree of activation. For example, a press trigger can increase the parameter with each press, or a motion trigger can increase it as acceleration moves farther beyond its threshold.

In the app's accessory interactions, **Temporary Intensity Change → By Param** maps this parameter linearly to the configured intensity range. For a range from A to B, parameter 0 gives A, parameter 255 gives B, and parameter 100 gives `A + (B - A) / 255 * 100`. If several conditions for the same trigger result are active at once, the largest parameter value is used. The trigger settings determine how parameters change during activation and deactivation.

### Indicator and Shoulder-Light Colors

1. Main indicator color range: `0x01`–`0x06`.
2. Shoulder-light color range: `0x00`–`0x07`.

| Value | 0x00 | 0x01   | 0x02 | 0x03   | 0x04 | 0x05 | 0x06  | 0x07  |
|-------|------|--------|------|--------|------|------|-------|-------|
| Color | Off  | Yellow | Red  | Purple | Blue | Cyan | Green | White |
