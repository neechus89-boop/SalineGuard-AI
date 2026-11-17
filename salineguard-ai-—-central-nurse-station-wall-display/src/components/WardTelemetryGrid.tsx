import React, { useState } from 'react';
import { BedDouble, Droplets, RotateCcw, Pencil, LineChart } from 'lucide-react';
import { WardBed } from '../types/telemetry';

interface WardTelemetryGridProps {
  beds: WardBed[];
  onRefillBed: (bedId: string) => void;
  onEditPatient: (bedId: string) => void;
  onViewHistory: (bedId: string) => void;
}

export const WardTelemetryGrid: React.FC<WardTelemetryGridProps> = ({
  beds,
  onRefillBed,
  onEditPatient,
  onViewHistory,
}) => {
  const [filter, setFilter] = useState<'all' | 'attention'>('all');

  const visibleBeds =
    filter === 'attention'
      ? beds.filter((b) => b.status !== 'NORMAL_FLOW')
      : beds;

  const attentionCount = beds.filter((b) => b.status !== 'NORMAL_FLOW').length;

  return (
    <section
      aria-label="Multi-Bed Ward Telemetry Wall Grid"
      className="rounded-2xl border border-slate-800/90 bg-[#0B101E]/85 p-5 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          <BedDouble className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-bold tracking-tight text-slate-100">
            ICU Ward Telemetry Matrix · Beds 02 – 12
          </h2>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs text-slate-400">
            11 Active Bays
          </span>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#060B16] p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Beds ({beds.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('attention')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'attention'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Low / Clamped ({attentionCount})
          </button>
        </div>
      </div>

      {visibleBeds.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          All ward beds (BED-02 through BED-12) are currently within normal saline thresholds.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleBeds.map((bed) => {
            const isCritical = bed.status === 'AUTO_CLAMPED' || bed.clamped || bed.level <= 10;
            const isLow = !isCritical && bed.status === 'LOW_SALINE';

            const borderStyle = isCritical
              ? 'border-rose-500/70 bg-rose-950/20'
              : isLow
                ? 'border-amber-500/50 bg-amber-950/15'
                : 'border-slate-800/90 bg-[#070C18]/90 hover:border-slate-700';

            const barStyle = isCritical
              ? 'bg-rose-500'
              : isLow
                ? 'bg-amber-400'
                : 'bg-emerald-400';

            const levelTextStyle = isCritical
              ? 'text-rose-400'
              : isLow
                ? 'text-amber-300'
                : 'text-emerald-300';

            const valveLabel = isCritical
              ? 'CLAMPED 90°'
              : isLow
                ? 'LOW BAG · 0°'
                : 'OPEN 0°';

            return (
              <article
                key={bed.id}
                className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${borderStyle}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-100">
                      {bed.id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-medium text-slate-400">
                        {bed.room}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditPatient(bed.id)}
                        title={`Edit patient for ${bed.id}`}
                        aria-label={`Edit patient for ${bed.id}`}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewHistory(bed.id)}
                        title={`View historical trends for ${bed.id}`}
                        aria-label={`View historical trends for ${bed.id}`}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-sky-300 cursor-pointer"
                      >
                        <LineChart className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1 truncate text-xs font-semibold text-slate-200">
                    {bed.patientName}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-sky-300/90">
                    {bed.mrn}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">
                    {bed.solution}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`font-mono text-2xl font-bold tabular-nums ${levelTextStyle}`}
                    >
                      {bed.level}%
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <Droplets className="h-3 w-3 text-slate-500" />
                      <span className="tabular-nums">
                        {isCritical ? '0' : bed.dripRateMlHr} mL/hr
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barStyle}`}
                      style={{ width: `${bed.level}%` }}
                    />
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-800/70 pt-2">
                    <span
                      className={`font-mono text-[10px] font-bold tracking-wide ${
                        isCritical
                          ? 'text-rose-400'
                          : isLow
                            ? 'text-amber-400'
                            : 'text-emerald-400/90'
                      }`}
                    >
                      {valveLabel}
                    </span>

                    {(isLow || isCritical) && (
                      <button
                        type="button"
                        onClick={() => onRefillBed(bed.id)}
                        title="Mark new IV bag hung (100%)"
                        className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>New Bag</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
