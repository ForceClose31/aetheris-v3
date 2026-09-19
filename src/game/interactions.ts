import { ITEMS, JOBS } from '../content/catalog';
import type { AreaDefinition, NpcId } from '../content/world';
import { currentObjective, hasMilestone, recordMilestone } from '../domain/objectives';
import {
  buyItem,
  chooseJob,
  completeSentinel,
  completeSupplies,
  craftTonic,
  maxHp,
  reportVaultFindings,
} from '../domain/progression';
import type { GameState, ItemId, JobId, Point } from '../domain/types';
import type { DialogAction, GameInterface } from '../ui/interface';
import type { WorldView } from '../rendering/world';

interface Target {
  id: string;
  type: 'npc' | 'herb' | 'chest' | 'camp' | 'interactive';
  name: string;
  point: Point;
}

export class InteractionSystem {
  private dialogFor(
    id: string,
    title: string,
    eyebrow: string,
    body: string,
    actions: DialogAction[] = [],
  ): void {
    this.ui.dialog(title, eyebrow, body, actions, id);
  }
  private target: Target | null = null;
  constructor(
    private readonly state: GameState,
    private readonly ui: GameInterface,
    private readonly view: WorldView,
    private readonly save: () => void,
    private readonly area: AreaDefinition,
  ) {}

  nearby(point: Point): string {
    const targets: Target[] = [
      ...this.area.npcs.map((npc) => ({
        id: npc.id,
        type: 'npc' as const,
        name: `Bicara dengan ${npc.name}`,
        point: npc,
      })),
      ...this.area.herbs
        .filter((herb) => !this.state.world.gathered.includes(herb.id))
        .map((herb) => ({
          id: herb.id,
          type: 'herb' as const,
          name: 'Petik Moonleaf',
          point: herb,
        })),
      ...this.area.chests
        .filter((chest) => !this.state.world.opened.includes(chest.id))
        .map((chest) => ({
          id: chest.id,
          type: 'chest' as const,
          name: 'Buka peti persediaan',
          point: chest,
        })),
      ...(this.area.camp
        ? [
            {
              id: 'camp',
              type: 'camp' as const,
              name: 'Istirahat di api unggun',
              point: this.area.camp,
            },
          ]
        : []),
      ...this.area.interactives
        .filter((interactive) => !hasMilestone(this.state, interactive.milestone))
        .map((interactive) => ({
          id: interactive.id,
          type: 'interactive' as const,
          name: interactive.label,
          point: interactive,
        })),
    ];
    let nearest = 76;
    this.target = null;
    for (const target of targets) {
      const distance = Math.hypot(point.x - target.point.x, point.y - target.point.y);
      if (distance < nearest) {
        this.target = target;
        nearest = distance;
      }
    }
    return this.target?.name ?? '';
  }

  interact(): void {
    if (!this.target) {
      this.ui.toast('Dekati penduduk, tumbuhan, peti, atau api unggun untuk berinteraksi.');
      return;
    }
    const target = this.target;
    if (target.type === 'npc') this.npc(target.id as NpcId);
    if (target.type === 'herb' && !this.state.world.gathered.includes(target.id)) {
      this.state.world.gathered.push(target.id);
      this.state.player.inventory.herb++;
      this.view.herbs.get(target.id)?.destroy();
      this.view.herbs.delete(target.id);
      this.ui.toast('+1 Moonleaf', 'reward');
    }
    if (target.type === 'chest' && !this.state.world.opened.includes(target.id)) {
      const chest = this.area.chests.find((entry) => entry.id === target.id);
      const gold = chest?.loot?.gold ?? 18;
      const tonic = chest?.loot?.tonic ?? 1;
      this.state.world.opened.push(target.id);
      this.state.player.gold += gold;
      this.state.player.inventory.tonic += tonic;
      this.view.chests.get(target.id)?.setTint(0x777777);
      this.ui.toast(`Persediaan ditemukan · +${gold} gold · +${tonic} tonik`, 'reward');
      if (target.id === 'north-road-cache')
        this.ui.toast('Reruntuhan jalur pendek ke The Old Watch terbuka.', 'reward');
      this.save();
    }
    if (target.type === 'interactive') {
      const interactive = this.area.interactives.find((entry) => entry.id === target.id)!;
      if (recordMilestone(this.state, interactive.milestone)) {
        this.ui.dialog(interactive.label, 'TEMUAN PERJALANAN', `<p>${interactive.text}</p>`, [
          { label: 'Catat & tutup', run: () => this.ui.close() },
        ]);
        this.save();
      }
    }
    if (target.type === 'camp')
      this.ui.dialog(
        'Bara yang masih hangat',
        'API UNGGUN LARKHAVEN',
        '<p>Untuk beberapa saat, dunia terasa tenang. Pulihkan tenaga dan catat perjalananmu.</p>',
        [
          {
            label: 'Istirahat & simpan',
            run: () => {
              this.state.player.hp = maxHp(this.state.player);
              this.state.player.stamina = 100;
              this.save();
              this.ui.close();
              this.ui.toast('Tenaga pulih. Perjalanan berlanjut.');
            },
          },
          { label: 'Lihat slot', secondary: true, run: () => this.ui.showSlots('save') },
        ],
      );
  }

