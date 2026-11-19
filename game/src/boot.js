// Port Almar — boot: input, camera, the frame loop, and the wiring
// between every system. The player walks, steals and drives cars,
// sails boats, fights, shops, and runs Selma Okafor's seven missions.
import { createState, clamp, dist2, angleTo, rand } from './state.js';
import { buildCity, drawCity, buildingAt, onRoad } from './city.js';
import { spawnTraffic, updateVehicles, drawVehicles, makeCar, makeBoat, addCash, showToast, showBanner, burst } from './vehicles.js';
import { spawnPeds, updatePeople, drawPeople } from './people.js';
import { tryShoot, tryPunch, updateBullets, drawCombat, updateParticles, setToastRef } from './combat.js';
import { MISSIONS, startMission, updateMissions, updateSideJobs, startTaxi } from './missions.js';
import { nearestShop, shopOpen, buyWeapon, repairCar, paintCar, tuneCar, buyCarFromDealer, eatMeal, sleepAtSafehouse, drawShops, drawPackages, dealerImports } from './economy.js';
import { AudioSys } from './audio.js';
import { drawHUD, showMenu, hideMenu, showShopMenu, hideShopMenu } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW = { w: 1280, h: 720 };

const G = createState();
window.__G = G; // debug handle: lets a test page read live state
const city = buildCity();
const audio = new AudioSys();
dealerImports.makeCar = makeCar;
setToastRef(showToast);

spawnTraffic(G, city, 22);
spawnPeds(G, 42);
// Boats moored at the marina.
for (let i = 0; i < 3; i++) G.boats.push(makeBoat(3420 + i * 12, 1960 + i * 90));
// Hidden packages glow on the map (drawn from the city list).

loadGame(G);
if (hasSave()) showToast(G, 'Save loaded — welcome back to Port Almar.');

// --- input ---------------------------------------------------------------
const input = { up: false, down: false, left: false, right: false, handbrake: false };
const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'handbrake' };

window.addEventListener('keydown', (e) => {
  if (keyMap[e.code] !== undefined) { input[keyMap[e.code]] = true; e.preventDefault(); }
  G.keys[e.code] = true;
  if (e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') onMissionKey();
  if (e.code === 'KeyT') startTaxi(G);
  if (e.code === 'KeyB') onShopKey();
  if (e.code === 'KeyE') onEnterKey();
  if (e.code === 'KeyF') tryPunch(G);
  if (e.code === 'Digit1') equipWeapon('fists');
  if (e.code === 'Digit2') equipWeapon('pistol');
  if (e.code === 'Digit3') equipWeapon('smg');
  if (e.code === 'Digit4') equipWeapon('shotgun');
  if (e.code === 'KeyR' && (G.mode === 'wasted' || G.mode === 'busted')) respawn();
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
  G.keys[e.code] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (VIEW.w / r.width);
  G.mouse.y = (e.clientY - r.top) * (VIEW.h / r.height);
  G.mouse.wx = G.cam.x + (G.mouse.x - VIEW.w / 2);
  G.mouse.wy = G.cam.y + (G.mouse.y - VIEW.h / 2);
});
canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (e.button !== 0) return;
  G.mouse.down = true;
  if (G.mode === 'play') {
    if (G.player.weapon === 'fists') tryPunch(G);
    else tryShoot(G, city);
  }
});
window.addEventListener('mouseup', () => { G.mouse.down = false; });
document.getElementById('menu-btn').addEventListener('click', () => {
  audio.ensure();
  onMenuButton();
});
document.getElementById('shop-close').addEventListener('click', hideShopMenu);
document.getElementById('shop-body').addEventListener('click', (e) => {
  const buy = e.target.closest('[data-buy]');
  const paint = e.target.closest('[data-paint]');
  const car = e.target.closest('[data-car]');
  if (buy) onShopBuy(buy.dataset.buy);
  if (paint) paintCar(G, paint.dataset.paint);
  if (car) buyCarFromDealer(G, Number(car.dataset.car));
});

