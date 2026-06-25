# 🎣 BassBuddy

A simple, fun, and rewarding **bass fishing game** built for quick mobile play.
No installs, no accounts, no build step — just open it in a phone browser and start casting.

![Lily Cove](https://img.shields.io/badge/play-in%20browser-ffd35c) ![No deps](https://img.shields.io/badge/dependencies-none-5be37a)

## How to play

1. **Tap & hold** the big button to charge your cast — release to fling your line.
2. **Wait for a bite.** When you see **FISH ON!**, tap to set the hook (be quick!).
3. **Reel it in.** Hold the button to lift your green catch-bar, release to let it
   drop. Keep the bar over the fish to fill the progress meter and land your catch.
4. **Earn 🪙 coins**, beat your personal-best weights, and spend coins in the
   **🛒 Tackle Shop** on better rods and new fishing spots.

## Features

- **One-thumb gameplay** — the entire game is driven by a single tap-and-hold button.
- **Three fishing spots** — Lily Cove, Rushing River, and Midnight Lake, each with
  its own scenery, fish, and bigger payouts.
- **Rods that matter** — upgrade for stronger reels, bigger fish, and rarer luck.
- **20+ fish** across common → uncommon → rare → legendary, plus the odd old boot. 🥾
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
