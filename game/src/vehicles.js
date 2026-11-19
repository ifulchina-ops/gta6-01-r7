// Port Almar — vehicles: player driving, traffic AI, boats.
// Cars are simple arcade physics: heading, speed, steering that bites
// harder at low speed. Traffic cars follow the road grid and stop for
// each other; boats glide on the water east of the beach.
import { CAR_MODELS, clamp, rand, pick, dist2 } from './state.js';
import { ROADS_X, ROADS_Y, onRoad, buildingAt, nearestRoadPoint } from './city.js';

const TRAFFIC_COLORS = ['#c23b2e', '#2e6fc2', '#e8c23a', '#3aa655', '#e8e8e8', '#7a4a9a', '#222831', '#d97a2a'];

export function makeCar(x, y, modelIdx, color, opts = {}) {
  const m = CAR_MODELS[modelIdx ?? Math.floor(Math.random() * CAR_MODELS.length)];
  return {
    x, y, angle: opts.angle ?? 0, speed: 0, model: m, color: color ?? pick(TRAFFIC_COLORS),
    hp: 100, smoke: 0, traffic: !!opts.traffic, cop: !!opts.cop,
    route: opts.route ?? null, routeIdx: 0, wait: 0, honk: 0,
    target: opts.target ?? null, parked: !!opts.parked, id: Math.random().toString(36).slice(2, 8),
  };
}

export function makeBoat(x, y) {
  return { x, y, angle: -Math.PI / 2, speed: 0, len: 64, wid: 24, hp: 100, color: '#e8f2f5', rented: false };
}

export function spawnTraffic(G, city, n) {
  for (let i = 0; i < n; i++) {
    const rx = pick(ROADS_X);
    const ry = pick(ROADS_Y);
    const horizontal = Math.random() > 0.5;
    const x = horizontal ? rand(200, 3100) : rx;
    const y = horizontal ? ry : rand(200, 2600);
    const car = makeCar(x, y, undefined, undefined, { traffic: true, angle: horizontal ? (Math.random() > 0.5 ? 0 : Math.PI) : (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2) });
    car.route = buildRoute(x, y);
    G.cars.push(car);
  }
  // Parked cars near shops and along the strip.
  const spots = [[1740, 1140], [900, 1140], [2620, 740], [3060, 1940], [420, 1740], [2080, 2000], [1200, 1200]];
  for (const [sx, sy] of spots) {
    G.cars.push(makeCar(sx + rand(-30, 30), sy + rand(-20, 20), Math.floor(rand(0, CAR_MODELS.length)), undefined, { parked: true, angle: rand(0, Math.PI * 2) }));
  }
}

function buildRoute(x, y) {
  const pts = [];
  let cx = x, cy = y;
  for (let i = 0; i < 8; i++) {
    if (Math.random() > 0.5) cx = pick(ROADS_X);
    else cy = pick(ROADS_Y);
    pts.push({ x: cx, y: cy });
  }
  return pts;
}

export function updateVehicles(G, city, dt, input) {
  const p = G.player;
  // --- player car ---
  if (!p.onFoot && p.car) {
    const car = p.car;
    const m = car.model;
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const engineBoost = 1 + G.garage.engine * 0.15;
    car.speed += fwd * m.accel * engineBoost * dt;
    car.speed -= car.speed * 0.9 * dt;
    if (input.handbrake) car.speed *= (1 - 2.2 * dt);
    car.speed = clamp(car.speed, -m.top * 0.45, m.top * (car.hp < 30 ? 0.55 : 1));
    if (car.hp <= 0) damageCar(G, car, 0); // wrecked by cop rams: player is out on foot
    const grip = m.grip * (input.handbrake ? 0.55 : 1);
    car.angle += steer * grip * dt * clamp(Math.abs(car.speed) / 90, 0, 1) * Math.sign(car.speed || 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (nx < 100 || nx > 3380 || ny < 100 || ny > 2700) {
      car.speed *= 0.4; // beach, water and the city edge stop the car
    } else if (!buildingAt(city, nx, ny)) { car.x = nx; car.y = ny; }
    else {
      car.speed *= -0.25;
      damageCar(G, car, 6);
      G.cam.shake = Math.max(G.cam.shake, 5);
    }
    if (car.hp < 45) car.smoke = Math.min(1, car.smoke + dt * 0.3);
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    // Stunt jump ramps.
    for (const j of city.jumps) {
      if (dist2(car.x, car.y, j.x, j.y) < 60 * 60 && Math.abs(car.speed) > 240) {
        car.speed *= 1.15;
        addCash(G, 0);
        G.jumpsDone++;
        showToast(G, `STUNT JUMP — ${j.name}! +$50`);
        addCash(G, 50);
        G.stats.cashEarned += 50;
        j.x += 100000; // one-shot per ramp per session
        burst(G, car.x, car.y, '#ffd23a', 18);
      }
    }
    if (Math.abs(car.speed) > 200 && onRoad(car.x, car.y)) G.heat = Math.min(100, G.heat + dt * 0.15);
  }
  // --- player boat ---
  if (p.boat) {
    const b = p.boat;
    const fwd = (input.up ? 1 : 0) - (input.down ? 0.6 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    b.speed += fwd * 220 * dt;
    b.speed -= b.speed * 0.6 * dt;
    b.speed = clamp(b.speed, -120, 380);
    b.angle += steer * 2.2 * dt * clamp(Math.abs(b.speed) / 80, 0, 1) * Math.sign(b.speed || 1);
    b.x = clamp(b.x + Math.cos(b.angle) * b.speed * dt, 3400, 3580);
    b.y = clamp(b.y + Math.sin(b.angle) * b.speed * dt, 40, 2760);
    p.x = b.x; p.y = b.y; p.angle = b.angle;
    if (Math.random() < dt * 8) G.particles.push({ x: b.x - Math.cos(b.angle) * 30, y: b.y - Math.sin(b.angle) * 30, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.5, t: 0, color: '#bfe8ff', size: 4 });
  }
  // --- traffic ---
  for (const car of G.cars) {
    if (car === p.car || car.parked || car.cop) continue;
    if (!car.route || car.route.length === 0) car.route = buildRoute(car.x, car.y);
    const tgt = car.route[car.routeIdx % car.route.length];
    const dx = tgt.x - car.x, dy = tgt.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) { car.routeIdx++; continue; }
    const want = Math.atan2(dy, dx);
    let da = want - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += clamp(da, -2.4 * dt, 2.4 * dt);
    // Stop for a car ahead.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car) continue;
      const ox = other.x - car.x, oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 30) { blocked = true; break; }
    }
    const targetSpeed = blocked ? 0 : 150;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 100 || car.x > 3300 || car.y < 100 || car.y > 2700) {
      car.route = buildRoute(car.x, car.y);
      car.x = clamp(car.x, 120, 3280); car.y = clamp(car.y, 120, 2680);
    }
  }
  // Car-car collisions (player vs traffic): shove + damage + sparks.
  if (p.car) {
    const pc = p.car;
    for (const other of G.cars) {
      if (other === pc || other.parked) continue;
      const d2 = dist2(pc.x, pc.y, other.x, other.y);
      if (d2 < 58 * 58) {
        const a = Math.atan2(other.y - pc.y, other.x - pc.x);
        other.x += Math.cos(a) * 30; other.y += Math.sin(a) * 30;
        other.speed = 40;
        damageCar(G, pc, 2);
        damageCar(G, other, 8);
        if (Math.abs(pc.speed) > 250) {
          G.heat = Math.min(100, G.heat + 3);
          burst(G, other.x, other.y, '#ffb03a', 10);
        }
      }
    }
  }
}

