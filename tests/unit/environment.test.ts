import { expect, it } from 'vitest';
import { AREAS, areaObstacles, contains, safePosition } from '../../src/content/world';
import {
  environmentPalette,
  groundOrnaments,
  terrainTiles,
  TILE_SIZE,
} from '../../src/rendering/terrain';

it('keeps every interaction, entry and exit connected with player footprint clearance', () => {
  for (const area of Object.values(AREAS)) {
    const obstacles = areaObstacles(area);
    const b = area.physicsBounds;
    const step = 8;
    const open = (x: number, y: number) =>
      x >= b.x + 12 &&
      x <= b.x + b.w - 12 &&
      y >= b.y + 20 &&
      y <= b.y + b.h &&
      safePosition(x, y, obstacles);
    const start = {
      x: Math.round(area.spawn.x / step) * step,
      y: Math.round(area.spawn.y / step) * step,
    };
    const queue = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const x = p.x + dx!,
          y = p.y + dy!,
          key = `${x},${y}`;
        if (!visited.has(key) && open(x, y)) {
          visited.add(key);
          queue.push({ x, y });
        }
      }
    }
    for (const target of [
      ...area.npcs,
      ...area.chests,
      ...area.herbs,
      ...(area.camp ? [area.camp] : []),
    ])
      expect(
        queue.some((p) => Math.hypot(p.x - target.x, p.y - target.y) < 64),
        `${area.terrainKey}: interaction ${target.x},${target.y}`,
      ).toBe(true);
    for (const entry of Object.values(area.entries))
      expect(
        queue.some((p) => Math.hypot(p.x - entry.x, p.y - entry.y) <= step),
        `${area.terrainKey}: entry`,
      ).toBe(true);
    for (const exit of area.exits)
      expect(
        queue.some((p) => contains(exit, p)),
        `${area.terrainKey}: ${exit.id}`,
      ).toBe(true);
  }
});

it('uses bounded layered tiles and distinct palettes instead of a world-sized texture', () => {
  expect(new Set(Object.values(AREAS).map((a) => environmentPalette(a).join())).size).toBe(3);
  expect(new Set(Object.values(AREAS).map((a) => groundOrnaments(a).join())).size).toBe(3);
  for (const area of Object.values(AREAS)) {
    const tiles = terrainTiles(area);
    expect(tiles).toHaveLength(
      Math.ceil(area.width / TILE_SIZE) * Math.ceil(area.height / TILE_SIZE),
    );
    expect(tiles.some((t) => t.detail)).toBe(true);
    expect(tiles.some((t) => !t.detail)).toBe(true);
  }
  expect(new Set(AREAS.larkhaven.houses.map((h) => h.style)).size).toBe(4);
});
