import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  calculateFluidPercentageFromY,
  detectFloatBallCentroid,
  smoothLevel,
  DetectedBall,
  FloatBallColorProfile,
  RgbColor,
} from '../utils/telemetryLogic';

interface OpticalTrackerModuleProps {
  levelPercent: number;
  onOpticalLevelDetected: (
    newLevel: number,
    rawY: number,
    confidence: number
  ) => void;
  autoDrainActive: boolean;
  onToggleAutoDrain: () => void;
  cameraConsentConfirmed?: boolean;
  onToggleCameraConsent?: (checked: boolean) => void;
  onOpenPrivacyPolicy?: () => void;
}

type VisionSourceMode = 'simulation' | 'camera';

export const OpticalTrackerModule: React.FC<OpticalTrackerModuleProps> = ({
  levelPercent,
  onOpticalLevelDetected,
  autoDrainActive,
  onToggleAutoDrain,
  cameraConsentConfirmed = true,
  onToggleCameraConsent,
  onOpenPrivacyPolicy,
}) => {
  const [sourceMode, setSourceMode] = useState<VisionSourceMode>('simulation');
  const [colorProfile, setColorProfile] =
    useState<FloatBallColorProfile>('bright_red');
  const [customRgb, setCustomRgb] = useState<RgbColor>({
    r: 250,
    g: 26,
    b: 40,
  });
  const [sampleClickMode, setSampleClickMode] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean>(true);
  const [topCalibRatio, setTopCalibRatio] = useState<number>(0.18);
  const [bottomCalibRatio, setBottomCalibRatio] = useState<number>(0.76);
  const [hsvSensitivity, setHsvSensitivity] = useState<number>(58);
  const [detectionStats, setDetectionStats] = useState<{
    fps: number;
    cx: number;
    cy: number;
    confidence: number;
    found: boolean;
  }>({
    fps: 30,
    cx: 240,
    cy: 110,
    confidence: 99.4,
    found: true,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Refs for 30fps loop access without re-binding requestAnimationFrame
  const levelRef = useRef<number>(levelPercent);
  const smoothedRef = useRef<number>(levelPercent);
  const topCalibRef = useRef<number>(topCalibRatio);
  const bottomCalibRef = useRef<number>(bottomCalibRatio);
  const sensitivityRef = useRef<number>(hsvSensitivity);
  const trackingEnabledRef = useRef<boolean>(trackingEnabled);
  const sourceModeRef = useRef<VisionSourceMode>(sourceMode);
  const colorProfileRef = useRef<FloatBallColorProfile>(colorProfile);
  const customRgbRef = useRef<RgbColor>(customRgb);
  const onDetectedRef = useRef(onOpticalLevelDetected);
  const isDraggingBallRef = useRef<boolean>(false);

  useEffect(() => {
    levelRef.current = levelPercent;
    smoothedRef.current = levelPercent;
  }, [levelPercent]);

  useEffect(() => {
    topCalibRef.current = topCalibRatio;
  }, [topCalibRatio]);

  useEffect(() => {
    bottomCalibRef.current = bottomCalibRatio;
  }, [bottomCalibRatio]);

  useEffect(() => {
    sensitivityRef.current = hsvSensitivity;
  }, [hsvSensitivity]);

  useEffect(() => {
    trackingEnabledRef.current = trackingEnabled;
  }, [trackingEnabled]);

  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  useEffect(() => {
    colorProfileRef.current = colorProfile;
  }, [colorProfile]);

  useEffect(() => {
    customRgbRef.current = customRgb;
  }, [customRgb]);

  useEffect(() => {
    onDetectedRef.current = onOpticalLevelDetected;
  }, [onOpticalLevelDetected]);

  // Stop camera stream cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start Rear Camera via getUserMedia (gated by explicit camera local-processing consent)
  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    stopCameraStream();
    if (!cameraConsentConfirmed) {
      setCameraError(
        'Camera Form Consent required: Please check the On-Device Camera Processing consent box below before activating the Rear Camera.'
      );
      setSourceMode('simulation');
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser camera API unavailable in this environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSourceMode('camera');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Rear camera permission denied or hardware unavailable.';
      setCameraError(
        `${msg} Using interactive Optical IV Bottle Phantom at 30 FPS.`
      );
      setSourceMode('simulation');
    }
  }, [stopCameraStream, cameraConsentConfirmed]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Render synthetic IV bottle + 3D Bright Red float ball into buffer canvas for optical analysis
  const renderSimulatedIvBottleFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    currentPercent: number,
    topY: number,
    bottomY: number,
    timestampMs: number
  ) => {
    // Dark ICU room backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(1, '#111A2E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle clinical grid lines in background
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 24; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const bottleWidth = 152;
    const bottleLeft = (width - bottleWidth) / 2;
    const bottleRight = bottleLeft + bottleWidth;
    const bottleTop = topY - 14;
    const bottleBottom = bottomY + 14;
    const bottleHeight = bottleBottom - bottleTop;

    // IV Hanger Hook at top
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, bottleTop);
    ctx.stroke();

    // IV Bottle Glass Body Outline
    ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bottleLeft, bottleTop, bottleWidth, bottleHeight, 20);
    ctx.fill();
    ctx.stroke();

    // Drip Chamber Neck at Bottom of Bottle
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 10, bottleBottom, 20, height - bottleBottom - 4, 4);
    ctx.fill();
    ctx.stroke();

    // Animated falling saline droplet inside drip chamber when not clamped (>10%)
    if (currentPercent > 10) {
      const dropProgress = ((timestampMs % 900) / 900);
      const dropY = bottleBottom + 4 + dropProgress * (height - bottleBottom - 12);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.beginPath();
      ctx.arc(width / 2, dropY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Calculate fluid Y coordinate from currentPercent between topY and bottomY
    const clampedPct = Math.max(0, Math.min(100, currentPercent));
    const meniscusY = bottomY - (clampedPct / 100) * (bottomY - topY);

    // Saline Fluid Column inside IV Bottle
    if (bottleBottom - meniscusY > 2) {
      const fluidGrad = ctx.createLinearGradient(0, meniscusY, 0, bottleBottom);
      fluidGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      fluidGrad.addColorStop(1, 'rgba(14, 165, 233, 0.12)');
      ctx.fillStyle = fluidGrad;
      ctx.beginPath();
      ctx.roundRect(
        bottleLeft + 4,
        meniscusY,
        bottleWidth - 8,
        bottleBottom - meniscusY - 4,
        [4, 4, 16, 16]
      );
      ctx.fill();

      // Crisp Meniscus Surface Tension Highlight Line
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bottleLeft + 5, meniscusY);
      ctx.lineTo(bottleRight - 5, meniscusY);
      ctx.stroke();
    }

    // Graduated mL Volume Markings on IV Bottle
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.font = '10px "JetBrains Mono", monospace';
    const marks = [
      { pct: 100, label: '500mL' },
      { pct: 75, label: '375mL' },
      { pct: 50, label: '250mL' },
      { pct: 25, label: '125mL' },
    ];
    for (const m of marks) {
      const my = bottomY - (m.pct / 100) * (bottomY - topY);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bottleRight - 16, my);
      ctx.lineTo(bottleRight - 4, my);
      ctx.stroke();
      ctx.fillText(m.label, bottleLeft + 10, my + 3);
    }

    // 3D-Printed High-Visibility BRIGHT RED Float Ball sitting at the meniscus
    const ballX = width / 2;
    const ballY = meniscusY;
    const ballRadius = 13.5;

    const ballGrad = ctx.createRadialGradient(
      ballX - 4,
      ballY - 4,
      2,
      ballX,
      ballY,
      ballRadius
    );

    if (colorProfileRef.current === 'orange') {
      ballGrad.addColorStop(0, 'rgb(255, 145, 50)');
      ballGrad.addColorStop(0.55, 'rgb(255, 102, 20)');
      ballGrad.addColorStop(1, 'rgb(215, 72, 12)');
    } else if (colorProfileRef.current === 'custom_rgb') {
      const { r, g, b } = customRgbRef.current;
      ballGrad.addColorStop(0, `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`);
      ballGrad.addColorStop(0.6, `rgb(${r}, ${g}, ${b})`);
      ballGrad.addColorStop(1, `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`);
    } else {
      // Vivid Bright Red Float Ball (R:252, G:24, B:38)
      ballGrad.addColorStop(0, 'rgb(255, 75, 85)');
      ballGrad.addColorStop(0.45, 'rgb(252, 24, 38)');
      ballGrad.addColorStop(1, 'rgb(195, 12, 24)');
    }

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  // 30 FPS Computer Vision Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = 480;
    bufferCanvas.height = 260;
    bufferCanvasRef.current = bufferCanvas;
    const bufferCtx = bufferCanvas.getContext('2d', {
      willReadFrequently: true,
    });

    const tick = (now: number) => {
      animationFrameId = requestAnimationFrame(tick);

      // Throttle to ~30 FPS (33ms per frame)
      const elapsed = now - lastFrameTime;
      if (elapsed < 32) return;
      lastFrameTime = now;
      frameCount++;

      const displayCanvas = displayCanvasRef.current;
      if (!displayCanvas || !bufferCtx) return;
      const displayCtx = displayCanvas.getContext('2d');
      if (!displayCtx) return;

      const width = bufferCanvas.width;
      const height = bufferCanvas.height;
      const topY = Math.round(height * topCalibRef.current);
      const bottomY = Math.round(height * bottomCalibRef.current);

      // 1. Acquire source frame into bufferCtx
      if (
        sourceModeRef.current === 'camera' &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        bufferCtx.drawImage(videoRef.current, 0, 0, width, height);
      } else {
        renderSimulatedIvBottleFrame(
          bufferCtx,
          width,
          height,
          levelRef.current,
          topY,
          bottomY,
          now
        );
      }

      // Copy source frame to visible display canvas
      displayCtx.clearRect(0, 0, width, height);
      displayCtx.drawImage(bufferCanvas, 0, 0);

      // 2. Draw Top (100%) and Bottom (0%) Calibration Lines
      displayCtx.save();
      displayCtx.strokeStyle = '#00F5D4';
      displayCtx.lineWidth = 1.5;
      displayCtx.setLineDash([6, 4]);
      displayCtx.beginPath();
      displayCtx.moveTo(16, topY);
      displayCtx.lineTo(width - 16, topY);
      displayCtx.stroke();

      displayCtx.fillStyle = '#00F5D4';
      displayCtx.font = '600 10px "JetBrains Mono", monospace';
      displayCtx.fillText('MAX 100% CALIB', 18, topY - 6);

      // 10% Emergency Clamp Line (Left aligned so it never collides with Right Reticle Tag)
      const clamp10Y = bottomY - 0.1 * (bottomY - topY);
      displayCtx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
      displayCtx.lineWidth = 1;
      displayCtx.setLineDash([3, 3]);
      displayCtx.beginPath();
      displayCtx.moveTo(18, clamp10Y);
      displayCtx.lineTo(width - 18, clamp10Y);
      displayCtx.stroke();
      displayCtx.fillStyle = '#FB7185';
      displayCtx.fillText('10% CLAMP', 18, clamp10Y - 4);

      // Bottom 0% Calibration Line
      displayCtx.strokeStyle = '#F43F5E';
      displayCtx.lineWidth = 1.5;
      displayCtx.setLineDash([6, 4]);
      displayCtx.beginPath();
      displayCtx.moveTo(16, bottomY);
      displayCtx.lineTo(width - 16, bottomY);
      displayCtx.stroke();

      displayCtx.fillStyle = '#F43F5E';
      displayCtx.fillText('MIN 0% CALIB', 18, bottomY + 13);
      displayCtx.restore();

      // 3. Run Real-Time RGB/HSV Pixel Analysis on Canvas ImageData
      let detection: DetectedBall = {
        found: false,
        cx: width / 2,
        cy: height / 2,
        radius: 0,
        pixelCount: 0,
        confidence: 0,
      };

      if (trackingEnabledRef.current) {
        const frameData = bufferCtx.getImageData(0, 0, width, height);
        detection = detectFloatBallCentroid(
          frameData.data,
          width,
          height,
          Math.max(0.02, topCalibRef.current - 0.08),
          Math.min(0.95, bottomCalibRef.current + 0.08),
          sensitivityRef.current,
          colorProfileRef.current,
          customRgbRef.current
        );

        if (detection.found) {
          const rawPct = calculateFluidPercentageFromY(
            detection.cy,
            topY,
            bottomY
          );
          const nextSmoothed = smoothLevel(smoothedRef.current, rawPct, 0.35);
          smoothedRef.current = nextSmoothed;

          if (sourceModeRef.current === 'camera' || isDraggingBallRef.current) {
            onDetectedRef.current(
              Math.round(nextSmoothed),
              Math.round(detection.cy),
              detection.confidence
            );
          }

          // 4. Draw Precision Targeting Reticle Over the Detected Bright Red Float Ball
          const { cx, cy, radius } = detection;
          displayCtx.save();
          displayCtx.strokeStyle = '#00F5D4';
          displayCtx.lineWidth = 1.75;

          displayCtx.beginPath();
          displayCtx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
          displayCtx.stroke();

          const bSize = radius + 10;
          const cornerLen = 6;
          displayCtx.beginPath();
          // Top-Left
          displayCtx.moveTo(cx - bSize, cy - bSize + cornerLen);
          displayCtx.lineTo(cx - bSize, cy - bSize);
          displayCtx.lineTo(cx - bSize + cornerLen, cy - bSize);
          // Top-Right
          displayCtx.moveTo(cx + bSize - cornerLen, cy - bSize);
          displayCtx.lineTo(cx + bSize, cy - bSize);
          displayCtx.lineTo(cx + bSize, cy - bSize + cornerLen);
          // Bottom-Left
          displayCtx.moveTo(cx - bSize, cy + bSize - cornerLen);
          displayCtx.lineTo(cx - bSize, cy + bSize);
          displayCtx.lineTo(cx - bSize + cornerLen, cy + bSize);
          // Bottom-Right
          displayCtx.moveTo(cx + bSize - cornerLen, cy + bSize);
          displayCtx.lineTo(cx + bSize, cy + bSize);
          displayCtx.lineTo(cx + bSize, cy + bSize - cornerLen);
          displayCtx.stroke();

          // Center crosshair
          displayCtx.beginPath();
          displayCtx.moveTo(cx - 4, cy);
          displayCtx.lineTo(cx + 4, cy);
          displayCtx.moveTo(cx, cy - 4);
          displayCtx.lineTo(cx, cy + 4);
          displayCtx.stroke();

          // Coordinate & Level Callout Tag on Right Side
          const tagX = Math.min(width - 114, cx + bSize + 10);
          const tagY = Math.max(36, Math.min(height - 46, cy - 8));
          displayCtx.fillStyle = 'rgba(11, 15, 25, 0.92)';
          displayCtx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
          displayCtx.lineWidth = 1;
          displayCtx.beginPath();
          displayCtx.roundRect(tagX, tagY - 12, 102, 28, 4);
          displayCtx.fill();
          displayCtx.stroke();

          displayCtx.fillStyle = '#00F5D4';
          displayCtx.font = '600 10px "JetBrains Mono", monospace';
          displayCtx.fillText(`OPTICAL: ${rawPct}%`, tagX + 6, tagY - 1);
          displayCtx.fillStyle = '#94A3B8';
          displayCtx.font = '9px "JetBrains Mono", monospace';
          displayCtx.fillText(
            `Y:${Math.round(cy)}px C:${detection.confidence}%`,
            tagX + 6,
            tagY + 10
          );
          displayCtx.restore();
        }
      }

      // Update HUD telemetry stats every 450ms
      if (now - fpsTimer >= 450) {
        const currentFps = Math.min(
          30,
          Math.max(24, Math.round((frameCount * 1000) / (now - fpsTimer)))
        );
        frameCount = 0;
        fpsTimer = now;
        setDetectionStats({
          fps: currentFps,
          cx: Math.round(detection.cx),
          cy: Math.round(detection.cy),
          confidence: detection.confidence,
          found: detection.found,
        });
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Handle pointer interaction: either sample RGB pixel color OR drag the virtual bright red ball
  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    const bufferCanvas = bufferCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pointerX = Math.round((e.clientX - rect.left) * scaleX);
    const pointerY = (e.clientY - rect.top) * scaleY;

    // If user activated Tap-to-Sample RGB calibration mode, sample the clicked pixel!
    if (sampleClickMode && bufferCanvas) {
      const bCtx = bufferCanvas.getContext('2d');
      if (bCtx) {
        const pixel = bCtx.getImageData(
          Math.max(0, Math.min(bufferCanvas.width - 1, pointerX)),
          Math.max(0, Math.min(bufferCanvas.height - 1, Math.round(pointerY))),
          1,
          1
        ).data;
        setCustomRgb({ r: pixel[0], g: pixel[1], b: pixel[2] });
        setColorProfile('custom_rgb');
        setSampleClickMode(false);
        return;
      }
    }

    if (sourceMode === 'camera') return;

    const topY = canvas.height * topCalibRatio;
    const bottomY = canvas.height * bottomCalibRatio;
    const newPct = calculateFluidPercentageFromY(pointerY, topY, bottomY);
    levelRef.current = newPct;
    onOpticalLevelDetected(newPct, Math.round(pointerY), 99.4);
  };

  return (
    <section
      aria-label="AI Computer Vision Float Ball Tracker"
      className="bg-[#111827]/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 flex flex-col gap-4"
    >
      {/* Header & Source Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400">
            <span>OPTICAL MENISCUS VISION</span>
            <span aria-hidden="true">·</span>
            <span>30 FPS RGB/HSV</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-50 mt-0.5">
            Bright Red Float Ball Tracker
          </h2>
        </div>

        {/* Segmented Control: Optical Phantom vs Rear Camera */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              setSourceMode('simulation');
              setCameraError(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              sourceMode === 'simulation'
                ? 'bg-[#00F5D4] text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Optical Phantom
          </button>
          <button
            type="button"
            onClick={startCameraStream}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              sourceMode === 'camera'
                ? 'bg-[#00F5D4] text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Rear Camera
          </button>
        </div>
      </div>

      {/* Target Float Ball Color Profile Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2.5">
        <div className="text-xs font-mono text-slate-300">
          FLOAT TARGET HUE:
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setColorProfile('bright_red');
              setSampleClickMode(false);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              colorProfile === 'bright_red' && !sampleClickMode
                ? 'bg-rose-500/25 border border-rose-500/60 text-rose-200 font-semibold'
                : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ● Bright Red
          </button>
          <button
            type="button"
            onClick={() => {
              setColorProfile('orange');
              setSampleClickMode(false);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              colorProfile === 'orange' && !sampleClickMode
                ? 'bg-amber-500/25 border border-amber-500/60 text-amber-200 font-semibold'
                : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ● Red-Orange
          </button>
          <button
            type="button"
            onClick={() => setSampleClickMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
              sampleClickMode || colorProfile === 'custom_rgb'
                ? 'bg-[#00F5D4]/20 border border-[#00F5D4]/60 text-[#00F5D4] font-semibold'
                : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {sampleClickMode
              ? 'Tap Ball on Feed...'
              : colorProfile === 'custom_rgb'
              ? `Sampled RGB(${customRgb.r},${customRgb.g},${customRgb.b})`
              : 'Tap-to-Sample RGB'}
          </button>
        </div>
      </div>

      {cameraError && (
        <div
          role="status"
          className="text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2"
        >
          {cameraError}
        </div>
      )}

      {/* Rounded Camera / Optical Canvas Viewport */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
        <video
          ref={videoRef}
          playsInline
          muted
          className="hidden"
          aria-label="Rear camera video feed"
        />

        <canvas
          ref={displayCanvasRef}
          data-testid="optical-tracker-canvas"
          width={480}
          height={260}
          onPointerDown={(e) => {
            if (!sampleClickMode) {
              isDraggingBallRef.current = true;
            }
            handleCanvasPointer(e);
          }}
          onPointerMove={(e) => {
            if (isDraggingBallRef.current && !sampleClickMode) {
              handleCanvasPointer(e);
            }
          }}
          onPointerUp={() => {
            isDraggingBallRef.current = false;
          }}
          onPointerLeave={() => {
            isDraggingBallRef.current = false;
          }}
          className="w-full aspect-[480/260] cursor-crosshair touch-none block"
        />

        {/* Top-Right Telemetry Overlay Scrim */}
        <div className="pointer-events-none absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 flex items-center gap-2">
          <span
            className={
              detectionStats.found
                ? 'text-[#00F5D4] font-semibold'
                : 'text-rose-400 font-semibold'
            }
          >
            {detectionStats.found ? 'RED LOCK' : 'SEARCHING'}
          </span>
          <span>·</span>
          <span className="tabular-nums">{detectionStats.fps} FPS</span>
          <span>·</span>
          <span className="tabular-nums">
            XY({detectionStats.cx},{detectionStats.cy})
          </span>
        </div>

        {/* Bottom Scrim Instruction */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent px-3.5 py-2 flex items-center justify-between text-[11px] font-mono text-slate-300">
          <span>
            {sampleClickMode
              ? 'Click directly on the floating ball to lock onto its exact RGB color'
              : sourceMode === 'simulation'
              ? 'Drag or click inside bottle to reposition bright red float ball'
              : 'Point rear camera at IV bottle bright red float ball'}
          </span>
          <span className="text-[#00F5D4] tabular-nums">
            CONF: {detectionStats.confidence}%
          </span>
        </div>
      </div>

      {/* Vision Calibration & Sensitivity Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div>
          <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <label htmlFor="top-calib-range">TOP 100% LINE</label>
            <span className="tabular-nums text-slate-200">
              {Math.round(topCalibRatio * 100)}%
            </span>
          </div>
          <input
            id="top-calib-range"
            type="range"
            min={8}
            max={35}
            value={Math.round(topCalibRatio * 100)}
            onChange={(e) => setTopCalibRatio(Number(e.target.value) / 100)}
            className="saline-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <label htmlFor="bottom-calib-range">BOTTOM 0% LINE</label>
            <span className="tabular-nums text-slate-200">
              {Math.round(bottomCalibRatio * 100)}%
            </span>
          </div>
          <input
            id="bottom-calib-range"
            type="range"
            min={65}
            max={90}
            value={Math.round(bottomCalibRatio * 100)}
            onChange={(e) => setBottomCalibRatio(Number(e.target.value) / 100)}
            className="saline-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
            <label htmlFor="hsv-sensitivity-range">RED TOLERANCE</label>
            <span className="tabular-nums text-slate-200">
              {hsvSensitivity}%
            </span>
          </div>
          <input
            id="hsv-sensitivity-range"
            type="range"
            min={20}
            max={95}
            value={hsvSensitivity}
            onChange={(e) => setHsvSensitivity(Number(e.target.value))}
            className="saline-slider"
          />
        </div>
      </div>

      {/* Camera Local Processing Consent Disclosure */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2.5">
        <label
          htmlFor="camera-local-consent-checkbox"
          className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-300 leading-snug"
        >
          <input
            id="camera-local-consent-checkbox"
            data-testid="camera-local-consent-checkbox"
            type="checkbox"
            checked={cameraConsentConfirmed}
            onChange={(e) => {
              onToggleCameraConsent?.(e.target.checked);
              if (!e.target.checked && sourceMode === 'camera') {
                stopCameraStream();
                setSourceMode('simulation');
              }
            }}
            className="mt-0.5 h-3.5 w-3.5 accent-[#00F5D4] rounded shrink-0"
          />
          <span>
            <strong className="font-mono text-slate-100">
              Camera Consent:
            </strong>{' '}
            I consent to local 30 FPS RGB/HSV optical float-ball analysis in
            volatile browser RAM (0 video recording, 0 cloud uploads).{' '}
            {onOpenPrivacyPolicy && (
              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="text-[#00F5D4] underline hover:text-white"
              >
                View Privacy Policy
              </button>
            )}
          </span>
        </label>
      </div>

      {/* Bottom Action Bar for Optical Tracking & Simulated Gravity Drain */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setTrackingEnabled((prev) => !prev)}
          className="px-3.5 py-2 text-xs font-mono font-medium rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors whitespace-nowrap shrink-0"
        >
          {trackingEnabled ? 'Pause Reticle Lock' : 'Resume Reticle Lock'}
        </button>

        <button
          type="button"
          onClick={onToggleAutoDrain}
          className={`px-3.5 py-2 text-xs font-mono font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
            autoDrainActive
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
              : 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200'
          }`}
        >
          {autoDrainActive ? 'Stop Gravity Drain Sim' : 'Simulate IV Drain'}
        </button>
      </div>
    </section>
  );
};