  private npc(id: NpcId): void {
    if (id === 'mara') this.mara();
    if (id === 'borin') this.shop();
    if (id === 'sera') this.trainer();
    if (id === 'elian')
      this.dialogFor(
        'elian',
        'Elian',
        'TABIB · LARKHAVEN',
        '<p>“Tidak semua luka perlu menjadi bekas. Duduklah sebentar. Kamu tak perlu membuktikan apa pun pada siapa pun hari ini.”</p><p class="muted">Pemulihan di desa tidak dikenakan biaya.</p>',
        [
          {
            label: 'Pulihkan HP',
            run: () => {
              this.state.player.hp = maxHp(this.state.player);
              this.ui.close();
              this.ui.toast('Elian memulihkan seluruh HP-mu.');
            },
          },
        ],
      );
  }

  private mara(): void {
    const w = this.state.world;
    const step = currentObjective(this.state)?.id;
    if (step === 'supplies-accept')
      this.dialogFor(
        'mara',
        'Hal-hal kecil yang berarti',
        'MARA · PENJAGA DESA',
        '<p>“Biasanya aku mengantar persediaan Elian sendiri. Tapi sejak jalan utara ditutup, penjaga lain belum kembali.”</p><p>“Bisa bantu? Singkirkan <strong>3 Moss Slime</strong> di seberang jembatan, lalu bawakan <strong>3 Moonleaf</strong>. Daunnya pucat dan berkilau. Jangan memaksakan diri.”</p><div class="reward">IMBALAN <span>30 gold · 100 XP · 2 tonik</span></div>',
        [
          {
            label: 'Aku akan membantu',
            run: () => {
              w.quests.supplies = 'active';
              w.questKills = 0;
              this.ui.close();
              this.ui.toast('Quest dimulai · Hal-hal kecil yang berarti');
              this.save();
            },
          },
          { label: 'Nanti dulu', secondary: true, run: () => this.ui.close() },
        ],
      );
    else if (step === 'supplies-report')
      this.dialogFor(
        'mara',
        'Seseorang bisa mengandalkanmu',
        'MARA · PENJAGA DESA',
        '<p>“Kamu kembali. Elian akan senang.”</p><p>Mara menatap jalan utara. “Ada satu hal lagi. Suara hantaman dari menara tua. Sesuatu di sana terbangun. Siapkan pedang yang lebih baik sebelum menyelidikinya.”</p>',
        [
          {
            label: 'Serahkan Moonleaf',
            run: () => {
              completeSupplies(this.state);
              this.ui.close();
              this.ui.toast('Quest selesai · +30 gold · +100 XP · +2 tonik', 'reward');
              this.ui.toast('Quest baru · Yang terbangun di utara');
              this.save();
            },
          },
        ],
      );
    else if (step === 'supplies-slime' || step === 'supplies-herb')
      this.dialogFor(
        'mara',
        'Jangan terburu-buru',
        'MARA · PENJAGA DESA',
        `<p>“Seberangi jembatan ke timur. Moss Slime hidup di dekat jalan. Petik Moonleaf dengan <strong>E</strong>.”</p><p>Slime: ${Math.min(3, w.questKills)}/3 · Moonleaf: ${Math.min(3, this.state.player.inventory.herb)}/3</p>`,
        [{ label: 'Baiklah', run: () => this.ui.close() }],
      );
    else if (step === 'investigate-trail' || step === 'secure-cache')
      this.dialogFor(
        'mara',
        'Jalan yang menutup cerita',
        'MARA · PENJAGA DESA',
        '<p>“Jalur utara masih tertutup, dan penjaga yang kutunggu belum pulang.”</p><p>“Cari tahu apa yang terjadi di sana. Mulailah dari catatan mereka di jalur — dan jangan biarkan cache gudang jatuh ke mulut serigala.”</p>',
        [{ label: 'Aku akan menyelidiki', run: () => this.ui.close() }],
      );
    else if (step === 'sentinel-defeat')
      this.dialogFor(
        'mara',
        'Rute yang dibuka bukti',
        'MARA · PENJAGA DESA',
        '<p>“Catatanmu masuk akal. Kalau jalur pendek sudah aman, tidak ada alasan lagi menunda.”</p><p>“The Old Watch menunggumu. Akhiri ini.”</p>',
        [{ label: 'Sampai nanti', run: () => this.ui.close() }],
      );
    else if (step === 'sentinel-report')
      this.dialogFor(
        'mara',
        'Batu pun bisa melupakan',
        'MARA · PENJAGA DESA',
        '<p>“Penjaga itu dibuat untuk melindungi jalan. Mengapa ia menyerang kita?”</p><p>Di antara pecahan batu, kamu menemukan cap kerajaan yang seharusnya sudah lenyap. Mara membaliknya, menatap lambangnya lama, lalu menunjuk ke bawah.</p><p>“Cap ini tidak tercatat di arsip mana pun — kecuali arsip di bawah menara. Lihat apa yang masih berjalan di sana.”</p>',
        [
          {
            label: 'Selesaikan perjalanan pertama',
            run: () => {
              completeSentinel(this.state);
              this.ui.close();
              this.ui.toast('Chapter I selesai · +100 gold · +200 XP', 'reward');
              this.save();
            },
          },
        ],
      );
    else if (
      step === 'open-archive' ||
      step === 'vault-seal-a' ||
      step === 'vault-seal-b' ||
      step === 'vault-note'
    )
      this.dialogFor(
        'mara',
        'Kunci yang belum genap',
        'MARA · PENJAGA DESA',
        '<p>“Arsip kerajaan tidak menerima tamu setengah informasi.”</p><p>“Segel-segel di ruang itu menyimpan cerita yang sama. Lengkapkan semuanya, lalu bawa kepadaku.”</p>',
        [{ label: 'Aku mengerti', run: () => this.ui.close() }],
      );
    else if (step === 'report-findings')
      this.dialogFor(
        'mara',
        'Jalur untuk esok hari',
        'MARA · PENJAGA DESA',
        '<p>“Automaton yang berbalik. Perintah jaga malam yang tak pernah dicabut. Dan catatan yang menyuruh mereka menahan jalur.”</p><p>Mara menata cap dan catatan itu menjadi satu. “Besok kita kirim ini ke guild. Malam ini, jalur desa sudah lebih aman — berkatmu.”</p><div class="reward">IMBALAN <span>80 gold · 200 XP · 2 tonik</span></div>',
        [
          {
            label: 'Sampaikan temuanmu',
            run: () => {
              if (reportVaultFindings(this.state)) {
                this.ui.close();
                this.ui.toast('Campaign selesai · +80 gold · +200 XP · +2 tonik', 'reward');
                this.save();
              }
            },
          },
        ],
      );
    else
      this.dialogFor(
        'mara',
        'Mara',
        'PENJAGA DESA',
        `<p>${w.quests.sentinel === 'complete' ? '“Larkhaven masih punya hari esok berkat usahamu. Jika ingin terus berlatih, Sera menunggumu di balai desa.”' : '“The Old Watch berada di utara hutan. Beli pedang dari Borin dan bawa tonik. Jika lantai memerah, segera menghindar.”'}</p>`,
        [{ label: 'Sampai nanti', run: () => this.ui.close() }],
      );
  }

