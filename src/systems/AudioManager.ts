/**
 * Procedural audio for OVERLUCK.
 * No external assets: every SFX is generated from oscillators + noise bursts
 * via the Web Audio API. Keeps the repo asset-free and guarantees sub-frame
 * latency since we never stream samples.
 *
 * The AudioContext is created lazily on the first user gesture (browsers
 * suspend it until then). All `play*` calls become no-ops until the context
 * is resumed. `AudioManager.unlock()` should be called from any key/pointer
 * event early in the lifecycle (BootScene does it for us).
 */

type OscType = OscillatorType;

interface ToneSpec {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscType;
  gain?: number;
  delay?: number;
  attack?: number;
  release?: number;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lastFireAt = 0;
  private enabled = true;
  private masterVolume = 0.4;
  private sfxVolume = 1;

  public unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctor =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.enabled = false;
    }
  }

  public setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.masterGain) {
      this.masterGain.gain.value = on ? this.masterVolume : 0;
    }
  }

  public setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.enabled) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  public setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public applySettings(settings: { masterVolume: number; sfxVolume: number; muted: boolean }): void {
    this.setMasterVolume(settings.masterVolume);
    this.setSfxVolume(settings.sfxVolume);
    this.setEnabled(!settings.muted);
  }

  public setVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? this.masterVolume : 0;
  }

  // --- Public SFX ---------------------------------------------------------

  public playFire(outcome: "normal" | "crit" | "misfire"): void {
    // Throttle: if many projectiles fire the same frame, quiet duplicates
    const now = this.now();
    const delta = now - this.lastFireAt;
    this.lastFireAt = now;
    const volScale = delta < 0.04 ? 0.35 : delta < 0.08 ? 0.65 : 1;

    if (outcome === "crit") {
      this.tone({ freq: 880, endFreq: 1320, duration: 0.16, type: "square", gain: 0.22 * volScale });
      this.tone({ freq: 440, endFreq: 660, duration: 0.12, type: "triangle", gain: 0.16 * volScale, delay: 0.01 });
      this.noiseBurst(0.05, 0.14 * volScale);
    } else if (outcome === "misfire") {
      this.tone({ freq: 260, endFreq: 130, duration: 0.12, type: "sawtooth", gain: 0.18 * volScale });
    } else {
      this.tone({ freq: 620, endFreq: 420, duration: 0.08, type: "square", gain: 0.14 * volScale });
    }
  }

  public playImpact(isCrit = false): void {
    const base = isCrit ? 120 : 180;
    this.tone({ freq: base, endFreq: base * 0.5, duration: 0.1, type: "triangle", gain: 0.18 });
    this.noiseBurst(0.05, 0.14);
  }

  public playEnemyDeath(isBoss = false): void {
    if (isBoss) {
      this.tone({ freq: 220, endFreq: 80, duration: 0.45, type: "sawtooth", gain: 0.2 });
      this.tone({ freq: 440, endFreq: 110, duration: 0.5, type: "triangle", gain: 0.14, delay: 0.02 });
      this.noiseBurst(0.3, 0.2);
    } else {
      this.tone({ freq: 520, endFreq: 140, duration: 0.18, type: "triangle", gain: 0.14 });
      this.noiseBurst(0.08, 0.1);
    }
  }

  public playBaseHit(): void {
    this.tone({ freq: 160, endFreq: 80, duration: 0.22, type: "square", gain: 0.2 });
    this.noiseBurst(0.18, 0.16);
  }

  public playWaveStart(): void {
    // Low → high fanfare
    this.tone({ freq: 330, duration: 0.14, type: "triangle", gain: 0.14 });
    this.tone({ freq: 440, duration: 0.14, type: "triangle", gain: 0.14, delay: 0.12 });
    this.tone({ freq: 660, duration: 0.22, type: "triangle", gain: 0.16, delay: 0.24 });
  }

  public playWaveClear(): void {
    // Arpeggio C-E-G
    this.tone({ freq: 523.25, duration: 0.14, type: "triangle", gain: 0.14 });
    this.tone({ freq: 659.25, duration: 0.14, type: "triangle", gain: 0.14, delay: 0.1 });
    this.tone({ freq: 783.99, duration: 0.24, type: "triangle", gain: 0.16, delay: 0.2 });
  }

  public playJackpot(): void {
    // Big arpeggio + noise shimmer
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone({ freq: f, duration: 0.22, type: "triangle", gain: 0.16, delay: i * 0.08 });
    });
    this.noiseBurst(0.6, 0.08, 0.4);
  }

  public playClick(): void {
    this.tone({ freq: 720, endFreq: 900, duration: 0.04, type: "square", gain: 0.08 });
  }

  public playHover(): void {
    this.tone({ freq: 480, duration: 0.02, type: "square", gain: 0.04 });
  }

  public playCountdown(step: "number" | "go"): void {
    if (step === "go") {
      this.tone({ freq: 660, endFreq: 990, duration: 0.22, type: "triangle", gain: 0.2 });
      this.noiseBurst(0.08, 0.14);
    } else {
      this.tone({ freq: 440, duration: 0.08, type: "square", gain: 0.12 });
    }
  }

  public playGameOver(): void {
    this.tone({ freq: 400, endFreq: 100, duration: 0.9, type: "sawtooth", gain: 0.22 });
    this.tone({ freq: 300, endFreq: 75, duration: 1, type: "triangle", gain: 0.16, delay: 0.05 });
  }

  public playVictory(): void {
    [261.63, 329.63, 392.0, 523.25, 659.25].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.22, type: "triangle", gain: 0.18, delay: i * 0.1 });
    });
    this.noiseBurst(0.6, 0.08, 0.5);
  }

  public playSpin(): void {
    // Ascending tick train
    for (let i = 0; i < 6; i += 1) {
      this.tone({ freq: 320 + i * 60, duration: 0.04, type: "square", gain: 0.08, delay: i * 0.08 });
    }
  }

  public playTick(): void {
    this.tone({ freq: 820, duration: 0.03, type: "square", gain: 0.07 });
  }

  public playPlace(): void {
    this.tone({ freq: 440, endFreq: 660, duration: 0.12, type: "triangle", gain: 0.16 });
    this.tone({ freq: 330, endFreq: 220, duration: 0.1, type: "sawtooth", gain: 0.08, delay: 0.02 });
  }

  public playUpgrade(): void {
    [440, 554.37, 659.25].forEach((f, i) => {
      this.tone({ freq: f, duration: 0.14, type: "triangle", gain: 0.18, delay: i * 0.06 });
    });
    this.noiseBurst(0.2, 0.08, 0.3);
  }

  public playReward(): void {
    this.tone({ freq: 660, endFreq: 880, duration: 0.18, type: "triangle", gain: 0.16 });
    this.tone({ freq: 990, duration: 0.1, type: "triangle", gain: 0.1, delay: 0.08 });
  }

  /** Bright shimmer + gold note used for achievement toasts. */
  public playAchievement(): void {
    this.tone({ freq: 880, duration: 0.08, type: "triangle", gain: 0.14 });
    this.tone({ freq: 1174.66, duration: 0.12, type: "triangle", gain: 0.14, delay: 0.06 });
    this.tone({ freq: 1567.98, duration: 0.2, type: "triangle", gain: 0.16, delay: 0.14 });
    this.noiseBurst(0.3, 0.05, 0.1);
  }

  /** Short descending chord when a tower is sold. */
  public playSell(): void {
    this.tone({ freq: 660, endFreq: 440, duration: 0.18, type: "triangle", gain: 0.16 });
    this.tone({ freq: 330, endFreq: 220, duration: 0.14, type: "sawtooth", gain: 0.1, delay: 0.03 });
  }

  /** Ominous swell for boss phase transitions. */
  public playBossPhase(phase: number): void {
    const base = 120 - phase * 15;
    this.tone({ freq: base, endFreq: base * 2, duration: 0.6, type: "sawtooth", gain: 0.22 });
    this.tone({ freq: base * 1.5, duration: 0.55, type: "triangle", gain: 0.14, delay: 0.08 });
    this.noiseBurst(0.5, 0.15, 0.0);
  }

  // --- Ambient drone -----------------------------------------------------

  private ambientNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

  /**
   * Starts a sustained tri-pad drone. Multiple calls replace the current
   * ambient. Intended for casino mini-scenes (Slot / Roulette / Card).
   */
  public startAmbient(mode: "casino" | "menu" = "casino"): void {
    this.stopAmbient();
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const master = this.masterGain;
    const freqs = mode === "casino" ? [110, 165, 220] : [98, 147, 196];
    const t0 = ctx.currentTime;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + 1.4);
      osc.connect(g).connect(master);
      osc.start(t0);
      this.ambientNodes.push({ osc, gain: g });
    }
  }

  public stopAmbient(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const { osc, gain } of this.ambientNodes) {
      try {
        gain.gain.cancelScheduledValues(t0);
        gain.gain.setValueAtTime(gain.gain.value, t0);
        gain.gain.linearRampToValueAtTime(0, t0 + 0.4);
        osc.stop(t0 + 0.5);
      } catch {
        /* already stopped */
      }
    }
    this.ambientNodes = [];
  }

  // --- Internals ----------------------------------------------------------

  private now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  private tone(spec: ToneSpec): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (spec.delay ?? 0);
    const gainVal = spec.gain ?? 0.2;
    const attack = spec.attack ?? 0.005;
    const release = spec.release ?? 0.06;

    const osc = ctx.createOscillator();
    osc.type = spec.type ?? "triangle";
    osc.frequency.setValueAtTime(spec.freq, t0);
    if (spec.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.endFreq), t0 + spec.duration);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainVal, t0 + attack);
    gain.gain.setValueAtTime(gainVal, t0 + Math.max(attack, spec.duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration);

    osc.connect(gain).connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + spec.duration + 0.02);
  }

  private noiseBurst(duration: number, gainVal: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const envelope = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    noise.connect(filter).connect(gain).connect(this.masterGain);
    noise.start(t0);
    noise.stop(t0 + duration + 0.02);
  }
}

// Shared singleton consumed throughout the game.
export const audio = new AudioManager();
