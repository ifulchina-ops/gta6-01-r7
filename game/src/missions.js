// Port Almar — missions: a seven-job story arc for fixer Selma Okafor,
// plus side work: taxi fares, a street-race loop, hidden packages and
// random street events. Each mission is a small state machine with
// objectives, a marker, a timer where it matters, and a cash reward.
import { dist2, angleTo, clamp, rand, pick } from './state.js';
import { addCash, showBanner, showToast, burst } from './vehicles.js';

export const MISSIONS = [
  {
    id: 0, title: 'First Fare', giver: 'Selma Okafor',
    brief: 'Selma needs a wheelman she can trust. Pick up her client at the Glass Quay tower and drop him at the marina — no scratches, no cops.',
    reward: 300, target: { x: 1740, y: 420 }, drop: { x: 3300, y: 2100 }, kind: 'pickup',
  },
  {
    id: 1, title: 'Hot Wheels', giver: 'Selma Okafor',
    brief: 'A Vela GT is parked outside Vela Motors. Take it. The owner will call the cops — lose them before you bring it to the garage.',
    reward: 500, target: { x: 2620, y: 660 }, drop: { x: 900, y: 1060 }, kind: 'steal',
  },
  {
    id: 2, title: 'The Cannery Job', giver: 'Selma Okafor',
    brief: 'Guards watch the Old Cannery warehouse. Get inside, grab the crate, and get out. Loud is fine — fast is better.',
    reward: 800, target: { x: 420, y: 560 }, drop: { x: 900, y: 1060 }, kind: 'grab',
  },
  {
    id: 3, title: 'Harbor Lights', giver: 'Selma Okafor',
    brief: 'Night run. Smuggle a crate by boat from the docks to the marina pier. The water is the only road the PD does not watch.',
    reward: 900, target: { x: 1700, y: 1250 }, drop: { x: 3300, y: 2050 }, kind: 'boat',
  },
  {
    id: 4, title: 'Dune Run', giver: 'Selma Okafor',
    brief: 'A street race around the Dune Strip loop. Beat the clock: 5 gates in 90 seconds. The bookies pay double if you win clean.',
    reward: 1000, target: { x: 2080, y: 1920 }, drop: null, kind: 'race', time: 90,
  },
  {
    id: 5, title: 'The Informant', giver: 'Selma Okafor',
    brief: 'An informant is talking to the PD at Palmera Heights. Silence him — or scare him off the island. Your call, Dario.',
    reward: 1200, target: { x: 600, y: 1500 }, drop: { x: 900, y: 1060 }, kind: 'hit',
  },
  {
    id: 6, title: 'The Last Delivery', giver: 'Selma Okafor',
    brief: 'One last job: drive the package through a 3-star dragnet to the safehouse. Finish this and Port Almar is yours.',
    reward: 2000, target: { x: 1740, y: 420 }, drop: { x: 420, y: 1660 }, kind: 'deliver',
  },
];

export function startMission(G, idx) {
  const def = MISSIONS[idx];
  if (!def) return;
  G.mission = {
    def, stage: 0, // 0 go to target, 1 carry out, 2 return / done
    t: def.time ?? 0, gates: [], gateIdx: 0, client: false, crate: false,
  };
  if (def.kind === 'race') {
    G.mission.gates = [
      { x: 2620, y: 1920 }, { x: 2960, y: 1920 }, { x: 2960, y: 2320 },
      { x: 2080, y: 2320 }, { x: 2080, y: 1920 },
    ];
  }
  showBanner(G, `MISSION — ${def.title}`, def.brief);
  G.heat = Math.max(G.heat, def.kind === 'deliver' ? 58 : G.heat);
}

