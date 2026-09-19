import Phaser from 'phaser';
import type { AreaDefinition } from '../content/world';
import { environmentPalette, groundOrnaments, terrainTiles, TILE_SIZE } from './terrain';

type Painter = (context: CanvasRenderingContext2D) => void;
// Small ground-clutter painters; muted on purpose so bright ivory/gold stays reserved for gameplay.
const ORNAMENTS: Record<
  string,
  (c: CanvasRenderingContext2D, palette: string[], x: number, y: number) => void
> = {
  tuft: (c, p, x, y) => {
    pixel(c, p[3]!, x, y + 2, 2, 6);
    pixel(c, p[2]!, x + 4, y, 2, 8);
    pixel(c, p[3]!, x + 8, y + 3, 2, 5);
    pixel(c, '#93a47b', x + 4, y, 2, 2);
  },
  flower: (c, _p, x, y) => {
    pixel(c, '#4f6b45', x + 4, y + 4, 2, 6);
    pixel(c, '#9d7fa3', x + 2, y, 6, 4);
    pixel(c, '#c7aecb', x + 4, y + 1, 2, 2);
  },
  pebble: (c, _p, x, y) => {
    pixel(c, '#79816f', x, y + 4, 6, 4);
    pixel(c, '#949b87', x, y + 4, 4, 2);
    pixel(c, '#667060', x + 8, y + 6, 4, 3);
  },
  mushroom: (c, _p, x, y) => {
    pixel(c, '#c7bda2', x + 3, y + 5, 2, 4);
    pixel(c, '#85604d', x, y + 2, 8, 4);
    pixel(c, '#ab8670', x, y + 2, 8, 2);
    pixel(c, '#d6c8ad', x + 2, y + 3, 2, 1);
  },
  leaf: (c, _p, x, y) => {
    pixel(c, '#7c6f4c', x, y + 4, 5, 2);
    pixel(c, '#94825a', x + 4, y + 2, 5, 2);
    pixel(c, '#6b6142', x + 8, y + 5, 4, 2);
  },
  crack: (c, p, x, y) => {
    pixel(c, p[3]!, x, y, 2, 4);
    pixel(c, p[3]!, x + 2, y + 4, 2, 4);
    pixel(c, p[3]!, x + 4, y + 8, 2, 4);
    pixel(c, p[1]!, x + 4, y + 6, 2, 2);
  },
  dry: (c, _p, x, y) => {
    pixel(c, '#98a07a', x, y + 2, 2, 6);
    pixel(c, '#b4b78d', x + 4, y, 2, 7);
    pixel(c, '#87916b', x + 8, y + 3, 2, 5);
  },
};
const pixel = (
  c: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const hash = (x: number, y: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function texture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: Painter,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) throw new Error(`Cannot create texture ${key}`);
  const context = canvas.getContext();
  context.imageSmoothingEnabled = false;
  try {
    paint(context);
    canvas.refresh();
  } catch (error) {
    scene.textures.remove(key);
    throw error;
  }
}

