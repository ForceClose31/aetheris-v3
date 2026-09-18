import { JOBS } from '../content/catalog';
import { WORLD } from '../content/world';
import { maxHp, xpNeeded } from '../domain/progression';
import type { GameState } from '../domain/types';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface SaveRecord {
  version: 1;
  savedAt: string;
  state: GameState;
}
export type SaveResult = { ok: true } | { ok: false; message: string };
const prefix = 'aetheris:save:';
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max = 1_000_000): value is number =>
  number(value, min, max) && Number.isInteger(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length < 1000 &&
  value.every((entry: unknown) => typeof entry === 'string' && entry.length < 100);
const stage = (value: unknown): boolean =>
  ['available', 'active', 'complete'].includes(String(value));

export function validateState(value: unknown): value is GameState {
  if (!object(value) || !object(value.player) || !object(value.world)) return false;
  const p = value.player;
  const w = value.world;
  if (
    !integer(p.level, 1, 100) ||
    !number(p.xp, 0, xpNeeded(p.level)) ||
    !number(p.hp, 1, 2000) ||
    !number(p.stamina, 0, 100) ||
    !integer(p.gold, 0)
  )
    return false;
  if (p.job !== null && (typeof p.job !== 'string' || !Object.hasOwn(JOBS, p.job) || p.level < 10))
    return false;
  if (!['wood-sword', 'iron-sword'].includes(String(p.weapon))) return false;
  if (
    !object(p.inventory) ||
    !['herb', 'tonic', 'wood-sword', 'iron-sword'].every((key) =>
      integer((p.inventory as Record<string, unknown>)[key], 0),
    )
  )
    return false;
  if (
    !object(p.position) ||
    !number(p.position.x, 20, WORLD.width - 20) ||
    !number(p.position.y, 20, WORLD.height - 20)
  )
    return false;
  if (
    !number(w.seconds, 0, 1e10) ||
    !object(w.kills) ||
    !['slime', 'wolf', 'golem'].every((key) =>
      integer((w.kills as Record<string, unknown>)[key], 0),
    )
  )
    return false;
  if (
    !strings(w.gathered) ||
    !strings(w.opened) ||
    !integer(w.questKills, 0) ||
    !integer(w.merchantStock, 0, 8) ||
    typeof w.bossDefeated !== 'boolean'
  )
    return false;
  if (!object(w.quests) || !stage(w.quests.supplies) || !stage(w.quests.sentinel)) return false;
  if (w.quests.sentinel !== 'available' && w.quests.supplies !== 'complete') return false;
  if (w.quests.sentinel === 'complete' && !w.bossDefeated) return false;
  const typed = value as unknown as GameState;
  return typed.player.hp <= maxHp(typed.player);
}

export class SaveStore {
  constructor(private readonly storage: StoragePort) {}

  read(slot: number): SaveRecord | null {
    try {
      const raw = this.storage.getItem(prefix + slot);
      if (!raw) return null;
      const record: unknown = JSON.parse(raw);
      if (
        !object(record) ||
        record.version !== 1 ||
        typeof record.savedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.savedAt)) ||
        !validateState(record.state)
      )
        return null;
      return record as unknown as SaveRecord;
    } catch {
      return null;
    }
  }

  write(slot: number, state: GameState): SaveResult {
    if (!integer(slot, 1, 3) || !validateState(state))
      return { ok: false, message: 'Data tidak valid; penyimpanan sebelumnya tetap aman.' };
    try {
      const record: SaveRecord = { version: 1, savedAt: new Date().toISOString(), state };
      this.storage.setItem(prefix + slot, JSON.stringify(record));
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: 'Browser menolak penyimpanan. Periksa ruang penyimpanan atau mode privat.',
      };
    }
  }
}

export function browserStorage(): StoragePort {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}
