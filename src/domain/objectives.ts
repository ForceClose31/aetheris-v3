import type { GameState } from './types';

// Objective kinds needed by the chapter and the campaign foundation.
export type ObjectiveKind = 'discovery' | 'encounter' | 'collect' | 'interact' | 'report';

export interface ObjectiveProgress {
  id: string;
  kind: ObjectiveKind;
  title: string;
  detail: string;
  progress: number;
  target: number | null;
  done: boolean;
  // Main story chain is what the tracker follows; optional entries never gate.
  main: boolean;
  // Future campaign milestones stay represented but unreachable until their
  // content exists, so they can never become current or lock the player.
  playable: boolean;
  current: boolean;
}

// Persistent discovery/interact facts live in WorldState.milestones with stable
// IDs; idempotent by construction. Everything else derives from the quest machine.
export function recordMilestone(state: GameState, id: string): boolean {
  if (state.world.milestones.includes(id)) return false;
  state.world.milestones.push(id);
  return true;
}

export function hasMilestone(state: GameState, id: string): boolean {
  return state.world.milestones.includes(id);
}

// Legacy saves that already progressed past supplies never recorded the new
// campaign marker; they are grandfathered out of the investigation chain.
export function isGrandfathered(state: GameState): boolean {
  return state.world.quests.sentinel !== 'available' && !hasMilestone(state, 'supplies-reported');
}

// The watch route opens through investigation evidence — or legacy progression.
export function watchRouteOpen(state: GameState): boolean {
  if (state.world.quests.sentinel === 'available') return false;
  if (isGrandfathered(state)) return true;
  return (
    hasMilestone(state, 'north-road-trail-read') && state.world.opened.includes('north-road-cache')
  );
}

// Single source for tracker, journal, map markers and NPC dialog steps. The
// quest machine (supplies/sentinel, questKills, bossDefeated) stays authoritative.
export function objectiveSummary(state: GameState): ObjectiveProgress[] {
  const w = state.world;
  const q = w.quests;
  const herb = Math.min(3, state.player.inventory.herb);
  const kills = Math.min(3, w.questKills);
  const accepted = q.supplies !== 'available';
  const gathering = `Moss Slime ${kills}/3 · Moonleaf ${herb}/3\nKembali ke Mara setelah terkumpul.`;
  const watchFound = hasMilestone(state, 'found-old-watch');
  const grandfathered = isGrandfathered(state);
  const entries: ObjectiveProgress[] = [
    {
      id: 'supplies-accept',
      kind: 'interact',
      title: 'Hal-hal kecil yang berarti',
      detail: 'Bicaralah dengan Mara di dekat sumur desa.',
      progress: accepted ? 1 : 0,
      target: 1,
      done: accepted,
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'supplies-slime',
      kind: 'encounter',
      title: 'Hal-hal kecil yang berarti',
      detail: gathering,
      progress: kills,
      target: 3,
      done: q.supplies === 'complete' || (accepted && w.questKills >= 3),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'supplies-herb',
      kind: 'collect',
      title: 'Hal-hal kecil yang berarti',
      detail: gathering,
      progress: herb,
      target: 3,
      done: q.supplies === 'complete' || (accepted && herb >= 3),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'supplies-report',
      kind: 'report',
      title: 'Hal-hal kecil yang berarti',
      detail: gathering,
      progress: q.supplies === 'complete' ? 1 : 0,
      target: 1,
      done: q.supplies === 'complete',
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'investigate-trail',
      kind: 'discovery',
      title: 'Jejak di jalan yang ditutup',
      detail: 'Selidiki Jalur Utara: baca catatan penjaga di jalur.',
      progress: hasMilestone(state, 'north-road-trail-read') || grandfathered ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'north-road-trail-read') || grandfathered,
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'secure-cache',
      kind: 'collect',
      title: 'Jejak di jalan yang ditutup',
      detail: 'Amankan cache gudang jalur dari genggaman wolf.',
      progress: state.world.opened.includes('north-road-cache') || grandfathered ? 1 : 0,
      target: 1,
      done: state.world.opened.includes('north-road-cache') || grandfathered,
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'sentinel-defeat',
      kind: 'encounter',
      title: 'Yang terbangun di utara',
      detail: 'Selidiki The Old Watch di utara Mossveil.',
      progress: w.bossDefeated ? 1 : 0,
      target: 1,
      done: w.bossDefeated,
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'sentinel-report',
      kind: 'report',
      title: 'Yang terbangun di utara',
      detail: 'Penjaga telah tumbang. Kembali ke Mara.',
      progress: q.sentinel === 'complete' ? 1 : 0,
      target: 1,
      done: q.sentinel === 'complete',
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'open-archive',
      kind: 'discovery',
      title: 'Perintah yang tertinggal',
      detail: 'Cap menunjuk ke bawah: temukan Ruang Arsip di bawah watch.',
      progress: hasMilestone(state, 'found-vault') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'found-vault'),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'vault-seal-a',
      kind: 'interact',
      title: 'Perintah yang tertinggal',
      detail: 'Periksa segel barat di Ruang Arsip.',
      progress: hasMilestone(state, 'vault-seal-a') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'vault-seal-a'),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'vault-seal-b',
      kind: 'interact',
      title: 'Perintah yang tertinggal',
      detail: 'Periksa segel timur di Ruang Arsip.',
      progress: hasMilestone(state, 'vault-seal-b') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'vault-seal-b'),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'vault-note',
      kind: 'discovery',
      title: 'Perintah yang tertinggal',
      detail: 'Baca catatan perintah di Ruang Arsip.',
      progress: hasMilestone(state, 'vault-note-read') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'vault-note-read'),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'report-findings',
      kind: 'report',
      title: 'Jalur untuk esok hari',
      detail: 'Bukti telah lengkap. Laporkan temuanmu pada Mara.',
      progress: hasMilestone(state, 'campaign-complete') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'campaign-complete'),
      main: true,
      playable: true,
      current: false,
    },
    {
      id: 'found-old-watch',
      kind: 'discovery',
      title: 'Sekitar Larkhaven',
      detail: 'Temukan The Old Watch di utara Mossveil.',
      progress: watchFound ? 1 : 0,
      target: 1,
      done: watchFound,
      main: false,
      playable: true,
      current: false,
    },
    {
      id: 'found-north-road',
      kind: 'discovery',
      title: 'Sekitar Larkhaven',
      detail: 'Temukan Jalur Utara di utara Mossveil.',
      progress: hasMilestone(state, 'found-north-road') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'found-north-road'),
      main: false,
      playable: true,
      current: false,
    },
    {
      id: 'found-vault',
      kind: 'discovery',
      title: 'Sekitar Larkhaven',
      detail: 'Temukan Ruang Arsip Penjaga di bawah The Old Watch.',
      progress: hasMilestone(state, 'found-vault') ? 1 : 0,
      target: 1,
      done: hasMilestone(state, 'found-vault'),
      main: false,
      playable: true,
      current: false,
    },
  ];
  // The campaign is one sequential chain: the first unfinished main entry is the
  // actionable step for tracker, journal, map marker and dialog alike. Story
  // state that can be derived (grandfathered investigation) is already folded
  // into the done flags above.
  const current = entries.find((entry) => entry.main && entry.playable && !entry.done);
  if (current) current.current = true;
  return entries;
}

export function currentObjective(state: GameState): ObjectiveProgress | null {
  return objectiveSummary(state).find((entry) => entry.current) ?? null;
}