// The weapon is a separate layer (see character.ts); the base body never bakes one in.
function person(
  c: CanvasRenderingContext2D,
  coat: string,
  accent: string,
  frame: number,
  dir: 'down' | 'up' | 'side',
): void {
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  pixel(c, '#172d2b99', 5, 28, 15, 4);
  if (dir === 'side') {
    pixel(c, '#203133', 10, 22, 4, 7 + step);
    pixel(c, '#203133', 14, 22, 4, 7 - step);
    pixel(c, '#b19c6d', 9 + step, 28 + step, 5, 2);
    pixel(c, '#b19c6d', 14 - step, 28 - step, 5, 2);
  } else {
    pixel(c, '#203133', 8, 22, 4, 7 + step);
    pixel(c, '#203133', 15, 22, 4, 7 - step);
    pixel(c, '#b19c6d', 7, 28 + step, 5, 2);
    pixel(c, '#b19c6d', 15, 28 - step, 5, 2);
  }
  pixel(c, '#233c3c', 6, 12, 15, 12);
  pixel(c, coat, 7, 12, 13, 10);
  if (dir === 'up') {
    pixel(c, accent, 8, 13, 13, 3);
    pixel(c, '#533c2e', 8, 3, 12, 10);
    pixel(c, '#453b30', 8, 2, 11, 5);
    pixel(c, '#726047', 9, 2, 8, 2);
    pixel(c, '#5d4736', 10, 6, 9, 2);
  } else if (dir === 'side') {
    pixel(c, accent, 12, 13, 3, 8);
    pixel(c, '#533c2e', 8, 3, 11, 10);
    pixel(c, '#d8ae7e', 13, 6, 8, 7);
    pixel(c, '#f1c898', 15, 7, 6, 3);
    pixel(c, '#453b30', 8, 2, 11, 5);
    pixel(c, '#726047', 9, 2, 8, 2);
    pixel(c, '#302f2a', 18, 8, 2, 2);
    pixel(c, '#d8ae7e', 21, 9, 2, 2);
  } else {
    pixel(c, accent, 8, 13, 3, 7);
    pixel(c, '#533c2e', 8, 3, 12, 10);
    pixel(c, '#d8ae7e', 9, 6, 10, 7);
    pixel(c, '#f1c898', 10, 7, 8, 3);
    pixel(c, '#453b30', 8, 2, 11, 5);
    pixel(c, '#726047', 9, 2, 8, 2);
    pixel(c, '#302f2a', 17, 8, 2, 2);
  }
  pixel(c, accent, 8, 22, 11, 2);
  pixel(c, coat, 4, 14 + step, 4, 6);
  pixel(c, '#d8ae7e', 4, 20 + step, 4, 3);
  pixel(c, coat, 20, 14 - step, 3, 6);
  pixel(c, '#d8ae7e', 20, 20 - step, 3, 3);
}

