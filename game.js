/* BassBuddy — a simple, fun, rewarding bass fishing game for mobile.
   No dependencies. Single canvas scene + DOM HUD. State saved to localStorage. */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  const RODS = [
    { id: "twig",   name: "Twig Rod",      ico: "🎣", price: 0,    power: 1.0, luck: 0,    desc: "A humble start. Gets the job done." },
    { id: "carbon", name: "Carbon Caster", ico: "🪶", price: 120,  power: 1.25, luck: 0.08, desc: "Lighter line, bigger bass, fewer snaps." },
    { id: "pro",    name: "Pro Angler",    ico: "⚙️", price: 450,  power: 1.55, luck: 0.16, desc: "Tournament-grade. Lands the lunkers." },
    { id: "legend", name: "Legend Reel",   ico: "🌟", price: 1400, power: 1.9,  luck: 0.28, desc: "Whispered about on every dock." },
  ];

  // Each spot has its own fish table. Rarity weights are relative.
  const SPOTS = [
    {
      id: "cove", name: "Lily Cove", price: 0,
      sky: ["#7fd4e8", "#bff0f7"], water: ["#2a93b8", "#0a3a4a"],
      desc: "Calm starter waters full of friendly fish.",
      fish: [
        { name: "Bluegill",        emoji: "🐟", w: [0.2, 0.9],  rarity: "common",    weight: 50, value: 5 },
        { name: "Largemouth Bass", emoji: "🐠", w: [1.0, 5.5],  rarity: "common",    weight: 38, value: 10 },
        { name: "Smallmouth Bass", emoji: "🐡", w: [0.8, 4.0],  rarity: "uncommon",  weight: 18, value: 16 },
        { name: "Old Boot",        emoji: "🥾", w: [1.0, 2.0],  rarity: "junk",      weight: 10, value: 1 },
        { name: "Golden Bass",     emoji: "✨", w: [3.0, 8.0],  rarity: "rare",      weight: 4,  value: 60 },
      ],
    },
    {
      id: "river", name: "Rushing River", price: 200,
      sky: ["#9fdcc0", "#d7f3e6"], water: ["#2fae8e", "#0c4438"],
      desc: "Faster water, feistier fish, better pay.",
      fish: [
        { name: "Rainbow Trout",   emoji: "🌈", w: [0.6, 3.5],  rarity: "common",    weight: 40, value: 14 },
        { name: "Largemouth Bass", emoji: "🐠", w: [1.5, 6.5],  rarity: "common",    weight: 30, value: 16 },
        { name: "Catfish",         emoji: "🐱", w: [2.0, 12.0], rarity: "uncommon",  weight: 18, value: 28 },
        { name: "Tin Can",         emoji: "🥫", w: [0.3, 0.6],  rarity: "junk",      weight: 8,  value: 1 },
        { name: "Tiger Muskie",    emoji: "🐅", w: [5.0, 18.0], rarity: "rare",      weight: 4,  value: 95 },
      ],
    },
    {
      id: "deep", name: "Midnight Lake", price: 900,
      sky: ["#3a4b7a", "#1b2447"], water: ["#243a78", "#070d2a"],
      desc: "Deep, dark, and full of trophies.",
      fish: [
        { name: "Walleye",         emoji: "👁️", w: [1.0, 7.0],  rarity: "common",    weight: 34, value: 22 },
        { name: "Giant Bass",      emoji: "🐋", w: [6.0, 16.0], rarity: "uncommon",  weight: 26, value: 45 },
        { name: "Sturgeon",        emoji: "🦈", w: [10.0, 40.0],rarity: "rare",      weight: 12, value: 130 },
        { name: "Lake Monster",    emoji: "🐉", w: [30.0, 90.0],rarity: "legendary", weight: 3,  value: 500 },
        { name: "Glowfish",        emoji: "💎", w: [2.0, 6.0],  rarity: "rare",      weight: 8,  value: 120 },
      ],
    },
  ];

  const RARITY_COLOR = {
    junk:      "#8a96a0",
    common:    "#9fb3bf",
    uncommon:  "#5be37a",
    rare:      "#5c9bff",
    legendary: "#ffd35c",
  };
  const RARITY_MULT = { junk: 0.5, common: 1, uncommon: 1.4, rare: 2.2, legendary: 4 };

  // ---------------------------------------------------------------------------
  // Save / state
  // ---------------------------------------------------------------------------
  const SAVE_KEY = "bassbuddy_v1";
  function defaultSave() {
    return {
      coins: 0,
      rod: "twig",
      ownedRods: ["twig"],
      spot: "cove",
      ownedSpots: ["cove"],
      records: {}, // fishName -> best weight
      caught: {},  // fishName -> count
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.coins === "number") return Object.assign(defaultSave(), s);
    } catch (e) {}
    return defaultSave();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
  }
  const G = load();

  function rod() { return RODS.find(r => r.id === G.rod) || RODS[0]; }
  function spot() { return SPOTS.find(s => s.id === G.spot) || SPOTS[0]; }

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  const canvas = $("c"), ctx = canvas.getContext("2d");
  const el = {
    coins: $("coins"), rodName: $("rodName"), spotName: $("spotName"),
    status: $("status"), actionBtn: $("actionBtn"),
    castMeter: $("castMeter"), castFill: $("castFill"),
    reelGame: $("reelGame"), reelZone: $("reelZone"), reelFishMark: $("reelFishMark"),
    reelProgress: $("reelProgress"), reelTension: $("reelTension"),
    catchModal: $("catchModal"), catchRarity: $("catchRarity"), catchEmoji: $("catchEmoji"),
    catchName: $("catchName"), catchWeight: $("catchWeight"), catchReward: $("catchReward"),
    catchRecord: $("catchRecord"), catchOk: $("catchOk"),
    failModal: $("failModal"), failMsg: $("failMsg"), failOk: $("failOk"),
    shopBtn: $("shopBtn"), shopModal: $("shopModal"), shopClose: $("shopClose"),
    shopCoins: $("shopCoins"), shopRods: $("shopRods"), shopSpots: $("shopSpots"), shopDex: $("shopDex"),
    fx: $("fx"),
  };

  // ---------------------------------------------------------------------------
  // Canvas sizing
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Game state machine
  //   idle -> charging -> casting -> waiting -> bite -> reeling -> (caught|fail)
  // ---------------------------------------------------------------------------
  const S = {
    mode: "idle",
    t: 0,                  // generic timer (ms in current mode-ish)
    castPower: 0,          // 0..1
    castDir: 1,
    bobber: { x: 0, y: 0, targetX: 0, targetY: 0, flyT: 0 },
    biteTimer: 0,
    biteWindow: 0,         // ms remaining to hook after bite
    hookedFish: null,
    // reeling
    reel: { fishPos: 0.5, fishVel: 0, zoneCenter: 0.5, zoneSize: 0.28, progress: 0, vy: 0, jitter: 1, speed: 1 },
    holding: false,
    fishes: [],            // ambient swimming fish for the scene
    ripples: [],
  };

  const waterLine = () => H * 0.42;

  // ambient fish in the scene
  function seedFish() {
    S.fishes = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function setStatus(txt, bite) {
    el.status.textContent = txt || "";
    el.status.classList.toggle("bite", !!bite);
    el.status.style.opacity = txt ? "1" : "0";
  }
  function setBtn(txt, cls) {
    el.actionBtn.textContent = txt;
    el.actionBtn.className = "action-btn" + (cls ? " " + cls : "");
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function floatText(txt, color) {
    const d = document.createElement("div");
    d.className = "float";
    d.textContent = txt;
    if (color) d.style.color = color;
    d.style.left = (W / 2 - 30 + rnd(-20, 20)) + "px";
    d.style.top = (H * 0.5) + "px";
    el.fx.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

  function updateHUD() {
    el.coins.textContent = G.coins;
    el.rodName.textContent = rod().name;
    el.spotName.textContent = spot().name;
  }

  // ---------------------------------------------------------------------------
  // Fish selection
  // ---------------------------------------------------------------------------
  function pickFish() {
    const sp = spot();
    const luck = rod().luck;
    // luck shifts weights toward rarer fish
    const table = sp.fish.map(f => {
      let w = f.weight;
      if (f.rarity === "rare") w *= 1 + luck * 4;
      if (f.rarity === "legendary") w *= 1 + luck * 6;
      if (f.rarity === "junk") w *= Math.max(0.2, 1 - luck * 2);
      return { f, w };
    });
    const total = table.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let chosen = table[0].f;
    for (const x of table) { r -= x.w; if (r <= 0) { chosen = x.f; break; } }

    // weight: bias bigger with rod power
    const lo = chosen.w[0], hi = chosen.w[1];
    const bias = clamp(0.5 + (rod().power - 1) * 0.4, 0.3, 0.9);
    const roll = Math.pow(Math.random(), 1.6 - bias); // skew
    const weight = +(lo + (hi - lo) * roll).toFixed(1);

    // difficulty 0..1 from weight relative to its range + rarity
    const rangeFrac = (weight - lo) / Math.max(0.01, hi - lo);
    const rarityHard = { junk: 0.05, common: 0.2, uncommon: 0.4, rare: 0.65, legendary: 0.9 }[chosen.rarity];
    const difficulty = clamp(rarityHard * 0.6 + rangeFrac * 0.5, 0.05, 0.98);

    const value = Math.max(1, Math.round(chosen.value * (0.6 + weight / hi) * RARITY_MULT[chosen.rarity]));
    return { ...chosen, weight, difficulty, value };
  }

  // ---------------------------------------------------------------------------
  // Input — action button drives the whole flow
  // ---------------------------------------------------------------------------
  function pressStart(e) {
    e.preventDefault();
    if (S.mode === "idle") {
      S.mode = "charging";
      S.castPower = 0; S.castDir = 1;
      el.castMeter.classList.remove("hidden");
      setStatus("");
      setBtn("RELEASE TO CAST!", "");
    } else if (S.mode === "reeling") {
      S.holding = true;
    }
  }
  function pressEnd(e) {
    e.preventDefault();
    if (S.mode === "charging") {
      el.castMeter.classList.add("hidden");
      doCast(S.castPower);
    } else if (S.mode === "bite") {
      // tapping during bite = hook set
      hookSet();
    } else if (S.mode === "reeling") {
      S.holding = false;
    }
  }

  el.actionBtn.addEventListener("pointerdown", pressStart);
  el.actionBtn.addEventListener("pointerup", pressEnd);
  el.actionBtn.addEventListener("pointercancel", pressEnd);
  el.actionBtn.addEventListener("pointerleave", function (e) {
    // releasing finger off-button while reeling shouldn't keep holding
    if (S.mode === "reeling") S.holding = false;
  });

  // ---------------------------------------------------------------------------
  // Flow steps
  // ---------------------------------------------------------------------------
  function doCast(power) {
    S.mode = "casting";
    S.bobber.flyT = 0;
    // start at rod tip (bottom center), arc out to a spot on the water
    const startX = W / 2, startY = H - 120;
    const dist = 0.25 + power * 0.7;       // fraction across screen
    const tx = clamp(W / 2 + (Math.random() < 0.5 ? -1 : 1) * dist * W * 0.42, 40, W - 40);
    const ty = waterLine() + 30 + (1 - power) * 40 + rnd(0, (H - waterLine()) * 0.5 * power);
    S.bobber.x = startX; S.bobber.y = startY;
    S.bobber.sx = startX; S.bobber.sy = startY;
    S.bobber.targetX = tx; S.bobber.targetY = clamp(ty, waterLine() + 20, H - 150);
    S.castPower = power;
    setBtn("…", "");
    el.actionBtn.disabled = true;
    setStatus("");
  }

  function startWaiting() {
    S.mode = "waiting";
    el.actionBtn.disabled = false;
    setBtn("WAITING FOR A BITE…", "");
    el.actionBtn.disabled = true;
    setStatus("Wait for it…");
    // better casts (more power) bite a touch faster on average
    S.biteTimer = rnd(1100, 4200) - S.castPower * 700;
    ripple(S.bobber.x, S.bobber.y);
  }

  function triggerBite() {
    S.mode = "bite";
    S.hookedFish = pickFish();
    // window to react scales (harder fish = snappier)
    S.biteWindow = 1500 - S.hookedFish.difficulty * 650;
    el.actionBtn.disabled = false;
    setBtn("TAP TO HOOK!", "hook");
    setStatus("FISH ON!", true);
    vibrate(40);
    ripple(S.bobber.x, S.bobber.y);
    ripple(S.bobber.x, S.bobber.y);
  }

  function missedBite() {
    S.mode = "idle";
    S.hookedFish = null;
    setStatus("");
    setBtn("TAP & HOLD TO CAST", "");
    el.actionBtn.disabled = false;
    showFail("Too slow — it spat the hook!");
  }

  function hookSet() {
    const f = S.hookedFish;
    S.mode = "reeling";
    setStatus("");
    setBtn("HOLD TO REEL!", "reel");
    el.reelGame.classList.remove("hidden");
    el.reelTension.classList.remove("hidden");
    // configure minigame from difficulty (0..1). Bigger rod => bigger catch-bar.
    const d = f.difficulty;
    S.reel.fishPos = 0.5;        // 0 = top, 1 = bottom
    S.reel.fishVel = 0;
    S.reel.zoneCenter = 0.5;     // your catch-bar center
    S.reel.vy = 0;
    S.reel.progress = 0.12;      // start with a little buffer
    S.reel.zoneSize = clamp(0.30 - d * 0.14, 0.13, 0.30) * (1 + rod().power * 0.10);
    S.reel.jitter = 0.5 + d * 1.6;   // erratic darting
    S.reel.speed = 0.5 + d * 0.9;    // swim speed
    el.reelFishMark.textContent = f.emoji;
    S.holding = false;
    vibrate(30);
  }

  function landFish() {
    const f = S.hookedFish;
    S.mode = "caught";
    el.reelGame.classList.add("hidden");
    el.reelTension.classList.add("hidden");
    el.actionBtn.disabled = true;

    // rewards + records
    G.coins += f.value;
    G.caught[f.name] = (G.caught[f.name] || 0) + 1;
    const prev = G.records[f.name] || 0;
    const isRecord = f.weight > prev;
    if (isRecord) G.records[f.name] = f.weight;
    save();
    updateHUD();
    vibrate([20, 40, 30]);

    // populate modal
    el.catchRarity.textContent = f.rarity.toUpperCase();
    el.catchRarity.style.background = RARITY_COLOR[f.rarity];
    el.catchRarity.style.color = f.rarity === "legendary" ? "#5a3a00" : "#06222c";
    el.catchEmoji.textContent = f.emoji;
    el.catchName.textContent = f.name;
    el.catchWeight.textContent = f.weight;
    el.catchReward.textContent = f.value;
    el.catchRecord.textContent = isRecord && prev > 0 ? "🏆 NEW PERSONAL BEST!"
      : isRecord ? "🏆 FIRST CATCH!" : "";
    el.catchModal.classList.remove("hidden");
  }

  function loseFish(msg) {
    S.mode = "idle";
    el.reelGame.classList.add("hidden");
    el.reelTension.classList.add("hidden");
    setStatus("");
    setBtn("TAP & HOLD TO CAST", "");
    el.actionBtn.disabled = false;
    vibrate(120);
    showFail(msg || "The line snapped!");
  }

  function showFail(msg) {
    el.failMsg.textContent = msg;
    el.failModal.classList.remove("hidden");
  }

  function resetToIdle() {
    S.mode = "idle";
    S.hookedFish = null;
    setStatus("");
    setBtn("TAP & HOLD TO CAST", "");
    el.actionBtn.disabled = false;
  }

  // ---------------------------------------------------------------------------
  // Ripples
  // ---------------------------------------------------------------------------
  function ripple(x, y) { S.ripples.push({ x, y, r: 4, a: 0.7 }); }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }

  function update(dt, now) {
    // charging power oscillates
    if (S.mode === "charging") {
      S.castPower += S.castDir * dt * 0.0016;
      if (S.castPower >= 1) { S.castPower = 1; S.castDir = -1; }
      if (S.castPower <= 0) { S.castPower = 0; S.castDir = 1; }
      el.castFill.style.width = (S.castPower * 100) + "%";
    }

    // bobber flying
    if (S.mode === "casting") {
      S.bobber.flyT += dt / 520;
      const p = clamp(S.bobber.flyT, 0, 1);
      const ease = p;
      S.bobber.x = S.bobber.sx + (S.bobber.targetX - S.bobber.sx) * ease;
      // parabolic arc
      const arc = Math.sin(p * Math.PI) * 120 * (0.5 + S.castPower);
      S.bobber.y = S.bobber.sy + (S.bobber.targetY - S.bobber.sy) * ease - arc;
      if (p >= 1) { S.bobber.y = S.bobber.targetY; startWaiting(); }
    }

    // waiting -> bite
    if (S.mode === "waiting") {
      S.biteTimer -= dt;
      S.bobber.y = S.bobber.targetY + Math.sin(now / 600) * 3;
      if (S.biteTimer <= 0) triggerBite();
    }

    // bite reaction window
    if (S.mode === "bite") {
      S.biteWindow -= dt;
      S.bobber.y = S.bobber.targetY + Math.sin(now / 70) * 6; // jiggle hard
      if (Math.random() < 0.25) ripple(S.bobber.x, S.bobber.y);
      if (S.biteWindow <= 0) missedBite();
    }

    // reeling minigame
    if (S.mode === "reeling") updateReel(dt, now);

    // ambient fish
    for (const f of S.fishes) {
      f.x += f.dir * f.spd * dt * 0.06;
      f.wob += dt * 0.004;
      if (f.x < -30) { f.x = W + 30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
      if (f.x > W + 30) { f.x = -30; f.y = waterLine() + 40 + Math.random() * (H - waterLine() - 160); }
    }

    // ripples
    for (const r of S.ripples) { r.r += dt * 0.05; r.a -= dt * 0.0012; }
    S.ripples = S.ripples.filter(r => r.a > 0);
  }

  function updateReel(dt, now) {
    const R = S.reel;
    const d = S.hookedFish.difficulty;
    const step = dt / 16.67; // normalize to ~frames

    // Fish wanders up/down (0=top,1=bottom) and occasionally darts
    R.fishVel += (Math.random() - 0.5) * R.jitter * 0.004 * step;
    if (Math.random() < (0.02 + d * 0.03) * step) R.fishVel += (Math.random() - 0.5) * R.speed * 0.04;
    R.fishVel = clamp(R.fishVel, -0.02 * R.speed, 0.02 * R.speed);
    R.fishPos += R.fishVel * step;
    if (R.fishPos < 0.06) { R.fishPos = 0.06; R.fishVel = Math.abs(R.fishVel); }
    if (R.fishPos > 0.94) { R.fishPos = 0.94; R.fishVel = -Math.abs(R.fishVel); }

    // Your catch-bar: HOLD lifts it up (center -> 0), RELEASE = gravity pulls down
    if (S.holding) R.vy -= 0.0011 * step;
    else R.vy += 0.0009 * step;
    R.vy *= 0.90;
    R.zoneCenter += R.vy * step;
    const half = R.zoneSize / 2;
    if (R.zoneCenter < half) { R.zoneCenter = half; R.vy = 0; }
    if (R.zoneCenter > 1 - half) { R.zoneCenter = 1 - half; R.vy = 0; }

    const onFish = Math.abs(R.zoneCenter - R.fishPos) < half;

    if (onFish) {
      // reel in — faster when on target; harder fish reel slower
      R.progress += 0.0052 * (1.25 - d * 0.45) * step;
      el.reelTension.classList.remove("warn");
      el.reelTension.textContent = "REEL IT IN!";
    } else {
      // forgiving: progress slips slowly, no instant snap
      R.progress -= 0.0016 * (0.7 + d * 0.6) * step;
      el.reelTension.classList.add("warn");
      el.reelTension.textContent = "KEEP ON IT!";
    }

    if (R.progress >= 1) { landFish(); return; }
    if (R.progress <= 0) { loseFish("The bass slipped the hook!"); return; }

    // visuals (vertical: top% positioning)
    el.reelProgress.style.height = (R.progress * 100) + "%";
    el.reelZone.style.height = (R.zoneSize * 100) + "%";
    el.reelZone.style.top = ((R.zoneCenter - half) * 100) + "%";
    el.reelFishMark.style.top = (R.fishPos * 100) + "%";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function render(now) {
    const sp = spot();
    const wl = waterLine();

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, wl);
    sky.addColorStop(0, sp.sky[0]); sky.addColorStop(1, sp.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, wl);

    // sun / moon
    const isNight = sp.id === "deep";
    ctx.beginPath();
    ctx.arc(W * 0.78, wl * 0.42, 34, 0, 6.29);
    ctx.fillStyle = isNight ? "rgba(230,235,255,.9)" : "rgba(255,238,170,.95)";
    ctx.fill();

    // distant hills
    ctx.fillStyle = isNight ? "rgba(20,30,60,.6)" : "rgba(70,150,120,.45)";
    ctx.beginPath();
    ctx.moveTo(0, wl);
    for (let x = 0; x <= W; x += 40) {
      ctx.lineTo(x, wl - 26 - Math.sin(x * 0.01 + 1) * 18 - Math.sin(x * 0.03) * 8);
    }
    ctx.lineTo(W, wl); ctx.closePath(); ctx.fill();

    // water
    const water = ctx.createLinearGradient(0, wl, 0, H);
    water.addColorStop(0, sp.water[0]); water.addColorStop(1, sp.water[1]);
    ctx.fillStyle = water;
    ctx.fillRect(0, wl, W, H - wl);

    // water shimmer lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = wl + 20 + i * (H - wl) / 8;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 24) {
        const yy = y + Math.sin(x * 0.03 + now / 700 + i) * 3;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // ambient fish (silhouettes under water)
    for (const f of S.fishes) {
      ctx.save();
      ctx.translate(f.x, f.y + Math.sin(f.wob) * 3);
      ctx.scale(f.dir, 1);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, 6.29);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-f.size, 0);
      ctx.lineTo(-f.size - 8, -6);
      ctx.lineTo(-f.size - 8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ripples
    for (const r of S.ripples) {
      ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, r.a) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 6.29);
      ctx.stroke();
    }

    // angler + rod (simple silhouette bottom-left)
    drawAngler();

    // line + bobber when in play
    if (["casting", "waiting", "bite", "reeling"].includes(S.mode)) {
      const tipX = W / 2 + 64, tipY = H - 188;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      // gentle sag toward bobber
      const midX = (tipX + S.bobber.x) / 2;
      const midY = (tipY + S.bobber.y) / 2 + 18;
      ctx.quadraticCurveTo(midX, midY, S.bobber.x, S.bobber.y);
      ctx.stroke();

      // bobber
      ctx.beginPath();
      ctx.arc(S.bobber.x, S.bobber.y, 7, 0, 6.29);
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath();
      ctx.arc(S.bobber.x, S.bobber.y - 1, 7, Math.PI, 0);
      ctx.fillStyle = "#ff4d3d"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.3)";
      ctx.beginPath(); ctx.arc(S.bobber.x, S.bobber.y, 7, 0, 6.29); ctx.stroke();
    }
  }

  function drawAngler() {
    const x = W / 2, y = H - 150;
    ctx.save();
    // little dock
    ctx.fillStyle = "rgba(60,40,25,.7)";
    ctx.fillRect(x - 70, y + 40, 90, 10);
    // body
    ctx.fillStyle = "rgba(20,30,40,.85)";
    ctx.beginPath();
    ctx.ellipse(x - 30, y + 22, 16, 22, 0, 0, 6.29); // torso
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 30, y - 6, 11, 0, 6.29); // head
    ctx.fill();
    // hat
    ctx.fillStyle = "rgba(40,90,70,.9)";
    ctx.beginPath();
    ctx.ellipse(x - 30, y - 14, 16, 5, 0, 0, 6.29);
    ctx.fill();
    ctx.fillRect(x - 38, y - 24, 16, 11);
    // rod
    ctx.strokeStyle = "rgba(120,80,40,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 20, y + 6);
    ctx.lineTo(x + 64, y - 38);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Modals: catch / fail
  // ---------------------------------------------------------------------------
  el.catchOk.addEventListener("click", () => {
    el.catchModal.classList.add("hidden");
    floatText("+" + S.hookedFish.value + " 🪙", "#ffd35c");
    resetToIdle();
  });
  el.failOk.addEventListener("click", () => {
    el.failModal.classList.add("hidden");
    resetToIdle();
  });

  // ---------------------------------------------------------------------------
  // Shop
  // ---------------------------------------------------------------------------
  function openShop() {
    el.shopModal.classList.remove("hidden");
    renderShop();
  }
  function renderShop() {
    el.shopCoins.textContent = G.coins;
    // Rods
    el.shopRods.innerHTML = "";
    RODS.forEach(r => {
      const owned = G.ownedRods.includes(r.id);
      const equipped = G.rod === r.id;
      const btn = owned
        ? (equipped ? `<button class="item-btn equipped" disabled>EQUIPPED</button>`
                    : `<button class="item-btn owned" data-equip-rod="${r.id}">EQUIP</button>`)
        : `<button class="item-btn buy" data-buy-rod="${r.id}" ${G.coins < r.price ? "disabled" : ""}>${r.price} 🪙</button>`;
      el.shopRods.insertAdjacentHTML("beforeend", `
        <div class="item">
          <div class="item-ico">${r.ico}</div>
          <div class="item-info">
            <div class="item-name">${r.name}</div>
            <div class="item-desc">${r.desc} · Power ${r.power.toFixed(2)}× · Luck +${Math.round(r.luck*100)}%</div>
          </div>
          ${btn}
        </div>`);
    });
    // Spots
    el.shopSpots.innerHTML = "";
    SPOTS.forEach(s => {
      const owned = G.ownedSpots.includes(s.id);
      const active = G.spot === s.id;
      const btn = owned
        ? (active ? `<button class="item-btn equipped" disabled>FISHING</button>`
                  : `<button class="item-btn owned" data-go-spot="${s.id}">GO</button>`)
        : `<button class="item-btn buy" data-buy-spot="${s.id}" ${G.coins < s.price ? "disabled" : ""}>${s.price} 🪙</button>`;
      el.shopSpots.insertAdjacentHTML("beforeend", `
        <div class="item">
          <div class="item-ico">${s.id === "deep" ? "🌙" : s.id === "river" ? "🏞️" : "🌿"}</div>
          <div class="item-info">
            <div class="item-name">${s.name}</div>
            <div class="item-desc">${s.desc}</div>
          </div>
          ${btn}
        </div>`);
    });
    // Fish-Dex
    el.shopDex.innerHTML = `<div class="dex-grid"></div>`;
    const grid = el.shopDex.querySelector(".dex-grid");
    const seen = new Set();
    SPOTS.forEach(s => s.fish.forEach(f => {
      if (seen.has(f.name)) return; seen.add(f.name);
      const caught = G.caught[f.name];
      const best = G.records[f.name];
      grid.insertAdjacentHTML("beforeend", `
        <div class="dex-cell ${caught ? "" : "locked"}">
          <div class="e">${caught ? f.emoji : "❓"}</div>
          <div class="n">${caught ? f.name : "???"}</div>
          <div class="best">${best ? "🏆 " + best + " lb" : caught ? "" : ""}</div>
        </div>`);
    }));
  }

  el.shopBtn.addEventListener("click", openShop);
  el.shopClose.addEventListener("click", () => el.shopModal.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      const tab = t.dataset.tab;
      el.shopRods.classList.toggle("hidden", tab !== "rods");
      el.shopSpots.classList.toggle("hidden", tab !== "spots");
      el.shopDex.classList.toggle("hidden", tab !== "dex");
    });
  });

  // shop button delegation
  el.shopModal.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.buyRod) {
      const r = RODS.find(x => x.id === t.dataset.buyRod);
      if (G.coins >= r.price) { G.coins -= r.price; G.ownedRods.push(r.id); G.rod = r.id; save(); updateHUD(); renderShop(); }
    } else if (t.dataset.equipRod) {
      G.rod = t.dataset.equipRod; save(); updateHUD(); renderShop();
    } else if (t.dataset.buySpot) {
      const s = SPOTS.find(x => x.id === t.dataset.buySpot);
      if (G.coins >= s.price) { G.coins -= s.price; G.ownedSpots.push(s.id); G.spot = s.id; save(); updateHUD(); renderShop(); }
    } else if (t.dataset.goSpot) {
      if (S.mode !== "idle") { resetToIdle(); }
      G.spot = t.dataset.goSpot; save(); updateHUD(); seedFish(); renderShop();
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  updateHUD();
  setBtn("TAP & HOLD TO CAST", "");
  setStatus("Tap & hold the button to cast 🎣");
  requestAnimationFrame(frame);

  // prevent scroll/zoom gestures swallowing taps
  document.addEventListener("touchmove", e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", e => e.preventDefault());
})();
