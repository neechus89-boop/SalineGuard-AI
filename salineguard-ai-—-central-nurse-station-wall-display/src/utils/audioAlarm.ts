/**
 * Web Audio API clinical ICU two-tone chime synthesizer.
 * Generates an IEC-inspired dual-tone hospital alert chime (no external audio assets required).
 */

class IcuAudioEngine {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;
  private isMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock(): boolean {
    const ctx = this.ensureContext();
    return Boolean(ctx && ctx.state === 'running');
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopCriticalLoop();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Plays a crisp two-tone clinical ICU alert chime (880 Hz -> 659.25 Hz).
   */
  public playCriticalChime() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.scheduleTone(ctx, 880, now, 0.16, 0.18);
    this.scheduleTone(ctx, 659.25, now + 0.19, 0.22, 0.18);
    this.scheduleTone(ctx, 880, now + 0.48, 0.16, 0.14);
  }

  /**
   * Plays a subtle single soft chime when entering LOW_SALINE warning threshold.
   */
  public playWarningChime() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.scheduleTone(ctx, 587.33, now, 0.18, 0.1);
  }

  public startCriticalLoop() {
    if (this.isMuted) return;
    if (this.intervalId !== null) return;

    this.playCriticalChime();
    this.intervalId = window.setInterval(() => {
      if (!this.isMuted) {
        this.playCriticalChime();
      }
    }, 2400);
  }

  public stopCriticalLoop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    frequency: number,
    startTime: number,
    duration: number,
    peakGain: number
  ) {
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();
    const harmonicGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(frequency * 2, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    harmonicGain.gain.setValueAtTime(0.0001, startTime);
    harmonicGain.gain.exponentialRampToValueAtTime(peakGain * 0.18, startTime + 0.018);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.8);

    osc.connect(gain);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    harmonic.start(startTime);
    osc.stop(startTime + duration + 0.02);
    harmonic.stop(startTime + duration + 0.02);
  }
}

export const icuAudioEngine = new IcuAudioEngine();
