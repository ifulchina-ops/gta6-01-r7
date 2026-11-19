// Port Almar — economy: cash, shops with opening hours, the garage,
// the safehouse, and car buying. Shops close at night — check the
// clock before you drive across town for a gun.
import { WEAPONS, clamp } from './state.js';
import { addCash, showToast, showBanner, burst } from './vehicles.js';

export function shopOpen(shop, clockMin) {
  const h = Math.floor(clockMin / 60);
  return h >= shop.open && h < shop.close;
}

export function nearestShop(G, city, maxDist = 130) {
  const p = G.player;
  let best = null, bd = maxDist * maxDist;
  for (const s of city.shops) {
    const d = (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function shopHoursText(shop, clockMin) {
  const h = Math.floor(clockMin / 60);
  const open = shopOpen(shop, clockMin);
  return open ? `OPEN until ${shop.close}:00` : `CLOSED — opens ${shop.open}:00 (now ${h}:00)`;
}

export function buyWeapon(G, key) {
  const p = G.player;
  const w = WEAPONS[key];
  if (!w || !w.price) return false;
  if (p.owned[key]) {
    // Top up ammo instead.
    const ammoPrice = Math.floor(w.price / 4);
    if (p.cash < ammoPrice) { showToast(G, 'Not enough cash for ammo.'); return false; }
    p.cash -= ammoPrice;
    p.weapons[key] += w.ammo;
    showToast(G, `${w.name} ammo +${w.ammo} — $${ammoPrice}.`);
    return true;
  }
  if (p.cash < w.price) { showToast(G, `Need $${w.price} for the ${w.name}.`); return false; }
  p.cash -= w.price;
  p.owned[key] = true;
  p.weapons[key] = w.ammo;
  p.weapon = key;
  showToast(G, `Bought ${w.name} — $${w.price}. Press ${key === 'pistol' ? '2' : key === 'smg' ? '3' : '4'} to equip.`);
  return true;
}

export function repairCar(G) {
  const p = G.player;
  if (!p.car) { showToast(G, 'Bring a car into the garage to repair it.'); return false; }
  const missing = 100 - p.car.hp;
  if (missing <= 0) { showToast(G, 'This car is already mint.'); return false; }
  const cost = Math.ceil(missing * 2);
  if (p.cash < cost) { showToast(G, `Repair costs $${cost} — you have $${p.cash}.`); return false; }
  p.cash -= cost;
  p.car.hp = 100;
  p.car.smoke = 0;
  showToast(G, `Repaired to full — $${cost}.`);
  burst(G, p.car.x, p.car.y, '#4ade80', 14);
  return true;
}

export function paintCar(G, color) {
  const p = G.player;
  if (!p.car) { showToast(G, 'Bring a car to paint it.'); return false; }
  if (p.cash < 150) { showToast(G, 'A paint job costs $150.'); return false; }
  p.cash -= 150;
  p.car.color = color;
  G.garage.paint = color;
  showToast(G, `Fresh paint — $${150}. Looking sharp.`);
  return true;
}

export function tuneCar(G, part) {
  const p = G.player;
  if (part === 'armor') {
    if (G.garage.armor >= 3) { showToast(G, 'Armor is maxed out.'); return false; }
    const cost = 400 * (G.garage.armor + 1);
    if (p.cash < cost) { showToast(G, `Armor plate costs $${cost}.`); return false; }
    p.cash -= cost;
    G.garage.armor++;
    if (p.car) p.car.hp = 100;
    showToast(G, `Armor plated — level ${G.garage.armor}. Your car takes less damage.`);
    return true;
  }
  if (part === 'engine') {
    if (G.garage.engine >= 3) { showToast(G, 'Engine is maxed out.'); return false; }
    const cost = 500 * (G.garage.engine + 1);
    if (p.cash < cost) { showToast(G, `Engine tuning costs $${cost}.`); return false; }
    p.cash -= cost;
    G.garage.engine++;
    showToast(G, `Engine tuned — level ${G.garage.engine}. Faster top speed.`);
    return true;
  }
  return false;
}

export function buyCarFromDealer(G, modelIdx) {
  const p = G.player;
  const prices = [1200, 900, 2200, 1600, 1400, 4500];
  const cost = prices[modelIdx] ?? 1500;
  if (p.cash < cost) { showToast(G, `That car costs $${cost}.`); return false; }
  p.cash -= cost;
  const { makeCar } = dealerImports;
  const car = makeCar(2620, 740, modelIdx, undefined, { angle: 0 });
  G.cars.push(car);
  showToast(G, 'Car bought — it is parked outside Vela Motors.');
  return true;
}

// makeCar is imported lazily here to keep economy free of a vehicles
// cycle at module load; boot wires it in.
export const dealerImports = { makeCar: null };

export function eatMeal(G) {
  const p = G.player;
  if (p.cash < 15) { showToast(G, 'A meal costs $15.'); return false; }
  if (p.hp >= 100) { showToast(G, 'You are already full health.'); return false; }
  p.cash -= 15;
  p.hp = clamp(p.hp + 35, 0, 100);
  showToast(G, 'Snack Shack meal — +35 HP. Tasty.');
  return true;
}

export function sleepAtSafehouse(G) {
  const p = G.player;
  p.hp = 100;
  p.armor = 50;
  G.heat = 0;
  G.wanted = 0;
  G.cops.length = 0;
  G.copCars.length = 0;
  G.heli = null;
  G.clock = 8 * 60;
  showBanner(G, 'SAFEHOUSE', 'You slept, saved and healed. A new day in Port Almar.');
  return true;
}

export function drawShops(ctx, city, clockMin, cam, view) {
  for (const s of city.shops) {
    if (Math.abs(s.x - cam.x) > view.w / 2 + 60 || Math.abs(s.y - cam.y) > view.h / 2 + 60) continue;
    const open = shopOpen(s, clockMin);
    // Shop front: awning + sign.
    ctx.fillStyle = open ? '#2fae4a' : '#7a3a3a';
    ctx.fillRect(s.x - 46, s.y - 30, 92, 14);
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(s.x - 46, s.y - 16, 92, 40);
    ctx.fillStyle = '#1c1c22';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.name.toUpperCase(), s.x, s.y + 2);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = open ? '#2fae4a' : '#c23b2e';
    ctx.fillText(open ? 'OPEN' : `CLOSED ${s.open}:00–${s.close}:00`, s.x, s.y + 16);
    // Pulsing ring so the player can spot shops.
    const pulse = 1 + Math.sin(performance.now() / 400) * 0.08;
    ctx.strokeStyle = open ? 'rgba(47,174,74,0.7)' : 'rgba(194,59,46,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 52 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawPackages(ctx, city) {
  for (const pk of city.packages) {
    if (pk.got) continue;
    ctx.fillStyle = '#ffd23a';
    ctx.save();
    ctx.translate(pk.x, pk.y + Math.sin(performance.now() / 300 + pk.x) * 3);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
}
