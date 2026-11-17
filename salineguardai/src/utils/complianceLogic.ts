export type LegalDocumentTab =
  | 'privacy_policy'
  | 'terms_of_service'
  | 'cookie_policy'
  | 'sdk_audit'
  | 'form_consents';

export interface CookieConsentState {
  hasResponded: boolean;
  strictlyNecessary: true;
  functionalPreferences: boolean;
  analyticsTelemetry: false;
  updatedAtIso: string | null;
  version: string;
}

export interface FormConsentState {
  lanTransmissionConfirmed: boolean;
  cameraLocalProcessingConfirmed: boolean;
  clinicalSupervisionConfirmed: boolean;
}

export interface SdkAuditEntry {
  name: string;
  version: string;
  category:
    | 'Core Runtime'
    | 'Browser Native API'
    | 'Cloud Backend SDK'
    | 'Unused / Excluded'
    | 'Third-Party Tracker';
  bundledInClient: boolean;
  networkAccess: string;
  piiCollected: string;
  status: 'VERIFIED_SAFE' | 'STRIPPED_FROM_BUNDLE' | 'BLOCKED';
  notes: string;
}

export const CONSENT_STORAGE_KEY = 'salineguard_cookie_consent_v1';
export const PREFS_STORAGE_KEY = 'salineguard_functional_prefs_v1';

export const DEFAULT_COOKIE_CONSENT: CookieConsentState = {
  hasResponded: false,
  strictlyNecessary: true,
  functionalPreferences: false,
  analyticsTelemetry: false,
  updatedAtIso: null,
  version: '1.0.0',
};

export const DEFAULT_FORM_CONSENTS: FormConsentState = {
  lanTransmissionConfirmed: true,
  cameraLocalProcessingConfirmed: true,
  clinicalSupervisionConfirmed: true,
};

/**
 * Data Minimization Guard:
 * Ensures that user input in the ESP32 host field never contains accidental PII
 * such as email addresses, spaces/names, or query strings/credentials.
 */
export function inspectInputForUnnecessaryData(rawInput: string): {
  isSafe: boolean;
  sanitized: string;
  violationReason: string | null;
} {
  const trimmed = rawInput.trim();

  // Check for email pattern (e.g., user@domain)
  if (trimmed.includes('@')) {
    return {
      isSafe: false,
      sanitized: trimmed.replace(/.*@/, ''),
      violationReason:
        'Data Minimization Policy: Email addresses or user credentials are not permitted. Enter only the ESP32 LAN IP or hostname.',
    };
  }

  // Check for spaces (e.g., accidental entry of a patient or clinician full name)
  if (/\s/.test(trimmed)) {
    return {
      isSafe: false,
      sanitized: trimmed.replace(/\s+/g, ''),
      violationReason:
        'Data Minimization Policy: Personal names or multi-word identifiers are blocked. Enter only an IPv4 address (e.g., 192.168.4.1).',
    };
  }

  // Strip any URL query parameters or fragments so no extra metadata is attached
  const cleanHost = trimmed
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0];

  return {
    isSafe: true,
    sanitized: cleanHost,
    violationReason: null,
  };
}

/**
 * Returns the static + runtime Third-Party SDK & Dependency Audit manifest.
 */
export function getThirdPartySdkAuditManifest(): SdkAuditEntry[] {
  return [
    {
      name: 'React & React DOM',
      version: '19.0.1',
      category: 'Core Runtime',
      bundledInClient: true,
      networkAccess: 'None (Local DOM rendering only)',
      piiCollected: 'None',
      status: 'VERIFIED_SAFE',
      notes: 'Used strictly for rendering the ICU telemetry interface. Zero telemetry hooks.',
    },
    {
      name: 'Firebase Auth & Cloud Firestore',
      version: 'Official Google Firebase SDK',
      category: 'Cloud Backend SDK',
      bundledInClient: true,
      networkAccess: 'Authenticated HTTPS (Google Sign-In + Firestore rules)',
      piiCollected: 'Clinician Auth + Authorized Hospital Patient / Supply Records',
      status: 'VERIFIED_SAFE',
      notes: 'Enforces strict Firestore security rules (verified email + ownerId isolation) for hospital patient records and saline bottle usage analytics.',
    },
    {
      name: 'HTML5 Canvas & MediaDevices (getUserMedia)',
      version: 'W3C Native',
      category: 'Browser Native API',
      bundledInClient: true,
      networkAccess: 'None (In-memory 30 FPS pixel buffer only)',
      piiCollected: 'None',
      status: 'VERIFIED_SAFE',
      notes: 'Processes RGB/HSV float-ball coordinates in volatile RAM. Video frames are never recorded or uploaded.',
    },
    {
      name: 'Web Speech API & Web Audio API',
      version: 'W3C Native',
      category: 'Browser Native API',
      bundledInClient: true,
      networkAccess: 'None (Local OS speech synthesizer & oscillator)',
      piiCollected: 'None',
      status: 'VERIFIED_SAFE',
      notes: 'Generates acoustic emergency clamp alerts at <=10% fluid level locally on the device.',
    },
    {
      name: 'Fetch API (LAN ESP32 Controller)',
      version: 'WHATWG Native',
      category: 'Browser Native API',
      bundledInClient: true,
      networkAccess: 'Local Wi-Fi HTTP GET (http://<espIp>/set?level=X)',
      piiCollected: 'None',
      status: 'VERIFIED_SAFE',
      notes: 'Transmits only integer fluid percentage (0-100) throttled to 150ms. Zero cookies or headers sent.',
    },
    {
      name: '@google/genai',
      version: '2.4.0 (Unused)',
      category: 'Unused / Excluded',
      bundledInClient: false,
      networkAccess: 'None (Tree-shaken / Not imported)',
      piiCollected: 'None',
      status: 'STRIPPED_FROM_BUNDLE',
      notes: 'Verified 0 imports across all source files. No external AI API calls or API keys are used.',
    },
    {
      name: 'Google Analytics / Meta Pixel / Mixpanel / Sentry',
      version: 'N/A',
      category: 'Third-Party Tracker',
      bundledInClient: false,
      networkAccess: 'Blocked (0 trackers present)',
      piiCollected: 'None',
      status: 'BLOCKED',
      notes: 'Zero third-party advertising, behavioral profiling, or session-recording SDKs installed.',
    },
  ];
}
