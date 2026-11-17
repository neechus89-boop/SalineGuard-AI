import React, { useState } from 'react';
import { validateIpAddress, buildEsp32Url } from '../utils/telemetryLogic';
import {
  inspectInputForUnnecessaryData,
  FormConsentState,
  LegalDocumentTab,
} from '../utils/complianceLogic';

export interface EspCommandLogEntry {
  id: string;
  timestamp: string;
  url: string;
  level: number;
  servoState: string;
  status: 'TRANSMITTED' | 'OFFLINE_QUEUED';
}

interface ExecutiveOverridePanelProps {
  levelPercent: number;
  onSetLevel: (level: number, sourceLabel: string) => void;
  espIp: string;
  onChangeEspIp: (ip: string) => void;
  onManualSync: () => void;
  voiceAlertsEnabled: boolean;
  onToggleVoiceAlerts: () => void;
  onTestVoiceAlert: () => void;
  lastVoiceAnnouncement: string | null;
  commandLogs: EspCommandLogEntry[];
  formConsents: FormConsentState;
  onUpdateFormConsents: (updated: FormConsentState) => void;
  onOpenLegalModal: (tab: LegalDocumentTab) => void;
}

export const ExecutiveOverridePanel: React.FC<ExecutiveOverridePanelProps> = ({
  levelPercent,
  onSetLevel,
  espIp,
  onChangeEspIp,
  onManualSync,
  voiceAlertsEnabled,
  onToggleVoiceAlerts,
  onTestVoiceAlert,
  lastVoiceAnnouncement,
  commandLogs,
  formConsents,
  onUpdateFormConsents,
  onOpenLegalModal,
}) => {
  const [dataMinimizationAlert, setDataMinimizationAlert] = useState<
    string | null
  >(null);

  const roundedLevel = Math.max(0, Math.min(100, Math.round(levelPercent)));
  const isIpValid = validateIpAddress(espIp);
  const currentEndpoint = buildEsp32Url(
    isIpValid ? espIp : '192.168.4.1',
    roundedLevel
  );

  const handleIpInputChange = (rawVal: string) => {
    const check = inspectInputForUnnecessaryData(rawVal);
    if (!check.isSafe) {
      setDataMinimizationAlert(check.violationReason);
      onChangeEspIp(check.sanitized);
    } else {
      setDataMinimizationAlert(null);
      onChangeEspIp(rawVal);
    }
  };

  return (
    <section
      aria-label="Executive Override and Hardware Settings"
      className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400">
            <span>MANUAL SERVO ACTUATION</span>
            <span aria-hidden="true">·</span>
            <span>HTTP GET NO-CORS</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-50 mt-0.5">
            Executive Override &amp; ESP32 Sync
          </h2>
        </div>

        {/* ESP32 Sync Connection Status Text */}
        <div
          data-testid="esp32-sync-status"
          className="text-xs font-mono text-right"
        >
          <span
            className={
              isIpValid && formConsents.lanTransmissionConfirmed
                ? 'text-[#00F5D4] font-semibold'
                : 'text-[#F43F5E] font-semibold'
            }
          >
            {!formConsents.lanTransmissionConfirmed
              ? '▲ CONSENT REQUIRED'
              : isIpValid
              ? '● ESP32 SYNC READY'
              : '✖ INVALID NODE IP'}
          </span>
        </div>
      </div>

      {/* Custom HTML Range Slider (0 - 100%) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="executive-override-slider"
            className="text-xs font-mono text-slate-300 font-medium"
          >
            MANUAL FLUID LEVEL OVERRIDE (0% – 100%)
          </label>
          <span className="text-sm font-mono font-bold text-[#00F5D4] tabular-nums">
            {roundedLevel}%
          </span>
        </div>
        <input
          id="executive-override-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={roundedLevel}
          onChange={(e) =>
            onSetLevel(Number(e.target.value), 'Executive Slider Override')
          }
          className="saline-slider"
        />
        <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1.5">
          <span>0% (Clamped)</span>
          <span>25%</span>
          <span>50% (Warning)</span>
          <span>75%</span>
          <span>100% (Full)</span>
        </div>
      </div>

      {/* Haptic-Style Preset Buttons: "100% Reset", "35% Warning", "8% Emergency Clamp" */}
      <div>
        <div className="text-xs font-mono text-slate-400 mb-2">
          RAPID CLINICAL PRESETS
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onSetLevel(100, '100% Reset Preset')}
            className="px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] text-xs font-mono font-semibold text-emerald-300 transition-all whitespace-nowrap shrink-0"
          >
            100% Reset
          </button>

          <button
            type="button"
            onClick={() => onSetLevel(35, '35% Warning Preset')}
            className="px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] text-xs font-mono font-semibold text-amber-300 transition-all whitespace-nowrap shrink-0"
          >
            35% Warning
          </button>

          <button
            type="button"
            onClick={() => onSetLevel(8, '8% Emergency Clamp Preset')}
            className="px-4 py-2.5 rounded-xl border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] text-xs font-mono font-semibold text-rose-300 transition-all whitespace-nowrap shrink-0"
          >
            8% Emergency Clamp
          </button>
        </div>
      </div>

      {/* ESP32 Bedside Node IP Configuration + Form Consent & Data Minimization Guard */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="esp32-ip-input"
            className="block text-xs font-mono text-slate-400"
          >
            ESP32 BEDSIDE NODE IP ADDRESS (LAN ONLY · NO PII)
          </label>
          <span className="text-[10px] font-mono text-emerald-400">
            DATA MINIMIZED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="esp32-ip-input"
            type="text"
            value={espIp}
            onChange={(e) => handleIpInputChange(e.target.value)}
            placeholder="192.168.4.1"
            aria-describedby="esp32-form-consent-label"
            className="flex-1 bg-slate-900/90 border border-slate-700/90 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#00F5D4]"
          />
          <button
            type="button"
            onClick={onManualSync}
            disabled={!isIpValid || !formConsents.lanTransmissionConfirmed}
            className="px-4 py-2 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 disabled:opacity-40 text-slate-950 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Sync ESP32 Now
          </button>
        </div>
        {dataMinimizationAlert && (
          <p
            role="alert"
            data-testid="data-minimization-alert"
            className="text-xs font-mono text-amber-300 bg-amber-950/50 border border-amber-800/70 rounded-lg px-2.5 py-1.5"
          >
            {dataMinimizationAlert}
          </p>
        )}
        {!isIpValid && (
          <p className="text-xs font-mono text-[#F43F5E]">
            Enter a valid IPv4 address (e.g. 192.168.4.1) or local hostname.
          </p>
        )}
        <div className="text-[11px] font-mono text-slate-400 truncate">
          GET Target: <span className="text-slate-200">{currentEndpoint}</span>
        </div>

        {/* Explicit Form Consent Checkbox for Hardware Telemetry */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5">
          <label
            id="esp32-form-consent-label"
            htmlFor="esp32-lan-consent-checkbox"
            className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-300 leading-snug"
          >
            <input
              id="esp32-lan-consent-checkbox"
              data-testid="esp32-lan-consent-checkbox"
              type="checkbox"
              checked={formConsents.lanTransmissionConfirmed}
              onChange={(e) =>
                onUpdateFormConsents({
                  ...formConsents,
                  lanTransmissionConfirmed: e.target.checked,
                })
              }
              className="mt-0.5 h-3.5 w-3.5 accent-[#00F5D4] rounded shrink-0"
            />
            <span>
              <strong className="font-mono text-slate-100">
                Form Consent:
              </strong>{' '}
              I authorize local HTTP GET fluid level transmission (throttled to
              150ms) to this ESP32 IP and confirm no patient-identifiable data
              is entered, per our{' '}
              <button
                type="button"
                onClick={() => onOpenLegalModal('privacy_policy')}
                className="text-[#00F5D4] underline hover:text-white"
              >
                Privacy Policy
              </button>{' '}
              &amp;{' '}
              <button
                type="button"
                onClick={() => onOpenLegalModal('terms_of_service')}
                className="text-[#00F5D4] underline hover:text-white"
              >
                Terms
              </button>
              .
            </span>
          </label>
        </div>
      </div>

      {/* Web Speech API Voice Alert Controls & Status */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-mono text-slate-300 font-medium">
              ACOUSTIC ICU VOICE SYNTHESIS
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Announces emergency pinch-clamp actuation at ≤10%
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleVoiceAlerts}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors whitespace-nowrap shrink-0 ${
                voiceAlertsEnabled
                  ? 'border-[#00F5D4]/50 bg-[#00F5D4]/10 text-[#00F5D4]'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {voiceAlertsEnabled ? 'Voice Armed' : 'Voice Muted'}
            </button>
            <button
              type="button"
              onClick={onTestVoiceAlert}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Test Voice Alert
            </button>
          </div>
        </div>

        {lastVoiceAnnouncement && (
          <div
            data-testid="voice-announcement-banner"
            role="alert"
            className="bg-rose-950/40 border border-rose-800/70 rounded-lg px-3 py-2 text-xs font-mono text-rose-200"
          >
            SPEECH SYNTHESIS: &ldquo;{lastVoiceAnnouncement}&rdquo;
          </div>
        )}
      </div>

      {/* Recent ESP32 HTTP GET Command Log */}
      <div className="pt-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>RECENT ESP32 SERVO TELEMETRY LOG</span>
          <span>MODE: NO-CORS</span>
        </div>
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg divide-y divide-slate-800/60 max-h-28 overflow-y-auto">
          {commandLogs.length === 0 ? (
            <div className="px-3 py-2.5 text-xs font-mono text-slate-500">
              No HTTP GET commands dispatched yet.
            </div>
          ) : (
            commandLogs.map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono"
              >
                <span className="text-slate-400 shrink-0">{entry.timestamp}</span>
                <span className="text-slate-200 truncate">{entry.url}</span>
                <span
                  className={`shrink-0 ${
                    entry.level <= 10 ? 'text-[#F43F5E]' : 'text-[#00F5D4]'
                  }`}
                >
                  {entry.servoState}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
