import Phaser from 'phaser';
import type { AreaDefinition } from '../content/world';

type Painter = (context: CanvasRenderingContext2D) => void;
const pixel = (
  c: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
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
  paint(context);
  canvas.refresh();
}

function person(c: CanvasRenderingContext2D, coat: string, accent: string, frame: number): void {
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  pixel(c, '#172d2b99', 5, 28, 15, 4);
  pixel(c, '#203133', 8, 22, 4, 7 + step);
  pixel(c, '#203133', 15, 22, 4, 7 - step);
  pixel(c, '#b19c6d', 7, 28 + step, 5, 2);
  pixel(c, '#b19c6d', 15, 28 - step, 5, 2);
  pixel(c, '#233c3c', 6, 12, 15, 12);
  pixel(c, coat, 7, 12, 13, 10);
  pixel(c, accent, 8, 13, 3, 7);
  pixel(c, accent, 8, 22, 11, 2);
  pixel(c, '#533c2e', 8, 3, 12, 10);
  pixel(c, '#d8ae7e', 9, 6, 10, 7);
  pixel(c, '#f1c898', 10, 7, 8, 3);
  pixel(c, '#453b30', 8, 2, 11, 5);
  pixel(c, '#726047', 9, 2, 8, 2);
  pixel(c, '#302f2a', 17, 8, 2, 2);
  pixel(c, coat, 4, 14 + step, 4, 6);
  pixel(c, '#d8ae7e', 4, 20 + step, 4, 3);
  pixel(c, coat, 20, 14 - step, 3, 6);
  pixel(c, '#d8ae7e', 20, 20 - step, 3, 3);
  pixel(c, '#bcba99', 24, 12, 2, 13);
  pixel(c, '#ede0b3', 25, 10, 1, 12);
  pixel(c, '#99714c', 22, 22, 6, 2);
}

