## SalineGuard AI — Automated IV Telemetry & Anti-Backflow Safety System

![Platform](https://img.shields.io/badge/Hardware-Dual%20ESP32%20DevKit%20V1-blue)
![Actuator](https://img.shields.io/badge/Actuator-MG995%20High--Torque%20Servo-orange)
![Interface](https://img.shields.io/badge/Telemetry-Local%20Wi--Fi%20Mesh%20(192.168.4.1)-green)
![3D Printing](https://img.shields.io/badge/Enclosure-OpenSCAD%20%2F%20PLA-lightgrey)

**SalineGuard AI** is a zero-contact, closed-loop intravenous (IV) infusion monitoring and mechanical auto-clamping system. It prevents dangerous air embolism and venous blood backflow when an IV saline bottle runs dry—without modifying sterile hospital drip bags.

---

##  Four-Node System Architecture

1. **Optical Meniscus Tracker (Smartphone):** Tracks a buoyant red float indicator inside the transparent drip chamber in real time and transmits fluid percentage via HTTP to `192.168.4.1/set`.
2. **Bedside Control & Actuation Hub (ESP32 #1):** Hosts the local `SalineGuard-AI` Wi-Fi Access Point (`192.168.4.1`), renders a 7 FPS medical HUD on a **128×64 SH1106 OLED**, drives tri-color status LEDs + piezo alarm, and actuates a **360° MG995 high-torque servo** pinch-clamp.
3. **Central Nurse Station Wall Display (Laptop Web App):** Polls `/status` every `300 ms` to render live ward telemetry, visual drip-chamber animations, audio chimes, and remote `/clamp` or `/unclamp` overrides.
4. **Remote Ward Desk Unit (ESP32 #2):** Connects wirelessly to the bedside hotspot to display live bed percentage and clamp alerts on a **16×2 I2C LCD** with a physical nurse override push-button.

---

##  Three-Stage Clinical Safety Thresholds

| Fluid Level | Clinical State | Bedside LED | Servo Pinch-Clamp | Audio Alarm |
| :--- | :--- | :--- | :--- | :--- |
| **51% – 100%** | `NORMAL_FLOW` |  Green | Open (`0°`) | Silent |
| **11% – 50%** | `LOW_SALINE` |  Yellow | Open (`0°`) | Silent |
| **0% – 10%** | `AUTO_CLAMPED` |  Red | **Locked Shut (`90°`)** | Active Alarm |

---

## 🔌 Hardware Pinout Summary

### Bedside Unit (ESP32 DevKit V1)
* **SH1106 OLED (I2C):** `SDA → GPIO 21`, `SCL → GPIO 22`
* **MG995 Servo Signal:** `GPIO 13` *(Powered via isolated external 5V–6V supply with common GND)*
* **Status LEDs:** `Green → GPIO 14`, `Yellow → GPIO 26`, `Red → GPIO 12`
* **Piezo Buzzer:** `GPIO 27`

### Nurse Station Unit (ESP32 DevKit V1)
* **16×2 I2C LCD:** `SDA → GPIO 21`, `SCL → GPIO 22` *(Auto-detects `0x27` / `0x3F`)*
* **Remote Override Button:** `GPIO 4` (to `GND`, internal pull-up)
* **Desk Alert Buzzer:** `GPIO 19`

---

##  Quick Deployment

1. Flash `firmware/Bedside_Unit_ESP32.ino` to the Bedside ESP32 and `firmware/Nurse_Station_ESP32.ino` to the Nurse Station ESP32 using Arduino IDE.
2. Connect the smartphone and laptop to the **`SalineGuard-AI`** Wi-Fi network (Password: `12345678`).
3. Open the web dashboard on the laptop and point the phone tracker at the IV drip chamber.