export function damageCar(G, car, amt) {
  car.hp = Math.max(0, car.hp - amt);
  if (car.hp <= 0 && car === G.player.car) {
    burst(G, car.x, car.y, '#ff6a3a', 30);
    G.player.car = null;
    G.player.onFoot = true;
    showToast(G, 'Your car is wrecked — walk it off.');
  }
}

export function drawVehicles(ctx, G, cam, view) {
  for (const car of G.cars) {
    if (Math.abs(car.x - cam.x) > view.w / 2 + 90 || Math.abs(car.y - cam.y) > view.h / 2 + 90) continue;
    drawCar(ctx, car);
  }
  for (const b of G.boats) {
    if (Math.abs(b.x - cam.x) > view.w / 2 + 90 || Math.abs(b.y - cam.y) > view.h / 2 + 90) continue;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    roundRect(ctx, -b.len / 2, -b.wid / 2, b.len, b.wid, 10);
    ctx.fill();
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(-8, -8, 22, 16);
    ctx.restore();
  }
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -car.model.len / 2 + 4, -car.model.wid / 2 + 5, car.model.len, car.model.wid, 8);
  ctx.fill();
  ctx.fillStyle = car.cop ? '#1c2a44' : car.color;
  roundRect(ctx, -car.model.len / 2, -car.model.wid / 2, car.model.len, car.model.wid, 8);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = car.cop ? '#d8e8ff' : '#20242c';
  roundRect(ctx, -6, -car.model.wid / 2 + 4, 18, car.model.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(car.model.len / 2 - 12, -car.model.wid / 2 + 5, 4, car.model.wid - 10);
  // Headlights.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(car.model.len / 2 - 2, -car.model.wid / 2 + 3, 3, 5);
  ctx.fillRect(car.model.len / 2 - 2, car.model.wid / 2 - 8, 3, 5);
  if (car.cop) {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-14, -car.model.wid / 2 - 2, 10, 5);
    ctx.fillStyle = '#2f7bff';
    ctx.fillRect(-14, car.model.wid / 2 - 3, 10, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // Damage smoke.
  if (car.hp < 45) {
    ctx.fillStyle = `rgba(80,80,80,${0.5 - car.hp / 100})`;
    ctx.beginPath();
    ctx.arc(-car.model.len / 2 + Math.random() * 8, (Math.random() - 0.5) * 10, 7 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar over the player's car.
  if (car.hp < 100 && car.hp > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(car.x - 26, car.y - car.model.wid / 2 - 14, 52, 5);
    ctx.fillStyle = car.hp > 50 ? '#4ade80' : '#f87171';
    ctx.fillRect(car.x - 26, car.y - car.model.wid / 2 - 14, 52 * (car.hp / 100), 5);
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function burst(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({ x, y, vx: Math.cos(a) * rand(40, 220), vy: Math.sin(a) * rand(40, 220), life: rand(0.3, 0.8), t: 0, color, size: rand(2, 5) });
  }
}

export function addCash(G, n) {
  G.player.cash += n;
  if (n > 0) G.stats.cashEarned += n;
}

export function showToast(G, msg) {
  G.toast = msg;
  G.toastT = 3;
}

export function showBanner(G, msg, sub) {
  G.banner = { msg, sub: sub || '' };
  G.bannerT = 3.5;
}
