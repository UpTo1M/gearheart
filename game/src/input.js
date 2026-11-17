// Gearheart — input: mouse and keyboard, translated into game actions.
// The canvas hands it raw positions and keys; it answers with what the
// player meant: rotate a cell, pick a tray gear, press a button, pause.
import { cellAt, computeLayout, HUD_BUTTONS, pointIn, screenButtons, traySlots } from './layout.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_HELP = 8;
export const ACTION_ROTATE_KEY = 16;

export function createInput(canvas) {
  const queue = [];
  let mouse = { x: -1, y: -1, inside: false };
  let clicked = null;
  let rightClicked = null;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    mouse = { ...canvasPoint(event), inside: true };
  });
  canvas.addEventListener('mouseleave', () => {
    mouse = { x: -1, y: -1, inside: false };
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) clicked = canvasPoint(event);
    if (event.button === 2) rightClicked = canvasPoint(event);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'Space') queue.push(ACTION_CONFIRM);
    else if (event.code === 'KeyP' || event.code === 'Escape') queue.push(ACTION_PAUSE);
    else if (event.code === 'KeyM') queue.push(ACTION_MUTE);
    else if (event.code === 'KeyH') queue.push(ACTION_HELP);
    else if (event.code === 'KeyR') queue.push(ACTION_ROTATE_KEY);
    else if (event.code.startsWith('Digit')) {
      const n = Number(event.code.slice(5));
      if (n >= 1 && n <= 4) queue.push(100 + n);
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });

  return {
    mouse() {
      return mouse;
    },
    takeKeys() {
      const keys = queue.splice(0, queue.length);
      let bits = 0;
      const digits = [];
      for (const k of keys) {
        if (k >= 100) digits.push(k - 100);
        else bits |= k;
      }
      return { bits, digits };
    },

    /**
     * Interpret the pending click against the current screen and board.
     * Returns null, or an action: { kind, ... }.
     */
    takeClick(screen, level, trayCount) {
      const point = clicked;
      clicked = null;
      const right = rightClicked;
      rightClicked = null;
      if (!point && !right) return null;
      const p = point ?? right;
      const isRight = !point && !!right;

      for (const [id, rect] of Object.entries(HUD_BUTTONS)) {
        if (pointIn(rect, p.x, p.y)) return { kind: 'hud', id };
      }
      const buttons = screenButtons(screen);
      for (const b of buttons) {
        if (pointIn(b, p.x, p.y)) return { kind: 'button', id: b.id };
      }
      if (screen !== 'play' && screen !== 'paused') return null;
      if (!level) return null;
      const layout = computeLayout(level.cols, level.rows);
      const cell = cellAt(layout, level.cols, level.rows, p.x, p.y);
      if (cell) {
        if (isRight) return { kind: 'pickup', ...cell };
        return { kind: 'cell', ...cell };
      }
      const slots = traySlots(trayCount);
      for (let i = 0; i < slots.length; i += 1) {
        if (pointIn(slots[i], p.x, p.y)) return { kind: 'tray', index: i };
      }
      return null;
    },
  };
}