  private shop(): void {
    const p = this.state.player;
    const stock = this.state.world.merchantStock;
    const goods: ItemId[] = ['iron-sword', 'steel-sword', 'padded-vest', 'leather-cap'];
    const cacheNote = this.state.world.opened.includes('north-road-cache')
      ? '<p>“Besi dan kayu dari cache jalur utara? Taruh sini. Bahan bagus — sayalah jadi sesuatu yang berguna.”</p>'
      : '';
    const rows = goods
      .map(
        (id) =>
          `<div class="shop-item"><div><h3>${ITEMS[id].name}</h3><p>${ITEMS[id].description}</p></div><b>${ITEMS[id].price} ◈</b></div>`,
      )
      .join('');
    this.dialogFor(
      'borin',
      'Borin’s Forge',
      'PANDAI BESI & PERBEKALAN',
      `<p>“Besi yang baik tak membuatmu berani. Tapi setidaknya ia tidak patah ketika kamu mencoba.”</p>${cacheNote}${rows}<div class="shop-item"><div><h3>${ITEMS.tonic.name}</h3><p>+45 HP · stok ${stock}</p></div><b>${ITEMS.tonic.price} ◈</b></div><p class="muted">Gold: ${p.gold} · Moonleaf: ${p.inventory.herb}. Meracik tonik memakai 3 daun; sisihkan daun untuk Mara.</p>`,
      [
        ...goods.map((id) => ({
          label: p.inventory[id] > 0 ? `${ITEMS[id].name} dimiliki` : `Beli ${ITEMS[id].name}`,
          disabled: p.inventory[id] > 0 || p.gold < (ITEMS[id].price ?? 0),
          run: () => {
            if (buyItem(this.state, id)) this.ui.toast(`${ITEMS[id].name} dipakai.`, 'reward');
            this.shop();
          },
        })),
        {
          label: 'Beli tonik',
          disabled: p.gold < (ITEMS.tonic.price ?? 0) || stock < 1,
          secondary: true,
          run: () => {
            buyItem(this.state, 'tonic');
            this.shop();
          },
        },
        {
          label: 'Racik tonik · 3 daun',
          disabled: p.inventory.herb < (this.state.world.quests.supplies === 'complete' ? 3 : 6),
          secondary: true,
          run: () => {
            craftTonic(this.state);
            this.shop();
          },
        },
      ],
    );
  }

