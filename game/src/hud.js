// Port Almar — HUD and menus: wanted stars, cash, health and armor,
// weapon and ammo, the live minimap, the mission tracker, banners,
// toasts, and the title / pause / wasted / busted / complete screens.
// The HUD is drawn on the canvas so screenshots show the whole game;
// menus are DOM overlays for crisp text.
import { WEAPONS, DISTRICTS, clamp } from './state.js';
import { missionObjectiveText, missionMarker, MISSIONS } from './missions.js';
import { shopOpen } from './economy.js';

export function drawHUD(ctx, G, city, view) {
  const p = G.player;
  const w = view.w, h = view.h;
  // --- top-left: wanted stars + cash + health/armor ---
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#ffd23a' : 'rgba(255,255,255,0.75)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(stars, 16, 38);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`$${p.cash.toLocaleString()}`, 16, 66);
  // Health + armor bars.
  bar(ctx, 16, 76, 170, 12, p.hp / 100, '#e23b3b', 'HP');
  bar(ctx, 16, 92, 170, 9, p.armor / 100, '#7ab8ff', 'ARMOR');
  // Clock + weather + district.
  const hh = Math.floor(G.clock / 60) % 24;
  const mm = Math.floor(G.clock % 60);
  const district = DISTRICTS.find((d) => p.x >= d.x && p.x < d.x + d.w && p.y >= d.y && p.y < d.y + d.h);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${G.weather.toUpperCase()}`, 16, 126);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(district ? district.name : 'Port Almar', 16, 146);
  // --- bottom-left: weapon (the controls hint lives in the corner div) ---
  const weapon = WEAPONS[p.weapon];
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  const ammo = p.weapon === 'fists' ? '∞' : `${p.weapons[p.weapon] ?? 0}`;
  ctx.fillText(`${weapon.name}  •  ${ammo}`, 16, h - 18);
  // --- bottom-center: mission tracker ---
  const obj = missionObjectiveText(G);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const tw = ctx.measureText(obj).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectFill(ctx, w / 2 - tw / 2 - 14, h - 66, tw + 28, 30, 8);
  ctx.fillStyle = '#ffd23a';
  ctx.textAlign = 'center';
  ctx.fillText(obj, w / 2, h - 45);
  ctx.textAlign = 'left';
  // --- mission timer ---
  if (G.mission && G.mission.t > 0) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = G.mission.t < 15 ? '#ff5a5a' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(G.mission.t)}s`, w / 2, 64);
    ctx.textAlign = 'left';
  }
  // --- banner ---
  if (G.banner && G.bannerT > 0) {
    const a = Math.min(1, G.bannerT);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23a';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 8;
    ctx.fillText(G.banner.msg, w / 2, 120);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(G.banner.sub, w / 2, 146);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  // --- toast ---
  if (G.toast && G.toastT > 0) {
    ctx.globalAlpha = Math.min(1, G.toastT);
    ctx.font = '15px system-ui, sans-serif';
    const tw2 = ctx.measureText(G.toast).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRectFill(ctx, w / 2 - tw2 / 2 - 12, h - 108, tw2 + 24, 26, 8);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.toast, w / 2, h - 90);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // --- wanted flash vignette ---
  if (G.wanted >= 3) {
    const pulse = 0.10 + Math.sin(performance.now() / 300) * 0.05;
    ctx.fillStyle = `rgba(255,30,30,${pulse})`;
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 10, w, 10);
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
  }
  // --- low health vignette ---
  if (p.hp < 30 && G.mode === 'play') {
    ctx.fillStyle = 'rgba(200,0,0,0.18)';
    ctx.fillRect(0, 0, w, h);
  }
  drawMinimap(ctx, G, city, w, h);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.fillText(label, x + 3, y + h - 2);
}

