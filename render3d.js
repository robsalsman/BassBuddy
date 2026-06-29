// =============================================================================
// BassBuddy — real-time 3D underwater renderer (Three.js, MIT).
// Driven by the 2D game's state each frame. Layered over the 2D canvas and
// shown only in the underwater view; if WebGL is unavailable the game falls
// back to the original 2D scene automatically (Scene3D just never goes ready).
// All geometry is original/procedural — no third-party art assets.
// =============================================================================
import * as THREE from "./vendor/three.module.min.js";

// =============================================================================
// Detailed, realistic procedural bass — shared by the fight, the 3D preview,
// and the catch screen. The skin is painted to an offscreen canvas (scales,
// flank gradient, species markings, gill plate, lateral line) and used as the
// colour map; a matching grayscale bump map gives the scales real relief under
// the lights. All original art — nothing sampled from another game.
// art = { body, belly, back?, patColor, pat:'lateral'|'bars'|'spots', eye, bigmouth }
// =============================================================================
function hexNum(c) { return (typeof c === "string") ? new THREE.Color(c).getHex() : c; }

function bassTextures(art) {
  const W = 1024, H = 384;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const bv = document.createElement("canvas"); bv.width = W; bv.height = H;
  const b = bv.getContext("2d");

  const body = new THREE.Color(art.body || "#6f9e4e");
  const back = art.back ? new THREE.Color(art.back) : body.clone().multiplyScalar(0.45);
  const belly = new THREE.Color(art.belly || "#eef1d6");
  const flank = body.clone().lerp(new THREE.Color("#ffffff"), 0.12);
  const css = c => `rgb(${(c.r*255)|0},${(c.g*255)|0},${(c.b*255)|0})`;

  // base flank gradient (v: 0=back .. 0.5=belly .. 1=back), mirrored
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, css(back));
  grad.addColorStop(0.18, css(body));
  grad.addColorStop(0.40, css(flank));
  grad.addColorStop(0.50, css(belly));
  grad.addColorStop(0.60, css(flank));
  grad.addColorStop(0.82, css(body));
  grad.addColorStop(1.00, css(back));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);

  // overlapping scales across the flanks (skip the very belly + back ridge)
  const sw = 26, sh = 18;
  for (let row = 1; row < H / sh - 1; row++) {
    const cy = row * sh, vy = cy / H;
    if (vy < 0.06 || vy > 0.94) continue;
    const bellyFade = 1 - Math.min(1, Math.abs(vy - 0.5) / 0.42); // scales fade into the belly
    for (let col = -1; col < W / sw + 1; col++) {
      const cx = col * sw + (row % 2 ? sw / 2 : 0);
      g.beginPath(); g.arc(cx, cy, sw * 0.62, Math.PI * 0.05, Math.PI * 0.95);
      g.strokeStyle = `rgba(0,0,0,${0.10 + bellyFade * 0.05})`; g.lineWidth = 1.4; g.stroke();
      g.beginPath(); g.arc(cx, cy - 1.5, sw * 0.6, Math.PI * 1.05, Math.PI * 1.95);
      g.strokeStyle = `rgba(255,255,255,${0.06 + bellyFade * 0.05})`; g.lineWidth = 1.2; g.stroke();
      // bump relief: bright top rim, dark bottom rim
      b.beginPath(); b.arc(cx, cy - 1.5, sw * 0.6, Math.PI * 1.05, Math.PI * 1.95); b.strokeStyle = "rgba(255,255,255,0.5)"; b.lineWidth = 2; b.stroke();
      b.beginPath(); b.arc(cx, cy, sw * 0.62, Math.PI * 0.05, Math.PI * 0.95); b.strokeStyle = "rgba(0,0,0,0.5)"; b.lineWidth = 2; b.stroke();
    }
  }

  // mottled olive blotching over the back/upper flank (both top bands)
  const pc = css(new THREE.Color(art.patColor || "#2a3618"));
  g.fillStyle = pc;
  for (const vy0 of [0.12, 0.88]) {
    g.globalAlpha = 0.16;
    for (let k = 0; k < 60; k++) {
      const x = Math.random() * W, y = (vy0 + (Math.random() - 0.5) * 0.16) * H, r = 5 + Math.random() * 12;
      g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, 6.28); g.fill();
    }
  }
  g.globalAlpha = 1;

  // species markings along the flanks (two mirrored bands: v≈0.30 and v≈0.70)
  for (const vy of [0.30, 0.70]) {
    const y = vy * H;
    if (art.pat === "lateral") {                       // largemouth: bold, broken, jagged lateral stripe
      g.fillStyle = pc; g.globalAlpha = 0.6;
      g.beginPath(); g.moveTo(W * 0.08, y);
      for (let x = W * 0.08; x <= W * 0.88; x += 12) g.lineTo(x, y - (6 + Math.abs(Math.sin(x * 0.06) * 7 + Math.sin(x * 0.17) * 5)));
      for (let x = W * 0.88; x >= W * 0.08; x -= 12) g.lineTo(x, y + (6 + Math.abs(Math.cos(x * 0.05) * 7 + Math.sin(x * 0.21) * 4)));
      g.closePath(); g.fill();
      // dark diamond blotches strung along the stripe
      g.globalAlpha = 0.5;
      for (let x = W * 0.12; x < W * 0.85; x += W * 0.10) { g.beginPath(); g.ellipse(x, y, 9, 13 + Math.sin(x) * 3, 0, 0, 6.28); g.fill(); }
    } else if (art.pat === "bars") {                   // smallmouth: vertical bronze bars
      g.fillStyle = pc; g.globalAlpha = 0.42;
      for (let x = W * 0.16; x < W * 0.82; x += W * 0.085) {
        const bw = 10 + Math.sin(x) * 3; g.fillRect(x - bw / 2, vy < 0.5 ? y - 40 : y, bw, 64);
      }
    } else if (art.pat === "spots") {                  // spotted: rows of small dark spots
      g.fillStyle = pc; g.globalAlpha = 0.5;
      for (let x = W * 0.12; x < W * 0.84; x += 26) {
        g.beginPath(); g.arc(x, y + 18, 4.5, 0, 6.28); g.fill();
        g.beginPath(); g.arc(x + 13, y + 38, 4, 0, 6.28); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // gill plate near the head + reddish gill margin, and a shaded cheek
  const gx = W * 0.80;
  g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(gx, H * 0.10); g.quadraticCurveTo(gx - 30, H * 0.5, gx, H * 0.90); g.stroke();
  b.strokeStyle = "rgba(40,40,40,1)"; b.lineWidth = 4;
  b.beginPath(); b.moveTo(gx, H * 0.10); b.quadraticCurveTo(gx - 30, H * 0.5, gx, H * 0.90); b.stroke();
  g.strokeStyle = "rgba(150,40,40,0.30)"; g.lineWidth = 6;
  g.beginPath(); g.moveTo(gx + 2, H * 0.18); g.quadraticCurveTo(gx - 26, H * 0.5, gx + 2, H * 0.82); g.stroke();
  // dark mouth gape at the snout, lower jaw
  g.fillStyle = "rgba(15,10,8,0.7)";
  g.beginPath(); g.ellipse(W * 0.96, H * 0.62, W * 0.05, H * 0.06, 0, 0, 6.28); g.fill();

  const map = new THREE.CanvasTexture(cv);
  const bump = new THREE.CanvasTexture(bv);
  map.anisotropy = 4;
  return { map, bump };
}

function makeBass(art) {
  art = art || {};
  const LEN = 2.4, SEG = 80, RING = 28;
  const group = new THREE.Group();

  const depth = t => {
    const bd = Math.sin(Math.pow(Math.min(t, 1), 1.2) * Math.PI);
    let d = 0.05 + bd * 0.50;
    if (t > 0.84) d = Math.max(d, 0.34) * (1 - (t - 0.84) / 0.16 * 0.62);
    if (t < 0.10) d *= t / 0.10;
    return d;
  };
  const widthFac = t => 0.34 + Math.sin(Math.min(t, 1) * Math.PI) * 0.12;

  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, x = (t - 0.5) * LEN, d = depth(t), w = widthFac(t);
    for (let j = 0; j <= RING; j++) {
      const a = j / RING * Math.PI * 2;
      positions.push(x, Math.cos(a) * d, Math.sin(a) * d * w);
      uvs.push(t, j / RING);
    }
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RING; j++) {
    const a = i * (RING + 1) + j, bb = a + RING + 1;
    indices.push(a, bb, a + 1, bb, bb + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();

  const { map, bump } = bassTextures(art);
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.04, roughness: 0.42, metalness: 0.16 });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  group.geo = geo; group.basePos = Float32Array.from(positions); group.len = LEN;
  group.disposables = [geo, mat, map, bump];

  // fins — translucent membrane with faint rays painted on
  const finCv = document.createElement("canvas"); finCv.width = 64; finCv.height = 64;
  const fg = finCv.getContext("2d");
  const finCol = new THREE.Color(art.back || (new THREE.Color(art.body || "#6f9e4e")).multiplyScalar(0.5));
  fg.fillStyle = `rgba(${(finCol.r*255)|0},${(finCol.g*255)|0},${(finCol.b*255)|0},0.92)`; fg.fillRect(0, 0, 64, 64);
  fg.strokeStyle = "rgba(0,0,0,0.22)"; fg.lineWidth = 1.5;
  for (let i = 4; i < 64; i += 7) { fg.beginPath(); fg.moveTo(i, 0); fg.lineTo(i - 6, 64); fg.stroke(); }
  const finTex = new THREE.CanvasTexture(finCv);
  const finMat = new THREE.MeshStandardMaterial({ map: finTex, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  group.disposables.push(finTex, finMat);

  const tail = new THREE.Shape();
  tail.moveTo(0, 0); tail.lineTo(-0.78, 0.66); tail.lineTo(-0.62, 0.30); tail.lineTo(-0.5, 0);
  tail.lineTo(-0.62, -0.30); tail.lineTo(-0.78, -0.66); tail.closePath();
  const tailMesh = new THREE.Mesh(new THREE.ShapeGeometry(tail), finMat);
  tailMesh.position.x = -LEN / 2 + 0.04; group.add(tailMesh); group.tail = tailMesh;

  // split dorsal: spiny front + soft rear
  const spiny = new THREE.Shape();
  spiny.moveTo(-0.1, 0); spiny.lineTo(0.05, 0.40); spiny.lineTo(0.25, 0.30); spiny.lineTo(0.45, 0.42); spiny.lineTo(0.6, 0.30); spiny.lineTo(0.7, 0); spiny.closePath();
  const sd = new THREE.Mesh(new THREE.ShapeGeometry(spiny), finMat);
  sd.rotation.y = Math.PI / 2; sd.position.set(LEN * 0.06, depth(0.55) * 0.98, 0); group.add(sd);
  const soft = new THREE.Shape();
  soft.moveTo(-0.7, 0); soft.quadraticCurveTo(-0.45, 0.42, -0.1, 0.30); soft.lineTo(-0.05, 0); soft.closePath();
  const softD = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
  softD.rotation.y = Math.PI / 2; softD.position.set(-LEN * 0.18, depth(0.4) * 0.98, 0); group.add(softD);
  // anal fin (underside)
  const af = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
  af.rotation.y = Math.PI / 2; af.scale.set(0.6, -0.6, 0.6); af.position.set(-LEN * 0.22, -depth(0.34) * 0.95, 0); group.add(af);
  // pectoral + pelvic fins
  for (const s of [1, -1]) {
    const pf = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
    pf.scale.set(0.42, 0.42, 0.42); pf.rotation.x = s * 0.9; pf.rotation.z = -0.4;
    pf.position.set(LEN * 0.20, -depth(0.7) * 0.25, s * depth(0.7) * widthFac(0.7) * 0.95); group.add(pf);
    const pv = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
    pv.scale.set(0.28, 0.28, 0.28); pv.rotation.x = s * 1.1;
    pv.position.set(LEN * 0.06, -depth(0.55) * 0.85, s * depth(0.55) * widthFac(0.55) * 0.6); group.add(pv);
  }

  // eyes — glossy: white sclera, coloured iris, black pupil, specular dot
  const ex = LEN * 0.36, ed = depth(0.86);
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf6f3e8, roughness: 0.25 });
  const irisMat = new THREE.MeshStandardMaterial({ color: hexNum(art.eye || "#caa23a"), roughness: 0.2, metalness: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.1 });
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [1, -1]) {
    const zc = s * ed * widthFac(0.86);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), scleraMat); ew.position.set(ex, ed * 0.5, zc * 0.9); group.add(ew);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), irisMat); ir.position.set(ex + 0.04, ed * 0.5, zc * 1.0); group.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), pupilMat); pu.position.set(ex + 0.06, ed * 0.5, zc * 1.05); group.add(pu);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), hiMat); hi.position.set(ex + 0.07, ed * 0.56, zc * 1.06); group.add(hi);
  }
  // tracked mouth point at the front of the head, so a hooked line attaches here
  group.mouth = new THREE.Object3D(); group.mouth.position.set(LEN * 0.52, -depth(0.95) * 0.1, 0); group.add(group.mouth);
  return group;
}

