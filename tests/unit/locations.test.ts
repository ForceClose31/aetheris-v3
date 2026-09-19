import { expect, it } from 'vitest';
import { ENEMIES } from '../../src/content/catalog';
import { AREAS, AREA_ORIGINS, LEGACY_AREA, safeLocation } from '../../src/content/world';
import { newGame, recoverFromDefeat } from '../../src/domain/progression';
import type { MapId } from '../../src/domain/types';
import { SaveStore, validateState } from '../../src/platform/save';

// Original v1 shape, deliberately independent of newGame().
const legacy = {
  version: 1,
  savedAt: '2026-09-18T00:00:00.000Z',
  state: {
    player: {
      level: 10,
      xp: 12,
      hp: 100,
      stamina: 63,
      gold: 177,
      job: 'mage',
      weapon: 'iron-sword',
      inventory: { herb: 4, tonic: 7, 'wood-sword': 1, 'iron-sword': 1 },
      position: { x: 500, y: 690 },
    },
    world: {
      seconds: 900,
      kills: { slime: 12, wolf: 3, golem: 1 },
      gathered: ['leaf-1', 'leaf-9'],
      opened: ['wayside-cache', 'forest-cache'],
      quests: { supplies: 'complete', sentinel: 'active' },
      questKills: 4,
      bossDefeated: true,
      merchantStock: 3,
    },
  },
};

const legacyIds: MapId[] = ['larkhaven', 'mossveil', 'old-watch'];

it('partitions every existing NPC, resource, chest and enemy exactly once', () => {
  for (const field of ['npcs', 'herbs', 'chests'] as const)
    expect(
      Object.entries(AREAS)
        .filter(([id]) => legacyIds.includes(id as MapId))
        .flatMap(([, a]) => a[field].map((p) => p.id))
        .sort(),
    ).toEqual(LEGACY_AREA[field].map((p) => p.id).sort());
  const spawns = Object.entries(AREAS).flatMap(([id, area]) =>
    (legacyIds as string[]).includes(id)
      ? area.spawns.map((p) => ({ ...p, x: p.x + AREA_ORIGINS[id as MapId].x }))
      : [],
  );
  expect(spawns).toHaveLength(LEGACY_AREA.spawns.length);
  expect(spawns).toEqual(expect.arrayContaining(LEGACY_AREA.spawns));
  expect(AREAS.larkhaven.spawns).toEqual([]);
  expect(AREAS.mossveil.spawns).toHaveLength(9);
  expect(AREAS['old-watch'].spawns.map((p) => p.kind)).toEqual(['golem']);
});

it('registers the Phase 7 areas with gated archive and shortcut transitions', () => {
  expect(Object.keys(AREAS).sort()).toEqual([
    'interior-chapel',
    'interior-farm',
    'interior-forge',
    'interior-guild',
    'interior-healer',
    'interior-inn',
    'larkhaven',
    'mossveil',
    'north-cave',
    'north-road',
    'old-watch',
    'watch-crypt',
    'watch-vault',
  ]);
  const state = newGame();
  const vaultExit = AREAS['old-watch'].exits.find((exit) => exit.id === 'watch-vault')!;
  expect(vaultExit.gate?.unlocked(state)).toBe(false);
  state.world.bossDefeated = true;
  expect(vaultExit.gate?.unlocked(state)).toBe(true);
  const shortcut = AREAS['north-road'].exits.find((exit) => exit.id === 'north-shortcut')!;
  expect(shortcut.gate?.unlocked(state)).toBe(false);
  state.world.opened.push('north-road-cache');
  expect(shortcut.gate?.unlocked(state)).toBe(true);
  const watchSide = AREAS['old-watch'].exits.find((exit) => exit.id === 'watch-north')!;
  expect(watchSide.gate?.unlocked(state)).toBe(true);
  expect(AREAS['north-road'].spawns.every((spawn) => spawn.kind !== 'golem')).toBe(true);
  expect(AREAS['watch-vault'].spawns.map((spawn) => spawn.kind)).toEqual([
    'automaton',
    'automaton',
  ]);
});

