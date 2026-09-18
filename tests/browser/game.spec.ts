import { expect, test, type Page } from '@playwright/test';
import { newGame } from '../../src/domain/progression';
import type { GameState } from '../../src/domain/types';

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
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state: savedState }),
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
  state.player.position = { x: 1050, y: 602 };
  state.player.weapon = 'iron-sword';
  state.player.inventory['iron-sword'] = 1;
  state.player.inventory.herb = 3;
  state.world.quests.supplies = 'active';
  state.world.questKills = 2;
  await loadFixture(page, state);
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyJ');
  const fought = await saveAndRead(page);
  expect(fought.world.questKills).toBeGreaterThanOrEqual(3);
  expect(fought.world.kills.slime).toBeGreaterThanOrEqual(1);
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
  state.player.position = { x: 1380, y: 365 };
  state.world.quests.supplies = 'complete';
  state.world.quests.sentinel = 'active';
  await loadFixture(page, state);
  await expect(page.locator('.boss-hud')).toBeVisible();
  await page.screenshot({ path: 'test-results/aetheris-boss.png' });
  state.player.level = 10;
  state.player.hp = 151;
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
  state.player.position = { x: 1380, y: 340 };
  state.player.weapon = 'iron-sword';
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
