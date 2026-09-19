// Speaker portraits for the dialog system (semi-MMORPG presentation): a small
// pixel bust per named character, rendered offscreen and cached as a data URL
// so the DOM dialog can show who is talking. Pure DOM/canvas — no Phaser.
const SIZE = 28;
const cache = new Map<string, string>();

interface SpeakerLook {
  bg: string;
  skin: string;
  skinSh: string;
  hair: string;
  hairD: string;
  hairL: string;
  coat: string;
  coatL: string;
}

const LOOKS: Record<string, SpeakerLook> = {
  pengelana: {
    bg: '#3c5a50',
    skin: '#e2b68c',
    skinSh: '#c1956e',
    hair: '#4a3626',
    hairD: '#31241a',
    hairL: '#6d5340',
    coat: '#6c9ca0',
    coatL: '#85b0b3',
  },
  mara: {
    bg: '#5c4440',
    skin: '#e2b68c',
    skinSh: '#c1956e',
    hair: '#4a3626',
    hairD: '#31241a',
    hairL: '#6d5340',
    coat: '#9d7063',
    coatL: '#b08778',
  },
  elian: {
    bg: '#4c5a44',
    skin: '#e8c39a',
    skinSh: '#c9a078',
    hair: '#8f8f88',
    hairD: '#6f6f68',
    hairL: '#a8a8a0',
    coat: '#d1c9a6',
    coatL: '#e2dbc0',
  },
  borin: {
    bg: '#4a3f33',
    skin: '#e2b68c',
    skinSh: '#c1956e',
    hair: '#5a4028',
    hairD: '#43301e',
    hairL: '#6d5335',
    coat: '#5d4a38',
    coatL: '#74593f',
  },
  sera: {
    bg: '#41455c',
    skin: '#e2b68c',
    skinSh: '#c1956e',
    hair: '#4a3626',
    hairD: '#31241a',
    hairL: '#6d5340',
    coat: '#737692',
    coatL: '#8b8fae',
  },
};

export function hasPortrait(id: string): boolean {
  return Object.hasOwn(LOOKS, id);
}

export function portraitDataUrl(id: string): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const look = LOOKS[id] ?? LOOKS.pengelana;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d')!;
  const px = (color: string, x: number, y: number, w: number, h: number): void => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  // Framed panel with the speaker's tint.
  px('#1c2a26', 0, 0, SIZE, SIZE);
  px(look.bg, 1, 1, SIZE - 2, SIZE - 2);
  px('#ffffff14', 1, 1, SIZE - 2, 3);
  // Shoulders and coat.
  px('#1c2a26', 3, 21, 22, 7);
  px(look.coat, 4, 22, 20, 6);
  px(look.coatL, 4, 22, 20, 1);
  // Neck.
  px(look.skinSh, 11, 18, 6, 4);
  // Head: face, jaw, ears.
  px('#1c2a26', 6, 2, 16, 18);
  px(look.skin, 7, 6, 14, 13);
  px(look.skinSh, 7, 15, 14, 4);
  px(look.skin, 5, 10, 2, 5);
  px(look.skin, 21, 10, 2, 5);
  // Hair per speaker.
  if (id === 'borin') {
    px(look.skinSh, 7, 6, 14, 2);
    px(look.hair, 6, 15, 16, 7);
    px(look.hairL, 6, 15, 16, 2);
    px(look.hairD, 10, 20, 8, 2);
    px('#22303a', 9, 10, 2, 2);
    px('#22303a', 17, 10, 2, 2);
  } else {
    px(look.hairD, 6, 1, 16, 8);
    px(look.hair, 7, 2, 14, 6);
    px(look.hairL, 8, 2, 12, 2);
    px(look.hair, 5, 4, 2, 9);
    px(look.hair, 21, 4, 2, 9);
    px(look.skin, 7, 7, 14, 5);
    if (id === 'mara') {
      px(look.hairD, 9, 0, 10, 3);
      px(look.hair, 10, 1, 8, 1);
      px('#22303a', 8, 8, 3, 1);
      px('#22303a', 17, 8, 3, 1);
    } else if (id === 'elian') {
      px('#22303a', 8, 8, 4, 3);
      px('#22303a', 16, 8, 4, 3);
      px('#f6f2e6', 9, 9, 2, 1);
      px('#f6f2e6', 17, 9, 2, 1);
    } else if (id === 'sera') {
      px(look.hair, 21, 3, 3, 14);
      px(look.hairL, 22, 4, 2, 10);
    }
    if (id !== 'elian') {
      px('#f6f2e6', 9, 9, 3, 2);
      px('#f6f2e6', 16, 9, 3, 2);
      px('#22303a', 10, 9, 2, 2);
      px('#22303a', 17, 9, 2, 2);
    }
    px(look.skinSh, 12, 15, 5, 1);
  }
  const url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}
