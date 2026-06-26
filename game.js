/* BassBuddy — a simple, fun, rewarding bass fishing game for mobile.
   Vanilla JS. Canvas scene + DOM HUD. Saved to localStorage.

   Features: species-accurate fish art, tap-to-aim casting, lure type+color,
   selectable venues & fishing positions, and a full bass tournament mode. */
(function () {
  "use strict";

  // ===========================================================================
  // Data
  // ===========================================================================
  const RODS = [
    { id: "twig",   name: "Twig Rod",      ico: "🎣", price: 0,    power: 1.0,  luck: 0,    desc: "A humble start. Gets the job done." },
    { id: "carbon", name: "Carbon Caster", ico: "🪶", price: 120,  power: 1.25, luck: 0.08, desc: "Lighter line, bigger bass, longer casts." },
    { id: "pro",    name: "Pro Angler",    ico: "⚙️", price: 450,  power: 1.55, luck: 0.16, desc: "Tournament-grade. Lands the lunkers." },
    { id: "legend", name: "Legend Reel",   ico: "🌟", price: 1400, power: 1.9,  luck: 0.28, desc: "Whispered about on every dock." },
  ];

  // Lures: type changes how/what bites. Colors are tuned to water clarity.
  // fam: "natural" (clear water) or "bright" (stained/dark water).
  const COLORS = {
    green:     { name: "Green Pumpkin", hex: "#3f6b34", fam: "natural" },
    brown:     { name: "Brown",         hex: "#6b4a2a", fam: "natural" },
    shad:      { name: "Shad",          hex: "#aeb7bf", fam: "natural" },
    white:     { name: "White",         hex: "#f0f0ee", fam: "natural" },
    black:     { name: "Black",         hex: "#1d1d1f", fam: "natural" },
    chartreuse:{ name: "Chartreuse",    hex: "#c6e23a", fam: "bright" },
    gold:      { name: "Gold",          hex: "#e8b53a", fam: "bright" },
    red:       { name: "Red Craw",      hex: "#b6322b", fam: "bright" },
    pink:      { name: "Bubblegum",     hex: "#e85d9b", fam: "bright" },
    firetiger: { name: "Fire Tiger",    hex: "#e0a52a", fam: "bright" },
  };
  const LURES = [
    { id: "worm",    name: "Plastic Worm",  ico: "🪱", price: 0,    desc: "All-purpose. Bass can't resist it.",
      colors: ["green","black","red","white"], bite: 1.0, bassBias: 1.35, lmBias: 1.1, junk: 1.0, rareBias: 1.0, sizeBias: 1.0 },
    { id: "spinner", name: "Spinnerbait",   ico: "🌀", price: 140,  desc: "Flash & vibration trigger fast reaction strikes.",
      colors: ["chartreuse","white","gold","shad"], bite: 1.45, bassBias: 1.2, lmBias: 1.15, junk: 0.7, rareBias: 1.1, sizeBias: 1.05 },
    { id: "crank",   name: "Crankbait",     ico: "🎣", price: 320,  desc: "Dives deep for chunkier, heavier fish.",
      colors: ["firetiger","shad","red","chartreuse"], bite: 1.1, bassBias: 1.15, lmBias: 1.1, junk: 0.6, rareBias: 1.25, sizeBias: 1.2 },
    { id: "frog",    name: "Topwater Frog", ico: "🐸", price: 560,  desc: "Surface blow-ups. Largemouth love it.",
      colors: ["green","black","white","brown"], bite: 1.0, bassBias: 1.25, lmBias: 1.9, junk: 0.4, rareBias: 1.15, sizeBias: 1.15 },
    { id: "jig",     name: "Football Jig",  ico: "🥅", price: 900,  desc: "Slow bottom craw for trophy bass.",
      colors: ["brown","green","black","red"], bite: 0.85, bassBias: 1.5, lmBias: 1.5, junk: 0.5, rareBias: 1.5, sizeBias: 1.35 },
    { id: "swim",    name: "Swimbait",      ico: "🐟", price: 1600, desc: "Big bait, big bass. Filters out the small stuff.",
      colors: ["shad","green","white","gold"], bite: 0.8, bassBias: 1.4, lmBias: 1.4, junk: 0.2, rareBias: 1.6, sizeBias: 1.55, minSize: 1.25 },
  ];

  // Fish. `art` drives the SVG. `lm:true` = largemouth black bass (tournament-legal).
  const F = {
    bluegill:  { name: "Bluegill",        w: [0.2, 1.1],  rarity: "common", base: 5,
                 art: { shape: "panfish", body: "#4f7fa0", belly: "#e0a23a", pat: "panel" } },
    largemouth:{ name: "Largemouth Bass", w: [1.0, 6.5],  rarity: "common", base: 11, lm: true,
                 art: { shape: "bass", body: "#6f9e4e", belly: "#eef1d6", pat: "lateral", patColor: "#33401f", bigmouth: true } },
    smallmouth:{ name: "Smallmouth Bass", w: [0.8, 4.5],  rarity: "uncommon", base: 16,
                 art: { shape: "bass", body: "#a07b46", belly: "#efe6cf", pat: "bars", patColor: "#6e4f28", eye: "#c23a2a" } },
    golden:    { name: "Golden Bass",     w: [3.0, 8.5],  rarity: "rare", base: 60,
                 art: { shape: "bass", body: "#e8b53a", belly: "#fff3c4", pat: "lateral", patColor: "#b07a16", bigmouth: true, shimmer: true } },
    rainbow:   { name: "Rainbow Trout",   w: [0.6, 4.0],  rarity: "common", base: 14,
                 art: { shape: "trout", body: "#7fae9c", belly: "#f2f0e6", pat: "trout" } },
    catfish:   { name: "Channel Catfish", w: [2.0, 14.0], rarity: "uncommon", base: 28,
                 art: { shape: "catfish", body: "#6b6450", belly: "#efe9d6" } },
    muskie:    { name: "Tiger Muskie",    w: [5.0, 22.0], rarity: "rare", base: 95,
                 art: { shape: "musky", body: "#8aa05a", belly: "#eef0d8", pat: "bars", patColor: "#46562a" } },
    walleye:   { name: "Walleye",         w: [1.0, 8.0],  rarity: "common", base: 22,
                 art: { shape: "walleye", body: "#b59b54", belly: "#f2ead0", pat: "bars", patColor: "#7c6a32", bigeye: true } },
    giant:     { name: "Giant Bass",      w: [6.0, 18.0], rarity: "uncommon", base: 45, lm: true,
                 art: { shape: "bass", body: "#5e8f54", belly: "#e8edcf", pat: "lateral", patColor: "#2c3f22", bigmouth: true } },
    sturgeon:  { name: "Sturgeon",        w: [10.0, 48.0],rarity: "rare", base: 130,
                 art: { shape: "sturgeon", body: "#8b8f8a", belly: "#d8d6cc" } },
    monster:   { name: "Lake Monster",    w: [30.0, 95.0],rarity: "legendary", base: 500,
                 art: { shape: "monster", body: "#3f8d63", belly: "#9be0b4" } },
    glowfish:  { name: "Glowfish",        w: [2.0, 6.0],  rarity: "rare", base: 120,
                 art: { shape: "trout", body: "#39c5d6", belly: "#c6f9ff", pat: "glow" } },
    boot:      { name: "Old Boot",        w: [1.0, 2.0],  rarity: "junk", base: 1,
                 art: { shape: "boot" } },
    can:       { name: "Tin Can",         w: [0.3, 0.7],  rarity: "junk", base: 1,
                 art: { shape: "can" } },
  };

  // Venues, each with a fish table and selectable fishing positions.
  const SPOTS = [
    {
      id: "cove", name: "Lily Cove", ico: "🌿", price: 0, clarity: "natural",
      sky: ["#7fd4e8", "#bff0f7"], water: ["#2a93b8", "#0a3a4a"],
      desc: "Calm, clear starter water. Natural colors shine here.",
      fish: [
        { k: "bluegill", weight: 46 }, { k: "largemouth", weight: 40 },
        { k: "smallmouth", weight: 16 }, { k: "golden", weight: 4 }, { k: "boot", weight: 9 },
      ],
      positions: [
        { id: "pads", name: "Lily Pads", ico: "🪷", desc: "Largemouth ambush spot.",
          zone: [0.30, 0.32, 0.18, 0.16], bias: { largemouth: 1.7, bluegill: 1.3, golden: 1.3, smallmouth: 0.7 } },
        { id: "dock", name: "Boat Dock", ico: "🛶", desc: "Shade-loving bass stack up.",
          zone: [0.70, 0.30, 0.16, 0.14], bias: { largemouth: 1.5, smallmouth: 1.3, bluegill: 1.1 } },
        { id: "open", name: "Open Water", ico: "🌊", desc: "Roaming schools, smallmouth.",
          zone: [0.50, 0.62, 0.22, 0.16], bias: { smallmouth: 1.6, bluegill: 1.2 } },
        { id: "drop", name: "The Drop-off", ico: "📉", desc: "Deeper edge, bigger fish.",
          zone: [0.50, 0.84, 0.26, 0.14], bias: { golden: 2.2, largemouth: 1.2, smallmouth: 1.2, bluegill: 0.5 } },
      ],
    },
    {
      id: "river", name: "Rushing River", ico: "🏞️", price: 200, clarity: "stained",
      sky: ["#9fdcc0", "#d7f3e6"], water: ["#2fae8e", "#0c4438"],
      desc: "Stained current. Bright colors get noticed.",
      fish: [
        { k: "rainbow", weight: 40 }, { k: "largemouth", weight: 28 },
        { k: "catfish", weight: 18 }, { k: "muskie", weight: 5 }, { k: "can", weight: 9 },
      ],
      positions: [
        { id: "riffle", name: "Riffles", ico: "💨", desc: "Oxygen-rich, trout hold here.",
          zone: [0.32, 0.42, 0.18, 0.14], bias: { rainbow: 1.8, catfish: 0.6 } },
        { id: "pool", name: "Deep Pool", ico: "🌀", desc: "Catfish and toothy muskie.",
          zone: [0.68, 0.66, 0.20, 0.18], bias: { catfish: 1.8, muskie: 1.8, rainbow: 0.7 } },
        { id: "bank", name: "Undercut Bank", ico: "🪵", desc: "Largemouth tuck under cover.",
          zone: [0.22, 0.70, 0.18, 0.16], bias: { largemouth: 1.9, muskie: 1.3 } },
        { id: "tailout", name: "Tailout", ico: "🏞️", desc: "Mixed bag in the seam.",
          zone: [0.55, 0.84, 0.26, 0.13], bias: { rainbow: 1.3, largemouth: 1.2, catfish: 1.2 } },
      ],
    },
    {
      id: "deep", name: "Midnight Lake", ico: "🌙", price: 900, clarity: "bright",
      sky: ["#3a4b7a", "#1b2447"], water: ["#243a78", "#070d2a"],
      desc: "Dark, deep, full of trophies. Bright colors only.",
      fish: [
        { k: "walleye", weight: 32 }, { k: "giant", weight: 26 },
        { k: "sturgeon", weight: 12 }, { k: "glowfish", weight: 8 }, { k: "monster", weight: 3 },
      ],
      positions: [
        { id: "weed", name: "Weed Edge", ico: "🌿", desc: "Giant largemouth prowl.",
          zone: [0.30, 0.44, 0.18, 0.16], bias: { giant: 2.0, walleye: 1.2 } },
        { id: "point", name: "Main-Lake Point", ico: "📍", desc: "Walleye & ancient sturgeon.",
          zone: [0.70, 0.58, 0.18, 0.16], bias: { walleye: 1.8, sturgeon: 1.7 } },
        { id: "hole", name: "Deep Hole", ico: "🕳️", desc: "Something huge lives down there.",
          zone: [0.50, 0.84, 0.24, 0.14], bias: { sturgeon: 2.0, monster: 2.4, walleye: 0.6 } },
        { id: "flat", name: "Moonlit Flat", ico: "🌙", desc: "Glowfish drift in the dark.",
          zone: [0.50, 0.40, 0.26, 0.14], bias: { glowfish: 2.4, walleye: 1.3 } },
      ],
    },
  ];

  const RARITY_COLOR = { junk: "#8a96a0", common: "#9fb3bf", uncommon: "#5be37a", rare: "#5c9bff", legendary: "#ffd35c" };
  const RARITY_MULT  = { junk: 0.5, common: 1, uncommon: 1.4, rare: 2.2, legendary: 4 };
  const RARITY_HARD  = { junk: 0.05, common: 0.2, uncommon: 0.4, rare: 0.65, legendary: 0.9 };

  function fishDef(k) { return F[k]; }

  // ===========================================================================
  // Save / state
  // ===========================================================================
  const SAVE_KEY = "bassbuddy_v2";
  function defaultSave() {
    return {
      coins: 0,
      rod: "twig", ownedRods: ["twig"],
      lure: { id: "worm", color: "green" }, ownedLures: ["worm"],
      spot: "cove", ownedSpots: ["cove"],
      positions: { cove: "pads", river: "riffle", deep: "weed" },
      records: {}, caught: {},
      tourWins: 0, bestBag: 0,
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.coins === "number") {
        const d = defaultSave();
        // shallow-merge with nested guards
        const m = Object.assign(d, s);
        m.lure = Object.assign(d.lure, s.lure || {});
        m.positions = Object.assign(d.positions, s.positions || {});
        return m;
      }
    } catch (e) {}
    return defaultSave();
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
  const G = load();

  const rod  = () => RODS.find(r => r.id === G.rod) || RODS[0];
  const lure = () => LURES.find(l => l.id === G.lure.id) || LURES[0];
  const spot = () => SPOTS.find(s => s.id === G.spot) || SPOTS[0];
  const position = () => { const sp = spot(); return sp.positions.find(p => p.id === G.positions[sp.id]) || sp.positions[0]; };

  // ===========================================================================
  // DOM refs
  // ===========================================================================
  const $ = id => document.getElementById(id);
  const canvas = $("c"), ctx = canvas.getContext("2d");
  const el = {
    coins: $("coins"), rodName: $("rodName"), spotName: $("spotName"), posName: $("posName"),
    lureIco: $("lureIco"), lureName: $("lureName"), lureSwatch: $("lureSwatch"),
    status: $("status"), actionBtn: $("actionBtn"),
    reelGame: $("reelGame"), reelZone: $("reelZone"), reelFishMark: $("reelFishMark"),
    reelProgress: $("reelProgress"), reelTension: $("reelTension"),
    catchModal: $("catchModal"), catchRarity: $("catchRarity"), catchArt: $("catchArt"),
    catchName: $("catchName"), catchWeight: $("catchWeight"), catchReward: $("catchReward"),
    catchRewardWrap: $("catchRewardWrap"), catchRecord: $("catchRecord"), catchTourney: $("catchTourney"), catchOk: $("catchOk"),
    failModal: $("failModal"), failMsg: $("failMsg"), failOk: $("failOk"),
    shopBtn: $("shopBtn"), shopModal: $("shopModal"), shopClose: $("shopClose"), shopCoins: $("shopCoins"),
    shopRods: $("shopRods"), shopLures: $("shopLures"), shopSpots: $("shopSpots"), shopDex: $("shopDex"),
    rodChip: $("rodChip"), lureChip: $("lureChip"), spotChip: $("spotChip"),
    lureModal: $("lureModal"), lureClose: $("lureClose"), lureList: $("lureList"), colorRow: $("colorRow"),
    mapModal: $("mapModal"), mapClose: $("mapClose"), mapVenues: $("mapVenues"), posGrid: $("posGrid"),
    tourneyBtn: $("tourneyBtn"),
    tourHud: $("tourHud"), tourClock: $("tourClock"), livewell: $("livewell"), tourTotal: $("tourTotal"), tourBig: $("tourBig"), tourQuit: $("tourQuit"),
    tourStartModal: $("tourStartModal"), tourFee: $("tourFee"), tourField: $("tourField"), tourStartFee: $("tourStartFee"),
    tourStartBtn: $("tourStartBtn"), tourStartCancel: $("tourStartCancel"), tourRules: $("tourRules"),
    tourResultModal: $("tourResultModal"), tourResultMedal: $("tourResultMedal"), tourPlace: $("tourPlace"),
    tourBag: $("tourBag"), tourResultStats: $("tourResultStats"), tourStandings: $("tourStandings"), tourResultOk: $("tourResultOk"),
    fx: $("fx"),
  };

  // ===========================================================================
  // Canvas sizing
  // ===========================================================================
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const waterLine = () => H * 0.42;
  const rodTip = () => ({ x: W / 2 + 64, y: H - 188 });
  const anglerBase = () => ({ x: W / 2, y: H - 150 });

  // ===========================================================================
  // Fish art (inline SVG, species-accurate cartoon style)
  // ===========================================================================
  let UID = 0;
  function shade(hex, amt) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    r = clamp(r + amt, 0, 255); g = clamp(g + amt, 0, 255); b = clamp(b + amt, 0, 255);
    return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  }
  // build pattern overlay markup for a body of given geometry
  function patternMarkup(a, cx, cy, rx, ry) {
    let s = "";
    const pc = a.patColor || "#33401f";
    if (a.pat === "lateral") {
      s += `<rect x="${cx - rx + 8}" y="${cy - 3}" width="${rx * 1.7}" height="6" rx="3" fill="${pc}" opacity="0.5"/>`;
      for (let i = 0; i < 5; i++) {
        const x = cx - rx + 14 + i * (rx * 1.6 / 5);
        s += `<ellipse cx="${x}" cy="${cy}" rx="5" ry="7" fill="${pc}" opacity="0.45"/>`;
      }
    } else if (a.pat === "bars") {
      for (let i = 0; i < 6; i++) {
        const x = cx - rx + 10 + i * (rx * 1.7 / 6);
        s += `<rect x="${x}" y="${cy - ry + 3}" width="4" height="${ry * 2 - 6}" rx="2" fill="${pc}" opacity="0.4"/>`;
      }
    } else if (a.pat === "trout") {
      s += `<rect x="${cx - rx + 6}" y="${cy - 2}" width="${rx * 1.7}" height="5" rx="2.5" fill="#e3849e" opacity="0.6"/>`;
      const seed = [[-22, -8], [-8, -10], [4, -7], [16, -9], [-16, 6], [0, 7], [14, 5], [26, -4], [-28, 2]];
      for (const [dx, dy] of seed) s += `<circle cx="${cx + dx}" cy="${cy + dy}" r="2.1" fill="#2c3a24" opacity="0.7"/>`;
    } else if (a.pat === "panel") {
      for (let i = 0; i < 5; i++) {
        const x = cx - rx + 14 + i * (rx * 1.5 / 5);
        s += `<rect x="${x}" y="${cy - ry + 4}" width="3" height="${ry * 2 - 8}" rx="1.5" fill="#3a566b" opacity="0.35"/>`;
      }
      s += `<ellipse cx="${cx + rx - 12}" cy="${cy + 4}" rx="5" ry="7" fill="#1c2b3a" opacity="0.8"/>`; // gill spot
    } else if (a.pat === "glow") {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 4}" ry="${ry - 3}" fill="#d6fbff" opacity="0.3"/>`;
      for (const [dx, dy] of [[-18, -6], [2, -8], [16, 4], [-6, 6]]) s += `<circle cx="${cx + dx}" cy="${cy + dy}" r="2" fill="#eafdff"/>`;
    }
    return s;
  }
  function genericFish(a) {
    const id = "g" + (UID++);
    const body = a.body, back = a.back || shade(body, -34), belly = a.belly || "#f4eece";
    const fin = a.fin || shade(back, -6);
    const long = a.shape === "musky";
    const rx = long ? 50 : 40, ry = long ? 14 : 20, cx = 62, cy = 36;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${back}"/><stop offset="0.5" stop-color="${body}"/><stop offset="1" stop-color="${belly}"/></linearGradient></defs>`;
    // tail
    if (a.shape === "catfish") {
      s += `<path d="M${cx - rx + 8},${cy} L10,${cy - 12} Q4,${cy} 10,${cy + 12} Z" fill="${fin}"/>`;
    } else {
      s += `<path d="M${cx - rx + 10},${cy} L8,${cy - 18} L22,${cy} L8,${cy + 18} Z" fill="${fin}"/>`;
    }
    // dorsal fin
    const dy = cy - ry;
    if (a.shape === "walleye" || a.shape === "bass") {
      s += `<path d="M${cx - 18},${dy + 5} q4,-12 10,-11 q2,7 8,7 q2,-9 9,-8 q3,6 9,7 l-2,8 Z" fill="${fin}"/>`; // spiny
    } else {
      s += `<path d="M${cx - 16},${dy + 5} Q${cx},${dy - 13} ${cx + 24},${dy + 6} Z" fill="${fin}"/>`;
    }
    // body
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})" stroke="${shade(back, -12)}" stroke-width="1.5"/>`;
    // pattern
    s += patternMarkup(a, cx, cy, rx, ry);
    // pectoral fin
    s += `<path d="M${cx + 18},${cy + 6} q-8,16 8,15 q4,-7 2,-13 Z" fill="${shade(body, -14)}" opacity="0.85"/>`;
    // gill plate
    s += `<path d="M${cx + rx - 14},${cy - 13} q-7,13 0,26" fill="none" stroke="${shade(back, -8)}" stroke-width="1.5" opacity="0.5"/>`;
    // catfish barbels (whiskers)
    if (a.shape === "catfish") {
      const mx = cx + rx - 2, my = cy + 2;
      s += `<path d="M${mx},${my} q14,-2 22,-12 M${mx},${my} q16,2 24,-2 M${mx},${my + 4} q15,6 24,8 M${mx},${my + 4} q12,8 18,16"
            stroke="${shade(back, -4)}" stroke-width="1.6" fill="none" opacity="0.8" stroke-linecap="round"/>`;
    }
    // eye
    const er = a.bigeye ? 7 : 5.5, eye = a.eye || "#16242b";
    const ex = cx + rx - 9, ey = cy - 4;
    s += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#fff"/>`;
    if (a.bigeye) s += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#f2e7a0" opacity="0.55"/>`;
    s += `<circle cx="${ex + 1}" cy="${ey}" r="${er * 0.55}" fill="${eye}"/><circle cx="${ex - 1}" cy="${ey - 1.5}" r="1.2" fill="#fff"/>`;
    // mouth
    const mx = cx + rx - 1;
    if (a.bigmouth) {
      s += `<path d="M${mx - 2},${cy + 1} q10,1 12,9 q-9,1 -13,-3 Z" fill="${shade(body, -22)}"/>`;
      s += `<path d="M${mx - 3},${cy - 1} l13,3" stroke="${shade(back, -16)}" stroke-width="2" stroke-linecap="round"/>`;
    } else if (a.shape === "musky") {
      s += `<path d="M${mx - 6},${cy} l16,-2 l0,5 l-15,2 Z" fill="${shade(body, -20)}"/>`; // duckbill
      s += `<path d="M${mx - 4},${cy + 1} l15,0" stroke="#eee" stroke-width="1" opacity="0.6"/>`;
    } else {
      s += `<path d="M${mx},${cy} q7,0 8,4" fill="none" stroke="${shade(back, -16)}" stroke-width="2" stroke-linecap="round"/>`;
    }
    if (a.shimmer) for (const [dx, dy2] of [[-14, -8], [6, -6], [-2, 6]]) s += `<path d="M${cx + dx},${cy + dy2} l2,2 l-2,2 l-2,-2 Z" fill="#fff" opacity="0.9"/>`;
    return s;
  }
  function sturgeonFish(a) {
    const id = "g" + (UID++); const body = a.body, back = shade(body, -28), belly = a.belly;
    const cx = 60, cy = 38, rx = 48, ry = 12;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${back}"/><stop offset="1" stop-color="${belly}"/></linearGradient></defs>`;
    // shark-like heterocercal tail (upper lobe longer)
    s += `<path d="M16,${cy} L2,${cy - 24} L20,${cy - 4} L8,${cy + 12} Z" fill="${shade(back, -4)}"/>`;
    // long body tapering to pointed snout (right)
    s += `<path d="M18,${cy} Q40,${cy - ry} 80,${cy - 8} Q104,${cy - 4} 114,${cy} Q104,${cy + 6} 80,${cy + ry} Q40,${cy + ry} 18,${cy} Z" fill="url(#${id})" stroke="${shade(back, -10)}" stroke-width="1.5"/>`;
    // scutes along back
    for (let i = 0; i < 7; i++) { const x = 28 + i * 11; const y = cy - ry + 2 - (x > 80 ? (x - 80) * 0.4 : 0); s += `<path d="M${x},${y} l4,4 l-4,4 l-4,-4 Z" fill="${shade(back, 18)}" opacity="0.8"/>`; }
    // dorsal + pectoral
    s += `<path d="M58,${cy - ry + 2} q10,-9 20,0 Z" fill="${shade(back, -2)}"/>`;
    s += `<path d="M84,${cy + 6} q-8,12 6,12 Z" fill="${shade(back, -2)}"/>`;
    // barbels under snout
    s += `<path d="M104,${cy + 5} q-3,7 -8,9 M108,${cy + 5} q-2,8 -4,11 M100,${cy + 6} q-3,6 -10,7 M96,${cy + 6} q-4,6 -12,6" stroke="${shade(back, 6)}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.85"/>`;
    // eye
    s += `<circle cx="100" cy="${cy - 2}" r="3.5" fill="#fff"/><circle cx="100" cy="${cy - 2}" r="2" fill="#16242b"/>`;
    return s;
  }
  function monsterFish(a) {
    const id = "g" + (UID++); const body = a.body, back = shade(body, -26), belly = a.belly;
    const cy = 40;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${back}"/><stop offset="1" stop-color="${belly}"/></linearGradient></defs>`;
    // tail fin
    s += `<path d="M10,${cy + 4} q-8,-10 0,-18 q6,8 10,10 Z" fill="${shade(back, -4)}"/>`;
    // serpentine humps body
    s += `<path d="M12,${cy + 4} Q26,${cy - 26} 42,${cy} Q56,${cy + 22} 72,${cy} Q86,${cy - 24} 104,${cy - 4}
           Q112,${cy + 2} 108,${cy + 12} Q92,${cy + 6} 78,${cy + 14} Q60,${cy + 24} 46,${cy + 12}
           Q30,${cy + 22} 12,${cy + 4} Z" fill="url(#${id})" stroke="${shade(back, -8)}" stroke-width="2"/>`;
    // back spikes
    for (const [x, y] of [[30, cy - 14], [44, cy + 2], [66, cy + 6], [88, cy - 12]]) s += `<path d="M${x - 5},${y} l5,-10 l5,10 Z" fill="${shade(back, 14)}"/>`;
    // head (right) — dino snout
    s += `<path d="M98,${cy - 8} q16,-4 18,8 q1,9 -8,11 q-12,2 -14,-6 Z" fill="${shade(body, 6)}" stroke="${shade(back, -8)}" stroke-width="1.5"/>`;
    // horn
    s += `<path d="M104,${cy - 8} l3,-9 l4,7 Z" fill="${shade(back, 18)}"/>`;
    // eye + nostril + teeth
    s += `<circle cx="108" cy="${cy - 1}" r="3.4" fill="#ffec70"/><circle cx="109" cy="${cy - 1}" r="1.7" fill="#101"/>`;
    s += `<path d="M101,${cy + 9} l3,-4 l3,4 l3,-4 l3,4" stroke="#fff" stroke-width="1.4" fill="none"/>`;
    return s;
  }
  function bootArt() {
    return `<g stroke="#2a2622" stroke-width="2" stroke-linejoin="round">
      <path d="M44,8 L66,8 Q72,8 72,16 L74,46 Q92,48 100,58 Q104,66 96,66 L40,66 Q32,66 32,56 L34,18 Q34,8 44,8 Z" fill="#5a4632"/>
      <path d="M32,56 L96,56 L96,66 L40,66 Q32,66 32,56 Z" fill="#3a2c1e"/>
      <path d="M40,20 L70,20" stroke="#7a6047"/><circle cx="46" cy="32" r="2" fill="#7c5a3a"/></g>`;
  }
  function canArt() {
    return `<g stroke="#5a6066" stroke-width="2"><rect x="40" y="14" width="44" height="46" rx="4" fill="#b9c2c8"/>
      <ellipse cx="62" cy="14" rx="22" ry="6" fill="#d7dee3"/><ellipse cx="62" cy="14" rx="22" ry="6" fill="none"/>
      <rect x="46" y="26" width="32" height="20" rx="2" fill="#d94f3a" stroke="none"/>
      <path d="M40,38 q44,8 44,0" fill="none" stroke="#8c969d" stroke-width="1.5"/></g>`;
  }
  function fishSVG(fishOrArt, size) {
    const a = (fishOrArt && fishOrArt.art) ? fishOrArt.art : fishOrArt;
    let inner;
    if (a.shape === "sturgeon") inner = sturgeonFish(a);
    else if (a.shape === "monster") inner = monsterFish(a);
    else if (a.shape === "boot") inner = bootArt();
    else if (a.shape === "can") inner = canArt();
    else inner = genericFish(a);
    const w = size || 120, h = Math.round((size || 120) * 0.6);
    return `<svg viewBox="0 0 124 72" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  // ===========================================================================
  // Game state
  // ===========================================================================
  const S = {
    mode: "idle",   // idle | casting | waiting | bite | reeling | caught
    bobber: { x: 0, y: 0, sx: 0, sy: 0, targetX: 0, targetY: 0, flyT: 0, dist: 0 },
    castBonus: false,
    biteTimer: 0, biteWindow: 0,
    hookedFish: null,
    reel: { fishPos: 0.5, fishVel: 0, zoneCenter: 0.5, zoneSize: 0.28, progress: 0, vy: 0, jitter: 1, speed: 1 },
    holding: false,
    fishes: [], ripples: [],
    aim: null,      // pulsing reticle for last/queued cast point
    tournament: null,
  };

  function seedFish() {
    S.fishes = [];
    for (let i = 0; i < 5; i++) {
      S.fishes.push({
        x: Math.random() * W,
        y: waterLine() + 40 + Math.random() * (H - waterLine() - 160),
        dir: Math.random() < 0.5 ? -1 : 1,
        spd: 0.2 + Math.random() * 0.5,
        size: 10 + Math.random() * 16,
        wob: Math.random() * 6.28,
      });
    }
  }
  seedFish();

  // ===========================================================================
  // Helpers
  // ===========================================================================
  function setStatus(txt, bite) {
    el.status.textContent = txt || "";
    el.status.classList.toggle("bite", !!bite);
    el.status.style.opacity = txt ? "1" : "0";
  }
  function setBtn(txt, cls) {
    el.actionBtn.textContent = txt;
    el.actionBtn.className = "action-btn" + (cls ? " " + cls : "");
  }
  function showBtn(on) { el.actionBtn.classList.toggle("hidden", !on); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
  function anyModalOpen() {
    return [el.catchModal, el.failModal, el.shopModal, el.lureModal, el.mapModal,
            el.tourStartModal, el.tourResultModal].some(m => !m.classList.contains("hidden"));
  }

  function floatText(txt, color) {
    const d = document.createElement("div");
    d.className = "float"; d.textContent = txt;
    if (color) d.style.color = color;
    d.style.left = (W / 2 - 30 + rnd(-20, 20)) + "px";
    d.style.top = (H * 0.5) + "px";
    el.fx.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }
  function toast(txt) {
    const d = document.createElement("div");
    d.className = "toast"; d.innerHTML = txt;
    el.fx.appendChild(d);
    setTimeout(() => d.remove(), 1900);
  }

  function updateHUD() {
    el.coins.textContent = G.coins;
    el.rodName.textContent = rod().name;
    el.spotName.textContent = spot().name;
    el.posName.textContent = position().name;
    const lu = lure();
    el.lureIco.textContent = lu.ico;
    el.lureName.textContent = lu.name.split(" ")[lu.name.split(" ").length - 1];
    el.lureSwatch.style.background = COLORS[G.lure.color].hex;
  }

  // ===========================================================================
  // Fish selection — venue table × position bias × lure × rod luck
  // ===========================================================================
  function pickFish() {
    const sp = spot(), pos = position(), lu = lure(), luck = rod().luck;
    const colorFam = COLORS[G.lure.color].fam;
    const clarityMatch = colorFam === sp.clarity;

    const table = sp.fish.map(entry => {
      const def = fishDef(entry.k);
      let w = entry.weight;
      // position structure bias
      w *= (pos.bias && pos.bias[entry.k]) || 1;
      // lure biases
      if (def.lm) w *= lu.lmBias;
      else if (def.name.includes("Bass")) w *= lu.bassBias;
      if (def.rarity === "rare") w *= lu.rareBias * (1 + luck * 4);
      if (def.rarity === "legendary") w *= lu.rareBias * (1 + luck * 6);
      if (def.rarity === "junk") w *= lu.junk * Math.max(0.2, 1 - luck * 2);
      // color match nudges rarer fish up a touch
      if (clarityMatch && (def.rarity === "rare" || def.rarity === "legendary")) w *= 1.2;
      // cast landed on the structure: better odds of the good stuff
      if (S.castBonus && (def.rarity === "rare" || def.rarity === "legendary" || def.lm)) w *= 1.25;
      return { def, w: Math.max(0.0001, w) };
    });

    const total = table.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, chosen = table[0].def;
    for (const x of table) { r -= x.w; if (r <= 0) { chosen = x.def; break; } }

    // weight roll, biased bigger by rod power + lure size bias
    let lo = chosen.w[0], hi = chosen.w[1];
    if (lu.minSize) lo = lo + (hi - lo) * (lu.minSize - 1) * 0.4; // swimbait filters small
    const sizePush = clamp((rod().power - 1) * 0.4 + (lu.sizeBias - 1) * 0.5 + (S.castBonus ? 0.08 : 0), 0, 0.7);
    const roll = Math.pow(Math.random(), 1.7 - sizePush);
    const weight = +(lo + (hi - lo) * roll).toFixed(1);

    const rangeFrac = (weight - lo) / Math.max(0.01, hi - lo);
    const difficulty = clamp(RARITY_HARD[chosen.rarity] * 0.6 + rangeFrac * 0.5, 0.05, 0.98);
    const value = Math.max(1, Math.round(chosen.base * (0.6 + weight / hi) * RARITY_MULT[chosen.rarity]));
    return { def: chosen, name: chosen.name, art: chosen.art, rarity: chosen.rarity, lm: !!chosen.lm, weight, difficulty, value };
  }

  // ===========================================================================
  // Input
  // ===========================================================================
  canvas.addEventListener("pointerdown", (e) => {
    if (anyModalOpen()) return;
    if (S.mode === "idle") {
      const rect = canvas.getBoundingClientRect();
      castTo(e.clientX - rect.left, e.clientY - rect.top);
    } else if (S.mode === "bite") {
      hookSet();
    } else if (S.mode === "reeling") {
      S.holding = true;
    }
  });
  function release() { if (S.mode === "reeling") S.holding = false; }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  el.actionBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (S.mode === "bite") hookSet();
    else if (S.mode === "reeling") S.holding = true;
  });
  el.actionBtn.addEventListener("pointerup", (e) => { e.preventDefault(); release(); });
  el.actionBtn.addEventListener("pointercancel", release);
  el.actionBtn.addEventListener("pointerleave", release);

  // ===========================================================================
  // Flow
  // ===========================================================================
  function castTo(px, py) {
    const wl = waterLine();
    if (py < wl + 10) py = wl + 18;                 // keep it in the water
    const tip = rodTip();
    // clamp within casting range (rod power)
    const maxR = clamp(H * (0.42 + rod().power * 0.16), 180, H * 0.9);
    let dx = px - tip.x, dy = py - tip.y, d = Math.hypot(dx, dy);
    if (d > maxR) { px = tip.x + dx / d * maxR; py = tip.y + dy / d * maxR; }
    py = clamp(py, wl + 16, H - 150);
    px = clamp(px, 26, W - 26);

    S.mode = "casting";
    S.bobber.sx = tip.x; S.bobber.sy = tip.y;
    S.bobber.x = tip.x; S.bobber.y = tip.y;
    S.bobber.targetX = px; S.bobber.targetY = py;
    S.bobber.flyT = 0;
    S.bobber.dist = Math.hypot(px - tip.x, py - tip.y) / maxR;
    // bonus if landing on the chosen structure's hot zone
    const hz = hotZone();
    S.castBonus = Math.hypot(px - hz.x, py - hz.y) < hz.r;
    showBtn(false);
    setStatus("");
    S.aim = { x: px, y: py, t: 0 };
  }

  function startWaiting() {
    S.mode = "waiting";
    showBtn(false);
    setStatus(S.castBonus ? "On the spot! Wait for it…" : "Wait for it…");
    const lu = lure();
    let base = rnd(1100, 4000);
    base /= lu.bite;                                  // faster lures bite sooner
    if (COLORS[G.lure.color].fam === spot().clarity) base *= 0.8; // right color
    if (S.castBonus) base *= 0.7;                     // good structure
    S.biteTimer = Math.max(500, base);
    ripple(S.bobber.x, S.bobber.y);
  }

  function triggerBite() {
    S.mode = "bite";
    S.hookedFish = pickFish();
    S.biteWindow = 1500 - S.hookedFish.difficulty * 600;
    showBtn(true);
    setBtn("TAP TO HOOK!", "hook");
    setStatus("FISH ON!", true);
    vibrate(40);
    ripple(S.bobber.x, S.bobber.y); ripple(S.bobber.x, S.bobber.y);
  }

  function missedBite() {
    resetToIdle();
    showFail("Too slow — it spat the hook!");
  }

  function hookSet() {
    const f = S.hookedFish;
    S.mode = "reeling";
    showBtn(true);
    setBtn("HOLD TO REEL!", "reel");
    setStatus("");
    el.reelGame.classList.remove("hidden");
    el.reelTension.classList.remove("hidden");
    const d = f.difficulty;
    const R = S.reel;
    R.fishPos = 0.5; R.fishVel = 0; R.zoneCenter = 0.5; R.vy = 0; R.progress = 0.14;
    R.zoneSize = clamp(0.30 - d * 0.14, 0.13, 0.30) * (1 + rod().power * 0.10);
    R.jitter = 0.5 + d * 1.6;
    R.speed = 0.5 + d * 0.9;
    el.reelFishMark.innerHTML = fishSVG(f, 38);
    S.holding = false;
    vibrate(30);
  }

  function landFish() {
    const f = S.hookedFish;
    S.mode = "caught";
    el.reelGame.classList.add("hidden");
    el.reelTension.classList.add("hidden");
    showBtn(false);

    // dex + records always
    G.caught[f.name] = (G.caught[f.name] || 0) + 1;
    const prev = G.records[f.name] || 0;
    const isRecord = f.weight > prev;
    if (isRecord) G.records[f.name] = f.weight;

    if (S.tournament) { tourLand(f, isRecord, prev); save(); return; }

    G.coins += f.value;
    save(); updateHUD();
    vibrate([20, 40, 30]);
    showCatch(f, isRecord, prev);
  }

  function showCatch(f, isRecord, prev) {
    el.catchRarity.textContent = f.rarity.toUpperCase();
    el.catchRarity.style.background = RARITY_COLOR[f.rarity];
    el.catchRarity.style.color = f.rarity === "legendary" ? "#5a3a00" : "#06222c";
    el.catchArt.innerHTML = fishSVG(f, 170);
    el.catchName.textContent = f.name;
    el.catchWeight.textContent = f.weight;
    el.catchReward.textContent = f.value;
    el.catchRewardWrap.classList.remove("hidden");
    el.catchRecord.textContent = isRecord && prev > 0 ? "🏆 NEW PERSONAL BEST!" : isRecord ? "🏆 FIRST CATCH!" : "";
    el.catchTourney.classList.add("hidden");
    el.catchOk.textContent = "NICE! KEEP FISHING";
    el.catchModal.classList.remove("hidden");
  }

  function loseFish(msg) {
    if (S.tournament) { S.mode = "idle"; el.reelGame.classList.add("hidden"); el.reelTension.classList.add("hidden"); showBtn(false); vibrate(120); toast("💨 " + (msg || "It got off!")); setStatus("Tap the water to cast"); return; }
    resetToIdle();
    vibrate(120);
    showFail(msg || "The line snapped!");
  }

  function showFail(msg) { el.failMsg.textContent = msg; el.failModal.classList.remove("hidden"); }

  function resetToIdle() {
    S.mode = "idle";
    S.hookedFish = null;
    S.castBonus = false;
    el.reelGame.classList.add("hidden");
    el.reelTension.classList.add("hidden");
    showBtn(false);
    setStatus(S.tournament ? "Tap the water to cast" : "Tap the water to cast 🎣");
  }

  function ripple(x, y) { S.ripples.push({ x, y, r: 4, a: 0.7 }); }

  // ===========================================================================
  // Tournament mode
  // ===========================================================================
  function tourConfig() {
    const sp = spot();
    const dur = 150000; // 2:30
    const fee = sp.id === "deep" ? 150 : sp.id === "river" ? 90 : 50;
    const field = 10;
    return { dur, fee, field };
  }
  function openTourStart() {
    if (S.tournament) return;
    const cfg = tourConfig();
    el.tourFee.textContent = cfg.fee;
    el.tourStartFee.textContent = cfg.fee;
    el.tourField.textContent = cfg.field;
    el.tourRules.textContent = `${spot().name} • ${Math.round(cfg.dur / 60000)}:${String(Math.round(cfg.dur / 1000) % 60).padStart(2, "0")} on the clock.`;
    el.tourStartBtn.disabled = G.coins < cfg.fee;
    el.tourStartBtn.style.opacity = G.coins < cfg.fee ? "0.5" : "1";
    el.tourStartModal.classList.remove("hidden");
  }
  function startTournament() {
    const cfg = tourConfig();
    if (G.coins < cfg.fee) { toast("Not enough 🪙 for entry"); return; }
    G.coins -= cfg.fee; updateHUD();
    el.tourStartModal.classList.add("hidden");
    S.tournament = { timeLeft: cfg.dur, dur: cfg.dur, well: [], big: 0, culls: 0, field: cfg.field, fee: cfg.fee, spotId: spot().id, ended: false };
    el.tourHud.classList.remove("hidden");
    document.getElementById("loadout").classList.add("hidden");
    renderWell();
    resetToIdle();
    toast("🏁 Lines in! Boat your best 5 largemouth!");
    save();
  }
  function tourLand(f, isRecord, prev) {
    const T = S.tournament;
    if (!f.lm) {
      toast(`Released — ${f.name}<br><small>only largemouth count</small>`);
      vibrate(20);
      resetToIdle();
      return;
    }
    const entry = { name: f.name, weight: f.weight, art: f.art };
    let msg = "";
    if (T.well.length < 5) {
      T.well.push(entry);
      msg = `🪣 Live well: ${T.well.length}/5<br><b>${f.weight} lb largemouth</b>`;
    } else {
      // auto-cull smallest
      let minI = 0; for (let i = 1; i < T.well.length; i++) if (T.well[i].weight < T.well[minI].weight) minI = i;
      if (f.weight > T.well[minI].weight) {
        const culled = T.well[minI].weight;
        T.well[minI] = entry; T.culls++;
        msg = `♻️ Culled ${culled} lb<br><b>Upgraded to ${f.weight} lb!</b>`;
      } else {
        T.culls++;
        msg = `♻️ Too small — released<br><small>${f.weight} lb didn't make your top 5</small>`;
      }
    }
    if (f.weight > T.big) T.big = f.weight;
    vibrate([20, 40, 30]);
    renderWell();
    toast(msg);
    resetToIdle();
  }
  function wellTotal() { return S.tournament ? S.tournament.well.reduce((s, x) => s + x.weight, 0) : 0; }
  function renderWell() {
    const T = S.tournament; if (!T) return;
    let html = "";
    const big = T.big;
    for (let i = 0; i < 5; i++) {
      const fish = T.well[i];
      if (fish) {
        const isBig = fish.weight === big && big > 0;
        html += `<div class="well-slot full ${isBig ? "big" : ""}">${fishSVG(fish, 26)}<span>${fish.weight}</span></div>`;
      } else {
        html += `<div class="well-slot"><span>—</span></div>`;
      }
    }
    el.livewell.innerHTML = html;
    el.tourTotal.textContent = wellTotal().toFixed(2);
    el.tourBig.textContent = big > 0 ? `Big: ${big} lb` : "";
  }
  function updateTourClock(dt) {
    const T = S.tournament; if (!T || T.ended) return;
    // clock pauses while a blocking modal is open (reading the catch, shop, etc.)
    if (anyModalOpen()) return;
    T.timeLeft -= dt;
    const sec = Math.max(0, Math.ceil(T.timeLeft / 1000));
    el.tourClock.textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
    el.tourClock.parentElement.classList.toggle("low", sec <= 30);
    if (T.timeLeft <= 0) endTournament();
  }
  function endTournament() {
    const T = S.tournament; if (!T || T.ended) return;
    T.ended = true;
    // bail out of any active fight
    S.mode = "idle"; S.hookedFish = null;
    el.reelGame.classList.add("hidden"); el.reelTension.classList.add("hidden"); showBtn(false);

    const myTotal = wellTotal();
    // AI field — winning bags scale with venue
    const sp = SPOTS.find(s => s.id === T.spotId) || spot();
    const tier = sp.id === "deep" ? 1.7 : sp.id === "river" ? 1.25 : 1.0;
    const ai = [];
    for (let i = 0; i < T.field - 1; i++) {
      const n = 3 + Math.floor(Math.random() * 3); // 3–5 fish
      let wt = 0; for (let j = 0; j < n; j++) wt += rnd(1.2, 6.0) * tier;
      ai.push({ name: "AI Angler " + (i + 1), total: +wt.toFixed(2), big: +rnd(2, 7 * tier).toFixed(1), me: false });
    }
    const me = { name: "You", total: +myTotal.toFixed(2), big: +T.big.toFixed(1), me: true, fish: T.well.length };
    const board = ai.concat([me]).sort((a, b) => b.total - a.total);
    const place = board.findIndex(x => x.me) + 1;

    // payouts
    const fee = T.fee;
    let payout = 0;
    if (place === 1) payout = fee * 6;
    else if (place === 2) payout = fee * 3.5;
    else if (place === 3) payout = fee * 2.2;
    else if (place <= Math.ceil(T.field / 2)) payout = fee * 1.2;
    else payout = Math.round(fee * 0.4);
    payout = Math.round(payout);
    let bigBonus = 0;
    const fieldBigTop = Math.max(...board.map(b => b.big));
    if (T.big > 0 && T.big >= fieldBigTop) { bigBonus = Math.round(fee * 1.5); payout += bigBonus; }

    G.coins += payout;
    if (place === 1) G.tourWins = (G.tourWins || 0) + 1;
    if (myTotal > (G.bestBag || 0)) G.bestBag = +myTotal.toFixed(2);
    save(); updateHUD();

    // results UI
    const ord = ["", "1st", "2nd", "3rd"][place] || (place + "th");
    el.tourPlace.textContent = ord + " Place";
    el.tourResultMedal.textContent = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🎣";
    el.tourBag.innerHTML = T.well.length
      ? T.well.slice().sort((a, b) => b.weight - a.weight).map(f => `<div class="bag-fish">${fishSVG(f, 40)}<b>${f.weight}</b></div>`).join("")
      : `<p class="muted">No keepers in the well — better luck next time!</p>`;
    el.tourResultStats.innerHTML =
      `5-fish bag: <b>${myTotal.toFixed(2)} lb</b> (${me.fish} fish)<br>` +
      `Big bass: <b>${T.big ? T.big.toFixed(1) + " lb" : "—"}</b>${bigBonus ? ` &nbsp;<span style="color:var(--gold)">+${bigBonus} 🪙 Big Bass!</span>` : ""}<br>` +
      `Payout: <b>${payout} 🪙</b>` + (place === 1 ? "  🏆" : "");
    el.tourStandings.innerHTML = board.map((b, i) =>
      `<div class="stand-row ${b.me ? "me" : ""}"><span>${i + 1}. ${b.name}</span><span class="w">${b.total.toFixed(2)} lb</span></div>`).join("");
    el.tourResultModal.classList.remove("hidden");
    const meRow = el.tourStandings.querySelector(".me");
    if (meRow) el.tourStandings.scrollTop = Math.max(0, meRow.offsetTop - el.tourStandings.clientHeight / 2);
  }
  function closeTournament() {
    S.tournament = null;
    el.tourHud.classList.add("hidden");
    document.getElementById("loadout").classList.remove("hidden");
    el.tourResultModal.classList.add("hidden");
    el.tourClock.parentElement.classList.remove("low");
    resetToIdle();
    updateHUD();
  }

  el.tourneyBtn.addEventListener("click", () => { if (S.tournament) { /* already running */ toast("Tournament in progress ⏱️"); } else openTourStart(); });
  el.tourStartBtn.addEventListener("click", startTournament);
  el.tourStartCancel.addEventListener("click", () => el.tourStartModal.classList.add("hidden"));
  el.tourQuit.addEventListener("click", () => {
    if (!S.tournament) return;
    if (S.tournament.well.length) endTournament();   // weigh in what you have
    else { toast("Tournament cancelled"); closeTournament(); }
  });
  el.tourResultOk.addEventListener("click", closeTournament);

  // ===========================================================================
  // Update loop
  // ===========================================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }

  function update(dt, now) {
    if (S.tournament && !S.tournament.ended) updateTourClock(dt);

    if (S.mode === "casting") {
      S.bobber.flyT += dt / 520;
      const p = clamp(S.bobber.flyT, 0, 1);
      S.bobber.x = S.bobber.sx + (S.bobber.targetX - S.bobber.sx) * p;
      const arc = Math.sin(p * Math.PI) * (60 + S.bobber.dist * 130);
      S.bobber.y = S.bobber.sy + (S.bobber.targetY - S.bobber.sy) * p - arc;
      if (p >= 1) { S.bobber.y = S.bobber.targetY; startWaiting(); }
    }
    if (S.mode === "waiting") {
      S.biteTimer -= dt;
      S.bobber.y = S.bobber.targetY + Math.sin(now / 600) * 3;
      if (S.biteTimer <= 0) triggerBite();
    }
    if (S.mode === "bite") {
      S.biteWindow -= dt;
      S.bobber.y = S.bobber.targetY + Math.sin(now / 70) * 6;
      if (Math.random() < 0.25) ripple(S.bobber.x, S.bobber.y);
      if (S.biteWindow <= 0) missedBite();
    }
    if (S.mode === "reeling") updateReel(dt, now);

    for (const f of S.fishes) {
      f.x += f.dir * f.spd * dt * 0.06;
      f.wob += dt * 0.004;
      if (f.x < -30) { f.x = W + 30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
      if (f.x > W + 30) { f.x = -30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
    }
    for (const r of S.ripples) { r.r += dt * 0.05; r.a -= dt * 0.0012; }
    S.ripples = S.ripples.filter(r => r.a > 0);
    if (S.aim) { S.aim.t += dt; if (S.mode !== "casting" && S.mode !== "idle") S.aim = null; }
  }

  function updateReel(dt, now) {
    const R = S.reel, d = S.hookedFish.difficulty, step = dt / 16.67;
    R.fishVel += (Math.random() - 0.5) * R.jitter * 0.004 * step;
    if (Math.random() < (0.02 + d * 0.03) * step) R.fishVel += (Math.random() - 0.5) * R.speed * 0.04;
    R.fishVel = clamp(R.fishVel, -0.02 * R.speed, 0.02 * R.speed);
    R.fishPos += R.fishVel * step;
    if (R.fishPos < 0.06) { R.fishPos = 0.06; R.fishVel = Math.abs(R.fishVel); }
    if (R.fishPos > 0.94) { R.fishPos = 0.94; R.fishVel = -Math.abs(R.fishVel); }

    if (S.holding) R.vy -= 0.0011 * step; else R.vy += 0.0009 * step;
    R.vy *= 0.90;
    R.zoneCenter += R.vy * step;
    const half = R.zoneSize / 2;
    if (R.zoneCenter < half) { R.zoneCenter = half; R.vy = 0; }
    if (R.zoneCenter > 1 - half) { R.zoneCenter = 1 - half; R.vy = 0; }

    const onFish = Math.abs(R.zoneCenter - R.fishPos) < half;
    if (onFish) {
      R.progress += 0.0052 * (1.25 - d * 0.45) * step;
      el.reelTension.classList.remove("warn"); el.reelTension.textContent = "REEL IT IN!";
    } else {
      R.progress -= 0.0016 * (0.7 + d * 0.6) * step;
      el.reelTension.classList.add("warn"); el.reelTension.textContent = "KEEP ON IT!";
    }
    if (R.progress >= 1) { landFish(); return; }
    if (R.progress <= 0) { loseFish("The bass slipped the hook!"); return; }

    el.reelProgress.style.height = (R.progress * 100) + "%";
    el.reelZone.style.height = (R.zoneSize * 100) + "%";
    el.reelZone.style.top = ((R.zoneCenter - half) * 100) + "%";
    el.reelFishMark.style.top = (R.fishPos * 100) + "%";
  }

  // hot zone (chosen structure) in screen coords
  function hotZone() {
    const pos = position(), wl = waterLine();
    const z = pos.zone; // [cxFrac, cyFracOfWater, rxFrac, ryFracOfWater]
    return {
      x: z[0] * W,
      y: wl + z[1] * (H - wl),
      r: Math.min(z[2] * W, z[3] * (H - wl)) + 24,
      rx: z[2] * W, ry: z[3] * (H - wl),
      ico: pos.ico, name: pos.name,
    };
  }

  // ===========================================================================
  // Render
  // ===========================================================================
  function render(now) {
    const sp = spot(), wl = waterLine();
    const sky = ctx.createLinearGradient(0, 0, 0, wl);
    sky.addColorStop(0, sp.sky[0]); sky.addColorStop(1, sp.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, wl);

    const isNight = sp.id === "deep";
    ctx.beginPath(); ctx.arc(W * 0.78, wl * 0.42, 34, 0, 6.29);
    ctx.fillStyle = isNight ? "rgba(230,235,255,.9)" : "rgba(255,238,170,.95)"; ctx.fill();

    ctx.fillStyle = isNight ? "rgba(20,30,60,.6)" : "rgba(70,150,120,.45)";
    ctx.beginPath(); ctx.moveTo(0, wl);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, wl - 26 - Math.sin(x * 0.01 + 1) * 18 - Math.sin(x * 0.03) * 8);
    ctx.lineTo(W, wl); ctx.closePath(); ctx.fill();

    const water = ctx.createLinearGradient(0, wl, 0, H);
    water.addColorStop(0, sp.water[0]); water.addColorStop(1, sp.water[1]);
    ctx.fillStyle = water; ctx.fillRect(0, wl, W, H - wl);

    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = wl + 20 + i * (H - wl) / 8;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 24) { const yy = y + Math.sin(x * 0.03 + now / 700 + i) * 3; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }

    // chosen structure hot zone (where the good fish are)
    if (S.mode === "idle" || S.mode === "casting" || S.mode === "waiting") drawHotZone(now);

    // ambient fish
    for (const f of S.fishes) {
      ctx.save(); ctx.translate(f.x, f.y + Math.sin(f.wob) * 3); ctx.scale(f.dir, 1);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-f.size, 0); ctx.lineTo(-f.size - 8, -6); ctx.lineTo(-f.size - 8, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    for (const r of S.ripples) {
      ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, r.a) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 6.29); ctx.stroke();
    }

    // aim reticle
    if (S.aim && S.mode === "idle") {
      const pulse = 10 + Math.sin(now / 200) * 3;
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S.aim.x, S.aim.y, pulse, 0, 6.29); ctx.stroke();
    }

    drawAngler();

    if (["casting", "waiting", "bite", "reeling"].includes(S.mode)) {
      const tip = rodTip();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
      const midX = (tip.x + S.bobber.x) / 2, midY = (tip.y + S.bobber.y) / 2 + 18;
      ctx.quadraticCurveTo(midX, midY, S.bobber.x, S.bobber.y); ctx.stroke();
      // bobber
      ctx.beginPath(); ctx.arc(S.bobber.x, S.bobber.y, 7, 0, 6.29); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(S.bobber.x, S.bobber.y - 1, 7, Math.PI, 0); ctx.fillStyle = "#ff4d3d"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.arc(S.bobber.x, S.bobber.y, 7, 0, 6.29); ctx.stroke();
    }
  }

  function drawHotZone(now) {
    const hz = hotZone();
    ctx.save();
    const a = 0.10 + Math.sin(now / 500) * 0.04;
    const grd = ctx.createRadialGradient(hz.x, hz.y, 4, hz.x, hz.y, Math.max(hz.rx, hz.ry));
    grd.addColorStop(0, "rgba(255,211,92," + (a + 0.12) + ")");
    grd.addColorStop(1, "rgba(255,211,92,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(hz.x, hz.y, hz.rx, hz.ry, 0, 0, 6.29); ctx.fill();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(255,235,170,0.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(hz.x, hz.y, hz.rx, hz.ry, 0, 0, 6.29); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(hz.ico, hz.x, hz.y - hz.ry - 12);
    ctx.restore();
  }

  function drawAngler() {
    const b = anglerBase(); const x = b.x, y = b.y;
    ctx.save();
    ctx.fillStyle = "rgba(60,40,25,.7)"; ctx.fillRect(x - 70, y + 40, 90, 10);
    ctx.fillStyle = "rgba(20,30,40,.85)";
    ctx.beginPath(); ctx.ellipse(x - 30, y + 22, 16, 22, 0, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 30, y - 6, 11, 0, 6.29); ctx.fill();
    ctx.fillStyle = "rgba(40,90,70,.9)";
    ctx.beginPath(); ctx.ellipse(x - 30, y - 14, 16, 5, 0, 0, 6.29); ctx.fill();
    ctx.fillRect(x - 38, y - 24, 16, 11);
    ctx.strokeStyle = "rgba(120,80,40,.95)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 20, y + 6); ctx.lineTo(x + 64, y - 38); ctx.stroke();
    ctx.restore();
  }

  // ===========================================================================
  // Modals: catch / fail
  // ===========================================================================
  el.catchOk.addEventListener("click", () => {
    el.catchModal.classList.add("hidden");
    if (!S.tournament && S.hookedFish) floatText("+" + S.hookedFish.value + " 🪙", "#ffd35c");
    resetToIdle();
  });
  el.failOk.addEventListener("click", () => { el.failModal.classList.add("hidden"); resetToIdle(); });

  // ===========================================================================
  // Lure tray
  // ===========================================================================
  function openLures() { renderLures(); el.lureModal.classList.remove("hidden"); }
  function renderLures() {
    el.lureList.innerHTML = LURES.map(l => {
      const owned = G.ownedLures.includes(l.id);
      const sel = G.lure.id === l.id;
      return `<div class="lure-opt ${sel ? "sel" : ""} ${owned ? "" : "locked"}" data-lure="${l.id}" data-owned="${owned}">
        <div class="ico">${l.ico}</div>
        <div class="info"><div class="nm">${l.name}</div><div class="ds">${l.desc}</div></div>
        <div class="tag">${owned ? (sel ? "✓" : "TAP") : "🔒 " + l.price + "🪙"}</div></div>`;
    }).join("");
    renderColors();
  }
  function renderColors() {
    const l = lure();
    el.colorRow.innerHTML = l.colors.map(c => {
      const col = COLORS[c];
      const sel = G.lure.color === c;
      const good = col.fam === spot().clarity;
      return `<div class="color-dot ${sel ? "sel" : ""}" data-color="${c}" style="background:${col.hex}">
        <small>${col.name}${good ? " ⭐" : ""}</small></div>`;
    }).join("");
  }
  el.lureChip.addEventListener("click", openLures);
  el.lureClose.addEventListener("click", () => el.lureModal.classList.add("hidden"));
  el.lureModal.addEventListener("click", (e) => {
    const opt = e.target.closest(".lure-opt");
    const dot = e.target.closest(".color-dot");
    if (opt) {
      if (opt.dataset.owned === "true") {
        G.lure.id = opt.dataset.lure;
        const l = lure();
        if (!l.colors.includes(G.lure.color)) G.lure.color = l.colors[0];
        save(); updateHUD(); renderLures();
      } else {
        toast("Buy this lure in the 🛒 shop");
      }
    } else if (dot) {
      G.lure.color = dot.dataset.color; save(); updateHUD(); renderColors();
    }
  });

  // ===========================================================================
  // Map: venue + position
  // ===========================================================================
  function openMap() { renderMap(); el.mapModal.classList.remove("hidden"); }
  function renderMap() {
    el.mapVenues.innerHTML = SPOTS.map(s => {
      const owned = G.ownedSpots.includes(s.id);
      const sel = G.spot === s.id;
      return `<div class="venue ${sel ? "sel" : ""} ${owned ? "" : "locked"}" data-venue="${s.id}" data-owned="${owned}">
        <div class="ico">${s.ico}</div>
        <div class="info"><div class="nm">${s.name}</div><div class="ds">${s.desc}</div></div>
        <div class="lk">${owned ? (sel ? "HERE" : "GO") : "🔒 " + s.price + "🪙"}</div></div>`;
    }).join("");
    renderPositions();
  }
  function renderPositions() {
    const sp = spot();
    el.posGrid.innerHTML = sp.positions.map(p => {
      const sel = G.positions[sp.id] === p.id;
      return `<div class="pos-cell ${sel ? "sel" : ""}" data-pos="${p.id}">
        <div class="pi">${p.ico}</div><div class="pn">${p.name}</div><div class="pd">${p.desc}</div></div>`;
    }).join("");
  }
  el.spotChip.addEventListener("click", openMap);
  el.mapClose.addEventListener("click", () => el.mapModal.classList.add("hidden"));
  el.mapModal.addEventListener("click", (e) => {
    const v = e.target.closest(".venue");
    const p = e.target.closest(".pos-cell");
    if (v) {
      if (v.dataset.owned === "true") {
        if (G.spot !== v.dataset.venue) { G.spot = v.dataset.venue; seedFish(); resetToIdle(); }
        save(); updateHUD(); renderMap();
      } else { toast("Unlock this spot in the 🛒 shop"); }
    } else if (p) {
      G.positions[spot().id] = p.dataset.pos; save(); updateHUD(); renderPositions();
    }
  });

  // ===========================================================================
  // Shop
  // ===========================================================================
  el.rodChip.addEventListener("click", () => { openShop(); switchTab("rods"); });
  function openShop() { el.shopModal.classList.remove("hidden"); renderShop(); }
  function switchTab(tab) {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
    el.shopRods.classList.toggle("hidden", tab !== "rods");
    el.shopLures.classList.toggle("hidden", tab !== "lures");
    el.shopSpots.classList.toggle("hidden", tab !== "spots");
    el.shopDex.classList.toggle("hidden", tab !== "dex");
  }
  function renderShop() {
    el.shopCoins.textContent = G.coins;
    // Rods
    el.shopRods.innerHTML = RODS.map(r => {
      const owned = G.ownedRods.includes(r.id), eq = G.rod === r.id;
      const btn = owned ? (eq ? `<button class="item-btn equipped" disabled>EQUIPPED</button>` : `<button class="item-btn owned" data-equip-rod="${r.id}">EQUIP</button>`)
                        : `<button class="item-btn buy" data-buy-rod="${r.id}" ${G.coins < r.price ? "disabled" : ""}>${r.price} 🪙</button>`;
      return `<div class="item"><div class="item-ico">${r.ico}</div><div class="item-info"><div class="item-name">${r.name}</div>
        <div class="item-desc">${r.desc} · Power ${r.power.toFixed(2)}× · Luck +${Math.round(r.luck * 100)}%</div></div>${btn}</div>`;
    }).join("");
    // Lures
    el.shopLures.innerHTML = LURES.map(l => {
      const owned = G.ownedLures.includes(l.id), eq = G.lure.id === l.id;
      const btn = owned ? (eq ? `<button class="item-btn equipped" disabled>EQUIPPED</button>` : `<button class="item-btn owned" data-equip-lure="${l.id}">EQUIP</button>`)
                        : `<button class="item-btn buy" data-buy-lure="${l.id}" ${G.coins < l.price ? "disabled" : ""}>${l.price} 🪙</button>`;
      const swatches = l.colors.map(c => `<i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${COLORS[c].hex};margin-right:3px;border:1px solid rgba(255,255,255,.4)"></i>`).join("");
      return `<div class="item"><div class="item-ico">${l.ico}</div><div class="item-info"><div class="item-name">${l.name}</div>
        <div class="item-desc">${l.desc}</div><div style="margin-top:4px">${swatches}</div></div>${btn}</div>`;
    }).join("");
    // Spots
    el.shopSpots.innerHTML = SPOTS.map(s => {
      const owned = G.ownedSpots.includes(s.id), active = G.spot === s.id;
      const btn = owned ? (active ? `<button class="item-btn equipped" disabled>FISHING</button>` : `<button class="item-btn owned" data-go-spot="${s.id}">GO</button>`)
                        : `<button class="item-btn buy" data-buy-spot="${s.id}" ${G.coins < s.price ? "disabled" : ""}>${s.price} 🪙</button>`;
      return `<div class="item"><div class="item-ico">${s.ico}</div><div class="item-info"><div class="item-name">${s.name}</div>
        <div class="item-desc">${s.desc}</div></div>${btn}</div>`;
    }).join("");
    // Dex
    el.shopDex.innerHTML = `<div class="dex-grid"></div>`;
    const grid = el.shopDex.querySelector(".dex-grid");
    Object.keys(F).forEach(k => {
      const def = F[k];
      const caught = G.caught[def.name], best = G.records[def.name];
      grid.insertAdjacentHTML("beforeend", `<div class="dex-cell ${caught ? "" : "locked"}">
        <div class="e">${caught ? fishSVG(def, 56) : "❓"}</div>
        <div class="n">${caught ? def.name : "???"}</div>
        <div class="best">${best ? "🏆 " + best + " lb" : ""}</div></div>`);
    });
  }
  el.shopBtn.addEventListener("click", openShop);
  el.shopClose.addEventListener("click", () => el.shopModal.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  el.shopModal.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const d = t.dataset;
    if (d.buyRod) { const r = RODS.find(x => x.id === d.buyRod); if (G.coins >= r.price) { G.coins -= r.price; G.ownedRods.push(r.id); G.rod = r.id; } }
    else if (d.equipRod) { G.rod = d.equipRod; }
    else if (d.buyLure) { const l = LURES.find(x => x.id === d.buyLure); if (G.coins >= l.price) { G.coins -= l.price; G.ownedLures.push(l.id); G.lure.id = l.id; G.lure.color = l.colors[0]; } }
    else if (d.equipLure) { const l = LURES.find(x => x.id === d.equipLure); G.lure.id = l.id; if (!l.colors.includes(G.lure.color)) G.lure.color = l.colors[0]; }
    else if (d.buySpot) { const s = SPOTS.find(x => x.id === d.buySpot); if (G.coins >= s.price) { G.coins -= s.price; G.ownedSpots.push(s.id); G.spot = s.id; seedFish(); resetToIdle(); } }
    else if (d.goSpot) { if (G.spot !== d.goSpot) { G.spot = d.goSpot; seedFish(); resetToIdle(); } }
    else return;
    save(); updateHUD(); renderShop();
  });

  // ===========================================================================
  // Boot
  // ===========================================================================
  updateHUD();
  showBtn(false);
  setStatus("Tap the water to cast 🎣");
  requestAnimationFrame(frame);

  document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", e => e.preventDefault());
})();
