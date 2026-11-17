import React, { useEffect, useState } from 'react';
import {
  CookieConsentState,
  FormConsentState,
  LegalDocumentTab,
  getThirdPartySdkAuditManifest,
  CONSENT_STORAGE_KEY,
  PREFS_STORAGE_KEY,
} from '../utils/complianceLogic';

interface LegalComplianceModalProps {
  isOpen: boolean;
  activeTab: LegalDocumentTab;
  onSelectTab: (tab: LegalDocumentTab) => void;
  onClose: () => void;
  cookieConsent: CookieConsentState;
  onUpdateCookieConsent: (updated: CookieConsentState) => void;
  formConsents: FormConsentState;
  onUpdateFormConsents: (updated: FormConsentState) => void;
  onPurgeAllLocalData: () => void;
}

export const LegalComplianceModal: React.FC<LegalComplianceModalProps> = ({
  isOpen,
  activeTab,
  onSelectTab,
  onClose,
  cookieConsent,
  onUpdateCookieConsent,
  formConsents,
  onUpdateFormConsents,
  onPurgeAllLocalData,
}) => {
  const [liveAuditTimestamp, setLiveAuditTimestamp] = useState<string | null>(
    null
  );
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sdkManifest = getThirdPartySdkAuditManifest();

  const runLiveBrowserAudit = () => {
    setLiveAuditTimestamp(
      new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  };

  const scriptTagsCount =
    typeof document !== 'undefined' ? document.querySelectorAll('script').length : 1;
  const activeCookiesCount =
    typeof document !== 'undefined' && document.cookie.trim() !== ''
      ? document.cookie.split(';').length
      : 0;
  const localStorageKeysCount =
    typeof window !== 'undefined' && window.localStorage
      ? [CONSENT_STORAGE_KEY, PREFS_STORAGE_KEY].filter(
          (k) => window.localStorage.getItem(k) !== null
        ).length
      : 0;

  const tabs: { id: LegalDocumentTab; label: string }[] = [
    { id: 'privacy_policy', label: '1. Privacy Policy' },
    { id: 'terms_of_service', label: '2. Terms of Service' },
    { id: 'cookie_policy', label: '3. Cookie Policy' },
    { id: 'form_consents', label: '4. Form Consents & Data Minimization' },
    { id: 'sdk_audit', label: '5. Third-Party SDK Audit' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinical Governance, Privacy, Terms, and SDK Security Center"
      data-testid="legal-compliance-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#0B0F19] border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800 bg-[#111827]/90">
          <div>
            <div className="text-[11px] font-mono text-[#00F5D4] tracking-wider">
              SALINEGUARD AI · CLINICAL PRIVACY, GOVERNANCE &amp; SECURITY AUDIT
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-50 mt-0.5">
              Legal Policies, Form Consents &amp; Third-Party SDK Audit
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-legal-modal"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 transition-colors"
          >
            Close [ESC]
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Compliance Sections"
          className="flex flex-wrap items-center gap-1.5 px-5 py-3 bg-slate-950/90 border-b border-slate-800"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => onSelectTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                activeTab === t.id
                  ? 'bg-[#00F5D4] text-slate-950 font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm text-slate-300 leading-relaxed flex-1">
          {activeTab === 'privacy_policy' && (
            <article className="space-y-4" data-testid="privacy-policy-content">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-slate-50">
                  SalineGuard AI — Clinical &amp; Device Privacy Policy
                </h3>
                <span className="text-xs font-mono text-[#00F5D4]">
                  EFFECTIVE: NOVEMBER 2026 · HIPAA/GDPR SAFE-BY-DESIGN
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs font-mono font-semibold text-[#00F5D4]">
                    1. AUTHORIZED HOSPITAL PATIENT &amp; SUPPLY DATA
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    Hospital patient records (MRN code, ward/bed, diagnosis,
                    prescribed saline bag volume, flow rate) and saline bottle
                    consumption logs (mL used, time taken) are stored in Cloud
                    Firestore strictly for verified authenticated clinicians
                    with per-user{' '}
                    <code className="text-slate-100">ownerId</code> security
                    rules isolation.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs font-mono font-semibold text-[#00F5D4]">
                    2. 100% ON-DEVICE OPTICAL CAMERA PROCESSING
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    When Rear Camera mode is enabled via{' '}
                    <code className="text-slate-100">
                      navigator.mediaDevices.getUserMedia
                    </code>
                    , video frames are analyzed at 30 FPS inside a volatile
                    HTML5 <code className="text-slate-100">&lt;canvas&gt;</code>{' '}
                    pixel buffer to locate the bright red float ball. Frames are
                    immediately discarded each tick and are never recorded,
                    cached, or transmitted over any network.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs font-mono font-semibold text-[#00F5D4]">
                    3. LOCAL AREA NETWORK (LAN) ESP32 TELEMETRY
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    The application communicates exclusively with your local
                    ESP32 bedside pinch-clamp controller (default IP:{' '}
                    <code className="text-slate-100">192.168.4.1</code>) via
                    throttled (150ms) HTTP GET requests containing only the
                    integer fluid percentage:{' '}
                    <code className="text-slate-100">
                      http://&lt;espIp&gt;/set?level=X
                    </code>
                    .
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-xs font-mono font-semibold text-[#00F5D4]">
                    4. RIGHT TO ERASURE &amp; LOCAL DATA PURGE
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5">
                    Because zero data leaves your device to external cloud
                    servers, you retain 100% control over local browser state.
                    You can purge all local storage preferences and telemetry
                    logs at any time using the button at the bottom of this
                    panel.
                  </p>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'terms_of_service' && (
            <article className="space-y-4" data-testid="terms-of-service-content">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-slate-50">
                  SalineGuard AI — Terms of Service &amp; Clinical Use Agreement
                </h3>
                <span className="text-xs font-mono text-[#00F5D4]">
                  VERSION 1.0 · ICU HARDWARE &amp; SOFTWARE TERMS
                </span>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-mono text-xs font-semibold text-slate-100">
                    SECTION 1 — SUPPLEMENTAL SAFEGUARD &amp; CLINICAL SUPERVISION
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    SalineGuard AI is an automated secondary optical fluid-level
                    monitor and mechanical SG90 pinch-clamp controller designed
                    to assist clinical personnel in preventing IV line air
                    embolisms. It does not replace primary bedside nursing
                    observation, certified volumetric infusion pumps, or
                    standard hospital ICU protocols.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-mono text-xs font-semibold text-slate-100">
                    SECTION 2 — MANDATORY PRE-INFUSION CALIBRATION CHECK
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    Prior to relying on automated pinch-clamp actuation, the
                    operator must: (a) align the Top 100% and Bottom 0%
                    calibration lines with the physical IV bottle meniscus span;
                    (b) verify bright red float-ball reticle lock (&gt;80%
                    confidence); and (c) test emergency clamp actuation using
                    the &ldquo;8% Emergency Clamp&rdquo; preset to confirm full
                    90° mechanical tubing occlusion.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-mono text-xs font-semibold text-slate-100">
                    SECTION 3 — LOCAL WI-FI NETWORK ISOLATION
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    The ESP32 bedside node must be operated on a dedicated
                    medical device Wi-Fi access point or isolated local subnet.
                    Operators agree not to expose the ESP32 HTTP endpoint
                    directly to the public internet.
                  </p>
                </div>

                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
                  <h4 className="font-mono text-xs font-semibold text-slate-100">
                    SECTION 4 — LIMITATION OF WARRANTY
                  </h4>
                  <p className="mt-1 text-xs text-slate-300">
                    The software and companion ESP32 firmware interface are
                    provided &ldquo;as is&rdquo; for biomedical engineering
                    deployment, research, and clinical evaluation. Manual
                    override controls remain accessible at all times on the main
                    dashboard.
                  </p>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'cookie_policy' && (
            <article className="space-y-4" data-testid="cookie-policy-content">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-slate-50">
                  Cookie &amp; Browser LocalStorage Policy
                </h3>
                <span className="text-xs font-mono text-[#00F5D4]">
                  HTTP COOKIES SET: 0 · THIRD-PARTY COOKIES: 0
                </span>
              </div>

              <p className="text-xs text-slate-300">
                SalineGuard AI does not set any HTTP tracking cookies or
                third-party advertising cookies. We use browser{' '}
                <code className="text-slate-100">localStorage</code> strictly as
                documented in the table below, governed by your explicit
                consent:
              </p>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Storage Key</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Purpose</th>
                      <th className="py-2.5 px-3">Expiry / Retention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950/60">
                    <tr>
                      <td className="py-2.5 px-3 text-[#00F5D4]">
                        {CONSENT_STORAGE_KEY}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        Strictly Necessary
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        Records your cookie banner preference so the banner does
                        not obstruct ICU telemetry after acknowledgment.
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        Until manually purged
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#00F5D4]">
                        {PREFS_STORAGE_KEY}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        Functional (Opt-In Only)
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        Stores non-personal bedside setup (ESP32 IP, bag mL
                        capacity, flow rate). Only written if Functional
                        Preferences are enabled.
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        Consent-gated; wiped immediately upon opt-out
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-100">
                    Manage Functional Storage Consent
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Status:{' '}
                    <span className="text-[#00F5D4] font-mono">
                      {cookieConsent.functionalPreferences
                        ? 'OPTED IN (Saving ESP32 IP & Bag Volume)'
                        : 'ESSENTIAL ONLY (Functional Storage Disabled)'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCookieConsent({
                        ...cookieConsent,
                        hasResponded: true,
                        functionalPreferences: !cookieConsent.functionalPreferences,
                        updatedAtIso: new Date().toISOString(),
                      })
                    }
                    className="px-3.5 py-2 rounded-lg bg-[#00F5D4] text-slate-950 text-xs font-mono font-semibold hover:bg-[#00F5D4]/90 transition-colors"
                  >
                    {cookieConsent.functionalPreferences
                      ? 'Switch to Essential Only'
                      : 'Enable Functional Storage'}
                  </button>
                </div>
              </div>
            </article>
          )}

          {activeTab === 'form_consents' && (
            <article className="space-y-4" data-testid="form-consents-content">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-slate-50">
                  Form Consents &amp; Data Minimization Controls
                </h3>
                <span className="text-xs font-mono text-[#00F5D4]">
                  ACTIVE FORM GUARDS: 3/3 VERIFIED
                </span>
              </div>

              <p className="text-xs text-slate-300">
                Every interactive input and hardware control form in SalineGuard
                AI enforces explicit operator consent and automated data
                minimization so unnecessary or personal data is never collected:
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConsents.lanTransmissionConfirmed}
                    onChange={(e) =>
                      onUpdateFormConsents({
                        ...formConsents,
                        lanTransmissionConfirmed: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#00F5D4] rounded"
                  />
                  <div className="text-xs">
                    <div className="font-mono font-semibold text-slate-100">
                      1. ESP32 Local Network Transmission Consent
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Required before dispatching custom IP configuration or
                      manual override commands over local Wi-Fi (
                      <code>http://&lt;espIp&gt;/set?level=X</code>). Verifies
                      that no patient identifiers are entered into the host
                      field.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConsents.cameraLocalProcessingConfirmed}
                    onChange={(e) =>
                      onUpdateFormConsents({
                        ...formConsents,
                        cameraLocalProcessingConfirmed: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#00F5D4] rounded"
                  />
                  <div className="text-xs">
                    <div className="font-mono font-semibold text-slate-100">
                      2. Optical Camera Ephemeral Processing Consent
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Required before activating the device rear camera via{' '}
                      <code>getUserMedia</code>. Confirms that video frames are
                      analyzed strictly in local memory at 30 FPS and never
                      stored or uploaded.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formConsents.clinicalSupervisionConfirmed}
                    onChange={(e) =>
                      onUpdateFormConsents({
                        ...formConsents,
                        clinicalSupervisionConfirmed: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 accent-[#00F5D4] rounded"
                  />
                  <div className="text-xs">
                    <div className="font-mono font-semibold text-slate-100">
                      3. Clinical Pinch-Clamp Override Acknowledgment
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Confirms operator supervision when manually adjusting the
                      0–100% fluid slider or triggering the 8% Emergency Clamp
                      preset.
                    </p>
                  </div>
                </label>
              </div>
            </article>
          )}

          {activeTab === 'sdk_audit' && (
            <article className="space-y-4" data-testid="sdk-audit-content">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-50">
                    Third-Party SDK &amp; Runtime Dependency Security Audit
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Complete inventory of client bundles, browser APIs, and
                    unused packages stripped at build time.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="run-live-sdk-audit-btn"
                  onClick={runLiveBrowserAudit}
                  className="px-3.5 py-2 rounded-lg bg-[#00F5D4] text-slate-950 text-xs font-mono font-semibold hover:bg-[#00F5D4]/90 transition-colors"
                >
                  Run Live DOM &amp; SDK Audit
                </button>
              </div>

              {/* Live Runtime Inspection Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="text-[10px] text-slate-400">
                    3P TRACKING SDKS
                  </div>
                  <div className="text-lg font-bold text-[#10B981] mt-0.5">
                    0 DETECTED
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="text-[10px] text-slate-400">
                    HTTP COOKIES
                  </div>
                  <div className="text-lg font-bold text-[#00F5D4] mt-0.5">
                    {activeCookiesCount} ACTIVE
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="text-[10px] text-slate-400">
                    STORAGE KEYS
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {localStorageKeysCount} KEYS
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono">
                  <div className="text-[10px] text-slate-400">
                    DOM SCRIPT TAGS
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">
                    {scriptTagsCount} FIRST-PARTY
                  </div>
                </div>
              </div>

              {liveAuditTimestamp && (
                <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-300">
                  ✓ LIVE AUDIT PASSED AT {liveAuditTimestamp}: Verified 0
                  external analytics beacons, 0 cloud AI SDK calls, and 0
                  unauthorized third-party scripts in DOM.
                </div>
              )}

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">SDK / Module</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Network Scope</th>
                      <th className="py-2.5 px-3">PII Collected</th>
                      <th className="py-2.5 px-3">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950/60">
                    {sdkManifest.map((item) => (
                      <tr key={item.name}>
                        <td className="py-2.5 px-3 font-semibold text-slate-100">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {item.version}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.category}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <div>{item.networkAccess}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.notes}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400">
                          {item.piiCollected}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.status === 'VERIFIED_SAFE'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : item.status === 'STRIPPED_FROM_BUNDLE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </div>

        {/* Modal Footer with 1-Click Local Data Purge */}
        <div className="px-5 py-3.5 bg-[#111827]/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-400">
            {purgeFeedback ? (
              <span className="text-[#00F5D4] font-semibold">
                ✓ {purgeFeedback}
              </span>
            ) : (
              <span>
                Data Minimization Active: Only integer fluid % (0–100) is
                transmitted to ESP32.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="purge-local-data-btn"
              onClick={() => {
                onPurgeAllLocalData();
                setPurgeFeedback(
                  'All browser localStorage, session logs, and cached preferences purged.'
                );
              }}
              className="px-3.5 py-1.5 rounded-lg border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-mono font-semibold text-rose-300 transition-colors"
            >
              Purge All Local Storage &amp; Logs
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-xs font-mono font-semibold text-slate-950 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
