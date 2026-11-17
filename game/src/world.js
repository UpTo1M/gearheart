// Gearheart — the game state: screens, levels, power, timer, lives, score.
// Pure rules here; rendering lives in render.js, input in input.js.
import { LEVELS, LIVES, SCORE, STEP } from './config.js';
import { generateLevel, key, simulatePower } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';
export const SCREEN_HELP = 'help';

export const EVENT_NONE = 0;
export const EVENT_POWER = 1;
export const EVENT_SUN = 2;
export const EVENT_LEVEL = 4;
export const EVENT_LIFE = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_TICK = 64;
export const EVENT_ROTATE = 128;
export const EVENT_PLACE = 256;
export const EVENT_PICKUP = 512;

export function createWorld(seed) {
  const world = {
    seed,
    screen: SCREEN_TITLE,
    levelIndex: 0,
    level: null,
    grid: null,
    tray: [],
    powered: new Set(),
    heartPowered: false,
    score: 0,
    best: 0,
    lives: LIVES,
    streak: 0,
    timeLeft: 0,
    timeLimit: 0,
    selectedTray: -1,
    levelScore: 0,
    levelBonus: 0,
    timeBonus: 0,
    sunCount: 0,
    totalSuns: 0,
    elapsed: 0,
    message: '',
    messageUntil: 0,
    justPowered: [],
    justSunned: [],
  };

  function loadLevel(index, keepScore) {
    const level = generateLevel(index, world.seed + index * 131);
    world.levelIndex = index;
    world.level = level;
    world.grid = level.grid;
    world.tray = [...level.tray];
    world.timeLimit = level.timeLimit;
    world.timeLeft = level.timeLimit;
    world.selectedTray = -1;
    world.levelScore = 0;
    world.sunCount = 0;
    world.totalSuns = level.grid.flat().filter((c) => c && c.kind === 'gold').length;
    if (!keepScore) world.score = 0;
    refreshPower(world, true);
  }

  /** Recompute power; score newly lit gears and sun gears. */
  function refreshPower(w, silent) {
    const before = w.powered;
    const result = simulatePower(w.grid, w.level.cols, w.level.rows, w.level.drive, w.level.heart);
    const fresh = [];
    const sunned = [];
    for (const k of result.powered) {
      if (!before.has(k)) {
        fresh.push(k);
        const [x, y] = k.split(',').map(Number);
        const gear = w.grid[y][x];
        if (gear && gear.kind === 'gold') sunned.push(k);
      }
    }
    w.powered = result.powered;
    w.heartPowered = result.heartPowered;
    w.justPowered = fresh;
    w.justSunned = sunned;
    if (!silent) {
      for (const k of fresh) {
        const [x, y] = k.split(',').map(Number);
        const gear = w.grid[y][x];
        if (gear && gear.kind === 'gold') {
          w.score += SCORE.sunGear;
          w.levelScore += SCORE.sunGear;
          w.sunCount += 1;
          w.timeLeft = Math.min(w.timeLimit, w.timeLeft + SCORE.sunTimeBonus);
        } else {
          w.score += SCORE.powerGear;
          w.levelScore += SCORE.powerGear;
        }
      }
    }
    return result;
  }

  function startGame() {
    world.score = 0;
    world.lives = LIVES;
    world.streak = 0;
    loadLevel(0, true);
    world.screen = SCREEN_PLAY;
    world.message = 'Light the heart!';
    world.messageUntil = world.elapsed + 2.5;
  }

  function completeLevel() {
    const seconds = Math.ceil(world.timeLeft);
    const streakMult = 1 + world.streak * SCORE.streakStep;
    world.timeBonus = Math.round(seconds * SCORE.levelTimePerSecond * streakMult);
    world.levelBonus = Math.round(SCORE.levelBase * streakMult);
    world.score += world.levelBonus + world.timeBonus;
    world.streak += 1;
    world.screen = SCREEN_LEVEL;
    return EVENT_LEVEL;
  }

  function nextLevel() {
    if (world.levelIndex + 1 >= LEVELS.length) {
      world.screen = SCREEN_WIN;
      return EVENT_WIN;
    }
    loadLevel(world.levelIndex + 1, true);
    world.screen = SCREEN_PLAY;
    world.message = `Level ${world.levelIndex + 1} — light the heart!`;
    world.messageUntil = world.elapsed + 2.5;
    return EVENT_NONE;
  }

  function loseLife() {
    world.lives -= 1;
    world.streak = 0;
    if (world.lives <= 0) {
      world.screen = SCREEN_OVER;
      return EVENT_OVER;
    }
    loadLevel(world.levelIndex, true);
    world.screen = SCREEN_PLAY;
    world.message = 'The mainspring ran down!';
    world.messageUntil = world.elapsed + 2.5;
    return EVENT_LIFE;
  }

  return {
    state: world,

    startGame,
    nextLevel,
    loseLife,

    resetToTitle() {
      loadLevel(0, false);
      world.screen = SCREEN_TITLE;
    },

    pause() {
      if (world.screen === SCREEN_PLAY) world.screen = SCREEN_PAUSED;
    },
    resume() {
      if (world.screen === SCREEN_PAUSED) world.screen = SCREEN_PLAY;
    },
    showHelp(from) {
      world.helpReturn = from;
      world.screen = SCREEN_HELP;
    },
    hideHelp() {
      world.screen = world.helpReturn || SCREEN_TITLE;
    },

    /** Rotate the gear at (x, y) one step clockwise; returns event bits. */
    rotate(x, y) {
      if (world.screen !== SCREEN_PLAY) return EVENT_NONE;
      const gear = world.grid[y]?.[x];
      if (!gear || gear.kind === 'drive' || gear.kind === 'heart' || gear.rusted) return EVENT_NONE;
      gear.rotation = (gear.rotation + 1) % 4;
      let events = EVENT_ROTATE;
      const result = refreshPower(world, false);
      if (world.justPowered.length > 0) events |= EVENT_POWER;
      if (world.justSunned.length > 0) events |= EVENT_SUN;
      if (result.heartPowered) events |= completeLevel();
      return events;
    },

    /** Place the selected tray gear into an empty slot; returns event bits. */
    place(x, y) {
      if (world.screen !== SCREEN_PLAY) return EVENT_NONE;
      if (world.selectedTray < 0 || world.selectedTray >= world.tray.length) return EVENT_NONE;
      if (world.grid[y]?.[x]) return EVENT_NONE;
      const kind = world.tray[world.selectedTray];
      world.grid[y][x] = { kind, rotation: 0, rusted: false, playerPlaced: true };
      world.tray.splice(world.selectedTray, 1);
      world.selectedTray = -1;
      let events = EVENT_PLACE;
      const result = refreshPower(world, false);
      if (world.justPowered.length > 0) events |= EVENT_POWER;
      if (world.justSunned.length > 0) events |= EVENT_SUN;
      if (result.heartPowered) events |= completeLevel();
      return events;
    },

    /** Pick a player-placed gear back up into the tray; returns event bits. */
    pickup(x, y) {
      if (world.screen !== SCREEN_PLAY) return EVENT_NONE;
      const gear = world.grid[y]?.[x];
      if (!gear || !gear.playerPlaced) return EVENT_NONE;
      world.grid[y][x] = null;
      world.tray.push(gear.kind);
      refreshPower(world, false);
      return EVENT_PICKUP;
    },

    selectTray(index) {
      if (index >= 0 && index < world.tray.length) {
        world.selectedTray = world.selectedTray === index ? -1 : index;
        return true;
      }
      return false;
    },

    /** Advance the clock by one fixed step; returns events for sound. */
    step(dt) {
      world.elapsed += dt;
      if (world.screen !== SCREEN_PLAY) return EVENT_NONE;
      const before = Math.ceil(world.timeLeft);
      world.timeLeft -= dt;
      const after = Math.ceil(world.timeLeft);
      let events = EVENT_NONE;
      if (after !== before && after <= 10 && after > 0) events |= EVENT_TICK;
      if (world.timeLeft <= 0) {
        world.timeLeft = 0;
        return events | loseLife();
      }
      return events;
    },

    /** Recompute power without scoring (used by the shot stager). */
    resimulate() {
      const result = simulatePower(world.grid, world.level.cols, world.level.rows, world.level.drive, world.level.heart);
      world.powered = result.powered;
      world.heartPowered = result.heartPowered;
      return result;
    },

    loadLevel,
    refreshPower: (silent) => refreshPower(world, silent),
    gridKey: key,
  };
}
