import React from 'react';
import {
  classifyFluidStatus,
  calculateEstimatedTimeRemaining,
} from '../utils/telemetryLogic';

export interface TelemetryHistoryPoint {
  timeLabel: string;
  level: number;
}

interface TelemetryDashboardProps {
  levelPercent: number;
  bottleCapacityMl: number;
  flowRateMlPerHr: number;
  onCapacityChange: (capacity: number) => void;
  onFlowRateChange: (rate: number) => void;
  lastEspSyncTimestamp: string | null;
  espTargetUrl: string;
  historyPoints: TelemetryHistoryPoint[];
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  levelPercent,
  bottleCapacityMl,
  flowRateMlPerHr,
  onCapacityChange,
  onFlowRateChange,
  lastEspSyncTimestamp,
  espTargetUrl,
  historyPoints,
}) => {
  const roundedLevel = Math.max(0, Math.min(100, Math.round(levelPercent)));
  const status = classifyFluidStatus(roundedLevel);
  const timeInfo = calculateEstimatedTimeRemaining(
    roundedLevel,
    bottleCapacityMl,
    flowRateMlPerHr
  );

  // Circular SVG Ring Geometry
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (roundedLevel / 100) * circumference;

  const statusTextColor =
    status.code === 'AUTO_CLAMPED'
      ? 'text-[#F43F5E]'
      : status.code === 'LOW_SALINE'
      ? 'text-[#F59E0B]'
      : 'text-[#10B981]';

  const barBgColor =
    status.code === 'AUTO_CLAMPED'
      ? 'bg-[#F43F5E]'
      : status.code === 'LOW_SALINE'
      ? 'bg-[#F59E0B]'
      : 'bg-[#00F5D4]';

  // Build SVG Polyline Points for Real-Time Meniscus Depletion Curve
  const chartWidth = 440;
  const chartHeight = 76;
  const points =
    historyPoints.length > 1
      ? historyPoints
      : [
          { timeLabel: 'T-3', level: 82 },
          { timeLabel: 'T-2', level: 80 },
          { timeLabel: 'T-1', level: 79 },
          { timeLabel: 'NOW', level: roundedLevel },
        ];

  const polylineCoords = points
    .map((pt, i) => {
      const x =
        points.length === 1
          ? chartWidth / 2
          : (i / (points.length - 1)) * (chartWidth - 16) + 8;
      const y =
        chartHeight -
        6 -
        (Math.max(0, Math.min(100, pt.level)) / 100) * (chartHeight - 14);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const clampLineY = chartHeight - 6 - 0.1 * (chartHeight - 14);
  const warnLineY = chartHeight - 6 - 0.5 * (chartHeight - 14);

  return (
    <section
      aria-label="Live ICU Telemetry Dashboard"
      className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 lg:p-7 flex flex-col justify-between gap-6"
    >
      {/* Top Section Header & Semantic Status Readout */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono tracking-wider text-slate-400">
            <span className="whitespace-nowrap">ICU BEDSIDE TELEMETRY</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">NODE B-04</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400 whitespace-nowrap">RED FLOAT LOCK</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-50 mt-1">
            IV Fluid Remaining
          </h2>
        </div>

        {/* Status Indicator (Text-First, Non-Hue-Only) */}
        <div data-testid="telemetry-status-badge" className="text-right">
          <div
            className={`text-sm font-mono font-semibold tracking-wide ${statusTextColor}`}
          >
            {status.glyph} {status.label}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {status.code === 'AUTO_CLAMPED'
              ? 'Threshold ≤ 10% (Critical)'
              : status.code === 'LOW_SALINE'
              ? 'Threshold 11% – 50% (Warning)'
              : 'Threshold > 50% (Nominal)'}
          </div>
        </div>
      </div>

      {/* Primary Circular Progress Ring + Massive Numerical Display */}
      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-6 py-1">
        {/* SVG Circular Progress Gauge */}
        <div className="sm:col-span-5 flex justify-center">
          <div className="relative w-52 h-52 flex items-center justify-center">
            <svg
              className="w-full h-full -rotate-90 transform"
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
              {/* Outer calibration tick ring */}
              <circle
                cx="100"
                cy="100"
                r="94"
                fill="none"
                stroke="rgba(148, 163, 184, 0.1)"
                strokeWidth="1"
                strokeDasharray="3 6"
              />
              {/* Background Track Ring */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(30, 41, 59, 0.9)"
                strokeWidth="12"
              />
              {/* Critical 10% Threshold Marker Arc */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(244, 63, 94, 0.28)"
                strokeWidth="12"
                strokeDasharray={`${0.1 * circumference} ${circumference}`}
              />
              {/* Active Fluid Level Ring */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={status.accentHex}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition:
                    'stroke-dashoffset 180ms cubic-bezier(0.16, 1, 0.3, 1), stroke 180ms ease',
                }}
              />
            </svg>

            {/* Center Readout Inside Ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-mono text-slate-400 tracking-wider">
                RESERVOIR
              </span>
              <div className="flex items-baseline justify-center mt-0.5">
                <span
                  data-testid="fluid-level-value"
                  className="text-5xl font-mono font-bold tracking-tight text-slate-50 tabular-nums"
                >
                  {roundedLevel}
                </span>
                <span className="text-lg font-mono font-medium text-slate-400 ml-1">
                  %
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                {timeInfo.remainingMl} / {bottleCapacityMl} mL
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Horizontal Progress Bar + Clinical Narrative + Live Thresholds */}
        <div className="sm:col-span-7 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>LINEAR MENISCUS SCALE</span>
              <span className="tabular-nums text-slate-200 font-semibold">
                {roundedLevel}.0% ({timeInfo.remainingMl} mL)
              </span>
            </div>

            {/* Sleek Animated Horizontal Progress Bar */}
            <div className="relative h-3.5 w-full bg-slate-900/95 border border-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 left-[10%] w-0.5 bg-[#F43F5E] z-10"
                title="10% Emergency Auto-Clamp Threshold"
              />
              <div
                className="absolute top-0 bottom-0 left-[50%] w-px bg-[#F59E0B]/70 z-10"
                title="50% Low Saline Warning Threshold"
              />
              <div
                className={`h-full rounded-full ${barBgColor}`}
                style={{
                  width: `${roundedLevel}%`,
                  transition: 'width 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1.5">
              <span>0% EMPTY</span>
              <span className="text-[#F43F5E]">10% CLAMP</span>
              <span className="text-[#F59E0B]">50% LOW</span>
              <span>100% FULL</span>
            </div>
          </div>

          {/* Clinical State Summary */}
          <p className="text-sm text-slate-300 leading-relaxed">
            {status.clinicalSummary}
          </p>

          {/* Bag Volume & Flow Rate Calibration Controls */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div>
              <label
                htmlFor="bottle-capacity-select"
                className="block text-xs font-mono text-slate-400 mb-1"
              >
                IV BAG VOLUME
              </label>
              <select
                id="bottle-capacity-select"
                value={bottleCapacityMl}
                onChange={(e) => onCapacityChange(Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#00F5D4]"
              >
                <option value={250}>250 mL Saline</option>
                <option value={500}>500 mL Saline</option>
                <option value={1000}>1000 mL Saline</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="infusion-rate-select"
                className="block text-xs font-mono text-slate-400 mb-1"
              >
                INFUSION RATE
              </label>
              <select
                id="infusion-rate-select"
                value={flowRateMlPerHr}
                onChange={(e) => onFlowRateChange(Number(e.target.value))}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#00F5D4]"
              >
                <option value={75}>75 mL/hr (25 gtt)</option>
                <option value={125}>125 mL/hr (42 gtt)</option>
                <option value={200}>200 mL/hr (67 gtt)</option>
                <option value={250}>250 mL/hr (83 gtt)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row: Servo Clamp State + Est. Time to Empty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
        {/* Metric 1: SG90 Mechanical Pinch-Clamp State */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-slate-400">
              SERVO CLAMP STATE (SG90)
            </div>
            <div
              data-testid="servo-clamp-state"
              className={`text-2xl font-mono font-bold mt-1 tabular-nums ${
                status.isClamped ? 'text-[#F43F5E]' : 'text-[#00F5D4]'
              }`}
            >
              {status.servoStateText}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              {status.isClamped
                ? 'IV Tubing Occluded · Flow Halted'
                : 'IV Tubing Unobstructed · Gravity Flow'}
            </div>
          </div>

          {/* Crisp SVG Mechanical Pinch-Clamp Schematic */}
          <div className="w-16 h-16 shrink-0 flex items-center justify-center bg-slate-950/80 rounded-lg border border-slate-800">
            <svg
              viewBox="0 0 64 64"
              className="w-12 h-12"
              aria-label={`Servo arm at ${status.servoAngle} degrees`}
            >
              <rect
                x="18"
                y="6"
                width="8"
                height="52"
                rx="3"
                fill="none"
                stroke="#475569"
                strokeWidth="2"
              />
              <rect
                x="20"
                y="8"
                width="4"
                height={status.isClamped ? '22' : '48'}
                fill={status.isClamped ? '#F43F5E' : '#00F5D4'}
              />
              <rect
                x="36"
                y="20"
                width="20"
                height="24"
                rx="3"
                fill="#1E293B"
                stroke="#64748B"
                strokeWidth="1.5"
              />
              {status.isClamped ? (
                <line
                  x1="44"
                  y1="32"
                  x2="18"
                  y2="32"
                  stroke="#F43F5E"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ) : (
                <line
                  x1="44"
                  y1="32"
                  x2="44"
                  y2="10"
                  stroke="#00F5D4"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              )}
              <circle cx="44" cy="32" r="3.5" fill="#F8FAFC" />
            </svg>
          </div>
        </div>

        {/* Metric 2: Estimated Time to Empty / Auto-Clamp */}
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400">
              EST. TIME TO EMPTY (10% CLAMP)
            </div>
            <div
              data-testid="estimated-time-empty"
              className="text-2xl font-mono font-bold text-slate-50 mt-1 tabular-nums"
            >
              {timeInfo.formattedTime}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>USABLE: {timeInfo.usableMlBeforeClamp} mL</span>
            <span>·</span>
            <span>DRIP: {timeInfo.dropsPerMinute} gtt/min</span>
          </div>
        </div>
      </div>

      {/* Live Meniscus Depletion & Telemetry Sparkline Curve */}
      <div className="bg-slate-950/65 border border-slate-800/80 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span>MENISCUS DEPLETION TELEMETRY TRACE</span>
          <span className="text-slate-300 tabular-nums">
            SAMPLES: {points.length} · CURRENT: {roundedLevel}%
          </span>
        </div>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-16 overflow-visible"
          aria-label="Meniscus fluid level history chart"
        >
          {/* 50% Warning Reference Line */}
          <line
            x1="0"
            y1={warnLineY}
            x2={chartWidth}
            y2={warnLineY}
            stroke="rgba(245, 158, 11, 0.3)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* 10% Emergency Clamp Reference Line */}
          <line
            x1="0"
            y1={clampLineY}
            x2={chartWidth}
            y2={clampLineY}
            stroke="rgba(244, 63, 94, 0.45)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {/* Live Fluid Level Polyline */}
          <polyline
            fill="none"
            stroke={status.accentHex}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineCoords}
          />
        </svg>
      </div>

      {/* Live ESP32 Endpoint Telemetry Footer Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="truncate max-w-full">
          <span>ESP32 ENDPOINT: </span>
          <code className="text-slate-200">{espTargetUrl}</code>
        </div>
        <div>
          {lastEspSyncTimestamp
            ? `LAST TX: ${lastEspSyncTimestamp}`
            : 'READY FOR OPTICAL / MANUAL TX'}
        </div>
      </div>
    </section>
  );
};
