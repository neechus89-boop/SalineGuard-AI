#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <ESP32Servo.h>

const char* AP_SSID = "SalineGuard-AI";
const char* AP_PASS = "12345678";

// Bedside Hardware Pins (ESP32 DevKit V1)
const int SERVO_PIN  = 13;  // 360-deg MG995 Servo signal pin
const int BUZZER_PIN = 27;  // Active Piezo Buzzer
const int PIN_GREEN  = 14;  // Green LED (>50%)
const int PIN_YELLOW = 26;  // Yellow LED (11% - 50%)
const int PIN_RED    = 12;  // Red LED (<=10% or Clamped)

Adafruit_SH1106G display(128, 64, &Wire, -1);
WebServer server(80);
Servo clampServo;

int currentBedLevel = 100;
bool isClamped = false;
bool manualClampOverride = false;
int servoAngle = 0;

// 360-Degree Continuous MG995 Servo Calibration
const int SERVO_STOP_VAL   = 90;   // 90 = Neutral STOP
const int SERVO_CLAMP_DIR  = 180;  // Spin direction to pinch IV tube
const int SERVO_OPEN_DIR   = 0;    // Spin direction to release IV tube
const int CLAMP_TRAVEL_MS  = 450;  // Timed rotation burst in ms

bool physicalServoClamped = false;
unsigned long servoStopAtMs = 0;

// OLED HUD Animation State
unsigned long lastOledRefresh = 0;
int dripY = 0;
bool pulseBeat = false;

void renderSharpOLED();
void applyHardwareState();

void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
  server.sendHeader("Cache-Control", "no-store");
  server.sendHeader("Connection", "close");
}

String buildStatusJson() {
  String json = "{";
  json += "\"level\":" + String(currentBedLevel) + ",";
  json += "\"clamped\":" + String(isClamped ? "true" : "false") + ",";
  json += "\"servoAngle\":" + String(servoAngle) + ",";
  if (isClamped) json += "\"status\":\"AUTO_CLAMPED\"";
  else if (currentBedLevel <= 50) json += "\"status\":\"LOW_SALINE\"";
  else json += "\"status\":\"NORMAL_FLOW\"";
  json += "}";
  return json;
}

