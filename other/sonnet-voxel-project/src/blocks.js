// Block registry. Every block type is a small data record rather than a
// bare number-to-color map, so adding a new block later (a new ore, a new
// biome-specific block, a light-emitting block) is "add one entry here,"
// not "go hunt through the mesher/terrain/physics code."
//
// Fields:
//   id        - numeric id stored in the chunk voxel array (Uint8Array, so 0-255)
//   name      - internal name, used for save-file readability and debugging
//   color     - flat vertex color used until textures exist (Phase 3 decision:
//               near chunks get real textures, far LOD tiles stay flat-color,
//               so this field stays useful even after texturing lands)
//   solid     - blocks movement (used by physics.js collision)
//   opaque    - occludes neighboring faces during meshing / hides light
//   liquid    - reserved for the fluid system (Phase 3/4). Not used by the
//               mesher yet, but declared now so liquid-specific behavior
//               (spreading, no face culling against other liquid of a lower
//               level, etc.) has a place to hook into without renaming things.

export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  WATER: 7, // present in the registry now; not yet placed by terrain gen (Phase 3)
};

export const Blocks = {
  [BlockId.AIR]: {
    id: BlockId.AIR, name: "air",
    color: null, solid: false, opaque: false, liquid: false,
  },
  [BlockId.GRASS]: {
    id: BlockId.GRASS, name: "grass",
    color: [0.48, 0.68, 0.33], solid: true, opaque: true, liquid: false,
  },
  [BlockId.DIRT]: {
    id: BlockId.DIRT, name: "dirt",
    color: [0.52, 0.38, 0.24], solid: true, opaque: true, liquid: false,
  },
  [BlockId.STONE]: {
    id: BlockId.STONE, name: "stone",
    color: [0.55, 0.55, 0.56], solid: true, opaque: true, liquid: false,
  },
  [BlockId.SAND]: {
    id: BlockId.SAND, name: "sand",
    color: [0.83, 0.76, 0.55], solid: true, opaque: true, liquid: false,
  },
  [BlockId.WOOD]: {
    id: BlockId.WOOD, name: "wood",
    color: [0.45, 0.32, 0.18], solid: true, opaque: true, liquid: false,
  },
  [BlockId.LEAVES]: {
    id: BlockId.LEAVES, name: "leaves",
    // Rendered opaque for now (see mesher.js comments): a real cutout /
    // alpha-tested leaf texture is a Phase 3 addition once textures exist.
    color: [0.27, 0.5, 0.22], solid: true, opaque: true, liquid: false,
  },
  [BlockId.WATER]: {
    id: BlockId.WATER, name: "water",
    color: [0.16, 0.4, 0.6], solid: false, opaque: false, liquid: true,
  },
};

// Blocks the player can place from the hotbar, in slot order.
export const HOTBAR_BLOCKS = [
  BlockId.GRASS, BlockId.DIRT, BlockId.STONE, BlockId.SAND,
  BlockId.WOOD, BlockId.LEAVES,
];

export function isSolid(id) {
  const b = Blocks[id];
  return b ? b.solid : false;
}

export function isOpaque(id) {
  const b = Blocks[id];
  return b ? b.opaque : false;
}
