// =============================================================================
// BassBuddy — real-time 3D underwater renderer (Three.js, MIT).
// Driven by the 2D game's state each frame. Layered over the 2D canvas and
// shown only in the underwater view; if WebGL is unavailable the game falls
// back to the original 2D scene automatically (Scene3D just never goes ready).
// All geometry is original/procedural — no third-party art assets.
// =============================================================================
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";

// =============================================================================
// Optional real 3D models: drop a glTF/GLB into  models/<species>.glb
// (largemouth / smallmouth / spotted) and it's loaded and used in place of the
// procedural bass. The model is auto-centered and scaled to fit; it should
// face +X (head toward +X). If no file is present we silently use procedural.
// =============================================================================
const LOADED_MODELS = {};            // species -> prepared THREE.Object3D (template)
let _gltfLoader = null;
function loadRealModels() {
  if (_gltfLoader) return;
  _gltfLoader = new GLTFLoader();
  // a manifest lists which species models are present, so we never 404-probe
  fetch("models/manifest.json").then(r => r.ok ? r.json() : null).then(man => {
    if (!man) return;
    for (const key of ["largemouth", "smallmouth", "spotted"]) if (man[key]) loadOne(key);
  }).catch(() => {});
}
function loadOne(key) {
  _gltfLoader.load("models/" + key + ".glb", (gltf) => {
      const root = gltf.scene || gltf.scenes[0];
      // normalize: center at origin and scale longest axis to the game's fish length
      const box = new THREE.Box3().setFromObject(root), size = new THREE.Vector3();
      box.getSize(size); const c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);
      const longest = Math.max(size.x, size.y, size.z) || 1;
      root.scale.multiplyScalar(2.4 / longest);
      const wrap = new THREE.Group(); wrap.add(root); wrap.userData.imported = true;
      LOADED_MODELS[key] = wrap;
    }, undefined, () => { /* no file for this species — procedural fallback */ });
}
// a clone of the loaded model for a species, or null
function realModel(key) {
  const tpl = LOADED_MODELS[key]; if (!tpl) return null;
  const g = tpl.clone(true); g.userData.imported = true;
  g.mouth = new THREE.Object3D(); g.mouth.position.set(1.2, -0.05, 0); g.add(g.mouth);
  return g;
}

// =============================================================================
// Detailed, realistic procedural bass — shared by the fight, the 3D preview,
// and the catch screen. The skin is painted to an offscreen canvas (scales,
// flank gradient, species markings, gill plate, lateral line) and used as the
// colour map; a matching grayscale bump map gives the scales real relief under
// the lights. All original art — nothing sampled from another game.
// art = { body, belly, back?, patColor, pat:'lateral'|'bars'|'spots', eye, bigmouth }
// =============================================================================
function hexNum(c) { return (typeof c === "string") ? new THREE.Color(c).getHex() : c; }

// crisp text on a transparent canvas, for in-scene labels (sprites)
function textTexture(text) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
  const g = cv.getContext("2d");
  g.font = "bold 30px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,0.55)"; g.strokeText(text, 128, 34);
  g.fillStyle = "#eafff0"; g.fillText(text, 128, 34);
  const tx = new THREE.CanvasTexture(cv); return tx;
}

// turn a grayscale height canvas into a tangent-space normal map (Sobel)
function heightToNormal(srcCanvas, strength) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext("2d").getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const og = out.getContext("2d"), dst = og.createImageData(w, h), d = dst.data;
  const H = (x, y) => { x = (x + w) % w; y = (y + h) % h; return src[(y * w + x) * 4] / 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
    const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
    let nx = dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz) || 1;
    const i = (y * w + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(dst, 0, 0);
  const tx = new THREE.CanvasTexture(out); tx.anisotropy = 8; return tx;
}

