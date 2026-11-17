// Gearheart — layout: where everything sits on the 1280x720 canvas.
// Render and input both read this, so a button drawn here is a button that
// can be clicked there. Nothing here draws or listens; it only measures.
import { CANVAS } from './config.js';

export const HUD = { height: 64, timerBarY: 64, timerBarH: 8 };
export const TRAY = { labelY: 612, slotY: 632, slotW: 92, slotH: 68, gap: 12 };

export const HUD_BUTTONS = {
  mute: { x: 1064, y: 12, w: 56, h: 40 },
  help: { x: 1128, y: 12, w: 56, h: 40 },
  pause: { x: 1192, y: 12, w: 56, h: 40 },
};

/** Board geometry for a grid: centred, cell size fitted to the board area. */
export function computeLayout(cols, rows) {
  const areaX = 40;
  const areaY = HUD.height + HUD.timerBarH + 16;
  const areaW = CANVAS.width - 80;
  const areaH = TRAY.labelY - areaY - 16;
  const cell = Math.max(48, Math.min(96, Math.floor(areaW / cols), Math.floor(areaH / rows)));
  const boardW = cols * cell;
  const boardH = rows * cell;
  const boardX = Math.round((CANVAS.width - boardW) / 2);
  const boardY = Math.round(areaY + (areaH - boardH) / 2);
  return { boardX, boardY, boardW, boardH, cell };
}

/** Tray slot rectangles for `count` gears, centred. */
export function traySlots(count) {
  const total = count * TRAY.slotW + Math.max(0, count - 1) * TRAY.gap;
  const startX = Math.round((CANVAS.width - total) / 2);
  const slots = [];
  for (let i = 0; i < count; i += 1) {
    slots.push({ x: startX + i * (TRAY.slotW + TRAY.gap), y: TRAY.slotY, w: TRAY.slotW, h: TRAY.slotH });
  }
  return slots;
}

/** Cell (x, y) for a point on the board, or null when off the board. */
export function cellAt(layout, cols, rows, px, py) {
  if (px < layout.boardX || py < layout.boardY) return null;
  const x = Math.floor((px - layout.boardX) / layout.cell);
  const y = Math.floor((py - layout.boardY) / layout.cell);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return { x, y };
}

function button(cx, y, w, h) {
  return { x: Math.round(cx - w / 2), y, w, h };
}

/** The clickable buttons on each overlay screen (centred on the canvas). */
export function screenButtons(screen) {
  const cx = CANVAS.width / 2;
  if (screen === 'title') {
    return [
      { id: 'start', label: 'Start the clock', ...button(cx, 496, 300, 56) },
      { id: 'help', label: 'How to play', ...button(cx, 568, 300, 48) },
    ];
  }
  if (screen === 'level') {
    return [{ id: 'next', label: 'Next level', ...button(cx, 478, 300, 56) }];
  }
  if (screen === 'over' || screen === 'win') {
    return [{ id: 'restart', label: 'Play again', ...button(cx, 498, 300, 56) }];
  }
  if (screen === 'paused') {
    return [
      { id: 'resume', label: 'Resume', ...button(cx, 400, 300, 56) },
      { id: 'restart', label: 'Restart level', ...button(cx, 472, 300, 48) },
      { id: 'quit', label: 'Back to title', ...button(cx, 536, 300, 48) },
    ];
  }
  if (screen === 'help') {
    return [{ id: 'back', label: 'Back', ...button(cx, 604, 260, 48) }];
  }
  return [];
}

export function pointIn(rect, px, py) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}
