# Drop-in 3D fish models

Put a glTF binary here to replace the built-in procedural bass with a real
authored model on the catch / trophy screen:

- `largemouth.glb`, `smallmouth.glb`, `spotted.glb`

Then flip the matching entry to `true` in `manifest.json`, e.g.:

```json
{ "largemouth": true, "smallmouth": false, "spotted": false }
```

Requirements / notes:
- glTF 2.0 binary (`.glb`). The model is auto-centered and scaled to fit, so
  any size works. It should face **+X** (head toward +X) to sit correctly.
- Use a model you have the rights to ship. Good sources: CC0 models (e.g.
  Meshy), or CC-BY models (e.g. Sketchfab "DigitalLife3D") — for CC-BY, add the
  required attribution to this file.
- If a file is missing or its manifest flag is `false`, the game silently uses
  the original high-detail procedural bass — nothing breaks.
