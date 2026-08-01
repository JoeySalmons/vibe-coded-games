// Amanatides & Woo voxel traversal (the standard "3D DDA" algorithm for
// walking a ray through a voxel grid one cell at a time). Returns both the
// hit cell and the face that was struck, so callers can place a new block
// against the correct side.

export function raycastVoxel(origin, dir, maxDistance, isBlocking) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);

  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);

  const tDelta = (d) => (d === 0 ? Infinity : Math.abs(1 / d));
  const tDeltaX = tDelta(dir.x), tDeltaY = tDelta(dir.y), tDeltaZ = tDelta(dir.z);

  const firstBoundary = (o, step) => step > 0 ? Math.ceil(o) - o : o - Math.floor(o);
  let tMaxX = dir.x === 0 ? Infinity : firstBoundary(origin.x, stepX) / Math.abs(dir.x);
  let tMaxY = dir.y === 0 ? Infinity : firstBoundary(origin.y, stepY) / Math.abs(dir.y);
  let tMaxZ = dir.z === 0 ? Infinity : firstBoundary(origin.z, stepZ) / Math.abs(dir.z);
  // firstBoundary can be exactly 0 when standing on a cell edge; nudge so
  // we don't get stuck re-testing the same boundary.
  if (tMaxX === 0) tMaxX = tDeltaX;
  if (tMaxY === 0) tMaxY = tDeltaY;
  if (tMaxZ === 0) tMaxZ = tDeltaZ;

  let face = null;
  let t = 0;

  while (t <= maxDistance) {
    if (isBlocking(x, y, z)) {
      return { hit: true, x, y, z, face, distance: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; face = stepX > 0 ? "-x" : "+x";
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; face = stepY > 0 ? "-y" : "+y";
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = stepZ > 0 ? "-z" : "+z";
    }
  }

  return { hit: false };
}

// The face string tells you which side of the hit cell was struck; this
// gives the offset to place a new block adjacent to that face.
export const FACE_OFFSET = {
  "+x": [1, 0, 0], "-x": [-1, 0, 0],
  "+y": [0, 1, 0], "-y": [0, -1, 0],
  "+z": [0, 0, 1], "-z": [0, 0, -1],
};
