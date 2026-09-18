import type { EnemyId, Point, Rect } from '../domain/types';

export const WORLD = { width: 1920, height: 1408, spawn: { x: 464, y: 690 } };
export const RIVER = { x: 824, width: 96, bridgeY: 666, bridgeHeight: 92 };
export const PATHS: Rect[] = [
  { x: 408, y: 285, w: 88, h: 915 },
  { x: 160, y: 632, w: 1350, h: 76 },
  { x: 277, y: 494, w: 368, h: 238 },
  { x: 1180, y: 296, w: 64, h: 430 },
  { x: 1140, y: 276, w: 380, h: 70 },
  { x: 1338, y: 298, w: 70, h: 470 },
  { x: 1060, y: 700, w: 62, h: 385 },
];
export const HOUSES = [
  { x: 250, y: 440, style: 'red', label: 'RUMAH TABIB' },
  { x: 594, y: 433, style: 'blue', label: 'BENGKEL BORIN' },
  { x: 272, y: 910, style: 'brown', label: 'THE WAYFARER' },
  { x: 607, y: 880, style: 'red', label: 'BALAI DESA' },
];
export const NPCS = [
  { id: 'mara', name: 'Mara', role: 'Penjaga desa', x: 500, y: 585, color: 'guard' },
  { id: 'elian', name: 'Elian', role: 'Tabib', x: 275, y: 500, color: 'healer' },
  { id: 'borin', name: 'Borin', role: 'Pandai besi', x: 602, y: 497, color: 'smith' },
  { id: 'sera', name: 'Sera', role: 'Pelatih guild', x: 620, y: 950, color: 'trainer' },
] as const;
export type NpcId = (typeof NPCS)[number]['id'];
export const HERBS: (Point & { id: string })[] = [
  { id: 'leaf-1', x: 1000, y: 608 },
  { id: 'leaf-2', x: 1110, y: 802 },
  { id: 'leaf-3', x: 1274, y: 601 },
  { id: 'leaf-4', x: 1470, y: 800 },
  { id: 'leaf-5', x: 990, y: 940 },
  { id: 'leaf-6', x: 1448, y: 441 },
  { id: 'leaf-7', x: 1160, y: 1050 },
  { id: 'leaf-8', x: 1570, y: 627 },
  { id: 'leaf-9', x: 1560, y: 1040 },
];
export const SPAWNS: (Point & { kind: EnemyId })[] = [
  { kind: 'slime', x: 1050, y: 590 },
  { kind: 'slime', x: 1140, y: 755 },
  { kind: 'slime', x: 1280, y: 705 },
  { kind: 'slime', x: 1460, y: 675 },
  { kind: 'slime', x: 1040, y: 1000 },
  { kind: 'slime', x: 1240, y: 960 },
  { kind: 'wolf', x: 1490, y: 930 },
  { kind: 'wolf', x: 1590, y: 560 },
  { kind: 'wolf', x: 1130, y: 400 },
  { kind: 'golem', x: 1380, y: 285 },
];
export const CHESTS = [
  { id: 'wayside-cache', x: 742, y: 1020 },
  { id: 'forest-cache', x: 1630, y: 985 },
];
export const CAMP = { x: 421, y: 790 };
// Hand-placed groves. Decorative pixels are seeded; traversal and encounters are authored.
export const GROVES: Rect[] = [
  { x: 80, y: 85, w: 620, h: 135 },
  { x: 75, y: 260, w: 55, h: 850 },
  { x: 710, y: 280, w: 50, h: 580 },
  { x: 95, y: 1150, w: 620, h: 125 },
  { x: 975, y: 95, w: 740, h: 100 },
  { x: 1720, y: 245, w: 70, h: 940 },
  { x: 955, y: 330, w: 60, h: 165 },
  { x: 1040, y: 1130, w: 600, h: 115 },
  { x: 1240, y: 430, w: 110, h: 75 },
  { x: 1400, y: 1100, w: 70, h: 100 },
  { x: 1545, y: 810, w: 65, h: 65 },
  { x: 1160, y: 860, w: 65, h: 50 },
];
export const RUINS = { x: 1290, y: 218, w: 205, h: 163 };

export function regionAt(x: number, y: number): { name: string; subtitle: string } {
  if (x < RIVER.x) return { name: 'Larkhaven', subtitle: 'DESA DI TEPI DUNIA' };
  if (y < 410 && x > 1200) return { name: 'The Old Watch', subtitle: 'RERUNTUHAN PENJAGA' };
  return { name: 'Mossveil Woods', subtitle: 'WILAYAH LIAR · LV. 1–10' };
}
