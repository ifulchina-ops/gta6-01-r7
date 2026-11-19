// Port Almar — the city itself: roads, blocks, buildings, beach, docks.
// The world is a fixed grid of avenues and streets; buildings fill the
// blocks between them, each block tinted by its district. Everything is
// generated once from hashRand, so the map is identical every run.
import { WORLD_W, WORLD_H, ROAD_W, DISTRICTS, hashRand, clamp } from './state.js';

export const ROADS_X = [320, 760, 1200, 1640, 2080, 2520, 2960, 3360];
export const ROADS_Y = [320, 720, 1120, 1520, 1920, 2320, 2620];

export function buildCity() {
  const buildings = [];
  const palms = [];
  const containers = [];
  const cranes = [];
  // Beach strip along the east edge, water beyond it.
  const beach = { x: 3180, y: 0, w: WORLD_W - 3180, h: WORLD_H };
  const water = { x: 3400, y: 0, w: WORLD_W - 3400, h: WORLD_H };
  for (let bx = 0; bx < ROADS_X.length - 1; bx++) {
    for (let by = 0; by < ROADS_Y.length - 1; by++) {
      const x0 = ROADS_X[bx] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[by] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[by + 1] - ROAD_W / 2 - 14;
      if (x1 <= x0 || y1 <= y0) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      // Some blocks are parks, plazas or car parks instead of buildings.
      const roll = hashRand(bx, by, 7);
      if (roll < 0.12) {
        const n = 3 + Math.floor(hashRand(bx, by, 8) * 5);
        for (let i = 0; i < n; i++) {
          palms.push({ x: x0 + hashRand(bx, by, 20 + i) * (x1 - x0), y: y0 + hashRand(bx, by, 40 + i) * (y1 - y0) });
        }
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'park', district: district.name, tint: district.tint });
        continue;
      }
      if (roll < 0.2) {
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: 'lot', district: district.name, tint: district.tint });
        continue;
      }
      // Split a block into 1-4 buildings.
      const cols = (x1 - x0) > 260 ? 2 : 1;
      const rows = (y1 - y0) > 240 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
          const bx0 = x0 + c * bw + 6, by0 = y0 + r * bh + 6;
          const tall = district.name === 'Glass Quay' && hashRand(bx * 3 + c, by * 3 + r, 3) > 0.45;
          const kind = district.name === 'Old Cannery' || district.name === 'Ironworks Docks'
            ? (hashRand(bx + c, by + r, 5) > 0.5 ? 'warehouse' : 'factory')
            : district.name === 'Palmera Heights' ? 'house'
            : district.name === 'Marina Verde' ? 'hotel' : tall ? 'tower' : 'block';
          buildings.push({
            x: bx0, y: by0, w: bw - 12, h: bh - 12, kind, district: district.name,
            tint: district.tint, floors: kind === 'tower' ? 8 + Math.floor(hashRand(bx + c, by + r, 9) * 14)
              : kind === 'hotel' ? 4 + Math.floor(hashRand(bx + c, by + r, 9) * 4)
              : kind === 'house' ? 1 : 2 + Math.floor(hashRand(bx + c, by + r, 9) * 3),
            hue: hashRand(bx + c, by + r, 11),
          });
        }
      }
    }
  }
  // Dock containers + cranes in Ironworks Docks.
  for (let i = 0; i < 26; i++) {
    containers.push({
      x: 1560 + hashRand(i, 3, 1) * 880, y: 1160 + hashRand(i, 5, 2) * 420,
      w: 70 + hashRand(i, 7, 3) * 40, h: 26, color: ['#b3543a', '#3a6fb3', '#4a8a4a', '#c2a23a'][i % 4],
      angle: hashRand(i, 9, 4) > 0.5 ? 0 : Math.PI / 2,
    });
  }
  for (let i = 0; i < 3; i++) cranes.push({ x: 1700 + i * 320, y: 1180 });
  // Palm-lined boardwalk along the beach.
  for (let y = 120; y < WORLD_H - 100; y += 130) palms.push({ x: 3220 + hashRand(1, y, 6) * 60, y });

  const shops = [
    { name: "Harbor Arms", kind: 'weapons', x: 1740, y: 1060, open: 8, close: 22, blurb: 'Pistols, SMGs, ammo' },
    { name: "Okafor's Garage", kind: 'garage', x: 900, y: 1060, open: 7, close: 23, blurb: 'Repairs, paint, tuning' },
    { name: "Vela Motors", kind: 'cars', x: 2620, y: 660, open: 9, close: 20, blurb: 'Buy a car, skip the steal' },
    { name: 'Snack Shack', kind: 'food', x: 3060, y: 1860, open: 6, close: 24, blurb: 'Heal up — $15 a meal' },
    { name: 'Safehouse', kind: 'safehouse', x: 420, y: 1660, open: 0, close: 24, blurb: 'Sleep to save + heal' },
    { name: 'Bait & Boat Hire', kind: 'boats', x: 3300, y: 2050, open: 6, close: 19, blurb: 'Rent a speedboat' },
  ];
  const packages = [];
  for (let i = 0; i < 28; i++) {
    packages.push({
      x: 200 + hashRand(i, 11, 1) * (WORLD_W - 600), y: 200 + hashRand(i, 13, 2) * (WORLD_H - 600),
      got: false, id: i,
    });
  }
  const jumps = [
    { x: 2520, y: 1520, angle: 0, name: 'Quay Ramp' },
    { x: 1200, y: 2320, angle: Math.PI / 2, name: 'Dune Kicker' },
    { x: 2960, y: 720, angle: -Math.PI / 2, name: 'Tower Leap' },
  ];
  return {
    buildings, palms, containers, cranes, beach, water, shops, packages, jumps,
    marina: { x: 3260, y: 1900, w: 140, h: 700 },
    raceLoop: [
      { x: 2620, y: 1920 }, { x: 2960, y: 1920 }, { x: 2960, y: 2320 },
      { x: 2080, y: 2320 }, { x: 2080, y: 1920 },
    ],
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (b.kind === 'park' || b.kind === 'lot') continue;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}

