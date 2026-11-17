import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TelemetryDashboard,
  TelemetryHistoryPoint,
} from './components/TelemetryDashboard';
import { OpticalTrackerModule } from './components/OpticalTrackerModule';
import {
  ExecutiveOverridePanel,
  EspCommandLogEntry,
} from './components/ExecutiveOverridePanel';
import {
  classifyFluidStatus,
  buildEsp32Url,
  validateIpAddress,
  Esp32ThrottledSender,
} from './utils/telemetryLogic';
import { downloadStandaloneHtmlBundle } from './utils/standaloneHtmlExporter';
import {
  CookieConsentState,
  FormConsentState,
  LegalDocumentTab,
  DEFAULT_COOKIE_CONSENT,
  DEFAULT_FORM_CONSENTS,
  CONSENT_STORAGE_KEY,
  PREFS_STORAGE_KEY,
} from './utils/complianceLogic';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { LegalComplianceModal } from './components/LegalComplianceModal';
import { HospitalFirebasePanel } from './components/HospitalFirebasePanel';

export default function App() {
  const [levelPercent, setLevelPercent] = useState<number>(78);
  const [bottleCapacityMl, setBottleCapacityMl] = useState<number>(500);
  const [flowRateMlPerHr, setFlowRateMlPerHr] = useState<number>(125);
  const [espIp, setEspIp] = useState<string>('192.168.4.1');
  const [autoDrainActive, setAutoDrainActive] = useState<boolean>(false);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(true);
  const [lastVoiceAnnouncement, setLastVoiceAnnouncement] = useState<
    string | null
  >(null);
  const [lastEspSyncTimestamp, setLastEspSyncTimestamp] = useState<
    string | null
  >(null);
  const [commandLogs, setCommandLogs] = useState<EspCommandLogEntry[]>([]);
  const [historyPoints, setHistoryPoints] = useState<TelemetryHistoryPoint[]>([
    { timeLabel: 'T-5', level: 88 },
    { timeLabel: 'T-4', level: 85 },
    { timeLabel: 'T-3', level: 83 },
    { timeLabel: 'T-2', level: 80 },
    { timeLabel: 'T-1', level: 79 },
    { timeLabel: 'NOW', level: 78 },
  ]);

  // Privacy, Cookie Consent, Form Consents & Legal Compliance Modal state
  const [cookieConsent, setCookieConsent] = useState<CookieConsentState>(() => {
    try {
      const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_COOKIE_CONSENT, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
    return DEFAULT_COOKIE_CONSENT;
  });

  const [formConsents, setFormConsents] = useState<FormConsentState>(
    DEFAULT_FORM_CONSENTS
  );
  const [legalModalOpen, setLegalModalOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] =
    useState<LegalDocumentTab>('privacy_policy');

  const openLegalModal = useCallback((tab: LegalDocumentTab) => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  }, []);

  const handleSaveCookieConsent = useCallback((updated: CookieConsentState) => {
    setCookieConsent(updated);
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(updated));
      if (!updated.functionalPreferences) {
        window.localStorage.removeItem(PREFS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Load functional preferences only if user explicitly consented to functionalPreferences
  useEffect(() => {
    if (!cookieConsent.functionalPreferences) return;
    try {
      const saved = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.espIp === 'string' && validateIpAddress(parsed.espIp)) {
          setEspIp(parsed.espIp);
        }
        if (typeof parsed.bottleCapacityMl === 'number') {
          setBottleCapacityMl(parsed.bottleCapacityMl);
        }
        if (typeof parsed.flowRateMlPerHr === 'number') {
          setFlowRateMlPerHr(parsed.flowRateMlPerHr);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [cookieConsent.functionalPreferences]);

  // Persist functional preferences only when functionalPreferences consent is active
  useEffect(() => {
    if (!cookieConsent.functionalPreferences) return;
    try {
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({
          espIp,
          bottleCapacityMl,
          flowRateMlPerHr,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    cookieConsent.functionalPreferences,
    espIp,
    bottleCapacityMl,
    flowRateMlPerHr,
  ]);

  const handlePurgeAllLocalData = useCallback(() => {
    try {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
      window.localStorage.removeItem(PREFS_STORAGE_KEY);
      window.sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    setCookieConsent(DEFAULT_COOKIE_CONSENT);
    setCommandLogs([]);
    setLastEspSyncTimestamp(null);
    setEspIp('192.168.4.1');
    setBottleCapacityMl(500);
    setFlowRateMlPerHr(125);
  }, []);

  const wasClampedRef = useRef<boolean>(false);
  const lastTransmittedLevelRef = useRef<number | null>(null);

  // Physical HTTP GET dispatcher: fetch('http://' + espIp + '/set?level=' + Math.round(level), { mode: 'no-cors' })
  const executeEsp32Fetch = useCallback(
    (level: number) => {
      if (!formConsents.lanTransmissionConfirmed) return;
      const rounded = Math.max(0, Math.min(100, Math.round(level)));
      const cleanIp = (espIp || '192.168.4.1')
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '');
      const url = `http://${cleanIp}/set?level=${rounded}`;
      const statusInfo = classifyFluidStatus(rounded);
      const nowStr = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setLastEspSyncTimestamp(nowStr);
      setCommandLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowStr,
          url,
          level: rounded,
          servoState: statusInfo.servoStateText,
          status: 'TRANSMITTED',
        },
        ...prev.slice(0, 7),
      ]);

      fetch(url, { mode: 'no-cors' }).catch(() => {
        // Silent catch in preview environment when 192.168.4.1 is not on local network
      });
    },
    [espIp, formConsents.lanTransmissionConfirmed]
  );

  // Throttled sender instance ensuring at most 1 fetch per 150ms to prevent flooding ESP32
  const throttledSenderRef = useRef<Esp32ThrottledSender | null>(null);
  if (!throttledSenderRef.current) {
    throttledSenderRef.current = new Esp32ThrottledSender(
      executeEsp32Fetch,
      150
    );
  }

  useEffect(() => {
    throttledSenderRef.current?.updateSendFn(executeEsp32Fetch);
  }, [executeEsp32Fetch]);

  useEffect(() => {
    return () => {
      throttledSenderRef.current?.cancel();
    };
  }, []);

  // Transmit HTTP GET request to ESP32 bedside node throttled to 150ms
  const transmitToEsp32 = useCallback((targetLevel: number) => {
    throttledSenderRef.current?.send(targetLevel);
  }, []);

  // Play clinical ICU double-chime via Web Audio API and speak emergency alert via Web Speech API
  const triggerEmergencyVoiceAlert = useCallback(
    (forceSpeak = false) => {
      const phrase = 'Critical Alert: Emergency servo clamp engaged';
      setLastVoiceAnnouncement(phrase);

      if (!voiceAlertsEnabled && !forceSpeak) return;

      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.rate = 1.0;
          utterance.pitch = 0.95;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        // Ignore speech synthesis errors on restricted headless browsers
      }

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(660, ctx.currentTime + 0.14);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.36);
        }
      } catch {
        // Ignore if audio context requires additional gesture
      }
    },
    [voiceAlertsEnabled]
  );

  // Unified handler to update fluid level, send throttled 150ms HTTP GET, update history, and evaluate voice alert
  const updateFluidLevel = useCallback(
    (newLevel: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newLevel)));
      setLevelPercent(clamped);

      // Throttled to once every 150ms so rapid camera tracking or slider movements never flood the ESP32
      throttledSenderRef.current?.send(clamped);

      if (lastTransmittedLevelRef.current !== clamped) {
        lastTransmittedLevelRef.current = clamped;
        setHistoryPoints((prev) => [
          ...prev.slice(-17),
          {
            timeLabel: new Date().toLocaleTimeString([], {
              minute: '2-digit',
              second: '2-digit',
            }),
            level: clamped,
          },
        ]);
      }

      if (clamped <= 10) {
        if (!wasClampedRef.current) {
          wasClampedRef.current = true;
          triggerEmergencyVoiceAlert(false);
        }
      } else {
        wasClampedRef.current = false;
        setLastVoiceAnnouncement(null);
      }
    },
    [triggerEmergencyVoiceAlert]
  );

  // Initial ESP32 telemetry sync on mount
  useEffect(() => {
    executeEsp32Fetch(78);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional Simulated Gravity Drain timer for hands-free competition demonstration
  useEffect(() => {
    if (!autoDrainActive) return;
    const interval = setInterval(() => {
      setLevelPercent((prev) => {
        const next = Math.max(8, prev - 2);
        if (next <= 8) {
          setAutoDrainActive(false);
        }
        throttledSenderRef.current?.send(next);
        return next;
      });
    }, 650);
    return () => clearInterval(interval);
  }, [autoDrainActive]);

  // Keep history chart & voice alert synchronized when auto-drain decrements levelPercent
  useEffect(() => {
    if (lastTransmittedLevelRef.current !== levelPercent) {
      lastTransmittedLevelRef.current = levelPercent;
      setHistoryPoints((prev) => [
        ...prev.slice(-17),
        {
          timeLabel: new Date().toLocaleTimeString([], {
            minute: '2-digit',
            second: '2-digit',
          }),
          level: levelPercent,
        },
      ]);
      if (levelPercent <= 10 && !wasClampedRef.current) {
        wasClampedRef.current = true;
        triggerEmergencyVoiceAlert(false);
      } else if (levelPercent > 10) {
        wasClampedRef.current = false;
      }
    }
  }, [levelPercent, triggerEmergencyVoiceAlert]);

  const currentStatus = classifyFluidStatus(levelPercent);
  const currentEspUrl = buildEsp32Url(
    validateIpAddress(espIp) ? espIp : '192.168.4.1',
    levelPercent
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F19] via-[#101726] to-[#1A233A] text-[#F8FAFC] relative overflow-x-hidden">
      {/* Subtle Ambient Illumination Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-[-10%] left-[-5%] w-96 h-96 rounded-full bg-[#00F5D4]/[0.05] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-[-10%] right-[-5%] w-96 h-96 rounded-full bg-rose-500/[0.04] blur-3xl"
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B0F19]/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 py-3.5">
          {/* Zone 1: Single text element Brand wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
          >
            SalineGuard AI
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Primary Workspace Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            <a
              href="#telemetry-section"
              className="hover:text-[#00F5D4] transition-colors whitespace-nowrap shrink-0"
            >
              Telemetry
            </a>
            <a
              href="#vision-section"
              className="hover:text-[#00F5D4] transition-colors whitespace-nowrap shrink-0"
            >
              Red Ball Vision
            </a>
            <a
              href="#override-section"
              className="hover:text-[#00F5D4] transition-colors whitespace-nowrap shrink-0"
            >
              Servo Override
            </a>
            <a
              href="#hardware-section"
              className="hover:text-[#00F5D4] transition-colors whitespace-nowrap shrink-0"
            >
              ESP32 Node
            </a>
            <a
              href="#hospital-firebase-section"
              className="hover:text-[#00F5D4] transition-colors whitespace-nowrap shrink-0"
            >
              Patients &amp; Data
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => downloadStandaloneHtmlBundle(espIp)}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-[#00F5D4] hover:bg-[#00F5D4]/90 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Export Single-File HTML
            </button>
          </div>
        </div>
      </header>

      {/* Emergency Auto-Clamp Alert Banner when <= 10% */}
      {currentStatus.isClamped && (
        <div
          role="alert"
          data-testid="critical-clamp-banner"
          className="bg-rose-950/90 border-b border-rose-700/80 px-4 sm:px-6 py-2.5"
        >
          <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="text-rose-200 font-semibold">
              ✖ CRITICAL ALERT: IV FLUID AT {levelPercent}% — SG90 PINCH-CLAMP
              LOCKED AT 90° TO PREVENT AIR EMBOLISM
            </div>
            <button
              type="button"
              onClick={() => updateFluidLevel(100)}
              className="px-3 py-1 rounded bg-rose-200 text-rose-950 font-semibold hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              Replace IV Bag (Reset 100%)
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive 2-Column Clinical Grid */}
      <main
        id="top"
        className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 lg:py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column (7 cols on Desktop): Live ICU Telemetry Dashboard + Hardware Node Matrix */}
          <div
            id="telemetry-section"
            className="lg:col-span-7 flex flex-col gap-6"
          >
            <TelemetryDashboard
              levelPercent={levelPercent}
              bottleCapacityMl={bottleCapacityMl}
              flowRateMlPerHr={flowRateMlPerHr}
              onCapacityChange={setBottleCapacityMl}
              onFlowRateChange={setFlowRateMlPerHr}
              lastEspSyncTimestamp={lastEspSyncTimestamp}
              espTargetUrl={currentEspUrl}
              historyPoints={historyPoints}
            />

            {/* Bedside Hardware Node Architecture & Live SSD1306 OLED Preview */}
            <section
              id="hardware-section"
              aria-label="ESP32 Bedside Hardware Node Architecture"
              className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    PHYSICAL BEDSIDE PERIPHERALS · I2C &amp; PWM
                  </div>
                  <h2 className="text-base font-semibold text-slate-100 mt-0.5">
                    ESP32 Node State Matrix ({espIp})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateFluidLevel(currentStatus.isClamped ? 78 : 8)
                  }
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  {currentStatus.isClamped
                    ? 'Release Pinch-Clamp (78%)'
                    : 'Test Emergency Clamp (8%)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Simulated 128x64 I2C SSD1306 OLED Bedside Screen */}
                <div className="sm:col-span-5 bg-slate-950 border-2 border-slate-800 rounded-xl p-3.5 font-mono">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-800/80 pb-1 mb-2">
                    <span>SSD1306 OLED (0x3C)</span>
                    <span>128×64 PX</span>
                  </div>
                  <div className="text-xs text-[#00F5D4] font-bold tracking-wider">
                    SALINEGUARD ICU
                  </div>
                  <div className="text-lg font-bold text-slate-50 mt-0.5 tabular-nums">
                    FLUID: {levelPercent}%
                  </div>
                  <div
                    className={`text-xs font-semibold mt-0.5 ${
                      currentStatus.isClamped
                        ? 'text-[#F43F5E]'
                        : 'text-[#00F5D4]'
                    }`}
                  >
                    CLAMP: {currentStatus.isClamped ? 'LOCKED 90°' : 'OPEN 0°'}
                  </div>
                  <div className="w-full h-2 bg-slate-900 border border-slate-700 mt-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        currentStatus.isClamped
                          ? 'bg-[#F43F5E]'
                          : 'bg-[#00F5D4]'
                      }`}
                      style={{ width: `${levelPercent}%` }}
                    />
                  </div>
                </div>

                {/* 3 Hardware Peripheral Cards */}
                <div className="sm:col-span-7 grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                    <div className="text-[11px] font-mono text-slate-400">
                      SG90 SERVO
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold mt-1 tabular-nums ${
                        currentStatus.isClamped
                          ? 'text-[#F43F5E]'
                          : 'text-[#00F5D4]'
                      }`}
                    >
                      {currentStatus.servoAngle}° (
                      {currentStatus.isClamped ? 'LOCKED' : 'OPEN'})
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      GPIO 18 PWM
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                    <div className="text-[11px] font-mono text-slate-400">
                      PIEZO BUZZER
                    </div>
                    <div
                      className={`text-sm font-mono font-semibold mt-1 ${
                        currentStatus.isClamped
                          ? 'text-[#F43F5E]'
                          : 'text-slate-200'
                      }`}
                    >
                      {currentStatus.isClamped ? 'ALARM ON' : 'STANDBY'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      GPIO 19 Tone
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                    <div className="text-[11px] font-mono text-slate-400">
                      STATUS LED
                    </div>
                    <div className="text-sm font-mono font-semibold text-slate-100 mt-1">
                      {currentStatus.code === 'AUTO_CLAMPED'
                        ? 'CRIMSON'
                        : currentStatus.code === 'LOW_SALINE'
                        ? 'AMBER'
                        : 'EMERALD'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      GPIO 21/22/23
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column (5 cols on Desktop): AI Computer Vision (Bright Red Float Ball) + Executive Override */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div id="vision-section">
              <OpticalTrackerModule
                levelPercent={levelPercent}
                onOpticalLevelDetected={(newLevel) => {
                  updateFluidLevel(newLevel);
                }}
                autoDrainActive={autoDrainActive}
                onToggleAutoDrain={() => setAutoDrainActive((prev) => !prev)}
                cameraConsentConfirmed={
                  formConsents.cameraLocalProcessingConfirmed
                }
                onToggleCameraConsent={(checked) =>
                  setFormConsents((prev) => ({
                    ...prev,
                    cameraLocalProcessingConfirmed: checked,
                  }))
                }
                onOpenPrivacyPolicy={() => openLegalModal('privacy_policy')}
              />
            </div>

            <div id="override-section">
              <ExecutiveOverridePanel
                levelPercent={levelPercent}
                onSetLevel={(lvl) => {
                  setAutoDrainActive(false);
                  updateFluidLevel(lvl);
                }}
                espIp={espIp}
                onChangeEspIp={setEspIp}
                onManualSync={() => {
                  throttledSenderRef.current?.flush();
                  executeEsp32Fetch(levelPercent);
                }}
                voiceAlertsEnabled={voiceAlertsEnabled}
                onToggleVoiceAlerts={() =>
                  setVoiceAlertsEnabled((prev) => !prev)
                }
                onTestVoiceAlert={() => triggerEmergencyVoiceAlert(true)}
                lastVoiceAnnouncement={lastVoiceAnnouncement}
                commandLogs={commandLogs}
                formConsents={formConsents}
                onUpdateFormConsents={setFormConsents}
                onOpenLegalModal={openLegalModal}
              />
            </div>
          </div>
        </div>

        {/* Hospital Patient Registry & Firebase Saline Bottle Consumption / Time Analytics */}
        <div className="mt-6">
          <HospitalFirebasePanel
            currentLevelPercent={levelPercent}
            bottleCapacityMl={bottleCapacityMl}
            flowRateMlPerHr={flowRateMlPerHr}
            onSyncPrescriptionToMonitor={(bagMl, rateMlHr) => {
              setBottleCapacityMl(bagMl);
              setFlowRateMlPerHr(rateMlHr);
            }}
          />
        </div>
      </main>

      {/* Clinical Legal, Privacy, Cookie Policy & Third-Party SDK Audit Footer */}
      <footer
        aria-label="Clinical Privacy, Legal Policies, and SDK Security Audit Footer"
        className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 mt-4 border-t border-slate-800/80 text-xs font-mono text-slate-400"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-slate-200 font-semibold">
              SalineGuard AI · Automated ICU Pinch-Clamp Safeguard
            </div>
            <div className="text-[11px] text-slate-400">
              Clinician-Auth Protected · Cloud Firestore Sync · 0 Ad Trackers ·
              100% On-Device Optical Vision
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              data-testid="footer-privacy-policy-btn"
              onClick={() => openLegalModal('privacy_policy')}
              className="text-slate-300 hover:text-[#00F5D4] underline transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              data-testid="footer-terms-btn"
              onClick={() => openLegalModal('terms_of_service')}
              className="text-slate-300 hover:text-[#00F5D4] underline transition-colors"
            >
              Terms of Service
            </button>
            <button
              type="button"
              data-testid="footer-cookie-policy-btn"
              onClick={() => openLegalModal('cookie_policy')}
              className="text-slate-300 hover:text-[#00F5D4] underline transition-colors"
            >
              Cookie Policy
            </button>
            <button
              type="button"
              data-testid="footer-form-consents-btn"
              onClick={() => openLegalModal('form_consents')}
              className="text-slate-300 hover:text-[#00F5D4] underline transition-colors"
            >
              Form Consents &amp; Data Minimization
            </button>
            <button
              type="button"
              data-testid="footer-sdk-audit-btn"
              onClick={() => openLegalModal('sdk_audit')}
              className="text-slate-300 hover:text-[#00F5D4] underline transition-colors"
            >
              Third-Party SDK Audit
            </button>
            <button
              type="button"
              data-testid="footer-reopen-cookie-banner-btn"
              onClick={() =>
                setCookieConsent((prev) => ({ ...prev, hasResponded: false }))
              }
              className="px-2.5 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors"
            >
              Cookie Consent Banner
            </button>
          </div>
        </div>
      </footer>

      {/* Cookie Consent Banner */}
      <CookieConsentBanner
        consent={cookieConsent}
        onSaveConsent={handleSaveCookieConsent}
        onOpenLegalModal={openLegalModal}
      />

      {/* Tabbed Legal, Privacy, Cookie Policy, Form Consents & Third-Party SDK Audit Modal */}
      <LegalComplianceModal
        isOpen={legalModalOpen}
        activeTab={legalModalTab}
        onSelectTab={setLegalModalTab}
        onClose={() => setLegalModalOpen(false)}
        cookieConsent={cookieConsent}
        onUpdateCookieConsent={handleSaveCookieConsent}
        formConsents={formConsents}
        onUpdateFormConsents={setFormConsents}
        onPurgeAllLocalData={handlePurgeAllLocalData}
      />
    </div>
  );
}
