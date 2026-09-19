import Phaser from 'phaser';
import { BALANCE, ENEMIES, JOBS } from '../content/catalog';
import { AREAS, contains, regionAt, safeLocation, type AreaDefinition } from '../content/world';
import { maxHp, newGame, recoverFromDefeat, useTonic } from '../domain/progression';
import type { GameState, Point } from '../domain/types';
import type { GameAudio } from '../platform/audio';
import { InputController } from '../platform/input';
import type { SaveStore } from '../platform/save';
import {
  createCharacterLayers,
  syncCharacterLayers,
  type CharacterLayers,
  type FacingDir,
} from '../rendering/character';
import { createTextures, releaseAreaTextures } from '../rendering/textures';
import { buildWorld, type WorldView } from '../rendering/world';
import type { GameInterface } from '../ui/interface';
import { Effects } from './effects';
import { EnemySystem } from './enemies';
import { InteractionSystem } from './interactions';

interface Session {
  attack: number;
  skill: number;
  roll: number;
  invulnerable: number;
  respawns: Record<string, number>;
}
interface SceneData {
  state?: GameState;
  slot?: number;
  playing?: boolean;
  session?: Session;
  source?: GameState;
  arrival?: boolean;
}

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private area!: AreaDefinition;
  private session!: Session;
  private transitioning = false;
  private hero!: Phaser.Physics.Arcade.Sprite;
  private controls!: InputController;
  private view!: WorldView;
  private effects!: Effects;
  private enemies!: EnemySystem;
  private interactions!: InteractionSystem;
  private facing: Point = { x: 0, y: 1 };
  private dir: FacingDir = 'down';
  private character!: CharacterLayers;
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
    this.area = AREAS[this.state.player.mapId];
    this.session = data.session ?? { attack: 0, skill: 0, roll: 0, invulnerable: 0, respawns: {} };
    this.transitioning = !!data.source;
    this.attackTimer = this.skillTimer = this.rollTimer = this.rollCooldown = this.invulnerable = 0;
    this.attackTimer = this.session.attack;
    this.skillTimer = this.session.skill;
    this.rollCooldown = this.session.roll;
    this.invulnerable = this.session.invulnerable;
    this.combo = this.comboTimer = this.animationTime = this.saveTimer = this.hudTimer = 0;
    this.facing = { x: 0, y: 1 };
    this.dir = 'down';
    this.rollDirection = { ...this.facing };
    this.currentRegion = '';
    this.wasBlocked = true;
  }

  create(): void {
    try {
      this.createArea();
    } catch (error) {
      const source = this.sceneData.source;
      if (!source) throw error;
      releaseAreaTextures(this, this.area);
      this.ui.toast(
        'Area gagal dimuat. Kembali ke area asal; masuk exit untuk mencoba lagi.',
        'error',
      );
      this.scene.restart({
        state: source,
        slot: this.sceneData.slot,
        playing: true,
        session: this.session,
      });
    }
  }

  private createArea(): void {
    createTextures(this, this.area);
    const bounds = this.area.physicsBounds;
    this.physics.world.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
    this.view = buildWorld(this, this.state, this.area);
    const position = this.state.player.position;
    if (!safeLocation(this.area, position)) this.state.player.position = { ...this.area.spawn };
    this.hero = this.physics.add
      .sprite(this.state.player.position.x, this.state.player.position.y, 'player-down-0')
      .setOrigin(0.5, 1)
      .setScale(1.65)
      .setCollideWorldBounds(true);
    this.hero.setSize(14, 12).setOffset(9, 20);
    this.physics.add.collider(this.hero, this.view.solids);
    this.character = createCharacterLayers(this, this.state.player.equipment);
    syncCharacterLayers(this.character, this.hero, {
      dir: this.dir,
      facing: this.facing,
      equipment: this.state.player.equipment,
      attack: 0,
      duration: BALANCE.attackCooldown,
      combo: 0,
    });
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
      this.session.respawns,
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
        if (this.transitioning) return;
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
    const onPointer = (pointer: Phaser.Input.Pointer): void => {
      if (this.transitioning || this.ui.blocked || pointer.button !== 0) return;
      const point = camera.getWorldPoint(pointer.x, pointer.y);
      const dx = point.x - this.hero.x;
      const dy = point.y - (this.hero.y - 20);
      const length = Math.hypot(dx, dy);
      if (length > 5) this.facing = { x: dx / length, y: dy / length };
    };
    this.input.on('pointerdown', onPointer);
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
      this.input.off('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    });
    this.sceneData.source = undefined;
    this.transitioning = false;
    // Covers transitions, save-slot loads and defeat recovery, after the new view exists.
    for (const area of Object.values(AREAS))
      if (area !== this.area) releaseAreaTextures(this, area);
    if (this.sceneData.arrival) {
      this.cameras.main.fadeIn(120);
      this.save(this.ui.activeSlot, false);
    }
    this.refreshHud();
  }

  update(_time: number, delta: number): void {
    if (!this.hero || this.transitioning) return;
    const dt = Math.min(delta / 1000, 0.05);
    for (const image of this.view.occluders) {
      const behind =
        this.hero.y < image.y &&
        this.hero.y > image.y - image.displayHeight &&
        Math.abs(this.hero.x - image.x) < image.displayWidth / 2 + 12;
      image.setAlpha(behind ? 0.45 : 1);
    }
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
    this.dir =
      Math.abs(this.facing.x) > Math.abs(this.facing.y)
        ? 'side'
        : this.facing.y < 0
          ? 'up'
          : 'down';
    this.hero.setTexture(
      movement.x || movement.y
        ? `player-${this.dir}-${1 + (Math.floor(this.animationTime * 8) % 2)}`
        : `player-${this.dir}-0`,
    );
    this.hero.setFlipX(this.dir === 'side' && this.facing.x < 0);
    this.hero
      .setDepth(this.hero.y)
      .setAlpha(this.invulnerable > 0 && Math.floor(this.animationTime * 15) % 2 ? 0.5 : 1);
    syncCharacterLayers(this.character, this.hero, {
      dir: this.dir,
      facing: this.facing,
      equipment: this.state.player.equipment,
      attack: this.attackTimer,
      duration: BALANCE.attackCooldown,
      combo: this.combo,
    });
    this.state.player.position.x = this.hero.x;
    this.state.player.position.y = this.hero.y;
    if (!this.ui.blocked) this.enemies.update(dt, this.hero);
    if (this.transitioning) return;
    const exit = this.area.exits.find((candidate) => contains(candidate, this.hero));
    if (exit && !this.ui.blocked) {
      this.transition(exit);
      return;
    }
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

  private captureCooldowns(): void {
    this.session.attack = this.attackTimer;
    this.session.skill = this.skillTimer;
    this.session.roll = this.rollCooldown;
    this.session.invulnerable = this.invulnerable;
  }

  private transition(exit: AreaDefinition['exits'][number]): void {
    this.transitioning = true;
    this.hero.setVelocity(0);
    this.physics.pause();
    this.controls.clear();
    this.captureCooldowns();
    // A committed source is safe even if pagehide arrives during the fade or restart.
    const source = structuredClone(this.state);
    source.player.position = { ...this.area.spawn };
    // Prefer the nearest entry on return, outside the trigger.
    const entries = Object.values(this.area.entries);
    entries.sort(
      (a, b) =>
        Math.hypot(a.x - this.hero.x, a.y - this.hero.y) -
        Math.hypot(b.x - this.hero.x, b.y - this.hero.y),
    );
    if (entries[0]) source.player.position = { ...entries[0] };
    this.sceneData.source = source;
    const target = AREAS[exit.target];
    try {
      const entry = target?.entries[exit.entry];
      if (
        !entry ||
        !safeLocation(target, entry) ||
        target.spawns.some(
          (spawn) => Math.hypot(spawn.x - entry.x, spawn.y - entry.y) <= ENEMIES[spawn.kind].aggro,
        )
      )
        throw new Error('Unsafe area entry');
      createTextures(this, target);
      const next = structuredClone(this.state);
      next.player.mapId = exit.target;
      next.player.position = { ...entry };
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart({
          state: next,
          slot: this.ui.activeSlot,
          playing: true,
          session: this.session,
          source,
          arrival: true,
        });
      });
      this.cameras.main.fadeOut(120);
    } catch {
      releaseAreaTextures(this, target);
      this.state.player.position = { ...source.player.position };
      this.hero.setPosition(source.player.position.x, source.player.position.y);
      this.sceneData.source = undefined;
      this.transitioning = false;
      this.physics.resume();
      this.ui.toast(
        'Area gagal dimuat. Masuk exit lagi untuk mencoba ulang; progres tetap aman.',
        'error',
      );
    }
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
    if (this.transitioning || this.invulnerable > 0 || this.ui.blocked) return;
    this.state.player.hp -= amount;
    this.invulnerable = 0.8;
    this.audio.play('hurt');
    this.effects.floating(this.hero.x, this.hero.y, `−${amount}`, '#f0a58c');
    this.cameras.main.shake(140, 0.003);
    if (this.state.player.hp <= 0) {
      const gold = this.state.player.gold;
      recoverFromDefeat(this.state);
      this.invulnerable = 2;
      this.transitioning = true;
      this.physics.pause();
      this.controls.clear();
      this.captureCooldowns();
      this.scene.restart({
        state: this.state,
        playing: true,
        slot: this.ui.activeSlot,
        session: this.session,
        arrival: true,
      });
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
    if (this.transitioning) return;
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
    const result = this.saves.write(slot, this.sceneData.source ?? this.state);
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
