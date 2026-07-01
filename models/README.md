# Drop-in 3D fish models

Put a glTF binary here to replace the built-in procedural bass with a real
authored model on the catch / trophy screen:

- `largemouth.glb`, `smallmouth.glb`, `spotted.glb`

Then flip the matching entry to `true` in `manifest.json`, e.g.:

```json
{ "largemouth": true, "smallmouth": false, "spotted": false }
```

Requirements / notes:
- glTF 2.0 binary (`.glb`). The model is auto-centered and scaled to fit (longest
  axis normalized, then recentered), so any size works. Face it **+X** (head
  toward +X) to sit correctly.
- Keep it lightweight: aim for **under ~3 MB** (decimate + 1–2K textures). A
  12 MB hero model works but bloats first load on mobile.
- Use a model you have the rights to ship. Good sources: CC0 models (e.g.
  Meshy / Tripo AI generators), or CC-BY models (e.g. Sketchfab) — for CC-BY,
  add the required attribution here.
- If a file is missing or its manifest flag is `false`, the game silently uses
  the original high-detail procedural bass — nothing breaks.

## Status: shipping a real largemouth ✅
`largemouth.glb` is a **Meshy-generated** largemouth bass, optimized for the
web: decimated 234K → 66K triangles, textures resized 2048² → 1024² and
re-encoded, and the head baked to face **+X** — final size **~2.3 MB** (from
~13 MB). It downloads, normalizes, and renders on **both** the catch/trophy
screen and the live underwater fight, where a GPU vertex-shader swim bend flexes
the body/tail down its length — so a dense mesh swims with no rig and no
per-frame CPU cost. (An animation-clip path via `THREE.AnimationMixer` could be
added later if a GLB ships with a baked swim clip; Meshy's auto-rig currently
exports the skeleton without a clip.)

Attribution: bass model generated with **Meshy AI** (meshy.ai).

### Easiest way to make one (free):
1. Go to **meshy.ai** (or **tripo3d.ai**) — free tier, no cost to start.
2. Text-to-3D prompt: *"realistic largemouth bass, mouth slightly open, game-ready, side view"* — or upload a bass photo (image-to-3D gives better likeness).
3. Download as **GLB**, rename to `largemouth.glb`, drop it in this folder, set its flag to `true` in `manifest.json`, commit. Done.
