# External Voltage Detection: Explanation and Examples

[简体中文](README_CN.md)

This guide explains the button accessory's external voltage detection trigger, which lets Coyote users build custom interactions.

External voltage detection is an experimental, advanced feature provided as an extra and is not yet fully developed. It requires some electronics knowledge. At a minimum, prepare a multimeter, wires, a USB Type-C to Type-C cable, a potentiometer with a maximum resistance of approximately 20 kΩ, and electrical insulation tape.

## Basics

External voltage detection lets an external voltage signal trigger a configured event. It uses the main controller's ADC button-input function. The input reuses the **CC1 pin** of the 6-pin Type-C port, which connects to the ADC through an internal voltage divider.

The ADC measures the voltage between CC1 and GND. The 0–2.1 V measurement range is divided into 30 steps (0.07 V resolution), with an error of ±5%. **Do not charge the button while using this feature. Observe the connection polarity; the hardware voltage limit is 3.0 V.** Before use, verify the wiring, voltage, and polarity. Incorrect use may damage the device or create a hazard.

- The ADC button-input function is designed for discrete switching signals. Analog voltage measurements can have substantial errors, so designs based on switching states are strongly recommended.

## Detection Modes

Two modes are available: **High Level** (internal pull-up enabled) and **High Impedance** (internal pull-up disabled). High Level is the default.

In High Level mode, an internal pull-up connects to the external voltage detection pin (CC1) through a 10 kΩ resistor, and the pin connects to ground through a 4.8 kΩ resistor. With nothing connected, the pin voltage is approximately 1 V. Connect a variable resistor or switch between the detection pin and ground to change the measured voltage; no external power supply is required.

High Impedance mode disconnects the internal pull-up. CC1 remains connected to ground through the 4.8 kΩ resistor and does not supply an output voltage. This mode requires an external voltage source, such as a silicon photovoltaic cell, hand-cranked generator, or battery. Design the circuit for your intended interaction, taking voltage division and clamping into account.

Once the circuit is ready, configure the **Target Voltage Range** and **Parameter Mapping Range** in the app. An event is triggered whenever the measured voltage falls outside the target range. If a parameter mapping range is configured, the parameter increases as the voltage moves farther outside that range.

## Usage Examples

Voltage signals can come from many kinds of sensors. You can use off-the-shelf components such as photoresistors, microphone capsules, or distance sensors, or build your own—for example, by attaching a small motor to a hamster wheel, fitting a spring to a potentiometer, or applying copper foil tape to a cup.

Connect the button to your sensor using a standard USB Type-C to Type-C cable. Depending on your setup, use an adapter or cut and wire the cable yourself. For CC1 and GND pin positions, see a reference such as this [USB Type-C pinout](https://baike.baidu.com/item/USB%20Type-C?fromtitle=Type-C&fromid=16565336&fromModule=lemma_search-box#3). The functional test below also illustrates the connection.

Type-C connectors are reversible: one orientation connects CC1, and the other connects CC2. Check the orientation. Do not identify wires solely by color, as colors vary by manufacturer. One way to identify CC1 is to enable Travel Lock and confirm that the button is in its locked state (lights off and no response to presses). Plug the cable into the button, then use the multimeter's resistance mode to measure each wire against GND (usually the thick black wire). CC1 measures approximately 4.6 kΩ. If you measure approximately 5.1 kΩ, reverse the connector orientation.

Take appropriate care when using or building sensors. Before actual use, test the function and verify the setup with a potentiometer or bench power supply.

### Demo: Functional Test

This minimal demonstration uses only a cable and potentiometer to test the feature. It does not implement a specific interaction. Running this test before using the feature is strongly recommended to verify that it works reliably.

#### Hardware and Assembly

This example uses a common potentiometer and a standard USB Type-C to Type-C cable. For demonstration purposes, the cable is cut and wired directly. The components are shown below.

![Components for the functional test](/paw-prints/extvoltageinput/images/img1.webp)

After cutting the cable, use a multimeter and the USB Type-C plug pinout to identify CC and GND. Keep those wires accessible and insulate all unused wires.

Connect CC to the potentiometer's wiper and GND to either outer terminal. Plug the USB connector into the button to complete the setup.

![Potentiometer wiring](/paw-prints/extvoltageinput/images/img2.webp)

#### App Configuration

First, pair the button following the app's instructions. Its eye indicator color should match the accessory color shown in the app.

Add an accessory interaction, then add an **External Voltage Detection Trigger** for the corresponding button. Leave the measurement mode set to **High Level**, since the potentiometer uses the button's internal pull-up. At the potentiometer's maximum resistance (20 kΩ), the measured voltage is approximately 0.92 V.

Configure the **Target Voltage Range**, **Parameter Mapping Range**, and **Temporary Intensity Change** to suit your setup. For example:

- Target voltage range: 0.49–0.84 V.
- Parameter mapping range: 0.35 V (equivalent to 43 in older app versions that use a 0–255 scale).
- Temporary intensity change: **By Param**, with a range of +1 to +40.

![App configuration](/paw-prints/extvoltageinput/images/img3.webp)

Save the settings and start channel output as instructed by the app.

#### Expected Behavior

As you turn the potentiometer from one end to the other, the trigger state changes from active to inactive and then active again. The output intensity change follows the difference between the measured voltage and the target range, moving from 40 to 0 and back to 40. Because of ADC measurement error, the parameter changes in discrete steps and is not exact.

![Functional test results](/paw-prints/extvoltageinput/images/img4.webp)
