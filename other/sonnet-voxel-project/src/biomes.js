// Biome definitions. Phase 1 ships exactly one biome, but terrain.js already
// asks "which biome is at (wx, wz)?" for every column rather than assuming
// a single global height function. Adding real biomes later (Phase 4) means
// adding entries here and giving getBiome() a real selection (e.g. a
// low-frequency temperature/moisture noise field) plus a blend step at
// boundaries - it does not mean touching terrain.js's generation loop.

export const Biomes = {
  plains: {
    name: "plains",
    baseHeight: 44,
    amplitude: 14,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    treeDensity: 0.015,
  },
};

// Single-biome stand-in. Signature already takes world coordinates so the
// future version (noise-based biome selection + blending between neighbors)
// is a drop-in replacement with no callers needing to change.
export function getBiome(_wx, _wz) {
  return Biomes.plains;
}
