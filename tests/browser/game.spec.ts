import type Phaser from 'phaser';
import { expect, test, type Page } from '@playwright/test';
import { newGame } from '../../src/domain/progression';
import type { GameState } from '../../src/domain/types';
import type { WorldScene } from '../../src/game/world-scene';

declare global {
  interface Window {
    phase2Scene: WorldScene;
  }
}

async function captureScene(page: Page): Promise<void> {
  // Instrument the module actually loaded by the game, including Vite's HMR query.
  await page.route(/\/src\/game\/world-scene\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}\nconst phase2Create = WorldScene.prototype.create;\nWorldScene.prototype.create = function () { window.phase2Scene = this; phase2Create.call(this); };\n`,
    });
  });
  await page.reload();
  await page.waitForFunction(() => !!window.phase2Scene);
}

async function crossExit(page: Page, id: string, target: string): Promise<void> {
  await page.evaluate((exitId) => {
    const scene = window.phase2Scene;
    const exit = scene['area'].exits.find((e) => e.id === exitId)!;
    scene['hero'].setPosition(exit.x + exit.w / 2, exit.y + exit.h / 2);
  }, id);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scene = window.phase2Scene;
        return scene['transitioning'] ? 'transition' : scene['state'].player.mapId;
      }),
    )
    .toBe(target);
}

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mulai perjalanan', exact: true })).toBeVisible();
}

async function freshStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Mulai perjalanan', exact: true }).click();
  await page.getByRole('button', { name: 'Mulai', exact: true }).first().click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'playing');
  await page.waitForTimeout(300);
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await ready(page);
  await page.evaluate((savedState) => {
    localStorage.setItem(
      'aetheris:save:1',
      JSON.stringify({ version: 3, savedAt: new Date().toISOString(), state: savedState }),
    );
  }, state);
  await page.getByRole('button', { name: /Lanjutkan perjalanan tersimpan/ }).click();
  await page.getByRole('button', { name: 'Muat', exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function saveAndRead(page: Page): Promise<GameState> {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('aetheris:save:1')!).state as GameState,
  );
}

test('Phase 3 environments preserve access, layering, weather readability and area texture lifecycle', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await captureScene(page);
  await freshStart(page);
  for (const map of ['larkhaven', 'mossveil', 'old-watch']) {
    // Freeze only after arrival fade completes, otherwise it masks the weather snapshots
    // and a subsequent forced exit can request fade-out while fade-in is still running.
    await page.waitForFunction(() => !window.phase2Scene.cameras.main.fadeEffect.isRunning);
    const audit = await page.evaluate(async () => {
      const s = window.phase2Scene;
      const area = s['area'];
      const modulePath = '/src/content/world.ts';
      const { safePosition } = await import(modulePath);
      const keys = s.textures.getTextureKeys().filter((key) => key.startsWith('terrain-'));
      const access = [...area.npcs, ...area.chests, ...area.herbs].map((target) => {
        for (let dy = 24; dy <= 56; dy += 8)
          for (let dx = -32; dx <= 32; dx += 8) {
            const point = { x: target.x + dx, y: target.y + dy };
            if (!safePosition(point.x, point.y, s['view'].obstacles)) continue;
            s['hero'].body!.reset(point.x, point.y);
            (s['hero'].body as Phaser.Physics.Arcade.Body).updateFromGameObject();
            const overlap = s.physics.overlap(s['hero'], s['view'].solids);
            const hint = s['interactions'].nearby(point);
            if (!overlap && hint && s['interactions']['target']?.id === target.id) return true;
          }
        return false;
      });
      const canopy = s['view'].occluders.find((image) => image.texture.key.endsWith('/tree'))!;
      s['hero'].setPosition(canopy.x, canopy.y - 45);
      s.update(0, 0);
      const faded = canopy.alpha;
      s['hero'].setPosition(area.spawn.x, area.spawn.y);
      s.update(0, 0);
      s.scene.pause();
      return {
        access,
        faded,
        layer: s['view'].occluders.every((image) => image.depth === image.y),
        keysValid: keys.every((key) => key.startsWith(`${area.terrainKey}/`)),
        bounded: keys.every((key) => {
          const source = s.textures.get(key).getSourceImage();
          return source.width <= 128 && source.height <= 128;
        }),
        hasMissing: s.children.list.some(
          (child) => 'texture' in child && (child.texture as { key: string }).key === '__MISSING',
        ),
      };
    });
    expect(audit.access, map).not.toContain(false);
    expect(audit.faded).toBeCloseTo(0.45);
    expect(audit.layer && audit.keysValid && audit.bounded).toBe(true);
    expect(audit.hasMissing).toBe(false);
    for (const [weather, seconds] of [
      ['day', 0],
      ['night', 540],
      ['rain', 180],
      ['night-rain', 720],
    ] as const) {
      const telegraph = await page.evaluate((seconds) => {
        const s = window.phase2Scene,
          area = s['area'];
        s.cameras.main
          .stopFollow()
          .removeBounds()
          .setZoom(area.houses.length ? 0.62 : area.ruins ? 1.05 : 0.62)
          .centerOn(area.width / 2, area.height / 2);
        s['state'].world.seconds = seconds;
        s['state'].world.quests.supplies = 'complete';
        s['state'].world.quests.sentinel = 'active';
        const actor = s['enemies']['actors'][0];
        if (actor) {
          actor.windup = 1;
          actor.radius = 48;
          actor.target = { ...actor.home };
          s['enemies'].update(0, s['hero']);
        }
        s['effects'].update(0, seconds, s['view'].water);
        return (
          !actor ||
          (s['enemies']['indicators'].depth >
            Math.max(...s['view'].occluders.map((i) => i.depth)) &&
            s['enemies']['indicators'].commandBuffer.length > 0)
        );
      }, seconds);
      expect(telegraph).toBe(true);
      await page.screenshot({ path: `test-results/phase3-${map}-${weather}.png` });
    }
    if (map === 'larkhaven') {
      await page.evaluate(() => {
        const s = window.phase2Scene;
        s.cameras.main.setZoom(1.25).centerOn(422, 522);
        s['effects'].update(0, 0, s['view'].water);
      });
      await page.screenshot({ path: 'test-results/phase3-larkhaven-detail.png' });
    }
    await page.evaluate(() => window.phase2Scene.scene.resume());
    if (map === 'larkhaven') await crossExit(page, 'village-east', 'mossveil');
    if (map === 'mossveil') await crossExit(page, 'forest-watch', 'old-watch');
  }
  await crossExit(page, 'watch-south', 'mossveil');
  await page.waitForFunction(() => !window.phase2Scene.cameras.main.fadeEffect.isRunning);
  await crossExit(page, 'forest-west', 'larkhaven');
  expect(errors).toEqual([]);
});

test('starts, moves, accepts a quest, pauses, and reloads a saved journey', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('Browser error:', error.message);
  });
  await ready(page);
  await page.screenshot({ path: 'test-results/aetheris-title.png' });
  await freshStart(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(330);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  await expect(page.locator('[data-hud="interaction"]')).toContainText('Mara');
  await page.keyboard.press('KeyE');
  await expect(
    page.getByRole('heading', { name: 'Hal-hal kecil yang berarti', exact: true, level: 2 }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Aku akan membantu' }).click();
  await expect(page.locator('[data-hud="quest-body"]')).toContainText('Moss Slime 0/3');
  await page.screenshot({ path: 'test-results/aetheris-playing.png' });
  const saved = await saveAndRead(page);
  expect(saved.world.quests.supplies).toBe('active');
  expect(saved.player.position.x).toBeGreaterThan(480);
  const seconds = saved.world.seconds;
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  const paused = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetheris:save:1')!).state as GameState,
  );
  expect(paused.world.seconds).toBe(seconds);
  await page.reload();
  await page.getByRole('button', { name: /Lanjutkan perjalanan tersimpan/ }).click();
  await page.getByRole('button', { name: 'Muat', exact: true }).first().click();
  await expect(page.locator('[data-hud="quest-body"]')).toContainText('Moss Slime 0/3');
  expect(errors).toEqual([]);
});

test('combat earns quest credit and Mara consumes items and unlocks the boss', async ({ page }) => {
  const state = newGame();
  state.player.mapId = 'mossveil';
  state.player.position = { x: 226, y: 550 };
  state.player.equipment.weapon = 'iron-sword';
  state.player.inventory['iron-sword'] = 1;
  state.player.inventory.herb = 3;
  state.world.quests.supplies = 'active';
  state.world.questKills = 2;
  await loadFixture(page, state);
  await page.keyboard.down('KeyJ');
  await expect(page.locator('[data-hud="quest-body"]')).toContainText('Moss Slime 3/3');
  await page.keyboard.up('KeyJ');
  await page.screenshot({ path: 'test-results/aetheris-combat.png' });
  const fought = await saveAndRead(page);
  expect(fought.world.questKills).toBeGreaterThanOrEqual(3);
  expect(fought.world.kills.slime).toBeGreaterThanOrEqual(1);
  fought.player.mapId = 'larkhaven';
  fought.player.position = { x: 500, y: 635 };
  await loadFixture(page, fought);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Serahkan Moonleaf' }).click();
  await expect(page.locator('[data-hud="quest-title"]')).toHaveText('Yang terbangun di utara');
  const completed = await saveAndRead(page);
  expect(completed.player.inventory.herb).toBe(0);
  expect(completed.world.quests.supplies).toBe('complete');
  expect(completed.world.quests.sentinel).toBe('active');
});

test('boss encounter renders and job selection remains permanent across reloads', async ({
  page,
}) => {
  const state = newGame();
  state.player.mapId = 'old-watch';
  state.player.position = { x: 180, y: 365 };
  state.world.quests.supplies = 'complete';
  state.world.quests.sentinel = 'active';
  await loadFixture(page, state);
  await expect(page.locator('.boss-hud')).toBeVisible();
  await page.screenshot({ path: 'test-results/aetheris-boss.png' });
  state.player.level = 10;
  state.player.hp = 151;
  state.player.mapId = 'larkhaven';
  state.player.position = { x: 620, y: 1000 };
  await loadFixture(page, state);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Mage', exact: true }).click();
  await page.getByRole('button', { name: 'Pilih Mage', exact: true }).click();
  await expect(page.locator('[data-hud="job"]')).toHaveText('Mage');
  const chosen = await saveAndRead(page);
  expect(chosen.player.job).toBe('mage');
  await loadFixture(page, chosen);
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('heading', { name: 'Jalan yang kamu pilih' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Warrior', exact: true })).toHaveCount(0);
});

test('mobile layout exposes working touch actions without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await freshStart(page);
  await expect(page.getByRole('button', { name: 'Atas', exact: true })).toBeVisible();
  await page.getByTitle('Peta [M]', { exact: true }).click();
  await expect(page.locator('.large-map')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup', exact: true }).click();
  const bounds = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  await page.screenshot({ path: 'test-results/aetheris-mobile.png' });
});

test('the two-phase boss can be defeated and the chapter reward is persistent', async ({
  page,
}) => {
  const state = newGame();
  state.player.level = 8;
  state.player.hp = 133;
  state.player.mapId = 'old-watch';
  state.player.position = { x: 180, y: 340 };
  state.player.equipment.weapon = 'iron-sword';
  state.player.inventory['iron-sword'] = 1;
  state.world.quests.supplies = 'complete';
  state.world.quests.sentinel = 'active';
  await loadFixture(page, state);
  await expect(page.locator('.boss-hud')).toBeVisible();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(120);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ');
  await expect(page.locator('.boss-hud')).toBeHidden({ timeout: 15_000 });
  await page.keyboard.up('KeyJ');
  const victory = await saveAndRead(page);
  expect(victory.world.bossDefeated).toBe(true);
  victory.player.mapId = 'larkhaven';
  victory.player.position = { x: 500, y: 635 };
  await loadFixture(page, victory);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Selesaikan perjalanan pertama' }).click();
  const finished = await saveAndRead(page);
  expect(finished.world.quests.sentinel).toBe('complete');
  expect(finished.player.gold).toBe(victory.player.gold + 100);
  await loadFixture(page, finished);
  await expect(page.locator('[data-hud="quest-title"]')).toHaveText('Rumah, untuk sementara');
});

test('repeated exits keep one simulation, cooldowns, respawn, resources, rewards and input listeners', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await captureScene(page);
  await freshStart(page);
  const initial = await page.evaluate(() => {
    const s = window.phase2Scene;
    return {
      actors: s.children.length,
      bodies: s.physics.world.bodies.size,
      pointers: s.input.listenerCount('pointerdown'),
    };
  });
  await crossExit(page, 'village-east', 'mossveil');
  await page.evaluate(() => {
    const s = window.phase2Scene;
    const leaf = s['area'].herbs[0];
    s['interactions'].nearby(leaf);
    s['interactions'].interact();
    const chest = s['area'].chests[0];
    s['interactions'].nearby(chest);
    s['interactions'].interact();
    const enemy = s['enemies']['actors'][0];
    enemy.hp = 1;
    s['enemies'].attack(enemy.sprite, { x: 0, y: 1 }, 1, 57, false);
    s['skillTimer'] = 6;
    s['rollCooldown'] = 3;
  });
  const before = await page.evaluate(() => structuredClone(window.phase2Scene['state']));
  await crossExit(page, 'forest-west', 'larkhaven');
  await crossExit(page, 'village-east', 'mossveil');
  const returned = await page.evaluate(() => {
    const s = window.phase2Scene;
    return {
      skill: s['skillTimer'],
      roll: s['rollCooldown'],
      enemy: s['enemies']['actors'][0].hp,
      herbs: [...s['view'].herbs.keys()],
      state: s['state'],
    };
  });
  expect(returned.skill).toBeGreaterThan(4);
  expect(returned.roll).toBeGreaterThan(1);
  expect(returned.enemy).toBe(0);
  expect(returned.herbs).not.toContain('leaf-1');
  expect(returned.state.player.inventory).toEqual(before.player.inventory);
  expect(returned.state.player.gold).toBe(before.player.gold);
  expect(returned.state.world.kills).toEqual(before.world.kills);
  expect(returned.state.world.opened).toEqual(['forest-cache']);
  await crossExit(page, 'forest-watch', 'old-watch');
  await expect(page.locator('[data-hud="region"]')).toHaveText('The Old Watch');
  await expect(page.locator('.boss-hud')).toBeHidden();
  expect(await page.evaluate(() => window.phase2Scene['enemies']['actors'].length)).toBe(1);
  await page.screenshot({ path: 'test-results/aetheris-phase2-watch.png' });
  await crossExit(page, 'watch-south', 'mossveil');
  await crossExit(page, 'forest-west', 'larkhaven');
  for (let i = 0; i < 7; i++) {
    await crossExit(page, 'village-east', 'mossveil');
    await crossExit(page, 'forest-west', 'larkhaven');
  }
  expect(
    await page.evaluate(() => {
      const s = window.phase2Scene;
      return {
        actors: s.children.length,
        bodies: s.physics.world.bodies.size,
        pointers: s.input.listenerCount('pointerdown'),
      };
    }),
  ).toEqual(initial);
  // One press after repeated bindInput calls still performs exactly one interaction.
  await page.evaluate(() => window.phase2Scene['hero'].setPosition(500, 635));
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('button', { name: 'Aku akan membantu' })).toBeVisible();
  await page.getByRole('button', { name: 'Aku akan membantu' }).click();
  expect(errors).toEqual([]);
});

test('pagehide saves a coherent source during fade and committed target afterward; failed loads can retry', async ({
  page,
}) => {
  await ready(page);
  await captureScene(page);
  await freshStart(page);
  const source = await page.evaluate(() => {
    const s = window.phase2Scene;
    s['state'].player.gold = 123;
    s['transition'](s['area'].exits[0]);
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('aetheris:save:1')!).state as GameState;
  });
  expect(source.player.mapId).toBe('larkhaven');
  expect(source.player.gold).toBe(123);
  await expect
    .poll(() => page.evaluate(() => window.phase2Scene['state'].player.mapId))
    .toBe('mossveil');
  const committed = await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('aetheris:save:1')!).state as GameState;
  });
  expect(committed.player.mapId).toBe('mossveil');
  expect(committed.player.position.x).toBeLessThan(200);
  expect(committed.player.gold).toBe(123);
  // Inject a target texture failure, then retry the same authored exit.
  await page.evaluate(() => {
    const s = window.phase2Scene;
    const create = s.textures.createCanvas;
    s.textures.createCanvas = function (...args) {
      s.textures.createCanvas = create;
      throw new Error(`Test target load failure: ${args[0]}`);
    };
    s['transition'](s['area'].exits[1]);
  });
  await expect(page.locator('.toasts')).toContainText('Area gagal dimuat');
  expect(await page.evaluate(() => window.phase2Scene['state'].player.mapId)).toBe('mossveil');
  expect(await page.evaluate(() => window.phase2Scene['state'].player.gold)).toBe(123);
  await crossExit(page, 'forest-watch', 'old-watch');
  // A failure after restart must rebuild the source too, without saving a mixed location.
  await page.evaluate(() => {
    const s = window.phase2Scene;
    const create = s['createArea'];
    s['createArea'] = function () {
      s['createArea'] = create;
      throw new Error('Test world construction failure');
    };
    s['transition'](s['area'].exits[0]);
  });
  await expect(page.locator('.toasts')).toContainText('Kembali ke area asal');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = window.phase2Scene;
        return s['transitioning'] ? 'transition' : s['state'].player.mapId;
      }),
    )
    .toBe('old-watch');
  await crossExit(page, 'watch-south', 'mossveil');
  await crossExit(page, 'forest-watch', 'old-watch');
  await page.reload();
  await page.getByRole('button', { name: /Lanjutkan perjalanan tersimpan/ }).click();
  await page.getByRole('button', { name: 'Muat', exact: true }).first().click();
  await expect(page.locator('[data-hud="region"]')).toHaveText('The Old Watch');
  await expect(page.locator('[data-hud="gold"]')).toHaveText('123');
});

test('death in the watch loads Larkhaven and preserves progression', async ({ page }) => {
  await ready(page);
  await captureScene(page);
  await freshStart(page);
  await crossExit(page, 'village-east', 'mossveil');
  await crossExit(page, 'forest-watch', 'old-watch');
  await page.evaluate(() => {
    const s = window.phase2Scene;
    s['state'].player.gold = 100;
    s['state'].world.gathered = ['leaf-1'];
    s['state'].world.quests.supplies = 'complete';
    s['state'].world.quests.sentinel = 'active';
    s['takeDamage'](999);
  });
  await expect(page.getByRole('button', { name: 'Bangkit lagi' })).toBeVisible();
  await page.getByRole('button', { name: 'Bangkit lagi' }).click();
  await expect(page.locator('[data-hud="region"]')).toHaveText('Larkhaven');
  const recovered = await saveAndRead(page);
  expect(recovered.player.mapId).toBe('larkhaven');
  expect(recovered.player.position).toEqual({ x: 464, y: 690 });
  expect(recovered.player.gold).toBe(90);
  expect(recovered.world.gathered).toEqual(['leaf-1']);
  expect(recovered.world.quests.sentinel).toBe('active');
  expect(await page.evaluate(() => window.phase2Scene['enemies']['actors'].length)).toBe(0);
});
