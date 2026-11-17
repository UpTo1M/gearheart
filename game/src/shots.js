// Gearheart — screenshot scenes behind ?shot=start|play|win|end.
// Each one drives the real game forward (real levels, real moves, real
// rules), so the frame is what a short game really looks like, and the same
// seed always gives the same frame.
//
// Moves are applied atomically (a gear's rotation is set in one write, not
// step by step): a single click turns a gear 90 degrees in play, but a
// solution move may turn it 270, and turning it step by step could light
// the heart at an intermediate angle and strand the gear there.
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { applySolution } from './levels.js';
import { SCORE } from './config.js';

/**
 * Stage the named scene on `world` and return the screen to draw.
 * The world is the object createWorld returns; its state is world.state.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    // Level 2, as far along as it goes without winning: the power chain is
    // long and lit, the heart still dark, the clock half run down.
    world.loadLevel(1, true);
    state.screen = SCREEN_PLAY;
    state.elapsed = 30;
    applyMovesUpToWin(world, state.level.solution);
    state.timeLeft = Math.round(state.timeLimit * 0.55);
    return SCREEN_PLAY;
  }
  if (name === 'win') {
    // Level 1, solved in full: the heart is lit and the level-complete
    // panel shows the score breakdown.
    world.loadLevel(0, true);
    state.screen = SCREEN_PLAY;
    state.elapsed = 48;
    state.timeLeft = Math.round(state.timeLimit * 0.6);
    applyMoves(world, state.level.solution);
    if (state.heartPowered) {
      const streakMult = 1 + state.streak * SCORE.streakStep;
      state.levelBonus = Math.round(SCORE.levelBase * streakMult);
      state.timeBonus = Math.round(Math.ceil(state.timeLeft) * SCORE.levelTimePerSecond * streakMult);
      state.score += state.levelBonus + state.timeBonus;
      state.streak += 1;
      state.screen = SCREEN_LEVEL;
    }
    return state.screen;
  }
  if (name === 'end') {
    // A lost run: the mainspring ran down on level 1 with a score to show.
    world.loadLevel(0, true);
    state.screen = SCREEN_PLAY;
    state.elapsed = 62;
    applyMoves(world, state.level.solution.slice(0, 1));
    state.lives = 0;
    state.score = 1240;
    state.timeLeft = 0;
    state.screen = SCREEN_OVER;
    return SCREEN_OVER;
  }
  // Default: the title screen over a gently ticking level 1 board.
  world.resetToTitle();
  state.elapsed = 4.2;
  return SCREEN_TITLE;
}

/** Score the gears a move just lit, exactly as the world scores them. */
function scoreNewlyPowered(state, before) {
  for (const k of state.powered) {
    if (before.has(k)) continue;
    const [x, y] = k.split(',').map(Number);
    const gear = state.grid[y][x];
    if (gear && gear.kind === 'gold') {
      state.score += SCORE.sunGear;
      state.levelScore += SCORE.sunGear;
      state.sunCount += 1;
      state.timeLeft = Math.min(state.timeLimit, state.timeLeft + SCORE.sunTimeBonus);
    } else {
      state.score += SCORE.powerGear;
      state.levelScore += SCORE.powerGear;
    }
  }
}

/** Apply one solution move atomically; returns true when the heart lit. */
function applyOne(world, move) {
  const state = world.state;
  const before = new Set(state.powered);
  if (move.type === 'place') {
    const index = state.tray.indexOf(move.kind);
    if (index >= 0) state.tray.splice(index, 1);
  }
  applySolution(state.grid, [move]);
  world.resimulate();
  scoreNewlyPowered(state, before);
  return state.heartPowered;
}

/** Undo one solution move atomically (the mirror of applyOne). */
function undoOne(world, move) {
  const state = world.state;
  if (move.type === 'rotate') {
    const gear = state.grid[move.y][move.x];
    if (gear) gear.rotation = (gear.rotation + (4 - move.times) % 4) % 4;
  } else if (move.type === 'place') {
    state.grid[move.y][move.x] = null;
    state.tray.push(move.kind);
  }
  world.resimulate();
}

/** Apply solution moves; returns true when the heart lit. */
function applyMoves(world, moves) {
  for (const move of moves) {
    if (applyOne(world, move)) return true;
  }
  return false;
}

/**
 * Apply solution moves in path order, stopping just before the move that
 * would light the heart — and undoing that move — so the scene stays
 * mid-game with the longest lit chain possible.
 */
function applyMovesUpToWin(world, moves) {
  const state = world.state;
  for (const move of moves) {
    const snap = {
      score: state.score,
      levelScore: state.levelScore,
      sunCount: state.sunCount,
      timeLeft: state.timeLeft,
    };
    if (applyOne(world, move)) {
      Object.assign(state, snap);
      undoOne(world, move);
      break;
    }
  }
  world.resimulate();
}