function onMenuButton() {
  if (G.mode === 'title') {
    G.mode = 'play';
    hideMenu();
    showBanner(G, 'PORT ALMAR', 'Selma Okafor is waiting. Press M to start your first job.');
    audio.phone();
  } else if (G.mode === 'pause') {
    G.mode = 'play';
    hideMenu();
  } else if (G.mode === 'wasted' || G.mode === 'busted') {
    respawn();
  } else if (G.mode === 'complete') {
    G.mode = 'play';
    hideMenu();
  }
}

function respawn() {
  const p = G.player;
  if (G.mode === 'wasted') p.cash = Math.max(0, p.cash - 200);
  if (G.mode === 'busted') p.cash = Math.max(0, p.cash - 300);
  p.hp = 100;
  p.armor = 0;
  p.x = 320; p.y = 1660; // safehouse door, on the road
  p.onFoot = true; p.car = null; p.boat = null;
  G.heat = 0; G.wanted = 0;
  G.cops.length = 0; G.copCars.length = 0; G.heli = null;
  G.cam.x = p.x; G.cam.y = p.y;
  G.mode = 'play';
  hideMenu();
  saveGame(G);
}

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause';
    showMenu(G, 'pause');
    saveGame(G);
  } else if (G.mode === 'pause') {
    G.mode = 'play';
    hideMenu();
  }
}

function onMissionKey() {
  if (G.mode !== 'play') return;
  if (G.mission) { showToast(G, 'Mission already running — check the tracker.'); return; }
  if (G.missionIndex >= MISSIONS.length) { showToast(G, 'Story complete — free roam!'); return; }
  startMission(G, G.missionIndex);
  audio.phone();
}

function onShopKey() {
  if (G.mode !== 'play') return;
  const shop = nearestShop(G, city);
  if (!shop) { showToast(G, 'No shop nearby — look for the green rings on the minimap.'); return; }
  showShopMenu(G, city, shop);
  G.activeShop = shop;
}

function onShopBuy(kind) {
  const shop = G.activeShop;
  if (!shop) return;
  if (kind === 'pistol' || kind === 'smg' || kind === 'shotgun') buyWeapon(G, kind);
  else if (kind === 'repair') repairCar(G);
  else if (kind === 'armor') tuneCar(G, 'armor');
  else if (kind === 'engine') tuneCar(G, 'engine');
  else if (kind === 'meal') eatMeal(G);
  else if (kind === 'sleep') { sleepAtSafehouse(G); saveGame(G); }
  else if (kind === 'boat') {
    if (G.player.cash < 100) { showToast(G, 'Boat hire costs $100.'); return; }
    G.player.cash -= 100;
    const b = makeBoat(3440, 2050);
    b.rented = true;
    G.boats.push(b);
    showToast(G, 'Speedboat rented — it is waiting at the marina pier.');
  }
  if (shop) showShopMenu(G, city, shop);
}

function equipWeapon(key) {
  const p = G.player;
  if (!p.owned[key]) { showToast(G, `You do not own that yet — buy it at Harbor Arms.`); return; }
  p.weapon = key;
}

function onEnterKey() {
  if (G.mode !== 'play') return;
  const p = G.player;
  if (p.boat) {
    p.boat = null;
    p.onFoot = true;
    p.x = clamp(p.x - 60, 3180, 3360);
    showToast(G, 'You stepped ashore.');
    return;
  }
  if (!p.onFoot && p.car) {
    p.car = null;
    p.onFoot = true;
    p.x += 30;
    return;
  }
  // On foot: nearest car within reach.
  let best = null, bd = 80 * 80;
  for (const car of G.cars) {
    if (car.cop) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) {
    if (best.parked || Math.random() < 0.9) {
      p.car = best;
      p.onFoot = false;
      best.parked = false;
      G.stats.carsStolen++;
      G.heat = Math.min(100, G.heat + (best.parked ? 0 : 6));
      showToast(G, `You took the ${best.model.name}.`);
      audio.crash();
    }
    return;
  }
  // Near a moored boat?
  let boat = null, bd2 = 90 * 90;
  for (const b of G.boats) {
    const d = dist2(p.x, p.y, b.x, b.y);
    if (d < bd2) { bd2 = d; boat = b; }
  }
  if (boat) {
    p.boat = boat;
    p.onFoot = false;
    showToast(G, 'You are on the water. W/S to sail.');
  }
}

