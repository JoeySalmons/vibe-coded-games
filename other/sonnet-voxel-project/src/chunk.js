import { CHUNK_SIZE, CHUNK_HEIGHT } from "./config.js";
import { BlockId } from "./blocks.js";

const SIZE2 = CHUNK_SIZE * CHUNK_SIZE;

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export class Chunk {
  constructor(cx, cz, blocks) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = blocks; // Uint8Array, block id per voxel

    // Reserved, unused in Phase 1: per-voxel metadata byte. Intended future
    // use is fluid fill-level (source/flowing, 0-8, see design discussion)
    // and possibly plant growth stage later. Declared now so the chunk
    // binary layout doesn't change shape when fluids/growth are added -
    // only this array starts getting written to.
    this.meta = new Uint8Array(blocks.length);

    // Whether any block in this chunk differs from what generateChunkVoxels()
    // would produce fresh. Persistence (Phase 2) only needs to store chunks
    // where this is true, and only needs to store the diff, not the array.
    this.dirty = false;

    this.solidMesh = null;      // THREE.Mesh, opaque geometry
    this.transparentMesh = null; // THREE.Mesh, liquid/glass geometry (Phase 3+)
    this.meshDirty = true;      // needs (re)building before next render-ready use
  }

  localIndex(lx, ly, lz) {
    return ly * SIZE2 + lz * CHUNK_SIZE + lx;
  }

  inBounds(lx, ly, lz) {
    return lx >= 0 && lx < CHUNK_SIZE &&
           lz >= 0 && lz < CHUNK_SIZE &&
           ly >= 0 && ly < CHUNK_HEIGHT;
  }

  getBlock(lx, ly, lz) {
    if (!this.inBounds(lx, ly, lz)) return BlockId.AIR;
    return this.blocks[this.localIndex(lx, ly, lz)];
  }

  setBlock(lx, ly, lz, id) {
    if (!this.inBounds(lx, ly, lz)) return false;
    const i = this.localIndex(lx, ly, lz);
    if (this.blocks[i] === id) return false;
    this.blocks[i] = id;
    this.dirty = true;
    this.meshDirty = true;
    return true;
  }

  disposeMeshes() {
    for (const mesh of [this.solidMesh, this.transparentMesh]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      if (mesh.parent) mesh.parent.remove(mesh);
    }
    this.solidMesh = null;
    this.transparentMesh = null;
  }
}
