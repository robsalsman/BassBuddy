# 🎣 BassBuddy

A simple, fun, and rewarding **bass fishing game** built for quick mobile play.
No installs, no accounts, no build step — just open it in a phone browser and start casting.

![Lily Cove](https://img.shields.io/badge/play-in%20browser-ffd35c) ![No deps](https://img.shields.io/badge/dependencies-none-5be37a)

## How to play

1. **Tap the water** where you want your lure to land — aim for the glowing
   structure (lily pads, dock, drop-off…) where the good fish hold.
2. **Wait for a bite.** When you see **FISH ON!**, tap to set the hook (be quick!).
3. **Reel it in.** Hold to lift your green catch-bar, release to let it drop.
   Keep the bar over the fish to fill the progress meter and land your catch.
4. **Earn 🪙 coins**, beat your personal-best weights, and spend coins in the
   **🛒 Tackle Shop** on better rods, lures, and new fishing spots.

## Features

- **Aim your cast** — tap anywhere in your casting range to place the lure;
  land it on the highlighted structure for faster bites and better fish.
- **Lures that matter** — pick a **type** (worm, spinnerbait, crankbait, frog,
  jig, swimbait) and a **color**. Match the color to the water clarity for more
  bites; topwater frogs and jigs target big largemouth.
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
