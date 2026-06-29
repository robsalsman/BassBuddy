// =============================================================================
// BassBuddy — real-time 3D underwater renderer (Three.js, MIT).
// Driven by the 2D game's state each frame. Layered over the 2D canvas and
// shown only in the underwater view; if WebGL is unavailable the game falls
// back to the original 2D scene automatically (Scene3D just never goes ready).
// All geometry is original/procedural — no third-party art assets.
// =============================================================================
import * as THREE from "./vendor/three.module.min.js";

const Scene3D = (() => {
  let renderer, scene, camera, canvas, ready = false, visible = false;
  let surf, bottom, motes, biteSlab, biteEdgeTop, biteEdgeBot;
  let lureGroup, lineMesh, fightFish, fightArtKey = "";
  let pursuers = [], rays = [];
  const clock = { t: 0 };

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

    // pursuer shadow-bass pool
    for (let i = 0; i < 3; i++) { const p = buildShadowFish(); p.visible = false; scene.add(p); pursuers.push(p); }

    addEventListener("resize", resize);
    ready = true;
    return true;
  }

  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight, false);
    canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
    if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
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

  // ---- full procedural bass (used for the hooked fish in the fight) ----
  function buildFish(art) {
    const LEN = 2.4, SEG = 64, RING = 20;
    const body = new THREE.Color(art.body || 0x6f9e4e);
    const back = body.clone().multiplyScalar(0.5);
    const belly = new THREE.Color(art.belly || 0xeef1d6);
    const mid = body.clone();
    const pat = new THREE.Color(art.patColor || 0x2a3618);
    const mouthC = new THREE.Color(0x20140e);
    const group = new THREE.Group();

    const depth = t => {
      const b = Math.sin(Math.pow(Math.min(t, 1), 1.2) * Math.PI);
      let d = 0.05 + b * 0.50;
      if (t > 0.84) d = Math.max(d, 0.34) * (1 - (t - 0.84) / 0.16 * 0.62);
      if (t < 0.10) d *= t / 0.10;
      return d;
    };
    const widthFac = t => 0.34 + Math.sin(Math.min(t, 1) * Math.PI) * 0.12;

    const positions = [], colors = [], indices = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG, x = (t - 0.5) * LEN, d = depth(t), w = widthFac(t);
      for (let j = 0; j <= RING; j++) {
        const a = j / RING * Math.PI * 2, y = Math.cos(a) * d, z = Math.sin(a) * d * w;
        positions.push(x, y, z);
        const ty = Math.cos(a) * 0.5 + 0.5;
        let col = ty < 0.5 ? belly.clone().lerp(mid, ty * 2) : mid.clone().lerp(back, (ty - 0.5) * 2);
        if (t > 0.80 && t < 0.97 && ty > 0.30 && ty < 0.52) col.lerp(mouthC, 0.65);
        const flank = Math.abs(z) > d * w * 0.4;
        if (flank && t < 0.82) {
          if (art.pat === "lateral") { if (Math.abs(Math.cos(a)) < 0.30 && Math.sin(t * 24) > 0.35) col.lerp(pat, 0.55); }
          else if (art.pat === "bars") { if (ty > 0.42 && Math.sin(t * 34) > 0.55) col.lerp(pat, 0.5); }
          else if (art.pat === "spots") { if (ty < 0.5 && Math.sin(t * 40) * Math.cos(a * 5) > 0.5) col.lerp(pat, 0.55); }
        }
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RING; j++) {
      const a = i * (RING + 1) + j, b = a + RING + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.14 }));
    group.add(mesh);
    group.geo = geo; group.basePos = Float32Array.from(positions); group.len = LEN;

    const finMat = new THREE.MeshStandardMaterial({ color: back.getHex(), roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0); tailShape.lineTo(-0.75, 0.62); tailShape.lineTo(-0.55, 0); tailShape.lineTo(-0.75, -0.62); tailShape.closePath();
    const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), finMat);
    tail.position.x = -LEN / 2 + 0.02; group.add(tail); group.tail = tail;
    const dorsal = new THREE.Shape();
    dorsal.moveTo(-0.7, 0); dorsal.lineTo(-0.5, 0.34); dorsal.lineTo(-0.05, 0.46); dorsal.lineTo(0.4, 0.30); dorsal.lineTo(0.7, 0); dorsal.closePath();
    const df = new THREE.Mesh(new THREE.ShapeGeometry(dorsal), finMat);
    df.rotation.y = Math.PI / 2; df.position.set(-LEN * 0.02, depth(0.5) * 0.98, 0); group.add(df);
    for (const s of [1, -1]) {
      const pf = new THREE.Mesh(new THREE.ShapeGeometry(dorsal), finMat);
      pf.scale.set(0.42, 0.42, 0.42); pf.rotation.x = s * 0.8; pf.rotation.z = -0.3;
      pf.position.set(LEN * 0.22, -depth(0.7) * 0.2, s * depth(0.7) * widthFac(0.7) * 0.9); group.add(pf);
    }
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xf6f3e8, roughness: 0.3 });
    const eyeB = new THREE.MeshStandardMaterial({ color: art.eye || 0x16242b, roughness: 0.15 });
    const ex = LEN * 0.36, ed = depth(0.86);
    for (const s of [1, -1]) {
      const ew = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 14), eyeW);
      ew.position.set(ex, ed * 0.45, s * ed * widthFac(0.86) * 0.92); group.add(ew);
      const eb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), eyeB);
      eb.position.set(ex + 0.03, ed * 0.45, s * ed * widthFac(0.86) * 1.02); group.add(eb);
    }
    return group;
  }

  function disposeFish(g) {
    if (!g) return; scene.remove(g);
    g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  function undulate(g, t, strength) {
    if (!g.geo || !g.basePos) return;
    const p = g.geo.attributes.position.array, base = g.basePos;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], tailness = Math.min(1, Math.max(0, (-x + 1.0) / 2.0));
      p[i + 2] = base[i + 2] + Math.sin(x * 2.6 - t * 9) * strength * (0.15 + tailness * tailness);
    }
    g.geo.attributes.position.needsUpdate = true; g.geo.computeVertexNormals();
  }

  // ---- per-frame update, driven by the game ----
  function frame(st, dt) {
    if (!ready || !visible) return;
    clock.t += (dt || 16) / 1000;
    const t = clock.t;

    // bite zone
    const yTop = yOf(Math.max(0, st.band - st.win)), yBot = yOf(Math.min(1, st.band + st.win));
    const cy = (yTop + yBot) / 2, hgt = Math.max(0.15, yTop - yBot);
    biteSlab.position.y = cy; biteSlab.scale.y = hgt / 0.1;
    const zc = st.inZone ? 0x5be37a : 0xffd35c, ze = st.inZone ? 0x78f096 : 0xffe08a;
    biteSlab.material.color.setHex(zc); biteSlab.material.opacity = st.inZone ? 0.16 : 0.10;
    biteEdgeTop.position.y = yTop; biteEdgeBot.position.y = yBot;
    biteEdgeTop.material.color.setHex(ze); biteEdgeBot.material.color.setHex(ze);

    motes.rotation.y = t * 0.01;
    surf.material.opacity = 0.22 + 0.14 * (st.daylight != null ? st.daylight : 1);

    const showLure = st.mode === "retrieve" || st.mode === "strike";
    lureGroup.visible = showLure;
    lineMesh.visible = showLure || st.mode === "fight";

    if (showLure) {
      const lx = xOf(st.lureDist), ly = yOf(st.lureDepth) + Math.sin(t * (st.lureStyle === "top" ? 9 : 6)) * 0.12;
      lureGroup.position.set(lx, ly, 0);
      lureGroup.body.material.color.set(st.lureHex || 0xff5a2a);
      lineMesh.geometry.setFromPoints([ROD.clone(), new THREE.Vector3(lx, ly, 0)]);
      lineMesh.material.opacity = 0.5; lineMesh.material.color.setHex(0xffffff);

      // pursuers close in as interest builds
      const want = st.mode === "strike" ? 0 : Math.min(3, 1 + Math.round((st.interest || 0) * 2));
      for (let i = 0; i < pursuers.length; i++) {
        const p = pursuers[i]; const on = i < want;
        p.visible = on; if (!on) continue;
        const it = st.interest || 0, side = i % 2 === 0 ? 1 : -1;
        const reach = (1 - it) * (3.0 + i * 1.1) + 0.8;
        const tx = lx + side * reach, ty = yOf(st.band) + Math.sin(t * 0.9 + i) * 0.4;
        p.position.set(tx, ty, -0.4 - i * 0.5);
        const facing = tx > lx ? -1 : 1; p.scale.x = Math.abs(p.scale.x) * facing;
        p.mat.opacity = (i === 0 ? 0.22 + 0.5 * it : 0.16 + 0.25 * it);
        if (p.tail) p.tail.rotation.y = Math.sin(t * 7 + i) * 0.5;
      }
    } else {
      for (const p of pursuers) p.visible = false;
    }

    // the fight — full procedural bass
    if (st.mode === "fight" && st.fight) {
      const f = st.fight, key = JSON.stringify(f.art || {});
      if (!fightFish || key !== fightArtKey) { disposeFish(fightFish); fightFish = buildFish(f.art || {}); scene.add(fightFish); fightArtKey = key; }
      fightFish.visible = true;
      const fx = xOf(f.dist);
      let fy;
      if (f.state === "jump") fy = 2.9 + Math.abs(Math.sin(t * 11)) * 1.8;
      else fy = yOf(0.42 + Math.sin(t * 1.1) * 0.12 + (f.state === "run" ? 0.16 : 0));
      const sc = 0.5 + f.size * 0.9;
      fightFish.scale.setScalar(sc);
      fightFish.position.set(fx, fy, 0);
      const facing = f.state === "run" ? 1 : -1;        // run = away from boat (+x), else toward
      fightFish.rotation.y = facing < 0 ? 0 : Math.PI;
      fightFish.rotation.z = (f.state === "jump") ? -0.5 * facing : Math.sin(t * 2) * 0.08;
      undulate(fightFish, t, 0.16 + f.pull * 0.06);
      if (fightFish.tail) fightFish.tail.rotation.y = Math.sin(t * (8 + f.pull * 4)) * 0.5;
      // taut line bows red under tension
      const tip = ROD.clone();
      lineMesh.geometry.setFromPoints([tip, new THREE.Vector3(fx + facing * sc * 0.9, fy, 0)]);
      lineMesh.material.color.setHex(f.tension > 0.7 ? 0xff6a6a : 0xffffff);
      lineMesh.material.opacity = 0.55;
    } else if (fightFish) {
      fightFish.visible = false;
    }

    renderer.render(scene, camera);
  }

  return { init, setVisible, setVenue, frame, isReady: () => ready };
})();

window.Scene3D = Scene3D;