export function createTextures(scene: Phaser.Scene, area: AreaDefinition): void {
  texture(scene, area.terrainKey, area.width, area.height, (c) => {
    pixel(c, '#466348', 0, 0, area.width, area.height);
    for (let y = 0; y < area.height; y += 16) {
      for (let x = 0; x < area.width; x += 16) {
        const r = hash(x, y);
        const forest = x > area.forestStartX;
        pixel(
          c,
          forest
            ? ['#355943', '#3b6048', '#3d6146', '#365a44'][Math.floor(r * 4)]!
            : ['#4a6b4b', '#50704d', '#52714c', '#486b49'][Math.floor(r * 4)]!,
          x,
          y,
          16,
          16,
        );
        pixel(c, forest ? '#648054' : '#73905b', x + Math.floor(r * 12), y + 4, 2, 3);
        if (r > 0.5) pixel(c, '#314f3a', x + 3, y + 10, 3, 2);
        if (r > 0.95) pixel(c, '#afb984', x + 10, y + 9, 2, 2);
      }
    }
    area.paths.forEach(({ x, y, w, h }) => {
      pixel(c, '#657752', x - 6, y - 6, w + 12, h + 12);
      pixel(c, '#8e8b62', x, y, w, h);
      for (let py = y + 4; py < y + h - 4; py += 12)
        for (let px = x + 4; px < x + w - 4; px += 12) {
          const n = hash(px, py);
          pixel(c, n > 0.5 ? '#a09a73' : '#7e805a', px, py, n * 6 + 2, 2);
        }
    });
    // Riverbanks, authored crossing, and stepping stone village square.
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
    for (let y = area.square.y; y < area.square.y + area.square.h; y += 22)
      for (let x = area.square.x; x < area.square.x + area.square.w; x += 26) {
        pixel(c, '#717961', x + (y % 2) * 8, y, 22, 17);
        pixel(c, '#979b7c', x + 1, y, 20, 2);
      }
    pixel(c, '#4c6054', area.ruins.x - 30, area.ruins.y - 20, area.ruins.w + 60, area.ruins.h + 40);
    for (let y = area.ruins.y; y < area.ruins.y + area.ruins.h; y += 23)
      for (let x = area.ruins.x; x < area.ruins.x + area.ruins.w; x += 25) {
        pixel(c, hash(x, y) > 0.5 ? '#758071' : '#647469', x, y, 22, 20);
        pixel(c, '#8d9680', x, y, 22, 2);
      }
    c.strokeStyle = '#a4a47b';
    c.lineWidth = 3;
    for (const radius of area.arena.radii) {
      c.beginPath();
      c.arc(area.arena.x, area.arena.y, radius, 0, Math.PI * 2);
      c.stroke();
    }
    // Small gardens beside the village houses.
    area.houses.forEach((house) => {
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
  for (let frame = 0; frame < 3; frame++)
    texture(scene, `player-${frame}`, 32, 34, (c) => person(c, '#6c9ca0', '#d4c193', frame));
  for (const [key, coat, accent] of [
    ['guard', '#9d7063', '#d1b779'],
    ['healer', '#d1c9a6', '#719982'],
    ['smith', '#a37b4f', '#4b4d43'],
    ['trainer', '#737692', '#c0b79c'],
  ])
    texture(scene, key!, 32, 34, (c) => person(c, coat!, accent!, 0));
  texture(scene, 'tree', 64, 88, (c) => {
    pixel(c, '#213e3388', 10, 75, 49, 8);
    pixel(c, '#4a4633', 28, 42, 12, 37);
    pixel(c, '#7f6d42', 30, 48, 4, 30);
    pixel(c, '#3b4731', 23, 76, 22, 4);
    const layers = [
      [8, 34, 49, 25],
      [3, 26, 57, 23],
      [8, 13, 48, 26],
      [17, 4, 30, 22],
      [25, 0, 15, 14],
    ];
    layers.forEach(([x, y, w, h], i) => {
      pixel(c, ['#244b39', '#2b573e', '#356847', '#45784d', '#588953'][i]!, x!, y!, w!, h!);
      pixel(c, '#608854', x! + 4, y! + 3, w! - 12, 3);
      pixel(c, '#79965b', x! + 7, y! + 3, 8, 2);
      pixel(c, '#203f32', x! + w! - 6, y! + h! - 8, 6, 6);
    });
    for (let i = 0; i < 33; i++)
      pixel(
        c,
        i % 3 === 0 ? '#719452' : '#3e7145',
        10 + hash(i, 1) * 40,
        10 + hash(i, 2) * 39,
        4,
        2,
      );
  });
  for (const [name, roof, highlight] of [
    ['red', '#945944', '#bb7651'],
    ['blue', '#4d7478', '#76948c'],
    ['brown', '#71674c', '#958b63'],
  ]) {
    texture(scene, `house-${name}`, 108, 108, (c) => {
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
        const inset = Math.floor((52 - y) * 0.54);
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
  texture(scene, 'well', 52, 62, (c) => {
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
  texture(scene, 'camp', 32, 32, (c) => {
    pixel(c, '#6d7563', 2, 20, 28, 10);
    pixel(c, '#3b4637', 7, 20, 18, 6);
    pixel(c, '#af7045', 7, 23, 18, 3);
    pixel(c, '#e59d4e', 9, 12, 15, 12);
    pixel(c, '#f5cb73', 12, 7, 9, 17);
    pixel(c, '#fff0bb', 15, 15, 4, 9);
  });
  texture(scene, 'pillar', 32, 68, (c) => {
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
  texture(scene, 'rock', 32, 24, (c) => {
    pixel(c, '#344d3e88', 2, 18, 28, 5);
    pixel(c, '#68766a', 3, 9, 25, 12);
    pixel(c, '#88927a', 7, 4, 17, 12);
    pixel(c, '#a5a58a', 8, 4, 13, 3);
    pixel(c, '#50734c', 3, 16, 13, 4);
  });
}
