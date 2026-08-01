import { Blocks, HOTBAR_BLOCKS } from "./blocks.js";

// Deliberately plain DOM, not a framework. The HUD is a handful of
// elements updated by direct property writes in the game loop - there's no
// component tree, no reactive state graph, nothing a framework would
// meaningfully help with here, and keeping it framework-free means the
// entire game has zero build step.
export class UI {
  constructor(root) {
    this.root = root;
    this._buildCrosshair();
    this._buildDebugPanel();
    this._buildHotbar();
    this._buildStartOverlay();
    this.selectedSlot = 0;
  }

  _buildCrosshair() {
    const el = document.createElement("div");
    el.className = "crosshair";
    this.root.appendChild(el);
  }

  _buildDebugPanel() {
    const el = document.createElement("div");
    el.className = "debug-panel";
    this.root.appendChild(el);
    this.debugEl = el;
  }

  _buildHotbar() {
    const bar = document.createElement("div");
    bar.className = "hotbar";
    this.slotEls = HOTBAR_BLOCKS.map((blockId, i) => {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot";
      const swatch = document.createElement("div");
      swatch.className = "hotbar-swatch";
      const [r, g, b] = Blocks[blockId].color;
      swatch.style.background = `rgb(${r * 255 | 0}, ${g * 255 | 0}, ${b * 255 | 0})`;
      slot.appendChild(swatch);
      const label = document.createElement("span");
      label.className = "hotbar-key";
      label.textContent = String(i + 1);
      slot.appendChild(label);
      bar.appendChild(slot);
      return slot;
    });
    this.root.appendChild(bar);
    this.setSelectedSlot(0);
  }

  _buildStartOverlay() {
    const el = document.createElement("div");
    el.className = "start-overlay";
    el.innerHTML = `
      <div class="start-box">
        <h1>Voxel World</h1>
        <p>Click to play</p>
        <p class="controls">
          WASD move &middot; Space jump &middot; Shift sprint &middot; F fly &middot;
          Left click break &middot; Right click place &middot; 1-6 / scroll hotbar
        </p>
      </div>`;
    this.root.appendChild(el);
    this.startOverlay = el;
  }

  hideStartOverlay() {
    this.startOverlay.style.display = "none";
  }
  showStartOverlay() {
    this.startOverlay.style.display = "flex";
  }

  setSelectedSlot(i) {
    this.selectedSlot = i;
    this.slotEls.forEach((el, idx) => el.classList.toggle("selected", idx === i));
  }

  updateDebug({ fps, position, chunkCount, timeOfDay, renderDistance }) {
    this.debugEl.textContent =
      `FPS: ${fps.toFixed(0)}\n` +
      `XYZ: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}\n` +
      `Chunks loaded: ${chunkCount}\n` +
      `Time: ${(timeOfDay * 24).toFixed(1)}h\n` +
      `Render distance: ${renderDistance}`;
  }
}
