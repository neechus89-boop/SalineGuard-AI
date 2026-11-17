import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  LineChart,
  Pencil,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import {
  HistoryRecordKind,
  PatientAssignment,
  TelemetryHistoryEntry,
  WardBed,
} from '../types/telemetry';
import { TelemetryTrendChart } from './TelemetryTrendChart';

interface HistoricalAnalyticsViewProps {
  allBeds: WardBed[];
  assignments: Record<string, PatientAssignment>;
  history: TelemetryHistoryEntry[];
  selectedBedId: string;
  onSelectBedId: (bedId: string) => void;
  onEditPatient: (bedId: string) => void;
  onRecordSnapshotNow: (bedId: string) => void;
  onClearHistory: () => void;
}

function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const HistoricalAnalyticsView: React.FC<HistoricalAnalyticsViewProps> = ({
  allBeds,
  assignments,
  history,
  selectedBedId,
  onSelectBedId,
  onEditPatient,
  onRecordSnapshotNow,
  onClearHistory,
}) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return toLocalDateInput(d);
  });
  const [endDate, setEndDate] = useState<string>(() => toLocalDateInput(new Date()));
  const [kindFilter, setKindFilter] = useState<'all' | HistoryRecordKind>('all');

  const applyQuickRange = (daysBack: number | 'all') => {
    const today = new Date();
    setEndDate(toLocalDateInput(today));
    if (daysBack === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const start = new Date();
    start.setDate(today.getDate() - daysBack);
    setStartDate(toLocalDateInput(start));
  };

  const filteredEntries = useMemo(() => {
    const startMs = startDate
      ? new Date(`${startDate}T00:00:00`).getTime()
      : Number.NEGATIVE_INFINITY;
    const endMs = endDate
      ? new Date(`${endDate}T23:59:59.999`).getTime()
      : Number.POSITIVE_INFINITY;

    return history
      .filter((entry) => {
        if (entry.bedId !== selectedBedId) return false;
        if (kindFilter !== 'all' && entry.kind !== kindFilter) return false;
        const ts = new Date(entry.timestamp).getTime();
        return ts >= startMs && ts <= endMs;
      })
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, [history, selectedBedId, startDate, endDate, kindFilter]);

  const stats = useMemo(() => {
    if (filteredEntries.length === 0) {
      return {
        minLevel: null as number | null,
        avgLevel: null as number | null,
        clampEvents: 0,
        totalCount: 0,
      };
    }
    let minLevel = 100;
    let sum = 0;
    let clampEvents = 0;
    for (const e of filteredEntries) {
      if (e.level < minLevel) minLevel = e.level;
      sum += e.level;
      if (e.kind === 'clamp_action' || e.status === 'AUTO_CLAMPED') {
        clampEvents += 1;
      }
    }
    return {
      minLevel,
      avgLevel: Math.round(sum / filteredEntries.length),
      clampEvents,
      totalCount: filteredEntries.length,
    };
  }, [filteredEntries]);

  const selectedPatient = assignments[selectedBedId];
  const currentBed = allBeds.find((b) => b.id === selectedBedId);

  const handleExportCsv = () => {
    const header = [
      'Timestamp',
      'Bed ID',
      'Room',
      'Patient Name',
      'MRN',
      'Fluid Level (%)',
      'Status',
      'Clamped',
      'Servo Angle (deg)',
      'Event Type',
      'Note',
    ];
    const rows = filteredEntries.map((e) =>
      [
        e.timestamp,
        e.bedId,
        e.room,
        `"${e.patientName.replace(/"/g, '""')}"`,
        e.mrn,
        e.level,
        e.status,
        e.clamped ? 'YES' : 'NO',
        e.servoAngle,
        e.kind,
        `"${e.note.replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salineguard-${selectedBedId}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Top Filter & Date Range Toolbar */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0B101E]/90 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <LineChart className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-100">
                Historical Telemetry & Trend Analysis
              </h2>
              <p className="text-xs text-slate-400">
                Inspect stored fluid levels, threshold crossings, and clamp actions across any date range
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRecordSnapshotNow(selectedBedId)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25 cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Log Snapshot Now</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredEntries.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#060B16] px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All Logs</span>
            </button>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Bed Selector */}
            <label className="block">
              <span className="text-[11px] font-medium text-slate-400">
                Select Bed & Patient
              </span>
              <select
                value={selectedBedId}
                onChange={(e) => onSelectBedId(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500/70"
              >
                {allBeds.map((b) => {
                  const p = assignments[b.id];
                  return (
                    <option key={b.id} value={b.id}>
                      {b.id} · {p?.patientName ?? b.patientName} ({p?.mrn ?? b.mrn})
                    </option>
                  );
                })}
              </select>
            </label>

            {/* Date Range Inputs */}
            <label className="block">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Calendar className="h-3 w-3" />
                <span>From Date</span>
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="mt-1 block rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500/70"
              />
            </label>

            <label className="block">
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Calendar className="h-3 w-3" />
                <span>To Date</span>
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="mt-1 block rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-cyan-500/70"
              />
            </label>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#060B16] p-1">
              <button
                type="button"
                onClick={() => applyQuickRange(0)}
                className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(2)}
                className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
              >
                3 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange(7)}
                className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => applyQuickRange('all')}
                className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
              >
                All
              </button>
            </div>
          </div>

          {/* Record Type Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#060B16] p-1">
            {(
              [
                ['all', 'All Events'],
                ['telemetry', 'Samples'],
                ['status_change', 'Status'],
                ['clamp_action', 'Clamp Actions'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setKindFilter(val)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  kindFilter === val
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Context Strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#060B16]/85 px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold text-white">
              {selectedBedId}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-slate-200">
              {selectedPatient?.patientName ?? currentBed?.patientName}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-sky-300">
              {selectedPatient?.mrn ?? currentBed?.mrn}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-300">
              Room {selectedPatient?.room ?? currentBed?.room}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-400">
              {selectedPatient?.solution ?? currentBed?.solution}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onEditPatient(selectedBedId)}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
          >
            <Pencil className="h-3 w-3" />
            <span>Edit Patient</span>
          </button>
        </div>

        {/* 4-Column KPI Summary Row */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">
              Minimum Fluid Level
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-300">
              {stats.minLevel !== null ? `${stats.minLevel}%` : '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">
              Average Fluid Level
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-cyan-300">
              {stats.avgLevel !== null ? `${stats.avgLevel}%` : '—'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">
              Clamp / Critical Events
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-400">
              {stats.clampEvents}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#060B16]/85 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">
              Records in Date Range
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-100">
              {stats.totalCount}
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="mt-4">
          <TelemetryTrendChart entries={filteredEntries} bedId={selectedBedId} />
        </div>
      </section>

      {/* Historical Event Table */}
      <section className="rounded-2xl border border-slate-800/90 bg-[#0B101E]/90 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h3 className="text-sm font-bold text-slate-100">
            Stored Telemetry & Event Records · {selectedBedId}
          </h3>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            Showing {filteredEntries.length} records
          </span>
        </div>

        <div className="clinical-scroll mt-3 max-h-[340px] overflow-auto">
          {filteredEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No stored telemetry records match this bed and date filter.
            </div>
          ) : (
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#0B101E]">
                <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 px-3">Patient / MRN</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Fluid %</th>
                  <th className="py-2 px-3">Flow Status</th>
                  <th className="py-2 px-3 text-right">Servo</th>
                  <th className="py-2 pl-3">Clinical Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredEntries.map((entry) => {
                  const typeLabel =
                    entry.kind === 'clamp_action'
                      ? 'Clamp Action'
                      : entry.kind === 'status_change'
                        ? 'Status Change'
                        : entry.kind === 'patient_update'
                          ? 'Patient Update'
                          : 'Fluid Sample';

                  const typeColor =
                    entry.kind === 'clamp_action'
                      ? 'text-rose-400'
                      : entry.kind === 'status_change'
                        ? 'text-amber-400'
                        : entry.kind === 'patient_update'
                          ? 'text-sky-400'
                          : 'text-slate-400';

                  return (
                    <tr key={entry.id} className="h-9 hover:bg-slate-800/25">
                      <td className="py-2 pr-3 font-mono text-[11px] tabular-nums text-slate-300 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-200">
                          {entry.patientName}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-slate-400">
                          {entry.mrn}
                        </span>
                      </td>
                      <td className={`py-2 px-3 font-semibold whitespace-nowrap ${typeColor}`}>
                        {typeLabel}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-100 whitespace-nowrap">
                        {entry.level}%
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                        <span
                          className={
                            entry.status === 'AUTO_CLAMPED'
                              ? 'text-rose-400'
                              : entry.status === 'LOW_SALINE'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {entry.servoAngle}°
                      </td>
                      <td className="py-2 pl-3 text-slate-400">{entry.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
