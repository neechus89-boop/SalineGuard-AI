import React from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  SlidersHorizontal,
  Droplets,
  Pencil,
  LineChart,
} from 'lucide-react';
import { FlowStatus, PatientAssignment } from '../types/telemetry';
import { IvDripVisualizer } from './IvDripVisualizer';

interface Bed01SpotlightProps {
  level: number;
  clamped: boolean;
  servoAngle: number;
  status: FlowStatus;
  patient: PatientAssignment;
  espIp: string;
  espConnected: boolean;
  simulationMode: boolean;
  onEnableSimulation: () => void;
  onSimLevelChange: (newLevel: number) => void;
  onClamp: () => void;
  onUnclamp: () => void;
  onEditPatient: () => void;
  onViewTrends: () => void;
  isSendingCommand: boolean;
  commandFeedback: string | null;
  lastError: string | null;
}

export const Bed01Spotlight: React.FC<Bed01SpotlightProps> = ({
  level,
  clamped,
  servoAngle,
  status,
  patient,
  espIp,
  espConnected,
  simulationMode,
  onEnableSimulation,
  onSimLevelChange,
  onClamp,
  onUnclamp,
  onEditPatient,
  onViewTrends,
  isSendingCommand,
  commandFeedback,
  lastError,
}) => {
  const safeLevel = Math.max(0, Math.min(100, Math.round(level)));
  const bagSize = patient.bagVolumeMl || 500;
  const volumeMl = Math.round((safeLevel / 100) * bagSize);
  const isCritical = status === 'AUTO_CLAMPED' || clamped || safeLevel <= 10;
  const isLow = !isCritical && (status === 'LOW_SALINE' || safeLevel <= 50);

  const stageTheme = isCritical
    ? {
        cardClass: 'border-rose-500/80 bg-[#12080E]/90 animate-critical-pulse',
        badgeText: 'CRITICAL: AUTO-CLAMPED AT 90° - BACKFLOW PREVENTED',
        textColor: 'text-rose-400',
        numberColor: 'text-rose-400',
        barColor: 'bg-rose-500',
        barTrack: 'bg-rose-950/60',
        statusBg: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
        Icon: AlertOctagon,
      }
    : isLow
      ? {
          cardClass:
            'border-amber-500/60 bg-[#0F1118]/90 shadow-[0_0_24px_rgba(245,158,11,0.12)]',
          badgeText: 'WARNING: LOW SALINE - PREPARE BAG',
          textColor: 'text-amber-400',
          numberColor: 'text-amber-300',
          barColor: 'bg-amber-400',
          barTrack: 'bg-amber-950/50',
          statusBg: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
          Icon: AlertTriangle,
        }
      : {
          cardClass:
            'border-emerald-500/50 bg-[#09121B]/90 shadow-[0_0_24px_rgba(16,185,129,0.1)]',
          badgeText: 'NORMAL FLOW - VALVE OPEN 0°',
          textColor: 'text-emerald-400',
          numberColor: 'text-emerald-300',
          barColor: 'bg-emerald-400',
          barTrack: 'bg-emerald-950/50',
          statusBg: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
          Icon: ShieldCheck,
        };

  const StatusIcon = stageTheme.Icon;

  return (
    <section
      aria-label="BED-01 Live Hardware Spotlight"
      className={`flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-md transition-colors duration-300 ${stageTheme.cardClass}`}
    >
      {/* Top Bed Identity Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-3.5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold tracking-tight text-white">
                BED-01
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-sm font-medium text-slate-300">
                {patient.room} (Live Hardware)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-300">
              <span className="font-semibold text-white">{patient.patientName}</span>
              <span className="text-slate-500"> · </span>
              <span className="font-mono text-sky-300">{patient.mrn}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400">
                {patient.solution} ({bagSize} mL)
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              <span>{simulationMode ? 'DEMO ENGINE' : `ESP32 · ${espIp || '192.168.4.1'}`}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onEditPatient}
                className="flex items-center gap-1 rounded-md border border-slate-700/90 bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white cursor-pointer"
              >
                <Pencil className="h-2.5 w-2.5" />
                <span>Edit Patient</span>
              </button>
              <button
                type="button"
                onClick={onViewTrends}
                className="flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
              >
                <LineChart className="h-2.5 w-2.5" />
                <span>History</span>
              </button>
            </div>
          </div>
        </div>

        {/* Three-Stage Dynamic Status Strip */}
        <div
          className={`mt-3.5 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${stageTheme.statusBg}`}
        >
          <StatusIcon className="h-4 w-4 shrink-0" />
          <span className="font-mono text-xs font-bold tracking-wide">
            {stageTheme.badgeText}
          </span>
        </div>

        {/* Giant Percentage Readout + Animated Progress Bar */}
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-400">
                Saline Fluid Remaining
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`font-mono text-6xl font-bold leading-none tracking-tight tabular-nums ${stageTheme.numberColor}`}
                >
                  {safeLevel}
                </span>
                <span className="font-mono text-2xl font-semibold text-slate-400">
                  %
                </span>
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-xs text-slate-400">Est. Volume</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-100">
                {volumeMl} <span className="text-xs font-normal text-slate-400">/ {bagSize} mL</span>
              </div>
              <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-slate-400">
                <Droplets className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  {isCritical ? '0 mL/hr (Halted)' : `${patient.dripRateMlHr} mL/hr`}
                </span>
              </div>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div className="mt-4">
            <div
              className={`h-3 w-full overflow-hidden rounded-full border border-slate-800/90 ${stageTheme.barTrack}`}
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${stageTheme.barColor}`}
                style={{ width: `${safeLevel}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
              <span>0% EMPTY</span>
              <span className="text-rose-400/80">10% AUTO-CLAMP</span>
              <span className="text-amber-400/80">50% LOW WARN</span>
              <span>100% FULL</span>
            </div>
          </div>
        </div>

        {/* SVG IV Drip Chamber + Servo Pinch Visualization + Telemetry Side Specs */}
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <IvDripVisualizer
              level={safeLevel}
              clamped={clamped}
              servoAngle={servoAngle}
              status={status}
            />
          </div>

          <div className="flex flex-col justify-between gap-2.5 sm:col-span-5">
            <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
              <div className="text-[11px] font-medium text-slate-400">SG90 Servo Angle</div>
              <div
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  isCritical ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {isCritical ? Math.max(servoAngle, 90) : servoAngle}°
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-400">
                {isCritical ? 'PINCHED SHUT' : 'VALVE OPEN'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
              <div className="text-[11px] font-medium text-slate-400">Clamp State</div>
              <div
                className={`mt-1 font-mono text-base font-bold ${
                  isCritical ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {clamped || isCritical ? 'ENGAGED' : 'RELEASED'}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {isCritical ? 'Backflow Lock Active' : 'Free Gravity Drip'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
              <div className="text-[11px] font-medium text-slate-400">Hardware Status</div>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-200">
                {status}
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                {simulationMode
                  ? 'Local Demo State'
                  : espConnected
                    ? '300ms AP Poll OK'
                    : 'Awaiting ESP32 AP'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation / Demo Slider Fallback Controls */}
      {simulationMode ? (
        <div className="mt-4 rounded-xl border border-sky-500/40 bg-sky-950/20 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Demo Simulation Slider</span>
            </div>
            <span className="font-mono text-xs font-bold tabular-nums text-sky-200">
              {safeLevel}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={safeLevel}
            onChange={(e) => onSimLevelChange(Number(e.target.value))}
            aria-label="Simulate BED-01 Fluid Level"
            className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-sky-400"
          />

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSimLevelChange(78)}
              className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 font-mono text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 cursor-pointer"
            >
              78% Normal
            </button>
            <button
              type="button"
              onClick={() => onSimLevelChange(34)}
              className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 font-mono text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
            >
              34% Low
            </button>
            <button
              type="button"
              onClick={() => onSimLevelChange(8)}
              className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1.5 font-mono text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 cursor-pointer"
            >
              8% Critical
            </button>
          </div>
        </div>
      ) : (
        !espConnected && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-xs">
            <span className="text-slate-300">
              {lastError
                ? `ESP32 unreachable (${lastError}). Connect to SalineGuard-AI Wi-Fi or test with Demo Slider.`
                : `Waiting for http://${espIp}/status...`}
            </span>
            <button
              type="button"
              onClick={onEnableSimulation}
              className="rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-semibold text-sky-300 transition-colors hover:bg-sky-500/25 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Demo Slider
            </button>
          </div>
        )
      )}

      {/* Remote Servo Control Endpoints */}
      <div className="mt-4 border-t border-slate-800/80 pt-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClamp}
            disabled={isSendingCommand}
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/60 bg-rose-600/25 px-4 py-3 text-xs font-bold text-rose-100 transition-colors hover:bg-rose-600/40 disabled:opacity-50 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <Lock className="h-4 w-4 text-rose-300 shrink-0" />
            <span>Emergency Clamp (90°)</span>
          </button>

          <button
            type="button"
            onClick={onUnclamp}
            disabled={isSendingCommand}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600/20 px-4 py-3 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-600/35 disabled:opacity-50 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Unlock className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>Nurse Unclamp & Reset (0°)</span>
          </button>
        </div>

        {commandFeedback && (
          <p className="mt-2 text-center font-mono text-[11px] text-slate-300">
            {commandFeedback}
          </p>
        )}
      </div>
    </section>
  );
};
