// Port Almar — combat: fists, pistols, SMG, shotgun.
// The player aims with the mouse; bullets are simple tracers with
// spread, range and falloff. Hitting cops and peds raises heat, and
// every kill is counted in the stats the save file keeps.
import { WEAPONS, clamp, dist2, angleTo, rand } from './state.js';
import { buildingAt } from './city.js';
import { burst, addCash } from './vehicles.js';
import { hurtPlayer } from './people.js';

export function tryShoot(G, city) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.shootCd > 0 || p.weapon === 'fists') return;
  if ((p.weapons[p.weapon] ?? 0) <= 0) {
    p.weapon = 'fists';
    return;
  }
  p.shootCd = w.rate;
  p.weapons[p.weapon]--;
  G.stats.shotsFired++;
  const aim = angleTo(p.x, p.y, G.mouse.wx, G.mouse.wy);
  const spread = p.weapon === 'shotgun' ? 0.22 : p.weapon === 'smg' ? 0.09 : 0.03;
  const shots = p.weapon === 'shotgun' ? 5 : 1;
  for (let i = 0; i < shots; i++) {
    const a = aim + rand(-spread, spread);
    G.bullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 950, vy: Math.sin(a) * 950,
      life: w.range / 950, t: 0, dmg: w.damage, fromPlayer: true,
    });
  }
  G.cam.shake = Math.max(G.cam.shake, p.weapon === 'shotgun' ? 5 : 2);
  burst(G, p.x + Math.cos(aim) * 26, p.y + Math.sin(aim) * 26, '#ffd23a', 3);
  G.heat = Math.min(100, G.heat + (p.weapon === 'smg' ? 2 : 4));
}

export function tryPunch(G) {
  const p = G.player;
  if (p.punchCd > 0) return;
  p.punchCd = WEAPONS.fists.rate;
  const aim = angleTo(p.x, p.y, G.mouse.wx, G.mouse.wy);
  p.angle = aim;
  burst(G, p.x + Math.cos(aim) * 26, p.y + Math.sin(aim) * 26, '#fff', 3);
  const targets = [...G.peds.filter((q) => q.state !== 'down'), ...G.cops];
  for (const t of targets) {
    if (dist2(p.x, p.y, t.x, t.y) < 52 * 52) {
      hurtPed(G, t, WEAPONS.fists.damage, true);
      t.x += Math.cos(aim) * 14;
      t.y += Math.sin(aim) * 14;
    }
  }
  G.heat = Math.min(100, G.heat + 3);
}

export function updateBullets(G, city, dt) {
  for (const b of G.bullets) {
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (buildingAt(city, b.x, b.y)) {
      burst(G, b.x, b.y, '#c8c8c8', 4);
      b.t = b.life + 1;
      continue;
    }
    if (b.fromPlayer) {
      for (const ped of G.peds) {
        if (ped.state === 'down') continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
          hurtPed(G, ped, b.dmg, true);
          b.t = b.life + 1;
          break;
        }
      }
      if (b.t > b.life) continue;
      for (const cop of G.cops) {
        if (dist2(b.x, b.y, cop.x, cop.y) < 14 * 14) {
          cop.hp -= b.dmg;
          burst(G, b.x, b.y, '#ff3b30', 5);
          if (cop.hp <= 0) {
            const idx = G.cops.indexOf(cop);
            if (idx >= 0) G.cops.splice(idx, 1);
            G.stats.kills++;
            G.heat = Math.min(100, G.heat + 12);
            addCash(G, 40);
            showToastRef(G, 'Cop down — +$40 lifted.');
          }
          b.t = b.life + 1;
          break;
        }
      }
      if (b.t > b.life) continue;
      for (const cc of G.copCars) {
        if (dist2(b.x, b.y, cc.x, cc.y) < 30 * 30) {
          cc.hp -= b.dmg;
          burst(G, b.x, b.y, '#ffb03a', 5);
          if (cc.hp <= 0) {
            const idx = G.copCars.indexOf(cc);
            if (idx >= 0) G.copCars.splice(idx, 1);
            G.stats.kills++;
            G.heat = Math.min(100, G.heat + 15);
            burst(G, cc.x, cc.y, '#ff6a3a', 26);
          }
          b.t = b.life + 1;
          break;
        }
      }
    } else {
      // Enemy bullets (reserved for mission shooters) hit the player.
      const p = G.player;
      if (dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
        hurtPlayer(G, b.dmg, 'bullet');
        b.t = b.life + 1;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.t <= b.life);
}

function hurtPed(G, ped, dmg, byPlayer) {
  ped.hp -= dmg;
  burst(G, ped.x, ped.y, '#c22a2a', 6);
  if (ped.hp <= 0) {
    ped.state = 'down';
    if (byPlayer) {
      G.stats.kills++;
      G.heat = Math.min(100, G.heat + 8);
      if (Math.random() < 0.4) {
        addCash(G, 25);
        G.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: 25, t: 0 });
      }
    }
  } else {
    ped.state = 'flee';
    ped.scared = 4;
  }
}

export function drawCombat(ctx, G) {
  // Bullets as bright tracers.
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Cash / health pickups.
  for (const pk of G.pickups) {
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4a';
      ctx.fillRect(pk.x - 9, pk.y - 6, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 9, pk.y - 9, 18, 18);
      ctx.fillStyle = '#e23b3b';
      ctx.fillRect(pk.x - 2, pk.y - 7, 4, 14);
      ctx.fillRect(pk.x - 7, pk.y - 2, 14, 4);
    } else if (pk.kind === 'package') {
      ctx.fillStyle = '#ffd23a';
      ctx.save();
      ctx.translate(pk.x, pk.y + Math.sin(performance.now() / 300 + pk.x) * 3);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      ctx.fillStyle = '#7a5a00';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', pk.x, pk.y - 14);
    }
  }
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= (1 - 2 * dt);
    pt.vy *= (1 - 2 * dt);
  }
  G.particles = G.particles.filter((pt) => pt.t < pt.life);
  for (const pk of G.pickups) pk.t += dt;
  G.pickups = G.pickups.filter((pk) => pk.t < 25);
  // Player walks over pickups.
  const p = G.player;
  for (const pk of G.pickups) {
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      if (pk.kind === 'cash') addCash(G, pk.amount);
      if (pk.kind === 'health') p.hp = clamp(p.hp + 40, 0, 100);
      if (pk.kind === 'package') {
        G.packagesGot++;
        addCash(G, 100);
        G.stats.cashEarned += 100;
      }
      pk.t = 999;
    }
  }
  G.pickups = G.pickups.filter((pk) => pk.t < 25);
}

// Late-bound toast to avoid a people<->combat import cycle at load time.
let toastFn = null;
export function setToastRef(fn) { toastFn = fn; }
function showToastRef(G, msg) { if (toastFn) toastFn(G, msg); }
export { clamp };
