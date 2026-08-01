// Deterministic noise. Everything here is a pure function of (seed, coords) -
// no Math.random() anywhere. That matters for two concrete reasons in this
// codebase:
//   1. World.getBlock() predicts terrain in not-yet-generated neighbor
//      chunks (see world.js) so meshing can cull faces correctly across
//      chunk boundaries before the neighbor actually exists. That
//      prediction only matches the real chunk once it generates if
//      everything - including decorations like trees - is deterministic.
//   2. "Generate new world" (Phase 2) just means picking a new seed; the
//      same seed must always produce the same world, including on reload.

export class Noise {
  constructor(seed = 1337) {
    const p = new Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed >>> 0 || 1;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + (b - a) * t; }
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x), v = this.fade(y), w = this.fade(z);
    const p = this.perm;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return this.lerp(
      this.lerp(this.lerp(this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z), u),
                this.lerp(this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z), u), v),
      this.lerp(this.lerp(this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1), u),
                this.lerp(this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }

  // 2D convenience (y=0 plane) - most terrain queries only need this.
  noise2(x, z) { return this.noise3(x, 0, z); }

  fbm2(x, z, octaves, persistence, lacunarity) {
    let value = 0, freq = 1, amp = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2(x * freq, z * freq) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return value / maxAmp;
  }
}

// Deterministic per-coordinate pseudo-random in [0, 1). Used for placement
// decisions (e.g. "does a tree grow at this column?") where we need a
// reproducible answer for a given (seed, x, z) without maintaining any
// stateful RNG stream - important because these get queried in arbitrary
// order (chunk generation order isn't guaranteed) and possibly more than
// once (terrain prediction across chunk boundaries).
export function hashRandom(seed, x, z) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