// --- on-foot movement ----------------------------------------------------
function updateOnFoot(G, city, dt) {
  const p = G.player;
  const run = G.keys.ShiftLeft || G.keys.ShiftRight;
  const sp = run ? 240 : 150;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    const nx = p.x + mx * sp * dt;
    const ny = p.y + my * sp * dt;
    if (!buildingAt(city, nx, p.y)) p.x = nx;
    if (!buildingAt(city, p.x, ny)) p.y = ny;
    p.x = clamp(p.x, 80, 3560);
    p.y = clamp(p.y, 80, 2760);
    p.angle = Math.atan2(G.mouse.wy - p.y, G.mouse.wx - p.x);
    p.moving = true;
    p.speed = sp;
  } else {
    p.moving = false;
    p.speed = 0;
    p.angle = Math.atan2(G.mouse.wy - p.y, G.mouse.wx - p.x);
  }
  // Auto-aim assist: face the mouse always on foot.
  if (G.mouse.down && G.player.weapon !== 'fists') {
    const w = G.player.weapon;
    if (w === 'smg') tryShoot(G, city);
  }
}

// --- the loop ------------------------------------------------------------
let last = performance.now();
let saveTimer = 0;
let sirenTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;

  if (G.mode === 'play') {
    G.stats.timePlayed += dt;
    // Clock: 1 game hour per 2 real minutes; weather drifts.
    G.clock = (G.clock + dt * 0.5) % (24 * 60);
    if (Math.random() < dt * 0.002) {
      G.weather = G.weather === 'clear' ? 'rain' : G.weather === 'rain' ? 'haze' : 'clear';
    }
    G.player.shootCd = Math.max(0, G.player.shootCd - dt);
    G.player.punchCd = Math.max(0, G.player.punchCd - dt);
    if (G.player.onFoot && !G.player.boat) updateOnFoot(G, city, dt);
    updateVehicles(G, city, dt, input);
    updatePeople(G, city, dt);
    updateBullets(G, city, dt);
    updateParticles(G, dt);
    updateMissions(G, city, dt);
    updateSideJobs(G, city, dt);
    // Package pickup sync with the city list.
    for (const pk of city.packages) {
      if (!pk.got && dist2(G.player.x, G.player.y, pk.x, pk.y) < 34 * 34) {
        pk.got = true;
        G.packagesGot++;
        addCash(G, 100);
        showToast(G, `Hidden package ${G.packagesGot}/28 — +$100.`);
        audio.pickup();
      }
    }
    // Engine hum while driving.
    if (G.player.car && Math.abs(G.player.car.speed) > 40 && Math.random() < dt * 6) audio.engine(Math.abs(G.player.car.speed));
    // Siren wail while wanted.
    sirenTimer -= dt;
    if (G.wanted > 0 && sirenTimer <= 0) { audio.siren(); sirenTimer = 2.2; }
    // Timers.
    if (G.bannerT > 0) G.bannerT -= dt;
    if (G.toastT > 0) G.toastT -= dt;
    // Camera follows the player with a little shake.
    const tx = G.player.x, ty = G.player.y;
    G.cam.x += (tx - G.cam.x) * Math.min(1, 6 * dt);
    G.cam.y += (ty - G.cam.y) * Math.min(1, 6 * dt);
    if (G.cam.shake > 0) G.cam.shake = Math.max(0, G.cam.shake - dt * 30);
    // Autosave.
    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; saveGame(G); }
    // End states reached from hurtPlayer.
    if (G.mode === 'wasted') { showMenu(G, 'wasted'); audio.missionFail(); }
    if (G.mode === 'busted') { showMenu(G, 'busted'); audio.missionFail(); }
    if (G.mode === 'complete') { showMenu(G, 'complete'); audio.missionPass(); saveGame(G); }
    audio.updateMusic(dt, G.wanted);
  }

  render();
}

