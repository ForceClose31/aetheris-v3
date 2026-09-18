import { JOBS } from '../content/catalog';
import type { AreaDefinition, NpcId } from '../content/world';
import {
  buyItem,
  chooseJob,
  completeSentinel,
  completeSupplies,
  craftTonic,
  maxHp,
  suppliesReady,
} from '../domain/progression';
import type { GameState, JobId, Point } from '../domain/types';
import type { GameInterface } from '../ui/interface';
import type { WorldView } from '../rendering/world';

interface Target {
  id: string;
  type: 'npc' | 'herb' | 'chest' | 'camp';
  name: string;
  point: Point;
}

export class InteractionSystem {
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
      { id: 'camp', type: 'camp', name: 'Istirahat di api unggun', point: this.area.camp },
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
      this.state.world.opened.push(target.id);
      this.state.player.gold += 18;
      this.state.player.inventory.tonic++;
      this.view.chests.get(target.id)?.setTint(0x777777);
      this.ui.toast('Persediaan ditemukan · +18 gold · +1 tonik', 'reward');
      this.save();
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
      this.ui.dialog(
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
    if (w.quests.supplies === 'available')
      this.ui.dialog(
        'Hal-hal kecil yang berarti',
        'MARA · PENJAGA DESA',
        '<p>“Biasanya aku mengantar persediaan Elian sendiri. Tapi sejak jalan utara ditutup, penjaga lain belum kembali.”</p><p>“Bisa bantu? Singkirkan <strong>3 Moss Slime</strong> di seberang jembatan, lalu bawakan <strong>3 Moonleaf</strong>. Daunnya pucat dan berkilau. Jangan memaksakan diri.”</p><div class="reward">IMBALAN <span>30 gold · 85 XP · 2 tonik</span></div>',
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
    else if (suppliesReady(this.state))
      this.ui.dialog(
        'Seseorang bisa mengandalkanmu',
        'MARA · PENJAGA DESA',
        '<p>“Kamu kembali. Elian akan senang.”</p><p>Mara menatap jalan utara. “Ada satu hal lagi. Suara hantaman dari menara tua. Sesuatu di sana terbangun. Siapkan pedang yang lebih baik sebelum menyelidikinya.”</p>',
        [
          {
            label: 'Serahkan Moonleaf',
            run: () => {
              completeSupplies(this.state);
              this.ui.close();
              this.ui.toast('Quest selesai · +30 gold · +85 XP · +2 tonik', 'reward');
              this.ui.toast('Quest baru · Yang terbangun di utara');
              this.save();
            },
          },
        ],
      );
    else if (w.quests.supplies === 'active')
      this.ui.dialog(
        'Jangan terburu-buru',
        'MARA · PENJAGA DESA',
        `<p>“Seberangi jembatan ke timur. Moss Slime hidup di dekat jalan. Petik Moonleaf dengan <strong>E</strong>.”</p><p>Slime: ${Math.min(3, w.questKills)}/3 · Moonleaf: ${Math.min(3, this.state.player.inventory.herb)}/3</p>`,
        [{ label: 'Baiklah', run: () => this.ui.close() }],
      );
    else if (w.quests.sentinel === 'active' && w.bossDefeated)
      this.ui.dialog(
        'Batu pun bisa melupakan',
        'MARA · PENJAGA DESA',
        '<p>“Penjaga itu dibuat untuk melindungi jalan. Mengapa ia menyerang kita?”</p><p>Di antara pecahan batu, kamu menemukan cap kerajaan yang seharusnya sudah lenyap. Mara menyimpannya tanpa banyak bicara.</p><p>Perjalanan pertamamu berakhir di sini. Pertanyaan-pertanyaannya baru dimulai.</p>',
        [
          {
            label: 'Selesaikan perjalanan pertama',
            run: () => {
              completeSentinel(this.state);
              this.ui.close();
              this.ui.toast('Chapter I selesai · +100 gold · +150 XP', 'reward');
              this.save();
            },
          },
        ],
      );
    else
      this.ui.dialog(
        'Mara',
        'PENJAGA DESA',
        `<p>${w.quests.sentinel === 'complete' ? '“Larkhaven masih punya hari esok berkat usahamu. Jika ingin terus berlatih, Sera menunggumu di balai desa.”' : '“The Old Watch berada di utara hutan. Beli pedang dari Borin dan bawa tonik. Jika lantai memerah, segera menghindar.”'}</p>`,
        [{ label: 'Sampai nanti', run: () => this.ui.close() }],
      );
  }

  private shop(): void {
    const p = this.state.player;
    const stock = this.state.world.merchantStock;
    this.ui.dialog(
      'Borin’s Forge',
      'PANDAI BESI & PERBEKALAN',
      `<p>“Besi yang baik tak membuatmu berani. Tapi setidaknya ia tidak patah ketika kamu mencoba.”</p><div class="shop-item"><div><h3>Pedang besi</h3><p>+9 serangan · langsung dipakai</p></div><b>35 ◈</b></div><div class="shop-item"><div><h3>Tonik pemulih</h3><p>+45 HP · stok ${stock}</p></div><b>8 ◈</b></div><p class="muted">Gold: ${p.gold} · Moonleaf: ${p.inventory.herb}. Meracik tonik memakai 3 daun; sisihkan daun untuk Mara.</p>`,
      [
        {
          label: p.inventory['iron-sword'] ? 'Pedang sudah dimiliki' : 'Beli pedang',
          disabled: p.gold < 35 || p.inventory['iron-sword'] > 0,
          run: () => {
            if (buyItem(this.state, 'iron-sword')) this.ui.toast('Pedang besi dipakai.', 'reward');
            this.shop();
          },
        },
        {
          label: 'Beli tonik',
          disabled: p.gold < 8 || stock < 1,
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
      this.ui.dialog(
        'Jalan yang kamu pilih',
        'SERA · PELATIH GUILD',
        `<p>“Seorang ${JOBS[p.job].name} dibentuk oleh latihan. Pilihanmu sudah dibuat. Sekarang, buktikan melalui tindakan.”</p><p>Gunakan <strong>Q</strong> untuk ${JOBS[p.job].skill}. Skill memakai 35 stamina dan memerlukan 6 detik untuk pulih.</p>`,
      );
      return;
    }
    if (p.level < 10) {
      this.ui.dialog(
        'Belum saatnya memilih',
        'SERA · PELATIH GUILD',
        `<p>“Kamu belum perlu menyebut dirimu apa pun. Pelajari dulu cara bertahan.”</p><p>Kembali pada <strong>level 10</strong> untuk memilih job pertamamu. Pilihan itu permanen.</p><p class="muted">Level saat ini: ${p.level}/10</p>`,
      );
      return;
    }
    this.ui.dialog(
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
    this.ui.dialog(
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
