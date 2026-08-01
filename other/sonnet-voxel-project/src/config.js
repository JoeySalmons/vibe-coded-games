// Central tunables. Keeping these in one place makes the settings-menu work
// (Phase 2) a matter of writing values here at runtime rather than hunting
// through modules.

export const CHUNK_SIZE = 16;      // blocks per chunk, X and Z
export const CHUNK_HEIGHT = 128;   // blocks per chunk, Y (world height)

export const DEFAULT_RENDER_DISTANCE = 8; // chunks, radius around player
export const MAX_CHUNK_LOADS_PER_FRAME = 2; // generation budget on main thread

export const DEFAULT_SEED = 1337;

// Save-format version. Bump this whenever the chunk/edit data shape changes
// so old saves can be detected and discarded/migrated instead of silently
// misread. Not wired to persistence yet (that's Phase 2) but declared here
// now so nothing downstream has to guess at a version scheme later.
export const SAVE_FORMAT_VERSION = 1;
