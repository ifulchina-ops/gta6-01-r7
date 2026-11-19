// Port Almar — shared world state.
// One plain object holds everything the systems read and write, so each
// module stays small and the boot loop can snapshot it for saves.
export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const ROAD_W = 96;

export const DISTRICTS = [
  { name: 'Glass Quay', x: 1500, y: 300, w: 1100, h: 700, tint: '#3d6f8e', vibe: 'downtown towers' },
  { name: 'Marina Verde', x: 2400, y: 1500, w: 1200, h: 1000, tint: '#e8c97a', vibe: 'beach and boardwalk' },
  { name: 'Old Cannery', x: 200, y: 300, w: 1000, h: 800, tint: '#8a6b4a', vibe: 'warehouses and factories' },
  { name: 'Palmera Heights', x: 200, y: 1300, w: 1100, h: 900, tint: '#7fae6a', vibe: 'leafy houses' },
  { name: 'Dune Strip', x: 1400, y: 1800, w: 1000, h: 900, tint: '#d98a4a', vibe: 'motels and race boulevard' },
  { name: 'Ironworks Docks', x: 1500, y: 1100, w: 900, h: 600, tint: '#6a6f78', vibe: 'cranes and containers' },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.32, range: 46, ammo: Infinity, auto: false, color: '#f2c89b' },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 0.28, range: 420, ammo: 120, auto: false, color: '#d8d8d8', price: 350 },
  smg: { name: 'VK-9 SMG', damage: 14, rate: 0.09, range: 380, ammo: 240, auto: true, color: '#3a3a3a', price: 900 },
  shotgun: { name: 'Breach-12', damage: 34, rate: 0.85, range: 260, ammo: 40, auto: false, color: '#7a4a2a', price: 1400 },
};

export const CAR_MODELS = [
  { name: 'Civic Dart', top: 330, accel: 260, grip: 3.4, len: 52, wid: 26 },
  { name: 'Harbor Taxi', top: 300, accel: 230, grip: 3.2, len: 54, wid: 27 },
  { name: 'Dune Runner', top: 360, accel: 300, grip: 3.0, len: 56, wid: 28 },
  { name: 'Quay Cruiser', top: 310, accel: 240, grip: 3.5, len: 58, wid: 28 },
  { name: 'Iron Hauler', top: 260, accel: 200, grip: 3.8, len: 64, wid: 30 },
  { name: 'Vela GT', top: 420, accel: 340, grip: 2.8, len: 54, wid: 26 },
];

export function createState() {
  return {
    mode: 'title', // title | play | pause | wasted | busted | complete
    time: 0, // seconds since boot
    clock: 8 * 60, // minutes of day, starts 08:00
    weather: 'clear', // clear | rain | haze
    rain: 0,
    player: {
      x: 1640, y: 1520, angle: -Math.PI / 2, speed: 0,
      hp: 100, armor: 0, cash: 250, onFoot: true, car: null, boat: null,
      weapon: 'fists', weapons: { fists: Infinity, pistol: 0, smg: 0, shotgun: 0 },
      owned: { fists: true, pistol: false, smg: false, shotgun: false },
      punchCd: 0, shootCd: 0, runStamina: 100, moving: false,
    },
    wanted: 0,
    heat: 0, // 0..100, decays; crossing thresholds raises stars
    missionIndex: 0,
    mission: null, // active mission runtime
    missionDone: [false, false, false, false, false, false, false],
    storyComplete: false,
    taxi: null, race: null, packagesGot: 0, jumpsDone: 0,
    event: null, // active random event
    cars: [], peds: [], cops: [], copCars: [], heli: null,
    bullets: [], particles: [], pickups: [], boats: [],
    roadblocks: [], blood: [],
    garage: { paint: '#c23b2e', armor: 0, engine: 0, owned: [] },
    stats: { kills: 0, carsStolen: 0, fares: 0, racesWon: 0, missionsDone: 0, cashEarned: 0, timePlayed: 0, shotsFired: 0 },
    banner: null, bannerT: 0,
    toast: null, toastT: 0,
    cam: { x: 1800, y: 1450, shake: 0 },
    mouse: { x: 0, y: 0, down: false, wx: 0, wy: 0 },
    keys: {},
    scene: null,
    muted: false,
  };
}

// Wanted star thresholds on the heat meter.
export function heatForStars(stars) { return [0, 18, 38, 58, 78, 92][stars] ?? 100; }
export function starsForHeat(heat) {
  if (heat >= 92) return 5;
  if (heat >= 78) return 4;
  if (heat >= 58) return 3;
  if (heat >= 38) return 2;
  if (heat >= 18) return 1;
  return 0;
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
// Deterministic hash-based pseudo random for city layout (stable world).
export function hashRand(ix, iy, salt = 0) {
  let h = (ix * 374761393 + iy * 668265263 + salt * 974634211) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
