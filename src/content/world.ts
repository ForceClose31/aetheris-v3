import type { EnemyId, MapId, Point, Rect } from '../domain/types';

// New games and defeat recovery share this location, independently of the active view.
export const START_POSITION: Point = { x: 464, y: 690 };
const WORLD = { width: 1920, height: 1408 };
const RIVER = { x: 824, width: 96, bridgeY: 666, bridgeHeight: 92 };
const PATHS: Rect[] = [
  { x: 408, y: 285, w: 88, h: 915 },
  { x: 160, y: 632, w: 1350, h: 76 },
  { x: 277, y: 494, w: 368, h: 238 },
  { x: 1180, y: 296, w: 64, h: 430 },
  { x: 1140, y: 276, w: 380, h: 70 },
  { x: 1338, y: 298, w: 70, h: 470 },
  { x: 1060, y: 700, w: 62, h: 385 },
];
const HOUSES = [
  { x: 250, y: 440, style: 'red', label: 'RUMAH TABIB' },
  { x: 594, y: 433, style: 'blue', label: 'BENGKEL BORIN' },
  { x: 272, y: 910, style: 'brown', label: 'THE WAYFARER' },
  { x: 607, y: 880, style: 'guild', label: 'BALAI DESA' },
];
const NPCS = [
  { id: 'mara', name: 'Mara', role: 'Penjaga desa', x: 500, y: 585, color: 'guard' },
  { id: 'elian', name: 'Elian', role: 'Tabib', x: 275, y: 500, color: 'healer' },
  { id: 'borin', name: 'Borin', role: 'Pandai besi', x: 602, y: 497, color: 'smith' },
  { id: 'sera', name: 'Sera', role: 'Pelatih guild', x: 620, y: 950, color: 'trainer' },
] as const;
export type NpcId = (typeof NPCS)[number]['id'];
const HERBS: (Point & { id: string })[] = [
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
const SPAWNS: (Point & { kind: EnemyId })[] = [
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
const CHESTS = [
  { id: 'wayside-cache', x: 742, y: 1020 },
  { id: 'forest-cache', x: 1630, y: 985 },
];
const CAMP = { x: 421, y: 790 };
// Hand-placed groves. Decorative pixels are seeded; traversal and encounters are authored.
const GROVES: Rect[] = [
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
const RUINS = { x: 1290, y: 218, w: 205, h: 163 };

interface Region {
  name: string;
  subtitle: string;
}

export interface AreaDefinition {
  props: (Point & {
    kind:
      | 'fence'
      | 'lamp'
      | 'sign'
      | 'bench'
      | 'supplies'
      | 'forge'
      | 'laundry'
      | 'shrub'
      | 'fern'
      | 'log'
      | 'rubble'
      | 'banner';
  })[];
  entries: Record<string, Point>;
  exits: (Rect & { id: string; target: MapId; entry: string; label: string })[];
  width: number;
  height: number;
  physicsBounds: Rect;
  spawn: Point;
  overview: Point;
  terrainKey: string;
  river: typeof RIVER | null;
  paths: Rect[];
  houses: typeof HOUSES;
  npcs: readonly (Point & { id: NpcId; name: string; role: string; color: string })[];
  herbs: typeof HERBS;
  spawns: typeof SPAWNS;
  chests: typeof CHESTS;
  camp: Point | null;
  groves: Rect[];
  ruins: Rect | null;
  rocks: Point[];
  pillars: Point[];
  well: Point | null;
  forestStartX: number;
  square: Rect | null;
  arena: (Point & { radii: number[] }) | null;
  regions: (Region & { contains: (x: number, y: number) => boolean })[];
  defaultRegion: Region;
  atlas: {
    title: string;
    subtitle: string;
    description: string;
    labels: (Point & { text: string; fontSize: number })[];
  };
}

// Phase 1 retains the complete legacy world as one active area, without exits or a registry.
export const LEGACY_AREA: AreaDefinition = {
  props: [],
  entries: {},
  exits: [],
  ...WORLD,
  physicsBounds: { x: 30, y: 40, w: WORLD.width - 60, h: WORLD.height - 70 },
  spawn: START_POSITION,
  overview: { x: 700, y: 610 },
  terrainKey: 'terrain',
  river: RIVER,
  paths: PATHS,
  houses: HOUSES,
  npcs: NPCS,
  herbs: HERBS,
  spawns: SPAWNS,
  chests: CHESTS,
  camp: CAMP,
  groves: GROVES,
  ruins: RUINS,
  rocks: [
    { x: 192, y: 566 },
    { x: 696, y: 625 },
    { x: 197, y: 980 },
    { x: 712, y: 1152 },
    { x: 987, y: 809 },
    { x: 1314, y: 1110 },
    { x: 1550, y: 351 },
    { x: 1635, y: 722 },
  ],
  pillars: [
    { x: 1286, y: 228 },
    { x: 1493, y: 228 },
    { x: 1286, y: 398 },
    { x: 1493, y: 398 },
  ],
  well: { x: 438, y: 584 },
  forestStartX: RIVER.x + RIVER.width,
  square: { x: 345, y: 526, w: 210, h: 179 },
  arena: { x: 1380, y: 303, radii: [58, 47] },
  regions: [
    { name: 'Larkhaven', subtitle: 'DESA DI TEPI DUNIA', contains: (x) => x < RIVER.x },
    {
      name: 'The Old Watch',
      subtitle: 'RERUNTUHAN PENJAGA',
      contains: (x, y) => y < 410 && x > 1200,
    },
  ],
  defaultRegion: { name: 'Mossveil Woods', subtitle: 'WILAYAH LIAR · LV. 1–10' },
  atlas: {
    title: 'The Larkhaven Reach',
    subtitle: 'ATLAS · WILAYAH PEMBUKA',
    description: 'Peta Larkhaven, Mossveil dan The Old Watch',
    labels: [
      { x: 445, y: 1080, text: 'L A R K H A V E N', fontSize: 18 },
      { x: 1350, y: 1250, text: 'M O S S V E I L', fontSize: 18 },
      { x: 1380, y: 165, text: 'The Old Watch', fontSize: 13 },
    ],
  },
};

export function regionAt(area: AreaDefinition, x: number, y: number): Region {
  return area.regions.find((region) => region.contains(x, y)) ?? area.defaultRegion;
}

// The split uses local coordinates; the original definition also validates v1 locations.
export const AREA_ORIGINS: Record<MapId, Point> = {
  larkhaven: { x: 0, y: 0 },
  mossveil: { x: 824, y: 0 },
  'old-watch': { x: 1200, y: 0 },
};

export function legacyMapAt({ x, y }: Point): MapId {
  return x < 824 ? 'larkhaven' : y < 410 && x > 1200 ? 'old-watch' : 'mossveil';
}

function splitArea(
  id: MapId,
  width: number,
  height: number,
  spawn: Point,
  name: string,
): AreaDefinition {
  const origin = AREA_ORIGINS[id];
  const local = <T extends Point>(point: T): T => ({
    ...point,
    x: point.x - origin.x,
    y: point.y - origin.y,
  });
  const belongs = (point: Point): boolean => legacyMapAt(point) === id;
  const village = id === 'larkhaven';
  const watch = id === 'old-watch';
  return {
    props: [],
    width,
    height,
    physicsBounds: { x: 30, y: 40, w: width - 60, h: height - 70 },
    spawn,
    overview: spawn,
    entries: {},
    exits: [],
    terrainKey: `terrain-${id}`,
    river: id === 'mossveil' ? { ...RIVER, x: 0 } : null,
    paths: PATHS.filter((p) => p.x + p.w > origin.x && p.x < origin.x + width && p.y < height).map(
      local,
    ),
    houses: village ? HOUSES : [],
    npcs: village ? NPCS : [],
    herbs: HERBS.filter(belongs).map(local),
    chests: CHESTS.filter(belongs).map(local),
    spawns: SPAWNS.filter(belongs).map(local),
    camp: village ? CAMP : null,
    well: village ? LEGACY_AREA.well : null,
    square: village ? LEGACY_AREA.square : null,
    groves: GROVES.filter(belongs).map(local),
    rocks: LEGACY_AREA.rocks.filter(belongs).map(local),
    pillars: watch ? LEGACY_AREA.pillars.map(local) : [],
    ruins: watch ? local(RUINS) : null,
    arena: watch ? local(LEGACY_AREA.arena!) : null,
    forestStartX: village ? width : 0,
    regions: [],
    defaultRegion: {
      name,
      subtitle: village
        ? 'DESA DI TEPI DUNIA'
        : watch
          ? 'RERUNTUHAN PENJAGA'
          : 'WILAYAH LIAR · LV. 1–10',
    },
    atlas: {
      title: name,
      subtitle: 'ATLAS · WILAYAH PEMBUKA',
      description: `Peta ${name} dan jalur keluar`,
      labels: [],
    },
  };
}

export const AREAS: Record<MapId, AreaDefinition> = {
  larkhaven: splitArea('larkhaven', 824, 1408, START_POSITION, 'Larkhaven'),
  mossveil: splitArea('mossveil', 1096, 1408, { x: 135, y: 730 }, 'Mossveil Woods'),
  'old-watch': splitArea('old-watch', 720, 740, { x: 360, y: 610 }, 'The Old Watch'),
};
AREAS.larkhaven.entries = { 'from-mossveil': { x: 720, y: 700 } };
AREAS.larkhaven.exits = [
  {
    id: 'village-east',
    x: 766,
    y: 675,
    w: 28,
    h: 60,
    target: 'mossveil',
    entry: 'from-larkhaven',
    label: 'Mossveil →',
  },
];
AREAS.mossveil.entries = {
  'from-larkhaven': AREAS.mossveil.spawn,
  'from-watch': { x: 700, y: 300 },
};
AREAS.mossveil.exits = [
  {
    id: 'forest-west',
    x: 40,
    y: 680,
    w: 30,
    h: 60,
    target: 'larkhaven',
    entry: 'from-mossveil',
    label: '← Larkhaven',
  },
  {
    id: 'forest-watch',
    x: 674,
    y: 215,
    w: 52,
    h: 30,
    target: 'old-watch',
    entry: 'from-mossveil',
    label: '↑ The Old Watch',
  },
];
AREAS['old-watch'].entries = { 'from-mossveil': AREAS['old-watch'].spawn };
AREAS['old-watch'].exits = [
  {
    id: 'watch-south',
    x: 334,
    y: 675,
    w: 52,
    h: 30,
    target: 'mossveil',
    entry: 'from-watch',
    label: 'Mossveil ↓',
  },
];
// The south approach is new traversal space, using the existing path painter.
AREAS['old-watch'].paths.push({ x: 330, y: 360, w: 60, h: 345 });
AREAS['old-watch'].groves = [{ x: 572, y: 172, w: 70, h: 400 }];
AREAS.mossveil.paths.push({ x: 674, y: 230, w: 52, h: 395 });

// The paved plaza replaces the legacy rectangular dirt clearing.
AREAS.larkhaven.paths = AREAS.larkhaven.paths.filter((path) => path.w !== 368);
// Authored clusters frame destinations; main paths and interaction approaches stay open.
AREAS.larkhaven.paths.push(
  { x: 233, y: 433, w: 38, h: 113 },
  { x: 261, y: 510, w: 90, h: 36 },
  { x: 576, y: 428, w: 38, h: 113 },
  { x: 254, y: 909, w: 38, h: 62 },
  { x: 271, y: 935, w: 156, h: 38 },
  { x: 588, y: 880, w: 38, h: 90 },
  { x: 467, y: 951, w: 158, h: 38 },
);
AREAS.larkhaven.props = [
  { kind: 'fence', x: 170, y: 537 },
  { kind: 'fence', x: 230, y: 550 },
  { kind: 'shrub', x: 157, y: 447 },
  { kind: 'shrub', x: 340, y: 448 },
  { kind: 'laundry', x: 305, y: 305 },
  { kind: 'forge', x: 680, y: 472 },
  { kind: 'supplies', x: 686, y: 526 },
  { kind: 'fence', x: 551, y: 545 },
  { kind: 'lamp', x: 380, y: 594 },
  { kind: 'lamp', x: 532, y: 722 },
  { kind: 'sign', x: 725, y: 656 },
  { kind: 'lamp', x: 750, y: 763 },
  { kind: 'bench', x: 350, y: 793 },
  { kind: 'supplies', x: 182, y: 941 },
  { kind: 'sign', x: 346, y: 945 },
  { kind: 'fence', x: 215, y: 991 },
  { kind: 'banner', x: 690, y: 915 },
  { kind: 'bench', x: 536, y: 934 },
  { kind: 'lamp', x: 498, y: 1035 },
  { kind: 'shrub', x: 655, y: 1082 },
];
AREAS.mossveil.props = [
  { kind: 'fern', x: 168, y: 516 },
  { kind: 'fern', x: 231, y: 851 },
  { kind: 'fern', x: 467, y: 533 },
  { kind: 'fern', x: 795, y: 1050 },
  { kind: 'shrub', x: 586, y: 842 },
  { kind: 'log', x: 610, y: 1019 },
  { kind: 'log', x: 257, y: 468 },
  { kind: 'sign', x: 643, y: 302 },
  { kind: 'fern', x: 110, y: 805 },
  { kind: 'rubble', x: 749, y: 382 },
];
AREAS['old-watch'].props = [
  { kind: 'rubble', x: 92, y: 479 },
  { kind: 'rubble', x: 277, y: 460 },
  { kind: 'rubble', x: 489, y: 299 },
  { kind: 'rubble', x: 435, y: 521 },
  { kind: 'banner', x: 293, y: 188 },
  { kind: 'banner', x: 409, y: 636 },
  { kind: 'shrub', x: 80, y: 561 },
  { kind: 'fern', x: 485, y: 410 },
  { kind: 'sign', x: 304, y: 634 },
];

export function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function areaObstacles(area: AreaDefinition): Rect[] {
  const obstacles: Rect[] = [];
  const add = (x: number, y: number, w: number, h: number): void => {
    obstacles.push({ x: x - w / 2, y: y - h / 2, w, h });
  };
  const river = area.river;
  if (river) {
    obstacles.push({ x: river.x, y: 0, w: river.width, h: river.bridgeY });
    obstacles.push({
      x: river.x,
      y: river.bridgeY + river.bridgeHeight,
      w: river.width,
      h: area.height - river.bridgeY - river.bridgeHeight,
    });
  }
  area.houses.forEach((h) => add(h.x, h.y - 44, 164, 80));
  for (const grove of area.groves)
    for (let y = grove.y; y < grove.y + grove.h; y += 76)
      for (let x = grove.x; x < grove.x + grove.w; x += 70)
        add(x + (Math.floor(y / 76) % 2) * 22, y - 9, 18, 18);
  area.rocks.forEach((p) => add(p.x, p.y - 10, 43, 25));
  area.pillars.forEach((p) => add(p.x, p.y - 15, 42, 30));
  if (area.well) add(area.well.x, area.well.y - 14, 62, 36);
  area.npcs.forEach((p) => add(p.x, p.y - 10, 22, 22));
  for (const p of area.props) {
    if (p.kind === 'fence') add(p.x, p.y - 5, 60, 10);
    if (p.kind === 'bench') add(p.x, p.y - 7, 44, 14);
    if (p.kind === 'log') add(p.x, p.y - 8, 52, 16);
    if (p.kind === 'forge' || p.kind === 'supplies') add(p.x, p.y - 8, 36, 16);
    if (p.kind === 'lamp' || p.kind === 'sign' || p.kind === 'banner') add(p.x, p.y - 4, 8, 8);
  }
  return obstacles;
}

export function safePosition(x: number, y: number, obstacles: Rect[]): boolean {
  return !obstacles.some(
    (r) => x + 12 > r.x && x - 12 < r.x + r.w && y > r.y && y - 20 < r.y + r.h,
  );
}

export function safeLocation(area: AreaDefinition, point: Point): boolean {
  const b = area.physicsBounds;
  return (
    point.x >= b.x + 12 &&
    point.x <= b.x + b.w - 12 &&
    point.y >= b.y + 20 &&
    point.y <= b.y + b.h &&
    safePosition(point.x, point.y, areaObstacles(area)) &&
    !area.exits.some((exit) => contains(exit, point))
  );
}
