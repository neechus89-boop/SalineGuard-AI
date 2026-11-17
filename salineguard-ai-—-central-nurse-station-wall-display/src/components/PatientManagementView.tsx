import React, { useMemo, useState } from 'react';
import { Search, Pencil, LineChart, Users } from 'lucide-react';
import { PatientAssignment, WardBed } from '../types/telemetry';

interface PatientManagementViewProps {
  allBeds: WardBed[];
  assignments: Record<string, PatientAssignment>;
  onEditPatient: (bedId: string) => void;
  onInspectHistory: (bedId: string) => void;
}

export const PatientManagementView: React.FC<PatientManagementViewProps> = ({
  allBeds,
  assignments,
  onEditPatient,
  onInspectHistory,
}) => {
  const [query, setQuery] = useState('');

  const filteredBeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allBeds;
    return allBeds.filter((bed) => {
      const a = assignments[bed.id];
      return (
        bed.id.toLowerCase().includes(q) ||
        bed.room.toLowerCase().includes(q) ||
        (a?.patientName ?? bed.patientName).toLowerCase().includes(q) ||
        (a?.mrn ?? bed.mrn).toLowerCase().includes(q) ||
        (a?.clinicalNote ?? '').toLowerCase().includes(q)
      );
    });
  }, [allBeds, assignments, query]);

  return (
    <section
      aria-label="Patient Data Management"
      className="rounded-2xl border border-slate-800/90 bg-[#0B101E]/90 p-5 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-100">
              Patient Data & Bed Assignments
            </h2>
            <p className="text-xs text-slate-400">
              Associate patient identifiers (Name, MRN, Room) and infusion parameters with each ICU bed
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#060B16] px-3 py-2 text-xs focus-within:border-sky-500/60">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Name, MRN, Bed or Room..."
            className="w-60 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
              <th className="py-2.5 pr-3">Bed</th>
              <th className="py-2.5 px-3">Room</th>
              <th className="py-2.5 px-3">Patient Name</th>
              <th className="py-2.5 px-3">MRN</th>
              <th className="py-2.5 px-3">Clinical Note</th>
              <th className="py-2.5 px-3">IV Solution</th>
              <th className="py-2.5 px-3 text-right">Drip Rate</th>
              <th className="py-2.5 px-3 text-right">Live Level</th>
              <th className="py-2.5 px-3">Valve State</th>
              <th className="py-2.5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredBeds.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-slate-400">
                  No beds match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              filteredBeds.map((bed) => {
                const a = assignments[bed.id];
                const isCritical = bed.status === 'AUTO_CLAMPED' || bed.clamped || bed.level <= 10;
                const isLow = !isCritical && bed.status === 'LOW_SALINE';

                return (
                  <tr
                    key={bed.id}
                    className="h-11 transition-colors hover:bg-slate-800/30"
                  >
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-100 whitespace-nowrap">
                      {bed.id}
                      {bed.id === 'BED-01' && (
                        <span className="ml-1.5 font-sans text-[10px] font-medium text-emerald-400">
                          (ESP32)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {a?.room ?? bed.room}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-100 whitespace-nowrap">
                      {a?.patientName ?? bed.patientName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sky-300 whitespace-nowrap">
                      {a?.mrn ?? bed.mrn}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">
                      {a?.clinicalNote ?? 'ICU Infusion'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                      {a?.solution ?? bed.solution}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {isCritical ? 0 : (a?.dripRateMlHr ?? bed.dripRateMlHr)} mL/hr
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                        isCritical
                          ? 'text-rose-400'
                          : isLow
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                      }`}
                    >
                      {bed.level}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold whitespace-nowrap">
                      <span
                        className={
                          isCritical
                            ? 'text-rose-400'
                            : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }
                      >
                        {isCritical ? 'CLAMPED 90°' : isLow ? 'LOW BAG' : 'OPEN 0°'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditPatient(bed.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectHistory(bed.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/20 cursor-pointer"
                        >
                          <LineChart className="h-3 w-3" />
                          <span>Trends</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
