export class GameAudio {
  enabled = false;
  private context: AudioContext | null = null;
  private theme: 'village' | 'dungeon' | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextStepTime = 0;
  private noise: AudioBuffer | null = null;

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.play('bell');
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this.enabled;
  }

  play(type: 'hit' | 'step' | 'bell' | 'hurt' | 'pickup'): void {
    if (!this.enabled || !this.context) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = { hit: 170, step: 90, bell: 660, hurt: 100, pickup: 880 };
    const duration = type === 'bell' ? 0.55 : 0.12;
    oscillator.type = type === 'bell' || type === 'pickup' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequencies[type], context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequencies[type] * (type === 'pickup' ? 1.5 : 0.5),
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  // Medieval-flavoured loop: modal plucked melody over a sustained open fifth,
  // with soft hand-percussion outside. Themes switch per area (overworld/indoor).
  setTheme(theme: 'village' | 'dungeon' | null): void {
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    if (this.enabled) this.startMusic();
  }

  private startMusic(): void {
    if (!this.context || !this.theme || this.timer !== null) return;
    this.nextStepTime = this.context.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  private stopMusic(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (!this.enabled || !this.context || !this.theme) {
      this.stopMusic();
      return;
    }
    const stepTime = this.theme === 'village' ? 0.27 : 0.33;
    while (this.nextStepTime < this.context.currentTime + 0.3) {
      this.playStep(this.theme, this.step, this.nextStepTime);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepTime;
    }
  }

  // Dorian phrases for the village, sparse low Aeolian for the deep places.
  private playStep(theme: 'village' | 'dungeon', step: number, time: number): void {
    const dorian = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33];
    const aeolian = [220.0, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94];
    const village = [
      0, -1, 2, -1, 4, -1, 3, 2, 4, -1, 5, 4, 3, -1, 2, -1, 0, -1, 2, 3, 4, -1, 5, -1, 6, 5, 4, 3,
      2, -1, 1, -1,
    ];
    const crypt = [
      0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 1, -1, -1, 0, -1, -1, -1, 2, -1, -1, 4, -1, -1, 3, -1,
      1, -1, 0, -1, -1, -1,
    ];
    if (theme === 'village') {
      const degree = village[step % village.length];
      if (degree >= 0) this.pluck(dorian[degree], time, 0.05, 0.5);
      if (step % 16 === 0) this.drone(dorian[0] / 2, dorian[4] / 2, time, 16 * 0.27);
      if (step % 8 === 4) this.tap(time, 0.03);
    } else {
      const degree = crypt[step % crypt.length];
      if (degree >= 0) this.pluck(aeolian[degree] / 2, time, 0.055, 1.1);
      if (step % 32 === 0) this.drone(aeolian[0] / 2, aeolian[4] / 2, time, 32 * 0.33);
    }
  }

  // Plucked lute voice: triangle through a closing lowpass with fast decay.
  private pluck(freq: number, time: number, volume: number, duration: number): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration * 0.6);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(filter).connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
  }

  // Sustained open fifth under the melody.
  private drone(first: number, second: number, time: number, duration: number): void {
    const context = this.context!;
    for (const [freq, volume] of [
      [first, 0.028],
      [second, 0.02],
    ] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.6);
      gain.gain.setValueAtTime(volume, time + duration - 0.7);
      gain.gain.linearRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.05);
    }
  }

  // Soft hand-percussion: a filtered noise tap.
  private tap(time: number, volume: number): void {
    const context = this.context!;
    if (!this.noise) {
      this.noise = context.createBuffer(1, 2200, context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    gain.gain.setValueAtTime(volume, time);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(time);
  }

  destroy(): void {
    this.stopMusic();
    void this.context?.close();
  }
}
