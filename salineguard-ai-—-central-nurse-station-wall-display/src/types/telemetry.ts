export type FlowStatus = 'NORMAL_FLOW' | 'LOW_SALINE' | 'AUTO_CLAMPED';

export type IvSolutionType = 'Normal Saline 0.9%' | 'Ringer Lactate' | 'Dextrose 5%';

export interface Esp32StatusPayload {
  level: number;
  clamped: boolean;
  servoAngle: number;
  status: FlowStatus | string;
}

export interface PatientAssignment {
  bedId: string;
  patientName: string;
  mrn: string;
  room: string;
  clinicalNote: string;
  solution: IvSolutionType;
  dripRateMlHr: number;
  bagVolumeMl: number;
  admittedAt: string;
}

export interface WardBed {
  id: string;
  room: string;
  patientName: string;
  mrn: string;
  patientCode: string;
  solution: IvSolutionType;
  level: number;
  dripRateMlHr: number;
  clamped: boolean;
  servoAngle: number;
  status: FlowStatus;
  bagVolumeMl: number;
  lastUpdated: string;
}

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'action';

export interface AuditEvent {
  id: string;
  timestamp: string;
  bedId: string;
  severity: AuditSeverity;
  eventTitle: string;
  detail: string;
  levelSnapshot: number;
  servoAngleSnapshot: number;
}

export type HistoryRecordKind =
  | 'telemetry'
  | 'status_change'
  | 'clamp_action'
  | 'patient_update';

export interface TelemetryHistoryEntry {
  id: string;
  timestamp: string; // ISO 8601
  bedId: string;
  room: string;
  patientName: string;
  mrn: string;
  level: number;
  status: FlowStatus;
  clamped: boolean;
  servoAngle: number;
  kind: HistoryRecordKind;
  note: string;
}
