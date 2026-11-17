import React from 'react';
import { FlowStatus } from '../types/telemetry';

interface IvDripVisualizerProps {
  level: number;
  clamped: boolean;
  servoAngle: number;
  status: FlowStatus;
}

export const IvDripVisualizer: React.FC<IvDripVisualizerProps> = ({
  level,
  clamped,
  servoAngle,
  status,
}) => {
  const clampedLevel = Math.max(0, Math.min(100, level));
  const isStopped = clamped || clampedLevel <= 10 || servoAngle >= 45 || status === 'AUTO_CLAMPED';

  // Bag interior geometry: y=44 (100% top) to y=194 (0% bottom), total height = 150px
  const bagTop = 44;
  const bagHeight = 150;
  const fluidHeight = (clampedLevel / 100) * bagHeight;
  const meniscusY = bagTop + (bagHeight - fluidHeight);

  // Servo visual angle: 0° = open (arm vertical/parallel), 90° = pinched shut (arm horizontal across tube)
  const displayServoAngle = isStopped ? Math.max(servoAngle, 90) : servoAngle;

  const palette =
    status === 'AUTO_CLAMPED' || isStopped
      ? {
          fluidTop: '#ef4444',
          fluidBottom: '#991b1b',
          glow: 'rgba(239, 68, 68, 0.35)',
          stroke: '#f87171',
          droplet: '#f87171',
          servoAccent: '#ef4444',
        }
      : status === 'LOW_SALINE'
        ? {
            fluidTop: '#fbbf24',
            fluidBottom: '#b45309',
            glow: 'rgba(245, 158, 11, 0.28)',
            stroke: '#fbbf24',
            droplet: '#fbbf24',
            servoAccent: '#f59e0b',
          }
        : {
            fluidTop: '#34d399',
            fluidBottom: '#047857',
            glow: 'rgba(16, 185, 129, 0.28)',
            stroke: '#34d399',
            droplet: '#6ee7b7',
            servoAccent: '#10b981',
          };

  return (
    <div className="relative flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-[#060B16]/90 p-3">
      <svg
        viewBox="0 0 220 370"
        className="h-[310px] w-full max-w-[220px] select-none"
        role="img"
        aria-label={`IV Bag at ${clampedLevel}% fluid level, servo pinch clamp at ${displayServoAngle} degrees`}
      >
        <defs>
          <linearGradient id="bagFluidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fluidTop} stopOpacity="0.88" />
            <stop offset="100%" stopColor={palette.fluidBottom} stopOpacity="0.94" />
          </linearGradient>

          <linearGradient id="bagGlassGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#0f172a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.65" />
          </linearGradient>

          <clipPath id="ivBagClip">
            <rect x="48" y="42" width="104" height="154" rx="18" />
          </clipPath>

          <clipPath id="dripChamberClip">
            <rect x="86" y="216" width="28" height="58" rx="8" />
          </clipPath>
        </defs>

        {/* IV Stand Hook & Hanger */}
        <path
          d="M 100 6 C 100 6 100 18 100 22 M 92 14 C 92 8 108 8 108 14"
          fill="none"
          stroke="#64748b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="84" y="22" width="32" height="12" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
        <circle cx="100" cy="28" r="3" fill="#050811" stroke="#64748b" strokeWidth="1.2" />

        {/* Outer IV Bag Silhouette */}
        <rect
          x="46"
          y="40"
          width="108"
          height="158"
          rx="20"
          fill="url(#bagGlassGrad)"
          stroke={palette.stroke}
          strokeOpacity="0.55"
          strokeWidth="1.8"
        />

        {/* Animated Fluid + Meniscus Wave + Floating Red Tracking Ball */}
        <g clipPath="url(#ivBagClip)">
          {/* Subtle grid background inside bag */}
          <rect x="48" y="42" width="104" height="154" fill="#070C18" opacity="0.7" />

          {/* Fluid Body */}
          <g
            style={{
              transform: `translateY(${meniscusY - bagTop}px)`,
              transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Wave crest path */}
            <path
              d="M 38 44 Q 65 39 92 44 T 146 44 T 200 44 L 200 220 L 38 220 Z"
              fill="url(#bagFluidGrad)"
              className={clampedLevel > 0 && !isStopped ? 'animate-saline-wave' : ''}
            />

            {/* Bright surface meniscus highlight */}
            <path
              d="M 38 44 Q 65 39 92 44 T 146 44 T 200 44"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.55"
              strokeWidth="1.8"
              className={clampedLevel > 0 && !isStopped ? 'animate-saline-wave' : ''}
            />

            {/* Floating Red Camera-Tracking Ball sitting on the saline meniscus */}
            {clampedLevel > 2 && (
              <g transform="translate(100, 44)">
                <circle
                  cx="0"
                  cy="0"
                  r="7.5"
                  fill="#ef4444"
                  stroke="#fecaca"
                  strokeWidth="1.5"
                />
                {/* Specular reflection dot on floating red ball */}
                <circle cx="-2.3" cy="-2.3" r="2" fill="#ffffff" opacity="0.85" />
              </g>
            )}
          </g>

          {/* 50% Amber Warning Line */}
          <line
            x1="48"
            y1={bagTop + bagHeight * 0.5}
            x2="152"
            y2={bagTop + bagHeight * 0.5}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeOpacity="0.65"
          />
          {/* 10% Auto-Clamp Threshold Line */}
          <line
            x1="48"
            y1={bagTop + bagHeight * 0.9}
            x2="152"
            y2={bagTop + bagHeight * 0.9}
            stroke="#ef4444"
            strokeWidth="1.2"
            strokeDasharray="3 2"
            strokeOpacity="0.85"
          />
        </g>

        {/* Graduated Bag Scale Labels (Right side of bag) */}
        <g className="font-mono" fontSize="8.5" fill="#94a3b8">
          <line x1="142" y1="54" x2="150" y2="54" stroke="#64748b" strokeWidth="1" />
          <text x="160" y="57">500 mL</text>

          <line x1="142" y1="86" x2="150" y2="86" stroke="#64748b" strokeWidth="1" />
          <text x="160" y="89">375 mL</text>

          <line x1="142" y1="119" x2="150" y2="119" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="160" y="122" fill="#fbbf24">250 mL (50%)</text>

          <line x1="142" y1="152" x2="150" y2="152" stroke="#64748b" strokeWidth="1" />
          <text x="160" y="155">125 mL</text>

          <line x1="142" y1="179" x2="150" y2="179" stroke="#ef4444" strokeWidth="1.4" />
          <text x="160" y="182" fill="#f87171" fontWeight="700">10% CLAMP</text>
        </g>

        {/* Bag Neck Port */}
        <rect x="92" y="198" width="16" height="16" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />

        {/* Drip Chamber Housing */}
        <rect
          x="84"
          y="214"
          width="32"
          height="62"
          rx="10"
          fill="#070C18"
          stroke="#475569"
          strokeWidth="1.5"
        />

        {/* Drip Chamber Contents & Animated Falling Droplets */}
        <g clipPath="url(#dripChamberClip)">
          {/* Upper drip nozzle */}
          <path d="M 96 216 L 104 216 L 101.5 224 L 98.5 224 Z" fill="#94a3b8" />

          {/* Falling Droplet (halted completely when clamped or <=10%) */}
          {!isStopped && (
            <g className="animate-droplet">
              <path
                d="M 100 225 C 100 225 104 231 104 234 A 4 4 0 1 1 96 234 C 96 231 100 225 100 225 Z"
                fill={palette.droplet}
              />
            </g>
          )}

          {/* Chamber Lower Fluid Pool */}
          <rect
            x="86"
            y="258"
            width="28"
            height="18"
            fill={palette.fluidTop}
            fillOpacity="0.65"
          />
          <line
            x1="86"
            y1="258"
            x2="114"
            y2="258"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
        </g>

        {/* Lower IV Silicone Tubing (pinches inward when clamped!) */}
        {isStopped ? (
          <g>
            {/* Upper tube segment */}
            <path d="M 96 276 L 96 310 L 99 318 L 101 318 L 104 310 L 104 276 Z" fill="#1e293b" stroke="#ef4444" strokeWidth="1.2" />
            {/* Pinched flat segment */}
            <rect x="98.5" y="317" width="3" height="10" fill="#ef4444" />
            {/* Lower empty tube segment */}
            <path d="M 99 327 L 96 335 L 96 362 L 104 362 L 104 335 L 101 327 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
          </g>
        ) : (
          <g>
            <rect x="96" y="276" width="8" height="86" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
            {/* Saline column inside open tube */}
            <rect x="97.5" y="276" width="5" height="86" fill={palette.fluidTop} fillOpacity="0.55" />
          </g>
        )}

        {/* SG90 Servo Motor & Pinch Clamp Graphic */}
        <g transform="translate(100, 322)">
          {/* Servo Mounting Body (Left of tube) */}
          <rect
            x="-66"
            y="-16"
            width="44"
            height="32"
            rx="4"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="1.3"
          />
          <rect x="-61" y="-11" width="22" height="22" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <text
            x="-50"
            y="2.5"
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="#94a3b8"
            className="font-mono"
          >
            SG90
          </text>

          {/* Backstop anvil on right side of tube */}
          <rect x="8" y="-12" width="10" height="24" rx="2" fill="#334155" stroke="#64748b" strokeWidth="1" />

          {/* Rotating Servo Horn / Pinch Lever (pivots around x=-28, y=0) */}
          <g
            transform={`translate(-28, 0) rotate(${isStopped ? 0 : -52})`}
            style={{
              transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <rect
              x="-5"
              y="-5"
              width="38"
              height="10"
              rx="4"
              fill={isStopped ? '#ef4444' : '#38bdf8'}
              stroke={isStopped ? '#fecaca' : '#bae6fd'}
              strokeWidth="1.2"
            />
            <circle cx="0" cy="0" r="3.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* Servo Angle Telemetry Badge beside tube */}
          <text
            x="26"
            y="-2"
            fontSize="9"
            fontWeight="700"
            fill={isStopped ? '#f87171' : '#34d399'}
            className="font-mono"
          >
            {displayServoAngle}°
          </text>
          <text
            x="26"
            y="10"
            fontSize="7.5"
            fontWeight="600"
            fill={isStopped ? '#fca5a5' : '#94a3b8'}
            className="font-mono"
          >
            {isStopped ? 'PINCHED' : 'OPEN'}
          </text>
        </g>
      </svg>
    </div>
  );
};
