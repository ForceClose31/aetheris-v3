import { afterEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { BALANCE, ENEMIES } from '../../src/content/catalog';
import { LEGACY_AREA } from '../../src/content/world';
import { newGame } from '../../src/domain/progression';
import type { Effects } from '../../src/game/effects';
import { EnemySystem } from '../../src/game/enemies';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (x: number, y: number, a: number, b: number) => Math.hypot(x - a, y - b),
      },
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

function encounter(area = LEGACY_AREA) {
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  const graphics = {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
  };
  const scene = {
    add: { graphics: () => graphics },
    time: { delayedCall: vi.fn() },
    physics: {
      add: {
        collider: vi.fn(),
        sprite: (x: number, y: number) => ({
          x,
          y,
          active: true,
          visible: true,
          body: { enable: true },
          setOrigin: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setCollideWorldBounds: vi.fn().mockReturnThis(),
          setSize: vi.fn().mockReturnThis(),
          setOffset: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setVelocity: vi.fn().mockReturnThis(),
          setTexture: vi.fn().mockReturnThis(),
          setFlipX: vi.fn().mockReturnThis(),
          setTintFill: vi.fn().mockReturnThis(),
          clearTint: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setActive(value: boolean) {
            this.active = value;
            return this;
          },
          setVisible(value: boolean) {
            this.visible = value;
            return this;
          },
        }),
      },
    },
  };
  const state = newGame();
  state.world.quests.sentinel = 'active';
  const hooks = { damage: vi.fn(), defeated: vi.fn() };
  const effects = { floating: vi.fn() };
  const enemies = new EnemySystem(
    scene as unknown as Phaser.Scene,
    state,
    {} as Phaser.Physics.Arcade.StaticGroup,
    effects as unknown as Effects,
    hooks,
    area,
  );
  return { enemies, state, hooks };
}

it('creates only the enemy spawns supplied by the active area', () => {
  const { enemies } = encounter({
    ...LEGACY_AREA,
    spawns: [{ kind: 'wolf', x: 200, y: 300 }],
  });
  expect(enemies['actors']).toHaveLength(1);
  expect(enemies['actors'][0]).toMatchObject({
    definition: { id: 'wolf' },
    home: { x: 200, y: 300 },
  });
});

it('applies directional damage once and keeps knockback velocity until its duration expires', () => {
  const { enemies, hooks } = encounter();
  const actor = enemies['actors'][0];
  const player = { x: actor.sprite.x - 40, y: actor.sprite.y };
  expect(enemies.attack(player, { x: -1, y: 0 }, 1, 57, false)).toBe(false);
  expect(actor.hp).toBe(ENEMIES.slime.hp);
  expect(enemies.attack(player, { x: 1, y: 0 }, 1, 57, false)).toBe(true);
  expect(actor.hp).toBe(ENEMIES.slime.hp - 11);
  expect(actor.sprite.setVelocity).toHaveBeenLastCalledWith(BALANCE.knockbackSpeed, 0);
  actor.windup = 0.01;
  enemies.update(BALANCE.knockbackDuration / 2, player);
  expect(actor.sprite.setVelocity).toHaveBeenLastCalledWith(BALANCE.knockbackSpeed, 0);
  expect(hooks.damage).not.toHaveBeenCalled();
  enemies.update(BALANCE.knockbackDuration / 2, player);
  expect(actor.sprite.setVelocity).toHaveBeenLastCalledWith(0);
  enemies.update(0.02, player);
  expect(actor.windup).toBeLessThanOrEqual(0);
});

it('uses facing for overlapping targets and clears knockback when encounters reset', () => {
  const { enemies } = encounter();
  const actor = enemies['actors'][0];
  enemies.attack(actor.sprite, { x: 0, y: -1 }, 1, 57, false);
  expect(actor.sprite.setVelocity).toHaveBeenLastCalledWith(0, -BALANCE.knockbackSpeed);
  enemies.resetEncounters();
  expect(actor.knockback).toBe(0);
  expect(actor.hp).toBe(ENEMIES.slime.hp);
  expect(actor.sprite.setVelocity).toHaveBeenLastCalledWith(0);
});

it.each(['slime', 'golem'] as const)(
  'animates %s death, disables hits and awards a single reward',
  (kind) => {
    const { enemies, state, hooks } = encounter();
    const actor = enemies['actors'].find((enemy) => enemy.definition.id === kind)!;
    const player = { x: actor.sprite.x - 30, y: actor.sprite.y };
    actor.hp = 1;
    enemies.attack(player, { x: 1, y: 0 }, 1, 57, false);
    expect(actor.hp).toBe(0);
    expect(actor.sprite.active).toBe(false);
    expect(actor.sprite.visible).toBe(true);
    expect(actor.sprite.body!.enable).toBe(false);
    expect(enemies.attack(player, { x: 1, y: 0 }, 1, 57, false)).toBe(false);
    expect(state.world.kills[kind]).toBe(1);
    expect(hooks.defeated).toHaveBeenCalledTimes(1);
    enemies.update(BALANCE.enemyDeathDuration / 2, player);
    expect(actor.sprite.visible).toBe(true);
    expect(actor.sprite.setAlpha).toHaveBeenLastCalledWith(0.5);
    expect(actor.sprite.setRotation).toHaveBeenLastCalledWith(Math.PI / 4);
    enemies.update(BALANCE.enemyDeathDuration / 2, player);
    expect(actor.sprite.visible).toBe(false);
    expect(hooks.damage).not.toHaveBeenCalled();
    enemies.update(ENEMIES.slime.respawn + 1, player);
    expect(actor.sprite.active).toBe(false);
    enemies.update(0.01, { x: 0, y: 0 });
    if (kind === 'slime') {
      expect(actor.hp).toBe(ENEMIES.slime.hp);
      expect(actor.sprite.active).toBe(true);
      expect(actor.sprite.visible).toBe(true);
      expect(actor.sprite.body!.enable).toBe(true);
      expect(actor.sprite.setAlpha).toHaveBeenLastCalledWith(1);
      expect(actor.sprite.setRotation).toHaveBeenLastCalledWith(0);
      expect(actor.sprite.clearTint).toHaveBeenCalled();
    } else {
      expect(state.world.bossDefeated).toBe(true);
      expect(actor.sprite.active).toBe(false);
      expect(enemies.getBoss(player)).toBeNull();
    }
  },
);
