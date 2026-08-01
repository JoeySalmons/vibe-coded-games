import { Noise, hashRandom } from "./noise.js";
import { getBiome } from "./biomes.js";
import { BlockId } from "./blocks.js";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "./config.js";

// Generates terrain from a seed. Kept as a class (not module-level state)
// specifically so "generate new world" (Phase 2) is just `new TerrainGenerator(newSeed)`
// rather than a reload.
//
// No caves and no water yet (both Phase 3/4) - terrain is a pure heightmap:
// stone below, dirt/grass on top, occasional trees. Caves get carved as a
// second pass later without changing this height function; water gets a
// sea-level fill later without changing the tree pass. Both are additive.
export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  // Height of the terrain surface at a world column. Single source of truth
  // used by chunk generation AND by World.getBlock's prediction for
  // not-yet-loaded neighbor chunks (see world.js) - so it must stay a pure
  // function of (seed, wx, wz).
  heightAt(wx, wz) {
    const biome = getBiome(wx, wz);
    const n = this.noise.fbm2(
      wx * 0.015, wz * 0.015,
      biome.octaves, biome.persistence, biome.lacunarity
    );
    return Math.floor(biome.baseHeight + n * biome.amplitude);
  }

  // What block occupies a single world coordinate, ignoring decorations
  // (trees). Used for cross-chunk face-culling prediction where we only
  // need a fast "is this solid" answer, not a fully decorated block.
  blockAt(wx, wy, wz) {
    const h = this.heightAt(wx, wz);
    if (wy > h) return BlockId.AIR;
    if (wy === h) return BlockId.GRASS;
    if (wy >= h - 3) return BlockId.DIRT;
    return BlockId.STONE;
  }

  // Does a tree grow at this column? Deterministic - see noise.js comment
  // on why this can't use Math.random().
  hasTree(wx, wz, biome) {
    const r = hashRandom(this.seed, wx, wz);
    return r < biome.treeDensity;
  }

  // Fills a full chunk's voxel array, including decorations (trees). This
  // is the "real" generation path - blockAt() above is the cheap prediction
  // path used across chunk boundaries.
  generateChunkVoxels(cx, cz) {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    const idx = (x, y, z) => y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;

    const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const h = this.heightAt(wx, wz);
        heights[z * CHUNK_SIZE + x] = h;

        const top = Math.min(h, CHUNK_HEIGHT - 1);
        for (let y = 0; y <= top; y++) {
          let id;
          if (y === h) id = BlockId.GRASS;
          else if (y >= h - 3) id = BlockId.DIRT;
          else id = BlockId.STONE;
          blocks[idx(x, y, z)] = id;
        }
      }
    }

    // Trees - trunk + a small clamped canopy, entirely contained within this
    // chunk (no cross-chunk canopy spillover) so tree placement never needs
    // to touch a neighbor chunk's data.
    const biome = getBiome(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
    for (let x = 2; x < CHUNK_SIZE - 2; x++) {
      for (let z = 2; z < CHUNK_SIZE - 2; z++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        if (!this.hasTree(wx, wz, biome)) continue;

        const base = heights[z * CHUNK_SIZE + x] + 1;
        if (base + 6 >= CHUNK_HEIGHT) continue;

        const trunkHeight = 4 + Math.floor(hashRandom(this.seed, wx + 91, wz - 37) * 2);
        for (let y = base; y < base + trunkHeight; y++) {
          blocks[idx(x, y, z)] = BlockId.WOOD;
        }

        const canopyBase = base + trunkHeight - 2;
        const radius = 2;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const lx = x + dx, lz = z + dz;
            if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
            if (dx * dx + dz * dz > radius * radius + 1) continue;
            for (let dy = 0; dy < 3; dy++) {
              const ly = canopyBase + dy;
              if (ly >= CHUNK_HEIGHT) continue;
              const i = idx(lx, ly, lz);
              if (blocks[i] === BlockId.AIR) blocks[i] = BlockId.LEAVES;
            }
          }
        }
      }
    }

    return blocks;
  }
}