function roundRectFill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function drawMinimap(ctx, G, city, w, h) {
  const mw = 230, mh = 176;
  const mx = w - mw - 16, my = 16;
  const scaleX = mw / 3600, scaleY = mh / 2800;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRectFill(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  // Water + sand edge.
  ctx.fillStyle = '#2f7fb3';
  ctx.fillRect(mx + 3400 * scaleX, my, mw - 3400 * scaleX, mh);
  ctx.fillStyle = '#e8cf8f';
  ctx.fillRect(mx + 3180 * scaleX, my, 220 * scaleX, mh);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (const rx of [320, 760, 1200, 1640, 2080, 2520, 2960, 3360]) {
    ctx.beginPath(); ctx.moveTo(mx + rx * scaleX, my); ctx.lineTo(mx + rx * scaleX, my + mh); ctx.stroke();
  }
  for (const ry of [320, 720, 1120, 1520, 1920, 2320, 2620]) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * scaleY); ctx.lineTo(mx + mw, my + ry * scaleY); ctx.stroke();
  }
  // Shops.
  for (const s of city.shops) {
    ctx.fillStyle = shopOpen(s, G.clock) ? '#4ade80' : '#ff5a5a';
    ctx.fillRect(mx + s.x * scaleX - 2, my + s.y * scaleY - 2, 4, 4);
  }
  // Mission marker (pulsing).
  const marker = missionMarker(G);
  if (marker) {
    const pulse = 4 + Math.sin(performance.now() / 200) * 2;
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(mx + marker.x * scaleX, my + marker.y * scaleY, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Cops (blue), heli (white), player (yellow arrow).
  ctx.fillStyle = '#5aa2ff';
  for (const cc of G.copCars) ctx.fillRect(mx + cc.x * scaleX - 2, my + cc.y * scaleY - 2, 4, 4);
  if (G.heli) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(mx + G.heli.x * scaleX, my + G.heli.y * scaleY, 4, 0, Math.PI * 2); ctx.fill();
  }
  const px = mx + G.player.x * scaleX, py = my + G.player.y * scaleY;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North + label.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('PORT ALMAR', mx + 4, my + mh - 6);
  ctx.restore();
}

// --- DOM menus ------------------------------------------------------------
export function showMenu(G, kind) {
  const el = document.getElementById('menu');
  const title = document.getElementById('menu-title');
  const body = document.getElementById('menu-body');
  const btn = document.getElementById('menu-btn');
  if (!el || !title || !body || !btn) return;
  el.classList.remove('hidden');
  const p = G.player;
  if (kind === 'title') {
    title.textContent = 'PORT ALMAR';
    body.innerHTML = `
      <p class="tag">A sun-soaked open-world crime story. You are <b>Dario Venn</b>, wheelman for fixer <b>Selma Okafor</b>.</p>
      <p>7 story missions • taxi fares • street races • 28 hidden packages • boats • garage tuning • shops that close at night</p>
      <p class="controls">WASD move / drive &nbsp;•&nbsp; Mouse aim, click shoot &nbsp;•&nbsp; E enter car &nbsp;•&nbsp; F punch<br>
      1–4 weapons &nbsp;•&nbsp; M start mission &nbsp;•&nbsp; T taxi fare &nbsp;•&nbsp; Shift run &nbsp;•&nbsp; Space handbrake<br>
      Esc pause &nbsp;•&nbsp; Near a shop press B to open it</p>`;
    btn.textContent = 'START ENGINE';
  } else if (kind === 'pause') {
    title.textContent = 'PAUSED';
    body.innerHTML = `<p>Missions done: ${G.stats.missionsDone}/7 &nbsp;•&nbsp; Cash earned: $${G.stats.cashEarned.toLocaleString()}<br>
      Fares: ${G.stats.fares} &nbsp;•&nbsp; Races won: ${G.stats.racesWon} &nbsp;•&nbsp; Packages: ${G.packagesGot}/28<br>
      Cars stolen: ${G.stats.carsStolen} &nbsp;•&nbsp; Time played: ${Math.floor(G.stats.timePlayed / 60)} min</p>
      <p>Progress saves automatically at the safehouse and on mission pass.</p>`;
    btn.textContent = 'RESUME';
  } else if (kind === 'wasted') {
    title.textContent = 'WASTED';
    body.innerHTML = `<p>Dario went down in Port Almar. The city keeps moving without you.<br>
      You keep your cash minus the $200 hospital bill.</p>`;
    btn.textContent = 'TRY AGAIN';
  } else if (kind === 'busted') {
    title.textContent = 'BUSTED';
    body.innerHTML = `<p>The Almar PD hauled you in. Selma bailed you out — for $300.<br>
      Next time, keep a weapon out or keep running.</p>`;
    btn.textContent = 'WALK FREE';
  } else if (kind === 'complete') {
    title.textContent = 'PORT ALMAR IS YOURS';
    body.innerHTML = `<p>All 7 missions complete. Selma's crew runs the city now — and Dario Venn drives it.<br>
      Missions: 7/7 &nbsp;•&nbsp; Cash earned: $${G.stats.cashEarned.toLocaleString()} &nbsp;•&nbsp; Packages: ${G.packagesGot}/28</p>
      <p>Free roam continues — races, fares and packages are still out there.</p>`;
    btn.textContent = 'KEEP DRIVING';
  }
}

