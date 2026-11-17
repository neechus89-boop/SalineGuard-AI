import { calculateEstimatedTimeRemaining } from './telemetryLogic';

export type PrescribedBagMl = 250 | 500 | 1000;
export type InfusionSessionStatus =
  | 'COMPLETED'
  | 'CLAMPED_AUTO'
  | 'MANUAL_STOP';

export interface PatientInput {
  patientCode: string;
  fullName: string;
  age: number;
  wardBed: string;
  diagnosis: string;
  prescribedBagMl: PrescribedBagMl;
  prescribedRateMlHr: number;
  attendingClinician: string;
}

export interface PatientRecord extends PatientInput {
  id: string;
  ownerId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface InfusionSessionInput {
  patientId: string;
  patientCode: string;
  wardBed: string;
  bottleCapacityMl: PrescribedBagMl;
  flowRateMlPerHr: number;
  startLevelPercent: number;
  endLevelPercent: number;
  durationSeconds: number;
  clampTriggered: boolean;
  status: InfusionSessionStatus;
  notes?: string;
}

export interface InfusionSessionRecord extends InfusionSessionInput {
  id: string;
  volumeUsedMl: number;
  bottlesConsumed: number;
  estimatedTimeMinutes: number;
  ownerId: string;
  createdAtMs: number;
}

export interface InvestmentAnalyticsSummary {
  totalPatients: number;
  totalSessions: number;
  totalVolumeInfusedMl: number;
  totalVolumeInfusedLiters: number;
  totalBottlesConsumed: number;
  avgBottleDurationMinutes: number;
  formattedAvgDuration: string;
  avgVolumePerSessionMl: number;
  autoClampEventsCount: number;
  projectedMonthlyBottlesAllBeds: number;
  projectedAnnualBottlesAllBeds: number;
  bagSizeBreakdown: {
    bag250Count: number;
    bag500Count: number;
    bag1000Count: number;
  };
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeDocumentId(raw: string, prefix = 'rec'): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const stamp = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const candidate = cleaned ? `${prefix}-${cleaned}-${stamp}` : `${prefix}-${stamp}`;
  return candidate.slice(0, 128);
}

export function normalizeBagVolume(ml: number): PrescribedBagMl {
  if (ml <= 250) return 250;
  if (ml >= 1000) return 1000;
  return 500;
}

export function validateAndSanitizePatientInput(
  input: PatientInput
): { valid: boolean; errors: string[]; payload: PatientInput } {
  const errors: string[] = [];

  const patientCode = input.patientCode
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .slice(0, 40);
  if (patientCode.length < 2 || !VALID_ID_REGEX.test(patientCode)) {
    errors.push('Patient MRN / Code must be 2–40 alphanumeric/hyphen characters.');
  }

  const fullName = input.fullName.trim().slice(0, 100);
  if (fullName.length < 2) {
    errors.push('Patient full name must be at least 2 characters.');
  }

  const age = Math.max(0, Math.min(130, Math.round(Number(input.age) || 0)));
  if (Number.isNaN(Number(input.age)) || Number(input.age) < 0 || Number(input.age) > 130) {
    errors.push('Patient age must be between 0 and 130.');
  }

  const wardBed = input.wardBed.trim().slice(0, 60);
  if (wardBed.length < 2) {
    errors.push('Ward / Bed location must be at least 2 characters.');
  }

  const diagnosis = input.diagnosis.trim().slice(0, 160);
  if (diagnosis.length < 2) {
    errors.push('Clinical diagnosis / IV indication must be at least 2 characters.');
  }

  const prescribedBagMl = normalizeBagVolume(Number(input.prescribedBagMl));
  const prescribedRateMlHr = Math.max(
    10,
    Math.min(1000, Math.round(Number(input.prescribedRateMlHr) || 125))
  );

  const attendingClinician = input.attendingClinician.trim().slice(0, 80);
  if (attendingClinician.length < 2) {
    errors.push('Attending clinician name must be at least 2 characters.');
  }

  return {
    valid: errors.length === 0,
    errors,
    payload: {
      patientCode,
      fullName,
      age,
      wardBed,
      diagnosis,
      prescribedBagMl,
      prescribedRateMlHr,
      attendingClinician,
    },
  };
}

export function buildInfusionSessionPayload(
  input: InfusionSessionInput
): Omit<InfusionSessionRecord, 'id' | 'ownerId' | 'createdAtMs'> {
  const bottleCapacityMl = normalizeBagVolume(input.bottleCapacityMl);
  const flowRateMlPerHr = Math.max(
    10,
    Math.min(1000, Math.round(input.flowRateMlPerHr || 125))
  );
  const startLevelPercent = Math.max(
    0,
    Math.min(100, Math.round(input.startLevelPercent))
  );
  const endLevelPercent = Math.max(
    0,
    Math.min(100, Math.round(input.endLevelPercent))
  );

  const deltaPercent = Math.max(0, startLevelPercent - endLevelPercent);
  const volumeUsedMl = Math.min(
    2000,
    Math.round((deltaPercent / 100) * bottleCapacityMl)
  );
  const bottlesConsumed =
    Math.round((volumeUsedMl / bottleCapacityMl) * 100) / 100;
  const durationSeconds = Math.max(
    1,
    Math.min(604800, Math.round(input.durationSeconds))
  );

  const est = calculateEstimatedTimeRemaining(
    startLevelPercent,
    bottleCapacityMl,
    flowRateMlPerHr
  );

  const cleanNotes = input.notes?.trim().slice(0, 240);

  return {
    patientId: input.patientId.trim().slice(0, 128),
    patientCode: input.patientCode
      .trim()
      .replace(/[^a-zA-Z0-9_\-]/g, '-')
      .slice(0, 40),
    wardBed: input.wardBed.trim().slice(0, 60),
    bottleCapacityMl,
    flowRateMlPerHr,
    startLevelPercent,
    endLevelPercent,
    volumeUsedMl,
    bottlesConsumed,
    durationSeconds,
    estimatedTimeMinutes: Math.max(
      0,
      Math.min(10080, est.minutesToClamp)
    ),
    clampTriggered: Boolean(input.clampTriggered),
    status: input.status,
    ...(cleanNotes ? { notes: cleanNotes } : {}),
  };
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(
      2,
      '0'
    )}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function aggregateInvestmentMetrics(
  sessions: InfusionSessionRecord[],
  patients: PatientRecord[]
): InvestmentAnalyticsSummary {
  const totalPatients = patients.length;
  const totalSessions = sessions.length;

  let totalVolumeInfusedMl = 0;
  let totalBottlesConsumed = 0;
  let totalDurationSeconds = 0;
  let autoClampEventsCount = 0;
  let bag250Count = 0;
  let bag500Count = 0;
  let bag1000Count = 0;

  for (const s of sessions) {
    totalVolumeInfusedMl += s.volumeUsedMl;
    totalBottlesConsumed += s.bottlesConsumed;
    totalDurationSeconds += s.durationSeconds;
    if (s.clampTriggered || s.status === 'CLAMPED_AUTO') {
      autoClampEventsCount++;
    }
    if (s.bottleCapacityMl === 250) bag250Count++;
    else if (s.bottleCapacityMl === 1000) bag1000Count++;
    else bag500Count++;
  }

  const avgDurationMinutes =
    totalSessions > 0
      ? Math.round((totalDurationSeconds / totalSessions / 60) * 10) / 10
      : 0;
  const avgVolumePerSessionMl =
    totalSessions > 0 ? Math.round(totalVolumeInfusedMl / totalSessions) : 0;

  // Estimate projected monthly saline bottles needed across registered hospital beds
  // using observed patient flow rates (assuming standard 90% usable bag turnover per cycle)
  const activeBeds = Math.max(1, totalPatients);
  const avgPrescribedMlHr =
    totalPatients > 0
      ? patients.reduce((acc, p) => acc + p.prescribedRateMlHr, 0) /
        totalPatients
      : 125;
  const avgBagMl =
    totalPatients > 0
      ? patients.reduce((acc, p) => acc + p.prescribedBagMl, 0) / totalPatients
      : 500;
  const usableBagMl = avgBagMl * 0.9;
  const hoursPerBottle = usableBagMl / Math.max(10, avgPrescribedMlHr);
  const bottlesPerDayPerBed = 24 / Math.max(0.5, hoursPerBottle);
  const projectedMonthlyBottlesAllBeds = Math.round(
    bottlesPerDayPerBed * 30 * activeBeds
  );
  const projectedAnnualBottlesAllBeds = projectedMonthlyBottlesAllBeds * 12;

  const minsInt = Math.floor(avgDurationMinutes);
  const secsRem = Math.round((avgDurationMinutes - minsInt) * 60);

  return {
    totalPatients,
    totalSessions,
    totalVolumeInfusedMl,
    totalVolumeInfusedLiters: Math.round((totalVolumeInfusedMl / 1000) * 100) / 100,
    totalBottlesConsumed: Math.round(totalBottlesConsumed * 100) / 100,
    avgBottleDurationMinutes: avgDurationMinutes,
    formattedAvgDuration:
      totalSessions > 0
        ? `${minsInt}m ${String(secsRem).padStart(2, '0')}s`
        : '0m 00s',
    avgVolumePerSessionMl,
    autoClampEventsCount,
    projectedMonthlyBottlesAllBeds,
    projectedAnnualBottlesAllBeds,
    bagSizeBreakdown: {
      bag250Count,
      bag500Count,
      bag1000Count,
    },
  };
}

export function buildAnalyticsCsv(
  sessions: InfusionSessionRecord[],
  patients: PatientRecord[]
): string {
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const headers = [
    'SessionID',
    'TimestampISO',
    'PatientCode',
    'PatientName',
    'WardBed',
    'Diagnosis',
    'BottleCapacityMl',
    'FlowRateMlPerHr',
    'StartPercent',
    'EndPercent',
    'VolumeUsedMl',
    'BottlesConsumed',
    'DurationSeconds',
    'EstTimeToClampMinutes',
    'AutoClampTriggered',
    'Status',
    'Notes',
  ];

  const escapeCsv = (v: string | number | boolean) =>
    `"${String(v).replace(/"/g, '""')}"`;

  const rows = sessions.map((s) => {
    const p = patientMap.get(s.patientId);
    return [
      s.id,
      new Date(s.createdAtMs || Date.now()).toISOString(),
      s.patientCode,
      p?.fullName || 'N/A',
      s.wardBed,
      p?.diagnosis || 'N/A',
      s.bottleCapacityMl,
      s.flowRateMlPerHr,
      s.startLevelPercent,
      s.endLevelPercent,
      s.volumeUsedMl,
      s.bottlesConsumed,
      s.durationSeconds,
      s.estimatedTimeMinutes,
      s.clampTriggered,
      s.status,
      s.notes || '',
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
