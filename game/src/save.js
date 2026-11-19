// Port Almar — save: localStorage persistence for progress and stats.
// Saves on mission pass, safehouse sleep and every 30 seconds of play.
const KEY = 'port-almar-save-v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      cash: p.cash, hp: p.hp, armor: p.armor,
      weapons: p.weapons, owned: p.owned,
      missionIndex: G.missionIndex, missionDone: G.missionDone,
      packagesGot: G.packagesGot, jumpsDone: G.jumpsDone,
      garage: G.garage, stats: G.stats, clock: G.clock,
      px: p.x, py: p.y,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = G.player;
    p.cash = d.cash ?? 250;
    p.hp = d.hp ?? 100;
    p.armor = d.armor ?? 0;
    p.weapons = { fists: Infinity, pistol: 0, smg: 0, shotgun: 0, ...(d.weapons || {}) };
    p.owned = { fists: true, pistol: false, smg: false, shotgun: false, ...(d.owned || {}) };
    p.x = d.px ?? 1640;
    p.y = d.py ?? 1520;
    G.missionIndex = d.missionIndex ?? 0;
    G.missionDone = d.missionDone ?? [false, false, false, false, false, false, false];
    G.packagesGot = d.packagesGot ?? 0;
    G.jumpsDone = d.jumpsDone ?? 0;
    G.garage = { paint: '#c23b2e', armor: 0, engine: 0, owned: [], ...(d.garage || {}) };
    G.stats = { kills: 0, carsStolen: 0, fares: 0, racesWon: 0, missionsDone: 0, cashEarned: 0, timePlayed: 0, shotsFired: 0, ...(d.stats || {}) };
    G.clock = d.clock ?? 8 * 60;
    G.cam.x = p.x;
    G.cam.y = p.y;
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
