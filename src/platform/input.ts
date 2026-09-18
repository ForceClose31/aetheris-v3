export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'attack'
  | 'roll'
  | 'interact'
  | 'skill'
  | 'tonic'
  | 'journal'
  | 'inventory'
  | 'map'
  | 'pause';
const bindings: Record<string, Action> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyJ: 'attack',
  Space: 'roll',
  ShiftLeft: 'roll',
  KeyE: 'interact',
  KeyQ: 'skill',
  KeyR: 'tonic',
  KeyL: 'journal',
  KeyI: 'inventory',
  KeyM: 'map',
  Escape: 'pause',
};

export class InputController {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private abort = new AbortController();

  constructor(private readonly canvasHost: HTMLElement) {
    const options = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
          return;
        const action = bindings[event.code];
        if (!action) return;
        event.preventDefault();
        if (!event.repeat) this.press(action);
      },
      options,
    );
    window.addEventListener(
      'keyup',
      (event) => {
        const action = bindings[event.code];
        if (action) this.release(action);
      },
      options,
    );
    window.addEventListener('blur', () => this.clear(), options);
    canvasHost.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button === 0) this.press('attack');
        if (event.button === 2) this.press('roll');
      },
      options,
    );
    window.addEventListener(
      'pointerup',
      () => {
        this.release('attack');
        this.release('roll');
      },
      options,
    );
    canvasHost.addEventListener('contextmenu', (event) => event.preventDefault(), options);
  }

  press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }
  release(action: Action): void {
    this.held.delete(action);
  }
  down(action: Action): boolean {
    return this.held.has(action);
  }
  take(action: Action): boolean {
    const exists = this.pressed.has(action);
    this.pressed.delete(action);
    return exists;
  }
  flush(): void {
    this.pressed.clear();
  }
  clear(): void {
    this.held.clear();
    this.pressed.clear();
  }
  destroy(): void {
    this.abort.abort();
    this.clear();
  }
  get movement(): { x: number; y: number } {
    const x = Number(this.down('right')) - Number(this.down('left'));
    const y = Number(this.down('down')) - Number(this.down('up'));
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }
  get element(): HTMLElement {
    return this.canvasHost;
  }
}
