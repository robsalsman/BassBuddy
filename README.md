# 🎣 BassBuddy

A simple, fun, and rewarding **bass fishing game** built for quick mobile play.
No installs, no accounts, no build step — just open it in a phone browser and start casting.

![Lily Cove](https://img.shields.io/badge/play-in%20browser-ffd35c) ![No deps](https://img.shields.io/badge/dependencies-none-5be37a)

A faithful tribute to the SNES classic **Super Black Bass** — its cast-meter,
work-the-lure retrieve, hook-set and tension-vs-stamina fight — rebuilt for
one-thumb mobile play with original art and code, then extended with a modern
tournament mode and progression. (No assets or code from the original are used.)

## How to play

1. **Read the water & cast** — fish shadows school on the visible **structure**
   (lily pads, dock, logs, reeds, rocks…) so you can see where the bass are.
   **Press and hold** to aim while the **power meter** fills; **release** to cast
   your lure there.
2. **Dive in & work the lure** — when the lure splashes down the camera drops to
   an **underwater view** where you watch your actual lure and the bass that come
   to chase it. **Tap to twitch**, **hold to reel**. Keep the lure in the
   highlighted **BITE ZONE** (watch the **depth** and **line-out** readouts and
   the up/down coaching) with good **action** to build a bass's **interest** until
   it strikes. Match your **lure color** to the weather.
3. **Set the hook** — when it strikes (**FISH ON!**), tap/flick to set the hook
   before it spits the lure.
4. **Fight it** — the keystone: **reel only when the fish tires**, and **ease off
   when it runs or jumps**. Watch the **line tension** — peg it and the line
   **snaps**. Wear big bass down to land them.
5. **Earn 🪙 coins**, beat your personal-best weights, and spend coins in the
   **🛒 Tackle Shop** on better rods, lures, and new lakes.

## Conditions matter

Time of day, weather, and water temperature set **where the bass hold** (shallow
at dawn/dusk, deeper midday) and which **lure color** they see best (natural on
bright days, bright colors in fog/murk) — just like the original.

## Two ways to play

- **🎯 Career** — start with a twig rod and a worm and earn coins to unlock better
  rods, lures and lakes. The full progression.
- **🕹️ Arcade** — everything unlocked and free tournament entry. A sandbox to
  experiment and learn which lure-and-spot combos work in which conditions.

Switch anytime from the mode button; your unlocks and records are kept.

## Read the conditions, pick your combo

The **tackle box shows a live bite rating** for every lure for the current
time, weather, water temperature, depth and structure — with a one-line "why"
(e.g. *"Fish are deep — a topwater won't reach"*, *"Too flashy — go natural in
bright light"*). The fish finder recommends the **best lure right now**. It's
honest (the rating drives the real catch odds) and modeled on real fishing, so
it doubles as practice for picking lures in real conditions — which is the whole
game in tournament mode: choosing **when, where and what** to fish.

## Features

- **Aim your cast** — tap anywhere in your casting range to place the lure;
  land it on the highlighted structure for faster bites and better fish.
- **Eight classic lures** — Plastic Worm, Torpedo, Jitterbug, Pencil Bait, Frog,
  Spoon, Crankbait and Furry Sinker. Each has its own **style** (topwater vs
  sinking), **depth**, and **retrieve cadence**, plus a **color** set — match the
  color to the weather and the depth to where the bass are holding.
- **Boat-mode Fish Finder** — a sonar readout on the "Where to Fish" screen shows
  the bite depth, current conditions, the lure/color to throw, and the top species
  at your chosen spot.
- **Choose your spot** — 3 venues (Lily Cove, Rushing River, Midnight Lake), each
  with several **fishing positions** that change which species are biting.
- **🏆 Tournament mode** — race the clock to boat your best **5 largemouth**.
  Real bass-tournament rules: a 5-fish live well, **auto-culling** when you hook a
  sixth, **only largemouth count** (everything else is released), Big Bass bonus,
  an AI field, weigh-in standings, and coin payouts by placement.
- **Species-accurate fish art** — every fish is drawn to look like itself
  (a bronze barred smallmouth, a whiskered catfish, a big-eyed walleye…).
- **Rods that matter** — upgrade for stronger reels, longer casts, and rarer luck.
- **14 species** across common → uncommon → rare → legendary, plus junk. 🥾
- **Fish-Dex** that tracks every species you've caught and your record weights.
- **Progress saved automatically** in your browser (localStorage).
- **Mobile-first** — haptic feedback, safe-area aware, no zoom/scroll jank.

## Run it

It's a static site — just open `index.html`.

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then visit http://localhost:8000 on your phone or browser
```

Add it to your phone's home screen for a full-screen, app-like experience.

## Tech

Plain HTML, CSS, and vanilla JavaScript. The scene is drawn on a `<canvas>`;
the HUD, shop, and minigame are DOM. Three files, zero dependencies:

| File | Purpose |
|------|---------|
| `index.html` | Markup & HUD |
| `style.css`  | Mobile-first styling |
| `game.js`    | Game loop, fishing logic, shop, save system |

Tight lines! 🐟
