import { ITEMS, JOBS } from '../content/catalog';
import { AREAS, AREA_ORIGINS, LEGACY_AREA, legacyMapAt, safeLocation } from '../content/world';
import { maxHp, xpNeeded } from '../domain/progression';
import type { EquipSlot, GameState, ItemId, MapId } from '../domain/types';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface SaveRecord {
  version: 3;
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

// Payload shapes: v1 = legacy world + weapon field; v2 = split maps + weapon field;
// v3 = current, equipment record instead of weapon. Each is validated with its own rules.
function validatePayload(value: unknown, version: 1 | 2 | 3 = 3): boolean {
  if (!object(value) || !object(value.player) || !object(value.world)) return false;
  const p = value.player;
  const w = value.world;
  if (version !== 1 && (typeof p.mapId !== 'string' || !Object.hasOwn(AREAS, p.mapId)))
    return false;
  if (version === 3) {
    const slotItem = (item: unknown, slot: EquipSlot): boolean =>
      typeof item === 'string' &&
      Object.hasOwn(ITEMS, item) &&
      ITEMS[item as ItemId].slot === slot &&
      item !== 'herb' &&
      item !== 'tonic';
    const eq = p.equipment;
    if (
      !object(eq) ||
      !slotItem(eq.weapon, 'weapon') ||
      !(eq.body === null || slotItem(eq.body, 'body')) ||
      !(eq.head === null || slotItem(eq.head, 'head'))
    )
      return false;
  } else if (!['wood-sword', 'iron-sword'].includes(String(p.weapon))) return false;
  const area = version === 1 ? LEGACY_AREA : AREAS[p.mapId as MapId];
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
  const inventoryKeys =
    version === 3 ? Object.keys(ITEMS) : ['herb', 'tonic', 'wood-sword', 'iron-sword'];
  if (
    !object(p.inventory) ||
    !inventoryKeys.every((key) => integer((p.inventory as Record<string, unknown>)[key], 0))
  )
    return false;
  if (
    !object(p.position) ||
    !number(p.position.x, 20, area.width - 20) ||
    !number(p.position.y, 20, area.height - 20)
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
  // Legacy payloads have no equipment record; their HP ceiling uses the old formula.
  if (version !== 3) {
    const jobHp = p.job && typeof p.job === 'string' ? JOBS[p.job as keyof typeof JOBS].hp : 0;
    return number(p.hp, 1, 70 + (Number(p.level) - 1) * 9 + jobHp);
  }
  return typed.player.hp <= maxHp(typed.player);
}

export function validateState(value: unknown): value is GameState {
  return validatePayload(value, 3);
}

// v1/v2 payloads carry a `weapon` field; the migrated v3 state keeps an equipment
// record as the single source of truth. Idempotent: migrated output has no weapon
// field left to map again, and ownership of the equipped weapon is repaired.
function migrateLegacy(value: unknown, from: 1 | 2): GameState | null {
  if (!validatePayload(value, from)) return null;
  const state = structuredClone(value) as GameState & { player: { weapon?: string } };
  const p = state.player;
  if (from === 1) {
    p.mapId = legacyMapAt(p.position);
    const origin = AREA_ORIGINS[p.mapId];
    const area = AREAS[p.mapId];
    p.position = { x: p.position.x - origin.x, y: p.position.y - origin.y };
    if (!safeLocation(area, p.position)) p.position = { ...area.spawn };
  }
  const weapon = p.weapon as ItemId;
  delete p.weapon;
  p.equipment = { weapon, body: null, head: null };
  const inventory = p.inventory as Record<string, unknown>;
  for (const id of Object.keys(ITEMS))
    if (!Number.isFinite(Number(inventory[id]))) inventory[id] = 0;
  if (inventory[weapon] === 0) inventory[weapon] = 1;
  return validateState(state) ? state : null;
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
        (record.version !== 1 && record.version !== 2 && record.version !== 3) ||
        typeof record.savedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.savedAt))
      )
        return null;
      const state =
        record.version === 3
          ? record.state
          : migrateLegacy(record.state, record.version === 1 ? 1 : 2);
      if (!state || !validateState(state)) return null;
      return { version: 3, savedAt: record.savedAt, state };
    } catch {
      return null;
    }
  }

  write(slot: number, state: GameState): SaveResult {
    if (!integer(slot, 1, 3) || !validateState(state))
      return { ok: false, message: 'Data tidak valid; penyimpanan sebelumnya tetap aman.' };
    try {
      const record: SaveRecord = { version: 3, savedAt: new Date().toISOString(), state };
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
