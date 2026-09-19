import { describe, expect, it } from 'vitest';
import {
  currentObjective,
  hasMilestone,
  objectiveSummary,
  recordMilestone,
} from '../../src/domain/objectives';
import {
  completeSentinel,
  completeSupplies,
  craftTonic,
  defeatEnemy,
  newGame,
  reportVaultFindings,
} from '../../src/domain/progression';

describe('objective chain, prerequisites and activity-specific progress', () => {
  it('starts at the Mara acceptance step and never exposes gated futures', () => {
    const state = newGame();
    expect(currentObjective(state)?.id).toBe('supplies-accept');
    expect(objectiveSummary(state).every((entry) => entry.playable)).toBe(true);
    expect(objectiveSummary(state).every((entry) => !entry.current || entry.main)).toBe(true);
  });

  it('counts only slime kills after accepting supplies, never wolves or pre-accept kills', () => {
    const state = newGame();
    defeatEnemy(state, 'slime');
    expect(state.world.questKills).toBe(0);
    state.world.quests.supplies = 'active';
    defeatEnemy(state, 'wolf');
    expect(state.world.questKills).toBe(0);
    expect(objectiveSummary(state).find((entry) => entry.id === 'supplies-slime')!.progress).toBe(
      0,
    );
    defeatEnemy(state, 'slime');
    expect(state.world.questKills).toBe(1);
    expect(objectiveSummary(state).find((entry) => entry.id === 'supplies-slime')!.progress).toBe(
      1,
    );
  });

  it('reaches the report step only after both counters are satisfied', () => {
    const state = newGame();
    state.world.quests.supplies = 'active';
    state.player.inventory.herb = 3;
    expect(currentObjective(state)?.id).toBe('supplies-slime');
    for (let i = 0; i < 3; i++) defeatEnemy(state, 'slime');
    expect(currentObjective(state)?.id).toBe('supplies-report');
  });

  it('does not let an early boss kill skip the supplies chain', () => {
    const state = newGame();
    defeatEnemy(state, 'golem');
    expect(state.world.bossDefeated).toBe(true);
    expect(currentObjective(state)?.id).toBe('supplies-accept');
    state.world.quests.supplies = 'active';
    state.player.inventory.herb = 3;
    for (let i = 0; i < 3; i++) defeatEnemy(state, 'slime');
    expect(currentObjective(state)?.id).toBe('supplies-report');
    completeSupplies(state);
    expect(currentObjective(state)?.id).toBe('investigate-trail');
    recordMilestone(state, 'north-road-trail-read');
    state.world.opened.push('north-road-cache');
    expect(currentObjective(state)?.id).toBe('sentinel-report');
  });
});

