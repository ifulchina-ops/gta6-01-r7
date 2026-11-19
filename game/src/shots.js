// Port Almar — staged scenes for screenshots (?scene=...).
// Each scene drops the player into a real gameplay moment with the
// HUD, minimap, wanted stars and a mission banner all visible, then
// the game keeps running live underneath.
import { MISSIONS, startMission } from './missions.js';
import { makeCar, makeBoat, showBanner } from './vehicles.js';
import { makePed } from './people.js';
import { clamp } from './state.js';

export function applyScene(G, city, scene) {
  const p = G.player;
  G.scene = scene;
  G.mode = 'play';
  hideMenuDom();
  if (scene === 'heli') {
    // Police helicopter chase at 4 stars, player speeding in a Vela GT.
    G.clock = 17 * 60 + 40;
    G.weather = 'clear';
    p.x = 2080; p.y = 1520;
    const car = makeCar(2080, 1520, 5, '#c23b2e', { angle: 0 });
    car.speed = 330;
    G.cars.push(car);
    p.car = car; p.onFoot = false; p.angle = 0;
    p.cash = 4820;
    G.heat = 82;
    p.owned.pistol = true; p.weapons.pistol = 48; p.weapon = 'pistol';
    startMission(G, 6);
    G.mission.stage = 1;
    showBanner(G, 'THE LAST DELIVERY', 'Three stars and climbing. Drive to the safehouse — do not stop.');
    spawnCopPack(G, 3);
  } else if (scene === 'shootout') {
    // Mission shootout outside the Old Cannery warehouse, 2 stars.
    G.clock = 11 * 60 + 15;
    G.weather = 'clear';
    p.x = 520; p.y = 640; p.angle = 0.3;
    p.onFoot = true; p.car = null;
    p.cash = 2140; p.hp = 78; p.armor = 40;
    p.owned.smg = true; p.weapons.smg = 160; p.weapon = 'smg';
    p.owned.pistol = true; p.weapons.pistol = 60;
    G.heat = 42;
    startMission(G, 2);
    G.mission.stage = 1;
    showBanner(G, 'THE CANNERY JOB', 'Guards are on you. Get the crate to the garage.');
    for (let i = 0; i < 4; i++) {
      const g = makePed(420 + (i % 2) * 90 - 40, 560 + Math.floor(i / 2) * 80);
      g.shirt = '#222831'; g.state = 'flee'; g.scared = 9;
      G.peds.push(g);
    }
    const getaway = makeCar(640, 700, 2, '#3aa655', { angle: Math.PI / 2 });
    G.cars.push(getaway);
    G.bullets.push({ x: 520, y: 640, vx: 700, vy: 200, life: 0.4, t: 0, dmg: 0, fromPlayer: true });
    spawnCopPack(G, 1);
  } else if (scene === 'night') {
    // Night neon drive down the Dune Strip with a taxi fare active.
    G.clock = 21 * 60 + 30;
    G.weather = 'clear';
    p.x = 2520; p.y = 2320;
    const car = makeCar(2520, 2320, 5, '#2e6fc2', { angle: -Math.PI / 2 });
    car.speed = 300;
    G.cars.push(car);
    p.car = car; p.onFoot = false; p.angle = -Math.PI / 2;
    p.cash = 6310;
    G.heat = 0;
    G.taxi = { dest: { x: 1740, y: 420 }, fare: 240, t: 60 };
    p.owned.shotgun = true; p.weapons.shotgun = 24; p.weapon = 'shotgun';
    showBanner(G, 'NIGHT IN PORT ALMAR', 'Taxi fare: Glass Quay — $240. The strip never sleeps.');
  } else if (scene === 'race') {
    // Beach race: gates along Marina Verde, sunset, 1 star.
    G.clock = 18 * 60 + 10;
    G.weather = 'haze';
    p.x = 2620; p.y = 1920;
    const car = makeCar(2620, 1920, 2, '#e8c23a', { angle: 0 });
    car.speed = 340;
    G.cars.push(car);
    p.car = car; p.onFoot = false; p.angle = 0;
    p.cash = 3560;
    G.heat = 20;
    startMission(G, 4);
    G.mission.gateIdx = 2;
    showBanner(G, 'DUNE RUN — GATE 3/5', 'Beat the clock: 5 gates in 90 seconds.');
    // Rival racers alongside.
    const rival = makeCar(2620, 1850, 5, '#7a4a9a', { angle: 0 });
    rival.speed = 320;
    G.cars.push(rival);
    const rival2 = makeCar(2620, 1990, 0, '#e8e8e8', { angle: 0 });
    rival2.speed = 300;
    G.cars.push(rival2);
    // A boat out on the water for the extra-system read.
    const boat = makeBoat(3500, 2000);
    boat.speed = 200;
    G.boats.push(boat);
  }
  G.cam.x = p.x;
  G.cam.y = p.y;
  // Staged scenes keep their banner up for the screenshot.
  if (G.banner) G.bannerT = 999;
}

function spawnCopPack(G, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.5;
    const car = makeCar(
      G.player.x + Math.cos(a) * 420,
      G.player.y + Math.sin(a) * 420,
      0, '#1c2a44', { cop: true },
    );
    car.angle = Math.atan2(G.player.y - car.y, G.player.x - car.x);
    G.copCars.push(car);
    G.cars.push(car);
  }
}

function hideMenuDom() {
  const el = document.getElementById('menu');
  if (el) el.classList.add('hidden');
}
