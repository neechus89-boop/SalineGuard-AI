import React from 'react';
import {
  Activity,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  Radio,
} from 'lucide-react';

interface HospitalHeaderProps {
  clockTime: string;
  clockDate: string;
  totalBeds: number;
  normalCount: number;
  lowCount: number;
  criticalCount: number;
  espIp: string;
  onEspIpChange: (ip: string) => void;
  espConnected: boolean;
  simulationMode: boolean;
  onToggleSimulationMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  lastPollMs: number | null;
}

export const HospitalHeader: React.FC<HospitalHeaderProps> = ({
  clockTime,
  clockDate,
  totalBeds,
  normalCount,
  lowCount,
  criticalCount,
  espIp,
  onEspIpChange,
  espConnected,
  simulationMode,
  onToggleSimulationMode,
  isMuted,
  onToggleMute,
  lastPollMs,
}) => {
  return (
    <header className="w-full border-b border-slate-800/90 bg-[#080D1A]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        {/* Hospital & System Identity */}
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold tracking-wide text-emerald-400 whitespace-nowrap">
                SALINEGUARD AI
              </h1>
            </div>
          </div>
        </div>

        {/* Ward Summary Counters & Live Digital Clock */}
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-[#0B1120] px-4 py-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                Total Beds
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-slate-100">
                {totalBeds}
              </span>
            </div>
            <span className="h-4 w-px bg-slate-800" aria-hidden="true" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-medium text-emerald-400/90 whitespace-nowrap">
                Normal
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-emerald-400">
                {normalCount}
              </span>
            </div>
            <span className="h-4 w-px bg-slate-800" aria-hidden="true" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-medium text-amber-400/90 whitespace-nowrap">
                Low Warning
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-amber-400">
                {lowCount}
              </span>
            </div>
            <span className="h-4 w-px bg-slate-800" aria-hidden="true" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[11px] font-medium text-rose-400/90 whitespace-nowrap">
                Critical Clamped
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-rose-400">
                {criticalCount}
              </span>
            </div>
          </div>

          <div className="hidden xl:flex flex-col items-end border-l border-slate-800 pl-4">
            <span className="font-mono text-lg font-bold leading-none tabular-nums text-slate-100">
              {clockTime}
            </span>
            <span className="mt-1 font-mono text-[11px] leading-none text-slate-400">
              {clockDate}
            </span>
          </div>
        </div>

        {/* ESP32 Link Status, Editable IP, Mode Switch & Alarm Mute */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Editable ESP32 IP Address */}
          <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0B1120] px-2.5 py-1.5 text-xs focus-within:border-emerald-500/60">
            <span className="text-slate-400 font-medium whitespace-nowrap">ESP32 IP</span>
            <input
              type="text"
              value={espIp}
              onChange={(e) => onEspIpChange(e.target.value)}
              placeholder="192.168.4.1"
              aria-label="ESP32 IP Address"
              className="w-28 bg-transparent font-mono text-xs text-slate-100 outline-none placeholder:text-slate-600"
            />
          </label>

          {/* Live Hardware Link Indicator */}
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono font-medium whitespace-nowrap shrink-0 ${
              simulationMode
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                : espConnected
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            }`}
            title={
              simulationMode
                ? 'Manual demo slider active (ESP32 polling paused)'
                : espConnected
                  ? `Receiving 300ms telemetry from http://${espIp}/status`
                  : `Unable to reach http://${espIp}/status`
            }
          >
            {simulationMode ? (
              <>
                <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
                <span>DEMO SIMULATION</span>
              </>
            ) : espConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  LIVE ESP32 SYNC: {espIp || '192.168.4.1'}
                </span>
                {lastPollMs !== null && (
                  <span className="text-[10px] text-emerald-400/80 ml-0.5">
                    ({lastPollMs}ms)
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <WifiOff className="h-3.5 w-3.5 text-rose-400" />
                <span>ESP32 OFFLINE</span>
              </>
            )}
          </div>

          {/* Toggle Live Hardware vs Demo Slider */}
          <button
            type="button"
            onClick={onToggleSimulationMode}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              simulationMode
                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            {simulationMode ? (
              <>
                <Radio className="h-3.5 w-3.5" />
                <span>Switch to Live ESP32</span>
              </>
            ) : (
              <>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Demo Slider</span>
              </>
            )}
          </button>

          {/* ICU Audio Alarm Mute / Unmute */}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute ICU Audio Alarm' : 'Mute ICU Audio Alarm'}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isMuted
                ? 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
            }`}
          >
            {isMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>Alarm Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                <span>Audio Armed</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
