import { BALANCE, ENEMIES, ITEMS, JOBS } from '../content/catalog';
import { recordMilestone } from './objectives';
import { START_POSITION } from '../content/world';
import type { EquipSlot, EnemyId, GameState, ItemId, JobId, PlayerState } from './types';

export function newGame(): GameState {
  return {
    player: {
      mapId: 'larkhaven',
      level: 1,
      xp: 0,
      hp: 70,
      stamina: 100,
      gold: 12,
      job: null,
      equipment: { weapon: 'wood-sword', body: null, head: null },
      inventory: {
        herb: 0,
        tonic: 3,
        'wood-sword': 1,
        'iron-sword': 0,
        'steel-sword': 0,
        'padded-vest': 0,
        'leather-cap': 0,
      },
      position: { ...START_POSITION },
    },
    world: {
      seconds: 0,
      kills: { slime: 0, wolf: 0, golem: 0, automaton: 0 },
      gathered: [],
      opened: [],
      milestones: [],
      quests: { supplies: 'available', sentinel: 'available' },
      questKills: 0,
      bossDefeated: false,
      merchantStock: 8,
    },
  };
}
export const xpNeeded = (level: number): number => Math.round(45 + level * 19 + level ** 1.5 * 5);
export const maxHp = (player: PlayerState): number =>
  70 +
  (player.level - 1) * 9 +
  (player.job ? JOBS[player.job].hp : 0) +
  (player.equipment.body ? (ITEMS[player.equipment.body].hp ?? 0) : 0) +
  (player.equipment.head ? (ITEMS[player.equipment.head].hp ?? 0) : 0);
export const attackPower = (player: PlayerState): number =>
  11 +
  (player.level - 1) * 2 +
  (ITEMS[player.equipment.weapon].attack ?? 0) +
  (player.job ? JOBS[player.job].damage : 0);

// Equipping never heals: when the maximum drops, current HP is clamped instead.
function clampHp(player: PlayerState): void {
  player.hp = Math.min(player.hp, maxHp(player));
}

export function equipItem(state: GameState, id: ItemId): boolean {
  const slot = ITEMS[id]?.slot;
  const player = state.player;
  if (!slot || player.inventory[id] < 1 || player.equipment[slot] === id) return false;
  player.equipment[slot] = id;
  clampHp(player);
  return true;
}

// The weapon slot always holds a sword; body/head return to the base appearance.
export function unequipSlot(state: GameState, slot: EquipSlot): boolean {
  const player = state.player;
  if (slot === 'weapon' || player.equipment[slot] === null) return false;
  player.equipment[slot] = null;
  clampHp(player);
  return true;
}

export function grantXp(player: PlayerState, amount: number): number {
  player.xp += Math.max(0, amount);
  const previous = player.level;
  while (player.level < BALANCE.maxLevel && player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    player.level++;
    player.hp = maxHp(player);
  }
  if (player.level === BALANCE.maxLevel) player.xp = 0;
  return player.level - previous;
}

export function chooseJob(player: PlayerState, id: JobId): boolean {
  if (player.level < 10 || player.job !== null || !JOBS[id]) return false;
  player.job = id;
  player.hp = maxHp(player);
  return true;
}

export function defeatEnemy(state: GameState, kind: EnemyId): number {
  state.world.kills[kind]++;
  if (kind === 'slime' && state.world.quests.supplies === 'active') state.world.questKills++;
  if (kind === 'golem') state.world.bossDefeated = true;
  state.player.gold += ENEMIES[kind].gold;
  return grantXp(state.player, ENEMIES[kind].xp);
}

export function suppliesReady(state: GameState): boolean {
  return (
    state.world.quests.supplies === 'active' &&
    state.world.questKills >= 3 &&
    state.player.inventory.herb >= 3
  );
}

export function completeSupplies(state: GameState): boolean {
  if (!suppliesReady(state)) return false;
  state.player.inventory.herb -= 3;
  state.player.gold += 30;
  state.player.inventory.tonic += 2;
  grantXp(state.player, 100);
  state.world.quests.supplies = 'complete';
  state.world.quests.sentinel = 'active';
  // Marks that THIS save passed supplies under the integrated campaign; saves
  // without it are grandfathered out of the investigation chain.
  recordMilestone(state, 'supplies-reported');
  return true;
}

export function completeSentinel(state: GameState): boolean {
  if (state.world.quests.sentinel !== 'active' || !state.world.bossDefeated) return false;
  state.world.quests.sentinel = 'complete';
  state.player.gold += 100;
  grantXp(state.player, 200);
  return true;
}

// Campaign resolution: Mara receives the archive findings. Requires the warden
// report (sentinel complete) and all vault evidence; the reward is granted once.
export function reportVaultFindings(state: GameState): boolean {
  const w = state.world;
  const evidence =
    w.milestones.includes('vault-seal-a') &&
    w.milestones.includes('vault-seal-b') &&
    w.milestones.includes('vault-note-read');
  if (w.quests.sentinel !== 'complete' || !evidence) return false;
  if (!recordMilestone(state, 'campaign-complete')) return false;
  state.player.gold += 80;
  state.player.inventory.tonic += 2;
  grantXp(state.player, 200);
  // The safe road lets supplies flow again: Borin restocks once, capped at 8.
  state.world.merchantStock = Math.min(8, state.world.merchantStock + 4);
  return true;
}

export function useTonic(player: PlayerState): boolean {
  if (player.inventory.tonic < 1 || player.hp >= maxHp(player)) return false;
  player.inventory.tonic--;
  player.hp = Math.min(maxHp(player), player.hp + 45);
  return true;
}

// Consumables stack; equipment pieces are unique and auto-equip on purchase,
// preserving the existing iron-sword "langsung dipakai" flow.
export function buyItem(state: GameState, item: ItemId): boolean {
  const price = ITEMS[item]?.price;
  if (!price) return false;
  if (state.player.gold < price) return false;
  if (item === 'tonic') {
    if (state.world.merchantStock < 1) return false;
    state.world.merchantStock--;
    state.player.inventory.tonic++;
    return true;
  }
  if (ITEMS[item].slot && state.player.inventory[item] > 0) return false;
  state.player.gold -= price;
  state.player.inventory[item]++;
  if (ITEMS[item].slot) equipItem(state, item);
  return true;
}

export function craftTonic(state: GameState): boolean {
  const player = state.player;
  const reserved = state.world.quests.supplies === 'complete' ? 0 : 3;
  if (player.inventory.herb < 3 + reserved) return false;
  player.inventory.herb -= 3;
  player.inventory.tonic++;
  return true;
}

export function recoverFromDefeat(state: GameState): void {
  state.player.mapId = 'larkhaven';
  state.player.gold = Math.floor(state.player.gold * 0.9);
  state.player.hp = maxHp(state.player);
  state.player.stamina = 100;
  state.player.position = { ...START_POSITION };
}
