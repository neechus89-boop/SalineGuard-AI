import { FlowStatus, PatientAssignment, WardBed } from '../types/telemetry';

export function deriveFlowStatus(level: number, clamped: boolean): FlowStatus {
  if (clamped || level <= 10) return 'AUTO_CLAMPED';
  if (level <= 50) return 'LOW_SALINE';
  return 'NORMAL_FLOW';
}

export const DEFAULT_PATIENT_ASSIGNMENTS: Record<string, PatientAssignment> = {
  'BED-01': {
    bedId: 'BED-01',
    patientName: 'Raghav Menon',
    mrn: 'MRN-10142',
    room: 'ICU-101',
    clinicalNote: 'Post-Op Fluid Monitoring',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 110,
    bagVolumeMl: 500,
    admittedAt: '2026-11-14T08:15:00.000Z',
  },
  'BED-02': {
    bedId: 'BED-02',
    patientName: 'Lakshmi Nair',
    mrn: 'MRN-10204',
    room: 'ICU-102',
    clinicalNote: 'Post-CABG',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 120,
    bagVolumeMl: 500,
    admittedAt: '2026-11-13T14:30:00.000Z',
  },
  'BED-03': {
    bedId: 'BED-03',
    patientName: 'Arun Kurian',
    mrn: 'MRN-10211',
    room: 'ICU-103',
    clinicalNote: 'Neuro Obs',
    solution: 'Ringer Lactate',
    dripRateMlHr: 95,
    bagVolumeMl: 500,
    admittedAt: '2026-11-13T19:00:00.000Z',
  },
  'BED-04': {
    bedId: 'BED-04',
    patientName: 'Fathima Beevi',
    mrn: 'MRN-10219',
    room: 'ICU-104',
    clinicalNote: 'Sepsis Care',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 150,
    bagVolumeMl: 1000,
    admittedAt: '2026-11-12T22:10:00.000Z',
  },
  'BED-05': {
    bedId: 'BED-05',
    patientName: 'Suresh Babu',
    mrn: 'MRN-10224',
    room: 'ICU-105',
    clinicalNote: 'Renal Ward',
    solution: 'Dextrose 5%',
    dripRateMlHr: 80,
    bagVolumeMl: 500,
    admittedAt: '2026-11-14T06:45:00.000Z',
  },
  'BED-06': {
    bedId: 'BED-06',
    patientName: 'Deepa Thomas',
    mrn: 'MRN-10230',
    room: 'ICU-106',
    clinicalNote: 'Trauma Unit',
    solution: 'Ringer Lactate',
    dripRateMlHr: 110,
    bagVolumeMl: 500,
    admittedAt: '2026-11-14T11:20:00.000Z',
  },
  'BED-07': {
    bedId: 'BED-07',
    patientName: 'Vinod Kumar',
    mrn: 'MRN-10237',
    room: 'ICU-107',
    clinicalNote: 'Pulm ICU',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 100,
    bagVolumeMl: 500,
    admittedAt: '2026-11-15T01:15:00.000Z',
  },
  'BED-08': {
    bedId: 'BED-08',
    patientName: 'Anitha Raj',
    mrn: 'MRN-10245',
    room: 'ICU-108',
    clinicalNote: 'Cardiac Bay',
    solution: 'Dextrose 5%',
    dripRateMlHr: 75,
    bagVolumeMl: 500,
    admittedAt: '2026-11-14T16:40:00.000Z',
  },
  'BED-09': {
    bedId: 'BED-09',
    patientName: 'Mathew Joseph',
    mrn: 'MRN-10252',
    room: 'ICU-109',
    clinicalNote: 'Ortho Recov',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 125,
    bagVolumeMl: 500,
    admittedAt: '2026-11-15T04:00:00.000Z',
  },
  'BED-10': {
    bedId: 'BED-10',
    patientName: 'Nandini Varma',
    mrn: 'MRN-10258',
    room: 'ICU-110',
    clinicalNote: 'GI Stepdown',
    solution: 'Ringer Lactate',
    dripRateMlHr: 90,
    bagVolumeMl: 500,
    admittedAt: '2026-11-13T09:50:00.000Z',
  },
  'BED-11': {
    bedId: 'BED-11',
    patientName: 'Salim Muhammed',
    mrn: 'MRN-10261',
    room: 'ICU-111',
    clinicalNote: 'Resp Support',
    solution: 'Dextrose 5%',
    dripRateMlHr: 85,
    bagVolumeMl: 500,
    admittedAt: '2026-11-14T20:05:00.000Z',
  },
  'BED-12': {
    bedId: 'BED-12',
    patientName: 'Priya Menon',
    mrn: 'MRN-10269',
    room: 'ICU-112',
    clinicalNote: 'Endocrine',
    solution: 'Normal Saline 0.9%',
    dripRateMlHr: 60,
    bagVolumeMl: 500,
    admittedAt: '2026-11-15T07:30:00.000Z',
  },
};

const INITIAL_LEVELS: Record<string, number> = {
  'BED-02': 84,
  'BED-03': 41,
  'BED-04': 67,
  'BED-05': 92,
  'BED-06': 28,
  'BED-07': 74,
  'BED-08': 59,
  'BED-09': 88,
  'BED-10': 63,
  'BED-11': 79,
  'BED-12': 95,
};

export function buildInitialWardBeds(
  assignments: Record<string, PatientAssignment>
): WardBed[] {
  return Object.keys(INITIAL_LEVELS).map((bedId) => {
    const a = assignments[bedId] ?? DEFAULT_PATIENT_ASSIGNMENTS[bedId];
    const level = INITIAL_LEVELS[bedId] ?? 80;
    const status = deriveFlowStatus(level, false);
    return {
      id: bedId,
      room: a.room,
      patientName: a.patientName,
      mrn: a.mrn,
      patientCode: `${a.mrn} · ${a.clinicalNote}`,
      solution: a.solution,
      level,
      dripRateMlHr: a.dripRateMlHr,
      clamped: false,
      servoAngle: 0,
      status,
      bagVolumeMl: a.bagVolumeMl,
      lastUpdated: 'Live',
    };
  });
}