it('connects all exits in both directions with safe, non-aggro entries and distinct terrain', () => {
  expect(new Set(Object.values(AREAS).map((a) => a.terrainKey)).size).toBe(13);
  for (const [id, area] of Object.entries(AREAS)) {
    expect(safeLocation(area, area.spawn)).toBe(true);
    for (const exit of area.exits) {
      const target = AREAS[exit.target];
      const entry = target.entries[exit.entry];
      expect(target.exits.some((back) => back.target === id)).toBe(true);
      expect(safeLocation(target, entry)).toBe(true);
      for (const enemy of target.spawns)
        expect(Math.hypot(enemy.x - entry.x, enemy.y - entry.y)).toBeGreaterThan(
          ENEMIES[enemy.kind].aggro,
        );
    }
  }
});

it.each([
  ['larkhaven', { x: 500, y: 690 }, { x: 500, y: 690 }],
  ['mossveil', { x: 1110, y: 802 }, { x: 286, y: 802 }],
  ['old-watch', { x: 1380, y: 365 }, { x: 180, y: 365 }],
  ['larkhaven', { x: 250, y: 400 }, AREAS.larkhaven.spawn],
  ['mossveil', { x: 850, y: 500 }, AREAS.mossveil.spawn],
  ['old-watch', { x: 1286, y: 228 }, AREAS['old-watch'].spawn],
] as const)(
  'migrates v1 to %s with correct coordinates/fallback and unchanged progression',
  (mapId, position, expected) => {
    const fixture = structuredClone(legacy);
    fixture.state.player.position = { ...position };
    const original = JSON.stringify(fixture);
    let stored = original;
    const store = new SaveStore({
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    });
    const loaded = store.read(1)!;
    expect(loaded.version).toBe(5);
    expect(loaded.state).toEqual({
      world: {
        ...fixture.state.world,
        kills: { ...fixture.state.world.kills, automaton: 0 },
        milestones: ['found-old-watch'],
      },
      player: {
        level: 10,
        xp: 12,
        hp: 100,
        stamina: 63,
        gold: 177,
        job: 'mage',
        mapId,
        position: expected,
        equipment: { weapon: 'iron-sword', body: null, head: null },
        inventory: {
          herb: 4,
          tonic: 7,
          'wood-sword': 1,
          'iron-sword': 1,
          'steel-sword': 0,
          'padded-vest': 0,
          'leather-cap': 0,
        },
      },
    });
    expect(stored).toBe(original);
    expect(store.write(1, loaded.state).ok).toBe(true);
    expect(store.read(1)?.state).toEqual(loaded.state);
  },
);

it('rejects invalid map IDs, per-map bounds and bad legacy data without replacing the slot', () => {
  const state = newGame();
  expect(validateState({ ...state, player: { ...state.player, mapId: 'toString' } })).toBe(false);
  state.player.position.x = 1200;
  expect(validateState(state)).toBe(false);
  const bad = structuredClone(legacy);
  bad.state.player.gold = -1;
  let stored = JSON.stringify(bad);
  const store = new SaveStore({
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  });
  expect(store.read(1)).toBeNull();
  expect(JSON.parse(stored)).toEqual(bad);
  stored = JSON.stringify(legacy);
  const denied = new SaveStore({
    getItem: () => stored,
    setItem: () => {
      throw new Error('Quota');
    },
  });
  expect(denied.write(1, denied.read(1)!.state).ok).toBe(false);
  expect(JSON.parse(stored)).toEqual(legacy);
});

it('round trips each current map and recovers from the watch to Larkhaven', () => {
  let raw = '';
  const store = new SaveStore({
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
  });
  for (const mapId of Object.keys(AREAS) as MapId[]) {
    const state = newGame();
    state.player.mapId = mapId;
    state.player.position = { ...AREAS[mapId].spawn };
    expect(store.write(1, state).ok).toBe(true);
    expect(store.read(1)?.state).toEqual(state);
  }
  const state = store.read(1)!.state;
  state.world.gathered = ['leaf-1'];
  recoverFromDefeat(state);
  expect(state.player.mapId).toBe('larkhaven');
  expect(state.player.position).toEqual(AREAS.larkhaven.spawn);
  expect(state.world.gathered).toEqual(['leaf-1']);
});
