import React from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { AuditEvent } from '../types/telemetry';

interface NurseAuditLogProps {
  events: AuditEvent[];
  onClearLog: () => void;
}

export const NurseAuditLog: React.FC<NurseAuditLogProps> = ({
  events,
  onClearLog,
}) => {
  return (
    <section
      aria-label="Live Event and Nurse Audit Log"
      className="flex flex-col rounded-2xl border border-slate-800/90 bg-[#0B101E]/85 p-5 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-tight text-slate-100">
            Live Event & Nurse Audit Log
          </h2>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {events.length} {events.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClearLog}
          disabled={events.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#060B16] px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <div className="clinical-scroll mt-3 max-h-[250px] overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No telemetry transitions logged yet. Threshold crossings (50% warning, 10% auto-clamp) and desk commands appear here automatically.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {events.map((ev) => {
              const severityColor =
                ev.severity === 'critical'
                  ? 'text-rose-400'
                  : ev.severity === 'warning'
                    ? 'text-amber-400'
                    : ev.severity === 'action'
                      ? 'text-sky-400'
                      : 'text-emerald-400';

              return (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-[11px] font-medium tabular-nums text-slate-400 shrink-0">
                      {ev.timestamp}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-200 shrink-0">
                      {ev.bedId}
                    </span>
                    <span className={`font-semibold shrink-0 ${severityColor}`}>
                      {ev.eventTitle}
                    </span>
                    <span className="truncate text-slate-400">{ev.detail}</span>
                  </div>

                  <div className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                    {ev.levelSnapshot}% · {ev.servoAngleSnapshot}°
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
