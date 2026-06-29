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
  // The eight classic lures of the original, each with its own presentation.
  // style: "top" works the surface, "sink" sinks & dives on the retrieve.
  // band: depth this lure presents to (0 surface .. 1 bottom).
  // cadence: ideal twitch rhythm — "fast" rapid taps, "med" steady, "slow" big spaced sweeps.
  const LURES = [
    { id: "worm",     name: "Plastic Worm", ico: "🪱", price: 0,    desc: "All-purpose soft plastic. Slow bottom hops; bass can't resist.",
      colors: ["green","black","red","brown"], bite: 1.0, bassBias: 1.35, lmBias: 1.2, junk: 1.0, rareBias: 1.0, sizeBias: 1.0,
      style: "sink", band: 0.9, cadence: "slow", motion: "Slow bottom hops" },
    { id: "torpedo",  name: "Torpedo",      ico: "🚀", price: 130,  desc: "Prop topwater that kicks up the surface. Short sweeps; quick strikes.",
      colors: ["shad","white","chartreuse","black"], bite: 1.3, bassBias: 1.2, lmBias: 1.4, junk: 0.5, rareBias: 1.05, sizeBias: 1.0,
      style: "top", band: 0.08, cadence: "med", motion: "Short sweeps" },
    { id: "jitterbug",name: "Jitterbug",    ico: "🐞", price: 200,  desc: "Wobbles wildly across the top. Tiny twitches draw active fish.",
      colors: ["black","white","red","green"], bite: 1.45, bassBias: 1.15, lmBias: 1.35, junk: 0.5, rareBias: 1.1, sizeBias: 1.0,
      style: "top", band: 0.05, cadence: "fast", motion: "Tiny twitches" },
    { id: "pencil",   name: "Pencil Bait",  ico: "✏️", price: 320,  desc: "Walk-the-dog plug. Big sweeping motions call up bigger surface bass.",
      colors: ["shad","gold","white","chartreuse"], bite: 1.05, bassBias: 1.25, lmBias: 1.5, junk: 0.4, rareBias: 1.15, sizeBias: 1.15,
      style: "top", band: 0.06, cadence: "slow", motion: "Big sweeps" },
    { id: "frog",     name: "Frog",         ico: "🐸", price: 470,  desc: "Weedless over cover. Short skitters — largemouth explode on it.",
      colors: ["green","black","white","brown"], bite: 1.0, bassBias: 1.25, lmBias: 1.9, junk: 0.35, rareBias: 1.15, sizeBias: 1.2,
      style: "top", band: 0.07, cadence: "fast", motion: "Short skitters" },
    { id: "spoon",    name: "Spoon",        ico: "🥄", price: 620,  desc: "Flutters down, then darts up on the reel. Flashy and versatile.",
      colors: ["gold","shad","chartreuse","white"], bite: 1.1, bassBias: 1.15, lmBias: 1.1, junk: 0.6, rareBias: 1.3, sizeBias: 1.2,
      style: "sink", band: 0.55, cadence: "med", motion: "Flutter & dart" },
    { id: "crank",    name: "Crankbait",    ico: "🎏", price: 820,  desc: "Dives deep and rises on the reel — pulls mudders off the bottom.",
      colors: ["firetiger","shad","red","chartreuse"], bite: 1.1, bassBias: 1.15, lmBias: 1.1, junk: 0.55, rareBias: 1.3, sizeBias: 1.3,
      style: "sink", band: 0.72, cadence: "med", motion: "Steady deep wind" },
    { id: "furry",    name: "Furry Sinker", ico: "🧶", price: 1200, desc: "Hair-dressed bottom bait. Slow and big — filters out the small stuff.",
      colors: ["brown","black","green","red"], bite: 0.85, bassBias: 1.45, lmBias: 1.5, junk: 0.4, rareBias: 1.55, sizeBias: 1.5, minSize: 1.2,
      style: "sink", band: 0.82, cadence: "slow", motion: "Slow bottom drag" },
  ];

  // Fish-attractant scents/flavors. A scent gives a small all-round bump, plus
  // a combo bonus when it suits the lure style and the water conditions — so the
  // best results come from matching TYPE + COLOR + FLAVOR to the day.
  //   fav: which lure family it pairs with · warm/cold: temperature it shines in
  const ATTRACTANTS = {
    none:  { name: "No Scent",     ico: "⚪", base: 0.45, fav: null,     note: "Plain — let the lure do the work" },
    garlic:{ name: "Garlic",       ico: "🧄", base: 0.62, fav: null,     note: "All-round masking scent — small boost anywhere" },
    shad:  { name: "Shad Oil",     ico: "🐟", base: 0.55, fav: "moving", warm: true, note: "Baitfish scent — pairs with moving baits in warm water" },
    craw:  { name: "Crawfish",     ico: "🦞", base: 0.55, fav: "bottom", cold: true, note: "Craw scent — pairs with bottom baits in cool water" },
    night: { name: "Nightcrawler", ico: "🪱", base: 0.55, fav: "slow",   note: "Worm scent — pairs with slow finesse baits" },
    anise: { name: "Anise",        ico: "🌿", base: 0.58, fav: null,     cold: true, note: "Sweet cover scent — steady producer in cold water" },
  };

  // Fish. `art` drives the SVG. `bass:true` = black bass (counts in tournaments);
  // `lm:true` marks a largemouth specifically.
  // Black bass only — this is a bass fishing game.
  const F = {
    largemouth:{ name: "Largemouth Bass", w: [1.0, 7.0],  rarity: "common", base: 12, lm: true, bass: true,
                 art: { shape: "bass", body: "#6f9e4e", belly: "#eef1d6", pat: "lateral", patColor: "#33401f", bigmouth: true } },
    smallmouth:{ name: "Smallmouth Bass", w: [0.8, 5.5],  rarity: "common", base: 15, bass: true,
                 art: { shape: "bass", body: "#a07b46", belly: "#efe6cf", pat: "bars", patColor: "#6e4f28", eye: "#c23a2a" } },
    spotted:   { name: "Spotted Bass",    w: [0.6, 4.8],  rarity: "common", base: 14, bass: true,
                 art: { shape: "bass", body: "#6f8a3e", belly: "#eef0d2", pat: "spots", patColor: "#2f3d1c", eye: "#c23a2a" } },
    giant:     { name: "Giant Largemouth", w: [6.0, 14.0], rarity: "uncommon", base: 45, lm: true, bass: true, big: true,
                 art: { shape: "bass", body: "#5e8f54", belly: "#e8edcf", pat: "lateral", patColor: "#2c3f22", bigmouth: true } },
    hawg:      { name: "Trophy Largemouth", w: [10.0, 24.0], rarity: "legendary", base: 280, lm: true, bass: true, big: true,
                 art: { shape: "bass", body: "#4f7d46", belly: "#dfe6c4", pat: "lateral", patColor: "#243a1e", bigmouth: true } },
  };

  // Venues, each with a fish table and selectable fishing positions.
  const SPOTS = [
    {
      id: "cove", name: "Lily Cove", ico: "🌿", price: 0, clarity: "natural", baseDepth: 0.30,
      sky: ["#7fd4e8", "#bff0f7"], water: ["#2a93b8", "#0a3a4a"],
      desc: "Calm, clear largemouth water — lily pads and laydowns.",
      fish: [
        { k: "largemouth", weight: 56 }, { k: "spotted", weight: 16 }, { k: "smallmouth", weight: 14 },
        { k: "giant", weight: 10 }, { k: "hawg", weight: 2 },
      ],
      positions: [
        { id: "pads", name: "Lily Pads", ico: "🪷", desc: "Prime largemouth ambush cover.", depth: -0.14,
          zone: [0.30, 0.32, 0.18, 0.16], bias: { largemouth: 1.9, spotted: 1.1, giant: 1.3, smallmouth: 0.6 } },
        { id: "dock", name: "Boat Dock", ico: "🛶", desc: "Shade-loving bass stack up.", depth: -0.1,
          zone: [0.70, 0.30, 0.16, 0.14], bias: { largemouth: 1.6, smallmouth: 1.3, spotted: 1.3 } },
        { id: "open", name: "Open Water", ico: "🌊", desc: "Roaming smallmouth & spots.", depth: 0.0,
          zone: [0.50, 0.62, 0.22, 0.16], bias: { smallmouth: 1.7, spotted: 1.5 } },
        { id: "drop", name: "The Drop-off", ico: "📉", desc: "Deeper edge — the big girls.", depth: 0.26,
          zone: [0.50, 0.84, 0.26, 0.14], bias: { giant: 2.4, hawg: 2.8, largemouth: 1.3, spotted: 1.2 } },
      ],
    },
    {
      id: "river", name: "Boulder River", ico: "🏞️", price: 200, clarity: "natural", baseDepth: 0.46,
      sky: ["#9fdcc0", "#d7f3e6"], water: ["#2fae8e", "#0c4438"],
      desc: "Clear rocky current — smallmouth and spotted bass country.",
      fish: [
        { k: "smallmouth", weight: 44 }, { k: "spotted", weight: 30 }, { k: "largemouth", weight: 18 },
        { k: "giant", weight: 7 }, { k: "hawg", weight: 1 },
      ],
      positions: [
        { id: "riffle", name: "Rocky Riffles", ico: "💨", desc: "Oxygen-rich — smallmouth feed.", depth: -0.14,
          zone: [0.32, 0.42, 0.18, 0.14], bias: { smallmouth: 1.9, spotted: 1.4, giant: 0.8 } },
        { id: "pool", name: "Deep Pool", ico: "🌀", desc: "Big bass and toothy muskie.", depth: 0.2,
          zone: [0.68, 0.66, 0.20, 0.18], bias: { largemouth: 1.6, spotted: 1.2, giant: 1.6 } },
        { id: "bank", name: "Undercut Bank", ico: "🪵", desc: "Largemouth tuck under wood.", depth: -0.08,
          zone: [0.22, 0.70, 0.18, 0.16], bias: { largemouth: 1.9, spotted: 1.3, smallmouth: 1.1 } },
        { id: "tailout", name: "Current Seam", ico: "🏞️", desc: "Smallmouth & spots stage here.", depth: 0.04,
          zone: [0.55, 0.84, 0.26, 0.13], bias: { smallmouth: 1.5, spotted: 1.5, largemouth: 1.2 } },
      ],
    },
    {
      id: "deep", name: "Trophy Lake", ico: "🏆", price: 900, clarity: "bright", baseDepth: 0.66,
      sky: ["#3a4b7a", "#1b2447"], water: ["#243a78", "#070d2a"],
      desc: "Deep, low-light trophy lake — where giant bass live.",
      fish: [
        { k: "largemouth", weight: 32 }, { k: "giant", weight: 30 }, { k: "spotted", weight: 18 },
        { k: "smallmouth", weight: 16 }, { k: "hawg", weight: 4 },
      ],
      positions: [
        { id: "weed", name: "Weed Edge", ico: "🌿", desc: "Giant largemouth prowl the grass.", depth: -0.1,
          zone: [0.30, 0.44, 0.18, 0.16], bias: { giant: 2.1, largemouth: 1.5, spotted: 1.1 } },
        { id: "point", name: "Main-Lake Point", ico: "📍", desc: "Smallmouth, spots & old sturgeon.", depth: 0.02,
          zone: [0.70, 0.58, 0.18, 0.16], bias: { smallmouth: 1.7, spotted: 1.6, giant: 1.3 } },
        { id: "hole", name: "Deep Hole", ico: "🕳️", desc: "Where the true giants lurk.", depth: 0.24,
          zone: [0.50, 0.84, 0.24, 0.14], bias: { giant: 2.2, hawg: 3.0, largemouth: 1.4, spotted: 1.0 } },
        { id: "flat", name: "Moonlit Flat", ico: "🌙", desc: "Spots & smallmouth roam the flat.", depth: -0.2,
          zone: [0.50, 0.40, 0.26, 0.14], bias: { spotted: 1.8, smallmouth: 1.5, largemouth: 1.2 } },
      ],
    },
  ];

  const LUNKER_LB = 6;   // a black bass this heavy earns a "LUNKER!" callout
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
      lure: { id: "worm", color: "green" }, ownedLures: ["worm"], attractant: "none",
      spot: "cove", ownedSpots: ["cove"],
      positions: { cove: "pads", river: "riffle", deep: "weed" },
      records: {}, caught: {},
      tourWins: 0, bestBag: 0,
      mode: "career",   // "career" (earn & unlock) | "arcade" (everything unlocked)
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
        // migrate: drop any lures that no longer exist; keep the worm as the floor
        const valid = new Set(LURES.map(l => l.id));
        m.ownedLures = Array.from(new Set(["worm", ...(m.ownedLures || []).filter(id => valid.has(id))]));
        if (!valid.has(m.lure.id)) m.lure.id = "worm";
        if (!ATTRACTANTS[m.attractant]) m.attractant = "none";
        const lu = LURES.find(l => l.id === m.lure.id);
        if (lu && !lu.colors.includes(m.lure.color)) m.lure.color = lu.colors[0];
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

  // Arcade unlocks everything; career goes by what you've earned.
  const isArcade = () => G.mode === "arcade";
  const ownsRod = id => isArcade() || G.ownedRods.includes(id);
  const ownsLure = id => isArcade() || G.ownedLures.includes(id);
  const ownsSpot = id => isArcade() || G.ownedSpots.includes(id);

  // ===========================================================================
  // DOM refs
  // ===========================================================================
  const $ = id => document.getElementById(id);
  const canvas = $("c"), ctx = canvas.getContext("2d");
  const el = {
    coins: $("coins"), rodName: $("rodName"), spotName: $("spotName"), posName: $("posName"),
    lureIco: $("lureIco"), lureName: $("lureName"), lureSwatch: $("lureSwatch"),
    status: $("status"), actionBtn: $("actionBtn"),
    castMeter: $("castMeter"), cmFill: $("cmFill"),
    retrievePanel: $("retrievePanel"), rvDepth: $("rvDepth"), rvLine: $("rvLine"), rvAction: $("rvAction"), rvInterest: $("rvInterest"), rvHint: $("rvHint"),
    fightPanel: $("fightPanel"), ftStamina: $("ftStamina"), ftTension: $("ftTension"), ftDist: $("ftDist"), ftFishMark: $("ftFishMark"), ftLine: $("ftLine"), ftHint: $("ftHint"),
    condIcon: $("condIcon"), condTemp: $("condTemp"), condClock: $("condClock"),
    catchModal: $("catchModal"), catchRarity: $("catchRarity"), catchArt: $("catchArt"),
    catchName: $("catchName"), catchWeight: $("catchWeight"), catchReward: $("catchReward"),
    catchRewardWrap: $("catchRewardWrap"), catchRecord: $("catchRecord"), catchTourney: $("catchTourney"), catchOk: $("catchOk"),
    failModal: $("failModal"), failMsg: $("failMsg"), failOk: $("failOk"),
    shopBtn: $("shopBtn"), shopModal: $("shopModal"), shopClose: $("shopClose"), shopCoins: $("shopCoins"),
    shopRods: $("shopRods"), shopLures: $("shopLures"), shopSpots: $("shopSpots"), shopDex: $("shopDex"),
    rodChip: $("rodChip"), lureChip: $("lureChip"), spotChip: $("spotChip"),
    lureModal: $("lureModal"), lureClose: $("lureClose"), lureList: $("lureList"), colorRow: $("colorRow"), lureCond: $("lureCond"),
    mapModal: $("mapModal"), mapClose: $("mapClose"), mapVenues: $("mapVenues"), posGrid: $("posGrid"), finder: $("finder"),
    tourneyBtn: $("tourneyBtn"), modeBtn: $("modeBtn"), modeModal: $("modeModal"), modeClose: $("modeClose"),
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
  window.addEventListener("resize", () => { resize(); if (S.clouds) seedScenery(); });
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
    } else if (a.pat === "spots") {
      // spotted bass: dark lateral blotch row + rows of small spots below it
      const pc = a.patColor || "#33401f";
      for (let i = 0; i < 6; i++) { const x = cx - rx + 14 + i * (rx * 1.5 / 6); s += `<ellipse cx="${x}" cy="${cy - 2}" rx="4" ry="5" fill="${pc}" opacity="0.42"/>`; }
      for (let i = 0; i < 7; i++) { const x = cx - rx + 12 + i * (rx * 1.6 / 7); s += `<circle cx="${x}" cy="${cy + ry * 0.45}" r="1.8" fill="${pc}" opacity="0.6"/>`; }
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
  function fishInner(a) {
    if (a.shape === "sturgeon") return sturgeonFish(a);
    if (a.shape === "monster") return monsterFish(a);
    if (a.shape === "boot") return bootArt();
    if (a.shape === "can") return canArt();
    return genericFish(a);
  }
  function fishSVG(fishOrArt, size) {
    const a = (fishOrArt && fishOrArt.art) ? fishOrArt.art : fishOrArt;
    const w = size || 120, h = Math.round((size || 120) * 0.6);
    return `<svg viewBox="0 0 124 72" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${fishInner(a)}</svg>`;
  }
  // Trophy "hero" shot: the angler hoisting the caught bass (original art).
  function heroSVG(fish, size) {
    const a = fish.art, w = size || 200, h = size || 200;
    const tilt = -8;
    return `<svg viewBox="0 0 200 200" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <!-- angler torso (fishing vest) -->
      <path d="M58,196 L60,150 Q62,120 100,116 Q138,120 140,150 L142,196 Z" fill="#c7a96a"/>
      <path d="M70,196 L72,150 Q74,128 100,126 Q126,128 128,150 L130,196 Z" fill="#b9974f"/>
      <line x1="100" y1="128" x2="100" y2="196" stroke="rgba(90,68,36,0.6)" stroke-width="2"/>
      <!-- neck + head -->
      <rect x="93" y="92" width="14" height="14" fill="#caa56f"/>
      <circle cx="100" cy="80" r="20" fill="#caa56f"/>
      <!-- sunglasses -->
      <rect x="86" y="74" width="28" height="8" rx="3" fill="#15161b"/>
      <rect x="106" y="75" width="5" height="4" fill="rgba(150,200,230,0.5)"/>
      <!-- ball cap -->
      <path d="M80,72 A20,20 0 0 1 120,72 Z" fill="#c8482e"/>
      <rect x="100" y="68" width="34" height="8" rx="3" fill="#c8482e"/>
      <path d="M80,72 A20,18 0 0 1 100,56 L100,72 Z" fill="#a83a23"/>
      <!-- arms reaching down to grip the fish -->
      <path d="M64,150 Q44,150 44,128" stroke="#caa56f" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M136,150 Q156,150 156,128" stroke="#caa56f" stroke-width="11" fill="none" stroke-linecap="round"/>
      <!-- the trophy bass, held up across the chest -->
      <g transform="translate(38,150) rotate(${tilt}) scale(1.05)">${fishInner(a)}</g>
      <!-- gripping hands -->
      <ellipse cx="152" cy="126" rx="9" ry="7" fill="#caa56f"/>
      <ellipse cx="46" cy="126" rx="8" ry="6" fill="#caa56f"/>
    </svg>`;
  }

  // ===========================================================================
  // Game state
  // ===========================================================================
  // Phases: idle -> charging -> casting -> retrieve -> strike -> fight -> caught
  const S = {
    mode: "idle",
    bobber: { x: 0, y: 0, sx: 0, sy: 0, targetX: 0, targetY: 0, flyT: 0, dist: 0 },
    castBonus: false,
    castPower: 0, castDir: 1, castAim: null,
    hookedFish: null,
    // retrieve
    rv: { depth: 0, dist: 1, interest: 0, action: 0.5, lastTap: -999, taps: [], follower: 0 },
    strikeWindow: 0,
    // fight (tension vs stamina)
    ft: { stamina: 1, tension: 0, dist: 1, state: "tire", stateT: 0, pull: 0, jumpY: 0 },
    holding: false,
    pressT: 0, pressIsHold: false,
    fishes: [], ripples: [], splashes: [], bubbles: [], pursuers: [], clouds: [], motes: [], spray: [], trail: [],
    aim: null,
    view: "surface", viewT: 1,   // surface <-> underwater camera (viewT = transition 0..1)
    heading: 0, headingTarget: 0, steer: 0, holdBearing: 0, castFacing: 1,
    cond: { timeMin: 6.5 * 60, weather: "sun", temp: 64, band: 0.3 },
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
  function seedScenery() {
    S.clouds = [];
    for (let i = 0; i < 4; i++) S.clouds.push({ x: Math.random() * W, y: 20 + Math.random() * (waterLine() * 0.5), s: 0.6 + Math.random() * 0.8, spd: 0.003 + Math.random() * 0.006 });
    S.motes = [];
    for (let i = 0; i < 26; i++) S.motes.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, ph: Math.random() * 6.28, spd: 0.004 + Math.random() * 0.01 });
  }
  seedFish();
  seedScenery();

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
    el.modeBtn.textContent = isArcade() ? "🕹️ Arcade" : "🎯 Career";
    el.modeBtn.classList.toggle("arcade", isArcade());
    renderConditions();
  }

  // ---- Game mode (career / arcade) ----
  function reconcileOwnership() {
    if (!G.ownedRods.includes(G.rod)) G.rod = G.ownedRods[G.ownedRods.length - 1] || "twig";
    if (!G.ownedLures.includes(G.lure.id)) { G.lure.id = "worm"; G.lure.color = lure().colors[0]; }
    if (!G.ownedSpots.includes(G.spot)) { G.spot = G.ownedSpots[0] || "cove"; seedFish(); rollConditions(); }
  }
  function setMode(m) {
    if (G.mode === m) { el.modeModal.classList.add("hidden"); return; }
    if (S.tournament) { toast("Finish the tournament first"); return; }
    G.mode = m;
    if (m === "career") reconcileOwnership();
    save(); updateHUD(); resetToIdle();
    el.modeModal.classList.add("hidden");
    toast(m === "arcade" ? "🕹️ Arcade — everything unlocked!" : "🎯 Career — back to your progress");
  }
  el.modeBtn.addEventListener("click", () => {
    el.modeModal.querySelectorAll(".mode-opt").forEach(o => o.classList.toggle("sel", o.dataset.mode === G.mode));
    el.modeModal.classList.remove("hidden");
  });
  el.modeClose.addEventListener("click", () => el.modeModal.classList.add("hidden"));
  el.modeModal.addEventListener("click", (e) => { const o = e.target.closest(".mode-opt"); if (o) setMode(o.dataset.mode); });

  // ===========================================================================
  // Conditions: time of day, weather, water temperature -> fish holding depth
  // ===========================================================================
  const WEATHER = {
    sun:    { ico: "☀️", name: "Sunny",    fam: "natural", warm: 6 },
    cloud:  { ico: "☁️", name: "Cloudy",   fam: "bright",  warm: 1 },
    fog:    { ico: "🌫️", name: "Foggy",    fam: "bright",  warm: -1 },
    night:  { ico: "🌙", name: "Night",    fam: "bright",  warm: -4 },
  };
  // Seasonal patterns layered on the daily cycle — real bass behaviour.
  const SEASONS = {
    spring: { name: "Spring", ico: "🌱", tempBase: 60, depth: -0.14, activity: 0.22, note: "Pre-spawn — bass move shallow" },
    summer: { name: "Summer", ico: "☀️", tempBase: 80, depth: 0.14, activity: 0.0, note: "Heat pushes bass deep (early/late best)" },
    fall:   { name: "Fall",   ico: "🍂", tempBase: 62, depth: -0.06, activity: 0.24, note: "Fall feed-up — bass chase bait" },
    winter: { name: "Winter", ico: "❄️", tempBase: 45, depth: 0.20, activity: -0.28, note: "Cold water — slow & deep" },
  };
  const SEASON_ORDER = ["spring", "summer", "fall", "winter"];

  function rollConditions() {
    const sp = spot();
    if (sp.id === "deep") S.cond.weather = "night";
    else { const r = Math.random(); S.cond.weather = r < 0.5 ? "sun" : r < 0.78 ? "cloud" : "fog"; }
    S.cond.timeMin = (sp.id === "deep" ? 21 * 60 : 6 * 60) + Math.random() * 120;
    if (!S.cond.season) S.cond.season = SEASON_ORDER[Math.floor(Math.random() * 4)];
    // the productive water sits at a random bearing — turn the trolling motor to find it
    S.holdBearing = rnd(-1.0, 1.0);
    S.heading = 0; S.headingTarget = 0;
    // a hidden "pattern of the day": the bass are keyed on one lure, so even an
    // off-the-chart choice can crush it if it matches — discover it by fishing
    S.cond.hotLure = LURES[Math.floor(Math.random() * LURES.length)].id;
    recomputeCond();
  }
  // how directly the boat faces the holding water (1 = dead on, 0 = facing away)
  function facingQuality() { return clamp(0.5 + 0.5 * Math.cos((S.heading || 0) - (S.holdBearing || 0)), 0, 1); }
  function recomputeCond() {
    const c = S.cond, hour = c.timeMin / 60, sp = spot(), pos = position(), wx = c.weather;
    const sea = SEASONS[c.season] || SEASONS.summer;
    const midday = clamp(1 - Math.abs(hour - 14) / 9, 0, 1);
    c.temp = Math.round(clamp(sea.tempBase + (midday - 0.5) * 16 + WEATHER[wx].warm, 38, 92));

    // Holding depth = venue base + structure + season + time + weather + temperature.
    const base = (sp.baseDepth != null ? sp.baseDepth : 0.4) + ((pos && pos.depth) || 0) + sea.depth;
    const timeShift = (midday - 0.5) * 0.42;                       // deep midday, shallow at dawn/dusk
    const weatherShift = wx === "sun" ? 0.08 : wx === "cloud" ? -0.04 : wx === "fog" ? -0.08 : -0.10; // night up
    const tempShift = c.temp < 50 ? 0.14 : c.temp > 82 ? 0.12 : 0; // temp extremes push deep
    c.band = clamp(base + timeShift + weatherShift + tempShift, 0.05, 0.96);

    // Feeding window: wide & easy when fish are active, tight when conditions are tough.
    const lowLight = midday < 0.45 || wx !== "sun";
    const moderate = c.temp >= 56 && c.temp <= 78;
    let activity = 0.4 + sea.activity + (lowLight ? 0.2 : 0) + (moderate ? 0.18 : 0) + (wx === "cloud" || wx === "fog" ? 0.14 : 0);
    c.activity = clamp(activity, 0.15, 1);
    c.window = 0.045 + c.activity * 0.095;                          // zone half-width
  }
  function preferredFam() { return WEATHER[S.cond.weather].fam; }
  function fmtClock(min) {
    let h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    const ap = h < 12 ? "a" : "p"; let hh = h % 12; if (hh === 0) hh = 12;
    return hh + ":" + String(m).padStart(2, "0") + ap;
  }
  function renderConditions() {
    const c = S.cond, w = WEATHER[c.weather];
    el.condIcon.textContent = w.ico;
    el.condTemp.textContent = c.temp + "°";
    el.condClock.textContent = fmtClock(c.timeMin);
  }

  // ===========================================================================
  // Bite-rating engine — realistic "what to throw right now" scoring.
  // Combines depth, light/color, time, water temp, weather and structure so the
  // rating both drives the catch odds and teaches real lure selection.
  // ===========================================================================
  const STRUCT_GROUP = {
    pads: "veg", weed: "veg", reeds: "veg", tailout: "veg", flat: "veg",
    dock: "wood", bank: "wood", logs: "wood", pool: "wood",
    rocks: "rock", point: "rock", riffle: "rock",
    drop: "deep", hole: "deep", open: "open",
  };
  const STRUCT_PREF = {
    frog:      { veg: 1.0, wood: 0.8, rock: 0.5, deep: 0.25, open: 0.6 },
    pencil:    { veg: 0.7, wood: 0.6, rock: 0.6, deep: 0.35, open: 0.95 },
    torpedo:   { veg: 0.75, wood: 0.6, rock: 0.6, deep: 0.35, open: 0.95 },
    jitterbug: { veg: 0.85, wood: 0.7, rock: 0.5, deep: 0.3, open: 0.75 },
    worm:      { veg: 0.85, wood: 1.0, rock: 0.7, deep: 0.8, open: 0.6 },
    furry:     { veg: 0.6, wood: 1.0, rock: 0.85, deep: 0.95, open: 0.6 },
    spoon:     { veg: 0.45, wood: 0.6, rock: 0.85, deep: 0.9, open: 0.9 },
    crank:     { veg: 0.35, wood: 0.6, rock: 1.0, deep: 0.95, open: 0.85 },
  };

  // score a lure for the current conditions; returns {score 0..1, pct, stars, tip, good}
  function lureScore(lu, colorId) {
    const c = S.cond, band = c.band, hour = c.timeMin / 60, temp = c.temp;
    const pos = position();
    const lowLight = hour < 8 || hour > 18 || c.weather === "night" || c.weather === "fog";
    const overcast = c.weather === "cloud" || c.weather === "fog" || c.weather === "night";
    const bright = c.weather === "sun";
    const top = lu.style === "top";

    // 1) depth — can the lure present where the fish are holding?
    let depth;
    if (top) depth = clamp(1 - Math.max(0, band - 0.12) / 0.4, 0.05, 1);
    else if (band > lu.band + 0.08) depth = clamp(1 - (band - lu.band) / 0.5, 0.1, 0.6);
    else depth = clamp(1 - Math.abs(band - lu.band) * 0.7, 0.55, 1);

    // 2) color vs available light
    const col = COLORS[colorId || G.lure.color];
    const color = col.fam === preferredFam() ? 1 : 0.58;

    // 3) time of day
    let time;
    if (top) time = lowLight ? 1 : (hour >= 10 && hour <= 16 ? 0.35 : 0.72);
    else if (lu.id === "crank" || lu.id === "spoon") time = (hour >= 8 && hour <= 18) ? 0.95 : 0.7;
    else time = 0.85;

    // 4) water temperature
    const slow = lu.id === "worm" || lu.id === "furry";
    let tempS;
    if (temp < 55) tempS = slow ? 1 : (top ? 0.4 : 0.7);
    else if (temp > 72) tempS = top ? 1 : (slow ? 0.72 : 0.9);
    else tempS = 0.9;

    // 5) weather / activity
    const moving = ["torpedo", "jitterbug", "crank", "spoon"].includes(lu.id);
    let weath;
    if (moving) weath = overcast ? 1 : 0.72;
    else if (slow) weath = bright ? 1 : 0.78;
    else weath = overcast ? 0.85 : 0.95;

    // 6) structure / position
    const grp = STRUCT_GROUP[pos.id] || "open";
    const structS = (STRUCT_PREF[lu.id] && STRUCT_PREF[lu.id][grp]) != null ? STRUCT_PREF[lu.id][grp] : 0.6;

    // 7) fish-attractant scent/flavor — pairs with lure style + temperature
    const scent = scentScore(lu, temp);

    const score = depth * 0.27 + color * 0.14 + time * 0.13 + tempS * 0.11 + weath * 0.11 + structS * 0.14 + scent * 0.10;

    // educational tip — call out the limiting factor (or the strength)
    const factors = [
      ["depth", depth], ["color", color], ["time", time], ["temp", tempS], ["weather", weath], ["struct", structS], ["scent", scent],
    ].sort((a, b) => a[1] - b[1]);
    const weak = factors[0];
    let tip;
    if (weak[1] >= 0.62) tip = "✓ Dialed in for these conditions";
    else if (weak[0] === "depth") tip = top ? "Fish are deep — a topwater won't reach" : "Wrong depth for where they're holding";
    else if (weak[0] === "color") tip = bright ? "Too flashy — go natural in bright light" : "Too dull — go bright in low visibility";
    else if (weak[0] === "time") tip = "Topwater fades in midday sun — save it for low light";
    else if (weak[0] === "temp") tip = temp < 55 ? "Cold water — fish want a slow bait" : "Warm & active — a faster bait shines";
    else if (weak[0] === "weather") tip = moving ? "Calm & clear — finesse beats flash" : "Active, overcast day — try a moving bait";
    else if (weak[0] === "scent") tip = "Add a matching scent for an edge";
    else tip = "Not the cover this lure loves";

    return { score, pct: Math.round(score * 100), stars: clamp(Math.round(score * 5), 1, 5), tip, good: weak[1] >= 0.62 };
  }

  // attractant suitability 0..1 — base presence + combos with lure style & temp
  function scentScore(lu, temp) {
    const a = ATTRACTANTS[G.attractant] || ATTRACTANTS.none;
    let s = a.base;
    const moving = ["torpedo", "jitterbug", "crank", "spoon", "pencil"].includes(lu.id);
    const slow = lu.id === "worm" || lu.id === "furry";
    const bottom = lu.style === "sink";
    if (a.fav === "moving" && moving) s += 0.30;
    else if (a.fav === "slow" && slow) s += 0.30;
    else if (a.fav === "bottom" && bottom) s += 0.26;
    else if (a.fav && !moving && !slow && !bottom) s -= 0.05;
    if (a.warm && temp > 68) s += 0.12; else if (a.warm && temp < 56) s -= 0.06;
    if (a.cold && temp < 58) s += 0.12; else if (a.cold && temp > 74) s -= 0.06;
    return clamp(s, 0, 1);
  }

  function bestLureNow() {
    const pool = LURES.filter(l => ownsLure(l.id));
    let best = null, bs = -1;
    for (const l of pool) { const s = lureScore(l).score; if (s > bs) { bs = s; best = l; } }
    return best ? { lure: best, ...lureScore(best) } : null;
  }

  // ===========================================================================
  // Fish selection — venue table × position bias × lure × rod luck
  // ===========================================================================
  function pickFish() {
    const sp = spot(), pos = position(), lu = lure(), luck = rod().luck;
    const colorMatch = COLORS[G.lure.color].fam === preferredFam();
    // how well the lure was presented at the fish's holding depth
    const depthMatch = clamp(1 - Math.abs(S.rv.depth - S.cond.band) * 1.6, 0, 1);
    const goodAction = S.rv.action > 0.6;
    // where the big girls live: deeper water, low light, and on the fished depth.
    // worked deep + dawn/dusk/dark = trophy odds climb; shallow bright midday = small fish.
    const hour = S.cond.timeMin / 60, wx = S.cond.weather;
    const lowLight = hour < 7.5 || hour > 18 || wx === "night" || wx === "fog" || wx === "cloud";
    const deepFished = clamp((S.rv.depth - 0.32) / 0.5, -0.4, 1);     // how deep the lure was worked
    const trophyFactor = clamp(0.55 + deepFished * 1.0 + (lowLight ? 0.35 : 0) + (S.castBonus ? 0.2 : 0), 0.3, 2.4);

    const table = sp.fish.map(entry => {
      const def = fishDef(entry.k);
      let w = entry.weight;
      w *= (pos.bias && pos.bias[entry.k]) || 1;
      if (def.lm) w *= lu.lmBias;
      else if (def.name.includes("Bass")) w *= lu.bassBias;
      if (def.rarity === "rare") w *= lu.rareBias * (1 + luck * 4);
      if (def.rarity === "legendary") w *= lu.rareBias * (1 + luck * 6);
      if (def.rarity === "junk") w *= lu.junk * Math.max(0.2, 1 - luck * 2);
      if (colorMatch && (def.rarity === "rare" || def.rarity === "legendary")) w *= 1.2;
      if (S.castBonus && (def.rarity === "rare" || def.rarity === "legendary" || def.lm)) w *= 1.25;
      if (def.big) w *= trophyFactor;     // trophies favor deep, low-light, on-structure water
      return { def, w: Math.max(0.0001, w) };
    });

    const total = table.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, chosen = table[0].def;
    for (const x of table) { r -= x.w; if (r <= 0) { chosen = x.def; break; } }

    let lo = chosen.w[0], hi = chosen.w[1];
    if (lu.minSize) lo = lo + (hi - lo) * (lu.minSize - 1) * 0.4;
    // presenting on the money (depth + color + clean action) earns bigger fish
    const sizePush = clamp((rod().power - 1) * 0.4 + (lu.sizeBias - 1) * 0.5
      + depthMatch * 0.18 + (colorMatch ? 0.08 : 0) + (goodAction ? 0.08 : 0) + (S.castBonus ? 0.08 : 0), 0, 0.85);
    const roll = Math.pow(Math.random(), 1.7 - sizePush);
    const weight = +(lo + (hi - lo) * roll).toFixed(1);

    const rangeFrac = (weight - lo) / Math.max(0.01, hi - lo);
    const difficulty = clamp(RARITY_HARD[chosen.rarity] * 0.6 + rangeFrac * 0.5, 0.05, 0.98);
    const value = Math.max(1, Math.round(chosen.base * (0.6 + weight / hi) * RARITY_MULT[chosen.rarity]));
    // length from the standard bass length-weight relation (W = L^3 / 1600), +/- a little
    const lengthIn = +(Math.cbrt(weight * 1600) * (0.96 + Math.random() * 0.08)).toFixed(1);
    return { def: chosen, name: chosen.name, art: chosen.art, rarity: chosen.rarity, lm: !!chosen.lm, bass: !!chosen.bass, weight, lengthIn, difficulty, value };
  }

  // ===========================================================================
  // Input — one gesture model routed by phase
  //   idle: press water = aim + charge meter, release = cast
  //   retrieve: quick tap = twitch the lure, press-and-hold = reel
  //   strike: tap/flick = set the hook
  //   fight: hold = reel, release = give line
  // ===========================================================================
  const HOLD_MS = 165;
  let pressActive = false, holdCandidate = false, downX = 0, downY = 0, swiped = false;
  function ptr(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function onDown(x, y) {
    if (anyModalOpen()) return;
    pressActive = true; holdCandidate = false; swiped = false;
    S.pressT = performance.now(); downX = x; downY = y;
    if (S.mode === "idle") startCast(x, y);
    else if (S.mode === "strike") hookSet();
    else if (S.mode === "fight") S.holding = true;
    else if (S.mode === "retrieve") holdCandidate = true;
  }
  function onMove(x, y) {
    if (!pressActive) return;
    if (Math.abs(x - downX) > 24 || Math.abs(y - downY) > 24) swiped = true;
  }
  function onUp() {
    if (!pressActive) return;
    pressActive = false;
    const dur = performance.now() - S.pressT;
    if (S.mode === "retrieve") { if (!holdCandidate || dur < HOLD_MS) twitch(); S.holding = false; holdCandidate = false; }
    else if (S.mode === "fight") S.holding = false;
  }
  canvas.addEventListener("pointerdown", (e) => { const p = ptr(e); onDown(p.x, p.y); });
  canvas.addEventListener("pointermove", (e) => { const p = ptr(e); onMove(p.x, p.y); });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  el.actionBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); onDown(W / 2, H * 0.6); });
  el.actionBtn.addEventListener("pointerup", (e) => { e.preventDefault(); onUp(); });
  el.actionBtn.addEventListener("pointercancel", onUp);
  el.actionBtn.addEventListener("pointerleave", () => { if (S.mode === "fight" || (S.mode === "retrieve" && holdCandidate)) onUp(); });

  // promote a sustained retrieve press into a reel
  function pollHold(now) {
    if (S.mode === "retrieve" && pressActive && holdCandidate && now - S.pressT > HOLD_MS) S.holding = true;
  }

  // ===========================================================================
  // Flow
  // ===========================================================================
  // Point-and-click: tap the water and the lure is cast right there (capped by
  // the rod's range). The windup/whip motion plays out during the flight.
  function startCast(x, y) {
    const tip = rodTip(), wl = waterLine();
    const maxR = clamp(H * (0.40 + rod().power * 0.17), 200, H * 0.95);
    let dx = x - tip.x, dy = y - tip.y, d = Math.hypot(dx, dy) || 1;
    const reach = clamp(d, maxR * 0.3, maxR);          // land where tapped, within reach
    let px = tip.x + dx / d * reach, py = tip.y + dy / d * reach;
    py = clamp(py, wl + 18, H - 150); px = clamp(px, 26, W - 26);
    S.castAim = { x: px, y: py };
    S.mode = "casting";
    S.bobber.sx = tip.x; S.bobber.sy = tip.y; S.bobber.x = tip.x; S.bobber.y = tip.y;
    S.bobber.targetX = px; S.bobber.targetY = py;
    S.bobber.flyT = 0; S.bobber.dist = reach / maxR;
    S.castFt = Math.round(28 + S.bobber.dist * 66);    // how far this cast reached (ft)
    const hz = hotZone();
    S.castBonus = Math.hypot(px - hz.x, py - hz.y) < hz.r;
    S.castFacing = facingQuality();   // how well the boat was aimed at the fish when you cast
    S.castLuck = rnd(0.82, 1.28);     // real fishing varies cast-to-cast
    showBtn(false); setStatus("");
    S.aim = null;
  }

  function startRetrieve() {
    const lu = lure();
    S.mode = "retrieve";
    S.rv.dist = 1; S.rv.interest = 0; S.rv.action = 0.5; S.rv.taps = []; S.rv.follower = 0; S.rv.bob = 0;
    S.rv.depth = lu.style === "top" ? lu.band : 0.04;
    S.holding = false;
    // dive into the underwater view and spawn the bass holding nearby
    S.view = "under"; S.viewT = 0; S.bubbles.length = 0;
    spawnPursuers();
    splash(S.bobber.x, S.bobber.y); splash(S.bobber.x, S.bobber.y);
    el.retrievePanel.classList.remove("hidden");
    showBtn(true); setBtn("HOLD TO REEL", "reel");
    setStatus(S.castBonus ? "On the structure — work it!" : "Work the lure…");
    // clear the big centre text so it doesn't cover the underwater action
    setTimeout(() => { if (S.mode === "retrieve" || S.mode === "strike") setStatus(""); }, 1500);
  }
  function spawnPursuers() {
    S.pursuers = [];
    const n = 1 + Math.round(posQuality() * 2);
    for (let i = 0; i < n; i++) S.pursuers.push({ side: i % 2 ? 1 : -1, depth: clamp(S.cond.band + (Math.random() - 0.5) * 0.3, 0.1, 0.9), ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 0.6 });
  }

  function twitch() {
    const now = performance.now();
    S.rv.taps.push(now);
    if (S.rv.taps.length > 6) S.rv.taps.shift();
    const lu = lure();
    // topwater pops the surface; sinking lures hop up a touch — both jig visibly
    if (lu.style === "top") { S.rv.depth = clamp(lu.band, 0, 1); splash(S.bobber.x, waterLine()); }
    else S.rv.depth = clamp(S.rv.depth - 0.05, 0, 1);
    S.rv.bob = -13;                 // the lure jumps on the twitch, then settles
    ripple(S.bobber.x, S.bobber.y);
    vibrate(8);
  }

  function endRetrieveMiss() {
    setStatus("No takers — reel in and recast.");
    advanceTime(4);
    resetToIdle();
  }

  function strike() {
    S.mode = "strike";
    S.hookedFish = pickFish();
    S.strikeWindow = 950 - S.hookedFish.difficulty * 480;
    el.retrievePanel.classList.add("hidden");
    showBtn(true); setBtn("SET THE HOOK!", "hook");
    setStatus("FISH ON!", true);
    splash(S.bobber.x, S.bobber.y); splash(S.bobber.x, S.bobber.y);
    vibrate(45);
  }
  function strikeMissed() {
    setStatus("It spat the lure!");
    advanceTime(3);
    resetToIdle();
    if (!S.tournament) showFail("It spat the lure — set the hook quicker!");
  }

  function hookSet() {
    if (S.mode !== "strike") return;
    const f = S.hookedFish, d = f.difficulty;
    S.mode = "fight";
    // fight from the angler's point of view, up on the surface
    S.view = "surface"; S.viewT = 0;
    setStatus(""); setBtn("HOLD TO REEL", "reel"); showBtn(true);
    el.fightPanel.classList.remove("hidden");
    const T = S.ft;
    T.stamina = 1; T.tension = 0; T.dist = clamp(S.rv.dist, 0.45, 1);
    T.state = "run"; T.stateT = rnd(500, 1100); T.pull = 0.8; T.jumpY = 0;
    T.maxStam = 1; T.size = d;
    S.holding = false;
    vibrate([20, 30, 40]);
    el.ftHint.textContent = "Wear it down — reel when it tires!";
  }

  function landFish() {
    // start the boating animation — swing small ones in, hand-lip the big ones
    const f = S.hookedFish;
    S.mode = "landing";
    S.landT = 0;
    S.landBig = f.weight >= 3.5;
    el.fightPanel.classList.add("hidden");
    el.retrievePanel.classList.add("hidden");
    showBtn(false);
    setStatus(S.landBig ? "Lipping it…" : "Swinging it in…");
    vibrate([15, 30]);
  }
  function finishLand() {
    const f = S.hookedFish;
    S.mode = "caught";
    setStatus("");
    G.caught[f.name] = (G.caught[f.name] || 0) + 1;
    const prev = G.records[f.name] || 0;
    const isRecord = f.weight > prev;
    if (isRecord) G.records[f.name] = f.weight;
    advanceTime(5);

    if (S.tournament) { tourLand(f, isRecord, prev); save(); return; }
    G.coins += f.value;
    save(); updateHUD();
    vibrate([20, 40, 30]);
    showCatch(f, isRecord, prev);
  }

  function showCatch(f, isRecord, prev) {
    const lunk = f.bass && f.weight >= LUNKER_LB;
    el.catchRarity.textContent = lunk ? "🏆 LUNKER!" : f.rarity.toUpperCase();
    el.catchRarity.style.background = lunk ? "#ffd35c" : RARITY_COLOR[f.rarity];
    el.catchRarity.style.color = (lunk || f.rarity === "legendary") ? "#5a3a00" : "#06222c";
    el.catchRarity.classList.toggle("lunker", lunk);
    if (lunk) vibrate([30, 50, 30, 50, 60]);
    // 3D trophy if WebGL is up, else the SVG hero pose
    const cv3d = document.getElementById("catch3d"), svgHost = document.getElementById("catchArtSvg");
    let shown3d = false;
    const modelKey = f.lm ? "largemouth" : /Smallmouth/.test(f.name) ? "smallmouth" : /Spotted/.test(f.name) ? "spotted" : "largemouth";
    if (window.Scene3D && Scene3D.showCatch) { try { shown3d = Scene3D.showCatch(f.art, modelKey); } catch (e) {} }
    if (shown3d) { cv3d.style.display = "block"; svgHost.innerHTML = ""; }
    else { cv3d.style.display = "none"; svgHost.innerHTML = heroSVG(f, 168); }
    el.catchName.textContent = f.name;
    const lenIn = f.lengthIn || +Math.cbrt(f.weight * 1600).toFixed(1);
    animateMeasure(f.weight, lenIn);
    el.catchReward.textContent = f.value;
    el.catchRewardWrap.classList.remove("hidden");
    el.catchRecord.textContent = isRecord && prev > 0 ? "🏆 NEW PERSONAL BEST!" : isRecord ? "🏆 FIRST CATCH!" : "";
    el.catchTourney.classList.add("hidden");
    el.catchOk.textContent = "NICE! KEEP FISHING";
    el.catchModal.classList.remove("hidden");
  }

  // weigh & measure: the scale settles (numbers roll up) and the tape fills
  let _measureRAF = 0;
  function animateMeasure(weight, lengthIn) {
    const wEl = el.catchWeight, lEl = document.getElementById("catchLength");
    const fill = document.getElementById("catchRulerFill");
    const wCell = wEl && wEl.parentElement, lCell = lEl && lEl.parentElement;
    if (fill) fill.style.width = "0%";
    cancelAnimationFrame(_measureRAF);
    const dur = 1000, start = performance.now();
    const RULER_MAX = 28;   // inches the tape spans
    function step(now) {
      let p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);                         // ease-out settle
      const wob = p < 1 ? (1 - p) * Math.sin(p * 40) * 0.04 : 0; // needle wobble as it settles
      if (wEl) wEl.textContent = (weight * (e + wob)).toFixed(1);
      if (lEl) lEl.textContent = (lengthIn * e).toFixed(1);
      if (fill) fill.style.width = Math.min(100, lengthIn / RULER_MAX * 100 * e) + "%";
      if (p < 1) { _measureRAF = requestAnimationFrame(step); }
      else {
        if (wEl) wEl.textContent = weight.toFixed(1);
        if (lEl) lEl.textContent = lengthIn.toFixed(1);
        if (wCell) { wCell.classList.remove("settle"); void wCell.offsetWidth; wCell.classList.add("settle"); }
        if (lCell) { lCell.classList.remove("settle"); void lCell.offsetWidth; lCell.classList.add("settle"); }
        vibrate(20);
      }
    }
    _measureRAF = requestAnimationFrame(step);
  }

  function loseFish(msg) {
    el.fightPanel.classList.add("hidden");
    if (S.tournament) { S.mode = "idle"; showBtn(false); vibrate(120); toast("💥 " + (msg || "It got off!")); setStatus("Tap & hold the water to cast"); return; }
    resetToIdle();
    vibrate(120);
    showFail(msg || "The line snapped!");
  }

  function showFail(msg) { el.failMsg.textContent = msg; el.failModal.classList.remove("hidden"); }

  function resetToIdle() {
    S.mode = "idle";
    S.hookedFish = null;
    S.castBonus = false;
    S.holding = false;
    S.pursuers = [];
    S.bobberDepth = null;
    if (S.view !== "surface") { S.view = "surface"; S.viewT = 0; }
    el.retrievePanel.classList.add("hidden");
    el.fightPanel.classList.add("hidden");
    el.castMeter.classList.add("hidden");
    showBtn(false);
    setStatus("Tap & hold the water to aim, release to cast 🎣");
  }

  function advanceTime(min) {
    S.cond.timeMin += min;
    if (S.cond.timeMin >= 24 * 60) {           // a new day — the season drifts forward over time
      S.cond.timeMin -= 24 * 60;
      S.cond.day = (S.cond.day || 0) + 1;
      if (S.cond.day % 3 === 0) S.cond.season = SEASON_ORDER[(SEASON_ORDER.indexOf(S.cond.season) + 1) % 4];
    }
    recomputeCond(); renderConditions();
  }
  function ripple(x, y) { S.ripples.push({ x, y, r: 4, a: 0.7 }); }
  function splash(x, y) { S.splashes.push({ x, y, r: 3, a: 0.9 }); }
  function sprayBurst(x, y, n, power) {
    S.splashes.push({ x, y, r: 4, a: 0.9 });
    power = power || 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rnd(-1.1, 1.1), sp = rnd(0.06, 0.2) * power;
      S.spray.push({ x, y, vx: Math.cos(a) * sp * rnd(0.6, 1.6), vy: Math.sin(a) * sp - 0.03, life: rnd(280, 620), r: rnd(1.4, 3.4) });
    }
  }

  // ===========================================================================
  // Tournament mode
  // ===========================================================================
  function tourConfig() {
    const sp = spot();
    const dur = 150000; // 2:30
    const fee = isArcade() ? 0 : (sp.id === "deep" ? 150 : sp.id === "river" ? 90 : 50);
    const field = 10;
    return { dur, fee, field };
  }
  function openTourStart() {
    if (S.tournament) return;
    const cfg = tourConfig();
    el.tourFee.textContent = cfg.fee || "FREE";
    el.tourStartFee.textContent = cfg.fee || "FREE";
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
    toast("🏁 Lines in! Boat your best 5 black bass!");
    save();
  }
  function tourLand(f, isRecord, prev) {
    const T = S.tournament;
    if (!f.bass) {
      toast(`Released — ${f.name}<br><small>only black bass count</small>`);
      vibrate(20);
      resetToIdle();
      return;
    }
    const lunk = f.weight >= LUNKER_LB;
    const entry = { name: f.name, weight: f.weight, art: f.art };
    let msg = "";
    if (T.well.length < 5) {
      T.well.push(entry);
      msg = `🪣 Live well: ${T.well.length}/5<br><b>${lunk ? "🏆 LUNKER! " : ""}${f.weight} lb bass</b>`;
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
    el.fightPanel.classList.add("hidden"); el.retrievePanel.classList.add("hidden"); el.castMeter.classList.add("hidden"); showBtn(false);

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

    // payouts (arcade has no entry fee but still pays a base purse)
    const fee = T.fee || 50;
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
    drive3D(dt, now);
    updateBoatHud(now);
    requestAnimationFrame(frame);
  }

  // ---- Trolling motor + fish finder (surface view) ----
  (function setupBoatHud() {
    const L = document.getElementById("trollL"), R = document.getElementById("trollR");
    const press = dir => e => { e.preventDefault(); S.steer = dir; vibrate(8); };
    const release = e => { S.steer = 0; };
    for (const [btn, dir] of [[L, -1], [R, 1]]) {
      btn.addEventListener("pointerdown", press(dir));
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
    }
  })();

  function updateBoatHud(now) {
    const hud = document.getElementById("boatHud");
    // only in the idle surface view — cleared the moment you aim/cast so the
    // overlay never covers the angler or the casting motion
    const show = S.view === "surface" && S.viewT >= 1 && !anyModalOpen() && S.mode === "idle";
    hud.classList.toggle("hidden", !show);
    if (show) drawSonar(now);
    else if (S.steer) S.steer = 0;
  }

  function drawSonar(now) {
    const cv = document.getElementById("sonar"), g = cv.getContext("2d");
    const W2 = cv.width, H2 = cv.height;
    const lu = lure(), sc = lureScore(lu).score, face = facingQuality();
    const quality = clamp(sc * (0.4 + 0.6 * face), 0, 1);     // right lure + facing the fish
    document.getElementById("sonarQ").textContent =
      (quality > 0.66 ? "● STACKED" : quality > 0.33 ? "● MARKS" : "○ SCATTERED");
    document.getElementById("sonarQ").style.color = quality > 0.66 ? "#5be37a" : quality > 0.33 ? "#ffd35c" : "#9fb6c2";
    // water column
    const grd = g.createLinearGradient(0, 0, 0, H2);
    grd.addColorStop(0, "#0d4a63"); grd.addColorStop(1, "#03161f");
    g.fillStyle = grd; g.fillRect(0, 0, W2, H2);
    // surface line + bottom
    g.fillStyle = "rgba(180,230,245,.5)"; g.fillRect(0, 2, W2, 2);
    g.fillStyle = "#6b4a2a"; g.beginPath(); g.moveTo(0, H2);
    for (let x = 0; x <= W2; x += 12) g.lineTo(x, H2 - 10 - Math.sin(x * 0.2 + now / 600) * 4);
    g.lineTo(W2, H2); g.closePath(); g.fill();
    // bite-zone band
    const band = S.cond.band, win = S.cond.window || 0.085;
    const yTop = (band - win) * H2, yBot = (band + win) * H2;
    g.fillStyle = quality > 0.5 ? "rgba(91,227,122,.22)" : "rgba(255,211,92,.16)";
    g.fillRect(0, yTop, W2, yBot - yTop);
    g.strokeStyle = quality > 0.5 ? "rgba(120,240,150,.7)" : "rgba(255,211,92,.5)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, yTop); g.lineTo(W2, yTop); g.moveTo(0, yBot); g.lineTo(W2, yBot); g.stroke();
    // fish arches at the holding depth — count & brightness scale with quality
    const n = Math.round(2 + quality * 10);
    for (let i = 0; i < n; i++) {
      const ph = i * 1.7 + now / 700;
      const fx = ((i * 53 + now * 0.02) % (W2 + 20)) - 10;
      const fy = band * H2 + Math.sin(ph) * (win * H2 * 0.8);
      const a = 0.35 + quality * 0.55;
      g.strokeStyle = quality > 0.5 ? `rgba(120,240,150,${a})` : `rgba(255,225,150,${a})`;
      g.lineWidth = 1.6; g.beginPath(); g.arc(fx, fy, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    // depth ticks
    g.fillStyle = "rgba(200,225,235,.6)"; g.font = "8px system-ui"; g.textAlign = "right";
    for (let d = 0; d <= 1.001; d += 0.5) g.fillText(Math.round(d * 24) + "ft", W2 - 3, clamp(d * H2, 8, H2 - 3));
  }

  // ---- 3D underwater layer (Three.js). The 2D scene above keeps rendering as
  // a fallback; if WebGL is unavailable Scene3D never goes ready and we no-op.
  let _3dInit = false, _3dVenue = "";
  function drive3D(dt, now) {
    const S3 = window.Scene3D;
    if (!S3) return;
    if (!_3dInit) {
      _3dInit = true;
      try { S3.init(document.getElementById("c3d")); } catch (e) {}
    }
    if (!S3.isReady()) return;
    S3.setVisible(true);   // 3D now drives both surface & underwater; 2D stays as fallback beneath
    const sp = spot(), lu = lure(), dc = dayColors(sp);
    if (_3dVenue !== sp.id) { _3dVenue = sp.id; S3.setVenue(sp.water[0], sp.water[1]); }
    const band = S.cond.band, win = S.cond.window || 0.085;
    const lureDepth = S.mode === "fight" ? (S.bobberDepth != null ? S.bobberDepth : band) : S.rv.depth;
    const st = {
      view: S.view, mode: S.mode, band, win,
      lureDepth, lureDist: S.rv.dist, lureHex: COLORS[G.lure.color].hex, lureStyle: lu.style,
      lureId: lu.id, lurePhys: S.rv.phys || (lu.style === "top" ? "float" : lu.id === "crank" ? "dive" : "sink"),
      lureAction: S.rv.action || 0,
      inZone: Math.abs(lureDepth - band) < win,
      interest: S.rv.interest,
      daylight: dc.daylight, night: dc.night, sunX: dc.sunX, elev: dc.elev,
      skyTop: dc.top, skyBot: dc.bot, water0: sp.water[0],
      castAim: S.castAim ? { x: S.castAim.x, y: S.castAim.y } : null,
      castProgress: S.bobber.flyT || 0,
      heading: S.heading, holdBearing: S.holdBearing, facing: facingQuality(), steer: S.steer,
      structure: STRUCT_GROUP[position().id] || "open",
      hotZone: (function () { const z = hotZone(); return { x: z.x, y: z.y }; })(),
      fight: S.mode === "fight" && S.hookedFish ? {
        dist: S.ft.dist, state: S.ft.state, tension: S.ft.tension,
        size: S.ft.size, pull: S.ft.pull, art: S.hookedFish.art, reeling: !!S.holding,
        lat: S.ft.lat || 0,
      } : null,
      landing: S.mode === "landing" && S.hookedFish ? {
        t: clamp((S.landT || 0) / (S.landBig ? 1500 : 1000), 0, 1),
        big: !!S.landBig, size: S.ft.size, art: S.hookedFish.art,
      } : null,
    };
    S3.frame(st, dt);
  }

  function update(dt, now) {
    if (S.tournament && !S.tournament.ended) updateTourClock(dt);
    pollHold(now);

    // trolling-motor steering: hold a turn button to swing the boat
    if (S.steer) S.headingTarget = clamp(S.headingTarget + S.steer * dt * 0.0016, -Math.PI, Math.PI);
    S.heading += (S.headingTarget - S.heading) * Math.min(1, dt * 0.008);

    if (S.mode === "casting") {
      S.bobber.flyT += dt / 760;                       // windup+whip+flight all play out here
      const p = clamp(S.bobber.flyT, 0, 1);
      // lure leaves the rod tip after the whip (~45%), then arcs to the target
      const fp = clamp((p - 0.45) / 0.55, 0, 1);
      S.bobber.x = S.bobber.sx + (S.bobber.targetX - S.bobber.sx) * fp;
      const arc = Math.sin(fp * Math.PI) * (60 + S.bobber.dist * 130);
      S.bobber.y = S.bobber.sy + (S.bobber.targetY - S.bobber.sy) * fp - arc;
      if (p >= 1) { S.bobber.y = S.bobber.targetY; S.mode = "splashdown"; S.splashT = 0; }
    }
    if (S.mode === "splashdown") {                 // brief surface beat so the splash/ripples read
      S.splashT = (S.splashT || 0) + dt;
      if (S.splashT >= 360) startRetrieve();
    }
    if (S.mode === "retrieve") {
      updateRetrieve(dt, now);
      if (S.mode === "retrieve") {
        const tip = rodTip(), wl = waterLine(), wd = H - wl - 96;
        S.bobber.x = tip.x + (S.bobber.targetX - tip.x) * S.rv.dist;
        S.bobber.y = wl + 8 + S.rv.depth * wd;
      }
    }
    if (S.mode === "strike") {
      S.strikeWindow -= dt;
      S.bobber.y += Math.sin(now / 60) * 1.4;
      if (Math.random() < 0.3) ripple(S.bobber.x, S.bobber.y);
      if (S.strikeWindow <= 0) strikeMissed();
    }
    if (S.mode === "fight") {
      updateFight(dt, now);
      if (S.mode === "fight") {
        const tip = rodTip(), wl = waterLine();
        S.bobber.x = tip.x + (S.bobber.targetX - tip.x) * S.ft.dist;
        S.bobber.y = S.ft.state === "jump" ? wl - 16 - Math.abs(Math.sin(now / 80)) * 16 : wl + 14 + Math.sin(now / 200) * 3;
      }
    }
    if (S.mode === "landing") {
      S.landT = (S.landT || 0) + dt;
      if (S.landT >= (S.landBig ? 1500 : 1000)) finishLand();
    }

    for (const f of S.fishes) {
      f.x += f.dir * f.spd * dt * 0.06; f.wob += dt * 0.004;
      if (f.x < -30) { f.x = W + 30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
      if (f.x > W + 30) { f.x = -30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
    }
    for (const r of S.ripples) { r.r += dt * 0.05; r.a -= dt * 0.0012; }
    S.ripples = S.ripples.filter(r => r.a > 0);
    for (const s of S.splashes) { s.r += dt * 0.08; s.a -= dt * 0.0022; }
    S.splashes = S.splashes.filter(s => s.a > 0);

    // drifting clouds (surface) + particulate motes (underwater)
    for (const c of S.clouds) { c.x += c.spd * dt; if (c.x - 60 > W) c.x = -60; }
    for (const m of S.motes) { m.ph += m.spd * dt; m.y -= m.spd * dt * 6; m.x += Math.sin(m.ph) * 0.2; if (m.y < UW_TOP) { m.y = H; m.x = Math.random() * W; } }
    // water-spray droplets (gravity) + lure wake trail
    for (const s of S.spray) { s.vy += dt * 0.0007; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
    S.spray = S.spray.filter(s => s.life > 0);
    for (const t of S.trail) { t.r += dt * 0.03; t.a -= dt * 0.0018; }
    S.trail = S.trail.filter(t => t.a > 0);

    // camera crossfade + underwater bubbles
    if (S.viewT < 1) S.viewT = Math.min(1, S.viewT + dt / 420);
    if (S.view === "under") {
      if (Math.random() < dt * 0.004) S.bubbles.push({ x: rnd(0, W), y: H - 30, r: rnd(1.5, 4), a: 0.7, vy: rnd(0.02, 0.05) });
      for (const bb of S.bubbles) { bb.y -= bb.vy * dt; bb.a -= dt * 0.0005; }
      S.bubbles = S.bubbles.filter(b => b.a > 0 && b.y > UW_TOP);
    } else if (S.bubbles.length) S.bubbles.length = 0;
  }

  function updateRetrieve(dt, now) {
    const R = S.rv, lu = lure(), step = dt / 16.67;
    R.bob = (R.bob || 0) * Math.pow(0.84, step);   // twitch hop settles back down
    const ideal = lu.cadence === "fast" ? 250 : lu.cadence === "slow" ? 600 : 410;
    let q = 0.5;
    if (R.taps.length >= 2) {
      let sum = 0; for (let i = 1; i < R.taps.length; i++) sum += R.taps[i] - R.taps[i - 1];
      const avg = sum / (R.taps.length - 1), ratio = avg / ideal;
      q = clamp(1 - Math.abs(Math.log(ratio)) * 0.9, 0, 1);
    }
    const sinceTap = now - (R.taps[R.taps.length - 1] || -9999);
    if (sinceTap > ideal * 2.4 && !(S.holding && lu.cadence === "med")) q *= 0.35;
    if (S.holding && lu.cadence === "med") q = Math.max(q, 0.72);   // steady swim
    R.action += (q - R.action) * 0.10;

    // ---- lure physics in the water ----
    //  float (topwater): rides the surface, only moves horizontally
    //  dive  (crankbait): digs DOWN to its running depth as you wind, floats up on a pause
    //  sink  (worm/spoon/jig): sinks/flutters DOWN on a pause, lifts on the reel
    const phys = lu.style === "top" ? "float" : lu.id === "crank" ? "dive" : "sink";
    if (S.holding) {
      R.dist = clamp(R.dist - 0.0020 * step * (1 + rod().power * 0.10), 0, 1);
      if (phys === "dive") R.depth = clamp(R.depth + 0.0052 * step, 0, lu.band);
      else if (phys === "sink") R.depth = clamp(R.depth - 0.0040 * step, 0, 1);
    } else {
      if (phys === "sink") R.depth = clamp(R.depth + 0.0030 * step, 0, Math.min(1, lu.band + 0.12));
      else if (phys === "dive") R.depth = clamp(R.depth - 0.0040 * step, 0, lu.band);
      else R.depth = lu.band;   // topwater rides the surface
    }
    S.rv.phys = phys;

    // strategic suitability (the bite rating) × live skill (working it at the right depth)
    const sc = lureScore(lu).score;
    const depthNow = clamp(1 - Math.abs(R.depth - S.cond.band) / ((S.cond.window || 0.09) * 3), 0, 1);
    const struct = S.castBonus ? 1.2 : 1;
    const aimed = 0.55 + 0.45 * (S.castFacing != null ? S.castFacing : 1);   // faced the fish when you cast?
    const hot = lu.id === S.cond.hotLure ? 1.45 : 1;                          // matched the day's pattern
    const build = (R.action > 0.55 ? 1 : 0.3) * (0.25 + sc) * depthNow * struct * aimed * (S.castLuck || 1) * hot;
    R.interest = clamp(R.interest + (build * 0.012 - 0.0016) * step, 0, 1);
    R.follower = R.interest;
    if (R.interest >= 1) { strike(); return; }
    if (R.dist <= 0) { endRetrieveMiss(); return; }

    el.rvDepth.textContent = Math.round(R.depth * 24) + " ft";
    el.rvLine.textContent = Math.round(R.dist * (S.castFt || 60)) + " ft";
    el.rvAction.style.width = (R.action * 100) + "%";
    el.rvInterest.style.width = (R.interest * 100) + "%";
    const band = S.cond.band;
    let hint;
    if (lu.style === "top") {
      if (band > 0.24) hint = "Fish are holding deep — try a sinking lure";
      else hint = R.action > 0.6 ? "Perfect action — a bass is closing in!" : "Working the surface — keep twitching!";
    } else if (R.depth < band - (S.cond.window || 0.1)) hint = "Let it sink deeper…";
    else if (R.depth > band + (S.cond.window || 0.1)) hint = "Too deep — reel it up";
    else hint = R.action > 0.6 ? "Perfect action — a bass is closing in!" : "On their level — work it!";
    el.rvHint.textContent = hint;
    el.rvHint.className = "phase-hint" + (R.interest > 0.5 ? " good" : "");
  }

  function updateFight(dt, now) {
    const T = S.ft;
    T.stateT -= dt;
    if (T.stateT <= 0) {
      const tired = T.stamina < 0.33, r = Math.random();
      if (T.state === "tire") {
        if (!tired && r < 0.3) { T.state = "jump"; T.stateT = rnd(450, 800); }
        else { T.state = "run"; T.stateT = rnd(650, 1500) * (0.6 + T.size * 0.8); T.latTarget = rnd(-1, 1) * (0.5 + T.size * 0.5); }
      } else { T.state = "tire"; T.stateT = rnd(700, 1400) * (1.2 - T.size * 0.5); T.latTarget = (T.latTarget || 0) * 0.3; }
    }
    // a hooked bass bolts side to side, not just straight out
    if (T.lat == null) { T.lat = 0; T.latTarget = 0; }
    const latSpeed = T.state === "run" ? 0.006 : T.state === "jump" ? 0.004 : 0.0022;
    T.lat += ((T.latTarget || 0) - T.lat) * Math.min(1, dt * latSpeed) + (T.state === "run" ? Math.sin(now / 230) * 0.0009 * dt : 0);
    T.lat = clamp(T.lat, -1, 1);
    const sFactor = 0.35 + 0.65 * T.stamina;
    let pull = T.state === "jump" ? 1.5 : T.state === "run" ? 1.0 : 0.2;
    pull *= sFactor * (0.7 + T.size * 0.7);
    T.pull = pull;
    const rodTol = 1 + (rod().power - 1) * 0.55;

    if (S.holding) {
      T.tension += dt * (0.00050 + pull * 0.00150) / rodTol;
      T.dist = clamp(T.dist - dt * 0.00017 * (1.25 - pull * 0.6), 0, 1);
      T.stamina = clamp(T.stamina - dt * (0.00006 + (T.state === "tire" ? 0.00019 : 0.00004)), 0, 1);
    } else {
      T.tension -= dt * 0.0016;
      if (T.state === "run") T.dist = clamp(T.dist + dt * 0.00010, 0, 1);
      T.stamina = clamp(T.stamina - dt * 0.00003, 0, 1);
    }
    T.tension = clamp(T.tension, 0, 1);
    if (T.state === "jump" && Math.random() < 0.06) splash(S.bobber.x, waterLine());

    if (T.tension >= 1) { loseFish("The line snapped!"); return; }
    if (T.dist <= 0 && T.stamina < 0.25) { landFish(); return; }
    if (T.dist <= 0 && T.stamina >= 0.25) { T.dist = 0.04; T.state = "run"; T.stateT = rnd(450, 900); }

    el.ftStamina.style.width = (T.stamina * 100) + "%";
    el.ftTension.style.width = (T.tension * 100) + "%";
    el.ftDist.style.width = ((1 - T.dist) * 100) + "%";
    el.ftFishMark.style.left = ((1 - T.dist) * 100) + "%";
    el.ftLine.textContent = Math.round(T.dist * (S.castFt || 60)) + " ft";
    const running = T.state !== "tire";
    el.ftHint.textContent = T.tension > 0.78 ? "EASE OFF — about to snap!" : running ? "It's running — give it line!" : "Tired — reel it in!";
    el.ftHint.className = "phase-hint" + (T.tension > 0.78 || running ? " warn" : " good");
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
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }

  function drawFishShape(x, y, size, fill, dir, eye) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.5, 0, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(-size - size * 0.55, -size * 0.42); ctx.lineTo(-size - size * 0.55, size * 0.42); ctx.closePath(); ctx.fill();
    // dorsal + pectoral hints
    ctx.beginPath(); ctx.moveTo(-size * 0.2, -size * 0.5); ctx.lineTo(size * 0.2, -size * 0.85); ctx.lineTo(size * 0.35, -size * 0.45); ctx.closePath(); ctx.fill();
    if (eye) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(size * 0.55, -size * 0.12, size * 0.15, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#16242b"; ctx.beginPath(); ctx.arc(size * 0.58, -size * 0.12, size * 0.075, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  // Detailed side-view bass on canvas (matches the catch-screen art quality).
  function drawBassPattern(a, rx, ry) {
    const pc = a.patColor || "#33401f";
    ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = pc;
    if (a.pat === "lateral") { for (let i = 0; i < 5; i++) { const x = -rx * 0.62 + i * rx * 0.32; ctx.beginPath(); ctx.ellipse(x, 0, rx * 0.08, ry * 0.5, 0, 0, 6.29); ctx.fill(); } }
    else if (a.pat === "bars") { for (let i = 0; i < 5; i++) { const x = -rx * 0.6 + i * rx * 0.3; ctx.fillRect(x, -ry * 0.78, rx * 0.05, ry * 1.56); } }
    else if (a.pat === "spots") { for (let i = 0; i < 6; i++) { const x = -rx * 0.66 + i * rx * 0.26; ctx.beginPath(); ctx.arc(x, ry * 0.42, rx * 0.045, 0, 6.29); ctx.fill(); } ctx.beginPath(); ctx.ellipse(0, -ry * 0.05, rx * 0.5, ry * 0.12, 0, 0, 6.29); ctx.fill(); }
    else if (a.pat === "trout") { ctx.fillStyle = "#e3849e"; ctx.fillRect(-rx * 0.7, -ry * 0.12, rx * 1.4, ry * 0.24); ctx.fillStyle = pc; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-rx * 0.6 + i * rx * 0.2, -ry * 0.4 + (i % 2) * ry * 0.3, rx * 0.035, 0, 6.29); ctx.fill(); } }
    ctx.restore();
  }
  function drawBass(x, y, len, art, dir, alpha) {
    const a = art || {};
    const body = a.body || "#6f9e4e", back = a.back || shade(body, -36), belly = a.belly || "#eef1d6", fin = shade(back, -4);
    const rx = len * 0.5, ry = len * 0.27;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir || 1, 1); if (alpha != null) ctx.globalAlpha = alpha;
    // soft drop shadow
    ctx.save(); ctx.globalAlpha *= 0.22; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(0, ry + len * 0.08, rx * 0.9, ry * 0.4, 0, 0, 6.29); ctx.fill(); ctx.restore();
    // tail
    ctx.fillStyle = fin;
    ctx.beginPath(); ctx.moveTo(-rx + len * 0.06, 0); ctx.lineTo(-rx - len * 0.22, -len * 0.2); ctx.lineTo(-rx - len * 0.08, 0); ctx.lineTo(-rx - len * 0.22, len * 0.2); ctx.closePath(); ctx.fill();
    // dorsal fin (spiny + soft)
    ctx.beginPath(); ctx.moveTo(-rx * 0.42, -ry * 0.92); ctx.lineTo(-rx * 0.1, -ry - len * 0.16); ctx.lineTo(rx * 0.16, -ry - len * 0.03); ctx.lineTo(rx * 0.42, -ry - len * 0.12); ctx.lineTo(rx * 0.52, -ry * 0.8); ctx.closePath(); ctx.fill();
    // body
    const g = ctx.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, back); g.addColorStop(0.52, body); g.addColorStop(1, belly);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 6.29); ctx.fill();
    drawBassPattern(a, rx, ry);
    // pectoral fin
    ctx.fillStyle = shade(body, -16); ctx.beginPath(); ctx.moveTo(rx * 0.22, ry * 0.25); ctx.quadraticCurveTo(rx * 0.5, ry * 1.15, rx * 0.04, ry * 0.95); ctx.closePath(); ctx.fill();
    // gill line
    ctx.save(); ctx.globalAlpha *= 0.5; ctx.strokeStyle = shade(back, -8); ctx.lineWidth = Math.max(1, len * 0.03);
    ctx.beginPath(); ctx.moveTo(rx * 0.5, -ry * 0.62); ctx.quadraticCurveTo(rx * 0.42, 0, rx * 0.5, ry * 0.62); ctx.stroke(); ctx.restore();
    // eye
    const ex = rx * 0.64, ey = -ry * 0.26, er = Math.max(2, len * 0.075);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 6.29); ctx.fill();
    ctx.fillStyle = a.eye || "#16242b"; ctx.beginPath(); ctx.arc(ex + er * 0.2, ey, er * 0.55, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.2, 0, 6.29); ctx.fill();
    // mouth
    ctx.strokeStyle = shade(back, -16); ctx.lineWidth = Math.max(1.5, len * 0.045); ctx.lineCap = "round";
    if (a.bigmouth) { ctx.beginPath(); ctx.moveTo(rx * 0.78, ey + er * 1.4); ctx.lineTo(rx * 1.05, ry * 0.18); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx * 1.02, ry * 0.2); ctx.lineTo(rx * 0.8, ry * 0.5); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(rx * 0.92, ry * 0.08); ctx.lineTo(rx * 1.04, ry * 0.3); ctx.stroke(); }
    ctx.restore();
  }

  // ---- Lure art: each of the 8 lures, tinted by the chosen color, animated by `ph`
  function drawLure(x, y, id, hex, ph, scale, facing) {
    const dark = shade(hex, -45), light = shade(hex, 45);
    ctx.save(); ctx.translate(x, y); ctx.scale((facing || 1) * (scale || 1), (scale || 1));
    const hook = (hx, hy) => { ctx.strokeStyle = "#d7dde2"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.arc(hx, hy + 4, 2.8, Math.PI, 0.3, false); ctx.stroke(); };
    if (id === "worm") {
      ctx.strokeStyle = hex; ctx.lineCap = "round"; ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const t = i / 12, px = -15 + t * 28, py = Math.sin(t * 6.0 + ph) * 4 * (1 - Math.abs(t - 0.5)); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(-15, Math.sin(ph) * 1.6, 3.4, 0, 6.29); ctx.fill();
    } else if (id === "frog") {
      ctx.fillStyle = hex; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 6.29); ctx.fill();
      const k = Math.sin(ph) * 3; ctx.strokeStyle = shade(hex, -22); ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(8, 3); ctx.lineTo(15, 8 + k); ctx.lineTo(11, 12 + k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(15, -8 - k); ctx.lineTo(11, -12 - k); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-7, -4, 2.4, 0, 6.29); ctx.arc(-7, 4, 2.4, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-7, -4, 1.1, 0, 6.29); ctx.arc(-7, 4, 1.1, 0, 6.29); ctx.fill();
    } else if (id === "spoon") {
      ctx.save(); ctx.rotate(Math.sin(ph) * 0.5);
      const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, light); g.addColorStop(0.5, hex); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(-2, -2, 3, 6, 0, 0, 6.29); ctx.stroke();
      ctx.restore(); hook(0, 13);
    } else if (id === "crank") {
      const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, light); g.addColorStop(1, hex);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(185,212,232,.85)"; ctx.beginPath(); ctx.moveTo(-12, 3); ctx.lineTo(-20, 9); ctx.lineTo(-16, 11); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(7, -2, 2.4, 0, 6.29); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(7, -2, 1.1, 0, 6.29); ctx.fill();
      hook(2, 8); hook(11, 7);
    } else if (id === "torpedo") {
      ctx.fillStyle = hex; ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(-3, -1.5, 9, 2, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "#d7dde2"; ctx.lineWidth = 1.6; const pr = 3 + Math.sin(ph * 3) * 2.5;
      ctx.beginPath(); ctx.moveTo(13, -pr); ctx.lineTo(18, pr); ctx.moveTo(13, pr); ctx.lineTo(18, -pr); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-7, -1, 2, 0, 6.29); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-7, -1, 1, 0, 6.29); ctx.fill();
      hook(0, 5); hook(8, 5);
    } else if (id === "jitterbug") {
      ctx.fillStyle = hex; ctx.beginPath(); ctx.ellipse(2, 0, 11, 7, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(200,210,220,.92)"; ctx.beginPath(); ctx.moveTo(-8, -6); ctx.quadraticCurveTo(-21, 0, -8, 6); ctx.quadraticCurveTo(-12, 0, -8, -6); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(4, -2, 2, 0, 6.29); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(4, -2, 1, 0, 6.29); ctx.fill();
      hook(4, 7);
    } else if (id === "pencil") {
      const g = ctx.createLinearGradient(-16, 0, 16, 0); g.addColorStop(0, dark); g.addColorStop(1, light);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 16, 4.2, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-11, -1, 2, 0, 6.29); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-11, -1, 1, 0, 6.29); ctx.fill();
      hook(3, 4.5); hook(12, 4.5);
    } else if (id === "furry") {
      ctx.strokeStyle = hex; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) { const yy = -5 + i * 1.5, fl = Math.sin(ph + i * 0.6) * 2.4; ctx.beginPath(); ctx.moveTo(-4, yy); ctx.quadraticCurveTo(8, yy + fl, 17, yy + fl * 1.4); ctx.stroke(); }
      ctx.fillStyle = shade(hex, -12); ctx.beginPath(); ctx.arc(-7, -1, 5.5, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-9, -2.5, 1.7, 0, 6.29); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-9, -2.5, 0.85, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  // ---- View dispatcher with surface <-> underwater crossfade
  function render(now) {
    if (S.view === "under") {
      renderUnder(now);
      if (S.viewT < 1) { ctx.save(); ctx.globalAlpha = 1 - ease(S.viewT); renderSurface(now); ctx.restore(); }
    } else {
      renderSurface(now);
      if (S.viewT < 1) { ctx.save(); ctx.globalAlpha = 1 - ease(S.viewT); renderUnder(now); ctx.restore(); }
    }
  }

  // ===========================================================================
  // Surface view — read the structure & fish shadows, aim, and cast
  // ===========================================================================
  // ---- Time-of-day lighting ----
  function hx(c) { let h = c.replace("#", ""); if (h.length === 3) h = h.split("").map(x => x + x).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { const A = hx(a), B = hx(b); return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"; }
  const SKY_KEYS = [
    { h: 0, top: "#0a1230", bot: "#172048", night: 1, amb: "rgba(10,16,40,0.45)" },
    { h: 5, top: "#3a3560", bot: "#6a5a82", night: 1, amb: "rgba(34,32,72,0.34)" },
    { h: 6.6, top: "#f0a464", bot: "#ffd9a8", night: 0, amb: "rgba(255,180,110,0.14)" },
    { h: 9, top: "#7fc8e6", bot: "#cdeef7", night: 0, amb: "rgba(255,255,255,0)" },
    { h: 13, top: "#69b6e6", bot: "#cfeefb", night: 0, amb: "rgba(255,255,255,0)" },
    { h: 17, top: "#86c5e0", bot: "#ffe6c0", night: 0, amb: "rgba(255,210,150,0.08)" },
    { h: 18.7, top: "#e8794a", bot: "#ffcf9a", night: 0, amb: "rgba(255,150,90,0.16)" },
    { h: 20, top: "#22305f", bot: "#34406f", night: 1, amb: "rgba(20,30,70,0.34)" },
    { h: 24, top: "#0a1230", bot: "#172048", night: 1, amb: "rgba(10,16,40,0.45)" },
  ];
  function dayColors(sp) {
    if (sp.id === "deep") return { top: sp.sky[0], bot: sp.sky[1], night: true, moon: true, sunX: 0.78, elev: 0.25, sunColor: "#e9edff", amb: "rgba(12,18,44,0.30)", daylight: 0.14 };
    const hour = ((S.cond.timeMin / 60) % 24 + 24) % 24;
    let i = 0; while (i < SKY_KEYS.length - 1 && hour > SKY_KEYS[i + 1].h) i++;
    const a = SKY_KEYS[i], b = SKY_KEYS[Math.min(i + 1, SKY_KEYS.length - 1)];
    const t = (b.h === a.h) ? 0 : clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const night = (a.night * (1 - t) + b.night * t) > 0.5;
    const prog = clamp((hour - 6) / 12, 0, 1), elev = Math.sin(prog * Math.PI);
    return {
      top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), night, moon: night,
      sunX: 0.12 + prog * 0.76, elev,
      sunColor: night ? "#e9edff" : mix("#ffb070", "#fff2b8", clamp(elev, 0, 1)),
      amb: t < 0.5 ? a.amb : b.amb,
      daylight: night ? 0.14 : clamp(0.4 + elev * 0.6, 0.4, 1),
    };
  }

  function renderSurface(now) {
    const sp = spot(), wl = waterLine();
    const w = S.cond.weather, dc = dayColors(sp), night = dc.night;
    const sky = ctx.createLinearGradient(0, 0, 0, wl);
    sky.addColorStop(0, dc.top); sky.addColorStop(1, dc.bot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, wl);
    const sunX = dc.sunX * W, sunY = wl * (0.72 - 0.5 * dc.elev);
    {
      const gl = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 140);
      gl.addColorStop(0, night ? "rgba(210,220,255,0.40)" : "rgba(255,240,180,0.55)");
      gl.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, wl);
      ctx.beginPath(); ctx.arc(sunX, sunY, night ? 26 : 30, 0, 6.29);
      ctx.fillStyle = dc.sunColor; ctx.fill();
    }
    // drifting clouds
    ctx.fillStyle = night ? "rgba(180,190,220,0.12)" : (w === "fog" ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.72)");
    for (const c of S.clouds) drawCloud(c.x, c.y, c.s);
    // hills
    ctx.fillStyle = night ? "rgba(20,30,60,.6)" : "rgba(70,150,120,.45)";
    ctx.beginPath(); ctx.moveTo(0, wl);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, wl - 26 - Math.sin(x * 0.01 + 1) * 18 - Math.sin(x * 0.03) * 8);
    ctx.lineTo(W, wl); ctx.closePath(); ctx.fill();
    if (w === "cloud" || w === "fog") { ctx.fillStyle = w === "fog" ? "rgba(208,218,224,0.24)" : "rgba(150,162,172,0.16)"; ctx.fillRect(0, 0, W, wl); }

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
    // sun glint shimmering on the water under the sun
    {
      ctx.save(); ctx.fillStyle = night ? "rgba(210,220,255,0.10)" : "rgba(255,240,180,0.13)";
      for (let yy = wl + 8; yy < H; yy += 9) { const ww = 26 + (yy - wl) * 0.55, wob = Math.sin(yy * 0.18 + now / 320) * 9; ctx.fillRect(sunX - ww / 2 + wob, yy, ww, 3); }
      ctx.restore();
    }
    // ambient time-of-day tint over the whole scene
    if (dc.amb && dc.amb !== "rgba(255,255,255,0)") { ctx.fillStyle = dc.amb; ctx.fillRect(0, 0, W, H); }

    drawShoreline(now, sp, wl);

    const hz = hotZone();
    drawStructure(now, hz, sp);

    // roaming fish shadows + a cluster holding on the structure (where to cast)
    for (const f of S.fishes) {
      ctx.save(); ctx.translate(f.x, f.y + Math.sin(f.wob) * 3); ctx.scale(f.dir, 1);
      ctx.fillStyle = "rgba(10,25,30,0.18)";
      ctx.beginPath(); ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, 6.29); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-f.size, 0); ctx.lineTo(-f.size - 8, -6); ctx.lineTo(-f.size - 8, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (S.mode === "idle" || S.mode === "charging") {
      const q = posQuality(), holders = 2 + Math.round(q * 3);
      for (let i = 0; i < holders; i++) {
        const a = now / 2600 + i * 6.283 / holders;
        const hx = hz.x + Math.cos(a) * hz.rx * 0.7, hy = hz.y + Math.sin(a) * hz.ry * 0.7;
        const dir = Math.cos(a) < 0 ? -1 : 1, sz = 10 + (i % 3) * 4;
        ctx.save(); ctx.translate(hx, hy); ctx.scale(dir, 1);
        ctx.fillStyle = "rgba(10,25,30,0.30)";
        ctx.beginPath(); ctx.ellipse(0, 0, sz, sz * 0.45, 0, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.lineTo(-sz - 7, -5); ctx.lineTo(-sz - 7, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    drawRipplesSplashes();

    if (S.mode === "charging" && S.castAim) {
      const tip = rodTip();
      ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(S.castAim.x, S.castAim.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,235,170,0.85)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(S.castAim.x, S.castAim.y, 10, 0, 6.29); ctx.stroke();
    }

    drawAngler();

    // lure in flight during the cast (the actual lure, not a bobber)
    if (S.mode === "casting") {
      const tip = rodTip();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(S.bobber.x, S.bobber.y); ctx.stroke();
      drawLure(S.bobber.x, S.bobber.y, G.lure.id, COLORS[G.lure.color].hex, now / 90, 0.7, -1);
    }
    drawVignette();
  }

  function posQuality() {
    const sp = spot(), pos = position();
    const rows = sp.fish.map(e => e.weight * ((pos.bias && pos.bias[e.k]) || 1) * (fishDef(e.k).rarity === "junk" ? 0.2 : 1));
    const tot = rows.reduce((a, b) => a + b, 0);
    return clamp(tot / 120, 0.2, 1);
  }

  function drawStructure(now, hz, sp) {
    const id = position().id;
    ctx.save();
    // soft "good water" glow under the structure
    const g = ctx.createRadialGradient(hz.x, hz.y, 4, hz.x, hz.y, Math.max(hz.rx, hz.ry) * 1.1);
    g.addColorStop(0, "rgba(120,200,120,0.10)"); g.addColorStop(1, "rgba(120,200,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(hz.x, hz.y, hz.rx * 1.1, hz.ry * 1.1, 0, 0, 6.29); ctx.fill();

    const X = hz.x, Y = hz.y, R = Math.min(hz.rx, hz.ry);
    if (id === "pads" || id === "weed") {
      for (let i = 0; i < 6; i++) {
        const a = i * 6.283 / 6 + now / 4000, px = X + Math.cos(a) * hz.rx * 0.7, py = Y + Math.sin(a) * hz.ry * 0.7, r = 11 + (i % 3) * 4;
        ctx.fillStyle = "#3f7d3a"; ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.6, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#54a04a"; ctx.beginPath(); ctx.ellipse(px - 1, py - 1, r * 0.8, r * 0.45, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = sp.water[1]; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, r, -0.5, 0.4); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#f2a6d0"; ctx.beginPath(); ctx.arc(X, Y, 4, 0, 6.29); ctx.fill();
    } else if (id === "dock") {
      ctx.fillStyle = "rgba(80,55,32,0.95)";
      ctx.fillRect(0, Y - 6, X + R, 12);
      for (let px = 14; px < X + R; px += 26) { ctx.fillStyle = "rgba(40,28,16,0.9)"; ctx.fillRect(px, Y + 6, 6, 16); }
      ctx.fillStyle = "rgba(60,42,24,0.95)"; ctx.fillRect(X - R, Y - 8, R * 2, 5);
    } else if (id === "bank" || id === "pool" || id === "logs") {
      ctx.save(); ctx.translate(X, Y); ctx.rotate(-0.25);
      ctx.fillStyle = "#5a4128"; ctx.beginPath(); ctx.ellipse(0, 0, R + 16, 8, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#3c2b18"; ctx.beginPath(); ctx.ellipse(R + 16, 0, 5, 8, 0, 0, 6.29); ctx.fill();
      for (let bx = -R; bx < R; bx += 14) { ctx.strokeStyle = "rgba(40,28,16,.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, -7); ctx.lineTo(bx, 7); ctx.stroke(); }
      ctx.restore();
    } else if (id === "reeds" || id === "tailout" || id === "flat") {
      for (let i = -5; i <= 5; i++) {
        const bx = X + i * 9 + Math.sin(now / 800 + i) * 2, h = 26 + (i % 3) * 8;
        ctx.strokeStyle = "#5e7d3a"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(bx, Y + 6); ctx.lineTo(bx + Math.sin(now / 700 + i) * 3, Y + 6 - h); ctx.stroke();
        ctx.fillStyle = "#7a5a2a"; ctx.beginPath(); ctx.ellipse(bx + Math.sin(now / 700 + i) * 3, Y + 6 - h, 2.4, 6, 0, 0, 6.29); ctx.fill();
      }
    } else if (id === "rocks" || id === "riffle" || id === "point") {
      for (let i = 0; i < 4; i++) {
        const px = X + (i - 1.5) * R * 0.55, py = Y + (i % 2) * 6, r = 9 + (i % 3) * 5;
        ctx.fillStyle = "#6b6f73"; ctx.beginPath(); ctx.arc(px, py, r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#878c90"; ctx.beginPath(); ctx.arc(px - 2, py - 1, r * 0.7, Math.PI, 0); ctx.fill();
      }
    } else { // drop-off / hole / open water — deeper water + a round marker buoy
      const dg = ctx.createRadialGradient(X, Y, 4, X, Y, R + 22);
      dg.addColorStop(0, "rgba(0,12,24,0.34)"); dg.addColorStop(1, "rgba(0,12,24,0)");
      ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(X, Y, R + 22, (R + 22) * 0.55, 0, 0, 6.29); ctx.fill();
      const by = Y - 2 + Math.sin(now / 600) * 2;
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(X, by + 11, 11, 4, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#f4f4f2"; ctx.beginPath(); ctx.arc(X, by, 8, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "#e23b2e"; ctx.beginPath(); ctx.arc(X, by, 8, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, by, 8, 0, 6.29); ctx.stroke();
      ctx.fillStyle = "#d8d8d6"; ctx.fillRect(X - 1.4, by - 13, 2.8, 7);
      ctx.fillStyle = "#ffd35c"; ctx.beginPath(); ctx.arc(X, by - 14, 2.4, 0, 6.29); ctx.fill();
    }
    ctx.restore();
  }

  // ===========================================================================
  // Underwater view — watch the lure & the fish that pursue it
  // ===========================================================================
  const UW_TOP = 52;
  function depthY(d) { return UW_TOP + d * (H - 34 - UW_TOP); }

  function renderUnder(now) {
    const sp = spot(), dc = dayColors(sp), dl = dc.daylight;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(sp.water[0], 30 * dl)); g.addColorStop(0.18, sp.water[0]); g.addColorStop(1, sp.water[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // underside of the surface with moving light
    ctx.fillStyle = "rgba(255,255,255," + (0.10 * dl) + ")"; ctx.fillRect(0, 0, W, UW_TOP);
    ctx.strokeStyle = "rgba(255,255,255," + (0.16 * dl) + ")"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) { const yy = UW_TOP + Math.sin(x * 0.05 + now / 380) * 3; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
    ctx.stroke();
    // god rays (fade out at night)
    ctx.save(); ctx.globalAlpha = 0.04 + 0.08 * dl;
    for (let i = 0; i < 4; i++) {
      const rx = W * (0.2 + i * 0.22) + Math.sin(now / 3000 + i) * 20;
      ctx.fillStyle = "#dff6ff"; ctx.beginPath();
      ctx.moveTo(rx, UW_TOP); ctx.lineTo(rx + 34, UW_TOP); ctx.lineTo(rx + 90, H); ctx.lineTo(rx - 30, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // caustic light dapples just under the surface
    ctx.save(); ctx.globalAlpha = 0.05 + 0.09 * dl; ctx.fillStyle = "#eafaff";
    for (let x = 0; x < W; x += 34) { const cw = 14 + Math.sin(x * 0.2 + now / 500) * 6; ctx.beginPath(); ctx.ellipse(x + (now / 40 % 34), UW_TOP + 10, cw, 4, 0, 0, 6.29); ctx.fill(); }
    ctx.restore();
    // drifting particulate
    ctx.fillStyle = "rgba(220,240,250,0.5)";
    for (const m of S.motes) { ctx.globalAlpha = 0.25 + Math.sin(m.ph) * 0.2; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.29); ctx.fill(); }
    ctx.globalAlpha = 1;

    // bottom: weeds or rocks
    ctx.fillStyle = shade(sp.water[1], -12); ctx.fillRect(0, H - 30, W, 30);
    if (sp.id === "deep") {
      for (let i = 0; i < 6; i++) { const rx = (i + 0.5) * W / 6, rr = 14 + (i % 3) * 8; ctx.fillStyle = "rgba(10,16,30,0.9)"; ctx.beginPath(); ctx.arc(rx, H - 28, rr, Math.PI, 0); ctx.fill(); }
    } else {
      ctx.strokeStyle = "rgba(40,90,50,0.8)"; ctx.lineWidth = 4; ctx.lineCap = "round";
      for (let i = 0; i < 11; i++) { const wx = (i + 0.5) * W / 11; ctx.beginPath(); ctx.moveTo(wx, H - 28); ctx.quadraticCurveTo(wx + Math.sin(now / 600 + i) * 12, H - 60, wx + Math.sin(now / 600 + i) * 6, H - 86); ctx.stroke(); }
    }

    // rising bubbles
    for (const bb of S.bubbles) { ctx.strokeStyle = "rgba(255,255,255," + (bb.a * 0.6) + ")"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bb.x, bb.y, bb.r, 0, 6.29); ctx.stroke(); }

    // BITE ZONE band (where the bass are holding) — width varies with feeding activity
    const band = S.cond.band, win = S.cond.window || 0.085;
    const zTop = depthY(clamp(band - win, 0, 1)), zBot = depthY(clamp(band + win, 0, 1));
    const lureDepth = S.mode === "fight" ? clamp((S.bobberDepth != null ? S.bobberDepth : band), 0, 1) : S.rv.depth;
    const inZone = Math.abs(lureDepth - band) < win;
    ctx.fillStyle = inZone ? "rgba(91,227,122,0.18)" : "rgba(255,211,92,0.10)";
    ctx.fillRect(0, zTop, W, zBot - zTop);
    ctx.setLineDash([7, 7]); ctx.strokeStyle = inZone ? "rgba(120,240,150,0.7)" : "rgba(255,211,92,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, zTop); ctx.lineTo(W, zTop); ctx.moveTo(0, zBot); ctx.lineTo(W, zBot); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = inZone ? "rgba(120,240,150,0.95)" : "rgba(255,211,92,0.9)";
    ctx.font = "bold 10px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("🎯 BITE ZONE", 10, (zTop + zBot) / 2);

    // depth ruler (right edge)
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.textAlign = "right";
    for (let d = 0; d <= 1.0001; d += 0.25) {
      const yy = depthY(d); ctx.beginPath(); ctx.moveTo(W - 4, yy); ctx.lineTo(W - 12, yy); ctx.stroke();
      ctx.fillStyle = "rgba(220,235,240,0.7)"; ctx.font = "9px system-ui"; ctx.fillText(Math.round(d * 24) + "ft", W - 14, yy);
    }
    ctx.textAlign = "left";

    const rodEntry = { x: W * 0.28, y: UW_TOP };
    // line-out readout at the rod entry
    const frac = S.mode === "fight" ? S.ft.dist : S.rv.dist;
    ctx.fillStyle = "rgba(220,235,240,0.85)"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("↤ " + Math.round(frac * (S.castFt || 60)) + " ft line out", rodEntry.x + 6, UW_TOP - 3);

    if (S.mode === "retrieve" || S.mode === "strike") {
      const lu2 = lure();
      const amp = lu2.cadence === "fast" ? 11 : lu2.cadence === "slow" ? 6 : 8;
      const per = lu2.cadence === "fast" ? 90 : lu2.cadence === "slow" ? 200 : 135;
      const jig = Math.sin(now / per) * amp;       // the lure works up & down as you retrieve
      const lureX = lerp(W * 0.66, W * 0.34, 1 - S.rv.dist) + Math.sin(now / 130) * (S.mode === "strike" ? 1 : 3);
      const lureY = depthY(S.rv.depth) + jig + (S.rv.bob || 0);
      // wake trailing behind the lure as it swims
      if (now - (S._trailT || 0) > 60) { S._trailT = now; S.trail.push({ x: lureX + 11, y: lureY, r: 2.5, a: 0.45 }); }
      for (const t of S.trail) { ctx.strokeStyle = "rgba(210,235,245," + t.a + ")"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 6.29); ctx.stroke(); }
      // topwater V-wake at the surface
      if (lu2.style === "top") {
        ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(lureX, UW_TOP + 2); ctx.lineTo(lureX + 20, UW_TOP + 13);
        ctx.moveTo(lureX, UW_TOP + 2); ctx.lineTo(lureX - 20, UW_TOP + 13); ctx.stroke();
      }
      // pursuers closing in as interest builds
      drawPursuers(now, lureX, lureY);
      // line + lure
      ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(rodEntry.x, rodEntry.y); ctx.lineTo(lureX, lureY); ctx.stroke();
      drawLure(lureX, lureY, G.lure.id, COLORS[G.lure.color].hex, now / (lure().cadence === "fast" ? 70 : lure().cadence === "slow" ? 150 : 100), 1, -1);
      // zone coaching arrow by the lure
      if (S.mode === "retrieve") {
        if (lure().style === "top") {
          if (band > 0.24) zoneArrow(lureX + 26, lureY, 1, "FISH ARE DEEP");
          else { ctx.strokeStyle = "rgba(120,240,150,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lureX, lureY, 18 + Math.sin(now / 200) * 2, 0, 6.29); ctx.stroke(); }
        } else if (lureDepth < band - win) zoneArrow(lureX + 26, lureY, 1, "LET IT SINK");
        else if (lureDepth > band + win) zoneArrow(lureX + 26, lureY, -1, "REEL UP");
        else { ctx.strokeStyle = "rgba(120,240,150,0.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lureX, lureY, 18 + Math.sin(now / 200) * 2, 0, 6.29); ctx.stroke(); }
      }
    }

    if (S.mode === "fight") {
      const f = S.hookedFish;
      const fx = lerp(W * 0.66, W * 0.34, 1 - S.ft.dist);
      let fy;
      if (S.ft.state === "jump") fy = UW_TOP - 6 - Math.abs(Math.sin(now / 80)) * 46;
      else fy = depthY(clamp(0.45 + Math.sin(now / 240) * 0.12 + (S.ft.state === "run" ? 0.18 : 0), 0.1, 0.9));
      S.bobberDepth = clamp((fy - UW_TOP) / (H - 34 - UW_TOP), 0, 1);
      const taut = S.ft.tension;
      // flexing rod tip dipping into the water — loads up with tension & pull
      const wob = Math.sin(now / 55) * (1 + taut * 5) + (S.ft.state === "jump" ? Math.sin(now / 40) * 5 : 0);
      const bend = 10 + taut * 34 + S.ft.pull * 8 + wob;          // how hard the rod bows toward the fish
      const baseX = rodEntry.x - 30, baseY = -16, tipX = rodEntry.x, tipY = rodEntry.y + 6;
      const cx = (baseX + tipX) / 2 + bend * 0.7, cy = (baseY + tipY) / 2 + bend;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#5a3f22"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(cx, cy, tipX, tipY); ctx.stroke();
      ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(cx, cy, tipX, tipY); ctx.stroke();
      // line from the bent rod tip down to the fish
      ctx.strokeStyle = taut > 0.7 ? "rgba(255,120,120,0.85)" : "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tipX, tipY);
      const sag = 22 - taut * 28; ctx.quadraticCurveTo((tipX + fx) / 2, (tipY + fy) / 2 + sag, fx, fy); ctx.stroke();
      const dir = S.ft.state === "run" ? 1 : -1;
      const len = 46 + 46 * S.ft.size;
      drawBass(fx, fy, len, f && f.art, dir, 1);
      // the lure in its mouth
      drawLure(fx + dir * len * 0.52, fy + len * 0.05, G.lure.id, COLORS[G.lure.color].hex, now / 120, 0.55, dir);
      if (S.ft.state === "jump" && Math.random() < 0.2) sprayBurst(fx + rnd(-8, 8), UW_TOP + 2, 7, 1);
    }

    drawRipplesSplashes();
    if (dc.amb && dc.amb !== "rgba(255,255,255,0)") { ctx.fillStyle = dc.amb; ctx.fillRect(0, 0, W, H); }
    drawVignette();
  }

  function zoneArrow(x, y, dir, label) {
    ctx.save(); ctx.fillStyle = "rgba(255,235,170,0.95)"; ctx.strokeStyle = "rgba(255,235,170,0.95)";
    const yo = Math.sin(Date.now() / 200) * 3 * dir;
    ctx.beginPath(); ctx.moveTo(x, y - 8 * dir + yo); ctx.lineTo(x - 5, y + yo); ctx.lineTo(x + 5, y + yo); ctx.closePath(); ctx.fill();
    ctx.font = "bold 10px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(label, x + 10, y);
    ctx.restore();
  }

  function drawPursuers(now, lx, ly) {
    const t = S.rv.interest;
    for (let i = 0; i < S.pursuers.length; i++) {
      const p = S.pursuers[i];
      const lead = i === 0;
      const reach = (1 - t) * (110 + i * 36) + 20;
      const px = lx + p.side * reach + Math.sin(now / 480 * p.sp + p.ph) * 8;
      const py = lerp(depthY(p.depth), ly, lead ? t : t * 0.6) + Math.sin(now / 560 + p.ph) * 4;
      const op = lead ? 0.25 + 0.65 * t : 0.18 + 0.3 * t;
      const dir = px < lx ? 1 : -1;
      if (lead && t > 0.45) {
        // the committing bass resolves from a shadow into a real fish
        drawBass(px, py, 34 + 22 * t, { body: "#5f8f4a", belly: "#dfe7c2", patColor: "#2c3a1c", pat: "lateral", bigmouth: true }, dir, op);
      } else {
        const sz = (lead ? 15 : 12) + (lead ? 9 * t : 3);
        drawFishShape(px, py, sz, "rgba(14,32,34," + op + ")", dir, false);
      }
    }
  }

  function drawRipplesSplashes() {
    for (const r of S.ripples) {
      ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, r.a) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 6.29); ctx.stroke();
    }
    for (const s of S.splashes) {
      ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, s.a) + ")"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    }
    for (const s of S.spray) {
      const a = clamp(s.life / 550, 0, 1);
      ctx.fillStyle = "rgba(245,252,255," + (0.85 * a) + ")";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill();
    }
  }
  function splashAt(x, y, now) { if (Math.random() < 0.2) S.splashes.push({ x: x + rnd(-10, 10), y, r: 3, a: 0.8 }); }

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

  function drawCloud(x, y, s) {
    for (const [dx, dy, r] of [[-22 * s, 5 * s, 15 * s], [-2 * s, -5 * s, 21 * s], [20 * s, 5 * s, 15 * s], [4 * s, 9 * s, 19 * s]])
      { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r, r * 0.68, 0, 0, 6.29); ctx.fill(); }
  }
  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.34, W / 2, H * 0.5, H * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---- Per-lake shoreline scenery -------------------------------------------
  function leafyTree(x, baseY, s) {
    ctx.fillStyle = "rgba(70,44,26,0.92)"; ctx.fillRect(x - 2 * s, baseY - 16 * s, 4 * s, 18 * s);
    ctx.fillStyle = "#367033";
    for (const [dx, dy, r] of [[-8 * s, -20 * s, 11 * s], [8 * s, -20 * s, 11 * s], [0, -28 * s, 13 * s], [0, -15 * s, 12 * s]]) { ctx.beginPath(); ctx.arc(x + dx, baseY + dy, r, 0, 6.29); ctx.fill(); }
    ctx.fillStyle = "#4f9a47";
    for (const [dx, dy, r] of [[-5 * s, -24 * s, 6 * s], [6 * s, -21 * s, 5 * s]]) { ctx.beginPath(); ctx.arc(x + dx, baseY + dy, r, 0, 6.29); ctx.fill(); }
  }
  function pineTree(x, baseY, s) {
    ctx.fillStyle = "rgba(60,40,24,0.9)"; ctx.fillRect(x - 2 * s, baseY - 10 * s, 4 * s, 12 * s);
    ctx.fillStyle = "#2f6b46";
    for (let i = 0; i < 3; i++) { const ty = baseY - 8 * s - i * 9 * s, wdt = (14 - i * 3.5) * s; ctx.beginPath(); ctx.moveTo(x - wdt, ty); ctx.lineTo(x, ty - 15 * s); ctx.lineTo(x + wdt, ty); ctx.closePath(); ctx.fill(); }
  }
  function boulder(x, y, r) {
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.32, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = "#6b6f73"; ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#878c90"; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.6, Math.PI, 0); ctx.fill();
  }
  function cattailClump(x, y, n, col, now) {
    for (let i = 0; i < n; i++) {
      const bx = x + i * 7, h = 18 + (i % 3) * 8, sway = Math.sin(now / 700 + i) * 2;
      ctx.strokeStyle = col || "#5e7d3a"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + sway, y - h); ctx.stroke();
      ctx.fillStyle = col ? "#26303a" : "#6e4a22"; ctx.beginPath(); ctx.ellipse(bx + sway, y - h, 2.2, 6, 0, 0, 6.29); ctx.fill();
    }
  }
  function deadTimber(x, wl, h, now) {
    ctx.strokeStyle = "#241d14"; ctx.lineWidth = 4; ctx.lineCap = "round";
    const tx = x + Math.sin(x) * 2;
    ctx.beginPath(); ctx.moveTo(x, wl + 8); ctx.lineTo(tx, wl - h); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, wl - h * 0.6); ctx.lineTo(x - 9, wl - h * 0.6 - 7); ctx.moveTo(x, wl - h * 0.42); ctx.lineTo(x + 10, wl - h * 0.42 - 6); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.18; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, wl + 8); ctx.lineTo(x, wl + 8 + h * 0.28); ctx.stroke(); ctx.restore();
  }
  function drawShoreline(now, sp, wl) {
    ctx.save();
    if (sp.id === "cove") {
      leafyTree(W * 0.10, wl - 4, 1.1); leafyTree(W * 0.21, wl, 0.8); leafyTree(W * 0.93, wl - 2, 1.0);
      cattailClump(6, wl + 3, 7, null, now); cattailClump(W - 52, wl + 3, 6, null, now);
      // small dock jutting from the right shore
      ctx.fillStyle = "rgba(86,58,33,0.95)"; ctx.fillRect(W * 0.8, wl + 4, W * 0.2, 7);
      for (let px = W * 0.82; px < W; px += 22) { ctx.fillStyle = "rgba(44,30,17,0.9)"; ctx.fillRect(px, wl + 11, 5, 13); }
    } else if (sp.id === "river") {
      pineTree(W * 0.08, wl - 2, 1.1); pineTree(W * 0.18, wl + 2, 0.8); pineTree(W * 0.9, wl, 1.05); pineTree(W * 0.81, wl + 3, 0.7);
      for (const [bx, br] of [[W * 0.05, 16], [W * 0.15, 11], [W * 0.87, 15], [W * 0.96, 11], [W * 0.5, 8]]) boulder(bx, wl + 5, br);
    } else { // deep — night
      ctx.fillStyle = "rgba(190,200,225,0.09)"; ctx.fillRect(0, wl - 8, W, 28);
      for (const [tx, th] of [[W * 0.13, 72], [W * 0.25, 52], [W * 0.8, 66], [W * 0.9, 44], [W * 0.5, 38]]) deadTimber(tx, wl, th, now);
      cattailClump(6, wl + 3, 6, "#1c2a3a", now); cattailClump(W - 44, wl + 3, 5, "#1c2a3a", now);
    }
    ctx.restore();
  }

  // ---- A realistic angler casting from a bass boat (original art) ------------
  function drawAngler() {
    const b = anglerBase(), x = b.x, y = b.y, bob = Math.sin(performance.now() / 900) * 2;
    const tip = rodTip();
    ctx.save(); ctx.translate(0, bob); ctx.lineJoin = "round";
    // water shadow + wake
    ctx.fillStyle = "rgba(0,0,0,0.20)"; ctx.beginPath(); ctx.ellipse(x - 4, y + 52, 108, 13, 0, 0, 6.29); ctx.fill();
    // hull
    const hull = ctx.createLinearGradient(0, y + 22, 0, y + 58); hull.addColorStop(0, "#43617a"); hull.addColorStop(0.5, "#27414f"); hull.addColorStop(1, "#14222c");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(x - 104, y + 30); ctx.quadraticCurveTo(x - 116, y + 54, x - 84, y + 58);
    ctx.lineTo(x + 88, y + 58); ctx.quadraticCurveTo(x + 120, y + 50, x + 106, y + 30);
    ctx.quadraticCurveTo(x, y + 19, x - 104, y + 30); ctx.closePath(); ctx.fill();
    // metallic sparkle + accent stripe
    ctx.strokeStyle = "rgba(150,190,210,0.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 100, y + 31); ctx.quadraticCurveTo(x, y + 22, x + 102, y + 31); ctx.stroke();
    ctx.strokeStyle = "rgba(206,62,48,0.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 96, y + 38); ctx.quadraticCurveTo(x, y + 30, x + 100, y + 38); ctx.stroke();
    // deck
    ctx.fillStyle = "#3c5160"; ctx.beginPath(); ctx.ellipse(x - 2, y + 30, 92, 9, 0, 0, 6.29); ctx.fill();
    // raised front casting deck (right)
    ctx.fillStyle = "#4a6575"; ctx.beginPath(); ctx.ellipse(x + 60, y + 23, 44, 8, 0, 0, 6.29); ctx.fill();
    // console + windshield (mid-left)
    ctx.fillStyle = "#243640"; ctx.fillRect(x - 50, y + 6, 22, 20);
    ctx.fillStyle = "rgba(160,205,225,0.55)"; ctx.beginPath(); ctx.moveTo(x - 50, y + 6); ctx.lineTo(x - 34, y - 2); ctx.lineTo(x - 28, y + 6); ctx.closePath(); ctx.fill();
    // outboard motor (stern, left)
    ctx.fillStyle = "#161f27"; ctx.fillRect(x - 116, y + 16, 14, 20); ctx.fillRect(x - 111, y + 34, 4, 12);
    // trolling motor (bow)
    ctx.strokeStyle = "#161f27"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 100, y + 24); ctx.lineTo(x + 108, y + 48); ctx.stroke();

    // ---- angler on the front deck (facing the water, to the right) ----
    const ax = x + 50, ay = y + 22;
    // legs
    ctx.strokeStyle = "#37452f"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax - 5, ay); ctx.lineTo(ax - 7, ay - 20); ctx.moveTo(ax + 6, ay); ctx.lineTo(ax + 4, ay - 20); ctx.stroke();
    // torso — fishing vest
    const vest = ctx.createLinearGradient(0, ay - 40, 0, ay - 14); vest.addColorStop(0, "#d8bb7e"); vest.addColorStop(1, "#b9974f");
    ctx.fillStyle = vest; ctx.beginPath();
    ctx.moveTo(ax - 11, ay - 14); ctx.lineTo(ax - 9, ay - 36); ctx.quadraticCurveTo(ax, ay - 44, ax + 9, ay - 36); ctx.lineTo(ax + 11, ay - 14); ctx.quadraticCurveTo(ax, ay - 10, ax - 11, ay - 14); ctx.closePath(); ctx.fill();
    // vest detailing
    ctx.strokeStyle = "rgba(90,68,36,0.7)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ax, ay - 38); ctx.lineTo(ax, ay - 16); ctx.moveTo(ax - 7, ay - 24); ctx.lineTo(ax + 7, ay - 24); ctx.stroke();
    // back arm (to reel) and front arm (extended along the rod)
    ctx.strokeStyle = "#caa56f"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax - 3, ay - 33); ctx.lineTo(ax - 13, ay - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + 3, ay - 33); ctx.lineTo(ax + 17, ay - 26); ctx.stroke();
    // neck + head
    ctx.fillStyle = "#caa56f"; ctx.fillRect(ax - 2.5, ay - 44, 5, 5);
    ctx.beginPath(); ctx.arc(ax, ay - 48, 8, 0, 6.29); ctx.fill();
    // sunglasses
    ctx.fillStyle = "#15161b"; ctx.fillRect(ax + 1, ay - 50, 8, 4); ctx.fillStyle = "rgba(150,200,230,0.5)"; ctx.fillRect(ax + 6, ay - 50, 2, 2);
    // ball cap (brim to the right)
    ctx.fillStyle = "#c8482e";
    ctx.beginPath(); ctx.arc(ax, ay - 52, 8.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(ax, ay - 53, 15, 3.5);
    ctx.fillStyle = "#a83a23"; ctx.beginPath(); ctx.arc(ax, ay - 52, 8.5, Math.PI * 1.15, Math.PI * 1.6); ctx.fill();
    // ---- rod from the front hand out to the rod tip (flexes on the cast) ----
    ctx.strokeStyle = "#1b2730"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ax + 17, ay - 22, 4, 0, 6.29); ctx.stroke();
    const hxr = ax + 15, hyr = ay - 24, tx = tip.x, ty = tip.y - bob;
    const castBend = S.mode === "casting" ? Math.sin(clamp(S.bobber.flyT, 0, 1) * Math.PI) * 18 : 5;
    const rcx = (hxr + tx) / 2, rcy = (hyr + ty) / 2 - castBend;   // bow the rod upward
    ctx.strokeStyle = "#5a3f22"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hxr, hyr); ctx.quadraticCurveTo(rcx, rcy, tx, ty); ctx.stroke();
    ctx.strokeStyle = "rgba(210,180,120,0.6)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hxr, hyr); ctx.quadraticCurveTo(rcx, rcy, tx, ty); ctx.stroke();
    ctx.restore();
  }

  // ===========================================================================
  // Modals: catch / fail
  // ===========================================================================
  el.catchOk.addEventListener("click", () => {
    el.catchModal.classList.add("hidden");
    if (window.Scene3D && Scene3D.hideCatch) Scene3D.hideCatch();
    if (!S.tournament && S.hookedFish) floatText("+" + S.hookedFish.value + " 🪙", "#ffd35c");
    resetToIdle();
  });
  el.failOk.addEventListener("click", () => { el.failModal.classList.add("hidden"); resetToIdle(); });

  // ===========================================================================
  // Lure tray
  // ===========================================================================
  function openLures() { renderLures(); el.lureModal.classList.remove("hidden"); }
  function ratingColor(p) { return p >= 75 ? "#5be37a" : p >= 50 ? "#ffd35c" : p >= 30 ? "#ff9d3d" : "#ff5d5d"; }
  function starStr(n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
  function renderLures() {
    const c = S.cond, w = WEATHER[c.weather], band = c.band;
    const zone = band < 0.34 ? "shallow" : band < 0.67 ? "mid-depth" : "deep";
    el.lureCond.innerHTML = `${(SEASONS[c.season] || SEASONS.summer).ico} ${(SEASONS[c.season] || SEASONS.summer).name} · ${w.ico} ${w.name} · ${c.temp}° · ${fmtClock(c.timeMin)} · bass holding <b>${zone}</b> (~${Math.round(band * 24)}ft)`;
    // rate every lure for right now, best first
    const rated = LURES.map(l => ({ l, owned: ownsLure(l.id), r: lureScore(l) }))
      .sort((a, b) => b.r.score - a.r.score);
    el.lureList.innerHTML = rated.map(({ l, owned, r }) => {
      const sel = G.lure.id === l.id;
      const tag = owned ? (sel ? "✓ ON" : "TAP") : "🔒 " + l.price + "🪙";
      return `<div class="lure-opt ${sel ? "sel" : ""} ${owned ? "" : "locked"}" data-lure="${l.id}" data-owned="${owned}">
        <div class="ico">${l.ico}</div>
        <div class="info">
          <div class="nm">${l.name} <span class="stars" style="color:${ratingColor(r.pct)}">${starStr(r.stars)}</span></div>
          <div class="rate"><div class="rate-bar"><i style="width:${r.pct}%;background:${ratingColor(r.pct)}"></i></div><b style="color:${ratingColor(r.pct)}">${r.pct}</b></div>
          <div class="ds">${r.tip}</div>
        </div>
        <div class="tag">${tag}</div></div>`;
    }).join("");
    renderColors();
  }
  function renderColors() {
    const l = lure();
    el.colorRow.innerHTML = l.colors.map(c => {
      const col = COLORS[c];
      const sel = G.lure.color === c;
      const good = col.fam === preferredFam();
      const r = lureScore(l, c).pct;
      return `<div class="color-dot ${sel ? "sel" : ""}" data-color="${c}" style="background:${col.hex}">
        <small>${col.name}${good ? " ⭐" : ""} · ${r}</small></div>`;
    }).join("");
    renderScents();
  }
  function renderScents() {
    const row = document.getElementById("scentRow"); if (!row) return;
    const l = lure(), saved = G.attractant;
    row.innerHTML = Object.keys(ATTRACTANTS).map(k => {
      const a = ATTRACTANTS[k], sel = saved === k;
      G.attractant = k; const r = lureScore(l).pct;   // show the combined % this scent yields
      return `<div class="scent-opt ${sel ? "sel" : ""}" data-scent="${k}">
        <span class="scent-ico">${a.ico}</span><b>${a.name}</b>
        <i style="color:${ratingColor(r)}">${r}%</i></div>`;
    }).join("");
    G.attractant = saved;
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
    } else {
      const sc = e.target.closest(".scent-opt");
      if (sc) { G.attractant = sc.dataset.scent; save(); updateHUD(); renderLures(); }
    }
  });

  // ===========================================================================
  // Map: venue + position
  // ===========================================================================
  function openMap() { renderMap(); el.mapModal.classList.remove("hidden"); }
  function renderMap() {
    el.mapVenues.innerHTML = SPOTS.map(s => {
      const owned = ownsSpot(s.id);
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
    renderFinder();
  }

  // Sonar / fish-finder: what's biting, where, and what to throw — boat-mode scouting.
  function renderFinder() {
    const sp = spot(), pos = position(), c = S.cond, w = WEATHER[c.weather];
    const best = bestLureNow();
    // species likelihood at this position (structure bias only)
    const rows = sp.fish.map(e => ({ def: fishDef(e.k), w: e.weight * ((pos.bias && pos.bias[e.k]) || 1) }));
    const tot = rows.reduce((a, b) => a + b.w, 0) || 1;
    rows.sort((a, b) => b.w - a.w);
    const top = rows.slice(0, 3).map(r => ({ def: r.def, pct: Math.round(r.w / tot * 100) }));

    const band = c.band, depthFt = Math.round(band * 24);
    const zone = band < 0.34 ? "SHALLOW" : band < 0.67 ? "MID-DEPTH" : "DEEP";
    const recDepth = band < 0.34 ? "topwater & shallow" : band < 0.67 ? "mid-column" : "deep / bottom";
    const recColor = preferredFam() === "natural" ? "natural (green · shad · black)" : "bright (chartreuse · red · gold)";

    let blips = "";
    const density = clamp(0.5 + (top[0] ? top[0].pct / 100 : 0), 0.4, 1.2);
    const n = Math.round(5 + density * 4);
    for (let i = 0; i < n; i++) {
      const d = clamp(band + (Math.random() - 0.5) * 0.26, 0.05, 0.95);
      const sz = 4 + Math.random() * 6;
      blips += `<i class="blip" style="top:${(d * 100).toFixed(0)}%;left:${(14 + Math.random() * 72).toFixed(0)}%;width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px"></i>`;
    }
    const zTop = clamp((band - 0.09) * 100, 0, 82);

    el.finder.innerHTML = `<div class="finder-wrap">
      <div class="sonar">
        <div class="sweep"></div>
        <div class="bite-zone" style="top:${zTop}%;height:18%"><span>BITE</span></div>
        ${blips}
        <span class="s-top">0 ft</span><span class="s-bot">${Math.round(24)} ft</span>
      </div>
      <div class="finder-info">
        <div class="fi-line">${(SEASONS[c.season] || SEASONS.summer).ico} ${(SEASONS[c.season] || SEASONS.summer).name} · ${w.ico} ${w.name} · ${c.temp}° · ${fmtClock(c.timeMin)}</div>
        <div class="fi-line" style="color:#9fc3d2">${(SEASONS[c.season] || SEASONS.summer).note}</div>
        <div class="fi-line">Bass holding <b>${zone}</b> · ~${depthFt} ft</div>
        <div class="fi-line">Throw <b>${recDepth}</b> lures in <b>${recColor}</b></div>
        ${best ? `<div class="fi-line">Best lure: <b>${best.lure.ico} ${best.lure.name}</b> <span style="color:${ratingColor(best.pct)}">${best.pct}</span></div>` : ""}
        <div class="fi-species">${top.map(t => `<span class="fs">${fishSVG(t.def, 34)}<small>${t.pct}%</small></span>`).join("")}</div>
      </div>
    </div>`;
  }
  el.spotChip.addEventListener("click", openMap);
  el.mapClose.addEventListener("click", () => el.mapModal.classList.add("hidden"));
  el.mapModal.addEventListener("click", (e) => {
    const v = e.target.closest(".venue");
    const p = e.target.closest(".pos-cell");
    if (v) {
      if (v.dataset.owned === "true") {
        if (G.spot !== v.dataset.venue) { G.spot = v.dataset.venue; seedFish(); rollConditions(); resetToIdle(); }
        save(); updateHUD(); renderMap();
      } else { toast("Unlock this spot in the 🛒 shop"); }
    } else if (p) {
      G.positions[spot().id] = p.dataset.pos; recomputeCond(); save(); updateHUD(); renderPositions();
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
      const owned = ownsRod(r.id), eq = G.rod === r.id;
      const btn = owned ? (eq ? `<button class="item-btn equipped" disabled>EQUIPPED</button>` : `<button class="item-btn owned" data-equip-rod="${r.id}">EQUIP</button>`)
                        : `<button class="item-btn buy" data-buy-rod="${r.id}" ${G.coins < r.price ? "disabled" : ""}>${r.price} 🪙</button>`;
      return `<div class="item"><div class="item-ico">${r.ico}</div><div class="item-info"><div class="item-name">${r.name}</div>
        <div class="item-desc">${r.desc} · Power ${r.power.toFixed(2)}× · Luck +${Math.round(r.luck * 100)}%</div></div>${btn}</div>`;
    }).join("");
    // Lures
    el.shopLures.innerHTML = LURES.map(l => {
      const owned = ownsLure(l.id), eq = G.lure.id === l.id;
      const btn = owned ? (eq ? `<button class="item-btn equipped" disabled>EQUIPPED</button>` : `<button class="item-btn owned" data-equip-lure="${l.id}">EQUIP</button>`)
                        : `<button class="item-btn buy" data-buy-lure="${l.id}" ${G.coins < l.price ? "disabled" : ""}>${l.price} 🪙</button>`;
      const swatches = l.colors.map(c => `<i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${COLORS[c].hex};margin-right:3px;border:1px solid rgba(255,255,255,.4)"></i>`).join("");
      return `<div class="item"><div class="item-ico">${l.ico}</div><div class="item-info"><div class="item-name">${l.name}</div>
        <div class="item-desc">${l.desc}</div><div style="margin-top:4px">${swatches}</div></div>${btn}</div>`;
    }).join("");
    // Spots
    el.shopSpots.innerHTML = SPOTS.map(s => {
      const owned = ownsSpot(s.id), active = G.spot === s.id;
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
    else if (d.buySpot) { const s = SPOTS.find(x => x.id === d.buySpot); if (G.coins >= s.price) { G.coins -= s.price; G.ownedSpots.push(s.id); G.spot = s.id; seedFish(); rollConditions(); resetToIdle(); } }
    else if (d.goSpot) { if (G.spot !== d.goSpot) { G.spot = d.goSpot; seedFish(); rollConditions(); resetToIdle(); } }
    else return;
    save(); updateHUD(); renderShop();
  });

  // ===========================================================================
  // Boot
  // ===========================================================================
  rollConditions();
  updateHUD();
  showBtn(false);
  setStatus("Tap & hold the water to aim, release to cast 🎣");
  requestAnimationFrame(frame);

  document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", e => e.preventDefault());
})();
