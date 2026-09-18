import { describe, expect, it } from 'vitest';
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
      JSON.stringify({ version: 2, savedAt: new Date().toISOString(), state: newGame() }),
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
});
