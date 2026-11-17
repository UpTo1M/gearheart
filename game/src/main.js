// Gearheart — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between title, play, paused, help, level-complete, game
// over and victory screens.
//
// ?seed=N fixes the level layouts. ?shot=start|play|win|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_LEVEL, EVENT_LIFE, EVENT_OVER, EVENT_PICKUP, EVENT_PLACE, EVENT_POWER, EVENT_ROTATE, EVENT_SUN, EVENT_TICK, EVENT_WIN, SCREEN_HELP, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_ROTATE_KEY } from './input.js';
import { createRenderer } from './render.js';
import { createSound } from './audio.js';
import { stageShot } from './shots.js';
import { cellAt, computeLayout } from './layout.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

function runShot(name) {
  const screen = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, readBest(), null, sound.muted);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return screen;
}

function runGame() {
  const input = createInput(canvas);
  const state = world.state;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_ROTATE) sound.rotate();
    if (events & EVENT_PLACE) sound.place();
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_POWER) sound.power();
    if (events & EVENT_SUN) sound.sun();
    if (events & EVENT_TICK) sound.tick();
    if (events & EVENT_LEVEL) sound.level();
    if (events & EVENT_LIFE) sound.lose();
    if (events & EVENT_OVER) {
      sound.lose();
      if (state.score > best) {
        best = state.score;
        saveBest(best);
      }
    }
    if (events & EVENT_WIN) {
      sound.win();
      if (state.score > best) {
        best = state.score;
        saveBest(best);
      }
    }
  }

  function spawnFx() {
    const layout = renderer.layoutFor(state.level);
    for (const k of state.justPowered) {
      const [x, y] = k.split(',').map(Number);
      const cx = layout.boardX + (x + 0.5) * layout.cell;
      const cy = layout.boardY + (y + 0.5) * layout.cell;
      const gear = state.grid[y][x];
      if (gear && gear.kind === 'gold') {
        renderer.burst(cx, cy, '#ffd700', 14, 130);
        renderer.floatText(cx, cy - 10, '+150', '#ffd700');
      } else {
        renderer.burst(cx, cy, '#ffb347', 8, 90);
      }
    }
  }

  function startGame() {
    sound.unlock();
    sound.startMusic();
    world.startGame();
    announce(`Playing level 1. Light the heart before the mainspring runs down.`);
  }

  function hoverCell() {
    const mouse = input.mouse();
    if (!mouse.inside || !state.level) return null;
    const layout = computeLayout(state.level.cols, state.level.rows);
    return cellAt(layout, state.level.cols, state.level.rows, mouse.x, mouse.y);
  }

  function handleClick() {
    const action = input.takeClick(state.screen, state.level, state.tray.length);
    if (!action) return;
    if (action.kind === 'hud') {
      if (action.id === 'mute') {
        const muted = sound.toggleMute();
        announce(muted ? 'Sound muted.' : 'Sound on.');
      } else if (action.id === 'help') {
        world.showHelp(state.screen);
        announce('How to play.');
      } else if (action.id === 'pause') {
        if (state.screen === SCREEN_PLAY) {
          world.pause();
          announce('Paused.');
        } else if (state.screen === SCREEN_PAUSED) {
          world.resume();
          announce('Playing.');
        }
      }
      return;
    }
    if (action.kind === 'button') {
      sound.unlock();
      sound.click();
      if (action.id === 'start' || action.id === 'restart') startGame();
      else if (action.id === 'next') {
        const events = world.nextLevel();
        playEvents(events);
        announce(`Playing level ${state.levelIndex + 1}.`);
      } else if (action.id === 'resume') {
        world.resume();
        announce('Playing.');
      } else if (action.id === 'quit') {
        world.resetToTitle();
        announce('Gearheart. Press Space or click to start.');
      } else if (action.id === 'help') {
        world.showHelp(state.screen);
        announce('How to play.');
      } else if (action.id === 'back') {
        world.hideHelp();
        announce('Back.');
      }
      return;
    }
    if (action.kind === 'tray') {
      if (world.selectTray(action.index)) sound.click();
      return;
    }
    if (action.kind === 'pickup') {
      playEvents(world.pickup(action.x, action.y));
      return;
    }
    if (action.kind === 'cell') {
      sound.unlock();
      const gear = state.grid[action.y]?.[action.x];
      let events = 0;
      if (state.selectedTray >= 0 && !gear) {
        events = world.place(action.x, action.y);
      } else if (gear) {
        events = world.rotate(action.x, action.y);
      }
      if (events === 0) sound.denied();
      else playEvents(events);
    }
  }

  function handleKeys() {
    const { bits, digits } = input.takeKeys();
    if (bits & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (bits & ACTION_HELP) {
      if (state.screen === SCREEN_HELP) world.hideHelp();
      else world.showHelp(state.screen);
    }
    if (bits & ACTION_PAUSE) {
      if (state.screen === SCREEN_PLAY) {
        world.pause();
        announce('Paused.');
      } else if (state.screen === SCREEN_PAUSED) {
        world.resume();
        announce('Playing.');
      }
    }
    if (bits & ACTION_CONFIRM) {
      sound.unlock();
      if (state.screen === SCREEN_TITLE || state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) {
        startGame();
      } else if (state.screen === SCREEN_LEVEL) {
        const events = world.nextLevel();
        playEvents(events);
        announce(`Playing level ${state.levelIndex + 1}.`);
      } else if (state.screen === SCREEN_PAUSED) {
        world.resume();
        announce('Playing.');
      }
    }
    if (bits & ACTION_ROTATE_KEY && state.screen === SCREEN_PLAY) {
      const cell = hoverCell();
      if (cell) {
        const events = world.rotate(cell.x, cell.y);
        if (events === 0) sound.denied();
        else playEvents(events);
      }
    }
    for (const n of digits) {
      if (state.screen === SCREEN_PLAY) world.selectTray(n - 1);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleKeys();
    handleClick();
    const screen = state.screen;
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      while (accumulator >= STEP && (state.screen === SCREEN_PLAY || state.screen === SCREEN_TITLE)) {
        const events = world.step(STEP);
        playEvents(events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    spawnFx();
    renderer.updateFx(STEP);
    renderer.draw(state, best, hoverCell(), sound.muted);
    state.justPowered = [];
    state.justSunned = [];
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      world.pause();
      announce('Paused.');
    }
  });

  world.resetToTitle();
  announce('Gearheart. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