  private trainer(): void {
    const p = this.state.player;
    if (p.job) {
      this.dialogFor(
        'sera',
        'Jalan yang kamu pilih',
        'SERA · PELATIH GUILD',
        `<p>“Seorang ${JOBS[p.job].name} dibentuk oleh latihan. Pilihanmu sudah dibuat. Sekarang, buktikan melalui tindakan.”</p><p>Gunakan <strong>Q</strong> untuk ${JOBS[p.job].skill}. Skill memakai 35 stamina dan memerlukan 6 detik untuk pulih.</p>`,
      );
      return;
    }
    if (p.level < 10) {
      this.dialogFor(
        'sera',
        'Belum saatnya memilih',
        'SERA · PELATIH GUILD',
        `<p>“Kamu belum perlu menyebut dirimu apa pun. Pelajari dulu cara bertahan.”</p><p>Kembali pada <strong>level 10</strong> untuk memilih job pertamamu. Pilihan itu permanen.</p><p class="muted">Level saat ini: ${p.level}/10</p>`,
      );
      return;
    }
    this.dialogFor(
      'sera',
      'Tentukan jalanmu',
      'SERA · PILIHAN JOB PERMANEN',
      '<p>Delapan jalan, satu pilihan. Job yang dipilih tidak bisa diganti.</p>',
      Object.values(JOBS).map((job) => ({
        label: job.name,
        secondary: true,
        run: () => this.confirmJob(job.id),
      })),
    );
  }

  private confirmJob(id: JobId): void {
    const job = JOBS[id];
    this.dialogFor(
      'sera',
      `Menjadi ${job.name}?`,
      'PILIHAN INI PERMANEN',
      `<p>${job.description}</p><p>Skill: <strong>${job.skill}</strong> · +${job.hp} HP · +${job.damage} serangan.</p>`,
      [
        {
          label: `Pilih ${job.name}`,
          run: () => {
            if (chooseJob(this.state.player, id)) {
              this.ui.close();
              this.ui.toast(`Jalanmu dimulai sebagai ${job.name}.`, 'reward');
              this.save();
            }
          },
        },
        { label: 'Kembali', secondary: true, run: () => this.trainer() },
      ],
    );
  }
}
