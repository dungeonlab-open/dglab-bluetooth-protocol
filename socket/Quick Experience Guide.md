# Quick Start Guide

Our website serves as a test case for a small dinosaur jumping game, showcasing WebSocket control functionality. Follow the steps below to quickly experience and understand how it works.

## Quick Experience Steps

1. Open the **DG-LAB APP**, log in, and tap the **SOCKET** option on the main screen. Then, turn on your **Coyote 3.0** device. The app will scan for and connect to your Coyote 3.0. (If this is your first time using the app, you’ll see an introduction to the WebSocket feature and related precautions. Please read it carefully.)
2. Open this website on a computer browser: [https://www.dungeon-lab.com/t-rex-runner/index.html](https://www.dungeon-lab.com/t-rex-runner/index.html). If you don’t have a computer, you’ll need at least another device like a tablet for easier operation, as the game will require keyboard input.
3. Once the website is open, click the **Connect** button in the top right corner. A QR code will appear on the webpage.
4. Return to the **DG-LAB APP**, tap **Connect to Server**, and select the camera icon. Scan the QR code displayed on your computer screen. Make sure the scanning frame fully aligns with the QR code. The app will automatically establish a connection once the QR code is detected.
5. After the connection is established, the QR code on the webpage will disappear. At this point, you can press the **spacebar** on your keyboard to start the game. When the dinosaur hits an obstacle, it will trigger a 5-second wave output (this is the default setting and can be customized). You will see your **Coyote 3.0** device activate.

---

## Configuration

1. The dinosaur game webpage includes several pre-configured options. You can click on these options to expand the detailed menu. Adjustments, such as output duration and intensity, are applied in real time.

---

## FAQ

1. **How can I control multiple Coyote 3.0 devices simultaneously?**  
   To do this, you’ll need some coding skills to modify our open-source code. Please refer to the [v2/README.md](v2/README.md) document for more details.
2. **How can I enable other games to control the Coyote 3.0?**  
   For this, please also check the [v2/README.md](v2/README.md) document for guidance.

---

## Safety Reminder

Since WebSocket services act as third-party control interfaces, we cannot fully monitor their processes for malicious activity. Therefore, **avoid scanning and connecting to QR codes from unknown or untrusted sources.**
