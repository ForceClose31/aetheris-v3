import type { AreaDefinition } from '../content/world';

export const TILE_SIZE = 128;

/*
 * Visual contract (details in docs/assets.md): ground tiles are 128px canvases at depth -10,
 * props use foot origin (0.5, 1) and depth = foot Y, bright ivory/gold is reserved for
 * resources and navigation. Each area identity gets its own ornament vocabulary below so
 * shared ground builders still read as different biomes.
 */
export type GroundOrnament =
  | 'tuft'
  | 'flower'
  | 'pebble'
  | 'mushroom'
  | 'leaf'
  | 'crack'
  | 'dry'
  | 'thistle'
  | 'rune'
  | 'moss';

// Each biome gets its own muted ground language; bright ivory/gold stays reserved.
export function groundOrnaments(area: AreaDefinition): GroundOrnament[] {
  switch (area.biome) {
    case 'village':
      return ['tuft', 'flower', 'pebble'];
    case 'forest':
      return ['tuft', 'mushroom', 'leaf'];
    case 'watch':
      return ['dry', 'pebble', 'crack'];
    case 'north':
      return ['dry', 'thistle', 'pebble'];
    case 'vault':
      return ['crack', 'pebble', 'rune'];
    case 'interior':
      return ['crack', 'rune', 'pebble'];
    case 'dungeon':
      return ['crack', 'moss', 'rune'];
  }
}

// Muted ground leaves bright ivory/gold exclusively to resources and navigation.
// Per-biome palettes: muted grounds keep ivory/gold exclusive to gameplay reads.
export function environmentPalette(area: AreaDefinition): string[] {
  switch (area.biome) {
    case 'village':
      return ['#536d49', '#5b754e', '#648054', '#425e42', '#a4966b', '#827d55'];
    case 'forest':
      return ['#35594a', '#3c6250', '#4b7057', '#2c4c43', '#7f8260', '#606e51'];
    case 'watch':
      return ['#525f59', '#5c6960', '#728074', '#424e4b', '#8b907b', '#687568'];
    case 'north':
      return ['#6b6a52', '#75744f', '#827f5a', '#575743', '#a89a72', '#8f8464'];
    case 'vault':
      return ['#3a3f3d', '#434844', '#4d534e', '#2f3431', '#7c7462', '#5c5a50'];
    case 'interior':
      return ['#241f1a', '#2c2620', '#8a6d45', '#6d5535', '#a8854f', '#4a3a28'];
    case 'dungeon':
      return ['#232a2c', '#2a3134', '#333c3e', '#1c2224', '#4d5a58', '#39444a'];
  }
}

export function terrainTiles(area: AreaDefinition) {
  const details = [...area.paths];
  if (area.square) details.push(area.square);
  if (area.ruins)
    details.push({
      x: area.ruins.x - 30,
      y: area.ruins.y - 20,
      w: area.ruins.w + 60,
      h: area.ruins.h + 40,
    });
  if (area.river)
    details.push({ x: area.river.x - 24, y: 0, w: area.river.width + 48, h: area.height });
  if (area.arena) details.push({ x: area.arena.x - 64, y: area.arena.y - 64, w: 128, h: 128 });
  for (const house of area.houses.slice(0, 1))
    details.push({ x: house.x - 96, y: house.y + 20, w: 55, h: 50 });
  const tiles = [];
  for (let y = 0; y < area.height; y += TILE_SIZE)
    for (let x = 0; x < area.width; x += TILE_SIZE)
      tiles.push({
        x,
        y,
        detail: details.some(
          (r) =>
            x < r.x + r.w + 12 &&
            x + TILE_SIZE > r.x - 12 &&
            y < r.y + r.h + 12 &&
            y + TILE_SIZE > r.y - 12,
        ),
      });
  return tiles;
}
