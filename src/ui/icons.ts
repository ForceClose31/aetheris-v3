const paths: Record<string, string> = {
  journal:
    '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm16 0h-4a3 3 0 0 0-3 3m7-3v14h-3a4 4 0 0 0-4 3"/>',
  bag: '<path d="M7 8V6a5 5 0 0 1 10 0v2M5 8h14l2 13H3L5 8Zm4 4v3m6-3v3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>',
  sword: '<path d="m7 17 12-12 2-2-1 6L9 20M4 14l6 6M3 21l4-4"/>',
  leaf: '<path d="M5 19C-1 8 11 3 21 3c0 10-4 21-16 16Zm0 0L17 7"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  roll: '<path d="M4 12a8 8 0 1 1 3 6M4 12V5m0 7h7"/>',
  potion: '<path d="M9 3h6M10 3v6L5 17a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-8V3M7 16h10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  sound: '<path d="m4 9 4 0 5-5v16l-5-5H4V9Zm13-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
};
export const icon = (name: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spark}</svg>`;
