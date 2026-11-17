import React, { useEffect, useState } from 'react';
import { X, UserCheck, Save } from 'lucide-react';
import { IvSolutionType, PatientAssignment } from '../types/telemetry';

interface PatientEditModalProps {
  assignment: PatientAssignment | null;
  onClose: () => void;
  onSave: (updated: PatientAssignment) => void;
}

const SOLUTION_OPTIONS: IvSolutionType[] = [
  'Normal Saline 0.9%',
  'Ringer Lactate',
  'Dextrose 5%',
];

export const PatientEditModal: React.FC<PatientEditModalProps> = ({
  assignment,
  onClose,
  onSave,
}) => {
  const [patientName, setPatientName] = useState('');
  const [mrn, setMrn] = useState('');
  const [room, setRoom] = useState('');
  const [clinicalNote, setClinicalNote] = useState('');
  const [solution, setSolution] = useState<IvSolutionType>('Normal Saline 0.9%');
  const [dripRateMlHr, setDripRateMlHr] = useState(110);
  const [bagVolumeMl, setBagVolumeMl] = useState(500);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignment) return;
    setPatientName(assignment.patientName);
    setMrn(assignment.mrn);
    setRoom(assignment.room);
    setClinicalNote(assignment.clinicalNote);
    setSolution(assignment.solution);
    setDripRateMlHr(assignment.dripRateMlHr);
    setBagVolumeMl(assignment.bagVolumeMl);
    setError(null);
  }, [assignment]);

  useEffect(() => {
    if (!assignment) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [assignment, onClose]);

  if (!assignment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = patientName.trim();
    const cleanMrn = mrn.trim();
    const cleanRoom = room.trim();

    if (!cleanName) {
      setError('Patient Name is required.');
      return;
    }
    if (!cleanMrn) {
      setError('Medical Record Number (MRN) is required.');
      return;
    }
    if (!cleanRoom) {
      setError('Room / Bay identifier is required.');
      return;
    }

    onSave({
      ...assignment,
      patientName: cleanName,
      mrn: cleanMrn,
      room: cleanRoom,
      clinicalNote: clinicalNote.trim() || 'ICU Infusion',
      solution,
      dripRateMlHr: Math.max(10, Math.min(500, Number(dripRateMlHr) || 100)),
      bagVolumeMl: Number(bagVolumeMl) || 500,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#0B101E] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="patient-modal-title"
                className="text-base font-bold text-slate-100"
              >
                Assign Patient · {assignment.bedId}
              </h2>
              <p className="text-xs text-slate-400">
                Associate patient identifiers and infusion parameters with this bed
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition-colors hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Patient Full Name
              </span>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Raghav Menon"
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Medical Record Number (MRN)
              </span>
              <input
                type="text"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                placeholder="e.g. MRN-10142"
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Room / ICU Bay
              </span>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. ICU-101"
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Clinical Tag / Ward Note
              </span>
              <input
                type="text"
                value={clinicalNote}
                onChange={(e) => setClinicalNote(e.target.value)}
                placeholder="e.g. Post-CABG"
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="text-xs font-semibold text-slate-300">
                IV Solution
              </span>
              <select
                value={solution}
                onChange={(e) => setSolution(e.target.value as IvSolutionType)}
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500/70"
              >
                {SOLUTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Drip Rate (mL/hr)
              </span>
              <input
                type="number"
                min={10}
                max={500}
                value={dripRateMlHr}
                onChange={(e) => setDripRateMlHr(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-3 py-2 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-emerald-500/70"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">
                Bag Size (mL)
              </span>
              <select
                value={bagVolumeMl}
                onChange={(e) => setBagVolumeMl(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700/80 bg-[#060B16] px-2.5 py-2 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500/70"
              >
                <option value={250}>250 mL</option>
                <option value={500}>500 mL</option>
                <option value={1000}>1000 mL</option>
              </select>
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/60 bg-emerald-600/25 px-4 py-2 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-600/40 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Patient Assignment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