const Scene3D = (() => {
  let renderer, scene, camera, canvas, ready = false, visible = false;
  let surf, bottom, motes, biteSlab, biteEdgeTop, biteEdgeBot;
  let lureGroup, lineMesh, fightFish, fightArtKey = "";
  let pursuers = [], rays = [];
  const clock = { t: 0 };

  // surface world (above the water — idle / aim / cast)
  let scene2, camS, water, sunS, sunMesh, sunGlow, boat, aimRing, castLine, castLure;
  let fishShadows = [], hills, structProps, world;
  let skyKey = "";
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ray = new THREE.Raycaster();
  const ROD_S = new THREE.Vector3(0.45, 0.95, 3.6);   // rod tip in the surface scene

  // depth (0 surface .. 1 deep) -> world Y ; line-dist (0 boat .. 1 far) -> world X
  const yOf = d => 2.8 - d * 7.2;
  const xOf = dist => -3.0 + dist * 6.8;
  const ROD = new THREE.Vector3(-3.7, 2.7, 0.2);

  function init(cv) {
    canvas = cv;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    resize();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a3a4a);   // opaque so it fully covers the 2D layer
    scene.fog = new THREE.FogExp2(0x0d3f55, 0.052);

    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, -0.3, 9.4);
    camera.lookAt(0.2, -0.7, 0);

    scene.add(new THREE.HemisphereLight(0xcdeeff, 0x09232f, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2cf, 1.45);
    sun.position.set(2, 9, 5); scene.add(sun);

    // underside of the water surface
    surf = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x2a93b8, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
    );
    surf.rotation.x = -Math.PI / 2; surf.position.y = 2.9; scene.add(surf);

    // god-ray cones from the surface
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 12, 8, 1, true), rayMat);
      cone.position.set((i - 2) * 2.6, 2, -3 - (i % 3)); cone.rotation.x = Math.PI; cone.rotation.z = (i - 2) * 0.05;
      scene.add(cone); rays.push(cone);
    }

    // murky bottom
    bottom = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0a3247, roughness: 1 }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = -4.5; scene.add(bottom);

    // drifting particulate
    const pc = 220, pg = new THREE.BufferGeometry(), pa = new Float32Array(pc * 3);
    for (let i = 0; i < pc; i++) { pa[i*3] = (Math.random()-0.5)*24; pa[i*3+1] = (Math.random()-0.5)*14; pa[i*3+2] = (Math.random()-0.5)*16; }
    pg.setAttribute("position", new THREE.BufferAttribute(pa, 3));
    motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xcfeefb, size: 0.04, transparent: true, opacity: 0.5 }));
    scene.add(motes);

    // bite-zone slab + dashed-look edges
    biteSlab = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.1, 7),
      new THREE.MeshBasicMaterial({ color: 0x5be37a, transparent: true, opacity: 0.14, depthWrite: false })
    );
    scene.add(biteSlab);
    const edgeMat = () => new THREE.MeshBasicMaterial({ color: 0x78f096, transparent: true, opacity: 0.6, depthWrite: false });
    biteEdgeTop = new THREE.Mesh(new THREE.BoxGeometry(13, 0.02, 7), edgeMat());
    biteEdgeBot = new THREE.Mesh(new THREE.BoxGeometry(13, 0.02, 7), edgeMat());
    scene.add(biteEdgeTop); scene.add(biteEdgeBot);

    // the lure + its line
    lureGroup = buildLure(); scene.add(lureGroup);
    lineMesh = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([ROD.clone(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    );
    scene.add(lineMesh);

    // pursuer pool — real detailed bass that swim in to chase the lure
    const PURSUER_ART = { body: "#5f8f4a", belly: "#dfe7c2", patColor: "#2c3a1c", pat: "lateral", eye: "#caa23a", bigmouth: true };
    for (let i = 0; i < 3; i++) { const p = makeBass(PURSUER_ART); p.visible = false; scene.add(p); pursuers.push(p); }

    buildSurface();

    addEventListener("resize", resize);
    ready = true;
    return true;
  }

  // ===========================================================================
  // Surface world
  // ===========================================================================
  function skyTexture(top, bot) {
    const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256;
    const g = cv.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top); grd.addColorStop(1, bot);
    g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
    const tx = new THREE.CanvasTexture(cv); return tx;
  }
  function rippleBump() {
    const N = 256, cv = document.createElement("canvas"); cv.width = N; cv.height = N;
    const g = cv.getContext("2d");
    g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * N, y = Math.random() * N, r = 6 + Math.random() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.5)"); grd.addColorStop(0.5, "rgba(128,128,128,0.0)"); grd.addColorStop(1, "rgba(0,0,0,0.4)");
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    }
    const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(7, 7);
    return tx;
  }

  function buildSurface() {
    scene2 = new THREE.Scene();
    scene2.background = new THREE.Color(0x8fd0e6);
    scene2.fog = new THREE.Fog(0xbfe6f0, 14, 70);     // haze blends distant water into the sky

    camS = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 220);
    camS.position.set(0, 3.0, 8.8); camS.lookAt(0, -0.5, -9);

    scene2.add(new THREE.HemisphereLight(0xdff2ff, 0x2a6c5a, 1.0));
    sunS = new THREE.DirectionalLight(0xfff2cf, 1.4); sunS.position.set(3, 8, -2); scene2.add(sunS);

    // rippling water (stays put — the world turns around the boat, not the water)
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x2c8fb4, roughness: 0.18, metalness: 0.55, bumpMap: rippleBump(), bumpScale: 0.32 })
    );
    water.rotation.x = -Math.PI / 2; water.position.y = 0; scene2.add(water);

    // sun disc + glow
    sunMesh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0xfff3c8 }));
    sunGlow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35 }));
    scene2.add(sunGlow); scene2.add(sunMesh);

    // everything that rotates when you steer the trolling motor goes in `world`
    world = new THREE.Group(); scene2.add(world);

    // distant hills (shoreline ring) — so turning reveals new shore
    hills = new THREE.Group();
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, R = 46 + (i % 4) * 4;
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), new THREE.MeshStandardMaterial({ color: 0x356b4e, roughness: 1 }));
      h.position.set(Math.sin(a) * R, -0.6, -Math.cos(a) * R);
      h.scale.set(7 + (i % 3) * 2, 2.4 + (i % 4) * 0.7, 5); hills.add(h);
    }
    world.add(hills);

    // fish shadows drifting just under the surface (clustered near the structure)
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0a1d22, transparent: true, opacity: 0.32 });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.5, 18), shadowMat.clone());
      s.rotation.x = -Math.PI / 2; s.scale.set(1, 0.42, 1);
      s.userData = { sp: 0.2 + Math.random() * 0.5, dir: Math.random() < 0.5 ? 1 : -1, ph: Math.random() * 6.28, off: (Math.random() - 0.5) * 4 };
      world.add(s); fishShadows.push(s);
    }

    // structure props (lily-pad cluster) — placed at the productive bearing
    structProps = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9, side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(Math.cos(i * 0.9) * (0.6 + i * 0.22), 0.04, Math.sin(i * 0.9) * (0.6 + i * 0.22));
      structProps.add(pad);
    }
    world.add(structProps);

    // bass boat + angler in the foreground (fixed — camera rides the boat)
    boat = buildBoat(); boat.position.set(0, 0, 5.4); scene2.add(boat);

    // cast aim marker, line and lure
    aimRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: 0xffe7a6, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    aimRing.rotation.x = -Math.PI / 2; aimRing.visible = false; scene2.add(aimRing);
    castLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ROD_S.clone(), ROD_S.clone()]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    castLine.visible = false; scene2.add(castLine);
    castLure = buildLure(); castLure.scale.setScalar(0.7); castLure.visible = false; scene2.add(castLure);
  }

  function buildBoat() {
    const g = new THREE.Group();
    const flake = new THREE.MeshStandardMaterial({ color: 0x9a1f2a, roughness: 0.25, metalness: 0.6 });   // metal-flake hull
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.6, metalness: 0.3 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.4, metalness: 0.5 });

    // sleek hull: a tapered deck that narrows to a pointed bow up front (-z)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.05, -1.9);                       // stern, port
    hullShape.lineTo(1.05, -1.9);                        // stern, starboard
    hullShape.lineTo(1.12, -0.2);
    hullShape.lineTo(0.66, 1.55);
    hullShape.quadraticCurveTo(0, 2.5, -0.66, 1.55);     // pointed bow
    hullShape.lineTo(-1.12, -0.2);
    hullShape.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }), flake);
    hull.rotation.x = -Math.PI / 2; hull.position.y = -0.18; g.add(hull);
    // inset casting deck (where the angler stands) sits on top, flush
    const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.06, bevelEnabled: false }), deckMat);
    deck.rotation.x = -Math.PI / 2; deck.scale.set(0.9, 0.9, 1); deck.position.y = 0.42; g.add(deck);
    // white rub-rail stripe around the sheer
    const rail = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.08, bevelEnabled: false }), trimMat);
    rail.rotation.x = -Math.PI / 2; rail.scale.set(1.02, 1.02, 1); rail.position.y = 0.4; g.add(rail);

    // bow casting platform + the trolling motor mounted at the very tip
    const motor = new THREE.Group(); motor.position.set(0, 0.42, -2.35); g.add(motor); g.troll = motor;
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.5), deckMat); motor.add(mount);
    const shaftM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10), trimMat); shaftM.position.set(0, -0.7, 0.1); motor.add(shaftM);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5, metalness: 0.4 }));
    head.rotation.z = Math.PI / 2; head.position.set(0, -1.5, 0.1); motor.add(head);
    const prop = new THREE.Group(); prop.position.set(0, -1.5, -0.18); motor.add(prop); g.prop = prop;
    for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.02), trimMat); bl.rotation.z = i * 2.09; prop.add(bl); }

    // console with a glowing fish-finder screen, set ahead of the angler
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.3), deckMat); console.position.set(0.55, 0.66, 0.6); g.add(console);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshBasicMaterial({ color: 0x0a2230 }));
    screen.position.set(0.55, 0.7, 0.45); g.add(screen); g.finderScreen = screen;

    // angler — torso, head, cap (seated, viewed from behind)
    const ang = new THREE.Group(); ang.position.set(-0.15, 0.42, 0.7);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.62, 12), new THREE.MeshStandardMaterial({ color: 0x3f7c54, roughness: 0.9 }));
    torso.position.y = 0.3; ang.add(torso);
    const ahead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshStandardMaterial({ color: 0xe0b48a, roughness: 0.8 }));
    ahead.position.y = 0.74; ang.add(ahead);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12, 0, 6.28, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.7 }));
    cap.position.y = 0.78; ang.add(cap);
    g.add(ang);
    // fishing rod (pivots at the grip; a tracked tip feeds the line its origin)
    const rod = new THREE.Group(); rod.position.set(0.25, 0.78, -0.4);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, 3.6, 8), new THREE.MeshStandardMaterial({ color: 0x4a3420 }));
    shaft.position.y = 1.8; rod.add(shaft);
    const tip = new THREE.Object3D(); tip.position.y = 3.6; rod.add(tip);
    rod.rotation.x = -0.95; rod.rotation.z = 0.12;
    g.add(rod); g.rod = rod; g.rodTip = tip;
    return g;
  }

  function screenToWater(px, py) {
    const nx = (px / innerWidth) * 2 - 1, ny = -((py / innerHeight) * 2 - 1);
    ray.setFromCamera({ x: nx, y: ny }, camS);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(waterPlane, hit) ? hit : null;
  }

  function renderSurface(st, t, dt) {
    // sky / sun / light by time of day
    const key = (st.skyTop || "") + (st.skyBot || "");
    if (key !== skyKey) {
      skyKey = key;
      if (st.skyTop) scene2.background = skyTexture(st.skyTop, st.skyBot);
      if (st.skyBot) scene2.fog.color.set(st.skyBot);
    }
    const dl = st.daylight != null ? st.daylight : 1;
    sunS.intensity = 0.4 + dl * 1.1;
    sunMesh.material.color.set(st.night ? 0xdfe6ff : 0xfff3c8);
    sunGlow.material.opacity = st.night ? 0.18 : 0.35;
    const sx = (st.sunX != null ? st.sunX : 0.5), elev = (st.elev != null ? st.elev : 0.6);
    const sxw = (sx - 0.5) * 60, syw = 4 + elev * 22;
    sunMesh.position.set(sxw, syw, -55); sunGlow.position.set(sxw, syw, -56);
    sunS.position.set(sxw * 0.2, syw, -10);
    if (st.water0) water.material.color.set(st.water0);

    // steer: the whole world rotates around the boat as you run the trolling motor
    const heading = st.heading || 0, hold = st.holdBearing || 0, facing = st.facing != null ? st.facing : 1;
    world.rotation.y = -heading;

    // animate water ripples + boat bob
    water.material.bumpMap.offset.x = t * 0.015;
    water.material.bumpMap.offset.y = t * 0.008;
    boat.position.y = Math.sin(t * 0.8) * 0.05;
    boat.rotation.z = Math.sin(t * 0.7) * 0.02;
    // trolling motor: prop spins; head steers toward the turn
    if (boat.prop) boat.prop.rotation.z = t * 12;
    if (boat.troll) boat.troll.rotation.y += ((st.steer || 0) * 0.5 - boat.troll.rotation.y) * 0.1;

    // structure holds at the productive bearing (in world space, so it swings
    // into view as you turn to face it)
    const D = 11;
    structProps.position.set(Math.sin(hold) * D, 0, -Math.cos(hold) * D);
    structProps.visible = true;

    // fish shadows cluster around the structure; they're easier to see (more of
    // them, darker) the more directly you're facing the holding water
    for (let i = 0; i < fishShadows.length; i++) {
      const s = fishShadows[i], u = s.userData;
      const ang = hold + (i - fishShadows.length / 2) * 0.12 + Math.sin(t * 0.3 + u.ph) * 0.05;
      const dist = D + u.off + Math.sin(t * 0.5 + u.ph) * 0.6;
      s.position.set(Math.sin(ang) * dist, 0.03, -Math.cos(ang) * dist);
      const vis = i < 2 + Math.round(facing * 5);
      s.visible = vis;
      s.material.opacity = (0.12 + facing * 0.3) + Math.sin(t + u.ph) * 0.05;
    }

    // realistic cast: load the rod back over the shoulder while aiming, then
    // whip it forward fast on release so the lure launches off the tip.
    const rod = boat.rod;
    if (st.mode === "casting") {
      const p = Math.min(1, st.castProgress || 0);
      const whip = Math.min(1, p / 0.26);                  // the forward snap happens early
      const e = 1 - Math.pow(1 - whip, 3);                 // ease-out flick
      rod.rotation.x = 0.6 + e * (-2.0);                   // loaded (+0.6) -> hard forward (-1.4)
      if (p > 0.26) rod.rotation.x += (p - 0.26) * 0.5;    // recoil/settle back up a touch
      rod.rotation.z = 0.12 + Math.sin(t * 30) * (1 - whip) * 0.05;
    } else {
      const target = st.mode === "charging" ? 0.6 : -0.95; // cocked back to load, else relaxed forward
      rod.rotation.x += (target - rod.rotation.x) * Math.min(1, dt * 0.011);
      rod.rotation.x += (st.mode === "charging" ? Math.sin(t * 18) * 0.012 : Math.sin(t * 1.3) * 0.04);
      rod.rotation.z = 0.12;
    }
    boat.updateMatrixWorld(true);
    const tip = boat.rodTip.getWorldPosition(new THREE.Vector3());

    // aim + cast
    const land = st.castAim ? screenToWater(st.castAim.x, st.castAim.y) : null;
    if (st.mode === "charging" && land) {
      aimRing.visible = true; aimRing.position.set(land.x, 0.05, land.z);
      aimRing.scale.setScalar(0.9 + 0.12 * Math.sin(t * 6));
      castLine.visible = true; castLine.geometry.setFromPoints([tip, new THREE.Vector3(land.x, 0.05, land.z)]);
      castLure.visible = false;
    } else if (st.mode === "casting" && land) {
      const p = Math.min(1, st.castProgress || 0);
      const pos = tip.clone().lerp(new THREE.Vector3(land.x, 0.05, land.z), p);
      pos.y += Math.sin(p * Math.PI) * (1.6 + land.distanceTo(tip) * 0.12);
      castLure.visible = true; castLure.position.copy(pos);
      castLure.body.material.color.set(st.lureHex || 0xff5a2a);
      castLine.visible = true; castLine.geometry.setFromPoints([tip, pos]);
      aimRing.visible = false;
    } else {
      aimRing.visible = false; castLine.visible = false; castLure.visible = false;
    }

    renderer.render(scene2, camS);
  }

  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight, false);
    canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
    if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
    if (camS) { camS.aspect = innerWidth / innerHeight; camS.updateProjectionMatrix(); }
  }

  function setVisible(on) {
    if (!ready) return;
    if (on !== visible) { visible = on; canvas.style.opacity = on ? "1" : "0"; }
  }

  function setVenue(water0, water1) {
    if (!ready) return;
    surf.material.color.set(water0);
    bottom.material.color.set(water1);
    scene.fog.color.set(water1);
    scene.background.set(water1);
  }

  // ---- small tinted lure ----
  function buildLure() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff5a2a, roughness: 0.4, metalness: 0.3 }));
    body.scale.set(1.6, 0.8, 0.8); g.add(body); g.body = body;
    const bib = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshStandardMaterial({ color: 0xbfdce8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    bib.position.set(-0.26, -0.05, 0); bib.rotation.y = Math.PI / 2; bib.rotation.x = 0.5; g.add(bib);
    return g;
  }

  // ---- low-poly translucent shadow bass for pursuers ----
  function buildShadowFish() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x0e2022, transparent: true, opacity: 0.3 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat);
    b.scale.set(1.9, 0.85, 0.45); g.add(g.body = b);
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0); tailShape.lineTo(-0.6, 0.45); tailShape.lineTo(-0.45, 0); tailShape.lineTo(-0.6, -0.45); tailShape.closePath();
    const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), mat);
    tail.position.x = -0.95; g.add(g.tail = tail);
    g.mat = mat;
    return g;
  }

  function disposeFish(g) {
    if (!g) return; scene.remove(g);
    if (g.disposables) g.disposables.forEach(d => d.dispose && d.dispose());
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !g.disposables) o.material.dispose(); });
  }

  function undulate(g, t, strength, recompute) {
    if (!g.geo || !g.basePos) return;
    const p = g.geo.attributes.position.array, base = g.basePos;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], tailness = Math.min(1, Math.max(0, (-x + 1.0) / 2.0));
      p[i + 2] = base[i + 2] + Math.sin(x * 2.6 - t * 9) * strength * (0.15 + tailness * tailness);
    }
    g.geo.attributes.position.needsUpdate = true;
    if (recompute !== false) g.geo.computeVertexNormals();
  }

  // ---- per-frame update, driven by the game ----
  function frame(st, dt) {
    if (!ready || !visible) return;
    clock.t += (dt || 16) / 1000;
    const t = clock.t;

    if (st.view === "surface") { renderSurface(st, t, dt || 16); return; }

    // bite zone — only while you're working the lure; gone once a fish is on
    const showZone = st.mode === "retrieve" || st.mode === "strike";
    biteSlab.visible = biteEdgeTop.visible = biteEdgeBot.visible = showZone;
    if (showZone) {
      const yTop = yOf(Math.max(0, st.band - st.win)), yBot = yOf(Math.min(1, st.band + st.win));
      const cy = (yTop + yBot) / 2, hgt = Math.max(0.15, yTop - yBot);
      biteSlab.position.y = cy; biteSlab.scale.y = hgt / 0.1;
      const zc = st.inZone ? 0x5be37a : 0xffd35c, ze = st.inZone ? 0x78f096 : 0xffe08a;
      biteSlab.material.color.setHex(zc); biteSlab.material.opacity = st.inZone ? 0.16 : 0.10;
      biteEdgeTop.position.y = yTop; biteEdgeBot.position.y = yBot;
      biteEdgeTop.material.color.setHex(ze); biteEdgeBot.material.color.setHex(ze);
    }

    motes.rotation.y = t * 0.01;
    surf.material.opacity = 0.22 + 0.14 * (st.daylight != null ? st.daylight : 1);

    const showLure = st.mode === "retrieve" || st.mode === "strike";
    lureGroup.visible = showLure;
    lineMesh.visible = showLure || st.mode === "fight";

    if (showLure) {
      // the lure visibly works: jigs up/down and wiggles, faster for fast lures
      const fast = st.lureStyle === "top" ? 11 : 7;
      const jig = Math.sin(t * fast) * 0.20 + Math.sin(t * fast * 2.3) * 0.06;
      const wig = Math.sin(t * (fast * 0.6)) * 0.14;
      const lx = xOf(st.lureDist) + wig, ly = yOf(st.lureDepth) + jig;
      lureGroup.position.set(lx, ly, 0);
      lureGroup.rotation.z = Math.sin(t * fast) * 0.3;
      lureGroup.body.material.color.set(st.lureHex || 0xff5a2a);
      lineMesh.geometry.setFromPoints([ROD.clone(), new THREE.Vector3(lx, ly, 0)]);
      lineMesh.material.opacity = 0.5; lineMesh.material.color.setHex(0xffffff);

      // detailed bass swim in and close on the lure as interest builds
      const it = st.interest || 0;
      const want = st.mode === "strike" ? 1 : Math.min(3, 1 + Math.round(it * 2));
      for (let i = 0; i < pursuers.length; i++) {
        const p = pursuers[i]; const on = i < want;
        p.visible = on; if (!on) continue;
        const lead = i === 0, side = i % 2 === 0 ? 1 : -1;
        const reach = (1 - it) * (3.4 + i * 1.0) + (lead ? 0.7 : 1.3);
        const tx = lx + side * reach + Math.cos(t * 0.8 + i) * 0.35;
        const ty = yOf(st.band) + Math.sin(t * 0.9 + i * 1.7) * 0.45
                 + (ly - yOf(st.band)) * (lead ? it : it * 0.4);          // lead rises to the lure's depth
        const tz = -0.5 - i * 0.7 + Math.sin(t * (1.2 + i * 0.3) + i) * 0.5;
        p.position.set(tx, ty, tz);
        p.rotation.y = Math.atan2(tz, lx - tx);                            // head toward the lure
        p.scale.setScalar(lead ? 0.55 + it * 0.4 : 0.5);
        undulate(p, t * (lead ? 1.3 : 1.0) + i * 2, 0.18, lead);           // body swims (normals only for the lead — cheaper)
        if (p.tail) p.tail.rotation.y = Math.sin(t * (7 + it * 4) + i) * 0.5;
      }
    } else {
      for (const p of pursuers) p.visible = false;
    }

    // the fight — full procedural bass
    if (st.mode === "fight" && st.fight) {
      const f = st.fight, key = JSON.stringify(f.art || {});
      if (!fightFish || key !== fightArtKey) { disposeFish(fightFish); fightFish = makeBass(f.art || {}); scene.add(fightFish); fightArtKey = key; }
      fightFish.visible = true;
      const fx = xOf(f.dist);
      let fy;
      if (f.state === "jump") fy = 2.9 + Math.abs(Math.sin(t * 11)) * 1.8;
      else fy = yOf(0.42 + Math.sin(t * 1.1) * 0.12 + (f.state === "run" ? 0.16 : 0));
      const sc = 0.5 + f.size * 0.9;
      fightFish.scale.setScalar(sc);
      fightFish.position.set(fx, fy, 0);
      // the rod is up-left, so the hooked fish's head points that way (toward the
      // boat); it only quarters away a little when it runs, head still leading.
      fightFish.rotation.y = Math.PI - (f.state === "run" ? 0.5 : 0);
      fightFish.rotation.z = (f.state === "jump") ? 0.5 : Math.sin(t * 2) * 0.08;
      undulate(fightFish, t, 0.16 + f.pull * 0.06);
      if (fightFish.tail) fightFish.tail.rotation.y = Math.sin(t * (8 + f.pull * 4)) * 0.5;
      // line runs from the rod tip to the fish's actual mouth, bowing red when taut
      fightFish.updateMatrixWorld(true);
      const mouth = fightFish.mouth.getWorldPosition(new THREE.Vector3());
      lineMesh.geometry.setFromPoints([ROD.clone(), mouth]);
      lineMesh.material.color.setHex(f.tension > 0.7 ? 0xff6a6a : 0xffffff);
      lineMesh.material.opacity = 0.6;
    } else if (fightFish) {
      fightFish.visible = false;
    }

    renderer.render(scene, camera);
  }

  // ===========================================================================
  // Catch / trophy view — its own little renderer in the catch modal
  // ===========================================================================
  let catchR, catchScene, catchCam, catchFish, catchRAF = 0, catchReady = false, catchT = 0;

  function initCatch(cv) {
    if (!cv) return false;
    try { catchR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); }
    catch (e) { return false; }
    catchR.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    catchScene = new THREE.Scene();
    catchCam = new THREE.PerspectiveCamera(42, 1.8, 0.1, 50);
    catchCam.position.set(0, 0, 6.4);
    catchScene.add(new THREE.HemisphereLight(0xffffff, 0x44525e, 1.2));
    const d1 = new THREE.DirectionalLight(0xfff2cf, 1.7); d1.position.set(3, 5, 6); catchScene.add(d1);
    const d2 = new THREE.DirectionalLight(0x9fc0ff, 0.6); d2.position.set(-4, -1, 3); catchScene.add(d2);
    catchReady = true;
    return true;
  }

  function showCatch(art) {
    if (!catchReady && !initCatch(document.getElementById("catch3d"))) return false;
    const cv = catchR.domElement;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 160;
    catchR.setSize(w, h, false); catchCam.aspect = w / h; catchCam.updateProjectionMatrix();
    hideCatch();
    if (catchFish) { catchScene.remove(catchFish); if (catchFish.disposables) catchFish.disposables.forEach(d => d.dispose && d.dispose()); catchFish.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    catchFish = makeBass(art || {});
    catchFish.scale.setScalar(2.1);
    catchScene.add(catchFish);
    catchT = 0;
    const loop = () => {
      catchT += 0.016;
      catchFish.rotation.y = -0.55 + Math.sin(catchT * 0.55) * 0.85;   // turn to show both flanks
      catchFish.rotation.z = Math.sin(catchT * 0.8) * 0.05;
      catchFish.position.y = -0.1 + Math.sin(catchT * 1.1) * 0.12;
      if (catchFish.tail) catchFish.tail.rotation.y = Math.sin(catchT * 5) * 0.32;
      catchR.render(catchScene, catchCam);
      catchRAF = requestAnimationFrame(loop);
    };
    loop();
    return true;
  }

  function hideCatch() { if (catchRAF) cancelAnimationFrame(catchRAF); catchRAF = 0; }

  return { init, setVisible, setVenue, frame, isReady: () => ready, showCatch, hideCatch };
})();

export { makeBass, bassTextures };

window.Scene3D = Scene3D;
