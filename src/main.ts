import Phaser from 'phaser';
import { WorldScene } from './game/world-scene';
import { GameAudio } from './platform/audio';
import { browserStorage, SaveStore } from './platform/save';
import { GameInterface } from './ui/interface';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Application mount missing.');
const saves = new SaveStore(browserStorage());
const audio = new GameAudio();
const ui = new GameInterface(root, saves, audio);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: ui.host,
  backgroundColor: '#344f3d',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: ui.host.clientWidth,
    height: ui.host.clientHeight,
  },
  physics: { default: 'arcade', arcade: { debug: false, gravity: { x: 0, y: 0 } } },
  scene: [new WorldScene(ui, saves, audio)],
  input: { keyboard: false },
  render: { powerPreference: 'high-performance' },
  audio: { noAudio: true },
});

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    game.destroy(true);
    audio.destroy();
  });
