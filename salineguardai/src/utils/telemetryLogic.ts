export type FluidStatusCode = 'NORMAL_FLOW' | 'LOW_SALINE' | 'AUTO_CLAMPED';

export type FloatBallColorProfile = 'bright_red' | 'orange' | 'custom_rgb';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface FluidStatusInfo {
  code: FluidStatusCode;
  label: string;
  glyph: string;
  clinicalSummary: string;
  servoAngle: 0 | 90;
  servoStateText: string;
  isClamped: boolean;
  accentHex: string;
  secondaryHex: string;
}

export interface DetectedBall {
  found: boolean;
  cx: number;
  cy: number;
  radius: number;
  pixelCount: number;
  confidence: number;
}

/**
 * Classifies the IV fluid percentage into one of the three ICU telemetry states:
 * - > 50%: NORMAL FLOW (Servo Open 0°)
 * - 11% - 50%: LOW SALINE (Servo Open 0°)
 * - <= 10%: AUTO-CLAMPED (Servo Locked 90°)
 */
export function classifyFluidStatus(levelPercent: number): FluidStatusInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(levelPercent)));

  if (clamped <= 10) {
    return {
      code: 'AUTO_CLAMPED',
      label: 'AUTO-CLAMPED',
      glyph: '✖',
      clinicalSummary:
        'Critical threshold reached (≤10%). Emergency mechanical pinch-clamp engaged to prevent air embolism.',
      servoAngle: 90,
      servoStateText: 'Locked (90°)',
      isClamped: true,
      accentHex: '#F43F5E',
      secondaryHex: '#FB7185',
    };
  }

  if (clamped <= 50) {
    return {
      code: 'LOW_SALINE',
      label: 'LOW SALINE',
      glyph: '▲',
      clinicalSummary:
        'Saline reservoir depleted below 50%. Prepare replacement IV bag; line remains open.',
      servoAngle: 0,
      servoStateText: 'Open (0°)',
      isClamped: false,
      accentHex: '#F59E0B',
      secondaryHex: '#FBBF24',
    };
  }

  return {
    code: 'NORMAL_FLOW',
    label: 'NORMAL FLOW',
    glyph: '●',
    clinicalSummary:
      'Nominal gravity infusion flow. Optical meniscus tracker locked on bright red float indicator.',
    servoAngle: 0,
    servoStateText: 'Open (0°)',
    isClamped: false,
    accentHex: '#10B981',
    secondaryHex: '#00F5D4',
  };
}

/**
 * Calculates fluid percentage (0-100) from the Y coordinate of the tracked float ball
 * relative to the top (100%) and bottom (0%) calibration lines.
 * Note: In canvas coordinates, Y=0 is at the top, so topCalibrationY < bottomCalibrationY.
 */
