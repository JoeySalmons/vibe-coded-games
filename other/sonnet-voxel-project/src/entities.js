// Not wired up yet - this is Phase 6 (hostile mobs, and any future
// passive/neutral ones). Documented now because two Phase 1 decisions were
// made specifically to make this easy later:
//
//   - physics.js's resolveAABBMovement() takes a plain {x,y,z} position and
//     {width,height} box, not anything player-specific, so a mob controller
//     can reuse it directly instead of duplicating collision code.
//   - World.isSolidAt() is the same query the player controller uses, so
//     mob AI/physics can call it without needing new world-access code.
//
// Planned shape for a basic entity (simple state-machine AI first, not
// pathfinding):
//
//   {
//     id, type,              // e.g. "zombie"
//     position, velocity,    // same shape physics.js already expects
//     size: { width, height },
//     health, maxHealth,
//     state,                 // "idle" | "chase" | "attack", etc.
//     target,                // entity id or null
//   }
//
// A simple update loop: each tick, run a small per-state behavior function
// (idle: wander occasionally; chase: move toward target using the same
// resolveAABBMovement; attack: deal damage in range) - no A* or navmesh
// needed for a first pass, since the goal is "hostile mobs exist and are a
// threat," not full pathfinding around obstacles.