export function updateMissions(G, city, dt) {
  const m = G.mission;
  if (!m) return;
  const p = G.player;
  const def = m.def;
  if (m.t > 0) {
    m.t -= dt;
    if (m.t <= 0) {
      failMission(G, 'Out of time.');
      return;
    }
  }
  const at = (pt, r = 120) => dist2(p.x, p.y, pt.x, pt.y) < r * r;
  if (def.kind === 'pickup') {
    if (m.stage === 0 && at(def.target)) {
      m.stage = 1; m.client = true;
      showBanner(G, 'CLIENT ABOARD', 'Drive him to the marina pier. Keep it smooth.');
    } else if (m.stage === 1 && at(def.drop)) completeMission(G);
  } else if (def.kind === 'steal') {
    if (m.stage === 0 && at(def.target, 90)) {
      m.stage = 1;
      G.heat = Math.max(G.heat, 38);
      showBanner(G, 'CAR TAKEN', 'The alarm is screaming. Lose the cops, then reach the garage.');
    } else if (m.stage === 1 && at(def.drop) && G.wanted === 0) completeMission(G);
    else if (m.stage === 1 && at(def.drop)) showToast(G, 'Too hot — lose the cops first!');
  } else if (def.kind === 'grab') {
    if (m.stage === 0 && at(def.target)) {
      m.stage = 1; m.crate = true;
      G.heat = Math.min(100, G.heat + 20);
      // Warehouse guards appear as hostile peds.
      for (let i = 0; i < 3; i++) {
        G.peds.push({ x: def.target.x + rand(-80, 80), y: def.target.y + rand(-80, 80), angle: 0, speed: 90, skin: '#8a5a3a', shirt: '#222831', state: 'flee', tx: 0, ty: 0, retarget: 0, scared: 0, hp: 40 });
      }
      showBanner(G, 'CRATE GRABBED', 'Guards are on you. Get it to the garage.');
    } else if (m.stage === 1 && at(def.drop)) completeMission(G);
  } else if (def.kind === 'boat') {
    if (m.stage === 0 && at(def.target)) {
      m.stage = 1;
      // Hand the player a boat at the dock.
      if (!p.boat) {
        const b = { x: 3420, y: 1300, angle: -Math.PI / 2, speed: 0, len: 64, wid: 24, hp: 100, color: '#e8f2f5', rented: true };
        G.boats.push(b);
        p.boat = b; p.onFoot = false; p.car = null;
      }
      showBanner(G, 'ON THE WATER', 'Sail south to the marina pier. Stay off the beach road.');
    } else if (m.stage === 1 && p.boat && dist2(p.x, p.y, def.drop.x, def.drop.y) < 120 * 120) {
      p.boat = null; p.onFoot = true;
      completeMission(G);
    }
  } else if (def.kind === 'race') {
    const gate = m.gates[m.gateIdx];
    if (gate && at(gate, 80)) {
      m.gateIdx++;
      burst(G, gate.x, gate.y, '#4ade80', 16);
      if (m.gateIdx >= m.gates.length) completeMission(G);
      else showToast(G, `Gate ${m.gateIdx}/${m.gates.length} — keep going!`);
    }
  } else if (def.kind === 'hit') {
    if (m.stage === 0 && at(def.target, 120)) {
      m.stage = 1;
      // The informant is a marked ped who flees.
      const inf = { x: def.target.x, y: def.target.y, angle: 0, speed: 110, skin: '#f2c89b', shirt: '#ffd23a', state: 'flee', tx: 0, ty: 0, retarget: 0, scared: 9, hp: 50, informant: true };
      G.peds.push(inf);
      m.informant = inf;
      showBanner(G, 'THERE HE IS', 'The yellow-shirt informant is running. Deal with him.');
    } else if (m.stage === 1 && m.informant && m.informant.state === 'down') {
      completeMission(G);
    } else if (m.stage === 1 && m.informant && dist2(p.x, p.y, m.informant.x, m.informant.y) > 900 * 900) {
      failMission(G, 'The informant got away.');
    }
  } else if (def.kind === 'deliver') {
    if (m.stage === 0 && at(def.target)) {
      m.stage = 1;
      G.heat = Math.max(G.heat, 58);
      showBanner(G, 'PACKAGE LOADED', 'Three stars and climbing. Drive to the safehouse — do not stop.');
    } else if (m.stage === 1 && at(def.drop)) completeMission(G);
  }
}

export function completeMission(G) {
  const m = G.mission;
  const def = m.def;
  addCash(G, def.reward);
  G.missionDone[def.id] = true;
  G.stats.missionsDone++;
  showBanner(G, `MISSION PASSED — ${def.title}`, `+$${def.reward}. Selma is impressed.`);
  burst(G, G.player.x, G.player.y, '#4ade80', 24);
  G.mission = null;
  G.missionIndex = def.id + 1;
  if (G.missionIndex >= MISSIONS.length) {
    G.storyComplete = true;
    G.mode = 'complete';
  }
}

export function failMission(G, why) {
  showBanner(G, 'MISSION FAILED', why);
  G.mission = null;
}

