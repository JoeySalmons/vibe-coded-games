import * as THREE from "../vendor/three.module.min.js";
import { CHUNK_SIZE, CHUNK_HEIGHT, MAX_CHUNK_LOADS_PER_FRAME } from "./config.js";
import { Chunk, chunkKey } from "./chunk.js";
import { TerrainGenerator } from "./terrain.js";
import { buildChunkMesh } from "./mesher.js";
import { BlockId } from "./blocks.js";

const solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
// depthWrite: false avoids needing per-frame back-to-front triangle sorting
// for water - a deliberate simplification for axis-aligned voxel liquid,
// not an oversight. See project notes for why full sorting isn't worth it here.
const transparentMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false,
});

function worldToChunkCoord(w) {
  return Math.floor(w / CHUNK_SIZE);
}

export class World {
  constructor(scene, seed, renderDistance) {
    this.scene = scene;
    this.seed = seed;
    this.renderDistance = renderDistance;
    this.terrain = new TerrainGenerator(seed);
    this.chunks = new Map();
    this.loadQueue = []; // [cx, cz] pending generation, nearest first
    this.loadQueueSet = new Set();
  }

  // Global block lookup. Returns real data for loaded chunks; for
  // not-yet-loaded chunks it falls back to a deterministic terrain
  // prediction (see terrain.js). That prediction is what makes face
  // culling correct at the edge of the loaded area even before the
  // neighbor chunk exists - and because it's deterministic, the neighbor
  // chunk generates identically later, so nothing needs to be re-meshed
  // just because a neighbor finished loading.
  getBlock(wx, wy, wz) {
    if (wy < 0) return BlockId.STONE;
    if (wy >= CHUNK_HEIGHT) return BlockId.AIR;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) {
      const lx = wx - cx * CHUNK_SIZE;
      const lz = wz - cz * CHUNK_SIZE;
      return chunk.getBlock(lx, wy, lz);
    }
    return this.terrain.blockAt(wx, wy, wz);
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  isSolidAt(wx, wy, wz) {
    const id = this.getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return id !== BlockId.AIR && id !== BlockId.WATER;
  }

  // Edits a block and re-meshes whatever chunks need it. Editing a block on
  // a chunk's outer edge changes what the *neighbor* chunk's face culling
  // should look like too (its cached mesh was culling against this block's
  // old value) - so that neighbor gets re-meshed as well, but only if it's
  // actually loaded; nothing to fix in a chunk that doesn't exist yet.
  setBlock(wx, wy, wz, id) {
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;

    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const changed = chunk.setBlock(lx, wy, lz, id);
    if (!changed) return false;

    this._remeshChunk(chunk);

    if (lx === 0) this._remeshNeighborIfLoaded(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this._remeshNeighborIfLoaded(cx + 1, cz);
    if (lz === 0) this._remeshNeighborIfLoaded(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this._remeshNeighborIfLoaded(cx, cz + 1);

    return true;
  }

  _remeshNeighborIfLoaded(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) this._remeshChunk(chunk);
  }

  _remeshChunk(chunk) {
    const sampleWorld = (wx, wy, wz) => this.getBlock(wx, wy, wz);
    const { solidGeometry, transparentGeometry } = buildChunkMesh(chunk, sampleWorld);

    chunk.disposeMeshes();

    if (solidGeometry.attributes.position) {
      chunk.solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
      chunk.solidMesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      this.scene.add(chunk.solidMesh);
    }
    if (transparentGeometry.attributes.position) {
      chunk.transparentMesh = new THREE.Mesh(transparentGeometry, transparentMaterial);
      chunk.transparentMesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      chunk.transparentMesh.renderOrder = 1;
      this.scene.add(chunk.transparentMesh);
    }
    chunk.meshDirty = false;
  }

  // Height of the terrain surface at a world column - used for spawn
  // placement and can be reused by future entity spawning logic.
  surfaceHeightAt(wx, wz) {
    return this.terrain.heightAt(wx, wz);
  }

  // Call once per frame. Queues newly-needed chunks and drains a small,
  // fixed budget of generation work so a big render distance doesn't
  // stall a single frame. This is the main-thread version described for
  // Phase 1 - Phase 5 replaces the generation half of this with Web
  // Worker jobs without needing to change how chunks are stored/meshed.
  update(playerX, playerZ) {
    const pcx = worldToChunkCoord(playerX);
    const pcz = worldToChunkCoord(playerZ);
    const rd = this.renderDistance;

    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const cx = pcx + dx, cz = pcz + dz;
        const key = chunkKey(cx, cz);
        if (this.chunks.has(key) || this.loadQueueSet.has(key)) continue;
        this.loadQueue.push({ cx, cz, distSq: dx * dx + dz * dz });
        this.loadQueueSet.add(key);
      }
    }

    if (this.loadQueue.length > 0) {
      this.loadQueue.sort((a, b) => a.distSq - b.distSq);
      const n = Math.min(MAX_CHUNK_LOADS_PER_FRAME, this.loadQueue.length);
      for (let i = 0; i < n; i++) {
        const { cx, cz } = this.loadQueue.shift();
        this.loadQueueSet.delete(chunkKey(cx, cz));
        this._loadChunk(cx, cz);
      }
    }

    this._unloadFarChunks(pcx, pcz);
  }

  _loadChunk(cx, cz) {
    const blocks = this.terrain.generateChunkVoxels(cx, cz);
    const chunk = new Chunk(cx, cz, blocks);
    this.chunks.set(chunkKey(cx, cz), chunk);
    this._remeshChunk(chunk);
  }

  _unloadFarChunks(pcx, pcz) {
    // Small hysteresis margin so a chunk right at the boundary doesn't
    // load/unload every frame as the player jitters across the edge.
    const limit = this.renderDistance + 2;
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pcx, dz = chunk.cz - pcz;
      if (Math.abs(dx) > limit || Math.abs(dz) > limit) {
        chunk.disposeMeshes();
        this.chunks.delete(key);
      }
    }
  }

  get loadedChunkCount() {
    return this.chunks.size;
  }
}
