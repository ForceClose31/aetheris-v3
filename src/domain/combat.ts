import type { Point } from './types';

export function inAttackArc(
  origin: Point,
  target: Point,
  facing: Point,
  reach: number,
  wide = false,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance > reach) return false;
  if (wide || distance < 16) return true;
  return (dx * facing.x + dy * facing.y) / distance >= 0.1;
}

export function damageRoll(
  base: number,
  combo: number,
  random = Math.random,
): { amount: number; critical: boolean } {
  const critical = random() < 0.12;
  return { amount: Math.round(base * (combo === 3 ? 1.5 : 1) * (critical ? 1.75 : 1)), critical };
}
