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

## Status: pipeline verified ✅
The loader was tested end-to-end with a real GitHub-hosted GLB (Khronos
BarramundiFish): it downloads, normalizes, and renders on the catch/trophy
screen. So a proper `largemouth.glb` will "just work" — the only missing piece
is a good, lightweight largemouth model. (Currently shows on the catch screen
only; the live fight/underwater fish still use the procedural model, which would
need a rigged GLB with mouth/tail animation to swap fully.)

### Easiest way to make one (free):
1. Go to **meshy.ai** (or **tripo3d.ai**) — free tier, no cost to start.
2. Text-to-3D prompt: *"realistic largemouth bass, mouth slightly open, game-ready, side view"* — or upload a bass photo (image-to-3D gives better likeness).
3. Download as **GLB**, rename to `largemouth.glb`, drop it in this folder, set its flag to `true` in `manifest.json`, commit. Done.
