import { describe, expect, it } from 'vitest';
import { JOBS } from '../../src/content/catalog';
import {
  attackPower,
  buyItem,
  chooseJob,
  completeSentinel,
  completeSupplies,
  craftTonic,
  defeatEnemy,
  equipItem,
  grantXp,
  maxHp,
  newGame,
  recoverFromDefeat,
  unequipSlot,
  useTonic,
  xpNeeded,
} from '../../src/domain/progression';
import { damageRoll, inAttackArc } from '../../src/domain/combat';

describe('ordinary beginnings and progression', () => {
  it('starts as an ordinary villager with no job or special weapon', () => {
    const p = newGame().player;
    expect(p.level).toBe(1);
    expect(p.job).toBeNull();
    expect(p.equipment).toEqual({ weapon: 'wood-sword', body: null, head: null });
  });
  it('carries XP across multiple levels and restores health', () => {
    const p = newGame().player;
    p.hp = 1;
    const xp = xpNeeded(1) + xpNeeded(2) + 7;
    expect(grantXp(p, xp)).toBe(2);
    expect(p.xp).toBe(7);
    expect(p.hp).toBe(maxHp(p));
  });
  it('prevents job selection before level 10 and makes a selection permanent', () => {
    const p = newGame().player;
    expect(chooseJob(p, 'mage')).toBe(false);
    p.level = 10;
    expect(chooseJob(p, 'mage')).toBe(true);
    expect(chooseJob(p, 'warrior')).toBe(false);
    expect(p.job).toBe('mage');
    expect(Object.keys(JOBS)).toHaveLength(8);
  });
  it('caps long progression at level 100', () => {
    const p = newGame().player;
    p.level = 99;
    grantXp(p, 100000);
    expect(p.level).toBe(100);
    expect(p.xp).toBe(0);
  });
});

describe('quest and economy invariants', () => {
  it('counts kills only after accepting the first quest and grants each reward once', () => {
    const state = newGame();
    defeatEnemy(state, 'slime');
    expect(state.world.questKills).toBe(0);
    state.world.quests.supplies = 'active';
    for (let i = 0; i < 3; i++) defeatEnemy(state, 'slime');
    expect(completeSupplies(state)).toBe(false);
    state.player.inventory.herb = 3;
    const gold = state.player.gold;
    expect(completeSupplies(state)).toBe(true);
    expect(completeSupplies(state)).toBe(false);
    expect(state.player.gold).toBe(gold + 30);
    expect(state.player.inventory.herb).toBe(0);
    expect(state.world.quests.sentinel).toBe('active');
    expect(completeSentinel(state)).toBe(false);
    defeatEnemy(state, 'golem');
    expect(completeSentinel(state)).toBe(true);
    expect(completeSentinel(state)).toBe(false);
  });
  it('does not spend money without stock or buy duplicate equipment', () => {
    const state = newGame();
    state.player.gold = 100;
    state.world.merchantStock = 0;
    expect(buyItem(state, 'tonic')).toBe(false);
    expect(state.player.gold).toBe(100);
    expect(buyItem(state, 'iron-sword')).toBe(true);
    expect(buyItem(state, 'iron-sword')).toBe(false);
    expect(state.player.gold).toBe(65);
    expect(state.player.equipment.weapon).toBe('iron-sword');
  });
  it('consumes exact crafting materials and never wastes healing at full health', () => {
    const state = newGame();
    const p = state.player;
    p.inventory.herb = 2;
    expect(craftTonic(state)).toBe(false);
    p.inventory.herb = 3;
    expect(craftTonic(state)).toBe(false);
    p.inventory.herb = 6;
    expect(craftTonic(state)).toBe(true);
    expect(p.inventory.herb).toBe(3);
    expect(useTonic(p)).toBe(false);
    expect(p.inventory.tonic).toBe(4);
    p.hp = 60;
    expect(useTonic(p)).toBe(true);
    expect(p.hp).toBe(70);
    expect(p.inventory.tonic).toBe(3);
  });
  it('preserves earned progress after defeat and charges only ten percent gold', () => {
    const state = newGame();
    state.player.gold = 31;
    state.player.hp = -3;
    state.player.xp = 22;
    state.world.quests.supplies = 'active';
    state.world.questKills = 2;
    recoverFromDefeat(state);
    expect(state.player.hp).toBe(maxHp(state.player));
    expect(state.player.gold).toBe(27);
    expect(state.player.xp).toBe(22);
    expect(state.world.questKills).toBe(2);
  });
});

