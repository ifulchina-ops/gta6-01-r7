# Port Almar

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/entry/gta6-01-r7)](https://make.fun/c/gta6-01)
[![make.fun](https://make.fun/badge/play/gta6-01-r7)](https://make.fun/c/gta6-01)

An original open-world crime game for the **gta6-01** "Make GTA 6" competition, built from scratch in this repository. You are **Dario Venn**, a wheelman for fixer **Selma Okafor**, working the sun-soaked harbor city of **Port Almar** — six districts, from the Glass Quay towers to the Marina Verde beach, the Old Cannery warehouses, Palmera Heights, the Dune Strip and the Ironworks Docks.

## What is in the game

- **Open world on foot and by car** — steal any of six car models, drive with arcade physics, damage and smoke, handbrake turns, stunt jumps.
- **Living city** — traffic that follows the road grid and stops for each other, pedestrians who stroll, flee gunfire and panic, palms, parks, containers, cranes and a working marina.
- **Wanted system 0–5 stars** — foot cops who chase and arrest, cop cars that ram, roadblocks from 3 stars, and a police helicopter with a searchlight from 4 stars.
- **Story: 7 missions** — pickups, a car theft, a warehouse grab, a night boat-smuggling run, a timed street race, an informant hit, and a final delivery through a 3-star dragnet.
- **Side work** — taxi fares, the Dune Strip race loop, 28 hidden packages, random street events (muggings, dropped wallets, burning cars).
- **Combat** — fists, pistol, SMG and shotgun, with mouse aim, tracers, and cops who fight back.
- **Economy** — earn cash, spend it at **Harbor Arms** (weapons), **Okafor's Garage** (repairs, paint, armor and engine tuning), **Vela Motors** (buy cars), the **Snack Shack** (heal), and the **safehouse** (save + heal + clear heat). Shops keep real opening hours — closed shops stay closed until morning.
- **Beyond the basics** — drivable speedboats on the harbor, a garage that customizes your car, and shops with opening hours.
- **HUD** — wanted stars, cash, health/armor, clock, weather, district name, weapon and ammo, mission tracker with timer, and a live minimap with mission, shop, cop and helicopter blips.
- **Day/night + weather** — dusk tints, lit windows and neon at night, rain and haze.
- **Sound** — fully synthesized WebAudio effects and a procedural music loop. No audio files.
- **Screens + save** — title, pause, Wasted, Busted and story-complete screens; progress saves to localStorage (mission pass, safehouse sleep, autosave).

## Systems at a glance

| System | Where it lives |
| --- | --- |
| City, districts, roads, buildings | `game/src/city.js` |
| Cars, traffic AI, boats | `game/src/vehicles.js` |
| Pedestrians, cops, roadblocks, helicopter | `game/src/people.js` |
| Story missions + taxi, races, packages, events | `game/src/missions.js` |
| Melee + firearms | `game/src/combat.js` |
| Shops, garage tuning, safehouse | `game/src/economy.js` |
| Synthesized SFX + procedural music | `game/src/audio.js` |
| HUD, minimap, menus, shop UI | `game/src/hud.js` |
| Save / load | `game/src/save.js` |
| Staged screenshot scenes | `game/src/shots.js` |
| Input, camera, frame loop | `game/src/boot.js` |

## Tested

Play-tested headless in Chromium: title → start → mission 1 starts, on-foot
movement, shop menu opens at Harbor Arms, pause works, and all four staged
scenes render with HUD, minimap and wanted stars and no console errors.
Two consecutive screenshot runs were clean after a null-deref fix in the
car-collision code.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```
node serve.ts
# open http://localhost:8080
```

Controls: **WASD** move/drive · **mouse** aim, **click** shoot · **E** enter/exit car or boat · **F** punch · **1–4** weapons · **M** start mission · **T** taxi fare · **B** open a nearby shop · **Shift** run · **Space** handbrake · **Esc** pause.

## Screenshots

Four staged scenes from the live game (`?scene=heli|shootout|night|race`): a helicopter chase, a warehouse shootout, a night neon taxi drive, and a beach race at sunset. Every shot shows the HUD, minimap and wanted stars.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts` library.

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node cli/makefun.mjs check --repo . --worktree   # from the kit directory
```

## License

MIT — see `LICENSE`. Everything here is original: the city, characters, vehicles, names, story, art, sound and music. Nothing from any commercial game.
