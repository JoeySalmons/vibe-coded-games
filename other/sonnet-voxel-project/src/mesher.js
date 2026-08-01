import * as THREE from "../vendor/three.module.min.js";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "./config.js";
import { Blocks, BlockId, isOpaque } from "./blocks.js";

// --- Face direction table -----------------------------------------------
// Each face has a normal axis + sign, and two tangent axes (T1, T2) chosen
// so that T1 x T2 == normal exactly. That guarantees correct
// counter-clockwise-from-outside winding for every face using ONE shared
// code path below, instead of six hand-typed vertex lists (which is how
// this kind of mesher usually gets shipped with silently-inverted normals
// on some faces - easy to get 3 right and 3 backwards by hand without
// a check like this).
//
// Axis indices: 0 = x, 1 = y, 2 = z.
const FACES = [
  { normalAxis: 0, sign: 1, t1: 1, t2: 2, normal: [1, 0, 0] },  // +X
  { normalAxis: 0, sign: -1, t1: 2, t2: 1, normal: [-1, 0, 0] }, // -X
  { normalAxis: 1, sign: 1, t1: 2, t2: 0, normal: [0, 1, 0] },  // +Y
  { normalAxis: 1, sign: -1, t1: 0, t2: 2, normal: [0, -1, 0] }, // -Y
  { normalAxis: 2, sign: 1, t1: 0, t2: 1, normal: [0, 0, 1] },  // +Z
  { normalAxis: 2, sign: -1, t1: 1, t2: 0, normal: [0, 0, -1] }, // -Z
];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]]; // (t1,t2) params, CCW order

// Ambient occlusion: 0 (darkest, both edges blocked) .. 3 (fully lit).
// See https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
function vertexAO(side1, side2, corner) {
  if (side1 && side2) return 0;
  return 3 - (side1 + side2 + corner);
}
const AO_BRIGHTNESS = [0.45, 0.65, 0.82, 1.0];

/**
 * Build merged BufferGeometry-backed meshes for one chunk.
 *
 * @param chunk       Chunk instance (local voxel data)
 * @param sampleWorld (wx, wy, wz) => blockId, for coordinates OUTSIDE this
 *                    chunk. Backed by World.getBlock, which returns real
 *                    data for loaded neighbor chunks and a deterministic
 *                    terrain prediction for chunks that haven't generated
 *                    yet - see world.js for why that prediction is safe.
 * @returns { solidGeometry, transparentGeometry } - either may have zero
 *          vertices; caller decides whether to attach a mesh for an empty
 *          geometry (see world.js, which skips it).
 */
export function buildChunkMesh(chunk, sampleWorld) {
  const solid = { pos: [], norm: [], col: [], idx: [] };
  const transparent = { pos: [], norm: [], col: [], idx: [] };

  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  // Fast local lookup with automatic fallback to the world for
  // out-of-chunk coordinates - this is what makes face culling correct
  // across chunk boundaries.
  function getBlock(lx, ly, lz) {
    if (chunk.inBounds(lx, ly, lz)) return chunk.getBlock(lx, ly, lz);
    return sampleWorld(baseX + lx, ly, baseZ + lz);
  }

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        const id = chunk.getBlock(x, y, z);
        if (id === BlockId.AIR) continue;

        const block = Blocks[id];
        const target = block.liquid ? transparent : solid;
        const [r, g, b] = block.color;

        for (const face of FACES) {
          const d = [0, 0, 0];
          d[face.normalAxis] = face.sign;
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          const neighborId = getBlock(nx, ny, nz);

          // Emit the face whenever the neighbor doesn't fully hide it.
          // Two different opaque blocks still cull each other (no face
          // between stone and dirt). Liquids currently just check
          // opacity like everything else; when real water content lands
          // this is the spot to add "don't emit between two liquid
          // blocks of the same fill direction" if it's ever needed.
          if (isOpaque(neighborId)) continue;
          if (neighborId === id && block.liquid) continue; // no internal water faces

          emitFace(target, x, y, z, face, [r, g, b], getBlock);
        }
      }
    }
  }

  return {
    solidGeometry: toGeometry(solid),
    transparentGeometry: toGeometry(transparent),
  };
}

function emitFace(target, x, y, z, face, color, getBlock) {
  const block = [x, y, z];
  const aoValues = [0, 0, 0, 0];
  const positions = [];

  for (let i = 0; i < 4; i++) {
    const [p1, p2] = CORNERS[i];
    const pos = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      if (axis === face.normalAxis) {
        pos[axis] = block[axis] + (face.sign > 0 ? 1 : 0);
      } else if (axis === face.t1) {
        pos[axis] = block[axis] + p1;
      } else if (axis === face.t2) {
        pos[axis] = block[axis] + p2;
      }
    }
    positions.push(pos);

    // AO neighbor sampling (see module header comment for the derivation).
    const nCoord = [0, 0, 0];
    nCoord[face.normalAxis] = block[face.normalAxis] + face.sign;
    nCoord[face.t1] = block[face.t1] + (p1 === 1 ? 1 : -1);
    nCoord[face.t2] = block[face.t2] + (p2 === 1 ? 1 : -1);

    const side1Coord = [...nCoord]; side1Coord[face.t2] = block[face.t2];
    const side2Coord = [...nCoord]; side2Coord[face.t1] = block[face.t1];

    const side1 = isOpaque(getBlock(side1Coord[0], side1Coord[1], side1Coord[2])) ? 1 : 0;
    const side2 = isOpaque(getBlock(side2Coord[0], side2Coord[1], side2Coord[2])) ? 1 : 0;
    const corner = isOpaque(getBlock(nCoord[0], nCoord[1], nCoord[2])) ? 1 : 0;

    aoValues[i] = vertexAO(side1, side2, corner);
  }

  const baseIndex = target.pos.length / 3;
  for (let i = 0; i < 4; i++) {
    target.pos.push(positions[i][0], positions[i][1], positions[i][2]);
    target.norm.push(face.normal[0], face.normal[1], face.normal[2]);
    const brightness = AO_BRIGHTNESS[aoValues[i]];
    target.col.push(color[0] * brightness, color[1] * brightness, color[2] * brightness);
  }

  // Flip the triangulation diagonal when needed to avoid the classic
  // anisotropic-AO artifact (a visibly wrong diagonal shading seam).
  const [ao0, ao1, ao2, ao3] = aoValues;
  if (ao0 + ao2 > ao1 + ao3) {
    target.idx.push(baseIndex, baseIndex + 1, baseIndex + 3, baseIndex + 1, baseIndex + 2, baseIndex + 3);
  } else {
    target.idx.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  }
}

function toGeometry(buf) {
  const geo = new THREE.BufferGeometry();
  if (buf.pos.length === 0) return geo;
  geo.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(buf.norm, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(buf.col, 3));
  geo.setIndex(buf.idx);
  return geo;
}
