import React, { useState } from 'react';
import {
  CookieConsentState,
  LegalDocumentTab,
} from '../utils/complianceLogic';

interface CookieConsentBannerProps {
  consent: CookieConsentState;
  onSaveConsent: (updated: CookieConsentState) => void;
  onOpenLegalModal: (tab: LegalDocumentTab) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  consent,
  onSaveConsent,
  onOpenLegalModal,
}) => {
  const [functionalEnabled, setFunctionalEnabled] = useState<boolean>(
    consent.functionalPreferences
  );
  const [showCustomize, setShowCustomize] = useState<boolean>(false);

  if (consent.hasResponded) {
    return null;
  }

  const handleAcceptEssential = () => {
    onSaveConsent({
      hasResponded: true,
      strictlyNecessary: true,
      functionalPreferences: false,
      analyticsTelemetry: false,
      updatedAtIso: new Date().toISOString(),
      version: '1.0.0',
    });
  };

  const handleAcceptAll = () => {
    onSaveConsent({
      hasResponded: true,
      strictlyNecessary: true,
      functionalPreferences: true,
      analyticsTelemetry: false,
      updatedAtIso: new Date().toISOString(),
      version: '1.0.0',
    });
  };

  const handleSaveCustom = () => {
    onSaveConsent({
      hasResponded: true,
      strictlyNecessary: true,
      functionalPreferences: functionalEnabled,
      analyticsTelemetry: false,
      updatedAtIso: new Date().toISOString(),
      version: '1.0.0',
    });
  };

  return (
    <aside
      role="region"
      aria-label="Cookie and Local Storage Consent Banner"
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 pointer-events-none"
    >
      <div className="max-w-[1360px] mx-auto bg-[#0B0F19]/95 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-4 sm:p-5 shadow-2xl pointer-events-auto">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#00F5D4]">
              <span>● PRIVACY &amp; COOKIE CONSENT</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">ZERO THIRD-PARTY TRACKERS</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">STRICT DATA MINIMIZATION</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              SalineGuard AI processes all camera frames locally in volatile
              browser memory (0 cloud uploads) and uses strictly necessary local
              storage to remember your privacy choices. With your consent,
              optional functional storage can retain your bedside ESP32 IP and
              IV bag calibration settings. Read our{' '}
              <button
                type="button"
                onClick={() => onOpenLegalModal('privacy_policy')}
                className="text-[#00F5D4] underline hover:text-white font-medium"
              >
                Privacy Policy
              </button>
              ,{' '}
              <button
                type="button"
                onClick={() => onOpenLegalModal('terms_of_service')}
                className="text-[#00F5D4] underline hover:text-white font-medium"
              >
                Terms of Service
              </button>
              , and{' '}
              <button
                type="button"
                onClick={() => onOpenLegalModal('cookie_policy')}
                className="text-[#00F5D4] underline hover:text-white font-medium"
              >
                Cookie Policy
              </button>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCustomize((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap"
            >
              {showCustomize ? 'Hide Options' : 'Customize'}
            </button>
            <button
              type="button"
              data-testid="cookie-accept-essential"
              onClick={handleAcceptEssential}
              className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-semibold text-slate-100 transition-colors whitespace-nowrap"
            >
              Essential Only
            </button>
            <button
              type="button"
              data-testid="cookie-accept-all"
              onClick={handleAcceptAll}
              className="px-4 py-2 rounded-xl bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-xs font-mono font-semibold text-slate-950 transition-colors whitespace-nowrap"
            >
              Accept Functional &amp; Essential
            </button>
          </div>
        </div>

        {showCustomize && (
          <div className="mt-4 pt-4 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-100">
                    1. Strictly Necessary
                  </span>
                  <span className="text-[#00F5D4]">ALWAYS ACTIVE</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Stores your consent banner status and maintains ephemeral
                  in-memory safety state for the SG90 emergency clamp.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <label
                    htmlFor="banner-functional-cookie-toggle"
                    className="font-semibold text-slate-100 cursor-pointer"
                  >
                    2. Functional Bedside Prefs
                  </label>
                  <input
                    id="banner-functional-cookie-toggle"
                    type="checkbox"
                    checked={functionalEnabled}
                    onChange={(e) => setFunctionalEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[#00F5D4] rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Optionally saves your ESP32 IP address (e.g. 192.168.4.1), IV
                  bag volume, and flow rate in browser localStorage.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-400">
                    3. Third-Party Analytics
                  </span>
                  <span className="text-rose-400">DISABLED (0 SDKs)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  SalineGuard AI embeds zero third-party analytics, ad pixels,
                  or external tracking scripts.
                </p>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="px-3 py-1.5 rounded-lg bg-[#00F5D4] text-slate-950 text-xs font-mono font-semibold hover:bg-[#00F5D4]/90 transition-colors"
                >
                  Save Selected Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
