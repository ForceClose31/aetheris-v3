import { GROVES, HOUSES, NPCS, PATHS, RIVER, RUINS, WORLD } from '../content/world';
import type { GameState } from '../domain/types';

export function drawMap(canvas: HTMLCanvasElement, state: GameState, large = false): void {
  const c = canvas.getContext('2d');
  if (!c) return;
  const sx = canvas.width / WORLD.width;
  const sy = canvas.height / WORLD.height;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#344e40';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#283f35';
  c.fillRect(920 * sx, 0, canvas.width, canvas.height);
  c.fillStyle = '#738166';
  PATHS.forEach((p) => c.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy));
  c.fillStyle = '#528183';
  c.fillRect(RIVER.x * sx, 0, RIVER.width * sx, canvas.height);
  c.fillStyle = '#b6a276';
  c.fillRect(
    (RIVER.x - 10) * sx,
    RIVER.bridgeY * sy,
    (RIVER.width + 20) * sx,
    RIVER.bridgeHeight * sy,
  );
  c.fillStyle = '#213a30';
  GROVES.forEach((g) => c.fillRect(g.x * sx, g.y * sy, g.w * sx, g.h * sy));
  c.fillStyle = '#b09b72';
  HOUSES.forEach((h) => c.fillRect((h.x - 80) * sx, (h.y - 120) * sy, 160 * sx, 110 * sy));
  c.fillStyle = '#858d77';
  c.fillRect(RUINS.x * sx, RUINS.y * sy, RUINS.w * sx, RUINS.h * sy);
  NPCS.forEach((npc) => {
    c.fillStyle = '#e8ca81';
    c.fillRect(npc.x * sx - 2, npc.y * sy - 2, 4, 4);
  });
  if (state.world.quests.sentinel === 'active' && !state.world.bossDefeated) {
    c.strokeStyle = '#d3876d';
    c.strokeRect(1380 * sx - 4, 285 * sy - 4, 8, 8);
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
    c.font = '18px Georgia';
    c.fillStyle = '#f0e3bf';
    c.fillText('L A R K H A V E N', 445 * sx, 1080 * sy);
    c.fillText('M O S S V E I L', 1350 * sx, 1250 * sy);
    c.font = '13px Georgia';
    c.fillText('The Old Watch', 1380 * sx, 165 * sy);
  }
}