// --- side work ------------------------------------------------------------
export function updateSideJobs(G, city, dt) {
  const p = G.player;
  // Taxi: press T near a waving ped to take a fare.
  if (G.taxi) {
    const tx = G.taxi;
    tx.t -= dt;
    if (dist2(p.x, p.y, tx.dest.x, tx.dest.y) < 120 * 120) {
      addCash(G, tx.fare);
      G.stats.fares++;
      showToast(G, `Fare complete — +$${tx.fare}.`);
      G.taxi = null;
    } else if (tx.t <= 0) {
      showToast(G, 'Fare expired — the passenger walked away.');
      G.taxi = null;
    }
  }
  // Random street events: a mugging, a car on fire, a lost wallet.
  if (!G.event && G.wanted < 2 && Math.random() < dt * 0.012) {
    const kind = pick(['mugging', 'wallet', 'carfire']);
    const ex = clamp(p.x + rand(-400, 400), 200, 3100);
    const ey = clamp(p.y + rand(-300, 300), 200, 2600);
    G.event = { kind, x: ex, y: ey, t: 45 };
    if (kind === 'mugging') showToast(G, 'EVENT: a mugging in progress nearby — intervene for cash!');
    if (kind === 'wallet') showToast(G, 'EVENT: someone dropped a wallet nearby.');
    if (kind === 'carfire') showToast(G, 'EVENT: a car is burning nearby — check it out.');
    if (kind === 'wallet') G.pickups.push({ x: ex, y: ey, kind: 'cash', amount: 150, t: 0 });
    if (kind === 'carfire') {
      const car = G.cars.find((c) => dist2(c.x, c.y, ex, ey) < 200 * 200);
      if (car) car.hp = 20;
    }
  }
  if (G.event) {
    G.event.t -= dt;
    if (G.event.kind === 'mugging' && dist2(p.x, p.y, G.event.x, G.event.y) < 80 * 80) {
      addCash(G, 200);
      showToast(G, 'You stopped the mugging — the victim paid you $200.');
      G.event = null;
    }
    if (G.event && G.event.t <= 0) G.event = null;
  }
}

export function startTaxi(G) {
  if (G.taxi) return;
  const p = G.player;
  if (!p.car) { showToast(G, 'You need a car to take fares.'); return; }
  const dest = { x: rand(300, 3100), y: rand(300, 2500) };
  const fare = 80 + Math.floor(Math.hypot(dest.x - p.x, dest.y - p.y) / 12);
  G.taxi = { dest, fare, t: 75 };
  showBanner(G, 'TAXI FARE', `Drop the passenger off — $${fare} if you make it in time.`);
}

export function missionObjectiveText(G) {
  const m = G.mission;
  if (G.taxi && !m) return `Taxi fare: drop off for $${G.taxi.fare} — ${Math.ceil(G.taxi.t)}s left.`;
  if (!m) {
    if (G.storyComplete) return 'Story complete — free roam Port Almar.';
    if (G.missionIndex >= MISSIONS.length) return 'All missions done.';
    return `Next: ${MISSIONS[G.missionIndex].title} — press M to start.`;
  }
  const def = m.def;
  const stageText = {
    pickup: m.stage === 0 ? 'Pick up the client at Glass Quay' : 'Drop the client at the marina',
    steal: m.stage === 0 ? 'Steal the Vela GT at Vela Motors' : (G.wanted > 0 ? 'Lose the cops, then reach the garage' : 'Bring the car to the garage'),
    grab: m.stage === 0 ? 'Reach the Old Cannery warehouse' : 'Take the crate to the garage',
    boat: m.stage === 0 ? 'Reach the docks' : 'Sail to the marina pier',
    race: `Race gates: ${m.gateIdx}/${m.gates.length} — ${Math.ceil(m.t)}s left`,
    hit: m.stage === 0 ? 'Find the informant at Palmera Heights' : 'Deal with the informant',
    deliver: m.stage === 0 ? 'Pick up the package at Glass Quay' : 'Drive to the safehouse — stay moving',
  };
  return `${def.title}: ${stageText[def.kind] || ''}`;
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m) {
    if (G.taxi) return { x: G.taxi.dest.x, y: G.taxi.dest.y, color: '#ffd23a', label: 'FARE' };
    if (G.missionIndex < MISSIONS.length) return { x: MISSIONS[G.missionIndex].target.x, y: MISSIONS[G.missionIndex].target.y, color: '#4ade80', label: 'NEXT JOB' };
    return null;
  }
  const def = m.def;
  if (def.kind === 'race') {
    const gate = m.gates[m.gateIdx];
    return gate ? { x: gate.x, y: gate.y, color: '#4ade80', label: `GATE ${m.gateIdx + 1}` } : null;
  }
  if (def.kind === 'pickup' || def.kind === 'steal' || def.kind === 'grab' || def.kind === 'deliver') {
    const pt = m.stage === 0 ? def.target : def.drop;
    return pt ? { x: pt.x, y: pt.y, color: '#4ade80', label: m.stage === 0 ? 'GO HERE' : 'DROP OFF' } : null;
  }
  if (def.kind === 'boat') {
    const pt = m.stage === 0 ? def.target : def.drop;
    return pt ? { x: pt.x, y: pt.y, color: '#4ade80', label: m.stage === 0 ? 'DOCKS' : 'MARINA' } : null;
  }
  if (def.kind === 'hit') {
    if (m.stage === 0) return { x: def.target.x, y: def.target.y, color: '#ff5a5a', label: 'TARGET' };
    if (m.informant) return { x: m.informant.x, y: m.informant.y, color: '#ff5a5a', label: 'TARGET' };
  }
  return null;
}
