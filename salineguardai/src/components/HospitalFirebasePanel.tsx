import React, { useState, useEffect, useRef } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  OperationType,
  handleFirestoreError,
  User,
} from '../firebase';
import {
  PatientInput,
  PatientRecord,
  InfusionSessionRecord,
  PrescribedBagMl,
  validateAndSanitizePatientInput,
  sanitizeDocumentId,
  buildInfusionSessionPayload,
  aggregateInvestmentMetrics,
  formatDurationSeconds,
  buildAnalyticsCsv,
} from '../utils/infusionAnalytics';

interface HospitalFirebasePanelProps {
  currentLevelPercent: number;
  bottleCapacityMl: number;
  flowRateMlPerHr: number;
  onSyncPrescriptionToMonitor: (bagMl: number, rateMlHr: number) => void;
}

const EMPTY_PATIENT_FORM: PatientInput = {
  patientCode: '',
  fullName: '',
  age: 54,
  wardBed: '',
  diagnosis: '',
  prescribedBagMl: 500,
  prescribedRateMlHr: 125,
  attendingClinician: '',
};

export const HospitalFirebasePanel: React.FC<HospitalFirebasePanelProps> = ({
  currentLevelPercent,
  bottleCapacityMl,
  flowRateMlPerHr,
  onSyncPrescriptionToMonitor,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [sessions, setSessions] = useState<InfusionSessionRecord[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Patient form state
  const [showPatientForm, setShowPatientForm] = useState<boolean>(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [patientForm, setPatientForm] =
    useState<PatientInput>(EMPTY_PATIENT_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [savingPatient, setSavingPatient] = useState<boolean>(false);
  const [confirmDeletePatientId, setConfirmDeletePatientId] = useState<
    string | null
  >(null);

  // Active bottle infusion timer state
  const [runActive, setRunActive] = useState<boolean>(false);
  const [runStartLevel, setRunStartLevel] = useState<number>(
    currentLevelPercent
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [autoLogOnClamp, setAutoLogOnClamp] = useState<boolean>(true);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [savingSession, setSavingSession] = useState<boolean>(false);
  const [lastSavedBanner, setLastSavedBanner] = useState<string | null>(null);

  const autoLoggedThisRunRef = useRef<boolean>(false);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Firestore /patients and /infusionSessions only when authenticated
  useEffect(() => {
    if (!user) {
      setPatients([]);
      setSessions([]);
      setActivePatientId(null);
      return;
    }

    const patientsQuery = query(
      collection(db, 'patients'),
      where('ownerId', '==', user.uid)
    );

    const unsubPatients = onSnapshot(
      patientsQuery,
      (snapshot) => {
        const list: PatientRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            patientCode: String(data.patientCode || ''),
            fullName: String(data.fullName || ''),
            age: Number(data.age || 0),
            wardBed: String(data.wardBed || ''),
            diagnosis: String(data.diagnosis || ''),
            prescribedBagMl: (Number(data.prescribedBagMl) || 500) as PrescribedBagMl,
            prescribedRateMlHr: Number(data.prescribedRateMlHr || 125),
            attendingClinician: String(data.attendingClinician || ''),
            ownerId: String(data.ownerId || ''),
            createdAtMs:
              data.createdAt && typeof data.createdAt.toMillis === 'function'
                ? data.createdAt.toMillis()
                : Date.now(),
            updatedAtMs:
              data.updatedAt && typeof data.updatedAt.toMillis === 'function'
                ? data.updatedAt.toMillis()
                : Date.now(),
          };
        });
        list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPatients(list);
        setActivePatientId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? null
        );
        setFirestoreError(null);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Quota exceeded')) {
          setFirestoreError(
            'Firestore daily free-tier quota exceeded. Quota resets tomorrow.'
          );
        } else {
          setFirestoreError(`Firestore patient sync error: ${msg}`);
        }
        try {
          handleFirestoreError(err, OperationType.LIST, 'patients');
        } catch {
          // Handled in UI banner after structured logging
        }
      }
    );

    const sessionsQuery = query(
      collection(db, 'infusionSessions'),
      where('ownerId', '==', user.uid)
    );

    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const list: InfusionSessionRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            patientId: String(data.patientId || ''),
            patientCode: String(data.patientCode || ''),
            wardBed: String(data.wardBed || ''),
            bottleCapacityMl: (Number(data.bottleCapacityMl) ||
              500) as PrescribedBagMl,
            flowRateMlPerHr: Number(data.flowRateMlPerHr || 125),
            startLevelPercent: Number(data.startLevelPercent ?? 100),
            endLevelPercent: Number(data.endLevelPercent ?? 0),
            volumeUsedMl: Number(data.volumeUsedMl || 0),
            bottlesConsumed: Number(data.bottlesConsumed || 0),
            durationSeconds: Number(data.durationSeconds || 0),
            estimatedTimeMinutes: Number(data.estimatedTimeMinutes || 0),
            clampTriggered: Boolean(data.clampTriggered),
            status:
              data.status === 'CLAMPED_AUTO' || data.status === 'MANUAL_STOP'
                ? data.status
                : 'COMPLETED',
            notes: typeof data.notes === 'string' ? data.notes : undefined,
            ownerId: String(data.ownerId || ''),
            createdAtMs:
              data.createdAt && typeof data.createdAt.toMillis === 'function'
                ? data.createdAt.toMillis()
                : Date.now(),
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setSessions(list);
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Quota exceeded')) {
          setFirestoreError(
            'Firestore daily free-tier quota exceeded. Quota resets tomorrow.'
          );
        } else {
          setFirestoreError(`Firestore session sync error: ${msg}`);
        }
        try {
          handleFirestoreError(err, OperationType.LIST, 'infusionSessions');
        } catch {
          // Handled in UI banner after structured logging
        }
      }
    );

    return () => {
      unsubPatients();
      unsubSessions();
    };
  }, [user]);

  // 1-second active bottle timer
  useEffect(() => {
    if (!runActive) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [runActive]);

  const activePatient =
    patients.find((p) => p.id === activePatientId) || null;

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google authentication failed.';
      setAuthError(msg);
    }
  };

  const handleSignOut = async () => {
    setRunActive(false);
    await signOut(auth);
  };

  const handleSelectPatient = (patient: PatientRecord) => {
    setActivePatientId(patient.id);
    onSyncPrescriptionToMonitor(
      patient.prescribedBagMl,
      patient.prescribedRateMlHr
    );
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormErrors([]);
    setFirestoreError(null);

    const validation = validateAndSanitizePatientInput(patientForm);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setSavingPatient(true);
    try {
      if (editingPatientId) {
        const targetPath = `patients/${editingPatientId}`;
        try {
          await updateDoc(doc(db, 'patients', editingPatientId), {
            fullName: validation.payload.fullName,
            age: validation.payload.age,
            wardBed: validation.payload.wardBed,
            diagnosis: validation.payload.diagnosis,
            prescribedBagMl: validation.payload.prescribedBagMl,
            prescribedRateMlHr: validation.payload.prescribedRateMlHr,
            attendingClinician: validation.payload.attendingClinician,
            updatedAt: serverTimestamp(),
          });
          setActivePatientId(editingPatientId);
          onSyncPrescriptionToMonitor(
            validation.payload.prescribedBagMl,
            validation.payload.prescribedRateMlHr
          );
          setLastSavedBanner(
            `Updated patient ${validation.payload.patientCode} in Firestore.`
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, targetPath);
        }
      } else {
        const newId = sanitizeDocumentId(validation.payload.patientCode, 'pt');
        const targetPath = `patients/${newId}`;
        try {
          await setDoc(doc(db, 'patients', newId), {
            ...validation.payload,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setActivePatientId(newId);
          onSyncPrescriptionToMonitor(
            validation.payload.prescribedBagMl,
            validation.payload.prescribedRateMlHr
          );
          setLastSavedBanner(
            `Registered patient ${validation.payload.patientCode} in Firestore.`
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, targetPath);
        }
      }

      setShowPatientForm(false);
      setEditingPatientId(null);
      setPatientForm(EMPTY_PATIENT_FORM);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFirestoreError(msg);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    if (!user) return;
    setFirestoreError(null);
    const targetPath = `patients/${patientId}`;
    try {
      await deleteDoc(doc(db, 'patients', patientId));
      setConfirmDeletePatientId(null);
      setLastSavedBanner('Patient record deleted from Firestore.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFirestoreError(msg);
      try {
        handleFirestoreError(err, OperationType.DELETE, targetPath);
      } catch {
        // Logged
      }
    }
  };

  const handleLogInfusionSession = async (
    forcedStatus?: 'COMPLETED' | 'CLAMPED_AUTO' | 'MANUAL_STOP'
  ) => {
    if (!user || !activePatient) return;
    setSavingSession(true);
    setFirestoreError(null);

    const isClamped = currentLevelPercent <= 10;
    const status =
      forcedStatus ||
      (isClamped
        ? 'CLAMPED_AUTO'
        : currentLevelPercent <= 12
        ? 'COMPLETED'
        : 'MANUAL_STOP');

    const payload = buildInfusionSessionPayload({
      patientId: activePatient.id,
      patientCode: activePatient.patientCode,
      wardBed: activePatient.wardBed,
      bottleCapacityMl: (bottleCapacityMl === 250 || bottleCapacityMl === 1000
        ? bottleCapacityMl
        : 500) as PrescribedBagMl,
      flowRateMlPerHr,
      startLevelPercent: runStartLevel,
      endLevelPercent: currentLevelPercent,
      durationSeconds: Math.max(1, elapsedSeconds),
      clampTriggered: isClamped,
      status,
      notes: sessionNotes,
    });

    const sessionId = sanitizeDocumentId(activePatient.patientCode, 'sess');
    const targetPath = `infusionSessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'infusionSessions', sessionId), {
        ...payload,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });
      setRunActive(false);
      setElapsedSeconds(0);
      setRunStartLevel(currentLevelPercent);
      setSessionNotes('');
      autoLoggedThisRunRef.current = false;
      setLastSavedBanner(
        `Logged ${payload.volumeUsedMl} mL (${payload.bottlesConsumed} bottles) in ${formatDurationSeconds(
          payload.durationSeconds
        )} to Firestore.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFirestoreError(msg);
      try {
        handleFirestoreError(err, OperationType.CREATE, targetPath);
      } catch {
        // Logged
      }
    } finally {
      setSavingSession(false);
    }
  };

  // Optional auto-log to Firestore when an active run reaches the <=10% pinch-clamp threshold
  useEffect(() => {
    if (
      runActive &&
      autoLogOnClamp &&
      activePatient &&
      user &&
      currentLevelPercent <= 10 &&
      !autoLoggedThisRunRef.current
    ) {
      autoLoggedThisRunRef.current = true;
      void handleLogInfusionSession('CLAMPED_AUTO');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevelPercent, runActive, autoLogOnClamp, activePatient, user]);

  const handleDownloadCsv = () => {
    const csv = buildAnalyticsCsv(sessions, patients);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SalineGuard_Supply_Analytics_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fillSamplePatient = () => {
    const num = Math.floor(100 + Math.random() * 899);
    setPatientForm({
      patientCode: `ICU-B04-${num}`,
      fullName: 'Arjun Nair',
      age: 58,
      wardBed: 'ICU Ward A · Bed 04',
      diagnosis: 'Post-Op Fluid Resuscitation (0.9% NaCl)',
      prescribedBagMl: 500,
      prescribedRateMlHr: 125,
      attendingClinician: 'Dr. Meera Iyer',
    });
    setFormErrors([]);
  };

  const analytics = aggregateInvestmentMetrics(sessions, patients);
  const liveDeltaPct = Math.max(0, runStartLevel - currentLevelPercent);
  const liveConsumedMl = Math.round((liveDeltaPct / 100) * bottleCapacityMl);
  const liveBottleFrac =
    Math.round((liveConsumedMl / Math.max(1, bottleCapacityMl)) * 100) / 100;

  return (
    <section
      id="hospital-firebase-section"
      aria-label="Hospital Patient Registry and Firebase Saline Supply Analytics"
      className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 flex flex-col gap-6"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tracking-wider text-slate-400">
            <span>CLOUD FIRESTORE DATABASE</span>
            <span aria-hidden="true">·</span>
            <span>HOSPITAL PATIENT REGISTRY</span>
            <span aria-hidden="true">·</span>
            <span>SALINE SUPPLY &amp; INVESTOR ANALYTICS</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-50 mt-0.5">
            Hospital Patients &amp; Saline Bottle Consumption Database
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {authLoading ? (
            <span className="text-xs font-mono text-slate-400">
              Checking Firebase Auth...
            </span>
          ) : user ? (
            <>
              <div className="text-xs font-mono text-slate-300">
                <span className="text-[#00F5D4] font-semibold">
                  ● FIRESTORE SYNCED
                </span>{' '}
                <span className="text-slate-400">·</span>{' '}
                <span>{user.email || user.displayName}</span>
              </div>
              <button
                type="button"
                data-testid="firebase-signout-btn"
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="firebase-google-signin-btn"
              onClick={handleGoogleSignIn}
              className="px-4 py-2 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-slate-950 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Sign in with Google to Sync Firebase
            </button>
          )}
        </div>
      </div>

      {/* Status / Error Alerts */}
      {authError && (
        <div
          role="alert"
          className="bg-rose-950/60 border border-rose-700/80 rounded-xl px-4 py-2.5 text-xs font-mono text-rose-200"
        >
          Authentication Error: {authError}
        </div>
      )}
      {firestoreError && (
        <div
          role="alert"
          className="bg-rose-950/60 border border-rose-700/80 rounded-xl px-4 py-2.5 text-xs font-mono text-rose-200"
        >
          {firestoreError}
        </div>
      )}
      {lastSavedBanner && (
        <div
          role="status"
          className="bg-emerald-950/50 border border-emerald-700/70 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-200 flex items-center justify-between gap-2"
        >
          <span>✓ {lastSavedBanner}</span>
          <button
            type="button"
            onClick={() => setLastSavedBanner(null)}
            className="text-emerald-300 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Auth Initialization / Unauthenticated Onboarding / Authenticated Workspace */}
      {authLoading ? (
        <div
          data-testid="firebase-auth-loading"
          className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-6 text-xs font-mono text-slate-400"
        >
          Verifying clinician session with Firebase Authentication...
        </div>
      ) : !user ? (
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-base font-semibold text-slate-100">
              Connect Your Clinician Account to Persist Patient &amp; Bottle
              Supply Data
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Sign in with Google to store hospital patient profiles (MRN, ward
              bed, diagnosis, prescribed saline volume &amp; flow rate) and log
              exact saline bottle consumption (mL used, fractional bottle count,
              and time taken per bottle) to Cloud Firestore for hospital
              procurement and investment projections.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-slate-950 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Connect Firebase with Google
          </button>
        </div>
      ) : (
        <>
          {/* 4-Column Investor & Hospital Supply KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-slate-900/65 border border-slate-800/90 rounded-xl p-4">
              <div className="text-[11px] font-mono text-slate-400">
                TOTAL SALINE INFUSED
              </div>
              <div className="text-2xl font-mono font-bold text-[#00F5D4] mt-1 tabular-nums">
                {analytics.totalVolumeInfusedLiters.toFixed(2)}{' '}
                <span className="text-xs text-slate-400 font-normal">L</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                {analytics.totalVolumeInfusedMl} mL across{' '}
                {analytics.totalSessions} runs
              </div>
            </div>

            <div className="bg-slate-900/65 border border-slate-800/90 rounded-xl p-4">
              <div className="text-[11px] font-mono text-slate-400">
                BOTTLES CONSUMED
              </div>
              <div className="text-2xl font-mono font-bold text-slate-50 mt-1 tabular-nums">
                {analytics.totalBottlesConsumed.toFixed(2)}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  units
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                250mL:{analytics.bagSizeBreakdown.bag250Count} · 500mL:
                {analytics.bagSizeBreakdown.bag500Count} · 1L:
                {analytics.bagSizeBreakdown.bag1000Count}
              </div>
            </div>

            <div className="bg-slate-900/65 border border-slate-800/90 rounded-xl p-4">
              <div className="text-[11px] font-mono text-slate-400">
                AVG TIME PER BOTTLE RUN
              </div>
              <div className="text-2xl font-mono font-bold text-slate-50 mt-1 tabular-nums">
                {analytics.formattedAvgDuration}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                Avg {analytics.avgVolumePerSessionMl} mL ·{' '}
                {analytics.autoClampEventsCount} auto-clamps
              </div>
            </div>

            <div className="bg-slate-900/65 border border-slate-800/90 rounded-xl p-4">
              <div className="text-[11px] font-mono text-slate-400">
                PROJECTED MONTHLY DEMAND
              </div>
              <div className="text-2xl font-mono font-bold text-amber-300 mt-1 tabular-nums">
                {analytics.projectedMonthlyBottlesAllBeds}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  btl/mo
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
                {analytics.projectedAnnualBottlesAllBeds} btl/yr across{' '}
                {Math.max(1, analytics.totalPatients)} bed(s)
              </div>
            </div>
          </div>

          {/* 2-Column Workspace: Patient Registry (Left) + Active Run Timer & Analytics Table (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left (5 cols): Hospital Patient Registry */}
            <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div>
                  <div className="text-[11px] font-mono text-slate-400">
                    HOSPITAL ICU PATIENTS ({patients.length})
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Select Active Bedside Patient
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="add-patient-toggle-btn"
                  onClick={() => {
                    setEditingPatientId(null);
                    setPatientForm(EMPTY_PATIENT_FORM);
                    setFormErrors([]);
                    setShowPatientForm((prev) => !prev);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 text-slate-950 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  {showPatientForm ? 'Cancel' : '+ Add Patient'}
                </button>
              </div>

              {showPatientForm && (
                <form
                  onSubmit={handleSavePatient}
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[#00F5D4]">
                      {editingPatientId
                        ? 'EDIT HOSPITAL PATIENT'
                        : 'NEW HOSPITAL PATIENT RECORD'}
                    </span>
                    {!editingPatientId && (
                      <button
                        type="button"
                        onClick={fillSamplePatient}
                        className="text-[11px] font-mono text-slate-300 hover:text-[#00F5D4] underline"
                      >
                        Fill Sample ICU Patient
                      </button>
                    )}
                  </div>

                  {formErrors.length > 0 && (
                    <div
                      role="alert"
                      className="bg-rose-950/60 border border-rose-700/80 rounded-lg p-2 text-[11px] font-mono text-rose-200 space-y-0.5"
                    >
                      {formErrors.map((err) => (
                        <div key={err}>• {err}</div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        MRN / PATIENT CODE
                      </label>
                      <input
                        type="text"
                        required
                        disabled={Boolean(editingPatientId)}
                        value={patientForm.patientCode}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            patientCode: e.target.value,
                          }))
                        }
                        placeholder="ICU-B04-101"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        AGE (YEARS)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={130}
                        required
                        value={patientForm.age}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            age: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      PATIENT FULL NAME
                    </label>
                    <input
                      type="text"
                      required
                      value={patientForm.fullName}
                      onChange={(e) =>
                        setPatientForm((prev) => ({
                          ...prev,
                          fullName: e.target.value,
                        }))
                      }
                      placeholder="Full legal name"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        WARD / BED
                      </label>
                      <input
                        type="text"
                        required
                        value={patientForm.wardBed}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            wardBed: e.target.value,
                          }))
                        }
                        placeholder="ICU Ward A · Bed 04"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        ATTENDING CLINICIAN
                      </label>
                      <input
                        type="text"
                        required
                        value={patientForm.attendingClinician}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            attendingClinician: e.target.value,
                          }))
                        }
                        placeholder="Dr. Meera Iyer"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      CLINICAL DIAGNOSIS / IV INDICATION
                    </label>
                    <input
                      type="text"
                      required
                      value={patientForm.diagnosis}
                      onChange={(e) =>
                        setPatientForm((prev) => ({
                          ...prev,
                          diagnosis: e.target.value,
                        }))
                      }
                      placeholder="Post-Op Hydration / Electrolyte Replacement"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        SALINE BOTTLE SIZE
                      </label>
                      <select
                        value={patientForm.prescribedBagMl}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            prescribedBagMl: Number(
                              e.target.value
                            ) as PrescribedBagMl,
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      >
                        <option value={250}>250 mL Saline</option>
                        <option value={500}>500 mL Saline</option>
                        <option value={1000}>1000 mL Saline</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        FLOW RATE (mL/hr)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        required
                        value={patientForm.prescribedRateMlHr}
                        onChange={(e) =>
                          setPatientForm((prev) => ({
                            ...prev,
                            prescribedRateMlHr: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPatient}
                    className="w-full py-2 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 disabled:opacity-50 text-slate-950 text-xs font-mono font-semibold transition-colors"
                  >
                    {savingPatient
                      ? 'Saving to Firestore...'
                      : editingPatientId
                      ? 'Update Patient in Firestore'
                      : 'Save Patient to Firestore'}
                  </button>
                </form>
              )}

              {/* Registered Patient Cards */}
              {patients.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400">
                  No hospital patients registered yet. Click{' '}
                  <strong className="text-slate-200">+ Add Patient</strong> to
                  register a patient and bind their saline prescription to the
                  live monitor.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {patients.map((pt) => {
                    const isSelected = pt.id === activePatient?.id;
                    return (
                      <div
                        key={pt.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? 'bg-slate-900/95 border-[#00F5D4]/60'
                            : 'bg-slate-900/50 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectPatient(pt)}
                            className="text-left flex-1"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                              <span
                                className={
                                  isSelected
                                    ? 'text-[#00F5D4] font-semibold'
                                    : 'text-slate-300 font-semibold'
                                }
                              >
                                {pt.patientCode}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="text-slate-300">
                                {pt.wardBed}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-slate-50 mt-0.5">
                              {pt.fullName} ({pt.age}y)
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {pt.diagnosis}
                            </div>
                            <div className="text-[11px] font-mono text-slate-300 mt-1.5">
                              Rx: {pt.prescribedBagMl} mL @{' '}
                              {pt.prescribedRateMlHr} mL/hr ·{' '}
                              {pt.attendingClinician}
                            </div>
                          </button>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isSelected && (
                              <span className="text-[10px] font-mono text-[#00F5D4] font-semibold">
                                ● ACTIVE
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPatientId(pt.id);
                                  setPatientForm({
                                    patientCode: pt.patientCode,
                                    fullName: pt.fullName,
                                    age: pt.age,
                                    wardBed: pt.wardBed,
                                    diagnosis: pt.diagnosis,
                                    prescribedBagMl: pt.prescribedBagMl,
                                    prescribedRateMlHr: pt.prescribedRateMlHr,
                                    attendingClinician: pt.attendingClinician,
                                  });
                                  setShowPatientForm(true);
                                }}
                                className="text-[11px] font-mono text-slate-400 hover:text-white underline"
                              >
                                Edit
                              </button>
                              {confirmDeletePatientId === pt.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePatient(pt.id)}
                                  className="text-[11px] font-mono text-rose-400 hover:text-rose-200 underline font-semibold"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDeletePatientId(pt.id)
                                  }
                                  className="text-[11px] font-mono text-slate-500 hover:text-rose-400 underline"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right (7 cols): Live Bottle Timer + Firestore Session Records */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Live Infusion Run Timer & Logger */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div>
                    <div className="text-[11px] font-mono text-slate-400">
                      SALINE BOTTLE TIME &amp; VOLUME RECORDER
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {activePatient
                        ? `Monitoring: ${activePatient.fullName} (${activePatient.patientCode})`
                        : 'Select or add a hospital patient on the left to log runs'}
                    </h3>
                  </div>

                  <div className="text-lg font-mono font-bold text-[#00F5D4] tabular-nums">
                    {formatDurationSeconds(elapsedSeconds)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400">START %</div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                      {runStartLevel}%
                    </div>
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400">CURRENT %</div>
                    <div className="text-sm font-bold text-[#00F5D4] mt-0.5 tabular-nums">
                      {currentLevelPercent}%
                    </div>
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400">
                      CONSUMED VOLUME
                    </div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5 tabular-nums">
                      {liveConsumedMl} mL
                    </div>
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400">
                      BOTTLES NEEDED
                    </div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5 tabular-nums">
                      {liveBottleFrac.toFixed(2)} btl
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <input
                    type="text"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Optional supply or clinical note (e.g., Batch #402, smooth drip)"
                    maxLength={240}
                    className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#00F5D4]"
                  />

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!runActive ? (
                      <button
                        type="button"
                        disabled={!activePatient}
                        onClick={() => {
                          setRunStartLevel(currentLevelPercent);
                          setElapsedSeconds(0);
                          autoLoggedThisRunRef.current = false;
                          setRunActive(true);
                        }}
                        className="px-3.5 py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-xs font-mono font-semibold text-emerald-300 transition-colors whitespace-nowrap"
                      >
                        Start Bottle Run
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRunActive(false)}
                        className="px-3.5 py-2 rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-mono font-semibold text-amber-300 transition-colors whitespace-nowrap"
                      >
                        Pause Timer
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid="log-session-firebase-btn"
                      disabled={!activePatient || savingSession}
                      onClick={() => void handleLogInfusionSession()}
                      className="px-4 py-2 rounded-lg bg-[#00F5D4] hover:bg-[#00F5D4]/90 disabled:opacity-40 text-slate-950 text-xs font-mono font-semibold transition-colors whitespace-nowrap"
                    >
                      {savingSession ? 'Logging...' : 'Log Run to Firebase'}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoLogOnClamp}
                    onChange={(e) => setAutoLogOnClamp(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#00F5D4] rounded"
                  />
                  <span>
                    Automatically log saline bottle volume &amp; time taken to
                    Firestore when 10% Pinch-Clamp triggers
                  </span>
                </label>
              </div>

              {/* Logged Firestore Infusion Sessions Table */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono text-slate-400">
                      FIRESTORE TELEMETRY LEDGER ({sessions.length} SESSIONS)
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Saline Consumption &amp; Time-Taken Records
                    </h3>
                  </div>

                  <button
                    type="button"
                    disabled={sessions.length === 0}
                    onClick={handleDownloadCsv}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-mono text-slate-200 transition-colors whitespace-nowrap shrink-0"
                  >
                    Export Analytics CSV
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800/90 rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/95 text-slate-400 border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Patient</th>
                        <th className="py-2 px-3">Bottle</th>
                        <th className="py-2 px-3">Used (mL / Btl)</th>
                        <th className="py-2 px-3">Time Taken</th>
                        <th className="py-2 px-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 bg-slate-950/50">
                      {sessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-4 px-3 text-center text-slate-500"
                          >
                            No saline infusion sessions logged yet. Start a
                            bottle run or adjust the level and click &ldquo;Log
                            Run to Firebase&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        sessions.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2 px-3">
                              <div className="text-slate-100 font-semibold">
                                {s.patientCode}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {s.wardBed}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-300 tabular-nums">
                              {s.bottleCapacityMl} mL @ {s.flowRateMlPerHr}/hr
                            </td>
                            <td className="py-2 px-3 text-[#00F5D4] tabular-nums">
                              {s.volumeUsedMl} mL ({s.bottlesConsumed.toFixed(2)}{' '}
                              btl)
                            </td>
                            <td className="py-2 px-3 text-slate-200 tabular-nums">
                              {formatDurationSeconds(s.durationSeconds)}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={
                                  s.clampTriggered
                                    ? 'text-rose-400 font-semibold'
                                    : 'text-emerald-400 font-semibold'
                                }
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
