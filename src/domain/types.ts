export type JobId =
  'warrior' | 'knight' | 'mage' | 'archer' | 'assassin' | 'priest' | 'monk' | 'summoner';
export type EnemyId = 'slime' | 'wolf' | 'golem';
export type MapId = 'larkhaven' | 'mossveil' | 'old-watch';
export type QuestStage = 'available' | 'active' | 'complete';
export type ItemId =
  'herb' | 'tonic' | 'wood-sword' | 'iron-sword' | 'steel-sword' | 'padded-vest' | 'leather-cap';
export type EquipSlot = 'weapon' | 'body' | 'head';
export interface EquipmentState {
  weapon: ItemId;
  body: ItemId | null;
  head: ItemId | null;
}
export interface Point {
  x: number;
  y: number;
}
export interface PlayerState {
  mapId: MapId;
  level: number;
  xp: number;
  hp: number;
  stamina: number;
  gold: number;
  job: JobId | null;
  equipment: EquipmentState;
  inventory: Record<ItemId, number>;
  position: Point;
}
export interface WorldState {
  seconds: number;
  kills: Record<EnemyId, number>;
  gathered: string[];
  opened: string[];
  quests: { supplies: QuestStage; sentinel: QuestStage };
  questKills: number;
  bossDefeated: boolean;
  merchantStock: number;
}
export interface GameState {
  player: PlayerState;
  world: WorldState;
}
export interface JobDefinition {
  id: JobId;
  name: string;
  description: string;
  skill: string;
  hp: number;
  damage: number;
  reach: number;
  advanced: string[];
}
export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  gold: number;
  aggro: number;
  respawn: number;
}
export interface Rect extends Point {
  w: number;
  h: number;
}