export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e18;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry }; }
  }
  return best;
}

// --- drawing -------------------------------------------------------------
export function drawCity(ctx, city, cam, view, clock, weather) {
  const night = clock < 6 * 60 || clock >= 19 * 60;
  const dusk = (clock >= 17 * 60 && clock < 19 * 60) || (clock >= 6 * 60 && clock < 7 * 60);
  // Ground: grass base.
  ctx.fillStyle = night ? '#1d2b1e' : dusk ? '#4a5a3a' : '#6f9a52';
  ctx.fillRect(cam.x - view.w / 2 - 40, cam.y - view.h / 2 - 40, view.w + 80, view.h + 80);
  // Beach sand + water (east edge).
  ctx.fillStyle = night ? '#6a5f42' : '#e8cf8f';
  ctx.fillRect(Math.max(city.beach.x, cam.x - view.w / 2), cam.y - view.h / 2, city.beach.w, view.h);
  ctx.fillStyle = night ? '#0d2436' : '#2f7fb3';
  ctx.fillRect(Math.max(city.water.x, cam.x - view.w / 2), cam.y - view.h / 2, city.water.w, view.h);
  // Water shimmer lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const t = performance.now() / 900;
  for (let i = 0; i < 6; i++) {
    const wy = cam.y - view.h / 2 + ((i * 173 + t * 40) % (view.h + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(city.water.x + 10, wy);
    ctx.lineTo(city.water.x + 120, wy + Math.sin(t + i) * 6);
    ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = night ? '#23262c' : '#3c3f46';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, cam.y - view.h / 2 - 40, ROAD_W, view.h + 80);
  for (const ry of ROADS_Y) ctx.fillRect(cam.x - view.w / 2 - 40, ry - ROAD_W / 2, view.w + 80, ROAD_W);
  // Lane dashes.
  ctx.strokeStyle = night ? '#8a8a5a' : '#e8d44a';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx, cam.y - view.h / 2); ctx.lineTo(rx, cam.y + view.h / 2); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(cam.x - view.w / 2, ry); ctx.lineTo(cam.x + view.w / 2, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    if (rx < cam.x - view.w / 2 - 120 || rx > cam.x + view.w / 2 + 120) continue;
    if (ry < cam.y - view.h / 2 - 120 || ry > cam.y + view.h / 2 + 120) continue;
    for (let i = -2; i <= 2; i++) ctx.fillRect(rx - 34 + i * 15, ry - 52, 8, 104);
  }
  // Buildings.
  for (const b of city.buildings) {
    if (b.x > cam.x + view.w / 2 + 60 || b.x + b.w < cam.x - view.w / 2 - 60) continue;
    if (b.y > cam.y + view.h / 2 + 60 || b.y + b.h < cam.y - view.h / 2 - 60) continue;
    if (b.kind === 'park') {
      ctx.fillStyle = night ? '#23401f' : '#4d8a3f';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      continue;
    }
    if (b.kind === 'lot') {
      ctx.fillStyle = night ? '#2c2c30' : '#565660';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let px = b.x + 20; px < b.x + b.w - 20; px += 44) { ctx.beginPath(); ctx.moveTo(px, b.y + 10); ctx.lineTo(px, b.y + b.h - 10); ctx.stroke(); }
      continue;
    }
    // Shadow + body.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    const base = shadeFor(b);
    ctx.fillStyle = night ? darken(base) : base;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof edge.
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Windows: lit at night, dark by day.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const lit = night ? hashRand(cx + b.x, cy + b.y, 2) > 0.45 : hashRand(cx + b.x, cy + b.y, 2) > 0.85;
        ctx.fillStyle = lit ? (dusk ? '#ffca6a' : '#ffd98a') : 'rgba(20,30,45,0.75)';
        ctx.fillRect(b.x + 8 + cx * ((b.w - 16) / cols), b.y + 8 + cy * ((b.h - 16) / rows), 12, 12);
      }
    }
    if (b.kind === 'tower') {
      ctx.fillStyle = night ? '#ff5a7a' : '#c23b4a';
      ctx.fillRect(b.x + b.w / 2 - 3, b.y - 14, 6, 14);
    }
  }
  // Containers + cranes.
  for (const c of city.containers) {
    if (c.x < cam.x - view.w / 2 - 100 || c.x > cam.x + view.w / 2 + 100) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  for (const cr of city.cranes) {
    ctx.strokeStyle = '#d8a23a';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cr.x, cr.y + 60); ctx.lineTo(cr.x, cr.y - 90); ctx.lineTo(cr.x + 130, cr.y - 90); ctx.stroke();
    ctx.fillStyle = '#d8a23a';
    ctx.fillRect(cr.x - 14, cr.y + 50, 28, 14);
  }
  // Palms.
  for (const p of city.palms) {
    if (p.x < cam.x - view.w / 2 - 40 || p.x > cam.x + view.w / 2 + 40) continue;
    if (p.y < cam.y - view.h / 2 - 40 || p.y > cam.y + view.h / 2 + 40) continue;
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 22); ctx.stroke();
    ctx.fillStyle = night ? '#2a5a2a' : '#3f8a3f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + 4 + Math.cos(a) * 12, p.y - 24 + Math.sin(a) * 8, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Marina piers.
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(city.marina.x, city.marina.y, 14, city.marina.h);
  ctx.fillRect(city.marina.x + 60, city.marina.y, 14, city.marina.h);
  // District name labels on the ground, kept faint so they never fight the HUD.
  ctx.fillStyle = night ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) {
    const lx = d.x + d.w / 2, ly = d.y + d.h / 2;
    if (Math.abs(lx - cam.x) < view.w / 2 + 200 && Math.abs(ly - cam.y) < view.h / 2 + 200) {
      ctx.fillText(d.name.toUpperCase(), lx, ly);
    }
  }
  // Night / dusk tint + streetlight pools.
  if (night) {
    ctx.fillStyle = 'rgba(8,12,40,0.34)';
    ctx.fillRect(cam.x - view.w / 2, cam.y - view.h / 2, view.w, view.h);
  } else if (dusk) {
    ctx.fillStyle = 'rgba(255,120,40,0.10)';
    ctx.fillRect(cam.x - view.w / 2, cam.y - view.h / 2, view.w, view.h);
  }
  if (weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,220,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const rx = cam.x - view.w / 2 + ((i * 97 + performance.now() / 6) % view.w);
      const ry = cam.y - view.h / 2 + ((i * 61 + performance.now() / 3) % view.h);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 18); ctx.stroke();
    }
  }
}

function shadeFor(b) {
  const palettes = {
    tower: ['#5a7a9a', '#6a8aaa', '#4a6a8a', '#7a9ab5'],
    block: ['#b08a6a', '#9a7a5a', '#c09a7a', '#8a6a8a'],
    house: ['#d8b08a', '#c2a07a', '#e0c09a', '#b08a7a'],
    hotel: ['#e8d8a0', '#d8c88a', '#f0e0b0'],
    warehouse: ['#8a7a6a', '#7a6a5a', '#9a8a7a'],
    factory: ['#6a6a72', '#7a6a5a', '#5a5a62'],
  };
  const p = palettes[b.kind] || palettes.block;
  return p[Math.floor(b.hue * p.length) % p.length];
}

function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * 0.55);
  const g = Math.floor(((n >> 8) & 255) * 0.55);
  const b = Math.floor((n & 255) * 0.6);
  return `rgb(${r},${g},${b})`;
}
export { clamp };
