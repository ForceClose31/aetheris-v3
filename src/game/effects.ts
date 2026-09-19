import Phaser from 'phaser';
import type { AreaDefinition } from '../content/world';

export class Effects {
  private ambient: Phaser.GameObjects.Graphics;
  private tint: Phaser.GameObjects.Rectangle;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: AreaDefinition,
  ) {
    this.ambient = scene.add.graphics().setDepth(9000).setScrollFactor(0);
    this.tint = scene.add
      .rectangle(0, 0, 1, 1, 0x132442)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(8000)
      .setAlpha(0);
  }

  floating(x: number, y: number, message: string, color = '#f4e4ad'): void {
    const text = this.scene.add
      .text(x, y - 50, message, {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#1d322e',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(7000);
    this.scene.tweens.add({
      targets: text,
      y: y - 94,
      alpha: 0,
      duration: 850,
      onComplete: () => text.destroy(),
    });
  }

  slash(x: number, y: number, angle: number, skill: boolean, reach: number): void {
    const arc = this.scene.add.graphics().setDepth(6500);
    arc.lineStyle(skill ? 5 : 3, skill ? 0xa3d3cf : 0xf9df9b, 0.95);
    arc.beginPath();
    arc.arc(x, y - 16, reach * 0.82, angle - 1.1, angle + 1.1);
    arc.strokePath();
    arc.lineStyle(2, 0xfff6d2, 0.6);
    arc.beginPath();
    arc.arc(x, y - 16, reach * 0.65, angle - 1, angle + 0.9);
    arc.strokePath();
    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      duration: 180,
      onComplete: () => arc.destroy(),
    });
  }

  update(dt: number, seconds: number, water: Phaser.GameObjects.Graphics): void {
    this.time += dt;
    const camera = this.scene.cameras.main;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    const hour = (8 + seconds / 45) % 24;
    const dark = hour >= 18 || hour < 6;
    const rain = Math.floor(seconds / 150) % 3 === 1;
    this.tint.setSize(camera.width * 2, camera.height * 2).setAlpha(dark ? 0.35 : rain ? 0.12 : 0);
    this.ambient.clear();
    if (rain) {
      this.ambient.lineStyle(1, 0xc1dcdb, 0.28);
      for (let i = 0; i < 65; i++) {
        const x = (i * 137.3 + this.time * 40) % width;
        const y = (i * 77.8 + this.time * 240) % height;
        this.ambient.lineBetween(x, y, x - 4, y + 12);
      }
    } else {
      for (let i = 0; i < 24; i++) {
        const x = (i * 117.5 + Math.sin(this.time * 0.2 + i) * 25 + width) % width;
        const y = (i * 61.3 + Math.cos(this.time * 0.3 + i) * 16 + height) % height;
        this.ambient.fillStyle(
          dark ? 0xe4d483 : 0xe7dca9,
          dark ? 0.35 + Math.sin(i + this.time) * 0.25 : 0.2,
        );
        this.ambient.fillRect(x, y, 2, 2);
      }
    }
    water.clear().lineStyle(2, 0x95c5b0, 0.23);
    if (!this.area.river) return;
    for (let i = 0; i < 55; i++) {
      const y = (i * 29 + this.time * 9) % this.area.height;
      if (
        y > this.area.river.bridgeY - 4 &&
        y < this.area.river.bridgeY + this.area.river.bridgeHeight + 6
      )
        continue;
      const x = this.area.river.x + 12 + ((i * 17) % (this.area.river.width - 43));
      water.lineBetween(x, y, x + 15, y);
    }
  }
}