describe('objective completion, rewards and milestone persistence', () => {
  it('keeps completion idempotent with single-shot rewards across the chain', () => {
    const state = newGame();
    state.world.quests.supplies = 'active';
    state.player.inventory.herb = 3;
    for (let i = 0; i < 3; i++) defeatEnemy(state, 'slime');
    const gold = state.player.gold;
    expect(completeSupplies(state)).toBe(true);
    expect(completeSupplies(state)).toBe(false);
    expect(state.player.gold).toBe(gold + 30);
    expect(objectiveSummary(state).find((entry) => entry.id === 'supplies-report')!.done).toBe(
      true,
    );
    expect(currentObjective(state)?.id).toBe('investigate-trail');
    recordMilestone(state, 'north-road-trail-read');
    state.world.opened.push('north-road-cache');
    expect(currentObjective(state)?.id).toBe('sentinel-defeat');
    state.world.bossDefeated = true;
    expect(currentObjective(state)?.id).toBe('sentinel-report');
    expect(completeSentinel(state)).toBe(true);
    expect(completeSentinel(state)).toBe(false);
    expect(currentObjective(state)?.id).toBe('open-archive');
    recordMilestone(state, 'found-vault');
    expect(currentObjective(state)?.id).toBe('vault-seal-a');
    recordMilestone(state, 'vault-seal-a');
    recordMilestone(state, 'vault-seal-b');
    recordMilestone(state, 'vault-note-read');
    expect(currentObjective(state)?.id).toBe('report-findings');
    const goldBefore = state.player.gold;
    expect(reportVaultFindings(state)).toBe(true);
    expect(reportVaultFindings(state)).toBe(false);
    expect(state.player.gold).toBe(goldBefore + 80);
    expect(currentObjective(state)).toBeNull();
    const quests = JSON.stringify(state.world.quests);
    const milestones = JSON.stringify(state.world.milestones);
    completeSupplies(state);
    completeSentinel(state);
    reportVaultFindings(state);
    expect(JSON.stringify(state.world.quests)).toBe(quests);
    expect(JSON.stringify(state.world.milestones)).toBe(milestones);
  });

  it('records milestones only through their discovery event and never duplicates', () => {
    const state = newGame();
    defeatEnemy(state, 'wolf');
    state.player.inventory.herb = 3;
    expect(hasMilestone(state, 'found-old-watch')).toBe(false);
    expect(recordMilestone(state, 'found-old-watch')).toBe(true);
    expect(recordMilestone(state, 'found-old-watch')).toBe(false);
    expect(state.world.milestones).toEqual(['found-old-watch']);
    expect(objectiveSummary(state).find((entry) => entry.id === 'found-old-watch')!.done).toBe(
      true,
    );
  });

  it('protects quest herbs from optional crafting until supplies completes', () => {
    const state = newGame();
    state.world.quests.supplies = 'active';
    state.player.inventory.herb = 3;
    for (let i = 0; i < 3; i++) defeatEnemy(state, 'slime');
    expect(craftTonic(state)).toBe(false);
    expect(objectiveSummary(state).find((entry) => entry.id === 'supplies-herb')!.progress).toBe(3);
    expect(completeSupplies(state)).toBe(true);
    expect(craftTonic(state)).toBe(false);
    state.player.inventory.herb = 6;
    expect(craftTonic(state)).toBe(true);
  });
});

describe('Phase 7 objectives: north road, archive and automaton identity', () => {
  it('advances north-road and vault discoveries only through their own milestones', () => {
    const state = newGame();
    const entry = (id: string) => objectiveSummary(state).find((o) => o.id === id)!;
    expect(entry('investigate-trail').main).toBe(true);
    expect(entry('investigate-trail').done).toBe(false);
    defeatEnemy(state, 'wolf');
    recordMilestone(state, 'vault-seal-a');
    expect(entry('investigate-trail').done).toBe(false);
    expect(entry('vault-seal-b').done).toBe(false);
    recordMilestone(state, 'north-road-trail-read');
    expect(entry('investigate-trail').done).toBe(true);
    expect(entry('vault-seal-b').done).toBe(false);
  });

  it('marks the cache objective from the opened state and never duplicates it', () => {
    const state = newGame();
    const cache = () => objectiveSummary(state).find((entry) => entry.id === 'secure-cache')!;
    expect(cache().done).toBe(false);
    state.world.opened.push('north-road-cache');
    expect(cache().done).toBe(true);
    state.world.opened.push('north-road-cache');
    expect(cache().progress).toBe(1);
  });

  it('keeps automaton kills out of bossDefeated and out of the supplies counters', () => {
    const state = newGame();
    state.world.quests.supplies = 'active';
    const levels = defeatEnemy(state, 'automaton');
    expect(state.world.bossDefeated).toBe(false);
    expect(state.world.questKills).toBe(0);
    expect(state.world.kills.automaton).toBe(1);
    expect(levels).toBe(0);
    expect(objectiveSummary(state).find((entry) => entry.id === 'sentinel-defeat')!.done).toBe(
      false,
    );
  });

  it('keeps optional Phase 7 entries out of the main tracker chain', () => {
    const state = newGame();
    recordMilestone(state, 'found-old-watch');
    recordMilestone(state, 'found-north-road');
    recordMilestone(state, 'north-road-trail-read');
    recordMilestone(state, 'found-vault');
    state.world.opened.push('north-road-cache');
    recordMilestone(state, 'vault-seal-a');
    recordMilestone(state, 'vault-seal-b');
    recordMilestone(state, 'vault-note-read');
    const main = objectiveSummary(state).filter((entry) => entry.main && entry.current);
    expect(main.map((entry) => entry.id)).toEqual(['supplies-accept']);
    const optional = objectiveSummary(state).filter((entry) => !entry.main);
    expect(optional.every((entry) => entry.done)).toBe(true);
    expect(optional.every((entry) => entry.playable)).toBe(true);
  });
});
