import Phaser from 'phaser';
import { BALANCE, JOBS } from '../content/catalog';
import { regionAt, LEGACY_AREA } from '../content/world';
import { maxHp, newGame, recoverFromDefeat, useTonic } from '../domain/progression';
import type { GameState, Point } from '../domain/types';
import type { GameAudio } from '../platform/audio';
import { InputController } from '../platform/input';
import type { SaveStore } from '../platform/save';
import { createTextures } from '../rendering/textures';
import { buildWorld, safePosition, type WorldView } from '../rendering/world';
import type { GameInterface } from '../ui/interface';
import { Effects } from './effects';
import { EnemySystem } from './enemies';
import { InteractionSystem } from './interactions';

interface SceneData {
  state?: GameState;
  slot?: number;
  playing?: boolean;
}

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private readonly area = LEGACY_AREA;
  private hero!: Phaser.Physics.Arcade.Sprite;
  private controls!: InputController;
  private view!: WorldView;
  private effects!: Effects;
  private enemies!: EnemySystem;
  private interactions!: InteractionSystem;
  private facing: Point = { x: 0, y: 1 };
  private attackTimer = 0;
  private skillTimer = 0;
  private rollTimer = 0;
  private rollCooldown = 0;
  private invulnerable = 0;
  private combo = 0;
  private comboTimer = 0;
  private animationTime = 0;
  private saveTimer = 0;
  private hudTimer = 0;
  private currentRegion = '';
  private wasBlocked = true;
  private rollDirection: Point = { x: 0, y: 1 };
  private sceneData: SceneData = {};

  constructor(
    private readonly ui: GameInterface,
    private readonly saves: SaveStore,
    private readonly audio: GameAudio,
  ) {
    super('world');
  }

  init(data: SceneData): void {
    this.sceneData = data;
    this.state = data.state ?? newGame();
    this.attackTimer = this.skillTimer = this.rollTimer = this.rollCooldown = this.invulnerable = 0;
    this.combo = this.comboTimer = this.animationTime = this.saveTimer = this.hudTimer = 0;
    this.facing = { x: 0, y: 1 };
    this.rollDirection = { ...this.facing };
    this.currentRegion = '';
    this.wasBlocked = true;
  }

  create(): void {
    createTextures(this, this.area);
    const bounds = this.area.physicsBounds;
    this.physics.world.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
    this.view = buildWorld(this, this.state, this.area);
    const position = this.state.player.position;
    if (!safePosition(position.x, position.y, this.view.obstacles))
      this.state.player.position = { ...this.area.spawn };
    this.hero = this.physics.add
      .sprite(this.state.player.position.x, this.state.player.position.y, 'player-0')
      .setOrigin(0.5, 1)
      .setScale(1.65)
      .setCollideWorldBounds(true);
    this.hero.setSize(14, 12).setOffset(9, 20);
    this.physics.add.collider(this.hero, this.view.solids);
    this.effects = new Effects(this, this.area);
    this.enemies = new EnemySystem(
      this,
      this.state,
      this.view.solids,
      this.effects,
      {
        damage: (amount) => this.takeDamage(amount),
        defeated: (_name, levels) => {
          this.audio.play('pickup');
          if (levels > 0) {
            this.ui.toast(`Level ${this.state.player.level} · HP pulih sepenuhnya`, 'reward');
            this.effects.floating(this.hero.x, this.hero.y - 20, 'LEVEL UP', '#ead298');
          }
          if (this.state.world.bossDefeated && this.state.world.quests.sentinel === 'active')
            this.save(this.ui.activeSlot, false);
        },
      },
      this.area,
    );
    this.interactions = new InteractionSystem(
      this.state,
      this.ui,
      this.view,
      () => this.save(this.ui.activeSlot),
      this.area,
    );
    this.controls = new InputController(this.ui.host);
    this.ui.bindInput(this.controls);
    this.ui.hooks = {
      start: (state, slot) => {
        const next = state ?? newGame();
        if (!state) {
          const result = this.saves.write(slot, next);
          if (!result.ok) this.ui.toast(result.message, 'error');
        }
        this.ui.begin(next, slot);
        this.scene.restart({ state: next, slot, playing: true });
      },
      save: (slot) => this.save(slot),
      tonic: () => this.drinkTonic(),
      zoom: (delta) =>
        this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom + delta, 0.75, 2)),
    };
    const camera = this.cameras.main;
    camera
      .setBounds(0, 0, this.area.width, this.area.height)
      .setRoundPixels(true)
      .setZoom(this.scale.width < 700 ? 1 : 1.25);
    if (this.sceneData.playing) {
      camera.startFollow(this.hero, true, 0.1, 0.1);
      camera.centerOn(this.hero.x, this.hero.y);
      this.ui.announce(regionAt(this.area, this.hero.x, this.hero.y).name);
    } else camera.centerOn(this.area.overview.x, this.area.overview.y);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.ui.blocked || pointer.button !== 0) return;
      const point = camera.getWorldPoint(pointer.x, pointer.y);
      const dx = point.x - this.hero.x;
      const dy = point.y - (this.hero.y - 20);
      const length = Math.hypot(dx, dy);
      if (length > 5) this.facing = { x: dx / length, y: dy / length };
    });
    const onHidden = (): void => {
      if (!document.hidden || !this.ui.hasStarted) return;
      this.save(this.ui.activeSlot, false);
      this.controls.clear();
      if (!this.ui.blocked) this.ui.openPanel('pause');
    };
    const onPageHide = (): void => {
      if (this.ui.hasStarted) this.save(this.ui.activeSlot, false);
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.destroy();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    });
    this.refreshHud();
  }

  update(_time: number, delta: number): void {
    if (!this.hero) return;
    const dt = Math.min(delta / 1000, 0.05);
    if (this.controls.take('pause')) this.ui.togglePause();
    for (const action of ['journal', 'inventory', 'map'] as const) {
      if (this.controls.take(action) && this.ui.hasStarted) this.ui.openPanel(action);
    }
    if (this.ui.blocked) {
      this.physics.pause();
      this.hero.setVelocity(0);
      this.controls.clear();
      this.wasBlocked = true;
      this.effects.update(dt, this.state.world.seconds, this.view.water);
      this.refreshHud();
      return;
    }
    if (this.wasBlocked) {
      this.physics.resume();
      this.controls.clear();
      this.wasBlocked = false;
    }
    this.state.world.seconds += dt;
    this.animationTime += dt;
    this.saveTimer += dt;
    this.hudTimer += dt;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.skillTimer = Math.max(0, this.skillTimer - dt);
    this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 0;
    this.state.player.stamina = Math.min(
      100,
      this.state.player.stamina + BALANCE.staminaRegen * dt,
    );
    const movement = this.controls.movement;
    if (movement.x || movement.y) this.facing = movement;
    if (
      this.controls.take('roll') &&
      this.rollCooldown <= 0 &&
      this.state.player.stamina >= BALANCE.rollCost
    ) {
      this.rollTimer = BALANCE.rollDuration;
      this.rollCooldown = BALANCE.rollCooldown;
      this.rollDirection = { ...this.facing };
      this.invulnerable = BALANCE.rollDuration + 0.1;
      this.state.player.stamina -= BALANCE.rollCost;
    }
    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      this.hero.setVelocity(
        this.rollDirection.x * BALANCE.rollSpeed,
        this.rollDirection.y * BALANCE.rollSpeed,
      );
      this.hero.setRotation(
        Math.sin((1 - this.rollTimer / BALANCE.rollDuration) * Math.PI) *
          (this.rollDirection.x < 0 ? -0.5 : 0.5),
      );
    } else {
      this.hero
        .setRotation(0)
        .setVelocity(movement.x * BALANCE.walkSpeed, movement.y * BALANCE.walkSpeed);
      if ((this.controls.take('attack') || this.controls.down('attack')) && this.attackTimer <= 0)
        this.attack(false);
      if (this.controls.take('skill')) this.attack(true);
      if (this.controls.take('interact')) {
        this.interactions.nearby(this.hero);
        this.interactions.interact();
        this.audio.play('bell');
      }
      if (this.controls.take('tonic')) this.drinkTonic();
    }
    this.hero.setTexture(
      movement.x || movement.y
        ? `player-${1 + (Math.floor(this.animationTime * 8) % 2)}`
        : 'player-0',
    );
    if (this.facing.x) this.hero.setFlipX(this.facing.x < 0);
    this.hero
      .setDepth(this.hero.y)
      .setAlpha(this.invulnerable > 0 && Math.floor(this.animationTime * 15) % 2 ? 0.5 : 1);
    this.state.player.position.x = this.hero.x;
    this.state.player.position.y = this.hero.y;
    if (!this.ui.blocked) this.enemies.update(dt, this.hero);
    this.effects.update(dt, this.state.world.seconds, this.view.water);
    const region = regionAt(this.area, this.hero.x, this.hero.y).name;
    if (region !== this.currentRegion) {
      if (this.currentRegion) this.ui.announce(region);
      this.currentRegion = region;
    }
    if (this.saveTimer >= BALANCE.autosaveSeconds) {
      this.save(this.ui.activeSlot, false);
      this.saveTimer = 0;
    }
    if (this.hudTimer >= 0.1) {
      this.refreshHud();
      this.hudTimer = 0;
    }
    this.controls.flush();
  }

  private attack(skill: boolean): void {
    const p = this.state.player;
    if (skill && !p.job) {
      this.ui.toast('Skill job tersedia setelah memilih job pada level 10.');
      return;
    }
    if (skill && (this.skillTimer > 0 || p.stamina < BALANCE.skillCost)) return;
    if (!skill && this.attackTimer > 0) return;
    this.combo = (this.combo % 3) + 1;
    this.comboTimer = 0.85;
    this.attackTimer = BALANCE.attackCooldown;
    const reach = skill && p.job ? JOBS[p.job].reach : 57;
    if (skill) {
      this.skillTimer = BALANCE.skillCooldown;
      p.stamina -= BALANCE.skillCost;
      if (p.job === 'priest') p.hp = Math.min(maxHp(p), p.hp + 25);
    }
    this.effects.slash(
      this.hero.x,
      this.hero.y,
      Math.atan2(this.facing.y, this.facing.x),
      skill,
      reach,
    );
    if (this.enemies.attack(this.hero, this.facing, this.combo, reach, skill)) {
      this.audio.play('hit');
      this.cameras.main.shake(65, 0.0015);
    }
  }

  private takeDamage(amount: number): void {
    if (this.invulnerable > 0 || this.ui.blocked) return;
    this.state.player.hp -= amount;
    this.invulnerable = 0.8;
    this.audio.play('hurt');
    this.effects.floating(this.hero.x, this.hero.y, `−${amount}`, '#f0a58c');
    this.cameras.main.shake(140, 0.003);
    if (this.state.player.hp <= 0) {
      const gold = this.state.player.gold;
      recoverFromDefeat(this.state);
      this.hero
        .setPosition(this.state.player.position.x, this.state.player.position.y)
        .setVelocity(0);
      this.enemies.resetEncounters();
      this.invulnerable = 2;
      this.ui.dialog(
        'Setiap perjalanan punya jatuhnya',
        'KAMU KEMBALI KE LARKHAVEN',
        `<p>Elian menemukanmu sebelum malam turun. Luka-lukamu telah dirawat.</p><p>Kamu kehilangan ${gold - this.state.player.gold} gold. Pengalaman, perlengkapan, dan progres quest tetap tersimpan.</p>`,
        [{ label: 'Bangkit lagi', run: () => this.ui.close() }],
      );
      this.save(this.ui.activeSlot, false);
    }
  }

  private drinkTonic(): void {
    if (useTonic(this.state.player)) {
      this.effects.floating(this.hero.x, this.hero.y, '+ HP', '#afdab8');
      this.audio.play('pickup');
    } else
      this.ui.toast(
        this.state.player.inventory.tonic < 1
          ? 'Tonik habis. Temui Borin atau cari peti persediaan.'
          : 'HP sudah penuh.',
      );
  }

  private save(slot: number, notify = true): boolean {
    const result = this.saves.write(slot, this.state);
    if (!result.ok) this.ui.toast(result.message, 'error');
    else if (notify) this.ui.toast(`Perjalanan tersimpan · Slot ${slot}`);
    return result.ok;
  }

  private refreshHud(): void {
    this.ui.update(
      this.state,
      {
        nearby: this.interactions.nearby(this.hero),
        skillCooldown: this.skillTimer,
        rollCooldown: this.rollCooldown,
        boss: this.enemies.getBoss(this.hero),
      },
      this.area,
    );
  }
}
