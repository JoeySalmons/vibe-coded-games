import * as THREE from "../vendor/three.module.min.js";
import { CHUNK_SIZE, DEFAULT_RENDER_DISTANCE, DEFAULT_SEED } from "./config.js";
import { World } from "./world.js";
import { PlayerController } from "./player.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { raycastVoxel, FACE_OFFSET } from "./raycast.js";
import { BlockId, HOTBAR_BLOCKS, isSolid } from "./blocks.js";

const MOUSE_SENSITIVITY = 0.0022;
const REACH = 6;

// --- Renderer / scene / camera -------------------------------------------
const canvasHost = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = 0x8fc7ff;
scene.background = new THREE.Color(skyColor);
// Static for now - Phase 3 animates fog/sky color with time of day instead
// of replacing this, so nothing here needs to change shape later.
scene.fog = new THREE.FogExp2(skyColor, 0.008);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1,
  DEFAULT_RENDER_DISTANCE * CHUNK_SIZE * 1.6 + 40
);
camera.rotation.order = "YXZ";

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(60, 100, 40);
scene.add(sun);

// --- World / player --------------------------------------------------
const world = new World(scene, DEFAULT_SEED, DEFAULT_RENDER_DISTANCE);
const spawnY = world.surfaceHeightAt(0, 0) + 2;
const player = new PlayerController({ x: 0.5, y: spawnY, z: 0.5 });

const input = new Input(renderer.domElement);
const ui = new UI(document.getElementById("hud"));
let selectedHotbarSlot = 0;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement) ui.hideStartOverlay();
  else ui.showStartOverlay();
});

function isSolidAt(x, y, z) {
  return isSolid(world.getBlock(x, y, z));
}

function handleHotbarInput() {
  for (let i = 0; i < HOTBAR_BLOCKS.length; i++) {
    if (input.isDown(`Digit${i + 1}`)) selectedHotbarSlot = i;
  }
  if (input.wheelDelta !== 0) {
    selectedHotbarSlot = (selectedHotbarSlot + input.wheelDelta + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
  }
  ui.setSelectedSlot(selectedHotbarSlot);
}

function aabbOverlapsBlock(pos, size, bx, by, bz) {
  const half = size.width / 2;
  return pos.x + half > bx && pos.x - half < bx + 1 &&
         pos.z + half > bz && pos.z - half < bz + 1 &&
         pos.y + size.height > by && pos.y < by + 1;
}

const _lookDir = new THREE.Vector3();

// Reads the look direction straight from the camera's own world matrix
// (via THREE's getWorldDirection) rather than hand-deriving it from
// yaw/pitch with trig - that avoids any risk of the derivation quietly
// disagreeing with Three.js's actual Euler-order convention. Requires the
// camera transform to already be up to date for this frame (see call order
// in frame() below).
function handleBlockInteraction() {
  const eye = player.eyePosition;
  camera.getWorldDirection(_lookDir);

  const hit = raycastVoxel(eye, _lookDir, REACH, (x, y, z) => isSolid(world.getBlock(x, y, z)));
  if (!hit.hit) return;

  if (input.leftClick) {
    world.setBlock(hit.x, hit.y, hit.z, BlockId.AIR);
  } else if (input.rightClick) {
    const [ox, oy, oz] = FACE_OFFSET[hit.face];
    const px = hit.x + ox, py = hit.y + oy, pz = hit.z + oz;
    if (!aabbOverlapsBlock(player.position, player.size, px, py, pz)) {
      world.setBlock(px, py, pz, HOTBAR_BLOCKS[selectedHotbarSlot]);
    }
  }
}

// --- Main loop ---------------------------------------------------------
let lastTime = performance.now();
let fpsSmoothed = 60;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  fpsSmoothed += (1 / dt - fpsSmoothed) * 0.05;

  if (input.pointerLocked) {
    player.yaw -= input.mouseDX * MOUSE_SENSITIVITY;
    player.pitch -= input.mouseDY * MOUSE_SENSITIVITY;
    const limit = Math.PI / 2 - 0.01;
    player.pitch = Math.max(-limit, Math.min(limit, player.pitch));

    if (input.isDown("KeyF") && !input._flyLatch) { player.toggleFly(); input._flyLatch = true; }
    if (!input.isDown("KeyF")) input._flyLatch = false;

    const wish = {
      forward: input.isDown("KeyW"), back: input.isDown("KeyS"),
      left: input.isDown("KeyA"), right: input.isDown("KeyD"),
      up: input.isDown("Space"), down: input.isDown("ShiftLeft") && player.flying,
      sprint: input.isDown("ShiftLeft") && !player.flying,
    };
    if (input.isDown("Space") && !player.flying) player.jump();
    player.update(dt, wish, isSolidAt);

    handleHotbarInput();
  }

  world.update(player.position.x, player.position.z);

  const eye = player.eyePosition;
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");

  if (input.pointerLocked) handleBlockInteraction();

  renderer.render(scene, camera);

  ui.updateDebug({
    fps: fpsSmoothed,
    position: player.position,
    chunkCount: world.loadedChunkCount,
    timeOfDay: 0.5, // static placeholder until Phase 3's day/night cycle
    renderDistance: world.renderDistance,
  });

  input.endFrame();
}

requestAnimationFrame(frame);
