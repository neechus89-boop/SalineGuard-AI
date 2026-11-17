import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFluidStatus,
  calculateFluidPercentageFromY,
  smoothLevel,
  calculateEstimatedTimeRemaining,
  isFloatBallPixel,
  isOrangeFloatPixel,
  detectFloatBallCentroid,
  validateIpAddress,
  buildEsp32Url,
  Esp32ThrottledSender,
} from './telemetryLogic';
import {
  inspectInputForUnnecessaryData,
  getThirdPartySdkAuditManifest,
} from './complianceLogic';
import {
  validateAndSanitizePatientInput,
  buildInfusionSessionPayload,
  aggregateInvestmentMetrics,
  buildAnalyticsCsv,
  PatientRecord,
  InfusionSessionRecord,
} from './infusionAnalytics';

test('classifyFluidStatus returns NORMAL_FLOW above 50%', () => {
  const status100 = classifyFluidStatus(100);
  assert.equal(status100.code, 'NORMAL_FLOW');
  assert.equal(status100.label, 'NORMAL FLOW');
  assert.equal(status100.servoAngle, 0);
  assert.equal(status100.isClamped, false);

  const status51 = classifyFluidStatus(51);
  assert.equal(status51.code, 'NORMAL_FLOW');
});

test('classifyFluidStatus returns LOW_SALINE between 11% and 50%', () => {
  const status50 = classifyFluidStatus(50);
  assert.equal(status50.code, 'LOW_SALINE');
  assert.equal(status50.label, 'LOW SALINE');
  assert.equal(status50.servoAngle, 0);
  assert.equal(status50.isClamped, false);

  const status35 = classifyFluidStatus(35);
  assert.equal(status35.code, 'LOW_SALINE');

  const status11 = classifyFluidStatus(11);
  assert.equal(status11.code, 'LOW_SALINE');
});

test('classifyFluidStatus returns AUTO_CLAMPED at or below 10%', () => {
  const status10 = classifyFluidStatus(10);
  assert.equal(status10.code, 'AUTO_CLAMPED');
  assert.equal(status10.label, 'AUTO-CLAMPED');
  assert.equal(status10.servoAngle, 90);
  assert.equal(status10.isClamped, true);

  const status8 = classifyFluidStatus(8);
  assert.equal(status8.code, 'AUTO_CLAMPED');
  assert.equal(status8.servoAngle, 90);
});

test('calculateFluidPercentageFromY maps calibration bounds accurately', () => {
  const topY = 60;
  const bottomY = 260;

  assert.equal(calculateFluidPercentageFromY(60, topY, bottomY), 100);
  assert.equal(calculateFluidPercentageFromY(160, topY, bottomY), 50);
  assert.equal(calculateFluidPercentageFromY(260, topY, bottomY), 0);
  assert.equal(calculateFluidPercentageFromY(20, topY, bottomY), 100);
  assert.equal(calculateFluidPercentageFromY(310, topY, bottomY), 0);
});

test('smoothLevel blends readings with exponential moving average', () => {
  const next = smoothLevel(80, 40, 0.5);
  assert.equal(next, 60);
});

test('calculateEstimatedTimeRemaining computes time and macro-drip rate', () => {
  const est = calculateEstimatedTimeRemaining(60, 500, 125);
  assert.equal(est.remainingMl, 300);
  assert.equal(est.usableMlBeforeClamp, 250);
  assert.equal(est.minutesToClamp, 120);
  assert.equal(est.formattedTime, '2h 00m');
  assert.equal(est.dropsPerMinute, 42);

  const clampedEst = calculateEstimatedTimeRemaining(8, 500, 125);
  assert.equal(clampedEst.minutesToClamp, 0);
  assert.equal(clampedEst.dropsPerMinute, 0);
  assert.equal(clampedEst.formattedTime, '0h 00m (Clamped)');
});