export function hideMenu() {
  const el = document.getElementById('menu');
  if (el) el.classList.add('hidden');
}

export function showShopMenu(G, city, shop) {
  const el = document.getElementById('shop');
  const title = document.getElementById('shop-title');
  const body = document.getElementById('shop-body');
  if (!el || !title || !body) return;
  const p = G.player;
  title.textContent = shop.name;
  let html = `<p>${shop.blurb} — ${shopOpen(shop, G.clock) ? 'OPEN' : 'CLOSED'}</p><p>Cash: $${p.cash}</p>`;
  if (!shopOpen(shop, G.clock)) {
    html += `<p>This shop is closed right now. Come back during opening hours (${shop.open}:00–${shop.close}:00).</p>`;
  } else if (shop.kind === 'weapons') {
    html += `<div class="shop-row"><button data-buy="pistol">P9 Pistol — $350</button><button data-buy="smg">VK-9 SMG — $900</button><button data-buy="shotgun">Breach-12 — $1400</button></div>
      <p>Ammo top-up costs a quarter of the gun price. Owned: ${Object.keys(WEAPONS).filter((k) => p.owned[k]).join(', ')}</p>`;
  } else if (shop.kind === 'garage') {
    html += `<div class="shop-row"><button data-buy="repair">Repair car — $2/HP</button><button data-buy="armor">Armor plate — $${400 * (G.garage.armor + 1)}</button><button data-buy="engine">Engine tune — $${500 * (G.garage.engine + 1)}</button></div>
      <div class="shop-row"><button data-paint="#c23b2e">Red $150</button><button data-paint="#2e6fc2">Blue $150</button><button data-paint="#e8c23a">Gold $150</button><button data-paint="#3aa655">Green $150</button></div>
      <p>Armor ${G.garage.armor}/3 • Engine ${G.garage.engine}/3</p>`;
  } else if (shop.kind === 'cars') {
    html += `<div class="shop-row"><button data-car="0">Civic Dart $1200</button><button data-car="2">Dune Runner $2200</button><button data-car="5">Vela GT $4500</button></div>`;
  } else if (shop.kind === 'food') {
    html += `<div class="shop-row"><button data-buy="meal">Meal — $15 (+35 HP)</button></div>`;
  } else if (shop.kind === 'safehouse') {
    html += `<div class="shop-row"><button data-buy="sleep">Sleep — save + heal + clear heat</button></div>`;
  } else if (shop.kind === 'boats') {
    html += `<div class="shop-row"><button data-buy="boat">Rent speedboat — $100</button></div><p>Boats launch from the marina pier.</p>`;
  }
  html += `<p class="hint">Press B or Esc to close.</p>`;
  body.innerHTML = html;
  el.classList.remove('hidden');
}

export function hideShopMenu() {
  const el = document.getElementById('shop');
  if (el) el.classList.add('hidden');
}