void renderSharpOLED() {
  display.clearDisplay();

  // 1. Top Medical HUD Header + Connected Device Count
  display.fillRect(0, 0, 128, 12, SH110X_WHITE);
  display.setFont(NULL);
  display.setTextSize(1);
  display.setTextColor(SH110X_BLACK);
  display.setCursor(3, 2);
  display.print("SALINEGUARD");

  int clients = WiFi.softAPgetStationNum();
  display.setCursor(82, 2);
  display.print("LINK:");
  display.print(clients);
  if (pulseBeat) display.fillCircle(123, 5, 2, SH110X_BLACK);

  // 2. Corner HUD Brackets around Telemetry Zone
  display.drawLine(0, 15, 6, 15, SH110X_WHITE);
  display.drawLine(0, 15, 0, 21, SH110X_WHITE);
  display.drawLine(0, 48, 6, 48, SH110X_WHITE);
  display.drawLine(0, 42, 0, 48, SH110X_WHITE);

  // 3. Large Vector Percentage Readout
  display.setTextColor(SH110X_WHITE);
  display.setFont(&FreeSansBold18pt7b);
  display.setCursor(4, 41);
  display.print(currentBedLevel);

  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(String(currentBedLevel), 4, 41, &x1, &y1, &w, &h);
  display.setFont(NULL);
  display.setTextSize(1);
  display.setCursor(w + 8, 20);
  display.print("%");
  display.setCursor(w + 8, 32);
  display.print("IV");

  display.setCursor(5, 43);
  if (isClamped) {
    display.print("FLOW: 0 mL/hr");
  } else {
    display.print("BED-01 ACTIVE");
  }

  // 4. Right-Side Graduated IV Bag & Animated Drip Chamber
  display.drawRoundRect(96, 15, 28, 24, 4, SH110X_WHITE);
  display.drawLine(106, 13, 114, 13, SH110X_WHITE);

  int fillH = map(currentBedLevel, 0, 100, 0, 20);
  if (fillH > 0) {
    display.fillRect(98, 17 + (20 - fillH), 24, fillH, SH110X_WHITE);
  }
  display.drawLine(98, 22, 102, 22, SH110X_BLACK);
  display.drawLine(98, 27, 104, 27, SH110X_BLACK);
  display.drawLine(98, 32, 102, 32, SH110X_BLACK);

  display.drawLine(110, 39, 110, 42, SH110X_WHITE);
  if (isClamped) {
    display.drawLine(106, 43, 114, 49, SH110X_WHITE);
    display.drawLine(114, 43, 106, 49, SH110X_WHITE);
  } else {
    int dropPos = 43 + dripY;
    display.fillCircle(110, dropPos, 2, SH110X_WHITE);
    display.drawPixel(110, dropPos - 3, SH110X_WHITE);
  }

  // 5. Bottom Status Banner
  if (isClamped) {
    if (pulseBeat) {
      display.fillRect(0, 52, 128, 12, SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
    } else {
      display.drawRect(0, 52, 128, 12, SH110X_WHITE);
      display.setTextColor(SH110X_WHITE);
    }
    display.setCursor(11, 54);
    display.print("! TUBE CLAMPED !");
  } else if (currentBedLevel <= 50) {
    display.drawRect(0, 52, 128, 12, SH110X_WHITE);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(13, 54);
    display.print("WARN: LOW SALINE");
  } else {
    display.drawLine(0, 52, 128, 52, SH110X_WHITE);
    display.setTextColor(SH110X_WHITE);
    display.setCursor(10, 55);
    display.print("STATUS: NORMAL FLOW");
  }

  display.display();
}

void applyHardwareState() {
  bool shouldClamp = (manualClampOverride || currentBedLevel <= 10);

  if (shouldClamp && !physicalServoClamped) {
    physicalServoClamped = true;
    clampServo.write(SERVO_CLAMP_DIR);
    servoStopAtMs = millis() + CLAMP_TRAVEL_MS;
  } else if (!shouldClamp && physicalServoClamped) {
    physicalServoClamped = false;
    clampServo.write(SERVO_OPEN_DIR);
    servoStopAtMs = millis() + CLAMP_TRAVEL_MS;
  }

  if (shouldClamp) {
    isClamped = true;
    servoAngle = 90;
    digitalWrite(PIN_GREEN, LOW);
    digitalWrite(PIN_YELLOW, LOW);
    digitalWrite(PIN_RED, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (currentBedLevel <= 50) {
    isClamped = false;
    servoAngle = 0;
    digitalWrite(PIN_GREEN, LOW);
    digitalWrite(PIN_YELLOW, HIGH);
    digitalWrite(PIN_RED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    isClamped = false;
    servoAngle = 0;
    digitalWrite(PIN_GREEN, HIGH);
    digitalWrite(PIN_YELLOW, LOW);
    digitalWrite(PIN_RED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void updateLevelValue(int newLvl) {
  currentBedLevel = constrain(newLvl, 0, 100);
  if (currentBedLevel > 10 && !manualClampOverride) {
    isClamped = false;
  }
  applyHardwareState();
}

int parseIncomingLevel() {
  if (server.hasArg("level")) return server.arg("level").toInt();
  if (server.hasArg("val"))   return server.arg("val").toInt();
  if (server.hasArg("value")) return server.arg("value").toInt();
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    int colon = body.indexOf(':');
    if (colon != -1) return body.substring(colon + 1).toInt();
    return body.toInt();
  }
  return -1;
}

void handleLevelInput() {
  sendCorsHeaders();
  int lvl = parseIncomingLevel();
  if (lvl >= 0) updateLevelValue(lvl);
  server.send(200, "application/json", buildStatusJson());
}

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_YELLOW, OUTPUT);
  pinMode(PIN_RED, OUTPUT);

  clampServo.attach(SERVO_PIN, 500, 2400);
  clampServo.write(SERVO_STOP_VAL);

  Wire.begin(21, 22);
  Wire.setClock(400000);
  display.begin(0x3C, true);
  applyHardwareState();
  renderSharpOLED();

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS, 1, 0, 4);
  WiFi.setSleep(false);

  server.on("/set", HTTP_GET, handleLevelInput);
  server.on("/set", HTTP_POST, handleLevelInput);
  server.on("/update", HTTP_GET, handleLevelInput);
  server.on("/update", HTTP_POST, handleLevelInput);

  server.on("/status", HTTP_GET, []() {
    sendCorsHeaders();
    server.send(200, "application/json", buildStatusJson());
  });

  server.on("/clamp", HTTP_GET, []() {
    sendCorsHeaders();
    manualClampOverride = true;
    applyHardwareState();
    server.send(200, "application/json", buildStatusJson());
  });

  server.on("/unclamp", HTTP_GET, []() {
    sendCorsHeaders();
    manualClampOverride = false;
    if (currentBedLevel <= 10) currentBedLevel = 100;
    applyHardwareState();
    server.send(200, "application/json", buildStatusJson());
  });

  server.onNotFound([]() {
    sendCorsHeaders();
    server.send(204);
  });

  server.begin();
}

void loop() {
  server.handleClient();

  if (servoStopAtMs > 0 && millis() >= servoStopAtMs) {
    clampServo.write(SERVO_STOP_VAL);
    servoStopAtMs = 0;
  }

  if (millis() - lastOledRefresh >= 140) {
    lastOledRefresh = millis();
    pulseBeat = !pulseBeat;
    if (!isClamped) {
      dripY = (dripY + 2) % 6;
    }
    renderSharpOLED();
  }
}