test('isFloatBallPixel detects bright red float ball and rejects background colors', () => {
  // Bright red float ball (#FF1E2E -> R:255, G:30, B:46)
  assert.equal(isFloatBallPixel(255, 30, 46, 55, 'bright_red'), true);
  // Crimson-red shaded edge (R:220, G:20, B:30)
  assert.equal(isFloatBallPixel(220, 20, 30, 55, 'bright_red'), true);
  // Dark slate background (#0B0F19)
  assert.equal(isFloatBallPixel(11, 15, 25, 55, 'bright_red'), false);
  // Medical cyan (#00F5D4)
  assert.equal(isFloatBallPixel(0, 245, 212, 55, 'bright_red'), false);
  // Also supports orange profile
  assert.equal(isOrangeFloatPixel(255, 107, 26), true);
  // Also supports custom_rgb tap-to-calibrate profile
  assert.equal(
    isFloatBallPixel(200, 25, 60, 55, 'custom_rgb', { r: 205, g: 28, b: 58 }),
    true
  );
});

test('detectFloatBallCentroid finds centroid of synthetic bright red ball in RGBA frame', () => {
  const width = 120;
  const height = 160;
  const buffer = new Uint8ClampedArray(width * height * 4);

  const targetX = 60;
  const targetY = 95;
  const radius = 12;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dist = Math.hypot(x - targetX, y - targetY);
      if (dist <= radius) {
        // Bright red float ball
        buffer[idx] = 250;
        buffer[idx + 1] = 24;
        buffer[idx + 2] = 36;
        buffer[idx + 3] = 255;
      } else {
        buffer[idx] = 12;
        buffer[idx + 1] = 18;
        buffer[idx + 2] = 30;
        buffer[idx + 3] = 255;
      }
    }
  }

  const detection = detectFloatBallCentroid(
    buffer,
    width,
    height,
    0.08,
    0.92,
    55,
    'bright_red'
  );
  assert.equal(detection.found, true);
  assert.ok(Math.abs(detection.cx - targetX) <= 2);
  assert.ok(Math.abs(detection.cy - targetY) <= 2);
  assert.ok(detection.confidence > 50);
});

test('validateIpAddress and buildEsp32Url format ESP32 endpoint properly', () => {
  assert.equal(validateIpAddress('192.168.4.1'), true);
  assert.equal(validateIpAddress('salineguard.local'), true);
  assert.equal(validateIpAddress('999.999.999.999'), false);
  assert.equal(validateIpAddress(''), false);

  assert.equal(
    buildEsp32Url('192.168.4.1', 35.4),
    'http://192.168.4.1/set?level=35'
  );
  assert.equal(
    buildEsp32Url('http://192.168.4.1/', 8),
    'http://192.168.4.1/set?level=8'
  );
});

test('Esp32ThrottledSender throttles rapid calls to once every 150ms and delivers latest value', async () => {
  const sentLevels: number[] = [];
  const sender = new Esp32ThrottledSender((lvl) => {
    sentLevels.push(lvl);
  }, 150);

  // First call should dispatch immediately
  sender.send(100);
  assert.deepEqual(sentLevels, [100]);

  // Rapid bursts within 150ms should be throttled
  sender.send(95);
  sender.send(90);
  sender.send(85);
  // Still only 100 sent immediately
  assert.deepEqual(sentLevels, [100]);

  // Wait for 170ms for trailing throttle to fire with latest value (85)
  await new Promise((resolve) => setTimeout(resolve, 170));
  assert.deepEqual(sentLevels, [100, 85]);

  // Wait another 160ms so 150ms elapses since the execution of 85
  await new Promise((resolve) => setTimeout(resolve, 160));

  // Next call after 150ms should fire immediately
  sender.send(40);
  assert.deepEqual(sentLevels, [100, 85, 40]);

  sender.cancel();
});

test('inspectInputForUnnecessaryData blocks emails and personal names to enforce data minimization', () => {
  const validIp = inspectInputForUnnecessaryData('192.168.4.1');
  assert.equal(validIp.isSafe, true);
  assert.equal(validIp.sanitized, '192.168.4.1');
  assert.equal(validIp.violationReason, null);

  const emailAttempt = inspectInputForUnnecessaryData('patient@hospital.org');
  assert.equal(emailAttempt.isSafe, false);
  assert.ok(emailAttempt.violationReason?.includes('Data Minimization Policy'));

  const nameAttempt = inspectInputForUnnecessaryData('John Doe 192.168.4.1');
  assert.equal(nameAttempt.isSafe, false);
  assert.ok(nameAttempt.violationReason?.includes('Data Minimization Policy'));
});