describe('equipment slots, derived stats and swap safety', () => {
  it('derives attack and max HP from equipped items through a single path', () => {
    const state = newGame();
    const p = state.player;
    expect(attackPower(p)).toBe(11);
    expect(maxHp(p)).toBe(70);
    p.inventory['iron-sword'] = 1;
    p.inventory['padded-vest'] = 1;
    p.inventory['leather-cap'] = 1;
    expect(equipItem(state, 'iron-sword')).toBe(true);
    expect(equipItem(state, 'padded-vest')).toBe(true);
    expect(equipItem(state, 'leather-cap')).toBe(true);
    expect(p.equipment).toEqual({ weapon: 'iron-sword', body: 'padded-vest', head: 'leather-cap' });
    expect(attackPower(p)).toBe(20);
    expect(maxHp(p)).toBe(110);
    expect(p.inventory['padded-vest']).toBe(1);
    expect(p.inventory['iron-sword']).toBe(1);
  });
  it('rejects unowned, non-equippable and duplicate equips without changing state', () => {
    const state = newGame();
    const p = state.player;
    expect(equipItem(state, 'iron-sword')).toBe(false);
    expect(equipItem(state, 'leather-cap')).toBe(false);
    p.inventory['padded-vest'] = 1;
    expect(equipItem(state, 'padded-vest')).toBe(true);
    expect(equipItem(state, 'padded-vest')).toBe(false);
    expect(equipItem(state, 'herb')).toBe(false);
    expect(equipItem(state, 'tonic')).toBe(false);
    expect(equipItem(state, 'steel-sword')).toBe(false);
    expect(p.equipment).toEqual({ weapon: 'wood-sword', body: 'padded-vest', head: null });
  });
  it('unequips to the base appearance and never heals through equipment swaps', () => {
    const state = newGame();
    const p = state.player;
    p.inventory['padded-vest'] = 1;
    expect(unequipSlot(state, 'body')).toBe(false);
    expect(equipItem(state, 'padded-vest')).toBe(true);
    expect(maxHp(p)).toBe(95);
    p.hp = 95;
    expect(unequipSlot(state, 'body')).toBe(true);
    expect(p.equipment.body).toBeNull();
    expect(maxHp(p)).toBe(70);
    expect(p.hp).toBe(70);
    expect(p.inventory['padded-vest']).toBe(1);
    expect(equipItem(state, 'padded-vest')).toBe(true);
    expect(p.hp).toBe(70);
    expect(maxHp(p)).toBe(95);
    expect(unequipSlot(state, 'head')).toBe(false);
    expect(unequipSlot(state, 'weapon')).toBe(false);
    expect(p.equipment.weapon).toBe('wood-sword');
  });
  it('auto-equips purchased gear, keeps purchases unique and prices from the catalog', () => {
    const state = newGame();
    state.player.gold = 145;
    expect(buyItem(state, 'padded-vest')).toBe(true);
    expect(state.player.equipment.body).toBe('padded-vest');
    expect(state.player.inventory['padded-vest']).toBe(1);
    expect(buyItem(state, 'padded-vest')).toBe(false);
    expect(state.player.gold).toBe(105);
    expect(buyItem(state, 'steel-sword')).toBe(true);
    expect(state.player.equipment.weapon).toBe('steel-sword');
    expect(attackPower(state.player)).toBe(27);
    expect(buyItem(state, 'leather-cap')).toBe(true);
    expect(maxHp(state.player)).toBe(110);
    expect(state.player.gold).toBe(0);
  });
});

describe('combat geometry', () => {
  it('hits in the facing arc but not behind the character or out of reach', () => {
    const origin = { x: 100, y: 100 };
    const facing = { x: 1, y: 0 };
    expect(inAttackArc(origin, { x: 135, y: 110 }, facing, 50)).toBe(true);
    expect(inAttackArc(origin, { x: 60, y: 100 }, facing, 50)).toBe(false);
    expect(inAttackArc(origin, { x: 160, y: 100 }, facing, 50)).toBe(false);
    expect(inAttackArc(origin, { x: 60, y: 100 }, facing, 50, true)).toBe(true);
  });
  it('applies the third combo hit and critical multiplier predictably', () => {
    expect(damageRoll(10, 1, () => 0.9)).toEqual({ amount: 10, critical: false });
    expect(damageRoll(10, 3, () => 0.9).amount).toBe(15);
    expect(damageRoll(10, 3, () => 0).amount).toBe(26);
  });
});
