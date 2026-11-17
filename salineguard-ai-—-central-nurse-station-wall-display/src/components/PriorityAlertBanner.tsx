import React from 'react';
import { AlertOctagon, Unlock, VolumeX, Clock } from 'lucide-react';
import { WardBed } from '../types/telemetry';

interface PriorityAlertBannerProps {
  criticalBeds: WardBed[];
  elapsedSeconds: number;
  onUnclampBed01: () => void;
  isSendingCommand: boolean;
  isMuted: boolean;
  onMuteAlarm: () => void;
}

function formatStopwatch(totalTenths: number): string {
  const totalSec = Math.floor(totalTenths / 10);
  const tenths = totalTenths % 10;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const PriorityAlertBanner: React.FC<PriorityAlertBannerProps> = ({
  criticalBeds,
  elapsedSeconds,
  onUnclampBed01,
  isSendingCommand,
  isMuted,
  onMuteAlarm,
}) => {
  if (criticalBeds.length === 0) return null;

  const primaryBed = criticalBeds.find((b) => b.id === 'BED-01') ?? criticalBeds[0];
  const isBed01Critical = primaryBed.id === 'BED-01';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="animate-banner-flash w-full border-b border-rose-500/80 px-5 py-2.5 text-rose-50"
    >
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md bg-rose-950/80 border border-rose-400/50 px-2.5 py-1">
            <AlertOctagon className="h-4 w-4 text-rose-300 shrink-0" />
            <span className="font-mono text-xs font-bold tracking-wider text-rose-100 whitespace-nowrap">
              PRIORITY ALERT · {criticalBeds.map((b) => b.id).join(', ')}
            </span>
          </div>

          <span className="text-sm font-semibold text-white">
            {primaryBed.id} ({primaryBed.room}) —{' '}
            {primaryBed.level <= 10
              ? `FLUID DEPLETED (${primaryBed.level}%) · AUTO-CLAMPED AT 90° · BACKFLOW PREVENTED`
              : `MANUALLY CLAMPED AT 90° (${primaryBed.level}% REMAINING)`}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Ticking Response Stopwatch */}
          <div className="flex items-center gap-2 rounded-md border border-rose-300/40 bg-rose-950/90 px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[11px] font-medium text-rose-200 whitespace-nowrap">
              Response Timer
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-white">
              {formatStopwatch(elapsedSeconds)}
            </span>
          </div>

          {!isMuted && (
            <button
              type="button"
              onClick={onMuteAlarm}
              className="flex items-center gap-1.5 rounded-md border border-rose-300/40 bg-rose-950/70 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-900/90 whitespace-nowrap cursor-pointer"
            >
              <VolumeX className="h-3.5 w-3.5" />
              <span>Silence Chime</span>
            </button>
          )}

          {isBed01Critical && (
            <button
              type="button"
              onClick={onUnclampBed01}
              disabled={isSendingCommand}
              className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-bold text-rose-950 shadow-sm transition-colors hover:bg-rose-100 disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <Unlock className="h-3.5 w-3.5" />
              <span>Nurse Unclamp & Reset (0°)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