export function calculateFluidPercentageFromY(
  ballY: number,
  topCalibrationY: number,
  bottomCalibrationY: number
): number {
  const span = bottomCalibrationY - topCalibrationY;
  if (span <= 1) {
    return 0;
  }
  const rawRatio = (bottomCalibrationY - ballY) / span;
  const percentage = rawRatio * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

/**
 * Exponential moving average (EMA) filter to smooth optical level readings
 * before transmitting to the ESP32 servo node.
 */
export function smoothLevel(
  previousLevel: number,
  targetLevel: number,
  alpha = 0.28
): number {
  const safeAlpha = Math.max(0.01, Math.min(1, alpha));
  const blended = previousLevel + safeAlpha * (targetLevel - previousLevel);
  return Math.max(0, Math.min(100, Math.round(blended * 10) / 10));
}

/**
 * Calculates the estimated time to empty (or time until auto-clamp at 10%)
 * given current fluid percentage, bottle capacity (mL), and flow rate (mL/hr).
 */
export function calculateEstimatedTimeRemaining(
  levelPercent: number,
  bottleCapacityMl = 500,
  flowRateMlPerHr = 125
): {
  remainingMl: number;
  usableMlBeforeClamp: number;
  minutesToClamp: number;
  formattedTime: string;
  dropsPerMinute: number;
} {
  const safeLevel = Math.max(0, Math.min(100, levelPercent));
  const remainingMl = Math.round((safeLevel / 100) * bottleCapacityMl);
  // Standard macro-drip IV set = 20 drops/mL
  const dropsPerMinute =
    safeLevel <= 10 ? 0 : Math.round((flowRateMlPerHr * 20) / 60);

  if (safeLevel <= 10 || flowRateMlPerHr <= 0) {
    return {
      remainingMl,
      usableMlBeforeClamp: 0,
      minutesToClamp: 0,
      formattedTime: '0h 00m (Clamped)',
      dropsPerMinute: 0,
    };
  }

  const usablePercent = safeLevel - 10;
  const usableMlBeforeClamp = Math.round(
    (usablePercent / 100) * bottleCapacityMl
  );
  const hoursRemaining = usableMlBeforeClamp / flowRateMlPerHr;
  const totalMinutes = Math.max(1, Math.round(hoursRemaining * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    remainingMl,
    usableMlBeforeClamp,
    minutesToClamp: totalMinutes,
    formattedTime: `${hours}h ${String(minutes).padStart(2, '0')}m`,
    dropsPerMinute,
  };
}

/**
 * Evaluates if an RGB pixel belongs to the 3D-printed float ball.
 * Supports:
 * - 'bright_red' (Default): High-visibility bright red / crimson float ball (wraps Hue 342°-360° & 0°-16°)
 * - 'orange': High-visibility orange float ball (Hue 10°-38°)
 * - 'custom_rgb': User-sampled RGB target from clicking directly on the camera feed
 */
export function isFloatBallPixel(
  r: number,
  g: number,
  b: number,
  sensitivity = 55,
  profile: FloatBallColorProfile = 'bright_red',
  customTarget?: RgbColor
): boolean {
  const tolerance = ((sensitivity - 50) / 50) * 14; // -14 to +14

  if (profile === 'custom_rgb' && customTarget) {
    const dist = Math.hypot(
      r - customTarget.r,
      g - customTarget.g,
      b - customTarget.b
    );
    const maxDist = Math.max(24, 52 + tolerance * 1.4);
    return dist <= maxDist;
  }

  // Convert RGB to HSV
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  if (delta === 0) return false;

  let hue = 0;
  if (max === rNorm) {
    hue = ((gNorm - bNorm) / delta) % 6;
  } else if (max === gNorm) {
    hue = (bNorm - rNorm) / delta + 2;
  } else {
    hue = (rNorm - gNorm) / delta + 4;
  }
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : (delta / max) * 100;
  const value = max * 100;

  if (profile === 'bright_red') {
    // Bright Red dominance check: strong red channel, distinctly higher than green and blue
    const minRed = Math.max(125, 155 - tolerance * 1.5);
    if (r < minRed || g > 115 + tolerance || b > 115 + tolerance) {
      return false;
    }
    if (r - g < Math.max(45, 75 - tolerance) || r - b < Math.max(45, 75 - tolerance)) {
      return false;
    }
    const redHueRange =
      hue <= Math.min(24, 16 + tolerance * 0.5) ||
      hue >= Math.max(330, 342 - tolerance * 0.5);
    const minSat = Math.max(42, 58 - tolerance);
    const minVal = Math.max(45, 58 - tolerance);
    return redHueRange && saturation >= minSat && value >= minVal;
  }

  // Profile === 'orange'
  if (r < 145 || g < 40 || g > 215 || b > 125) {
    return false;
  }
  if (r - b < 70 || r <= g) {
    return false;
  }
  const minHue = Math.max(4, 10 - tolerance * 0.6);
  const maxHue = Math.min(48, 36 + tolerance * 0.6);
  const minSat = Math.max(38, 55 - tolerance);
  const minVal = Math.max(45, 58 - tolerance);

  return hue >= minHue && hue <= maxHue && saturation >= minSat && value >= minVal;
}

// Keep backward-compatible alias for orange pixel test
export function isOrangeFloatPixel(
  r: number,
  g: number,
  b: number,
  sensitivity = 50
): boolean {
  return isFloatBallPixel(r, g, b, sensitivity, 'orange');
}

/**
 * Scans an RGBA pixel buffer (from canvas getImageData) within the vertical ROI
 * and returns the centroid and radius of the tracked float ball (Bright Red by default).
 */
export function detectFloatBallCentroid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiTopRatio = 0.08,
  roiBottomRatio = 0.92,
  sensitivity = 55,
  profile: FloatBallColorProfile = 'bright_red',
  customTarget?: RgbColor
): DetectedBall {
  const startY = Math.max(0, Math.floor(height * roiTopRatio));
  const endY = Math.min(height - 1, Math.ceil(height * roiBottomRatio));
  const startX = Math.max(0, Math.floor(width * 0.15));
  const endX = Math.min(width - 1, Math.ceil(width * 0.85));

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  // Step by 2 pixels for fast 30fps performance while retaining high spatial accuracy
  const step = 2;
  for (let y = startY; y <= endY; y += step) {
    const rowOffset = y * width * 4;
    for (let x = startX; x <= endX; x += step) {
      const idx = rowOffset + x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (isFloatBallPixel(r, g, b, sensitivity, profile, customTarget)) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  const minCluster = 10;
  if (count < minCluster) {
    return {
      found: false,
      cx: width / 2,
      cy: height / 2,
      radius: 0,
      pixelCount: count * step * step,
      confidence: 0,
    };
  }

  const cx = sumX / count;
  const cy = sumY / count;
  const fullPixelEstimate = count * step * step;
  const estimatedRadius = Math.max(
    10,
    Math.min(48, Math.sqrt(fullPixelEstimate / Math.PI))
  );
  const confidence = Math.min(
    99.8,
    Math.round(Math.min(1, count / 90) * 100 * 10) / 10
  );

  return {
    found: true,
    cx,
    cy,
    radius: estimatedRadius,
    pixelCount: fullPixelEstimate,
    confidence,
  };
}

export function detectOrangeBallCentroid(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roiTopRatio = 0.08,
  roiBottomRatio = 0.92,
  sensitivity = 50
): DetectedBall {
  return detectFloatBallCentroid(
    data,
    width,
    height,
    roiTopRatio,
    roiBottomRatio,
    sensitivity,
    'orange'
  );
}

/**
 * Validates an IPv4 address or local hostname for the ESP32 bedside node.
 */
export function validateIpAddress(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return false;
  const ipv4Regex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(:\d{1,5})?$/;
  const localHostRegex = /^[a-zA-Z0-9-]+(\.local)?(:\d{1,5})?$/;
  return ipv4Regex.test(trimmed) || localHostRegex.test(trimmed);
}

/**
 * Builds the exact HTTP GET endpoint URL for the ESP32 servo clamp controller.
 */
export function buildEsp32Url(ipAddress: string, levelPercent: number): string {
  const cleanHost = ipAddress
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const clampedLevel = Math.max(0, Math.min(100, Math.round(levelPercent)));
  return `http://${cleanHost}/set?level=${clampedLevel}`;
}

/**
 * Throttles sending level updates to the ESP32 to once every 150ms
 * so rapid updates from camera optical tracking (30 FPS) or slider dragging
 * never flood or crash the ESP32 web server.
 */
export class Esp32ThrottledSender {
  private throttleMs: number;
  private lastSendTime: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingLevel: number | null = null;
  private sendFn: (level: number) => void;

  constructor(sendFn: (level: number) => void, throttleMs = 150) {
    this.sendFn = sendFn;
    this.throttleMs = throttleMs;
  }

  public updateSendFn(sendFn: (level: number) => void): void {
    this.sendFn = sendFn;
  }

  public send(level: number): void {
    const rounded = Math.round(level);
    this.pendingLevel = rounded;

    const now = Date.now();
    const elapsed = now - this.lastSendTime;

    if (elapsed >= this.throttleMs) {
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.execute(rounded);
    } else if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.pendingLevel !== null) {
          this.execute(this.pendingLevel);
        }
      }, this.throttleMs - elapsed);
    }
  }

  private execute(level: number): void {
    this.lastSendTime = Date.now();
    this.pendingLevel = null;
    this.sendFn(level);
  }

  public flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pendingLevel !== null) {
      this.execute(this.pendingLevel);
    }
  }

  public cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingLevel = null;
  }
}

