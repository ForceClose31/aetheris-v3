import Phaser from 'phaser';
import { CAMP, CHESTS, GROVES, HERBS, HOUSES, NPCS, RIVER, WORLD } from '../content/world';
import type { GameState, Rect } from '../domain/types';

export interface WorldView {
  solids: Phaser.Physics.Arcade.StaticGroup;
  obstacles: Rect[];
  herbs: Map<string, Phaser.GameObjects.Image>;
  chests: Map<string, Phaser.GameObjects.Image>;
  water: Phaser.GameObjects.Graphics;
}

export function buildWorld(scene: Phaser.Scene, state: GameState): WorldView {
  const solids = scene.physics.add.staticGroup();
  const obstacles: Rect[] = [];
  const herbs = new Map<string, Phaser.GameObjects.Image>();
  const chests = new Map<string, Phaser.GameObjects.Image>();
  const solid = (x: number, y: number, w: number, h: number): void => {
    const rect = scene.add.rectangle(x, y, w, h, 0, 0);
    solids.add(rect);
    obstacles.push({ x: x - w / 2, y: y - h / 2, w, h });
  };
  const prop = (x: number, y: number, key: string, scale = 2): Phaser.GameObjects.Image =>
    scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(y);
  scene.add.image(0, 0, 'terrain').setOrigin(0).setDepth(-10);
  solid(RIVER.x + RIVER.width / 2, RIVER.bridgeY / 2, RIVER.width, RIVER.bridgeY);
  solid(
    RIVER.x + RIVER.width / 2,
    (RIVER.bridgeY + RIVER.bridgeHeight + WORLD.height) / 2,
    RIVER.width,
    WORLD.height - RIVER.bridgeY - RIVER.bridgeHeight,
  );
  HOUSES.forEach((house) => {
    prop(house.x, house.y, `house-${house.style}`);
    solid(house.x, house.y - 44, 164, 80);
    scene.add
      .text(house.x, house.y + 9, house.label, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#e4d9ab',
        backgroundColor: '#2b433a',
      })
      .setOrigin(0.5)
      .setPadding(5, 3)
      .setDepth(house.y + 1)
      .setAlpha(0.85);
  });
  GROVES.forEach((grove, index) => {
    for (let y = grove.y; y < grove.y + grove.h; y += 76)
      for (let x = grove.x; x < grove.x + grove.w; x += 70) {
        const offset = (Math.floor(y / 76) % 2) * 22;
        prop(x + offset, y, 'tree', 1.5 + (index % 3) * 0.15);
        solid(x + offset, y - 9, 18, 18);
      }
  });
  for (const [x, y] of [
    [192, 566],
    [696, 625],
    [197, 980],
    [712, 1152],
    [987, 809],
    [1314, 1110],
    [1550, 351],
    [1635, 722],
  ]) {
    prop(x!, y!, 'rock');
    solid(x!, y! - 10, 43, 25);
  }
  for (const [x, y] of [
    [1286, 228],
    [1493, 228],
    [1286, 398],
    [1493, 398],
  ]) {
    prop(x!, y!, 'pillar');
    solid(x!, y! - 15, 42, 30);
  }
  prop(438, 584, 'well');
  solid(438, 570, 62, 36);
  prop(CAMP.x, CAMP.y, 'camp', 1.5);
  NPCS.forEach((npc) => {
    prop(npc.x, npc.y, npc.color, 1.6);
    solid(npc.x, npc.y - 10, 22, 22);
    scene.add
      .text(npc.x, npc.y - 65, npc.name, {
        fontFamily: 'Georgia',
        fontSize: '14px',
        color: '#f2e4bd',
        stroke: '#243a32',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(npc.y + 1);
  });
  HERBS.forEach((herb) => {
    if (!state.world.gathered.includes(herb.id))
      herbs.set(herb.id, prop(herb.x, herb.y, 'herb', 1.5));
  });
  CHESTS.forEach((chest) => {
    const sprite = prop(chest.x, chest.y, 'chest', 1.8);
    if (state.world.opened.includes(chest.id)) sprite.setTint(0x777777);
    chests.set(chest.id, sprite);
  });
  const water = scene.add.graphics().setDepth(-9);
  return { solids, obstacles, herbs, chests, water };
}

export function safePosition(x: number, y: number, obstacles: Rect[]): boolean {
  return !obstacles.some(
    (r) => x + 12 > r.x && x - 12 < r.x + r.w && y > r.y && y - 20 < r.y + r.h,
  );
}
