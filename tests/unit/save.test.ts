import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/domain/types';
import { newGame } from '../../src/domain/progression';
import { SaveStore, validateState, type StoragePort } from '../../src/platform/save';

function storage(): StoragePort {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

describe('versioned browser saves', () => {
  it('round trips complete progression with independent slots', () => {
    const store = new SaveStore(storage());
    const state = newGame();
    state.player.gold = 77;
    state.world.gathered.push('leaf-1');
    expect(store.write(1, state).ok).toBe(true);
    store.write(2, newGame());
    expect(store.read(1)?.state).toEqual(state);
    expect(store.read(2)?.state.player.gold).toBe(12);
    expect(store.read(3)).toBeNull();
  });
  it('rejects malformed JSON, unsupported versions and invalid data without crashing', () => {
    const data = storage();
    const store = new SaveStore(data);
    for (const raw of [
      '{broken',
      'null',
      '{}',
      JSON.stringify({ version: 99, savedAt: new Date().toISOString(), state: newGame() }),
    ]) {
      data.setItem('aetheris:save:1', raw);
      expect(store.read(1)).toBeNull();
    }
    const state = newGame();
    state.player.position.x = NaN;
    expect(validateState(state)).toBe(false);
    expect(store.write(1, state).ok).toBe(false);
  });
  it('keeps an existing save when a later state is invalid', () => {
    const store = new SaveStore(storage());
    store.write(1, newGame());
    const state = newGame();
    state.player.gold = -1;
    expect(store.write(1, state).ok).toBe(false);
    expect(store.read(1)?.state.player.gold).toBe(12);
    expect(store.write(4, newGame()).ok).toBe(false);
  });
  it('handles storage denial and quota errors honestly', () => {
    const store = new SaveStore({
      getItem: () => {
        throw new Error('Denied');
      },
      setItem: () => {
        throw new Error('Quota');
      },
    });
    expect(store.read(1)).toBeNull();
    expect(store.write(1, newGame()).ok).toBe(false);
  });
  it('rejects contradictory progression and prototype job names', () => {
    const state = newGame();
    state.world.quests.sentinel = 'complete';
    expect(validateState(state)).toBe(false);
    const raw = newGame() as unknown as { player: { job: string; level: number } };
    raw.player.level = 10;
    raw.player.job = 'toString';
    expect(validateState(raw)).toBe(false);
  });
  it('migrates version 2 payloads to equipment, idempotently across reloads', () => {
    const v2 = {
      version: 2,
      savedAt: '2026-09-19T00:00:00.000Z',
      state: {
        player: {
          mapId: 'mossveil',
          level: 4,
          xp: 10,
          hp: 90,
          stamina: 55,
          gold: 60,
          job: null,
          weapon: 'iron-sword',
          inventory: { herb: 2, tonic: 1, 'wood-sword': 1, 'iron-sword': 1 },
          position: { x: 286, y: 802 },
        },
        world: {
          seconds: 240,
          kills: { slime: 5, wolf: 1, golem: 0 },
          gathered: ['leaf-2'],
          opened: [],
          quests: { supplies: 'complete', sentinel: 'active' },
          questKills: 3,
          bossDefeated: false,
          merchantStock: 5,
        },
      },
    };
    let stored = JSON.stringify(v2);
    const store = new SaveStore({
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    });
    const migrated = store.read(1)!.state;
    expect(migrated.player.equipment).toEqual({ weapon: 'iron-sword', body: null, head: null });
    expect(migrated.player).not.toHaveProperty('weapon');
    expect(migrated.player.mapId).toBe('mossveil');
    expect(migrated.player.inventory).toEqual({
      herb: 2,
      tonic: 1,
      'wood-sword': 1,
      'iron-sword': 1,
      'steel-sword': 0,
      'padded-vest': 0,
      'leather-cap': 0,
    });
    expect(store.write(1, migrated).ok).toBe(true);
    expect(store.read(1)!.state).toEqual(migrated);
  });
  it('rejects corrupt or wrong-slot equipment ids instead of half-valid states', () => {
    const migrated = newGame();
    for (const equipment of [
      { weapon: 'banana', body: null, head: null },
      { weapon: 'padded-vest', body: null, head: null },
      { weapon: 'iron-sword', body: 'iron-sword', head: null },
      { weapon: 'iron-sword', body: 'banana', head: null },
      { weapon: 'iron-sword', body: null, head: 'wood-sword' },
      { weapon: 'wood-sword', body: null, head: 'herb' },
    ] as unknown as GameState['player']['equipment'][]) {
      const state = structuredClone(migrated);
      state.player.equipment = equipment;
      expect(validateState(state)).toBe(false);
    }
    expect(validateState(migrated)).toBe(true);
  });
});
