import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, LineChart, Users } from 'lucide-react';
import { HospitalHeader } from './components/HospitalHeader';
import { PriorityAlertBanner } from './components/PriorityAlertBanner';
import { Bed01Spotlight } from './components/Bed01Spotlight';
import { WardTelemetryGrid } from './components/WardTelemetryGrid';
import { NurseAuditLog } from './components/NurseAuditLog';
import { PatientManagementView } from './components/PatientManagementView';
import { HistoricalAnalyticsView } from './components/HistoricalAnalyticsView';
import { PatientEditModal } from './components/PatientEditModal';
import {
  DEFAULT_PATIENT_ASSIGNMENTS,
  buildInitialWardBeds,
  deriveFlowStatus,
} from './data/wardBeds';
import {
  AuditEvent,
  AuditSeverity,
  Esp32StatusPayload,
  FlowStatus,
  HistoryRecordKind,
  PatientAssignment,
  TelemetryHistoryEntry,
  WardBed,
} from './types/telemetry';
import { icuAudioEngine } from './utils/audioAlarm';
import {
  clearTelemetryHistoryStorage,
  loadPatientAssignments,
  loadTelemetryHistory,
  savePatientAssignments,
  saveTelemetryHistory,
} from './utils/telemetryStorage';

type WorkspaceTab = 'live' | 'patients' | 'history';

