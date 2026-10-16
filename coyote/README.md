## Understanding Coyote Pulses

[简体中文](README_CN.md)

This document explains the Coyote stimulator Pulse protocol and the data that controls its output.

### Concepts

#### Pulse Frequency

Coyote divides each second into 1,000 milliseconds and can generate one electrical pulse per millisecond. The output pattern is encoded as pulses and intervals between them.

The **Pulse frequency** field represents the duration of one output unit, consisting of X pulses followed by Y milliseconds of idle time. Its unit is milliseconds, even though the protocol calls it a frequency.

For example, a 1 Hz output corresponds to a Pulse frequency value of 1,000 ms; a 50 Hz output corresponds to 20 ms.

| Electrical pulse frequency | Pulse frequency value |
|:---:|:---:|
| 1 Hz | 1000 ms |
| 5 Hz | 200 ms |
| 10 Hz | 100 ms |
| 50 Hz | 20 ms |
| 100 Hz | 10 ms |
| 500 Hz | 2 ms |
| 1000 Hz | 1 ms |

In the Coyote V2 protocol, [X and Y](/coyote/v2/README.md) together determine the Pulse frequency. X specifies X consecutive pulses over X milliseconds. After those pulses, the device waits Y milliseconds before repeating.

> For example, `[1,9]` produces one pulse followed by a 9 ms interval: a 10 ms cycle, or 100 Hz. `[5,95]` produces five pulses followed by a 95 ms interval: a 100 ms cycle. Because the five pulses occur together within 5 ms, they are perceived as a single burst, giving a perceived frequency of 10 Hz and a Pulse frequency value of 100 ms.

The Coyote V3 protocol accepts only a Pulse frequency value. The distribution between pulses (X) and idle time (Y) is determined by [Frequency Balance Parameter 1](/coyote/v3/README.md).

V3 also compresses the Pulse frequency value before transmission. To create a linear change, use one of the following approaches.

> **Example 1: Linear change in electrical pulse frequency**
> 1. Choose frequencies: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 Hz.
> 2. Convert them to Pulse frequency values: 1000, 500, 333, 250, 200, 166, 142, 125, 111, 100 ms.
> 3. Apply the V3 conversion formula: 240, 180, 146, 130, 120, 113, 108, 105, 102, 100.
> 4. Send groups of four values every 100 ms, padding an incomplete group with 10.

> **Example 2: Linear change in the Pulse frequency value**
> 1. Choose values: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 ms.
> 2. Apply the V3 conversion formula: 100, 120, 140, 160, 180, 200, 210, 220, 230, 240.
> 3. Send groups of four values every 100 ms, padding an incomplete group with 10.

#### Converting Pulse Frequency to the Transmitted Value

Small frequency changes are difficult to perceive. As the output unit gets longer, a given change in its duration produces a smaller change in the electrical pulse frequency. This conversion also reduces the amount of data needed for transmission.

| Pulse frequency value | Transmitted value | Electrical pulse frequency |
|:---:|:---:|:---:|
| 10 ms | 10 | 100 Hz |
| 20 ms | 20 | 50 Hz |
| 50 ms | 50 | 20 Hz |
| 100 ms | 100 | 10 Hz |
| 110 ms | 102 | 9 Hz |
| 150 ms | 110 | 6.6 Hz |
| 650 ms | 205 | 1.53 Hz |
| 680 ms | 208 | 1.47 Hz |
| 750 ms | 215 | 1.33 Hz |

#### Pulse Intensity

Each electrical pulse consists of two symmetrical, opposite-polarity monophasic pulses. Their amplitude (voltage) is determined by the channel intensity. Pulse width controls the perceived intensity: wider pulses feel stronger, and narrower pulses feel weaker. Rhythmic changes in width produce different sensations.

In the Coyote V2 protocol, [Z](/coyote/v2/README.md) determines Pulse intensity. The official app uses values from 0 to 20. Pulse intensity is a relative value with no physical unit.

In V3, Pulse intensity ranges from 0 to 100 and is likewise unitless.

The approximate correspondence is: V2 Pulse intensity 20 ≈ V3 Pulse intensity 100.

### Output Windows

V2 uses a 100 ms output window. V3 uses a 25 ms window, but four sets are sent together, so each transmission still covers 100 ms.

A Pulse frequency value can represent a duration longer than the output window. What happens when the next set of data arrives before that duration ends?

The device handles this internally using a more complex process, whose details are outside the scope of this document. Keep the following in mind:

1. To maintain a stable Pulse frequency, keep sending the same value.
2. If the duration exceeds the output window and the next value differs, the resulting output may not directly match either input value because of this internal processing.

### Converting V2 Pulses to V3

V3 Pulse frequency: calculate V2 `(X + Y)`, then apply the conversion from `(10–1000)` to `(10–240)`.

V3 Pulse intensity: V2 `(Z * 5)`.
