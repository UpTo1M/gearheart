# Gearheart — The Clockkeeper's Trial

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/UpTo1M/gearheart/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/UpTo1M/gearheart/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A clockwork puzzle game for the make.fun best-game-01 bounty (round 2).

The Great Clock has stopped. Carry power from the golden drive gear to the
crimson heart gear before the mainspring runs down: click a gear to turn it
90°, and its glowing spoke shows where power will flow. A gear lights when
a lit neighbour points at it. Place spare gears from the tray into empty
slots, route around rusted gears that cannot turn, and light golden sun
gears for bonus points and extra time. Eight levels, three mainsprings, one
heart per level — light them all to become Grand Clockkeeper.

## Play

Serve `game/` with any static server and open `index.html` in a desktop
browser (Chrome recommended). No network requests, no build step.

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Mouse: click a gear to turn it, click a tray gear then an empty slot to
place it, right-click a placed gear to pick it back up.
Keys: `1–4` pick a spare gear, `R` turn the gear under the mouse,
`P` pause, `M` mute, `H` help, `Enter` start.

## Layout

- `game/index.html` — the page and canvas.
- `game/src/config.js` — palette, levels, tuning.
- `game/src/random.js` — seeded random source.
- `game/src/levels.js` — level generation (solved board → scramble →
  verified solution) and power-flow simulation.
- `game/src/world.js` — game state: screens, timer, lives, score.
- `game/src/audio.js` — WebAudio sound effects and music box (synthesised).
- `game/src/input.js` — mouse and keyboard input.
- `game/src/layout.js` — canvas layout (shared by render and input).
- `game/src/render.js` — all canvas drawing.
- `game/src/shots.js` — screenshot scenes behind `?shot=`.
- `game/src/main.js` — boot and the game loop.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json`.
- `screenshots/` — four real renders: title, play, level complete, game over.

Screenshots are staged with `?shot=start|play|win|end&seed=N`; the scenes
drive the real game forward from fixed seeds, so they are reproducible.

## License

MIT — see `LICENSE`.
