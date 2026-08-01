// Discrete per-axis AABB collision against the voxel grid. Not continuous
// (swept) collision - at human/mob movement speeds against 1-block-thick
// geometry, resolving one axis at a time (move X, clamp; move Y, clamp;
// move Z, clamp) is what most voxel engines actually use and is
// meaningfully simpler than true swept collision, which mostly matters for
// fast projectiles tunneling through thin geometry - not a concern here.
//
// Written as a free function taking a plain {x,y,z} position and
// {width,height} box rather than as a method on PlayerController, so
// future mobs (Phase 6) can call the exact same collision code instead of
// duplicating or reimplementing it.

export function resolveAABBMovement(position, size, delta, isSolidAt) {
  const { width, height } = size;
  const half = width / 2;

  moveAxis(position, delta, "x", half, height, isSolidAt);
  moveAxis(position, delta, "z", half, height, isSolidAt);
  const onGround = moveAxisY(position, delta, half, height, isSolidAt);
  return { onGround };
}

function aabbBlocked(px, py, pz, half, height, isSolidAt) {
  const minX = Math.floor(px - half), maxX = Math.floor(px + half);
  const minY = Math.floor(py), maxY = Math.floor(py + height - 0.001);
  const minZ = Math.floor(pz - half), maxZ = Math.floor(pz + half);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (isSolidAt(x, y, z)) return true;
      }
    }
  }
  return false;
}

function moveAxis(position, delta, axis, half, height, isSolidAt) {
  const d = delta[axis];
  if (d === 0) return;
  const next = { ...position, [axis]: position[axis] + d };
  if (!aabbBlocked(next.x, next.y, next.z, half, height, isSolidAt)) {
    position[axis] = next[axis];
  }
  // Blocked: leave position unchanged on this axis (velocity zeroing is
  // the caller's responsibility, since only Y-collision implies "grounded").
}

function moveAxisY(position, delta, half, height, isSolidAt) {
  const d = delta.y;
  const next = { ...position, y: position.y + d };
  if (!aabbBlocked(next.x, next.y, next.z, half, height, isSolidAt)) {
    position.y = next.y;
    return false;
  }
  if (d < 0) {
    // Landed - snap to the top of the block below.
    position.y = Math.floor(position.y);
  }
  return d <= 0; // grounded only if we were moving down (or resting) into a blocker
}
