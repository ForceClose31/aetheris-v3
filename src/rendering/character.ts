import type Phaser from 'phaser';

export type FacingDir = 'down' | 'up' | 'side';

// Rest pose offsets from the hero foot anchor per cardinal direction; the weapon
// renders above the body depth except when carried on the back (facing up).
const HOLD: Record<FacingDir, { x: number; y: number; rot: number; front: boolean }> = {
  down: { x: 9, y: -12, rot: 0.25, front: true },
  up: { x: -9, y: -12, rot: -0.25, front: false },
  side: { x: 8, y: -16, rot: 0.7, front: true },
};

export interface EquipmentVisual {
  weapon: string;
  body: string | null;
  head: string | null;
}

export interface CharacterPose {
  dir: FacingDir;
  facing: { x: number; y: number };
  equipment: EquipmentVisual;
  attack: number;
  duration: number;
  combo: number;
}

export interface CharacterLayers {
  weapon: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
}

// Every layer shares the hero foot anchor: gear overlays sit on the 32x34 body
// grid with origin (0.5, 1), the weapon grips at (0.5, 0.8); scale matches the hero.
export function createCharacterLayers(
  scene: Phaser.Scene,
  equipment: EquipmentVisual,
): CharacterLayers {
  const layer = (key: string, yOrigin: number): Phaser.GameObjects.Image =>
    scene.add.image(0, 0, key).setOrigin(0.5, yOrigin).setScale(1.65).setDepth(0);
  return {
    weapon: layer(`weapon-${equipment.weapon}`, 0.8),
    body: layer('body-padded-vest', 1).setVisible(false),
    head: layer('head-leather-cap-down', 1).setVisible(false),
  };
}

export function syncCharacterLayers(
  layers: CharacterLayers,
  hero: Phaser.Physics.Arcade.Sprite,
  pose: CharacterPose,
): void {
  const weaponKey = `weapon-${pose.equipment.weapon}`;
  if (layers.weapon.texture.key !== weaponKey) layers.weapon.setTexture(weaponKey);
  const hold = HOLD[pose.dir];
  const flip = hero.flipX;
  let ox = flip ? -hold.x : hold.x;
  let oy = hold.y;
  let rot = flip ? -hold.rot : hold.rot;
  const attacking = pose.attack > 0 && pose.duration > 0;
  if (attacking) {
    // Lunge along the live facing; an attacking weapon always renders in front.
    const progress = Math.min(1, 1 - pose.attack / pose.duration);
    const swing = Math.sin(progress * Math.PI);
    ox += pose.facing.x * 14 * swing;
    oy += pose.facing.y * 14 * swing;
    rot += (pose.combo % 2 === 0 ? -1 : 1) * swing * 1.3;
  }
  // The whole offset follows the hero rotation so roll keeps all layers aligned.
  const cos = Math.cos(hero.rotation);
  const sin = Math.sin(hero.rotation);
  layers.weapon
    .setPosition(hero.x + ox * cos - oy * sin, hero.y + ox * sin + oy * cos)
    .setRotation(rot + hero.rotation)
    .setAlpha(hero.alpha)
    .setDepth(attacking || hold.front ? hero.y + 0.5 : hero.y - 0.5);
  // Gear overlays mirror the hero transform directly and hide when unequipped.
  const gear = (
    layer: Phaser.GameObjects.Image,
    id: string | null,
    key: (id: string) => string,
    depth: number,
  ): void => {
    if (!id) {
      layer.setVisible(false);
      return;
    }
    const textureKey = key(id);
    if (layer.texture.key !== textureKey) layer.setTexture(textureKey);
    layer
      .setPosition(hero.x, hero.y)
      .setRotation(hero.rotation)
      .setFlipX(hero.flipX)
      .setAlpha(hero.alpha)
      .setDepth(hero.y + depth)
      .setVisible(true);
  };
  gear(layers.body, pose.equipment.body, (id) => `body-${id}`, 0.2);
  gear(layers.head, pose.equipment.head, (id) => `head-${id}-${pose.dir}`, 0.3);
}
