import Phaser from 'phaser';
import { BALANCE, ENEMIES } from '../content/catalog';
import type { AreaDefinition } from '../content/world';
import { damageRoll, inAttackArc } from '../domain/combat';
import { watchRouteOpen } from '../domain/objectives';
import { attackPower, defeatEnemy } from '../domain/progression';
import type { EnemyDefinition, GameState, Point } from '../domain/types';
import type { Effects } from './effects';

interface EnemyActor {
  spawnId: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  definition: EnemyDefinition;
  home: Point;
  hp: number;
  cooldown: number;
  windup: number;
  target: Point;
  radius: number;
  respawn: number;
  knockback: number;
  deathTimer: number;
}
export interface EnemyHooks {
  damage: (amount: number) => void;
  defeated: (name: string, levels: number) => void;
}

export class EnemySystem {
  private actors: EnemyActor[] = [];
  private indicators: Phaser.GameObjects.Graphics;
  private elapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    solids: Phaser.Physics.Arcade.StaticGroup,
    private readonly effects: Effects,
    private readonly hooks: EnemyHooks,
    area: AreaDefinition,
    private readonly respawns: Record<string, number> = {},
  ) {
    this.indicators = scene.add.graphics().setDepth(6000);
    area.spawns.forEach((spawn, index) => {
      const spawnId = `${this.state.player.mapId}:${index}`;
      const definition = ENEMIES[spawn.kind];
      const sprite = scene.physics.add
        .sprite(spawn.x, spawn.y, spawn.kind === 'slime' ? 'slime-0' : spawn.kind)
        .setOrigin(0.5, 1)
        .setScale(spawn.kind === 'golem' ? 1.65 : 1.6)
        .setCollideWorldBounds(true);
      sprite
        .setSize(spawn.kind === 'golem' ? 32 : 18, 12)
        .setOffset(
          spawn.kind === 'golem' ? 13 : 7,
          spawn.kind === 'golem' ? 49 : spawn.kind === 'wolf' ? 18 : 12,
        );
      scene.physics.add.collider(sprite, solids);
      const waiting = this.respawns[spawnId] !== undefined;
      const hiddenBoss = spawn.kind === 'golem' && !watchRouteOpen(state);
      if (waiting || hiddenBoss) {
        sprite.setVisible(false).setActive(false);
        sprite.body!.enable = false;
      }
      this.actors.push({
        spawnId,
        sprite,
        definition,
        home: { x: spawn.x, y: spawn.y },
        hp: waiting ? 0 : definition.hp,
        cooldown: 1,
        windup: 0,
        target: { ...spawn },
        radius: 0,
        respawn: waiting ? Math.max(0, this.respawns[spawnId]! - state.world.seconds) : 0,
        knockback: 0,
        deathTimer: 0,
      });
    });
  }

  update(dt: number, player: Point): void {
    this.elapsed += dt;
    this.indicators.clear();
    for (const actor of this.actors) {
      const { sprite, definition } = actor;
      if (actor.deathTimer > 0) {
        actor.deathTimer = Math.max(0, actor.deathTimer - dt);
        const progress = 1 - actor.deathTimer / BALANCE.enemyDeathDuration;
        sprite
          .setAlpha(1 - progress)
          .setRotation((progress * (sprite.flipX ? -1 : 1) * Math.PI) / 2);
        if (actor.deathTimer === 0) sprite.setVisible(false);
        continue;
      }
      if (definition.id === 'golem' && !watchRouteOpen(this.state)) {
        sprite.setVisible(false).setActive(false);
        sprite.body!.enable = false;
        continue;
      }
      if (actor.hp <= 0) {
        actor.respawn -= dt;
        if (
          actor.respawn <= 0 &&
          definition.respawn > 0 &&
          Phaser.Math.Distance.Between(player.x, player.y, actor.home.x, actor.home.y) > 140
        ) {
          actor.hp = definition.hp;
          delete this.respawns[actor.spawnId];
          sprite
            .setPosition(actor.home.x, actor.home.y)
            .setVelocity(0)
            .setAlpha(1)
            .setRotation(0)
            .clearTint()
            .setActive(true)
            .setVisible(true);
          sprite.body!.enable = true;
          actor.cooldown = 1;
        } else continue;
      }
      if (!sprite.active) {
        sprite.setActive(true).setVisible(true);
        sprite.body!.enable = true;
      }
      sprite.setDepth(sprite.y);
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, player.x, player.y);
      const homeDistance = Phaser.Math.Distance.Between(
        sprite.x,
        sprite.y,
        actor.home.x,
        actor.home.y,
      );
      if (actor.knockback > 0) {
        actor.knockback = Math.max(0, actor.knockback - dt);
        if (actor.knockback === 0) sprite.setVelocity(0);
      } else if (actor.windup > 0) {
        sprite.setVelocity(0);
        actor.windup -= dt;
        this.indicators
          .fillStyle(0xd98767, 0.19)
          .fillCircle(actor.target.x, actor.target.y - 8, actor.radius);
        this.indicators
          .lineStyle(2, 0xf0b081, 0.85)
          .strokeCircle(actor.target.x, actor.target.y - 8, actor.radius);
        if (actor.windup <= 0) {
          this.effects.floating(
            actor.target.x,
            actor.target.y,
            definition.id === 'golem' ? 'SLAM' : definition.id === 'automaton' ? 'BURST' : '!',
            '#e6a18a',
          );
          if (
            Phaser.Math.Distance.Between(player.x, player.y, actor.target.x, actor.target.y) <
            actor.radius + 8
          )
            this.hooks.damage(definition.damage);
          actor.cooldown =
            definition.id === 'golem'
              ? actor.hp < definition.hp / 2
                ? 0.9
                : 1.7
              : definition.id === 'automaton'
                ? 1.6
                : 1.2;
        }
      } else if (distance < definition.aggro && homeDistance < 300) {
        const attackRange =
          definition.id === 'golem' ? 120 : definition.id === 'automaton' ? 52 : 45;
        if (distance < attackRange && actor.cooldown <= 0) {
          actor.windup =
            definition.id === 'golem' ? 1.05 : definition.id === 'automaton' ? 0.75 : 0.5;
          actor.target = { x: player.x, y: player.y };
          actor.radius =
            definition.id === 'golem'
              ? actor.hp < definition.hp / 2
                ? 95
                : 76
              : definition.id === 'automaton'
                ? 46
                : 34;
          sprite.setVelocity(0);
        } else if (distance > 30) {
          const speed =
            definition.speed *
            (definition.id === 'golem' && actor.hp < definition.hp / 2 ? 1.5 : 1);
          sprite.setVelocity(
            ((player.x - sprite.x) / distance) * speed,
            ((player.y - sprite.y) / distance) * speed,
          );
          sprite.setFlipX(player.x < sprite.x);
        } else sprite.setVelocity(0);
      } else {
        const dx = actor.home.x - sprite.x;
        const dy = actor.home.y - sprite.y;
        const length = Math.hypot(dx, dy);
        if (length > 10)
          sprite.setVelocity(
            (dx / length) * definition.speed * 0.65,
            (dy / length) * definition.speed * 0.65,
          );
        else sprite.setVelocity(0);
        if (homeDistance < 15 && definition.id === 'golem')
          actor.hp = Math.min(definition.hp, actor.hp + dt * 12);
      }
      if (definition.id === 'slime')
        sprite.setTexture(`slime-${Math.floor(this.elapsed * 3 + actor.home.x) % 2}`);
      if (actor.hp < definition.hp) {
        const width = definition.id === 'golem' ? 70 : 35;
        const y = sprite.y - sprite.displayHeight - 9;
        this.indicators.fillStyle(0x172c28, 0.9).fillRect(sprite.x - width / 2, y, width, 4);
        this.indicators
          .fillStyle(0xd9a281, 1)
          .fillRect(sprite.x - width / 2, y, (width * actor.hp) / definition.hp, 4);
      }
    }
  }

  attack(player: Point, facing: Point, combo: number, reach: number, skill: boolean): boolean {
    let hit = false;
    for (const actor of this.actors) {
      const sprite = actor.sprite;
      if (
        !sprite.active ||
        actor.hp <= 0 ||
        !inAttackArc(
          player,
          sprite,
          facing,
          reach + (actor.definition.id === 'golem' ? 25 : 8),
          skill,
        )
      )
        continue;
      hit = true;
      const damage = damageRoll(attackPower(this.state.player) * (skill ? 2 : 1), combo);
      actor.hp = Math.max(0, actor.hp - damage.amount);
      sprite.setTintFill(0xf6e2b2);
      this.scene.time.delayedCall(90, () => {
        if (sprite.active) sprite.clearTint();
      });
      this.effects.floating(
        sprite.x,
        sprite.y,
        `${damage.critical ? '✦ ' : ''}${damage.amount}`,
        damage.critical ? '#ffe6a0' : '#f2e9cc',
      );
      if (actor.hp <= 0) {
        sprite.setActive(false).setVelocity(0).clearTint();
        sprite.body!.enable = false;
        actor.windup = 0;
        actor.knockback = 0;
        actor.deathTimer = BALANCE.enemyDeathDuration;
        actor.respawn = actor.definition.respawn;
        this.respawns[actor.spawnId] =
          this.state.world.seconds + BALANCE.enemyDeathDuration + actor.definition.respawn;
        const levels = defeatEnemy(this.state, actor.definition.id);
        this.effects.floating(sprite.x, sprite.y + 28, `+${actor.definition.xp} XP`, '#add5ba');
        this.hooks.defeated(actor.definition.name, levels);
      } else {
        const dx = sprite.x - player.x;
        const dy = sprite.y - player.y;
        const distance = Math.hypot(dx, dy);
        const speed = BALANCE.knockbackSpeed * (actor.definition.id === 'golem' ? 0.35 : 1);
        sprite.setVelocity(
          (distance > 0 ? dx / distance : facing.x) * speed,
          (distance > 0 ? dy / distance : facing.y) * speed,
        );
        actor.knockback = BALANCE.knockbackDuration;
      }
    }
    return hit;
  }

  getBoss(player: Point): { hp: number; max: number; name: string } | null {
    const boss = this.actors.find((actor) => actor.definition.id === 'golem');
    if (
      !boss ||
      !boss.sprite.active ||
      boss.hp <= 0 ||
      Phaser.Math.Distance.Between(player.x, player.y, boss.sprite.x, boss.sprite.y) > 330
    )
      return null;
    return { hp: boss.hp, max: boss.definition.hp, name: boss.definition.name };
  }

  resetEncounters(): void {
    this.actors.forEach((actor) => {
      if (actor.hp <= 0) return;
      actor.sprite.setPosition(actor.home.x, actor.home.y).setVelocity(0);
      actor.windup = 0;
      actor.knockback = 0;
      actor.cooldown = 1.5;
      actor.hp = actor.definition.hp;
    });
  }
}
