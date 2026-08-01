// Not wired up yet - this is Phase 2. Left here now, with the intended
// shape written down, so Phase 1 code (chunk.js's `dirty` flag, world.js's
// deterministic terrain prediction) is already compatible with it instead
// of needing to change once storage is added.
//
// Planned IndexedDB layout:
//
//   database: "voxelworld"
//     store "meta"     - { key: "worldInfo", seed, version, createdAt }
//     store "settings" - small values (render distance, sensitivity, FOV);
//                        actually these belong in localStorage instead,
//                        since they're tiny and synchronous access is
//                        convenient for the settings menu - only world data
//                        needs IndexedDB's async, larger-capacity storage.
//     store "chunks"   - keyed by "cx,cz", value = sparse edit diff:
//                        { blocks: { [localIndex]: blockId, ... } }
//                        NOT a full 32KB voxel array. Unmodified chunks
//                        (chunk.dirty === false) are never written at all -
//                        they regenerate identically from the seed.
//
// On load: generate the chunk from TerrainGenerator as normal, then apply
// the stored diff on top (if any).
//
// Also planned: an explicit "export world" (serialize all dirty chunks +
// meta to a downloadable JSON/binary file) and "import world" pair. This
// isn't a nice-to-have - IndexedDB data isn't guaranteed to survive browser
// storage-pressure eviction for a page that isn't installed/bookmarked, so
// export/import is the real backstop against silent progress loss for a
// GitHub-Pages-hosted, no-backend game.

export const SAVE_DB_NAME = "voxelworld";
export const SAVE_DB_VERSION = 1;
