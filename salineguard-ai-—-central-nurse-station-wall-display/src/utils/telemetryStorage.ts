import {
  DEFAULT_PATIENT_ASSIGNMENTS,
  deriveFlowStatus,
} from '../data/wardBeds';
import {
  PatientAssignment,
  TelemetryHistoryEntry,
} from '../types/telemetry';

const ASSIGNMENTS_KEY = 'salineguard_patient_assignments_v1';
const HISTORY_KEY = 'salineguard_telemetry_history_v1';
const MAX_HISTORY_RECORDS = 3000;

export function loadPatientAssignments(): Record<string, PatientAssignment> {
  if (typeof window === 'undefined') return { ...DEFAULT_PATIENT_ASSIGNMENTS };
  try {
    const raw = window.localStorage.getItem(ASSIGNMENTS_KEY);
    if (!raw) return { ...DEFAULT_PATIENT_ASSIGNMENTS };
    const parsed = JSON.parse(raw) as Record<string, PatientAssignment>;
    return {
      ...DEFAULT_PATIENT_ASSIGNMENTS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_PATIENT_ASSIGNMENTS };
  }
}

export function savePatientAssignments(
  assignments: Record<string, PatientAssignment>
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Generates realistic multi-day clinical baseline telemetry records on first launch
 * so date-range trend analysis is immediately populated while live events append in real time.
 */
function generateBaselineHistory(
  assignments: Record<string, PatientAssignment>
): TelemetryHistoryEntry[] {
  const now = Date.now();
  const entries: TelemetryHistoryEntry[] = [];

  // Seed 48 hours of fluid depletion + bag change cycles for BED-01, BED-03, BED-06, BED-02
  const bedConfigs: Array<{ bedId: string; hoursBack: number; stepHours: number; startLevel: number; drainPerStep: number }> = [
    { bedId: 'BED-01', hoursBack: 48, stepHours: 1.5, startLevel: 98, drainPerStep: 8 },
    { bedId: 'BED-02', hoursBack: 36, stepHours: 2, startLevel: 95, drainPerStep: 7 },
    { bedId: 'BED-03', hoursBack: 36, stepHours: 2, startLevel: 92, drainPerStep: 9 },
    { bedId: 'BED-06', hoursBack: 30, stepHours: 1.5, startLevel: 96, drainPerStep: 10 },
  ];

  for (const cfg of bedConfigs) {
    const patient = assignments[cfg.bedId] ?? DEFAULT_PATIENT_ASSIGNMENTS[cfg.bedId];
    let level = cfg.startLevel;
    const totalSteps = Math.floor(cfg.hoursBack / cfg.stepHours);

    for (let i = totalSteps; i >= 1; i--) {
      const ts = new Date(now - i * cfg.stepHours * 3600 * 1000).toISOString();
      const prevStatus = deriveFlowStatus(level + cfg.drainPerStep, false);
      const isClamped = level <= 10;
      const status = deriveFlowStatus(level, isClamped);

      let kind: TelemetryHistoryEntry['kind'] = 'telemetry';
      let note = 'Scheduled optical fluid reading';

      if (isClamped) {
        kind = 'clamp_action';
        note = 'Auto-clamped at 10% threshold · Backflow locked';
      } else if (prevStatus === 'NORMAL_FLOW' && status === 'LOW_SALINE') {
        kind = 'status_change';
        note = 'Crossed 50% low saline warning threshold';
      }

      entries.push({
        id: `seed-${cfg.bedId}-${i}`,
        timestamp: ts,
        bedId: cfg.bedId,
        room: patient.room,
        patientName: patient.patientName,
        mrn: patient.mrn,
        level,
        status,
        clamped: isClamped,
        servoAngle: isClamped ? 90 : 0,
        kind,
        note,
      });

      if (isClamped) {
        // Simulate nurse unclamping & hanging new bag 15 minutes later
        const resetTs = new Date(
          now - i * cfg.stepHours * 3600 * 1000 + 15 * 60 * 1000
        ).toISOString();
        level = 100;
        entries.push({
          id: `seed-${cfg.bedId}-${i}-reset`,
          timestamp: resetTs,
          bedId: cfg.bedId,
          room: patient.room,
          patientName: patient.patientName,
          mrn: patient.mrn,
          level: 100,
          status: 'NORMAL_FLOW',
          clamped: false,
          servoAngle: 0,
          kind: 'clamp_action',
          note: 'Nurse unclamp & new 500 mL bag hung',
        });
      } else {
        level = Math.max(8, level - cfg.drainPerStep);
      }
    }
  }

  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function loadTelemetryHistory(
  assignments: Record<string, PatientAssignment>
): TelemetryHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      const seeded = generateBaselineHistory(assignments);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as TelemetryHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTelemetryHistory(entries: TelemetryHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed =
      entries.length > MAX_HISTORY_RECORDS
        ? entries.slice(entries.length - MAX_HISTORY_RECORDS)
        : entries;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearTelemetryHistoryStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  } catch {
    // Ignore
  }
}