function normalizeEspIp(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return trimmed || '192.168.4.1';
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatClockDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeStatus(payload: Esp32StatusPayload): {
  level: number;
  clamped: boolean;
  servoAngle: number;
  status: FlowStatus;
} {
  const level = Math.max(0, Math.min(100, Number(payload.level ?? 0)));
  const clamped = Boolean(payload.clamped) || level <= 10;
  const servoAngle = Number.isFinite(Number(payload.servoAngle))
    ? Number(payload.servoAngle)
    : clamped
      ? 90
      : 0;

  let status: FlowStatus;
  if (
    payload.status === 'AUTO_CLAMPED' ||
    clamped ||
    level <= 10 ||
    servoAngle >= 45
  ) {
    status = 'AUTO_CLAMPED';
  } else if (payload.status === 'LOW_SALINE' || level <= 50) {
    status = 'LOW_SALINE';
  } else {
    status = 'NORMAL_FLOW';
  }

  return { level, clamped, servoAngle, status };
}

export default function App() {
  // Workspace Navigation Tab
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('live');

  // Clock state
  const [now, setNow] = useState<Date>(() => new Date());

  // Patient Assignments (persisted in localStorage)
  const [assignments, setAssignments] = useState<Record<string, PatientAssignment>>(() =>
    loadPatientAssignments()
  );
  const [editingBedId, setEditingBedId] = useState<string | null>(null);

  // Historical Telemetry Log (persisted in localStorage)
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryHistoryEntry[]>(() =>
    loadTelemetryHistory(loadPatientAssignments())
  );
  const [historyBedId, setHistoryBedId] = useState<string>('BED-01');

  // ESP32 Live Hardware Sync State
  const [espIp, setEspIp] = useState<string>('192.168.4.1');
  const [espConnected, setEspConnected] = useState<boolean>(false);
  const [lastPollMs, setLastPollMs] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Simulation / Demo Slider Fallback State
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [simLevel, setSimLevel] = useState<number>(78);
  const [simClamped, setSimClamped] = useState<boolean>(false);

  // Live Hardware Telemetry for BED-01
  const [hwLevel, setHwLevel] = useState<number>(78);
  const [hwClamped, setHwClamped] = useState<boolean>(false);
  const [hwServoAngle, setHwServoAngle] = useState<number>(0);
  const [hwStatus, setHwStatus] = useState<FlowStatus>('NORMAL_FLOW');

  // Remote command UI feedback
  const [isSendingCommand, setIsSendingCommand] = useState<boolean>(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  // Audio Alarm Mute State
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Simulated Ward Beds (BED-02 .. BED-12)
  const [wardBeds, setWardBeds] = useState<WardBed[]>(() =>
    buildInitialWardBeds(loadPatientAssignments())
  );

  // Audit Log State
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => [
    {
      id: 'init-1',
      timestamp: formatClockTime(new Date()),
      bedId: 'BED-01',
      severity: 'info',
      eventTitle: 'Station Telemetry Armed',
      detail: 'Polling ESP32 Access Point at 192.168.4.1 (300ms interval)',
      levelSnapshot: 78,
      servoAngleSnapshot: 0,
    },
  ]);

  // Critical Response Stopwatch (tenths of a second)
  const [elapsedTenths, setElapsedTenths] = useState<number>(0);

  // Refs for non-overlapping fetch & smart history throttling
  const isPollingRef = useRef<boolean>(false);
  const prevEspConnectedRef = useRef<boolean | null>(null);
  const prevBed01StateRef = useRef<{
    status: FlowStatus;
    clamped: boolean;
  }>({
    status: 'NORMAL_FLOW',
    clamped: false,
  });
  const lastBedSampleRef = useRef<Record<string, { level: number; time: number }>>({});

  // Persist assignments & history whenever updated
  useEffect(() => {
    savePatientAssignments(assignments);
  }, [assignments]);

  useEffect(() => {
    saveTelemetryHistory(telemetryHistory);
  }, [telemetryHistory]);

  const appendAuditEvent = useCallback(
    (
      bedId: string,
      severity: AuditSeverity,
      eventTitle: string,
      detail: string,
      levelSnapshot: number,
      servoAngleSnapshot: number
    ) => {
      const entry: AuditEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: formatClockTime(new Date()),
        bedId,
        severity,
        eventTitle,
        detail,
        levelSnapshot: Math.round(levelSnapshot),
        servoAngleSnapshot,
      };
      setAuditEvents((prev) => [entry, ...prev].slice(0, 60));
    },
    []
  );

  const appendHistoryRecord = useCallback(
    (
      bedId: string,
      level: number,
      status: FlowStatus,
      clamped: boolean,
      servoAngle: number,
      kind: HistoryRecordKind,
      note: string
    ) => {
      const patient = assignments[bedId] ?? DEFAULT_PATIENT_ASSIGNMENTS[bedId];
      const record: TelemetryHistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        bedId,
        room: patient?.room ?? 'ICU',
        patientName: patient?.patientName ?? 'Unassigned',
        mrn: patient?.mrn ?? '—',
        level: Math.round(level),
        status,
        clamped,
        servoAngle,
        kind,
        note,
      };
      setTelemetryHistory((prev) => [...prev, record]);
      lastBedSampleRef.current[bedId] = {
        level: Math.round(level),
        time: Date.now(),
      };
    },
    [assignments]
  );

  // Unlock browser Web Audio API on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      icuAudioEngine.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Digital Wall Clock (1s tick)
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Active BED-01 values (Hardware or Demo Simulation)
  const bed01Level = simulationMode ? simLevel : hwLevel;
  const bed01Clamped = simulationMode ? simClamped || simLevel <= 10 : hwClamped;
  const bed01ServoAngle = simulationMode
    ? bed01Clamped
      ? 90
      : 0
    : hwServoAngle;
  const bed01Status: FlowStatus = simulationMode
    ? deriveFlowStatus(simLevel, simClamped)
    : hwStatus;

  const bed01Assignment =
    assignments['BED-01'] ?? DEFAULT_PATIENT_ASSIGNMENTS['BED-01'];

  // Poll ESP32 /status every 300ms with strict isPollingRef lock
  const pollEsp32Status = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const targetIp = normalizeEspIp(espIp);
    const url = `http://${targetIp}/status`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 950);
    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as Esp32StatusPayload;
      const parsed = normalizeStatus(data);

      setHwLevel(parsed.level);
      setHwClamped(parsed.clamped);
      setHwServoAngle(parsed.servoAngle);
      setHwStatus(parsed.status);
      setEspConnected(true);
      setLastError(null);
      setLastPollMs(Math.max(1, Math.round(performance.now() - startedAt)));

      // Log periodic hardware sample if fluid changed by >= 2% or >= 20s elapsed
      const lastSample = lastBedSampleRef.current['BED-01'];
      const nowMs = Date.now();
      if (
        !lastSample ||
        Math.abs(lastSample.level - parsed.level) >= 2 ||
        nowMs - lastSample.time >= 20000
      ) {
        appendHistoryRecord(
          'BED-01',
          parsed.level,
          parsed.status,
          parsed.clamped,
          parsed.servoAngle,
          'telemetry',
          `Live ESP32 reading (${targetIp})`
        );
      }

      if (prevEspConnectedRef.current === false || prevEspConnectedRef.current === null) {
        appendAuditEvent(
          'BED-01',
          'info',
          'ESP32 Hardware Synced',
          `Connected to live telemetry at ${targetIp}`,
          parsed.level,
          parsed.servoAngle
        );
      }
      prevEspConnectedRef.current = true;
    } catch (err) {
      setEspConnected(false);
      setLastPollMs(null);
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Timeout (950ms)'
          : err instanceof Error
            ? err.message
            : 'Network offline';
      setLastError(message);

      if (prevEspConnectedRef.current === true) {
        appendAuditEvent(
          'BED-01',
          'warning',
          'ESP32 Link Lost',
          `Unable to reach http://${targetIp}/status (${message})`,
          hwLevel,
          hwServoAngle
        );
      }
      prevEspConnectedRef.current = false;
    } finally {
      window.clearTimeout(timeoutId);
      isPollingRef.current = false;
    }
  }, [espIp, appendAuditEvent, appendHistoryRecord, hwLevel, hwServoAngle]);

  useEffect(() => {
    if (simulationMode) {
      setEspConnected(false);
      return;
    }

    void pollEsp32Status();
    const intervalId = window.setInterval(() => {
      void pollEsp32Status();
    }, 300);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [simulationMode, pollEsp32Status]);

  // Monitor BED-01 threshold transitions -> Audit Log + Historical DB + Web Audio ICU Alarm
  useEffect(() => {
    const prev = prevBed01StateRef.current;
    const isCriticalNow =
      bed01Status === 'AUTO_CLAMPED' || bed01Clamped || bed01Level <= 10;

    if (prev.status !== bed01Status) {
      if (isCriticalNow) {
        const msg =
          bed01Level <= 10
            ? 'Auto-Clamped at Critical 10%'
            : 'Valve Clamped (90°)';
        appendAuditEvent(
          'BED-01',
          'critical',
          msg,
          'SG90 servo pinched tubing shut · Backflow prevented',
          bed01Level,
          bed01ServoAngle
        );
        appendHistoryRecord(
          'BED-01',
          bed01Level,
          bed01Status,
          true,
          Math.max(bed01ServoAngle, 90),
          'clamp_action',
          `${msg} · Backflow prevented`
        );
      } else if (bed01Status === 'LOW_SALINE') {
        appendAuditEvent(
          'BED-01',
          'warning',
          'Low Saline Warning (≤50%)',
          `Prepare replacement ${bed01Assignment.solution} bag`,
          bed01Level,
          bed01ServoAngle
        );
        appendHistoryRecord(
          'BED-01',
          bed01Level,
          bed01Status,
          false,
          bed01ServoAngle,
          'status_change',
          'Crossed ≤50% low saline warning threshold'
        );
        icuAudioEngine.playWarningChime();
      } else if (bed01Status === 'NORMAL_FLOW' && prev.status !== 'NORMAL_FLOW') {
        appendAuditEvent(
          'BED-01',
          'info',
          'Normal Flow Active',
          'Saline level nominal · Servo valve open at 0°',
          bed01Level,
          bed01ServoAngle
        );
        appendHistoryRecord(
          'BED-01',
          bed01Level,
          bed01Status,
          false,
          bed01ServoAngle,
          'status_change',
          'Normal flow restored (valve open 0°)'
        );
      }
    }

    if (isCriticalNow && !isMuted) {
      icuAudioEngine.startCriticalLoop();
    } else {
      icuAudioEngine.stopCriticalLoop();
    }

    prevBed01StateRef.current = {
      status: bed01Status,
      clamped: bed01Clamped,
    };
  }, [
    bed01Status,
    bed01Clamped,
    bed01Level,
    bed01ServoAngle,
    bed01Assignment.solution,
    isMuted,
    appendAuditEvent,
    appendHistoryRecord,
  ]);

  // Cleanup audio loop on unmount
  useEffect(() => {
    return () => {
      icuAudioEngine.stopCriticalLoop();
    };
  }, []);

  // Gentle live drift simulation for BED-02 .. BED-12 + historical logging on transitions
  useEffect(() => {
    const id = window.setInterval(() => {
      setWardBeds((prevBeds) =>
        prevBeds.map((bed) => {
          if (bed.clamped || bed.level <= 10) return bed;
          const shouldTick = Math.random() < bed.dripRateMlHr / 600;
          if (!shouldTick) return bed;

          const nextLevel = Math.max(10, bed.level - 1);
          const nextClamped = nextLevel <= 10;
          const nextStatus = deriveFlowStatus(nextLevel, nextClamped);
          const nextServoAngle = nextClamped ? 90 : 0;

          if (nextStatus !== bed.status) {
            appendHistoryRecord(
              bed.id,
              nextLevel,
              nextStatus,
              nextClamped,
              nextServoAngle,
              nextClamped ? 'clamp_action' : 'status_change',
              nextClamped
                ? 'Ward bed auto-clamped at 10% threshold'
                : 'Ward bed crossed 50% low saline threshold'
            );
          }

          return {
            ...bed,
            level: nextLevel,
            clamped: nextClamped,
            servoAngle: nextServoAngle,
            status: nextStatus,
          };
        })
      );
    }, 5500);
    return () => window.clearInterval(id);
  }, [appendHistoryRecord]);

  // Remote Servo Command: Emergency Clamp (90°)
  const handleClamp = useCallback(async () => {
    icuAudioEngine.unlock();

    if (simulationMode) {
      setSimClamped(true);
      setCommandFeedback('Simulation: Servo rotated to 90° (Pinched)');
      appendAuditEvent(
        'BED-01',
        'action',
        'Desk Emergency Clamp (90°)',
        'Manual override triggered in Demo Simulation mode',
        simLevel,
        90
      );
      appendHistoryRecord(
        'BED-01',
        simLevel,
        'AUTO_CLAMPED',
        true,
        90,
        'clamp_action',
        'Desk Emergency Clamp (90°) [Simulation]'
      );
      window.setTimeout(() => setCommandFeedback(null), 2600);
      return;
    }

    const targetIp = normalizeEspIp(espIp);
    setIsSendingCommand(true);
    setCommandFeedback(`Sending /clamp to ${targetIp}...`);

    try {
      await fetch(`http://${targetIp}/clamp`, { cache: 'no-store' });
      appendAuditEvent(
        'BED-01',
        'action',
        'Desk Emergency Clamp (90°)',
        `Dispatched GET http://${targetIp}/clamp`,
        hwLevel,
        90
      );
      appendHistoryRecord(
        'BED-01',
        hwLevel,
        'AUTO_CLAMPED',
        true,
        90,
        'clamp_action',
        `Remote Emergency Clamp dispatched to ${targetIp}`
      );
      setCommandFeedback('Emergency Clamp command sent · Refreshing /status');
      isPollingRef.current = false;
      await pollEsp32Status();
    } catch {
      setCommandFeedback(`Failed to reach http://${targetIp}/clamp`);
    } finally {
      setIsSendingCommand(false);
      window.setTimeout(() => setCommandFeedback(null), 3000);
    }
  }, [
    simulationMode,
    espIp,
    simLevel,
    hwLevel,
    appendAuditEvent,
    appendHistoryRecord,
    pollEsp32Status,
  ]);

  // Remote Servo Command: Nurse Unclamp & Reset (0°)
  const handleUnclamp = useCallback(async () => {
    icuAudioEngine.unlock();

    if (simulationMode) {
      const nextLevel = simLevel <= 10 ? 100 : simLevel;
      const nextStatus = deriveFlowStatus(nextLevel, false);
      setSimClamped(false);
      setSimLevel(nextLevel);
      setCommandFeedback(
        simLevel <= 10
          ? 'Simulation: Unclamped (0°) & Bag Reset to 100%'
          : 'Simulation: Servo reset to 0° (Open)'
      );
      appendAuditEvent(
        'BED-01',
        'action',
        'Nurse Unclamp & Reset (0°)',
        simLevel <= 10
          ? 'Valve released and replacement IV bag logged at 100%'
          : 'Valve released from nurse desk',
        nextLevel,
        0
      );
      appendHistoryRecord(
        'BED-01',
        nextLevel,
        nextStatus,
        false,
        0,
        'clamp_action',
        simLevel <= 10
          ? 'Nurse Unclamp & Bag Reset (100%) [Simulation]'
          : 'Nurse Unclamp (0°) [Simulation]'
      );
      window.setTimeout(() => setCommandFeedback(null), 2600);
      return;
    }

    const targetIp = normalizeEspIp(espIp);
    setIsSendingCommand(true);
    setCommandFeedback(`Sending /unclamp to ${targetIp}...`);

    try {
      await fetch(`http://${targetIp}/unclamp`, { cache: 'no-store' });
      appendAuditEvent(
        'BED-01',
        'action',
        'Nurse Unclamp & Reset (0°)',
        `Dispatched GET http://${targetIp}/unclamp`,
        hwLevel,
        0
      );
      appendHistoryRecord(
        'BED-01',
        hwLevel,
        deriveFlowStatus(hwLevel, false),
        false,
        0,
        'clamp_action',
        `Remote Nurse Unclamp & Reset dispatched to ${targetIp}`
      );
      setCommandFeedback('Unclamp & Reset sent · Refreshing /status');
      isPollingRef.current = false;
      await pollEsp32Status();
    } catch {
      setCommandFeedback(`Failed to reach http://${targetIp}/unclamp`);
    } finally {
      setIsSendingCommand(false);
      window.setTimeout(() => setCommandFeedback(null), 3000);
    }
  }, [
    simulationMode,
    espIp,
    simLevel,
    hwLevel,
    appendAuditEvent,
    appendHistoryRecord,
    pollEsp32Status,
  ]);

  const handleToggleMute = useCallback(() => {
    icuAudioEngine.unlock();
    setIsMuted((prev) => {
      const next = !prev;
      icuAudioEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleSimulationMode = useCallback(() => {
    icuAudioEngine.unlock();
    setSimulationMode((prev) => {
      const next = !prev;
      appendAuditEvent(
        'BED-01',
        'info',
        next ? 'Demo Simulation Enabled' : 'Live ESP32 Polling Resumed',
        next
          ? 'Manual slider active for exhibition presentation'
          : `Resumed 300ms polling of http://${normalizeEspIp(espIp)}/status`,
        next ? simLevel : hwLevel,
        next ? (simClamped ? 90 : 0) : hwServoAngle
      );
      return next;
    });
  }, [appendAuditEvent, espIp, simLevel, simClamped, hwLevel, hwServoAngle]);

  const handleSimLevelChange = useCallback(
    (newLevel: number) => {
      setSimLevel(newLevel);
      const nextClamped = newLevel <= 10;
      setSimClamped(nextClamped);

      const lastSample = lastBedSampleRef.current['BED-01'];
      if (!lastSample || Math.abs(lastSample.level - newLevel) >= 5) {
        appendHistoryRecord(
          'BED-01',
          newLevel,
          deriveFlowStatus(newLevel, nextClamped),
          nextClamped,
          nextClamped ? 90 : 0,
          'telemetry',
          'Demo simulation level adjustment'
        );
      }
    },
    [appendHistoryRecord]
  );

  const handleRefillWardBed = useCallback(
    (bedId: string) => {
      setWardBeds((prev) =>
        prev.map((bed) =>
          bed.id === bedId
            ? {
                ...bed,
                level: 100,
                clamped: false,
                servoAngle: 0,
                status: 'NORMAL_FLOW',
              }
            : bed
        )
      );
      appendAuditEvent(
        bedId,
        'action',
        'IV Bag Replaced (100%)',
        'Nurse logged fresh IV bag hang and valve check',
        100,
        0
      );
      appendHistoryRecord(
        bedId,
        100,
        'NORMAL_FLOW',
        false,
        0,
        'clamp_action',
        'Nurse logged replacement IV bag (100%)'
      );
    },
    [appendAuditEvent, appendHistoryRecord]
  );

  // Save Patient Assignment for any bed (BED-01 .. BED-12)
  const handleSavePatientAssignment = useCallback(
    (updated: PatientAssignment) => {
      setAssignments((prev) => ({
        ...prev,
        [updated.bedId]: updated,
      }));

      if (updated.bedId !== 'BED-01') {
        setWardBeds((prev) =>
          prev.map((bed) =>
            bed.id === updated.bedId
              ? {
                  ...bed,
                  room: updated.room,
                  patientName: updated.patientName,
                  mrn: updated.mrn,
                  patientCode: `${updated.mrn} · ${updated.clinicalNote}`,
                  solution: updated.solution,
                  dripRateMlHr: updated.dripRateMlHr,
                  bagVolumeMl: updated.bagVolumeMl,
                }
              : bed
          )
        );
      }

      const targetBedLevel =
        updated.bedId === 'BED-01'
          ? bed01Level
          : wardBeds.find((b) => b.id === updated.bedId)?.level ?? 80;
      const targetBedStatus =
        updated.bedId === 'BED-01'
          ? bed01Status
          : wardBeds.find((b) => b.id === updated.bedId)?.status ?? 'NORMAL_FLOW';
      const targetBedClamped =
        updated.bedId === 'BED-01'
          ? bed01Clamped
          : wardBeds.find((b) => b.id === updated.bedId)?.clamped ?? false;
      const targetBedAngle =
        updated.bedId === 'BED-01'
          ? bed01ServoAngle
          : wardBeds.find((b) => b.id === updated.bedId)?.servoAngle ?? 0;

      appendAuditEvent(
        updated.bedId,
        'info',
        'Patient Record Updated',
        `${updated.patientName} (${updated.mrn}) assigned to ${updated.room}`,
        targetBedLevel,
        targetBedAngle
      );

      // Directly insert with updated patient info
      const record: TelemetryHistoryEntry = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        bedId: updated.bedId,
        room: updated.room,
        patientName: updated.patientName,
        mrn: updated.mrn,
        level: Math.round(targetBedLevel),
        status: targetBedStatus,
        clamped: targetBedClamped,
        servoAngle: targetBedAngle,
        kind: 'patient_update',
        note: `Patient assigned: ${updated.patientName} (${updated.mrn}) · ${updated.solution}`,
      };
      setTelemetryHistory((prev) => [...prev, record]);

      setEditingBedId(null);
    },
    [
      bed01Level,
      bed01Status,
      bed01Clamped,
      bed01ServoAngle,
      wardBeds,
      appendAuditEvent,
    ]
  );

  // Aggregate all 12 beds (BED-01 + BED-02..12)
  const bed01AsWardBed: WardBed = useMemo(
    () => ({
      id: 'BED-01',
      room: bed01Assignment.room,
      patientName: bed01Assignment.patientName,
      mrn: bed01Assignment.mrn,
      patientCode: `${bed01Assignment.mrn} · ${bed01Assignment.clinicalNote}`,
      solution: bed01Assignment.solution,
      level: Math.round(bed01Level),
      dripRateMlHr: bed01Status === 'AUTO_CLAMPED' ? 0 : bed01Assignment.dripRateMlHr,
      clamped: bed01Clamped,
      servoAngle: bed01ServoAngle,
      status: bed01Status,
      bagVolumeMl: bed01Assignment.bagVolumeMl,
      lastUpdated: simulationMode ? 'Sim' : espConnected ? 'Live' : 'Offline',
    }),
    [
      bed01Assignment,
      bed01Level,
      bed01Clamped,
      bed01ServoAngle,
      bed01Status,
      simulationMode,
      espConnected,
    ]
  );

  const allBeds = useMemo(() => [bed01AsWardBed, ...wardBeds], [bed01AsWardBed, wardBeds]);

  const normalCount = useMemo(
    () => allBeds.filter((b) => b.status === 'NORMAL_FLOW').length,
    [allBeds]
  );
  const lowCount = useMemo(
    () => allBeds.filter((b) => b.status === 'LOW_SALINE').length,
    [allBeds]
  );
  const criticalBeds = useMemo(
    () => allBeds.filter((b) => b.status === 'AUTO_CLAMPED' || b.clamped || b.level <= 10),
    [allBeds]
  );

  const handleOpenBedHistory = useCallback((bedId: string) => {
    setHistoryBedId(bedId);
    setActiveTab('history');
  }, []);

  const handleRecordSnapshotNow = useCallback(
    (bedId: string) => {
      const target = allBeds.find((b) => b.id === bedId);
      if (!target) return;
      appendHistoryRecord(
        bedId,
        target.level,
        target.status,
        target.clamped,
        target.servoAngle,
        'telemetry',
        'Manual nurse telemetry snapshot logged'
      );
    },
    [allBeds, appendHistoryRecord]
  );

  const handleClearHistory = useCallback(() => {
    clearTelemetryHistoryStorage();
    setTelemetryHistory([]);
  }, []);

  // Priority Alert Response Stopwatch (ticks every 100ms while any bed is critical)
  useEffect(() => {
    if (criticalBeds.length === 0) {
      setElapsedTenths(0);
      return;
    }

    const id = window.setInterval(() => {
      setElapsedTenths((prev) => prev + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [criticalBeds.length]);

  const editingAssignment = editingBedId
    ? assignments[editingBedId] ?? DEFAULT_PATIENT_ASSIGNMENTS[editingBedId] ?? null
    : null;

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      <HospitalHeader
        clockTime={formatClockTime(now)}
        clockDate={formatClockDate(now)}
        totalBeds={allBeds.length}
        normalCount={normalCount}
        lowCount={lowCount}
        criticalCount={criticalBeds.length}
        espIp={espIp}
        onEspIpChange={setEspIp}
        espConnected={espConnected}
        simulationMode={simulationMode}
        onToggleSimulationMode={handleToggleSimulationMode}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        lastPollMs={lastPollMs}
      />

      <PriorityAlertBanner
        criticalBeds={criticalBeds}
        elapsedSeconds={elapsedTenths}
        onUnclampBed01={handleUnclamp}
        isSendingCommand={isSendingCommand}
        isMuted={isMuted}
        onMuteAlarm={handleToggleMute}
      />

      {/* Workspace View Switcher Ribbon */}
      <div className="border-b border-slate-800/70 bg-[#070B16]/90">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <nav
            aria-label="Station Workspace Views"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#050811] p-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Live Telemetry Wall</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('patients')}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'patients'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Patient Management ({allBeds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <LineChart className="h-3.5 w-3.5" />
              <span>History &amp; Trend Analysis</span>
            </button>
          </nav>

          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>
              Stored History:{' '}
              <strong className="tabular-nums text-slate-200">
                {telemetryHistory.length}
              </strong>{' '}
              records
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1680px] flex-1 px-5 py-5">
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
            {/* Left Column: BED-01 Live Hardware Spotlight */}
            <div className="lg:col-span-5 xl:col-span-4">
              <Bed01Spotlight
                level={bed01Level}
                clamped={bed01Clamped}
                servoAngle={bed01ServoAngle}
                status={bed01Status}
                patient={bed01Assignment}
                espIp={normalizeEspIp(espIp)}
                espConnected={espConnected}
                simulationMode={simulationMode}
                onEnableSimulation={() => setSimulationMode(true)}
                onSimLevelChange={handleSimLevelChange}
                onClamp={handleClamp}
                onUnclamp={handleUnclamp}
                onEditPatient={() => setEditingBedId('BED-01')}
                onViewTrends={() => handleOpenBedHistory('BED-01')}
                isSendingCommand={isSendingCommand}
                commandFeedback={commandFeedback}
                lastError={lastError}
              />
            </div>

            {/* Right Column: Ward Telemetry Wall Grid + Live Nurse Audit Log */}
            <div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8">
              <WardTelemetryGrid
                beds={wardBeds}
                onRefillBed={handleRefillWardBed}
                onEditPatient={(bedId) => setEditingBedId(bedId)}
                onViewHistory={handleOpenBedHistory}
              />

              <NurseAuditLog
                events={auditEvents}
                onClearLog={() => setAuditEvents([])}
              />
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <PatientManagementView
            allBeds={allBeds}
            assignments={assignments}
            onEditPatient={(bedId) => setEditingBedId(bedId)}
            onInspectHistory={handleOpenBedHistory}
          />
        )}

        {activeTab === 'history' && (
          <HistoricalAnalyticsView
            allBeds={allBeds}
            assignments={assignments}
            history={telemetryHistory}
            selectedBedId={historyBedId}
            onSelectBedId={setHistoryBedId}
            onEditPatient={(bedId) => setEditingBedId(bedId)}
            onRecordSnapshotNow={handleRecordSnapshotNow}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      <PatientEditModal
        assignment={editingAssignment}
        onClose={() => setEditingBedId(null)}
        onSave={handleSavePatientAssignment}
      />
    </div>
  );
}
