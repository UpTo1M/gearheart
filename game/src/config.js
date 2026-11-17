// Gearheart — configuration: the board, the palette, the levels and the tuning.
// One file, one job: every number the game balances on lives here.
export const CANVAS = { width: 1280, height: 720 };

export const PALETTE = {
  background: '#171208',
  backgroundEdge: '#0e0a05',
  panel: '#241b10',
  panelEdge: '#4a3517',
  slot: '#1d150a',
  slotEdge: '#3d2c14',
  brass: '#c9a227',
  brassLight: '#f0cd6a',
  brassDark: '#7a5c14',
  copper: '#b87333',
  iron: '#8a7a5c',
  rust: '#7d4a26',
  cream: '#f5e6c8',
  creamDim: '#cbb98d',
  amber: '#ffb347',
  gold: '#ffd700',
  heart: '#e0523d',
  heartDark: '#8f2a1d',
  teal: '#4fb3a9',
  danger: '#e0523d',
  good: '#9ed06a',
};

// Directions: 0 = east, 1 = south, 2 = west, 3 = north (clockwise).
export const DIRS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

// Gear kinds and the spokes each one carries at rotation 0.
// A spoke is a direction index into DIRS; rotating a gear by one step adds 1 (mod 4).
export const GEAR_KINDS = {
  single: { spokes: [0], label: 'Cog' },
  double: { spokes: [0, 2], label: 'Pass gear' },
  triple: { spokes: [0, 1, 2], label: 'T gear' },
  quad: { spokes: [0, 1, 2, 3], label: 'Junction' },
  gold: { spokes: [0], label: 'Sun gear', bonus: true },
};

export const LIVES = 3;
export const BEST_KEY = 'gearheart-best';

// Level table: grid size, how many path gears start scrambled, how many rusted
// decoys, how many empty slots, how many sun gears, and the tray the player gets.
export const LEVELS = [
  { cols: 6, rows: 4, scramble: 3, rusted: 1, empty: 0, suns: 1, tray: ['single'], timeBase: 40, timePerCell: 4 },
  { cols: 7, rows: 4, scramble: 4, rusted: 2, empty: 1, suns: 1, tray: ['single', 'double'], timeBase: 40, timePerCell: 4 },
  { cols: 7, rows: 5, scramble: 5, rusted: 2, empty: 1, suns: 2, tray: ['single', 'double'], timeBase: 42, timePerCell: 4 },
  { cols: 8, rows: 5, scramble: 6, rusted: 3, empty: 2, suns: 2, tray: ['single', 'double', 'single'], timeBase: 44, timePerCell: 4 },
  { cols: 8, rows: 5, scramble: 7, rusted: 3, empty: 2, suns: 2, tray: ['single', 'double', 'triple'], timeBase: 44, timePerCell: 3 },
  { cols: 8, rows: 6, scramble: 8, rusted: 4, empty: 2, suns: 3, tray: ['single', 'double', 'triple'], timeBase: 46, timePerCell: 3 },
  { cols: 9, rows: 6, scramble: 9, rusted: 4, empty: 3, suns: 3, tray: ['single', 'double', 'triple', 'single'], timeBase: 48, timePerCell: 3 },
  { cols: 9, rows: 6, scramble: 10, rusted: 5, empty: 3, suns: 3, tray: ['single', 'double', 'triple', 'quad'], timeBase: 48, timePerCell: 3 },
];

export const SCORE = {
  powerGear: 5,
  sunGear: 150,
  sunTimeBonus: 5,
  levelBase: 500,
  levelTimePerSecond: 10,
  streakStep: 0.1,
};

export const STEP = 1 / 60;
