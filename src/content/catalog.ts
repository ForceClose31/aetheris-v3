import type {
  EnemyDefinition,
  EnemyId,
  EquipSlot,
  ItemId,
  JobDefinition,
  JobId,
} from '../domain/types';

export const JOBS: Record<JobId, JobDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description: 'Serangan kuat dan sapuan pedang yang lebar.',
    skill: 'Cleave',
    hp: 24,
    damage: 8,
    reach: 56,
    advanced: ['Berserker', 'Paladin', 'Warlord'],
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'Daya tahan tinggi untuk bertarung di garis depan.',
    skill: 'Shield pulse',
    hp: 48,
    damage: 4,
    reach: 48,
    advanced: ['Guardian', 'Templar'],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    description: 'Ledakan aether dengan jangkauan luas.',
    skill: 'Aether burst',
    hp: 0,
    damage: 12,
    reach: 112,
    advanced: ['Archmage', 'Chronomancer', 'Elementalist'],
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    description: 'Serangan skill menjangkau musuh dari jauh.',
    skill: 'Arrow volley',
    hp: 8,
    damage: 7,
    reach: 150,
    advanced: ['Ranger', 'Hawkeye'],
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    description: 'Serangan jarak dekat dengan kerusakan tinggi.',
    skill: 'Shadow strike',
    hp: 4,
    damage: 14,
    reach: 62,
    advanced: ['Shadow Reaper', 'Ninja', 'Phantom Blade'],
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    description: 'Skill memulihkan tubuh sekaligus menghalau musuh.',
    skill: 'Sanctuary',
    hp: 16,
    damage: 3,
    reach: 90,
    advanced: ['High Priest', 'Oracle'],
  },
  monk: {
    id: 'monk',
    name: 'Monk',
    description: 'Pukulan terlatih dengan daya hidup yang seimbang.',
    skill: 'Chi wave',
    hp: 28,
    damage: 9,
    reach: 76,
    advanced: ['Champion', 'Ascetic'],
  },
  summoner: {
    id: 'summoner',
    name: 'Summoner',
    description: 'Memanggil denyut roh di sekitar tubuh.',
    skill: 'Spirit pulse',
    hp: 8,
    damage: 8,
    reach: 104,
    advanced: ['Spiritcaller', 'Conjurer'],
  },
};

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  slime: {
    id: 'slime',
    name: 'Moss Slime',
    hp: 32,
    damage: 7,
    speed: 35,
    xp: 22,
    gold: 4,
    aggro: 150,
    respawn: 22,
  },
  wolf: {
    id: 'wolf',
    name: 'Dusk Wolf',
    hp: 65,
    damage: 12,
    speed: 68,
    xp: 48,
    gold: 8,
    aggro: 190,
    respawn: 32,
  },
  golem: {
    id: 'golem',
    name: 'The Hollow Warden',
    hp: 330,
    damage: 23,
    speed: 31,
    xp: 300,
    gold: 110,
    aggro: 240,
    respawn: 0,
  },
  automaton: {
    id: 'automaton',
    name: 'Arc Automaton',
    hp: 60,
    damage: 12,
    speed: 26,
    xp: 42,
    gold: 7,
    aggro: 150,
    respawn: 0,
  },
};

export const ITEMS: Record<
  ItemId,
  {
    name: string;
    description: string;
    rarity: string;
    slot?: EquipSlot;
    attack?: number;
    hp?: number;
    price?: number;
  }
> = {
  herb: {
    name: 'Moonleaf',
    description: 'Daun obat dari tepian Mossveil. Tiga daun dapat diracik menjadi tonik.',
    rarity: 'Common',
  },
  tonic: {
    name: 'Tonik pemulih',
    description: 'Memulihkan 45 HP. Gunakan dengan tombol R.',
    rarity: 'Common',
    price: 8,
  },
  'wood-sword': {
    name: 'Pedang latihan',
    description: 'Kayu ash yang diasah. Awal yang sederhana.',
    rarity: 'Common',
    slot: 'weapon',
    attack: 0,
  },
  'iron-sword': {
    name: 'Pedang besi',
    description: 'Ditempa Borin. Menambah 9 daya serang.',
    rarity: 'Uncommon',
    slot: 'weapon',
    attack: 9,
    price: 35,
  },
  'steel-sword': {
    name: 'Pedang baja',
    description: 'Tempaan ganda Borin untuk jalan utara. Menambah 16 daya serang.',
    rarity: 'Rare',
    slot: 'weapon',
    attack: 16,
    price: 75,
  },
  'padded-vest': {
    name: 'Rompi empuk',
    description: 'Lapisan kulit tebal karya Borin. Menambah 25 HP maksimum.',
    rarity: 'Uncommon',
    slot: 'body',
    hp: 25,
    price: 40,
  },
  'leather-cap': {
    name: 'Topi kulit',
    description: 'Pelindung kepala ringan pengelana. Menambah 15 HP maksimum.',
    rarity: 'Common',
    slot: 'head',
    hp: 15,
    price: 30,
  },
};

export const BALANCE = {
  walkSpeed: 115,
  rollSpeed: 290,
  rollDuration: 0.23,
  rollCooldown: 0.6,
  rollCost: 25,
  staminaRegen: 21,
  attackCooldown: 0.32,
  knockbackDuration: 0.12,
  knockbackSpeed: 140,
  enemyDeathDuration: 0.3,
  skillCooldown: 6,
  skillCost: 35,
  maxLevel: 100,
  autosaveSeconds: 30,
} as const;
