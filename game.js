/* BassBuddy — a simple, fun, rewarding bass fishing game for mobile.
   Vanilla JS. Canvas scene + DOM HUD. Saved to localStorage.

   Features: species-accurate fish art, tap-to-aim casting, lure type+color,
   selectable venues & fishing positions, and a full bass tournament mode. */
(function () {
  "use strict";

  // ===========================================================================
  // Data
  // ===========================================================================
  // Real rod selection. power = fight muscle (line/backbone); lurePow = the bait
  // weight/power it's built for; cover = backbone to pull fish from structure;
  // finesse = soft-tip delicacy for clear water & light line.
  const RODS = [
    { id: "ultralight", name: "Ultralight Spin", ico: "🪶", type: "spin", power: 0.85, luck: 0.06, lurePow: 0.15, cover: 0.2, finesse: 1.0,
      desc: "Whippy spinning rod, light line. Tiny finesse baits in clear, open water — numbers, not giants." },
    { id: "spin",       name: "Spinning Rod",    ico: "🎣", type: "spin", power: 1.1,  luck: 0.1,  lurePow: 0.42, cover: 0.45, finesse: 0.82,
      desc: "Versatile medium spinner — worms, inline & light cranks in clear to stained water." },
    { id: "baitcast",   name: "Baitcaster",      ico: "⚙️", type: "cast", power: 1.45, luck: 0.16, lurePow: 0.72, cover: 0.78, finesse: 0.5,
      desc: "The all-around bass stick — accurate casts, moving baits, fish near cover." },
    { id: "heavy",      name: "Flipping Stick",  ico: "🪵", type: "cast", power: 1.85, luck: 0.22, lurePow: 0.95, cover: 1.0, finesse: 0.25,
      desc: "Broomstick power — big baits, heavy cover, hauls giants out of the slop." },
  ];
  const COVER_HEAVY = { veg: 0.9, wood: 0.85, rock: 0.5, deep: 0.6, open: 0.2 };

  // Rate a rod for the chosen lure + where you're fishing: Lure Fit, Cover Power, Finesse.
  function rodScore(rd, lu) {
    lu = lu || lure();
    const sz = G.lure.size || "med";
    const sp = spot(), pos = position(), clarity = sp.clarity || "stained";
    const grp = STRUCT_GROUP[pos.id] || "open";
    // the bait's effective weight/power from its aggressiveness + size + style
    const luPow = clamp((lu.aggr != null ? lu.aggr : 0.5) * 0.6 + (SIZES[sz].axis + 1) / 2 * 0.45 + (lu.style === "top" ? 0.08 : 0), 0, 1);
    const fit = clamp(1 - Math.abs(rd.lurePow - luPow) * 1.3, 0.1, 1);
    // power needed = how heavy the cover is + how big the fish run here
    const need = clamp((COVER_HEAVY[grp] != null ? COVER_HEAVY[grp] : 0.4) * 0.85 + (sp.id === "deep" ? 0.3 : sp.id === "river" ? 0.1 : 0), 0, 1);
    const power = clamp(1 - Math.max(0, need - rd.cover) * 1.7, 0.12, 1);   // too little backbone hurts; extra is fine
    const needFin = clarity === "clear" ? 0.85 : clarity === "stained" ? 0.45 : 0.2;
    const finesse = clamp(1 - Math.abs(rd.finesse - needFin) * 1.05, 0.18, 1);
    const score = fit * 0.42 + power * 0.34 + finesse * 0.24;
    const cats = [
      { key: "fit", label: "Lure Fit", pct: Math.round(fit * 100) },
      { key: "power", label: "Cover Power", pct: Math.round(power * 100) },
      { key: "finesse", label: "Finesse", pct: Math.round(finesse * 100) },
    ];
    const weak = cats.slice().sort((a, b) => a.pct - b.pct)[0];
    let tip;
    if (weak.pct >= 62) tip = "✓ Right rod for the job";
    else if (weak.key === "fit") tip = luPow > rd.lurePow ? "Underpowered for this bait — step up" : "Too stout for a finesse bait — go lighter";
    else if (weak.key === "power") tip = "Not enough backbone to pull them from this cover";
    else tip = clarity === "clear" ? "Clear water — a softer finesse rod draws more bites" : "Heavier water — power matters more than finesse here";
    return { score, pct: Math.round(score * 100), stars: clamp(Math.round(score * 5), 1, 5), cats, tip, good: weak.pct >= 62 };
  }

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
  // aggr = finesse(0)..power(1): how aggressive the presentation is, used by the
  // Action rating. viz = which built-in model to draw for it (visual stand-in).
  const LURES = [
    { id: "worm",     name: "Plastic Worm", ico: "🪱", price: 0,    desc: "All-purpose soft plastic. Slow bottom hops; bass can't resist.",
      colors: ["green","black","red","brown"], bite: 1.0, bassBias: 1.35, lmBias: 1.2, junk: 1.0, rareBias: 1.0, sizeBias: 1.0,
      style: "sink", band: 0.9, cadence: "slow", aggr: 0.2, motion: "Slow bottom hops" },
    { id: "carolina", name: "Carolina Rig", ico: "⛓️", price: 0,   desc: "Heavy weight, long leader — drags a plastic across deep structure.",
      colors: ["green","brown","red","black"], bite: 1.0, bassBias: 1.4, lmBias: 1.3, junk: 0.45, rareBias: 1.4, sizeBias: 1.3,
      style: "sink", band: 0.92, cadence: "slow", aggr: 0.28, motion: "Slow deep drag" },
    { id: "inline",   name: "Inline Spinner",ico: "🌀", price: 0,  desc: "Small spinning blade — steady flash that picks off numbers in clear water.",
      colors: ["shad","gold","white","chartreuse"], bite: 1.15, bassBias: 1.15, lmBias: 1.1, junk: 0.6, rareBias: 1.1, sizeBias: 0.9,
      style: "sink", band: 0.35, cadence: "med", aggr: 0.6, motion: "Steady blade spin" },
    { id: "torpedo",  name: "Torpedo",      ico: "🚀", price: 130,  desc: "Prop topwater that kicks up the surface. Short sweeps; quick strikes.",
      colors: ["shad","white","chartreuse","black"], bite: 1.3, bassBias: 1.2, lmBias: 1.4, junk: 0.5, rareBias: 1.05, sizeBias: 1.0,
      style: "top", band: 0.08, cadence: "med", aggr: 0.7, motion: "Short sweeps" },
    { id: "buzz",     name: "Buzzbait",     ico: "🪺", price: 0,    desc: "Blades churn a wake across the top — a reaction strike from active bass.",
      colors: ["white","black","chartreuse","shad"], bite: 1.35, bassBias: 1.2, lmBias: 1.5, junk: 0.4, rareBias: 1.15, sizeBias: 1.15,
      style: "top", band: 0.06, cadence: "med", aggr: 0.85, motion: "Buzzing wake" },
    { id: "jitterbug",name: "Jitterbug",    ico: "🐞", price: 200,  desc: "A gentle gurgling wobble — the calm-water & night topwater when bass won't chase a fast bait.",
      colors: ["black","white","red","green"], bite: 1.45, bassBias: 1.15, lmBias: 1.35, junk: 0.5, rareBias: 1.1, sizeBias: 1.0,
      style: "top", band: 0.05, cadence: "slow", aggr: 0.42, motion: "Gentle gurgle" },
    { id: "pencil",   name: "Pencil Bait",  ico: "✏️", price: 320,  desc: "Walk-the-dog plug. Big sweeping motions call up bigger surface bass.",
      colors: ["shad","gold","white","chartreuse"], bite: 1.05, bassBias: 1.25, lmBias: 1.5, junk: 0.4, rareBias: 1.15, sizeBias: 1.15,
      style: "top", band: 0.06, cadence: "slow", aggr: 0.5, motion: "Big sweeps" },
    { id: "frog",     name: "Frog",         ico: "🐸", price: 470,  desc: "Weedless over cover. Short skitters — largemouth explode on it.",
      colors: ["green","black","white","brown"], bite: 1.0, bassBias: 1.25, lmBias: 1.9, junk: 0.35, rareBias: 1.15, sizeBias: 1.2,
      style: "top", band: 0.07, cadence: "fast", aggr: 0.55, motion: "Short skitters" },
    { id: "spinner",  name: "Spinnerbait",  ico: "🎐", price: 0,    desc: "Wire bait with a flashing blade and skirt — covers water around cover.",
      colors: ["white","chartreuse","shad","firetiger"], bite: 1.2, bassBias: 1.3, lmBias: 1.35, junk: 0.5, rareBias: 1.2, sizeBias: 1.2,
      style: "sink", band: 0.42, cadence: "med", aggr: 0.75, motion: "Flash & thump" },
    { id: "trap",     name: "Rattle Trap",  ico: "📿", price: 0,    desc: "Lipless crankbait — tight rattling vibration rips through grass and flats.",
      colors: ["firetiger","red","shad","chartreuse"], bite: 1.2, bassBias: 1.2, lmBias: 1.2, junk: 0.55, rareBias: 1.25, sizeBias: 1.25,
      style: "sink", band: 0.6, cadence: "med", aggr: 0.8, motion: "Rattling vibration" },
    { id: "spoon",    name: "Spoon",        ico: "🥄", price: 620,  desc: "Flutters down, then darts up on the reel. Flashy and versatile.",
      colors: ["gold","shad","chartreuse","white"], bite: 1.1, bassBias: 1.15, lmBias: 1.1, junk: 0.6, rareBias: 1.3, sizeBias: 1.2,
      style: "sink", band: 0.55, cadence: "med", aggr: 0.62, motion: "Flutter & dart" },
    { id: "crank",    name: "Crankbait",    ico: "🎏", price: 820,  desc: "Dives deep and rises on the reel — pulls mudders off the bottom.",
      colors: ["firetiger","shad","red","chartreuse"], bite: 1.1, bassBias: 1.15, lmBias: 1.1, junk: 0.55, rareBias: 1.3, sizeBias: 1.3,
      style: "sink", band: 0.72, cadence: "med", aggr: 0.7, motion: "Steady deep wind" },
    { id: "furry",    name: "Furry Sinker", ico: "🧶", price: 1200, desc: "Hair-dressed bottom bait. Slow and big — filters out the small stuff.",
      colors: ["brown","black","green","red"], bite: 0.85, bassBias: 1.45, lmBias: 1.5, junk: 0.4, rareBias: 1.55, sizeBias: 1.5, minSize: 1.2,
      style: "sink", band: 0.82, cadence: "slow", aggr: 0.2, motion: "Slow bottom drag" },
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

  // Lure SIZE — a real selection axis. Small/finesse shines in clear, tough,
  // pressured water and draws MORE but smaller bites; large/magnum shines in
  // stained water & active fish, drawing FEWER but BIGGER ones. axis: -1..+1.
  const SIZES = {
    small: { name: "Finesse", ico: "🤏", axis: -1, bite: 1.12, sizePush: -0.16, bigGate: -0.18 },
    med:   { name: "Standard", ico: "✋", axis: 0,  bite: 1.0,  sizePush: 0,     bigGate: 0 },
    large: { name: "Magnum",  ico: "🖐️", axis: 1,  bite: 0.9,  sizePush: 0.18,  bigGate: 0.22 },
  };
  const SIZE_ORDER = ["small", "med", "large"];

  // LINE — the stealth-vs-strength axis. clarBite scales bites by water clarity
  // (invisible fluoro shines in clear water, visible braid shines in murk), cover
  // is break-off resistance in heavy cover, tol is snap tolerance in the fight,
  // top is a topwater bonus (floating mono), sens a small feel/interest bump.
  // cats are the static traits shown in the tackle box.
  const LINES = {
    mono:   { name: "Mono",         ico: "🧵", clarBite: { clear: 0.94, stained: 1.0, murky: 1.03 }, cover: 1.0,  tol: 1.12, top: 1.16, sens: 0.9,
              cats: [["Stealth", 55], ["Strength", 55], ["Sensitivity", 45], ["Cover", 55]] },
    fluoro: { name: "Fluorocarbon", ico: "💧", clarBite: { clear: 1.18, stained: 1.06, murky: 0.97 }, cover: 0.82, tol: 0.96, top: 0.9,  sens: 1.12,
              cats: [["Stealth", 92], ["Strength", 50], ["Sensitivity", 80], ["Cover", 42]] },
    braid:  { name: "Braid",        ico: "🪢", clarBite: { clear: 0.80, stained: 1.0, murky: 1.12 }, cover: 1.5,  tol: 1.35, top: 1.0,  sens: 1.25,
              cats: [["Stealth", 30], ["Strength", 95], ["Sensitivity", 90], ["Cover", 95]] },
  };
  const LINE_ORDER = ["mono", "fluoro", "braid"];
  function line() { return LINES[G.line] || LINES.mono; }
  function clarKey() { const c = spot().clarity; return c === "clear" ? "clear" : c === "murky" ? "murky" : "stained"; }
  // bite multiplier from the line: clarity-driven stealth, plus a topwater bump
  function lineBiteMul() { const L = line(); let m = L.clarBite[clarKey()]; if ((lure().style) === "top") m *= L.top; return m; }
  // teaching "fit %" for a line in the current conditions (clarity + cover + where big fish live)
  function lineFit(id) {
    const L = LINES[id], grp = STRUCT_GROUP[position().id] || "open";
    const heavyCover = grp === "veg" || grp === "wood", bigWater = (spot().baseDepth || 0.4) > 0.5 || grp === "deep";
    let s = 0.5 + (L.clarBite[clarKey()] - 1) * 1.2;
    s += (L.cover - 1) * (heavyCover ? 0.34 : -0.12);
    s += (L.tol - 1) * (bigWater ? 0.5 : 0.22);
    if ((lure().style) === "top") s += (L.top - 1) * 1.6;   // floating mono is the topwater line
    return clamp(Math.round(s * 100), 5, 99);
  }

  // Fish. `art` drives the SVG. `bass:true` = black bass (counts in tournaments);
  // `lm:true` marks a largemouth specifically.
  // Black bass only — this is a bass fishing game.
  // One species — the largemouth bass. The three internal tiers only spread the
  // SIZE range (small fish .. trophies) and give each lake its character; the
  // player always just catches a "Largemouth Bass". Bigger fish run a touch darker.
  const F = {
    largemouth:{ name: "Largemouth Bass", w: [1.0, 7.0],  rarity: "common", base: 12, lm: true, bass: true,
                 art: { shape: "bass", body: "#6f9e4e", belly: "#eef1d6", pat: "lateral", patColor: "#33401f", bigmouth: true } },
    giant:     { name: "Largemouth Bass", w: [6.0, 14.0], rarity: "uncommon", base: 45, lm: true, bass: true, big: true,
                 art: { shape: "bass", body: "#5e8f54", belly: "#e8edcf", pat: "lateral", patColor: "#2c3f22", bigmouth: true } },
    hawg:      { name: "Largemouth Bass", w: [10.0, 24.0], rarity: "legendary", base: 280, lm: true, bass: true, big: true,
                 art: { shape: "bass", body: "#4f7d46", belly: "#dfe6c4", pat: "lateral", patColor: "#243a1e", bigmouth: true } },
    smallie:   { name: "Smallmouth Bass", w: [0.8, 4.5],  rarity: "common", base: 16, bass: true,
                 art: { shape: "bass", body: "#8a6b3c", belly: "#e8dfc2", pat: "bars", patColor: "#5c4426" } },
    bronzeback:{ name: "Smallmouth Bass", w: [4.0, 8.2],  rarity: "rare", base: 90, bass: true, big: true,
                 art: { shape: "bass", body: "#7a5c30", belly: "#e2d8b8", pat: "bars", patColor: "#4e3820" } },
  };

  // Venues, each with a fish table and selectable fishing positions.
  const SPOTS = [
    {
      id: "cove", name: "Lily Cove", ico: "🌿", price: 0, clarity: "stained", baseDepth: 0.30,
      sky: ["#7fd4e8", "#bff0f7"], water: ["#2a93b8", "#0a3a4a"],
      desc: "Calm, clear largemouth water — lily pads and laydowns.",
      lore: { where: "Sweetwater County, Georgia — a sheltered arm of old farm-country water", size: "85 acres", depth: "14 ft max", record: "11.2 lb", known: "Friendly numbers water. Dawn topwater around the pads; skip the dock shade when the sun gets up." },
      fish: [
        { k: "largemouth", weight: 84 }, { k: "giant", weight: 13 }, { k: "hawg", weight: 3 },
      ],
      positions: [
        { id: "pads", name: "Lily Pads", ico: "🪷", desc: "Prime largemouth ambush cover.", depth: -0.14,
          zone: [0.30, 0.32, 0.18, 0.16], bias: { largemouth: 1.9, spotted: 1.1, giant: 1.3, smallmouth: 0.6 } },
        { id: "dock", name: "Boat Dock", ico: "🛶", desc: "Shade-loving bass stack up.", depth: -0.1,
          zone: [0.70, 0.30, 0.16, 0.14], bias: { largemouth: 1.6, smallmouth: 1.3, spotted: 1.3 } },
        { id: "open", name: "Open Water", ico: "🌊", desc: "Cruising largemouth bass.", depth: 0.0,
          zone: [0.50, 0.62, 0.22, 0.16], bias: { smallmouth: 1.7, spotted: 1.5 } },
        { id: "drop", name: "The Drop-off", ico: "📉", desc: "Deeper edge — the big girls.", depth: 0.26,
          zone: [0.50, 0.84, 0.26, 0.14], bias: { giant: 2.4, hawg: 2.8, largemouth: 1.3, spotted: 1.2 } },
        { id: "creek", name: "Creek Mouth", ico: "🏞️", desc: "Inflow current pulls in the baitfish.", depth: -0.08,
          zone: [0.18, 0.52, 0.16, 0.14], bias: { largemouth: 1.6, giant: 1.2 } },
        { id: "stump", name: "Stump Field", ico: "🪵", desc: "Flooded timber — snaggy gold.", depth: 0.06,
          zone: [0.78, 0.62, 0.16, 0.14], bias: { largemouth: 1.5, giant: 1.6, hawg: 1.4 } },
      ],
    },
    {
      id: "river", name: "Boulder River", ico: "🏞️", price: 200, clarity: "clear", baseDepth: 0.46,
      sky: ["#9fdcc0", "#d7f3e6"], water: ["#2fae8e", "#0c4438"],
      desc: "Clear rocky current — largemouth on the boulders.",
      lore: { where: "Ozark foothills, Missouri — a cool, clear tailwater below Boulder Dam", size: "12 river miles", depth: "18 ft pools", record: "8.6 lb", known: "Gin-clear current. Downsize, fish the seams and undercut banks — sloppy casts get refused." },
      fish: [
        { k: "largemouth", weight: 84 }, { k: "giant", weight: 13 }, { k: "hawg", weight: 3 },
      ],
      positions: [
        { id: "riffle", name: "Rocky Riffles", ico: "💨", desc: "Oxygen-rich — active bass feed.", depth: -0.14,
          zone: [0.32, 0.42, 0.18, 0.14], bias: { smallmouth: 1.9, spotted: 1.4, giant: 0.8 } },
        { id: "pool", name: "Deep Pool", ico: "🌀", desc: "Big bass and toothy muskie.", depth: 0.2,
          zone: [0.68, 0.66, 0.20, 0.18], bias: { largemouth: 1.6, spotted: 1.2, giant: 1.6 } },
        { id: "bank", name: "Undercut Bank", ico: "🪵", desc: "Largemouth tuck under wood.", depth: -0.08,
          zone: [0.22, 0.70, 0.18, 0.16], bias: { largemouth: 1.9, spotted: 1.3, smallmouth: 1.1 } },
        { id: "tailout", name: "Current Seam", ico: "🏞️", desc: "Bass stage in the current seam.", depth: 0.04,
          zone: [0.55, 0.84, 0.26, 0.13], bias: { smallmouth: 1.5, spotted: 1.5, largemouth: 1.2 } },
        { id: "eddy", name: "Back Eddy", ico: "🌀", desc: "Slack swirl behind the boulder.", depth: 0.0,
          zone: [0.40, 0.26, 0.14, 0.12], bias: { largemouth: 1.5, giant: 1.1 } },
        { id: "bridge", name: "Bridge Pilings", ico: "🌉", desc: "Shade and a current break on concrete.", depth: 0.1,
          zone: [0.86, 0.70, 0.14, 0.12], bias: { largemouth: 1.4, giant: 1.5 } },
      ],
    },
    {
      id: "deep", name: "Trophy Lake", ico: "🏆", price: 900, clarity: "murky", baseDepth: 0.66,
      sky: ["#3a4b7a", "#1b2447"], water: ["#243a78", "#070d2a"],
      desc: "Deep, low-light trophy lake — where giant bass live.",
      lore: { where: "Piney Woods, East Texas — a flooded river-bottom reservoir", size: "4,200 acres", depth: "62 ft max", record: "17.8 lb", known: "Big-fish factory. Low light and deep structure grow double-digit giants — the night bite is legendary." },
      fish: [
        { k: "largemouth", weight: 46 }, { k: "giant", weight: 44 }, { k: "hawg", weight: 10 },
      ],
      positions: [
        { id: "weed", name: "Weed Edge", ico: "🌿", desc: "Giant largemouth prowl the grass.", depth: -0.1,
          zone: [0.30, 0.44, 0.18, 0.16], bias: { giant: 2.1, largemouth: 1.5, spotted: 1.1 } },
        { id: "point", name: "Main-Lake Point", ico: "📍", desc: "Cruising largemouth on the point.", depth: 0.02,
          zone: [0.70, 0.58, 0.18, 0.16], bias: { smallmouth: 1.7, spotted: 1.6, giant: 1.3 } },
        { id: "hole", name: "Deep Hole", ico: "🕳️", desc: "Where the true giants lurk.", depth: 0.24,
          zone: [0.50, 0.84, 0.24, 0.14], bias: { giant: 2.2, hawg: 3.0, largemouth: 1.4, spotted: 1.0 } },
        { id: "flat", name: "Moonlit Flat", ico: "🌙", desc: "Largemouth roam the moonlit flat.", depth: -0.2,
          zone: [0.50, 0.40, 0.26, 0.14], bias: { spotted: 1.8, smallmouth: 1.5, largemouth: 1.2 } },
        { id: "hump", name: "Offshore Hump", ico: "⛰️", desc: "Isolated rise loaded with fish.", depth: 0.14,
          zone: [0.28, 0.68, 0.16, 0.13], bias: { giant: 1.9, hawg: 2.0, largemouth: 1.2 } },
        { id: "marina", name: "Old Marina", ico: "⚓", desc: "Sunken docks and brush shade.", depth: -0.04,
          zone: [0.78, 0.30, 0.14, 0.12], bias: { largemouth: 1.7, giant: 1.2 } },
      ],
    },
    {
      id: "bayou", name: "Cypress Bayou", ico: "🌾", price: 0, clarity: "stained", baseDepth: 0.26,
      sky: ["#8fb36a", "#d7e6b0"], water: ["#4f7a45", "#12300f"],
      desc: "Warm tea-stained swamp — giant largemouth buried in heavy cover.",
      lore: { where: "Atchafalaya Basin, Louisiana — a tea-stained backwater swamp", size: "2,900 acres", depth: "9 ft max", record: "12.4 lb", known: "Heavy-cover brawling. Flip the cypress knees and throw the frog over the mats — hold on." },
      unlock: { need: c => c.total >= 25, label: "Catch 25 bass to unlock", prog: c => [c.total, 25] },
      fish: [
        { k: "largemouth", weight: 74 }, { k: "giant", weight: 20 }, { k: "hawg", weight: 6 },
      ],
      positions: [
        { id: "pads", name: "Grass Mats", ico: "🌿", desc: "Frog water — bass blow up through the salad.", depth: -0.16,
          zone: [0.30, 0.34, 0.18, 0.16], bias: { largemouth: 2.0, giant: 1.5, hawg: 1.2 } },
        { id: "logs", name: "Cypress Knees", ico: "🪵", desc: "Flip the trunks — big bass tuck in tight.", depth: -0.06,
          zone: [0.70, 0.32, 0.16, 0.14], bias: { largemouth: 1.8, giant: 1.6 } },
        { id: "bank", name: "Backwater Slough", ico: "🐸", desc: "Skinny water full of ambushers.", depth: -0.1,
          zone: [0.24, 0.66, 0.18, 0.16], bias: { largemouth: 1.9, giant: 1.2 } },
        { id: "drop", name: "Boat Canal", ico: "📉", desc: "The deeper cut — the biggest girls stage here.", depth: 0.24,
          zone: [0.52, 0.84, 0.26, 0.14], bias: { giant: 2.4, hawg: 2.6, largemouth: 1.2 } },
        { id: "duckweed", name: "Duckweed Flat", ico: "🦆", desc: "A solid green canopy — frog heaven.", depth: -0.18,
          zone: [0.50, 0.20, 0.16, 0.12], bias: { largemouth: 1.9, giant: 1.4 } },
        { id: "levee", name: "Levee Riprap", ico: "🧱", desc: "The rock line warms early and late.", depth: 0.02,
          zone: [0.16, 0.42, 0.14, 0.12], bias: { largemouth: 1.4, giant: 1.3 } },
      ],
    },
    {
      id: "highland", name: "Highland Reservoir", ico: "⛰️", price: 0, clarity: "clear", baseDepth: 0.58,
      sky: ["#a7c8e8", "#e2eef7"], water: ["#2b83aa", "#08283a"],
      desc: "Deep, gin-clear highland lake — finesse the rock for suspended giants.",
      lore: { where: "Cumberland Plateau, Tennessee — a deep, clear mountain impoundment", size: "7,800 acres", depth: "110 ft max", record: "10.9 lb", known: "Suspended fish over standing timber and bluff rock. Finesse tackle and patience pay here." },
      unlock: { need: c => c.big >= LUNKER_LB, label: "Land a 6 lb+ lunker to unlock" },
      fish: [
        { k: "largemouth", weight: 60 }, { k: "giant", weight: 30 }, { k: "hawg", weight: 10 },
      ],
      positions: [
        { id: "point", name: "Main-Lake Point", ico: "📍", desc: "Cruising bass sweep the point.", depth: 0.04,
          zone: [0.66, 0.50, 0.18, 0.16], bias: { largemouth: 1.5, giant: 1.5 } },
        { id: "logs", name: "Standing Timber", ico: "🌲", desc: "Suspended bass hang in the flooded trees.", depth: 0.0,
          zone: [0.30, 0.46, 0.18, 0.16], bias: { largemouth: 1.7, giant: 1.4 } },
        { id: "rocks", name: "Bluff Wall", ico: "🧱", desc: "Vertical rock — bass pin bait against it.", depth: 0.1,
          zone: [0.24, 0.68, 0.18, 0.14], bias: { largemouth: 1.4, giant: 1.3 } },
        { id: "hole", name: "Deep Brush Pile", ico: "🕳️", desc: "Sunken brush in deep water holds true giants.", depth: 0.28,
          zone: [0.54, 0.84, 0.24, 0.14], bias: { giant: 2.4, hawg: 3.0, largemouth: 1.3 } },
        { id: "creek2", name: "Creek Arm", ico: "🏞️", desc: "Fingers of warmer, dingier water.", depth: -0.1,
          zone: [0.62, 0.16, 0.15, 0.12], bias: { largemouth: 1.6, giant: 1.2 } },
        { id: "road", name: "Roadbed", ico: "🛣️", desc: "A flooded road — the fish highway.", depth: 0.12,
          zone: [0.40, 0.62, 0.16, 0.12], bias: { giant: 1.7, hawg: 1.6, largemouth: 1.2 } },
      ],
    },
    {
      id: "falls", name: "Grande Falls Tailwater", ico: "🌄", price: 0, clarity: "clear", baseDepth: 0.44,
      sky: ["#bcd8e2", "#eef6f2"], water: ["#2f8f7e", "#0a3230"],
      desc: "Cold, fast, gin-clear tailwater — smallmouth country. They pull twice their weight.",
      lore: { where: "Below Grande Falls Dam, the Ozarks — cold water pushed through a boulder canyon", size: "9 river miles", depth: "38 ft in the chute", record: "7.9 lb smallmouth", known: "Bronze fish sit on current seams and boulder shade. Downsize, work the seams, hang on." },
      unlock: { need: c => c.big >= 8, label: "Land an 8 lb+ giant to unlock" },
      fish: [
        { k: "smallie", weight: 72 }, { k: "bronzeback", weight: 23 }, { k: "largemouth", weight: 5 },
      ],
      positions: [
        { id: "boil", name: "Dam Boil", ico: "🌀", desc: "Oxygen-rich churn — the strongest fish feed first.", depth: 0.06,
          zone: [0.16, 0.2, 0.16, 0.14], bias: { smallie: 1.6, bronzeback: 1.7 } },
        { id: "seam", name: "Current Seam", ico: "〰️", desc: "Fast meets slow — smallmouth stack the line.", depth: 0.0,
          zone: [0.44, 0.36, 0.18, 0.14], bias: { smallie: 1.9, bronzeback: 1.2 } },
        { id: "boulder", name: "Boulder Garden", ico: "🪨", desc: "Shade pockets behind every rock.", depth: 0.05,
          zone: [0.68, 0.52, 0.18, 0.15], bias: { smallie: 1.5, bronzeback: 1.5, largemouth: 0.8 } },
        { id: "chute", name: "The Chute", ico: "⤵️", desc: "Deep fast slot — the river's biggest fish hold bottom.", depth: 0.26,
          zone: [0.36, 0.62, 0.2, 0.14], bias: { bronzeback: 2.6, smallie: 1.1 } },
        { id: "gravel", name: "Gravel Flat", ico: "🏖️", desc: "Numbers water when the sun is low.", depth: -0.1,
          zone: [0.72, 0.22, 0.16, 0.12], bias: { smallie: 1.7, largemouth: 1.1 } },
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
      rod: "spin", ownedRods: ["spin"],
      lure: { id: "worm", color: "green", size: "med" }, ownedLures: ["worm"], attractant: "none", line: "mono",
      spot: "cove", ownedSpots: ["cove"],
      positions: { cove: "pads", river: "riffle", deep: "weed" },
      records: {}, caught: {}, catchLog: [],
      tourWins: 0, bestBag: 0,
      season: { best: {}, titles: 0 },   // circuit season: best points per event + championships won
      challenges: {}, lakes: {}, arcadeClears: 0, arcadeNC: false, arcadeBestScore: 0,
      mode: "free",     // "free" fishing (default) — tournaments are entered from the circuit
      muted: false, musicOn: true, musicVol: 0.5, sfxVol: 1,
      name: "", tutorialDone: false,
      pausedTour: null, pausedArcade: null,     // suspended runs, resumable from the menu
      pid: "", lbBucket: "",                    // global-leaderboard identity + board code
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
        if (!LINES[m.line]) m.line = "mono";
        const lu = LURES.find(l => l.id === m.lure.id);
        if (lu && !lu.colors.includes(m.lure.color)) m.lure.color = lu.colors[0];
        if (!SIZES[m.lure.size]) m.lure.size = "med";
        // migrate old rod ids (twig/carbon/pro/legend) → new real rod types
        const ROD_MAP = { twig: "spin", carbon: "spin", pro: "baitcast", legend: "heavy" };
        if (ROD_MAP[m.rod]) m.rod = ROD_MAP[m.rod];
        if (!RODS.find(r => r.id === m.rod)) m.rod = "spin";
        // migrate: old saves split bass into Giant/Trophy Largemouth — fold them all
        // into a single "Largemouth Bass" record/count
        m.records = m.records || {}; m.caught = m.caught || {};
        const LM = "Largemouth Bass";
        for (const old of ["Giant Largemouth", "Trophy Largemouth"]) {
          if (m.records[old] != null) { m.records[LM] = Math.max(m.records[LM] || 0, m.records[old]); delete m.records[old]; }
          if (m.caught[old] != null) { m.caught[LM] = (m.caught[LM] || 0) + m.caught[old]; delete m.caught[old]; }
        }
        return m;
      }
    } catch (e) {}
    return defaultSave();
  }
  var lbSubmitHook = null;   // set by the leaderboard module once it's up
  var cloudSaveHook = null;  // set by the daily module — backs the whole save up to the db
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
    if (lbSubmitHook) lbSubmitHook();   // throttled — pushes score changes to the global board
    if (cloudSaveHook) cloudSaveHook(); // throttled — full-save backup for restore-by-PIN
  }
  const G = load();
  // 🎨 a Paint Bench custom color rides in the save and joins the palette
  function applyCustomPaint() {
    if (G.customPaint && /^#[0-9a-f]{6}$/i.test(G.customPaint.hex)) {
      COLORS.custom = { name: (G.customPaint.name || "Custom").slice(0, 16), hex: G.customPaint.hex, fam: G.customPaint.fam === "bright" ? "bright" : "natural" };
    } else { delete COLORS.custom; if (G.lure && G.lure.color === "custom") G.lure.color = "green"; }
  }
  applyCustomPaint();

  const rod  = () => RODS.find(r => r.id === G.rod) || RODS[0];
  const lure = () => LURES.find(l => l.id === G.lure.id) || LURES[0];
  const spot = () => SPOTS.find(s => s.id === G.spot) || SPOTS[0];
  const position = () => { const sp = spot(); return sp.positions.find(p => p.id === G.positions[sp.id]) || sp.positions[0]; };

  // No economy: every rod, lure and lake is always yours. The game is about
  // choosing the right thing for the conditions, not buying it.
  const isArcade = () => true;
  const ownsRod = () => true;
  const ownsLure = () => true;
  // lakes are free, but the two extra ones unlock by hitting a milestone (no coins)
  const ownsSpot = (id) => {
    const sp = SPOTS.find(s => s.id === id);
    if (!sp || !sp.unlock) return true;
    return !!sp.unlock.need(achCtx());
  };

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
    fightPanel: $("fightPanel"), ftStamina: $("ftStamina"), ftTension: $("ftTension"), ftDist: $("ftDist"), ftFishMark: $("ftFishMark"), ftLine: $("ftLine"), ftHint: $("ftHint"), ftCover: $("ftCover"), ftCoverRow: $("ftCoverRow"),
    condIcon: $("condIcon"), condTemp: $("condTemp"), condClock: $("condClock"), condMoon: $("condMoon"),
    catchModal: $("catchModal"), catchRarity: $("catchRarity"), catchArt: $("catchArt"),
    catchName: $("catchName"), catchWeight: $("catchWeight"), catchReward: $("catchReward"),
    catchRewardWrap: $("catchRewardWrap"), catchScoreBd: $("catchScoreBd"), catchRecord: $("catchRecord"), catchTourney: $("catchTourney"), catchOk: $("catchOk"),
    failModal: $("failModal"), failMsg: $("failMsg"), failOk: $("failOk"),
    shopBtn: $("shopBtn"), muteBtn: $("muteBtn"),
    xpPill: $("xpPill"), recordsModal: $("recordsModal"), recordsClose: $("recordsClose"), recStats: $("recStats"), recBody: $("recBody"),
    catchLogModal: $("catchLogModal"), catchLogClose: $("catchLogClose"), clogList: $("clogList"), clogCount: $("clogCount"),
    fLake: $("fLake"), fLure: $("fLure"), fRod: $("fRod"), fTime: $("fTime"), fWx: $("fWx"),
    statsModal: $("statsModal"), statsClose: $("statsClose"), statsBody: $("statsBody"), openStatsBtn: $("openStatsBtn"),
    catchDetailModal: $("catchDetailModal"), catchDetailClose: $("catchDetailClose"), catchDetailBody: $("catchDetailBody"),
    trophyModal: $("trophyModal"), trophyClose: $("trophyClose"), trophyStats: $("trophyStats"), trophyMountSvg: $("trophyMountSvg"), trophyAch: $("trophyAch"), trophyAchHead: $("trophyAchHead"),
    rodChip: $("rodChip"), lureChip: $("lureChip"), spotChip: $("spotChip"),
    hookMeter: $("hookMeter"), hmMarker: $("hmMarker"), strikeFlash: $("strikeFlash"), catchHookset: $("catchHookset"),
    lureModal: $("lureModal"), lureClose: $("lureClose"), lureList: $("lureList"), colorRow: $("colorRow"), lureCond: $("lureCond"), lureCats: $("lureCats"), sizeRow: $("sizeRow"), lineRow: $("lineRow"), lineCats: $("lineCats"),
    rodModal: $("rodModal"), rodClose: $("rodClose"), rodList: $("rodList"), rodCond: $("rodCond"), rodCats: $("rodCats"),
    mapModal: $("mapModal"), daySummaryModal: $("daySummaryModal"), daySummaryBody: $("daySummaryBody"), newDayBtn: $("newDayBtn"), endDayBtn: $("endDayBtn"), mapClose: $("mapClose"), mapVenues: $("mapVenues"), posGrid: $("posGrid"),
    tourneyBtn: $("tourneyBtn"), modeModal: $("modeModal"), modeClose: $("modeClose"),
    tourHud: $("tourHud"), tourClock: $("tourClock"), livewell: $("livewell"), tourTotal: $("tourTotal"), tourBig: $("tourBig"), tourQuit: $("tourQuit"), tourPos: $("tourPos"),
    arcadeHud: $("arcadeHud"), arcTimer: $("arcTimer"), arcStage: $("arcStage"), arcQuota: $("arcQuota"), arcFill: $("arcFill"),
    arcadeModal: $("arcadeModal"), arcadeTitle: $("arcadeTitle"), arcadeBody: $("arcadeBody"), arcadeGo: $("arcadeGo"), arcadeAlt: $("arcadeAlt"),
    tourStartModal: $("tourStartModal"), tourField: $("tourField"),
    tourStartBtn: $("tourStartBtn"), tourStartCancel: $("tourStartCancel"), tourRules: $("tourRules"),
    tourResultModal: $("tourResultModal"), tourResultMedal: $("tourResultMedal"), tourPlace: $("tourPlace"),
    tourBag: $("tourBag"), tourResultStats: $("tourResultStats"), tourStandings: $("tourStandings"), tourResultOk: $("tourResultOk"),
    titleScreen: $("titleScreen"), anglerName: $("anglerName"), titleStats: $("titleStats"),
    tsFree: $("tsFree"), tsArcade: $("tsArcade"), tsTour: $("tsTour"), tsTutorial: $("tsTutorial"),
    tsResume: $("tsResume"), tsBoard: $("tsBoard"), homeBtn: $("homeBtn"),
    tsDaily: $("tsDaily"), dailyModal: $("dailyModal"), dailyClose: $("dailyClose"), dailyBody: $("dailyBody"),
    dailyTicker: $("dailyTicker"), dailyTickerText: $("dailyTickerText"),
    titleTicker: $("titleTicker"), titleTickerText: $("titleTickerText"),
    tsRestore: $("tsRestore"), restoreModal: $("restoreModal"), restoreGo: $("restoreGo"), restoreCancel: $("restoreCancel"),
    catchShare: $("catchShare"), hostModal: $("hostModal"), hostClose: $("hostClose"), hostBody: $("hostBody"), hostTitle: $("hostTitle"),
    garageModal: $("garageModal"), garageClose: $("garageClose"), garageBody: $("garageBody"), tsGarage: $("tsGarage"),
    tsBell: $("tsBell"), notifModal: $("notifModal"), notifClose: $("notifClose"), notifBody: $("notifBody"),
    proModal: $("proModal"), proClose: $("proClose"), proBody: $("proBody"),
    replayModal: $("replayModal"), replayName: $("replayName"), replayBar: $("replayBar"), replayClock: $("replayClock"), replayFeed: $("replayFeed"), replayClose: $("replayClose"),
    tsNews: $("tsNews"), newsModal: $("newsModal"), newsClose: $("newsClose"), newsBody: $("newsBody"),
    lbModal: $("lbModal"), lbClose: $("lbClose"), lbBody: $("lbBody"), lbSorts: $("lbSorts"),
    lbProfileModal: $("lbProfileModal"), lbpName: $("lbpName"), lbpClose: $("lbpClose"),
    lbpStats: $("lbpStats"), lbpFav: $("lbpFav"), lbpSorts: $("lbpSorts"), lbpList: $("lbpList"),
    mapTitle: $("mapTitle"), mapCond: $("mapCond"), posHead: $("posHead"),
    mapNext: $("mapNext"), mapBack: $("mapBack"), lureFish: $("lureFish"), lureBack: $("lureBack"), lakeMap: $("lakeMap"),
    lureTitle: $("lureTitle"), rodTitle: $("rodTitle"), rodBack: $("rodBack"), rodNext: $("rodNext"),
    tutBanner: $("tutBanner"), tutStep: $("tutStep"), tutText: $("tutText"), tutSkip: $("tutSkip"), menuBtn: $("menuBtn"),
    guideBtn: $("guideBtn"), guideModal: $("guideModal"), guideClose: $("guideClose"),
    anglerModal: $("anglerModal"), anglerTitle: $("anglerTitle"), anglerList: $("anglerList"),
    anglerBack: $("anglerBack"), anglerNext: $("anglerNext"), anglerClose: $("anglerClose"),
    garModal: $("garModal"), garFace: $("garFace"), garBody: $("garBody"), garYes: $("garYes"), garNo: $("garNo"),
    soundModal: $("soundModal"), sndMusic: $("sndMusic"), sndFx: $("sndFx"), soundClose: $("soundClose"),
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
    bag: [],   // free-play livewell: your 5 biggest bass this session (weights, desc)
  };
  // total of the session's best-5 free-play bag
  function bagTotal() { return S.bag.reduce((s, w) => s + w, 0); }
  // ---- achievements ----
  // Each has a test() run against a snapshot of your stats/catch-log, so they also
  // unlock retroactively (old saves earn what they've already done on next open).
  const ACH = [
    // ---- the ladder: sheer numbers ----
    { id: "first",   ico: "🎣", name: "First Cast",        desc: "Catch your first bass",               test: c => c.total >= 1 },
    { id: "ten",     ico: "🐟", name: "Getting Dialed",    desc: "Catch 10 bass",                       test: c => c.total >= 10,  prog: c => [c.total, 10] },
    { id: "twentyfive", ico: "🐠", name: "Regular",        desc: "Catch 25 bass",                       test: c => c.total >= 25,  prog: c => [c.total, 25] },
    { id: "fifty",   ico: "🎽", name: "Weekend Warrior",   desc: "Catch 50 bass",                       test: c => c.total >= 50,  prog: c => [c.total, 50] },
    { id: "hundred", ico: "💯", name: "Bass Master",       desc: "Catch 100 bass",                      test: c => c.total >= 100, prog: c => [c.total, 100] },
    { id: "c250",    ico: "🎏", name: "Stick",             desc: "Catch 250 bass",                      test: c => c.total >= 250, prog: c => [c.total, 250] },
    { id: "c500",    ico: "🐉", name: "River Legend",      desc: "Catch 500 bass",                      test: c => c.total >= 500, prog: c => [c.total, 500] },
    { id: "c1000",   ico: "🛐", name: "Bass Deity",        desc: "Catch 1,000 bass",                    test: c => c.total >= 1000, prog: c => [c.total, 1000] },
    // ---- the size ladder ----
    { id: "keeper2", ico: "✅", name: "Keeper",            desc: "Boat a 2 lb+ bass",                   test: c => c.big >= 2 },
    { id: "quality4",ico: "💚", name: "Quality Fish",      desc: "Boat a 4 lb+ bass",                   test: c => c.big >= 4 },
    { id: "lunker",  ico: "💪", name: "Lunker!",           desc: "Boat a 6 lb+ bass",                   test: c => c.big >= LUNKER_LB },
    { id: "eight",   ico: "🦬", name: "Bruiser",           desc: "Boat an 8 lb+ bass",                  test: c => c.big >= 8 },
    { id: "trophy",  ico: "👑", name: "Trophy Bass",       desc: "Land a 10 lb+ largemouth",            test: c => c.big >= 10 },
    { id: "legend12",ico: "🐲", name: "Lake Monster",      desc: "Land a 12 lb+ giant",                 test: c => c.big >= 12 },
    { id: "lunk5",   ico: "🥩", name: "Lunker Hunter",     desc: "Boat 5 lunkers (6 lb+)",              test: c => c.lunkers >= 5,  prog: c => [c.lunkers, 5] },
    { id: "lunk25",  ico: "🍖", name: "Hawg Farmer",       desc: "Boat 25 lunkers",                     test: c => c.lunkers >= 25, prog: c => [c.lunkers, 25] },
    // ---- skill ----
    { id: "perfect1", ico: "✨", name: "Perfect Timing",   desc: "Set a Perfect hookset",               test: c => c.perfectHooks >= 1 },
    { id: "perfect25",ico: "🎯", name: "Hair Trigger",     desc: "25 Perfect hooksets",                 test: c => c.perfectHooks >= 25, prog: c => [c.perfectHooks, 25] },
    { id: "acro",    ico: "🤸", name: "Rodeo Ride",        desc: "Land a bass that jumped 3+ times",    test: c => c.acro >= 1 },
    { id: "finesse", ico: "🤏", name: "Finesse Master",    desc: "Land a 5 lb+ bass on a finesse lure", test: c => c.finesse },
    { id: "ullunker",ico: "🪶", name: "Light-Line Hero",   desc: "Land a lunker on the Ultralight",     test: c => c.ulLunker },
    { id: "deep",    ico: "🕳️", name: "Deep Diver",        desc: "Catch a bass 20 ft+ down",            test: c => c.deep },
    { id: "skinny",  ico: "🦶", name: "Skinny Water",      desc: "Catch a bass under 3 ft deep",        test: c => c.shallow },
    { id: "score1500", ico: "💥", name: "Highlight Reel",  desc: "Score 1,500+ on a single catch",      test: c => c.bestCatchScore >= 1500 },
    { id: "score2500", ico: "🌟", name: "Perfect Catch",   desc: "Score 2,500+ on a single catch",      test: c => c.bestCatchScore >= 2500 },
    // ---- tackle mastery ----
    { id: "lures",   ico: "🧰", name: "Tackle Junkie",     desc: "Catch bass on 8 different lures",     test: c => c.lureCount >= 8, prog: c => [c.lureCount, 8] },
    { id: "alllures",ico: "🎁", name: "Full Box",          desc: "Catch bass on every lure",            test: c => c.lureCount >= LURES.length, prog: c => [c.lureCount, LURES.length] },
    { id: "allrods", ico: "🎋", name: "Rod Collector",     desc: "Catch bass on all 4 rods",            test: c => c.rodCount >= RODS.length, prog: c => [c.rodCount, RODS.length] },
    { id: "alllines",ico: "🧵", name: "Line Dancer",       desc: "Catch bass on all 3 line types",      test: c => c.lineCount >= 3, prog: c => [c.lineCount, 3] },
    { id: "allsizes",ico: "📏", name: "Size Matters",      desc: "Catch bass on all 3 lure sizes",      test: c => c.sizeCount >= 3, prog: c => [c.sizeCount, 3] },
    { id: "allscents",ico: "🧪", name: "Mad Scientist",    desc: "Catch bass on all 5 scents",          test: c => c.scentCount >= 5, prog: c => [c.scentCount, 5] },
    { id: "topwater",ico: "💦", name: "Blow-Up!",          desc: "Catch a bass on a topwater lure",     test: c => c.topwater },
    { id: "bottom",  ico: "🪨", name: "Bottom Bouncer",    desc: "Catch a bass on a bottom bait",       test: c => c.bottomBait },
    // ---- conditions ----
    { id: "night",   ico: "🌙", name: "Night Bite",        desc: "Catch a bass after dark",             test: c => c.night },
    { id: "dawn",    ico: "🌅", name: "Dawn Patrol",       desc: "Catch a bass before 6 am",            test: c => c.dawn },
    { id: "noon",    ico: "🥵", name: "High-Noon Hero",    desc: "Catch a bass in the midday sun",      test: c => c.noon },
    { id: "fullmoon",ico: "🌕", name: "Moon Feeder",       desc: "Catch a bass on a full moon",         test: c => c.fullMoon },
    { id: "newmoon", ico: "🌑", name: "Dark-Side Bite",    desc: "Catch a bass on a new moon",          test: c => c.newMoon },
    { id: "storm",   ico: "🌧️", name: "Rain Maker",        desc: "Catch a bass in the rain",            test: c => c.rain },
    { id: "fog",     ico: "🌫️", name: "Ghost Ship",        desc: "Catch a bass in the fog",             test: c => c.fog },
    { id: "winter",  ico: "❄️", name: "Hard-Water Hero",   desc: "Catch a bass in winter",              test: c => c.winter },
    { id: "seasons", ico: "🗓️", name: "Year-Rounder",      desc: "Catch bass in all 4 seasons",         test: c => c.seasonCount >= 4, prog: c => [c.seasonCount, 4] },
    // ---- the lakes ----
    { id: "slam",    ico: "🗺️", name: "Lake Slam",         desc: "Catch a bass in every lake",          test: c => c.lakeCount >= SPOTS.length, prog: c => [c.lakeCount, SPOTS.length] },
    { id: "unlockall",ico: "🔓", name: "Explorer",         desc: "Unlock every lake",                   test: c => c.allLakesOpen },
    { id: "local10", ico: "🏕️", name: "Local Knowledge",   desc: "Catch 10 bass in every lake",         test: c => c.tenEverywhere },
    // ---- the livewell & big days ----
    { id: "bag15",   ico: "🪣", name: "Heavy Sack",        desc: "A livewell over 15 lb",               test: c => c.bestBag >= 15 },
    { id: "bag20",   ico: "🧺", name: "Twenty Club",       desc: "A livewell over 20 lb",               test: c => c.bestBag >= 20 },
    { id: "bag25",   ico: "🛢️", name: "Legendary Bag",     desc: "A livewell over 25 lb",               test: c => c.bestBag >= 25 },
    { id: "day10",   ico: "☀️", name: "Banner Day",        desc: "Catch 10 bass in one day",            test: c => c.bestDayCatches >= 10, prog: c => [c.bestDayCatches, 10] },
    { id: "day20",   ico: "🔥", name: "On Fire",           desc: "Catch 20 bass in one day",            test: c => c.bestDayCatches >= 20, prog: c => [c.bestDayCatches, 20] },
    // ---- the circuit ----
    { id: "tourwin", ico: "🏁", name: "Tournament Win",    desc: "Win any tournament",                  test: c => c.tourWins >= 1 },
    { id: "tour3",   ico: "🥇", name: "Front Runner",      desc: "Win 3 tournaments",                   test: c => c.tourWins >= 3,  prog: c => [c.tourWins, 3] },
    { id: "tour10",  ico: "🏆", name: "Dynasty",           desc: "Win 10 tournaments",                  test: c => c.tourWins >= 10, prog: c => [c.tourWins, 10] },
    { id: "champ",   ico: "👑", name: "Circuit Champion",  desc: "Win a circuit season",                test: c => c.titles >= 1 },
    { id: "garrun",  ico: "🏹", name: "River Secret",      desc: "Somebody saw big gar up the river…",  test: c => c.garTrips >= 1 },
    { id: "garslam", ico: "🐊", name: "Gar Wrangler",      desc: "Arrow 100 lb of gar in one river run", test: c => c.garBestHaul >= 100 },
    { id: "creekrun", ico: "🥄", name: "Creek Secret",     desc: "Word at the marina: something's running…", test: c => c.sandTrips >= 1 },
    { id: "rcrun",   ico: "🚤", name: "Rapids Secret",     desc: "Somebody knows some sweet rapids up the river…", test: c => c.rcTrips >= 1 },
    { id: "rcslam",  ico: "🛞", name: "Send It",           desc: "Score 2,500 stunt points in one rapids run", test: c => c.rcBest >= 2500 },
    { id: "froggig", ico: "🔱", name: "Bayou Secret",      desc: "Something's singing in the bayou at night…", test: c => c.frogTrips >= 1 },
    { id: "frogslam",ico: "🐸", name: "Frog Fry",          desc: "Gig 10 lb of bullfrogs in one bayou night", test: c => c.frogBestHaul >= 10 },
    { id: "legend",  ico: "🌙", name: "The Legend of Lily Cove", desc: "Some stories turn out to be true…", test: c => c.ghostCaught >= 1 },
    { id: "troutrun", ico: "🪶", name: "First Light",        desc: "Something's sipping below the dam at dawn…", test: c => c.troutTrips >= 1 },
    { id: "browntown", ico: "🎺", name: "Brown Town",        desc: "Net 20 lb of trout in one dawn session", test: c => c.troutBestHaul >= 20 },
    { id: "catrun",   ico: "💪", name: "Bluff Secret",       desc: "Something's holed up under the bluff timber…", test: c => c.catTrips >= 1 },
    { id: "hogline",  ico: "🐋", name: "Hog Line",           desc: "Wrestle a 30 lb+ flathead out bare-handed", test: c => c.catBig >= 30 },
    { id: "sandslam", ico: "🐟", name: "Sandy Slam",       desc: "Boat 20 lb of sand bass in one creek run", test: c => c.sandBestHaul >= 20 },
    { id: "champ3",  ico: "💍", name: "Three-Peat",        desc: "Win 3 circuit seasons",               test: c => c.titles >= 3, prog: c => [c.titles, 3] },
    // ---- the arcade ----
    { id: "arcade",  ico: "🕹️", name: "Get Bass!",         desc: "Clear all 4 Arcade stages",           test: c => c.arcadeClears >= 1 },
    { id: "arcade1cc", ico: "🎖️", name: "One-Credit Clear", desc: "Clear Arcade without continuing",    test: c => c.arcadeNC },
    { id: "arcfinale", ico: "🌃", name: "The Midnight Run", desc: "Reach the Trophy Lake finale",       test: c => c.arcadeFinale },
    { id: "arc10k",  ico: "🎰", name: "Score Chaser",      desc: "10,000+ arcade score",                test: c => c.arcadeBest >= 10000 },
    { id: "arc20k",  ico: "🀄", name: "Cabinet King",      desc: "20,000+ arcade score",                test: c => c.arcadeBest >= 20000 },
    // ---- the long game ----
    { id: "life10k", ico: "📈", name: "Making a Name",     desc: "10,000 lifetime angler score",        test: c => c.lifeScore >= 10000,  prog: c => [c.lifeScore, 10000] },
    { id: "life100k",ico: "💼", name: "Turning Pro",       desc: "100,000 lifetime angler score",       test: c => c.lifeScore >= 100000, prog: c => [c.lifeScore, 100000] },
    { id: "life500k",ico: "🗿", name: "Hall of Famer",     desc: "500,000 lifetime angler score",       test: c => c.lifeScore >= 500000, prog: c => [c.lifeScore, 500000] },
    { id: "tutor",   ico: "🎓", name: "Student of the Game", desc: "Complete the tutorial",             test: c => c.tutorial },
  ];
  // snapshot of everything the achievement tests look at — lifetime tallies come
  // from G.tally (updated every catch), one-off flags fall back to the catch log
  function achCtx() {
    const log = G.catchLog || [];
    const recVals = Object.values(G.records || {});
    const t = G.tally || {};
    const cnt = o => Object.keys(o || {}).length;
    const hours = t.hour || {};
    const ctx = {
      total: Object.values(G.caught || {}).reduce((s, n) => s + n, 0),
      big: recVals.length ? Math.max(...recVals) : 0,
      bestBag: G.bestBag || 0,
      tourWins: G.tourWins || 0, titles: (G.season && G.season.titles) || 0,
      arcadeClears: G.arcadeClears || 0, arcadeNC: !!G.arcadeNC,
      arcadeBest: G.arcadeBestScore || 0, arcadeFinale: !!G.arcadeFinale,
      lunkers: G.lunkers || 0, perfectHooks: G.perfectHooks || 0, acro: G.acro || 0,
      bestCatchScore: G.bestCatchScore || 0, bestDayCatches: G.bestDayCatches || 0,
      lifeScore: G.coins || 0, tutorial: !!G.tutorialDone,
      garTrips: G.garTrips || 0, garBestHaul: G.garBestHaul || 0,
      sandTrips: G.sandTrips || 0, sandBestHaul: G.sandBestHaul || 0,
      rcTrips: G.rcTrips || 0, rcBest: G.rcBest || 0,
      frogTrips: G.frogTrips || 0, frogBestHaul: G.frogBestHaul || 0, ghostCaught: G.ghostCaught || 0,
      troutTrips: G.troutTrips || 0, troutBestHaul: G.troutBestHaul || 0,
      catTrips: G.catTrips || 0, catBig: G.catBig || 0,
      lureCount: Math.max(new Set(log.map(e => e.lure)).size, cnt(t.lure)),
      rodCount: cnt(t.rod), lineCount: cnt(t.line), sizeCount: cnt(t.size),
      scentCount: Object.keys(t.scent || {}).filter(k => k && k !== "none").length,
      seasonCount: cnt(t.season),
      lakeCount: Object.keys(G.lakes || {}).filter(k => G.lakes[k]).length,
      tenEverywhere: SPOTS.every(s => ((t.spot || {})[s.id] || 0) >= 10),
      topwater:   Object.keys(t.lure || {}).some(id => (LURES.find(l => l.id === id) || {}).style === "top"),
      bottomBait: Object.keys(t.lure || {}).some(id => { const l = LURES.find(x => x.id === id); return l && l.style === "sink" && l.band >= 0.8; }),
      night:    log.some(e => { const h = (e.timeMin / 60) % 24; return h < 5 || h >= 20; }),
      dawn:     Object.keys(hours).some(h => +h >= 4 && +h < 6),
      noon:     !!hours[12] || !!hours[13],
      fullMoon: log.some(e => e.moon === 4) || !!(t.moon || {})[4],
      newMoon:  !!(t.moon || {})[0],
      deep:     log.some(e => (e.depth || 0) >= 20),
      shallow:  log.some(e => (e.depth || 0) <= 3),
      finesse:  log.some(e => e.w >= 5 && e.size === "small"),
      ulLunker: log.some(e => e.w >= LUNKER_LB && e.rod === "ultralight"),
      rain:     log.some(e => e.weather === "rain") || !!(t.weather || {}).rain,
      fog:      !!(t.weather || {}).fog || log.some(e => e.weather === "fog"),
      winter:   !!(t.season || {}).winter || log.some(e => e.season === "winter"),
    };
    // lake-unlock tests read this same context — resolve them on the built object
    // (calling ownsSpot here would recurse straight back into achCtx)
    ctx.allLakesOpen = SPOTS.every(s => !s.unlock || !!s.unlock.need(ctx));
    return ctx;
  }
  // unlock everything now satisfied. silent (on load) just sets the flags; loud
  // (after a catch/win) fires the toast + save for anything newly earned.
  function evalAchievements(silent) {
    if (!G.challenges) G.challenges = {};
    const c = achCtx(); let changed = false;
    for (const a of ACH) {
      if (G.challenges[a.id]) continue;
      if (a.test(c)) { G.challenges[a.id] = true; changed = true; if (!silent) { toast(`🏅 ${a.name} — +1 skill point!`); grantAchSP(); } }
    }
    if (changed && !silent) save();
    return changed;
  }
  function unlock(id) {                          // still used by the tournament handlers
    if (!G.challenges) G.challenges = {};
    if (G.challenges[id]) return;
    G.challenges[id] = true;
    const a = ACH.find(x => x.id === id);
    if (a) { toast(`🏅 ${a.name} — +1 skill point!`); grantAchSP(); }
    save();
  }
  // catch-driven achievements (called whenever a bass is boated)
  function checkCatchChallenges(f) {
    if (!f || !f.bass) return;
    if (!G.lakes) G.lakes = {};
    G.lakes[G.spot] = true;
    logCatch(f);
    evalAchievements(false);
  }
  // lifetime tallies (unbounded, unlike the 300-entry log) — what the wall of
  // achievements reads for "caught on every X" and per-condition counts
  function tallyCatch(e) {
    const t = G.tally || (G.tally = {});
    const bump = (cat, key) => { if (key == null) return; const o = t[cat] || (t[cat] = {}); o[key] = (o[key] || 0) + 1; };
    bump("lure", e.lure); bump("color", e.color); bump("size", e.size); bump("rod", e.rod); bump("line", e.line);
    bump("spot", e.spot); bump("weather", e.weather); bump("season", e.season); bump("scent", e.scent || "none");
    bump("moon", e.moon); bump("hour", Math.floor((e.timeMin || 0) / 60) % 24);
    if (e.w >= LUNKER_LB) G.lunkers = (G.lunkers || 0) + 1;
    G.bestCatchScore = Math.max(G.bestCatchScore || 0, e.score || 0);
  }
  // record every bass with the full conditions/gear so the Catch Log can sort & filter
  function logCatch(f) {
    if (!G.catchLog) G.catchLog = [];
    G.catchLog.push({
      ts: Date.now(), w: f.weight, len: f.lengthIn || +Math.cbrt(f.weight * 1600).toFixed(1),
      depth: Math.round((S.catchDepth != null ? S.catchDepth : S.cond.band) * 24),   // feet the fish was caught at
      lure: G.lure.id, color: G.lure.color, size: G.lure.size || "med", rod: G.rod, line: G.line || "mono",
      scent: G.attractant || "none",
      spot: G.spot, pos: position().id,
      timeMin: Math.round(S.cond.timeMin), weather: S.cond.weather, season: S.cond.season, temp: S.cond.temp,
      moon: ((S.cond.moon || 0) % 8 + 8) % 8,
      score: Math.round(f.score || 0),
      tour: !!S.tournament,
    });
    tallyCatch(G.catchLog[G.catchLog.length - 1]);
    if (G.catchLog.length > 300) G.catchLog.shift();   // keep the log bounded
  }
  // time-of-day bucket for filtering
  function todBucket(timeMin) {
    const h = (timeMin / 60) % 24;
    if (h >= 5 && h < 8) return { k: "dawn", label: "Dawn" };
    if (h >= 8 && h < 17) return { k: "day", label: "Day" };
    if (h >= 17 && h < 20) return { k: "dusk", label: "Dusk" };
    return { k: "night", label: "Night" };
  }

  // add a bass to the session livewell, keeping only the 5 heaviest
  function bagAdd(weight) {
    S.bag.push(weight);
    S.bag.sort((a, b) => b - a);
    if (S.bag.length > 5) S.bag.length = 5;
    const tot = +bagTotal().toFixed(2);
    if (tot > (G.bestBag || 0)) { G.bestBag = tot; return true; }   // new personal-best livewell
    return false;
  }

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
  function vibrate(ms) { try { if (!G.muted) navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  // ---- Synthesized sound effects (Web Audio — no asset files) ----
  const Sound = (() => {
    let ctx = null, master = null, ready = false, ambBed = null;
    let bedFilter = null, bedGain = null, bedBase = 0.05, isNight = false;
    function ensure() {
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
          ctx = new AC();
          master = ctx.createGain(); master.connect(ctx.destination); applyGain();
          ready = true;
          ambientStart();
        }
        if (ctx.state === "suspended") ctx.resume();
      } catch (e) {}
    }
    // one master gain covers every effect + the ambience bed: mute × user volume.
    // Ramped, not snapped — a hard gain jump is an audible click ("zipper noise")
    function applyGain() {
      if (!master) return;
      const v = G.muted ? 0 : 0.45 * (G.sfxVol != null ? G.sfxVol : 1);
      try { master.gain.setTargetAtTime(v, ctx.currentTime, 0.03); } catch (e) { master.gain.value = v; }
    }
    function setMuted(m) { applyGain(); }
    function setVolume() { applyGain(); }
    // continuous gentle-water ambience (looping filtered noise with a slow swell)
    function ambientStart() {
      if (!ready || ambBed) return;
      try {
        const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        ambBed = ctx.createBufferSource(); ambBed.buffer = buf; ambBed.loop = true;
        const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = isNight ? 230 : 360;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        ambBed.connect(f); f.connect(g); g.connect(master);
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.02;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
        ambBed.start();
        bedFilter = f; bedGain = g; bedBase = isNight ? 0.034 : 0.05;
        g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(bedBase, ctx.currentTime + 2.5);
      } catch (e) {}
    }
    // ease the water bed darker & calmer at night, brighter & livelier by day
    function setNight(night) {
      isNight = !!night;
      if (!ready || !bedFilter) return;
      try {
        const t = ctx.currentTime;
        bedFilter.frequency.linearRampToValueAtTime(night ? 230 : 360, t + 2);
        bedBase = night ? 0.034 : 0.05;
        bedGain.gain.linearRampToValueAtTime(bedBase, t + 2);
      } catch (e) {}
    }
    // a passing wind gust — a swelling, sweeping whoosh of filtered noise
    function windGust(strength) {
      if (!ready || G.muted) return;
      try {
        const t = ctx.currentTime, dur = 2.4 + Math.random() * 1.8;
        const len = Math.max(1, (ctx.sampleRate * dur) | 0), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource(); n.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.55;
        f.frequency.setValueAtTime(330, t);
        f.frequency.linearRampToValueAtTime(640, t + dur * 0.4);
        f.frequency.linearRampToValueAtTime(360, t + dur);
        const g = ctx.createGain(), peak = 0.045 + clamp(strength || 0.5, 0, 1) * 0.06;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + dur * 0.42);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur);
      } catch (e) {}
    }
    // occasional wildlife call — flavoured by the lake you're on
    let venueId = "cove";
    function setVenue(id) { venueId = id || "cove"; }
    function ambientCall(night) {
      if (!ready || G.muted) return;
      try {
        const t = ctx.currentTime;
        if (venueId === "bayou") {
          // frog croaks + insect chatter — a warm swamp
          if (Math.random() < 0.6) { tone(150, t, 0.16, "sawtooth", 0.06, 120); tone(150, t + 0.2, 0.16, "sawtooth", 0.06, 118); }
          else for (let i = 0; i < 5; i++) tone(3200 + Math.random() * 800, t + i * 0.05, 0.03, "square", 0.015);
          return;
        }
        if (venueId === "highland" || (venueId === "deep" && !night)) {
          // a lonely loon wail carrying across open water
          tone(680, t, 0.6, "sine", 0.055, 900); tone(900, t + 0.5, 0.9, "sine", 0.05, 560); return;
        }
        if (venueId === "river" && !night) {
          // a killdeer-style trill over the current
          const base = 2000 + Math.random() * 500; for (let i = 0; i < 5; i++) tone(base + (i % 2 ? 180 : 0), t + i * 0.06, 0.05, "sine", 0.03); return;
        }
        if (night) { tone(720, t, 0.5, "sine", 0.05, 540); tone(560, t + 0.55, 0.75, "sine", 0.05, 430); }
        else { const base = 1700 + Math.random() * 900; for (let i = 0; i < 3; i++) tone(base + i * 130, t + i * 0.09, 0.08, "sine", 0.035, base + i * 130 + 220); }
      } catch (e) {}
    }
    // steady rain hiss (highpassed noise loop) faded in on rainy weather
    let rainBed = null, rainGain = null;
    function setRain(on) {
      if (!ready) return;
      try {
        const t = ctx.currentTime;
        if (on && !rainBed) {
          const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          rainBed = ctx.createBufferSource(); rainBed.buffer = buf; rainBed.loop = true;
          const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1600;
          rainGain = ctx.createGain(); rainGain.gain.setValueAtTime(0.0001, t); rainGain.gain.linearRampToValueAtTime(0.05, t + 1.6);
          rainBed.connect(f); f.connect(rainGain); rainGain.connect(master); rainBed.start();
        } else if (!on && rainBed) {
          const rb = rainBed, rg = rainGain; rainBed = null; rainGain = null;
          rg.gain.cancelScheduledValues(t); rg.gain.setValueAtTime(rg.gain.value, t); rg.gain.linearRampToValueAtTime(0.0001, t + 1.4);
          try { rb.stop(t + 1.6); } catch (e) {}
        }
      } catch (e) {}
    }
    function tone(freq, t0, dur, type, peak, slideTo) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
    }
    function noise(t0, dur, filtType, filtFreq, peak) {
      const len = Math.max(1, (ctx.sampleRate * dur) | 0), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = filtType || "lowpass"; f.frequency.value = filtFreq || 1000;
      const g = ctx.createGain(); g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      n.connect(f); f.connect(g); g.connect(master); n.start(t0); n.stop(t0 + dur);
    }
    function play(name) {
      if (!ready || G.muted) return;
      try {
        const t = ctx.currentTime;
        switch (name) {
          case "cast": noise(t, 0.3, "bandpass", 1800, 0.16); tone(900, t, 0.28, "sawtooth", 0.05, 1700); break;
          case "splash": noise(t, 0.34, "lowpass", 1400, 0.3); noise(t + 0.02, 0.22, "highpass", 2600, 0.12); break;
          case "twitch": tone(640, t, 0.06, "square", 0.05, 760); break;
          case "strike": tone(150, t, 0.42, "sine", 0.32, 70); noise(t, 0.4, "lowpass", 900, 0.28); break;
          case "perfect": [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.07, 0.26, "triangle", 0.16)); break;
          case "good": tone(660, t, 0.16, "triangle", 0.14); tone(990, t + 0.06, 0.18, "triangle", 0.12); break;
          case "weak": tone(320, t, 0.18, "sine", 0.12, 200); break;
          case "jump": noise(t, 0.3, "lowpass", 1700, 0.26); break;
          case "snap": tone(950, t, 0.12, "sawtooth", 0.2, 120); noise(t, 0.12, "highpass", 3000, 0.18); break;
          case "drag": {   // reel drag screaming as a big fish peels line
            const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
            o.type = "sawtooth"; o.frequency.setValueAtTime(430, t); o.frequency.linearRampToValueAtTime(370, t + 0.42);
            lfo.type = "square"; lfo.frequency.value = 34; lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency);   // buzzy vibrato
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
            o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45); lfo.start(t); lfo.stop(t + 0.45);
            noise(t, 0.4, "bandpass", 1300, 0.05);
            break;
          }
          case "land": [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.3, "triangle", 0.13)); break;
          case "lunker": [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.09, 0.46, "triangle", 0.15)); break;
          case "pb": {   // a bright rising fanfare — new personal best
            tone(330, t, 0.6, "sine", 0.07);
            [659, 988, 1319, 1760, 1976].forEach((f, i) => tone(f, t + 0.04 + i * 0.10, 0.42, "triangle", 0.16, f * 1.02));
            tone(2637, t + 0.5, 0.5, "sine", 0.07);
            break;
          }
          case "coin": tone(988, t, 0.08, "square", 0.09); tone(1319, t + 0.05, 0.12, "square", 0.09); break;
          case "ui": tone(520, t, 0.04, "sine", 0.05, 620); break;
          case "weighwin": {   // triumphant tournament win — bugle-style fanfare with a low swell
            tone(196, t, 1.1, "sine", 0.06);
            [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + 0.05 + i * 0.11, 0.34, "triangle", 0.15));
            noise(t + 0.02, 0.5, "highpass", 5000, 0.05); break;   // a shimmer of applause
          }
          case "weighin": {    // neutral weigh-in chime — the day's tally is in
            [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.12, 0.3, "triangle", 0.12));
            tone(392, t, 0.5, "sine", 0.05); break;
          }
        }
      } catch (e) {}
    }
    return { ensure, play, ambientCall, setMuted, setVolume, setNight, windGust, setVenue, setRain,
      ctxRef: () => { ensure(); return ctx; } };   // shared context — music must NOT open a second one (iOS crackles)
  })();
  const sfx = n => Sound.play(n);
  function anyModalOpen() {
    return [el.catchModal, el.failModal, el.lureModal, el.mapModal,
            el.tourStartModal, el.tourResultModal, el.recordsModal, el.rodModal, el.catchLogModal, el.statsModal, el.catchDetailModal, el.trophyModal, el.daySummaryModal, el.arcadeModal, el.titleScreen, el.lbModal, el.lbProfileModal, el.guideModal, el.anglerModal, el.garModal, el.soundModal, el.dailyModal, el.restoreModal, el.hostModal, el.garageModal, el.notifModal, el.proModal, el.replayModal, el.newsModal].some(m => !m.classList.contains("hidden"));
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

  // ===========================================================================
  // Soundtrack — audio files live in music/, listed in music/playlist.json:
  //   [{ "file": "song.mp3", "title": "Song", "artist": "…", "when": "title" }]
  // "when":"title" tracks loop on the main menu; the rest shuffle in-game.
  // Mobile browsers block audio until a tap, so playback arms on the first
  // pointerdown and follows the screen you're on from then on.
  // ===========================================================================
  const Music = (() => {
    let titleTracks = [], gameTracks = [], order = [], idx = 0, audio = null;
    let armed = false;              // a user gesture has happened — audio is allowed
    let scene = "title";            // which soundtrack the game wants right now
    let wantAuto = true;            // start the theme as part of page load, before any tap
    fetch("music/playlist.json" + (window.BB_V ? "?v=" + window.BB_V : ""))
      .then(r => (r.ok ? r.json() : []))
      .then(list => {
        const tracks = (Array.isArray(list) ? list : []).filter(t => t && t.file);
        titleTracks = tracks.filter(t => t.when === "title");
        gameTracks = tracks.filter(t => t.when !== "title");
        if (wantAuto) attemptAuto();
      })
      .catch(() => {});
    // music sits a step under the effects so it never buries them
    const TRIM = 0.8;
    function vol() { return (G.musicVol != null ? G.musicVol : 0.5) * TRIM; }
    // iOS makes HTMLMediaElement.volume read-only, so the slider must control a
    // WebAudio gain node instead — the element pipes through it where possible
    let mctx = null, mgain = null, msrc = null;
    function ensureGraph() {
      try {
        if (!audio) return;
        if (!mctx) {
          // share the SFX AudioContext — two live contexts make iOS crackle
          mctx = Sound.ctxRef ? Sound.ctxRef() : null;
          if (!mctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; mctx = new AC(); }
          mgain = mctx.createGain(); mgain.gain.value = vol();
          mgain.connect(mctx.destination);   // straight out — the mute button governs effects, not music
        }
        // only reroute the element through WebAudio once the context actually
        // runs — piping into a suspended context silences an autoplaying element.
        // resume() is async: attach the pipe the moment it lands, so the first
        // seconds never play through the raw (full-volume) element
        const attach = () => {
          if (msrc || !audio || mctx.state !== "running") return;
          msrc = mctx.createMediaElementSource(audio); msrc.connect(mgain);
          // the pipe usually lands moments after playback starts — come in on the
          // fade, never at full target
          try {
            mgain.gain.cancelScheduledValues(mctx.currentTime);
            mgain.gain.setValueAtTime(0.0001, mctx.currentTime);
            mgain.gain.setTargetAtTime(vol(), mctx.currentTime + 0.05, 0.9);
          } catch (e3) { mgain.gain.value = vol(); }
          try { audio.volume = 1; } catch (e4) {}
        };
        if (mctx.state === "suspended") { try { const p = mctx.resume(); if (p && p.then) p.then(attach).catch(() => {}); } catch (e2) {} }
        attach();
      } catch (e) {}
    }
    function applyVol() {
      if (mgain && msrc) {
        // piped: the gain node owns loudness, the element runs at unity
        try { mgain.gain.setTargetAtTime(vol(), mctx.currentTime, 0.03); } catch (e) { mgain.gain.value = vol(); }
        if (audio) try { audio.volume = 1; } catch (e) {}
      } else if (audio) {
        try { audio.volume = vol(); } catch (e) {}   // unpiped fallback (ignored on iOS)
      }
    }
    function ensureEl() {
      if (!audio) { audio = new Audio(); audio.addEventListener("ended", () => { if (!audio.loop) nextGame(); }); }
      ensureGraph();
      applyVol();
    }
    function shuffle() {
      order = gameTracks.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      idx = 0;
    }
    function playTrack(t, loop) {
      ensureEl();
      audio.loop = !!loop;
      audio.src = "music/" + t.file;
      // fade the track up gently from silence over ~3s — never louder than the
      // menu effects on the way in
      if (mgain && msrc) {
        try {
          mgain.gain.cancelScheduledValues(mctx.currentTime);
          mgain.gain.setValueAtTime(0.0001, mctx.currentTime);
          mgain.gain.setTargetAtTime(vol(), mctx.currentTime + 0.05, 0.9);
        } catch (e) {}
      } else {
        // unpiped element: JS-stepped fade (and start silent even where the
        // volume property is read-only, so a late pipe attach continues the ramp)
        try { audio.volume = 0; } catch (e) {}
        const t0 = Date.now();
        const fade = setInterval(() => {
          if (msrc || !audio) { clearInterval(fade); applyVol(); return; }
          const k = Math.min(1, (Date.now() - t0) / 2600);
          try { audio.volume = vol() * k; } catch (e) {}
          if (k >= 1) clearInterval(fade);
        }, 120);
      }
      audio.play().catch(() => {});
      if (t.title && !playTrack._did) { playTrack._did = true; toast(`🎵 ${t.title}${t.artist ? " — " + t.artist : ""}`); setTimeout(() => { playTrack._did = false; }, 4000); }
    }
    function nextGame() {
      if (!gameTracks.length) { if (audio) audio.pause(); return; }
      if (!order.length || idx >= order.length) shuffle();
      playTrack(gameTracks[order[idx++]], false);
    }
    // play whatever the current scene calls for (title theme loops; game shuffles)
    function sync() {
      if (!armed || G.musicOn === false) return;
      if (scene === "title" && titleTracks.length) playTrack(titleTracks[0], true);
      else if (scene === "game") { shuffle(); nextGame(); }
      else if (audio) audio.pause();
    }
    function setScene(s) { if (scene === s) return; scene = s; if (armed && G.musicOn !== false) sync(); }
    function onGesture() {
      if (!armed) { armed = true; sync(); }
      ensureGraph();   // the gesture lets the shared context run — attach the volume graph now
    }
    // boot-time autoplay: works where the browser allows it (desktop, PWA,
    // returning Safari sessions); everywhere else the first tap arms audio
    function attemptAuto() {
      if (armed || G.musicOn === false) return;
      if (!titleTracks.length) { wantAuto = true; return; }
      ensureEl();
      audio.loop = true;
      audio.preload = "auto";
      if (!audio.src) audio.src = "music/" + titleTracks[0].file;
      const p = audio.play();
      if (p && p.then) p.then(() => { armed = true; }).catch(() => {});
    }
    // keep knocking through the load window — some engines only allow playback
    // after the load event, after buffering, or on a visibility/focus change
    ["visibilitychange", "focus", "pageshow"].forEach(ev =>
      window.addEventListener(ev, () => { if (!armed) attemptAuto(); }));
    let autoTries = 0;
    const autoTimer = setInterval(() => {
      if (armed || G.musicOn === false || ++autoTries > 12) { clearInterval(autoTimer); return; }
      attemptAuto();
    }, 450);
    function setOn(on) {
      G.musicOn = on; save();
      if (on) { if (armed) sync(); else attemptAuto(); }
      else if (audio) audio.pause();
    }
    function setVolume() { applyVol(); }
    // any first interaction arms audio where autoplay was refused
    ["pointerdown", "touchstart", "keydown"].forEach(ev =>
      document.addEventListener(ev, onGesture, { capture: true, passive: true }));
    return { setScene, setOn, setVolume, tryAutoplay: attemptAuto };
  })();

  // ===========================================================================
  // GLOBAL LEADERBOARD — a free kvdb.io bucket, one key per angler plus a
  // player-maintained "_roster" index, readable by every copy of the game.
  // The board id ships in lb-config.json; until it's baked in, the modal
  // offers one-tap CREATE (runs from the player's browser) or JOIN with a
  // shared board code.
  // ===========================================================================
  const LB = (() => {
    let baked = "", bakedFb = "", rows = null, sortKey = "s";
    fetch("lb-config.json" + (window.BB_V ? "?v=" + window.BB_V : ""))
      .then(r => (r.ok ? r.json() : {}))
      .then(c => { baked = (c && c.bucket) || ""; bakedFb = (c && c.firebase) || ""; })
      .catch(() => {});
    const bucket = () => baked || G.lbBucket || "";
    const base = () => "https://kvdb.io/" + bucket() + "/";
    // a real database (Firebase RTDB) beats the anonymous key-store whenever
    // it's configured: one GET returns the whole board, writes are per-angler
    const fbOk = u => /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(u || "");
    const fb = () => { const u = (G.lbFb && fbOk(G.lbFb) ? G.lbFb : bakedFb) || ""; return u.replace(/\/+$/, ""); };
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    function pid() { if (!G.pid) { G.pid = "p" + Math.random().toString(36).slice(2, 10); save(); } return G.pid; }
    const nameKey = s => String(s == null ? "" : s).trim().toUpperCase();
    // one name = one angler: collapse duplicate names, keep the strongest entry
    // (an old phone resubmitting can't put a second "ROB" on any board)
    function dedupeNames(list, score) {
      const best = new Map();
      for (const e of list) {
        const k = nameKey(e.n != null ? e.n : e.name); if (!k) { best.set(Symbol(), e); continue; }
        const cur = best.get(k);
        if (!cur || score(e) > score(cur)) best.set(k, e);
      }
      return [...best.values()];
    }
    function biggest() { const v = Object.values(G.records || {}); return v.length ? Math.max(...v) : 0; }
    function topKey(o) { let k = null, m = 0; for (const key in (o || {})) { if (o[key] > m) { m = o[key]; k = key; } } return k; }
    // the full public profile — everyone on the board can browse everyone's stats
    function myEntry() {
      const t = G.tally || {}, ch = G.challenges || {};
      const top = (G.catchLog || []).slice().sort((x, y) => y.w - x.w).slice(0, 12)
        .map(e => ({ w: e.w, l: e.lure, sp: e.spot, se: e.season, wx: e.weather, h: Math.floor((e.timeMin || 0) / 60), sc: e.score || 0 }));
      return {
        n: G.name || "ANGLER", s: G.coins || 0, b: +biggest().toFixed(2), a: G.arcadeBestScore || 0, w: G.tourWins || 0, t: Date.now(),
        bw: (G.garage && G.garage.wrap) || "", bn: ((G.garage && G.garage.name) || "").slice(0, 14),
        st: {
          c: Object.values(G.caught || {}).reduce((s2, n2) => s2 + n2, 0),
          lk: G.lunkers || 0, bb: +(G.bestBag || 0).toFixed(2), ti: (G.season && G.season.titles) || 0,
          ac: G.arcadeClears || 0, ach: ACH.filter(x => ch[x.id]).length,
          ph: G.perfectHooks || 0, bd: G.bestDayCatches || 0, bc: G.bestCatchScore || 0,
        },
        fav: { l: topKey(t.lure), sp: topKey(t.spot) },
        top,
      };
    }
    let lastPush = 0, lastSent = "";
    function submit(force) {
      if (!bucket() || !G.name) return;
      const payload = JSON.stringify(myEntry());
      if (!force && payload === lastSent) return;
      if (!force && Date.now() - lastPush < 30000) return;
      lastPush = Date.now(); lastSent = payload;
      const id = pid();
      if (fb()) { fetch(fb() + "/board/" + id + ".json", { method: "PUT", body: payload }).catch(() => {}); return; }
      fetch(base() + id, { method: "PUT", body: payload })
        .then(() => getRoster())
        .then(ro => { if (!ro.includes(id)) return putRoster(ro.concat(id)); })
        .catch(() => {});
    }
    // The board never depends on kvdb's key-list endpoint (the one piece that
    // proved unreliable in the wild): the anglers maintain a tiny "_roster"
    // index key themselves, and every profile is read by direct key GET — the
    // primitives that demonstrably work. The list endpoint is only an extra
    // discovery pass so anglers on older game versions still get found.
    async function getJSON(url) {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      const t = await r.text();
      try { return JSON.parse(t); } catch (e) { return null; }
    }
    async function getRoster() {
      const v = await getJSON(base() + "_roster");
      return Array.isArray(v) ? v.filter(x => typeof x === "string" && /^p[a-z0-9]{4,20}$/.test(x)) : [];
    }
    function putRoster(list) {
      return fetch(base() + "_roster", { method: "PUT", body: JSON.stringify([...new Set(list)].slice(0, 500)) });
    }
    async function listPids() {
      try {
        const data = await getJSON(base() + "?format=json&limit=1000");
        const keys = Array.isArray(data)
          ? data.map(e => Array.isArray(e) ? e[0] : (e && typeof e === "object") ? (e.key != null ? e.key : e.k) : e)
          : (data && typeof data === "object") ? Object.keys(data) : [];
        return keys.filter(k => typeof k === "string" && /^p[a-z0-9]{4,20}$/.test(k));
      } catch (e) { return []; }
    }
    async function fetchAll() {
      const id = pid();
      if (fb()) {
        const r = await fetch(fb() + "/board.json");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const out = Object.entries(data || {}).map(([k, v]) => {
          try { if (typeof v === "string") v = JSON.parse(v); } catch (e) { return null; }
          if (!v || !v.n || !/^p[a-z0-9]{4,20}$/.test(k)) return null;
          v.id = k; return v;
        }).filter(Boolean);
        const mine = myEntry(); mine.id = id;
        const i = out.findIndex(o => o.id === mine.id);
        if (i >= 0) out[i] = mine; else if (G.name) out.push(mine);
        return dedupeNames(out, e => e.s || 0);
      }
      let roster = [], rosterErr = null;
      try { roster = await getRoster(); } catch (e) { rosterErr = e; }
      const extra = await listPids();
      if (rosterErr && !extra.length) throw rosterErr;   // board truly unreachable
      const all = [...new Set([...roster, ...extra, ...(G.name ? [id] : [])])];
      const got = await Promise.all(all.map(k =>
        getJSON(base() + k).then(v => { if (v && v.n) { v.id = k; return v; } return null; }).catch(() => null)));
      const out = got.filter(Boolean);
      // heal the roster so every angler we can see stays findable for everyone
      const knew = new Set(roster);
      if (!rosterErr && out.some(o => !knew.has(o.id))) putRoster(roster.concat(out.map(o => o.id))).catch(() => {});
      // fold our own latest numbers in — the PUT may still be in flight
      const mine = myEntry(); mine.id = id;
      const i = out.findIndex(o => o.id === mine.id);
      if (i >= 0) out[i] = mine; else if (G.name) out.push(mine);
      return dedupeNames(out, e => e.s || 0);
    }
    function codeFoot() {
      const via = fb() ? `⚡ live database` : `Board code: <b>${esc(bucket())}</b>`;
      return `<p class="muted" style="text-align:center;margin-top:10px;font-size:11px">${via}<br>Anyone on this game version is on this board automatically.
        <br><span id="lbDbLink" style="text-decoration:underline;cursor:pointer">⚙️ connect a database</span></p>`;
    }
    function renderDbSetup() {
      el.lbBody.innerHTML = `
        <p class="muted">Paste a Firebase Realtime Database URL (looks like <b>https://something-default-rtdb.firebaseio.com</b>). One player sets it up once — everyone lands on it.</p>
        <input id="lbFbUrl" class="clog-sel" style="width:100%;margin-bottom:8px" type="url" inputmode="url"
               placeholder="https://…firebaseio.com" autocomplete="off" value="${esc(G.lbFb || "")}">
        <div style="display:flex;gap:8px">
          <button class="big-btn" id="lbFbSave" style="flex:1">🔌 CONNECT</button>
          <button class="item-btn owned" id="lbFbCancel" style="flex:0 0 auto">CANCEL</button>
        </div>`;
    }
    function render() {
      if (!bucket()) { renderSetup(); return; }
      if (!rows) { el.lbBody.innerHTML = `<p class="muted" style="text-align:center">Casting out to the board…</p>`; return; }
      if (!rows.length) { el.lbBody.innerHTML = `<p class="muted" style="text-align:center">Nobody on the board yet — go catch one!</p>` + codeFoot(); return; }
      const key = sortKey;
      const fmtV = key === "b" ? v => (v || 0).toFixed(1) + " lb" : v => (v || 0).toLocaleString();
      const sorted = rows.slice().sort((x, y) => (y[key] || 0) - (x[key] || 0));
      // the community at a glance, pooled from every angler's public profile
      const commTotal = rows.reduce((s2, o) => s2 + ((o.st && o.st.c) || 0), 0);
      const commBig = Math.max(...rows.map(o => +o.b || 0), 0);
      const comm = `<p class="muted" style="text-align:center;font-size:11px;margin:0 0 8px">🌎 ${rows.length} angler${rows.length > 1 ? "s" : ""} · ${commTotal.toLocaleString()} bass boated · biggest ${commBig.toFixed(1)} lb<br>tap an angler for their full stats</p>`;
      el.lbBody.innerHTML = comm + sorted.map((o, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
        return `<div class="lb-row ${o.id === G.pid ? "me" : ""}" data-pid="${esc(o.id)}">
          <b class="lb-r">${medal}</b>
          <div class="lb-n">${(window.__isWeekChamp && window.__isWeekChamp(o.n)) ? "👑 " : ""}${esc(o.n)}${/^#[0-9a-f]{6}$/i.test(o.bw || "") ? `<i class="cdot" style="background:${o.bw}"></i>` : ""}<small>${o.bn ? esc(o.bn) + " · " : ""}🎯 ${(o.s || 0).toLocaleString()} · 🏅 ${(+o.b || 0).toFixed(1)} lb · 🕹️ ${(o.a || 0).toLocaleString()}</small></div>
          <b class="lb-v">${fmtV(o[key])}</b></div>`;
      }).join("") + codeFoot();
    }
    // ---- public angler profile: stats grid + favourites + sortable best catches ----
    let profRows = [], profSort = "w";
    function openProfile(o) {
      if (!o) return;
      el.lbpName.textContent = `🎣 ${o.n || "ANGLER"}`;
      const st = o.st || {};
      const tiles = [
        ["🎯", "Angler score", (o.s || 0).toLocaleString()],
        ["🏅", "Biggest bass", o.b ? (+o.b).toFixed(1) + " lb" : "—"],
        ["🕹️", "Arcade best", o.a ? (o.a).toLocaleString() : "—"],
        ["🐟", "Bass caught", st.c != null ? st.c.toLocaleString() : "—"],
        ["💪", "Lunkers", st.lk != null ? st.lk : "—"],
        ["🪣", "Best livewell", st.bb ? st.bb.toFixed(2) + " lb" : "—"],
        ["🏁", "Tourney wins", o.w || 0],
        ["👑", "Titles", st.ti != null ? st.ti : "—"],
        ["🏆", "Achievements", st.ach != null ? `${st.ach}/${ACH.length}` : "—"],
      ];
      el.lbpStats.innerHTML = tiles.map(([i, l, v]) =>
        `<div class="rec-stat"><div class="rs-ico">${i}</div><div class="rs-v">${v}</div><div class="rs-l">${l}</div></div>`).join("");
      const favL = o.fav && LURES.find(x => x.id === o.fav.l), favS = o.fav && SPOTS.find(x => x.id === o.fav.sp);
      const bits = [];
      if (favL) bits.push(`❤️ Go-to lure: ${favL.ico} ${favL.name}`);
      if (favS) bits.push(`🗺️ Home water: ${favS.ico} ${favS.name}`);
      if (st.ph) bits.push(`✨ ${st.ph} perfect hooksets`);
      if (st.bd) bits.push(`🔥 best day: ${st.bd} bass`);
      el.lbpFav.innerHTML = bits.map(x => `<span>${x}</span>`).join("");
      profRows = Array.isArray(o.top) ? o.top.filter(e => e && e.w) : [];
      profSort = "w";
      el.lbpSorts.querySelectorAll(".clog-sbtn").forEach(x => x.classList.toggle("active", x.dataset.lbps === "w"));
      renderProfCatches();
      el.lbProfileModal.classList.remove("hidden");
    }
    function renderProfCatches() {
      if (!profRows.length) { el.lbpList.innerHTML = `<p class="muted" style="text-align:center">No catches shared yet.</p>`; return; }
      const rowsS = profRows.slice().sort((x, y) => (y[profSort] || 0) - (x[profSort] || 0));
      el.lbpList.innerHTML = rowsS.map(e => {
        const l = LURES.find(x => x.id === e.l), sp = SPOTS.find(x => x.id === e.sp);
        const wx = WEATHER[e.wx], sea = SEASONS[e.se];
        const bits = [sea ? sea.ico + " " + sea.name : "", wx ? wx.ico + " " + wx.name : "", e.h != null ? fmtClock(e.h * 60) : ""].filter(Boolean).join(" · ");
        return `<div class="lb-row" style="cursor:default">
          <b class="lb-r">${l ? l.ico : "🎣"}${sp ? sp.ico : ""}</b>
          <div class="lb-n">${(+e.w).toFixed(2)} lb${l ? " · " + esc(l.name) : ""}<small>${bits}</small></div>
          <b class="lb-v">🎯 ${(e.sc || 0).toLocaleString()}</b></div>`;
      }).join("");
    }
    el.lbpClose.addEventListener("click", () => el.lbProfileModal.classList.add("hidden"));
    el.lbpSorts.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lbps]"); if (!b) return;
      profSort = b.dataset.lbps; sfx("ui");
      el.lbpSorts.querySelectorAll(".clog-sbtn").forEach(x => x.classList.toggle("active", x === b));
      renderProfCatches();
    });
    function renderSetup() {
      el.lbBody.innerHTML = `
        <p class="muted">No global board is linked yet. Create it once — every player lands on the same rankings.</p>
        <input id="lbEmail" class="clog-sel" style="width:100%;margin-bottom:8px" type="email" inputmode="email"
               placeholder="your email (goes only to kvdb.io)" autocomplete="email">
        <button class="big-btn" id="lbCreate">🌎 CREATE THE GLOBAL BOARD</button>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input id="lbJoin" class="clog-sel" style="flex:1" placeholder="…or paste a board code" autocomplete="off">
          <button class="item-btn owned" id="lbJoinBtn" style="flex:0 0 auto">JOIN</button>
        </div>`;
    }
    async function create() {
      // kvdb.io requires an email on bucket creation (their service, their record —
      // it is sent only to kvdb.io, never stored in the game or the repo)
      const email = (document.getElementById("lbEmail").value || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Enter an email for the board service ✉️"); return; }
      el.lbBody.innerHTML = `<p class="muted" style="text-align:center">Setting up the board…</p>`;
      try {
        const r = await fetch("https://kvdb.io", { method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "email=" + encodeURIComponent(email) });
        if (!r.ok) throw new Error("HTTP " + r.status + " — " + (await r.text()).slice(0, 80));
        const id = (await r.text()).trim();
        if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new Error("unexpected reply: " + id.slice(0, 40));
        G.lbBucket = id; save();
        toast("🌎 Global board created!");
        refresh();
      } catch (e) {
        el.lbBody.innerHTML = `<p class="muted" style="text-align:center">Couldn't set up the board — ${esc((e && e.message) || "network error")}.<br>Check your connection and try again.</p>`;
        setTimeout(renderSetup, 2600);
      }
    }
    async function refresh() {
      rows = null; render();
      if (!bucket()) return;
      submit(true);
      try { rows = await fetchAll(); }
      catch (e) {
        rows = null;
        el.lbBody.innerHTML = `<p class="muted" style="text-align:center">Couldn't read the board — ${esc((e && e.message) || "network error")}.</p>
          <button class="big-btn" id="lbRetry">↻ TRY AGAIN</button>` + codeFoot();
        return;
      }
      render();
    }
    function open() { el.lbModal.classList.remove("hidden"); try { if (typeof computeWeekChamp === "function") computeWeekChamp(); } catch (e) {} refresh(); }
    el.lbClose.addEventListener("click", () => el.lbModal.classList.add("hidden"));
    el.lbSorts.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lbsort]"); if (!b) return;
      sortKey = b.dataset.lbsort; sfx("ui");
      el.lbSorts.querySelectorAll(".clog-sbtn").forEach(x => x.classList.toggle("active", x === b));
      render();
    });
    el.lbBody.addEventListener("click", (e) => {
      if (e.target.closest("#lbCreate")) { sfx("ui"); create(); return; }
      if (e.target.closest("#lbRetry")) { sfx("ui"); refresh(); return; }
      if (e.target.closest("#lbDbLink")) { sfx("ui"); renderDbSetup(); return; }
      if (e.target.closest("#lbFbCancel")) { sfx("ui"); refresh(); return; }
      if (e.target.closest("#lbFbSave")) {
        const v = (document.getElementById("lbFbUrl").value || "").trim().replace(/\/+$/, "");
        if (!fbOk(v)) { toast("That doesn't look like a Firebase URL 🤔"); return; }
        G.lbFb = v; save(); sfx("good"); toast("🔌 Database connected!"); refresh(); return;
      }
      if (e.target.closest("#lbJoinBtn")) {
        const v = (document.getElementById("lbJoin").value || "").trim();
        if (v) { G.lbBucket = v; save(); sfx("good"); refresh(); }
        return;
      }
      const row = e.target.closest(".lb-row[data-pid]");
      if (row && rows) { sfx("ui"); openProfile(rows.find(o => o.id === row.dataset.pid)); }
    });
    lbSubmitHook = submit;
    return { open, submit, fb, pid, dedupeNames, nameKey };
  })();

  function updateHUD() {
    el.coins.textContent = G.coins;
    if (el.muteBtn) el.muteBtn.textContent = (G.muted && G.musicOn === false) ? "🔇" : "🔊";
    el.rodName.textContent = rod().name;
    el.spotName.textContent = spot().name;
    el.posName.textContent = position().name;
    const lu = lure();
    el.lureIco.textContent = lu.ico;
    el.lureName.textContent = lu.name.split(" ")[lu.name.split(" ").length - 1];
    el.lureSwatch.style.background = COLORS[G.lure.color].hex;
    renderConditions();
  }

  // ---- Tournament circuit ----
  // A circuit of events on the three lakes. Pick one, set your tackle from the
  // (fully unlocked) box, then fish it. No entry fee — it's all about the bag.
  const TOURNAMENTS = [
    { id: "cove-open",     spot: "cove",  name: "Lily Cove Open",          dur: 150000, field: 8,
      blurb: "A numbers game in the pads — boat five solid largemouth fast." },
    { id: "cove-shootout", spot: "cove",  name: "Cove Twilight Shootout",  dur: 150000, field: 10,
      blurb: "Low-light bite. Big girls slide up to the cover at dusk." },
    { id: "river-classic", spot: "river", name: "Boulder River Classic",   dur: 180000, field: 10,
      blurb: "Clear current and hard-fighting bass on the rock." },
    { id: "river-pro",     spot: "river", name: "Boulder River Pro-Am",    dur: 180000, field: 12,
      blurb: "Stingy clear water — match the hatch or go home empty." },
    { id: "trophy-champ",  spot: "deep",  name: "Trophy Lake Championship",dur: 210000, field: 12,
      blurb: "Big-fish water. One double-digit kicker can win it all." },
    { id: "trophy-invite", spot: "deep",  name: "Trophy Lake Invitational",dur: 210000, field: 14,
      blurb: "The deepest, darkest water — only the giants live here." },
  ];
  let pendingTour = null;   // the event chosen but not yet started

  // ===========================================================================
  // ARCADE MODE — faithful Get Bass: 4 stages at different lakes & times of day,
  // a weight quota per stage inside a hard timer, time EXTENSIONS for every fish
  // landed (bigger = more) and for making it jump, unlimited continues that raise
  // the quota 2 lb, and a finale where the quota is ONE giant bass.
  // ===========================================================================
  const ARCADE_STAGES = [
    { spot: "cove",  pos: "pads", timeMin: 6 * 60 + 15,  weather: "sun",   quota: 6,  dur: 150000, name: "Lily Cove",     sub: "Dawn" },
    { spot: "river", pos: "pool", timeMin: 12 * 60 + 30, weather: "sun",   quota: 9,  dur: 150000, name: "Boulder River", sub: "High Noon" },
    { spot: "bayou", pos: "pads", timeMin: 18 * 60 + 40, weather: "cloud", quota: 12, dur: 150000, name: "Cypress Bayou", sub: "Dusk" },
    { spot: "deep",  pos: "hole", timeMin: 22 * 60,      weather: "night", quota: 0,  dur: 130000, name: "Trophy Lake",   sub: "THE LUNKER", oneFish: 6 },
  ];
  const fmtT = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  function startArcade() {
    if (S.tournament && !S.tournament.ended) { toast("Tournament in progress ⏱️"); return; }
    if (S.arcade && !S.arcade.ended) { toast("Arcade run in progress 🕹️"); return; }
    if (S.tut) { S.tut = null; el.tutBanner.classList.add("hidden"); }
    dropPausedRuns();
    S.dayStarted = true;
    Music.setScene("game");   // in case we arrived via a menu deep-link with the theme still on
    el.modeModal.classList.add("hidden");
    S.arcadePrev = { spot: G.spot };
    S.arcade = { stage: 0, timeLeft: 0, bag: 0, quota: 0, bump: 0, continues: 0, score: 0, ended: false };
    el.arcadeHud.classList.remove("hidden");
    setupArcadeStage();
    save();
  }
  function setupArcadeStage() {
    const A = S.arcade, st = ARCADE_STAGES[A.stage];
    if (A.stage === 3) G.arcadeFinale = true;   // made it to the Trophy Lake lunker hunt
    G.spot = st.spot; G.positions[st.spot] = st.pos;
    S.cond.weather = st.weather; S.cond.timeMin = st.timeMin; S.cond.front = 0;
    S.cond.hotLure = LURES[Math.floor(Math.random() * LURES.length)].id;   // fresh pattern each stage
    S.holdBearing = rnd(-1.0, 1.0); S.heading = 0; S.headingTarget = 0;
    recomputeCond(); renderConditions();
    A.timeLeft = st.dur; A.bag = 0; A.bump = 0; A.quota = st.quota; A._hurry = false;
    seedFish(); resetToIdle(); updateHUD(); renderArcadeHud();
    toast(`🕹️ STAGE ${A.stage + 1}/4 — ${st.name} · ${st.sub}<br><small>${st.oneFish ? `Land ONE ${st.oneFish} lb+ bass!` : `Boat ${A.quota} lb of bass!`}</small>`);
    sfx("good");
  }
  function renderArcadeHud() {
    const A = S.arcade; if (!A) return;
    const st = ARCADE_STAGES[A.stage];
    el.arcTimer.textContent = fmtT(A.timeLeft);
    el.arcTimer.parentElement.classList.toggle("low", A.timeLeft <= 20000);
    el.arcStage.textContent = `S${A.stage + 1}/4`;
    if (st.oneFish) { el.arcQuota.textContent = `ONE ${st.oneFish} lb+`; el.arcFill.style.width = "0%"; }
    else { el.arcQuota.textContent = `${A.bag.toFixed(1)}/${A.quota} lb`; el.arcFill.style.width = Math.min(100, A.bag / A.quota * 100) + "%"; }
  }
  function updateArcadeClock(dt) {
    const A = S.arcade; if (!A || A.ended) return;
    if (anyModalOpen()) return;
    A.timeLeft -= dt;
    if (A.timeLeft <= 15000 && !A._hurry) { A._hurry = true; toast("⏰ HURRY UP!"); sfx("weak"); vibrate([40, 60, 40]); }
    if (A.timeLeft <= 0) { A.timeLeft = 0; renderArcadeHud(); arcadeTimeUp(); return; }
    renderArcadeHud();
  }
  // a landed fish in arcade: score it (stage multiplier), extend the clock, check the quota
  function arcadeLand(f) {
    const A = S.arcade, st = ARCADE_STAGES[A.stage];
    checkCatchChallenges(f);
    f.score = Math.round(f.score * (1 + A.stage * 0.25) / 10) * 10;   // later stages pay more
    A.score += f.score; G.coins += f.score; addAnglerXP(f.score);
    let bonus = 8000 + Math.round(f.weight * 2500);                    // every fish buys time
    const jumps = (S.ft && S.ft.jumps) || 0;
    if (jumps) bonus += Math.min(3, jumps) * 3000;                     // made it jump — style time
    A.timeLeft += bonus;
    vibrate([20, 40, 30]);
    if (st.oneFish) {
      if (f.weight >= st.oneFish) { arcadeStageClear(f); return; }
      toast(`🐟 ${f.weight} lb — need ${st.oneFish} lb+!<br><small>⏱ +${fmtT(bonus)}${jumps ? " · 🎏 jump bonus" : ""} · 🎯 +${f.score}</small>`);
    } else {
      A.bag += f.weight;
      if (A.bag >= A.quota) { renderArcadeHud(); arcadeStageClear(f); return; }
      toast(`🐟 ${f.weight} lb — ${A.bag.toFixed(1)}/${A.quota} lb<br><small>⏱ +${fmtT(bonus)}${jumps ? " · 🎏 jump bonus" : ""} · 🎯 +${f.score}</small>`);
    }
    renderArcadeHud();
    resetToIdle();
  }
  function arcadeStageClear(f) {
    const A = S.arcade, st = ARCADE_STAGES[A.stage], last = A.stage >= ARCADE_STAGES.length - 1;
    S.mode = "idle"; showBtn(false);
    sfx(last ? "pb" : "weighwin"); vibrate([30, 60, 30, 60, 60]);
    if (last) { arcadeEnd(true); return; }
    el.arcadeTitle.textContent = "🏁 STAGE CLEAR!";
    el.arcadeBody.innerHTML =
      `<p class="muted" style="text-align:center">${st.name} — ${st.sub}</p>
      <div class="rec-stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="rec-stat"><div class="rs-ico">🪣</div><div class="rs-v">${st.oneFish ? f.weight.toFixed(1) : A.bag.toFixed(1)} lb</div><div class="rs-l">Bagged</div></div>
        <div class="rec-stat"><div class="rs-ico">⏱</div><div class="rs-v">${fmtT(A.timeLeft)}</div><div class="rs-l">Time left</div></div>
        <div class="rec-stat"><div class="rs-ico">🎯</div><div class="rs-v">${A.score.toLocaleString()}</div><div class="rs-l">Score</div></div>
      </div>`;
    el.arcadeGo.textContent = `NEXT: ${ARCADE_STAGES[A.stage + 1].name} · ${ARCADE_STAGES[A.stage + 1].sub}`;
    el.arcadeGo.dataset.act = "next";
    el.arcadeAlt.classList.add("hidden");
    el.arcadeModal.classList.remove("hidden");
  }
  function arcadeTimeUp() {
    const A = S.arcade;
    S.mode = "idle"; showBtn(false);
    el.fightPanel.classList.add("hidden"); el.retrievePanel.classList.add("hidden"); el.castMeter.classList.add("hidden");
    sfx("snap"); vibrate(120);
    const st = ARCADE_STAGES[A.stage];
    el.arcadeTitle.textContent = "⏰ TIME UP!";
    el.arcadeBody.innerHTML =
      `<p class="muted" style="text-align:center">Stage ${A.stage + 1} — ${st.name}: ${st.oneFish ? `no ${st.oneFish} lb+ bass` : `${A.bag.toFixed(1)} of ${A.quota} lb`}</p>
      <p class="muted" style="text-align:center">Continue? ${st.oneFish ? "The lunker is still out there." : "The quota goes up 2 lb — just like the cabinet."}</p>`;
    el.arcadeGo.textContent = st.oneFish ? "🕹️ CONTINUE" : "🕹️ CONTINUE (+2 lb quota)";
    el.arcadeGo.dataset.act = "continue";
    el.arcadeAlt.classList.remove("hidden");
    el.arcadeModal.classList.remove("hidden");
  }
  function arcadeEnd(cleared) {
    const A = S.arcade;
    A.ended = true;
    G.arcadeBestScore = Math.max(G.arcadeBestScore || 0, A.score);
    if (cleared) { G.arcadeClears = (G.arcadeClears || 0) + 1; if (!A.continues) G.arcadeNC = true; }
    evalAchievements(false);
    el.arcadeTitle.textContent = cleared ? "🏆 GAME CLEAR!" : "🕹️ GAME OVER";
    el.arcadeBody.innerHTML =
      `<p class="muted" style="text-align:center">${cleared ? "All four stages — the lunker is yours!" : `Made it to stage ${A.stage + 1} of 4`}</p>
      <div class="rec-stats" style="grid-template-columns:repeat(2,1fr)">
        <div class="rec-stat"><div class="rs-ico">🎯</div><div class="rs-v">${A.score.toLocaleString()}</div><div class="rs-l">Arcade score</div></div>
        <div class="rec-stat"><div class="rs-ico">🕹️</div><div class="rs-v">${A.continues}</div><div class="rs-l">Continues</div></div>
      </div>` +
      (cleared && !A.continues ? `<p style="text-align:center;color:var(--gold);font-weight:900">🎖️ ONE-CREDIT CLEAR!</p>` : "");
    el.arcadeGo.textContent = "BACK TO THE LAKE";
    el.arcadeGo.dataset.act = "exit";
    el.arcadeAlt.classList.add("hidden");
    el.arcadeModal.classList.remove("hidden");
    save(); updateHUD();
    if (lbSubmitHook) lbSubmitHook(true);   // fresh arcade best goes straight to the global board
  }
  function exitArcade() {
    const prev = S.arcadePrev || {};
    S.arcade = null; S.arcadePrev = null;
    el.arcadeHud.classList.add("hidden");
    if (prev.spot) G.spot = prev.spot;
    rollConditions(); seedFish(); resetToIdle(); save(); updateHUD();
  }
  el.arcadeModal && el.arcadeModal.addEventListener("click", (e) => {
    const go = e.target.closest("#arcadeGo"), alt = e.target.closest("#arcadeAlt");
    if (alt) { el.arcadeModal.classList.add("hidden"); arcadeEnd(false); return; }
    if (!go) return;
    el.arcadeModal.classList.add("hidden");
    const act = el.arcadeGo.dataset.act, A = S.arcade;
    sfx("ui");
    if (act === "next") { A.stage++; setupArcadeStage(); }
    else if (act === "continue") {
      const st = ARCADE_STAGES[A.stage];
      A.continues++; if (!st.oneFish) { A.bump += 2; A.quota = st.quota + A.bump; }
      A.timeLeft = st.dur; A._hurry = false;
      renderArcadeHud(); resetToIdle();
      toast(`🕹️ CREDIT IN — ${st.oneFish ? "go get that lunker" : A.quota + " lb to beat now"}!`);
    }
    else exitArcade();
  });

  // ===========================================================================
  // ANGLER STABLE — selectable characters built from the crew's real photos.
  // Each has specialties; angler score earned while playing them is their XP,
  // and specialists level their strong suits faster. Levels feed real mechanics
  // (hookset window, finesse bites, fight strain, cast forgiveness, fish sense).
  // ===========================================================================
  const SKILLS = {
    hookset: { ico: "🪝", name: "Hookset" },
    finesse: { ico: "🪶", name: "Finesse" },
    power:   { ico: "💪", name: "Power" },
    casting: { ico: "🎯", name: "Casting" },
    sense:   { ico: "🧭", name: "Fish Sense" },
  };
  const ANGLERS = [
    // every base kit totals 18 — nobody is flatly better, just built different
    { id: "bubba",    name: "Bubba",       tag: "The Hoss",       desc: "Heavy line, heavy cover — winches 'em out like a tow truck.",
      w: { hookset: 1.2, finesse: 0.5, power: 1.6, casting: 0.8, sense: 1.0 }, hue: "#7a4a2a",
      base: { hookset: 50, finesse: 10, power: 60, casting: 20, sense: 40 } },
    { id: "alisa",    name: "Alisa",       tag: "The Natural",    desc: "Light line, soft landings — the fish never know she's there.",
      w: { hookset: 1.0, finesse: 1.6, power: 0.6, casting: 1.0, sense: 1.3 }, hue: "#7a4a8f",
      base: { hookset: 30, finesse: 60, power: 10, casting: 30, sense: 50 } },
    { id: "roberto",  name: "Roberto",     tag: "The Captain",    desc: "Steady hand, no weak suit — the boat's in good hands.",
      w: { hookset: 1.05, finesse: 1.05, power: 1.05, casting: 1.05, sense: 1.05 }, hue: "#5d7a45",
      base: { hookset: 40, finesse: 30, power: 40, casting: 40, sense: 30 } },
    { id: "hotrod",   name: "Hot Rod",     tag: "Full Throttle",  desc: "Big swings and long bombs — subtle is for other people.",
      w: { hookset: 1.0, finesse: 0.6, power: 1.5, casting: 1.3, sense: 0.8 }, hue: "#8f3b2c",
      base: { hookset: 30, finesse: 10, power: 60, casting: 50, sense: 30 } },
    { id: "wildwest", name: "Wild West",   tag: "The Gunslinger", desc: "Fastest cast in the county — dares any target, hits most.",
      w: { hookset: 1.2, finesse: 0.7, power: 1.1, casting: 1.5, sense: 0.7 }, hue: "#a4762c",
      base: { hookset: 40, finesse: 20, power: 40, casting: 60, sense: 20 } },
    { id: "drg",      name: "Dr. G",       tag: "The Surgeon",    desc: "Light line, small baits, hooksets like sutures.",
      w: { hookset: 1.4, finesse: 1.5, power: 0.6, casting: 0.9, sense: 1.0 }, hue: "#3f8f6a",
      base: { hookset: 60, finesse: 60, power: 10, casting: 30, sense: 20 } },
    { id: "jpbasser", name: "J.P. Basser", tag: "The Pro",        desc: "Reads water like a tournament sheet — always on fish.",
      w: { hookset: 1.1, finesse: 1.1, power: 0.9, casting: 1.0, sense: 1.4 }, hue: "#39557f",
      base: { hookset: 40, finesse: 40, power: 20, casting: 30, sense: 50 } },
    { id: "olddog",   name: "Old Dog",     tag: "The Veteran",    desc: "Seen every trick a bass has. Slow, sure, never fooled.",
      w: { hookset: 1.3, finesse: 1.2, power: 0.7, casting: 0.7, sense: 1.5 }, hue: "#6b5a44",
      base: { hookset: 50, finesse: 40, power: 10, casting: 20, sense: 60 } },
  ];
  const angler = () => ANGLERS.find(a => a.id === G.angler) || ANGLERS[0];
  const anglerXP = id => (G.anglerXP || {})[id] || 0;
  function addAnglerXP(pts) {
    if (!pts) return;
    if (!G.anglerXP) G.anglerXP = {};
    G.anglerXP[angler().id] = (G.anglerXP[angler().id] || 0) + pts;
  }
  // level-up economy: every 2,000 XP fished as an angler earns them a skill
  // point, plus a bonus point for each achievement won in their boat. Points
  // are spent by hand on any category (cap 10) — the player builds the angler.
  const SP_PER = 2000;
  const upSpent = id => { const u = (G.anglerUp || {})[id] || {}; return Object.values(u).reduce((s2, n) => s2 + n, 0); };
  const spEarned = id => Math.floor(anglerXP(id) / SP_PER) + ((G.anglerAchSP || {})[id] || 0);
  const spAvail = id => Math.max(0, spEarned(id) - upSpent(id));
  const skillLvl = (a, k) => Math.min(100, (a.base[k] || 0) + (((G.anglerUp || {})[a.id] || {})[k] || 0));
  const skill = k => skillLvl(angler(), k) / 100;   // 0..1 bonus strength right now
  function grantAchSP() {
    if (!G.anglerAchSP) G.anglerAchSP = {};
    G.anglerAchSP[angler().id] = (G.anglerAchSP[angler().id] || 0) + 1;
  }
  function spendSP(id, k) {
    const a = ANGLERS.find(x => x.id === id); if (!a) return;
    if (spAvail(id) <= 0 || skillLvl(a, k) >= 100) return;
    if (!G.anglerUp) G.anglerUp = {};
    if (!G.anglerUp[id]) G.anglerUp[id] = {};
    G.anglerUp[id][k] = (G.anglerUp[id][k] || 0) + 1;
    save();
  }
  // sense finds fish anywhere; finesse pays off on small (and lightly on medium) baits
  function anglerBiteMul() {
    const fin = (G.lure.size || "med") === "small" ? 1 : (G.lure.size || "med") === "med" ? 0.35 : 0;
    return (1 + skill("sense") * 0.15) * (1 + skill("finesse") * 0.22 * fin);
  }

  // ---- portraits: same barn-wood template the Guide set; anglers without a
  // photo yet get a mystery-silhouette card until their real face lands
  const FACES = {
    bubba: P => `
      <path d="M12,120 C14,94 32,82 46,80 L74,80 C88,82 106,94 108,120 Z" fill="#b6322b" stroke="#8f2822" stroke-width="1"/>
      <!-- denim overall straps over the red tee -->
      <path d="M30,120 L36,84 L48,88 L44,120 Z" fill="#3b5372" stroke="#2c405a" stroke-width="1"/>
      <path d="M90,120 L84,84 L72,88 L76,120 Z" fill="#3b5372" stroke="#2c405a" stroke-width="1"/>
      <circle cx="42" cy="92" r="2.4" fill="#c9ced4"/><circle cx="78" cy="92" r="2.4" fill="#c9ced4"/>
      <path d="M52,66 L68,66 L67,84 L53,84 Z" fill="#d1a075"/>
      <ellipse cx="37.5" cy="52" rx="4.4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="82.5" cy="52" rx="4.4" ry="6" fill="url(#${P}skin)"/>
      <path d="M38,42 Q38,23 60,23 Q82,23 82,42 L82,52 Q82,71 60,74 Q38,71 38,52 Z" fill="url(#${P}skin)"/>
      <!-- the big auburn beard -->
      <path d="M38,50 Q37,74 45,83 Q52,91 60,91 Q68,91 75,83 Q83,74 82,50 L82,56 Q83,76 73,84 Q66,89 60,89 Q54,89 47,84 Q37,76 38,56 Z" fill="#8a5a2e"/>
      <path d="M39,52 Q39,74 47,81 Q53,88 60,88 Q67,88 73,81 Q81,74 81,52 Q81,60 78,67 Q75,59 72,57 L67,61 Q63,58 60,58 Q57,58 53,61 L48,57 Q45,59 42,67 Q39,60 39,52 Z" fill="#9a6836"/>
      <path d="M54,68 Q60,72 66,68 L66,71 Q60,75 54,71 Z" fill="#6e4522"/>
      <!-- camo trucker cap -->
      <path d="M36,40 Q38,18 60,18 Q82,18 84,40 L84,44 L36,44 Z" fill="#5c6844"/>
      <path d="M42,32 q4,-4 8,0 q4,4 8,0 M58,26 q4,-4 8,0 M66,34 q4,-4 8,0" stroke="#46523a" stroke-width="3" fill="none" opacity=".8"/>
      <path d="M32,42 Q60,36 88,42 L88,47 Q60,41 32,47 Z" fill="#4a5638"/>
      <path d="M36,44 L84,44 L84,40 Q60,46 36,40 Z" fill="#e8e4da" opacity=".25"/>
      <path d="M50,52 q4,-2.4 8,0 M62,52 q4,-2.4 8,0" stroke="#4a3018" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="54" cy="55" r="1.8" fill="#241a12"/><circle cx="66" cy="55" r="1.8" fill="#241a12"/>
      <path d="M59,55 q2,6 0,8.5 q-2,1.2 -3,0" stroke="#b98a63" stroke-width="1.2" fill="none"/>
      <ellipse cx="45" cy="61" rx="3" ry="2" fill="#c98a66" opacity=".5"/><ellipse cx="75" cy="61" rx="3" ry="2" fill="#c98a66" opacity=".5"/>`,
    alisa: P => `
      <path d="M14,120 C16,96 34,84 46,81 L74,81 C88,84 104,96 106,120 Z" fill="#8a6fa8" stroke="#6e5589" stroke-width="1"/>
      <path d="M48,81 Q60,90 72,81 L72,86 Q60,94 48,86 Z" fill="#6e5589"/>
      <path d="M52,81 L60,92 L68,81 L64,79 L60,84 L56,79 Z" fill="#f0eaf6"/>
      <!-- long dark hair down both sides, ponytail behind the shoulder -->
      <path d="M38,44 Q34,70 36,96 Q40,102 46,100 Q42,74 44,52 Z" fill="#3a2b22"/>
      <path d="M82,44 Q86,70 84,96 Q80,102 74,100 Q78,74 76,52 Z" fill="#3a2b22"/>
      <path d="M84,60 Q94,76 90,98 Q86,104 82,100 Q86,80 80,64 Z" fill="#31241c"/>
      <path d="M52,66 L68,66 L67,84 L53,84 Z" fill="#d1a075"/>
      <ellipse cx="38.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M40,42 Q40,24 60,24 Q80,24 80,42 L80,52 Q80,70 60,73 Q40,70 40,52 Z" fill="url(#${P}skin)"/>
      <!-- soft hair line under the cap -->
      <path d="M40,44 Q42,34 50,31 Q44,40 44,50 Z" fill="#3a2b22"/>
      <path d="M80,44 Q78,34 70,31 Q76,40 76,50 Z" fill="#3a2b22"/>
      <!-- sage cap, low brim -->
      <path d="M38,40 Q40,20 60,20 Q80,20 82,40 L82,44 L38,44 Z" fill="#9db08a"/>
      <path d="M34,42 Q60,36 86,42 L86,47 Q60,41 34,47 Z" fill="#87996f"/>
      <circle cx="60" cy="28" r="2.2" fill="#87996f"/>
      <path d="M50,52 q4,-2.6 8,0 M62,52 q4,-2.6 8,0" stroke="#2c2118" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="54" cy="55" r="1.7" fill="#241a12"/><circle cx="66" cy="55" r="1.7" fill="#241a12"/>
      <path d="M59,55 q1.5,6 0,8 q-1.5,1 -2.5,0" stroke="#b98a63" stroke-width="1.1" fill="none"/>
      <path d="M54,66 Q60,70 66,66" stroke="#a06a4a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M46,49 q-1,-3.4 3,-4 M74,49 q1,-3.4 -3,-4" stroke="#3a2b22" stroke-width="1.3" fill="none"/>`,
    roberto: P => `
      <path d="M14,120 C16,96 34,84 46,81 L74,81 C88,84 104,96 106,120 Z" fill="#4a5258" stroke="#3a4147" stroke-width="1"/>
      <path d="M48,81 Q60,90 72,81 L72,85 Q60,93 48,85 Z" fill="#3a4147"/>
      <path d="M15,120 C18,96 34,85 46,82 L52,84 L52,120 Z" fill="#6d7a52" stroke="#535e3d" stroke-width="1"/>
      <path d="M105,120 C102,96 86,85 74,82 L68,84 L68,120 Z" fill="#6d7a52" stroke="#535e3d" stroke-width="1"/>
      <rect x="23" y="99" width="16" height="13" rx="2" fill="#616e47" stroke="#535e3d" stroke-width=".8"/>
      <rect x="81" y="99" width="16" height="13" rx="2" fill="#616e47" stroke="#535e3d" stroke-width=".8"/>
      <path d="M23,103 h16 M81,103 h16" stroke="#535e3d" stroke-width=".8"/>
      <circle cx="31" cy="103" r="1" fill="#535e3d"/><circle cx="89" cy="103" r="1" fill="#535e3d"/>
      <path d="M25,92 h12 M83,92 h12" stroke="#535e3d" stroke-width=".9" opacity=".7"/>
      <path d="M34,92 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M52,66 L68,66 L67,84 L53,84 Z" fill="#d1a075"/>
      <ellipse cx="38.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M40,42 Q40,24 60,24 Q80,24 80,42 L80,52 Q80,70 60,73 Q40,70 40,52 Z" fill="url(#${P}skin)"/>
      <!-- the big salt-and-pepper beard: full, bushy, proud -->
      <path d="M40,50 Q39,72 46,82 Q52,90 60,90 Q68,90 74,82 Q81,72 80,50 L80,56 Q81,74 72,82 Q66,88 60,88 Q54,88 48,82 Q39,74 40,56 Z" fill="#8f8f89"/>
      <path d="M41,52 Q41,72 48,80 Q54,87 60,87 Q66,87 72,80 Q79,72 79,52 Q79,60 76,66 Q74,58 71,56 L66,60 Q63,57 60,57 Q57,57 54,60 L49,56 Q46,58 44,66 Q41,60 41,52 Z" fill="#9d9d97"/>
      <g stroke="#c9c9c2" stroke-width=".9" fill="none" opacity=".8">
        <path d="M45,60 q-1,9 3,15"/><path d="M75,60 q1,9 -3,15"/><path d="M52,66 q-1,9 3,14"/>
        <path d="M68,66 q1,9 -3,14"/><path d="M60,70 q0,8 0,13"/>
      </g>
      <g stroke="#5f5f5a" stroke-width=".9" fill="none" opacity=".7">
        <path d="M48,58 q-1,10 2,17"/><path d="M72,58 q1,10 -2,17"/><path d="M56,64 q-.5,10 1,15"/><path d="M64,64 q.5,10 -1,15"/>
      </g>
      <path d="M51,62.5 Q60,66.5 69,62.5 Q66,60 60,60 Q54,60 51,62.5 Z" fill="#7d7d78"/>
      <path d="M52.6,64.4 Q60,69.4 67.4,64.4 Q66,70.4 60,70.4 Q54,70.4 52.6,64.4 Z" fill="#7e3f2e"/>
      <path d="M54,65.6 Q60,68.8 66,65.6 Q60,67.6 54,65.6 Z" fill="#f2ede4"/>
      <path d="M60,48 q-1.5,5.4 -2.5,7.6 q2.5,1.9 5,0 Q61.4,53.4 60,48" fill="#c98a5f" opacity=".85"/>
      <!-- yellow shades, purple mirror lenses -->
      <linearGradient id="${P}lens" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#c04a97"/><stop offset=".55" stop-color="#8c2f74"/><stop offset="1" stop-color="#5e2050"/>
      </linearGradient>
      <g stroke="#f2c531" stroke-width="2.2" fill="url(#${P}lens)">
        <rect x="42" y="43" width="15.5" height="12" rx="4.5"/>
        <rect x="62.5" y="43" width="15.5" height="12" rx="4.5"/>
      </g>
      <path d="M57.5,47.5 q2.5,-2 5,0" stroke="#f2c531" stroke-width="2.2" fill="none"/>
      <path d="M42,47 L38,48 M78,47 L82,48" stroke="#f2c531" stroke-width="1.8" fill="none"/>
      <path d="M45.5,46 q3,-1.6 6,0" stroke="#e9b7dd" stroke-width="1" fill="none" opacity=".7"/>
      <path d="M66,46 q3,-1.6 6,0" stroke="#e9b7dd" stroke-width="1" fill="none" opacity=".7"/>
      <!-- camo bucket hat -->
      <path d="M38,38 Q38,18 60,18 Q82,18 82,38 L82,40 L38,40 Z" fill="#585d61"/>
      <path d="M32,39 Q60,32 88,39 Q91,44 86,46 Q60,39 34,46 Q29,44 32,39 Z" fill="#4c5155"/>
      <g opacity=".9">
        <path d="M44,24 q6,-4 12,-1 q2,4 -3,5 q-7,1 -9,-4 Z" fill="#c9cdd0"/>
        <path d="M62,20 q7,-1 10,3 q-1,4 -6,3 q-6,-1 -4,-6 Z" fill="#23272a"/>
        <path d="M50,32 q5,-3 9,0 q1,3 -4,4 q-6,0 -5,-4 Z" fill="#23272a"/>
        <path d="M68,30 q5,-2 8,1 q0,4 -5,3 q-4,-1 -3,-4 Z" fill="#c9cdd0"/>
        <path d="M40,32 q4,-4 7,-1 q1,4 -3,4 q-4,0 -4,-3 Z" fill="#8b9094"/>
        <path d="M37,42 q6,-2 11,0 q1,3 -4,3 q-6,0 -7,-3 Z" fill="#c9cdd0"/>
        <path d="M56,40 q6,-2 9,1 q-1,3 -5,2 q-5,0 -4,-3 Z" fill="#8b9094"/>
        <path d="M72,41 q5,-2 9,1 q0,3 -5,2 q-5,0 -4,-3 Z" fill="#23272a"/>
      </g>
      <path d="M38,39 Q60,34 82,39 L82,41 Q60,36 38,41 Z" fill="#33383c" opacity=".6"/>
      <path d="M44,41.5 q5,-2 10,-.6" stroke="#4d4640" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M66,40.9 q5,-1.4 10,.6" stroke="#4d4640" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    hotrod: P => `
      <path d="M8,120 C11,94 30,82 44,79 L76,79 C90,82 109,94 112,120 Z" fill="#c3c7cb" stroke="#a9adb2" stroke-width="1"/>
      <g stroke="#d7dade" stroke-width=".9" opacity=".8" fill="none">
        <path d="M20,96 q20,-6 38,-2"/><path d="M60,92 q22,-4 38,4"/><path d="M26,108 q22,-5 40,0"/><path d="M62,106 q20,-3 34,5"/>
      </g>
      <path d="M47,79 Q60,88 73,79 L73,84 Q60,93 47,84 Z" fill="#aeb2b7"/>
      <path d="M9,120 C12,95 30,83 44,80 L50,82 L50,120 Z" fill="#b3a077" stroke="#8d7c58" stroke-width="1"/>
      <path d="M111,120 C108,95 90,83 76,80 L70,82 L70,120 Z" fill="#b3a077" stroke="#8d7c58" stroke-width="1"/>
      <rect x="17" y="99" width="16" height="13" rx="2" fill="#a6936a" stroke="#8d7c58" stroke-width=".8"/>
      <rect x="87" y="99" width="16" height="13" rx="2" fill="#a6936a" stroke="#8d7c58" stroke-width=".8"/>
      <path d="M17,103 h16 M87,103 h16" stroke="#8d7c58" stroke-width=".8"/>
      <circle cx="25" cy="103" r="1" fill="#8d7c58"/><circle cx="95" cy="103" r="1" fill="#8d7c58"/>
      <path d="M19,92 h12 M89,92 h12" stroke="#8d7c58" stroke-width=".9" opacity=".7"/>
      <path d="M28,92 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M51,66 L69,66 L68,83 L52,83 Z" fill="#d1a075"/>
      <ellipse cx="38.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M40,42 Q40,25 60,25 Q80,25 80,42 L80,52 Q80,72 60,75 Q40,72 40,52 Z" fill="url(#${P}skin)"/>
      <!-- full dark beard, groomed tight, a touch of frost at the chin -->
      <path d="M40,50 Q40,68 47,76 Q53,83 60,83 Q67,83 73,76 Q80,68 80,50 L80,55 Q80,71 71,78 Q66,82 60,82 Q54,82 49,78 Q40,71 40,55 Z" fill="#33271d"/>
      <path d="M41,52 Q41,68 48,75 Q54,81 60,81 Q66,81 72,75 Q79,68 79,52 Q79,58 76,63 Q74,56 70,54 L66,58 Q63,55.5 60,55.5 Q57,55.5 54,58 L50,54 Q46,56 44,63 Q41,58 41,52 Z" fill="#3d2f23"/>
      <g stroke="#241a12" stroke-width=".9" fill="none" opacity=".7">
        <path d="M46,58 q-1,8 2,14"/><path d="M74,58 q1,8 -2,14"/><path d="M53,63 q-.5,8 1.5,13"/><path d="M67,63 q.5,8 -1.5,13"/>
      </g>
      <path d="M56,76 q4,3 8,0 q-2,4 -4,4 q-2,0 -4,-4 Z" fill="#8b8378" opacity=".65"/>
      <path d="M51,61.5 Q60,65 69,61.5 Q66,59.4 60,59.4 Q54,59.4 51,61.5 Z" fill="#241a12"/>
      <path d="M52.4,63.6 Q60,68.6 67.6,63.6 Q66,69.8 60,69.8 Q54,69.8 52.4,63.6 Z" fill="#7e3f2e"/>
      <path d="M54,64.8 Q60,68.2 66,64.8 Q60,67 54,64.8 Z" fill="#f4efe6"/>
      <path d="M60,48 q-1.5,5.4 -2.4,7.6 q2.4,1.9 4.8,0 Q61.3,53.4 60,48" fill="#c98a5f" opacity=".85"/>
      <ellipse cx="46.5" cy="58" rx="3.2" ry="2" fill="#dd8a62" opacity=".35"/>
      <ellipse cx="73.5" cy="58" rx="3.2" ry="2" fill="#dd8a62" opacity=".35"/>
      <!-- black rectangular frames -->
      <ellipse cx="50.5" cy="50" rx="2" ry="2.2" fill="#4a3423"/>
      <ellipse cx="69.5" cy="50" rx="2" ry="2.2" fill="#4a3423"/>
      <circle cx="51.2" cy="49.3" r=".6" fill="#fff" opacity=".9"/>
      <circle cx="70.2" cy="49.3" r=".6" fill="#fff" opacity=".9"/>
      <g stroke="#1c1c1e" stroke-width="1.9" fill="rgba(228,236,242,.16)">
        <rect x="42" y="44.5" width="15.5" height="11" rx="2.6"/>
        <rect x="62.5" y="44.5" width="15.5" height="11" rx="2.6"/>
      </g>
      <path d="M57.5,48.5 h5" stroke="#1c1c1e" stroke-width="1.9" fill="none"/>
      <path d="M42,48 L38,49 M78,48 L82,49" stroke="#1c1c1e" stroke-width="1.6" fill="none"/>
      <path d="M44,43 q5,-2.2 10,-.8" stroke="#33271d" stroke-width="2.1" fill="none" stroke-linecap="round"/>
      <path d="M66,42.2 q5,-1.4 10,.8" stroke="#33271d" stroke-width="2.1" fill="none" stroke-linecap="round"/>
      <!-- short dark hair, faded sides, a little length up top -->
      <path d="M39,42 Q38,20 60,19 Q82,20 81,42 Q81,31 74,27 Q66,22 52,24 Q44,26 41,32 Q39,36 39,42 Z" fill="#3a2d22"/>
      <path d="M41,38 Q40,30 46,26 L44,38 Z" fill="#4a3a2c" opacity=".7"/>
      <path d="M79,38 Q80,30 74,26 L76,38 Z" fill="#4a3a2c" opacity=".7"/>
      <path d="M46,23 q6,-3 12,-2 M60,20.5 q7,-1 12,3" stroke="#241a12" stroke-width="1" fill="none" opacity=".8"/>`,
    olddog: P => `
      <path d="M12,120 C15,95 33,83 45,80 L75,80 C89,83 105,95 108,120 Z" fill="#35507a" stroke="#294060" stroke-width="1"/>
      <path d="M47,80 Q60,89 73,80 L73,85 Q60,94 47,85 Z" fill="#294060"/>
      <path d="M13,120 C16,96 32,85 44,81 L50,83 L50,120 Z" fill="#8a8a68" stroke="#6d6d4f" stroke-width="1"/>
      <path d="M107,120 C104,96 88,85 76,81 L70,83 L70,120 Z" fill="#8a8a68" stroke="#6d6d4f" stroke-width="1"/>
      <rect x="21" y="99" width="16" height="13" rx="2" fill="#7d7d5c" stroke="#6d6d4f" stroke-width=".8"/>
      <rect x="83" y="99" width="16" height="13" rx="2" fill="#7d7d5c" stroke="#6d6d4f" stroke-width=".8"/>
      <path d="M21,103 h16 M83,103 h16" stroke="#6d6d4f" stroke-width=".8"/>
      <circle cx="29" cy="103" r="1" fill="#6d6d4f"/><circle cx="91" cy="103" r="1" fill="#6d6d4f"/>
      <path d="M23,92 h12 M85,92 h12" stroke="#6d6d4f" stroke-width=".9" opacity=".7"/>
      <path d="M32,92 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M52,66 L68,66 L67,83 L53,83 Z" fill="#c99a72"/>
      <ellipse cx="38.5" cy="53" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="53" rx="4" ry="6" fill="url(#${P}skin)"/>
      <!-- the silver side wings flare out past the ears -->
      <path d="M40,44 Q34,50 30,60 Q28,66 33,64 Q40,61 42,54 Z" fill="#d9d9d4"/>
      <path d="M80,44 Q86,50 90,60 Q92,66 87,64 Q80,61 78,54 Z" fill="#d9d9d4"/>
      <path d="M41,52 Q36,58 34,64 Q33,68 38,66 Q43,63 44,57 Z" fill="#c7c7c1"/>
      <path d="M79,52 Q84,58 86,64 Q87,68 82,66 Q77,63 76,57 Z" fill="#c7c7c1"/>
      <path d="M41,42 Q41,26 60,26 Q79,26 79,42 L79,53 Q79,72 60,75 Q41,72 41,53 Z" fill="url(#${P}skin)"/>
      <path d="M44,62 Q52,73 60,74 Q68,73 76,62 Q71,71 60,72 Q49,71 44,62 Z" fill="#b07a52" opacity=".4"/>
      <!-- weathered lines: a life squinting at the water -->
      <g stroke="#b07a52" stroke-width=".8" fill="none" opacity=".55">
        <path d="M48,36 q12,-2.5 24,0"/><path d="M50,32.5 q10,-2 20,0"/>
        <path d="M43,56 q1.5,3 3.5,4"/><path d="M77,56 q-1.5,3 -3.5,4"/>
      </g>
      <!-- swept-back silver mane -->
      <path d="M39,44 Q38,18 60,17 Q82,18 81,44 Q81,30 74,26 Q66,22 54,23 Q45,25 42,32 Q39,37 39,44 Z" fill="#d9d9d4"/>
      <path d="M42,30 q8,-6 17,-6 M52,22.5 q9,-1.5 17,2 M44,37 q4,-8 11,-11" stroke="#b9b9b3" stroke-width="1" fill="none" opacity=".9"/>
      <path d="M60,17.5 q10,1 15,7" stroke="#efefec" stroke-width="1.1" fill="none" opacity=".9"/>
      <!-- thin half-rim glasses -->
      <path d="M44,45 q5,-1.8 10,-.6" stroke="#a8a8a2" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <path d="M66,44.4 q5,-1.2 10,.6" stroke="#a8a8a2" stroke-width="1.9" fill="none" stroke-linecap="round"/>
      <ellipse cx="50.5" cy="51.6" rx="1.9" ry="1.9" fill="#41525c"/>
      <ellipse cx="69.5" cy="51.6" rx="1.9" ry="1.9" fill="#41525c"/>
      <circle cx="51.2" cy="51" r=".55" fill="#fff" opacity=".9"/>
      <circle cx="70.2" cy="51" r=".55" fill="#fff" opacity=".9"/>
      <path d="M47,54.8 q3.6,1.3 7,.2" stroke="#b07a52" stroke-width=".8" fill="none" opacity=".7"/>
      <path d="M66,55 q3.6,1.1 7,-.2" stroke="#b07a52" stroke-width=".8" fill="none" opacity=".7"/>
      <g stroke="#2a2a2c" stroke-width="1.5" fill="rgba(230,238,244,.14)">
        <rect x="42.5" y="47" width="15" height="9.5" rx="2.2"/>
        <rect x="62.5" y="47" width="15" height="9.5" rx="2.2"/>
      </g>
      <path d="M57.5,50 h5" stroke="#2a2a2c" stroke-width="1.4" fill="none"/>
      <path d="M42.5,50 L38.5,51 M77.5,50 L81.5,51" stroke="#2a2a2c" stroke-width="1.3" fill="none"/>
      <path d="M60,50 q-1.4,5.6 -2.3,7.8 q2.3,1.8 4.6,0 Q61.2,55.6 60,50" fill="#b87f57" opacity=".8"/>
      <!-- white Van Dyke: heavy mustache, pointed chin beard -->
      <path d="M49.5,62.5 Q54,59.5 60,61 Q66,59.5 70.5,62.5 Q68,65.5 63,64.5 Q61.5,64 60,64 Q58.5,64 57,64.5 Q52,65.5 49.5,62.5 Z" fill="#e8e8e3"/>
      <path d="M53,66.5 Q56,65.5 58,66 L60,66.4 L62,66 Q64,65.5 67,66.5 Q68,74 65,80 Q62.5,84.5 60,84.5 Q57.5,84.5 55,80 Q52,74 53,66.5 Z" fill="#e8e8e3"/>
      <path d="M56,68 q-.5,7 1.5,11 M64,68 q.5,7 -1.5,11 M60,68.5 q0,7.5 0,12" stroke="#c4c4be" stroke-width=".8" fill="none" opacity=".9"/>
      <path d="M56.5,64.6 Q60,66.4 63.5,64.6" stroke="#8a5a3c" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    drg: P => `
      <path d="M8,120 C11,94 30,82 44,79 L76,79 C90,82 109,94 112,120 Z" fill="#3a6ea8" stroke="#2d578a" stroke-width="1"/>
      <path d="M46,79 L56,90 L52,96 L44,86 Z" fill="#2d578a"/>
      <path d="M74,79 L64,90 L68,96 L76,86 Z" fill="#2d578a"/>
      <path d="M56,90 L60,120 L64,90 Z" fill="#2d578a" opacity=".6"/>
      <path d="M9,120 C12,95 30,83 44,80 L50,82 L50,120 Z" fill="#b3a077" stroke="#8d7c58" stroke-width="1"/>
      <path d="M111,120 C108,95 90,83 76,80 L70,82 L70,120 Z" fill="#b3a077" stroke="#8d7c58" stroke-width="1"/>
      <rect x="17" y="99" width="16" height="13" rx="2" fill="#a6936a" stroke="#8d7c58" stroke-width=".8"/>
      <rect x="87" y="99" width="16" height="13" rx="2" fill="#a6936a" stroke="#8d7c58" stroke-width=".8"/>
      <path d="M17,103 h16 M87,103 h16" stroke="#8d7c58" stroke-width=".8"/>
      <circle cx="25" cy="103" r="1" fill="#8d7c58"/><circle cx="95" cy="103" r="1" fill="#8d7c58"/>
      <path d="M19,92 h12 M89,92 h12" stroke="#8d7c58" stroke-width=".9" opacity=".7"/>
      <path d="M28,92 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M52,66 L68,66 L67,82 L53,82 Z" fill="#d1a075"/>
      <ellipse cx="38.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="52" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M40,42 Q40,25 60,25 Q80,25 80,42 L80,52 Q80,71 60,74 Q40,71 40,52 Z" fill="url(#${P}skin)"/>
      <!-- the long beard: full at the cheeks, flowing to a point at the chest -->
      <path d="M41,48 Q40,64 45,74 Q50,86 55,93 Q58,98 60,98 Q62,98 65,93 Q70,86 75,74 Q80,64 79,48 L79,54 Q79,68 73,78 Q68,88 63,93 Q60,96 57,93 Q52,88 47,78 Q41,68 41,54 Z" fill="#463526"/>
      <path d="M42,50 Q42,66 48,76 Q53,87 58,93 Q60,95.5 62,93 Q67,87 72,76 Q78,66 78,50 Q78,57 75,63 Q73,55 69,53 L65,57 Q62.5,54.5 60,54.5 Q57.5,54.5 55,57 L51,53 Q47,55 45,63 Q42,57 42,50 Z" fill="#52402e"/>
      <g stroke="#2f2418" stroke-width=".9" fill="none" opacity=".7">
        <path d="M47,60 q0,12 6,22"/><path d="M73,60 q0,12 -6,22"/><path d="M54,66 q1,12 5,20"/><path d="M66,66 q-1,12 -5,20"/>
      </g>
      <g stroke="#8d8478" stroke-width=".8" fill="none" opacity=".65">
        <path d="M50,62 q0,10 5,18"/><path d="M70,62 q0,10 -5,18"/><path d="M60,68 q0,12 0,20"/>
      </g>
      <path d="M51,60.5 Q60,64.5 69,60.5 Q66,58 60,58 Q54,58 51,60.5 Z" fill="#2f2418"/>
      <path d="M52.4,62.8 Q60,67.6 67.6,62.8 Q66,68.8 60,68.8 Q54,68.8 52.4,62.8 Z" fill="#7e3f2e"/>
      <path d="M54,64 Q60,67.2 66,64 Q60,66.2 54,64 Z" fill="#f4efe6"/>
      <path d="M60,47 q-1.5,5.4 -2.4,7.6 q2.4,1.9 4.8,0 Q61.3,52.4 60,47" fill="#c98a5f" opacity=".85"/>
      <ellipse cx="46" cy="56.5" rx="3.4" ry="2.1" fill="#dd8a62" opacity=".4"/>
      <ellipse cx="74" cy="56.5" rx="3.4" ry="2.1" fill="#dd8a62" opacity=".4"/>
      <!-- happy squint: eyes nearly closed by the grin -->
      <ellipse cx="50.5" cy="50.5" rx="2.6" ry="1.5" fill="#5b6f7d"/>
      <ellipse cx="69.5" cy="50.5" rx="2.6" ry="1.5" fill="#5b6f7d"/>
      <circle cx="50.5" cy="50.2" r="1" fill="#33261c"/>
      <circle cx="69.5" cy="50.2" r="1" fill="#33261c"/>
      <path d="M47.2,49 q3.3,-2 6.6,-.4" stroke="#a8724e" stroke-width="1" fill="none"/>
      <path d="M66.2,48.6 q3.3,-1.6 6.6,.4" stroke="#a8724e" stroke-width="1" fill="none"/>
      <path d="M46.8,53 q3.5,1.6 7,.4" stroke="#b07a52" stroke-width=".9" fill="none" opacity=".8"/>
      <path d="M66.2,53.4 q3.5,1.2 7,-.4" stroke="#b07a52" stroke-width=".9" fill="none" opacity=".8"/>
      <path d="M43.5,42.5 q5,-2 10,-.6" stroke="#3a2d20" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M66.5,41.9 q5,-1.4 10,.6" stroke="#3a2d20" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <!-- charcoal trucker cap, black mesh back, orange shop logo -->
      <path d="M37,37 Q37,14 60,14 Q83,14 83,37 L83,40 L37,40 Z" fill="#4d545c"/>
      <path d="M37,37 Q37,20 44,16 L44,40 L37,40 Z" fill="#23262a"/>
      <path d="M83,37 Q83,20 76,16 L76,40 L83,40 Z" fill="#23262a"/>
      <g stroke="#3a3e44" stroke-width=".7" opacity=".9">
        <path d="M38,26 l4,4 M38,31 l4,4 M40,22 l3,3"/>
        <path d="M82,26 l-4,4 M82,31 l-4,4 M80,22 l-3,3"/>
      </g>
      <circle cx="60" cy="15.5" r="1.6" fill="#23262a"/>
      <g stroke="#e8963c" stroke-width="1.4" fill="none" opacity=".95">
        <path d="M49,25 q2.5,-3 5,0 q-2.5,3 -5,0 Z"/>
        <path d="M56,22.5 q3,-1.5 6,0"/>
        <path d="M56,26.5 q3,1.5 6,0"/>
      </g>
      <path d="M64.5,21.5 l2.4,4.6 l2.6,-4.6 l2.4,4.6 l2.2,-4.2" stroke="#f0f0ec" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M33,38 Q60,31 87,38 Q90,43 85,44.5 Q60,37 35,44.5 Q30,43 33,38 Z" fill="#4d545c"/>
      <path d="M35,44 Q60,37.5 85,44 L84.4,45.4 Q60,39 35.6,45.4 Z" fill="#33383e" opacity=".9"/>`,
    jpbasser: P => `
      <path d="M14,120 C16,96 34,84 46,81 L74,81 C88,84 104,96 106,120 Z" fill="#c9bd9a" stroke="#a89c7a" stroke-width="1"/>
      <path d="M48,81 L54,89 L60,83 L66,89 L72,81 L71,86 L60,95 L49,86 Z" fill="#bdb08c" stroke="#a89c7a" stroke-width=".7"/>
      <path d="M60,95 L60,120" stroke="#a89c7a" stroke-width="1"/>
      <circle cx="60" cy="101" r="1.2" fill="#8d8163"/><circle cx="60" cy="109" r="1.2" fill="#8d8163"/><circle cx="60" cy="117" r="1.2" fill="#8d8163"/>
      <rect x="30" y="99" width="14" height="12" rx="2" fill="#bdb08c" stroke="#a89c7a" stroke-width=".8"/>
      <rect x="76" y="99" width="14" height="12" rx="2" fill="#bdb08c" stroke="#a89c7a" stroke-width=".8"/>
      <path d="M30,102.5 h14 M76,102.5 h14" stroke="#a89c7a" stroke-width=".8"/>
      <circle cx="37" cy="102.5" r="1" fill="#8d8163"/><circle cx="83" cy="102.5" r="1" fill="#8d8163"/>
      <path d="M84,94 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M52,68 L68,68 L67,84 L53,84 Z" fill="#d69c74"/>
      <path d="M52,68 L68,68 L67,75 Q60,79 53,75 Z" fill="#b97f57" opacity=".55"/>
      <ellipse cx="38.5" cy="54" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="54" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M40,42 Q40,24 60,24 Q80,24 80,42 L80,54 Q80,76 60,78 Q40,76 40,54 Z" fill="url(#${P}skin)"/>
      <path d="M43,62 Q50,75 60,76 Q70,75 77,62 Q72,73 60,74 Q48,73 43,62 Z" fill="#c98f65" opacity=".4"/>
      <path d="M38,42 Q37,18 60,17 Q83,18 82,42 Q82,33 76,29 Q73,33 69,29 Q64,34 59,29 Q54,33 49,29 Q45,33 42,31 Q39,35 38,42 Z" fill="#8a744f"/>
      <path d="M44,26 q4,-3 9,-2 M56,23 q5,-2 10,0 M68,25 q4,-1 7,2" stroke="#6f5c3d" stroke-width="1" fill="none" opacity=".8"/>
      <path d="M45,44 q5,-2.5 10,-.8" stroke="#7a6544" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M65,43.2 q5,-1.7 10,.8" stroke="#7a6544" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="50.8" cy="50.6" rx="2" ry="2.2" fill="#4a3a2c"/>
      <ellipse cx="69.2" cy="50.6" rx="2" ry="2.2" fill="#4a3a2c"/>
      <circle cx="51.5" cy="49.9" r=".6" fill="#fff" opacity=".85"/>
      <circle cx="69.9" cy="49.9" r=".6" fill="#fff" opacity=".85"/>
      <ellipse cx="46.5" cy="59" rx="3.6" ry="2.2" fill="#e08a66" opacity=".4"/>
      <ellipse cx="73.5" cy="59" rx="3.6" ry="2.2" fill="#e08a66" opacity=".4"/>
      <path d="M60,50 q-1.5,5.6 -2.4,7.8 q2.4,1.9 4.8,0 Q61.3,55.6 60,50" fill="#cf9068" opacity=".8"/>
      <path d="M41.5,54 Q43,70 54,75.5 Q57,77 60,77 Q63,77 66,75.5 Q77,70 78.5,54 Q78,68 68,74.5 L66,71.5 Q63,73 60,73 Q57,73 54,71.5 L52,74.5 Q42,68 41.5,54 Z" fill="#96603c" opacity=".7"/>
      <path d="M51.5,61.4 Q60,64.6 68.5,61.4 L68,63.4 Q60,66.2 52,63.4 Z" fill="#96603c" opacity=".8"/>
      <path d="M53.5,71.8 Q60,75.8 66.5,71.8 Q64,76.8 60,76.8 Q56,76.8 53.5,71.8 Z" fill="#96603c" opacity=".85"/>
      <path d="M50,63.5 Q60,71 70,63.5 Q66,69.6 60,69.6 Q54,69.6 50,63.5 Z" fill="#8a4a37"/>
      <path d="M52.2,64.6 Q60,69.4 67.8,64.6 Q60,67.8 52.2,64.6 Z" fill="#f4efe6"/>
      <path d="M50,63.5 Q60,71 70,63.5" stroke="#7e4432" stroke-width="1" fill="none"/>`,
    wildwest: P => `
      <path d="M14,120 C16,96 34,84 46,81 L74,81 C88,84 104,96 106,120 Z" fill="#6e3440" stroke="#552732" stroke-width="1"/>
      <rect x="56.6" y="92" width="6.8" height="28" fill="#5f2c37"/>
      <circle cx="60" cy="98" r="1.4" fill="#3d1c24"/><circle cx="60" cy="106" r="1.4" fill="#3d1c24"/><circle cx="60" cy="114" r="1.4" fill="#3d1c24"/>
      <path d="M48,81 Q60,90 72,81 L72,86 Q60,95 48,86 Z" fill="#5f2c37"/>
      <path d="M15,120 C18,96 34,85 46,82 L52,84 L52,120 Z" fill="#77704e" stroke="#5c563b" stroke-width="1"/>
      <path d="M105,120 C102,96 86,85 74,82 L68,84 L68,120 Z" fill="#77704e" stroke="#5c563b" stroke-width="1"/>
      <rect x="23" y="99" width="16" height="13" rx="2" fill="#6b6445" stroke="#5c563b" stroke-width=".8"/>
      <rect x="81" y="99" width="16" height="13" rx="2" fill="#6b6445" stroke="#5c563b" stroke-width=".8"/>
      <path d="M23,103 h16 M81,103 h16" stroke="#5c563b" stroke-width=".8"/>
      <circle cx="31" cy="103" r="1" fill="#5c563b"/><circle cx="89" cy="103" r="1" fill="#5c563b"/>
      <path d="M25,92 h12 M83,92 h12" stroke="#5c563b" stroke-width=".9" opacity=".7"/>
      <path d="M34,92 l2,4 l2,-1.5" stroke="#e8963c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M52,68 L68,68 L67,84 L53,84 Z" fill="#e2ad86"/>
      <path d="M52,68 L68,68 L67,75 Q60,79 53,75 Z" fill="#c68e64" opacity=".5"/>
      <ellipse cx="38.5" cy="54" rx="4" ry="6" fill="url(#${P}skin)"/>
      <ellipse cx="81.5" cy="54" rx="4" ry="6" fill="url(#${P}skin)"/>
      <path d="M41,42 Q41,26 60,26 Q79,26 79,42 L79,53 Q79,73 60,76 Q41,73 41,53 Z" fill="url(#${P}skin)"/>
      <g fill="#4c3826">
        <circle cx="38" cy="28" r="7.5"/><circle cx="82" cy="28" r="7.5"/>
        <circle cx="34.5" cy="39" r="6.5"/><circle cx="85.5" cy="39" r="6.5"/>
        <circle cx="34.5" cy="50" r="5.5"/><circle cx="85.5" cy="50" r="5.5"/>
        <circle cx="36.5" cy="59" r="4.5"/><circle cx="83.5" cy="59" r="4.5"/>
        <circle cx="47" cy="31" r="7"/><circle cx="59" cy="29" r="7.5"/><circle cx="71" cy="31" r="7"/>
        <path d="M40,34 Q41,26 47,24 L52,36 Q45,38 40,34 Z"/><path d="M80,34 Q79,26 73,24 L68,36 Q75,38 80,34 Z"/>
      </g>
      <g stroke="#6a523a" stroke-width="1.1" fill="none" opacity=".7">
        <path d="M37,30 q1,-5 5,-6"/><path d="M84,31 q-1,-5 -5,-6"/>
        <path d="M50,29 q4,-3 8,-1"/><path d="M63,28 q4,-2 7,1"/>
        <path d="M35,46 q0,-4 3,-6"/><path d="M85,46 q0,-4 -3,-6"/>
      </g>
      <g stroke="#d9dee3" stroke-width="1.5" fill="rgba(255,255,255,.10)">
        <rect x="42" y="45.5" width="15.5" height="12.5" rx="5"/>
        <rect x="62.5" y="45.5" width="15.5" height="12.5" rx="5"/>
        <path d="M57.5,50.5 q2.5,-1.8 5,0" fill="none"/>
        <path d="M42,50 L38,51" fill="none"/><path d="M78,50 L82,51" fill="none"/>
      </g>
      <ellipse cx="50" cy="52" rx="2" ry="2.2" fill="#51707f"/>
      <ellipse cx="70" cy="52" rx="2" ry="2.2" fill="#51707f"/>
      <circle cx="50.7" cy="51.3" r=".6" fill="#fff" opacity=".9"/>
      <circle cx="70.7" cy="51.3" r=".6" fill="#fff" opacity=".9"/>
      <ellipse cx="46" cy="60" rx="3.6" ry="2.3" fill="#e08a66" opacity=".45"/>
      <ellipse cx="74" cy="60" rx="3.6" ry="2.3" fill="#e08a66" opacity=".45"/>
      <path d="M60,52 q-1.4,5.2 -2.3,7.4 q2.3,1.8 4.6,0 Q61.2,57.2 60,52" fill="#d69468" opacity=".8"/>
      <path d="M50,64 Q60,72.5 70,64 Q66,71 60,71 Q54,71 50,64 Z" fill="#7e4432"/>
      <path d="M52.4,65.2 Q60,70.4 67.6,65.2 Q60,68.4 52.4,65.2 Z" fill="#f4efe6"/>
      <path d="M50,64 Q60,72.5 70,64" stroke="#6e3a2a" stroke-width="1" fill="none"/>
      <!-- trucker hat: tall foam front, navy mesh back, red bass on the panel -->
      <path d="M37,36 Q37,13 60,13 Q83,13 83,36 L83,39 L37,39 Z" fill="#2e4a68"/>
      <path d="M44,36 Q44,16 60,15 Q76,16 76,36 Z" fill="#f2efe8"/>
      <path d="M44,36 Q44,26 46,21 Q45,30 46,36 Z" fill="#d9d5ca"/>
      <path d="M76,36 Q76,26 74,21 Q75,30 74,36 Z" fill="#d9d5ca"/>
      <g stroke="#22394f" stroke-width=".7" opacity=".8">
        <path d="M38,26 l4,4 M38,31 l4,4 M40,23 l3,3"/>
        <path d="M82,26 l-4,4 M82,31 l-4,4 M80,23 l-3,3"/>
      </g>
      <circle cx="60" cy="14.5" r="1.6" fill="#22394f"/>
      <path d="M52.5,26.5 Q57,22.5 62.5,24 Q66,25 67,26.8 Q66,28.6 62.5,29.6 Q57,31 52.5,26.5 Z" fill="#c23b28"/>
      <path d="M67,26.8 L71.5,23.8 L70.2,26.8 L71.5,29.8 Z" fill="#c23b28"/>
      <path d="M58,23.6 L59.4,21 L61,23.3 Z" fill="#c23b28"/>
      <circle cx="56" cy="25.6" r=".8" fill="#f2efe8"/>
      <path d="M53.5,31.5 q6.5,1.8 13,0" stroke="#c23b28" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M33,38 Q60,31 87,38 Q90,43 85,44.5 Q60,37 35,44.5 Q30,43 33,38 Z" fill="#2e4a68"/>
      <path d="M35,44 Q60,37.5 85,44 L84.4,45.4 Q60,39 35.6,45.4 Z" fill="#22394f" opacity=".9"/>`,
  };
  function mysteryFace() {
    return `
      <g fill="#141b22" opacity=".92">
        <path d="M16,120 C18,96 36,84 47,81 L73,81 C86,84 102,96 104,120 Z"/>
        <rect x="52" y="64" width="16" height="20" rx="5"/>
        <circle cx="60" cy="48" r="19"/>
        <path d="M39,44 Q39,30 60,30 Q81,30 81,44 L83,46 Q84,49 80,49 L40,49 Q36,49 37,46 Z"/>
      </g>
      <text x="60" y="57" font-size="19" font-weight="bold" text-anchor="middle" fill="rgba(255,255,255,.6)" font-family="sans-serif">?</text>
      <text x="60" y="103" font-size="7.5" text-anchor="middle" fill="rgba(255,255,255,.55)" font-family="sans-serif" letter-spacing="1">PHOTO SOON</text>`;
  }
  function anglerSVG(a, crop) {
    const vb = crop ? "30 16 60 60" : "0 0 120 120";
    const P = "av_" + a.id;    // unique gradient ids — six of these render in one list
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${P}skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#eab894"/><stop offset="1" stop-color="#d09a72"/>
        </linearGradient>
        <radialGradient id="${P}vig" cx="50%" cy="42%" r="75%">
          <stop offset="55%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(20,10,4,.55)"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="${a.hue}"/>
      <g stroke="rgba(0,0,0,.25)" stroke-width="1">
        <line x1="24" y1="0" x2="24" y2="120"/><line x1="52" y1="0" x2="52" y2="120"/>
        <line x1="82" y1="0" x2="82" y2="120"/><line x1="106" y1="0" x2="106" y2="120"/>
      </g>
      ${FACES[a.id] ? FACES[a.id](P) : mysteryFace()}
      <rect width="120" height="120" fill="url(#${P}vig)"/>
    </svg>`;
  }

  // ---- the picker: step 1 of the prep wizard (free play and tournaments both)
  function openAnglers() {
    renderAnglers();
    el.anglerTitle.textContent = `🧑‍🎣 ${prepNum(1)} — Pick your angler`;
    el.anglerBack.textContent = S.prepTour ? "◂ EVENT" : "◂ MENU";
    el.anglerNext.textContent = S.prepTour ? "NEXT — PICK YOUR SPOT ▸" : "NEXT — PICK YOUR LAKE ▸";
    el.anglerModal.classList.remove("hidden");
  }
  function renderAnglers() {
    el.anglerList.innerHTML = ANGLERS.map(a => {
      const sel = angler().id === a.id;
      const xp = anglerXP(a.id);
      const spec = Object.keys(SKILLS).filter(k => a.w[k] >= 1.25).map(k => SKILLS[k].ico + " " + SKILLS[k].name).join(" · ");
      const av = spAvail(a.id);
      const rows = Object.keys(SKILLS).map(k => {
        const lvl = skillLvl(a, k);
        const plus = sel && av > 0 && lvl < 100 ? `<button class="sp-plus" data-up="${a.id}:${k}">＋</button>` : "";
        return `<div class="cat"><span>${SKILLS[k].ico} ${SKILLS[k].name}</span>
          <div class="cat-bar"><i style="width:${lvl}%;background:${ratingColor(lvl)}"></i></div>
          <b style="color:${ratingColor(lvl)}">${lvl}</b>${plus}</div>`;
      }).join("");
      const spLine = av > 0
        ? `<div class="sp-line hot">🔺 ${av} skill point${av > 1 ? "s" : ""} to spend — tap ＋ on a skill</div>`
        : `<div class="sp-line">Next skill point: ${(xp % SP_PER).toLocaleString()} / ${SP_PER.toLocaleString()} XP fished as ${a.name} · achievements won in their boat are +1 each</div>`;
      const detail = sel ? `<div class="opt-detail"><div class="cats">${rows}</div>${spLine}<div class="cats-tip">${a.desc}</div></div>` : "";
      return `<div class="lure-opt angler-opt ${sel ? "sel" : ""}" data-angler="${a.id}">
        <div class="angler-face">${anglerSVG(a, true)}</div>
        <div class="info">
          <div class="nm">${a.name} <span class="stars" style="color:#ffd35c">${a.tag}</span></div>
          <div class="ds">★ ${spec || "Balanced — a little of everything"}</div>
        </div>
        <div class="tag">${sel ? "✓ YOU" : "TAP"}</div></div>` + detail;
    }).join("");
  }
  el.anglerModal.addEventListener("click", (e) => {
    const up = e.target.closest("[data-up]");
    if (up) { const [id, k] = up.dataset.up.split(":"); spendSP(id, k); sfx("good"); renderAnglers(); return; }
    const o = e.target.closest(".angler-opt"); if (!o) return;
    if (G.angler !== o.dataset.angler) { G.angler = o.dataset.angler; save(); sfx("ui"); renderAnglers(); }
  });
  el.anglerClose.addEventListener("click", () => { el.anglerModal.classList.add("hidden"); exitPrep(); });
  el.anglerBack.addEventListener("click", () => { sfx("ui"); el.anglerModal.classList.add("hidden"); exitPrep(); });
  el.anglerNext.addEventListener("click", () => { sfx("ui"); gotoPrep(S.prepTour ? 3 : 2); });

  // ===========================================================================
  // 🏹 GAR RUN — hidden Easter egg. Fish Trophy Lake as Dr. G and a mystery
  // pin appears upriver: Roberto's got the bows in the truck. Tap a rolling
  // gar to put an arrow on it before it sounds. Nothing anywhere hints at it.
  // ===========================================================================
  const GAR_MS = 75000;
  const EGG_HOME = { drg: "deep", jpbasser: "deep", hotrod: "river", olddog: "bayou", roberto: "cove", alisa: "falls", bubba: "highland" };
  function eggAvailable() {
    const a = angler().id;
    if (EGG_HOME[a] !== G.spot) return false;
    // the finale only shows itself once every other secret has been found
    if (a === "roberto" && !((G.garTrips || 0) && (G.sandTrips || 0) && (G.rcTrips || 0) && (G.frogTrips || 0) && (G.troutTrips || 0) && (G.catTrips || 0))) return false;
    return !(S.tournament && !S.tournament.ended) && !(S.arcade && !S.arcade.ended) && !S.tut;
  }
  const eggKind = () => ({ jpbasser: "sand", hotrod: "rc", olddog: "frog", roberto: "ghost", alisa: "trout", bubba: "cat" }[angler().id] || "gar");
  function openGarInvite() {
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    if (eggKind() === "cat") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Bubba — them <b>flatheads</b> are holed up under the bluff timber. Roll them sleeves up, we're going <b>noodling</b>!”</p>`;
      el.garYes.textContent = "💪 ROLL 'EM UP";
    } else if (eggKind() === "trout") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Alisa — first light below the dam, the <b>big browns</b> come up to sip. Bring the fly rod. Don't tell the bass guys.”</p>`;
      el.garYes.textContent = "🪶 STRING THE FLY ROD";
    } else if (eggKind() === "frog") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Hey Old Dog — hear 'em singing? <b>Bullfrogs</b> all down the bayou tonight. Grab the gigs and the headlamp!”</p>`;
      el.garYes.textContent = "🔱 GRAB THE GIGS";
    } else if (eggKind() === "ghost") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “You've found every secret we've got… except the one I never told. The old dock at <b>Lily Cove</b>. She only rolls after midnight. Bring your best lure.”</p>`;
      el.garYes.textContent = "🌙 CHASE THE LEGEND";
    } else if (eggKind() === "rc") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Hey bro — there's some <b>sweet rapids</b> up the river. Wanna go drive the <b>RC boats</b> and do some stunts?”</p>`;
      el.garYes.textContent = "🚤 GRAB THE RC BOATS";
    } else if (eggKind() === "sand") {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Hey James! I heard at the marina the <b>sand bass</b> are running up the creek — wanna check it out?”</p>`;
      el.garYes.textContent = "🎣 RUN THE CREEK";
    } else {
      el.garBody.innerHTML = `<p><b>Roberto:</b> “Hey Jake, I saw some <b>big gar</b> up the river — let's grab our bows and head up!”</p>`;
      el.garYes.textContent = "🏹 GRAB THE BOWS";
    }
    el.garNo.classList.remove("hidden");
    el.garModal.classList.remove("hidden");
    sfx("ui");
  }
  function startBowfish() {
    S.bow = { kind: eggKind(), t: GAR_MS, gars: [], arrows: [], hits: [], haul: [], spawnT: 500, shots: 0, over: false, penalty: 0, fight: null, holding: false, quiver: 3, quiverOut: false, boat: { x: W * 0.3, y: H - 150 }, air: null };
    S.mode = "bowfish";
    S.view = "surface"; S.viewT = 1;
    el.garModal.classList.add("hidden");
    el.mapModal.classList.add("hidden");
    setStatus("");
    toast(S.bow.kind === "cat" ? "💪 Reach into a boil when it churns — and HOLD ON!"
      : S.bow.kind === "trout" ? "🪶 Drop the fly in a rise ring — soft as you can!"
      : S.bow.kind === "frog" ? "🔱 Gig a frog when its eyes shine bright!"
      : S.bow.kind === "ghost" ? "🌙 Dinks roll all night… wait for HER."
      : S.bow.kind === "rc" ? "🚤 Send it off a rock when the spray flies!"
      : S.bow.kind === "sand" ? "🥄 Cast on a sand bass when it rolls!" : "🏹 Tap a gar when it rolls!");
    sfx("cast");
  }
  function cancelBowfish() { S.bow = null; if (S.mode === "bowfish") { S.mode = "idle"; showBtn(false); } }
  function updateBowfish(dt) {
    const B = S.bow; if (!B || B.over) return;
    B.t -= dt;
    const wl = waterLine();
    // ---- a stuck giant fights on the bow reel ----
    if (B.fight) {
      const F = B.fight;
      F.stT -= dt;
      if (F.stT <= 0) {
        // little gar mostly just run; the giants go airborne again and again
        if (F.state === "run" && Math.random() < 0.3 + F.k * 0.6) {
          F.state = "jump"; F.stT = 650;
          sfx("jump"); splash(F.x, F.y); if (Math.random() < 0.5) F.dir *= -1;
        } else { F.state = "run"; F.stT = rnd(1000, 1800); }
      }
      F.jp = F.state === "jump" ? 1 - F.stT / 650 : 0;
      F.x = clamp(F.x + F.dir * dt * (0.02 + F.k * 0.02), W * 0.12, W * 0.88);
      if (B.holding) {
        F.dist = clamp(F.dist - dt * (0.00024 - F.k * 0.00014) * (F.state === "jump" ? 0.3 : 1), 0, 1);
        F.strain = clamp(F.strain + dt * (F.state === "jump" ? 0.0004 + F.k * 0.0005 : 0.00005 + F.k * 0.00013) * garageNet(), 0, 1);
      } else {
        F.strain = clamp(F.strain - dt * 0.0007, 0, 1);
        F.dist = clamp(F.dist + dt * 0.00002, 0, 1);
      }
      if (F.strain >= 1) {          // it threw the hook — that one's gone
        B.quiver--;
        toast(F.ghost ? `💢 She threw the hook — the legend lives!${B.quiver > 0 ? ` ${B.quiver} lure${B.quiver > 1 ? "s" : ""} left` : ""}`
          : F.trout ? `💢 Popped the tippet!${B.quiver > 0 ? ` ${B.quiver} fl${B.quiver > 1 ? "ies" : "y"} left` : ""}`
          : F.cat ? `💢 It rolled and tore loose!${B.quiver > 0 ? ` ${B.quiver} grip${B.quiver > 1 ? "s" : ""} left` : ""}`
          : B.kind === "sand" ? `💢 Broke off with the spoon!${B.quiver > 0 ? ` ${B.quiver} left` : ""}`
          : `💢 It threw the arrow!${B.quiver > 0 ? ` ${B.quiver} left` : ""}`); sfx("snap"); vibrate([60, 40, 60]);
        splash(F.x, F.y); B.fight = null; B.holding = false; showBtn(false);
        if (B.quiver <= 0) { B.quiverOut = true; endBowfish(); return; }
      } else if (F.dist <= 0.06) {  // boated — and the arrow comes back with it
        B.haul.push(F.w);
        const rp = reelPoint();
        B.hits.push({ x: rp.x, y: rp.y - 46, t: 0, w: F.w });
        const bonus = Math.round(2 + F.k * 5);
        B.t = Math.min(GAR_MS, B.t + bonus * 1000);
        if (F.ghost) {
          B.haul.pop();            // she's no dink — the generic push above doesn't count her
          B.ghostW = F.w;
          toast(`🌙 <b>THE GHOST OF LILY COVE — ${F.w} lb!!</b>`);
          sfx("lunker"); vibrate([40, 60, 40, 60, 80]);
          B.fight = null; B.holding = false; showBtn(false);
          endBowfish();
          return;
        }
        const big2 = B.kind === "cat" ? F.w >= 15 : B.kind === "trout" ? F.w >= 5 : B.kind === "sand" ? F.w >= 2.5 : F.w >= 15;
        toast(`${B.kind === "cat" ? (big2 ? "🐋 HOG FLATHEAD" : "💪 Flathead") : B.kind === "trout" ? (big2 ? "🎺 BIG BROWN" : "🪶 Trout") : B.kind === "sand" ? (big2 ? "🐟 SLAB sand bass" : "🎣 Sand bass") : (big2 ? "🐊 GIANT GAR" : "🏹 Gar")} ${B.kind === "cat" ? "wrestled in" : B.kind === "trout" ? "netted" : "boated"} — <b>${F.w} lb</b> (+${bonus}s)`);
        if (B.kind === "cat") G.catBig = Math.max(G.catBig || 0, F.w);
        sfx(big2 ? "lunker" : "land"); vibrate([30, 40, 30, 40]);
        B.fight = null; B.holding = false; showBtn(false);
      }
    } else {
      // ---- the river rolls: the quarry, and things you'd better not hit ----
      B.spawnT -= dt;
      if (B.spawnT <= 0) {
        B.spawnT = rnd(650, 1800);
        const roll = Math.random();
        if (B.kind === "sand") {
          if (roll < 0.2) {         // a gar rolls through the school — do NOT cast at it
            B.gars.push({ type: "gar", x: rnd(W * 0.14, W * 0.86), y: wl + 24 + rnd(0, (H - wl) * 0.5),
              w: 0, r: 26, t: 0, dur: rnd(1400, 2200), dir: Math.random() < 0.5 ? -1 : 1, hit: false, hazard: true });
          } else {
            const slab = Math.random() < 0.2;
            const w = +(slab ? rnd(2.5, 4.8) : rnd(0.7, 2.3)).toFixed(1);
            B.gars.push({ type: "sand", x: rnd(W * 0.14, W * 0.86), y: wl + 24 + rnd(0, (H - wl) * 0.5),
              w, r: 13 + w * 4, t: 0, dur: rnd(950, 1500) * (slab ? 0.85 : 1),
              dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (B.kind === "rc") {
          if (roll < 0.2) {           // waterlogged stump riding the current — do NOT hit it
            B.gars.push({ type: "stump", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.4),
              w: 0, r: 22, t: 0, dur: rnd(2300, 3200), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          } else {                    // the surge bares a ramp rock, spray flying
            const big = Math.random() < 0.25;
            const w = +(big ? rnd(3, 5) : rnd(1, 2.6)).toFixed(1);
            B.gars.push({ type: "rock", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.4),
              w, r: 15 + w * 3.6, t: 0, dur: rnd(1500, 2400) * (big ? 0.85 : 1),
              dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (B.kind === "cat") {
          if (roll < 0.18) {          // snapping turtle in the hole — keep your fingers
            B.gars.push({ type: "turtle", x: rnd(W * 0.16, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w: 0, r: 24, t: 0, dur: rnd(2400, 3300), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          } else {
            const hog = Math.random() < 0.2;
            const w = +(hog ? rnd(15, 38) : rnd(4, 12)).toFixed(1);
            B.gars.push({ type: "cat", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w, r: 16 + w * 0.7, t: 0, dur: rnd(1500, 2400) * (hog ? 0.85 : 1),
              dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (B.kind === "trout") {
          if (roll < 0.16) {          // a waterlogged branch riding the current — not a rise
            B.gars.push({ type: "snag", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w: 0, r: 22, t: 0, dur: rnd(2400, 3400), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          } else {
            const brown = Math.random() < 0.18;
            const w = +(brown ? rnd(5, 14) : rnd(1, 4.2)).toFixed(1);
            B.gars.push({ type: "trout", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w, r: 14 + w * 1.6, t: 0, dur: rnd(1300, 2100) * (brown ? 0.85 : 1),
              dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (B.kind === "frog") {
          if (roll < 0.18) {          // cottonmouth working the bank — leave it alone
            B.gars.push({ type: "snake", x: rnd(W * 0.16, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w: 0, r: 24, t: 0, dur: rnd(2400, 3300), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          } else {                    // eyeshine in the pads
            const slab = Math.random() < 0.22;
            const w = +(slab ? rnd(1.4, 2.4) : rnd(0.4, 1.2)).toFixed(1);
            B.gars.push({ type: "frog", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.4),
              w, r: 13 + w * 5, t: 0, dur: rnd(1500, 2500) * (slab ? 0.85 : 1),
              dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (B.kind === "ghost") {
          if (roll < 0.12 && !B.fight) {   // HER — quick roll, glowing, once in a while
            const w = +rnd(15, 21).toFixed(1);
            B.gars.push({ type: "ghost", x: rnd(W * 0.2, W * 0.8), y: wl + 30 + rnd(0, (H - wl) * 0.38),
              w, r: 30, t: 0, dur: rnd(1000, 1400), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          } else {                    // dinks — they'll eat all night and waste your time
            const w = +rnd(0.8, 2.2).toFixed(1);
            B.gars.push({ type: "dink", x: rnd(W * 0.14, W * 0.8), y: wl + 24 + rnd(0, (H - wl) * 0.42),
              w, r: 12 + w * 2.5, t: 0, dur: rnd(1100, 1700), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
          }
        } else if (roll < 0.12) {          // beaver crossing, tail up
          B.gars.push({ type: "beaver", x: rnd(W * 0.16, W * 0.84), y: wl + 24 + rnd(0, (H - wl) * 0.45),
            w: 0, r: 24, t: 0, dur: rnd(2100, 2800), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
        } else if (roll < 0.22) {   // gator gliding, eyes and snout
          B.gars.push({ type: "gator", x: rnd(W * 0.16, W * 0.84), y: wl + 24 + rnd(0, (H - wl) * 0.5),
            w: 0, r: 30, t: 0, dur: rnd(2600, 3400), dir: Math.random() < 0.5 ? -1 : 1, hit: false });
        } else {
          const giant = Math.random() < 0.2;
          const w = +(giant ? rnd(15, 48) : rnd(3, 12)).toFixed(1);
          B.gars.push({ type: "gar", x: rnd(W * 0.14, W * 0.86), y: wl + 24 + rnd(0, (H - wl) * 0.5),
            w, r: 15 + w * 0.85, t: 0, dur: rnd(950, 1500) * (giant ? 0.82 : 1),
            dir: Math.random() < 0.5 ? -1 : 1, hit: false });
        }
      }
    }
    for (const g of B.gars) { g.t += dt; if (g.type === "beaver" || g.type === "gator" || g.type === "stump" || g.type === "snake" || g.type === "sand" || g.type === "snag") g.x += g.dir * dt * 0.012; }
    B.gars = B.gars.filter(g => g.t < g.dur && !g.hit);
    for (const a of B.arrows) {
      a.t += dt;
      if (!a.done && a.t >= a.dur) {
        a.done = true;
        if (B.kind === "cat") {
          const gc = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r + 6);
          splash(a.tx, a.ty);
          if (!gc) {
            B.quiver--; sfx("snap");
            if (B.quiver > 0) toast(`💪 Empty hole — scraped your arm on the timber! ${B.quiver} grip${B.quiver > 1 ? "s" : ""} left`);
            continue;
          }
          gc.hit = true;
          if (gc.type === "turtle") {
            B.quiver--; B.penalty += 350;
            B.hits.push({ x: gc.x, y: gc.y, t: 0, bad: "SNAPPER!! −350" });
            sfx("snap"); vibrate([90, 60, 90]);
            continue;
          }
          const kC = clamp((gc.w - 4) / 30, 0, 1);
          B.fight = { x: gc.x, y: gc.y, w: gc.w, r: gc.r, k: kC, dist: 1, strain: 0, state: "run", stT: rnd(600, 1100), dir: gc.dir, jp: 0, cat: true };
          toast(gc.w >= 15 ? "💪 <b>BIG FLATHEAD ON YOUR ARM!</b> Hold on — ease up when it rolls!" : "💪 Got one by the jaw — walk it out!");
          setBtn("HOLD ON", "reel"); showBtn(true);
          sfx("strike"); vibrate([50, 60, 50]);
          continue;
        }
        if (B.kind === "trout") {
          const gt = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r + 5);
          splash(a.tx, a.ty);
          if (!gt) {
            B.quiver--; sfx("snap");
            if (B.quiver > 0) toast(`🪶 Dragged the fly — put down the pool! ${B.quiver} fl${B.quiver > 1 ? "ies" : "y"} left`);
            continue;
          }
          gt.hit = true;
          if (gt.type === "snag") {
            B.quiver--; B.penalty += 200;
            B.hits.push({ x: gt.x, y: gt.y, t: 0, bad: "IN THE BRANCH! −200" });
            sfx("snap"); vibrate([60, 40, 60]);
            continue;
          }
          const kT = clamp((gt.w - 1) / 13, 0, 1);
          B.fight = { x: gt.x, y: gt.y, w: gt.w, r: gt.r, k: kT, dist: 1, strain: 0, state: "run", stT: rnd(600, 1100), dir: gt.dir, jp: 0, trout: true };
          toast(gt.w >= 5 ? "🪶 <b>BIG BROWN!</b> Hold to reel — let it run when it jumps!" : "🪶 Tight! Ease it back to the net.");
          setBtn("HOLD TO REEL", "reel"); showBtn(true);
          sfx("strike"); vibrate([30, 50, 30]);
          continue;
        }
        if (B.kind === "frog") {
          const gf = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r + 4);
          splash(a.tx, a.ty);
          if (!gf) {
            B.quiver--; sfx("snap"); vibrate([60, 40, 60]);
            if (B.quiver > 0) toast(`🔱 Stuck a cypress root — bent a gig! ${B.quiver} left`);
            continue;
          }
          gf.hit = true;
          if (gf.type === "snake") {
            B.quiver--; B.penalty += 400;
            B.hits.push({ x: gf.x, y: gf.y, t: 0, bad: "COTTONMOUTH!! −400" });
            for (const o of B.gars) if (o.type === "frog") o.hit = true;   // the thrash clears the pads
            B.spawnT = Math.max(B.spawnT, 2400);
            sfx("snap"); vibrate([90, 60, 90]);
            continue;
          }
          const upF = Math.sin(clamp(gf.t / gf.dur, 0, 1) * Math.PI);
          const qF = clamp(upF * 0.6 + clamp(1 - Math.hypot(gf.x - a.tx, gf.y - a.ty) / (gf.r + 4), 0, 1) * 0.4, 0, 1);
          B.haul.push(gf.w);
          B.t = Math.min(GAR_MS, B.t + 2500);
          B.hits.push({ x: gf.x, y: gf.y, t: 0, trick: `${gf.w >= 1.4 ? "SLAB BULL" : "GIGGED"}! ${gf.w} lb`, big: gf.w >= 1.4 && qF > 0.6 });
          sfx(gf.w >= 1.4 ? "lunker" : "land"); vibrate([25, 35, 25]);
          continue;
        }
        if (B.kind === "ghost") {
          const gg = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r + 6);
          splash(a.tx, a.ty);
          if (!gg) {
            B.quiver--; sfx("snap");
            if (B.quiver > 0) toast(`💥 Wrapped the dock pilings — snapped off! ${B.quiver} left`);
            continue;
          }
          gg.hit = true;
          if (gg.type === "dink") {     // a dink ate it — fun, but she's still out there
            B.haul.push(gg.w);
            B.t = Math.min(GAR_MS, B.t + 1500);
            B.hits.push({ x: gg.x, y: gg.y, t: 0, trick: `dink ${gg.w} lb` });
            sfx("land"); vibrate(15);
            continue;
          }
          // THE GHOST — hold on
          const kG = clamp(0.75 + (gg.w - 15) / 24, 0.75, 1);
          B.fight = { x: gg.x, y: gg.y, w: gg.w, r: gg.r, k: kG, dist: 1, strain: 0, state: "run", stT: rnd(500, 900), dir: gg.dir, jp: 0, ghost: true };
          toast("🌙 <b>IT'S HER!!</b> Hold to reel — let go when she jumps!");
          setBtn("HOLD TO REEL", "reel"); showBtn(true);
          sfx("strike"); vibrate([60, 60, 60, 60]);
          continue;
        }
        if (B.kind === "rc") {
          const g2r = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r + 6);
          splash(a.tx, a.ty);
          B.boat = { x: a.tx, y: a.ty };
          if (!g2r) {
            B.quiver--; sfx("snap"); vibrate([60, 40, 60]);
            if (B.quiver > 0) toast(`🌀 Flipped in the whitewater — busted a prop! ${B.quiver} left`);
            continue;
          }
          g2r.hit = true;
          if (g2r.type === "stump") {
            B.quiver--; B.penalty += 250;
            B.hits.push({ x: g2r.x, y: g2r.y, t: 0, bad: "SMASHED A STUMP! −250" });
            sfx("snap"); vibrate([70, 50, 70]);
            continue;
          }
          // a clean ramp is timing + line: peak surge, dead-center = huge air
          const up2 = Math.sin(clamp(g2r.t / g2r.dur, 0, 1) * Math.PI);
          const center = clamp(1 - Math.hypot(g2r.x - a.tx, g2r.y - a.ty) / (g2r.r + 6), 0, 1);
          const q = clamp(up2 * 0.55 + center * 0.45, 0, 1);
          const trick = q > 0.78 ? "SUPERMAN 720!!" : q > 0.52 ? "BACKFLIP 360!" : "KICKFLIP!";
          const tpts = Math.round((q > 0.78 ? 500 : q > 0.52 ? 300 : 150) * (1 + g2r.w * 0.16));
          B.haul.push(tpts);
          B.t = Math.min(GAR_MS, B.t + 3000);
          B.hits.push({ x: g2r.x, y: g2r.y, t: 0, trick: `${trick} +${tpts}`, big: q > 0.78 });
          B.air = { x: g2r.x, y: g2r.y, t: 0, dur: 750 + q * 550, q, dir: a.tx >= a.sx ? 1 : -1 };
          B.boat = { x: clamp(g2r.x + 34 * (a.tx >= a.sx ? 1 : -1), W * 0.1, W * 0.9), y: g2r.y + 8 };
          sfx(q > 0.78 ? "lunker" : "jump"); vibrate([20, 30, 40]);
          continue;
        }
        const g = B.gars.find(g2 => !g2.hit && g2.t < g2.dur && Math.hypot(g2.x - a.tx, g2.y - a.ty) < g2.r);
        splash(a.tx, a.ty);
        if (!g) {
          B.quiver--; sfx(B.kind === "sand" ? "snap" : "splash");
          if (B.quiver > 0) toast(B.kind === "sand" ? `💥 Hung up — line snapped! ${B.quiver} spoon${B.quiver > 1 ? "s" : ""} left`
            : `💦 Miss — ${B.quiver} arrow${B.quiver > 1 ? "s" : ""} left`);
          continue;
        }
        g.hit = true;
        if (g.type === "gar" && g.hazard) {   // the gar takes the spoon with it
          B.quiver--;
          B.hits.push({ x: g.x, y: g.y, t: 0, bad: "GAR BIT IT OFF!" });
          sfx("snap"); vibrate([70, 50, 70]);
          continue;
        }
        if (g.type === "sand") {              // hooked up — fight sized to the fish
          const k = clamp((g.w - 0.7) / 4, 0, 1);
          B.fight = { x: g.x, y: g.y, w: g.w, r: g.r, k, dist: 1, strain: 0, state: "run", stT: rnd(700, 1200), dir: g.dir, jp: 0 };
          toast(g.w >= 2.5 ? "🎣 STUCK A SLAB — hold to reel, let go when it jumps!" : "🎣 Hooked up — reel it to the boat!");
          setBtn("HOLD TO REEL", "reel"); showBtn(true);
          sfx("strike"); vibrate([30, 50, 30]);
          continue;
        }
        if (g.type === "beaver") {
          B.penalty += 300; B.quiver--;
          B.hits.push({ x: g.x, y: g.y, t: 0, bad: "NOT THE BEAVER! −300" });
          sfx("weak"); vibrate([70, 50, 70]);
        } else if (g.type === "gator") {
          B.penalty += 500; B.quiver--;
          B.hits.push({ x: g.x, y: g.y, t: 0, bad: "THAT'S A GATOR!! −500" });
          // the thrash spooks everything in the pool
          for (const o of B.gars) if (o.type === "gar") o.hit = true;
          B.spawnT = Math.max(B.spawnT, 2600);
          splash(g.x, g.y); splash(g.x + 14, g.y); splash(g.x - 14, g.y);
          sfx("snap"); vibrate([90, 60, 90]);
        } else {                    // every gar goes on the reel — size sets the fight
          const k = clamp((g.w - 3) / 45, 0, 1);
          B.fight = { x: g.x, y: g.y, w: g.w, r: g.r, k, dist: 1, strain: 0, state: "run", stT: rnd(700, 1200), dir: g.dir, jp: 0 };
          toast(g.w >= 15 ? "🏹 STUCK A GIANT — hold the reel, let go when it jumps!" : "🏹 Stuck one — reel it to the boat!");
          setBtn("HOLD TO REEL", "reel"); showBtn(true);
          sfx("strike"); vibrate([30, 50, 30]);
        }
      }
    }
    B.arrows = B.arrows.filter(a => a.t < a.dur + 350);
    for (const h of B.hits) h.t += dt;
    B.hits = B.hits.filter(h => h.t < 1100);
    if (B.air) { B.air.t += dt; if (B.air.t >= B.air.dur) { splash(B.boat.x, B.boat.y); sfx("splash"); B.air = null; } }
    if (B.quiver <= 0 && !B.over) { B.quiverOut = true; endBowfish(); return; }
    if (B.t <= 0) endBowfish();
  }
  function bowAnchor() {
    if (S.bow && S.bow.kind === "sand") return { x: W * 0.74 - 118, y: H - 316 };   // the rod tip
    if (S.bow && S.bow.kind === "frog") return { x: W * 0.74 - 96, y: H - 330 };    // the raised gig
    if (S.bow && S.bow.kind === "ghost") return { x: W * 0.74 - 118, y: H - 316 };  // night rod tip
    if (S.bow && S.bow.kind === "trout") return { x: W * 0.74 - 122, y: H - 322 };  // the fly rod reaches
    if (S.bow && S.bow.kind === "cat") return { x: W * 0.74 - 74, y: H - 238 };     // Bubba's reaching arm
    return { x: W * 0.74 - 70, y: H - 251 };                                        // the bow grip
  }
  function reelPoint() {
    let btnTop = H - 170;
    try { const br = el.actionBtn.getBoundingClientRect(); if (br && br.height) btnTop = br.top; } catch (e) {}
    return { x: W * 0.34, y: Math.max(waterLine() + 110, btnTop - 90) };
  }
  function bowShoot(x, y) {
    const B = S.bow; if (!B || B.over) return;
    if (B.fight) { B.holding = true; return; }           // mid-fight the tap IS the reel
    if (B.quiver <= 0) return;
    if (y < waterLine() + 6) return;                     // arrows go in the water
    if (B.kind === "rc") {
      if (B.air || B.arrows.some(a2 => !a2.done)) return;   // one boat, one run at a time
      const d2 = Math.hypot(x - B.boat.x, y - B.boat.y);
      B.shots++;
      B.arrows.push({ sx: B.boat.x, sy: B.boat.y, tx: x, ty: y, t: 0, dur: Math.max(240, d2 / 0.34), done: false });
      sfx("cast"); vibrate(10);
      return;
    }
    B.shots++;
    const ba = bowAnchor();
    B.arrows.push({ sx: ba.x, sy: ba.y, tx: x, ty: y, t: 0, dur: 170, done: false });
    sfx("cast"); vibrate(10);
  }
  function endBowfish() {
    const B = S.bow; if (!B || B.over) return;
    B.over = true; B.holding = false; showBtn(false);
    if (B.kind === "rc") { endRapids(B); return; }
    if (B.kind === "frog") { endFrog(B); return; }
    if (B.kind === "ghost") { endGhost(B); return; }
    if (B.kind === "trout") { endTrout(B); return; }
    if (B.kind === "cat") { endCat(B); return; }
    const total = +B.haul.reduce((a, w) => a + w, 0).toFixed(1);
    const big = B.haul.length ? Math.max(...B.haul) : 0;
    const sand = B.kind === "sand";
    const pts = Math.max(0, Math.round(total * (sand ? 220 : 60) + B.haul.length * 120) - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    if (sand) {
      G.sandTrips = (G.sandTrips || 0) + 1;
      G.sandCount = (G.sandCount || 0) + B.haul.length;
      G.sandBestHaul = Math.max(G.sandBestHaul || 0, total);
    } else {
      G.garTrips = (G.garTrips || 0) + 1;
      G.garCount = (G.garCount || 0) + B.haul.length;
      G.garBestHaul = Math.max(G.garBestHaul || 0, total);
    }
    evalAchievements(false);
    save(); updateHUD();
    sfx(B.haul.length ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = sand
      ? (B.quiverOut ? "That was the last spoon, James — the creek wins this round!" : B.haul.length ? "The marina wasn't lying — that's a MESS of sandies!" : "They were rolling everywhere and we couldn't hook one… don't tell the marina.")
      : (B.quiverOut ? "That's the last arrow, partner — we're done for tonight!" : B.haul.length ? "Now THAT'S bowfishing!" : "They rolled right past us — quicker on the draw next time!");
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>${sand ? "🥄" : "🏹"} <b>${B.haul.length}</b> ${sand ? "sand bass caught" : "gar arrowed"} · <b>${total.toFixed(1)} lb</b>${big ? ` · biggest <b>${big.toFixed(1)} lb</b>` : ""}<br>
      🎯 <b>+${pts.toLocaleString()}</b> points${B.penalty ? ` <span style="color:#ff9d8a">(−${B.penalty} for the wildlife…)</span>` : ""}${(sand ? G.sandBestHaul : G.garBestHaul) === total && B.haul.length ? " · best haul yet!" : ""}</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  function endRapids(B) {
    const tricks = B.haul.length;
    const total = Math.round(B.haul.reduce((a, b) => a + b, 0));
    const pts = Math.max(0, total - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    G.rcTrips = (G.rcTrips || 0) + 1;
    G.rcTricks = (G.rcTricks || 0) + tricks;
    G.rcBest = Math.max(G.rcBest || 0, pts);
    evalAchievements(false);
    save(); updateHUD();
    sfx(tricks ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = B.quiverOut ? "Bro, that's all three props in the drink — pits are closed!"
      : tricks ? "DUUUDE, that boat was FLYING! The marina's gonna hear about this."
      : "All gas, no air, bro — we'll send it next time!";
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>🚤 <b>${tricks}</b> trick${tricks === 1 ? "" : "s"} landed<br>
      🎯 <b>+${pts.toLocaleString()}</b> points${B.penalty ? ` <span style="color:#ff9d8a">(−${B.penalty} for the lumber…)</span>` : ""}${G.rcBest === pts && tricks ? " · best run yet!" : ""}</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  // 🚤 RAPIDS RUN gets its own scene: high-noon canyon light, whitewater lanes
  // sliding downstream, ramp rocks baring in the surge, Hot Rod on the gravel
  // bar with the transmitter, and one very loud little boat
  function renderRapids(now) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#5db6e8"); g.addColorStop(0.7, "#a8d9f2"); g.addColorStop(1, "#d9eef8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,244,200,0.95)";
    ctx.beginPath(); ctx.arc(W * 0.78, 54, 20, 0, Math.PI * 2); ctx.fill();
    // canyon walls crowd the gorge, the river gap up the middle
    const wallRow = (y, h, col, step, off) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = -10; x < W + 20; x += step) {
        const ph = h * (0.55 + 0.45 * Math.abs(Math.sin((x + off) * 0.11)));
        const mid = Math.abs(x - W * 0.5) / (W * 0.5);
        const hh = ph * (0.2 + mid * 1.0);
        ctx.lineTo(x, y - hh); ctx.lineTo(x + step * 0.55, y - hh * 0.55);
      }
      ctx.lineTo(W + 20, y); ctx.closePath(); ctx.fill();
    };
    wallRow(wl, 130, "#8a7663", 42, 8);
    wallRow(wl + 2, 88, "#6e5c4c", 30, 52);
    // pointed firs on the rim
    ctx.fillStyle = "#3f5237";
    for (let x = 8; x < W; x += 46) {
      const mid = Math.abs(x - W * 0.5) / (W * 0.5);
      if (mid < 0.28) continue;
      const th = 20 + 14 * Math.abs(Math.sin(x * 0.7)), ty2 = wl - 60 * (0.2 + mid);
      ctx.beginPath(); ctx.moveTo(x, ty2); ctx.lineTo(x - 8, ty2 + th); ctx.lineTo(x + 8, ty2 + th); ctx.closePath(); ctx.fill();
    }
    // the river: cold mountain water, whitewater lanes sliding downstream
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#4a92a4"); g.addColorStop(0.5, "#2d6478"); g.addColorStop(1, "#1c4152");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    // standing waves piling across the gorge — this is RAPIDS water
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = "#dff2fa"; ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const yy = wl + 26 + i * ((H - wl) / 6.4);
      ctx.beginPath(); ctx.moveTo(0, yy);
      for (let x = 0; x <= W; x += 26) ctx.lineTo(x + 13, yy + Math.sin(x * 0.11 + now / 260 + i * 2) * 5 - 4), ctx.lineTo(x + 26, yy);
      ctx.stroke();
    }
    ctx.restore();
    // whitewater streaks racing downstream
    ctx.save(); ctx.strokeStyle = "#f2fbff"; ctx.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const lane = W * (0.08 + 0.84 * ((i * 61) % 100) / 100);
      const yy = wl + ((now * (0.09 + (i % 3) * 0.03) + i * 67) % (H - wl));
      const near = (yy - wl) / (H - wl);
      ctx.globalAlpha = 0.18 + near * 0.3;
      ctx.lineWidth = 1.6 + near * 2.4;
      ctx.beginPath(); ctx.moveTo(lane - 6 - near * 8, yy); ctx.quadraticCurveTo(lane, yy + 9 + near * 6, lane + 7 + near * 9, yy + 3); ctx.stroke();
    }
    // drifting foam flecks
    ctx.fillStyle = "#f2fbff";
    for (let i = 0; i < 16; i++) {
      const fx = W * (0.1 + 0.8 * ((i * 37) % 100) / 100);
      const fy = wl + ((now * 0.07 + i * 113) % (H - wl));
      ctx.globalAlpha = 0.14 + ((fy - wl) / (H - wl)) * 0.22;
      ctx.beginPath(); ctx.ellipse(fx, fy, 3.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // what the surge shows: ramp rocks bare, stumps ride the current
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.translate(gr.x, gr.y);
      if (gr.type === "stump") {
        ctx.scale(gr.dir, 1);
        ctx.globalAlpha = 0.6 + up * 0.4;
        ctx.fillStyle = "#4a3620";
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5c452a";
        ctx.beginPath(); ctx.ellipse(10, -4, 6, 4.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(12, -7); ctx.lineTo(17, -13); ctx.moveTo(7, -8); ctx.lineTo(8, -13); ctx.stroke();
        ctx.strokeStyle = "rgba(207,228,239,0.4)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-20, 3); ctx.lineTo(-29, 6); ctx.stroke();
      } else {
        const r2 = gr.r * (0.55 + up * 0.45);
        ctx.globalAlpha = 0.5 + up * 0.5;
        ctx.fillStyle = "#7d8790";
        ctx.beginPath(); ctx.moveTo(-r2, 4); ctx.quadraticCurveTo(-r2 * 0.5, -r2 * 0.75, r2 * 0.15, -r2 * 0.6);
        ctx.quadraticCurveTo(r2 * 0.7, -r2 * 0.4, r2, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#99a4ad";
        ctx.beginPath(); ctx.moveTo(-r2 * 0.6, 0); ctx.quadraticCurveTo(-r2 * 0.2, -r2 * 0.62, r2 * 0.12, -r2 * 0.5);
        ctx.lineTo(r2 * 0.2, 0); ctx.closePath(); ctx.fill();
        const churn = 0.7 + 0.3 * Math.sin(now / 90 + gr.x);
        ctx.globalAlpha = (0.35 + up * 0.65) * churn;
        ctx.fillStyle = "#f2fbff";
        // whitewater piles on the upstream face and rags off downstream
        ctx.beginPath(); ctx.ellipse(-r2 * 0.55, 3, r2 * 0.5, 4.5 + up * 3, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r2 * 0.2, 5.5, r2 * 0.4, 3 + up * 2, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha *= 0.7;
        ctx.beginPath(); ctx.ellipse(r2 * 0.55, 5, r2 * 0.35, 2.6, 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r2 * 0.45, -r2 * 0.35, 3.5 + up * 2.5, 2.4, -0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // ---- the boat: running a line, airborne mid-trick, or idling on station ----
    const drawBoat = (bx, by, ang, airLift, spin) => {
      ctx.save(); ctx.translate(bx, by - airLift); ctx.rotate(ang + spin);
      ctx.fillStyle = "#d8dee2";
      ctx.beginPath(); ctx.moveTo(-16, 3); ctx.quadraticCurveTo(0, 7, 17, 2); ctx.lineTo(14, -1); ctx.lineTo(-15, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#d33a2c";
      ctx.beginPath(); ctx.moveTo(-15, -1); ctx.lineTo(14, -1); ctx.quadraticCurveTo(18, -2.5, 15, -4.5); ctx.lineTo(-12, -4.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#20262c";
      ctx.beginPath(); ctx.ellipse(-2, -5.5, 6, 3.4, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#ffd35c"; ctx.font = "800 6px system-ui"; ctx.textAlign = "center";
      ctx.fillText("7", 7, -1.2);
      ctx.restore();
    };
    const run = B.arrows.find(a2 => !a2.done);
    if (run) {
      const p = Math.min(1, run.t / run.dur);
      const bx = run.sx + (run.tx - run.sx) * p, by = run.sy + (run.ty - run.sy) * p;
      ctx.save(); ctx.fillStyle = "#f2fbff";   // rooster tail chasing the hull
      for (let i = 1; i <= 4; i++) {
        const tp = Math.max(0, p - i * 0.05);
        const wx = run.sx + (run.tx - run.sx) * tp, wy = run.sy + (run.ty - run.sy) * tp;
        ctx.globalAlpha = 0.55 - i * 0.11;
        ctx.beginPath(); ctx.ellipse(wx, wy + 2, 8 - i, 4 - i * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      drawBoat(bx, by + Math.sin(now / 45) * 1.4, Math.atan2(run.ty - run.sy, run.tx - run.sx) * 0.22, 0, 0);
    } else if (B.air) {
      const p2 = B.air.t / B.air.dur;
      const lift = Math.sin(p2 * Math.PI) * (46 + B.air.q * 52);
      const spins = (1 + Math.round(B.air.q * 2)) * Math.PI * 2 * (B.air.dir || 1);
      drawBoat(B.air.x + p2 * 30 * (B.air.dir || 1), B.air.y, 0, lift, p2 * spins);
    } else {
      drawBoat(B.boat.x, B.boat.y + Math.sin(now / 300) * 2, Math.sin(now / 500) * 0.06, 0, 0);
      ctx.save(); ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now / 200); ctx.fillStyle = "#f2fbff";
      ctx.beginPath(); ctx.ellipse(B.boat.x - 18, B.boat.y + 3, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // trick + crash callouts float up
    for (const h of B.hits) {
      const p = h.t / 1100;
      ctx.save(); ctx.globalAlpha = 1 - p;
      const msg2 = h.bad || h.trick || "";
      ctx.font = "800 " + (h.bad ? 17 : h.big ? 24 : 18) + "px system-ui"; ctx.textAlign = "center";
      ctx.fillStyle = h.bad ? "#ff5d5d" : h.big ? "#ffd35c" : "#8fe3a0";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
      const ty = h.y - 24 - p * 34;
      const hx2 = clamp(h.x, 70, W - 70);
      ctx.strokeText(msg2, hx2, ty); ctx.fillText(msg2, hx2, ty);
      ctx.restore();
    }
    // the gravel bar off the right corner, and Hot Rod on it
    const bkT = H - 150;
    ctx.fillStyle = "#9a8668";
    ctx.beginPath(); ctx.moveTo(W * 0.3, H);
    ctx.quadraticCurveTo(W * 0.52, bkT + 14, W + 6, bkT - 10);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b09a78";
    ctx.beginPath(); ctx.moveTo(W * 0.42, H);
    ctx.quadraticCurveTo(W * 0.6, bkT + 30, W + 6, bkT + 12);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#7d8790";
    ctx.beginPath(); ctx.ellipse(W * 0.56, H - 56, 14, 6, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W * 0.9, H - 118, 10, 5, -0.15, 0, Math.PI * 2); ctx.fill();
    const px = W * 0.74, bankY = H - 124, SC = 1.85;
    ctx.save(); ctx.translate(px, bankY); ctx.scale(SC, SC);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2c3238"; ctx.lineWidth = 9;   // legs planted in the gravel
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-5, -30); ctx.moveTo(11, 0); ctx.lineTo(8, -30); ctx.stroke();
    ctx.fillStyle = "#c8362b";                        // the red racing tee
    ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(-13, -56, -7, -60);
    ctx.lineTo(9, -60); ctx.quadraticCurveTo(14, -54, 12, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#eaeef0"; ctx.fillRect(-11, -47, 23, 4);   // white racing stripe
    ctx.fillStyle = "#dfae85"; ctx.beginPath(); ctx.arc(-4, -71, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c2025";                        // wraparound shades
    ctx.beginPath(); ctx.ellipse(-8.5, -71.5, 4.8, 2.5, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c8362b";                        // red cap, brim at the water
    ctx.beginPath(); ctx.arc(-4, -74, 10, Math.PI * 0.9, Math.PI * 2.02); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-12, -75.5, 8, 3, 0.12, 0, Math.PI * 2); ctx.fill();
    // both arms forward onto the transmitter
    ctx.strokeStyle = "#c8362b"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-19, -47); ctx.stroke();
    ctx.strokeStyle = "#b02f25"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(6, -56); ctx.lineTo(-11, -45); ctx.stroke();
    // the transmitter: box in both hands, antenna out over the water
    ctx.save(); ctx.translate(-18, -44); ctx.rotate(-0.12);
    ctx.fillStyle = "#23292f"; ctx.beginPath(); ctx.roundRect(-10, -7, 21, 14, 3); ctx.fill();
    ctx.fillStyle = "#3a424a"; ctx.beginPath(); ctx.roundRect(-8, -5, 17, 5, 2); ctx.fill();
    ctx.strokeStyle = "#8a949c"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-26, -31); ctx.stroke();
    ctx.fillStyle = "#ff5d5d"; ctx.beginPath(); ctx.arc(-26, -31, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#dfae85";
    ctx.beginPath(); ctx.arc(-4.5, -0.5, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -0.5, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#12161a";
    ctx.beginPath(); ctx.arc(-4.5, -2.2, 1.4, 0, Math.PI * 2); ctx.arc(6, -2.2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
    // canvas HUD: props, clock, tricks, points
    const sec = Math.max(0, Math.ceil(B.t / 1000));
    const total = Math.round(B.haul.reduce((a2, b2) => a2 + b2, 0));
    ctx.save(); ctx.font = "700 15px system-ui"; ctx.textAlign = "center";
    const msg = `${"🌀".repeat(Math.max(0, B.quiver))}${"·".repeat(3 - Math.max(0, B.quiver))}  ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}  ·  ${B.haul.length} trick${B.haul.length === 1 ? "" : "s"} · ${total.toLocaleString()} pts`;
    const tw = ctx.measureText(msg).width + 26;
    ctx.fillStyle = "rgba(6,26,36,0.72)";
    ctx.beginPath(); ctx.roundRect((W - tw) / 2, 14, tw, 30, 15); ctx.fill();
    ctx.fillStyle = sec <= 10 ? "#ff9d8a" : "#eaf6fb"; ctx.fillText(msg, W / 2, 34);
    ctx.restore();
  }
  function endCat(B) {
    const total = +B.haul.reduce((a, w) => a + w, 0).toFixed(1);
    const big = B.haul.length ? Math.max(...B.haul) : 0;
    const pts = Math.max(0, Math.round(total * 80 + B.haul.length * 150) - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    G.catTrips = (G.catTrips || 0) + 1;
    G.catCount = (G.catCount || 0) + B.haul.length;
    G.catBestHaul = Math.max(G.catBestHaul || 0, total);
    evalAchievements(false);
    save(); updateHUD();
    sfx(B.haul.length ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = B.quiverOut ? "That arm's done for the day, Bubba — the bluff wins this one!"
      : B.haul.length ? "Wrestled 'em out BARE-HANDED. Fish fry's at your place, big man!"
      : "All them holes and every one empty… they heard you coming, Bubba.";
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>💪 <b>${B.haul.length}</b> flathead${B.haul.length === 1 ? "" : "s"} wrestled in · <b>${total.toFixed(1)} lb</b>${big ? ` · biggest <b>${big.toFixed(1)} lb</b>` : ""}<br>
      🎯 <b>+${pts.toLocaleString()}</b> points${B.penalty ? ` <span style="color:#ff9d8a">(−${B.penalty} for the snapper…)</span>` : ""}${G.catBestHaul === total && B.haul.length ? " · best haul yet!" : ""}</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  // 💪 THE BLUFF — Bubba's noodling hole: late sun on the bluff wall, boils
  // churning over sunken timber, and fingers where fingers shouldn't go
  function renderCat(now) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#e8b46a"); g.addColorStop(0.6, "#d98d4e"); g.addColorStop(1, "#c8703c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,240,200,0.95)";
    ctx.beginPath(); ctx.arc(W * 0.22, 64, 22, 0, Math.PI * 2); ctx.fill();
    // the bluff wall: stacked rock ledges across the far bank
    ctx.fillStyle = "#6e5040";
    ctx.fillRect(0, wl - 92, W, 92);
    ctx.fillStyle = "#7e5c48";
    for (let i = 0; i < 4; i++) {
      const ly = wl - 84 + i * 22;
      ctx.beginPath(); ctx.moveTo(0, ly);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x + 12, ly + Math.sin(x * 0.3 + i * 5) * 3);
      ctx.lineTo(W, ly + 8); ctx.lineTo(0, ly + 8); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "#5c4234";
    ctx.beginPath(); ctx.moveTo(0, wl - 92);
    for (let x = 0; x <= W; x += 36) ctx.lineTo(x + 18, wl - 92 - 10 - 14 * Math.abs(Math.sin(x * 0.08)));
    ctx.lineTo(W, wl - 92); ctx.closePath(); ctx.fill();
    // cedar scrub on top
    ctx.fillStyle = "#4a5a38";
    for (let x = 12; x < W; x += 42) { ctx.beginPath(); ctx.ellipse(x, wl - 104 - 8 * Math.abs(Math.sin(x)), 13, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    // deep green reservoir water
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#3f7458"); g.addColorStop(0.5, "#28513e"); g.addColorStop(1, "#16332a");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = "#ffe9b8";
    for (let i = 0; i < 7; i++) { const yy = wl + 10 + i * 14; ctx.fillRect(W * 0.22 - (26 - i * 3) / 2 + Math.sin(now / 900 + i) * 4, yy, 26 - i * 3, 2); }
    ctx.restore();
    // sunken timber poking through
    ctx.strokeStyle = "#3a2c1e"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(W * 0.16, wl + 60); ctx.lineTo(W * 0.24, wl + 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.62, wl + 100); ctx.lineTo(W * 0.56, wl + 40); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W * 0.22, wl + 30); ctx.lineTo(W * 0.28, wl + 22); ctx.stroke();
    // the holes at work: boils churn, snappers cruise
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.translate(gr.x, gr.y);
      if (gr.type === "turtle") {
        ctx.scale(gr.dir, 1);
        ctx.globalAlpha = 0.55 + up * 0.45;
        ctx.fillStyle = "#3e4a30";
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, Math.PI, 0); ctx.fill();      // shell dome
        ctx.strokeStyle = "#2c3622"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.stroke();
        ctx.fillStyle = "#4a5238";
        ctx.beginPath(); ctx.ellipse(16, -2, 5.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();  // the head
        ctx.fillStyle = "#ffd35c"; ctx.beginPath(); ctx.arc(17.5, -3.4, 1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(207,228,239,0.35)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-16, 2); ctx.lineTo(-24, 5); ctx.stroke();
      } else {
        // a flathead working the hole: slick boil, bubbles, a tail kick
        const hog = gr.w >= 15;
        ctx.globalAlpha = 0.35 + up * 0.5;
        ctx.fillStyle = "#1c3a2e";
        ctx.beginPath(); ctx.ellipse(0, 2, gr.r * 1.15, gr.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();  // the slick
        ctx.globalAlpha = 0.5 + up * 0.5;
        ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(0, 2, gr.r * (0.5 + p * 0.8), gr.r * 0.32 * (0.5 + p * 0.8), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(240,248,252,0.75)";
        for (let i = 0; i < (hog ? 6 : 4); i++) {
          const bx = Math.sin(i * 2.1 + now / 160) * gr.r * 0.5, by = Math.cos(i * 1.7 + now / 200) * gr.r * 0.2;
          ctx.beginPath(); ctx.arc(bx, by, 1.6 + (i % 2), 0, Math.PI * 2); ctx.fill();
        }
        if (up > 0.5) {   // tail breaks the surface on the roll
          ctx.globalAlpha = up;
          ctx.fillStyle = hog ? "#5c4a2e" : "#6a563a";
          ctx.beginPath(); ctx.moveTo(gr.dir * gr.r * 0.5, 0); ctx.quadraticCurveTo(gr.dir * gr.r * 0.9, -8 * up, gr.dir * gr.r * 1.1, 2); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    renderBowShared(now, "cat");
  }
  function endTrout(B) {
    const total = +B.haul.reduce((a, w) => a + w, 0).toFixed(1);
    const big = B.haul.length ? Math.max(...B.haul) : 0;
    const pts = Math.max(0, Math.round(total * 260 + B.haul.length * 120) - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    G.troutTrips = (G.troutTrips || 0) + 1;
    G.troutCount = (G.troutCount || 0) + B.haul.length;
    G.troutBestHaul = Math.max(G.troutBestHaul || 0, total);
    evalAchievements(false);
    save(); updateHUD();
    sfx(B.haul.length ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = B.quiverOut ? "Last fly's in a tree somewhere, Alisa — the browns win the morning!"
      : B.haul.length ? "Soft hands, big browns. The bass guys would NOT believe this."
      : "They sipped everything but ours… we'll match the hatch next time.";
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>🪶 <b>${B.haul.length}</b> trout netted · <b>${total.toFixed(1)} lb</b>${big ? ` · biggest <b>${big.toFixed(1)} lb</b>` : ""}<br>
      🎯 <b>+${pts.toLocaleString()}</b> points${B.penalty ? ` <span style="color:#ff9d8a">(−${B.penalty} for the lumber…)</span>` : ""}${G.troutBestHaul === total && B.haul.length ? " · best morning yet!" : ""}</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  // 🪶 FIRST LIGHT — Alisa's tailwater dawn: mist bands, rise rings, a fly line
  function renderTrout(now) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#8fa8c8"); g.addColorStop(0.55, "#d8b8a8"); g.addColorStop(1, "#f2d8be");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,236,200,0.9)";
    ctx.beginPath(); ctx.arc(W * 0.3, wl - 26, 20, 0, Math.PI * 2); ctx.fill();
    const wallRow = (y, h, col, step, off) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = -10; x < W + 20; x += step) {
        const ph = h * (0.55 + 0.45 * Math.abs(Math.sin((x + off) * 0.11)));
        const mid = Math.abs(x - W * 0.5) / (W * 0.5);
        const hh = ph * (0.2 + mid * 1.0);
        ctx.lineTo(x, y - hh); ctx.lineTo(x + step * 0.55, y - hh * 0.55);
      }
      ctx.lineTo(W + 20, y); ctx.closePath(); ctx.fill();
    };
    wallRow(wl, 120, "#7a7488", 42, 8);
    wallRow(wl + 2, 80, "#5e5a70", 30, 52);
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#6c8ba0"); g.addColorStop(0.5, "#3d5a6e"); g.addColorStop(1, "#243c4c");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    // mist bands hanging over the water
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const my = wl + 16 + i * 34, drift = Math.sin(now / (2200 + i * 500)) * 20;
      ctx.globalAlpha = 0.12 + i * 0.02;
      ctx.fillStyle = "#f4ece2";
      ctx.beginPath(); ctx.ellipse(W * (0.3 + i * 0.15) + drift, my, 120, 11, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // gentle current lines
    ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = "#dff2fa"; ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const yy = wl + 26 + i * ((H - wl) / 7);
      ctx.beginPath(); ctx.moveTo(0, yy + Math.sin(now / 1100 + i * 2) * 3); ctx.bezierCurveTo(W * 0.3, yy - 4, W * 0.7, yy + 4, W, yy); ctx.stroke();
    }
    ctx.restore();
    // rises: spreading rings with a sipping snout; snags ride the current
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.translate(gr.x, gr.y);
      if (gr.type === "snag") {
        ctx.scale(gr.dir, 1);
        ctx.globalAlpha = 0.55 + up * 0.45;
        ctx.strokeStyle = "#4a3a28"; ctx.lineWidth = 4.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-20, 2); ctx.lineTo(18, -2); ctx.stroke();
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(10, -9); ctx.moveTo(-8, 1); ctx.lineTo(-4, -7); ctx.stroke();
        ctx.strokeStyle = "rgba(223,242,250,0.4)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-26, 4); ctx.lineTo(-33, 7); ctx.stroke();
      } else {
        const brown = gr.w >= 5;
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.strokeStyle = "#eef6fa"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(0, 2, 6 + p * gr.r * 1.6, (6 + p * gr.r * 1.6) * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = (1 - p) * 0.5;
        ctx.beginPath(); ctx.ellipse(0, 2, 3 + p * gr.r, (3 + p * gr.r) * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
        if (up > 0.35) {   // the sip: a snout & dorsal breaking the film
          ctx.globalAlpha = up;
          ctx.fillStyle = brown ? "#8a6b34" : "#7d8a6a";
          ctx.beginPath(); ctx.ellipse(gr.dir * 3, 0, gr.r * 0.5, 3.6 * up, 0, Math.PI, 0); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-gr.dir * gr.r * 0.3, 0); ctx.lineTo(-gr.dir * gr.r * 0.42, -5 * up); ctx.lineTo(-gr.dir * gr.r * 0.5, 0); ctx.closePath(); ctx.fill();
          if (brown) { ctx.fillStyle = "#c8a04a"; ctx.beginPath(); ctx.ellipse(gr.dir * 5, 1, gr.r * 0.26, 2 * up, 0, Math.PI, 0); ctx.fill(); }
        }
      }
      ctx.restore();
    }
    renderBowShared(now, "trout");
  }
  function endFrog(B) {
    const total = +B.haul.reduce((a, w) => a + w, 0).toFixed(1);
    const pts = Math.max(0, Math.round(total * 300 + B.haul.length * 100) - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    G.frogTrips = (G.frogTrips || 0) + 1;
    G.frogCount = (G.frogCount || 0) + B.haul.length;
    G.frogBestHaul = Math.max(G.frogBestHaul || 0, total);
    evalAchievements(false);
    save(); updateHUD();
    sfx(B.haul.length ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = B.quiverOut ? "That's the last gig, Old Dog — bayou keeps the rest tonight!"
      : B.haul.length ? "Frog legs for the whole crew — fire up the fryer!"
      : "All them eyes and not one frog… they were laughing at us.";
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>🔱 <b>${B.haul.length}</b> frog${B.haul.length === 1 ? "" : "s"} gigged · <b>${total.toFixed(1)} lb</b><br>
      🎯 <b>+${pts.toLocaleString()}</b> points${B.penalty ? ` <span style="color:#ff9d8a">(−${B.penalty} for the snake…)</span>` : ""}${G.frogBestHaul === total && B.haul.length ? " · best haul yet!" : ""}</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  function endGhost(B) {
    const got = !!B.ghostW;
    const dinks = B.haul.length;
    const pts = Math.max(0, (got ? 5000 + Math.round(B.ghostW * 100) : 0) + dinks * 80 - B.penalty);
    G.coins += pts; addAnglerXP(pts);
    G.ghostTrips = (G.ghostTrips || 0) + 1;
    if (got) { G.ghostCaught = (G.ghostCaught || 0) + 1; G.ghostBest = Math.max(G.ghostBest || 0, B.ghostW); }
    evalAchievements(false);
    save(); updateHUD();
    sfx(got ? "weighwin" : "weighin");
    el.garFace.innerHTML = anglerSVG(ANGLERS.find(a => a.id === "roberto"), false);
    const say = got ? `${B.ghostW} pounds. …And THAT is why they tell stories about this place. The legend's real, and you're in it now.`
      : B.quiverOut ? "Three lures in the pilings — she wins tonight. She always wins."
      : "She's still down there. Some nights I swear I can hear her.";
    el.garBody.innerHTML = `<p><b>Roberto:</b> “${say}”</p>
      <p>${got ? `🌙 <b>THE GHOST OF LILY COVE — ${B.ghostW} lb</b><br>` : ""}🎣 ${dinks} dink${dinks === 1 ? "" : "s"} on the side<br>
      🎯 <b>+${pts.toLocaleString()}</b> points</p>`;
    el.garYes.textContent = "🎣 BACK TO THE BASS";
    el.garNo.classList.add("hidden");
    el.garModal.classList.remove("hidden");
  }
  // 🔱 FROG GIGGING — Old Dog's bayou night: moss, moonlight, a headlamp beam,
  // and eyeshine in the pads
  function renderFrog(now) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#0a0e2a"); g.addColorStop(0.7, "#141c3a"); g.addColorStop(1, "#1d2a44");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 24; i++) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(i * 7 + now / 900)); ctx.fillRect((i * 73) % W, (i * 41) % (wl - 60), 1.6, 1.6); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f4ecd0"; ctx.beginPath(); ctx.arc(W * 0.2, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a0e2a"; ctx.beginPath(); ctx.arc(W * 0.2 - 10, 62, 24, 0, Math.PI * 2); ctx.fill();
    // cypress silhouettes with hanging moss
    const cyp = (x, h) => {
      ctx.fillStyle = "#050a18";
      ctx.fillRect(x - 5, wl - h, 10, h);
      ctx.beginPath(); ctx.moveTo(x - 26, wl - h + 8); ctx.quadraticCurveTo(x, wl - h - 26, x + 26, wl - h + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 16, wl - 2); ctx.lineTo(x - 5, wl - 26); ctx.lineTo(x + 5, wl - 26); ctx.lineTo(x + 16, wl - 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#0d1526"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      for (const mx of [-18, -8, 6, 16]) { ctx.beginPath(); ctx.moveTo(x + mx, wl - h + 6); ctx.lineTo(x + mx + 2, wl - h + 22 + Math.sin(now / 800 + mx) * 2); ctx.stroke(); }
    };
    cyp(30, 96); cyp(96, 128); cyp(W - 40, 110); cyp(W - 110, 88); cyp(W * 0.5 - 8, 70);
    // black-tea water with the moon streak
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#101a2e"); g.addColorStop(0.5, "#0a1220"); g.addColorStop(1, "#060c16");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = "#f4ecd0";
    for (let i = 0; i < 8; i++) { const yy = wl + 10 + i * 15; ctx.fillRect(W * 0.2 - (30 - i * 3) / 2 + Math.sin(now / 800 + i) * 5, yy, 30 - i * 3, 2); }
    ctx.restore();
    // the headlamp beam sweeping from the boat toward the pads
    const px = W * 0.74, deckY = H - 138;
    ctx.save();
    const hb = ctx.createRadialGradient(px - 20, deckY - 128, 10, px - 20, deckY - 128, H * 0.75);
    hb.addColorStop(0, "rgba(255,244,190,0.28)"); hb.addColorStop(0.5, "rgba(255,244,190,0.1)"); hb.addColorStop(1, "rgba(255,244,190,0)");
    ctx.fillStyle = hb;
    ctx.beginPath(); ctx.moveTo(px - 20, deckY - 128);
    ctx.lineTo(W * 0.02, wl + 30); ctx.lineTo(W * 0.62, wl + 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    // lily pads
    ctx.fillStyle = "#12251c";
    for (let i = 0; i < 10; i++) {
      const lx = W * (0.08 + 0.7 * ((i * 47) % 100) / 100), ly = wl + 20 + ((i * 89) % Math.max(40, (H - wl) * 0.5));
      ctx.beginPath(); ctx.ellipse(lx, ly, 16, 6, 0.1, 0.25, Math.PI * 2.1); ctx.fill();
    }
    // what the light finds: frog eyeshine, and the wrong kind of ripple
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.translate(gr.x, gr.y);
      if (gr.type === "snake") {
        ctx.scale(gr.dir, 1);
        ctx.globalAlpha = 0.5 + up * 0.5;
        ctx.strokeStyle = "#1c2a1e"; ctx.lineWidth = 5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-24, 2);
        for (let sx2 = -24; sx2 <= 16; sx2 += 8) ctx.lineTo(sx2, 2 + Math.sin(sx2 * 0.4 + now / 120) * 4);
        ctx.stroke();
        ctx.fillStyle = "#26361f"; ctx.beginPath(); ctx.ellipse(20, 0, 6.5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffd35c"; ctx.beginPath(); ctx.arc(22, -1.6, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(207,228,239,0.3)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(26, -2); ctx.lineTo(34, -5); ctx.moveTo(26, 2); ctx.lineTo(34, 5); ctx.stroke();
      } else {
        // the eyes give it away first — two hot coals over a faint frog
        const shine = 0.35 + up * 0.65;
        ctx.globalAlpha = shine * 0.5;
        ctx.fillStyle = "#2c3d24";
        ctx.beginPath(); ctx.ellipse(0, 2, gr.r * 0.62, gr.r * 0.34, 0, Math.PI, 0); ctx.fill();   // squat body
        ctx.globalAlpha = shine;
        for (const ex of [-4.5, 4.5]) {
          ctx.fillStyle = "rgba(255,220,120," + (0.35 + up * 0.5) + ")";
          ctx.beginPath(); ctx.arc(ex, -gr.r * 0.3, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffe9a0"; ctx.beginPath(); ctx.arc(ex, -gr.r * 0.3, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 0.25 * up; ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, 4, gr.r * 1.1, 5, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    renderBowShared(now, "frog");
  }
  // 🌙 THE GHOST OF LILY COVE — Roberto's finale: moonlit dock, fireflies,
  // dinks rolling… and sometimes something much, much bigger
  function renderGhost(now) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#0c1230"); g.addColorStop(0.65, "#1a2448"); g.addColorStop(1, "#2a3a5e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 20; i++) { ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(i * 5 + now / 1100)); ctx.fillRect((i * 91) % W, (i * 53) % (wl - 80), 1.6, 1.6); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f7f1da"; ctx.beginPath(); ctx.arc(W * 0.68, 78, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(230,224,200,0.5)"; ctx.beginPath(); ctx.arc(W * 0.68 - 10, 70, 6, 0, Math.PI * 2); ctx.arc(W * 0.68 + 8, 86, 4, 0, Math.PI * 2); ctx.fill();
    // treeline + THE old dock, left
    ctx.fillStyle = "#0a1024";
    ctx.beginPath(); ctx.moveTo(0, wl);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, wl - 26 - 20 * Math.abs(Math.sin(x * 0.05)));
    ctx.lineTo(W, wl); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0d1526";
    ctx.fillRect(8, wl - 34, 118, 8);                                   // dock deck
    for (const dx of [16, 52, 88, 118]) ctx.fillRect(dx, wl - 28, 6, 42); // pilings into the water
    ctx.fillStyle = "#0a1020"; ctx.fillRect(30, wl - 58, 8, 26); ctx.fillRect(26, wl - 62, 46, 8);   // old lamp post arm
    // still night water, moon river
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#182448"); g.addColorStop(0.5, "#101a36"); g.addColorStop(1, "#0a1226");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = "#f7f1da";
    for (let i = 0; i < 9; i++) { const yy = wl + 12 + i * 15; ctx.fillRect(W * 0.68 - (44 - i * 4) / 2 + Math.sin(now / 750 + i) * 5, yy, 44 - i * 4, 2.4); }
    ctx.restore();
    // fireflies drifting the bank
    for (let i = 0; i < 7; i++) {
      const fx = (i * 67 + now * 0.008 * (i % 2 ? 1 : -1)) % W, fy = wl - 12 - (i * 23) % 60;
      ctx.save(); ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(now / 500 + i * 3));
      ctx.fillStyle = "#c8f57a"; ctx.beginPath(); ctx.arc((fx + W) % W, fy, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // pads near the dock
    ctx.fillStyle = "#14263a";
    for (let i = 0; i < 8; i++) {
      const lx = W * (0.06 + 0.5 * ((i * 43) % 100) / 100), ly = wl + 24 + ((i * 71) % Math.max(40, (H - wl) * 0.42));
      ctx.beginPath(); ctx.ellipse(lx, ly, 15, 5.5, 0.1, 0.25, Math.PI * 2.1); ctx.fill();
    }
    // rolls: dinks flash silver — SHE glows
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.translate(gr.x, gr.y); ctx.scale(gr.dir, 1);
      if (gr.type === "ghost") {
        ctx.save(); ctx.globalAlpha = up * 0.5;
        ctx.fillStyle = "rgba(190,225,255,0.7)";
        ctx.beginPath(); ctx.ellipse(0, 0, gr.r * 1.5, gr.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        const len = gr.r * 2.4, hgt = gr.r * 0.62 * up;
        ctx.globalAlpha = 0.5 + up * 0.5;
        ctx.fillStyle = "#bcd8e8";
        ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.5, len * 0.5, Math.max(3, hgt), 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#93b6cc";
        ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.6, len * 0.42, Math.max(2, hgt * 0.55), 0, Math.PI, 0); ctx.fill();
        if (up > 0.4) {
          ctx.fillStyle = "#7fa4bc";
          ctx.beginPath(); ctx.moveTo(-len * 0.2, -hgt); ctx.lineTo(-len * 0.08, -hgt - 10 * up); ctx.lineTo(len * 0.05, -hgt); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = "rgba(207,228,239,0.6)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(0, 4, len * 0.6 + p * 16, 7 + p * 6, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        const len = gr.r * 2, hgt = gr.r * 0.5 * up;
        ctx.globalAlpha = 0.3 + up * 0.5;
        ctx.fillStyle = "#3e5a4a";
        ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.5, len * 0.5, Math.max(2, hgt), 0, Math.PI, 0); ctx.fill();
        if (up > 0.45) { ctx.fillStyle = "#cfe0d2"; ctx.beginPath(); ctx.ellipse(len * 0.12, 1 - hgt * 0.3, len * 0.2, Math.max(1, hgt * 0.3), 0.1, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
    renderBowShared(now, "ghost");
  }
  // the shared night-scene tail: fight overlay, projectiles, callouts, the
  // boat + angler, and the HUD pill — frog & ghost both close with this
  function renderBowShared(now, kind) {
    const B = S.bow; if (!B) return;
    const wl = waterLine();
    // ---- the hooked ghost on the rod ----
    if (B.fight) {
      const F = B.fight;
      const ba = bowAnchor();
      const rp = reelPoint();
      const gx = rp.x + (F.x - rp.x) * F.dist, gy = rp.y + (F.y - rp.y) * F.dist;
      const near = 1 + (1 - F.dist) * 0.9;
      const lift = Math.sin((F.jp || 0) * Math.PI) * 56 * near;
      const len = (40 + F.w * 1.4) * near;
      const thrash = Math.sin(now / 55) * (F.state === "jump" ? 0.34 : 0.13);
      ctx.save(); ctx.strokeStyle = "rgba(240,240,235,0.7)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(ba.x, ba.y); ctx.quadraticCurveTo((ba.x + gx) / 2, Math.min(ba.y, gy - lift) - 8, gx, gy - lift); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(gx, gy - lift); ctx.rotate(thrash * (F.dir || 1)); ctx.scale(F.dir || 1, 1);
      if (!F.trout) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = "rgba(190,225,255,0.8)";
        ctx.beginPath(); ctx.ellipse(0, 0, len * 0.62, len * 0.3, 0, 0, Math.PI * 2); ctx.fill();   // her glow
      }
      ctx.globalAlpha = F.state === "jump" ? 1 : 0.9;
      ctx.fillStyle = F.cat ? "#6a563a" : F.trout ? "#a08040" : "#bcd8e8";
      ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5, len * 0.2, 0, 0, Math.PI * 2); ctx.fill();     // pale body
      ctx.fillStyle = F.cat ? "#544428" : F.trout ? "#7a5c28" : "#93b6cc";
      ctx.beginPath(); ctx.ellipse(0, -len * 0.08, len * 0.46, len * 0.1, 0, Math.PI, 0); ctx.fill();
      if (F.trout) { ctx.fillStyle = "#c03a2c"; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * len * 0.16, -2 + (i % 2) * 4, 1.6, 0, Math.PI * 2); ctx.fill(); } }
      if (F.cat) {   // the flat head and the whiskers
        ctx.fillStyle = "#5c4a2e";
        ctx.beginPath(); ctx.ellipse(len * 0.38, 0, len * 0.2, len * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#2c2418"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(len * 0.5, -2); ctx.quadraticCurveTo(len * 0.68, -10, len * 0.74, -4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(len * 0.5, 3); ctx.quadraticCurveTo(len * 0.68, 11, len * 0.74, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(len * 0.46, -5); ctx.quadraticCurveTo(len * 0.58, -13, len * 0.66, -9); ctx.stroke();
      }
      ctx.fillStyle = F.cat ? "#6a563a" : F.trout ? "#8a6b34" : "#a7c4d6";
      ctx.beginPath(); ctx.moveTo(-len * 0.48, 0); ctx.lineTo(-len * 0.68, -len * 0.14); ctx.lineTo(-len * 0.64, len * 0.14); ctx.closePath(); ctx.fill();  // tail
      ctx.fillStyle = "#7fa4bc";
      ctx.beginPath(); ctx.moveTo(-len * 0.2, -len * 0.18); ctx.lineTo(-len * 0.05, -len * 0.34); ctx.lineTo(len * 0.1, -len * 0.18); ctx.closePath(); ctx.fill();  // dorsal
      ctx.fillStyle = "#0c1230"; ctx.beginPath(); ctx.arc(len * 0.34, -len * 0.04, 2.6, 0, Math.PI * 2); ctx.fill();   // eye
      ctx.strokeStyle = "#0c1230"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(len * 0.46, 2); ctx.lineTo(len * 0.3, 7); ctx.stroke();          // the big jaw
      ctx.restore();
      if (F.state === "jump") { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(gx, gy + 4, len * 0.5, 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const sw = 150, sx2 = (W - sw) / 2, sy2 = 56;
      ctx.save();
      ctx.fillStyle = "rgba(6,26,36,0.72)"; ctx.beginPath(); ctx.roundRect(sx2 - 40, sy2 - 9, sw + 66, 46, 14); ctx.fill();
      ctx.font = "700 9px system-ui"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(234,246,251,0.75)";
      ctx.fillText("LINE", sx2 - 6, sy2 + 8);
      ctx.fillText("BOAT", sx2 - 6, sy2 + 27);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(sx2, sy2, sw, 10, 5); ctx.fill();
      ctx.fillStyle = F.strain > 0.72 ? "#ff5d5d" : F.strain > 0.45 ? "#ffd35c" : "#8fe3a0";
      ctx.beginPath(); ctx.roundRect(sx2, sy2, sw * F.strain, 10, 5); ctx.fill();
      const prog = 1 - F.dist;
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(sx2, sy2 + 19, sw, 10, 5); ctx.fill();
      ctx.fillStyle = "#7fd4e8"; ctx.beginPath(); ctx.roundRect(sx2, sy2 + 19, sw * Math.max(0.04, prog), 10, 5); ctx.fill();
      ctx.font = "13px system-ui"; ctx.textAlign = "center";
      ctx.fillText("🛶", sx2 + sw + 14, sy2 + 30);
      const mx = sx2 + sw * Math.max(0.04, prog);
      ctx.fillStyle = "#eaf6fb";
      ctx.beginPath(); ctx.moveTo(mx, sy2 + 17.5); ctx.lineTo(mx - 4.5, sy2 + 12); ctx.lineTo(mx + 4.5, sy2 + 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (!B.holding && F.state !== "jump") {
        ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(now / 180) * 0.25;
        ctx.font = "800 14px system-ui"; ctx.textAlign = "center";
        ctx.fillStyle = "#ffd35c"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
        ctx.strokeText("REEL! ▼", W / 2, sy2 + 56); ctx.fillText("REEL! ▼", W / 2, sy2 + 56);
        ctx.restore();
      }
    }
    // ---- projectiles: the gig thrust, or the lure sailing out ----
    for (const a of B.arrows) {
      const p = Math.min(1, a.t / a.dur);
      const ax = a.sx + (a.tx - a.sx) * p, ay = a.sy + (a.ty - a.sy) * p - Math.sin(p * Math.PI) * (kind === "frog" ? 26 : 46);
      ctx.save(); ctx.globalAlpha = a.done ? Math.max(0, 1 - (a.t - a.dur) / 350) : 1;
      if (kind === "ghost") {
        ctx.strokeStyle = "rgba(240,240,235,0.55)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.quadraticCurveTo((a.sx + ax) / 2, Math.min(a.sy, ay) - 14, ax, ay); ctx.stroke();
      }
      if (!a.done) {
        const ang = Math.atan2(a.ty - a.sy, a.tx - a.sx);
        ctx.translate(ax, ay); ctx.rotate(ang);
        if (kind === "cat") {    // the lunge: a rolled sleeve and a grabbing hand
          ctx.fillStyle = "#b6322b";
          ctx.beginPath(); ctx.ellipse(-8, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#dfae85";
          ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#c9955f"; ctx.lineWidth = 2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(9, -5); ctx.moveTo(6, 0); ctx.lineTo(11, 0); ctx.moveTo(5, 3); ctx.lineTo(9, 5); ctx.stroke();
        } else if (kind === "trout") {  // the fly: a speck of hackle on a whisper of leader
          ctx.strokeStyle = "rgba(240,240,235,0.5)"; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(0, 0); ctx.stroke();
          ctx.fillStyle = "#5a4632"; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#c9b89a"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(-5, -6); ctx.moveTo(1, -2); ctx.lineTo(4, -7); ctx.stroke();
        } else if (kind === "frog") {   // the gig: shaft + three tines
          ctx.strokeStyle = "#8a6b42"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(8, 0); ctx.stroke();
          ctx.strokeStyle = "#c9ced4"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(16, -4); ctx.moveTo(8, 0); ctx.lineTo(17, 0); ctx.moveTo(8, 0); ctx.lineTo(16, 4); ctx.stroke();
        } else {                 // her lure — the good one, flashing in the moon
          ctx.rotate(a.t / 70);
          ctx.fillStyle = "#e8ddb8"; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff8e2"; ctx.beginPath(); ctx.ellipse(-1, -2, 1.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
    // ---- floating callouts ----
    for (const h of B.hits) {
      const p = h.t / 1100;
      ctx.save(); ctx.globalAlpha = 1 - p;
      const msg2 = h.bad || h.trick || (h.w != null ? `${h.w} lb!` : "");
      ctx.font = "800 " + (h.bad ? 17 : h.big ? 23 : 17) + "px system-ui"; ctx.textAlign = "center";
      ctx.fillStyle = h.bad ? "#ff5d5d" : h.big ? "#ffd35c" : "#8fe3a0";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
      const ty = h.y - 24 - p * 34;
      const hx2 = clamp(h.x, 70, W - 70);
      ctx.strokeText(msg2, hx2, ty); ctx.fillText(msg2, hx2, ty);
      ctx.restore();
    }
    // ---- jon boat off the right corner + the angler ----
    const dkT = H - 158;
    ctx.fillStyle = kind === "frog" ? "#3c4a52" : "#5a4a3a";
    ctx.beginPath(); ctx.moveTo(W * 0.12, H);
    ctx.quadraticCurveTo(W * 0.4, dkT + 4, W + 6, dkT - 14);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = kind === "frog" ? "#4c5c66" : "#6e5c48"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W * 0.13, H - 2);
    ctx.quadraticCurveTo(W * 0.4, dkT + 6, W + 6, dkT - 12); ctx.stroke();
    ctx.fillStyle = kind === "frog" ? "#2c3840" : "#453a2c";
    ctx.beginPath(); ctx.moveTo(W * 0.3, H);
    ctx.quadraticCurveTo(W * 0.56, dkT + 78, W + 6, dkT + 66);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    const flying = B.arrows.some(a => !a.done);
    const fighting = !!B.fight, straining = fighting && B.holding;
    const px = W * 0.74, deckY = H - 138, SC = 1.85;
    const lean = straining ? 0.14 : fighting ? 0.05 : 0;
    ctx.save(); ctx.translate(px, deckY); ctx.rotate(lean); ctx.scale(SC, SC);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2c3238"; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-5, -30); ctx.moveTo(11, 0); ctx.lineTo(8, -30); ctx.stroke();
    if (kind === "cat") {
      // Bubba: camo cap, big auburn beard, red tee + overall straps, sleeves up
      ctx.fillStyle = "#b6322b";
      ctx.beginPath(); ctx.moveTo(-13, -28); ctx.quadraticCurveTo(-15, -56, -8, -60);
      ctx.lineTo(10, -60); ctx.quadraticCurveTo(16, -54, 14, -28); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#3b5372"; ctx.lineWidth = 5;   // overall straps
      ctx.beginPath(); ctx.moveTo(-8, -58); ctx.lineTo(-10, -30); ctx.moveTo(9, -58); ctx.lineTo(11, -30); ctx.stroke();
      ctx.fillStyle = "#dfae85"; ctx.beginPath(); ctx.arc(-4, -71, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8a5a2e";   // the beard
      ctx.beginPath(); ctx.moveTo(-13, -67); ctx.quadraticCurveTo(-14, -50, -4, -43);
      ctx.quadraticCurveTo(2, -51, 0, -66) ; ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#5c6844";   // camo cap
      ctx.beginPath(); ctx.arc(-4, -75, 10.5, Math.PI * 0.9, Math.PI * 2.02); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-13, -76.5, 8, 3, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#46523a"; ctx.beginPath(); ctx.arc(-7, -79, 2.4, 0, Math.PI * 2); ctx.arc(-1, -76, 2, 0, Math.PI * 2); ctx.fill();
      // arms: lead arm plunges toward the water when the grab flies
      ctx.strokeStyle = "#dfae85"; ctx.lineWidth = 8; ctx.lineCap = "round";   // bare rolled-up arms
      ctx.beginPath(); ctx.moveTo(-6, -55); ctx.lineTo(flying ? -34 : -28, flying ? -38 : -50); ctx.stroke();
      ctx.strokeStyle = "#d3a075"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(7, -55); ctx.lineTo(fighting ? -6 : 14, fighting ? -40 : -48); ctx.stroke();
      ctx.fillStyle = "#dfae85";
      ctx.beginPath(); ctx.arc(flying ? -36 : -30, flying ? -37 : -49, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b6322b";   // rolled sleeve cuffs
      ctx.beginPath(); ctx.ellipse(-12, -53, 5, 4, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, -53, 5, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (kind === "trout") {
      // Alisa: lavender shirt, dark ponytail, sage cap, the long fly rod working
      ctx.fillStyle = "#8a6fa8";
      ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(-13, -56, -7, -60);
      ctx.lineTo(9, -60); ctx.quadraticCurveTo(14, -54, 12, -28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#dfae85"; ctx.beginPath(); ctx.arc(-4, -71, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2b22";   // ponytail swinging behind
      ctx.beginPath(); ctx.moveTo(4, -76); ctx.quadraticCurveTo(14, -66, 11, -48); ctx.quadraticCurveTo(7, -52, 5, -62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9db08a";   // sage cap
      ctx.beginPath(); ctx.arc(-4, -74, 10, Math.PI * 0.9, Math.PI * 2.02); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-12, -75.5, 8, 3, 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6fa8"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-36, -61); ctx.stroke();
      ctx.strokeStyle = "#7a6096"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(6, -56); ctx.lineTo(fighting ? -8 : 12, fighting ? -42 : -50); ctx.stroke();
      ctx.fillStyle = "#dfae85";
      ctx.beginPath(); ctx.arc(-38, -61, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(-38, -61);
      const ftX = -30, ftY = -40;   // the long, willowy fly rod
      ctx.strokeStyle = "#5a4632"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
      if (fighting) { ctx.beginPath(); ctx.moveTo(8, 5); ctx.quadraticCurveTo(-16, -26, ftX - 6, ftY + 18); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(8, 5); ctx.quadraticCurveTo(-8, -18, ftX, ftY); ctx.stroke(); }
      ctx.fillStyle = "#2e3338"; ctx.beginPath(); ctx.arc(5, 9, 4.2, 0, Math.PI * 2); ctx.fill();
      if (!flying && !fighting) {   // a lazy loop of line off the tip
        ctx.strokeStyle = "rgba(235,235,225,0.65)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ftX, ftY); ctx.quadraticCurveTo(ftX - 14, ftY + 16, ftX - 4, ftY + 22); ctx.stroke();
      }
      ctx.restore();
    } else if (kind === "frog") {
      // Old Dog: olive jacket, gray beard, bucket hat, headlamp burning
      ctx.fillStyle = "#5a6247";
      ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(-13, -56, -7, -60);
      ctx.lineTo(9, -60); ctx.quadraticCurveTo(14, -54, 12, -28); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#dfae85"; ctx.beginPath(); ctx.arc(-4, -71, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b9bec2";   // the gray beard
      ctx.beginPath(); ctx.moveTo(-12, -67); ctx.quadraticCurveTo(-13, -50, -4, -44);
      ctx.quadraticCurveTo(1, -52, -1, -65); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4a5240";   // bucket hat
      ctx.beginPath(); ctx.arc(-4, -75, 9.5, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-4, -74.5, 13, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff4be";   // the headlamp
      ctx.beginPath(); ctx.arc(-11, -77, 2.6, 0, Math.PI * 2); ctx.fill();
      // lead arm holds the gig high, butt hand low
      ctx.strokeStyle = "#5a6247"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-30, -66); ctx.stroke();
      ctx.strokeStyle = "#4e553e"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(6, -56); ctx.lineTo(-4, -40); ctx.stroke();
      ctx.fillStyle = "#dfae85";
      ctx.beginPath(); ctx.arc(-32, -67, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-5, -39, 4, 0, Math.PI * 2); ctx.fill();
      // the gig itself: long shaft, tines at the top, angled at the water
      ctx.save(); ctx.strokeStyle = "#8a6b42"; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(6, -30); ctx.lineTo(-52, -102); ctx.stroke();
      ctx.strokeStyle = "#c9ced4"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-52, -102); ctx.lineTo(-60, -110); ctx.moveTo(-52, -102); ctx.lineTo(-55, -113); ctx.moveTo(-52, -102); ctx.lineTo(-48, -112); ctx.stroke();
      ctx.restore();
    } else {
      // Roberto: maroon flannel, dark hair, rod out over the moonlight
      ctx.fillStyle = "#7e3040";
      ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(-13, -56, -7, -60);
      ctx.lineTo(9, -60); ctx.quadraticCurveTo(14, -54, 12, -28); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#5e2430"; ctx.lineWidth = 1.4;   // flannel lines
      ctx.beginPath(); ctx.moveTo(-10, -50); ctx.lineTo(12, -50); ctx.moveTo(-11, -40); ctx.lineTo(12, -40); ctx.moveTo(-2, -60); ctx.lineTo(-2, -28); ctx.stroke();
      ctx.fillStyle = "#caa07a"; ctx.beginPath(); ctx.arc(-4, -71, 9.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#241a12";   // dark hair
      ctx.beginPath(); ctx.arc(-4, -73.5, 10, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
      ctx.strokeStyle = "#241a12"; ctx.lineWidth = 2.2;   // mustache
      ctx.beginPath(); ctx.moveTo(-12, -66.5); ctx.quadraticCurveTo(-8, -64.5, -4, -66); ctx.stroke();
      ctx.strokeStyle = "#7e3040"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-36, -61); ctx.stroke();
      ctx.strokeStyle = "#6e2a38"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(6, -56); ctx.lineTo(fighting ? -8 : 15, fighting ? -42 : -53); ctx.stroke();
      ctx.fillStyle = "#caa07a";
      ctx.beginPath(); ctx.arc(-38, -61, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(-38, -61);
      const tipX = -26, tipY = -35;
      ctx.strokeStyle = "#3a2c20"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      if (fighting) { ctx.beginPath(); ctx.moveTo(6, 4); ctx.quadraticCurveTo(-14, -22, tipX - 5, tipY + 14); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(tipX, tipY); ctx.stroke(); }
      ctx.fillStyle = "#2e3338"; ctx.beginPath(); ctx.arc(3, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#c9c9c2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(3, 8, 2.8, 0, Math.PI * 2); ctx.stroke();
      if (!flying && !fighting) {
        ctx.strokeStyle = "rgba(235,235,225,0.7)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX, tipY + 14); ctx.stroke();
        ctx.fillStyle = "#e8ddb8"; ctx.beginPath(); ctx.ellipse(tipX, tipY + 19, 2.6, 5.2, 0.15, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    // ---- HUD pill ----
    const sec = Math.max(0, Math.ceil(B.t / 1000));
    const total = B.haul.reduce((a2, w) => a2 + w, 0);
    ctx.save(); ctx.font = "700 15px system-ui"; ctx.textAlign = "center";
    const icon = kind === "cat" ? "💪" : kind === "trout" ? "🪶" : kind === "frog" ? "🔱" : "🪝";
    const tail = kind === "cat" ? `${B.haul.length} flathead${B.haul.length === 1 ? "" : "s"} · ${total.toFixed(1)} lb`
      : kind === "trout" ? `${B.haul.length} trout · ${total.toFixed(1)} lb`
      : kind === "frog" ? `${B.haul.length} frog${B.haul.length === 1 ? "" : "s"} · ${total.toFixed(1)} lb`
      : B.ghostW ? `SHE'S IN THE BOAT` : `${B.haul.length} dink${B.haul.length === 1 ? "" : "s"} · she's out there…`;
    const msg = `${icon.repeat(Math.max(0, B.quiver))}${"·".repeat(3 - Math.max(0, B.quiver))}  ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}  ·  ${tail}`;
    const tw = ctx.measureText(msg).width + 26;
    ctx.fillStyle = "rgba(6,26,36,0.72)";
    ctx.beginPath(); ctx.roundRect((W - tw) / 2, 14, tw, 30, 15); ctx.fill();
    ctx.fillStyle = sec <= 10 ? "#ff9d8a" : "#eaf6fb"; ctx.fillText(msg, W / 2, 34);
    ctx.restore();
  }
  function renderBowfish(now) {
    const B = S.bow; if (!B) return;
    if (B.kind === "rc") { renderRapids(now); return; }
    if (B.kind === "frog") { renderFrog(now); return; }
    if (B.kind === "ghost") { renderGhost(now); return; }
    if (B.kind === "trout") { renderTrout(now); return; }
    if (B.kind === "cat") { renderCat(now); return; }
    const wl = waterLine();
    // dusk sky over the piney bottoms
    let g = ctx.createLinearGradient(0, 0, 0, wl);
    g.addColorStop(0, "#241d4e"); g.addColorStop(0.55, "#a44a2e"); g.addColorStop(1, "#f2a05c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, wl);
    ctx.fillStyle = "rgba(255,196,130,0.9)";
    ctx.beginPath(); ctx.arc(W * 0.5, wl - 6, 24, 0, Math.PI * 2); ctx.fill();
    // pine silhouettes crowding both banks upriver
    const pineRow = (y, h, col, step, off) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = -10; x < W + 20; x += step) {
        const ph = h * (0.6 + 0.4 * Math.abs(Math.sin((x + off) * 0.13)));
        const mid = Math.abs(x - W * 0.5) / (W * 0.5);           // river gap in the middle
        const hh = ph * (0.25 + mid * 0.95);
        ctx.lineTo(x, y - hh); ctx.lineTo(x + step * 0.5, y - hh * 0.42);
      }
      ctx.lineTo(W + 20, y); ctx.closePath(); ctx.fill();
    };
    pineRow(wl, 90, "#3a2f45", 26, 3);
    pineRow(wl + 2, 130, "#241f30", 34, 40);
    // the river: dark tea water with the sundown streak
    g = ctx.createLinearGradient(0, wl, 0, H);
    g.addColorStop(0, "#3d3242"); g.addColorStop(0.4, "#1d2430"); g.addColorStop(1, "#0c1218");
    ctx.fillStyle = g; ctx.fillRect(0, wl, W, H - wl);
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = "#ffbe82";
    for (let i = 0; i < 9; i++) { const yy = wl + 12 + i * 16, ww = 60 - i * 5; ctx.fillRect(W * 0.5 - ww / 2 + Math.sin(now / 700 + i) * 6, yy, ww, 2.5); }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const yy = wl + 26 + i * ((H - wl) / 7); ctx.beginPath(); ctx.moveTo(0, yy + Math.sin(now / 900 + i * 2) * 3); ctx.bezierCurveTo(W * 0.3, yy - 4, W * 0.7, yy + 4, W, yy); ctx.stroke(); }
    ctx.restore();
    // what's moving on the river: gar roll, beavers cross, gators glide
    for (const gr of B.gars) {
      const p = gr.t / gr.dur, up = Math.sin(p * Math.PI);
      ctx.save(); ctx.globalAlpha = 0.3 * up; ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(gr.x, gr.y + 3, gr.r * 1.35 + p * 14, 6 + p * 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(gr.x, gr.y); ctx.scale(gr.dir, 1);
      if (gr.type === "beaver") {
        ctx.globalAlpha = 0.45 + up * 0.55;
        ctx.fillStyle = "#5c4128";
        ctx.beginPath(); ctx.ellipse(6, -2, 12, 6.5, 0, 0, Math.PI * 2); ctx.fill();      // wet brown back
        ctx.beginPath(); ctx.arc(17, -6, 6, 0, Math.PI * 2); ctx.fill();                  // round head
        ctx.fillStyle = "#4a3420";
        ctx.beginPath(); ctx.arc(14.5, -11, 2.2, 0, Math.PI * 2); ctx.arc(20, -10.5, 2.2, 0, Math.PI * 2); ctx.fill();   // little ears
        ctx.beginPath(); ctx.ellipse(-10, 0, 8, 3.4, -0.35, 0, Math.PI * 2); ctx.fill();  // the flat tail
        ctx.fillStyle = "#1c1410"; ctx.beginPath(); ctx.arc(19.5, -6.5, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(207,228,239,0.5)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(24, -3); ctx.lineTo(34, -8); ctx.moveTo(24, 1); ctx.lineTo(36, 3); ctx.stroke();     // V wake
      } else if (gr.type === "gator") {
        ctx.globalAlpha = 0.5 + up * 0.5;
        ctx.fillStyle = "#33402a";
        ctx.beginPath(); ctx.ellipse(-14, -1, 12, 4, 0, 0, Math.PI * 2); ctx.fill();      // back ridge
        ctx.beginPath(); ctx.ellipse(6, -2, 14, 3.4, 0, 0, Math.PI * 2); ctx.fill();      // long snout ridge
        ctx.fillStyle = "#25301e";
        ctx.beginPath(); ctx.arc(-1, -6, 3.4, 0, Math.PI * 2); ctx.arc(6, -6.2, 3.2, 0, Math.PI * 2); ctx.fill();        // eye knobs
        ctx.fillStyle = "#ffd35c";
        ctx.beginPath(); ctx.arc(-1, -6.5, 1, 0, Math.PI * 2); ctx.arc(6, -6.7, 1, 0, Math.PI * 2); ctx.fill();          // eyeshine
        ctx.strokeStyle = "#25301e"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(-19, -6.5); ctx.moveTo(-17, -5); ctx.lineTo(-12, -7); ctx.stroke();   // tail scutes
      } else if (gr.type === "sand") {
        const len = gr.r * 2, hgt = gr.r * 0.6 * up;
        ctx.globalAlpha = 0.35 + up * 0.6;
        ctx.fillStyle = "#8a95a0";
        ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.5, len * 0.5, Math.max(2, hgt), 0, Math.PI, 0); ctx.fill();
        if (up > 0.4) {
          ctx.fillStyle = "#6d7680";   // dark striped back breaking the surface
          ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.62, len * 0.42, Math.max(1.5, hgt * 0.55), 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = "#59616a";   // the spiny dorsal
          ctx.beginPath(); ctx.moveTo(-len * 0.18, -hgt); ctx.lineTo(-len * 0.1, -hgt - 7 * up); ctx.lineTo(-len * 0.02, -hgt);
          ctx.lineTo(len * 0.04, -hgt - 5 * up); ctx.lineTo(len * 0.1, -hgt); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#d7dde2";   // silver flank flash
          ctx.beginPath(); ctx.ellipse(len * 0.14, 2 - hgt * 0.3, len * 0.22, Math.max(1, hgt * 0.3), 0.1, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const len = gr.r * 2.2, hgt = gr.r * 0.5 * up;
        ctx.globalAlpha = 0.35 + up * 0.6;
        ctx.fillStyle = "#4a5537";
        ctx.beginPath(); ctx.ellipse(0, 2 - hgt * 0.5, len * 0.5, Math.max(2, hgt), 0, Math.PI, 0); ctx.fill();
        if (up > 0.45) {
          ctx.fillStyle = "#5b6844";
          ctx.beginPath(); ctx.moveTo(len * 0.42, 1 - hgt * 0.4); ctx.lineTo(len * 0.72, 3 - hgt * 0.1); ctx.lineTo(len * 0.42, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#39422b";
          ctx.beginPath(); ctx.moveTo(-len * 0.28, -hgt); ctx.lineTo(-len * 0.16, -hgt - 6 * up); ctx.lineTo(-len * 0.06, -hgt); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    // ---- the hooked giant: thrashing, jumping, arrow buried in its back ----
    if (B.fight) {
      const F = B.fight;
      const ba = bowAnchor(), bowX = ba.x, bowY = ba.y;
      // reeling drags it down to a landing spot just ABOVE the reel button,
      // so the fish never disappears under the player's thumb
      const rp = reelPoint();
      const gx = rp.x + (F.x - rp.x) * F.dist, gy = rp.y + (F.y - rp.y) * F.dist;
      const near = 1 + (1 - F.dist) * 0.9;                 // perspective: it grows as it comes
      const lift = Math.sin((F.jp || 0) * Math.PI) * 52 * near;
      const len = (30 + F.w * 1.1) * near;
      const thrash = Math.sin(now / 55) * (F.state === "jump" ? 0.34 : 0.13);
      // taut line from the bow reel to the fish
      ctx.save(); ctx.strokeStyle = "rgba(240,240,235,0.7)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(bowX, bowY); ctx.quadraticCurveTo((bowX + gx) / 2, Math.min(bowY, gy - lift) - 8, gx, gy - lift); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(gx, gy - lift); ctx.rotate(thrash * (F.dir || 1));
      ctx.scale(F.dir || 1, 1);
      ctx.globalAlpha = F.state === "jump" ? 1 : 0.85;
      if (B.kind === "sand") {
        const L2 = len * 1.6;   // sandies are deep-bodied, not eels
        ctx.fillStyle = "#8a95a0";
        ctx.beginPath(); ctx.ellipse(0, 0, L2 * 0.5, L2 * 0.26, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6d7680";
        ctx.beginPath(); ctx.ellipse(0, -L2 * 0.1, L2 * 0.46, L2 * 0.14, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = "#5c646d"; ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-L2 * 0.34, i * L2 * 0.08 - 1); ctx.lineTo(L2 * 0.3, i * L2 * 0.08 - 2); ctx.stroke(); }
        ctx.fillStyle = "#59616a";      // spiny dorsal up top
        ctx.beginPath(); ctx.moveTo(-L2 * 0.22, -L2 * 0.22); ctx.lineTo(-L2 * 0.1, -L2 * 0.4); ctx.lineTo(L2 * 0.06, -L2 * 0.22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#77808a";
        ctx.beginPath(); ctx.moveTo(-L2 * 0.48, 0); ctx.lineTo(-L2 * 0.68, -L2 * 0.16); ctx.lineTo(-L2 * 0.64, L2 * 0.16); ctx.closePath(); ctx.fill();   // tail
        ctx.fillStyle = "#e8edf1"; ctx.beginPath(); ctx.ellipse(2, L2 * 0.12, L2 * 0.38, L2 * 0.1, 0, 0, Math.PI); ctx.fill();   // white belly
        ctx.fillStyle = "#1c2025"; ctx.beginPath(); ctx.arc(L2 * 0.34, -L2 * 0.05, 2.2, 0, Math.PI * 2); ctx.fill();             // eye
        // the silver spoon flashing in its jaw
        ctx.save(); ctx.translate(L2 * 0.48, 2); ctx.rotate(0.5 + thrash);
        ctx.fillStyle = "#d9dee3"; ctx.beginPath(); ctx.ellipse(0, 4, 3, 6.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f6f9fb"; ctx.beginPath(); ctx.ellipse(-0.8, 2.6, 1.2, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = "#57653f";
        ctx.beginPath(); ctx.ellipse(0, 0, len * 0.5, len * 0.14, 0, 0, Math.PI * 2); ctx.fill();     // long body
        ctx.beginPath(); ctx.moveTo(len * 0.44, -2); ctx.lineTo(len * 0.78, 1); ctx.lineTo(len * 0.44, 4); ctx.closePath(); ctx.fill();   // the snout
        ctx.fillStyle = "#48543a";
        ctx.beginPath(); ctx.moveTo(-len * 0.48, 0); ctx.lineTo(-len * 0.66, -8); ctx.lineTo(-len * 0.62, 8); ctx.closePath(); ctx.fill(); // tail
        ctx.fillStyle = "#e6ecda"; ctx.beginPath(); ctx.ellipse(2, len * 0.07, len * 0.4, len * 0.05, 0, 0, Math.PI); ctx.fill();          // pale belly
        ctx.fillStyle = "#1c2416"; ctx.beginPath(); ctx.arc(len * 0.34, -2, 2, 0, Math.PI * 2); ctx.fill();                                 // eye
        // the arrow, buried and waving
        ctx.strokeStyle = "#e8d9b0"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-len * 0.1, -len * 0.1); ctx.lineTo(-len * 0.1 - 10, -len * 0.1 - 18); ctx.stroke();
        ctx.fillStyle = "#c23b28";
        ctx.beginPath(); ctx.moveTo(-len * 0.1 - 10, -len * 0.1 - 18); ctx.lineTo(-len * 0.1 - 16, -len * 0.1 - 24); ctx.lineTo(-len * 0.1 - 6, -len * 0.1 - 22); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      if (F.state === "jump") { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#cfe4ef"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(gx, gy + 4, len * 0.5, 7, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      // fight gauges: line strain on top, distance-to-the-boat below
      const sw = 150, sx2 = (W - sw) / 2, sy2 = 56;
      ctx.save();
      ctx.fillStyle = "rgba(6,26,36,0.72)"; ctx.beginPath(); ctx.roundRect(sx2 - 40, sy2 - 9, sw + 66, 46, 14); ctx.fill();
      ctx.font = "700 9px system-ui"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(234,246,251,0.75)";
      ctx.fillText("LINE", sx2 - 6, sy2 + 8);
      ctx.fillText("BOAT", sx2 - 6, sy2 + 27);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(sx2, sy2, sw, 10, 5); ctx.fill();
      ctx.fillStyle = F.strain > 0.72 ? "#ff5d5d" : F.strain > 0.45 ? "#ffd35c" : "#8fe3a0";
      ctx.beginPath(); ctx.roundRect(sx2, sy2, sw * F.strain, 10, 5); ctx.fill();
      // the marker crawls to the hull as line comes in
      const prog = 1 - F.dist;
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.beginPath(); ctx.roundRect(sx2, sy2 + 19, sw, 10, 5); ctx.fill();
      ctx.fillStyle = "#7fd4e8"; ctx.beginPath(); ctx.roundRect(sx2, sy2 + 19, sw * Math.max(0.04, prog), 10, 5); ctx.fill();
      ctx.font = "13px system-ui"; ctx.textAlign = "center";
      ctx.fillText("🛶", sx2 + sw + 14, sy2 + 30);
      const mx = sx2 + sw * Math.max(0.04, prog);
      ctx.fillStyle = "#eaf6fb";
      ctx.beginPath(); ctx.moveTo(mx, sy2 + 17.5); ctx.lineTo(mx - 4.5, sy2 + 12); ctx.lineTo(mx + 4.5, sy2 + 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (!B.holding && F.state !== "jump") {
        ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(now / 180) * 0.25;
        ctx.font = "800 14px system-ui"; ctx.textAlign = "center";
        ctx.fillStyle = "#ffd35c"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
        ctx.strokeText("REEL! ▼", W / 2, sy2 + 56); ctx.fillText("REEL! ▼", W / 2, sy2 + 56);
        ctx.restore();
      }
    }
    // arrows with the line trailing back to the bow
    for (const a of B.arrows) {
      const p = Math.min(1, a.t / a.dur);
      const ax = a.sx + (a.tx - a.sx) * p, ay = a.sy + (a.ty - a.sy) * p - Math.sin(p * Math.PI) * 46;
      ctx.save(); ctx.globalAlpha = a.done ? Math.max(0, 1 - (a.t - a.dur) / 350) : 1;
      ctx.strokeStyle = "rgba(240,240,235,0.55)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.quadraticCurveTo((a.sx + ax) / 2, Math.min(a.sy, ay) - 14, ax, ay); ctx.stroke();
      if (!a.done) {
        const ang = Math.atan2(a.ty - a.sy, a.tx - a.sx);
        ctx.translate(ax, ay); ctx.rotate(ang);
        if (B.kind === "sand") {   // the spoon tumbles as it flies
          ctx.rotate(a.t / 60);
          ctx.fillStyle = "#d9dee3"; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f6f9fb"; ctx.beginPath(); ctx.ellipse(-1, -2, 1.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = "#e8d9b0"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(11, 0); ctx.stroke();
          ctx.fillStyle = "#d8dee2"; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(4, -4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    // hit callouts float up
    for (const h of B.hits) {
      const p = h.t / 1100;
      ctx.save(); ctx.globalAlpha = 1 - p;
      const msg2 = h.bad || `${h.w} lb!`;
      ctx.font = "800 " + (h.bad ? 17 : h.w >= 20 ? 24 : 18) + "px system-ui"; ctx.textAlign = "center";
      ctx.fillStyle = h.bad ? "#ff5d5d" : h.w >= 20 ? "#ffd35c" : "#8fe3a0";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineJoin = "round";
      const ty = h.y - 24 - p * 34;
      const hx2 = clamp(h.x, 70, W - 70);
      ctx.strokeText(msg2, hx2, ty); ctx.fillText(msg2, hx2, ty);
      ctx.restore();
    }
    // the bow deck runs off the corner — you're shooting off the port bow,
    // and the shooter is people-sized on it
    const dkT = H - 158;                                     // deck line at the right edge
    ctx.fillStyle = "#7e2f3b";                               // gunwale + foredeck
    ctx.beginPath(); ctx.moveTo(W * 0.12, H);
    ctx.quadraticCurveTo(W * 0.4, dkT + 4, W + 6, dkT - 14);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#93424e"; ctx.lineWidth = 3;          // deck edge highlight
    ctx.beginPath(); ctx.moveTo(W * 0.13, H - 2);
    ctx.quadraticCurveTo(W * 0.4, dkT + 6, W + 6, dkT - 12); ctx.stroke();
    ctx.fillStyle = "#5f232d";                               // hull side to the waterline
    ctx.beginPath(); ctx.moveTo(W * 0.3, H);
    ctx.quadraticCurveTo(W * 0.56, dkT + 78, W + 6, dkT + 66);
    ctx.lineTo(W + 6, H); ctx.closePath(); ctx.fill();
    const flying = B.arrows.some(a => !a.done);
    const fighting = !!B.fight, straining = fighting && B.holding;
    const px = W * 0.74, deckY = H - 138, SC = 1.85;
    const lean = straining ? 0.14 : fighting ? 0.05 : 0;
    // ---- the archer, drawn as one figure in profile, shooting left ----
    ctx.save(); ctx.translate(px, deckY); ctx.rotate(lean); ctx.scale(SC, SC);
    ctx.lineCap = "round";
    // legs planted on the deck
    ctx.strokeStyle = "#2c3238"; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-5, -30); ctx.moveTo(11, 0); ctx.lineTo(8, -30); ctx.stroke();
    const sandRun = B.kind === "sand";
    // torso: J.P.'s khaki guide shirt on the creek, Dr. G's blue polo on the river
    ctx.fillStyle = sandRun ? "#c9bd9a" : "#3a6ea8";
    ctx.beginPath(); ctx.moveTo(-11, -28); ctx.quadraticCurveTo(-13, -56, -7, -60);
    ctx.lineTo(9, -60); ctx.quadraticCurveTo(14, -54, 12, -28); ctx.closePath(); ctx.fill();
    // head in profile, eyes on the water
    ctx.fillStyle = "#dfae85"; ctx.beginPath(); ctx.arc(-4, -71, 9.5, 0, Math.PI * 2); ctx.fill();
    if (sandRun) {
      // sandy hair and the chinstrap
      ctx.fillStyle = "#8a744f";
      ctx.beginPath(); ctx.arc(-4, -73, 10, Math.PI * 0.95, Math.PI * 1.98); ctx.fill();
      ctx.strokeStyle = "#96603c"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(-4.5, -70, 9, Math.PI * 0.32, Math.PI * 0.78); ctx.stroke();
    } else {
      // the long beard running down the chest
      ctx.fillStyle = "#463526";
      ctx.beginPath(); ctx.moveTo(-12, -67); ctx.quadraticCurveTo(-13, -52, -5, -42);
      ctx.quadraticCurveTo(0, -52, -2, -65); ctx.closePath(); ctx.fill();
      // charcoal cap, brim toward the target
      ctx.fillStyle = "#4d545c";
      ctx.beginPath(); ctx.arc(-4, -74, 10, Math.PI * 0.9, Math.PI * 2.02); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-12, -75.5, 8, 3, 0.12, 0, Math.PI * 2); ctx.fill();
    }
    // lead arm straight out to the grip
    ctx.strokeStyle = sandRun ? "#c9bd9a" : "#3a6ea8"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-6, -56); ctx.lineTo(-36, -61); ctx.stroke();
    // draw arm: on the string until the shot; on the reel crank in a fight
    ctx.strokeStyle = sandRun ? "#b8ab88" : "#35638f"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(6, -56);
    let hx, hy;
    if (fighting) { ctx.lineTo(-8, -42); hx = -44; hy = -52; }
    else if (flying) { ctx.lineTo(16, -56); hx = 12, hy = -68; }
    else { ctx.lineTo(15, -53); hx = -16; hy = -63; }
    ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = "#dfae85";
    ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-38, -61, 4.5, 0, Math.PI * 2); ctx.fill();   // grip hand
    if (sandRun) {
      // the spinning rod in the lead hand, tip out over the creek
      ctx.save(); ctx.translate(-38, -61);
      const tipX = -26, tipY = -35;   // rod tip (matches bowAnchor: px-118*, deckY-316 in screen space)
      ctx.strokeStyle = "#4a3a2c"; ctx.lineWidth = 3.2; ctx.lineCap = "round";
      if (fighting) { ctx.beginPath(); ctx.moveTo(6, 4); ctx.quadraticCurveTo(-14, -22, tipX - 5, tipY + 14); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(tipX, tipY); ctx.stroke(); }
      ctx.strokeStyle = "#6b5a44"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(tipX * 0.6, tipY * 0.6); ctx.stroke();   // highlight up the blank
      ctx.fillStyle = "#2e3338"; ctx.beginPath(); ctx.arc(3, 8, 5, 0, Math.PI * 2); ctx.fill();   // the reel
      ctx.strokeStyle = "#c9c9c2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(3, 8, 2.8, 0, Math.PI * 2); ctx.stroke();
      if (!flying && !fighting) {     // spoon dangling off the tip, catching light
        ctx.strokeStyle = "rgba(235,235,225,0.7)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX, tipY + 14); ctx.stroke();
        ctx.fillStyle = "#d9dee3"; ctx.beginPath(); ctx.ellipse(tipX, tipY + 19, 2.6, 5.2, 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f6f9fb"; ctx.beginPath(); ctx.ellipse(tipX - 0.8, tipY + 17.5, 1, 2.4, 0.15, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else {
    // the bow in the lead hand: belly to the river, string to the man
    ctx.save(); ctx.translate(-38, -61); ctx.rotate(-0.1);
    ctx.strokeStyle = "#6b4a2a"; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(2, -34); ctx.quadraticCurveTo(-18, 0, 2, 34); ctx.stroke();
    ctx.fillStyle = "#2e3338"; ctx.beginPath(); ctx.arc(-8, 9, 5, 0, Math.PI * 2); ctx.fill();   // the bow reel
    ctx.strokeStyle = "#c9c9c2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-8, 9, 2.8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(235,235,225,0.85)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, -34);
    if (flying || fighting) ctx.lineTo(2, 34); else { ctx.lineTo(21, -2); ctx.lineTo(2, 34); }
    ctx.stroke();
    if (!flying && !fighting) {   // nocked arrow lies across the riser, head at the water
      ctx.strokeStyle = "#e8d9b0"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(21, -2); ctx.lineTo(-26, -3); ctx.stroke();
      ctx.fillStyle = "#d8dee2"; ctx.beginPath(); ctx.moveTo(-31, -3.2); ctx.lineTo(-23, -6.6); ctx.lineTo(-23, 0.2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    }
    ctx.restore();
    // canvas HUD: the clock and the stringer
    const sec = Math.max(0, Math.ceil(B.t / 1000));
    const total = B.haul.reduce((a2, w) => a2 + w, 0);
    ctx.save(); ctx.font = "700 15px system-ui"; ctx.textAlign = "center";
    const msg = `${(B.kind === "sand" ? "🥄" : "➳").repeat(Math.max(0, B.quiver))}${"·".repeat(3 - Math.max(0, B.quiver))}  ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}  ·  ${B.haul.length} ${B.kind === "sand" ? "sandies" : "gar"} · ${total.toFixed(1)} lb`;
    const tw = ctx.measureText(msg).width + 26;
    ctx.fillStyle = "rgba(6,26,36,0.72)";
    ctx.beginPath(); ctx.roundRect((W - tw) / 2, 14, tw, 30, 15); ctx.fill();
    ctx.fillStyle = sec <= 10 ? "#ff9d8a" : "#eaf6fb"; ctx.fillText(msg, W / 2, 34);
    ctx.restore();
  }
  el.garYes.addEventListener("click", () => {
    if (S.bow && S.bow.over) { cancelBowfish(); el.garModal.classList.add("hidden"); sfx("ui"); resetToIdle(); updateHUD(); }
    else { sfx("good"); startBowfish(); }
  });
  el.garNo.addEventListener("click", () => { el.garModal.classList.add("hidden"); sfx("ui"); });

  // ===========================================================================
  // 🎮 GAMEPAD — a Bluetooth controller runs the whole game. The left stick or
  // d-pad moves a pointer, Ⓐ presses whatever's under it (menus, casting, the
  // lot), and the water gets fast paths: Ⓐ sets the hook on a strike, Ⓐ or the
  // right trigger holds the reel, Ⓑ twitches the lure or backs out of a menu.
  // ===========================================================================
  const pollGamepad = (() => {
    try { addEventListener("gamepadconnected", e => toast(`🎮 ${(e.gamepad.id || "Controller").split("(")[0].trim()} connected`)); } catch (e) {}
    const cur = document.createElement("div");
    cur.id = "gpCursor"; cur.classList.add("hidden");
    document.body.appendChild(cur);
    let cx = innerWidth / 2, cy = innerHeight / 2;
    let prevB = [], lastAct = 0, greeted = false, holdMode = null, downEl = null;
    const DEAD = 0.18;
    const topModal = () => {
      const vis = [...document.querySelectorAll(".modal:not(.hidden)")];
      return vis.length ? vis[vis.length - 1] : null;
    };
    const synth = (type, tgt, Ctor) => {
      try { tgt.dispatchEvent(new (Ctor || PointerEvent)(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 7, pointerType: "mouse", isPrimary: true, view: window })); } catch (e) {}
    };
    const press = () => { downEl = document.elementFromPoint(cx, cy); if (downEl) synth("pointerdown", downEl); cur.classList.add("pressed"); };
    const release = () => {
      cur.classList.remove("pressed");
      if (!downEl) return;
      synth("pointerup", downEl);
      synth("click", downEl, MouseEvent);
      downEl = null;
    };
    const waterMode = () => !anyModalOpen() && ["retrieve", "fight", "splashdown", "casting", "landing"].includes(S.mode);
    const bowFighting = () => !anyModalOpen() && S.mode === "bowfish" && S.bow && S.bow.fight;
    return function pollGamepad(dt) {
      let pad = null;
      try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected) { pad = p; break; } } catch (e) {}
      if (!pad) { cur.classList.add("hidden"); return; }
      if (!greeted) { greeted = true; toast("🎮 Controller connected — stick moves the pointer, Ⓐ presses"); }
      const now = performance.now();
      const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const was = i => !!prevB[i];
      const ax = i => { const v = pad.axes[i] || 0; return Math.abs(v) > DEAD ? v : 0; };
      // pointer: left stick + d-pad, speed eases with deflection
      let vx = ax(0) + (b(15) ? 0.75 : 0) - (b(14) ? 0.75 : 0);
      let vy = ax(1) + (b(13) ? 0.75 : 0) - (b(12) ? 0.75 : 0);
      if (vx || vy) {
        const step = 0.8 * Math.min(50, dt || 16);   // px per ms — the same feel at any frame rate
        cx = Math.max(4, Math.min(innerWidth - 4, cx + vx * step));
        cy = Math.max(4, Math.min(innerHeight - 4, cy + vy * step));
        lastAct = now;
      }
      if (pad.buttons.some((x, i) => x.pressed !== was(i) || x.pressed)) lastAct = now;
      cur.style.transform = `translate(${cx.toFixed(0)}px, ${cy.toFixed(0)}px)`;
      cur.classList.toggle("hidden", now - lastAct > 6000);
      // Ⓐ / R1 / R2 — press: fast paths on the water, pointer press everywhere else
      for (const bi of [0, 5, 7]) {
        if (b(bi) && !was(bi)) {
          if (!anyModalOpen() && S.mode === "strike") { holdMode = "hook"; sfx("ui"); hookSet(); }
          else if (waterMode() || bowFighting() || (bi !== 0 && !anyModalOpen())) { holdMode = "reel"; onDown(W / 2, H * 0.6); }
          else if (bi === 0) { holdMode = "point"; press(); }
        }
        if (!b(bi) && was(bi) && holdMode) {
          if (holdMode === "reel") onUp();
          else if (holdMode === "point") release();
          holdMode = null;
        }
      }
      // Ⓑ — back out of the top menu, or twitch the lure on the water
      if (b(1) && !was(1)) {
        const m = topModal();
        if (m) {
          const back = m.querySelector(".close-btn") || m.querySelector("#garNo") || m.querySelector(".big-btn.ghost");
          if (back) back.click();
        } else if (S.mode === "retrieve") twitch();
      }
      // Ⓧ guide · Ⓨ tackle · START home · SELECT sound
      if (b(2) && !was(2) && el.guideBtn && !el.guideBtn.classList.contains("fishing-off") && !anyModalOpen()) el.guideBtn.click();
      if (b(3) && !was(3) && !anyModalOpen()) el.shopBtn.click();
      if (b(9) && !was(9)) el.homeBtn.click();
      if (b(8) && !was(8) && !anyModalOpen()) el.muteBtn.click();
      // right stick: scroll an open menu, or steer the trolling motor
      const ry = ax(3), rx = ax(2);
      const m2 = topModal();
      if (m2 && ry) {
        const sb = m2.querySelector(".shop-body") || m2.querySelector(".modal-card");
        if (sb) sb.scrollTop += ry * 16;
      } else if (!m2 && S.mode === "idle") S.steer = rx > 0 ? 1 : rx < 0 ? -1 : (S.steer === 1 || S.steer === -1 ? 0 : S.steer);
      prevB = pad.buttons.map(x => x.pressed);
    };
  })();

  // ===========================================================================
  // THE GUIDE — a warm old-timer built from a family photo: khaki cap, wire
  // glasses, blue plaid. One tap and he reads the water like a real guide.
  // (This portrait style is the template for future angler avatars.)
  // ===========================================================================
  function guideSVG(crop) {
    const vb = crop ? "33 21 54 54" : "0 0 120 120";
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gskin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#eab894"/><stop offset="1" stop-color="#d09a72"/>
        </linearGradient>
        <linearGradient id="gcap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e8dcb8"/><stop offset="1" stop-color="#cdbd92"/>
        </linearGradient>
        <pattern id="gplaid" width="13" height="13" patternUnits="userSpaceOnUse">
          <rect width="13" height="13" fill="#bcd2e2"/>
          <rect width="13" height="4.5" y="4" fill="#93b3cb" opacity=".8"/>
          <rect width="4.5" height="13" x="4" fill="#93b3cb" opacity=".8"/>
          <rect width="13" height="1.3" y="5.6" fill="#eef5fa" opacity=".9"/>
          <rect width="1.3" height="13" x="5.6" fill="#eef5fa" opacity=".9"/>
        </pattern>
        <radialGradient id="gvig" cx="50%" cy="42%" r="75%">
          <stop offset="55%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(20,10,4,.55)"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="#7a563a"/>
      <g stroke="#5f4028" stroke-width="1">
        <line x1="24" y1="0" x2="24" y2="120"/><line x1="52" y1="0" x2="52" y2="120"/>
        <line x1="82" y1="0" x2="82" y2="120"/><line x1="106" y1="0" x2="106" y2="120"/>
      </g>
      <g stroke="#8d6845" stroke-width=".7" opacity=".7">
        <path d="M6,30 q8,3 16,1"/><path d="M60,74 q10,-3 18,0"/><path d="M90,20 q8,4 14,2"/>
      </g>
      <!-- shoulders / plaid shirt -->
      <path d="M14,120 C16,96 34,84 46,81 L74,81 C88,84 104,96 106,120 Z" fill="url(#gplaid)" stroke="#7796ad" stroke-width="1"/>
      <path d="M46,81 L54,92 L60,84 L66,92 L74,81 L74,86 L60,98 L46,86 Z" fill="#a7c2d6" stroke="#7796ad" stroke-width=".8"/>
      <path d="M52,86 L60,120 M68,86 L60,120" stroke="#7796ad" stroke-width=".8" fill="none"/>
      <circle cx="60" cy="104" r="1.3" fill="#5c7a90"/><circle cx="60" cy="113" r="1.3" fill="#5c7a90"/>
      <rect x="55" y="80" width="10" height="7" fill="#3a4a52"/>
      <!-- neck -->
      <path d="M52,68 L68,68 L67,84 L53,84 Z" fill="#d69c74"/>
      <path d="M52,68 L68,68 L67,75 Q60,79 53,75 Z" fill="#b97f57" opacity=".55"/>
      <!-- ears -->
      <ellipse cx="38.5" cy="55" rx="4" ry="6" fill="url(#gskin)"/>
      <ellipse cx="81.5" cy="55" rx="4" ry="6" fill="url(#gskin)"/>
      <!-- gray hair at the temples -->
      <path d="M38,44 q-3,8 0,14 q4,3 6,1 q-3,-8 -1,-15 Z" fill="#d8d8d4"/>
      <path d="M82,44 q3,8 0,14 q-4,3 -6,1 q3,-8 1,-15 Z" fill="#d8d8d4"/>
      <!-- head -->
      <path d="M41,42 Q41,26 60,26 Q79,26 79,42 L79,54 Q79,74 60,76 Q41,74 41,54 Z" fill="url(#gskin)"/>
      <path d="M44,64 Q52,74 60,74 Q68,74 76,64 Q70,72 60,72 Q50,72 44,64 Z" fill="#b97f57" opacity=".35"/>
      <!-- cap -->
      <path d="M40,38 Q40,18 60,18 Q80,18 80,38 L80,40 L40,40 Z" fill="url(#gcap)"/>
      <path d="M40,38 Q60,32 80,38 L80,41 Q60,36 40,41 Z" fill="#b3a479"/>
      <path d="M34,40 Q60,32 86,40 Q88,44 84,45 Q60,38 36,45 Q32,44 34,40 Z" fill="#dccfa6"/>
      <path d="M36,45 Q60,38 84,45 L84,46.5 Q60,40 36,46.5 Z" fill="#a89a71" opacity=".8"/>
      <g stroke="#c23b28" stroke-width="1.1" fill="none" opacity=".9">
        <path d="M53,26 q3,-2 6,0"/><path d="M55,29 q4,-2 8,0"/><path d="M60,32 h6"/>
      </g>
      <path d="M41,41 Q60,36 79,41 L79,45 Q60,40 41,45 Z" fill="#9a6f4b" opacity=".35"/>
      <!-- brows -->
      <path d="M45,45 q5,-2.5 10,-.5" stroke="#bdbdb8" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M65,44.5 q5,-2 10,.5" stroke="#bdbdb8" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- glasses -->
      <g stroke="#7d7a72" stroke-width="1.3" fill="rgba(226,236,244,.28)">
        <rect x="43.5" y="47" width="14.5" height="11" rx="4.5"/>
        <rect x="62" y="47" width="14.5" height="11" rx="4.5"/>
        <path d="M58,51.5 q2,-1.5 4,0" fill="none"/>
        <path d="M43.5,51 L39,52" fill="none"/><path d="M76.5,51 L81,52" fill="none"/>
      </g>
      <!-- eyes: kind, crinkled -->
      <ellipse cx="50.8" cy="52.6" rx="2" ry="2.3" fill="#3c2f26"/>
      <ellipse cx="69.2" cy="52.6" rx="2" ry="2.3" fill="#3c2f26"/>
      <circle cx="51.5" cy="51.8" r=".6" fill="#fff" opacity=".85"/>
      <circle cx="69.9" cy="51.8" r=".6" fill="#fff" opacity=".85"/>
      <path d="M47.5,55.8 q3.2,1.6 6.4,0" stroke="#b97f57" stroke-width=".8" fill="none"/>
      <path d="M66.1,55.8 q3.2,1.6 6.4,0" stroke="#b97f57" stroke-width=".8" fill="none"/>
      <ellipse cx="47" cy="60.5" rx="3.4" ry="2" fill="#e08a66" opacity=".35"/>
      <ellipse cx="73" cy="60.5" rx="3.4" ry="2" fill="#e08a66" opacity=".35"/>
      <!-- nose -->
      <path d="M60,52 q-1.6,6 -2.6,8.2 q2.6,2 5.2,0 Q61.4,58 60,52" fill="#cf9068" opacity=".8"/>
      <!-- laugh lines -->
      <path d="M50,62 q1.6,3.4 4,4.6" stroke="#b97f57" stroke-width=".9" fill="none" opacity=".8"/>
      <path d="M70,62 q-1.6,3.4 -4,4.6" stroke="#b97f57" stroke-width=".9" fill="none" opacity=".8"/>
      <!-- big warm smile -->
      <path d="M50,64.5 Q60,72.5 70,64.5 Q66,70.5 60,70.5 Q54,70.5 50,64.5 Z" fill="#8a4a37"/>
      <path d="M52.2,65.6 Q60,70.6 67.8,65.6 Q60,68.9 52.2,65.6 Z" fill="#f4efe6"/>
      <path d="M50,64.5 Q60,72.5 70,64.5" stroke="#7e4432" stroke-width="1" fill="none"/>
      <rect width="120" height="120" fill="url(#gvig)"/>
    </svg>`;
  }
  // gather everything the engine knows into one plain-spoken guide read
  function guideReport() {
    const c = S.cond, sp = spot(), pos = position(), w = WEATHER[c.weather], sea = SEASONS[c.season] || SEASONS.summer;
    const hour = c.timeMin / 60, ft = Math.round(c.band * 24);
    const zone = c.band < 0.34 ? "shallow" : c.band < 0.67 ? "mid-depth" : "deep";
    const best = bestLureNow();
    const here = STRUCT_GROUP[pos.id] || "open", bestGrp = bestSeasonGroup(), fit = seasonFit();
    const bestPos = sp.positions.find(p => (STRUCT_GROUP[p.id] || "open") === bestGrp);
    const colorRec = preferredFam() === "natural" ? "natural colors — greens, shad, black" : "something loud — chartreuse, red, gold";
    // best size / line / scent for the recommended lure, scored the same way the pickers score
    let szBest = "med", szPct = -1;
    for (const k of SIZE_ORDER) { const p = lureScore(best ? best.lure : lure(), null, k).pct; if (p > szPct) { szPct = p; szBest = k; } }
    let lnBest = "mono", lnPct = -1;
    for (const k of LINE_ORDER) { const p = lineFit(k); if (p > lnPct) { lnPct = p; lnBest = k; } }
    const savedSc = G.attractant; let scBest = "none", scPct = -1;
    for (const k in ATTRACTANTS) { G.attractant = k; const p = lureScore(best ? best.lure : lure()).pct; if (p > scPct) { scPct = p; scBest = k; } }
    G.attractant = savedSc;
    const lowLight = hour < 8 || hour > 18 || c.weather === "night" || c.weather === "fog";
    const why =
      c.weather === "rain" ? "That rain's putting fresh oxygen in the shallows — they'll chase a moving bait." :
      c.weather === "fog" ? "Fog keeps the light low all day. They'll roam like it's dawn — cover water." :
      c.weather === "night" ? "Dark water, big appetite. The giants hunt shallow at night — slow and loud." :
      c.weather === "sun" && hour >= 10 && hour <= 16 ? "Bright midday sun pins 'em tight to shade and deep edges. Put it right on their nose." :
      lowLight ? "Low light has 'em up and prowling — prime feeding window, don't waste it." :
      c.temp < 50 ? "Cold water slows their motor way down. Half-speed everything and let it soak." :
      c.temp > 82 ? "Bathwater up top — the better fish slide deep where it's cool. Follow 'em down." :
      "Fair conditions — the fish are where the food and cover meet. Fish the pattern, not the memory.";
    const spotLine = fit >= 1.15
      ? `You're parked on the right stuff — ${STRUCT_LABEL[here]} is exactly the ${sea.name.toLowerCase()} pattern. Stay put.`
      : fit <= 0.85
        ? `I'd move. This ${sea.name.toLowerCase()}, the fish want ${STRUCT_LABEL[bestGrp]}${bestPos ? ` — slide over to ${bestPos.ico} ${bestPos.name}` : ""}.`
        : `Fair spot. If it goes quiet, the ${sea.name.toLowerCase()} pattern is ${STRUCT_LABEL[bestGrp]}${bestPos ? ` — ${bestPos.ico} ${bestPos.name} has it` : ""}.`;
    const greet = hour < 11 ? "Mornin'!" : hour < 17 ? "Afternoon!" : hour < 21 ? "Evenin'!" : "Still out here, huh?";
    const signs = ["Now go get 'em.", "That big girl's out there somewhere.", "Keep your hook sharp.", "Set it like you mean it.", "Tight lines, kid."];
    return `
      <p><b>${greet}</b> ${sea.ico} ${sea.name}, ${w.ico} ${w.name.toLowerCase()}, water's ${c.temp}°, ${moonNow().ico} ${moonNow().name.toLowerCase()} moon, ${fmtClock(c.timeMin)}. Bass are holding <b>${zone}</b> — call it <b>${ft} ft</b>.</p>
      <p>🗺️ ${spotLine}</p>
      <p>🧰 Tie on the <b>${best ? best.lure.ico + " " + best.lure.name : "worm"}</b>${best ? ` <span style="color:${ratingColor(best.pct)}">(${best.pct} bite)</span>` : ""} in <b>${SIZES[szBest].name.toLowerCase()}</b>, ${colorRec}. Spool up <b>${LINES[lnBest].name}</b>${scBest !== "none" ? `, and a shot of <b>${ATTRACTANTS[scBest].name}</b> wouldn't hurt` : ""}.</p>
      <p>💡 ${why}</p>
      <p class="g-sign">— ${signs[Math.floor(c.timeMin / 97) % signs.length]}</p>`;
  }
  const GUIDE_TOPICS = [
    ["📅 Daily Tournament", "One entry a day, whole world's in. Rules rotate at midnight UTC — the flashing scroll on the menu takes you straight there. Your 4-digit PIN is your identity: same PIN, any phone."],
    ["🥊 Duels", "Circuit menu → CALL SOMEBODY OUT. Name an angler, text them the link, you each fish one 3:00 run. The W-L record between you two is forever, and their fish stream onto your ticker live."],
    ["🎪 Host a Tournament", "Circuit menu → HOST YOUR OWN. Pick the water and format, text the invite link — everyone gets one entry, standings run 48 hours."],
    ["🏆 Pro Season", "Circuit menu → PRO SEASON. Six events against seven loud pros, F1 points, sponsor deals that pay, a 100k champion's purse."],
    ["👑 Weekly Championship", "Every daily you fish earns points toward the Mon–Sun crown — best 5 of 7 days. Last week's champ wears the 👑 on the rankings."],
    ["🚤 The Garage", "Spend your points: a faster trolling motor, pro sonar, a landing net that saves break-offs, hull wraps, a boat name — and the Paint Bench, where you mix a custom lure color and name it."],
    ["📼 Replays", "See a ▶ next to somebody's daily or event run? Tap it — their whole run plays back, catch by catch."],
    ["📣 Share a Lunker", "Land a 6 lb+ bass and hit SHARE — the link opens your full catch card anywhere: the spot on the map, the lure, the conditions."],
    ["📥 New phone?", "Title screen → Restore my angler. Your name + daily PIN pulls your whole career onto any device."],
    ["❓ Secret spots", "Folks say every angler in the stable has a place they don't talk about. Fish the right water as the right angler and watch the map…"],
  ];
  function openGuide() {
    document.getElementById("guideFace").innerHTML = guideSVG(false);
    document.getElementById("guideBody").innerHTML = guideReport() +
      `<div class="g-topics"><div class="rec-h" style="margin-top:12px">🧭 Ask me about the game</div>` +
      GUIDE_TOPICS.map(([t, d]) => `<details class="g-topic"><summary>${t}</summary><p>${d}</p></details>`).join("") + `</div>`;
    el.guideModal.classList.remove("hidden");
    sfx("ui");
  }
  // 🆕 What's New — shows itself once per version, lives behind the title link
  const WHATS_NEW = [
    "💪 <b>Bubba joins the crew</b> — The Hoss. Word is something's holed up under the bluff timber at Highland…",
    "🖌️ <b>The Paint Bench</b> — mix your own lure color in the Garage, name it, fish it on every lure in the box.",
    "🪶 <b>Alisa joins the crew</b> — the finesse specialist. She's heard something's sipping below the dam at first light…",
    "🌄 <b>Grande Falls Tailwater</b> — smallmouth country. Land an 8 lb+ giant to unlock it.",
    "🏆 <b>Pro Season</b> — a six-event career vs seven trash-talking pros, sponsor money, a champion's purse.",
    "🚤 <b>The Garage</b> — trolling motor, pro sonar, landing net, hull wraps + a boat name for the board.",
    "🥊 <b>Duels</b> — call somebody out, fish head-to-head, the W-L record is forever. Their fish stream in live.",
    "📼 <b>Replays</b> — tap ▶ on anyone's daily or event run and watch it back catch by catch.",
    "🔥 <b>Reactions + the Bell</b> — drop 🔥🐟😂🤯 on a bag; callouts and verdicts land in your 🔔.",
    "👑 <b>Weekly Championship</b> — every daily counts toward the Mon–Sun crown.",
  ];
  function openNews() {
    el.newsBody.innerHTML = WHATS_NEW.map(x => `<div class="notif-row fresh">${x}</div>`).join("");
    el.newsModal.classList.remove("hidden");
    G.newsV = window.BB_V || "0"; save();
  }
  el.tsNews.addEventListener("click", () => { sfx("ui"); openNews(); });
  el.newsClose.addEventListener("click", () => el.newsModal.classList.add("hidden"));

  // ===========================================================================
  // TITLE SCREEN — name entry + mode select on boot; 🏠 from the map returns here
  // ===========================================================================
  function showTitle() {
    el.anglerName.value = G.name || "";
    const biggest = Object.values(G.records || {}).reduce((m, w) => Math.max(m, w), 0);
    const bits = [];   // each chip deep-links to the screen that tells its story
    if (G.coins) bits.push([`🏆 ${G.coins.toLocaleString()} pts`, "records"]);
    if (biggest) bits.push([`🐟 best ${biggest.toFixed(1)} lb`, "trophy"]);
    if (G.arcadeBestScore) bits.push([`🕹️ ${G.arcadeBestScore.toLocaleString()}`, "circuit"]);
    if ((G.season || {}).titles) bits.push([`👑 ${G.season.titles}`, "circuit"]);
    el.titleStats.innerHTML = bits.map(([b, act]) => `<span data-open="${act}">${b}</span>`).join("");
    el.titleStats.classList.toggle("hidden", !bits.length);
    // a suspended tournament or arcade run resumes right from the menu
    const pr = G.pausedTour ? `▶ RESUME ${G.pausedTour.t.name.toUpperCase()} · ${fmtT(G.pausedTour.t.timeLeft)} LEFT`
      : G.pausedArcade ? `▶ RESUME ARCADE · S${G.pausedArcade.a.stage + 1}/4 · ${fmtT(G.pausedArcade.a.timeLeft)}` : null;
    el.tsResume.classList.toggle("hidden", !pr);
    if (pr) el.tsResume.textContent = pr;
    el.tsFree.textContent = S.dayStarted ? "🎣 BACK TO THE WATER" : "🎣 GO FISHING";
    if (el.tsDaily) {
      const dToday = G.dailyDone === dayKey();
      el.tsDaily.innerHTML = dToday ? "📅 DAILY — FISHED TODAY ✓" : "📅 DAILY TOURNAMENT";
      el.tsDaily.classList.toggle("fresh", !dToday);
    }
    renderTitleTicker();
    try { fetchInbox().then(updateBell); } catch (e) {}
    try { pruneOldData(); } catch (e) {}
    if (el.tsNews) el.tsNews.classList.toggle("fresh", G.newsV !== (window.BB_V || "0"));
    if (G.newsV !== (window.BB_V || "0") && G.name && !S.dayStarted) setTimeout(() => { if (!anyModalOpen() || !el.titleScreen.classList.contains("hidden")) openNews(); }, 700);
    el.titleScreen.classList.remove("hidden");
    flushSharedLinks();
    Music.setScene("title");
  }
  function closeTitle(keepTheme) {
    const n = (el.anglerName.value || "").trim().toUpperCase().slice(0, 12);
    if (n) G.name = n;
    if (!G.name) G.name = "ANGLER";
    el.anglerName.blur();
    el.titleScreen.classList.add("hidden");
    if (!keepTheme) Music.setScene("game");   // theme keeps playing through lake/spot/tackle prep
    save(); updateHUD();
  }
  el.tsFree.addEventListener("click", () => {
    sfx("ui");
    const go = () => { if (S.dayStarted) { closeTitle(); return; } closeTitle(true); startPrep(); };
    if (openDailySheet(true, go)) return;   // once a day: "wanna fish the daily?"
    go();
  });
  el.tsArcade.addEventListener("click", () => { closeTitle(); sfx("ui"); startArcade(); });
  el.tsTour.addEventListener("click", () => { closeTitle(); sfx("ui"); openCircuit(); });
  el.tsTutorial.addEventListener("click", () => { closeTitle(); sfx("ui"); startTutorial(); });
  el.tsResume.addEventListener("click", () => { closeTitle(); sfx("good"); resumeRun(); });
  el.tsBoard.addEventListener("click", () => { sfx("ui"); LB.open(); });
  // the stat chips on the menu deep-link to the screens behind the numbers
  el.titleStats.addEventListener("click", (e) => {
    const s2 = e.target.closest("[data-open]"); if (!s2) return;
    sfx("ui");
    if (s2.dataset.open === "records") openRecords();
    else if (s2.dataset.open === "trophy") openTrophyRoom();
    else { closeTitle(true); openCircuit(); }
  });
  el.menuBtn.addEventListener("click", () => { el.mapModal.classList.add("hidden"); sfx("ui"); showTitle(); });
  el.guideBtn.innerHTML = guideSVG(true);
  el.guideBtn.addEventListener("click", openGuide);
  el.guideClose.addEventListener("click", () => el.guideModal.classList.add("hidden"));
  // 🏠 from anywhere: an active tournament/arcade run is saved, not lost
  el.homeBtn.addEventListener("click", () => {
    if ((S.tournament && !S.tournament.ended) || (S.arcade && !S.arcade.ended)) suspendRun();
    if (S.bow) cancelBowfish();
    if (S.tut) endTutorial(false);
    sfx("ui"); showTitle();
  });

  // ---- suspend & resume: a run in progress survives leaving to the menu (and
  // the save), so you can put the phone down mid-tournament and pick it up later
  function suspendRun() {
    if (S.tournament && !S.tournament.ended) {
      G.pausedTour = { t: S.tournament, spot: G.spot, weather: S.cond.weather, hotLure: S.cond.hotLure, angler: G.angler };
      duelStreamStop(S.tournament);
      S.tournament = null;
      el.tourHud.classList.add("hidden");
      el.dailyTicker.classList.add("hidden");
      toast("🏁 Tournament saved — resume from the menu ▶");
    } else if (S.arcade && !S.arcade.ended) {
      G.pausedArcade = { a: S.arcade, prev: S.arcadePrev, hotLure: S.cond.hotLure, angler: G.angler };
      S.arcade = null; S.arcadePrev = null;
      el.arcadeHud.classList.add("hidden");
      toast("🕹️ Arcade run saved — resume from the menu ▶");
    }
    resetToIdle(); save(); updateHUD();
  }
  function resumeRun() {
    S.dayStarted = true;
    if (G.pausedTour) {
      const p = G.pausedTour; G.pausedTour = null;
      if (p.angler) G.angler = p.angler;
      G.spot = p.spot; seedFish();
      if (p.weather) S.cond.weather = p.weather;
      S.cond.hotLure = p.hotLure;
      S.tournament = p.t;
      recomputeCond(); renderConditions();
      el.tourHud.classList.remove("hidden"); renderWell(); renderTourBoard();
      if (p.t.daily || p.t.custom) { el.dailyTicker.classList.remove("hidden"); refreshDailyLive(p.t); if (p.t.duel) duelStream(p.t); }
      toast(`🏁 ${p.t.name} — back on the water!`);
    } else if (G.pausedArcade) {
      const p = G.pausedArcade; G.pausedArcade = null;
      if (p.angler) G.angler = p.angler;
      S.arcade = p.a; S.arcadePrev = p.prev;
      const st = ARCADE_STAGES[S.arcade.stage];
      G.spot = st.spot; G.positions[st.spot] = st.pos;
      S.cond.weather = st.weather; S.cond.timeMin = st.timeMin; S.cond.hotLure = p.hotLure;
      recomputeCond(); renderConditions(); seedFish();
      el.arcadeHud.classList.remove("hidden"); renderArcadeHud();
      toast(`🕹️ STAGE ${S.arcade.stage + 1}/4 — the clock's running!`);
    }
    resetToIdle(); save(); updateHUD();
  }
  function dropPausedRuns() {
    if (G.pausedTour || G.pausedArcade) { G.pausedTour = null; G.pausedArcade = null; toast("Saved run abandoned"); }
  }

  // ---- GO FISHING prep wizard: lake → spot → tackle, the theme playing all the
  // way — each step has room to read the weather and conditions before lines-in
  function startPrep() { gotoPrep(1); }
  // step numbering: free play runs 1..9 (angler..scent); tournaments skip the
  // lake step (the event fixed it) and renumber the rest as 1..8
  function prepNum(step) { return S.prepTour ? `${step === 1 ? 1 : step - 1} of 8` : `${step} of 9`; }
  function gotoPrep(step) {
    S.prep = step;
    el.mapModal.classList.add("hidden"); el.lureModal.classList.add("hidden"); el.rodModal.classList.add("hidden"); el.anglerModal.classList.add("hidden");
    if (step === 1) openAnglers();
    else if (step <= 3) openMap();
    else if (step === 4) openRods();
    else openLures();
  }
  // ✕ or backing all the way out of the wizard — to the menu, or back to the
  // event sheet when it's a tournament prep
  function exitPrep() {
    const wasTour = S.prepTour;
    S.prep = null; S.prepTour = false;
    el.lureFish.classList.add("hidden"); el.lureBack.classList.add("hidden");
    el.mapModal.classList.add("hidden"); el.lureModal.classList.add("hidden"); el.rodModal.classList.add("hidden"); el.anglerModal.classList.add("hidden");
    if (wasTour && pendingTour) { refreshTourStart(); el.tourStartModal.classList.remove("hidden"); }
    else showTitle();
  }
  function finishPrep() {
    S.prep = null;
    el.lureFish.classList.add("hidden"); el.lureBack.classList.add("hidden");
    el.lureModal.classList.add("hidden");
    S.dayStarted = true;
    Music.setScene("game");
    resetToIdle(); save(); updateHUD();
    toast(`🎣 ${spot().name} — ${position().name}. Lines in!`);
  }
  function finishTourPrep() {
    S.prep = null; S.prepTour = false;
    el.lureFish.classList.add("hidden"); el.lureBack.classList.add("hidden");
    el.lureModal.classList.add("hidden");
    S.dayStarted = true;
    startTournament();
  }
  // the slider labels ARE the per-channel mute toggles
  function updateVolLabels() {
    const m = document.getElementById("musicMuteLbl"), s2 = document.getElementById("sfxMuteLbl");
    if (m) { m.textContent = (G.musicOn === false ? "🔇" : "🎵") + " Music"; m.classList.toggle("off", G.musicOn === false); }
    if (s2) { s2.textContent = (G.muted ? "🔇" : "🔊") + " Effects"; s2.classList.toggle("off", !!G.muted); }
  }
  function setSfxMuted(m) {
    G.muted = m; Sound.setMuted(m);
    if (!m) Sound.ensure();
    save(); updateHUD(); updateVolLabels();
  }
  document.getElementById("musicMuteLbl").addEventListener("click", () => { Music.setOn(G.musicOn === false); updateVolLabels(); updateHUD(); sfx("ui"); });
  document.getElementById("sfxMuteLbl").addEventListener("click", () => { setSfxMuted(!G.muted); if (!G.muted) sfx("ui"); });
  updateVolLabels();
  // volume sliders — live while you drag, saved when you let go
  const volCtl = (id, pctId, get, set) => {
    const r = document.getElementById(id), p = document.getElementById(pctId);
    if (!r) return;
    r.value = Math.round(get() * 100); p.textContent = r.value;
    r.addEventListener("input", () => { set(r.value / 100); p.textContent = r.value; });
    r.addEventListener("change", () => { save(); sfx("ui"); });
  };
  volCtl("musicVol", "musicVolPct", () => (G.musicVol != null ? G.musicVol : 0.6), v => { G.musicVol = v; Music.setVolume(); });
  volCtl("sfxVol", "sfxVolPct", () => (G.sfxVol != null ? G.sfxVol : 1), v => {
    G.sfxVol = v; Sound.setVolume();
    // audible feedback while dragging so you can hear the level you're setting
    if (!volCtl._t || Date.now() - volCtl._t > 160) { volCtl._t = Date.now(); Sound.ensure(); sfx("ui"); }
  });
  el.anglerName.addEventListener("keydown", (e) => { if (e.key === "Enter") el.anglerName.blur(); });

  // ===========================================================================
  // TUTORIAL — a coach banner that watches real play and advances step by step
  // ===========================================================================
  const TUT_STEPS = [
    "Press & HOLD the water, drag to aim at the 🎯 ring, then RELEASE to cast",
    "TAP to twitch the lure; pause and it sinks. Work it inside the green 🎯 BITE ZONE",
    "A bass is closing in — hold that rhythm, keep it in the zone…",
    "STRIKE! Tap the meter when the sweeping marker hits the green!",
    "HOLD reel to gain line, let GO when the tension bar runs red — tire it out!",
  ];
  function startTutorial() {
    if (S.tournament && !S.tournament.ended) { toast("Tournament in progress ⏱️"); return; }
    if (S.arcade && !S.arcade.ended) { toast("Arcade run in progress 🕹️"); return; }
    // friendly water: shallow cove pads on a cloudy summer morning = hungry fish
    G.spot = "cove"; G.positions.cove = "pads";
    S.cond.weather = "cloud"; S.cond.timeMin = 7 * 60 + 30; S.cond.season = "summer"; S.cond.front = 0.05;
    recomputeCond(); renderConditions(); seedFish(); resetToIdle();
    S.dayStarted = true;
    S.tut = { step: -1 };
    el.tutBanner.classList.remove("hidden");
    tutShow(0);
    save(); updateHUD();
    toast("🎓 Let's catch your first bass!");
  }
  function tutShow(i) {
    if (!S.tut || S.tut.step === i) return;
    S.tut.step = i;
    el.tutStep.textContent = (i + 1) + "/" + TUT_STEPS.length;
    el.tutText.textContent = TUT_STEPS[i];
  }
  function endTutorial(done) {
    if (!S.tut) return;
    S.tut = null;
    el.tutBanner.classList.add("hidden");
    if (done) {
      G.tutorialDone = true; save();
      sfx("weighwin");
      setTimeout(() => toast("🎓 Tutorial complete — you're a bass angler now! Tap 📍 to explore, 🧰 for tackle 🎉"), 1600);
    }
  }
  el.tutSkip.addEventListener("click", () => { endTutorial(false); sfx("ui"); toast("Tutorial skipped — tight lines!"); });
  function updateTutorial() {
    const T = S.tut; if (!T) return;
    if (S.mode === "caught" || S.mode === "landing") { endTutorial(true); return; }
    if (S.mode === "fight") tutShow(4);
    else if (S.mode === "strike") tutShow(3);
    else if (S.mode === "retrieve") { if (S.rv.interest > 0.42) tutShow(2); else if (T.step !== 2) tutShow(1); }
    else if (S.mode === "idle" && T.step > 0) { tutShow(0); el.tutText.textContent = "It got away — happens to the pros too. Cast again!"; }
  }

  function openCircuit() {
    if (S.tournament && !S.tournament.ended) { toast("Tournament in progress ⏱️"); return; }
    if (S.arcade && !S.arcade.ended) { toast("Arcade run in progress 🕹️"); return; }
    const season = G.season || { best: {}, titles: 0 };
    const seasonPts = Object.values(season.best || {}).reduce((s, p) => s + p, 0);
    const seasonEvents = Object.keys(season.best || {}).length;
    document.getElementById("circuitSeason").innerHTML =
      `Season: <b>${seasonPts} pts</b> · ${seasonEvents}/${TOURNAMENTS.length} events` +
      (season.titles ? ` · 👑 <b>${season.titles}</b> title${season.titles > 1 ? "s" : ""}` : "");
    const list = document.getElementById("circuitList");
    const arcadeBest = G.arcadeBestScore ? ` · best <b style="color:var(--gold)">${G.arcadeBestScore.toLocaleString()}</b>` : "";
    const dk0 = dayKey(), dr0 = dailyRules(dk0), dsp0 = SPOTS.find(s => s.id === dr0.spot) || SPOTS[0];
    const dDone0 = G.dailyDone === dk0;
    list.innerHTML = `<div class="item circuit" data-daily="1">
        <div class="item-ico">📅</div>
        <div class="item-info">
          <div class="item-name">DAILY — ${dr0.mode.name}</div>
          <div class="item-desc">${dsp0.ico} ${dsp0.name} · 3:00 · ${dr0.mode.rule} One entry a day, against the whole world.${dDone0 ? ` · <span style="color:#5be37a">✓ fished today</span>` : ""}</div>
        </div>
        <button class="item-btn owned" data-daily="1">${dDone0 ? "VIEW" : "ENTER"}</button>
      </div><div class="item circuit" data-pro="1">
        <div class="item-ico">🎬</div>
        <div class="item-info">
          <div class="item-name">PRO SEASON${(G.pro && !G.pro.done) ? ` — ROUND ${G.pro.round + 1}/6` : (G.pro && G.pro.titles) ? ` — 👑 ${G.pro.titles} title${G.pro.titles > 1 ? "s" : ""}` : ""}</div>
          <div class="item-desc">Six events, a cast of loud-mouthed pros, sponsor money, one champion. Your career starts here.</div>
        </div>
        <button class="item-btn owned" data-pro="1">${G.pro && !G.pro.done ? "CONTINUE" : "START"}</button>
      </div><div class="item circuit" data-duel="1">
        <div class="item-ico">🥊</div>
        <div class="item-info">
          <div class="item-name">CALL SOMEBODY OUT</div>
          <div class="item-desc">Name an angler, pick the water, text the callout. Head-to-head, one run each — the W-L record is forever.</div>
        </div>
        <button class="item-btn owned" data-duel="1">DUEL</button>
      </div><div class="item circuit" data-host="1">
        <div class="item-ico">🎪</div>
        <div class="item-info">
          <div class="item-name">HOST YOUR OWN</div>
          <div class="item-desc">Pick the water and format, get an invite link, text the crew. One entry each — bragging rights on the line.</div>
        </div>
        <button class="item-btn owned" data-host="1">HOST</button>
      </div><div class="item circuit arcade-item" data-arcade="1">
        <div class="item-ico">🕹️</div>
        <div class="item-info">
          <div class="item-name">ARCADE — Get Bass</div>
          <div class="item-desc">4 stages, 4 lakes, dawn to night. Beat the weight quota before time runs out — every fish buys time. Finale: land ONE giant.${arcadeBest}</div>
        </div>
        <button class="item-btn owned" data-arcade="1">PLAY</button>
      </div>` + TOURNAMENTS.map(t => {
      const sp = SPOTS.find(s => s.id === t.spot) || SPOTS[0];
      const mins = Math.round(t.dur / 60000), secs = Math.round(t.dur / 1000) % 60;
      const best = (season.best || {})[t.id] || 0;
      const done = best ? ` · <span style="color:#5be37a">✓ ${best} pts</span>` : "";
      return `<div class="item circuit" data-tour="${t.id}">
        <div class="item-ico">${sp.ico}</div>
        <div class="item-info">
          <div class="item-name">${t.name}</div>
          <div class="item-desc">${sp.name} · ${mins}:${String(secs).padStart(2, "0")} · field of ${t.field}${done}<br>${t.blurb}</div>
        </div>
        <button class="item-btn owned" data-tour="${t.id}">ENTER</button>
      </div>`;
    }).join("");
    el.modeModal.classList.remove("hidden");
  }
  function chooseTour(id) {
    const t = TOURNAMENTS.find(x => x.id === id); if (!t) return;
    pendingTour = t;
    // hop to that lake so the player can read conditions & set tackle for it
    if (G.spot !== t.spot) { G.spot = t.spot; seedFish(); rollConditions(); }
    save(); updateHUD(); resetToIdle();
    el.modeModal.classList.add("hidden");
    refreshTourStart();
    el.tourStartModal.classList.remove("hidden");
  }
  function refreshTourStart() {
    if (!pendingTour) return;
    const t = pendingTour, sp = SPOTS.find(s => s.id === t.spot) || spot();
    const mins = Math.round(t.dur / 60000), secs = Math.round(t.dur / 1000) % 60;
    document.getElementById("tourTitle").textContent = t.name;
    const tm = document.getElementById("tourMap"), tl = document.getElementById("tourLore");
    if (tm) tm.innerHTML = lakeTopoSVG(sp);
    if (tl) tl.innerHTML = sp.lore ? `📍 ${sp.lore.where}<br>📏 ${sp.lore.size} · 🌊 ${sp.lore.depth} · 💧 ${sp.clarity} water · 🏆 record ${sp.lore.record}` : "";
    el.tourRules.textContent = `${sp.name} • ${mins}:${String(secs).padStart(2, "0")} on the clock.`
      + (t.daily ? " 📅 DAILY: " + (DAILY_MODES.find(m => m.id === t.mode) || DAILY_MODES[0]).rule
        : t.custom ? " 🎪 CREW EVENT: " + (DAILY_MODES.find(m => m.id === t.mode) || DAILY_MODES[0]).rule : "");
    el.tourField.textContent = t.custom ? "your whole crew" : t.field;
    const lu = lure();
    document.getElementById("tourTackle").innerHTML =
      `<b>Your tackle:</b> ${rod().ico} ${rod().name} · ${lu.ico} ${lu.name} <i style="display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;background:${COLORS[G.lure.color].hex};border:1px solid rgba(255,255,255,.5)"></i>`;
  }
  el.tourneyBtn.addEventListener("click", openCircuit);
  el.modeClose.addEventListener("click", () => el.modeModal.classList.add("hidden"));
  el.modeModal.addEventListener("click", (e) => { const p0 = e.target.closest("[data-pro]"); if (p0) { el.modeModal.classList.add("hidden"); sfx("ui"); openProSeason(); return; } const x0 = e.target.closest("[data-duel]"); if (x0) { el.modeModal.classList.add("hidden"); sfx("ui"); openDuelSheet(); return; } const h0 = e.target.closest("[data-host]"); if (h0) { el.modeModal.classList.add("hidden"); sfx("ui"); openHostSheet(); return; } const d0 = e.target.closest("[data-daily]"); if (d0) { el.modeModal.classList.add("hidden"); openDailySheet(false); return; } const a = e.target.closest("[data-arcade]"); if (a) { startArcade(); return; } const b = e.target.closest("[data-tour]"); if (b) chooseTour(b.dataset.tour); });

  // ===========================================================================
  // Conditions: time of day, weather, water temperature -> fish holding depth
  // ===========================================================================
  const WEATHER = {
    sun:    { ico: "☀️", name: "Sunny",    fam: "natural", warm: 6 },
    cloud:  { ico: "☁️", name: "Cloudy",   fam: "bright",  warm: 1 },
    rain:   { ico: "🌧️", name: "Rain",     fam: "bright",  warm: -2 },
    fog:    { ico: "🌫️", name: "Foggy",    fam: "bright",  warm: -1 },
    night:  { ico: "🌙", name: "Night",    fam: "bright",  warm: -4 },
  };
  // weather drifts during a session — a passing front. Higher rank = more overcast.
  const WX_NEXT = { sun: [["sun", 0.55], ["cloud", 0.45]], cloud: [["cloud", 0.38], ["sun", 0.3], ["rain", 0.22], ["fog", 0.1]], rain: [["rain", 0.45], ["cloud", 0.55]], fog: [["fog", 0.32], ["sun", 0.42], ["cloud", 0.26]] };
  const WX_RANK = { sun: 0, fog: 1, cloud: 2, rain: 3 };
  function maybeShiftWeather() {
    const c = S.cond;
    if (spot().id === "deep") return;                 // Trophy Lake is always a night bite
    c.wxT = (c.wxT || 0) + 1;
    if (c.wxT < 2 || Math.random() > 0.3) return;     // a couple casts between fronts
    c.wxT = 0;
    const opts = WX_NEXT[c.weather] || WX_NEXT.sun;
    let r = Math.random(), next = c.weather;
    for (const [w, p] of opts) { r -= p; if (r <= 0) { next = w; break; } }
    if (next === c.weather) return;
    const building = (WX_RANK[next] || 0) > (WX_RANK[c.weather] || 0);   // weather worsening
    c.front = building ? 0.2 : -0.24;                 // pre-front feed vs post-front bluebird
    c.weather = next;
    recomputeCond(); renderConditions();
    const w = WEATHER[next];
    toast(building ? `${w.ico} ${w.name} moving in — bite's firing up! 🔥` : `${w.ico} ${w.name} after the front — tougher bite 🥶`);
  }
  // Seasonal patterns layered on the daily cycle — real bass behaviour.
  const SEASONS = {
    spring: { name: "Spring", ico: "🌱", tempBase: 60, depth: -0.14, activity: 0.22, note: "Pre-spawn — bass move shallow" },
    summer: { name: "Summer", ico: "☀️", tempBase: 80, depth: 0.14, activity: 0.0, note: "Heat pushes bass deep (early/late best)" },
    fall:   { name: "Fall",   ico: "🍂", tempBase: 62, depth: -0.06, activity: 0.24, note: "Fall feed-up — bass chase bait" },
    winter: { name: "Winter", ico: "❄️", tempBase: 45, depth: 0.20, activity: -0.28, note: "Cold water — slow & deep" },
  };
  const SEASON_ORDER = ["spring", "summer", "fall", "winter"];

  // Moon phase — real solunar effect: bass feed hardest around the new & full
  // moon, slack on the quarters. The phase is the same at every lake (it's the
  // sky), drifts a phase per in-game day, and is logged with every catch.
  const MOON = [
    { ico: "🌑", name: "New Moon", feed: 0.12 },
    { ico: "🌒", name: "Waxing Crescent", feed: 0.0 },
    { ico: "🌓", name: "First Quarter", feed: -0.05 },
    { ico: "🌔", name: "Waxing Gibbous", feed: 0.05 },
    { ico: "🌕", name: "Full Moon", feed: 0.12 },
    { ico: "🌖", name: "Waning Gibbous", feed: 0.05 },
    { ico: "🌗", name: "Last Quarter", feed: -0.05 },
    { ico: "🌘", name: "Waning Crescent", feed: 0.0 },
  ];
  function moonNow() { return MOON[(((S.cond.moon || 0) % 8) + 8) % 8]; }

  function rollConditions() {
    const sp = spot();
    if (sp.id === "deep") S.cond.weather = "night";
    else { const r = Math.random(); S.cond.weather = r < 0.45 ? "sun" : r < 0.7 ? "cloud" : r < 0.88 ? "fog" : "rain"; }
    S.cond.front = 0; S.cond.wxT = 0;
    S.cond.timeMin = (sp.id === "deep" ? 21 * 60 : 6 * 60) + Math.random() * 120;
    if (!S.cond.season) S.cond.season = SEASON_ORDER[Math.floor(Math.random() * 4)];
    if (S.cond.moon == null) S.cond.moon = Math.floor(Math.random() * 8);   // same moon across lakes, set once
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
    const weatherShift = wx === "sun" ? 0.08 : wx === "cloud" ? -0.04 : wx === "rain" ? -0.06 : wx === "fog" ? -0.08 : -0.10; // night up
    const tempShift = c.temp < 50 ? 0.14 : c.temp > 82 ? 0.12 : 0; // temp extremes push deep
    c.band = clamp(base + timeShift + weatherShift + tempShift, 0.05, 0.96);

    // Feeding window: wide & easy when fish are active, tight when conditions are tough.
    // A passing front layers on top: building weather fires them up, a bluebird
    // post-front shuts them down (c.front, set + decayed as weather drifts).
    const lowLight = midday < 0.45 || wx !== "sun";
    const moderate = c.temp >= 56 && c.temp <= 78;
    let activity = 0.4 + sea.activity + (lowLight ? 0.2 : 0) + (moderate ? 0.18 : 0) + (wx === "cloud" || wx === "fog" || wx === "rain" ? 0.14 : 0) + (c.front || 0) + moonNow().feed;
    c.activity = clamp(activity, 0.12, 1);
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
    if (el.condMoon) { const mn = moonNow(); el.condMoon.textContent = mn.ico; el.condMoon.title = mn.name; }
    el.condClock.textContent = fmtClock(c.timeMin);
  }

  // ===========================================================================
  // Bite-rating engine — realistic "what to throw right now" scoring.
  // Combines depth, light/color, time, water temp, weather and structure so the
  // rating both drives the catch odds and teaches real lure selection.
  // ===========================================================================
  const STRUCT_GROUP = {
    pads: "veg", weed: "veg", reeds: "veg", tailout: "veg", flat: "veg", duckweed: "veg",
    dock: "wood", bank: "wood", logs: "wood", pool: "wood", stump: "wood", marina: "wood", bridge: "wood",
    rocks: "rock", point: "rock", riffle: "rock", levee: "rock", hump: "rock", road: "rock",
    drop: "deep", hole: "deep", open: "open", creek: "open", creek2: "open", eddy: "open",
  };
  // Seasonal patterns: bass relate to different structure through the year, so
  // where you fish should follow the season. These multiply the bite/ambush rate
  // by the current structure group, and the finder coaches you to the pattern.
  const SEASON_STRUCT = {
    spring: { veg: 1.40, wood: 1.28, rock: 0.90, deep: 0.62, open: 0.85, tip: "shallow spawning cover — pads, wood & grass" },
    summer: { veg: 0.88, wood: 0.95, rock: 1.15, deep: 1.34, open: 1.00, tip: "deep ledges & points midday, shallow at dawn/dusk" },
    fall:   { veg: 1.22, wood: 1.05, rock: 1.00, deep: 0.82, open: 1.28, tip: "bass chase bait — shallow flats & open water" },
    winter: { veg: 0.68, wood: 0.85, rock: 1.12, deep: 1.38, open: 0.72, tip: "deep & slow — the fish barely move" },
  };
  const STRUCT_LABEL = { veg: "grass/pads", wood: "wood cover", rock: "rock", deep: "deep structure", open: "open water" };
  // how well a structure group fits the season right now (dawn/dusk pulls summer
  // fish shallow); ~0.5 off-pattern .. ~1.5 dialed-in
  function seasonFitFor(grp) {
    const sea = S.cond.season || "summer";
    let f = (SEASON_STRUCT[sea] || SEASON_STRUCT.summer)[grp] || 1;
    if (sea === "summer" && Math.abs(S.cond.timeMin / 60 - 14) > 5) {  // early/late — flip toward shallow
      if (grp === "veg" || grp === "wood") f *= 1.4;
      if (grp === "deep") f *= 0.80;
    }
    return clamp(f, 0.5, 1.5);
  }
  function seasonFit() { return seasonFitFor(STRUCT_GROUP[position().id] || "open"); }
  // the structure group the season favors most right now (for finder coaching)
  function bestSeasonGroup() {
    const groups = ["veg", "wood", "rock", "deep", "open"];
    return groups.reduce((a, b) => seasonFitFor(b) > seasonFitFor(a) ? b : a);
  }
  const STRUCT_PREF = {
    frog:      { veg: 1.0, wood: 0.8, rock: 0.5, deep: 0.25, open: 0.6 },
    pencil:    { veg: 0.7, wood: 0.6, rock: 0.6, deep: 0.35, open: 0.95 },
    torpedo:   { veg: 0.75, wood: 0.6, rock: 0.6, deep: 0.35, open: 0.95 },
    jitterbug: { veg: 0.8, wood: 0.7, rock: 0.7, deep: 0.35, open: 0.98 },
    buzz:      { veg: 0.9, wood: 0.8, rock: 0.5, deep: 0.25, open: 0.85 },
    worm:      { veg: 0.85, wood: 1.0, rock: 0.7, deep: 0.8, open: 0.6 },
    carolina:  { veg: 0.7, wood: 0.85, rock: 0.9, deep: 1.0, open: 0.7 },
    furry:     { veg: 0.6, wood: 1.0, rock: 0.85, deep: 0.95, open: 0.6 },
    spoon:     { veg: 0.45, wood: 0.6, rock: 0.85, deep: 0.9, open: 0.9 },
    crank:     { veg: 0.35, wood: 0.6, rock: 1.0, deep: 0.95, open: 0.85 },
    spinner:   { veg: 0.75, wood: 1.0, rock: 0.7, deep: 0.55, open: 0.85 },
    trap:      { veg: 0.9, wood: 0.55, rock: 0.8, deep: 0.8, open: 0.95 },
    inline:    { veg: 0.65, wood: 0.65, rock: 0.85, deep: 0.6, open: 0.95 },
  };

  // score a lure for the current conditions; returns {score 0..1, pct, stars, tip, good}
  // Rate a lure across the real factors an angler weighs: Depth, Action (speed),
  // Profile (size), Color (visibility), Cover, Scent — returns each category plus
  // a weighted overall. colorId / sizeId let the UI preview options.
  function lureScore(lu, colorId, sizeId) {
    const c = S.cond, band = c.band, hour = c.timeMin / 60, temp = c.temp;
    const pos = position(), sp = spot();
    const clarity = sp.clarity || "stained";
    const activity = c.activity != null ? c.activity : 0.5;
    const lowLight = hour < 8 || hour > 18 || c.weather === "night" || c.weather === "fog" || c.weather === "rain";
    const overcast = c.weather === "cloud" || c.weather === "fog" || c.weather === "night" || c.weather === "rain";
    const bright = c.weather === "sun";
    const top = lu.style === "top";
    const sz = sizeId || G.lure.size || "med";

    // 1) DEPTH — can it present where the fish are holding?
    let depth;
    if (top) depth = clamp(1 - Math.max(0, band - 0.12) / 0.4, 0.05, 1);
    else if (band > lu.band + 0.08) depth = clamp(1 - (band - lu.band) / 0.5, 0.1, 0.6);
    else depth = clamp(1 - Math.abs(band - lu.band) * 0.7, 0.55, 1);

    // 2) ACTION — does the bait's aggressiveness suit the fish's mood (temp, light,
    //    activity)? Cold/clear/tough water wants finesse; warm/active/overcast wants power.
    let want = clamp((temp - 50) / 42 * 0.5 + activity * 0.4 + (overcast ? 0.14 : bright ? -0.12 : 0), 0, 1);
    let action = clamp(1 - Math.abs((lu.aggr != null ? lu.aggr : 0.5) - want) * 1.05, 0.18, 1);
    if (top) action *= lowLight ? 1 : (hour >= 10 && hour <= 16 ? 0.5 : 0.82);   // topwater wants low light

    // 3) PROFILE — does the lure SIZE match the water? Clear/calm → small finesse;
    //    stained/muddy & active → bigger profile. axis -1(small)..+1(large).
    const clarityIdeal = clarity === "clear" ? -0.6 : clarity === "murky" ? 0.7 : 0.1;
    const ideal = clamp((clarityIdeal + (activity - 0.5) * 1.2) / 1.35, -1, 1);
    const profile = clamp(1 - Math.abs(SIZES[sz].axis - ideal) * 0.55, 0.15, 1);

    // 4) COLOR — visibility for the light/water
    const col = COLORS[colorId || G.lure.color];
    let color = col.fam === preferredFam() ? 1 : 0.55;
    if (clarity === "murky") color *= (col.fam === "bright") ? 1 : 0.85;   // muddy water rewards bright/flash

    // 5) COVER — does it work this position's structure?
    const grp = STRUCT_GROUP[pos.id] || "open";
    const cover = (STRUCT_PREF[lu.id] && STRUCT_PREF[lu.id][grp]) != null ? STRUCT_PREF[lu.id][grp] : 0.6;

    // 6) SCENT — attractant pairing
    const scent = scentScore(lu, temp);

    const score = depth * 0.24 + action * 0.18 + profile * 0.14 + color * 0.14 + cover * 0.16 + scent * 0.14;
    const cats = [
      { key: "depth", label: "Depth", pct: Math.round(depth * 100) },
      { key: "action", label: "Action", pct: Math.round(action * 100) },
      { key: "profile", label: "Profile", pct: Math.round(profile * 100) },
      { key: "color", label: "Color", pct: Math.round(color * 100) },
      { key: "cover", label: "Cover", pct: Math.round(cover * 100) },
      { key: "scent", label: "Scent", pct: Math.round(scent * 100) },
    ];
    // tip = call out the weakest link
    const weak = cats.slice().sort((a, b) => a.pct - b.pct)[0];
    let tip;
    if (weak.pct >= 62) tip = "✓ Dialed in for these conditions";
    else if (weak.key === "depth") tip = top ? "Fish are deep — a topwater won't reach" : "Won't get to the holding depth";
    else if (weak.key === "action") tip = want > (lu.aggr || 0.5) ? "Too sluggish — they want a faster bait" : "Too aggressive — slow down & finesse";
    else if (weak.key === "profile") tip = SIZES[sz].axis > ideal ? "Downsize — too big for this water" : "Upsize — they want a bigger profile";
    else if (weak.key === "color") tip = bright ? "Too flashy — go natural in bright light" : "Too dull — go bright in low/dirty water";
    else if (weak.key === "scent") tip = "Add a matching scent for an edge";
    else tip = "Not the cover this lure loves";

    return { score, pct: Math.round(score * 100), stars: clamp(Math.round(score * 5), 1, 5), cats, tip, good: weak.pct >= 62 };
  }

  // attractant suitability 0..1 — base presence + combos with lure style & temp
  function scentScore(lu, temp) {
    const a = ATTRACTANTS[G.attractant] || ATTRACTANTS.none;
    let s = a.base;
    const ag = lu.aggr != null ? lu.aggr : 0.5;
    const moving = ag >= 0.55, slow = ag <= 0.3, bottom = lu.style === "sink";
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
    // presentation quality earned this retrieve (right lure + bite-zone time + action).
    // Big fish are FUSSY: low credit suppresses them hard, high credit lets them commit.
    // Ambush strikes are reaction bites from aggressive (usually big) fish, so they get a floor.
    let present = clamp(S.rv.bigCred != null ? S.rv.bigCred : 0.4, 0, 1);
    if (S.rv.ambush) present = Math.max(present, 0.72);
    const sz = SIZES[G.lure.size] || SIZES.med;       // lure size: magnum draws bigger, finesse draws smaller
    const bigGate = clamp(0.18 + present * 1.7 + sz.bigGate, 0.1, 2.2);

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
      if (def.big) w *= trophyFactor * bigGate;     // trophies need deep/low-light water AND a dialed-in presentation
      return { def, w: Math.max(0.0001, w) };
    });

    const total = table.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, chosen = table[0].def;
    for (const x of table) { r -= x.w; if (r <= 0) { chosen = x.def; break; } }

    let lo = chosen.w[0], hi = chosen.w[1];
    if (lu.minSize) lo = lo + (hi - lo) * (lu.minSize - 1) * 0.4;
    // presenting on the money (depth + color + clean action) earns bigger fish
    const sizePush = clamp((rod().power - 1) * 0.4 + (lu.sizeBias - 1) * 0.5 + sz.sizePush
      + depthMatch * 0.18 + (colorMatch ? 0.08 : 0) + (goodAction ? 0.08 : 0) + (S.castBonus ? 0.08 : 0), 0, 0.9);
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
    if (S.mode === "bowfish") { bowShoot(x, y); return; }
    if (S.mode === "idle") startCast(x, y);
    // NOTE: strike has no canvas/reel-button handler on purpose — the hookset is
    // its own target on the timing meter, so working the lure can't trigger it early
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
    else if (S.mode === "bowfish" && S.bow) S.bow.holding = false;
  }
  // unlock the audio context on the first touch (mobile policy) + a soft click on any control
  document.addEventListener("pointerdown", (e) => {
    Sound.ensure();
    if (e.target.closest("button, .chip, .tab, .circuit, .item-btn, .lure-opt, .color-dot, .scent-opt, .size-opt, .troll-btn, .well-slot, .map-venue, .pos-cell")) sfx("ui");
  }, true);
  canvas.addEventListener("pointerdown", (e) => { const p = ptr(e); onDown(p.x, p.y); });
  canvas.addEventListener("pointermove", (e) => { const p = ptr(e); onMove(p.x, p.y); });
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  el.actionBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); onDown(W / 2, H * 0.6); });
  el.actionBtn.addEventListener("pointerup", (e) => { e.preventDefault(); onUp(); });
  el.actionBtn.addEventListener("pointercancel", onUp);
  el.actionBtn.addEventListener("pointerleave", () => { if (S.mode === "fight" || S.mode === "bowfish" || (S.mode === "retrieve" && holdCandidate)) onUp(); });
  // the hookset is set ONLY by tapping the timing meter (its own target, away from
  // the reel button) so working the lure never fires it by accident
  el.hookMeter.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (S.mode === "strike") { sfx("ui"); hookSet(); } });

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
    const coverDist = Math.hypot(px - hz.x, py - hz.y);
    S.castAccuracy = clamp(1 - coverDist / (hz.r * 1.7 * (1 + skill("casting") * 0.5)), 0, 1);   // 1 = pitched on the cover, 0 = open water (a deadeye caster gets credit for near-misses)
    S.castBonus = coverDist < hz.r;
    S.castFacing = facingQuality();   // how well the boat was aimed at the fish when you cast
    S.castLuck = rnd(0.82, 1.28);     // real fishing varies cast-to-cast
    showBtn(false); setStatus("");
    S.aim = null;
    sfx("cast"); vibrate(12);
  }

  function startRetrieve() {
    const lu = lure();
    S.mode = "retrieve";
    S.rv.dist = 1; S.rv.interest = 0; S.rv.action = 0.5; S.rv.taps = []; S.rv.follower = 0; S.rv.bob = 0; S.rv.ambush = null;
    // big-fish credit — a tight pitch to the cover primes bigger fish before you even work it
    S.rv.bigCred = clamp(0.18 + (S.castAccuracy || 0) * 0.34, 0, 1);
    S.rv.depth = lu.style === "top" ? lu.band : 0.04;
    S.holding = false;
    // dive into the underwater view and spawn the bass holding nearby
    S.view = "under"; S.viewT = 0; S.bubbles.length = 0;
    spawnPursuers();
    splash(S.bobber.x, S.bobber.y); splash(S.bobber.x, S.bobber.y);
    el.retrievePanel.classList.remove("hidden");
    showBtn(true); setBtn("HOLD TO REEL", "reel");
    setStatus((S.castAccuracy || 0) > 0.7 ? "🎯 Pitched it tight to the cover!" : (S.castAccuracy || 0) > 0.35 ? "Near the structure — work it!" : "Open water — work it back…");
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
    sfx("twitch"); vibrate(8);
  }

  function endRetrieveMiss() {
    setStatus("No takers — reel in and recast.");
    advanceTime(4);
    resetToIdle();
  }

  function strike() {
    S.mode = "strike";
    S.hookedFish = pickFish();
    // snapshot the depth the lure was working when the fish committed (the catch depth)
    S.catchDepth = (S.rv && S.rv.depth != null) ? S.rv.depth : S.cond.band;
    // snapshot how well the bite was earned — feeds the catch score's presentation multiplier
    S.presQ = S.rv ? clamp(S.rv.bigCred || 0, 0, 1) : 0;
    // window + sweep speed scale with the fish: trophies give a tighter, faster
    // meter for more tension; little ones are forgiving
    const diff = clamp(S.hookedFish.difficulty || 0.4, 0, 1);
    S.strikeWindow = (2900 - diff * 700) * (1 + skill("sense") * 0.25);   // ~2.9s easy .. ~2.2s hard — a sharp angler feels it coming
    // hold = a short cinematic beat: time slows and the camera punches in on the
    // open mouth before the timing marker starts to sweep
    S.hook = { phase: rnd(0, 6.28), marker: 0.5, done: false, speed: 0.0038 + diff * 0.0032, hold: 520 };
    S.strikeT = 0;
    el.retrievePanel.classList.add("hidden");
    // hide the reel button entirely so a held/late reel tap can't set the hook early —
    // the hookset lives on its own target up on the timing meter
    showBtn(false);
    el.hookMeter.classList.remove("hidden");
    el.hookMeter.classList.add("armed");
    flashStrike();
    setStatus("FISH ON!", true);
    splash(S.bobber.x, S.bobber.y); splash(S.bobber.x, S.bobber.y);
    sfx("strike"); vibrate(45);
  }
  function flashStrike() {
    const fl = el.strikeFlash; if (!fl) return;
    fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");   // restart the animation
  }
  function strikeMissed() {
    el.hookMeter.classList.add("hidden");
    el.hookMeter.classList.remove("armed");
    setStatus("It spat the lure!");
    advanceTime(3);
    resetToIdle();
    if (!S.tournament) showFail("It spat the lure — set the hook quicker!");
  }

  function hookSet() {
    if (S.mode !== "strike" || (S.hook && S.hook.done)) return;
    const f = S.hookedFish, d = f.difficulty;
    // hookset quality from how close the marker was to the centre when you tapped
    const off = S.hook ? Math.min(1, Math.abs((S.hook.marker != null ? S.hook.marker : 0.5) - 0.5) * 2) : 0.5;
    const hs = skill("hookset");   // a practiced hookset forgives more of the sweep
    const quality = clamp(1 - off / (0.5 * (1 + hs * 0.3)), 0, 1);
    const perfect = off < 0.1 * (1 + hs * 0.8), good = off < 0.24 * (1 + hs * 0.6);
    S.hookQuality = quality;
    S.hookRating = perfect ? "Perfect ✨" : good ? "Good" : quality > 0.12 ? "Fair" : "Weak";
    if (perfect) G.perfectHooks = (G.perfectHooks || 0) + 1;   // achievement tally (saved on the catch)
    if (S.hook) S.hook.done = true;
    el.hookMeter.classList.add("hidden");
    el.hookMeter.classList.remove("armed");
    S.mode = "fight";
    // fight from the angler's point of view, up on the surface
    S.view = "surface"; S.viewT = 0;
    setBtn("HOLD TO REEL", "reel"); showBtn(true);
    el.fightPanel.classList.remove("hidden");
    const T = S.ft;
    // a good hookset starts the fish more worn down and pulling less = easier fight
    T.stamina = 1 - quality * 0.32; T.tension = 0; T.dist = clamp(S.rv.dist, 0.45, 1);
    T.cover = 0; T._coverBuzz = 0; T.lat = 0; T.latTarget = 0; T.jumps = 0;
    T.state = "run"; T.stateT = rnd(500, 1100); T.pull = 0.85 - quality * 0.3; T.jumpY = 0;
    T.maxStam = T.stamina; T.size = d;
    S.holding = false;
    setStatus(perfect ? "PERFECT HOOKSET!" : good ? "Solid hookset!" : "Hooked up!", true);
    sfx(perfect ? "perfect" : good ? "good" : "weak");
    vibrate(perfect ? [20, 40, 30, 40] : [20, 30, 40]);
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

    // ---- CATCH SCORE (Big-Buck-Hunter style): size × hookset × presentation ----
    // base = weight in hundredths of a pound; a perfect hookset runs ×1.5; a
    // dialed-in presentation (earned bite + pitched tight to cover) runs ×1.5;
    // lunkers stack a flat bonus. The 🏆 pill accumulates these for life.
    const hq = S.hookQuality || 0;
    const presQ = clamp((S.presQ || 0) * 0.7 + (S.castAccuracy != null ? S.castAccuracy : 0.5) * 0.3, 0, 1);
    const scoreBase = Math.round(f.weight * 100);
    const hookMul = 1 + hq * 0.5;
    const presMul = 1 + presQ * 0.5;
    const scoreBonus = f.weight >= 10 ? 1000 : f.weight >= LUNKER_LB ? 500 : 0;
    f.score = Math.round((scoreBase * hookMul * presMul + scoreBonus) * garageScoreMul() / 10) * 10;
    f.scoreInfo = { base: scoreBase, hookMul, presMul, bonus: scoreBonus, hq, presQ };
    S.hookQuality = 0;
    // the day's running tally (shown on the end-of-day summary)
    S.dayCatches = (S.dayCatches || 0) + 1;
    S.dayPts = (S.dayPts || 0) + f.score;
    S.dayBest = Math.max(S.dayBest || 0, f.weight);
    G.bestDayCatches = Math.max(G.bestDayCatches || 0, S.dayCatches);
    if (((S.ft && S.ft.jumps) || 0) >= 3) G.acro = (G.acro || 0) + 1;   // landed an acrobat
    if (f.bass) bigBassSubmit(f.weight);   // 🐷 Big Bass of the Day — every mode counts
    if (f.bass && f.weight >= LUNKER_LB && S.tournament && S.tournament.pro && G.pro && !G.pro.done) { G.pro.lunkers = (G.pro.lunkers || 0) + 1; checkSponsors(); }

    const lunk = f.bass && f.weight >= LUNKER_LB;
    sfx(lunk ? "lunker" : "land"); setTimeout(() => sfx("coin"), 450);
    if (S.arcade && !S.arcade.ended) { arcadeLand(f); save(); updateHUD(); return; }
    if (S.tournament) { tourLand(f, isRecord, prev); G.coins += f.score; addAnglerXP(f.score); save(); updateHUD(); return; }
    G.coins += f.score; addAnglerXP(f.score);
    // free-play livewell: every bass updates your session best-5 bag
    let bagPB = false;
    if (f.bass) bagPB = bagAdd(f.weight);
    checkCatchChallenges(f);
    save(); updateHUD();
    vibrate([20, 40, 30]);
    if (bagPB && S.bag.length >= 2) setTimeout(() => toast(`🪣 New personal-best livewell: ${bagTotal().toFixed(2)} lb`), 700);
    showCatch(f, isRecord, prev);
  }

  function showCatch(f, isRecord, prev) {
    const lunk = f.bass && f.weight >= LUNKER_LB;
    // a size class, not a species category — they're all largemouth bass
    const cls = f.weight >= 10 ? { t: "🏆 TROPHY", c: "#ffd35c", dark: true }
      : f.weight >= 4 ? { t: "BIG BASS", c: "#5c9bff", dark: false }
      : f.weight >= 2 ? { t: "QUALITY", c: "#5be37a", dark: true }
      : { t: "KEEPER", c: "#9fb3bf", dark: true };
    el.catchRarity.textContent = lunk ? "🏆 LUNKER!" : cls.t;
    el.catchRarity.style.background = lunk ? "#ffd35c" : cls.c;
    el.catchRarity.style.color = (lunk || cls.dark) ? "#06222c" : "#fff";
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
    el.catchReward.textContent = (f.score != null ? f.score : f.value).toLocaleString();
    el.catchRewardWrap.classList.remove("hidden");
    // the score breakdown — how the points were earned (size × hookset × presentation)
    if (el.catchScoreBd) {
      const si = f.scoreInfo;
      el.catchScoreBd.innerHTML = si ? [
        `<span>⚖️ ${f.weight} lb → ${si.base}</span>`,
        `<span class="${si.hq > 0.82 ? "hot" : ""}">🪝 ×${si.hookMul.toFixed(2)}</span>`,
        `<span class="${si.presQ > 0.75 ? "hot" : ""}">🎯 ×${si.presMul.toFixed(2)}</span>`,
        si.bonus ? `<span class="hot">💪 LUNKER +${si.bonus}</span>` : "",
      ].filter(Boolean).join("") : "";
    }
    if (S.hookRating) { el.catchHookset.textContent = "Hookset: " + S.hookRating; el.catchHookset.classList.remove("hidden"); el.catchHookset.classList.toggle("perfect", /Perfect/.test(S.hookRating)); }
    else el.catchHookset.classList.add("hidden");
    el.catchRecord.classList.remove("pb");
    if (isRecord && prev > 0) {
      el.catchRecord.textContent = `🏆 NEW PERSONAL BEST! (beat ${prev.toFixed(1)} lb)`;
      el.catchRecord.classList.add("pb");
      setTimeout(() => sfx("pb"), 420);    // ring the fanfare after the landing chime
      vibrate([18, 60, 24, 60, 40]);
    } else if (isRecord) {
      el.catchRecord.textContent = "🏆 FIRST CATCH!";
    } else {
      // not a record — say so plainly, with the mark still to beat (no false "PB!")
      const best = G.records[f.name] || 0;
      el.catchRecord.textContent = best ? `Your best ${f.name}: ${best.toFixed(1)} lb` : "";
    }
    el.catchTourney.classList.add("hidden");
    if (el.catchShare) el.catchShare.classList.toggle("hidden", !(f.bass && f.weight >= LUNKER_LB));
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
    sfx("snap");
    if (S.tournament || (S.arcade && !S.arcade.ended)) { S.mode = "idle"; showBtn(false); vibrate(120); toast("💥 " + (msg || "It got off!")); setStatus("Tap & hold the water to cast"); return; }
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
    el.hookMeter.classList.add("hidden");
    el.castMeter.classList.add("hidden");
    showBtn(false);
    setStatus("Tap & hold the water to aim, release to cast 🎣");
  }

  // ---- the running clock (Sega Original-mode style): game time flows at one
  // game-minute per real second, so a full day plays out in ~15 real minutes.
  // Conditions recompute as it flows — the morning bite dies, fish slide deep at
  // midday, the dusk window fires — so the right lure/spot keeps changing.
  function tickClock(dt) {
    if (S.tournament || anyModalOpen()) return;      // tournaments sweep their own day; modals pause it
    S._min = (S._min || 0) + dt / 1000;
    if (S._min < 1) return;
    const mins = Math.floor(S._min); S._min -= mins;
    S.cond.timeMin += mins;
    S.cond.front = (S.cond.front || 0) * Math.pow(0.995, mins);
    S._wxMin = (S._wxMin || 0) + mins;
    if (S._wxMin >= 25) { S._wxMin = 0; maybeShiftWeather(); }   // fronts drift every ~25 game-min
    // free play is "a day on the water": it ends at dusk (Trophy Lake's night
    // bite runs till dawn) — waits for an idle moment so it never cuts a fight
    const endMin = spot().id === "deep" ? 29 * 60 : 21 * 60;
    if (S.cond.timeMin >= endMin && S.mode === "idle") { endDay(); return; }
    recomputeCond(); renderConditions();
  }
  function endDay() {
    S._min = 0;
    const bag = (S.bag || []).slice().sort((a, b) => b - a);
    const dayN = (S.cond.day || 0) + 1;
    const w = WEATHER[S.cond.weather] || {};
    el.daySummaryBody.innerHTML =
      `<p class="muted" style="text-align:center">Day ${dayN} · ${spot().ico} ${spot().name} · ${w.ico || ""} ${w.name || ""} · ${(SEASONS[S.cond.season] || SEASONS.summer).ico} ${(SEASONS[S.cond.season] || SEASONS.summer).name}</p>
      <div class="rec-stats" style="grid-template-columns:repeat(2,1fr)">
        <div class="rec-stat"><div class="rs-ico">🐟</div><div class="rs-v">${S.dayCatches || 0}</div><div class="rs-l">Bass boated</div></div>
        <div class="rec-stat"><div class="rs-ico">🎯</div><div class="rs-v">${(S.dayPts || 0).toLocaleString()}</div><div class="rs-l">Points earned</div></div>
        <div class="rec-stat"><div class="rs-ico">🏅</div><div class="rs-v">${S.dayBest ? S.dayBest.toFixed(1) + " lb" : "—"}</div><div class="rs-l">Best bass</div></div>
        <div class="rec-stat"><div class="rs-ico">🪣</div><div class="rs-v">${bag.length ? bagTotal().toFixed(2) + " lb" : "—"}</div><div class="rs-l">Top-5 bag</div></div>
      </div>` +
      (bag.length ? `<div class="tr-bits" style="margin-bottom:6px">${bag.map(x => `<span>🐟 ${x.toFixed(1)} lb</span>`).join("")}</div>` : `<p class="muted" style="text-align:center">Skunked — tomorrow's another day.</p>`);
    el.daySummaryModal.classList.remove("hidden");
    sfx("weighin");
  }
  function startNewDay() {
    el.daySummaryModal.classList.add("hidden");
    S.cond.day = (S.cond.day || 0) + 1;
    if (S.cond.day % 3 === 0) S.cond.season = SEASON_ORDER[(SEASON_ORDER.indexOf(S.cond.season) + 1) % 4];
    S.cond.moon = (((S.cond.moon || 0) + 1) % 8);
    rollConditions();                              // fresh weather, fresh pattern-of-the-day
    S.bag = []; S.dayCatches = 0; S.dayPts = 0; S.dayBest = 0; S._wxMin = 0;
    seedFish(); resetToIdle(); save(); updateHUD();
    toast(`☀️ Day ${S.cond.day + 1} — fresh conditions, fresh pattern`);
  }

  function advanceTime(min) {
    S.cond.timeMin += min;
    if (S.cond.timeMin >= 24 * 60) {           // a new day — the season drifts forward over time
      S.cond.timeMin -= 24 * 60;
      S.cond.day = (S.cond.day || 0) + 1;
      if (S.cond.day % 3 === 0) S.cond.season = SEASON_ORDER[(SEASON_ORDER.indexOf(S.cond.season) + 1) % 4];
      S.cond.moon = (((S.cond.moon || 0) + 1) % 8);   // the moon drifts a phase each day
    }
    S.cond.front = (S.cond.front || 0) * 0.6;   // a front's effect fades as the system passes through
    maybeShiftWeather();                         // weather may drift to a new front mid-session
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
  // rival anglers you compete against live
  const RIVAL_NAMES = ["R. Vela", "J. Kwan", "M. Boone", "T. Ito", "D. Ferro", "K. Ash",
    "C. Rios", "B. Nash", "L. Okafor", "P. Sung", "G. Reyes", "S. Vance", "A. Dorn", "F. Colt"];
  // build the field: each rival gets a skill and a set of catch events revealed over
  // the day, so their bags climb (and cull) live — no scripted "AI appears at the end"
  function buildRivals(field, tier) {
    const names = RIVAL_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, Math.max(0, field - 1));
    return names.map(name => {
      const skill = 0.62 + Math.random() * 0.72;                 // 0.62 .. 1.34
      const nCatch = 4 + Math.floor(Math.random() * 5);          // 4..8 fish through the day
      const catches = [];
      for (let j = 0; j < nCatch; j++) catches.push({ w: +(rnd(1.0, 5.4) * tier * skill).toFixed(2), at: Math.random() });
      return { name, skill, catches };
    });
  }
  // a rival's live 5-fish total / big fish at elapsed fraction e (0..1)
  function rivalRevealed(rv, e) { return rv.catches.filter(c => c.at <= e).map(c => c.w).sort((a, b) => b - a); }
  function rivalTotal(rv, e) { return rivalRevealed(rv, e).slice(0, 5).reduce((s, w) => s + w, 0); }
  function rivalBig(rv, e) { const r = rivalRevealed(rv, e); return r.length ? r[0] : 0; }
  // full standings (you + rivals) at the current elapsed fraction
  function tourStandings() {
    const T = S.tournament; if (!T) return [];
    if (T.daily || T.custom) return dailyBoardRows(T);
    const e = clamp(1 - T.timeLeft / T.dur, 0, 1);
    const board = (T.rivals || []).map(rv => ({ name: rv.name, total: rivalTotal(rv, e), big: rivalBig(rv, e), me: false }));
    board.push({ name: G.name || "You", total: wellTotal(), big: T.big, me: true, fish: T.well.length });
    board.sort((a, b) => b.total - a.total || b.big - a.big);
    return board;
  }
  function renderTourBoard() {
    // no floating leaderboard over the water — just a compact place chip on the
    // tournament bar (full standings come at the weigh-in; lead changes toast)
    const T = S.tournament;
    if (!T || T.ended) { if (el.tourPos) el.tourPos.textContent = ""; return; }
    const board = tourStandings();
    const myPlace = board.findIndex(b => b.me) + 1;
    const who = document.getElementById("tourWho");
    if (who) who.textContent = G.name || "YOU";
    if (el.tourPos) el.tourPos.textContent = `P${myPlace}/${board.length}`;
  }


  function startTournament() {
    const t = pendingTour; if (!t) { el.tourStartModal.classList.add("hidden"); return; }
    dropPausedRuns();
    Music.setScene("game");   // lines in — theme out, even off a menu deep-link
    if (G.spot !== t.spot) { G.spot = t.spot; seedFish(); rollConditions(); }
    // a fee still seeds the purse maths, but the player never pays it
    const fee = t.spot === "deep" ? 150 : t.spot === "river" ? 90 : 50;
    const sp = SPOTS.find(s => s.id === t.spot) || spot();
    const tier = sp.id === "deep" || sp.id === "highland" ? 1.7 : sp.id === "river" || sp.id === "bayou" ? 1.25 : 1.0;
    el.tourStartModal.classList.add("hidden");
    // Sega Original-mode day sweep: the event's countdown maps onto a full fishing
    // day (Morning -> Noon -> Evening; Trophy Lake runs Dusk -> Midnight -> Dawn)
    S.dayStarted = true;
    const sweepStart = t.spot === "deep" ? 21 * 60 : 6 * 60;
    S.tournament = { timeLeft: t.dur, dur: t.dur, well: [], big: 0, culls: 0, field: t.field, fee, spotId: t.spot, name: t.name, eventId: t.id, ended: false, tier, rivals: buildRivals(t.field, tier), lastLead: null, sweepStart, period: 0 };
    if (t.pro) S.tournament.pro = true;
    if (t.daily || t.custom) {
      const T2 = S.tournament;
      T2.daily = t.daily || null; T2.custom = t.custom || null; T2.duel = !!t.duel; T2.mode = t.mode; T2.rivals = []; T2.dayCount = 0; T2._real = [];
      el.dailyTicker.classList.remove("hidden");
      dailySubmit(T2);          // registers you on today's board right away
      refreshDailyLive(T2);
      if (T2.duel) duelStream(T2);
    }
    pendingTour = null;   // lines are in — the prep sheet is done
    S.cond.timeMin = sweepStart; recomputeCond(); renderConditions();
    el.tourHud.classList.remove("hidden");
    renderWell();
    renderTourBoard();
    updateHUD();
    resetToIdle();
    toast(t.custom ? `🎪 ${t.name} — lines in! The crew's watching.` : t.daily ? `📅 ${t.name} — lines in! The whole world fishes this one.` : `🏁 ${t.name} — lines in! ${t.field - 1} rivals on the water!`);
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
    if (T.daily || T.custom) {
      T.dayCount = (T.dayCount || 0) + 1;
      (T.rp = T.rp || []).push([Math.round((T.dur - T.timeLeft) / 1000), f.weight]);
      dailySubmit(T);
    }
    checkCatchChallenges(f);
    vibrate([20, 40, 30]);
    renderWell();
    renderTourBoard();
    toast(msg + (f.score ? `<br><small>🎯 +${f.score} pts</small>` : ""));
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
    // sweep the in-game day across the event: the light moves, fish move with it
    const prog = clamp(1 - T.timeLeft / T.dur, 0, 1);
    S.cond.timeMin = (T.sweepStart != null ? T.sweepStart : 6 * 60) + prog * 12 * 60;
    T._condT = (T._condT || 0) + dt;
    if (T._condT >= 900) { T._condT = 0; recomputeCond(); renderConditions(); }
    const period = Math.min(2, Math.floor(prog * 3));
    if (period !== T.period) {
      T.period = period;
      const names = (T.sweepStart || 0) >= 17 * 60 ? ["DUSK", "MIDNIGHT", "DAWN"] : ["MORNING", "NOON", "EVENING"];
      toast(`🕐 <b>${names[period]}</b> — ${period === 1 ? "fish slide to their midday holds" : "prime light, the bite window is open!"}`);
      sfx("good"); vibrate(20);
    }
    // refresh the live leaderboard a couple times a second as rivals boat fish
    T._boardT = (T._boardT || 0) + dt;
    if (T._boardT >= 450) {
      T._boardT = 0;
      const board = tourStandings();
      const lead = board[0] && board[0].name;
      if (T.lastLead && lead !== T.lastLead && T.well.length) {   // the lead changed — call it out
        toast(board[0].me ? "🥇 You took the lead!" : `${lead} took the lead`);
      }
      T.lastLead = lead;
      renderTourBoard();
    }
    if (T.daily || T.custom) {
      T._dailyT = (T._dailyT || 0) + dt;
      if (T._dailyT >= (T.duel ? 8000 : 20000)) { T._dailyT = 0; refreshDailyLive(T); }
    }
    if (T.timeLeft <= 0) endTournament();
  }
  function endTournament() {
    const T = S.tournament; if (!T || T.ended) return;
    T.ended = true;
    // bail out of any active fight
    S.mode = "idle"; S.hookedFish = null;
    el.fightPanel.classList.add("hidden"); el.retrievePanel.classList.add("hidden"); el.castMeter.classList.add("hidden"); showBtn(false);
    if (T.daily || T.custom) { endDaily(T); return; }

    const myTotal = wellTotal();
    // the weigh-in: the same rivals you watched all day bring in their FINAL bags
    const board = (T.rivals || []).map(rv => ({ name: rv.name, total: +rivalTotal(rv, 1).toFixed(2), big: +rivalBig(rv, 1).toFixed(1), me: false }));
    board.push({ name: G.name || "You", total: +myTotal.toFixed(2), big: +T.big.toFixed(1), me: true, fish: T.well.length });
    board.sort((a, b) => b.total - a.total || b.big - a.big);
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

    G.coins += payout; addAnglerXP(payout);
    if (place === 1) { G.tourWins = (G.tourWins || 0) + 1; unlock("tourwin"); }
    if (myTotal > (G.bestBag || 0)) G.bestBag = +myTotal.toFixed(2);

    // --- circuit season: best points per event; a full sweep crowns a champion ---
    if (!G.season) G.season = { best: {}, titles: 0 };
    const pts = Math.min(120, Math.round(100 * (T.field - place + 1) / T.field) + (place === 1 ? 15 : 0));
    if (T.eventId && pts > (G.season.best[T.eventId] || 0)) G.season.best[T.eventId] = pts;
    const seasonDone = Object.keys(G.season.best).length, seasonTotal = Object.values(G.season.best).reduce((s, p) => s + p, 0);
    let champBanner = "";
    if (seasonDone >= TOURNAMENTS.length) {
      // completed the circuit — champion if you averaged a top-third finish
      if (seasonTotal >= TOURNAMENTS.length * 72) { G.season.titles = (G.season.titles || 0) + 1; unlock("champ"); champBanner = `<br><span style="color:var(--gold);font-weight:900">🏆 CIRCUIT CHAMPION! (title #${G.season.titles})</span>`; }
      else champBanner = `<br><span class="muted">Circuit complete — ${seasonTotal} pts, not quite champion. New season!</span>`;
      G.season.best = {};   // fresh season starts
    }
    const seasonNow = Object.keys(G.season.best).length, seasonPtsNow = Object.values(G.season.best).reduce((s, p) => s + p, 0);
    save(); updateHUD();

    // results UI
    const ord = ["", "1st", "2nd", "3rd"][place] || (place + "th");
    el.tourPlace.textContent = ord + " Place";
    el.tourResultMedal.textContent = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🎣";
    el.tourBag.innerHTML = T.well.length
      ? T.well.slice().sort((a, b) => b.weight - a.weight).map(f => `<div class="bag-fish">${fishSVG(f, 40)}<b>${f.weight}</b></div>`).join("")
      : `<p class="muted">No keepers in the well — better luck next time!</p>`;
    el.tourResultStats.innerHTML =
      `5-fish bag: <b>${myTotal.toFixed(2)} lb</b> (${T.well.length} fish)<br>` +
      `Big bass: <b>${T.big ? T.big.toFixed(1) + " lb" : "—"}</b>${bigBonus ? ` &nbsp;<span style="color:var(--gold)">+${bigBonus} pts Big Bass!</span>` : ""}<br>` +
      `Points: <b>+${payout}</b> 🎯` + (place === 1 ? "  🏆" : "") +
      `<br>Circuit: <b>+${pts} pts</b> · season ${seasonPtsNow} (${seasonNow}/${TOURNAMENTS.length} events)` + champBanner;
    el.tourStandings.innerHTML = board.map((b, i) =>
      `<div class="stand-row ${b.me ? "me" : ""}"><span>${i + 1}. ${b.name}</span><span class="w">${b.total.toFixed(2)} lb</span></div>`).join("");
    // --- pro season bookkeeping rides on top of the normal weigh-in ---
    if (T.pro && G.pro && !G.pro.done) {
      const P = G.pro;
      const myP = Math.min(place, 8);
      const order = PRO_RIVALS.map(rv => ({ rv, roll: rv.skill * (0.6 + Math.random() * 0.8) })).sort((a, b2) => b2.roll - a.roll);
      const slots = []; for (let i = 1; i <= 8; i++) if (i !== myP) slots.push(i);
      order.forEach((o, i) => { P.pts[o.rv.name] = (P.pts[o.rv.name] || 0) + (PRO_F1[slots[i] - 1] || 2); });
      P.pts.ME = (P.pts.ME || 0) + (PRO_F1[myP - 1] || 2);
      if (place === 1) P.wins = (P.wins || 0) + 1;
      P.bagLb = +((P.bagLb || 0) + myTotal).toFixed(1);
      P.round++;
      if (P.round >= TOURNAMENTS.length) P.done = true;
      checkSponsors();
      save();
      el.tourResultStats.innerHTML += `<br>🏆 PRO SEASON: P${myP} · <b>+${PRO_F1[myP - 1] || 2} pts</b> (${P.pts.ME} total)` +
        (P.done ? ` · <b style="color:var(--gold)">season complete — see the standings!</b>` : "");
      if (!P.done) {
        const rv = order[0].rv;
        setTimeout(() => toast(`🎙️ <b>${rv.name}</b>: “${rv.line}”`), 2200);
      }
    }
    el.tourResultModal.classList.remove("hidden");
    setTimeout(() => sfx(place === 1 ? "weighwin" : "weighin"), 300);   // weigh-in fanfare
    const meRow = el.tourStandings.querySelector(".me");
    if (meRow) el.tourStandings.scrollTop = Math.max(0, meRow.offsetTop - el.tourStandings.clientHeight / 2);
  }
  function closeTournament() {
    S.tournament = null;
    el.dailyTicker.classList.add("hidden");
    pendingTour = null;
    if (lbSubmitHook) lbSubmitHook(true);   // tournament winnings hit the global board right away
    el.tourHud.classList.add("hidden");
    document.getElementById("loadout").classList.remove("hidden");
    el.tourResultModal.classList.add("hidden");
    el.tourClock.parentElement.classList.remove("low");
    resetToIdle();
    updateHUD();
  }

  // ===========================================================================
  // DAILY TOURNAMENT — one entry per angler per real day. The day's rules
  // (lake + format) are derived from the UTC date, so every phone worldwide
  // fishes the same challenge; results live in Firebase under /daily/<day>.
  // Real anglers show in GOLD ★ — a seeded crew of touring pros pads the
  // field, their catches revealing across the real day like a day-long event.
  // ===========================================================================
  const DAILY_DUR = 180000;
  const DAILY_MODES = [
    { id: "bag",   ico: "🪣", name: "HEAVY BAG",         rule: "Heaviest 5-bass limit wins." },
    { id: "big",   ico: "🐷", name: "BIG BASS SHOWDOWN", rule: "One fish decides it — biggest bass wins." },
    { id: "count", ico: "🔢", name: "NUMBERS GAME",      rule: "Most bass boated wins — size doesn't matter." },
  ];
  function dayKey(off) { const d = new Date(Date.now() + (off || 0) * 86400000); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
  // tiny seeded PRNG — same date, same rules, on every phone on the planet
  function dayRng(seed) {
    let a = 0; const s2 = "bass" + seed;
    for (let i = 0; i < s2.length; i++) a = (a * 31 + s2.charCodeAt(i)) >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function dailyRules(dk) {
    const r = dayRng(dk);
    // fixed pool, NOT SPOTS.length: adding a lake must never re-shuffle the
    // rotation old builds computed. Grande Falls joins on its cutover day.
    const pool = ["cove", "river", "deep", "bayou", "highland"];
    if (dk >= 20260724) pool.push("falls");
    const sp = SPOTS.find(s => s.id === pool[Math.floor(r() * pool.length)]) || SPOTS[0];
    const mode = DAILY_MODES[Math.floor(r() * DAILY_MODES.length)];
    return { day: dk, spot: sp.id, mode };
  }
  // how much of the UTC day has passed — the pros' catches reveal on this clock
  function dayFrac(dk) {
    if (dk !== dayKey()) return 1;
    const now = new Date();
    return clamp((now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440, 0.05, 1);
  }
  function dailyCpu(dk) {
    const rules = dailyRules(dk);
    const sp = SPOTS.find(s => s.id === rules.spot) || SPOTS[0];
    const tier = sp.id === "deep" || sp.id === "highland" ? 1.7 : sp.id === "river" || sp.id === "bayou" ? 1.25 : 1.0;
    const r = dayRng(dk * 7 + 3);
    const names = RIVAL_NAMES.slice().sort(() => r() - 0.5).slice(0, 9);
    return names.map(name => {
      const skill = 0.55 + r() * 0.7;
      const n = 3 + Math.floor(r() * 10);
      const catches = [];
      for (let j = 0; j < n; j++) catches.push({ w: +((0.9 + r() * 4.4) * tier * skill).toFixed(2), at: r() });
      return { name, catches };
    });
  }
  function dailyCpuRows(dk, need) {
    const f = dayFrac(dk);
    return dailyCpu(dk).slice(0, Math.max(0, need)).map(cv => {
      const rev = cv.catches.filter(c => c.at <= f).map(c => c.w).sort((a, b) => b - a);
      return { name: cv.name, total: +rev.slice(0, 5).reduce((s2, w) => s2 + w, 0).toFixed(2), big: rev[0] || 0, fish: rev.length, real: false };
    });
  }
  const dEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function dailyLine(r, m) { return !r ? "" : m === "big" ? (r.big ? r.big.toFixed(2) + " lb big bass" : "—") : m === "count" ? r.fish + " bass" : (r.total ? r.total.toFixed(2) + " lb" : "—"); }
  function dailySort(rows, m) {
    const met = r => m === "big" ? [r.big, r.total] : m === "count" ? [r.fish, r.total] : [r.total, r.big];
    rows.sort((a, b) => { const A = met(a), B = met(b); return B[0] - A[0] || B[1] - A[1]; });
    return rows;
  }
  async function fetchDay(dk) {
    const base2 = LB.fb(); if (!base2) return [];
    const r = await fetch(base2 + "/daily/" + dk + ".json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json() || {};
    const rows = Object.entries(data).map(([k, v]) =>
      (v && typeof v === "object" && v.n && /^p[a-z0-9]{4,20}$/.test(k))
        ? { pid: k, name: String(v.n).slice(0, 14), total: +v.w || 0, big: +v.b || 0, fish: +v.f || 0, real: true, rp: Array.isArray(v.rp) ? v.rp.slice(0, 40) : null }
        : null).filter(Boolean);
    return LB.dedupeNames(rows, e => e.total * 10000 + e.big * 100 + e.fish);
  }
  function dailySubmit(T, done) {
    const base2 = LB.fb(); if (!base2 || !T || (!T.daily && !T.custom)) return;
    const body = JSON.stringify({ n: G.name || "ANGLER", w: +wellTotal().toFixed(2), b: +(T.big || 0).toFixed(2), f: T.dayCount || 0, d: done ? 1 : 0, t: Date.now(), rp: (T.rp || []).slice(0, 40) });
    const path = T.custom ? "/events/" + T.custom + "/res/" : "/daily/" + T.daily + "/";
    fetch(base2 + path + LB.pid() + ".json", { method: "PUT", body }).catch(() => {});
  }
  // the live board mid-run: you + every real entry so far today + the pros
  function dailyBoardRows(T) {
    const myPid = LB.pid();
    const me = { name: G.name || "You", total: +wellTotal().toFixed(2), big: +(T.big || 0), fish: T.dayCount || 0, real: true, me: true };
    const real = (T._real || []).filter(r => r.pid !== myPid && LB.nameKey(r.name) !== LB.nameKey(G.name)).map(r => Object.assign({}, r));
    const cpu = T.custom ? [] : dailyCpuRows(T.daily, Math.max(3, 10 - real.length));
    return dailySort([me].concat(real, cpu), T.mode);
  }
  function refreshDailyLive(T) {
    (T.custom ? fetchEventRes(T.custom) : fetchDay(T.daily)).then(rows => { T._real = rows; }).catch(() => {}).then(() => {
      if (S.tournament !== T || T.ended) return;
      const rows = dailyBoardRows(T);
      const myI = rows.findIndex(r => r.me);
      const md = DAILY_MODES.find(x => x.id === T.mode) || DAILY_MODES[0];
      const bigRow = rows.slice().sort((a, b) => b.big - a.big)[0];
      const nick = r2 => r2.me ? "YOU" : dEsc(r2.name).toUpperCase() + (r2.real ? " ★" : "");
      const rl = (T._real || []).length;
      const entered = (T._real || []).some(r2 => r2.pid === LB.pid()) ? rl : rl + 1;
      const bits = [
        T.custom ? `🎪 CREW EVENT · ${md.ico} ${md.name}` : `📅 DAILY · ${md.ico} ${md.name}`,
        bigRow && bigRow.big ? `🐷 BIG BASS OF THE DAY: ${bigRow.big.toFixed(2)} lb — ${nick(bigRow)}` : "🐷 no big bass on the board yet — go get it",
        rows[0] ? `🥇 LEADER: ${nick(rows[0])} · ${dailyLine(rows[0], T.mode)}` : "",
        myI >= 0 ? `🎣 YOU: P${myI + 1}/${rows.length} · ${dailyLine(rows[myI], T.mode)}` : "",
        `👥 ${entered} real angler${entered === 1 ? "" : "s"} in today`,
      ].filter(Boolean);
      if (el.dailyTickerText) el.dailyTickerText.innerHTML = bits.join(" &nbsp;&nbsp;·&nbsp;&nbsp; ");
      renderTourBoard();
    });
  }
  function endDaily(T) {
    duelStreamStop(T);
    el.dailyTicker.classList.add("hidden");
    dailySubmit(T, true);
    const myTotal = wellTotal();
    const rows = dailyBoardRows(T);
    const place = rows.findIndex(r => r.me) + 1;
    const md = DAILY_MODES.find(x => x.id === T.mode) || DAILY_MODES[0];
    const fee = T.fee || 90;
    let payout = place === 1 ? fee * 5 : place === 2 ? fee * 3 : place === 3 ? fee * 2 : place <= Math.ceil(rows.length / 2) ? fee : Math.round(fee * 0.4);
    payout = Math.round(payout);
    G.coins += payout; addAnglerXP(payout);
    if (myTotal > (G.bestBag || 0)) G.bestBag = +myTotal.toFixed(2);
    if (T.custom) {
      if (!G.evDone) G.evDone = {};
      G.evDone[T.custom] = 1;
    } else {
      G.dailyDone = T.daily;
      if (!G.dailyHist) G.dailyHist = {};
      G.dailyHist[T.daily] = { p: place, of: rows.length, w: +myTotal.toFixed(2), b: +(T.big || 0).toFixed(2), f: T.dayCount || 0, m: T.mode };
      Object.keys(G.dailyHist).sort().slice(0, -14).forEach(k => delete G.dailyHist[k]);   // keep two weeks
    }
    save(); updateHUD();
    const ord = ["", "1st", "2nd", "3rd"][place] || place + "th";
    el.tourPlace.textContent = ord + " today (so far)";
    el.tourResultMedal.textContent = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "📅";
    el.tourBag.innerHTML = T.well.length
      ? T.well.slice().sort((a, b) => b.weight - a.weight).map(f => `<div class="bag-fish">${fishSVG(f, 40)}<b>${f.weight}</b></div>`).join("")
      : `<p class="muted">No keepers in the well today.</p>`;
    el.tourResultStats.innerHTML =
      `${md.ico} <b>${T.custom ? "Crew " : "Daily "}${md.name}</b> — your ${dailyLine(rows[place - 1], T.mode)}<br>` +
      `Points: <b>+${payout}</b> 🎯${place === 1 ? "  🏆" : ""}<br>` +
      (T.custom
        ? (T.duel
          ? `<span class="muted" style="font-size:11px">Your side's in the book — open the callout link to see the verdict once they fish theirs. 🥊</span>`
          : `<span class="muted" style="font-size:11px">The board keeps filling until the invite closes — open the invite link anytime for the latest. <b style="color:var(--gold)">Gold ★ = real anglers.</b></span>`)
        : `<span class="muted" style="font-size:11px">The board keeps filling until midnight UTC — the final call is on tomorrow's DAILY screen. <b style="color:var(--gold)">Gold ★ = real anglers.</b></span>`);
    el.tourStandings.innerHTML = rows.map((b, i) =>
      `<div class="stand-row ${b.me ? "me" : ""} ${b.real ? "real" : ""}"><span>${i + 1}. ${dEsc(b.me ? (G.name || "You") : b.name)}${b.real && !b.me ? " ★" : ""}</span><span class="w">${dailyLine(b, T.mode)}</span></div>`).join("");
    el.tourResultModal.classList.remove("hidden");
    setTimeout(() => sfx(place === 1 ? "weighwin" : "weighin"), 300);
    const meRow = el.tourStandings.querySelector(".me");
    if (meRow) el.tourStandings.scrollTop = Math.max(0, meRow.offsetTop - el.tourStandings.clientHeight / 2);
  }
  // --- 🐷 Big Bass of the Day: your biggest black bass today, ANY mode ---
  // (free play, tournament, arcade, daily — they all pass through finishLand)
  function bigBassSubmit(w) {
    const dk = dayKey();
    if (!G.bigbassDay || G.bigbassDay.d !== dk) G.bigbassDay = { d: dk, w: 0 };
    if (w <= G.bigbassDay.w) return;
    G.bigbassDay.w = +w.toFixed(2); save();
    const base2 = LB.fb(); if (!base2) return;
    fetch(base2 + "/bigbass/" + dk + "/" + LB.pid() + ".json", { method: "PUT",
      body: JSON.stringify({ n: G.name || "ANGLER", w: +w.toFixed(2), t: Date.now() }) }).catch(() => {});
  }
  async function fetchBigBass(dk) {
    const base2 = LB.fb(); if (!base2) return [];
    const r = await fetch(base2 + "/bigbass/" + dk + ".json");
    if (!r.ok) return [];
    const data = await r.json() || {};
    const rows = Object.entries(data).map(([k, v]) =>
      (v && typeof v === "object" && v.n && +v.w > 0 && /^p[a-z0-9]{4,20}$/.test(k))
        ? { pid: k, name: String(v.n).slice(0, 14), w: +v.w }
        : null).filter(Boolean);
    return LB.dedupeNames(rows, e => e.w).sort((a, b) => b.w - a.w);
  }
  // the home-screen marquee: sell today's daily + the Big Bass of the Day ranks
  function renderTitleTicker() {
    if (!el.titleTicker) return;
    const dk = dayKey(), rules = dailyRules(dk), md = rules.mode;
    const sp = SPOTS.find(s => s.id === rules.spot) || SPOTS[0];
    const done = G.dailyDone === dk;
    const promo = done
      ? `✅ DAILY FISHED — new challenge at midnight UTC · tap for today&#39;s standings ▸`
      : `📅 ENTER THE DAILY TOURNAMENT — ${md.ico} ${md.name} at ${sp.name} · one entry a day · TAP HERE ▸`;
    const setText = list => {
      const myPid = LB.pid();
      let bb = "🐷 BIG BASS OF THE DAY — all waters, all anglers: ";
      bb += list.length
        ? list.slice(0, 5).map((e, i) => `${i + 1}. ${e.pid === myPid ? "YOU" : dEsc(e.name).toUpperCase()} ${e.w.toFixed(2)} lb`).join(" &nbsp;·&nbsp; ")
        : "no bass on the board yet — yours could be first!";
      el.titleTickerText.innerHTML =
        `<span style="color:var(--gold)">${promo}</span> &nbsp;&nbsp;•&nbsp;&nbsp; ${bb}`;
    };
    // show instantly with what we know; the ranks fill in when the board answers
    let seed = [];
    if (G.bigbassDay && G.bigbassDay.d === dk && G.bigbassDay.w > 0) seed = [{ pid: LB.pid(), name: G.name || "YOU", w: G.bigbassDay.w }];
    setText(seed);
    el.titleTicker.classList.remove("hidden");
    const tryRanks = attempt => {
      // at boot the lb-config fetch may not have landed yet — try again shortly
      if (!LB.fb()) { if (attempt < 5) setTimeout(() => tryRanks(attempt + 1), 900); return; }
      fetchBigBass(dk).then(list => {
        const myPid = LB.pid();   // fold in our own — the PUT may still be in flight
        if (G.bigbassDay && G.bigbassDay.d === dk && G.bigbassDay.w > 0) {
          const i2 = list.findIndex(e => e.pid === myPid || LB.nameKey(e.name) === LB.nameKey(G.name));
          const mine2 = { pid: myPid, name: G.name || "YOU", w: G.bigbassDay.w };
          if (i2 < 0) list.push(mine2); else if (list[i2].w < mine2.w) list[i2] = mine2;
          list.sort((a, b) => b.w - a.w);
        }
        if (!el.titleScreen.classList.contains("hidden")) setText(list);
      }).catch(() => {});
    };
    tryRanks(0);
  }
  el.titleTicker.addEventListener("click", () => { sfx("ui"); openDailySheet(false); });

  // --- 🔒 ANGLER PIN: one 4-digit PIN per name, set on first daily entry ---
  // The registry lives in Firebase under /pins/<name> as a SHA-256 hash, so
  // the same PIN works from any phone — and it's the identity layer any
  // future feature can lean on (pinCheck verifies name + pin anywhere).
  const pinKey = () => "n_" + (LB.nameKey(G.name || "ANGLER").replace(/[^A-Z0-9]/g, "_") || "ANGLER");
  const pinUrl = () => LB.fb() + "/pins/" + pinKey() + ".json";
  async function pinHash(name, pin) {
    const data = new TextEncoder().encode("bb1:" + LB.nameKey(name) + ":" + pin);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  async function pinFetch() {
    const r = await fetch(pinUrl());
    if (!r.ok) throw new Error("HTTP " + r.status);
    const v = await r.json();
    return v && v.h ? String(v.h) : null;
  }
  async function pinCheck(name, pin) {   // the universal verify — reusable anywhere
    const existing = await pinFetch().catch(() => null);
    const h = await pinHash(name, pin);
    if (!existing) return { ok: true, isNew: true, h };
    return { ok: h === existing, isNew: false, h };
  }
  let dailyPinHash = null;   // today's fetched hash while the sheet is open
  function renderPinStep(existing) {
    const card = el.dailyBody.querySelector(".daily-card");
    if (!card) return;
    card.innerHTML = `
      <div class="d-title">🔒 ANGLER PIN</div>
      <div class="d-sub" id="pinMsg">${existing
        ? `Enter your 4-digit PIN, <b>${dEsc(G.name || "ANGLER")}</b>`
        : `First time in, <b>${dEsc(G.name || "ANGLER")}</b> — pick a 4-digit PIN. Same PIN every day, on any phone.`}</div>
      <input id="pinInput" class="pin-input" type="tel" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">
      <button class="big-btn" id="pinGo" style="margin-top:8px">${existing ? "🔓 UNLOCK & ENTER" : "✅ SET PIN & ENTER"}</button>
      <button class="text-btn" id="pinBack">Back</button>`;
    setTimeout(() => { const i = document.getElementById("pinInput"); if (i) i.focus(); }, 60);
  }

  // --- ☁️ CLOUD SAVE: the whole save backs up under /saves/<name>, so an
  // angler can pull their progress onto a new phone (or the new domain)
  // with just their name + daily-tournament PIN.
  let lastCloudPush = 0;
  function cloudBackup() {
    const base2 = LB.fb(); if (!base2 || !G.name) return;
    if (Date.now() - lastCloudPush < 120000) return;   // a couple times a session is plenty
    lastCloudPush = Date.now();
    try {
      const body = JSON.stringify({ n: G.name, t: Date.now(), v: localStorage.getItem(SAVE_KEY) || JSON.stringify(G) });
      fetch(LB.fb() + "/saves/" + pinKey() + ".json", { method: "PUT", body }).catch(() => {});
    } catch (e) {}
  }
  cloudSaveHook = cloudBackup;
  async function restoreAngler(name, pin) {
    const base2 = LB.fb(); if (!base2) return { ok: false, why: "offline" };
    const key = "n_" + (LB.nameKey(name).replace(/[^A-Z0-9]/g, "_") || "ANGLER");
    // the PIN registry is the identity check; a name with no PIN yet is open
    const pr = await fetch(base2 + "/pins/" + key + ".json").catch(() => null);
    const pv = pr && pr.ok ? await pr.json() : null;
    if (pv && pv.h) {
      const h = await pinHash(name, pin);
      if (h !== String(pv.h)) return { ok: false, why: "pin" };
    }
    const sr = await fetch(base2 + "/saves/" + key + ".json").catch(() => null);
    if (!sr || !sr.ok) return { ok: false, why: "none" };
    const sv = await sr.json();
    if (!sv || !sv.v) return { ok: false, why: "none" };
    try { JSON.parse(sv.v); } catch (e) { return { ok: false, why: "corrupt" }; }
    try { localStorage.setItem(SAVE_KEY, sv.v); } catch (e) { return { ok: false, why: "corrupt" }; }
    return { ok: true };
  }
  el.tsRestore.addEventListener("click", () => {
    sfx("ui");
    const rn = document.getElementById("restoreName");
    if (rn) rn.value = (el.anglerName.value || G.name || "").trim();
    const rm = document.getElementById("restoreMsg"); if (rm) rm.textContent = "";
    el.restoreModal.classList.remove("hidden");
  });
  el.restoreCancel.addEventListener("click", () => { sfx("ui"); el.restoreModal.classList.add("hidden"); });
  el.restoreGo.addEventListener("click", () => {
    const name = (document.getElementById("restoreName").value || "").trim().toUpperCase().slice(0, 12);
    const pin = (document.getElementById("restorePin").value || "").trim();
    const msg = document.getElementById("restoreMsg");
    if (!name) { if (msg) msg.textContent = "Enter your angler name"; return; }
    if (msg) msg.textContent = "Casting out for your save…";
    restoreAngler(name, pin).then(res => {
      if (res.ok) {
        if (msg) msg.textContent = "✅ Restored! Reloading…";
        sfx("weighwin");
        setTimeout(() => location.reload(), 900);
      } else if (res.why === "pin") { sfx("weak"); if (msg) msg.textContent = "❌ Wrong PIN for " + name; }
      else if (res.why === "offline") { if (msg) msg.textContent = "📡 Can't reach the database"; }
      else { if (msg) msg.textContent = "No cloud save found for " + name + " yet — play once on the old phone first"; }
    });
  });

  // --- 📣 SHARE A LUNKER: the whole catch rides inside the link, so it
  // opens as a full catch card (lake map, spot, lure, conditions) anywhere ---
  let cdEntry = null;        // the catch behind the open detail card
  let cdShareAs = null;      // credit the original angler when re-sharing
  function shareCatch(entry, angler) {
    try {
      const who = angler || G.name || "ANGLER";
      const payload = { a: who, e: entry };
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const url = location.origin + location.pathname + "?lunker=" + b64;
      const text = `🏆 ${who} caught a ${(+entry.w).toFixed(1)} lb bass on BassBuddy — see where, and on what!`;
      if (navigator.share) { navigator.share({ title: "BassBuddy — Share a Lunker", text, url }).catch(() => {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + " " + url).then(() => toast("🔗 Link copied — text it to the crew!")).catch(() => toast("Couldn't copy the link 😕"));
      }
    } catch (e2) { toast("Couldn't build the share link 😕"); }
  }
  el.catchShare.addEventListener("click", () => {
    sfx("ui");
    const e2 = (G.catchLog || [])[(G.catchLog || []).length - 1];
    if (e2) shareCatch(e2);
  });
  el.catchDetailBody.addEventListener("click", (e) => {
    if (e.target.closest("#cdShare") && cdEntry) { sfx("ui"); shareCatch(cdEntry, cdShareAs); }
  });
  function showSharedCatch(p) {
    const e2 = {};
    for (const k in p.e) {   // a link is untrusted input — numbers stay numbers, strings get escaped
      const v = p.e[k];
      e2[k] = typeof v === "number" ? v : typeof v === "boolean" ? v : dEsc(String(v).slice(0, 40));
    }
    e2.w = +e2.w || 0; e2.len = +e2.len || +Math.cbrt(Math.max(0.1, e2.w) * 1600).toFixed(1);
    cdShareAs = dEsc(String(p.a || "AN ANGLER").slice(0, 14));
    openCatchDetail(e2);
    const hdr = document.createElement("div");
    hdr.className = "cd-share-banner";
    hdr.innerHTML = `📣 <b>${cdShareAs}</b> shared this lunker — go catch its twin!`;
    el.catchDetailBody.prepend(hdr);
    sfx("lunker");
  }

  // --- 🎪 HOSTED EVENTS: anyone can spin up a tournament and text the link;
  // entries land under /events/<code>/res and everyone gets one shot ---
  let hostSel = { spot: "cove", mode: "bag" };
  let hostSheetKind = "host";   // which sheet the lake/format buttons re-render
  const eventUrl = code => location.origin + location.pathname + "?join=" + code;
  function openHostSheet() {
    hostSheetKind = "host";
    if (el.hostTitle) el.hostTitle.textContent = "🎪 Host a Tournament";
    const spots = SPOTS.map(s => `<button class="item-btn ${hostSel.spot === s.id ? "owned" : ""}" data-hspot="${s.id}">${s.ico} ${s.name}</button>`).join("");
    const modes = DAILY_MODES.map(m => `<button class="item-btn ${hostSel.mode === m.id ? "owned" : ""}" data-hmode="${m.id}">${m.ico} ${m.name}</button>`).join("");
    el.hostBody.innerHTML = `
      <p class="muted">Set the water and the format — you'll get an invite link to text the crew. One entry each; standings go final 48 hours after you post it.</p>
      <h3 class="rec-h">🗺️ The water</h3><div class="host-grid">${spots}</div>
      <h3 class="rec-h">🏅 Format</h3><div class="host-grid">${modes}</div>
      <button class="big-btn" id="hostCreate" style="margin-top:10px">🎪 CREATE & GET THE INVITE LINK</button>`;
    el.hostModal.classList.remove("hidden");
  }
  function createEvent() {
    const base2 = LB.fb(); if (!base2) { toast("📡 Can't reach the database"); return; }
    const md = DAILY_MODES.find(m => m.id === hostSel.mode) || DAILY_MODES[0];
    const sp = SPOTS.find(s => s.id === hostSel.spot) || SPOTS[0];
    const code = Array.from({ length: 5 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    const cfg = { name: `${G.name || "ANGLER"}'s ${md.name}`, host: G.name || "ANGLER", spot: sp.id, mode: md.id, dur: 180000, t: Date.now(), until: Date.now() + 48 * 3600000 };
    el.hostBody.innerHTML = `<p class="muted" style="text-align:center">Posting the event…</p>`;
    fetch(base2 + "/events/" + code + "/cfg.json", { method: "PUT", body: JSON.stringify(cfg) })
      .then(r => { if (!r.ok) throw 0; openEventSheet(code, cfg, []); shareEvent(code, cfg); })
      .catch(() => { toast("Couldn't post the event 📡"); openHostSheet(); });
  }
  function shareEvent(code, cfg) {
    const sp = SPOTS.find(s => s.id === cfg.spot) || SPOTS[0];
    const text = `🎣 You're invited: ${cfg.name} on ${sp.name} — BassBuddy. One entry each, fish it before it closes!`;
    const url = eventUrl(code);
    if (navigator.share) { navigator.share({ title: "BassBuddy Tournament Invite", text, url }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + url).then(() => toast("🔗 Invite copied — text it to the crew!")).catch(() => {});
    }
  }
  async function fetchEventRes(code) {
    const base2 = LB.fb(); if (!base2) return [];
    const r = await fetch(base2 + "/events/" + code + "/res.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json() || {};
    const rows = Object.entries(data).map(([k, v]) =>
      (v && typeof v === "object" && v.n && /^p[a-z0-9]{4,20}$/.test(k))
        ? { pid: k, name: String(v.n).slice(0, 14), total: +v.w || 0, big: +v.b || 0, fish: +v.f || 0, done: !!v.d, real: true, rp: Array.isArray(v.rp) ? v.rp.slice(0, 40) : null }
        : null).filter(Boolean);
    return LB.dedupeNames(rows, e2 => e2.total * 10000 + e2.big * 100 + e2.fish);
  }
  async function openJoinEvent(code) {
    const base2 = LB.fb(); if (!base2) { toast("📡 Can't reach the database"); return; }
    if (el.hostTitle) el.hostTitle.textContent = "🎪 Tournament Invite";
    el.hostBody.innerHTML = `<p class="muted" style="text-align:center">Reading the invite…</p>`;
    el.hostModal.classList.remove("hidden");
    try {
      const r = await fetch(base2 + "/events/" + code + "/cfg.json");
      const cfg = r.ok ? await r.json() : null;
      if (!cfg || !cfg.mode) { el.hostBody.innerHTML = `<p class="muted" style="text-align:center">That invite doesn't exist (or expired) 🤷</p>`; return; }
      const res = await fetchEventRes(code).catch(() => []);
      openEventSheet(code, cfg, res);
    } catch (e2) {
      el.hostBody.innerHTML = `<p class="muted" style="text-align:center">Couldn't read the invite 📡</p>`;
    }
  }
  async function openEventSheet(code, cfg, res) {
    const md = DAILY_MODES.find(m => m.id === cfg.mode) || DAILY_MODES[0];
    const sp = SPOTS.find(s => s.id === cfg.spot) || SPOTS[0];
    const closed = Date.now() > (+cfg.until || 0);
    const done = (G.evDone || {})[code];
    const myPid = LB.pid();
    const rows = dailySort(res.map(x => Object.assign({}, x, { me: x.pid === myPid })), md.id);
    const duel = cfg.duel && cfg.duel.a && cfg.duel.b ? cfg.duel : null;
    if (duel) {
      const myKey = LB.nameKey(G.name);
      const inDuel = myKey === LB.nameKey(duel.a) || myKey === LB.nameKey(duel.b);
      const winner = duelDecide(code, cfg, rows);
      let rec = null;
      try { rec = await fetchDuelRecord(duel.a, duel.b); } catch (e2) {}
      const ka = LB.nameKey(duel.a), kb = LB.nameKey(duel.b);
      const recLine = rec ? `Lifetime: <b style="color:var(--gold)">${dEsc(duel.a)}</b> ${rec[ka] || 0} — ${rec[kb] || 0} <b style="color:var(--gold)">${dEsc(duel.b)}</b>` : "";
      if (el.hostTitle) el.hostTitle.textContent = "🥊 Duel";
      el.hostBody.innerHTML = `
        <div class="daily-card">
          <div class="d-title">🥊 ${dEsc(duel.a)} vs ${dEsc(duel.b)}</div>
          <div class="d-sub"><b>${sp.ico} ${sp.name}</b> · ${md.ico} ${md.name} · ⏱️ 3:00 each</div>
          <div class="d-sub">${md.rule}</div>
          ${recLine ? `<div class="d-sub">${recLine}</div>` : ""}
          ${winner
            ? `<div class="d-done">🏆 <b>${dEsc(winner === ka ? duel.a : duel.b)}</b> WINS THE DUEL!</div>` +
              (inDuel ? `<button class="big-btn" id="duelRematch" style="margin-top:8px">🔁 REMATCH</button>` : "")
            : closed ? `<div class="d-sub muted">Duel window closed.</div>`
            : !inDuel ? `<div class="d-sub muted">This one's between ${dEsc(duel.a)} and ${dEsc(duel.b)} — you're ringside 🍿</div>`
            : done ? `<div class="d-done">✅ Your bag is in — waiting on ${dEsc(myKey === ka ? duel.b : duel.a)}…</div>`
            : `<button class="big-btn" id="evEnter" style="margin-top:8px">🥊 FISH YOUR SIDE NOW</button>`}
          <button class="text-btn" id="evShare">🔗 Share the callout</button>
        </div>
        <h3 class="rec-h">📊 The tale of the tape</h3>
        <div class="d-list">${rows.length ? rows.map((b2, i) => dRow(b2, i, md.id)).join("") : `<p class="muted" style="text-align:center">Nobody's weighed in yet.</p>`}</div>`;
      el.hostBody.dataset.ev = JSON.stringify({ code, cfg });
      el.hostModal.classList.remove("hidden");
      return;
    }
    if (el.hostTitle) el.hostTitle.textContent = "🎪 Crew Tournament";
    let when = "";
    try { when = new Date(+cfg.until).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }); } catch (e2) {}
    el.hostBody.innerHTML = `
      <div class="daily-card">
        <div class="d-title">${md.ico} ${dEsc(String(cfg.name || md.name).slice(0, 40))}</div>
        <div class="d-sub">Hosted by <b style="color:var(--gold)">${dEsc(String(cfg.host || "?").slice(0, 14))}</b> · <b>${sp.ico} ${sp.name}</b> · ⏱️ 3:00</div>
        <div class="d-sub">${md.rule}</div>
        <div class="d-sub muted" style="font-size:11px">Invite code <b>${dEsc(code)}</b> · one entry each · ${closed ? "<b>CLOSED — final standings</b>" : "closes " + when}</div>
        ${closed ? "" : done
          ? `<div class="d-done">✅ You've fished this one — watch the board fill in!</div>`
          : `<button class="big-btn" id="evEnter" style="margin-top:8px">🎣 FISH IT NOW</button>`}
        <button class="text-btn" id="evShare">🔗 Share the invite</button>
      </div>
      <h3 class="rec-h">📊 Standings <span style="font-weight:400;color:var(--gold)">★ gold = real anglers</span></h3>
      <div class="d-list">${rows.length ? rows.map((b2, i) => dRow(b2, i, md.id)).join("") : `<p class="muted" style="text-align:center">Nobody's fished it yet — be first!</p>`}</div>`;
    el.hostBody.dataset.ev = JSON.stringify({ code, cfg });
    el.hostModal.classList.remove("hidden");
  }
  // --- 🥊 DUELS: an event between exactly two named anglers. Rides the same
  // /events/<code> rails; the pair's lifetime record lives at /events/_duelrec.
  const duelPairKey = (a, b2) => {
    const ka = LB.nameKey(a).replace(/[^A-Z0-9]/g, "_"), kb = LB.nameKey(b2).replace(/[^A-Z0-9]/g, "_");
    return [ka, kb].sort().join("__");
  };
  function openDuelSheet() {
    hostSheetKind = "duel";
    if (el.hostTitle) el.hostTitle.textContent = "🥊 Call Somebody Out";
    const spots = SPOTS.map(s => `<button class="item-btn ${hostSel.spot === s.id ? "owned" : ""}" data-hspot="${s.id}">${s.ico} ${s.name}</button>`).join("");
    const modes = DAILY_MODES.map(m => `<button class="item-btn ${hostSel.mode === m.id ? "owned" : ""}" data-hmode="${m.id}">${m.ico} ${m.name}</button>`).join("");
    el.hostBody.innerHTML = `
      <p class="muted">Name your opponent, set the water and the format — then text them the callout. Just you two, one 3:00 run each, winner takes the record.</p>
      <input id="duelTarget" class="title-name" maxlength="12" placeholder="WHO ARE YOU CALLING OUT?"
             autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" value="${dEsc(hostSel.target || "")}">
      <h3 class="rec-h">🗺️ The water</h3><div class="host-grid">${spots}</div>
      <h3 class="rec-h">🏅 Format</h3><div class="host-grid">${modes}</div>
      <button class="big-btn" id="duelCreate" style="margin-top:10px">🥊 SEND THE CALLOUT</button>`;
    el.hostModal.classList.remove("hidden");
  }
  function createDuel() {
    const base2 = LB.fb(); if (!base2) { toast("📡 Can't reach the database"); return; }
    const target = ((document.getElementById("duelTarget") || {}).value || "").trim().toUpperCase().slice(0, 12);
    if (!target) { toast("Who are you calling out? 🥊"); return; }
    if (LB.nameKey(target) === LB.nameKey(G.name)) { toast("You can't call yourself out 😅"); return; }
    hostSel.target = target;
    const md = DAILY_MODES.find(m => m.id === hostSel.mode) || DAILY_MODES[0];
    const sp = SPOTS.find(s => s.id === hostSel.spot) || SPOTS[0];
    const code = Array.from({ length: 5 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    const cfg = { name: `${G.name || "ANGLER"} vs ${target}`, host: G.name || "ANGLER", spot: sp.id, mode: md.id,
      dur: 180000, t: Date.now(), until: Date.now() + 48 * 3600000, duel: { a: G.name || "ANGLER", b: target } };
    el.hostBody.innerHTML = `<p class="muted" style="text-align:center">Posting the callout…</p>`;
    fetch(base2 + "/events/" + code + "/cfg.json", { method: "PUT", body: JSON.stringify(cfg) })
      .then(r => { if (!r.ok) throw 0; inboxWrite(target, { ty: "duel", from: G.name || "ANGLER", id: "D" + code }); openEventSheet(code, cfg, []); shareDuel(code, cfg); })
      .catch(() => { toast("Couldn't post the callout 📡"); openDuelSheet(); });
  }
  function shareDuel(code, cfg) {
    const sp = SPOTS.find(s => s.id === cfg.spot) || SPOTS[0];
    const text = `🥊 ${cfg.duel.a} is calling YOU out, ${cfg.duel.b}! ${DAILY_MODES.find(m => m.id === cfg.mode).name} at ${sp.name} on BassBuddy — settle it on the water:`;
    const url = eventUrl(code);
    if (navigator.share) { navigator.share({ title: "BassBuddy Duel", text, url }).catch(() => {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + url).then(() => toast("🔗 Callout copied — text it to them!")).catch(() => {});
    }
  }
  async function fetchDuelRecord(a, b2) {
    const base2 = LB.fb(); if (!base2) return null;
    try {
      const r = await fetch(base2 + "/events/_duelrec/" + duelPairKey(a, b2) + ".json");
      if (!r.ok) return null;
      const data = await r.json() || {};
      const rec = {};
      for (const k in data) { const w = data[k] && data[k].w; if (w) rec[w] = (rec[w] || 0) + 1; }
      return rec;   // { NAMEKEY: wins }
    } catch (e2) { return null; }
  }
  // both bags are in — call it, and write the result once (idempotent value)
  function duelDecide(code, cfg, rows) {
    const ka = LB.nameKey(cfg.duel.a), kb = LB.nameKey(cfg.duel.b);
    const ra = rows.find(r => LB.nameKey(r.name) === ka), rb = rows.find(r => LB.nameKey(r.name) === kb);
    if (!ra || !rb || !ra.done || !rb.done) return null;
    const ordered = dailySort([ra, rb].map(x => Object.assign({}, x)), cfg.mode);
    const winner = LB.nameKey(ordered[0].name);
    const base2 = LB.fb();
    if (base2) fetch(base2 + "/events/_duelrec/" + duelPairKey(cfg.duel.a, cfg.duel.b) + "/" + code + ".json",
      { method: "PUT", body: JSON.stringify({ w: winner, t: cfg.t || 0 }) }).catch(() => {});
    const wName = winner === LB.nameKey(cfg.duel.a) ? cfg.duel.a : cfg.duel.b;
    const lName = winner === LB.nameKey(cfg.duel.a) ? cfg.duel.b : cfg.duel.a;
    inboxWrite(wName, { ty: "duelend", won: true, vs: lName, id: "E" + code });
    inboxWrite(lName, { ty: "duelend", won: false, vs: wName, id: "E" + code });
    return winner;
  }
  function chooseEvent(code, cfg) {
    if (S.tournament && !S.tournament.ended) { toast("Tournament in progress ⏱️"); return; }
    if (S.arcade && !S.arcade.ended) { toast("Arcade run in progress 🕹️"); return; }
    if ((G.evDone || {})[code]) { toast("One entry each — you've fished this one 🎪"); return; }
    if (Date.now() > (+cfg.until || 0)) { toast("That event has closed 🌙"); return; }
    if (cfg.duel && cfg.duel.a && cfg.duel.b) {
      const myKey = LB.nameKey(G.name);
      if (myKey !== LB.nameKey(cfg.duel.a) && myKey !== LB.nameKey(cfg.duel.b)) { toast(`This duel is ${cfg.duel.a} vs ${cfg.duel.b} — spectators only 🍿`); return; }
    }
    const md = DAILY_MODES.find(m => m.id === cfg.mode) || DAILY_MODES[0];
    el.hostModal.classList.add("hidden");
    el.dailyModal.classList.add("hidden");
    if (!el.titleScreen.classList.contains("hidden")) closeTitle(true);
    if (S.tut) { S.tut = null; el.tutBanner.classList.add("hidden"); }
    pendingTour = { id: null, custom: code, mode: md.id, spot: cfg.spot, name: String(cfg.name || "Crew " + md.name).slice(0, 40), dur: +cfg.dur || 180000, field: 0, duel: !!cfg.duel };
    if (G.spot !== cfg.spot && SPOTS.some(s => s.id === cfg.spot)) { G.spot = cfg.spot; seedFish(); rollConditions(); }
    save(); updateHUD(); resetToIdle();
    refreshTourStart();
    el.tourStartModal.classList.remove("hidden");
  }
  el.hostClose.addEventListener("click", () => { sfx("ui"); el.hostModal.classList.add("hidden"); });
  el.hostBody.addEventListener("click", (e) => {
    const rerender = () => {
      const ti = document.getElementById("duelTarget");   // keep the typed-in opponent across re-renders
      if (ti) hostSel.target = (ti.value || "").trim().toUpperCase().slice(0, 12);
      (hostSheetKind === "duel" ? openDuelSheet : openHostSheet)();
    };
    const hs = e.target.closest("[data-hspot]"); if (hs) { hostSel.spot = hs.dataset.hspot; sfx("ui"); rerender(); return; }
    const hm = e.target.closest("[data-hmode]"); if (hm) { hostSel.mode = hm.dataset.hmode; sfx("ui"); rerender(); return; }
    if (e.target.closest("#hostCreate")) { sfx("good"); createEvent(); return; }
    const d = (() => { try { return JSON.parse(el.hostBody.dataset.ev || "{}"); } catch (e2) { return {}; } })();
    if (e.target.closest("#evShare")) { sfx("ui"); if (d.cfg) shareEvent(d.code, d.cfg); return; }
    if (e.target.closest("#evEnter")) { sfx("good"); if (d.cfg) chooseEvent(d.code, d.cfg); return; }
    if (e.target.closest("#duelCreate")) { sfx("good"); createDuel(); return; }
    if (e.target.closest("#duelRematch")) {
      sfx("good");
      if (d.cfg && d.cfg.duel) {
        const opp = LB.nameKey(G.name) === LB.nameKey(d.cfg.duel.a) ? d.cfg.duel.b : d.cfg.duel.a;
        hostSel.target = opp; hostSel.spot = d.cfg.spot; hostSel.mode = d.cfg.mode;
        openDuelSheet();
      }
      return;
    }
  });

  // --- shared links open once the player reaches the menu ---
  let pendingShare = null, pendingJoin = null;
  (function parseSharedLinks() {
    try {
      const q = new URLSearchParams(location.search);
      const lk = q.get("lunker"), jn = q.get("join");
      if (lk) {
        try {
          const p = JSON.parse(decodeURIComponent(escape(atob(lk.replace(/-/g, "+").replace(/_/g, "/")))));
          if (p && p.e && isFinite(+p.e.w)) pendingShare = p;
        } catch (e2) {}
      }
      if (jn && /^[a-z0-9]{4,8}$/i.test(jn)) pendingJoin = jn.toUpperCase();
      if (lk || jn) history.replaceState(null, "", location.pathname);
    } catch (e2) {}
  })();
  function flushSharedLinks() {
    if (pendingShare) { const p = pendingShare; pendingShare = null; setTimeout(() => showSharedCatch(p), 400); }
    else if (pendingJoin) { const c = pendingJoin; pendingJoin = null; setTimeout(() => openJoinEvent(c), 400); }
  }

  // --- 👑 WEEKLY CREW CHAMPIONSHIP: F1-style points from each real day board
  // (10/7/5/3/2, then 1 for entering), best 5 of 7 days, Mon–Sun UTC. Nothing
  // new is written — it's all derived from /daily, so CPU pros never score.
  const WEEK_PTS = [10, 7, 5, 3, 2];
  function weekOffsets(prev) {
    const dow = new Date().getUTCDay();                 // 0 Sun .. 6 Sat
    const mon = -((dow + 6) % 7) - (prev ? 7 : 0);      // offset of that week's Monday
    return Array.from({ length: 7 }, (x, i) => mon + i);
  }
  async function weeklyStandings(prev) {
    const offs = weekOffsets(prev);
    const days = await Promise.all(offs.map(o => fetchDay(dayKey(o)).catch(() => [])));
    const tally = new Map();   // nameKey -> { name, pts: [day pts...] }
    days.forEach((rows, i) => {
      const mode = dailyRules(dayKey(offs[i])).mode.id;
      dailySort(rows.slice(), mode).forEach((r, place) => {
        const k = LB.nameKey(r.name); if (!k) return;
        const p = WEEK_PTS[place] != null ? WEEK_PTS[place] : 1;
        if (!tally.has(k)) tally.set(k, { name: r.name, pts: [] });
        tally.get(k).pts.push(p);
      });
    });
    return [...tally.values()]
      .map(t => ({ name: t.name, days: t.pts.length, pts: t.pts.sort((a, b) => b - a).slice(0, 5).reduce((s2, p) => s2 + p, 0) }))
      .sort((a, b) => b.pts - a.pts || b.days - a.days);
  }
  // last week's winner gets the crown everywhere until next Monday
  function computeWeekChamp() {
    const wk = dayKey(weekOffsets(true)[0]);
    if (G.weekChamp && G.weekChamp.wk === wk && Date.now() - (G.weekChamp.t || 0) < 6 * 3600000) return;
    if (!LB.fb()) return;
    weeklyStandings(true).then(rows => {
      G.weekChamp = { wk, t: Date.now(), n: rows.length ? LB.nameKey(rows[0].name) : "", disp: rows.length ? rows[0].name : "" };
      save();
    }).catch(() => {});
  }
  const isWeekChamp = name => !!(G.weekChamp && G.weekChamp.n && LB.nameKey(name) === G.weekChamp.n);
  window.__isWeekChamp = isWeekChamp;   // the LB module renders the crown

  // --- 🚤 THE GARAGE: something to spend all those points on. Upgrades carry
  // real effects; wraps + a boat name show up on the boards.
  const WRAPS = [["#d33a2c", "Rocket Red"], ["#2f7fd3", "Lake Blue"], ["#3fae5a", "Swamp Green"], ["#ffd35c", "Gold Rush"], ["#9b59d0", "Night Purple"]];
  const gar = () => (G.garage = G.garage || { motor: 0, sonar: 0, net: 0, bobber: 0, wrap: "", name: "" });
  const garageMoveMs = () => [20000, 14000, 9000][gar().motor] || 9000;
  const garageNet = () => (gar().net ? 0.88 : 1);          // the net eases line strain
  const garageScoreMul = () => (gar().bobber ? 1.05 : 1);  // the lucky bobber pays 5%
  const garageSonar = () => gar().sonar >= 1;
  const GARAGE_ITEMS = [
    { id: "motor", name: "Trolling Motor", ico: "🌀", tiers: [36000, 90000],
      desc: l2 => l2 === 0 ? "Tournament spot moves cost 0:14 instead of 0:20" : l2 === 1 ? "Upgrade again: moves cost just 0:09" : "Maxed — moves cost 0:09" },
    { id: "sonar", name: "Pro Sonar", ico: "📡", tiers: [45000],
      desc: l2 => l2 === 0 ? "The finder calls out the size class holding on your spot" : "Installed — size class on the finder" },
    { id: "net",   name: "Landing Net", ico: "🥅", tiers: [60000],
      desc: l2 => l2 === 0 ? "12% less line strain in every fight — fewer break-offs" : "Racked and ready — 12% easier on the line" },
    { id: "bobber", name: "Lucky Bobber", ico: "🎈", tiers: [25000],
      desc: l2 => l2 === 0 ? "+5% catch score on every bass. Don't ask how it works." : "Tied on. It works. Don't ask." },
  ];
  function openGarage() {
    const g2 = gar();
    const items = GARAGE_ITEMS.map(it => {
      const lvl = g2[it.id] || 0, next = it.tiers[lvl];
      return `<div class="item">
        <div class="item-ico">${it.ico}</div>
        <div class="item-info"><div class="item-name">${it.name}${it.tiers.length > 1 ? ` <small>Lv ${lvl}/${it.tiers.length}</small>` : lvl ? " ✓" : ""}</div>
        <div class="item-desc">${it.desc(lvl)}</div></div>
        ${next != null
          ? `<button class="item-btn ${G.coins >= next ? "" : "cant"}" data-gbuy="${it.id}">${next.toLocaleString()} 🎯</button>`
          : `<button class="item-btn owned" disabled>OWNED</button>`}
      </div>`;
    }).join("");
    const wraps = WRAPS.map(([hex, nm]) => `<button class="wrap-dot ${g2.wrap === hex ? "sel" : ""}" data-gwrap="${hex}" title="${nm}" style="background:${hex}"></button>`).join("");
    el.garageBody.innerHTML = `
      <p class="muted">Your winnings, your rig. Upgrades work everywhere; the wrap and boat name ride with you on the boards.</p>
      ${items}
      <h3 class="rec-h">🖌️ Paint Bench <small class="muted" style="font-weight:400">${G.customPaint ? "repaint free" : "15,000 🎯 once"} · your color on every lure</small></h3>
      <div class="paint-bench">
        <label class="pb-lab">Base<input type="color" id="paintHex" value="${(G.customPaint && G.customPaint.hex) || "#7a2ce8"}"></label>
        <input id="paintName" class="clog-sel" style="flex:1" maxlength="16" placeholder="NAME IT (BUBBA'S BLAZE…)"
          autocomplete="off" autocapitalize="characters" value="${dEsc((G.customPaint && G.customPaint.name) || "")}">
      </div>
      <div class="paint-bench" style="margin-top:6px">
        <button class="item-btn ${(!G.customPaint || G.customPaint.fam !== "bright") ? "owned" : ""}" data-pfam="natural" style="flex:1">🍃 Shows natural</button>
        <button class="item-btn ${(G.customPaint && G.customPaint.fam === "bright") ? "owned" : ""}" data-pfam="bright" style="flex:1">🔆 Runs loud</button>
      </div>
      <button class="big-btn" id="paintSave" style="margin-top:8px">🖌️ ${G.customPaint ? "REPAINT" : "MIX THE PAINT — 15,000 🎯"}</button>
      <h3 class="rec-h">🎨 Hull wrap <small class="muted" style="font-weight:400">8,000 🎯 each · boat name included</small></h3>
      <div class="wrap-row">${wraps}</div>
      <input id="boatName" class="clog-sel" style="width:100%;margin-top:8px" maxlength="14" placeholder="NAME YOUR BOAT (shows on the board)"
        autocomplete="off" autocapitalize="characters" value="${dEsc(g2.name || "")}" ${g2.wrap ? "" : "disabled"}>
      <button class="big-btn" id="boatNameSave" style="margin-top:8px" ${g2.wrap ? "" : "disabled"}>💾 SAVE THE RIG</button>`;
    el.garageModal.classList.remove("hidden");
  }
  el.garageBody.addEventListener("click", (e) => {
    const g2 = gar();
    const bb = e.target.closest("[data-gbuy]");
    if (bb) {
      const it = GARAGE_ITEMS.find(x => x.id === bb.dataset.gbuy);
      const lvl = g2[it.id] || 0, cost = it.tiers[lvl];
      if (cost == null) return;
      if (G.coins < cost) { toast("Not enough points yet — go fish! 🎣"); sfx("weak"); return; }
      G.coins -= cost; g2[it.id] = lvl + 1;
      save(); updateHUD(); sfx("good"); vibrate([20, 30, 20]);
      toast(`🚤 ${it.name} ${it.tiers.length > 1 ? "Lv " + g2[it.id] : ""} installed!`);
      openGarage();
      return;
    }
    const wb = e.target.closest("[data-gwrap]");
    if (wb) {
      const hex = wb.dataset.gwrap;
      if (g2.wrap === hex) return;
      if (!g2.paidWraps) g2.paidWraps = {};
      if (!g2.paidWraps[hex]) {
        if (G.coins < 8000) { toast("Wraps run 8,000 points 🎨"); sfx("weak"); return; }
        G.coins -= 8000; g2.paidWraps[hex] = 1;
      }
      g2.wrap = hex; save(); updateHUD(); sfx("good");
      openGarage();
      return;
    }
    const pf = e.target.closest("[data-pfam]");
    if (pf) { hostSel.pfam = pf.dataset.pfam; sfx("ui");
      document.querySelectorAll("[data-pfam]").forEach(x => x.classList.toggle("owned", x.dataset.pfam === pf.dataset.pfam));
      return; }
    if (e.target.closest("#paintSave")) {
      const hex = ((document.getElementById("paintHex") || {}).value || "").toLowerCase();
      const nm = (((document.getElementById("paintName") || {}).value) || "").trim().toUpperCase().slice(0, 16);
      if (!/^#[0-9a-f]{6}$/.test(hex)) { toast("Pick a color first 🎨"); return; }
      if (!nm) { toast("Give the paint a name 🖌️"); return; }
      if (!G.customPaint) {
        if (G.coins < 15000) { toast("The bench runs 15,000 points 🖌️"); sfx("weak"); return; }
        G.coins -= 15000;
      }
      const fam = hostSel.pfam || (G.customPaint && G.customPaint.fam) || "natural";
      G.customPaint = { hex, name: nm, fam };
      applyCustomPaint();
      save(); updateHUD(); sfx("weighwin"); vibrate([20, 30, 20]);
      toast(`🖌️ <b>${dEsc(nm)}</b> is on the bench — it's a color choice on every lure now!`);
      openGarage();
      return;
    }
    if (e.target.closest("#boatNameSave")) {
      const inp = document.getElementById("boatName");
      g2.name = ((inp && inp.value) || "").trim().toUpperCase().slice(0, 14);
      save(); sfx("good"); toast(g2.name ? `🚤 "${dEsc(g2.name)}" — she's ready` : "Boat name cleared");
      if (lbSubmitHook) lbSubmitHook(true);
      return;
    }
  });
  el.garageClose.addEventListener("click", () => { sfx("ui"); el.garageModal.classList.add("hidden"); });
  el.tsGarage.addEventListener("click", () => { sfx("ui"); openGarage(); });

  // --- 🔥 REACTIONS: tap a real angler's daily row, drop an emoji on it ---
  const REACTS = ["🔥", "🐟", "😂", "🤯"];
  async function fetchReacts(dk) {
    const base2 = LB.fb(); if (!base2) return {};
    try {
      const r = await fetch(base2 + "/react/" + dk + ".json");
      if (!r.ok) return {};
      const data = await r.json() || {};
      const out = {};   // pid -> {emoji: count}
      for (const pid in data) {
        const per = {};
        for (const who in data[pid]) { const e2 = data[pid][who] && data[pid][who].e; if (REACTS.includes(e2)) per[e2] = (per[e2] || 0) + 1; }
        out[pid] = per;
      }
      return out;
    } catch (e2) { return {}; }
  }
  const reactStr = per => per ? REACTS.filter(e2 => per[e2]).map(e2 => `${e2}${per[e2] > 1 ? per[e2] : ""}`).join(" ") : "";
  function sendReact(dk, targetPid, targetName, emoji) {
    const base2 = LB.fb(); if (!base2) return;
    fetch(base2 + "/react/" + dk + "/" + targetPid + "/" + LB.pid() + ".json",
      { method: "PUT", body: JSON.stringify({ e: emoji, n: G.name || "ANGLER", t: Date.now() }) }).catch(() => {});
    inboxWrite(targetName, { ty: "react", from: G.name || "ANGLER", e: emoji });
    toast(`${emoji} sent to ${dEsc(targetName)}`);
    sfx("good"); vibrate(15);
  }

  // --- 🔔 INBOX: callouts, verdicts, and reactions land here; the bell (and
  // the installed app icon) wear the unread count ---
  const inboxKeyFor = name => "n_" + (LB.nameKey(name).replace(/[^A-Z0-9]/g, "_") || "X");
  function inboxWrite(targetName, body) {
    const base2 = LB.fb(); if (!base2 || !targetName) return;
    if (LB.nameKey(targetName) === LB.nameKey(G.name)) return;   // don't notify yourself
    const id = (body.ty === "duel" || body.ty === "duelend" ? body.id : null) || ("m" + Math.random().toString(36).slice(2, 9));
    fetch(base2 + "/inbox/" + inboxKeyFor(targetName) + "/" + id + ".json",
      { method: "PUT", body: JSON.stringify(Object.assign({ t: Date.now() }, body)) }).catch(() => {});
  }
  let inboxCache = null, inboxAt = 0;
  async function fetchInbox(force) {
    const base2 = LB.fb(); if (!base2 || !G.name) return [];
    if (!force && inboxCache && Date.now() - inboxAt < 300000) return inboxCache;
    try {
      const r = await fetch(base2 + "/inbox/" + inboxKeyFor(G.name) + ".json");
      const data = r.ok ? (await r.json() || {}) : {};
      inboxCache = Object.entries(data).map(([id, v]) => (v && v.ty ? Object.assign({ id }, v) : null))
        .filter(Boolean).sort((a, b2) => (b2.t || 0) - (a.t || 0)).slice(0, 30);
      inboxAt = Date.now();
      return inboxCache;
    } catch (e2) { return inboxCache || []; }
  }
  function inboxLine(m) {
    const esc2 = s => dEsc(String(s || "").slice(0, 16));
    if (m.ty === "duel") return `🥊 <b>${esc2(m.from)}</b> called you out! Open their link to answer.`;
    if (m.ty === "duelend") return m.won ? `🏆 You beat <b>${esc2(m.vs)}</b> in the duel!` : `💢 <b>${esc2(m.vs)}</b> took the duel — rematch?`;
    if (m.ty === "react") return `${m.e || "🔥"} <b>${esc2(m.from)}</b> reacted to your daily bag`;
    return "";
  }
  function updateBell(list) {
    const unseen = (list || []).filter(m => !(G.inboxSeen || {})[m.id]);
    let n = unseen.length;
    if (G.dailyDone !== dayKey()) n += 1;   // the daily counts as one nudge
    const ct = document.getElementById("bellCt");
    if (ct) { ct.textContent = n || ""; ct.classList.toggle("hidden", !n); }
    try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e2) {}
  }
  async function openNotifs() {
    el.notifBody.innerHTML = `<p class="muted" style="text-align:center">Checking the mailbox…</p>`;
    el.notifModal.classList.remove("hidden");
    const list = await fetchInbox(true);
    const items = [];
    if (G.dailyDone !== dayKey()) items.push(`<div class="notif-row fresh">📅 Today's <b>daily tournament</b> is waiting — one entry, whole world's in.</div>`);
    for (const m of list) {
      const line = inboxLine(m); if (!line) continue;
      const fresh = !(G.inboxSeen || {})[m.id];
      items.push(`<div class="notif-row ${fresh ? "fresh" : ""}">${line}</div>`);
    }
    el.notifBody.innerHTML = items.length ? items.join("") : `<p class="muted" style="text-align:center">All quiet on the water 🌊</p>`;
    if (!G.inboxSeen) G.inboxSeen = {};
    for (const m of list) G.inboxSeen[m.id] = 1;
    const keys = Object.keys(G.inboxSeen); if (keys.length > 120) keys.slice(0, keys.length - 120).forEach(k => delete G.inboxSeen[k]);
    save();
    updateBell(list);
  }
  el.tsBell.addEventListener("click", () => { sfx("ui"); openNotifs(); });
  el.notifClose.addEventListener("click", () => el.notifModal.classList.add("hidden"));

  // --- 🏆 PRO SEASON: the six circuit events as a career arc — a fixed cast
  // of rivals with mouths on them, F1 points, sponsor deals, a champion.
  const PRO_RIVALS = [
    { name: "R. Vela",   tag: "The Hammer",    skill: 1.30, line: "Tell the kid the lake's mine after lunch." },
    { name: "K. Ash",    tag: "Ice Cold",      skill: 1.22, line: "I don't chase 'em. They come to me." },
    { name: "M. Boone",  tag: "Big Bag Boone", skill: 1.15, line: "Five fish. Twenty pounds. Every time." },
    { name: "T. Ito",    tag: "The Surgeon",   skill: 1.10, line: "Your spot? I finished with it an hour ago." },
    { name: "C. Rios",   tag: "Hot Streak",    skill: 1.02, line: "Somebody's gotta cash these checks." },
    { name: "B. Nash",   tag: "The Grinder",   skill: 0.95, line: "I'll out-cast you 'til dark, friend." },
    { name: "L. Okafor", tag: "Rookie Fire",   skill: 0.90, line: "New name, same leaderboard. Learn it." },
  ];
  const PRO_F1 = [25, 18, 15, 12, 10, 8, 6, 4];
  const SPONSORS = [
    { id: "lunk", ico: "🏆", name: "Lunker Deal",  desc: "Land 3 lunkers in season events", target: 3, key: "lunkers", pay: 30000 },
    { id: "wins", ico: "🥇", name: "Sweep Bonus",  desc: "Win 2 season events",             target: 2, key: "wins",    pay: 50000 },
    { id: "grind", ico: "⚖️", name: "Grind Deal",  desc: "Weigh 60 lb across the season",   target: 60, key: "bagLb",  pay: 25000 },
  ];
  const pro = () => G.pro;
  function proStart() {
    G.pro = { round: 0, pts: { ME: 0 }, lunkers: 0, wins: 0, bagLb: 0, paid: {}, done: false, titles: (G.pro && G.pro.titles) || 0 };
    PRO_RIVALS.forEach(rv => { G.pro.pts[rv.name] = 0; });
    save();
    openProSeason();
    toast("🏆 PRO SEASON — six events, seven mouths to shut. Lines in!");
  }
  function proStandings() {
    const P = pro(); if (!P) return [];
    return Object.entries(P.pts).map(([n, p]) => ({
      n: n === "ME" ? (G.name || "YOU") : n, me: n === "ME", pts: p,
      tag: n === "ME" ? "" : (PRO_RIVALS.find(r => r.name === n) || {}).tag || "",
    })).sort((a, b) => b.pts - a.pts);
  }
  function checkSponsors() {
    const P = pro(); if (!P) return;
    for (const sp2 of SPONSORS) {
      if (P.paid[sp2.id]) continue;
      if ((P[sp2.key] || 0) >= sp2.target) {
        P.paid[sp2.id] = 1; G.coins += sp2.pay;
        toast(`🤝 <b>${sp2.name}</b> pays out — <b>+${sp2.pay.toLocaleString()}</b> 🎯`);
        sfx("weighwin"); vibrate([30, 40, 30]);
      }
    }
  }
  function openProSeason() {
    const P = pro();
    if (!P) {
      el.proBody.innerHTML = `
        <div class="daily-card">
          <div class="d-title">🏆 PRO SEASON</div>
          <div class="d-sub">Six circuit events. Seven pros who talk too much. F1 points, sponsor money, one champion.</div>
          <button class="big-btn" id="proStart" style="margin-top:8px">🎬 START THE SEASON</button>
        </div>`;
      el.proModal.classList.remove("hidden");
      return;
    }
    const rows = proStandings();
    const board = rows.map((r2, i) =>
      `<div class="d-row ${r2.me ? "me real" : ""}"><span>${i + 1}. ${dEsc(r2.n)}${r2.me ? " ★" : ""}${r2.tag ? ` <small class="muted">“${r2.tag}”</small>` : ""}</span><span class="w">${r2.pts} pts</span></div>`).join("");
    const deals = SPONSORS.map(sp2 => {
      const prog = Math.min(P[sp2.key] || 0, sp2.target);
      return `<div class="d-row"><span>${sp2.ico} ${sp2.name} <small class="muted">${sp2.desc}</small></span><span class="w">${P.paid[sp2.id] ? "PAID ✓" : `${(+prog.toFixed(1))}/${sp2.target}`}</span></div>`;
    }).join("");
    let head;
    if (P.done) {
      const champ = rows[0];
      head = `<div class="daily-card">
        <div class="d-title">${champ.me ? "👑 SEASON CHAMPION!" : "🏁 SEASON OVER"}</div>
        <div class="d-sub">${champ.me ? `You took the title with <b>${champ.pts} pts</b>${P.champPaid ? "" : " — <b>+100,000</b> 🎯 champion's purse!"}` : `<b>${dEsc(champ.n)}</b> takes the title with ${champ.pts} pts. Unfinished business.`}</div>
        <button class="big-btn" id="proStart" style="margin-top:8px">🔄 RUN IT BACK — NEW SEASON</button>
      </div>`;
      if (champ.me && !P.champPaid) { P.champPaid = 1; P.titles = (P.titles || 0) + 1; G.coins += 100000; save(); updateHUD(); sfx("weighwin"); }
    } else {
      const t = TOURNAMENTS[P.round];
      const sp3 = SPOTS.find(s2 => s2.id === t.spot) || SPOTS[0];
      head = `<div class="daily-card">
        <div class="d-title">🏆 ROUND ${P.round + 1} of ${TOURNAMENTS.length}</div>
        <div class="d-sub"><b>${t.name}</b> · ${sp3.ico} ${sp3.name}</div>
        <div class="d-sub muted" style="font-size:11px">${t.blurb}</div>
        <button class="big-btn" id="proFish" style="margin-top:8px">🎣 FISH THE ROUND</button>
      </div>`;
    }
    el.proBody.innerHTML = head +
      `<h3 class="rec-h">📊 Season standings</h3><div class="d-list">${board}</div>
       <h3 class="rec-h">🤝 Sponsor deals</h3><div class="d-list">${deals}</div>`;
    el.proModal.classList.remove("hidden");
  }
  el.proBody.addEventListener("click", (e) => {
    if (e.target.closest("#proStart")) { sfx("good"); proStart(); return; }
    if (e.target.closest("#proFish")) {
      sfx("good");
      const P = pro(); if (!P || P.done) return;
      const t = TOURNAMENTS[P.round]; if (!t) return;
      el.proModal.classList.add("hidden");
      if (!el.titleScreen.classList.contains("hidden")) closeTitle(true);
      pendingTour = Object.assign({}, t, { pro: true });
      if (G.spot !== t.spot) { G.spot = t.spot; seedFish(); rollConditions(); }
      save(); updateHUD(); resetToIdle();
      refreshTourStart();
      el.tourStartModal.classList.remove("hidden");
      return;
    }
  });
  el.proClose.addEventListener("click", () => { sfx("ui"); el.proModal.classList.add("hidden"); });

  // --- 📼 REPLAYS: a submitted run's catch tape, played back as a live feed ---
  let rpTimer = null;
  function openReplay(name, rp) {
    if (rpTimer) { clearInterval(rpTimer); rpTimer = null; }
    const dur = 180;                                 // the run clock, in seconds
    const SPEED = dur / 6.5;                         // whole tape in ~6.5s
    el.replayName.textContent = `📼 ${name}'s run`;
    el.replayFeed.innerHTML = "";
    el.replayBar.style.width = "0%";
    el.replayClock.textContent = "0:00";
    el.replayModal.classList.remove("hidden");
    const tape = rp.slice().sort((a, b2) => a[0] - b2[0]);
    let clock = 0, idx = 0, bag = 0, count = 0;
    rpTimer = setInterval(() => {
      clock += SPEED * 0.1;
      if (clock >= dur) { clock = dur; clearInterval(rpTimer); rpTimer = null; }
      el.replayBar.style.width = (clock / dur * 100).toFixed(1) + "%";
      el.replayClock.textContent = `${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, "0")}`;
      while (idx < tape.length && tape[idx][0] <= clock) {
        const [t2, w] = tape[idx++];
        count++; bag += +w || 0;
        const big = w >= LUNKER_LB;
        const row = document.createElement("div");
        row.className = "notif-row" + (big ? " fresh" : "");
        row.innerHTML = `${big ? "🏆" : "🎣"} <b>${Math.floor(t2 / 60)}:${String(t2 % 60).padStart(2, "0")}</b> — ${(+w).toFixed(1)} lb${big ? " LUNKER!" : ""}`;
        el.replayFeed.appendChild(row);
        sfx(big ? "lunker" : "land"); vibrate(big ? [20, 30, 20] : 10);
      }
      if (!rpTimer) {
        const done = document.createElement("div");
        done.className = "notif-row";
        done.innerHTML = `🏁 Lines out — <b>${count}</b> bass · <b>${bag.toFixed(1)} lb</b>`;
        el.replayFeed.appendChild(done);
      }
    }, 100);
  }
  function replayClickHandler(e) {
    const rb = e.target.closest("[data-rplay]");
    if (rb && replayCache[rb.dataset.rplay]) {
      e.stopPropagation();
      sfx("ui");
      const c = replayCache[rb.dataset.rplay];
      openReplay(c.name, c.rp);
      return true;
    }
    return false;
  }
  el.replayClose.addEventListener("click", () => { if (rpTimer) { clearInterval(rpTimer); rpTimer = null; } el.replayModal.classList.add("hidden"); });
  el.hostBody.addEventListener("click", replayClickHandler);

  // --- ⚡ LIVE DUELS: RTDB streams the opponent's fish the moment they land —
  // EventSource speaks text/event-stream natively; polling stays as fallback
  function duelStream(T) {
    if (!window.EventSource || T._es || !T.custom || !LB.fb()) return;
    try {
      const es = new EventSource(LB.fb() + "/events/" + T.custom + "/res.json");
      const kick = () => { if (S.tournament === T && !T.ended) refreshDailyLive(T); };
      es.addEventListener("put", kick);
      es.addEventListener("patch", kick);
      es.onerror = () => { try { es.close(); } catch (e2) {} T._es = null; };
      T._es = es;
    } catch (e2) {}
  }
  function duelStreamStop(T) {
    if (T && T._es) { try { T._es.close(); } catch (e2) {} T._es = null; }
  }

  // --- 🧹 housekeeping: each phone quietly clears boards past ~35 days and
  // its own stale inbox — once per day, bounded, idempotent
  function pruneOldData() {
    const base2 = LB.fb(); if (!base2) return;
    const today = dayKey();
    if (G.pruneAt === today) return;
    G.pruneAt = today; save();
    for (let off = 35; off <= 40; off++) {
      const dk2 = dayKey(-off);
      for (const node of ["daily", "bigbass", "react"])
        fetch(`${base2}/${node}/${dk2}.json`, { method: "DELETE" }).catch(() => {});
    }
    fetchInbox(true).then(list => {
      const cut = Date.now() - 14 * 86400000;
      for (const m of list) if ((m.t || 0) < cut)
        fetch(`${base2}/inbox/${inboxKeyFor(G.name)}/${m.id}.json`, { method: "DELETE" }).catch(() => {});
    }).catch(() => {});
  }

  let dailyThen = null;   // where to go if the once-a-day prompt is waved off
  function openDailySheet(auto, then) {
    const dk = dayKey();
    if (auto) {
      if (G.dailyAsk === dk || G.dailyDone === dk || !LB.fb() || (S.tournament && !S.tournament.ended) ||
          (S.arcade && !S.arcade.ended) || G.pausedTour || G.pausedArcade) return false;
      G.dailyAsk = dk; save();
      dailyThen = then || null;
    } else dailyThen = null;
    renderDailySheet();
    el.dailyModal.classList.remove("hidden");
    return true;
  }
  const replayCache = {};
  function dRow(b, i, mode2, reacts, canReact) {
    const rs = reactStr(reacts && b.pid ? reacts[b.pid] : null);
    const tap = canReact && b.real && !b.me && b.pid ? ` data-rpid="${b.pid}" data-rname="${dEsc(b.name)}"` : "";
    let rpBtn = "";
    if (b.real && b.pid && b.rp && b.rp.length) {
      replayCache[b.pid] = { name: b.name, rp: b.rp };
      rpBtn = ` <button class="rp-btn" data-rplay="${b.pid}">▶</button>`;
    }
    return `<div class="d-row ${b.me ? "me" : ""} ${b.real ? "real" : ""}"${tap}><span>${i + 1}. ${dEsc(b.name)}${b.real ? " ★" : ""}${b.me ? " <small>(you)</small>" : ""}${rs ? ` <small class="rx">${rs}</small>` : ""}${rpBtn}</span><span class="w">${dailyLine(b, mode2)}</span></div>`;
  }
  function renderDailySheet() {
    const dk = dayKey(), rules = dailyRules(dk), md = rules.mode;
    const sp = SPOTS.find(s => s.id === rules.spot) || SPOTS[0];
    const fbOn = !!LB.fb();
    const done = G.dailyDone === dk;
    const hist = (G.dailyHist || {})[dk];
    el.dailyBody.innerHTML = `
      <div class="daily-card">
        <div class="d-title">${md.ico} ${md.name}</div>
        <div class="d-sub"><b>${sp.ico} ${sp.name}</b> · ⏱️ 3:00 on the clock</div>
        <div class="d-sub">${md.rule}</div>
        <div class="d-sub muted" style="font-size:11px">The whole world gets this same challenge — one entry per angler. New challenge at midnight UTC.</div>
        ${done
          ? `<div class="d-done">✅ You fished today${hist ? ` — <b>${["", "1st", "2nd", "3rd"][hist.p] || hist.p + "th"}</b> at weigh-in` : ""}. Come back tomorrow!</div>`
          : fbOn
            ? `<button class="big-btn" id="dailyEnter" style="margin-top:8px">🎣 ENTER TODAY&#39;S DAILY</button>`
            : `<div class="d-done" style="color:var(--muted,#9ab)">📡 Can&#39;t reach the live board — check your connection.</div>`}
        ${dailyThen ? `<button class="text-btn" id="dailyLater">Maybe later</button>` : ""}
      </div>
      <h3 class="rec-h">📊 Today so far <span style="font-weight:400;color:var(--gold)">★ gold = real anglers</span></h3>
      <div class="d-list" id="dailyToday"><p class="muted" style="text-align:center">Casting out to the board…</p></div>
      <h3 class="rec-h">🌙 Yesterday&#39;s weigh-in</h3>
      <div class="d-list" id="dailyYest"><p class="muted" style="text-align:center">…</p></div>
      <h3 class="rec-h">👑 Weekly Crew Championship <span class="muted" style="font-weight:400;font-size:10px">best 5 of 7 dailies · Mon–Sun</span></h3>
      <div class="d-list" id="dailyWeek"><p class="muted" style="text-align:center">…</p></div>`;
    if (!fbOn) {
      document.getElementById("dailyToday").innerHTML = document.getElementById("dailyYest").innerHTML =
        document.getElementById("dailyWeek").innerHTML =
        `<p class="muted" style="text-align:center">— offline —</p>`;
      return;
    }
    const fill = (dk2, boxId, mode2, empty) => {
      Promise.all([fetchDay(dk2), fetchReacts(dk2)]).then(([rows, rx]) => {
        const myPid = LB.pid();
        const canReact = dk2 === dk;   // you can only react to today's bags
        const list = rows.map(r => Object.assign({}, r, { me: r.pid === myPid }));
        const cpu = dailyCpuRows(dk2, Math.max(3, 10 - list.length));
        const board = dailySort(list.concat(cpu), mode2);
        const box = document.getElementById(boxId); if (!box) return;
        const mine = board.findIndex(bb => bb.me);
        let html = board.slice(0, 10).map((bb, i) => dRow(bb, i, mode2, rx, canReact)).join("");
        if (mine >= 10) html += dRow(board[mine], mine, mode2, rx, canReact);
        box.innerHTML = html || `<p class="muted" style="text-align:center">${empty}</p>`;
      }).catch(() => {
        const box = document.getElementById(boxId);
        if (box) box.innerHTML = `<p class="muted" style="text-align:center">Couldn&#39;t read the board 📡</p>`;
      });
    };
    fill(dk, "dailyToday", md.id, "Nobody&#39;s in yet — be the first!");
    const yk = dayKey(-1);
    fill(yk, "dailyYest", dailyRules(yk).mode.id, "No entries yesterday.");
    computeWeekChamp();
    weeklyStandings(false).then(rows => {
      const box = document.getElementById("dailyWeek"); if (!box) return;
      const myKey = LB.nameKey(G.name);
      const champ = G.weekChamp && G.weekChamp.disp ? `<div class="d-row" style="color:var(--gold)"><span>👑 Reigning champ: <b>${dEsc(G.weekChamp.disp)}</b></span><span class="w">last week</span></div>` : "";
      box.innerHTML = champ + (rows.length
        ? rows.slice(0, 5).map((r, i) => `<div class="d-row real ${LB.nameKey(r.name) === myKey ? "me" : ""}"><span>${i + 1}. ${dEsc(r.name)} ★</span><span class="w">${r.pts} pts · ${r.days} day${r.days === 1 ? "" : "s"}</span></div>`).join("")
        : `<p class="muted" style="text-align:center">No dailies fished this week yet — points start with today&#39;s!</p>`);
    }).catch(() => {
      const box = document.getElementById("dailyWeek");
      if (box) box.innerHTML = `<p class="muted" style="text-align:center">Couldn&#39;t read the week 📡</p>`;
    });
  }
  function chooseDaily() {
    if (S.tournament && !S.tournament.ended) { toast("Tournament in progress ⏱️"); return; }
    if (S.arcade && !S.arcade.ended) { toast("Arcade run in progress 🕹️"); return; }
    const dk = dayKey();
    if (G.dailyDone === dk) { toast("You&#39;ve fished today&#39;s daily — new one at midnight UTC 📅"); return; }
    const rules = dailyRules(dk), md = rules.mode;
    dailyThen = null;
    el.dailyModal.classList.add("hidden");
    if (!el.titleScreen.classList.contains("hidden")) closeTitle(true);
    if (S.tut) { S.tut = null; el.tutBanner.classList.add("hidden"); }
    pendingTour = { id: null, daily: dk, mode: md.id, spot: rules.spot, name: `Daily ${md.name}`, dur: DAILY_DUR, field: 10 };
    if (G.spot !== rules.spot) { G.spot = rules.spot; seedFish(); rollConditions(); }
    save(); updateHUD(); resetToIdle();
    refreshTourStart();
    el.tourStartModal.classList.remove("hidden");
  }
  el.tsDaily.addEventListener("click", () => { sfx("ui"); openDailySheet(false); });
  el.dailyClose.addEventListener("click", () => {
    sfx("ui"); el.dailyModal.classList.add("hidden");
    const f0 = dailyThen; dailyThen = null; if (f0) f0();
  });
  el.dailyBody.addEventListener("click", (e) => {
    if (replayClickHandler(e)) return;
    const rEm = e.target.closest("[data-remoji]");
    if (rEm) {
      const pick = rEm.closest(".rx-pick");
      sendReact(dayKey(), pick.dataset.rpid, pick.dataset.rname, rEm.dataset.remoji);
      pick.remove();
      return;
    }
    const rRow = e.target.closest("[data-rpid]");
    if (rRow && !rRow.classList.contains("rx-pick")) {
      document.querySelectorAll(".rx-pick").forEach(x => x.remove());
      const pick = document.createElement("div");
      pick.className = "rx-pick"; pick.dataset.rpid = rRow.dataset.rpid; pick.dataset.rname = rRow.dataset.rname;
      pick.innerHTML = REACTS.map(e2 => `<button data-remoji="${e2}">${e2}</button>`).join("");
      rRow.after(pick);
      sfx("ui");
      return;
    }
    if (e.target.closest("#dailyEnter")) {
      sfx("ui");
      const btn = document.getElementById("dailyEnter");
      if (btn) { btn.textContent = "🔒 CHECKING…"; btn.disabled = true; }
      pinFetch().then(h => { dailyPinHash = h; renderPinStep(!!h); })
        .catch(() => { dailyPinHash = null; renderPinStep(false); });
      return;
    }
    if (e.target.closest("#pinBack")) { sfx("ui"); renderDailySheet(); return; }
    if (e.target.closest("#pinGo")) {
      const inp = document.getElementById("pinInput");
      const pin = ((inp && inp.value) || "").trim();
      if (!/^\d{4}$/.test(pin)) { toast("PIN is 4 digits 🔢"); return; }
      pinHash(G.name || "ANGLER", pin).then(h => {
        const msg = document.getElementById("pinMsg");
        if (dailyPinHash) {
          if (h === dailyPinHash) { sfx("good"); chooseDaily(); }
          else {
            sfx("weak"); vibrate([40, 30, 40]);
            if (msg) msg.innerHTML = `❌ Wrong PIN for <b>${dEsc(G.name || "ANGLER")}</b> — try again`;
            if (inp) inp.value = "";
          }
        } else {
          fetch(pinUrl(), { method: "PUT", body: JSON.stringify({ h, t: Date.now() }) }).catch(() => {});
          toast("🔒 PIN set — same PIN every day, any phone");
          sfx("good"); chooseDaily();
        }
      });
      return;
    }
    if (e.target.closest("#dailyLater")) {
      sfx("ui"); el.dailyModal.classList.add("hidden");
      const f0 = dailyThen; dailyThen = null; if (f0) f0();
    }
  });

  // START walks the same angler → spot → rod → lure → size → color → line →
  // scent steps as free play; the clock only starts at 🏁 LINES IN!
  el.tourStartBtn.addEventListener("click", () => {
    if (!pendingTour) return;
    sfx("ui");
    el.tourStartModal.classList.add("hidden");
    S.prepTour = true;
    gotoPrep(1);
  });
  el.tourStartCancel.addEventListener("click", () => { pendingTour = null; el.tourStartModal.classList.add("hidden"); });
  el.tourQuit.addEventListener("click", () => {
    if (!S.tournament) return;
    if (S.tournament.ended) { closeTournament(); return; }   // result screen lost? End still gets you out
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
    if (S.bow && !anyModalOpen()) updateBowfish(dt);
    render(now);
    drive3D(dt, now);
    updateBoatHud(now);
    updateSegaHud();
    try { pollGamepad(dt); } catch (e) {}
    // ambient soundscape: wildlife calls, day/night water tone, wind on rough days
    const night = !!(dayColors(spot()).night);
    // occasional ambient wildlife call (birdsong by day, a loon at night)
    S._ambT = (S._ambT == null ? rnd(3000, 7000) : S._ambT - dt);
    if (S._ambT <= 0) { S._ambT = rnd(6000, 13000); try { Sound.ambientCall(night); } catch (e) {} }
    // shift the water bed darker & calmer at night, brighter by day (only on change)
    if (S._night !== night) { S._night = night; try { Sound.setNight(night); } catch (e) {} }
    // flavour the wildlife to the lake you're on (only on change)
    if (S._sndVenue !== G.spot) { S._sndVenue = G.spot; try { Sound.setVenue(G.spot); } catch (e) {} }
    // wind gusts pick up on cloudy / foggy water
    const wx = S.cond && S.cond.weather, windy = wx === "cloud" || wx === "fog" || wx === "rain";
    // a steady rain hiss fades in and out with the weather
    const raining = wx === "rain";
    if (S._raining !== raining) { S._raining = raining; try { Sound.setRain(raining); } catch (e) {} }
    if (windy) {
      S._windT = (S._windT == null ? rnd(4000, 9000) : S._windT - dt);
      if (S._windT <= 0) { S._windT = rnd(7000, 15000); try { Sound.windGust(wx === "fog" ? 0.45 : 0.7); } catch (e) {} }
    } else S._windT = null;
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

  // ---- Sega-style status overlay (LINE OUT / W.TEMP / TOTAL WEIGHT / TENSION / lure) ----
  let _sega = null;
  function updateSegaHud() {
    if (!_sega) _sega = {
      hud: $("segaHud"), lineOut: $("segaLineOut"), temp: $("segaTemp"),
      wlb: $("segaWeightLb"), woz: $("segaWeightOz"), cast: $("segaCast"), best: $("segaBest"),
      tension: $("segaTension"), tFill: $("segaTensionFill"),
      lure: $("segaLure"), lIco: $("segaLureIco"), lSw: $("segaLureSwatch"), lName: $("segaLureName"),
      left: $("segaHud").querySelector(".sega-left"), right: $("segaHud").querySelector(".sega-right"),
      menuHud: $("hud"), loadout: $("loadout"),
    };
    const e = _sega;
    const fishing = ["casting", "splashdown", "retrieve", "strike", "fight", "landing", "bowfish"].includes(S.mode);
    const show = fishing && !anyModalOpen();
    e.hud.classList.toggle("hidden", !show || S.mode === "bowfish");
    // hide the menu chrome while fishing so the Sega overlay owns the screen
    e.menuHud.classList.toggle("fishing-off", show);
    e.loadout.classList.toggle("fishing-off", show);
    if (el.guideBtn) el.guideBtn.classList.toggle("fishing-off", show);
    if (!show) return;
    // in a tournament the tour HUD already shows the clock + weight at the top,
    // so suppress the Sega top blocks to avoid overlapping it
    const inTour = !!(S.tournament && !S.tournament.ended);
    // a live run bar (tournament OR arcade) sits at the lure-preview's height —
    // shift the preview below it while the bar is up
    const runOn = inTour || !!(S.arcade && !S.arcade.ended);
    document.getElementById("game").classList.toggle("run-on", runOn);
    e.left.classList.toggle("hidden", inTour);
    e.right.classList.toggle("hidden", inTour);
    const lu = lure(), ft = S.castFt || 60;
    const dist = S.mode === "fight" ? (S.ft ? S.ft.dist : 0) : (S.rv ? S.rv.dist : 0);
    e.lineOut.textContent = Math.round(dist * ft);
    e.temp.textContent = (+((S.cond && S.cond.temp != null) ? S.cond.temp : 68)).toFixed(1);
    // TOTAL WEIGHT = your live 5-fish bag (tournament livewell, or the free-play
    // session livewell — the 5 biggest bass you've boated this session)
    let lb = S.tournament ? wellTotal() : bagTotal();
    const whole = Math.floor(lb), oz = Math.round((lb - whole) * 16);
    e.wlb.textContent = whole; e.woz.textContent = String(Math.min(15, oz)).padStart(2, "0");
    // personal-best livewell under the total (free play only)
    if (e.best) {
      if (!S.tournament && (G.bestBag || 0) > 0) { e.best.textContent = `BEST ${(G.bestBag).toFixed(1)} lb`; e.best.classList.remove("hidden"); }
      else e.best.classList.add("hidden");
    }
    const showCast = S.mode === "casting" || S.mode === "splashdown";
    e.cast.classList.toggle("hidden", !showCast);
    if (showCast) e.cast.innerHTML = (S.castFt || 0) + "<small>ft</small>";
    const inFight = S.mode === "fight" && S.ft;
    e.tension.classList.toggle("hidden", !inFight);
    if (inFight) e.tFill.style.height = Math.round(S.ft.tension * 100) + "%";
    e.lure.classList.remove("hidden");
    e.lIco.textContent = lu.ico; e.lSw.style.background = COLORS[G.lure.color].hex; e.lName.textContent = lu.name;
  }

  function drawSonar(now) {
    const cv = document.getElementById("sonar"), g = cv.getContext("2d");
    const W2 = cv.width, H2 = cv.height;
    const lu = lure(), sc = lureScore(lu).score, face = facingQuality();
    const quality = clamp(sc * (0.4 + 0.6 * face), 0, 1);     // right lure + facing the fish
    document.getElementById("sonarQ").textContent =
      (quality > 0.66 ? "● STACKED" : quality > 0.33 ? "● MARKS" : "○ SCATTERED") + (garageSonar() ? " · PRO" : "");
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
    // the shoal HOLDING here — anchored at the bite depth (not scrolling past), so
    // the finder reads as real returns for THIS spot + position. Count reflects how
    // many stack here, arch size reflects the fish size, depth = where they hold.
    const sp = spot(), pos = position();
    const ents = sp.fish.map(e => ({ def: F[e.k], w: e.weight * ((pos.bias && pos.bias[e.k]) || 1) }));
    const totW = ents.reduce((s, e) => s + e.w, 0) || 1;
    const avgLb = ents.reduce((s, e) => s + e.w * ((e.def.w[0] + e.def.w[1]) / 2), 0) / totW;
    if (garageSonar()) { const q2 = document.getElementById("sonarQ"); if (q2 && !q2.textContent.includes("lb")) q2.textContent += ` · ~${avgLb.toFixed(1)} lb class`; }
    const pr = (seed) => { const x = Math.sin(seed * 127.1 + (sp.id.length + pos.id.length) * 91.7) * 43758.5453; return x - Math.floor(x); };
    // abundance: how concentrated this position is (its bias) + how lit-up the bite is
    const rich = clamp((((pos.bias && pos.bias.largemouth) || 1) + ((pos.bias && pos.bias.giant) || 0.6) + ((pos.bias && pos.bias.hawg) || 0.3)) / 3 - 0.5, 0, 1.4);
    const count = Math.max(2, Math.round(3 + rich * 4 + quality * 4));    // ~3..11 marks
    for (let i = 0; i < count; i++) {
      let rr = pr(i + 1) * totW, em = ents[0];
      for (const e of ents) { rr -= e.w; if (rr <= 0) { em = e; break; } }
      const big = !!em.def.big;
      const lb = (em.def.w[0] + em.def.w[1]) / 2 * (0.72 + pr(i + 9) * 0.55);
      const rad = clamp(2.4 + lb * 0.42, 2.4, Math.min(12, W2 * 0.13));
      const fx = 13 + pr(i + 3) * (W2 - 26);                              // fixed spot, gentle in-place bob
      const fy = clamp(band * H2 + (pr(i + 5) - 0.5) * (win * H2 * 1.7) + Math.sin(now / 700 + i * 1.3) * 2.4, 7, H2 - 22);
      const a = 0.34 + quality * 0.5 + (big ? 0.16 : 0);
      g.strokeStyle = big ? `rgba(255,206,110,${a + 0.1})` : quality > 0.5 ? `rgba(120,240,150,${a})` : `rgba(180,225,165,${a})`;
      g.lineWidth = big ? 2.4 : 1.5;
      g.beginPath(); g.arc(fx, fy, rad, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      if (big) { g.beginPath(); g.arc(fx, fy, rad * 0.6, Math.PI * 1.04, Math.PI * 1.96); g.stroke(); }
    }
    // holding-depth marker right on the band
    const holdFt = Math.round(band * 24);
    g.fillStyle = quality > 0.5 ? "#9dffbb" : "#ffe08a"; g.textAlign = "left"; g.font = "bold 11px system-ui";
    g.fillText("▶ " + holdFt + " ft", 5, clamp(band * H2 + 4, 13, H2 - 28));
    // depth ticks (right)
    g.fillStyle = "rgba(200,225,235,.6)"; g.font = "8px system-ui"; g.textAlign = "right";
    for (let d = 0; d <= 1.001; d += 0.5) g.fillText(Math.round(d * 24) + "ft", W2 - 3, clamp(d * H2, 8, H2 - 22));
    // specifics strip — the concrete read for THIS spot: how many, how deep, how
    // big, and (by colour) how active. Changes the moment you switch positions.
    const sizeWord = avgLb >= 9 ? "BIG" : avgLb >= 5 ? "QUALITY" : "SMALL";
    const act = (S.cond.activity != null ? S.cond.activity : 0.5);
    const actCol = act > 0.62 ? "#5be37a" : act > 0.4 ? "#ffd35c" : "#ff9b6b";
    g.fillStyle = "rgba(2,12,18,.82)"; g.fillRect(0, H2 - 17, W2, 17);
    g.fillStyle = actCol; g.fillRect(4, H2 - 13, 8, 8);                  // activity swatch
    g.textAlign = "left"; g.font = "bold 9px system-ui"; g.fillStyle = "#dff0f7";
    g.fillText(`${count} FISH · ${holdFt}FT · ${sizeWord}`, 16, H2 - 5);
  }

  // ---- 3D underwater layer (Three.js). The 2D scene above keeps rendering as
  // a fallback; if WebGL is unavailable Scene3D never goes ready and we no-op.
  let _3dInit = false, _3dVenue = "";
  function drive3D(dt, now) {
    const S3 = window.Scene3D;
    if (!S3) return;
    if (S.bow) { if (S3.isReady && S3.isReady()) S3.setVisible(false); return; }   // the river run is its own 2D scene
    if (!_3dInit) {
      _3dInit = true;
      try { S3.init(document.getElementById("c3d")); } catch (e) {}
    }
    if (!S3.isReady()) return;
    S3.setVisible(true);   // 3D now drives both surface & underwater; 2D stays as fallback beneath
    const sp = spot(), lu = lure(), dc = dayColors(sp), pos = position();
    if (_3dVenue !== sp.id) { _3dVenue = sp.id; S3.setVenue(sp.water[0], sp.water[1], sp.clarity, sp.struct3d || sp.id); }
    // typical fish SIZE and ABUNDANCE at this spot, so the underwater shoal reflects
    // it: big-fish spots show big bass, a good combo/spot shows more of them
    let sBig = 0, sTot = 0;
    for (const e of sp.fish) {
      const def = F[e.k], b = (pos.bias && pos.bias[e.k]) || 1, w = e.weight * b;
      sBig += w * (def.w[0] + def.w[1]) / 2; sTot += w;
    }
    const avgLb = sTot ? sBig / sTot : 4;
    const fishSize = clamp((avgLb - 2) / 12, 0.12, 1);          // ~2..14 lb -> 0.12..1
    const fishDensity = clamp(0.18 + lureScore(lu).score * 0.82, 0.1, 1);
    const band = S.cond.band, win = S.cond.window || 0.085;
    const lureDepth = S.mode === "fight" ? (S.bobberDepth != null ? S.bobberDepth : band) : S.rv.depth;
    const st = {
      view: S.view, mode: S.mode, band, win,
      lureDepth, lureDist: S.rv.dist, lureHex: COLORS[G.lure.color].hex, lureStyle: lu.style,
      lureId: lu.viz || lu.id, lurePhys: S.rv.phys || (lu.style === "top" ? "float" : lu.id === "crank" ? "dive" : "sink"),
      lureAction: S.rv.action || 0,
      inZone: Math.abs(lureDepth - band) < win,
      interest: S.rv.interest, fishSize, fishDensity,
      ambush: S.rv.ambush ? { prog: clamp((S.rv.ambush.t || 0) / 540, 0, 1), from: S.rv.ambush.from } : null,
      daylight: dc.daylight, night: dc.night, sunX: dc.sunX, elev: dc.elev, moon: ((S.cond.moon || 0) % 8 + 8) % 8,
      skyTop: dc.top, skyBot: dc.bot, water0: sp.water[0],
      castAim: S.castAim ? { x: S.castAim.x, y: S.castAim.y } : null,
      castProgress: S.bobber.flyT || 0,
      heading: S.heading, holdBearing: S.holdBearing, facing: facingQuality(), steer: S.steer,
      structure: STRUCT_GROUP[position().id] || "open", venue: sp.id, weather: S.cond.weather, season: S.cond.season,
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
    else if (S.arcade && !S.arcade.ended) updateArcadeClock(dt);
    else tickClock(dt);                            // the day is always moving in free play
    if (S.tut) updateTutorial();
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
      if (p >= 1) { S.bobber.y = S.bobber.targetY; S.mode = "splashdown"; S.splashT = 0; sfx("splash"); }
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
      S.strikeT = (S.strikeT || 0) + dt;
      const holding = S.hook && S.hook.hold > 0;     // slow-mo zoom beat before the meter goes live
      if (holding) {
        S.hook.hold -= dt;
        S.hook.marker = 0.5;                          // parked dead-centre during the punch-in
        if (el.hmMarker) el.hmMarker.style.left = "50%";
      } else {
        S.strikeWindow -= dt;                         // clock only runs once the marker starts sweeping
        // sweep the hookset marker back and forth; the centre is the sweet spot
        if (S.hook) {
          S.hook.phase += dt * (S.hook.speed || 0.009);
          S.hook.marker = 0.5 + 0.5 * Math.sin(S.hook.phase);
          if (el.hmMarker) el.hmMarker.style.left = (S.hook.marker * 100) + "%";
        }
        if (S.strikeWindow <= 0) strikeMissed();
      }
      S.bobber.y += Math.sin(now / 60) * 1.4;
      if (Math.random() < 0.3) ripple(S.bobber.x, S.bobber.y);
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
    // the lure is always being worked back toward the boat (so it visibly tracks
    // right-to-left across the screen); holding the reel brings it in faster
    R.dist = clamp(R.dist - 0.0009 * step, 0, 1);
    if (S.holding) {
      R.dist = clamp(R.dist - 0.0016 * step * (1 + rod().power * 0.10), 0, 1);
      if (phys === "dive") R.depth = clamp(R.depth + 0.0052 * step, 0, lu.band);
      else if (phys === "sink") R.depth = clamp(R.depth - 0.0040 * step, 0, 1);
    } else {
      if (phys === "sink") R.depth = clamp(R.depth + 0.0030 * step, 0, 1);   // gravity: a paused sinker falls all the way to the bottom
      else if (phys === "dive") R.depth = clamp(R.depth - 0.0040 * step, 0, lu.band);
      else R.depth = lu.band;   // topwater rides the surface
    }
    S.rv.phys = phys;

    // strategic suitability (the bite rating) × live skill (working it at the right depth)
    const sc = lureScore(lu).score;
    const depthNow = clamp(1 - Math.abs(R.depth - S.cond.band) / ((S.cond.window || 0.09) * 3), 0, 1);
    const struct = 0.8 + (S.castAccuracy != null ? S.castAccuracy : 0.5) * 0.5;   // pitched tight to cover = more bites
    const aimed = 0.55 + 0.45 * (S.castFacing != null ? S.castFacing : 1);   // faced the fish when you cast?
    const hot = lu.id === S.cond.hotLure ? 1.45 : 1;                          // matched the day's pattern
    const szBite = (SIZES[G.lure.size] || SIZES.med).bite;   // finesse = more bites, magnum = fewer
    const sFit = seasonFit();                                 // fishing the season's pattern?
    const lineMul = lineBiteMul() * (0.94 + line().sens * 0.06);   // line stealth vs clarity (+ topwater, feel)
    const build = (R.action > 0.55 ? 1 : 0.3) * (0.25 + sc) * depthNow * struct * aimed * (S.castLuck || 1) * hot * szBite * sFit * lineMul
      * anglerBiteMul()      // fish sense finds bites anywhere; finesse pays on light presentations
      * (S.tut ? 1.6 : 1);   // tutorial fish are eager — the lesson shouldn't drag
    R.interest = clamp(R.interest + (build * 0.012 - 0.0016) * step, 0, 1);
    R.follower = R.interest;

    // big-fish credit: trophies are FAR fussier than dinks. It builds only while
    // the lure is dialed in — right bait (sc), in the bite zone (depthNow), with
    // proper action — and drains whenever the presentation slips. pickFish() reads
    // this to decide how big a fish commits, so a sloppy retrieve gets only dinks.
    // on-pattern structure also gets you a shot at the bigger, better-positioned fish
    const instQ = clamp(sc * depthNow * (R.action > 0.55 ? 1 : 0.4) * (hot > 1 ? 1.12 : 1) * (0.7 + sFit * 0.3), 0, 1);
    R.bigCred = clamp(R.bigCred + (instQ - 0.5) * 0.02 * step, 0, 1);

    // ambush strike — a hidden bass explodes from cover at a random moment. Far
    // likelier on/near structure; once triggered it rushes the lure to a strike.
    const grp = STRUCT_GROUP[position().id] || "open";
    if (!R.ambush && R.interest < 0.72 && R.dist > 0.12 && R.dist < 0.9) {
      const rate = (grp === "open" || grp === "deep" ? 0.0003 : 0.0009) * (0.45 + sc) * sFit;
      if (Math.random() < rate * step) {
        R.ambush = { t: 0, from: grp === "rock" || grp === "deep" ? 1 : grp === "wood" || grp === "veg" ? 2 : Math.floor(Math.random() * 3) };
        vibrate(18);
      }
    }
    if (R.ambush) R.interest = Math.max(R.interest, Math.min(1, (R.ambush.t += dt) / 540));   // the rush drives it to a strike

    if (R.interest >= 1) { strike(); return; }
    if (R.dist <= 0) { endRetrieveMiss(); return; }

    el.rvDepth.textContent = Math.round(R.depth * 24) + " ft";
    el.rvLine.textContent = Math.round(R.dist * (S.castFt || 60)) + " ft";
    el.rvAction.style.width = (R.action * 100) + "%";
    el.rvInterest.style.width = (R.interest * 100) + "%";
    const band = S.cond.band, winH = S.cond.window || 0.1;
    let hint;
    if (lu.style === "top") {
      if (band > 0.24) hint = "Fish are holding deep — try a sinking lure";
      else hint = R.action > 0.6 ? "Perfect action — a bass is closing in!" : "Working the surface — keep twitching!";
    } else if (phys === "dive" && band > lu.band + winH) hint = "They're deeper than this crank dives — tie on a sinking lure";
    else if (R.depth < band - winH) hint = phys === "dive" ? "Keep winding — dig it down to them…" : "Ease off the reel — let it sink to the zone…";
    else if (R.depth > band + winH) hint = "Too deep — reel it up";
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
        if (!tired && r < 0.3) { T.state = "jump"; T.stateT = rnd(450, 800); T.jumps = (T.jumps || 0) + 1; sfx("jump"); vibrate(20); }
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
    const rodTol = (1 + (rod().power - 1) * 0.55) * line().tol;   // stronger line resists the snap

    if (S.holding) {
      T.tension += dt * (0.00050 + pull * 0.00150) / (rodTol * (1 + skill("power") * 0.35)) * garageNet();
      T.dist = clamp(T.dist - dt * 0.00017 * (1.25 - pull * 0.6), 0, 1);
      T.stamina = clamp(T.stamina - dt * (0.00006 + (T.state === "tire" ? 0.00019 : 0.00004)) * (1 + skill("power") * 0.25), 0, 1);
    } else {
      T.tension -= dt * 0.0016;
      if (T.state === "run") T.dist = clamp(T.dist + dt * 0.00010, 0, 1);
      T.stamina = clamp(T.stamina - dt * 0.00003, 0, 1);
    }
    T.tension = clamp(T.tension, 0, 1);
    // a big bass surging and peeling line: the drag screams + the rod buzzes in
    // your hand (re-triggered while it runs — not a steady click loop)
    const takingLine = T.state === "run" && T.size > 0.45 && (!S.holding || T.pull > 0.85);
    if (takingLine) {
      T._dragT = (T._dragT || 0) - dt;
      if (T._dragT <= 0) { sfx("drag"); vibrate(70); T._dragT = 430; }
    } else T._dragT = 0;
    if (T.state === "jump" && Math.random() < 0.06) splash(S.bobber.x, waterLine());

    // --- the cover is now a real hazard ---
    const hasCover = (STRUCT_GROUP[position().id] || "open") !== "open";
    const bigFish = T.size > 0.45;
    // a big bass bolts for the cover on its runs: horsing it (holding) drives it
    // INTO the structure; giving line turns it out. Wrap up and you're broken off.
    if (T.state === "run" && bigFish && hasCover) {
      // a powerful rod muscles the fish out of cover; a finesse stick gets wrapped
      if (S.holding) T.cover = clamp((T.cover || 0) + dt * 0.00072 * (0.55 + T.size) * (1.25 - rod().cover * 0.85) / line().cover, 0, 1);
      else T.cover = clamp((T.cover || 0) - dt * 0.0013, 0, 1);
      if ((T.cover || 0) > 0.5 && !T._coverBuzz) { vibrate(45); T._coverBuzz = 1; }
      if ((T.cover || 0) < 0.3) T._coverBuzz = 0;
      if ((T.cover || 0) >= 1) { loseFish("It wrapped you in the cover!"); return; }
    } else { T.cover = clamp((T.cover || 0) - dt * 0.0018, 0, 1); T._coverBuzz = 0; }
    // a jumping bass throws the hook if you hold it tight — you have to give slack
    if (T.state === "jump" && S.holding && T.tension > 0.55) {
      if (Math.random() < dt * 0.00075 * (0.5 + T.size)) { loseFish("It threw the hook on the jump!"); return; }
    }

    if (T.tension >= 1) { loseFish("The line snapped!"); return; }
    if (T.dist <= 0 && T.stamina < 0.25) { landFish(); return; }
    if (T.dist <= 0 && T.stamina >= 0.25) { T.dist = 0.04; T.state = "run"; T.stateT = rnd(450, 900); }

    el.ftStamina.style.width = (T.stamina * 100) + "%";
    el.ftTension.style.width = (T.tension * 100) + "%";
    el.ftDist.style.width = ((1 - T.dist) * 100) + "%";
    el.ftFishMark.style.left = ((1 - T.dist) * 100) + "%";
    el.ftLine.textContent = Math.round(T.dist * (S.castFt || 60)) + " ft";
    // cover-risk meter — only while a big bass is boring into the structure
    const coverShown = (T.cover || 0) > 0.04;
    el.ftCoverRow.classList.toggle("hidden", !coverShown);
    if (coverShown) el.ftCover.style.width = (T.cover * 100) + "%";
    // contextual coaching: jump → give slack, run-into-cover → give line, else reel
    let hint, warn = true;
    if (T.state === "jump") hint = "🐟 JUMPING — give slack!";
    else if (T.state === "run" && bigFish && hasCover && (T.cover || 0) > 0.12) hint = "⚠️ Diving for cover — GIVE LINE!";
    else if (T.tension > 0.78) hint = "EASE OFF — about to snap!";
    else if (T.state === "run") hint = "It's running — give it line!";
    else { hint = "Tired — reel it in!"; warn = false; }
    el.ftHint.textContent = hint;
    el.ftHint.className = "phase-hint" + (warn ? " warn" : " good");
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
    if (S.bow) { renderBowfish(now); return; }
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
      drawLure(S.bobber.x, S.bobber.y, lure().viz || G.lure.id, COLORS[G.lure.color].hex, now / 90, 0.7, -1);
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
      drawLure(lureX, lureY, lure().viz || G.lure.id, COLORS[G.lure.color].hex, now / (lure().cadence === "fast" ? 70 : lure().cadence === "slow" ? 150 : 100), 1, -1);
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
      drawLure(fx + dir * len * 0.52, fy + len * 0.05, lure().viz || G.lure.id, COLORS[G.lure.color].hex, now / 120, 0.55, dir);
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
    if (!S.tournament && S.hookedFish) floatText("+" + (S.hookedFish.score || S.hookedFish.value) + " pts", "#ffd35c");
    resetToIdle();
  });
  el.failOk.addEventListener("click", () => { el.failModal.classList.add("hidden"); resetToIdle(); });

  // ===========================================================================
  // Lure tray
  // ===========================================================================
  // wizard steps 4..8 stage the tackle box one option category at a time
  const LURE_STEPS = {
    5: { seg: "lure",  ico: "🪱", name: "Pick your lure",  back: "◂ ROD",   next: "NEXT — SIZE ▸" },
    6: { seg: "size",  ico: "📏", name: "Lure size",       back: "◂ LURE",  next: "NEXT — COLOR ▸" },
    7: { seg: "color", ico: "🎨", name: "Color",           back: "◂ SIZE",  next: "NEXT — LINE ▸" },
    8: { seg: "line",  ico: "🧵", name: "Line",            back: "◂ COLOR", next: "NEXT — SCENT ▸" },
    9: { seg: "scent", ico: "🧪", name: "Scent / flavor",  back: "◂ LINE",  next: null },
  };
  function openLures() {
    renderLures();
    const st = LURE_STEPS[S.prep] || null;
    const seg = st && st.seg;
    const show = (elm, on) => elm && elm.classList.toggle("hidden", !on);
    show(document.getElementById("tbTabsLure"), !seg);
    show(el.lureList, !seg || seg === "lure");
    el.lureCats.classList.add("hidden");
    show(document.getElementById("sizeHead"), !seg || seg === "size");
    show(el.sizeRow, !seg || seg === "size");
    show(document.getElementById("colorHead"), !seg || seg === "color");
    show(el.colorRow, !seg || seg === "color");
    show(document.getElementById("lineHead"), !seg || seg === "line");
    show(el.lineRow, !seg || seg === "line");
    show(el.lineCats, !seg || seg === "line");
    show(document.getElementById("scentHead"), !seg || seg === "scent");
    show(document.getElementById("scentRow"), !seg || seg === "scent");
    el.lureTitle.textContent = st ? `${st.ico} ${prepNum(S.prep)} — ${st.name}` : "🧰 Tackle Box";
    show(el.lureBack, !!st); show(el.lureFish, !!st);
    if (st) {
      el.lureBack.textContent = st.back;
      el.lureFish.textContent = st.next || (S.prepTour ? "🏁 LINES IN!" : "🎣 GO FISH!");
    }
    el.lureModal.classList.remove("hidden");
  }
  function ratingColor(p) { return p >= 75 ? "#5be37a" : p >= 50 ? "#ffd35c" : p >= 30 ? "#ff9d3d" : "#ff5d5d"; }
  function starStr(n) { return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
  function renderLures() {
    const c = S.cond, w = WEATHER[c.weather], band = c.band;
    const zone = band < 0.34 ? "shallow" : band < 0.67 ? "mid-depth" : "deep";
    el.lureCond.innerHTML = `${(SEASONS[c.season] || SEASONS.summer).ico} ${(SEASONS[c.season] || SEASONS.summer).name} · ${w.ico} ${w.name} · ${c.temp}° · ${moonNow().ico} ${moonNow().name} · ${fmtClock(c.timeMin)} · bass holding <b>${zone}</b> (~${Math.round(band * 24)}ft)`;
    // rate every lure for right now, best first
    const rated = LURES.map(l => ({ l, r: lureScore(l) }))
      .sort((a, b) => b.r.score - a.r.score);
    el.lureList.innerHTML = rated.map(({ l, r }) => {
      const sel = G.lure.id === l.id;
      const tag = sel ? "✓ ON" : "TAP";
      // the highlighted lure expands with its full category breakdown right here
      const detail = sel ? `<div class="opt-detail">${catBars(r.cats)}<div class="cats-tip">${r.tip}</div></div>` : "";
      return `<div class="lure-opt ${sel ? "sel" : ""}" data-lure="${l.id}">
        <div class="ico">${l.ico}</div>
        <div class="info">
          <div class="nm">${l.name} <span class="stars" style="color:${ratingColor(r.pct)}">${starStr(r.stars)}</span></div>
          <div class="rate"><div class="rate-bar"><i style="width:${r.pct}%;background:${ratingColor(r.pct)}"></i></div><b style="color:${ratingColor(r.pct)}">${r.pct}</b></div>
          ${sel ? "" : `<div class="ds">${r.tip}</div>`}
        </div>
        <div class="tag">${tag}</div></div>` + detail;
    }).join("");
    renderSizes();
    renderLine();
    renderColors();
  }
  function renderLine() {
    el.lineRow.innerHTML = LINE_ORDER.map(k => {
      const L = LINES[k], sel = (G.line || "mono") === k, fit = lineFit(k);
      return `<div class="size-opt ${sel ? "sel" : ""}" data-line="${k}">
        <span class="scent-ico">${L.ico}</span><b>${L.name}</b><i style="color:${ratingColor(fit)}">${fit}%</i></div>`;
    }).join("");
    const L = line();
    el.lineCats.innerHTML = `<div class="cats-head">Line — ${L.ico} ${L.name}</div>` +
      catBars(L.cats.map(([label, pct]) => ({ label, pct })));
  }
  // a row of mini category bars (shared by lure + rod breakdowns)
  function catBars(cats) {
    return `<div class="cats">` + cats.map(c =>
      `<div class="cat"><span>${c.label}</span><div class="cat-bar"><i style="width:${c.pct}%;background:${ratingColor(c.pct)}"></i></div><b style="color:${ratingColor(c.pct)}">${c.pct}</b></div>`
    ).join("") + `</div>`;
  }
  function renderSizes() {
    el.sizeRow.innerHTML = SIZE_ORDER.map(k => {
      const s = SIZES[k], sel = (G.lure.size || "med") === k;
      const r = lureScore(lure(), null, k).pct;
      return `<div class="size-opt ${sel ? "sel" : ""}" data-size="${k}">
        <span class="scent-ico">${s.ico}</span><b>${s.name}</b><i style="color:${ratingColor(r)}">${r}%</i></div>`;
    }).join("");
  }
  function renderColors() {
    const l = lure();
    const list = COLORS.custom ? l.colors.concat("custom") : l.colors;
    el.colorRow.innerHTML = list.map(c => {
      const col = COLORS[c];
      const sel = G.lure.color === c;
      const good = col.fam === preferredFam();
      const r = lureScore(l, c).pct;
      // no color name (they overflow the swatch) — just the bite rating + a star
      // when the colour matches the day's pattern. The swatch shows the colour.
      return `<div class="color-dot ${sel ? "sel" : ""}" data-color="${c}" title="${col.name}" style="background:${col.hex}">
        <small>${good ? "⭐" : ""}${r}</small></div>`;
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
  // closing any tackle picker mid tournament-prep hops back to the start sheet
  function tackleClosed() {
    if (pendingTour && !(S.tournament && !S.tournament.ended)) { refreshTourStart(); el.tourStartModal.classList.remove("hidden"); }
  }
  el.lureChip.addEventListener("click", openLures);
  el.lureClose.addEventListener("click", () => {
    el.lureModal.classList.add("hidden");
    if (S.prep) { exitPrep(); return; }
    tackleClosed();
  });
  el.lureFish.addEventListener("click", () => {
    if (S.prep >= 5 && S.prep < 9) { sfx("ui"); gotoPrep(S.prep + 1); return; }
    sfx("cast");
    if (S.prepTour) finishTourPrep(); else finishPrep();
  });
  el.lureBack.addEventListener("click", () => { sfx("ui"); gotoPrep(S.prep - 1); });
  el.lureModal.addEventListener("click", (e) => {
    const opt = e.target.closest(".lure-opt");
    const dot = e.target.closest(".color-dot");
    if (opt) {
      G.lure.id = opt.dataset.lure;
      const l = lure();
      if (!l.colors.includes(G.lure.color)) G.lure.color = l.colors[0];
      save(); updateHUD(); renderLures();
    } else if (dot) {
      G.lure.color = dot.dataset.color; save(); updateHUD(); renderLures();
    } else {
      const szEl = e.target.closest(".size-opt");
      const sc = e.target.closest(".scent-opt");
      if (szEl && szEl.dataset.line) { G.line = szEl.dataset.line; save(); updateHUD(); renderLures(); }
      else if (szEl && szEl.dataset.size) { G.lure.size = szEl.dataset.size; save(); updateHUD(); renderLures(); }
      else if (sc) { G.attractant = sc.dataset.scent; save(); updateHUD(); renderLures(); }
    }
  });

  // ---- Rod picker ----
  function openRods() {
    renderRods();
    const prep = S.prep === 4;
    el.rodTitle.textContent = prep ? `🎣 ${prepNum(4)} — Pick your rod` : "🧰 Tackle Box";
    const tabs = document.getElementById("tbTabsRod");
    if (tabs) tabs.classList.toggle("hidden", prep);
    el.rodBack.classList.toggle("hidden", !prep);
    el.rodNext.classList.toggle("hidden", !prep);
    el.rodModal.classList.remove("hidden");
  }
  function renderRods() {
    const lu = lure(), sp = spot(), pos = position();
    el.rodCond.innerHTML = `${lu.ico} ${lu.name} · ${SIZES[G.lure.size || "med"].name} · ${sp.ico} ${sp.name} — ${pos.name} · <b>${sp.clarity}</b> water`;
    const rated = RODS.map(rd => ({ rd, r: rodScore(rd, lu) })).sort((a, b) => b.r.score - a.r.score);
    el.rodList.innerHTML = rated.map(({ rd, r }) => {
      const sel = G.rod === rd.id;
      const detail = sel ? `<div class="opt-detail">${catBars(r.cats)}<div class="cats-tip">${r.tip}</div></div>` : "";
      return `<div class="lure-opt ${sel ? "sel" : ""}" data-rod="${rd.id}">
        <div class="ico">${rd.ico}</div>
        <div class="info">
          <div class="nm">${rd.name} <span class="stars" style="color:${ratingColor(r.pct)}">${starStr(r.stars)}</span></div>
          <div class="rate"><div class="rate-bar"><i style="width:${r.pct}%;background:${ratingColor(r.pct)}"></i></div><b style="color:${ratingColor(r.pct)}">${r.pct}</b></div>
          <div class="ds">${rd.desc}</div>
        </div>
        <div class="tag">${sel ? "✓ ON" : "TAP"}</div></div>` + detail;
    }).join("");
    el.rodCats.innerHTML = "";
  }
  el.rodClose.addEventListener("click", () => {
    el.rodModal.classList.add("hidden");
    if (S.prep) { exitPrep(); return; }
    tackleClosed();
  });
  el.rodBack.addEventListener("click", () => { sfx("ui"); gotoPrep(3); });
  el.rodNext.addEventListener("click", () => { sfx("ui"); gotoPrep(5); });
  el.rodModal.addEventListener("click", (e) => {
    const opt = e.target.closest(".lure-opt"); if (!opt) return;
    G.rod = opt.dataset.rod; save(); updateHUD(); renderRods();
  });

  // ===========================================================================
  // Map: venue + position
  // ===========================================================================
  function openMap() { renderMap(); el.mapModal.classList.remove("hidden"); }
  function renderMap() {
    // GO FISHING prep wizard: step 1 shows lakes, step 2 the spot + finder —
    // conditions ride along at the top so every pick is an informed one
    const prep = S.prep || 0;
    el.mapTitle.textContent = prep === 2 ? `🗺️ ${prepNum(2)} — Pick your lake` : prep === 3 ? `📍 ${prepNum(3)} — Pick your spot` : "🗺️ Where to Fish";
    const c = S.cond, w = WEATHER[c.weather], sea = SEASONS[c.season] || SEASONS.summer;
    el.mapCond.innerHTML = `${sea.ico} ${sea.name} · ${w.ico} ${w.name} · ${c.temp}° · ${moonNow().ico} ${moonNow().name} · ${fmtClock(c.timeMin)} · bass holding ~<b>${Math.round(c.band * 24)} ft</b>`
      + (S.tournament && !S.tournament.ended && !prep ? ` · <span style="color:var(--gold)">🚤 moving to a new spot costs <b>0:20</b></span>` : "");
    el.mapVenues.classList.toggle("hidden", prep === 3);
    const spotStep = prep !== 2;
    el.posHead.classList.toggle("hidden", !spotStep);
    el.lakeMap.classList.toggle("hidden", !spotStep);
    el.posGrid.classList.toggle("hidden", !spotStep);
    el.mapNext.classList.toggle("hidden", !prep);
    el.mapNext.textContent = prep === 2 ? "NEXT — PICK YOUR SPOT ▸" : "NEXT — PICK YOUR ROD ▸";
    el.mapBack.classList.toggle("hidden", !prep);
    el.mapBack.textContent = prep === 2 ? "◂ ANGLER" : S.prepTour ? "◂ ANGLER" : "◂ LAKE";
    el.endDayBtn.classList.toggle("hidden", !!prep);
    el.menuBtn.classList.toggle("hidden", !!prep);
    el.mapVenues.innerHTML = SPOTS.map(s => {
      const owned = ownsSpot(s.id);
      const sel = G.spot === s.id;
      let sub = s.desc;
      if (!owned && s.unlock) {
        const p = s.unlock.prog ? s.unlock.prog(achCtx()) : null;
        sub = `🔒 ${s.unlock.label}` + (p ? ` (${Math.min(p[0], p[1])}/${p[1]})` : "");
      }
      // the selected lake expands with its guidebook entry — where it is, how big,
      // how deep, the lake record, and how it fishes
      const detail = sel && owned && s.lore ? `<div class="venue-detail">
          <div class="vd-where">📍 ${s.lore.where}</div>
          <div class="vd-chips">
            <span>📏 ${s.lore.size}</span><span>🌊 ${s.lore.depth}</span>
            <span>💧 ${s.clarity} water</span><span>🏆 record ${s.lore.record}</span>
          </div>
          <div class="vd-known">🎣 ${s.lore.known}</div>
        </div>` : "";
      return `<div class="venue ${sel ? "sel" : ""} ${owned ? "" : "locked"}" data-venue="${s.id}" data-owned="${owned}">
        <div class="ico">${s.ico}</div>
        <div class="info"><div class="nm">${s.name}</div><div class="ds"${owned ? "" : ' style="color:#ffcf6a"'}>${sub}</div></div>
        <div class="lk">${owned ? (sel ? "HERE" : "GO") : "🔒"}</div></div>` + detail;
    }).join("");
    renderPositions();
  }
  // ---- overhead lake map: each lake's own shape with the spots pinned where
  // their zones actually sit on the water. Markers are tappable.
  const LAKE_SHAPES = {
    cove:     { water: "M14,32 C10,14 32,6 54,7 C80,8 94,20 93,35 C92,52 72,60 47,58 C24,56 17,49 14,32 Z", deco: "pads" },
    falls:    { water: "M4,10 C18,4 30,14 40,22 C52,31 50,44 62,50 C76,57 90,54 96,60 L96,64 L78,64 C60,60 42,54 30,44 C18,35 6,26 4,16 Z", deco: "rocks" },
    river:    { water: "M2,8 C20,2 32,16 48,15 C64,14 60,30 76,33 C90,36 96,46 98,56 L98,64 L84,64 C68,56 58,50 44,43 C28,35 8,28 2,20 Z", deco: "rocks" },
    deep:     { water: "M7,27 C9,9 38,3 61,7 C86,11 96,25 94,40 C92,57 66,63 41,60 C17,57 5,45 7,27 Z", deco: "deep" },
    bayou:    { water: "M6,20 C16,7 33,13 44,9 C58,3 73,9 85,15 C97,22 95,38 87,46 C77,57 62,50 50,56 C36,63 19,57 11,46 C3,36 0,29 6,20 Z", deco: "cypress" },
    highland: { water: "M48,3 C58,13 55,23 62,31 C71,42 89,39 95,49 L95,61 L73,61 C62,52 54,50 45,54 L24,61 L5,58 C9,45 25,44 35,37 C46,30 41,15 48,3 Z", deco: "timber" },
  };
  function lakeTopoSVG(sp) {
    const shape = LAKE_SHAPES[sp.id] || LAKE_SHAPES.cove;
    const deep = shade(sp.water[1], -6), shallow = sp.water[0];
    let deco = "";
    const dot = (x, y, txt, size) => `<text x="${x}" y="${y}" font-size="${size || 4}" text-anchor="middle" opacity="0.75">${txt}</text>`;
    if (shape.deco === "pads") deco = dot(24, 22, "🪷") + dot(70, 16, "🪷") + dot(38, 50, "🪷", 3.4);
    else if (shape.deco === "rocks") deco = dot(30, 24, "🪨", 3.6) + dot(64, 26, "🪨", 3) + dot(86, 48, "🪨", 3.6);
    else if (shape.deco === "cypress") deco = dot(28, 16, "🌳", 4.2) + dot(72, 12, "🌳", 3.6) + dot(18, 44, "🌳", 3.6) + dot(66, 52, "🌳", 4);
    else if (shape.deco === "timber") deco = dot(30, 44, "🌲", 3.8) + dot(58, 24, "🌲", 3.2) + dot(82, 52, "🌲", 3.6);
    else if (shape.deco === "deep") deco = dot(50, 34, "〰️", 4);
    const xy = p => [8 + p.zone[0] * 84, 5 + p.zone[1] * 50];
    // display-only declutter: nudge overlapping pins apart, then place each
    // label in the first free slot (below → above → right → left) so names
    // never stomp on pins or each other
    const pins = sp.positions.map(p => { const [x, y] = xy(p); return { p, x, y }; });
    for (let it = 0; it < 3; it++) for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i], b = pins[j];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
      if (d < 13) { const push = (13 - d) / 2; dx /= d; dy /= d; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; }
    }
    pins.forEach(q => { q.x = Math.min(92, Math.max(8, q.x)); q.y = Math.min(56, Math.max(8, q.y)); });
    const placed = [];
    const boxAt = (pin, mode) => {
      const w = pin.p.name.length * 2.15 + 2, h = 4.4;
      if (mode === "below") return { x: pin.x - w / 2, y: pin.y + 6.8, w, h, tx: pin.x, ty: pin.y + 10.2, anchor: "middle" };
      if (mode === "above") return { x: pin.x - w / 2, y: pin.y - 11, w, h, tx: pin.x, ty: pin.y - 7.6, anchor: "middle" };
      if (mode === "right") return { x: pin.x + 6.6, y: pin.y - 2.2, w, h, tx: pin.x + 7.2, ty: pin.y + 1.2, anchor: "start" };
      return { x: pin.x - 6.6 - w, y: pin.y - 2.2, w, h, tx: pin.x - 7.2, ty: pin.y + 1.2, anchor: "end" };
    };
    const collides = b =>
      b.x < 1 || b.x + b.w > 99 || b.y < 1 || b.y + b.h > 64 ||
      pins.some(q => q.x + 5.6 > b.x && q.x - 5.6 < b.x + b.w && q.y + 5.6 > b.y && q.y - 5.6 < b.y + b.h) ||
      placed.some(o => o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y);
    const labeled = pins.slice().sort((a, b) => a.y - b.y).map(pin => {
      let box = null;
      for (const m of ["below", "above", "right", "left"]) { const cand = boxAt(pin, m); if (!collides(cand)) { box = cand; break; } }
      if (!box) box = boxAt(pin, "below");
      placed.push(box);
      return { pin, box };
    });
    const isSel = id => G.positions[sp.id] === id;
    // 🏹 the secret upriver hole shows itself only to the right angler
    const eggPin = (typeof eggAvailable === "function" && sp.id === G.spot && eggAvailable())
      ? `<g class="mk mk-egg" data-pos="gar_egg" transform="translate(88,10)">
          <circle r="9" fill="transparent" stroke="none"/>
          <circle r="5.2" class="mk-c"/>
          <text y="1.8" font-size="5.4" text-anchor="middle">❓</text>
        </g>` : "";
    const markers = eggPin + pins.map(({ p, x, y }) => `<g class="mk ${isSel(p.id) ? "sel" : ""}" data-pos="${p.id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
        <circle r="9" fill="transparent" stroke="none"/>
        <circle r="5.2" class="mk-c"/>
        <text y="1.6" font-size="5" text-anchor="middle">${p.ico}</text>
      </g>`).join("")
      + labeled.map(({ pin, box }) => `<g class="mk ${isSel(pin.p.id) ? "sel" : ""}" data-pos="${pin.p.id}">
        <text x="${box.tx.toFixed(1)}" y="${box.ty.toFixed(1)}" class="mk-l" text-anchor="${box.anchor}">${pin.p.name}</text>
      </g>`).join("");
    return `<svg viewBox="0 0 100 66" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="lm-${sp.id}" cx="50%" cy="42%" r="70%">
        <stop offset="0%" stop-color="${deep}"/><stop offset="100%" stop-color="${shallow}"/>
      </radialGradient></defs>
      <path d="${shape.water}" fill="url(#lm-${sp.id})" stroke="rgba(234,246,251,0.5)" stroke-width="0.8"/>
      ${deco}${markers}
      <text x="97" y="63" font-size="3.2" text-anchor="end" fill="rgba(234,246,251,0.5)">${sp.ico} ${sp.name}</text>
    </svg>`;
  }
  function renderPositions() {
    const sp = spot();
    el.lakeMap.innerHTML = lakeTopoSVG(sp);
    // the fish-finder report expands right out of the highlighted hole
    el.posGrid.innerHTML = sp.positions.map(p => {
      const sel = G.positions[sp.id] === p.id;
      const detail = sel ? `<div class="pos-detail"><div class="finder" id="finder"></div></div>` : "";
      return `<div class="pos-cell ${sel ? "sel" : ""}" data-pos="${p.id}">
        <div class="pi">${p.ico}</div><div class="pn">${p.name}</div><div class="pd">${p.desc}</div></div>` + detail;
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

    const host = document.getElementById("finder"); if (!host) return;
    host.innerHTML = `<div class="finder-wrap">
      <div class="sonar">
        <div class="sweep"></div>
        <div class="bite-zone" style="top:${zTop}%;height:18%"><span>BITE</span></div>
        ${blips}
        <span class="s-top">0 ft</span><span class="s-bot">${Math.round(24)} ft</span>
      </div>
      <div class="finder-info">
        <div class="fi-line">${(SEASONS[c.season] || SEASONS.summer).ico} ${(SEASONS[c.season] || SEASONS.summer).name} · ${w.ico} ${w.name} · ${c.temp}° · ${fmtClock(c.timeMin)}</div>
        <div class="fi-line" style="color:#9fc3d2">${(SEASON_STRUCT[c.season] || SEASON_STRUCT.summer).tip}</div>
        <div class="fi-line">${(() => {
          const here = STRUCT_GROUP[pos.id] || "open", fit = seasonFit(), best = bestSeasonGroup();
          if (fit >= 1.15) return `<b style="color:#5be37a">✓ On the seasonal pattern</b> — ${STRUCT_LABEL[here]}`;
          if (fit <= 0.85) return `<b style="color:#ff9b3d">Off-pattern</b> — try <b>${STRUCT_LABEL[best]}</b> this season`;
          return `Fair spot for the season · best: <b>${STRUCT_LABEL[best]}</b>`;
        })()}</div>
        <div class="fi-line">Bass holding <b>${zone}</b> · ~${depthFt} ft</div>
        <div class="fi-line">Throw <b>${recDepth}</b> lures in <b>${recColor}</b></div>
        ${best ? `<div class="fi-line">Best lure: <b>${best.lure.ico} ${best.lure.name}</b> <span style="color:${ratingColor(best.pct)}">${best.pct}</span></div>` : ""}
      </div>
    </div>`;
  }
  el.spotChip.addEventListener("click", openMap);
  el.mapClose.addEventListener("click", () => {
    el.mapModal.classList.add("hidden");
    if (S.prep) exitPrep();   // backing out of prep — menu, or the event sheet
  });
  el.mapNext.addEventListener("click", () => {
    sfx("ui");
    if (S.prep === 2) { S.prep = 3; renderMap(); }
    else if (S.prep === 3) gotoPrep(4);
  });
  el.mapBack.addEventListener("click", () => {
    sfx("ui");
    if (S.prep === 3 && !S.prepTour) { S.prep = 2; renderMap(); }
    else if (S.prep === 3 || S.prep === 2) gotoPrep(1);
    else exitPrep();
  });
  el.newDayBtn.addEventListener("click", () => { sfx("ui"); startNewDay(); });
  el.endDayBtn.addEventListener("click", () => {
    if (S.tournament && !S.tournament.ended) { toast("Finish the tournament first ⏱️"); return; } if (S.arcade && !S.arcade.ended) { toast("Finish the arcade run first 🕹️"); return; }
    el.mapModal.classList.add("hidden");
    endDay();
  });
  el.mapModal.addEventListener("click", (e) => {
    const v = e.target.closest(".venue");
    const p = e.target.closest(".pos-cell") || e.target.closest(".mk");   // grid cell or overhead-map pin
    if (p && p.dataset.pos === "gar_egg") { openGarInvite(); return; }
    if (v) {
      if (S.arcade && !S.arcade.ended) { toast("Can't switch lakes mid-arcade 🕹️"); return; }
      if (v.dataset.owned === "true") {
        if (G.spot !== v.dataset.venue) { G.spot = v.dataset.venue; seedFish(); rollConditions(); resetToIdle(); }
        save(); updateHUD(); renderMap();
      } else { const sp = SPOTS.find(s => s.id === v.dataset.venue); toast(sp && sp.unlock ? "🔒 " + sp.unlock.label : "Locked"); }
    } else if (p) {
      const posId = p.dataset.pos, cur = G.positions[spot().id];
      if (S.arcade && !S.arcade.ended) { if (posId !== cur) toast("The stage picks the spot 🕹️"); return; }
      const T = S.tournament && !S.tournament.ended ? S.tournament : null;
      if (T && posId !== cur) {
        // running the boat to new water costs tournament time (the motor helps)
        const mvMs = garageMoveMs();
        T.timeLeft -= mvMs;
        G.positions[spot().id] = posId;
        recomputeCond(); seedFish(); save(); updateHUD();
        el.mapModal.classList.add("hidden");
        toast(`🚤 Ran to ${position().name} — <b>−0:${String(Math.round(mvMs / 1000)).padStart(2, "0")}</b>`);
        sfx("cast"); vibrate(15);
        resetToIdle();
        if (T.timeLeft <= 0) { T.timeLeft = 0; endTournament(); }
        return;
      }
      G.positions[spot().id] = posId; recomputeCond(); save(); updateHUD(); renderPositions();
    }
  });

  // ===========================================================================
  // Shop
  // ===========================================================================
  el.rodChip.addEventListener("click", openRods);
  // the gameplay speaker button opens the sound panel: music and effects
  // each get their own switch, linked to the toggles on the menu sliders
  function renderSoundPanel() {
    const mOn = G.musicOn !== false, fOn = !G.muted;
    el.sndMusic.textContent = `${mOn ? "🎵" : "🔇"} Music — ${mOn ? "ON" : "OFF"}`;
    el.sndMusic.classList.toggle("ghost", !mOn);
    el.sndFx.textContent = `${fOn ? "🔊" : "🔇"} Effects — ${fOn ? "ON" : "OFF"}`;
    el.sndFx.classList.toggle("ghost", !fOn);
  }
  el.muteBtn.addEventListener("click", () => { renderSoundPanel(); el.soundModal.classList.remove("hidden"); sfx("ui"); });
  el.sndMusic.addEventListener("click", () => { Music.setOn(G.musicOn === false); updateVolLabels(); updateHUD(); renderSoundPanel(); sfx("ui"); });
  el.sndFx.addEventListener("click", () => { setSfxMuted(!G.muted); renderSoundPanel(); if (!G.muted) sfx("ui"); });
  el.soundClose.addEventListener("click", () => { el.soundModal.classList.add("hidden"); sfx("ui"); });
  // ---- Record book (tap the 🏆 winnings pill) ----
  function openRecords() {
    const h = document.getElementById("recTitle");
    if (h) h.textContent = G.name ? `🏆 ${G.name}'s Record Book` : "🏆 Record Book";
    renderRecords(); el.recordsModal.classList.remove("hidden");
  }
  function renderRecords() {
    const totalCaught = Object.values(G.caught || {}).reduce((s, n) => s + n, 0);
    const recVals = Object.values(G.records || {});
    const biggest = recVals.length ? Math.max(...recVals) : 0;
    const season = G.season || { best: {}, titles: 0 };
    const seasonPts = Object.values(season.best || {}).reduce((s, p) => s + p, 0);
    const seasonEvents = Object.keys(season.best || {}).length;
    const bestCatch = (G.catchLog || []).reduce((m, c) => Math.max(m, c.score || 0), 0);
    // every tile links onward to the screen with the detail behind it
    const stats = [
      ["🐟", "Bass caught", totalCaught, totalCaught > 0 && "log"],
      ["🏅", "Biggest bass", biggest ? biggest.toFixed(1) + " lb" : "—", biggest > 0 && "trophy"],
      ["🪣", "Best livewell", (G.bestBag || 0) ? G.bestBag.toFixed(2) + " lb" : "—", totalCaught > 0 && "logw"],
      ["🏁", "Tournament wins", G.tourWins || 0, "circuit"],
      ["👑", "Circuit titles", season.titles || 0, "circuit"],
      ["📋", "Season", `${seasonPts} pts · ${seasonEvents}/${TOURNAMENTS.length}`, "circuit"],
      ["🎯", "Angler score", (G.coins || 0).toLocaleString(), totalCaught > 0 && "logs"],
      ["💥", "Best catch", bestCatch ? bestCatch.toLocaleString() : "—", bestCatch > 0 && "logs"],
      ["🕹️", "Arcade best", G.arcadeBestScore ? G.arcadeBestScore.toLocaleString() : "—", "circuit"],
    ];
    el.recStats.innerHTML = stats.map(([i, l, v, act]) =>
      `<div class="rec-stat ${act ? "tap" : ""}" ${act ? `data-act="${act}"` : ""}><div class="rs-ico">${i}</div><div class="rs-v">${v}${act ? " ›" : ""}</div><div class="rs-l">${l}</div></div>`
    ).join("");
    const seenName = new Set();
    const fishRows = Object.keys(F).filter(k => { if (seenName.has(F[k].name)) return false; seenName.add(F[k].name); return true; }).map(k => {
      const def = F[k], best = G.records[def.name], n = G.caught[def.name];
      const lunk = best && best >= LUNKER_LB;
      return `<div class="item"><div class="item-ico">${n ? fishSVG(def, 40) : "❓"}</div>
        <div class="item-info"><div class="item-name">${n ? def.name : "???"}</div>
        <div class="item-desc">${n ? `Caught ${n} · biggest ${best ? best.toFixed(1) + " lb" : "—"}` : "Not caught yet"}</div></div>
        <div class="item-btn ${lunk ? "equipped" : "owned"}">${best ? best.toFixed(1) + " lb" : "—"}</div></div>`;
    }).join("");
    const ch = G.challenges || {};
    const done = ACH.filter(a => ch[a.id]).length;
    const trophyBtn = `<div class="trophy-cta" data-act="trophy">
        <div class="tc-ico">🏆</div>
        <div class="tc-txt"><div class="tc-name">Trophy Room</div>
          <div class="tc-sub">${biggest ? "Your " + biggest.toFixed(1) + " lb mount · " : ""}${done}/${ACH.length} achievements</div></div>
        <div class="tc-chev">›</div></div>`;
    el.recBody.innerHTML = fishRows + `<h3 class="rec-h" style="margin-top:14px">Trophy Room &amp; Achievements</h3>` + trophyBtn;
  }
  el.recordsClose && el.recStats.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-act]"); if (!tile) return;
    const act = tile.dataset.act; sfx("ui");
    if (act === "log") openCatchLog();
    else if (act === "logw") openCatchLog("weight");
    else if (act === "logs") openCatchLog("score");
    else if (act === "trophy") openTrophyRoom();
    else if (act === "circuit") {
      el.recordsModal.classList.add("hidden");
      if (!el.titleScreen.classList.contains("hidden")) closeTitle(true);
      openCircuit();
    }
  });
  el.recBody && el.recBody.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="trophy"]')) openTrophyRoom();
  });

  // ---- Trophy Room — your biggest bass mounted in 3D + the achievement wall ----
  function trophyEntry() {
    // the heaviest bass in the catch log (has full context); fall back to records
    const log = (G.catchLog || []).slice().sort((a, b) => b.w - a.w);
    if (log.length) return log[0];
    const recVals = Object.entries(G.records || {});
    if (!recVals.length) return null;
    const [name, w] = recVals.sort((a, b) => b[1] - a[1])[0];
    return { w, len: +Math.cbrt(w * 1600).toFixed(1), _name: name, bare: true };
  }
  function trophyArt(w) {
    // pick the sculpt/markings that match the size class, like the catch screen does
    const def = w >= 10 ? F.hawg : w >= 6 ? F.giant : F.largemouth;
    return def.art;
  }
  function openTrophyRoom() {
    renderTrophyRoom();
    el.trophyModal.classList.remove("hidden");
    // mount the biggest bass in 3D once the modal has real dimensions
    const t = trophyEntry();
    const cv = document.getElementById("trophy3d"), host = el.trophyMountSvg;
    let shown = false;
    if (t && window.Scene3D && Scene3D.showCatch) {
      requestAnimationFrame(() => {
        try { shown = Scene3D.showCatch(trophyArt(t.w), "largemouth", cv); } catch (e) {}
        cv.style.display = shown ? "block" : "none";
        if (!shown && host) host.innerHTML = t ? fishSVG(F.largemouth, 150) : "";
      });
    } else if (host) {
      cv.style.display = "none";
      host.innerHTML = t ? fishSVG(F.largemouth, 150) : "";
    }
  }
  function renderTrophyRoom() {
    const t = trophyEntry();
    // headline mount stats
    if (t) {
      const sp = SPOTS.find(s => s.id === t.spot);
      const when = t.ts ? new Date(t.ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
      const lu = t.lure && LURES.find(l => l.id === t.lure);
      const bits = [
        t.len ? `📏 ${t.len}"` : "",
        t.score ? `🎯 ${t.score.toLocaleString()} pts` : "",
        sp ? `${sp.ico} ${sp.name}` : "",
        lu ? `${lu.ico} ${lu.name}` : "",
        when,
      ].filter(Boolean);
      el.trophyStats.innerHTML =
        `<div class="tr-w">${t.w.toFixed(1)}<small>lb</small></div>
         <div class="tr-name">Largemouth Bass — Personal Best</div>
         <div class="tr-bits">${bits.map(b => `<span>${b}</span>`).join("")}</div>`;
    } else {
      el.trophyStats.innerHTML = `<div class="tr-name">No mount yet — go land your personal best!</div>`;
    }
    // achievement wall
    const ch = G.challenges || {};
    const c = achCtx();
    const got = ACH.filter(a => ch[a.id]).length;
    el.trophyAchHead.textContent = `Achievements · ${got}/${ACH.length}`;
    el.trophyAch.innerHTML = ACH.map(a => {
      const done = !!ch[a.id];
      let sub = a.desc;
      if (!done && a.prog) { const [cur, tgt] = a.prog(c); sub = `${a.desc} — ${Math.min(cur, tgt)}/${tgt}`; }
      return `<div class="ach ${done ? "on" : "off"}">
        <div class="ach-ico">${done ? a.ico : "🔒"}</div>
        <div class="ach-txt"><div class="ach-name">${a.name}</div><div class="ach-sub">${sub}</div></div>
        ${done ? '<div class="ach-check">✓</div>' : ""}</div>`;
    }).join("");
  }
  el.trophyClose.addEventListener("click", () => {
    if (window.Scene3D && Scene3D.hideCatch) { try { Scene3D.hideCatch(document.getElementById("trophy3d")); } catch (e) {} }
    el.trophyModal.classList.add("hidden");
  });
  el.trophyModal.addEventListener("click", (e) => {
    if (e.target === el.trophyModal) el.trophyClose.click();
  });

  // ---- Catch Log — every bass, sortable & filterable ----
  let clogSort = "recent";
  let clogView = [];   // the current filtered+sorted rows, for tap-to-detail
  const clogFilters = { spot: "", lure: "", rod: "", time: "", weather: "" };
  function openCatchLog(sort) {
    clogSort = sort || "recent";
    clogFilters.spot = clogFilters.lure = clogFilters.rod = clogFilters.time = clogFilters.weather = "";
    el.catchLogModal.querySelectorAll(".clog-sbtn").forEach(b => b.classList.toggle("active", b.dataset.sort === clogSort));
    buildClogFilters();
    renderCatchLog();
    el.catchLogModal.classList.remove("hidden");
  }
  // populate the filter dropdowns from the values actually present in the log
  function buildClogFilters() {
    const log = G.catchLog || [];
    const opt = (val, label, cur) => `<option value="${val}" ${cur === val ? "selected" : ""}>${label}</option>`;
    const distinct = key => Array.from(new Set(log.map(e => e[key])));
    el.fLake.innerHTML = opt("", "All lakes", clogFilters.spot) + distinct("spot").map(id => { const s = SPOTS.find(x => x.id === id); return s ? opt(id, s.ico + " " + s.name, clogFilters.spot) : ""; }).join("");
    el.fLure.innerHTML = opt("", "All lures", clogFilters.lure) + distinct("lure").map(id => { const l = LURES.find(x => x.id === id); return l ? opt(id, l.ico + " " + l.name, clogFilters.lure) : ""; }).join("");
    el.fRod.innerHTML = opt("", "All rods", clogFilters.rod) + distinct("rod").map(id => { const r = RODS.find(x => x.id === id); return r ? opt(id, r.ico + " " + r.name, clogFilters.rod) : ""; }).join("");
    el.fTime.innerHTML = opt("", "Any time", clogFilters.time) + [["dawn", "Dawn"], ["day", "Day"], ["dusk", "Dusk"], ["night", "Night"]].map(([k, l]) => opt(k, l, clogFilters.time)).join("");
    el.fWx.innerHTML = opt("", "Any weather", clogFilters.weather) + distinct("weather").map(w => WEATHER[w] ? opt(w, WEATHER[w].ico + " " + WEATHER[w].name, clogFilters.weather) : "").join("");
  }
  function renderCatchLog() {
    let rows = (G.catchLog || []).slice();
    rows = rows.filter(e =>
      (!clogFilters.spot || e.spot === clogFilters.spot) &&
      (!clogFilters.lure || e.lure === clogFilters.lure) &&
      (!clogFilters.rod || e.rod === clogFilters.rod) &&
      (!clogFilters.time || todBucket(e.timeMin).k === clogFilters.time) &&
      (!clogFilters.weather || e.weather === clogFilters.weather));
    if (clogSort === "weight") rows.sort((a, b) => b.w - a.w);
    else if (clogSort === "length") rows.sort((a, b) => b.len - a.len);
    else if (clogSort === "score") rows.sort((a, b) => (b.score || 0) - (a.score || 0));
    else rows.sort((a, b) => b.ts - a.ts);
    clogView = rows;
    el.clogCount.textContent = `${rows.length} bass · tap one for details`;
    if (!rows.length) { el.clogList.innerHTML = `<p class="muted" style="text-align:center;padding:18px">No catches match those filters.</p>`; return; }
    el.clogList.innerHTML = rows.map((e, i) => {
      const l = LURES.find(x => x.id === e.lure), r = RODS.find(x => x.id === e.rod), sp = SPOTS.find(x => x.id === e.spot);
      const pos = sp && sp.positions.find(p => p.id === e.pos), col = COLORS[e.color], sz = SIZES[e.size];
      const wx = WEATHER[e.weather] || {}, sea = SEASONS[e.season] || {};
      const lunk = e.w >= LUNKER_LB;
      return `<div class="clog-row" data-idx="${i}">
        <div class="clog-w ${lunk ? "lunk" : ""}"><b>${e.w.toFixed(1)}</b><small>lb</small><span>${e.len.toFixed(1)}"${e.depth != null ? " · " + e.depth + "ft" : ""}</span></div>
        <div class="clog-meta">
          <div>${l ? l.ico + " " + l.name : e.lure}${sz ? " · " + sz.name : ""}${col ? ` <i class="cdot" style="background:${col.hex}"></i>` : ""}</div>
          <div>${r ? r.ico + " " + r.name : e.rod} · ${sp ? sp.ico + " " + sp.name : e.spot}${pos ? " — " + pos.name : ""}</div>
          <div>${wx.ico || ""} ${wx.name || e.weather} · ${e.temp}° · ${fmtClock(e.timeMin)} · ${sea.ico || ""}${e.moon != null ? " " + MOON[((e.moon % 8) + 8) % 8].ico : ""}${e.tour ? " · 🏁" : ""}${e.score ? ` · <b style="color:var(--gold)">🎯 ${e.score}</b>` : ""}</div>
        </div><div class="clog-chev">›</div></div>`;
    }).join("");
  }
  el.catchLogClose.addEventListener("click", () => el.catchLogModal.classList.add("hidden"));
  el.catchLogModal.addEventListener("click", (e) => {
    const sb = e.target.closest(".clog-sbtn");
    if (sb) { clogSort = sb.dataset.sort; el.catchLogModal.querySelectorAll(".clog-sbtn").forEach(b => b.classList.toggle("active", b === sb)); renderCatchLog(); return; }
    const row = e.target.closest(".clog-row");
    if (row && clogView[+row.dataset.idx]) openCatchDetail(clogView[+row.dataset.idx]);
  });

  // ---- Single catch detail (tap a row) ----
  function logArt(w) { return w >= 10 ? F.hawg.art : w >= 6 ? F.giant.art : F.largemouth.art; }
  // a little top-down map of the lake with a pin where it was caught
  function lakeMapSVG(spotId, posId) {
    const sp = SPOTS.find(s => s.id === spotId); if (!sp) return "";
    const pos = sp.positions.find(p => p.id === posId);
    const W = 300, H = 116;
    const px = clamp(pos ? pos.zone[0] : 0.5, 0.06, 0.94) * W;
    const py = clamp(pos ? pos.zone[1] : 0.5, 0.12, 0.9) * H;
    const dots = sp.positions.map(p => { const x = clamp(p.zone[0], 0.06, 0.94) * W, y = clamp(p.zone[1], 0.12, 0.9) * H, on = p.id === posId; return `<circle cx="${x}" cy="${y}" r="${on ? 0 : 3}" fill="rgba(255,255,255,.35)"/>`; }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="lm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sp.water[0]}"/><stop offset="1" stop-color="${sp.water[1]}"/></linearGradient></defs>
      <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="url(#lm)"/>
      <rect x="0" y="0" width="${W}" height="16" fill="rgba(60,90,50,.55)"/>
      ${dots}
      <circle cx="${px}" cy="${py}" r="9" fill="none" stroke="#ffd35c" stroke-width="2.5" opacity=".9"/>
      <circle cx="${px}" cy="${py}" r="3.5" fill="#ffd35c"/>
    </svg>`;
  }
  function openCatchDetail(e) {
    cdEntry = e;
    const l = LURES.find(x => x.id === e.lure), r = RODS.find(x => x.id === e.rod), sp = SPOTS.find(x => x.id === e.spot);
    const pos = sp && sp.positions.find(p => p.id === e.pos), col = COLORS[e.color], sz = SIZES[e.size];
    const wx = WEATHER[e.weather] || {}, sea = SEASONS[e.season] || {};
    const lunk = e.w >= LUNKER_LB;
    const picSize = clamp(150 + e.w * 9, 150, 330);   // bigger fish → bigger picture
    const fish = { name: "Largemouth Bass", art: logArt(e.w), weight: e.w, lengthIn: e.len };
    let dateStr = "";
    try { if (e.ts > 1e12) dateStr = new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (x) {}
    const mn = e.moon != null ? MOON[((e.moon % 8) + 8) % 8] : null;
    const rows = [
      ["🎣", "Lure", `${l ? l.ico + " " + l.name : e.lure}${col ? ` <i class="cdot" style="background:${col.hex}"></i> ${col.name}` : ""}`],
      ["📐", "Lure size", `${sz ? sz.ico + " " + sz.name : e.size}`],
      ...(e.score ? [["🎯", "Catch score", e.score.toLocaleString() + " pts"]] : []),
      ["🪝", "Rod", r ? r.ico + " " + r.name : e.rod],
      ["📍", "Location", `${sp ? sp.ico + " " + sp.name : e.spot}${pos ? " — " + pos.name : ""}`],
      ["🌊", "Depth", e.depth != null ? e.depth + " ft" : "—"],
      ["🌡️", "Conditions", `${wx.ico || ""} ${wx.name || e.weather} · ${e.temp}°F · ${sea.ico || ""} ${sea.name || e.season}`],
      ...(mn ? [["🌙", "Moon", mn.ico + " " + mn.name]] : []),
      ["⏰", "Time of day", `${fmtClock(e.timeMin)} (${todBucket(e.timeMin).label})`],
    ];
    if (dateStr) rows.push(["📅", "Date", dateStr]);
    if (e.tour) rows.push(["🏁", "Event", "Tournament catch"]);
    el.catchDetailBody.innerHTML =
      `<div class="cd-hero ${lunk ? "lunk" : ""}">${fishSVG(fish, picSize)}${lunk ? '<div class="cd-badge">🏆 LUNKER</div>' : ""}</div>
       <div class="cd-name">Largemouth Bass</div>
       <div class="cd-trio">
         <div><b>${e.w.toFixed(1)}</b><small>lb</small></div>
         <div><b>${e.len.toFixed(1)}</b><small>in</small></div>
         <div><b>${e.depth != null ? e.depth : "—"}</b><small>ft deep</small></div>
       </div>
       <div class="cd-map-h">📍 Where on the lake</div>
       <div class="cd-map">${lakeMapSVG(e.spot, e.pos)}</div>
       <div class="cd-rows">` +
        rows.map(([i, k, v]) => `<div class="cd-row"><span class="cd-ic">${i}</span><span class="cd-k">${k}</span><span class="cd-v">${v}</span></div>`).join("") +
      `</div><button class="big-btn" id="cdShare" style="margin-top:10px">📣 SHARE THIS CATCH</button>`;
    el.catchDetailModal.classList.remove("hidden");
  }
  el.catchDetailClose.addEventListener("click", () => el.catchDetailModal.classList.add("hidden"));
  [["fLake", "spot"], ["fLure", "lure"], ["fRod", "rod"], ["fTime", "time"], ["fWx", "weather"]].forEach(([id, key]) =>
    el[id].addEventListener("change", () => { clogFilters[key] = el[id].value; renderCatchLog(); }));

  // ---- Stats dashboard ----
  let statsMetric = "count";
  function openStats() { renderStats(); el.statsModal.classList.remove("hidden"); }
  function renderStats() {
    const log = G.catchLog || [];
    if (!log.length) { el.statsBody.innerHTML = `<p class="muted" style="text-align:center;padding:24px">No catches logged yet — go fishing!</p>`; return; }
    const n = log.length, sumW = log.reduce((s, e) => s + e.w, 0), avgW = sumW / n;
    const maxW = Math.max(...log.map(e => e.w));
    const avgLen = log.reduce((s, e) => s + (e.len || 0), 0) / n;
    const depths = log.filter(e => e.depth != null).map(e => e.depth);
    const avgDepth = depths.length ? depths.reduce((s, d) => s + d, 0) / depths.length : 0;
    const cards = [
      ["🐟", "Caught", n], ["⚖️", "Avg", avgW.toFixed(1) + " lb"], ["🏅", "Biggest", maxW.toFixed(1) + " lb"],
      ["🪣", "Total", sumW.toFixed(0) + " lb"], ["📏", "Avg len", avgLen.toFixed(1) + '"'], ["🌊", "Avg depth", avgDepth.toFixed(0) + " ft"],
    ];
    // group catches by a key, computing count / avg / max weight
    function group(keyFn, labelFn) {
      const m = {};
      for (const e of log) { const k = keyFn(e); if (k == null) continue; (m[k] = m[k] || { count: 0, sumW: 0, maxW: 0, label: labelFn(k) }); m[k].count++; m[k].sumW += e.w; m[k].maxW = Math.max(m[k].maxW, e.w); }
      return Object.values(m).map(v => ({ label: v.label, count: v.count, avg: v.sumW / v.count, max: v.maxW }));
    }
    const mVal = g => statsMetric === "avg" ? g.avg : g.count;
    const mFmt = g => statsMetric === "avg" ? g.avg.toFixed(1) + " lb" : g.count;
    function bars(title, groups) {
      if (!groups.length) return "";
      groups = groups.slice().sort((a, b) => mVal(b) - mVal(a));
      const mx = Math.max(...groups.map(mVal), 0.0001);
      return `<div class="sd-sec"><div class="sd-h">${title}</div>` + groups.map(g =>
        `<div class="sd-bar"><span class="sd-lbl">${g.label}</span><div class="sd-track"><i style="width:${Math.round(mVal(g) / mx * 100)}%"></i></div><b>${mFmt(g)}</b></div>`).join("") + `</div>`;
    }
    function histo(title, vals, edges, unit) {
      const counts = edges.map((lo, i) => { const hi = edges[i + 1] != null ? edges[i + 1] : Infinity; return vals.filter(v => v >= lo && v < hi).length; });
      const mx = Math.max(...counts, 1);
      return `<div class="sd-sec"><div class="sd-h">${title}</div>` + edges.map((lo, i) => {
        const hi = edges[i + 1], lbl = hi != null ? `${lo}–${hi}` : `${lo}+`;
        return `<div class="sd-bar"><span class="sd-lbl">${lbl}${unit}</span><div class="sd-track"><i style="width:${Math.round(counts[i] / mx * 100)}%"></i></div><b>${counts[i]}</b></div>`;
      }).join("") + `</div>`;
    }
    const TOD = { dawn: "🌅 Dawn", day: "☀️ Day", dusk: "🌆 Dusk", night: "🌙 Night" };
    el.statsBody.innerHTML =
      `<div class="sd-cards">` + cards.map(([i, l, v]) => `<div class="sd-card"><div class="sd-ci">${i}</div><div class="sd-cv">${v}</div><div class="sd-cl">${l}</div></div>`).join("") + `</div>` +
      `<div class="sd-metric"><span>Bars show:</span><button class="sd-mbtn ${statsMetric === "count" ? "active" : ""}" data-metric="count"># Caught</button><button class="sd-mbtn ${statsMetric === "avg" ? "active" : ""}" data-metric="avg">Avg lb</button></div>` +
      bars("By Lure", group(e => e.lure, k => { const l = LURES.find(x => x.id === k); return l ? l.ico + " " + l.name : k; })) +
      bars("By Lake", group(e => e.spot, k => { const s = SPOTS.find(x => x.id === k); return s ? s.ico + " " + s.name : k; })) +
      bars("By Rod", group(e => e.rod, k => { const r = RODS.find(x => x.id === k); return r ? r.ico + " " + r.name : k; })) +
      bars("By Size", group(e => e.size, k => { const s = SIZES[k]; return s ? s.ico + " " + s.name : k; })) +
      bars("By Time of Day", group(e => todBucket(e.timeMin).k, k => TOD[k] || k)) +
      bars("By Weather", group(e => e.weather, k => { const w = WEATHER[k]; return w ? w.ico + " " + w.name : k; })) +
      bars("By Moon", group(e => e.moon != null ? e.moon : null, k => { const m = MOON[((+k % 8) + 8) % 8]; return m ? m.ico + " " + m.name : k; })) +
      histo("Depth caught", depths, [0, 5, 10, 15, 20], " ft") +
      histo("Weight", log.map(e => e.w), [0, 2, 4, 6, 8, 10], " lb") +
      (() => {   // 🏆 the money lure, lake by lake
        const byLake = {};
        for (const e of log) { (byLake[e.spot] = byLake[e.spot] || {}); const L2 = byLake[e.spot]; (L2[e.lure] = L2[e.lure] || { n: 0, w: 0 }); L2[e.lure].n++; L2[e.lure].w += e.w; }
        const rows2 = Object.entries(byLake).map(([spId, lures2]) => {
          const sp2 = SPOTS.find(x => x.id === spId);
          const best2 = Object.entries(lures2).sort((a, b) => b[1].n - a[1].n)[0];
          const lu2 = LURES.find(x => x.id === best2[0]);
          return `<div class="sd-bar"><span class="sd-lbl">${sp2 ? sp2.ico + " " + sp2.name : spId}</span><div class="sd-track"></div><b>${lu2 ? lu2.ico + " " + lu2.name : best2[0]} · ${best2[1].n}</b></div>`;
        }).join("");
        return rows2 ? `<div class="sd-sec"><div class="sd-h">🏆 Your money lure, lake by lake</div>${rows2}</div>` : "";
      })() +
      (() => {   // 📈 personal-best timeline: each time the bar was raised
        let pb = 0; const steps = [];
        for (const e of log) if (e.w > pb) { pb = e.w; steps.push(e); }
        if (steps.length < 2) return "";
        return `<div class="sd-sec"><div class="sd-h">📈 Personal-best timeline</div>` + steps.slice(-8).map(e => {
          let d2 = ""; try { if (e.ts > 1e12) d2 = new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (x) {}
          const sp2 = SPOTS.find(x => x.id === e.spot);
          return `<div class="sd-bar"><span class="sd-lbl">${d2 || "—"}</span><div class="sd-track"><i style="width:${Math.round(e.w / pb * 100)}%"></i></div><b>${e.w.toFixed(1)} lb${sp2 ? " · " + sp2.ico : ""}</b></div>`;
        }).join("") + `</div>`;
      })();
  }
  el.openStatsBtn.addEventListener("click", openStats);
  el.statsClose.addEventListener("click", () => el.statsModal.classList.add("hidden"));
  el.statsModal.addEventListener("click", (e) => {
    const mb = e.target.closest(".sd-mbtn");
    if (mb) { statsMetric = mb.dataset.metric; renderStats(); }
  });
  el.xpPill.addEventListener("click", openRecords);
  el.recordsClose.addEventListener("click", () => el.recordsModal.classList.add("hidden"));

  // 🧰 opens the real tackle box (lure/size/line/color/scent); tabs hop between
  // the lure, rod and lake pickers so it all feels like one box
  el.shopBtn.addEventListener("click", openLures);
  document.querySelectorAll(".tb-tab").forEach(t => t.addEventListener("click", () => {
    el.lureModal.classList.add("hidden"); el.rodModal.classList.add("hidden");
    if (t.dataset.tb === "rods") openRods();
    else if (t.dataset.tb === "lures") openLures();
    else { if (S.prep) S.prep = 3; openMap(); }   // lakes hop inside the wizard rejoins at the spot step
  }));

  // ===========================================================================
  // Boot
  // ===========================================================================
  // the angler stable arrived after launch: existing career points become the
  // current angler's starting XP, exactly as if they'd been earned in the boat
  if (!G.angler) G.angler = "roberto";
  if (!G.anglerXP) G.anglerXP = { [G.angler]: G.coins || 0 };
  // a lifetime on the water teaches the whole crew: one-time, every angler is
  // seeded with up to 12k XP of career experience to spend — then each one
  // earns solo, by fishing as them and winning achievements in their boat
  if (!G.crewSeeded) {
    const seed = Math.min(G.coins || 0, 12000);
    for (const a of ANGLERS) G.anglerXP[a.id] = Math.max(G.anglerXP[a.id] || 0, seed);
    G.crewSeeded = true;
  }
  // the skill scale went 10 → 100: refund every point spent at the old fat
  // value so it can be re-spent on the fine scale, and deepen the crew seed
  if (!G.skill100) {
    G.anglerUp = {};
    const seed = Math.min(G.coins || 0, 40000);
    for (const a of ANGLERS) G.anglerXP[a.id] = Math.max(G.anglerXP[a.id] || 0, seed);
    G.skill100 = true;
  }
  // migrate old saves: seed the lifetime tallies from the catch log once, so
  // long-time anglers get credit for what they've already caught
  if (!G.tally && (G.catchLog || []).length) { G.catchLog.forEach(tallyCatch); save(); }
  evalAchievements(true);   // retroactively credit anything an existing save already earned
  rollConditions();
  updateHUD();
  showBtn(false);
  setStatus("Tap & hold the water to aim, release to cast 🎣");
  // boot splash: bubbles rise, the logo surfaces, the theme starts itself
  // (where the platform allows autoplay — otherwise the first tap starts it)
  (function intro() {
    const sp2 = document.getElementById("introSplash");
    showTitle();                              // menu is ready underneath the splash
    if (!sp2) return;
    for (let i = 0; i < 20; i++) {
      const b = document.createElement("i");
      b.className = "is-bub";
      b.style.left = (3 + Math.random() * 94) + "%";
      const bs = 4 + Math.random() * 15;
      b.style.width = b.style.height = bs.toFixed(0) + "px";
      b.style.animationDelay = (Math.random() * 1.3).toFixed(2) + "s";
      b.style.animationDuration = (1.1 + Math.random() * 1.3).toFixed(2) + "s";
      sp2.appendChild(b);
    }
    Music.tryAutoplay();
    // swap the placeholder for the game's real rigged bass as soon as it's loaded:
    // it swims (the model's own animation) while revolving a slow 360
    (function fishIn() {
      if (sp2._go || !document.getElementById("introFish")) return;
      // wait for the actual rigged GLB — the same model the underwater scenes
      // swim — never the procedural fallback
      if (window.Scene3D && Scene3D.isReady && Scene3D.isReady() && Scene3D.hasModel && Scene3D.hasModel("largemouth")) {
        try {
          const cv = document.getElementById("introFish");
          cv.classList.remove("hidden");
          if (Scene3D.showCatch(F.largemouth.art, "largemouth", cv, true)) {
            const em = document.getElementById("isFishEmoji");
            if (em) em.classList.add("hidden");
            return;
          }
          cv.classList.add("hidden");
        } catch (e) {}
      }
      setTimeout(fishIn, 350);
    })();
    const go = () => {
      if (sp2._go) return; sp2._go = true;
      Sound.ensure(); sfx("good");   // the press is the audio gesture — music arms through it
      try { if (window.Scene3D && Scene3D.hideCatch) Scene3D.hideCatch(document.getElementById("introFish")); } catch (e) {}
      sp2.classList.add("done");     // splash keeps eating taps while it fades — no ghost clicks
      setTimeout(() => sp2.remove(), 650);
    };
    const startBtn = document.getElementById("isStart");
    if (startBtn) startBtn.addEventListener("pointerdown", go);
    setTimeout(() => {
      if (sp2._go) return;
      const sub = document.getElementById("isSub");
      if (sub) sub.classList.add("hidden");
      if (startBtn) startBtn.classList.remove("hidden");
    }, 1900);
  })();
  requestAnimationFrame(frame);

  document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", e => e.preventDefault());
})();
