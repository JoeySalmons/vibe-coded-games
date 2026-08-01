import { resolveAABBMovement } from "./physics.js";

const GRAVITY = -24;
const JUMP_SPEED = 8;
const WALK_SPEED = 4.3;
const SPRINT_MULT = 1.6;
const FLY_SPEED = 10;

export class PlayerController {
  constructor(spawn) {
    this.position = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.size = { width: 0.6, height: 1.8 };
    this.eyeHeight = 1.62;
    this.onGround = false;
    this.flying = false;
    this.yaw = 0;
    this.pitch = 0;
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.y = 0;
  }

  jump() {
    if (this.onGround && !this.flying) {
      this.velocity.y = JUMP_SPEED;
    }
  }

  // input: { forward, back, left, right, up, down, sprint } booleans
  update(dt, input, isSolidAt) {
    const speed = (this.flying ? FLY_SPEED : WALK_SPEED) * (input.sprint ? SPRINT_MULT : 1);

    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    // Camera forward is -Z at yaw 0; standard FPS basis.
    const fx = -sinY, fz = -cosY;
    const rx = cosY, rz = -sinY;

    let mx = 0, mz = 0;
    if (input.forward) { mx += fx; mz += fz; }
    if (input.back) { mx -= fx; mz -= fz; }
    if (input.right) { mx += rx; mz += rz; }
    if (input.left) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const delta = { x: mx * speed * dt, y: 0, z: mz * speed * dt };

    if (this.flying) {
      if (input.up) delta.y += speed * dt;
      if (input.down) delta.y -= speed * dt;
      this.velocity.y = 0;
    } else {
      this.velocity.y += GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -50); // terminal-ish velocity
      delta.y = this.velocity.y * dt;
    }

    const result = resolveAABBMovement(this.position, this.size, delta, isSolidAt);
    this.onGround = result.onGround;
    if (this.onGround && !this.flying && this.velocity.y < 0) this.velocity.y = 0;
  }

  get eyePosition() {
    return { x: this.position.x, y: this.position.y + this.eyeHeight, z: this.position.z };
  }
}
