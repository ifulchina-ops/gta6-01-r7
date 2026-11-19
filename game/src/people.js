// Port Almar — people: pedestrians, foot cops, cop cars, roadblocks,
// and the police helicopter that circles at four stars and above.
// Pedestrians stroll the sidewalks, flee gunfire, and cross streets;
// the wanted system escalates who hunts the player and how.
import { clamp, rand, pick, dist2, angleTo, starsForHeat, heatForStars } from './state.js';
import { ROADS_X, ROADS_Y, onRoad, nearestRoadPoint } from './city.js';
import { makeCar, burst, showToast, showBanner } from './vehicles.js';

const PED_COLORS = ['#e8a06a', '#c27a4a', '#8a5a3a', '#f2c89b', '#a06a4a'];
const SHIRTS = ['#d94a4a', '#4a7ad9', '#4ad97a', '#d9c24a', '#9a4ad9', '#e8e8e8', '#3a3a3a', '#ff8a3a'];

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const x = rand(150, 3150), y = rand(150, 2650);
    G.peds.push(makePed(x, y));
  }
}

export function makePed(x, y) {
  return {
    x, y, angle: rand(0, Math.PI * 2), speed: rand(28, 55),
    skin: pick(PED_COLORS), shirt: pick(SHIRTS),
    state: 'walk', // walk | flee | panic | down
    tx: x, ty: y, retarget: rand(2, 6), scared: 0, hp: 30,
  };
}

export function updatePeople(G, city, dt) {
  const p = G.player;
  // --- pedestrians ---
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    ped.retarget -= dt;
    const playerNear = dist2(ped.x, ped.y, p.x, p.y) < 260 * 260;
    const gunfire = G.bullets.length > 0 && dist2(ped.x, ped.y, p.x, p.y) < 420 * 420;
    if ((playerNear && p.speed > 200 && !p.onFoot) || gunfire) {
      ped.state = 'flee';
      ped.scared = 3;
    }
    if (ped.scared > 0) {
      ped.scared -= dt;
      if (ped.scared <= 0) ped.state = 'walk';
    }
    if (ped.retarget <= 0 || dist2(ped.x, ped.y, ped.tx, ped.ty) < 24 * 24) {
      if (ped.state === 'flee') {
        const a = angleTo(p.x, p.y, ped.x, ped.y);
        ped.tx = ped.x + Math.cos(a) * rand(200, 400);
        ped.ty = ped.y + Math.sin(a) * rand(200, 400);
      } else {
        // Stroll along the nearest road, on the sidewalk edge.
        const rp = nearestRoadPoint(ped.x, ped.y);
        ped.tx = clamp(rp.x + rand(-140, 140), 120, 3160);
        ped.ty = clamp(rp.y + rand(-140, 140), 120, 2660);
      }
      ped.retarget = rand(3, 8);
    }
    const want = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    let da = want - ped.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    ped.angle += clamp(da, -3 * dt, 3 * dt);
    const sp = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
    ped.x = clamp(ped.x + Math.cos(ped.angle) * sp * dt, 100, 3300);
    ped.y = clamp(ped.y + Math.sin(ped.angle) * sp * dt, 100, 2700);
  }
  // Keep the crowd topped up near the player.
  if (G.peds.filter((q) => q.state !== 'down').length < 26) {
    G.peds.push(makePed(p.x + rand(-500, 500), p.y + rand(-400, 400)));
  }
  // --- wanted decay + escalation ---
  const stars = starsForHeat(G.heat);
  if (stars !== G.wanted) {
    G.wanted = stars;
    if (!G.scene) {
      if (stars > 0) showBanner(G, `WANTED — ${stars} STAR${stars > 1 ? 'S' : ''}`, stars >= 3 ? 'Roadblocks ahead. Lose the heat!' : 'The Almar PD is on you.');
      if (stars === 0) showToast(G, 'You lost the cops. Heat is off.');
    }
  }
  if (G.wanted === 0) G.heat = Math.max(0, G.heat - dt * 4);
  else G.heat = Math.max(heatForStars(G.wanted), G.heat - dt * 0.8);
  updatePolice(G, city, dt);
  updateHeli(G, dt);
}

