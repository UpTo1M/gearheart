// Gearheart — rendering: every pixel on the 1280x720 canvas.
// A brass-and-walnut workbench, glowing power, and big readable overlays.
// The renderer owns particles and floating score text; the loop feeds it
// spawn events after each action and clears the world's just-lit lists.
import { CANVAS, PALETTE, DIRS, GEAR_KINDS } from './config.js';
import { computeLayout, HUD, HUD_BUTTONS, screenButtons, traySlots, TRAY } from './layout.js';
import { spokeDirs, key } from './levels.js';
import {
  SCREEN_HELP, SCREEN_LEVEL, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN,
} from './world.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gearPath(ctx, cx, cy, r, spin) {
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = spin + (i / 16) * TAU;
    const radius = i % 2 === 0 ? r : r * 0.8;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.85);
  ctx.bezierCurveTo(cx - s * 1.15, cy - s * 0.1, cx - s * 0.55, cy - s * 0.95, cx, cy - s * 0.25);
  ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.95, cx + s * 1.15, cy - s * 0.1, cx, cy + s * 0.85);
  ctx.closePath();
}

function boltPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.15, cy - s);
  ctx.lineTo(cx - s * 0.55, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.05, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.15, cy + s);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.15);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.15);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const floats = [];

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 40,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, age: 0, life: 1.1 });
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i -= 1) {
      const f = floats[i];
      f.age += dt;
      f.y -= 34 * dt;
      if (f.age >= f.life) floats.splice(i, 1);
    }
  }

  function drawBackground(t) {
    const g = ctx.createRadialGradient(640, 300, 80, 640, 360, 820);
    g.addColorStop(0, '#241b10');
    g.addColorStop(1, PALETTE.backgroundEdge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    // Two slow decorative gears drifting behind the board.
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = PALETTE.brass;
    gearPath(ctx, 90, 640, 110, t * 0.05);
    ctx.fill();
    gearPath(ctx, 1210, 90, 130, -t * 0.04);
    ctx.fill();
    ctx.restore();
  }

  function drawGear(cx, cy, r, gear, powered, t, spinDir) {
    const spin = powered ? t * 0.6 * spinDir : 0;
    const isRust = gear.rusted;
    const isGold = gear.kind === 'gold';
    const isDrive = gear.kind === 'drive';
    const isHeart = gear.kind === 'heart';
    ctx.save();
    if (powered && !isHeart) {
      ctx.shadowColor = PALETTE.amber;
      ctx.shadowBlur = 18;
    }
    const fill = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    if (isRust) {
      fill.addColorStop(0, '#8a5a35');
      fill.addColorStop(1, '#5a3a20');
    } else if (isGold || isDrive) {
      fill.addColorStop(0, PALETTE.brassLight);
      fill.addColorStop(1, PALETTE.brass);
    } else if (isHeart) {
      fill.addColorStop(0, '#c65a45');
      fill.addColorStop(1, PALETTE.heartDark);
    } else if (powered) {
      fill.addColorStop(0, '#f0cd6a');
      fill.addColorStop(1, '#c9a227');
    } else {
      fill.addColorStop(0, '#7a6740');
      fill.addColorStop(1, '#4a3a1e');
    }
    gearPath(ctx, cx, cy, r, spin);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = isRust ? '#3d2412' : '#2e2110';
    ctx.stroke();
    // Hub.
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.34, 0, TAU);
    ctx.fillStyle = isRust ? '#4a2c17' : '#2e2110';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, TAU);
    ctx.fillStyle = powered || isDrive ? PALETTE.amber : '#8a7a5c';
    ctx.fill();
    // Rust speckles (stable per position).
    if (isRust) {
      ctx.fillStyle = 'rgba(40, 20, 8, 0.55)';
      const seed = Math.floor(cx * 7 + cy * 13);
      for (let i = 0; i < 5; i += 1) {
        const a = ((seed + i * 97) % 360) * (Math.PI / 180);
        const d = r * (0.45 + ((seed + i * 31) % 40) / 100);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5, 0, TAU);
        ctx.fill();
      }
    }
    // Sun rays for the bonus gear.
    if (isGold) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05);
        ctx.lineTo(cx + Math.cos(a) * r * 1.28, cy + Math.sin(a) * r * 1.28);
        ctx.stroke();
      }
    }
    // Spokes: the power direction, fixed while the teeth spin beneath.
    if (!isHeart) {
      const dirs = spokeDirs(gear);
      for (const d of dirs) {
        const a = d * (Math.PI / 2) - Math.PI / 2;
        const x2 = cx + Math.cos(a) * r * 0.92;
        const y2 = cy + Math.sin(a) * r * 0.92;
        ctx.strokeStyle = powered || isDrive ? PALETTE.amber : (isRust ? '#7d4a26' : '#a8894a');
        ctx.lineWidth = powered ? 6 : 4;
        ctx.lineCap = 'round';
        if (powered || isDrive) {
          ctx.shadowColor = PALETTE.amber;
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x2, y2, powered ? 5 : 4, 0, TAU);
        ctx.fillStyle = powered || isDrive ? '#ffe9a8' : '#cbb98d';
        ctx.fill();
      }
    }
    if (isDrive) {
      boltPath(ctx, cx, cy, r * 0.42);
      ctx.fillStyle = '#fff3c4';
      ctx.fill();
    }
    if (isHeart) {
      const pulse = powered ? 1 + Math.sin(t * 5) * 0.07 : 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.translate(-cx, -cy);
      heartPath(ctx, cx, cy, r * 0.52);
      ctx.fillStyle = powered ? '#ff7a5c' : '#b03a28';
      if (powered) {
        ctx.shadowColor = PALETTE.heart;
        ctx.shadowBlur = 22;
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPowerLines(state, layout, t) {
    ctx.save();
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.85)';
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 8;
    const { grid, level } = state;
    for (const k of state.powered) {
      const [x, y] = k.split(',').map(Number);
      const gear = grid[y]?.[x];
      if (!gear || gear.kind === 'heart') continue;
      const cx = layout.boardX + (x + 0.5) * layout.cell;
      const cy = layout.boardY + (y + 0.5) * layout.cell;
      for (const d of spokeDirs(gear)) {
        const nx = x + DIRS[d].x;
        const ny = y + DIRS[d].y;
        const isHeart = nx === level.heart.x && ny === level.heart.y;
        const isPowered = state.powered.has(key(nx, ny));
        if (!isHeart && !isPowered) continue;
        const ex = layout.boardX + (nx + 0.5) * layout.cell;
        const ey = layout.boardY + (ny + 0.5) * layout.cell;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBoard(state, t, hover) {
    const { level, grid } = state;
    const layout = computeLayout(level.cols, level.rows);
    ctx.save();
    roundRect(ctx, layout.boardX - 14, layout.boardY - 14, layout.boardW + 28, layout.boardH + 28, 16);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    ctx.restore();

    for (let y = 0; y < level.rows; y += 1) {
      for (let x = 0; x < level.cols; x += 1) {
        const cx = layout.boardX + (x + 0.5) * layout.cell;
        const cy = layout.boardY + (y + 0.5) * layout.cell;
        const gear = grid[y][x];
        ctx.save();
        roundRect(ctx, cx - layout.cell / 2 + 4, cy - layout.cell / 2 + 4, layout.cell - 8, layout.cell - 8, 10);
        ctx.fillStyle = PALETTE.slot;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = PALETTE.slotEdge;
        ctx.stroke();
        ctx.restore();
        if (!gear) {
          // Empty slot: a faint plus invites a tray gear.
          ctx.save();
          ctx.strokeStyle = 'rgba(203, 185, 141, 0.4)';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          const s = layout.cell * 0.16;
          ctx.beginPath();
          ctx.moveTo(cx - s, cy);
          ctx.lineTo(cx + s, cy);
          ctx.moveTo(cx, cy - s);
          ctx.lineTo(cx, cy + s);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        const powered = state.powered.has(key(x, y));
        const spinDir = (x + y) % 2 === 0 ? 1 : -1;
        drawGear(cx, cy, layout.cell * 0.42, gear, powered, t, spinDir);
        if (gear.playerPlaced) {
          ctx.save();
          ctx.strokeStyle = 'rgba(79, 179, 169, 0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, layout.cell * 0.47, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    drawPowerLines(state, layout, t);
    if (hover && state.screen === SCREEN_PLAY) {
      const cx = layout.boardX + (hover.x + 0.5) * layout.cell;
      const cy = layout.boardY + (hover.y + 0.5) * layout.cell;
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 230, 200, 0.85)';
      ctx.lineWidth = 2.5;
      roundRect(ctx, cx - layout.cell / 2 + 2, cy - layout.cell / 2 + 2, layout.cell - 4, layout.cell - 4, 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHud(state, best) {
    const { level, score, lives, timeLeft, timeLimit } = state;
    ctx.save();
    ctx.textBaseline = 'middle';
    // Left: level and score.
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '700 22px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${state.levelIndex + 1} / ${8}`, 24, 24);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.creamDim;
    ctx.fillText(`SCORE ${score.toLocaleString('en-US')}`, 24, 50);
    // Centre: the seconds, above the timer bar.
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS.width / 2, 46);
    // Right, row 1: mainspring lives.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.creamDim;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('SPRING', 800, 26);
    for (let i = 0; i < 3; i += 1) {
      const cx = 880 + i * 28;
      const cy = 26;
      gearPath(ctx, cx, cy, 10, i < lives ? state.elapsed * 0.8 : 0);
      ctx.fillStyle = i < lives ? PALETTE.brassLight : '#4a3a1e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, TAU);
      ctx.fillStyle = '#2e2110';
      ctx.fill();
    }
    // Right, row 1: sun-gear tally; row 2: best score.
    ctx.textAlign = 'right';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`☀ ${state.sunCount} / ${state.totalSuns}`, 1030, 26);
    ctx.fillStyle = PALETTE.creamDim;
    ctx.fillText(`BEST ${Math.max(best, score).toLocaleString('en-US')}`, 1030, 50);
    // Timer bar.
    const barW = 560;
    const barX = (CANVAS.width - barW) / 2;
    const ratio = Math.max(0, timeLeft / timeLimit);
    ctx.fillStyle = '#0e0a05';
    roundRect(ctx, barX - 2, HUD.timerBarY - 2, barW + 4, HUD.timerBarH + 4, 5);
    ctx.fill();
    const low = timeLeft <= 10;
    const color = ratio > 0.5 ? PALETTE.amber : ratio > 0.25 ? '#ff8c42' : PALETTE.danger;
    ctx.fillStyle = color;
    if (low && Math.sin(state.elapsed * 8) > 0) ctx.globalAlpha = 0.55;
    roundRect(ctx, barX, HUD.timerBarY, barW * ratio, HUD.timerBarH, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    // HUD buttons.
    for (const [id, rect] of Object.entries(HUD_BUTTONS)) {
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
      ctx.fillStyle = '#2a2012';
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.cream;
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = id === 'mute' ? '♪' : id === 'help' ? '?' : 'II';
      ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    }
    ctx.restore();
  }

  function drawTray(state) {
    const slots = traySlots(Math.max(state.tray.length, 1));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.creamDim;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('SPARE GEARS — click one, then click an empty slot to place it · right-click a placed gear to pick it up', CANVAS.width / 2, TRAY.labelY - 8);
    state.tray.forEach((kind, i) => {
      const s = slots[i];
      roundRect(ctx, s.x, s.y, s.w, s.h, 10);
      ctx.fillStyle = state.selectedTray === i ? '#3a2c12' : '#241b10';
      ctx.fill();
      ctx.lineWidth = state.selectedTray === i ? 3 : 1.5;
      ctx.strokeStyle = state.selectedTray === i ? PALETTE.amber : PALETTE.panelEdge;
      ctx.stroke();
      drawGear(s.x + s.w / 2, s.y + s.h / 2 - 8, 20, { kind, rotation: 0, rusted: false }, false, state.elapsed, 1);
      ctx.fillStyle = PALETTE.creamDim;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(GEAR_KINDS[kind].label, s.x + s.w / 2, s.y + s.h - 12);
    });
    if (state.tray.length === 0) {
      ctx.fillStyle = PALETTE.creamDim;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText('Tray empty — every spare gear is on the board.', CANVAS.width / 2, TRAY.slotY + 34);
    }
    ctx.restore();
  }

  function drawButton(rect, label, primary) {
    ctx.save();
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fillStyle = primary ? PALETTE.brass : '#2a2012';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = primary ? PALETTE.brassLight : PALETTE.panelEdge;
    ctx.stroke();
    ctx.fillStyle = primary ? '#241b10' : PALETTE.cream;
    ctx.font = '700 21px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    ctx.restore();
  }

  function drawPanel(x, y, w, h) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 18);
    ctx.fillStyle = 'rgba(20, 14, 6, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    ctx.restore();
  }

  function drawTitle(state, best) {
    // Dimmed board behind the title.
    ctx.save();
    ctx.globalAlpha = 0.3;
    drawBoard(state, state.elapsed, null);
    ctx.restore();
    ctx.fillStyle = 'rgba(10, 7, 3, 0.55)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    // Emblem: a great gear with a heart.
    const ex = CANVAS.width / 2;
    const ey = 218;
    drawGear(ex, ey, 92, { kind: 'heart', rotation: 0, rusted: false }, true, state.elapsed, 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = PALETTE.amber;
    ctx.shadowBlur = 26;
    ctx.fillStyle = PALETTE.brassLight;
    ctx.font = '900 84px Georgia, serif';
    ctx.fillText('GEARHEART', ex, 380);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.cream;
    ctx.font = 'italic 600 26px Georgia, serif';
    ctx.fillText('The Clockkeeper’s Trial', ex, 424);
    ctx.fillStyle = PALETTE.creamDim;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Turn the gears. Wake the heart. Beat the mainspring.', ex, 462);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, ex, 66);
    }
    ctx.restore();
    for (const b of screenButtons(SCREEN_TITLE)) {
      drawButton(b, b.label, b.id === 'start');
    }
  }

  function drawHelp(state) {
    drawPanel(240, 60, 800, 560);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.brassLight;
    ctx.font = '900 40px Georgia, serif';
    ctx.fillText('How to play', CANVAS.width / 2, 116);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      'The Great Clock has stopped. Carry power from the golden',
      'drive gear to the crimson heart gear before the mainspring',
      'runs down.',
      '',
      '• Click a gear to turn it 90°. Its glowing spoke shows where',
      '  power will flow. A gear lights when a lit neighbour points at it.',
      '• Click a spare gear in the tray, then an empty slot, to place it.',
      '  Right-click a gear you placed to pick it back up.',
      '• Rusted gears cannot turn — route around them.',
      '• Light a golden sun gear for +150 points and +5 seconds.',
      '• The heart lit means the level is won: faster is worth more.',
      '• Three lost mainsprings and the clock stops for good.',
      '',
      'Keys:  1–4 pick a spare gear · R turn the gear under the mouse',
      '       P pause · M mute · H help · Enter start',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 290, 168 + i * 28));
    ctx.restore();
    for (const b of screenButtons(SCREEN_HELP)) drawButton(b, b.label, false);
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(10, 7, 3, 0.6)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    drawPanel(440, 300, 400, 330);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.brassLight;
    ctx.font = '900 40px Georgia, serif';
    ctx.fillText('Paused', CANVAS.width / 2, 352);
    ctx.restore();
    for (const b of screenButtons(SCREEN_PAUSED)) drawButton(b, b.label, b.id === 'resume');
  }

  function drawLevelComplete(state) {
    ctx.fillStyle = 'rgba(10, 7, 3, 0.55)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    drawPanel(380, 130, 520, 420);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '900 42px Georgia, serif';
    ctx.fillText('The heart beats!', CANVAS.width / 2, 192);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '600 21px system-ui, sans-serif';
    const rows = [
      ['Level bonus', state.levelBonus],
      ['Time bonus', state.timeBonus],
      ['Sun gears lit', `${state.sunCount} × 150`],
      ['Score', state.score],
    ];
    rows.forEach(([label, value], i) => {
      const y = 258 + i * 40;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.creamDim;
      ctx.fillText(label, 440, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = i === 3 ? PALETTE.gold : PALETTE.cream;
      ctx.font = i === 3 ? '700 23px system-ui, sans-serif' : '600 21px system-ui, sans-serif';
      ctx.fillText(typeof value === 'number' ? value.toLocaleString('en-US') : value, 840, y);
      ctx.font = '600 21px system-ui, sans-serif';
    });
    if (state.streak > 1) {
      ctx.fillStyle = PALETTE.teal;
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.streak} levels in a row — streak bonus applied!`, CANVAS.width / 2, 428);
    }
    ctx.restore();
    for (const b of screenButtons(SCREEN_LEVEL)) drawButton(b, b.label, true);
  }

  function drawGameOver(state, best) {
    ctx.fillStyle = 'rgba(10, 7, 3, 0.6)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    drawPanel(380, 140, 520, 410);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.heart;
    ctx.font = '900 42px Georgia, serif';
    ctx.fillText('The clock stopped', CANVAS.width / 2, 202);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText(`You reached level ${state.levelIndex + 1} of 8.`, CANVAS.width / 2, 258);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, CANVAS.width / 2, 312);
    ctx.fillStyle = PALETTE.creamDim;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(`Best  ${Math.max(best, state.score).toLocaleString('en-US')}`, CANVAS.width / 2, 348);
    ctx.fillText('The gears are waiting. Wind the clock and try again.', CANVAS.width / 2, 420);
    ctx.restore();
    for (const b of screenButtons(SCREEN_OVER)) drawButton(b, b.label, true);
  }

  function drawVictory(state, best) {
    ctx.fillStyle = 'rgba(10, 7, 3, 0.55)';
    ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
    drawPanel(340, 110, 600, 460);
    ctx.save();
    ctx.textAlign = 'center';
    drawGear(CANVAS.width / 2, 200, 64, { kind: 'heart', rotation: 0, rusted: false }, true, state.elapsed, 1);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '900 44px Georgia, serif';
    ctx.fillText('Grand Clockkeeper!', CANVAS.width / 2, 300);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText('All eight hearts beat as one. The Great Clock lives again.', CANVAS.width / 2, 344);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(`FINAL SCORE  ${state.score.toLocaleString('en-US')}`, CANVAS.width / 2, 402);
    ctx.fillStyle = PALETTE.creamDim;
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(`Best  ${Math.max(best, state.score).toLocaleString('en-US')}`, CANVAS.width / 2, 440);
    ctx.restore();
    for (const b of screenButtons(SCREEN_WIN)) drawButton(b, b.label, true);
  }

  function drawFx() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const f of floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      ctx.fillStyle = f.color;
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawMessage(state) {
    if (!state.message || state.elapsed > state.messageUntil) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 24px Georgia, serif';
    ctx.fillStyle = 'rgba(10, 7, 3, 0.7)';
    const w = ctx.measureText(state.message).width + 36;
    roundRect(ctx, CANVAS.width / 2 - w / 2, 96, w, 40, 20);
    ctx.fill();
    ctx.fillStyle = PALETTE.cream;
    ctx.fillText(state.message, CANVAS.width / 2, 117);
    ctx.restore();
  }

  return {
    burst,
    floatText,
    updateFx,
    layoutFor(level) {
      return computeLayout(level.cols, level.rows);
    },
    draw(state, best, hover, muted) {
      const t = state.elapsed;
      drawBackground(t);
      const screen = state.screen;
      if (screen === SCREEN_TITLE) {
        drawTitle(state, best);
      } else if (screen === SCREEN_HELP) {
        drawBoard(state, t, null);
        drawHelp(state);
      } else {
        drawBoard(state, t, hover);
        drawHud(state, best);
        drawTray(state);
        drawMessage(state);
        if (screen === SCREEN_PAUSED) drawPaused(state);
        else if (screen === SCREEN_LEVEL) drawLevelComplete(state);
        else if (screen === SCREEN_OVER) drawGameOver(state, best);
        else if (screen === SCREEN_WIN) drawVictory(state, best);
      }
      drawFx();
      if (muted) {
        ctx.save();
        ctx.fillStyle = PALETTE.creamDim;
        ctx.font = '600 15px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('muted (M)', CANVAS.width - 24, CANVAS.height - 16);
        ctx.restore();
      }
    },
  };
}
