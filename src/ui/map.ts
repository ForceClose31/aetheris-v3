import { objectiveSummary } from '../domain/objectives';
import type { AreaDefinition } from '../content/world';
import type { GameState } from '../domain/types';

export function drawMap(
  canvas: HTMLCanvasElement,
  state: GameState,
  area: AreaDefinition,
  large = false,
): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const sx = canvas.width / area.width;
  const sy = canvas.height / area.height;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#344e40';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#283f35';
  c.fillRect(area.forestStartX * sx, 0, canvas.width, canvas.height);
  c.fillStyle = '#738166';
  area.paths.forEach((p) => c.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy));
  if (area.river) {
    c.fillStyle = '#528183';
    c.fillRect(area.river.x * sx, 0, area.river.width * sx, canvas.height);
    c.fillStyle = '#b6a276';
    c.fillRect(
      (area.river.x - 10) * sx,
      area.river.bridgeY * sy,
      (area.river.width + 20) * sx,
      area.river.bridgeHeight * sy,
    );
  }
  c.fillStyle = '#213a30';
  area.groves.forEach((g) => c.fillRect(g.x * sx, g.y * sy, g.w * sx, g.h * sy));
  c.fillStyle = '#b09b72';
  area.houses.forEach((h) => c.fillRect((h.x - 80) * sx, (h.y - 120) * sy, 160 * sx, 110 * sy));
  c.fillStyle = '#858d77';
  if (area.ruins)
    c.fillRect(area.ruins.x * sx, area.ruins.y * sy, area.ruins.w * sx, area.ruins.h * sy);
  area.npcs.forEach((npc) => {
    c.fillStyle = '#e8ca81';
    c.fillRect(npc.x * sx - 2, npc.y * sy - 2, 4, 4);
  });
  const boss = area.spawns.find((spawn) => spawn.kind === 'golem');
  const huntingWarden = objectiveSummary(state).some(
    (entry) => entry.id === 'sentinel-defeat' && entry.current,
  );
  if (boss && huntingWarden) {
    c.strokeStyle = '#d3876d';
    c.strokeRect(boss.x * sx - 4, boss.y * sy - 4, 8, 8);
  }
  c.fillStyle = '#f2d18b';
  for (const exit of area.exits) {
    c.fillRect(exit.x * sx, exit.y * sy, Math.max(4, exit.w * sx), Math.max(4, exit.h * sy));
    if (large) {
      c.font = '12px monospace';
      c.textAlign = exit.x < area.width / 2 ? 'left' : 'right';
      c.fillText(exit.label, exit.x * sx, exit.y * sy - 8);
    }
  }
  const { x, y } = state.player.position;
  c.fillStyle = '#f8efc9';
  c.beginPath();
  c.arc(x * sx, y * sy, large ? 5 : 3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#f8efc950';
  c.beginPath();
  c.arc(x * sx, y * sy, large ? 10 : 6, 0, Math.PI * 2);
  c.stroke();
  if (large) {
    c.textAlign = 'center';
    c.fillStyle = '#f0e3bf';
    for (const label of area.atlas.labels) {
      c.font = `${label.fontSize}px Georgia`;
      c.fillText(label.text, label.x * sx, label.y * sy);
    }
  }
}
