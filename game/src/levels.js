// Gearheart — level generation. A level is built backwards: a winding path is
// drawn from the drive gear to the heart, gears are laid along it already
// pointing the right way, then some of them are scrambled. The scramble is
// recorded as the solution, so a level is always solvable, and the generator
// verifies the scrambled board does not already power the heart.
import { DIRS, GEAR_KINDS, LEVELS } from './config.js';
import { createRandom } from './random.js';

export function key(x, y) {
  return `${x},${y}`;
}

/** The directions a gear's spokes point in, given its kind and rotation. */
export function spokeDirs(gear) {
  if (gear.kind === 'drive') return [0];
  if (gear.kind === 'heart') return [];
  const base = GEAR_KINDS[gear.kind].spokes;
  return base.map((d) => (d + gear.rotation) % 4);
}

/** Power flow from the drive: returns the powered cells and whether the heart lit. */
export function simulatePower(grid, cols, rows, drive, heart) {
  const powered = new Set();
  const queue = [drive];
  powered.add(key(drive.x, drive.y));
  let heartPowered = false;
  while (queue.length > 0) {
    const cell = queue.pop();
    const gear = grid[cell.y][cell.x];
    if (!gear) continue;
    for (const dir of spokeDirs(gear)) {
      const nx = cell.x + DIRS[dir].x;
      const ny = cell.y + DIRS[dir].y;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (nx === heart.x && ny === heart.y) {
        heartPowered = true;
        continue;
      }
      const next = grid[ny][nx];
      if (!next || next.kind === 'drive' || next.kind === 'heart') continue;
      const k = key(nx, ny);
      if (!powered.has(k)) {
        powered.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return { powered, heartPowered };
}

function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function neighbours(x, y, cols, rows) {
  const out = [];
  for (let d = 0; d < 4; d += 1) {
    const nx = x + DIRS[d].x;
    const ny = y + DIRS[d].y;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push({ x: nx, y: ny, dir: d });
  }
  return out;
}

/**
 * A winding self-avoiding path from start to target, at least minLen cells long.
 * Randomised depth-first search; never steps on the blocked cells (the drive
 * and the heart); null when no long enough path was found.
 */
function findPath(random, cols, rows, start, target, minLen, blocked) {
  const visited = new Set([key(start.x, start.y)]);
  const path = [start];
  function dfs(cell) {
    if (cell.x === target.x && cell.y === target.y) return path.length >= minLen;
    const next = random.shuffle(neighbours(cell.x, cell.y, cols, rows));
    for (const n of next) {
      if (blocked.has(key(n.x, n.y))) continue;
      if (n.x === target.x && n.y === target.y) {
        if (path.length + 1 >= minLen) {
          path.push({ x: n.x, y: n.y });
          return true;
        }
        continue;
      }
      if (visited.has(key(n.x, n.y))) continue;
      visited.add(key(n.x, n.y));
      path.push({ x: n.x, y: n.y });
      if (dfs({ x: n.x, y: n.y })) return true;
      path.pop();
      visited.delete(key(n.x, n.y));
    }
    return false;
  }
  return dfs(start) ? path : null;
}

/** Direction index from cell a to adjacent cell b. */
function directionTo(a, b) {
  for (let d = 0; d < 4; d += 1) {
    if (a.x + DIRS[d].x === b.x && a.y + DIRS[d].y === b.y) return d;
  }
  return 0;
}

function buildOnce(levelIndex, seed) {
  const cfg = LEVELS[levelIndex];
  const random = createRandom(seed);
  const { cols, rows } = cfg;
  const driveRow = random.int(rows);
  const heartRow = random.int(rows);
  const drive = { x: 0, y: driveRow };
  const heart = { x: cols - 1, y: heartRow };
  const start = { x: 1, y: driveRow };
  const target = { x: cols - 2, y: heartRow };
  const minLen = Math.min(cols + rows, cols * rows - 2);
  const blocked = new Set([key(drive.x, drive.y), key(heart.x, heart.y)]);
  let path = null;
  for (let attempt = 0; attempt < 200 && !path; attempt += 1) {
    path = findPath(random, cols, rows, start, target, minLen, blocked);
  }
  if (!path) return null;
  const onPath = new Set(path.map((c) => key(c.x, c.y)));

  // Lay the solved board: every path cell gets a gear whose spokes cover the
  // step to the next path cell (or to the heart for the last one).
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  grid[drive.y][drive.x] = { kind: 'drive', rotation: 0, rusted: true };
  grid[heart.y][heart.x] = { kind: 'heart', rotation: 0, rusted: true };
  for (let i = 0; i < path.length; i += 1) {
    const cell = path[i];
    const next = i + 1 < path.length ? path[i + 1] : heart;
    const want = directionTo(cell, next);
    const roll = random.next();
    let kind = 'single';
    if (roll > 0.82) kind = 'triple';
    else if (roll > 0.6) kind = 'double';
    // Rotate the kind so one of its spokes points at `want`.
    grid[cell.y][cell.x] = { kind, rotation: want % 4, rusted: false, playerPlaced: false };
  }

  // Decoys: a few gears off the path (misdirection, and a second route for
  // the bold), the rest left empty so the player can place spare gears.
  // Most off-path cells stay empty: a dense field of decoys would conduct
  // power around the puzzle and make the scramble meaningless.
  const empties = [];
  let rustedLeft = cfg.rusted;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (onPath.has(key(x, y))) continue;
      if ((x === drive.x && y === drive.y) || (x === heart.x && y === heart.y)) continue;
      const roll = random.next();
      if (roll < 0.55) {
        empties.push({ x, y });
      } else {
        const kind = random.pick(['single', 'single', 'double', 'triple', 'quad']);
        const rusted = rustedLeft > 0 && random.next() < 0.5;
        if (rusted) rustedLeft -= 1;
        grid[y][x] = { kind, rotation: random.int(4), rusted, playerPlaced: false };
      }
    }
  }

  // Sun gears: bonus gears hugging the path, so a branch can light them.
  const pathAdj = [];
  for (const cell of path) {
    for (const n of neighbours(cell.x, cell.y, cols, rows)) {
      if (onPath.has(key(n.x, n.y))) continue;
      if ((n.x === drive.x && n.y === drive.y) || (n.x === heart.x && n.y === heart.y)) continue;
      if (grid[n.y][n.x] && grid[n.y][n.x].kind === 'gold') continue;
      pathAdj.push({ x: n.x, y: n.y });
    }
  }
  random.shuffle(pathAdj);
  for (let i = 0; i < Math.min(cfg.suns, pathAdj.length); i += 1) {
    const c = pathAdj[i];
    grid[c.y][c.x] = { kind: 'gold', rotation: random.int(4), rusted: false, playerPlaced: false };
  }

  // One empty slot on the path (levels with room for it): the tray supplies the gear.
  const solution = [];
  const tray = [...cfg.tray];
  const emptyPath = cfg.empty > 0 && path.length > 5;
  let emptySpot = null;
  if (emptyPath) {
    emptySpot = path[1 + random.int(path.length - 3)];
    const emptyIndex = path.indexOf(emptySpot);
    const next = path[emptyIndex + 1] ?? heart;
    const want = directionTo(emptySpot, next);
    grid[emptySpot.y][emptySpot.x] = null;
    empties.push({ x: emptySpot.x, y: emptySpot.y });
    tray.push('single');
    solution.push({ type: 'place', x: emptySpot.x, y: emptySpot.y, kind: 'single', times: want, order: emptyIndex });
  }

  // Scramble: rotate some path gears off their solved angle, recording the undo.
  const scramblePool = path.filter((c) => !(emptySpot && c.x === emptySpot.x && c.y === emptySpot.y));
  random.shuffle(scramblePool);
  const scrambleCount = Math.min(cfg.scramble, scramblePool.length);
  for (let i = 0; i < scrambleCount; i += 1) {
    const cell = scramblePool[i];
    const gear = grid[cell.y][cell.x];
    // Only deltas that actually take a spoke off the wanted direction: a
    // double keeps its spokes after 180 degrees, and a triple still covers
    // the wanted direction after 180 or 270 degrees.
    const deltas = gear.kind === 'single' ? [1, 2, 3] : gear.kind === 'double' ? [1, 3] : [1];
    const delta = random.pick(deltas);
    gear.rotation = (gear.rotation + delta) % 4;
    solution.push({ type: 'rotate', x: cell.x, y: cell.y, times: (4 - delta) % 4, order: path.indexOf(cell) });
  }
  // Order the solution along the path, drive to heart, so applying a prefix
  // lights the chain step by step (the screenshot stager relies on this).
  solution.sort((a, b) => a.order - b.order);

  // The scrambled board must not already power the heart; the solution must.
  const startCheck = simulatePower(grid, cols, rows, drive, heart);
  if (startCheck.heartPowered) return null;
  const solved = cloneGrid(grid);
  applySolution(solved, solution);
  const endCheck = simulatePower(solved, cols, rows, drive, heart);
  if (!endCheck.heartPowered) return null;

  // Every solution move must be critical: take any one away and the heart
  // stays dark. Otherwise decoy gears already bridge around that move and
  // the puzzle is looser than it looks — a single fix would win the level.
  // (Kept as a best effort: the hard requirement below is that the heart
  // only lights on the last move in path order.)
  let critical = 0;
  for (let i = 0; i < solution.length; i += 1) {
    const partial = cloneGrid(grid);
    applySolution(partial, solution.filter((_, j) => j !== i));
    const check = simulatePower(partial, cols, rows, drive, heart);
    if (!check.heartPowered) critical += 1;
  }
  if (critical < solution.length - 1) return null;

  // Applying the solution in path order must light the heart only on the
  // last move: the chain is built step by step, never finished early.
  const trace = cloneGrid(grid);
  for (let i = 0; i < solution.length; i += 1) {
    applySolution(trace, [solution[i]]);
    const check = simulatePower(trace, cols, rows, drive, heart);
    if (check.heartPowered && i !== solution.length - 1) return null;
  }

  // The opening board should read as a short lit chain, not a lit blob:
  // the drive's reach at the start is bounded by the path so far.
  if (startCheck.powered.size > path.length + 4) return null;

  const timeLimit = cfg.timeBase + path.length * cfg.timePerCell;
  return {
    levelIndex, cols, rows, drive, heart, grid, tray, solution, timeLimit,
    pathLength: path.length, emptySlots: empties,
  };
}

/** Apply solution moves to a grid (used by the generator and the shot stager). */
export function applySolution(grid, solution) {
  for (const move of solution) {
    if (move.type === 'rotate') {
      const gear = grid[move.y][move.x];
      if (gear) gear.rotation = (gear.rotation + move.times) % 4;
    } else if (move.type === 'place') {
      grid[move.y][move.x] = { kind: move.kind, rotation: move.times % 4, rusted: false, playerPlaced: true };
    }
  }
}

/** Generate a level, retrying with fresh seeds until the board verifies. */
export function generateLevel(levelIndex, seed) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const level = buildOnce(levelIndex, seed + attempt * 7919);
    if (level) return level;
  }
  throw new Error(`could not generate level ${levelIndex}`);
}
