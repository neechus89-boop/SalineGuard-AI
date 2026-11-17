import React, { useMemo, useState } from 'react';
import { TelemetryHistoryEntry } from '../types/telemetry';

interface TelemetryTrendChartProps {
  entries: TelemetryHistoryEntry[];
  bedId: string;
}

function formatAxisLabel(iso: string): string {
  const d = new Date(iso);
  const monthDay = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${monthDay} ${time}`;
}

function formatFullTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const TelemetryTrendChart: React.FC<TelemetryTrendChartProps> = ({
  entries,
  bedId,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [entries]
  );

  const width = 920;
  const height = 280;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = useMemo(() => {
    if (sorted.length === 0) return [];
    const minT = new Date(sorted[0].timestamp).getTime();
    const maxT = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const spanT = Math.max(1, maxT - minT);

    return sorted.map((entry, idx) => {
      const t = new Date(entry.timestamp).getTime();
      const x =
        sorted.length === 1
          ? padLeft + plotW / 2
          : padLeft + ((t - minT) / spanT) * plotW;
      const y = padTop + ((100 - Math.max(0, Math.min(100, entry.level))) / 100) * plotH;
      return {
        idx,
        x,
        y,
        entry,
      };
    });
  }, [sorted, plotW, plotH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const bottomY = padTop + plotH;
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [points, linePath, plotH]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;

    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  if (sorted.length === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-6 text-center">
        <p className="text-sm font-semibold text-slate-300">
          No historical telemetry points for {bedId} in the selected date range
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Widen the date range or click &ldquo;Log Snapshot Now&rdquo; to record current telemetry.
        </p>
      </div>
    );
  }

  const activePoint = hoverIndex !== null ? points[hoverIndex] ?? null : null;
  const y50 = padTop + (50 / 100) * plotH;
  const y10 = padTop + (90 / 100) * plotH;

  // Compute 4 evenly-spaced X axis labels
  const xTicks =
    points.length <= 1
      ? [points[0]]
      : [0, 0.33, 0.66, 1].map((ratio) => {
          const i = Math.min(points.length - 1, Math.round(ratio * (points.length - 1)));
          return points[i];
        });

  return (
    <div className="relative rounded-xl border border-slate-800/80 bg-[#060B16]/90 p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-200">
            Saline Fluid Level Trend (%)
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {bedId} ({sorted.length} samples)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>Fluid %</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>50% Warning</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>10% / Clamp Event</span>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[260px] w-full cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`Historical saline level trend chart for ${bedId}`}
        >
          <defs>
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Y-Axis Gridlines */}
          {[100, 75, 50, 25, 0].map((val) => {
            const y = padTop + ((100 - val) / 100) * plotH;
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748b"
                  className="font-mono"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* 50% Low Saline Threshold Line */}
          <line
            x1={padLeft}
            y1={y50}
            x2={width - padRight}
            y2={y50}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 4"
            strokeOpacity="0.65"
          />

          {/* 10% Auto-Clamp Threshold Line */}
          <line
            x1={padLeft}
            y1={y10}
            x2={width - padRight}
            y2={y10}
            stroke="#ef4444"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            strokeOpacity="0.75"
          />

          {/* Area Fill & Line */}
          {areaPath && <path d={areaPath} fill="url(#trendAreaGrad)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Event & Sample Markers */}
          {points.map((p) => {
            const isClamp =
              p.entry.kind === 'clamp_action' ||
              p.entry.status === 'AUTO_CLAMPED' ||
              p.entry.clamped;
            const isStatusChange = p.entry.kind === 'status_change';

            if (!isClamp && !isStatusChange && points.length > 45) {
              return null;
            }

            const color = isClamp
              ? '#ef4444'
              : isStatusChange
                ? '#f59e0b'
                : '#22d3ee';
            const r = isClamp ? 4.5 : isStatusChange ? 4 : 2.5;

            return (
              <circle
                key={p.entry.id}
                cx={p.x}
                cy={p.y}
                r={r}
                fill={color}
                stroke="#060B16"
                strokeWidth="1.4"
              />
            );
          })}

          {/* X-Axis Timestamps */}
          {xTicks.map((tick, idx) => (
            <text
              key={`${tick.entry.id}-${idx}`}
              x={tick.x}
              y={height - 10}
              textAnchor={
                idx === 0
                  ? 'start'
                  : idx === xTicks.length - 1
                    ? 'end'
                    : 'middle'
              }
              fontSize="10"
              fill="#64748b"
              className="font-mono"
            >
              {formatAxisLabel(tick.entry.timestamp)}
            </text>
          ))}

          {/* Interactive Crosshair Probe */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + plotH}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5.5"
                fill="#ffffff"
                stroke="#06b6d4"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Crosshair HUD Overlay */}
        {activePoint && (
          <div className="pointer-events-none absolute right-3 top-2 rounded-lg border border-slate-700/90 bg-[#0B1120]/95 px-3 py-2 text-xs shadow-xl">
            <div className="font-mono text-[11px] text-slate-400">
              {formatFullTimestamp(activePoint.entry.timestamp)}
            </div>
            <div className="mt-1 flex items-center gap-3 font-mono">
              <span className="text-base font-bold tabular-nums text-cyan-300">
                {activePoint.entry.level}%
              </span>
              <span
                className={`text-[11px] font-bold ${
                  activePoint.entry.status === 'AUTO_CLAMPED'
                    ? 'text-rose-400'
                    : activePoint.entry.status === 'LOW_SALINE'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}
              >
                {activePoint.entry.status}
              </span>
              <span className="text-[11px] text-slate-300">
                {activePoint.entry.servoAngle}°
              </span>
            </div>
            <div className="mt-0.5 max-w-[260px] truncate text-[11px] text-slate-300">
              {activePoint.entry.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
