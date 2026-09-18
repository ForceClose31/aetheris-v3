export class GameAudio {
  enabled = false;
  private context: AudioContext | null = null;

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.play('bell');
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

  destroy(): void {
    void this.context?.close();
  }
}
