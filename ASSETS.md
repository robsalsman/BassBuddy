# BassBuddy — Full Graphics Asset Inventory

Every sprite, model, texture and effect in the game, where it lives, and its
quality status after the polish pass. Two rendering layers:
**3D** (render3d.js — procedural Three.js) and **2D/SVG** (game.js — canvas + inline SVG).

Legend: ✅ high quality · ⬆️ upgraded in this pass · 📦 drop-in slot (real
authored asset can replace the procedural stand-in, pipeline ready)

## 3D — Fish
| Asset | Where | Status |
|---|---|---|
| Largemouth bass (catch/trophy) | `models/largemouth.glb` (Meshy, 2.3 MB, 66K tris) | ✅ real authored model |
| Largemouth bass (live fight) | same GLB + GPU vertex-shader swim | ✅ |
| Rigged/animated bass | GLB loader | ⬆️ **AnimationMixer pipeline added** — drop in a GLB with baked clips (`swim`/`idle`) and it plays automatically, skeleton-aware cloning included. 📦 needs a Meshy/Blender export **with an animation clip** (current auto-rig exports bones but no clip) |
| Procedural bass (fallback, pursuers, shoal) | `makeBass()` — painted scale/bump/normal maps, per-species markings | ✅ |
| Smallmouth / spotted models | `models/manifest.json` slots | 📦 empty, loader ready |
| Shadow pursuer bass | `buildShadowFish()` | ✅ (intentionally silhouette) |

## 3D — Lures (13)
| Asset | Status |
|---|---|
| Crankbait, Spoon, Worm, Furry jig, Torpedo, Pencil, Jitterbug, Frog | ✅ modeled (lip, blades, skirts, trebles, eyes) |
| **Spinnerbait** | ⬆️ new model — bent wire frame, twin spinning willow blades, skirt |
| **Buzzbait** | ⬆️ new model — delta prop blade, wire, skirt |
| **Rattle Trap** | ⬆️ new model — flat-sided lipless profile, twin trebles |
| **Inline Spinner** | ⬆️ new model — shaft, spinning oval blade, dressed treble |
| **Carolina Rig** | ⬆️ new model — brass egg weight, red bead, leader, trailing worm |

## 3D — Environment (surface)
| Asset | Status |
|---|---|
| Water (physical material + ripple normal map) | ⬆️ normal map redrawn with wind-streaked anisotropic ripples |
| Sky gradient (per lake/time) | ✅ |
| **Clouds** | ⬆️ new — drifting soft cloud sprites, count/tone driven by weather (puffy in sun, grey layer in cloud, dark in rain) |
| **Stars** | ⬆️ new — night starfield, fades with daylight |
| Sun disc + glow, phase-accurate moon | ✅ |
| Rain streak system, fog haze, overcast dimming | ✅ (prev pass) |
| Shoreline hill ring (season-tinted) | ✅ (prev pass) |
| Per-lake skylines: pines / knolls / peaks / cypress line / cliffs | ✅ (prev pass) |
| **Birds** | ⬆️ new — gulls flapping across the sky on fair days |
| Venue structures: dock+boathouse, stone bridge+gazebo, dam+buoys, cypress stand+duck blind, timber+bluff+marker | ✅ |
| Lily pad cluster at the hot bearing | ✅ |
| Fish shadows under the surface | ✅ |

## 3D — Boat & Angler
| Asset | Status |
|---|---|
| Bass boat (metal-flake hull, deck, rub-rail, console w/ live finder screen, trolling motor w/ spinning prop) | ✅ |
| Angler (legs/vest/cap, articulated arms, reel-crank + fish-lipping poses) | ✅ |
| Rod (11-segment parabolic bend, tapered, real line guides, EVA grip, spinning reel + crank) | ✅ |
| Line (threads the guides to the lure/fish mouth, tension-colored) | ✅ |

## 3D — Environment (underwater)
| Asset | Status |
|---|---|
| Contoured bottom + silt texture, water-tinted by lake | ✅ |
| Terrain sets: weed bed, flooded timber+dock pilings, boulders, drop-off rubble | ✅ |
| Lake-signature cover: cypress roots/knees (bayou), brush pile+timber (highland) | ✅ |
| God rays, drifting motes, bubble trails | ✅ |
| Bite-zone band + coaching ring/arrows | ✅ |

## 2D / SVG (game.js)
| Asset | Status |
|---|---|
| fishSVG / heroSVG (catalog + fallback catch art: gradients, fins, markings) | ✅ |
| drawLure (2D fallback canvas lure sprites, all 13) | ✅ |
| Lake map SVG (Catch Detail: top-down lake + gold pin) | ✅ |
| Sonar/fish-finder widget (blips, bite band, sweep) | ✅ |
| UI iconography | ✅ consistent emoji set (deliberate arcade style) |

## Notes on "real" assets
The drop-in pipeline (`models/*.glb` + `manifest.json`) accepts authored models
for any species, auto-normalizes them (+X facing), and — new this pass — plays
baked animation clips via AnimationMixer with a skeleton-aware clone. To fully
replace the GPU-shader swim with true rigged animation, export a GLB **with an
animation clip** (Meshy “Animate” or Blender: armature → keyframe a tail-swish
loop → export with Animation checked) and drop it in; everything else is wired.
