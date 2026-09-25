import { createBot } from './bot.js';
import { nearestEnemy } from './combat.js';

// ============================================================
// КОНТРОЛЛЕРЫ — кто управляет бойцом. У всех один метод:
//   command(dt, world) → { moveX, moveZ, aimDir, attack?, ult? }
//     moveX, moveZ — джойстик −1..1 в осях арены (экранный низ = +Z)
//     aimDir       — { x, z }, пока прицел атаки оттянут, иначе null
//     attack       — есть, если в этом кадре атака: { x, z } направление или null (автоприцел)
//     ult          — есть, если в этом кадре ульта: точка { x, z } или null (без прицела)
//
//   local  — кнопки и джойстик этого устройства
//   bot    — бот (bot.js)
//   remote — (ещё нет) игрок по сети: команды приходят в сообщениях и отдаются
//            отсюда; всё остальное — матч, режимы, герои — не меняется.
// ============================================================

// Оттяжка кнопки: (dx, dy) — вектор −1..1 в экранных осях, экранный низ = +Z.
// Меньше порога — считаем коротким касанием (автоприцел).
const AIM_DEAD = 0.25;
export const dragDir = (dx, dy) => {
  const m = Math.hypot(dx, dy);
  return m < AIM_DEAD ? null : { x: dx / m, z: dy / m };
};

// точка ульты по оттяжке кнопки; короткое касание — в ближайшего врага, иначе перед собой
export function ultPoint(f, world, dx, dy) {
  const kit = f.kit;
  const mag = Math.hypot(dx, dy);
  if (mag < 0.2) {
    const tgt = nearestEnemy(f, world, kit.ultAutoRange ?? kit.ultRange ?? 8);
    if (tgt) return { x: tgt.pos.x, z: tgt.pos.z };
    const r = (kit.ultRange ?? 4) * 0.5;
    return { x: f.pos.x + Math.sin(f.facing) * r, z: f.pos.z + Math.cos(f.facing) * r };
  }
  const k = Math.min(1, mag) / mag;
  return { x: f.pos.x + dx * k * kit.ultRange, z: f.pos.z + dy * k * kit.ultRange };
}

// кнопки этого устройства: input заполняют джойстик и кнопки (src/ui)
export function createLocalController(f, input) {
  return {
    command(dt, world) {
      const cmd = { moveX: input.moveX, moveZ: input.moveY, aimDir: null };
      if (input.attackAim?.active) cmd.aimDir = dragDir(input.attackAim.dx, input.attackAim.dy);
      if (input.attack) { input.attack = false; cmd.attack = null; }          // касание — автоприцел
      if (input.attackFire) {                                                   // отпустили оттянутую кнопку
        cmd.attack = dragDir(input.attackFire.dx, input.attackFire.dy);
        input.attackFire = null;
      }
      if (input.ult) { input.ult = false; cmd.ult = f.kit.ultAim === 'drag' ? ultPoint(f, world, 0, 0) : null; }
      if (input.ultFire) { cmd.ult = ultPoint(f, world, input.ultFire.dx, input.ultFire.dy); input.ultFire = null; }
      return cmd;
    },
  };
}

export function createBotController(f, opts) {
  const bot = createBot(f, opts);
  return { command: (dt, world) => bot.think(dt, world) };
}