function render() {
  const cam = {
    x: G.cam.x + (G.cam.shake > 0 ? rand(-G.cam.shake, G.cam.shake) : 0),
    y: G.cam.y + (G.cam.shake > 0 ? rand(-G.cam.shake, G.cam.shake) : 0),
  };
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  // World space: translate so the camera sits at screen centre.
  ctx.save();
  ctx.translate(VIEW.w / 2 - cam.x, VIEW.h / 2 - cam.y);
  drawCity(ctx, city, cam, VIEW, G.clock, G.weather);
  drawShops(ctx, city, G.clock, cam, VIEW);
  drawPackages(ctx, city);
  drawVehicles(ctx, G, cam, VIEW);
  drawPeople(ctx, G, cam, VIEW);
  drawPlayer(ctx, G);
  drawCombat(ctx, G);
  drawMarkerWorld(ctx, G);
  ctx.restore();
  drawMarkerArrow(ctx, G, cam);
  if (G.mode === 'play' || G.mode === 'pause') drawHUD(ctx, G, city, VIEW);
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot || p.boat) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Dario: teal jacket, dark jeans.
  ctx.fillStyle = '#0f7a6a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
  // Weapon in hand.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222831';
    ctx.fillRect(8, -2, p.weapon === 'shotgun' ? 20 : 14, 4);
  }
  ctx.restore();
  // Armor ring.
  if (p.armor > 0) {
    ctx.strokeStyle = 'rgba(122,184,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke();
  }
}

function markerTarget(G) {
  const m = G.mission;
  if (G.taxi) return { target: G.taxi.dest, color: '#ffd23a', label: 'FARE' };
  if (m) {
    const def = m.def;
    if (def.kind === 'race') {
      const gate = m.gates[m.gateIdx];
      return gate ? { target: gate, color: '#4ade80', label: `GATE ${m.gateIdx + 1}` } : null;
    }
    if (def.kind === 'hit' && m.stage === 1 && m.informant) return { target: m.informant, color: '#ff5a5a', label: 'TARGET' };
    const pt = m.stage === 0 ? def.target : def.drop;
    return pt ? { target: pt, color: '#4ade80', label: m.stage === 0 ? 'GO HERE' : 'DROP OFF' } : null;
  }
  if (G.missionIndex < MISSIONS.length) {
    return { target: MISSIONS[G.missionIndex].target, color: '#4ade80', label: 'NEXT JOB' };
  }
  return null;
}

function drawMarkerWorld(ctx, G) {
  // Objective marker diamond, drawn in world space (inside the camera translate).
  const found = markerTarget(G);
  if (!found) return;
  const { target, color, label } = found;
  const bob = Math.sin(performance.now() / 240) * 6;
  ctx.save();
  ctx.translate(target.x, target.y + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-10, -10, 20, 20);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-10, -10, 20, 20);
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, target.x, target.y - 28 + bob);
  ctx.textAlign = 'left';
}

function drawMarkerArrow(ctx, G, cam) {
  // Edge arrow, drawn in screen space after the camera translate is restored.
  const found = markerTarget(G);
  if (!found) return;
  const { target, color } = found;
  const dx = target.x - cam.x, dy = target.y - cam.y;
  if (Math.abs(dx) > VIEW.w / 2 - 40 || Math.abs(dy) > VIEW.h / 2 - 40) {
    const a = Math.atan2(dy, dx);
    const ex = VIEW.w / 2 + Math.cos(a) * (VIEW.w / 2 - 60);
    const ey = VIEW.h / 2 + Math.sin(a) * (VIEW.h / 2 - 60);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.hypot(dx, dy))}m`, ex, ey - 16);
    ctx.textAlign = 'left';
  }
}

// --- staged scenes + title ----------------------------------------------
const params = new URLSearchParams(location.search);
const scene = params.get('scene');
if (scene) {
  applyScene(G, city, scene);
} else {
  showMenu(G, 'title');
  if (hasSave()) {
    const btn = document.getElementById('menu-btn');
    if (btn) btn.textContent = 'CONTINUE';
  }
}

requestAnimationFrame(frame);
