import Phaser from 'phaser';
import { areaObstacles, type AreaDefinition } from '../content/world';
export { safePosition } from '../content/world';
import type { GameState, Rect } from '../domain/types';
import { terrainTiles } from './terrain';

export interface WorldView {
  solids: Phaser.Physics.Arcade.StaticGroup;
  occluders: Phaser.GameObjects.Image[];
  obstacles: Rect[];
  herbs: Map<string, Phaser.GameObjects.Image>;
  chests: Map<string, Phaser.GameObjects.Image>;
  water: Phaser.GameObjects.Graphics;
}

export function buildWorld(scene: Phaser.Scene, state: GameState, area: AreaDefinition): WorldView {
  const occluders: Phaser.GameObjects.Image[] = [];
  const solids = scene.physics.add.staticGroup();
  const obstacles = areaObstacles(area);
  const herbs = new Map<string, Phaser.GameObjects.Image>();
  const chests = new Map<string, Phaser.GameObjects.Image>();
  for (const r of obstacles)
    solids.add(scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0, 0));
  const prop = (x: number, y: number, key: string, scale = 2): Phaser.GameObjects.Image =>
    scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(y);
  for (const { x, y, detail } of terrainTiles(area)) {
    const variant = ((x / 128) * 3 + (y / 128) * 7) % 4;
    scene.add.image(x, y, `${area.terrainKey}/ground-${variant}`).setOrigin(0).setDepth(-10);
    if (detail)
      scene.add.image(x, y, `${area.terrainKey}/detail-${x}-${y}`).setOrigin(0).setDepth(-9.5);
  }
  for (const item of area.props) prop(item.x, item.y, `${area.terrainKey}/${item.kind}`);

  area.houses.forEach((house) => {
    occluders.push(prop(house.x, house.y, `${area.terrainKey}/house-${house.style}`));
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
  area.groves.forEach((grove, index) => {
    for (let y = grove.y; y < grove.y + grove.h; y += 76)
      for (let x = grove.x; x < grove.x + grove.w; x += 70) {
        const offset = (Math.floor(y / 76) % 2) * 22;
        // Deterministic silhouette mix keeps groves varied without extra data.
        const variant = ['', '-b', '-c'][(Math.floor(x / 70) + Math.floor(y / 76) + index) % 3]!;
        occluders.push(
          prop(x + offset, y, `${area.terrainKey}/tree${variant}`, index % 3 === 0 ? 2 : 1.5),
        );
      }
  });
  for (const { x, y } of area.rocks) {
    prop(x, y, `${area.terrainKey}/rock`);
  }
  for (const { x, y } of area.pillars) {
    prop(x, y, `${area.terrainKey}/pillar`);
  }
  if (area.well) prop(area.well.x, area.well.y, `${area.terrainKey}/well`);
  if (area.camp) prop(area.camp.x, area.camp.y, `${area.terrainKey}/camp`, 1.5);
  area.npcs.forEach((npc) => {
    prop(npc.x, npc.y, npc.color, 1.6);
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
  area.herbs.forEach((herb) => {
    if (!state.world.gathered.includes(herb.id))
      herbs.set(herb.id, prop(herb.x, herb.y, 'herb', 1.5));
  });
  area.chests.forEach((chest) => {
    const sprite = prop(chest.x, chest.y, 'chest', 1.8);
    if (state.world.opened.includes(chest.id)) sprite.setTint(0x777777);
    chests.set(chest.id, sprite);
  });
  for (const exit of area.exits) {
    scene.add
      .rectangle(exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w, exit.h, 0xe8ca81, 0.25)
      .setDepth(-8);
    scene.add
      .text(exit.x + exit.w / 2, exit.y - 16, exit.label, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#fff0ba',
        stroke: '#243a32',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6000);
  }
  const water = scene.add.graphics().setDepth(-9);
  return { solids, obstacles, herbs, chests, water, occluders };
}
