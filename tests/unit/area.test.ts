import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { LEGACY_AREA, regionAt, START_POSITION } from '../../src/content/world';
import { newGame, recoverFromDefeat } from '../../src/domain/progression';
import { Effects } from '../../src/game/effects';
import { InteractionSystem } from '../../src/game/interactions';
import { SaveStore } from '../../src/platform/save';
import { buildWorld, safePosition } from '../../src/rendering/world';
import type { GameInterface } from '../../src/ui/interface';
import { drawMap } from '../../src/ui/map';

vi.mock('phaser', () => ({ default: {} }));

it('preserves legacy content identities, region boundaries and recovery location', () => {
  expect([LEGACY_AREA.width, LEGACY_AREA.height]).toEqual([1920, 1408]);
  expect(LEGACY_AREA.physicsBounds).toEqual({ x: 30, y: 40, w: 1860, h: 1338 });
  expect(LEGACY_AREA.npcs.map((npc) => npc.id)).toEqual(['mara', 'elian', 'borin', 'sera']);
  expect(LEGACY_AREA.herbs.map((herb) => herb.id)).toEqual(
    Array.from({ length: 9 }, (_, i) => `leaf-${i + 1}`),
  );
  expect(LEGACY_AREA.chests.map((chest) => chest.id)).toEqual(['wayside-cache', 'forest-cache']);
  expect(LEGACY_AREA.spawns.filter((spawn) => spawn.kind === 'slime')).toHaveLength(6);
  expect(LEGACY_AREA.spawns.filter((spawn) => spawn.kind === 'wolf')).toHaveLength(3);
  expect(LEGACY_AREA.spawns.filter((spawn) => spawn.kind === 'golem')).toEqual([
    { kind: 'golem', x: 1380, y: 285 },
  ]);
  for (const [x, y, name] of [
    [823, 300, 'Larkhaven'],
    [824, 300, 'Mossveil Woods'],
    [1200, 409, 'Mossveil Woods'],
    [1201, 409, 'The Old Watch'],
    [1380, 410, 'Mossveil Woods'],
  ] as const)
    expect(regionAt(LEGACY_AREA, x, y).name).toBe(name);
  const state = newGame();
  state.player.position = { x: 1500, y: 300 };
  recoverFromDefeat(state);
  expect(state.player.position).toEqual(START_POSITION);
  expect(state.player.position).not.toBe(START_POSITION);
});

it('uses the supplied area for world collision, interactions, water and atlas markers', () => {
  const area = {
    ...LEGACY_AREA,
    width: 640,
    height: 480,
    terrainKey: 'test-terrain',
    river: { x: 400, width: 96, bridgeY: 160, bridgeHeight: 92 },
    houses: [],
    groves: [],
    rocks: [],
    pillars: [],
    npcs: [],
    well: { x: 80, y: 90 },
    camp: { x: 40, y: 350 },
    herbs: [{ id: 'test-leaf', x: 240, y: 300 }],
    chests: [{ id: 'test-cache', x: 340, y: 300 }],
    spawns: [{ kind: 'golem' as const, x: 550, y: 90 }],
    atlas: { ...LEGACY_AREA.atlas, labels: [{ x: 100, y: 100, text: 'Test', fontSize: 18 }] },
    regions: [],
    defaultRegion: { name: 'Test', subtitle: 'Test area' },
  };
  const image = {
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  const graphics = {
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn(),
    lineBetween: vi.fn(),
  };
  const rectangle = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { image: vi.fn(() => image), rectangle: vi.fn(() => rectangle), graphics: () => graphics },
    physics: { add: { staticGroup: () => ({ add: vi.fn() }) } },
    cameras: { main: { width: 320, height: 240, zoom: 1 } },
  } as unknown as Phaser.Scene;
  const state = newGame();
  state.world.quests.sentinel = 'active';
  const view = buildWorld(scene, state, area);
  expect(scene.add.image).toHaveBeenCalledWith(0, 0, 'test-terrain');
  expect(view.obstacles).toContainEqual({ x: 400, y: 0, w: 96, h: 160 });
  expect(view.obstacles).toContainEqual({ x: 400, y: 252, w: 96, h: 228 });
  expect(safePosition(448, 200, view.obstacles)).toBe(true);
  expect(safePosition(448, 300, view.obstacles)).toBe(false);
  expect(scene.add.image).toHaveBeenCalledWith(80, 90, 'well');
  const ui = { toast: vi.fn() } as unknown as GameInterface;
  const interactions = new InteractionSystem(state, ui, view, vi.fn(), area);
  expect(interactions.nearby(area.herbs[0]!)).toBe('Petik Moonleaf');
  interactions.interact();
  expect(state.world.gathered).toEqual(['test-leaf']);
  expect(view.herbs.size).toBe(0);
  expect(interactions.nearby({ x: 500, y: 585 })).toBe('');
  new Effects(scene, area).update(0, 0, graphics as unknown as Phaser.GameObjects.Graphics);
  expect(graphics.lineBetween).toHaveBeenCalled();
  for (const [x, y] of graphics.lineBetween.mock.calls) {
    expect(x).toBeGreaterThanOrEqual(area.river.x);
    expect(y).toBeLessThan(area.height);
    expect(y <= 156 || y >= 258).toBe(true);
  }
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  };
  const canvas = {
    width: 320,
    height: 240,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  drawMap(canvas, state, area, true);
  expect(context.strokeRect).toHaveBeenCalledWith(271, 41, 8, 8);
  expect(context.fillText).toHaveBeenCalledExactlyOnceWith('Test', 50, 50);
  expect(regionAt(area, 500, 585).name).toBe('Test');
});

it('round trips an original version 1 payload without adding area or equipment fields', () => {
  const record = {
    version: 1,
    savedAt: '2026-09-18T00:00:00.000Z',
    state: {
      player: {
        level: 1,
        xp: 0,
        hp: 70,
        stamina: 100,
        gold: 12,
        job: null,
        weapon: 'wood-sword',
        inventory: { herb: 0, tonic: 3, 'wood-sword': 1, 'iron-sword': 0 },
        position: { x: 464, y: 690 },
      },
      world: {
        seconds: 0,
        kills: { slime: 0, wolf: 0, golem: 0 },
        gathered: [],
        opened: [],
        quests: { supplies: 'available', sentinel: 'available' },
        questKills: 0,
        bossDefeated: false,
        merchantStock: 8,
      },
    },
  };
  let stored = JSON.stringify(record);
  const store = new SaveStore({
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  });
  const loaded = store.read(1);
  expect(loaded).toEqual(record);
  expect(store.write(1, loaded!.state)).toEqual({ ok: true });
  expect(JSON.parse(stored)).toMatchObject({ version: 1, state: record.state });
});