test('getThirdPartySdkAuditManifest verifies audited dependencies and blocks third-party trackers', () => {
  const manifest = getThirdPartySdkAuditManifest();
  assert.ok(manifest.length >= 6);
  const firebaseEntry = manifest.find((e) =>
    e.name.includes('Firebase Auth & Cloud Firestore')
  );
  assert.ok(firebaseEntry);
  assert.equal(firebaseEntry.status, 'VERIFIED_SAFE');
  const trackerEntry = manifest.find(
    (e) => e.category === 'Third-Party Tracker'
  );
  assert.ok(trackerEntry);
  assert.equal(trackerEntry.status, 'BLOCKED');
});

test('validateAndSanitizePatientInput enforces hospital patient bounds and rejects invalid values', () => {
  const ok = validateAndSanitizePatientInput({
    patientCode: 'ICU-B04-101',
    fullName: 'Arjun Nair',
    age: 58,
    wardBed: 'ICU Ward A · Bed 04',
    diagnosis: 'Post-Op Fluid Resuscitation',
    prescribedBagMl: 500,
    prescribedRateMlHr: 125,
    attendingClinician: 'Dr. Meera Iyer',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.errors.length, 0);

  const bad = validateAndSanitizePatientInput({
    patientCode: '!',
    fullName: 'A',
    age: 200,
    wardBed: 'X',
    diagnosis: 'Y',
    prescribedBagMl: 500,
    prescribedRateMlHr: 125,
    attendingClinician: 'Z',
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 4);
});

test('buildInfusionSessionPayload and aggregateInvestmentMetrics calculate saline bottle usage and time taken', () => {
  const sessionPayload = buildInfusionSessionPayload({
    patientId: 'pt-icu-1',
    patientCode: 'ICU-B04-101',
    wardBed: 'ICU Ward A · Bed 04',
    bottleCapacityMl: 500,
    flowRateMlPerHr: 125,
    startLevelPercent: 100,
    endLevelPercent: 10,
    durationSeconds: 12960,
    clampTriggered: true,
    status: 'CLAMPED_AUTO',
    notes: 'Auto-clamped cleanly at 10%',
  });

  assert.equal(sessionPayload.volumeUsedMl, 450);
  assert.equal(sessionPayload.bottlesConsumed, 0.9);
  assert.equal(sessionPayload.durationSeconds, 12960);
  assert.equal(sessionPayload.clampTriggered, true);

  const patients: PatientRecord[] = [
    {
      id: 'pt-icu-1',
      patientCode: 'ICU-B04-101',
      fullName: 'Arjun Nair',
      age: 58,
      wardBed: 'ICU Ward A · Bed 04',
      diagnosis: 'Post-Op Hydration',
      prescribedBagMl: 500,
      prescribedRateMlHr: 125,
      attendingClinician: 'Dr. Meera Iyer',
      ownerId: 'uid-1',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
  ];

  const sessions: InfusionSessionRecord[] = [
    {
      ...sessionPayload,
      id: 'sess-1',
      ownerId: 'uid-1',
      createdAtMs: 2000,
    },
  ];

  const summary = aggregateInvestmentMetrics(sessions, patients);
  assert.equal(summary.totalPatients, 1);
  assert.equal(summary.totalSessions, 1);
  assert.equal(summary.totalVolumeInfusedMl, 450);
  assert.equal(summary.totalBottlesConsumed, 0.9);
  assert.equal(summary.autoClampEventsCount, 1);
  assert.ok(summary.projectedMonthlyBottlesAllBeds > 0);

  const csv = buildAnalyticsCsv(sessions, patients);
  assert.ok(csv.includes('ICU-B04-101'));
  assert.ok(csv.includes('450'));
  assert.ok(csv.includes('12960'));
});

