#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const char* WIFI_SSID = "SalineGuard-AI";
const char* WIFI_PASS = "12345678";

const char* STATUS_URL  = "http://192.168.4.1/status";
const char* CLAMP_URL   = "http://192.168.4.1/clamp";
const char* UNCLAMP_URL = "http://192.168.4.1/unclamp";

const int SDA_PIN    = 21;  // 16x2 LCD I2C SDA
const int SCL_PIN    = 22;  // 16x2 LCD I2C SCL
const int BUTTON_PIN = 4;   // Override push button (wired between GPIO 4 and GND)
const int BUZZER_PIN = 19;  // Optional Nurse Station buzzer

LiquidCrystal_I2C lcd(0x27, 16, 2);

int bedLevel = -1;
bool isClamped = false;
bool bedOnline = false;
bool heartbeatToggle = false;

unsigned long lastPollMs = 0;
unsigned long lastReconnectMs = 0;
unsigned long lastButtonMs = 0;

String prevRow0 = "";
String prevRow1 = "";

uint8_t detectLcdAddress() {
  uint8_t addresses[] = {0x27, 0x3F};
  for (uint8_t addr : addresses) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      return addr;
    }
  }
  return 0x27;
}

void writeLcdRow(int row, String text) {
  while (text.length() < 16) text += " ";
  text = text.substring(0, 16);

  if (row == 0 && text == prevRow0) return;
  if (row == 1 && text == prevRow1) return;

  lcd.setCursor(0, row);
  lcd.print(text);

  if (row == 0) prevRow0 = text;
  if (row == 1) prevRow1 = text;
}

bool parseBedsideJson(const String& json) {
  int lvlKey = json.indexOf("\"level\":");
  if (lvlKey == -1) return false;

  int startIdx = lvlKey + 8;
  int endIdx = json.indexOf(",", startIdx);
  if (endIdx == -1) endIdx = json.indexOf("}", startIdx);

  String lvlStr = json.substring(startIdx, endIdx);
  lvlStr.trim();
  bedLevel = constrain(lvlStr.toInt(), 0, 100);

  int clampKey = json.indexOf("\"clamped\":");
  if (clampKey != -1) {
    String clampSlice = json.substring(clampKey + 10, clampKey + 16);
    isClamped = (clampSlice.indexOf("true") != -1);
  } else {
    isClamped = (bedLevel <= 10);
  }
  return true;
}

void refreshLcdScreen() {
  if (WiFi.status() != WL_CONNECTED) {
    writeLcdRow(0, "SALINEGUARD AI");
    writeLcdRow(1, "WIFI SEARCHING..");
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, LOW);
    return;
  }

  if (!bedOnline || bedLevel < 0) {
    writeLcdRow(0, "WIFI CONNECTED");
    writeLcdRow(1, "WAITING BED-01..");
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, LOW);
    return;
  }

  String row0 = "BED-01: " + String(bedLevel) + "%";
  while (row0.length() < 15) row0 += " ";
  row0 += (heartbeatToggle ? "*" : " ");
  writeLcdRow(0, row0);

  if (isClamped || bedLevel <= 10) {
    writeLcdRow(1, "!CLAMPED 90 DEG!");
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, HIGH);
  } else if (bedLevel <= 50) {
    writeLcdRow(1, "WARN: LOW SALINE");
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, LOW);
  } else {
    writeLcdRow(1, "FLOW: NORMAL");
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, LOW);
  }
}

void pollBedsideUnit() {
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(250);
  http.useHTTP10(true);

  if (http.begin(client, STATUS_URL)) {
    int code = http.GET();
    if (code == 200) {
      String body = http.getString();
      if (parseBedsideJson(body)) {
        bedOnline = true;
        heartbeatToggle = !heartbeatToggle;
      }
    } else {
      bedOnline = false;
    }
    http.end();
  } else {
    bedOnline = false;
  }
  refreshLcdScreen();
}

void sendOverrideCommand(const char* url, const char* bannerText) {
  if (WiFi.status() != WL_CONNECTED) return;
  writeLcdRow(1, bannerText);

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(300);
  http.useHTTP10(true);

  if (http.begin(client, url)) {
    int code = http.GET();
    if (code == 200) {
      parseBedsideJson(http.getString());
      bedOnline = true;
    }
    http.end();
  }
  refreshLcdScreen();
}

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  if (BUZZER_PIN >= 0) {
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
  }

  Wire.begin(SDA_PIN, SCL_PIN);
  uint8_t foundAddr = detectLcdAddress();
  lcd = LiquidCrystal_I2C(foundAddr, 16, 2);
  lcd.init();
  lcd.backlight();

  writeLcdRow(0, "NURSE STATION");
  writeLcdRow(1, "JOINING WIFI...");

  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < 6000) {
    delay(200);
  }
  refreshLcdScreen();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    bedOnline = false;
    refreshLcdScreen();
    if (now - lastReconnectMs >= 4000) {
      lastReconnectMs = now;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
    return;
  }

  if (digitalRead(BUTTON_PIN) == LOW && (now - lastButtonMs > 400)) {
    lastButtonMs = now;
    if (isClamped) {
      sendOverrideCommand(UNCLAMP_URL, "UNCLAMPING 0 DEG");
    } else {
      sendOverrideCommand(CLAMP_URL, "CLAMPING 90 DEG!");
    }
  }

  if (now - lastPollMs >= 300) {
    lastPollMs = now;
    pollBedsideUnit();
  }
}