function updatePolice(G, city, dt) {
  const p = G.player;
  const stars = G.wanted;
  // Foot cops: spawn up to 1 + stars, chase on foot, punch / arrest.
  const wantCops = stars === 0 ? 0 : Math.min(2 + stars, 7);
  while (G.cops.length < wantCops) {
    const a = rand(0, Math.PI * 2);
    G.cops.push({
      x: clamp(p.x + Math.cos(a) * rand(380, 520), 100, 3300),
      y: clamp(p.y + Math.sin(a) * rand(380, 520), 100, 2700),
      angle: 0, speed: 150 + stars * 12, hp: 60, punchCd: 0, state: 'chase',
    });
  }
  if (stars === 0) G.cops.length = 0;
  for (const cop of G.cops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    if (d > 34) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    } else if (p.onFoot) {
      cop.punchCd -= dt;
      if (cop.punchCd <= 0) {
        cop.punchCd = 0.8;
        hurtPlayer(G, 8, 'cop');
      }
    }
    // Busted: a cop stands next to you on foot with no weapon drawn.
    if (d < 30 && p.onFoot && p.weapon === 'fists' && stars <= 2) {
      G.bustedBy = 'foot';
      G.mode = 'busted';
    }
  }
  // Cop cars from 2 stars: ram the player's car, or chase on foot targets.
  const wantCars = stars >= 2 ? Math.min(stars - 1, 4) : 0;
  while (G.copCars.length < wantCars) {
    const a = rand(0, Math.PI * 2);
    const car = makeCar(
      clamp(p.x + Math.cos(a) * rand(500, 700), 150, 3200),
      clamp(p.y + Math.sin(a) * rand(500, 700), 150, 2600),
      0, '#1c2a44', { cop: true, angle: angleTo(0, 0, 0, 0) },
    );
    car.angle = angleTo(car.x, car.y, p.x, p.y);
    G.copCars.push(car);
  }
  if (stars < 2) G.copCars.length = 0;
  for (const cc of G.copCars) {
    const d = Math.hypot(p.x - cc.x, p.y - cc.y);
    if (d > 900) {
      cc.x = p.x + rand(-500, 500);
      cc.y = p.y + rand(-500, 500);
    }
    const want = angleTo(cc.x, cc.y, p.x, p.y);
    let da = want - cc.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    cc.angle += clamp(da, -3 * dt, 3 * dt);
    const sp = d > 120 ? 340 : 200;
    cc.x += Math.cos(cc.angle) * sp * dt;
    cc.y += Math.sin(cc.angle) * sp * dt;
    // Ram damage to the player's car.
    if (p.car && dist2(cc.x, cc.y, p.car.x, p.car.y) < 56 * 56) {
      p.car.hp = Math.max(0, p.car.hp - 5 * dt);
      G.cam.shake = Math.max(G.cam.shake, 4);
      if (Math.random() < dt * 4) burst(G, cc.x, cc.y, '#ffb03a', 4);
    }
  }
  // Roadblocks from 3 stars: two cop cars parked across the road ahead.
  if (stars >= 3 && G.roadblocks.length === 0) {
    const rp = nearestRoadPoint(p.x + Math.cos(p.angle) * 500, p.y + Math.sin(p.angle) * 500);
    for (let i = -1; i <= 1; i += 2) {
      const car = makeCar(rp.x + i * 40, rp.y, 0, '#1c2a44', { cop: true, parked: true });
      G.roadblocks.push(car);
      G.cars.push(car);
    }
    showToast(G, 'ROADBLOCK ahead — find another route!');
  }
  if (stars < 3) {
    for (const rb of G.roadblocks) {
      const idx = G.cars.indexOf(rb);
      if (idx >= 0) G.cars.splice(idx, 1);
    }
    G.roadblocks.length = 0;
  }
}

function updateHeli(G, dt) {
  const p = G.player;
  if (G.wanted >= 4) {
    if (!G.heli) {
      G.heli = { x: p.x - 300, y: p.y - 300, angle: 0, orbit: 0, searchlight: 0 };
      if (!G.scene) showBanner(G, 'POLICE HELICOPTER', 'It can see you anywhere. Break line of sight!');
    }
    const h = G.heli;
    h.orbit += dt * 0.5;
    const tx = p.x + Math.cos(h.orbit) * 220;
    const ty = p.y + Math.sin(h.orbit) * 220;
    h.x += (tx - h.x) * Math.min(1, 2 * dt);
    h.y += (ty - h.y) * Math.min(1, 2 * dt);
    h.angle = angleTo(h.x, h.y, p.x, p.y);
    // The spotlight pins you: heat stops decaying while it watches.
    if (Math.hypot(p.x - h.x, p.y - h.y) < 320) G.heat = Math.max(G.heat, heatForStars(4));
    h.searchlight = (h.searchlight + dt) % 1;
  } else {
    G.heli = null;
  }
}

export function hurtPlayer(G, dmg, src) {
  const p = G.player;
  if (G.mode !== 'play') return;
  let left = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  G.cam.shake = Math.max(G.cam.shake, 6);
  burst(G, p.x, p.y, '#ff3b30', 6);
  if (p.hp <= 0) {
    p.hp = 0;
    G.mode = src === 'cop' && G.wanted <= 2 ? 'busted' : 'wasted';
  }
}

export function drawPeople(ctx, G, cam, view) {
  // Pedestrians.
  for (const ped of G.peds) {
    if (Math.abs(ped.x - cam.x) > view.w / 2 + 40 || Math.abs(ped.y - cam.y) > view.h / 2 + 40) continue;
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(120,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 16);
    }
  }
  // Foot cops.
  for (const cop of G.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1c2a44';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8e8ff';
    ctx.fillRect(-8, -3, 6, 6);
    ctx.restore();
  }
  // Cop cars are drawn by the vehicle renderer; roadblocks too.
  // Helicopter + searchlight cone.
  if (G.heli) {
    const h = G.heli;
    const grad = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.34)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(h.x, h.y, 260, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    ctx.fillStyle = '#4a5f8a';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#9ad1ff';
    ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    const rotor = (performance.now() / 40) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * 34, Math.sin(rotor) * 10);
    ctx.lineTo(-Math.cos(rotor) * 34, -Math.sin(rotor) * 10);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALMAR PD AIR-1', h.x, h.y - 34);
  }
}
