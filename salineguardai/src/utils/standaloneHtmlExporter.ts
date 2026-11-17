/**
 * Generates a complete, self-contained single-file HTML bundle of SalineGuard AI
 * containing Tailwind CSS (via CDN), custom CSS, and full Vanilla JS bright red float ball optical tracking & ESP32 control
 * so users can download and deploy it directly onto an ESP32 LittleFS/SPIFFS partition or run offline.
 */
export function downloadStandaloneHtmlBundle(defaultIp = '192.168.4.1'): void {
  const htmlContent = `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
  <title>SalineGuard AI — ICU IV Fluid Monitoring & Pinch-Clamp System</title>
  <meta name="theme-color" content="#0B0F19" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: linear-gradient(135deg, #0B0F19 0%, #1A233A 100%); color: #F8FAFC; min-height: 100vh; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
    input[type='range'] { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; background: rgba(15,23,42,0.9); border-radius: 999px; border: 1px solid rgba(148,163,184,0.25); }
    input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #00F5D4; border: 3px solid #0B0F19; cursor: pointer; }
  </style>
</head>
<body class="p-4 md:p-8">
  <div class="max-w-6xl mx-auto space-y-6">
    <header class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div class="text-lg font-bold tracking-tight">SalineGuard AI</div>
      <div class="text-xs font-mono text-[#00F5D4]">ESP32 ICU PINCH-CLAMP NODE (${defaultIp}) · BRIGHT RED FLOAT TRACKER</div>
    </header>
    <main class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold">IV Fluid Remaining</h1>
          <div id="statusBadge" class="text-sm font-mono font-semibold text-emerald-400">● NORMAL FLOW</div>
        </div>
        <div class="flex items-baseline gap-2">
          <span id="levelReadout" class="text-6xl font-mono font-bold">78</span>
          <span class="text-2xl font-mono text-slate-400">%</span>
        </div>
        <div class="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div id="levelBar" class="h-full bg-[#00F5D4] transition-all duration-150" style="width: 78%"></div>
        </div>
        <div class="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div class="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div class="text-xs font-mono text-slate-400">SERVO CLAMP STATE</div>
            <div id="servoState" class="text-xl font-mono font-bold text-[#00F5D4] mt-1">Open (0°)</div>
          </div>
          <div class="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div class="text-xs font-mono text-slate-400">EST. TIME TO EMPTY</div>
            <div id="timeEmpty" class="text-xl font-mono font-bold text-slate-100 mt-1">2h 43m</div>
          </div>
        </div>
      </section>
      <section class="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 class="text-lg font-semibold">Bright Red Float Ball Tracker & Override</h2>
        <canvas id="visionCanvas" width="480" height="240" class="w-full rounded-xl border border-slate-800 bg-slate-950 cursor-crosshair"></canvas>
        <input id="overrideSlider" type="range" min="0" max="100" value="78" />
        <div class="grid grid-cols-3 gap-2">
          <button onclick="setLevel(100)" class="py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-xs font-mono text-emerald-300">100% Reset</button>
          <button onclick="setLevel(35)" class="py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-mono text-amber-300">35% Warning</button>
          <button onclick="setLevel(8)" class="py-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-xs font-mono text-rose-300">8% Emergency Clamp</button>
        </div>
        <div class="pt-2">
          <label class="text-xs font-mono text-slate-400 block mb-1">ESP32 IP ADDRESS</label>
          <input id="espIp" type="text" value="${defaultIp}" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono" />
        </div>
      </section>
    </main>
  </div>
  <script>
    let currentLvl = 78;
    let alerted = false;
    const slider = document.getElementById('overrideSlider');
    const canvas = document.getElementById('visionCanvas');
    const ctx = canvas.getContext('2d');
    slider.addEventListener('input', (e) => setLevel(Number(e.target.value)));
    canvas.addEventListener('pointerdown', (e) => {
      const r = canvas.getBoundingClientRect();
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      const pct = Math.max(0, Math.min(100, Math.round(((195 - y) / (195 - 40)) * 100)));
      setLevel(pct);
    });
    let lastSendTime = 0;
    let pendingLevel = null;
    let throttleTimer = null;

    function sendEsp32Throttled(val) {
      const rounded = Math.round(val);
      pendingLevel = rounded;
      const now = Date.now();
      const elapsed = now - lastSendTime;

      if (elapsed >= 150) {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
          throttleTimer = null;
        }
        dispatchEsp32Fetch(rounded);
      } else if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          if (pendingLevel !== null) {
            dispatchEsp32Fetch(pendingLevel);
          }
        }, 150 - elapsed);
      }
    }

    function dispatchEsp32Fetch(lvl) {
      lastSendTime = Date.now();
      pendingLevel = null;
      const ip = document.getElementById('espIp').value.trim() || '192.168.4.1';
      fetch('http://' + ip + '/set?level=' + Math.round(lvl), { mode: 'no-cors' }).catch(() => {});
    }

    function setLevel(val) {
      const lvl = Math.max(0, Math.min(100, Math.round(val)));
      currentLvl = lvl;
      slider.value = lvl;
      document.getElementById('levelReadout').textContent = lvl;
      const bar = document.getElementById('levelBar');
      const badge = document.getElementById('statusBadge');
      const servo = document.getElementById('servoState');
      const timeEl = document.getElementById('timeEmpty');
      bar.style.width = lvl + '%';
      if (lvl <= 10) {
        badge.textContent = '✖ AUTO-CLAMPED';
        badge.className = 'text-sm font-mono font-semibold text-rose-500';
        bar.className = 'h-full bg-rose-500 transition-all duration-150';
        servo.textContent = 'Locked (90°)';
        servo.className = 'text-xl font-mono font-bold text-rose-500 mt-1';
        timeEl.textContent = '0h 00m (Clamped)';
        if (!alerted && 'speechSynthesis' in window) {
          alerted = true;
          window.speechSynthesis.speak(new SpeechSynthesisUtterance('Critical Alert: Emergency servo clamp engaged'));
        }
      } else {
        alerted = false;
        const mins = Math.round(((lvl - 10) / 100 * 500 / 125) * 60);
        timeEl.textContent = Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm';
        servo.textContent = 'Open (0°)';
        servo.className = 'text-xl font-mono font-bold text-[#00F5D4] mt-1';
        if (lvl <= 50) {
          badge.textContent = '▲ LOW SALINE';
          badge.className = 'text-sm font-mono font-semibold text-amber-400';
          bar.className = 'h-full bg-amber-400 transition-all duration-150';
        } else {
          badge.textContent = '● NORMAL FLOW';
          badge.className = 'text-sm font-mono font-semibold text-emerald-400';
          bar.className = 'h-full bg-[#00F5D4] transition-all duration-150';
        }
      }
      sendEsp32Throttled(lvl);
      drawPhantom();
    }
    function drawPhantom() {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, 480, 240);
      const topY = 40, botY = 195;
      const menY = botY - (currentLvl / 100) * (botY - topY);
      ctx.strokeStyle = 'rgba(148,163,184,0.4)';
      ctx.strokeRect(170, topY - 10, 140, botY - topY + 20);
      ctx.fillStyle = 'rgba(56,189,248,0.22)';
      ctx.fillRect(173, menY, 134, botY - menY + 8);
      ctx.fillStyle = 'rgb(252, 24, 38)';
      ctx.beginPath();
      ctx.arc(240, menY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00F5D4';
      ctx.beginPath();
      ctx.arc(240, menY, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawPhantom();
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'SalineGuard_AI_Standalone.html';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
