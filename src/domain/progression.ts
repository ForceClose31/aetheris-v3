import { BALANCE, ENEMIES, JOBS } from '../content/catalog';
import { WORLD } from '../content/world';
import type { EnemyId, GameState, JobId, PlayerState } from './types';

export function newGame(): GameState {
  return {
    player: {
      level: 1,
      xp: 0,
      hp: 70,
      stamina: 100,
      gold: 12,
      job: null,
      weapon: 'wood-sword',
      inventory: { herb: 0, tonic: 3, 'wood-sword': 1, 'iron-sword': 0 },
      position: { ...WORLD.spawn },
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
  };
}
export const xpNeeded = (level: number): number => Math.round(45 + level * 19 + level ** 1.5 * 5);
export const maxHp = (player: PlayerState): number =>
  70 + (player.level - 1) * 9 + (player.job ? JOBS[player.job].hp : 0);
export const attackPower = (player: PlayerState): number =>
  11 +
  (player.level - 1) * 2 +
  (player.weapon === 'iron-sword' ? 9 : 0) +
  (player.job ? JOBS[player.job].damage : 0);

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
  grantXp(state.player, 85);
  state.world.quests.supplies = 'complete';
  state.world.quests.sentinel = 'active';
  return true;
}

export function completeSentinel(state: GameState): boolean {
  if (state.world.quests.sentinel !== 'active' || !state.world.bossDefeated) return false;
  state.world.quests.sentinel = 'complete';
  state.player.gold += 100;
  grantXp(state.player, 150);
  return true;
}

export function useTonic(player: PlayerState): boolean {
  if (player.inventory.tonic < 1 || player.hp >= maxHp(player)) return false;
  player.inventory.tonic--;
  player.hp = Math.min(maxHp(player), player.hp + 45);
  return true;
}

export function buyItem(state: GameState, item: 'tonic' | 'iron-sword'): boolean {
  const price = item === 'tonic' ? 8 : 35;
  if (state.player.gold < price) return false;
  if (item === 'tonic' && state.world.merchantStock < 1) return false;
  if (item === 'iron-sword' && state.player.inventory[item] > 0) return false;
  state.player.gold -= price;
  state.player.inventory[item]++;
  if (item === 'tonic') state.world.merchantStock--;
  else state.player.weapon = item;
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
  state.player.gold = Math.floor(state.player.gold * 0.9);
  state.player.hp = maxHp(state.player);
  state.player.stamina = 100;
  state.player.position = { ...WORLD.spawn };
}
