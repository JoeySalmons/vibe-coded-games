# Voxel World — Phase 1

A Minecraft-like voxel game, built as plain ES modules with zero npm/Node
dependency at runtime — Three.js is vendored locally in `vendor/`, not
pulled from a CDN, so the only thing anyone needs is a browser and this
repo. Matches the "GitHub Pages, singleplayer" plan discussed alongside
this build.

## Running it

**GitHub Pages (recommended):** push this folder to a repo, enable Pages,
done. Real `https://` means native ES module imports between files just
work — no bundler, no build step.

**Locally:** ES modules are blocked under `file://`, so you need *any*
static file server, e.g. from this folder:
```
python3 -m http.server 8000
```
then open `http://localhost:8000`.

## What's in Phase 1

- Single biome (rolling hills + trees), deterministic from a seed
- First-person movement: WASD, sprint, jump, collision (per-axis AABB
  against the voxel grid), an F-key fly toggle for easy exploration/testing
- Left-click break / right-click place, with a 6-slot hotbar
- Chunk meshing: one merged `BufferGeometry` per chunk (never one mesh per
  block), correct face culling across chunk boundaries (not just within a
  chunk), and real per-vertex ambient occlusion with the standard
  triangulation-flip fix for the diagonal-shading artifact
- Fixed render distance (8 chunks by default, `config.js`), main-thread
  chunk streaming budgeted per-frame so loading in doesn't stall a frame

## Deliberately not in this pass (per the phased plan)

- **Persistence / settings menu** — `persistence.js` documents the intended
  IndexedDB sparse-diff format (only store *edits*, never full chunk
  arrays, since terrain regenerates identically from the seed) and the
  export/import safety net, but nothing is wired up yet
- **Day/night, water, textures** — terrain never places water yet (kept
  out on purpose to avoid rendering unstyled water); `Blocks.WATER` and the
  mesher's transparent-geometry path already exist so wiring this up later
  doesn't touch the mesher again
- **Caves/biomes, LOD, survival (inventory/crafting/health/mobs)** — later
  phases; `biomes.js` and `entities.js` document the intended extension
  points so those phases are additive rather than refactors

## Architecture notes for future phases

- `chunk.js` reserves a per-voxel `meta` byte array (currently unused) for
  fluid fill-levels later, matching the source/flowing-block model
  discussed for the fluid system
- `physics.js`'s collision function takes a generic position/size, not
  anything player-specific, so mob AI can reuse it directly
- `world.js`'s `getBlock()` predicts terrain for not-yet-loaded chunks
  using the same deterministic generator that will eventually produce that
  chunk for real — this is what makes cross-chunk face culling correct
  without needing a remesh once the neighbor loads

## A bug worth knowing about, found while building this

While deriving the face/winding table for the mesher, I checked the
original prototype code (the file you'd uploaded earlier in this
conversation) against the right-hand-rule winding a `THREE.FrontSide`
material actually requires — 3 of its 6 face directions were wound
backwards, which would render as missing top/some side faces (you'd see
through the world from above). This project's mesher derives all 6
directions from `T1 × T2 = normal` and verifies against that instead of
hand-typing each direction, specifically to avoid repeating that bug.

I can't render a live browser in this sandbox, so this is correct as far
as static analysis goes — worth a first-load check for anything that looks
visually off, particularly around AO shading and face culling at chunk
seams.
