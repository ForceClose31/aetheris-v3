import { ITEMS, JOBS } from '../content/catalog';
import { regionAt, type AreaDefinition } from '../content/world';
import { currentObjective, objectiveSummary, type ObjectiveProgress } from '../domain/objectives';
import { attackPower, equipItem, maxHp, unequipSlot, xpNeeded } from '../domain/progression';
import type { GameState, ItemId } from '../domain/types';
import type { GameAudio } from '../platform/audio';
import type { Action, InputController } from '../platform/input';
import type { SaveStore } from '../platform/save';
import { icon } from './icons';
import { drawMap } from './map';
import { hasPortrait, portraitDataUrl } from '../rendering/portraits';

export interface InterfaceHooks {
  start: (state: GameState | null, slot: number) => void;
  save: (slot: number) => boolean;
  tonic: () => void;
  zoom: (delta: number) => void;
}
export interface DialogAction {
  label: string;
  run: () => void;
  secondary?: boolean;
  disabled?: boolean;
}
export interface HudDetails {
  nearby: string;
  skillCooldown: number;
  rollCooldown: number;
  boss: { hp: number; max: number; name: string } | null;
}

export class GameInterface {
  readonly host: HTMLElement;
  private modal: HTMLElement;
  private intro: HTMLElement;
  private toastHost: HTMLElement;
  private state: GameState | null = null;
  private area: AreaDefinition | null = null;
  private slot = 1;
  private started = false;
  private lastFocus: HTMLElement | null = null;
  private hudRefs = new Map<string, HTMLElement>();
  private boundInput: InputController | null = null;
  private inputBound = false;
  hooks: InterfaceHooks | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly store: SaveStore,
    private readonly audio: GameAudio,
  ) {
    root.innerHTML = `
      <header class="topbar">
        <a class="wordmark" href="#" aria-label="Aetheris, menu utama"><span class="crest">A</span><span>AETHERIS<small>THE QUIET BEFORE</small></span></a>
        <div class="chapter-label"><span class="tiny-line"></span> CHAPTER I <span class="muted">/</span> A humble beginning</div>
        <nav aria-label="Menu game">
          <button data-panel="journal" title="Jurnal [L]">${icon('journal')}<span>Jurnal</span><kbd>L</kbd></button>
          <button data-panel="inventory" title="Tas [I]">${icon('bag')}<span>Tas</span><kbd>I</kbd></button>
          <button data-panel="map" title="Peta [M]">${icon('map')}<span>Peta</span><kbd>M</kbd></button>
          <button data-panel="pause" class="icon-button" title="Pengaturan [Esc]" aria-label="Pengaturan">${icon('settings')}</button>
        </nav>
      </header>
      <main class="viewport" aria-label="Dunia Aetheris">
        <div id="game-host" role="application" aria-label="Aetheris. WASD untuk bergerak, J menyerang, E berinteraksi." tabindex="0"></div>
        <div class="world-vignette"></div>
        <div class="hud">
          <section class="player-card" aria-label="Status karakter">
            <div class="portrait"><span></span><b data-hud="level">1</b></div>
            <div class="vitals"><div class="player-name">Pengelana <span data-hud="job">Villager</span></div>
              <div class="meter health"><i data-hud="hp-bar"></i><span data-hud="hp"></span></div>
              <div class="meter stamina"><i data-hud="stamina-bar"></i></div>
              <div class="xp-row"><span data-hud="xp"></span><span class="gold">◈ <b data-hud="gold"></b></span></div>
            </div>
          </section>
          <section class="location-card"><div class="location-heading"><span class="live-dot"></span><span data-hud="region">Larkhaven</span><span class="compass">N ↑</span></div>
            <button class="minimap-button" data-panel="map" aria-label="Buka peta dunia"><canvas id="minimap" width="190" height="122"></canvas></button>
            <div class="world-clock">${icon('sun')}<span data-hud="clock">08:00</span><span data-hud="weather">Cerah</span></div>
          </section>
          <section class="quest-tracker"><div class="eyebrow">${icon('journal')} PERJALANANMU</div><h3 data-hud="quest-title"></h3><p data-hud="quest-body"></p><button data-panel="journal">Buka jurnal <span>↗</span></button></section>
          <div class="region-announcement" data-hud="region-banner"></div>
          <div class="boss-hud" hidden><small>PENJAGA YANG TERLUPAKAN</small><h3 data-hud="boss-name"></h3><div class="meter"><i data-hud="boss-bar"></i></div></div>
          <div class="interaction" data-hud="interaction" hidden></div>
          <div class="actionbar">
            <button data-input="attack" title="Serang [J / klik kiri]">${icon('sword')}<kbd>J</kbd><span>Serang</span></button>
            <button data-input="roll" title="Menghindar [Spasi]">${icon('roll')}<kbd>SPACE</kbd><span>Hindar</span><i data-hud="roll-cooldown" class="cooldown"></i></button>
            <span class="action-divider"></span>
            <button data-input="skill" title="Skill job [Q]">${icon('spark')}<kbd>Q</kbd><span data-hud="skill-name">Terkunci</span><i data-hud="skill-cooldown" class="cooldown"></i></button>
            <button data-input="tonic" title="Tonik pemulih [R]">${icon('potion')}<kbd>R</kbd><span>Tonik <b data-hud="tonics">3</b></span></button>
            <span class="action-divider"></span>
            <button data-input="interact" title="Interaksi [E]">${icon('leaf')}<kbd>E</kbd><span>Interaksi</span></button>
          </div>
          <div class="touch-move" aria-label="Kontrol arah"><button data-input="up" aria-label="Atas">↑</button><button data-input="left" aria-label="Kiri">←</button><button data-input="down" aria-label="Bawah">↓</button><button data-input="right" aria-label="Kanan">→</button></div>
          <div class="world-note"><span class="live-dot"></span> <span data-hud="region-subtitle">DESA DI TEPI DUNIA</span></div>
        </div>
        <section class="intro">
          <div class="intro-content"><div class="eyebrow"><span class="tiny-line"></span> SEBUAH PERJALANAN DIMULAI</div>
            <h1>Aetheris<span>Every legend begins<br>with an ordinary soul.</span></h1>
            <p>Kamu bukan pahlawan dari ramalan.<br>Hanya seorang warga desa, sebilah pedang kayu,<br>dan dunia yang belum kamu kenal.</p>
            <div class="intro-rule"><span>01</span> THE QUIET BEFORE</div>
            <button class="primary start-button" id="start-game">Mulai perjalanan ${icon('arrow')}</button>
            <button class="text-button" id="load-game">Lanjutkan perjalanan tersimpan <span>↗</span></button>
            <div class="intro-controls"><span><kbd>W A S D</kbd> Bergerak</span><span><kbd>J</kbd> Menyerang</span><span><kbd>E</kbd> Interaksi</span></div>
          </div>
          <div class="intro-coordinate"><span class="live-dot"></span> LARKHAVEN <span>EST. YEAR 841</span></div>
          <div class="chapter-stamp">I<span>THE FIRST<br>FOOTSTEPS</span></div>
        </section>
        <div class="modal-backdrop" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"></section></div>
        <div class="toasts" aria-live="polite" aria-atomic="false"></div>
      </main>
      <footer><span><i class="live-dot"></i> AETHERIS <span class="footer-separator">/</span> CHAPTER I</span><span class="desktop-hint">WASD bergerak <i>·</i> J serang <i>·</i> SPACE hindar <i>·</i> E interaksi</span><button id="audio-toggle" aria-label="Aktifkan audio">${icon('sound')} <span>Audio mati</span></button></footer>`;
    this.host = this.find('#game-host');
    this.modal = this.find('.modal-backdrop');
    this.intro = this.find('.intro');
    this.toastHost = this.find('.toasts');
    this.root.dataset.mode = 'intro';
    this.root
      .querySelectorAll<HTMLElement>('[data-hud]')
      .forEach((element) => this.hudRefs.set(element.dataset.hud!, element));
    this.root.querySelectorAll<HTMLElement>('[data-panel]').forEach((button) =>
      button.addEventListener('click', () => {
        if (this.started) this.openPanel(button.dataset.panel!);
      }),
    );
    this.find('#start-game').addEventListener('click', () => this.showSlots('new'));
    this.find('#load-game').addEventListener('click', () => this.showSlots('load'));
    this.find('.wordmark').addEventListener('click', (event) => {
      event.preventDefault();
      if (this.started) this.openPanel('pause');
    });
    this.find('#audio-toggle').addEventListener('click', () => {
      const enabled = this.audio.toggle();
      this.find('#audio-toggle span').textContent = enabled ? 'Audio aktif' : 'Audio mati';
      this.find('#audio-toggle').setAttribute(
        'aria-label',
        enabled ? 'Matikan audio' : 'Aktifkan audio',
      );
    });
    this.modal.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [
        ...this.modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input'),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }

  private find(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }

  bindInput(input: InputController): void {
    this.boundInput = input;
    if (this.inputBound) return;
    this.inputBound = true;
    this.root.querySelectorAll<HTMLElement>('[data-input]').forEach((button) => {
      const action = button.dataset.input as Action;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        if (!this.blocked) this.boundInput?.press(action);
      });
      const release = (): void => this.boundInput?.release(action);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('click', (event) => {
        if (event.detail === 0 && !this.blocked) {
          this.boundInput?.press(action);
          this.boundInput?.release(action);
        }
      });
    });
  }

  get blocked(): boolean {
    return !this.started || !this.modal.hidden;
  }
  get activeSlot(): number {
    return this.slot;
  }
  get hasStarted(): boolean {
    return this.started;
  }

  begin(state: GameState, slot: number): void {
    this.state = state;
    this.slot = slot;
    this.started = true;
    this.intro.hidden = true;
    this.root.dataset.mode = 'playing';
    this.close();
    this.host.focus();
  }

  close(): void {
    this.modal.hidden = true;
    this.lastFocus?.focus();
  }
  togglePause(): void {
    if (!this.modal.hidden) this.close();
    else if (this.started) this.openPanel('pause');
  }

  dialog(
    title: string,
    eyebrow: string,
    body: string,
    actions: DialogAction[] = [],
    portrait?: string,
  ): void {
    if (this.modal.hidden)
      this.lastFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.modal.hidden = false;
    const content =
      portrait && hasPortrait(portrait)
        ? `<div class="dialog-row"><img class="dialog-portrait" src="${portraitDataUrl(portrait)}" alt="${title}" width="84" height="84"><div class="dialog-text">${body}</div></div>`
        : body;
    this.modal.firstElementChild!.innerHTML = `<div class="modal-top"><span class="eyebrow">${eyebrow}</span><button class="close-button" aria-label="Tutup">×</button></div><h2 id="modal-title">${title}</h2><div class="modal-body">${content}</div><div class="modal-actions"></div>`;
    this.modal.querySelector('.close-button')!.addEventListener('click', () => this.close());
    const bar = this.modal.querySelector('.modal-actions')!;
    actions.forEach((action) => {
      const button = document.createElement('button');
      button.className = action.secondary ? 'secondary' : 'primary';
      button.textContent = action.label;
      button.disabled = action.disabled ?? false;
      button.addEventListener('click', action.run);
      bar.append(button);
    });
    (this.modal.querySelector('.modal') as HTMLElement).focus();
  }

  openPanel(panel: string): void {
    if (!this.state || !this.area) return;
    if (panel === 'journal') this.journal();
    if (panel === 'inventory') this.inventory();
    if (panel === 'map') {
      this.dialog(
        this.area.atlas.title,
        this.area.atlas.subtitle,
        '<canvas class="large-map" width="720" height="480"></canvas><p class="map-legend"><span>● Kamu</span><span>◈ Penduduk desa</span><span>□ Penjaga reruntuhan</span></p>',
      );
      const canvas = this.modal.querySelector('canvas')!;
      canvas.setAttribute('aria-label', this.area.atlas.description);
      drawMap(canvas, this.state, this.area, true);
    }
    if (panel === 'pause')
      this.dialog(
        'Sejenak beristirahat',
        'PERJALANAN DIJEDA',
        `<p>Dunia menunggumu. Progres disimpan otomatis setiap 30 detik selama bermain.</p><div class="settings-row"><span>Jarak kamera</span><button id="zoom-out" aria-label="Perkecil kamera">−</button><button id="zoom-in" aria-label="Perbesar kamera">+</button></div><p class="muted">Slot aktif: ${this.slot} · Data tersimpan di browser ini.</p>`,
        [
          { label: 'Lanjutkan', run: () => this.close() },
          {
            label: 'Simpan',
            secondary: true,
            run: () => {
              this.hooks?.save(this.slot);
            },
          },
          { label: 'Slot penyimpanan', secondary: true, run: () => this.showSlots('save') },
        ],
      );
    this.modal.querySelector('#zoom-out')?.addEventListener('click', () => this.hooks?.zoom(-0.25));
    this.modal.querySelector('#zoom-in')?.addEventListener('click', () => this.hooks?.zoom(0.25));
  }

  private journal(): void {
    const state = this.state!;
    const entries = objectiveSummary(state);
    const main = entries.filter((entry) => entry.main);
    const optional = entries.filter((entry) => !entry.main);
    const mark = (entry: ObjectiveProgress): string =>
      entry.done ? '✓' : entry.playable ? '○' : '–';
    const descriptions: Record<string, string> = {
      'Hal-hal kecil yang berarti':
        'Persediaan tabib mulai menipis. Mara membutuhkan seseorang untuk membersihkan jalan menuju hutan.',
      'Jejak di jalan yang ditutup':
        'Jalan utara ditutup dan penjaga belum kembali. Mara meminta jawaban, bukan dugaan.',
      'Yang terbangun di utara':
        'Sebuah penjaga batu bergerak lagi di The Old Watch. Hindari lingkaran serangannya, cari kesempatan di antara hantaman, lalu laporkan pada Mara.',
      'Perintah yang tertinggal':
        'Cap kerajaan menunjuk ke bawah. Arsip di bawah watch menyimpan perintah yang belum selesai.',
      'Jalur untuk esok hari':
        'Bukti telah lengkap. Bawa semuanya kepada Mara — jalur lokal bisa aman kembali.',
    };
    const groups: { title: string; entries: ObjectiveProgress[] }[] = [];
    for (const entry of main) {
      const group = groups.find((candidate) => candidate.title === entry.title);
      if (group) group.entries.push(entry);
      else groups.push({ title: entry.title, entries: [entry] });
    }
    let previousDone = true;
    const articles = groups
      .map((group) => {
        const done = group.entries.every((entry) => entry.done);
        const unlocked = previousDone || done;
        previousDone = done;
        const tag = done ? 'SELESAI' : unlocked ? 'CERITA UTAMA' : 'BELUM TERBUKA';
        return `<article class="quest-entry ${unlocked || done ? '' : 'dimmed'}"><span class="tag">${tag}</span><h3>${group.title}</h3><p>${descriptions[group.title] ?? ''}</p><ul>${group.entries
          .map((entry) => `<li>${mark(entry)} ${entry.detail.replace('\n', ' · ')}</li>`)
          .join('')}</ul></article>`;
      })
      .join('');
    const exploration = `<article class="quest-entry dimmed"><span class="tag">${optional.every((entry) => entry.done) ? 'TERJELAJAHI' : 'EKSPLORASI'}</span><h3>Jelajahi Aetheris</h3><ul>${optional
      .map((entry) => `<li>${mark(entry)} ${entry.detail}</li>`)
      .join('')}</ul></article>`;
    this.dialog('Catatan seorang pengelana', 'JURNAL · CHAPTER I', articles + exploration);
  }

  private inventory(): void {
    const p = this.state!.player;
    const items = (Object.keys(ITEMS) as ItemId[]).filter((id) => p.inventory[id] > 0);
    const equipped = (id: ItemId): boolean =>
      p.equipment.weapon === id || p.equipment.body === id || p.equipment.head === id;
    const iconFor = (id: ItemId): string =>
      icon(
        ITEMS[id].slot === 'body'
          ? 'armor'
          : ITEMS[id].slot === 'head'
            ? 'helm'
            : id === 'herb'
              ? 'leaf'
              : id === 'tonic'
                ? 'potion'
                : 'sword',
      );
    const actions: { label: string; disabled?: boolean; secondary?: boolean; run: () => void }[] =
      [];
    for (const id of items) {
      const slot = ITEMS[id].slot;
      if (!slot) continue;
      if (equipped(id)) {
        if (slot !== 'weapon')
          actions.push({
            label: `Lepas ${ITEMS[id].name}`,
            secondary: true,
            run: () => {
              unequipSlot(this.state!, slot);
              this.inventory();
            },
          });
      } else
        actions.push({
          label: `Pakai ${ITEMS[id].name}`,
          run: () => {
            equipItem(this.state!, id);
            this.inventory();
          },
        });
    }
    actions.push({
      label: 'Minum tonik',
      disabled: p.inventory.tonic < 1 || p.hp >= maxHp(p),
      run: () => {
        this.hooks?.tonic();
        this.inventory();
      },
    });
    actions.push({ label: 'Kembali', secondary: true, run: () => this.close() });
    this.dialog(
      'Bekal perjalanan',
      'INVENTARIS & KARAKTER',
      `<div class="stat-grid"><div><small>LEVEL</small><b>${p.level}</b></div><div><small>JOB</small><b>${p.job ? JOBS[p.job].name : 'Villager'}</b></div><div><small>SERANGAN</small><b>${attackPower(p)}</b></div><div><small>HP MAKS</small><b>${maxHp(p)}</b></div><div><small>GOLD</small><b>${p.gold}</b></div></div><div class="item-list">${items.map((id) => `<article class="item-row"><div class="item-icon">${iconFor(id)}</div><div><h3>${ITEMS[id].name} ${equipped(id) ? '<span class="tag">DIPAKAI</span>' : ''}</h3><p>${ITEMS[id].description}</p><small>${ITEMS[id].rarity}</small></div><b>×${p.inventory[id]}</b></article>`).join('')}</div>`,
      actions,
      'pengelana',
    );
  }

  showSlots(mode: 'new' | 'save' | 'load'): void {
    this.dialog(
      mode === 'new' ? 'Awal sebuah cerita' : 'Jejak perjalanan',
      'TIGA SLOT PENYIMPANAN',
      `<p>${mode === 'new' ? 'Pilih tempat untuk menyimpan perjalanan barumu.' : 'Simpan atau lanjutkan perjalanan. Setiap slot berdiri sendiri.'}</p><div class="save-slots"></div>`,
    );
    const container = this.modal.querySelector('.save-slots')!;
    for (let slot = 1; slot <= 3; slot++) {
      const record = this.store.read(slot);
      const row = document.createElement('div');
      row.className = 'save-slot';
      row.innerHTML = `<div><small>SLOT 0${slot}</small><h3>${record ? `Pengelana · Lv. ${record.state.player.level}` : 'Perjalanan baru'}</h3><p>${record ? new Date(record.savedAt).toLocaleString('id-ID') : 'Belum ada simpanan yang dapat dimuat'}</p></div>`;
      const action = document.createElement('button');
      action.className = 'secondary';
      action.textContent = mode === 'new' ? 'Mulai' : mode === 'save' ? 'Simpan' : 'Muat';
      action.disabled = mode === 'load' && !record;
      const run = (): void => {
        if (mode === 'save') {
          if (this.hooks?.save(slot)) {
            this.slot = slot;
            this.showSlots('save');
          }
        } else {
          this.hooks?.start(mode === 'load' ? record!.state : null, slot);
        }
      };
      action.addEventListener('click', () => {
        if (record && mode !== 'load')
          this.dialog(
            'Ganti simpanan ini?',
            `SLOT 0${slot}`,
            '<p>Progres lama pada slot ini akan digantikan oleh perjalananmu sekarang.</p>',
            [
              { label: 'Ganti simpanan', run },
              { label: 'Batal', secondary: true, run: () => this.showSlots(mode) },
            ],
          );
        else run();
      });
      row.append(action);
      if (mode === 'save' && record) {
        const load = document.createElement('button');
        load.className = 'secondary';
        load.textContent = 'Muat';
        load.addEventListener('click', () =>
          this.dialog(
            'Muat perjalanan?',
            `SLOT 0${slot}`,
            '<p>Perubahan yang belum disimpan dalam perjalanan aktif akan hilang.</p>',
            [
              { label: 'Muat', run: () => this.hooks?.start(record.state, slot) },
              { label: 'Batal', secondary: true, run: () => this.showSlots('save') },
            ],
          ),
        );
        row.append(load);
      }
      container.append(row);
    }
  }

  update(state: GameState, details: HudDetails, area: AreaDefinition): void {
    this.state = state;
    this.area = area;
    const p = state.player;
    const text = (key: string, value: string): void => {
      const node = this.hudRefs.get(key)!;
      if (node.textContent !== value) node.textContent = value;
    };
    text('level', String(p.level));
    text('job', p.job ? JOBS[p.job].name : 'Villager');
    text('hp', `${Math.ceil(p.hp)} / ${maxHp(p)}`);
    this.hudRefs.get('hp-bar')!.style.width = `${(p.hp / maxHp(p)) * 100}%`;
    this.hudRefs.get('stamina-bar')!.style.width = `${p.stamina}%`;
    text('xp', `${p.xp} / ${xpNeeded(p.level)} XP`);
    text('gold', String(p.gold));
    text('tonics', String(p.inventory.tonic));
    const region = regionAt(area, p.position.x, p.position.y);
    text('region', region.name);
    text('region-subtitle', region.subtitle);
    const hour = (8 + state.world.seconds / 45) % 24;
    text(
      'clock',
      `${Math.floor(hour).toString().padStart(2, '0')}:${Math.floor((hour % 1) * 60)
        .toString()
        .padStart(2, '0')}`,
    );
    text(
      'weather',
      Math.floor(state.world.seconds / 150) % 3 === 1
        ? 'Hujan'
        : hour >= 18 || hour < 6
          ? 'Malam'
          : 'Cerah',
    );
    text('skill-name', p.job ? JOBS[p.job].skill : 'Lv. 10');
    text('skill-cooldown', details.skillCooldown > 0 ? `${Math.ceil(details.skillCooldown)}s` : '');
    text('roll-cooldown', details.rollCooldown > 0 ? '·' : '');
    const current = currentObjective(state);
    text('quest-title', current?.title ?? 'Rumah, untuk sementara');
    text(
      'quest-body',
      current?.detail ?? 'Larkhaven aman. Latih dirimu dan temui Sera pada level 10.',
    );
    const interaction = this.hudRefs.get('interaction')!;
    interaction.hidden = !details.nearby;
    if (details.nearby) interaction.innerHTML = `<kbd>E</kbd> ${details.nearby}`;
    const boss = this.find('.boss-hud');
    boss.hidden = !details.boss;
    if (details.boss) {
      text('boss-name', details.boss.name);
      this.hudRefs.get('boss-bar')!.style.width = `${(details.boss.hp / details.boss.max) * 100}%`;
    }
    drawMap(this.find('#minimap') as HTMLCanvasElement, state, area);
  }

  announce(name: string): void {
    const banner = this.hudRefs.get('region-banner')!;
    banner.textContent = name;
    banner.classList.remove('animate');
    void banner.offsetWidth;
    banner.classList.add('animate');
  }

  toast(message: string, kind = ''): void {
    const toast = document.createElement('div');
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    this.toastHost.append(toast);
    if (this.toastHost.childElementCount > 4) this.toastHost.firstElementChild?.remove();
    window.setTimeout(() => toast.remove(), 4200);
  }
}
