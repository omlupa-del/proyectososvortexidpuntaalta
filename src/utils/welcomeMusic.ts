/**
 * Ambient Reassuring Background Music Engine for Vortex ID Punta Alta.
 * Built with Web Audio API for zero network latency, 100% offline reliability,
 * and cinematic ambient atmosphere (warm analog-style pad + gentle bell arpeggio).
 */

class WelcomeMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private loopInterval: number | null = null;
  private activeNodes: (OscillatorNode | GainNode)[] = [];
  private isMuted: boolean = false;
  private baseVolume: number = 0.22; // subtle background level

  private initContext(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.baseVolume, this.ctx.currentTime);

      // Lowpass filter for warm, cinematic analog feel (smooth out highs)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.musicGain.connect(filter);
      filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start playing ambient welcome music
   */
  public start(): boolean {
    if (this.isPlaying) return true;
    const ok = this.initContext();
    if (!ok || !this.ctx || !this.masterGain || !this.musicGain) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.isPlaying = true;

    // Reset volume to base level with soft fade in
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.baseVolume, now + 1.2);

    // Warm Chord Progression: Dmaj9 -> Gmaj7 -> Bm7 -> Asus4 (approx 16-bar gentle cycle)
    // Frequencies (Hz):
    const chordProgressions = [
      // Dmaj9 (Inspiring, reassuring, safe)
      { pad: [146.83, 220.0, 277.18, 329.63, 369.99], bells: [587.33, 739.99, 880.0, 1108.7] },
      // Gmaj7 (Expansive, welcoming, community)
      { pad: [196.0, 246.94, 293.66, 369.99], bells: [783.99, 987.77, 1174.66, 1479.98] },
      // Bm7 (Deep, serious, protective care)
      { pad: [123.47, 185.0, 220.0, 293.66], bells: [587.33, 880.0, 1174.66, 1479.98] },
      // Asus4 -> A (Harmonic resolution, warmth)
      { pad: [110.0, 220.0, 293.66, 329.63, 440.0], bells: [659.25, 880.0, 1108.73, 1318.51] }
    ];

    let chordIdx = 0;
    const chordDuration = 4.2; // 4.2 seconds per chord step

    const playChordStep = () => {
      if (!this.isPlaying || !this.ctx || !this.musicGain) return;
      const stepNow = this.ctx.currentTime;
      const current = chordProgressions[chordIdx];
      chordIdx = (chordIdx + 1) % chordProgressions.length;

      // 1. Play warm analog pad oscillators
      current.pad.forEach((freq, i) => {
        if (!this.ctx || !this.musicGain) return;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        // Slight detune for rich lush acoustic chorus
        const detune = (i % 2 === 0 ? 1 : -1) * (i * 3.5);
        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, stepNow);
        osc.detune.setValueAtTime(detune, stepNow);

        // Gentle attack, sustained body, soft release
        noteGain.gain.setValueAtTime(0.001, stepNow);
        noteGain.gain.linearRampToValueAtTime(0.035 / (i > 1 ? 1.5 : 1), stepNow + 1.2);
        noteGain.gain.setValueAtTime(0.035 / (i > 1 ? 1.5 : 1), stepNow + chordDuration - 0.8);
        noteGain.gain.linearRampToValueAtTime(0.001, stepNow + chordDuration);

        osc.connect(noteGain);
        noteGain.connect(this.musicGain);

        osc.start(stepNow);
        osc.stop(stepNow + chordDuration);

        this.activeNodes.push(osc, noteGain);
      });

      // 2. Play gentle celestial bell arpeggio notes across the chord
      current.bells.forEach((freq, idx) => {
        if (!this.ctx || !this.musicGain) return;
        const bellTime = stepNow + 0.6 + idx * 0.7;
        const osc = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, bellTime);

        bellGain.gain.setValueAtTime(0.001, bellTime);
        bellGain.gain.linearRampToValueAtTime(0.038, bellTime + 0.04);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, bellTime + 1.2);

        osc.connect(bellGain);
        bellGain.connect(this.musicGain);

        osc.start(bellTime);
        osc.stop(bellTime + 1.3);

        this.activeNodes.push(osc, bellGain);
      });
    };

    // Trigger first step right away
    playChordStep();

    // Loop steps
    this.loopInterval = window.setInterval(() => {
      if (this.isPlaying) {
        playChordStep();
      }
    }, chordDuration * 1000 - 100);

    return true;
  }

  /**
   * Duck music volume down when the Spanish voice greeting is actively speaking
   * and gently restore it when the voice finishes!
   */
  public setDucked(ducked: boolean): void {
    if (!this.ctx || !this.masterGain || !this.isPlaying || this.isMuted) return;
    const now = this.ctx.currentTime;
    const targetVolume = ducked ? 0.07 : this.baseVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(targetVolume, now + 0.6);
  }

  /**
   * Toggle mute on/off
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain && this.isPlaying) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.baseVolume, now + 0.2);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Stop music smoothly and clear intervals
   */
  public stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.loopInterval !== null) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);

      setTimeout(() => {
        try {
          this.activeNodes.forEach((node) => {
            if ('stop' in node) {
              (node as OscillatorNode).stop();
            }
            node.disconnect();
          });
          this.activeNodes = [];
        } catch {}
      }, 550);
    }
  }
}

// Export singleton instance
export const welcomeMusic = new WelcomeMusicEngine();
