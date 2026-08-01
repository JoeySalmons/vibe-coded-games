export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pointerLocked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftClick = false;
    this.rightClick = false;
    this.wheelDelta = 0;

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    this.dom.addEventListener("click", () => {
      if (!this.pointerLocked) this.dom.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    this.dom.addEventListener("mousedown", (e) => {
      if (!this.pointerLocked) return;
      if (e.button === 0) this.leftClick = true;
      if (e.button === 2) this.rightClick = true;
    });
    this.dom.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("wheel", (e) => {
      if (!this.pointerLocked) return;
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });
  }

  isDown(code) { return this.keys.has(code); }

  // Call once per frame after reading the per-frame fields above.
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftClick = false;
    this.rightClick = false;
    this.wheelDelta = 0;
  }
}