export function createTextures(scene: Phaser.Scene, area: AreaDefinition): void {
  for (const kind of new Set(area.props.map((prop) => prop.kind)))
    texture(scene, `${area.terrainKey}/${kind}`, 40, 48, (c) => {
      const p = (color: string, x: number, y: number, w: number, h: number) =>
        pixel(c, color, x, y, w, h);
      const wood = '#776346',
        light = '#ad9361',
        dark = '#35483d';
      p('#203e3433', 5, 43, 30, 3);
      if (kind === 'fence' || kind === 'bench') {
        p(dark, 4, 31, 32, 5);
        p(wood, 5, 29, 30, 4);
        p(light, 5, 29, 30, 1);
        p(wood, 6, 25, 3, 22);
        p(wood, 31, 23, 3, 24);
        p(light, 6, 25, 1, 20);
        p(light, 31, 23, 1, 21);
        p(wood, 6, 39, 28, 3);
        if (kind === 'bench') {
          p(dark, 8, 40, 24, 4);
          p(light, 8, 37, 24, 3);
        }
      } else if (kind === 'lamp' || kind === 'sign' || kind === 'banner') {
        p(dark, 18, 11, 4, 36);
        p(wood, 18, 11, 2, 34);
        p(light, 18, 10, 15, 3);
        if (kind === 'lamp') {
          p(dark, 24, 12, 11, 15);
          p('#a78a50', 25, 14, 9, 12);
          p('#edcc82', 27, 16, 5, 7);
          p('#fff0bc', 28, 17, 2, 4);
          p(dark, 28, 14, 1, 12);
          p(dark, 23, 25, 13, 2);
        } else if (kind === 'sign') {
          p(dark, 5, 18, 31, 12);
          p(light, 5, 17, 28, 10);
          p(wood, 7, 24, 25, 2);
          p('#e1cea0', 11, 20, 13, 2);
          p('#e1cea0', 22, 18, 2, 6);
        } else {
          p('#355d60', 22, 13, 13, 23);
          p('#779184', 22, 13, 2, 21);
          p('#c4b57f', 28, 18, 2, 12);
          p('#c4b57f', 25, 22, 8, 2);
          p('#355d60', 22, 34, 5, 4);
        }
      } else if (kind === 'supplies') {
        p(dark, 6, 29, 18, 16);
        p(wood, 7, 28, 16, 15);
        p(light, 7, 28, 16, 2);
        p(light, 8, 30, 2, 12);
        p(light, 20, 30, 2, 12);
        p(light, 8, 40, 14, 2);
        p('#9d8e68', 25, 33, 10, 11);
        p('#b6a57b', 27, 31, 6, 10);
        p(wood, 27, 33, 6, 2);
      } else if (kind === 'forge') {
        p(wood, 12, 37, 17, 8);
        p(light, 12, 37, 17, 2);
        p('#384b4b', 17, 29, 10, 10);
        p('#73857f', 5, 25, 30, 5);
        p('#b0b3a0', 8, 24, 26, 2);
        p('#384b4b', 9, 29, 23, 3);
        p(wood, 31, 33, 2, 11);
        p('#a8a996', 28, 32, 8, 3);
        p('#e0763f', 19, 34, 4, 2);
        p('#f2a45f', 20, 33, 2, 2);
      } else if (kind === 'laundry') {
        p(wood, 3, 19, 2, 27);
        p(wood, 35, 17, 2, 29);
        p(light, 4, 20, 32, 1);
        p('#a9b49a', 7, 21, 10, 14);
        p('#688982', 21, 21, 10, 11);
        p('#c8c7a4', 8, 21, 2, 12);
        p('#90a695', 22, 21, 2, 9);
      } else if (kind === 'log') {
        p(dark, 5, 36, 30, 9);
        p(wood, 7, 33, 28, 10);
        p(light, 7, 33, 27, 2);
        p('#b6a074', 4, 35, 7, 8);
        p(wood, 6, 37, 3, 4);
        p(dark, 15, 38, 17, 2);
        p('#59724e', 19, 31, 12, 4);
      } else if (kind === 'rubble') {
        for (const [x, y, w, h] of [
          [4, 37, 15, 8],
          [18, 31, 16, 12],
          [28, 40, 9, 6],
        ]) {
          p('#43554f', x!, y!, w!, h!);
          p('#7c8877', x!, y!, w! - 2, h! - 2);
          p('#a0a58c', x!, y!, w! - 3, 2);
        }
        p('#354a45', 25, 33, 2, 8);
        p('#57714d', 6, 42, 10, 3);
      } else {
        for (let i = 0; i < 7; i++) {
          const x = 5 + i * 4,
            y = 33 - Math.floor(Math.sin((i / 6) * Math.PI) * 9);
          p(dark, x, y + 3, 5, 43 - y);
          p(kind === 'fern' ? '#638065' : '#5d774e', x, y, 5, 41 - y);
          p('#8b9966', x, y, 3, 2);
          if (kind === 'fern') p('#304f43', x + 2, y + 6, 3, 2);
        }
      }
    });
  const palette = environmentPalette(area);
  const ornaments = groundOrnaments(area);
  for (let variant = 0; variant < 4; variant++)
    texture(scene, `${area.terrainKey}/ground-${variant}`, TILE_SIZE, TILE_SIZE, (c) => {
      pixel(c, palette[0]!, 0, 0, TILE_SIZE, TILE_SIZE);
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(hash(i, variant + 1) * 64) * 2;
        const y = Math.floor(hash(i, variant + 9) * 64) * 2;
        pixel(c, palette[1]!, x, y, 8, 4);
        pixel(c, palette[i % 5 === 0 ? 3 : 2]!, x + 2, y, 2, 2);
      }
      for (let i = 0; i < 7; i++) {
        const kind = ornaments[i % ornaments.length]!;
        ORNAMENTS[kind](
          c,
          palette,
          Math.floor(hash(i + 31, variant) * 60) * 2 + 2,
          Math.floor(hash(i + 7, variant + 3) * 58) * 2 + 2,
        );
      }
    });
  for (const tile of terrainTiles(area).filter((tile) => tile.detail))
    texture(scene, `${area.terrainKey}/detail-${tile.x}-${tile.y}`, TILE_SIZE, TILE_SIZE, (c) => {
      c.translate(-tile.x, -tile.y);
      area.paths.forEach(({ x, y, w, h }) => {
        // Irregular shoulders follow the long axis; the traversable center stays open.
        const horizontal = w > h;
        const length = horizontal ? w : h;
        const width = horizontal ? h : w;
        for (let along = -6; along < length + 6; along += 6) {
          const taper = along < 6 || along > length - 12 ? Math.min(10, width / 5) : 0;
          const bend = Math.round(Math.sin(along / 63 + x + y) * 4) * 2;
          const fringe = Math.floor(hash(Math.floor(along / 18), x + y) * 3) * 2;
          const across = bend + taper;
          if (horizontal) {
            pixel(
              c,
              palette[5]!,
              x + along,
              y + across - 5 - fringe,
              6,
              width - taper * 2 + 10 + fringe,
            );
            pixel(c, palette[4]!, x + along, y + across, 6, width - taper * 2);
          } else {
            pixel(
              c,
              palette[5]!,
              x + across - 5 - fringe,
              y + along,
              width - taper * 2 + 10 + fringe,
              6,
            );
            pixel(c, palette[4]!, x + across, y + along, width - taper * 2, 6);
          }
        }
        for (let py = y + 4; py < y + h - 4; py += 14)
          for (let px = x + 4; px < x + w - 4; px += 18) {
            const n = hash(px, py);
            if (n > 0.6) pixel(c, palette[5]!, px + Math.floor(n * 4) * 2, py, 4, 2);
            if (n > 0.94) pixel(c, '#b7ac84', px, py - 2, 6, 2);
          }
      });
      // Riverbanks, authored crossing, and stepping stone village square.
      if (area.river) {
        pixel(c, '#294f47', area.river.x - 14, 0, area.river.width + 28, area.height);
        pixel(c, '#74805a', area.river.x - 6, 0, area.river.width + 12, area.height);
        pixel(c, '#285963', area.river.x, 0, area.river.width, area.height);
        for (let y = 0; y < area.height; y += 24) {
          pixel(c, '#326e73', area.river.x + 7, y, area.river.width - 14, 7);
          pixel(c, '#4a8380', area.river.x + 15 + hash(y, 1) * 30, y + 9, 24, 2);
        }
        for (let x = area.river.x - 18; x < area.river.x + area.river.width + 18; x += 10) {
          pixel(c, '#453f31', x, area.river.bridgeY, 10, area.river.bridgeHeight);
          pixel(c, '#a38c5f', x, area.river.bridgeY + 3, 8, area.river.bridgeHeight - 6);
          pixel(c, '#c2a975', x + 1, area.river.bridgeY + 6, 2, area.river.bridgeHeight - 12);
        }
        pixel(c, '#513e2c', area.river.x - 22, area.river.bridgeY - 4, area.river.width + 44, 5);
        pixel(c, '#c3a06a', area.river.x - 22, area.river.bridgeY - 8, area.river.width + 44, 4);
        pixel(
          c,
          '#513e2c',
          area.river.x - 22,
          area.river.bridgeY + area.river.bridgeHeight,
          area.river.width + 44,
          5,
        );
      }
      if (area.square) {
        for (let y = area.square.y; y < area.square.y + area.square.h; y += 22)
          for (let x = area.square.x; x < area.square.x + area.square.w; x += 26) {
            if (
              Math.pow((x + 11 - area.square.x - area.square.w / 2) / (area.square.w / 2), 2) +
                Math.pow((y + 8 - area.square.y - area.square.h / 2) / (area.square.h / 2), 2) >
              1
            )
              continue;
            const inset = hash(x, y) > 0.65 ? 4 : 0;
            pixel(c, '#717961', x + inset, y, 22 - inset, 17);
            pixel(c, '#979b7c', x + inset + 1, y, 19 - inset, 2);
            if (hash(x, y) > 0.7) pixel(c, '#55684d', x + 12, y + 9, 2, 8);
          }
      }
      if (area.ruins) {
        pixel(
          c,
          '#4c6054',
          area.ruins.x - 30,
          area.ruins.y - 20,
          area.ruins.w + 60,
          area.ruins.h + 40,
        );
        for (let y = area.ruins.y; y < area.ruins.y + area.ruins.h; y += 23)
          for (let x = area.ruins.x; x < area.ruins.x + area.ruins.w; x += 25) {
            pixel(c, hash(x, y) > 0.5 ? '#758071' : '#647469', x, y, 22, 20);
            pixel(c, '#8d9680', x, y, 22, 2);
            if (hash(x, y) > 0.4) {
              pixel(c, '#435950', x + 9, y + 7, 2, 13);
              pixel(c, '#435950', x + 11, y + 6, 6, 2);
              pixel(c, '#627a51', x + 1, y + 16, 7, 3);
            }
          }
      }
      if (area.arena)
        for (const radius of area.arena.radii)
          for (let angle = 0; angle < Math.PI * 2; angle += 0.035)
            pixel(
              c,
              '#a4a47b',
              Math.round((area.arena.x + Math.cos(angle) * radius) / 2) * 2,
              Math.round((area.arena.y + Math.sin(angle) * radius) / 2) * 2,
              2,
              2,
            );
      // Small gardens beside the village houses.
      area.houses.slice(0, 1).forEach((house) => {
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 5; col++) {
            const x = house.x - 91 + col * 9;
            const y = house.y + 25 + row * 12;
            pixel(c, '#574e34', x, y, 7, 10);
            pixel(c, '#8b9d58', x + 2, y + 1, 3, 6);
            pixel(c, row === 1 ? '#d2b476' : '#8fa475', x + 1, y + 1, 5, 2);
          }
      });
    });
  // Directional player frames: idle 0, walk 1/2; side view mirrors for left/right.
  for (const dir of ['down', 'up', 'side'] as const)
    for (let frame = 0; frame < 3; frame++)
      texture(scene, `player-${dir}-${frame}`, 32, 34, (c) =>
        person(c, '#6c9ca0', '#d4c193', frame, dir),
      );
  for (const [key, coat, accent] of [
    ['guard', '#9d7063', '#d1b779'],
    ['healer', '#d1c9a6', '#719982'],
    ['smith', '#a37b4f', '#4b4d43'],
    ['trainer', '#737692', '#c0b79c'],
  ])
    texture(scene, key!, 32, 34, (c) => person(c, coat!, accent!, 0, 'down'));
  for (const [id, blade, spine, edge, guard, grip, pommel] of [
    ['wood-sword', '#a3805a', '#c2a06f', '#7c5f43', '#5d4a35', '#6b543c', '#8a6b4a'],
    ['iron-sword', '#cfd6d2', '#eef2ec', '#8f9a97', '#5b5346', '#4a3b2e', '#c9a35c'],
    ['steel-sword', '#e8ecee', '#ffffff', '#a9b3b4', '#c9a35c', '#4a3b2e', '#9c7a3f'],
  ])
    texture(scene, `weapon-${id}`, 22, 26, (c) => {
      pixel(c, blade!, 9, 3, 5, 12);
      pixel(c, spine!, 10, 3, 2, 11);
      pixel(c, edge!, 9, 4, 1, 11);
      pixel(c, edge!, 13, 4, 1, 11);
      pixel(c, blade!, 10, 1, 3, 2);
      pixel(c, guard!, 7, 15, 9, 3);
      pixel(c, grip!, 10, 18, 3, 4);
      pixel(c, pommel!, 10, 22, 3, 2);
    });
  // Equipment overlays share the 32x34 body grid and foot origin of person().
  texture(scene, 'body-padded-vest', 32, 34, (c) => {
    pixel(c, '#4a4034', 6, 12, 15, 11);
    pixel(c, '#7a6a4d', 7, 12, 13, 10);
    pixel(c, '#8f7d59', 7, 12, 13, 2);
    pixel(c, '#5d5140', 7, 19, 13, 2);
    pixel(c, '#9c8a63', 12, 13, 2, 8);
    pixel(c, '#3f4b45', 7, 21, 13, 2);
  });
  const cap =
    (shift: number): Painter =>
    (c) => {
      pixel(c, '#4f4230', 7 + shift, 1, 15, 2);
      pixel(c, '#6b5a3e', 8 + shift, 2, 13, 4);
      pixel(c, '#8a7454', 9 + shift, 2, 11, 1);
      pixel(c, '#5d4f38', 6 + shift, 6, 17, 2);
    };
  for (const dir of ['down', 'up'] as const)
    texture(scene, `head-leather-cap-${dir}`, 32, 34, cap(0));
  texture(scene, 'head-leather-cap-side', 32, 34, cap(1));
  const canopy = area.ruins ? ['#394e45', '#4c6252', '#677958'] : ['#274d3d', '#3b6847', '#648451'];
  // Three shared silhouettes: broad asymmetric, tall layered cone, gnarled leaner.
  const drawTree = (
    c: CanvasRenderingContext2D,
    clusters: [number, number, number, number][],
    gnarled = false,
  ): void => {
    pixel(c, '#213e3388', 10, 75, 49, 8);
    pixel(c, '#4a4633', 28, 42, 12, 37);
    pixel(c, '#7f6d42', 30, 48, 4, 30);
    pixel(c, '#3b4731', 23, 76, 22, 4);
    if (gnarled) {
      pixel(c, '#4a4633', 36, 46, 9, 4);
      pixel(c, '#7f6d42', 44, 45, 2, 3);
    }
    clusters.forEach(([x, y, w, h], i) => {
      for (let row = 0; row < h; row += 3) {
        const inset = Math.floor(Math.abs(row - h / 2) / 4) * 2;
        pixel(c, canopy[0]!, x + inset, y + row, w - inset * 2, 3);
        pixel(c, canopy[1]!, x + inset, y + row, w - inset * 2 - 3, 3);
      }
      for (let k = 0; k < 12; k++) {
        const px = x + 5 + Math.floor(hash(k, i) * (w - 12));
        const py = y + 5 + Math.floor(hash(i, k + 5) * (h - 10));
        pixel(c, canopy[2]!, px, py, 3, 2);
      }
    });
    pixel(c, '#94805a', 30, 61, 2, 14);
    pixel(c, '#584f36', gnarled ? 19 : 22, 78, gnarled ? 17 : 11, 2);
    pixel(c, '#584f36', 39, 76, 8, 3);
  };
  texture(scene, `${area.terrainKey}/tree`, 64, 88, (c) =>
    drawTree(c, [
      [9, 30, 29, 29],
      [29, 24, 29, 31],
      [5, 19, 27, 24],
      [17, 6, 31, 29],
      [39, 15, 20, 25],
    ]),
  );
  texture(scene, `${area.terrainKey}/tree-b`, 64, 88, (c) =>
    drawTree(c, [
      [27, 4, 13, 17],
      [20, 20, 26, 18],
      [13, 37, 38, 18],
      [7, 52, 48, 16],
    ]),
  );
  texture(scene, `${area.terrainKey}/tree-c`, 64, 88, (c) =>
    drawTree(
      c,
      [
        [4, 12, 23, 21],
        [12, 30, 25, 20],
        [20, 47, 29, 17],
      ],
      true,
    ),
  );
  for (const [name, roof, highlight] of [
    ['red', '#945944', '#bb7651'],
    ['blue', '#4d7478', '#76948c'],
    ['brown', '#71674c', '#958b63'],
    ['guild', '#486b69', '#79978a'],
  ]) {
    if (!area.houses.some((house) => house.style === name)) continue;
    texture(scene, `${area.terrainKey}/house-${name}`, 108, 108, (c) => {
      pixel(c, '#203c3388', 6, 94, 100, 12);
      pixel(c, '#434b3f', 10, 52, 88, 49);
      pixel(c, '#b8ab7b', 12, 51, 84, 44);
      pixel(c, '#d1bd87', 13, 52, 40, 36);
      [14, 51, 91].forEach((x) => pixel(c, '#695c3d', x, 53, 5, 43));
      pixel(c, '#67533a', 10, 87, 88, 6);
      pixel(c, '#786347', 48, 68, 18, 29);
      pixel(c, '#3d4437', 51, 70, 12, 26);
      pixel(c, '#a99761', 61, 81, 2, 2);
      [23, 73].forEach((x) => {
        pixel(c, '#6b6648', x, 64, 15, 17);
        pixel(c, '#eac579', x + 2, 65, 11, 13);
        pixel(c, '#967c4f', x + 7, 65, 2, 13);
        pixel(c, '#967c4f', x + 2, 71, 11, 2);
      });
      pixel(c, '#5b503b', 3, 49, 102, 9);
      for (let y = 10; y < 52; y += 6) {
        const inset =
          name === 'brown'
            ? Math.floor((52 - y) * 0.23)
            : name === 'guild'
              ? Math.floor((52 - y) / 12) * 7
              : Math.floor((52 - y) * 0.54);
        pixel(c, roof!, inset, y, 108 - inset * 2, 6);
        pixel(c, highlight!, inset, y, 108 - inset * 2, 1);
        for (let x = inset + (y % 12 === 0 ? 0 : 6); x < 108 - inset; x += 12)
          pixel(c, '#493e322f', x, y + 1, 1, 5);
      }
      pixel(c, '#ccb686', 25, 7, 58, 3);
      pixel(c, '#71715a', 77, 1, 10, 21);
      pixel(c, '#999780', 77, 1, 4, 21);
      pixel(c, '#bdb28b', 75, 0, 14, 4);
      pixel(c, '#b2a37a', 44, 98, 25, 4);
      if (name === 'red') {
        pixel(c, '#536d49', 18, 80, 26, 7);
        for (let x = 20; x < 44; x += 6) {
          pixel(c, '#8d9e62', x, 77, 3, 6);
          pixel(c, '#b49a9d', x, 77, 3, 2);
        }
        pixel(c, '#536d49', 10, 56, 3, 23);
      }
      if (name === 'blue') {
        pixel(c, '#434d4b', 78, 0, 19, 35);
        pixel(c, '#8a9180', 79, 0, 5, 33);
        for (let y = 4; y < 30; y += 7) pixel(c, '#626d63', 84, y, 12, 2);
        pixel(c, '#253c38', 77, 0, 21, 4);
        pixel(c, '#534c3b', 2, 77, 33, 18);
        pixel(c, '#404e4e', 4, 73, 29, 6);
        pixel(c, '#b3b29b', 5, 72, 23, 2);
      }
      if (name === 'brown') {
        pixel(c, '#443e30', 6, 73, 3, 28);
        pixel(c, '#443e30', 99, 73, 3, 28);
        for (let x = 4; x < 103; x += 11) pixel(c, x % 2 ? '#788777' : '#c2b68b', x, 64, 11, 12);
        pixel(c, '#d1bb8b', 4, 76, 99, 3);
      }
      if (name === 'guild') {
        pixel(c, '#a3ac91', 47, 17, 15, 25);
        pixel(c, '#365653', 49, 19, 11, 19);
        pixel(c, '#d9c28d', 53, 22, 3, 12);
        pixel(c, '#d9c28d', 50, 26, 9, 3);
        pixel(c, '#859083', 8, 91, 92, 5);
        pixel(c, '#aab098', 4, 96, 100, 4);
      }
    });
  }
  for (let frame = 0; frame < 2; frame++)
    texture(scene, `slime-${frame}`, 32, 26, (c) => {
      const bounce = frame * 2;
      pixel(c, '#1c373577', 3, 21, 27, 4);
      pixel(c, '#24473e', 3, 10 + bounce, 26, 12 - bounce);
      pixel(c, '#66a58b', 5, 8 + bounce, 22, 13 - bounce);
      pixel(c, '#86c3a0', 9, 5 + bounce, 14, 12 - bounce);
      pixel(c, '#b1d8af', 11, 7 + bounce, 7, 3);
      pixel(c, '#284d48', 10, 14, 3, 3);
      pixel(c, '#284d48', 21, 14, 3, 3);
      pixel(c, '#d6e6c4', 10, 14, 1, 1);
      pixel(c, '#d6e6c4', 21, 14, 1, 1);
    });
  texture(scene, 'wolf', 40, 32, (c) => {
    pixel(c, '#19393177', 2, 26, 37, 5);
    pixel(c, '#405257', 6, 12, 24, 13);
    pixel(c, '#7d8b89', 6, 10, 23, 10);
    pixel(c, '#9ba59b', 13, 10, 16, 4);
    pixel(c, '#64777a', 27, 8, 10, 14);
    pixel(c, '#a3aa9d', 30, 14, 10, 7);
    pixel(c, '#293b40', 34, 15, 2, 2);
    pixel(c, '#4b6267', 28, 2, 4, 9);
    pixel(c, '#7a8884', 35, 3, 3, 8);
    pixel(c, '#3c4b4c', 7, 23, 4, 7);
    pixel(c, '#3c4b4c', 25, 23, 4, 7);
    pixel(c, '#8b958a', 0, 8, 7, 6);
  });
  texture(scene, 'golem', 58, 68, (c) => {
    pixel(c, '#17372b99', 5, 58, 49, 8);
    pixel(c, '#4b5c51', 10, 43, 15, 20);
    pixel(c, '#4b5c51', 34, 43, 15, 20);
    pixel(c, '#818b6e', 12, 43, 9, 16);
    pixel(c, '#818b6e', 36, 43, 9, 16);
    pixel(c, '#495e53', 8, 19, 42, 30);
    pixel(c, '#8b9576', 11, 19, 36, 27);
    pixel(c, '#b1b394', 12, 19, 30, 5);
    pixel(c, '#5d745d', 21, 27, 18, 19);
    pixel(c, '#d8c17f', 27, 29, 7, 11);
    pixel(c, '#f4e6a7', 29, 31, 3, 6);
    pixel(c, '#677962', 18, 3, 25, 19);
    pixel(c, '#9ea98a', 19, 3, 22, 5);
    pixel(c, '#243d38', 22, 12, 17, 4);
    pixel(c, '#dbc27e', 24, 12, 4, 3);
    pixel(c, '#dbc27e', 33, 12, 4, 3);
    pixel(c, '#6e8066', 0, 24, 12, 26);
    pixel(c, '#6e8066', 47, 24, 11, 26);
    pixel(c, '#a4ac8a', 0, 24, 8, 6);
    pixel(c, '#a4ac8a', 48, 24, 8, 6);
    pixel(c, '#52724a', 17, 0, 15, 5);
    pixel(c, '#719050', 2, 20, 10, 6);
  });
  texture(scene, 'herb', 20, 24, (c) => {
    pixel(c, '#284b35', 2, 19, 16, 4);
    pixel(c, '#96b26e', 9, 5, 2, 16);
    pixel(c, '#83ac70', 3, 10, 8, 4);
    pixel(c, '#b8c990', 10, 6, 7, 4);
    pixel(c, '#ced9a0', 6, 2, 8, 5);
    pixel(c, '#f0e3b5', 9, 1, 3, 4);
  });
  texture(scene, 'chest', 28, 24, (c) => {
    pixel(c, '#393c2c', 2, 7, 24, 16);
    pixel(c, '#a18043', 3, 6, 22, 15);
    pixel(c, '#d0af66', 3, 6, 22, 3);
    pixel(c, '#534a33', 3, 13, 22, 2);
    pixel(c, '#c8b075', 6, 7, 3, 14);
    pixel(c, '#c8b075', 20, 7, 3, 14);
    pixel(c, '#e0c782', 12, 12, 5, 5);
  });
  if (area.well)
    texture(scene, `${area.terrainKey}/well`, 52, 62, (c) => {
      pixel(c, '#2d443977', 4, 53, 47, 7);
      pixel(c, '#697a70', 9, 36, 35, 20);
      pixel(c, '#a8ab88', 9, 36, 35, 4);
      pixel(c, '#344f4d', 14, 37, 25, 8);
      pixel(c, '#48807c', 18, 39, 15, 3);
      pixel(c, '#775d3e', 10, 16, 4, 27);
      pixel(c, '#775d3e', 39, 16, 4, 27);
      pixel(c, '#89694a', 6, 11, 42, 8);
      pixel(c, '#b9965c', 13, 5, 28, 7);
      pixel(c, '#d0b878', 18, 2, 18, 5);
      pixel(c, '#c7b87e', 27, 19, 1, 19);
    });
  if (area.camp)
    texture(scene, `${area.terrainKey}/camp`, 32, 32, (c) => {
      pixel(c, '#6d7563', 2, 20, 28, 10);
      pixel(c, '#3b4637', 7, 20, 18, 6);
      pixel(c, '#af7045', 7, 23, 18, 3);
      pixel(c, '#e59d4e', 9, 12, 15, 12);
      pixel(c, '#f5cb73', 12, 7, 9, 17);
      pixel(c, '#fff0bb', 15, 15, 4, 9);
    });
  if (area.pillars.length)
    texture(scene, `${area.terrainKey}/pillar`, 32, 68, (c) => {
      pixel(c, '#344c4377', 0, 59, 32, 9);
      pixel(c, '#778575', 7, 7, 19, 52);
      pixel(c, '#a4ac92', 7, 7, 5, 52);
      pixel(c, '#465e55', 23, 12, 3, 47);
      pixel(c, '#9ea98b', 3, 4, 26, 8);
      pixel(c, '#b8bda0', 3, 4, 26, 2);
      pixel(c, '#858f76', 1, 58, 30, 6);
      pixel(c, '#4f734e', 4, 2, 13, 4);
      pixel(c, '#465d51', 12, 29, 6, 2);
      pixel(c, '#465d51', 17, 31, 3, 7);
    });
  texture(scene, `${area.terrainKey}/rock`, 32, 24, (c) => {
    pixel(c, '#344d3e88', 2, 18, 28, 5);
    pixel(c, '#68766a', 3, 9, 25, 12);
    pixel(c, '#88927a', 7, 4, 17, 12);
    pixel(c, '#a5a58a', 8, 4, 13, 3);
    pixel(c, '#50734c', 3, 16, 13, 4);
  });
}

export function releaseAreaTextures(scene: Phaser.Scene, area: AreaDefinition): void {
  for (const key of scene.textures.getTextureKeys())
    if (key.startsWith(`${area.terrainKey}/`)) scene.textures.remove(key);
}