function bassTextures(art) {
  const W = 2048, H = 768;                                   // high-res skin
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const bv = document.createElement("canvas"); bv.width = W; bv.height = H;   // height (for normals)
  const b = bv.getContext("2d");
  const rv = document.createElement("canvas"); rv.width = W; rv.height = H;   // roughness
  const rg = rv.getContext("2d");

  const body = new THREE.Color(art.body || "#6f9e4e");
  const back = art.back ? new THREE.Color(art.back) : body.clone().multiplyScalar(0.42);
  const belly = new THREE.Color(art.belly || "#eef1d6").lerp(new THREE.Color("#ffffff"), 0.45);  // near-white belly
  const gold = body.clone().lerp(new THREE.Color("#d9d27a"), 0.45);     // gold-green upper flank
  const flank = body.clone().lerp(new THREE.Color("#f2f4e6"), 0.4);     // pale lower flank
  const css = c => `rgb(${(c.r*255)|0},${(c.g*255)|0},${(c.b*255)|0})`;

  // base flank gradient (v: 0=back .. 0.5=belly .. 1=back), mirrored:
  // dark olive back -> gold-green upper flank -> pale flank -> white belly
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, css(back));
  grad.addColorStop(0.14, css(body));
  grad.addColorStop(0.28, css(gold));
  grad.addColorStop(0.42, css(flank));
  grad.addColorStop(0.50, css(belly));
  grad.addColorStop(0.58, css(flank));
  grad.addColorStop(0.72, css(gold));
  grad.addColorStop(0.86, css(body));
  grad.addColorStop(1.00, css(back));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
  // roughness: wet/glossy belly (dark = smooth), drier scaly back (lighter)
  const rgrad = rg.createLinearGradient(0, 0, 0, H);
  rgrad.addColorStop(0.0, "#9a9a9a"); rgrad.addColorStop(0.5, "#4c4c4c"); rgrad.addColorStop(1.0, "#9a9a9a");
  rg.fillStyle = rgrad; rg.fillRect(0, 0, W, H);

  // overlapping scales across the flanks (skip the very belly + back ridge)
  const sw = 50, sh = 34;
  for (let row = 1; row < H / sh - 1; row++) {
    const cy = row * sh, vy = cy / H;
    if (vy < 0.06 || vy > 0.94) continue;
    const bellyFade = 1 - Math.min(1, Math.abs(vy - 0.5) / 0.42); // scales fade into the belly
    for (let col = -1; col < W / sw + 1; col++) {
      const cx = col * sw + (row % 2 ? sw / 2 : 0);
      g.beginPath(); g.arc(cx, cy, sw * 0.62, Math.PI * 0.05, Math.PI * 0.95);
      g.strokeStyle = `rgba(0,0,0,${0.10 + bellyFade * 0.05})`; g.lineWidth = 2.6; g.stroke();
      g.beginPath(); g.arc(cx, cy - 3, sw * 0.6, Math.PI * 1.05, Math.PI * 1.95);
      g.strokeStyle = `rgba(255,255,255,${0.06 + bellyFade * 0.05})`; g.lineWidth = 2.2; g.stroke();
      // height relief: bright top rim, dark bottom rim -> normal map
      b.beginPath(); b.arc(cx, cy - 3, sw * 0.6, Math.PI * 1.05, Math.PI * 1.95); b.strokeStyle = "rgba(255,255,255,0.55)"; b.lineWidth = 4; b.stroke();
      b.beginPath(); b.arc(cx, cy, sw * 0.62, Math.PI * 0.05, Math.PI * 0.95); b.strokeStyle = "rgba(0,0,0,0.55)"; b.lineWidth = 4; b.stroke();
      // each scale edge reads a touch rougher
      rg.beginPath(); rg.arc(cx, cy, sw * 0.62, Math.PI * 0.05, Math.PI * 0.95); rg.strokeStyle = "rgba(200,200,200,0.25)"; rg.lineWidth = 3; rg.stroke();
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
    if (art.pat === "lateral") {                       // largemouth: ragged broken stripe -> dark caudal blotch
      g.fillStyle = pc;
      // overlapping irregular blotches that merge into a torn horizontal band,
      // strongest through the middle and fading toward the head/tail
      for (let bx = 0.08; bx < 0.82; bx += 0.028) {
        const midw = Math.sin(Math.min(1, (bx - 0.05) / 0.78) * Math.PI);     // strongest mid-body
        const n = Math.sin(bx * 57.3) * Math.cos(bx * 23.7);                  // stable pseudo-noise -1..1
        g.globalAlpha = (0.22 + midw * 0.5) * (0.7 + 0.3 * Math.abs(n));
        const bw = Math.abs(14 + midw * 26 + n * 8), bh = Math.abs(7 + midw * (16 + n * 9));
        g.beginPath(); g.ellipse(W * bx, y + n * 10, bw, bh, n * 0.3, 0, 6.28); g.fill();
      }
      // solid dark blotch where the stripe converges on the caudal peduncle
      g.globalAlpha = 0.74;
      g.beginPath(); g.ellipse(W * 0.085, y, W * 0.045, 28, 0, 0, 6.28); g.fill();
      g.globalAlpha = 1;
    } else if (art.pat === "bars") {                   // smallmouth: dark vertical tiger bars
      g.fillStyle = pc;
      const top = vy < 0.5, y0 = top ? H * 0.13 : H * 0.52, y1 = top ? H * 0.48 : H * 0.87;
      for (let i = 0; i < 9; i++) {
        const x = W * (0.17 + i * 0.072) + Math.sin(i * 2.3) * 6;
        g.globalAlpha = 0.34 + 0.2 * Math.abs(Math.sin(i * 1.7));     // irregular intensity
        g.beginPath();                                                // tapered bar (wider at the back)
        g.moveTo(x - 15, y0); g.lineTo(x + 15, y0); g.lineTo(x + 7, y1); g.lineTo(x - 7, y1);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
    } else if (art.pat === "spots") {                  // spotted bass: lateral blotch row + spot rows below
      g.fillStyle = pc;
      for (let bx = 0.1; bx < 0.8; bx += 0.05) {       // broken lateral blotch line
        g.globalAlpha = 0.42; g.beginPath(); g.ellipse(W * bx, y, 11, 9, 0, 0, 6.28); g.fill();
      }
      const dirn = vy < 0.5 ? 1 : -1;                  // rows of spots toward the belly
      for (let row = 1; row <= 3; row++) {
        for (let x = 0.12; x < 0.82; x += 0.05) {
          g.globalAlpha = 0.36 - row * 0.04;
          g.beginPath(); g.arc(W * (x + row * 0.012), y + dirn * row * 22, 6 - row, 0, 6.28); g.fill();
        }
      }
      g.globalAlpha = 1;
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
  // soft cheek shading + the dark gill-cover (operculum) blotch, on both flanks
  for (const cy of [0.30, 0.70]) {
    const yy = cy * H;
    const cheek = g.createRadialGradient(gx + 28, yy, 4, gx + 28, yy, 90);
    cheek.addColorStop(0, "rgba(30,40,24,0.22)"); cheek.addColorStop(1, "rgba(30,40,24,0)");
    g.fillStyle = cheek; g.beginPath(); g.ellipse(gx + 28, yy, 90, 64, 0, 0, 6.28); g.fill();
    // the dark spot at the rear of the gill flap
    g.fillStyle = "rgba(18,22,14,0.5)";
    g.beginPath(); g.ellipse(gx + 6, yy + (cy < 0.5 ? 18 : -18), 16, 22, 0, 0, 6.28); g.fill();
  }
  // mouth + maxilla (upper-jaw) line — drawn on BOTH flanks (v≈0.30 / 0.70) so
  // it shows from the side. The defining largemouth trait: the maxilla extends
  // back PAST the eye — a big "bucket" mouth — vs smallmouth (jaw under eye).
  const jawEnd = art.bigmouth ? 0.80 : 0.865;     // where the jaw hinges (u)
  g.lineCap = "round";
  for (const sgn of [-1, 1]) {
    const y = H * (0.5 + sgn * 0.205);            // the two visible flanks, mouth level
    g.strokeStyle = "rgba(12,9,7,0.82)"; g.lineWidth = art.bigmouth ? 8 : 6;
    g.beginPath(); g.moveTo(W * 0.992, y); g.quadraticCurveTo(W * 0.905, y + sgn * 9, W * jawEnd, y + sgn * 6); g.stroke();
    // a finer lower-lip line just below it (the closed gape)
    g.strokeStyle = "rgba(40,30,22,0.4)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.985, y + sgn * 6); g.quadraticCurveTo(W * 0.93, y + sgn * 14, W * 0.90, y + sgn * 11); g.stroke();
    // matching relief on the height map so the jaw seam catches light
    b.strokeStyle = "rgba(30,30,30,0.9)"; b.lineWidth = 6;
    b.beginPath(); b.moveTo(W * 0.992, y); b.quadraticCurveTo(W * 0.905, y + sgn * 9, W * jawEnd, y + sgn * 6); b.stroke();
  }
  // darkened lips wrapping the front of the snout (reads as the mouth from any angle)
  g.fillStyle = "rgba(18,14,10,0.5)";
  g.fillRect(W * 0.97, H * 0.20, W * 0.03, H * 0.60);

  // eyes painted straight onto the head texture on both flanks, so they are
  // permanently part of the fish and can never detach when it turns
  for (const evy of [0.23, 0.77]) {
    const ey = evy * H, ex2 = W * 0.862;
    g.fillStyle = "rgba(16,22,11,0.55)"; g.beginPath(); g.ellipse(ex2, ey, 31, 34, 0, 0, 6.28); g.fill();   // socket ring
    g.fillStyle = css(new THREE.Color(art.eye || "#caa23a")); g.beginPath(); g.ellipse(ex2, ey, 23, 26, 0, 0, 6.28); g.fill();  // gold iris
    g.fillStyle = "#0b0b09"; g.beginPath(); g.ellipse(ex2, ey, 11, 13, 0, 0, 6.28); g.fill();               // black pupil
    g.fillStyle = "rgba(255,255,255,0.92)"; g.beginPath(); g.arc(ex2 - 6, ey - 7, 4.5, 0, 6.28); g.fill();  // glint
    b.fillStyle = "rgba(186,186,186,0.6)"; b.beginPath(); b.ellipse(ex2, ey, 25, 28, 0, 0, 6.28); b.fill(); // gentle dome relief
  }

  const map = new THREE.CanvasTexture(cv); map.anisotropy = 8;
  if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightToNormal(bv, 2.4);
  const roughnessMap = new THREE.CanvasTexture(rv); roughnessMap.anisotropy = 4;
  return { map, normalMap, roughnessMap };
}

function makeBass(art) {
  art = art || {};
  const LEN = 2.7, SEG = 140, RING = 48;     // high-poly for smooth, lifelike curves
  const group = new THREE.Group();

  // deep-bodied profile from the reference: dorsal hump behind the head,
  // deepest through the middle, a big full head, and a narrow caudal peduncle.
  const depth = t => {
    const bd = Math.sin(Math.pow(Math.min(t, 1), 1.15) * Math.PI);
    let d = 0.055 + bd * 0.46;
    if (t > 0.82) d = Math.max(d, 0.36) * (1 - (t - 0.82) / 0.18 * 0.5);   // full head, gentle snout
    if (t < 0.09) d *= t / 0.09;                                           // pinch the tail base
    return d;
  };
  // laterally compressed body, but a rounder (fuller) head
  const widthFac = t => 0.30 + Math.sin(Math.min(t, 1) * Math.PI) * 0.10 + (t > 0.7 ? (t - 0.7) * 0.5 : 0);

  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, x = (t - 0.5) * LEN, d = depth(t), w = widthFac(t);
    const hump = Math.max(0, Math.sin((t - 0.12) / 0.88 * Math.PI));       // 0 at ends, peak mid-body
    for (let j = 0; j <= RING; j++) {
      const a = j / RING * Math.PI * 2, ca = Math.cos(a);
      let y = ca * d;
      if (ca > 0) y *= 1 + hump * 0.17;        // the back arches up (dorsal hump)
      else y *= 1 + hump * 0.05;               // the belly rounds gently
      positions.push(x, y, Math.sin(a) * d * w);
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

  const { map, normalMap, roughnessMap } = bassTextures(art);
  // physically-based, wet-looking skin: scale relief via normal map, varying
  // gloss via roughness map, and a clearcoat "slime" layer that catches the light
  const mat = new THREE.MeshPhysicalMaterial({
    map, normalMap, roughnessMap, metalness: 0.0, roughness: 1.0,
    normalScale: new THREE.Vector2(0.9, 0.9),
    clearcoat: 0.7, clearcoatRoughness: 0.35, envMapIntensity: 1.1, sheen: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  group.geo = geo; group.basePos = Float32Array.from(positions); group.len = LEN;
  group.disposables = [geo, mat, map, normalMap, roughnessMap];

  // back/belly surface heights (account for the dorsal hump) so fins seat right
  const humpAt = t => Math.max(0, Math.sin((t - 0.12) / 0.88 * Math.PI));
  const topY = t => depth(t) * (1 + humpAt(t) * 0.17);
  const botY = t => -depth(t) * (1 + humpAt(t) * 0.05);

  // fins — translucent amber/cream membranes (with subtle ray streaks), like the
  // reference. PhysicalMaterial + transmission gives that wet, see-through look.
  const finCv = document.createElement("canvas"); finCv.width = 96; finCv.height = 96;
  const fg = finCv.getContext("2d");
  fg.clearRect(0, 0, 96, 96);
  const fgrad = fg.createLinearGradient(0, 96, 0, 0);
  fgrad.addColorStop(0, "rgba(208,196,150,0.95)"); fgrad.addColorStop(1, "rgba(225,220,196,0.45)");
  fg.fillStyle = fgrad; fg.fillRect(0, 0, 96, 96);
  fg.strokeStyle = "rgba(90,72,40,0.32)"; fg.lineWidth = 1.3;          // fin rays fanning from the base
  for (let k = 0; k <= 14; k++) { const tx = k / 14 * 96; fg.beginPath(); fg.moveTo(48, 96); fg.lineTo(tx, 4); fg.stroke(); }
  const finTex = new THREE.CanvasTexture(finCv);
  const finMat = new THREE.MeshPhysicalMaterial({ map: finTex, color: 0xd9c79a, roughness: 0.4, metalness: 0,
    side: THREE.DoubleSide, transparent: true, opacity: 0.84, envMapIntensity: 0.85, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  group.disposables.push(finTex, finMat);

  // broad, slightly-forked tail
  const tail = new THREE.Shape();
  tail.moveTo(0, 0);
  tail.quadraticCurveTo(-0.5, 0.55, -0.92, 0.7); tail.quadraticCurveTo(-0.78, 0.32, -0.72, 0);
  tail.quadraticCurveTo(-0.78, -0.32, -0.92, -0.7); tail.quadraticCurveTo(-0.5, -0.55, 0, 0);
  const tailMesh = new THREE.Mesh(new THREE.ShapeGeometry(tail), finMat);
  tailMesh.position.x = -LEN / 2 + 0.04; tailMesh.scale.setScalar(1.05); group.add(tailMesh); group.tail = tailMesh;

  // Median fins lie in the body's vertical midline plane (X-Y, z=0) so they run
  // ALONG the spine like the tail — not across the body.
  // Spiny dorsal: stiff sail with a scalloped (spined) top edge.
  const spiny = new THREE.Shape();
  spiny.moveTo(-0.46, 0);
  spiny.lineTo(-0.42, 0.24); spiny.lineTo(-0.34, 0.29); spiny.lineTo(-0.27, 0.25);
  spiny.lineTo(-0.18, 0.31); spiny.lineTo(-0.10, 0.28); spiny.lineTo(-0.02, 0.33);
  spiny.lineTo(0.07, 0.29); spiny.lineTo(0.15, 0.32); spiny.lineTo(0.24, 0.28);
  spiny.lineTo(0.33, 0.29); spiny.lineTo(0.40, 0.22); spiny.lineTo(0.46, 0);
  spiny.closePath();
  const sd = new THREE.Mesh(new THREE.ShapeGeometry(spiny), finMat);
  sd.position.set(0.18, topY(0.52) - 0.13, 0); group.add(sd); group.dorsal = sd;
  // Soft dorsal: a single rounded lobe set behind the spiny sail.
  const soft = new THREE.Shape();
  soft.moveTo(-0.30, 0); soft.quadraticCurveTo(-0.12, 0.34, 0.12, 0.30);
  soft.quadraticCurveTo(0.24, 0.25, 0.30, 0); soft.closePath();
  const softD = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
  softD.position.set(-0.52, topY(0.34) - 0.10, 0); group.add(softD);
  // Anal fin: a smaller rounded lobe on the underside, mirrored downward.
  const af = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
  af.scale.set(0.7, -0.7, 0.7); af.position.set(-0.58, botY(0.36) + 0.10, 0); group.add(af);
  // pectoral (fan, just behind the gill) + pelvic fins
  const pec = new THREE.Shape();
  pec.moveTo(0, 0); pec.quadraticCurveTo(-0.2, 0.5, -0.62, 0.5); pec.quadraticCurveTo(-0.42, 0.14, -0.5, 0); pec.closePath();
  for (const s of [1, -1]) {
    const pf = new THREE.Mesh(new THREE.ShapeGeometry(pec), finMat);
    pf.scale.set(0.7, 0.7, 0.7); pf.rotation.x = s * 1.0; pf.rotation.z = -0.5;
    pf.position.set(LEN * 0.24, -depth(0.74) * 0.1, s * depth(0.74) * widthFac(0.74) * 0.95); group.add(pf);
    const pv = new THREE.Mesh(new THREE.ShapeGeometry(soft), finMat);
    pv.scale.set(0.3, 0.3, 0.3); pv.rotation.x = s * 1.15;
    pv.position.set(LEN * 0.1, botY(0.56) + 0.04, s * depth(0.56) * widthFac(0.56) * 0.6); group.add(pv);
  }

  // Eyes are painted into the head texture (see bassTextures) so they are part
  // of the body mesh and always stay attached when the fish turns — no separate
  // eyeball geometry to disconnect.

  // slightly-open gape — a dark mouth cavity set into the snout, with a pale
  // lower lip below it, so the bass reads as actively feeding from any angle
  const snoutX = LEN * 0.475, jawY = -depth(0.96) * 0.18;
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.6, side: THREE.DoubleSide });
  const gape = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mouthMat);
  gape.scale.set(0.13, 0.06, 0.15); gape.position.set(snoutX, jawY + 0.03, 0); group.add(gape);
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x8a8a6a, roughness: 0.7 });
  const lip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), lipMat);
  lip.scale.set(0.12, 0.045, 0.15); lip.position.set(snoutX - 0.01, jawY - 0.04, 0); group.add(lip);
  group.disposables.push(mouthMat, lipMat);

  // tracked mouth point at the front of the head, so a hooked line attaches here
  group.mouth = new THREE.Object3D(); group.mouth.position.set(LEN * 0.52, -depth(0.95) * 0.1, 0); group.add(group.mouth);
  return group;
}

const Scene3D = (() => {
  let renderer, scene, camera, canvas, ready = false, visible = false;
  let surf, bottom, motes, biteSlab, biteEdgeTop, biteEdgeBot, biteLabel, zoneRing, arrowUp, arrowDn;
  let terrainSets = {}, uwHemi, uwSun;
  let lureGroup, lineMesh, fightFish, fightArtKey = "", lureTrail, trailPts = [];
  let pursuers = [], rays = [];
  const clock = { t: 0 };

  // surface world (above the water — idle / aim / cast)
  let scene2, camS, water, sunS, sunMesh, sunGlow, boat, aimRing, castLine, castLure;
  let fishShadows = [], hills, structProps, world;
  let splashRings = [], surfFish = null, surfFishKey = "", boil, castSplashed = false;
  let skyKey = "", envMap = null;
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ray = new THREE.Raycaster();
  const ROD_S = new THREE.Vector3(0.45, 0.95, 3.6);   // rod tip in the surface scene

  // depth (0 surface .. 1 deep) -> world Y ; line-dist (0 boat .. 1 far) -> world X
  // mapped so the typical bite range (shallow..mid) sits centred in frame,
  // not crammed against the surface up top.
  const yOf = d => 1.7 - d * 5.6;
  const xOf = dist => -1.7 + dist * 3.4;          // kept inside the portrait frame
  const ROD = new THREE.Vector3(-2.2, 2.4, 0.2);  // line enters from the top-left

  // build a prefiltered environment map (sky gradient + sun) for realistic
  // reflections on the wet fish skin and the water
  function buildEnv(rnd) {
    try {
      const pmrem = new THREE.PMREMGenerator(rnd);
      const es = new THREE.Scene();
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(50, 24, 16),
        new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
      );
      const top = new THREE.Color(0x9fd8ef), bot = new THREE.Color(0x16384a);
      const pos = sky.geometry.attributes.position, col = [];
      for (let i = 0; i < pos.count; i++) {
        const yN = (pos.getY(i) / 50) * 0.5 + 0.5;
        const c = bot.clone().lerp(top, yN); col.push(c.r, c.g, c.b);
      }
      sky.geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      es.add(sky);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
      sun.position.set(14, 26, -10); es.add(sun);
      const tex = pmrem.fromScene(es, 0, 0.1, 100).texture;
      sky.geometry.dispose(); sky.material.dispose(); sun.geometry.dispose(); sun.material.dispose(); pmrem.dispose();
      return tex;
    } catch (e) { return null; }
  }

  function init(cv) {
    canvas = cv;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 3));   // crisp on strong GPUs
    if (THREE.ACESFilmicToneMapping !== undefined) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; }
    resize();
    envMap = buildEnv(renderer);                    // image-based lighting for real reflections
    loadRealModels();                               // pick up any models/<species>.glb you drop in
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a3a4a);   // opaque so it fully covers the 2D layer
    scene.fog = new THREE.FogExp2(0x0d3f55, 0.052);
    scene.environment = envMap;

    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, -0.3, 9.4);
    camera.lookAt(0.2, -0.7, 0);

    uwHemi = new THREE.HemisphereLight(0xcdeeff, 0x09232f, 1.15); scene.add(uwHemi);
    uwSun = new THREE.DirectionalLight(0xfff2cf, 1.45);
    uwSun.position.set(2, 9, 5); scene.add(uwSun);

    // underside of the water surface
    surf = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x2a93b8, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
    );
    surf.rotation.x = -Math.PI / 2; surf.position.y = 2.9; scene.add(surf);

    // god-ray cones streaming down from the surface (shafts of light)
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xeaf9ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 8; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4 + (i % 3) * 0.5, 15, 8, 1, true), rayMat.clone());
      cone.position.set((i - 3.5) * 1.9, 3.5, -3 - (i % 4)); cone.rotation.x = Math.PI; cone.rotation.z = (i - 3.5) * 0.04;
      cone.userData.phase = i * 0.7; scene.add(cone); rays.push(cone);
    }

    // contoured bottom with a drop-off ledge + lumps (worked structure)
    const bgeo = new THREE.PlaneGeometry(44, 30, 32, 18);
    { const bp = bgeo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), y = bp.getY(i);          // y: + = near boat, - = far
        let h = -Math.tanh((y + 2) * 0.45) * 0.9;       // a break/drop-off across the middle
        h += Math.sin(x * 0.55) * 0.22 + Math.cos(y * 0.7 + x * 0.3) * 0.18 + (Math.random() - 0.5) * 0.06;
        bp.setZ(i, h);
      }
      bgeo.computeVertexNormals();
    }
    bottom = new THREE.Mesh(bgeo, new THREE.MeshStandardMaterial({ map: siltTexture(), color: 0xcabf90, roughness: 1 }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = -3.5; scene.add(bottom);
    buildTerrain();

    // drifting particulate
    const pc = 220, pg = new THREE.BufferGeometry(), pa = new Float32Array(pc * 3);
    for (let i = 0; i < pc; i++) { pa[i*3] = (Math.random()-0.5)*24; pa[i*3+1] = (Math.random()-0.5)*14; pa[i*3+2] = (Math.random()-0.5)*16; }
    pg.setAttribute("position", new THREE.BufferAttribute(pa, 3));
    motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xcfeefb, size: 0.04, transparent: true, opacity: 0.5 }));
    scene.add(motes);

    // bite-zone slab + dashed-look edges
    biteSlab = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.1, 3.2),
      new THREE.MeshBasicMaterial({ color: 0x5be37a, transparent: true, opacity: 0.14, depthWrite: false })
    );
    scene.add(biteSlab);
    const edgeMat = () => new THREE.MeshBasicMaterial({ color: 0x78f096, transparent: true, opacity: 0.6, depthWrite: false });
    biteEdgeTop = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.04, 3.2), edgeMat());
    biteEdgeBot = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.04, 3.2), edgeMat());
    scene.add(biteEdgeTop); scene.add(biteEdgeBot);
    // "BITE ZONE" label sprite (always faces the camera)
    biteLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture("🎯 BITE ZONE"), transparent: true, depthWrite: false, depthTest: false }));
    biteLabel.scale.set(2.2, 0.55, 1); scene.add(biteLabel);
    // in-zone ring (pulses around the lure when it's in the zone) + up/down coaching arrows
    zoneRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28), new THREE.MeshBasicMaterial({ color: 0x78f096, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    zoneRing.visible = false; scene.add(zoneRing);
    const arrowMat = () => new THREE.MeshBasicMaterial({ color: 0xffe7a6, transparent: true, depthTest: false });
    arrowUp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), arrowMat()); arrowUp.visible = false; scene.add(arrowUp);
    arrowDn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), arrowMat()); arrowDn.rotation.z = Math.PI; arrowDn.visible = false; scene.add(arrowDn);

    // the lure + its line (scaled up so it reads clearly underwater)
    lureGroup = buildLure(); lureGroup.scale.setScalar(1.35); scene.add(lureGroup);
    // a fading wobble trail tracing the lure's recent path through the water
    { const TN = 18, ta = new Float32Array(TN * 3), tc = new Float32Array(TN * 3);
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(ta, 3));
      tg.setAttribute("color", new THREE.BufferAttribute(tc, 3));
      lureTrail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
      lureTrail.frustumCulled = false; lureTrail.visible = false; scene.add(lureTrail);
    }
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
  // a tiling ripple normal map for the water surface
  function rippleNormal() {
    const N = 512, cv = document.createElement("canvas"); cv.width = N; cv.height = N;
    const g = cv.getContext("2d");
    g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * N, y = Math.random() * N, r = 8 + Math.random() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.5)"); grd.addColorStop(0.5, "rgba(128,128,128,0.0)"); grd.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    }
    const tx = heightToNormal(cv, 1.4);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(8, 8);
    return tx;
  }

  function buildSurface() {
    scene2 = new THREE.Scene();
    scene2.background = new THREE.Color(0x8fd0e6);
    scene2.fog = new THREE.Fog(0xbfe6f0, 14, 70);     // haze blends distant water into the sky
    scene2.environment = envMap;

    camS = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 220);
    camS.position.set(0, 3.0, 8.8); camS.lookAt(0, -0.5, -9);

    scene2.add(new THREE.HemisphereLight(0xdff2ff, 0x2a6c5a, 1.0));
    sunS = new THREE.DirectionalLight(0xfff2cf, 1.4); sunS.position.set(3, 8, -2); scene2.add(sunS);

    // rippling water (stays put — the world turns around the boat, not the water)
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200, 1, 1),
      new THREE.MeshPhysicalMaterial({ color: 0x1f6f92, roughness: 0.12, metalness: 0.0, normalMap: rippleNormal(), normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.2, clearcoat: 0.5, clearcoatRoughness: 0.2 })
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

    // splash-ring pool (lure splashdown, fish boils)
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.34, 28), new THREE.MeshBasicMaterial({ color: 0xeaf6fb, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      r.rotation.x = -Math.PI / 2; r.visible = false; r.userData = { life: 0, max: 1 }; scene2.add(r); splashRings.push(r);
    }
    // a churning "boil" disc that shows where a hooked fish is working sub-surface
    boil = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    boil.rotation.x = -Math.PI / 2; boil.visible = false; scene2.add(boil);
  }

  function splashAt(x, z, size) {
    const r = splashRings.find(s => !s.visible) || splashRings[0];
    r.visible = true; r.position.set(x, 0.06, z); r.userData.life = 0; r.userData.max = size || 1;
    r.scale.setScalar(0.4);
  }
  function ensureSurfFish(art) {
    const key = JSON.stringify(art || {});
    if (!surfFish || key !== surfFishKey) {
      if (surfFish) { scene2.remove(surfFish); if (surfFish.disposables) surfFish.disposables.forEach(d => d.dispose && d.dispose()); surfFish.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      surfFish = makeBass(art || {}); scene2.add(surfFish); surfFishKey = key;
    }
    return surfFish;
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

    // angler — a standing figure viewed from behind (legs, vest, capped head),
    // posed like the Sega caster on the bow deck. Local y=0 is the deck.
    const ang = new THREE.Group(); ang.position.set(0.16, 0.42, 0.75);
    const skin = new THREE.MeshStandardMaterial({ color: 0xe2b489, roughness: 0.8 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x39506e, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xecefef, roughness: 0.85 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xb23528, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.7 });
    for (const sx of [-1, 1]) {                          // legs + shoes
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.072, 0.72, 8), jeans);
      leg.position.set(sx * 0.11, 0.38, 0); ang.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.27), shoeMat);
      shoe.position.set(sx * 0.11, 0.05, 0.05); ang.add(shoe);
    }
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.24, 12), jeans); hips.position.y = 0.84; ang.add(hips);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.185, 0.5, 12), shirt); torso.position.y = 1.18; ang.add(torso);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.205, 0.44, 14, 1, true), vestMat); vest.position.y = 1.2; ang.add(vest);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), vestMat); collar.rotation.x = Math.PI / 2; collar.position.y = 1.44; ang.add(collar);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin); neck.position.y = 1.47; ang.add(neck);
    const aHead = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 16), skin); aHead.position.y = 1.6; ang.add(aHead);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12, 0, 6.28, 0, Math.PI / 2), capMat); cap.position.y = 1.61; ang.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16, 1, false, 0, Math.PI), capMat);
    brim.position.set(0, 1.6, -0.12); ang.add(brim);    // bill points forward (-z)
    // arms — shoulder-pivoted so they hold the rod, crank the reel, and reach
    // out to lip/swing a landed fish
    const sleeve = new THREE.MeshStandardMaterial({ color: 0xecefef, roughness: 0.85 });
    function makeArm(side) {
      // a single continuous limb (sleeve + rolled-cuff forearm flush in line) so
      // it always reads as ONE arm — no elbow kink that looks like a second limb
      const arm = new THREE.Group(); arm.position.set(side * 0.19, 1.32, 0.0);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.42, 8), sleeve);
      upper.position.set(0, -0.21, 0); arm.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.044, 0.34, 8), skin);
      fore.position.set(0, -0.57, 0); arm.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), skin); hand.position.set(0, -0.75, 0); arm.add(hand); arm.hand = hand;
      arm.rotation.x = 1.45;            // +x swings forward; reaches up to the rod grip
      return arm;
    }
    const armL = makeArm(1), armR = makeArm(-1);
    ang.add(armL); ang.add(armR);
    g.add(ang);
    g.angler = ang; g.armL = armL; g.armR = armR;
    // fishing rod — a chain of many short segments so it bends in a smooth,
    // continuous parabolic curve under load (not a single hinge), with real
    // line-guide eyelets running the line up to the tip.
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 0.35, metalness: 0.35 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x322318, roughness: 0.9 });   // EVA foam grip
    const guideMat = new THREE.MeshStandardMaterial({ color: 0xcdd2d6, roughness: 0.3, metalness: 0.7 });
    const rod = new THREE.Group(); rod.position.set(0.22, 1.06, 0.2);
    const NSEG = 11, segLen = 0.34, segs = [], guides = [];
    let parent = rod;
    for (let i = 0; i < NSEG; i++) {
      const seg = new THREE.Group(); if (i > 0) seg.position.y = segLen;
      const f0 = i / NSEG, f1 = (i + 1) / NSEG;
      const r0 = 0.05 * (1 - f0) + 0.011, r1 = 0.05 * (1 - f1) + 0.011;   // smooth taper to the tip
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen, 8), rodMat);
      cyl.position.y = segLen / 2; seg.add(cyl);
      // a line-guide eyelet near the top of each segment (from the 2nd up),
      // standing off the +z side; the line threads through the ring
      if (i >= 1) {
        const gsz = 0.045 * (1 - f1) + 0.016, stand = r1 + gsz + 0.012;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, stand, 6), guideMat);
        post.rotation.x = Math.PI / 2; post.position.set(0, segLen - 0.03, stand / 2); seg.add(post);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(gsz, 0.008, 6, 14), guideMat);
        ring.rotation.x = Math.PI / 2; ring.position.set(0, segLen - 0.03, stand); seg.add(ring);
        const center = new THREE.Object3D(); center.position.copy(ring.position); seg.add(center); guides.push(center);
      }
      parent.add(seg); parent = seg; segs.push(seg);
    }
    const tip = new THREE.Object3D(); tip.position.y = segLen; parent.add(tip);
    g.rodSegs = segs; g.rodGuides = guides;
    // EVA grip + reel seat at the butt
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.52, 12), gripMat); grip.position.y = 0.24; rod.add(grip);
    // spinning reel with a crank handle, hung under the seat
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 14), trimMat);
    reel.rotation.x = Math.PI / 2; reel.position.set(0, 0.5, 0.14); rod.add(reel);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 12), gripMat); spool.rotation.x = Math.PI / 2; spool.position.set(0, 0.5, 0.2); rod.add(spool);
    const handle = new THREE.Group(); handle.position.set(0, 0.5, 0.2); rod.add(handle); g.reelHandle = handle;
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 6), trimMat); crank.position.set(0.07, 0, 0); crank.rotation.z = Math.PI / 2; handle.add(crank);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), deckMat); knob.position.set(0.14, 0, 0); handle.add(knob);
    // the line running up the rod through the guides (updated each frame)
    const rodLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    g.add(rodLine); g.rodLine = rodLine;
    const reelExit = new THREE.Object3D(); reelExit.position.set(0, 0.56, 0.18); rod.add(reelExit); g.reelExit = reelExit;
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
    // cinematic camera: swing to a 3/4 side view to watch the fish get boated
    if (!camS.userData.look) camS.userData.look = new THREE.Vector3(0, -0.5, -9);
    const onLanding = st.mode === "landing" && st.landing;
    const camPos = onLanding ? { x: 3.5, y: 2.2, z: 8.7 } : { x: -0.95, y: 2.45, z: 8.4 };
    const camLook = onLanding ? { x: 0.0, y: 0.9, z: 5.0 } : { x: 0.35, y: 0.4, z: -9 };
    const k = Math.min(1, dt * 0.005);
    camS.position.x += (camPos.x - camS.position.x) * k;
    camS.position.y += (camPos.y - camS.position.y) * k;
    camS.position.z += (camPos.z - camS.position.z) * k;
    camS.userData.look.x += (camLook.x - camS.userData.look.x) * k;
    camS.userData.look.y += (camLook.y - camS.userData.look.y) * k;
    camS.userData.look.z += (camLook.z - camS.userData.look.z) * k;
    camS.lookAt(camS.userData.look);

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
    world.rotation.y = heading;   // ▶ turns the boat right -> world slides left (and back)

    // animate water ripples + boat bob
    water.material.normalMap.offset.x = t * 0.015;
    water.material.normalMap.offset.y = t * 0.008;
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

    // ---- rod animation per phase (cast whip / fight bend / landing hoist) ----
    const lerp = (a, b, k) => a + (b - a) * k;
    const rod = boat.rod, tipSec = boat.rodTipSec;
    const casting = st.mode === "casting", splashing = st.mode === "splashdown";
    const fighting = st.mode === "fight" && st.fight, landing = st.mode === "landing" && st.landing;
    const p = casting ? Math.min(1, st.castProgress || 0) : 0;
    let bend = 0;
    if (casting) {
      let rx, rz;
      if (p < 0.32) { const u = 1 - Math.pow(1 - p / 0.32, 2); rx = lerp(-0.95, 1.15, u); rz = lerp(0.12, 0.6, u); }
      else if (p < 0.5) { const u = (p - 0.32) / 0.18, e = 1 - Math.pow(1 - u, 3); rx = lerp(1.15, -1.5, e); rz = lerp(0.6, 0.12, e); }
      else { rx = lerp(-1.5, -1.05, (p - 0.5) / 0.5); rz = 0.12; }
      rod.rotation.x = rx; rod.rotation.z = rz;
    } else if (fighting) {
      const f = st.fight, load = 0.4 + f.tension * 0.9 + f.pull * 0.25;
      const pump = f.reeling ? Math.sin(t * 7) * 0.13 : 0;          // reeling pumps the rod
      rod.rotation.x = -0.5 - load * 0.12 + pump;                   // held up high, dips with load
      rod.rotation.z = 0.12 + Math.sin(t * 5) * f.tension * 0.06;
      bend = -(0.45 + load * 0.75) - Math.abs(Math.sin(t * 9)) * 0.05;  // tip bows forward toward the fish
    } else if (landing) {
      const e = landing.t;
      rod.rotation.x = lerp(-0.6, 0.25, e); rod.rotation.z = 0.12;  // hoist up
      bend = -(0.6 * (1 - e) + 0.12);
    } else {
      rod.rotation.x += (-0.95 + Math.sin(t * 1.3) * 0.04 - rod.rotation.x) * Math.min(1, dt * 0.01);
      rod.rotation.z += (0.12 - rod.rotation.z) * Math.min(1, dt * 0.01);
    }
    // ease the total bend, then spread it over the segments (more curve toward
    // the tip) so the rod bows in a smooth, continuous arc
    boat._bend = (boat._bend || 0) + (bend - (boat._bend || 0)) * Math.min(1, dt * 0.02);
    if (boat.rodSegs) {
      const n = boat.rodSegs.length, sum = n * (n + 1) / 2;
      for (let i = 0; i < n; i++) boat.rodSegs[i].rotation.x = boat._bend * (i + 1) / sum;
    }
    // reel the handle while fighting + reeling, or during the landing hoist
    // reel handle spins while you hold to reel (and during the landing wind-in)
    if (boat.reelHandle) boat.reelHandle.rotation.z -= ((fighting && st.fight.reeling) || landing ? dt * 0.045 : 0);

    // angler's arms: hold the rod, crank the reel, reach out to land the fish
    const armL = boat.armL, armR = boat.armR;
    if (armL && armR) {
      // NOTE: +rotation.x swings the arm FORWARD/up toward the rod, 0 = hanging down
      if (fighting) {
        armL.rotation.x += (1.55 - armL.rotation.x) * 0.15; armL.rotation.z *= 0.85;
        if (st.fight.reeling) { armR.rotation.x = 1.5 + Math.sin(t * 7) * 0.2; armR.rotation.z = Math.cos(t * 7) * 0.24; }  // cranking
        else { armR.rotation.x += (1.5 - armR.rotation.x) * 0.12; armR.rotation.z *= 0.85; }
        if (boat.angler) boat.angler.rotation.x *= 0.9;
      } else if (landing) {
        const e = landing.t, reach = Math.sin(Math.min(1, e / 0.5) * Math.PI / 2), lift = Math.max(0, (e - 0.5) / 0.5);
        const ax = 1.35 - reach * 0.8 + lift * 1.4;                 // reach down to the water, then hoist up
        armL.rotation.x = ax; armR.rotation.x = ax;
        armL.rotation.z = 0.2 * reach; armR.rotation.z = -0.2 * reach;
        if (boat.angler) boat.angler.rotation.x = reach * 0.4 - lift * 0.25;   // lean to reach, sit back to lift
      } else {
        // two-handed hold: the lower (support) hand grips the foregrip, the upper
        // hand the reel seat — staggered so BOTH hands read, not one behind the body
        armL.rotation.x += (1.28 + Math.sin(t * 1.2) * 0.03 - armL.rotation.x) * 0.08;     // lower grip
        armR.rotation.x += (1.6 + Math.sin(t * 1.2 + 1) * 0.03 - armR.rotation.x) * 0.08;  // up on the reel
        armL.rotation.z += (-0.05 - armL.rotation.z) * 0.08; armR.rotation.z += (0.1 - armR.rotation.z) * 0.08;
        if (boat.angler) boat.angler.rotation.x *= 0.9;
      }
    }
    boat.updateMatrixWorld(true);
    const tip = boat.rodTip.getWorldPosition(new THREE.Vector3());

    // thread the line up the rod through the guide eyelets to the tip
    if (boat.rodLine) {
      const pts = [boat.reelExit.getWorldPosition(new THREE.Vector3())];
      for (const gd of boat.rodGuides) pts.push(gd.getWorldPosition(new THREE.Vector3()));
      pts.push(tip.clone());
      boat.rodLine.geometry.setFromPoints(pts);
    }

    // the cast lure shows the chosen lure model + colour
    if (castLure.setType) { castLure.setType(st.lureId); castLure.body.material.color.set(st.lureHex || 0xff5a2a); }

    const land = st.castAim ? screenToWater(st.castAim.x, st.castAim.y) : null;

    // ---- cast: lure rides the tip through the whip, then arcs out & splashes ----
    if (casting && land) {
      const landV = new THREE.Vector3(land.x, 0.05, land.z);
      let pos;
      if (p < 0.45) pos = tip.clone();
      else { const fp = (p - 0.45) / 0.55; pos = tip.clone().lerp(landV, fp); pos.y += Math.sin(fp * Math.PI) * (2.4 + tip.distanceTo(landV) * 0.14); }
      castLure.visible = true; castLure.position.copy(pos);
      castLure.body.material.color.set(st.lureHex || 0xff5a2a);
      castLine.visible = true; castLine.material.color.setHex(0xffffff); castLine.material.opacity = 0.6;
      castLine.geometry.setFromPoints([tip, pos]);
      aimRing.visible = true; aimRing.position.copy(landV); aimRing.scale.setScalar(0.8 + 0.12 * Math.sin(t * 6));
      castSplashed = false;
    } else if (splashing && land) {
      // lure has hit the water — kick a splash + spreading rings, lure resting
      if (!castSplashed) { splashAt(land.x, land.z, 1.3); castSplashed = true; }
      castLure.visible = true; castLure.position.set(land.x, 0.05 + Math.sin(t * 8) * 0.03, land.z);
      castLine.visible = true; castLine.geometry.setFromPoints([tip, new THREE.Vector3(land.x, 0.05, land.z)]);
      aimRing.visible = false;
    } else {
      castLure.visible = false;
      if (!fighting && !landing) { castLine.visible = false; aimRing.visible = false; }
    }

    // ---- fight: the hooked bass out in front, boiling / jumping, drawing closer ----
    if (fighting) {
      const f = st.fight, fish = ensureSurfFish(f.art);
      const dist3d = 2.3 + f.dist * 13;
      // side-to-side running, scaled so it stays in frame as it nears the boat
      const fxw = (f.lat || 0) * (1.2 + f.dist * 2.2) + Math.sin(t * 0.6) * 0.4 * (0.35 + f.dist);
      let fy;
      if (f.state === "jump") fy = 0.35 + Math.abs(Math.sin(t * 5)) * 1.7;
      else fy = f.dist < 0.22 ? -0.12 : -0.55;
      const sz = isFinite(f.size) ? f.size : 0.5, pull = isFinite(f.pull) ? f.pull : 0;
      // grows a little as it's worked closer (perspective already enlarges it too)
      const near = 1 - Math.min(1, isFinite(f.dist) ? f.dist : 1);
      const sc = (0.55 + sz * 0.8) * (1 + near * 0.3);
      fish.visible = true; fish.scale.setScalar(sc); fish.position.set(fxw, fy, -dist3d);
      // present a 3/4 BROADSIDE view (flank to the camera) so the whole bass
      // reads as one fish — head-on it looked like loose eyes and fins. It
      // thrashes (roll), sways, and turns into its lateral runs.
      const yawBase = f.state === "jump" ? -0.55 : -0.78;
      fish.rotation.set(
        f.state === "jump" ? -0.4 : Math.sin(t * 3) * 0.1,
        yawBase + Math.sin(t * 1.3) * 0.3 + (f.lat || 0) * 0.5,
        Math.sin(t * 5) * 0.16
      );
      if (fish.tail) fish.tail.rotation.y = Math.sin(t * (8 + pull * 4)) * 0.5;
      undulate(fish, t, 0.16 + pull * 0.06, true);
      boil.visible = f.state !== "jump";
      boil.position.set(fxw, 0.05, -dist3d); boil.material.opacity = 0.22 + Math.sin(t * 10) * 0.1;
      boil.scale.setScalar(0.7 + sc * 0.3 + Math.sin(t * 6) * 0.12);
      if (f.state === "jump" && Math.sin(t * 5) > 0.96) splashAt(fxw, -dist3d, 1.4);
      // surface splash when it rolls/thrashes near the boat
      if (f.state !== "jump" && f.dist < 0.4 && Math.sin(t * 6) > 0.93) splashAt(fxw, -dist3d, 0.8 + (0.4 - f.dist) * 2);
      fish.updateMatrixWorld(true);
      const mouth = fish.mouth.getWorldPosition(new THREE.Vector3());
      castLine.visible = true; castLine.material.color.setHex(f.tension > 0.7 ? 0xff6a6a : 0xffffff);
      castLine.material.opacity = 0.7; castLine.geometry.setFromPoints([tip, mouth]);
    } else if (landing) {
      // boat the fish — swing the small ones in, hoist the big ones up by the lip
      const e = landing.t, fish = ensureSurfFish(landing.art), sc = 0.6 + (landing.size || 0.5) * 0.9;
      fish.visible = true; fish.scale.setScalar(sc);
      let pos;
      if (landing.big) {
        // lip: draw the fish up to the bow beside the angler, then lift it aboard
        const inN = Math.min(1, e / 0.6);
        const z = lerp(-2.6, 4.7, inN);                            // comes to the boat
        const y = e < 0.6 ? lerp(-0.4, 0.2, inN) : lerp(0.2, 1.25, (e - 0.6) / 0.4);  // to the surface, then hoisted
        pos = new THREE.Vector3(0.1 + Math.sin(t * 2) * 0.12, y, z);
      } else {
        // swing: skip the fish up and back over the gunwale fast
        const a = Math.sin(e * Math.PI * 0.5);
        pos = new THREE.Vector3(0, lerp(-0.3, 1.3, a), lerp(-3.0, 5.4, e));
      }
      fish.position.copy(pos);
      fish.rotation.set(0.2 * Math.sin(t * 7), -Math.PI / 2, 0.3 + Math.sin(t * 9) * 0.25 * (1 - e));
      if (fish.tail) fish.tail.rotation.y = Math.sin(t * 12) * 0.5 * (1 - e * 0.5);
      undulate(fish, t * 1.5, 0.12 * (1 - e * 0.6), true);
      boil.visible = false;
      if (e < 0.06 && !castSplashed) { splashAt(pos.x, pos.z, 1.5); castSplashed = true; }
      fish.updateMatrixWorld(true);
      const mouth = fish.mouth.getWorldPosition(new THREE.Vector3());
      castLine.visible = true; castLine.material.color.setHex(0xffffff); castLine.material.opacity = 0.45;
      castLine.geometry.setFromPoints([tip, mouth]);
    } else {
      if (surfFish) surfFish.visible = false;
      boil.visible = false;
      if (!casting && !splashing) castSplashed = false;
    }

    // animate the splash rings (expand + fade)
    for (const r of splashRings) {
      if (!r.visible) continue;
      r.userData.life += dt / 650;
      if (r.userData.life >= 1) { r.visible = false; continue; }
      r.scale.setScalar(0.4 + r.userData.life * 2.6 * r.userData.max);
      r.material.opacity = 0.55 * (1 - r.userData.life);
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
    // the bottom stays silt-coloured (just tinted toward the water) so it reads
    // as a lit lakebed up close while depth fog blends the distance into the water
    bottom.material.color.copy(new THREE.Color(0xcabf90).lerp(new THREE.Color(water1), 0.4));
    scene.fog.color.set(water1);
    scene.background.set(water1);
  }

  // canvas silt/sand texture for the lakebed — mottled patches, ripples, grain
  function siltTexture() {
    const N = 256, cv = document.createElement("canvas"); cv.width = N; cv.height = N;
    const x = cv.getContext("2d");
    x.fillStyle = "#8f8a68"; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) {                      // mottled silt patches
      x.globalAlpha = 0.04 + Math.random() * 0.08; x.fillStyle = Math.random() < 0.5 ? "#6f6a4a" : "#a8a47e";
      x.beginPath(); x.arc(Math.random() * N, Math.random() * N, 8 + Math.random() * 40, 0, 6.28); x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = "rgba(80,76,54,0.16)"; x.lineWidth = 2;   // faint sand ripples
    for (let y = 0; y < N; y += 10) { x.beginPath(); for (let xx = 0; xx <= N; xx += 8) x.lineTo(xx, y + Math.sin(xx * 0.09) * 4); x.stroke(); }
    for (let i = 0; i < 2200; i++) {                     // fine grain
      x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      x.fillRect(Math.random() * N, Math.random() * N, 1.5, 1.5);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 5);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // canvas bark texture for submerged timber — vertical grooves + cracks
  function barkTexture() {
    const N = 128, cv = document.createElement("canvas"); cv.width = N; cv.height = N;
    const x = cv.getContext("2d");
    x.fillStyle = "#6b4d2e"; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) {                       // vertical streaks/grooves
      const px = Math.random() * N, w = 1 + Math.random() * 3, lit = Math.random() < 0.5;
      x.strokeStyle = lit ? `rgba(225,190,140,${0.05 + Math.random() * 0.12})` : `rgba(30,18,8,${0.06 + Math.random() * 0.16})`;
      x.lineWidth = w; x.beginPath(); let xx = px; x.moveTo(xx, 0);
      for (let y = 0; y <= N; y += 12) { xx += (Math.random() - 0.5) * 4; x.lineTo(xx, y); }
      x.stroke();
    }
    for (let i = 0; i < 6; i++) {                         // a few horizontal cracks
      const y = Math.random() * N; x.strokeStyle = "rgba(20,12,6,0.3)"; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y); x.lineTo(N, y + (Math.random() - 0.5) * 6); x.stroke();
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- underwater structure sets, shown by the spot's structure group ----
  function buildTerrain() {
    const place = (m, x, y, z) => { m.position.set(x, y, z); return m; };
    // VEG — weed beds / lily stalks rising off the bottom
    const veg = new THREE.Group();
    const weedMat = new THREE.MeshStandardMaterial({ color: 0x2f6b35, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.3 + Math.random() * 0.8, 5), weedMat);
      place(blade, -2.6 + Math.random() * 5.2, -3.0 + Math.random() * 0.5, -0.6 - Math.random() * 2.4);
      blade.userData.sway = Math.random() * 6.28; veg.add(blade);
    }
    // WOOD — flooded timber: standing dead trunks (what bass relate to) plus a
    // fallen laydown log, all bark-textured. Matches the Sega underwater shot.
    const wood = new THREE.Group();
    const barkMap = barkTexture();
    const barkMat = new THREE.MeshStandardMaterial({ map: barkMap, color: 0x9a774e, roughness: 0.95 });
    const barkDark = new THREE.MeshStandardMaterial({ map: barkMap, color: 0x6a4e2d, roughness: 0.95 });
    const trunks = [
      { x: -1.9, z: -1.5, h: 3.3, r: 0.20, lean: 0.07 },
      { x: 0.5, z: -2.3, h: 4.0, r: 0.24, lean: -0.05 },
      { x: 1.7, z: -1.1, h: 2.5, r: 0.15, lean: 0.11 },
      { x: -0.6, z: -2.9, h: 3.0, r: 0.18, lean: 0.03 },
    ];
    for (const tk of trunks) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(tk.r * 0.62, tk.r, tk.h, 10), barkMat);
      tr.position.set(tk.x, -3.4 + tk.h / 2, tk.z); tr.rotation.z = tk.lean; tr.rotation.x = tk.lean * 0.5; wood.add(tr);
      const top = new THREE.Mesh(new THREE.ConeGeometry(tk.r * 0.6, tk.r * 0.8, 9), barkMat);   // short splintered top
      top.position.set(tk.x + tk.lean * tk.h * 0.5, -3.4 + tk.h, tk.z); top.rotation.z = tk.lean; wood.add(top);
      if (tk.h > 3) {                                  // a stub limb on the taller snags
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 1.0, 6), barkDark);
        br.rotation.z = 1.0 + tk.lean; br.position.set(tk.x + 0.4, -3.4 + tk.h * 0.66, tk.z + 0.1); wood.add(br);
      }
    }
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 4.0, 10), barkMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = 0.3; place(log, -0.3, -3.0, -0.5); wood.add(log);
    // ROCK — boulder pile
    const rock = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6066, roughness: 1, flatShading: true });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.5, 0), rockMat);
      place(b, -2.2 + i * 0.85 + Math.random() * 0.3, -3.1 + Math.random() * 0.4, -0.8 - Math.random() * 2);
      b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); rock.add(b);
    }
    // DEEP — a rocky drop-off: a low rubble shelf of clustered boulders along
    // the edge (the contoured bottom already provides the actual break)
    const deep = new THREE.Group();
    const deepRock = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + Math.random() * 0.6, 0), deepRock);
      place(b, -3.2 + i * 0.6 + Math.random() * 0.3, -3.05 + Math.random() * 0.45, -1.2 - Math.random() * 1.8);
      b.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); b.scale.y = 0.6 + Math.random() * 0.4; deep.add(b);
    }
    // OPEN — bare; nothing to add
    const open = new THREE.Group();

    terrainSets = { veg, wood, rock, deep, open };
    for (const k in terrainSets) { terrainSets[k].visible = false; scene.add(terrainSets[k]); }
  }

  // ---- small tinted lure ----
  // a distinct, recognisable 3D model for every lure type. Nose points -x
  // (where the line ties); the tail/blades trail +x.
  function buildLure() {
    const g = new THREE.Group();
    const M = {
      hook: new THREE.MeshStandardMaterial({ color: 0xbcc0c4, roughness: 0.3, metalness: 0.85 }),
      blade: new THREE.MeshStandardMaterial({ color: 0xe9e2c4, roughness: 0.18, metalness: 0.95 }),
      clear: new THREE.MeshPhysicalMaterial({ color: 0xcfe6f0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      eyeW: new THREE.MeshStandardMaterial({ color: 0xf3efde, roughness: 0.3 }),
      eyeB: new THREE.MeshBasicMaterial({ color: 0x141414 }),
    };
    const tintBody = hex => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.34, metalness: 0.25, envMapIntensity: 1.1 });
    const softBody = hex => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72, metalness: 0 });
    const eyes = (parent, x, z, y, r) => {
      for (const s of [1, -1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), M.eyeW); e.position.set(x, y, s * z); parent.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 6, 6), M.eyeB); p.position.set(x + 0.005, y, s * (z + r * 0.45)); parent.add(p);
      }
    };
    const trebleAt = (parent, x, y, z, s) => {
      const h = new THREE.Group(); h.position.set(x, y, z); h.scale.setScalar(s); h.rotation.z = -0.32;   // trails back a touch
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 6), M.hook); shank.position.y = -0.045; h.add(shank);
      // three splayed J-bends, each curling back up to a point (reads as a treble, not a leg)
      for (let i = 0; i < 3; i++) {
        const prong = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 9, Math.PI * 0.95), M.hook);
        prong.position.y = -0.09; prong.rotation.x = Math.PI / 2; prong.rotation.y = i * 2.094; prong.rotation.z = 0.4; h.add(prong);
      }
      parent.add(h);
    };
    const models = {};

    // CRANKBAIT — fat diving plug with a clear lip at the nose
    { const m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), tintBody(0xff7a2a)); b.scale.set(1.5, 0.96, 0.9); m.add(b); m.body = b;
      const lip = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), M.clear); lip.position.set(-0.25, -0.07, 0); lip.rotation.y = Math.PI / 2; lip.rotation.x = -0.7; m.add(lip);
      eyes(m, -0.17, 0.07, 0.06, 0.03); trebleAt(m, 0.0, -0.13, 0, 0.95); trebleAt(m, 0.22, -0.1, 0, 0.85);
      models.crank = m;
    }
    // SPOON — concave metal blade that flashes; treble at the tail
    { const m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), new THREE.MeshStandardMaterial({ color: 0xd9c37a, roughness: 0.16, metalness: 0.96, envMapIntensity: 1.3 }));
      b.scale.set(1.7, 0.28, 0.7); m.add(b); m.body = b;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 10), M.hook); ring.position.x = -0.22; ring.rotation.y = Math.PI / 2; m.add(ring);
      trebleAt(m, 0.2, 0, 0, 0.9); models.spoon = m;
    }
    // PLASTIC WORM — curved soft body with a curl tail, on a worm hook
    { const m = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.24, 0.02, 0), new THREE.Vector3(-0.07, -0.02, 0.02),
        new THREE.Vector3(0.1, 0.0, -0.03), new THREE.Vector3(0.24, 0.03, 0.03), new THREE.Vector3(0.31, 0.0, -0.04)]);
      const bMat = softBody(0x3f8f3a);
      const b = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, 0.034, 8), bMat); m.add(b); m.body = b;
      const tcurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.31, 0.0, -0.04), new THREE.Vector3(0.37, 0.05, 0.0),
        new THREE.Vector3(0.35, 0.11, 0.05), new THREE.Vector3(0.28, 0.12, 0.02)]);
      m.add(new THREE.Mesh(new THREE.TubeGeometry(tcurve, 22, 0.022, 6), bMat));
      trebleAt(m, -0.06, -0.05, 0, 0.8); models.worm = m;
    }
    // FURRY SINKER — hair jig: painted head + flowing skirt
    { const m = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), tintBody(0x6a4e2d)); head.position.x = -0.13; head.scale.set(1.2, 1, 1); m.add(head); m.body = head;
      eyes(m, -0.16, 0.04, 0.02, 0.018);
      const skirt = new THREE.Group(); skirt.position.set(-0.09, 0, 0);
      const sMat = head.material;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * 6.28, str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0015, 0.34, 4), sMat);
        str.rotation.z = Math.PI / 2; str.position.set(0.17, Math.cos(a) * 0.045, Math.sin(a) * 0.045); skirt.add(str);
      }
      m.add(skirt); m.skirt = skirt; trebleAt(m, 0.04, -0.03, 0, 0.8); models.furry = m;
    }
    // TORPEDO — slim prop topwater
    { const m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.052, 0.34, 14), tintBody(0xdcdcdc)); b.rotation.z = Math.PI / 2; m.add(b); m.body = b;
      eyes(m, -0.13, 0.05, 0.03, 0.022);
      const prop = new THREE.Group(); prop.position.x = 0.2;
      for (let i = 0; i < 2; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.1, 0.03), M.blade); bl.rotation.x = i * Math.PI / 2; prop.add(bl); }
      m.add(prop); m.spin = prop; trebleAt(m, 0.06, -0.07, 0, 0.8); trebleAt(m, -0.08, -0.07, 0, 0.8); models.torpedo = m;
    }
    // PENCIL — tapered walk-the-dog plug
    { const m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.072, 0.42, 14), tintBody(0xe2e2e2)); b.rotation.z = -Math.PI / 2; m.add(b); m.body = b;
      eyes(m, -0.15, 0.05, 0.04, 0.022); trebleAt(m, 0.09, -0.05, 0, 0.8); trebleAt(m, -0.06, -0.06, 0, 0.8); models.pencil = m;
    }
    // JITTERBUG — fat body with the signature double-cup metal lip
    { const m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), tintBody(0x222222)); b.scale.set(1.3, 0.96, 0.96); m.add(b); m.body = b;
      const lip = new THREE.Group(); lip.position.set(-0.18, -0.02, 0);
      for (const s of [1, -1]) { const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10, 0, Math.PI), M.blade); cup.scale.set(0.55, 0.95, 1); cup.position.z = s * 0.065; cup.rotation.y = -Math.PI / 2 + s * 0.5; lip.add(cup); }
      m.add(lip); eyes(m, 0.05, 0.08, 0.08, 0.028); trebleAt(m, -0.04, -0.13, 0, 0.9); trebleAt(m, 0.17, -0.1, 0, 0.9); models.jitterbug = m;
    }
    // FROG — rounded weedless body with trailing legs
    { const m = new THREE.Group();
      const bMat = softBody(0x4f8f3a);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), bMat); b.scale.set(1.3, 0.78, 1.0); m.add(b); m.body = b;
      const legs = new THREE.Group();
      for (const s of [1, -1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.007, 0.24, 6), bMat); leg.position.set(0.2, -0.02, s * 0.06); leg.rotation.z = Math.PI / 2; leg.rotation.y = s * 0.45; legs.add(leg); }
      m.add(legs); m.legs = legs; eyes(m, -0.07, 0.055, 0.1, 0.03); models.frog = m;
    }

    for (const k in models) { models[k].visible = false; g.add(models[k]); }
    g.models = models;
    g.setType = id => {
      const m = models[id] || models.worm;
      for (const k in models) models[k].visible = (models[k] === m);
      g.body = m.body; g.active = m;
    };
    g.setType("worm");
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
    biteSlab.visible = biteEdgeTop.visible = biteEdgeBot.visible = biteLabel.visible = showZone;
    if (showZone) {
      const yTop = yOf(Math.max(0, st.band - st.win)), yBot = yOf(Math.min(1, st.band + st.win));
      const cy = (yTop + yBot) / 2, hgt = Math.max(0.2, yTop - yBot);
      biteSlab.position.set(0, cy, 0); biteSlab.scale.y = hgt / 0.1;
      const zc = st.inZone ? 0x5be37a : 0xffd35c, ze = st.inZone ? 0x9dffbb : 0xffe08a;
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      biteSlab.material.color.setHex(zc); biteSlab.material.opacity = (st.inZone ? 0.20 : 0.10) + pulse * 0.04;
      biteEdgeTop.position.y = yTop; biteEdgeBot.position.y = yBot;
      biteEdgeTop.material.color.setHex(ze); biteEdgeBot.material.color.setHex(ze);
      biteEdgeTop.material.opacity = biteEdgeBot.material.opacity = 0.42 + pulse * 0.28;
      // label rides just above the band (kept high enough to clear the HUD)
      biteLabel.position.set(-0.35, Math.max(yTop + 0.34, -0.6), 0.5);
    }

    motes.rotation.y = t * 0.01;
    const dl = st.daylight != null ? st.daylight : 1;
    surf.material.opacity = 0.22 + 0.14 * dl;
    if (uwSun) uwSun.intensity = 0.25 + dl * 1.25;        // dim & moonlit at night
    if (uwHemi) uwHemi.intensity = 0.30 + dl * 0.95;
    // god-rays shimmer and fade out at night
    for (const ray of rays) { ray.material.opacity = (0.025 + 0.05 * dl) * (0.7 + 0.3 * Math.sin(t * 0.8 + ray.userData.phase)); }

    // show the structure that matches this spot; sway the weeds
    const struct = st.structure || "open";
    for (const k in terrainSets) terrainSets[k].visible = (k === struct);
    if (struct === "veg" && terrainSets.veg) {
      for (const blade of terrainSets.veg.children) blade.rotation.z = Math.sin(t * 1.3 + (blade.userData.sway || 0)) * 0.18;
    }

    const showLure = st.mode === "retrieve" || st.mode === "strike";
    lureGroup.visible = showLure;
    lineMesh.visible = showLure || st.mode === "fight";

    if (showLure) {
      // each lure works with its own real action
      const act = 0.45 + (st.lureAction || 0) * 0.55;   // cleaner action = livelier
      let jig = 0, wig = 0, roll = 0, yaw = 0, pitch = 0;
      switch (st.lureId) {
        case "crank": {                                   // tight, fast side-to-side wobble
          const f = 22; yaw = Math.sin(t * f) * 0.5 * act; roll = Math.sin(t * f) * 0.18; jig = Math.sin(t * f) * 0.05; break;
        }
        case "spoon": {                                   // wide flutter — rocks and tumbles
          roll = Math.sin(t * 7) * 0.9; pitch = Math.sin(t * 5.5) * 0.5; jig = Math.sin(t * 5.5) * 0.16; wig = Math.sin(t * 3.5) * 0.12; break;
        }
        case "worm": case "furry": {                      // slow bottom hops (the twitch bob)
          jig = Math.max(0, Math.sin(t * 2.4)) * 0.22 * act; pitch = Math.sin(t * 2.2) * 0.25; wig = Math.sin(t * 1.6) * 0.06; break;
        }
        case "jitterbug": case "torpedo": {               // surface — waddle hard side to side
          yaw = Math.sin(t * 13) * 0.6 * act; roll = Math.sin(t * 13) * 0.3; jig = Math.abs(Math.sin(t * 13)) * 0.07; wig = Math.sin(t * 9) * 0.16; break;
        }
        default: {                                        // pencil / frog — walk-the-dog sweep
          yaw = Math.sin(t * 6) * 0.7 * act; wig = Math.sin(t * 6) * 0.2; jig = Math.abs(Math.sin(t * 6)) * 0.05; break;
        }
      }
      const lx = xOf(st.lureDist) + wig, ly = yOf(st.lureDepth) + jig;
      lureGroup.setType(st.lureId);
      lureGroup.position.set(lx, ly, 0);
      lureGroup.rotation.set(pitch, yaw, roll);
      lureGroup.body.material.color.set(st.lureHex || 0xff5a2a);
      // animate the moving parts of the active lure
      const am = lureGroup.active;
      if (am.spin) am.spin.rotation.x = t * 22;                       // torpedo prop
      if (am.skirt) am.skirt.rotation.z = Math.sin(t * 6) * 0.12;     // jig skirt breathes
      if (am.legs) { am.legs.children.forEach((l, i) => l.rotation.y = (i ? -1 : 1) * (0.45 + Math.sin(t * 7) * 0.25)); }
      // record the lure's path into the fading wobble trail
      if (lureTrail) {
        trailPts.unshift([lx, ly, -0.05]);
        const TN = lureTrail.geometry.attributes.position.count;
        if (trailPts.length > TN) trailPts.length = TN;
        const pa = lureTrail.geometry.attributes.position.array, ca = lureTrail.geometry.attributes.color.array;
        for (let i = 0; i < TN; i++) {
          const pt = trailPts[Math.min(i, trailPts.length - 1)];
          pa[i * 3] = pt[0]; pa[i * 3 + 1] = pt[1]; pa[i * 3 + 2] = pt[2];
          const fade = 1 - i / TN; ca[i * 3] = 0.8 * fade; ca[i * 3 + 1] = 0.95 * fade; ca[i * 3 + 2] = fade;  // cyan-white, fading to tail
        }
        lureTrail.geometry.attributes.position.needsUpdate = true;
        lureTrail.geometry.attributes.color.needsUpdate = true;
        lureTrail.visible = true;
      }
      lineMesh.geometry.setFromPoints([ROD.clone(), new THREE.Vector3(lx, ly, 0)]);
      lineMesh.material.opacity = 0.5; lineMesh.material.color.setHex(0xffffff);

      // coaching: a pulsing ring when the lure is in the zone, else an arrow
      // showing which way to move it (down = let it sink, up = reel up)
      const bandY = yOf(st.band);
      if (st.inZone) {
        zoneRing.visible = true; zoneRing.position.set(lx, ly, 0.4);
        zoneRing.scale.setScalar(1 + 0.18 * Math.sin(t * 6));
        arrowUp.visible = arrowDn.visible = false;
      } else {
        zoneRing.visible = false;
        const tooShallow = ly > bandY;                 // lure above the zone -> sink
        const ar = tooShallow ? arrowDn : arrowUp, other = tooShallow ? arrowUp : arrowDn;
        other.visible = false; ar.visible = true;
        ar.position.set(lx + 0.5, ly + (tooShallow ? -0.1 : 0.1) - 0.15 * Math.sin(t * 5) * (tooShallow ? 1 : -1), 0.4);
      }

      // detailed bass patrol and close on the lure as interest builds. They
      // ALWAYS swim a lazy sweep (so they never freeze) and converge on the
      // lure as interest climbs, instead of pinning at the frame edge.
      const it = st.interest || 0;
      const want = st.mode === "strike" ? 1 : Math.min(3, 1 + Math.round(it * 2));
      const bandY2 = yOf(st.band);
      for (let i = 0; i < pursuers.length; i++) {
        const p = pursuers[i]; const on = i < want;
        p.visible = on; if (!on) continue;
        const lead = i === 0, side = i % 2 === 0 ? 1 : -1;
        const conv = lead ? Math.pow(it, 0.7) : it * 0.5;                  // how committed it is to the lure
        // lazy patrol that keeps the fish moving and on-screen at all times
        const patrolX = side * (1.5 - 0.4 * it) + Math.sin(t * (0.6 + i * 0.25) + i * 2) * 0.55;
        const patrolY = bandY2 + Math.sin(t * 0.8 + i * 1.7) * 0.45;
        let tx = patrolX + (lx - patrolX) * conv;                          // drift in toward the lure
        const ty = patrolY + (ly - patrolY) * conv;
        tx = Math.max(-2.1, Math.min(2.1, tx));
        const tz = -0.6 - i * 0.7 + Math.sin(t * (1.1 + i * 0.3) + i) * 0.45;
        p.position.set(tx, ty, tz);
        // BROADSIDE to the camera (flank showing, head toward the lure) — not
        // tail-on. rotation.y 0 or PI = side view; +/-PI/2 would show head/tail.
        const faceLeft = lx < tx;
        p.rotation.y = (faceLeft ? Math.PI : 0) + Math.sin(t * 1.4 + i) * 0.16;
        p.scale.setScalar(lead ? 0.55 + it * 0.4 : 0.5);
        undulate(p, t * (lead ? 1.4 : 1.05) + i * 2, 0.22, true);          // body always swims
        if (p.tail) p.tail.rotation.y = Math.sin(t * (7 + it * 4) + i) * 0.5;
      }
    } else {
      for (const p of pursuers) p.visible = false;
      zoneRing.visible = arrowUp.visible = arrowDn.visible = false;
      if (lureTrail) lureTrail.visible = false; trailPts.length = 0;
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
    try { catchR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { return false; }
    catchR.setPixelRatio(Math.min(devicePixelRatio || 1, 3));
    if (THREE.ACESFilmicToneMapping !== undefined) { catchR.toneMapping = THREE.ACESFilmicToneMapping; catchR.toneMappingExposure = 1.1; }
    catchScene = new THREE.Scene();
    catchScene.environment = buildEnv(catchR);     // reflections on the trophy's wet skin
    catchCam = new THREE.PerspectiveCamera(42, 1.8, 0.1, 50);
    catchCam.position.set(0, 0, 6.4);
    catchScene.add(new THREE.HemisphereLight(0xffffff, 0x44525e, 1.2));
    const d1 = new THREE.DirectionalLight(0xfff2cf, 1.7); d1.position.set(3, 5, 6); catchScene.add(d1);
    const d2 = new THREE.DirectionalLight(0x9fc0ff, 0.6); d2.position.set(-4, -1, 3); catchScene.add(d2);
    catchReady = true;
    return true;
  }

  function showCatch(art, speciesKey) {
    if (!catchReady && !initCatch(document.getElementById("catch3d"))) return false;
    const cv = catchR.domElement;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 160;
    catchR.setSize(w, h, false); catchCam.aspect = w / h; catchCam.updateProjectionMatrix();
    hideCatch();
    if (catchFish) { catchScene.remove(catchFish); if (catchFish.disposables) catchFish.disposables.forEach(d => d.dispose && d.dispose()); catchFish.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    // prefer a real loaded model for this species; else the procedural bass
    catchFish = realModel(speciesKey) || makeBass(art || {});
    catchFish.scale.setScalar(catchFish.userData.imported ? 1.0 : 2.1);
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
