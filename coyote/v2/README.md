## Coyote Stimulator V2

[简体中文](README_CN.md)

| Service UUID | Characteristic UUID |      Properties       |     Name      |  Size   |
|:------------:|:-------------------:|:---------------------:|:-------------:|:-------:|
|    0x180A    |       0x1500        |     Read / Notify     | Battery_Level | 1 byte  |
|    0x180B    |       0x1504        | Read / Write / Notify |    PWM_AB2    | 3 bytes |
|    0x180B    |       0x1505        |     Read / Write      |    PWM_A34    | 3 bytes |
|    0x180B    |       0x1506        |     Read / Write      |    PWM_B34    | 3 bytes |

|     Name      |      Description      | Data layout                                                                                         |
|:-------------:|:---------------------:|:----------------------------------------------------------------------------------------------------|
| Battery_Level | Current battery level | 1 byte (integer, 0–100)                                                                             |
|    PWM_AB2    | Channel A/B intensity | Bits 23–22: reserved; bits 21–11: actual channel A intensity; bits 10–0: actual channel B intensity |
|    PWM_A34    | Channel B Pulse data  | Bits 23–20: reserved; bits 19–15: Az; bits 14–5: Ay; bits 4–0: Ax                                   |
|    PWM_B34    | Channel A Pulse data  | Bits 23–20: reserved; bits 19–15: Bz; bits 14–5: By; bits 4–0: Bx                                   |

### Bluetooth Name

Stimulator 2.0: `D-LAB ESTIM01`

> Base UUID: `955Axxxx-0FE2-F5AA-A094-84B8D4F3E8AD`. Replace `xxxx` with the service UUID.

### Overview

Coyote contains two independent pulse generators, one for each channel (A and B). Each generator consists of a power module and a Pulse control module. Four protocol parameters—S, X, Y, and Z—control these modules.

### Power Module (S)

> S: `PWM_AB2` characteristic

The power module controls the pulse voltage, or channel intensity (the number inside the ring in the app). Parameter S ranges from 0 to 2047 and **must not exceed 2047**. Each intensity step in the official app corresponds to an increase of 7: the device value is seven times the displayed value. Writing a new S value changes the channel intensity immediately, and that value remains in effect.

### Pulse Control Module (X, Y, Z)

> X: bits 4–0 (5 bits) of `PWM_A34` or `PWM_B34`<br />
> Y: bits 14–5 (10 bits) of `PWM_A34` or `PWM_B34`<br />
> Z: bits 19–15 (5 bits) of `PWM_A34` or `PWM_B34`

The Pulse control module determines the timing and width of electrical pulses. These patterns are stored as built-in or custom Pulses.

### Pulse Timing

Coyote divides each second into 1,000 milliseconds and can generate one electrical pulse per millisecond. X specifies X consecutive pulses over X milliseconds; Y specifies the idle interval in milliseconds before the next group. X ranges from 0 to 31, and Y ranges from 0 to 1023.

> For example, `[1,9]` produces one pulse followed by a 9 ms interval: a 10 ms cycle, or 100 Hz. `[5,95]` produces five pulses followed by a 95 ms interval: a 100 ms cycle. Because the five pulses occur together within 5 ms, they are perceived as one burst, giving a perceived frequency of 10 Hz.

### Frequency Value

```
Frequency = X + Y
Actual pulse frequency = Frequency / 1000
```

`Frequency` describes the relationship between X and Y and ranges from 10 to 1000. Use it to calculate suitable X and Y values. The recommended ratio is given by:

<div id="gongshi"><pre>
X = ((Frequency / 1000)^ 0.5) * 15
Y = Frequency - X
</pre></div>

This ratio provides the best results. If X:Y exceeds 1:9 (for example, `[8,2]`), the overall sensation becomes weaker.

### Pulse Width

Each electrical pulse consists of two symmetrical, opposite-polarity monophasic pulses. Their amplitude (voltage) is determined by the channel intensity. Wider pulses feel stronger; narrower pulses feel weaker. Rhythmic changes in width produce different sensations.

Z controls pulse width and ranges from 0 to 31. The actual width is `Z * 5 µs`. For example, `Z = 20` gives `5 * 20 µs = 100 µs`.

- **Note:** Pulse widths above 100 µs (`Z > 20`) are more likely to cause a stinging sensation.

### Creating Changing Pulses

Pulse parameters can vary over time. Each `[X,Y,Z]` set is valid for only 0.1 s: after receiving a set, the device outputs the corresponding Pulse for 0.1 s and then stops. To sustain a 100 Hz output with a 100 µs width, send `[1,9,20]` every 0.1 s.

- You can also change `Frequency` every 0.1 s and use the [Frequency formula](#gongshi) to calculate X and Y.

### More Examples

For a Pulse whose frequency gradually increases, send these sets in order, one every 0.1 s:

```
[5,135,20][5,125,20][5,115,20][5,105,20][5,95,20][4,86,20][4,76,20][4,66,20][3,57,20][3,47,20][3,37,20][2,28,20][2,18,20][1,14,20][1,9,20]
```

For a Pulse that alternates between two frequencies, send these sets in order, one every 0.1 s:

```
[5,95,20][5,95,20][5,95,20][5,95,20][5,95,20][1,9,20][1,9,20][1,9,20][1,9,20][1,9,20]
```

For a constant-frequency Pulse with a pushing sensation, send these sets in order, one every 0.1 s:

```
[1,9,4][1,9,8][1,9,12][1,9,16][1,9,18][1,9,19][1,9,20][1,9,0][1,9,0][1,9,0]
```

- Frequency changes are perceived relatively slowly. Changes that are too fast may not create a sense of rhythm, whereas frequent pulse-width changes can produce a variety of sensations.
