/* ============================================================================
   player.js — first-person captain. Pointer-lock look, AABB collision against
   the whole ship, stair ramps, deck platforms, and the interaction ray.
   All player coordinates are SHIP-LOCAL, so you stay planted as she heels.
   ========================================================================== */
(function (TT) {
  "use strict";

  const EYE = 1.58;
  const RADIUS = 0.33;
  const HEIGHT = 1.78;
  const STEP_UP = 0.62;
  const GRAVITY = 22;

  // -------------------------------------------------------- broadphase grid
  const CELL = 8;
  const grid = new Map();
  const key = (ix, iy, iz) => ix + "," + iy + "," + iz;

  TT.buildCollisionGrid = function () {
    grid.clear();
    const S = TT.collision.solids;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const x0 = Math.floor(s.x0 / CELL), x1 = Math.floor(s.x1 / CELL);
      const y0 = Math.floor(s.y0 / CELL), y1 = Math.floor(s.y1 / CELL);
      const z0 = Math.floor(s.z0 / CELL), z1 = Math.floor(s.z1 / CELL);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const k = key(x, y, z);
            let a = grid.get(k);
            if (!a) { a = []; grid.set(k, a); }
            a.push(i);
          }
    }
    return grid.size;
  };

  const _near = [];
  function nearbySolids(x, y, z) {
    _near.length = 0;
    const ix = Math.floor(x / CELL), iy = Math.floor(y / CELL), iz = Math.floor(z / CELL);
    const seen = nearbySolids._seen || (nearbySolids._seen = new Set());
    seen.clear();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const a = grid.get(key(ix + dx, iy + dy, iz + dz));
          if (!a) continue;
          for (let i = 0; i < a.length; i++)
            if (!seen.has(a[i])) { seen.add(a[i]); _near.push(TT.collision.solids[a[i]]); }
        }
    return _near;
  }

  // ------------------------------------------------------------- platforms
  // Coarse walkable surfaces. floorAt picks the highest one you can stand on.
  TT.platforms = [];
  TT.addPlatform = function (x0, x1, y, inset, z0, z1) {
    TT.platforms.push({ x0, x1, y, inset, z0, z1 });
  };

  TT.registerPlatforms = function () {
    const add = TT.addPlatform;
    add(-52, 48, 27.2, 2.7);          // Boat Deck
    add(-58, 52, 24.4, 1.6);          // A / Promenade
    add(-60, 50, 21.6, 0.7);          // B / Bridge Deck (weather)
    add(78, 133, 22.0, 0.7);          // forecastle
    add(50, 78, 18.8, 0.7);           // forward well deck
    add(-88, -60, 18.8, 0.7);         // aft well deck
    add(-133, -88, 21.6, 0.7);        // poop deck
    add(-110, 100, 18.8, 1.0);        // C
    add(-110, 100, 16.0, 1.0);        // D
    add(-112, 92, 13.2, 1.0);         // E
    add(-112, 92, 10.4, 1.0);         // F
    add(-120, -88, 7.6, 1.0); add(52, 118, 7.6, 1.0);      // G
    add(-120, -88, 4.6, 1.0); add(52, 118, 4.6, 1.0);      // Orlop
    add(-114, 70, 1.6, 1.2);          // Tank Top (incl. firemen's passage)
  };

  function platformFloor(x, z, currentY) {
    let best = -Infinity;
    for (const p of TT.platforms) {
      if (x < p.x0 || x > p.x1) continue;
      if (p.z0 !== undefined) { if (z < p.z0 || z > p.z1) continue; }
      else {
        const hw = TT.halfBeamAt(x, p.y + 1) - p.inset;
        if (Math.abs(z) > hw + 0.6) continue;
      }
      if (p.y > currentY + STEP_UP) continue;
      if (p.y > best) best = p.y;
    }
    return best;
  }

  /** Best stair surface at this spot: the flight whose tread sits closest to
      where the player currently is. Returns {y, diff} or null. */
  function rampFloor(x, z, currentY) {
    let bestY = 0, bestDiff = Infinity, found = false;
    for (const r of TT.collision.ramps) {
      // Generous at the ends of the flight so you can step on and off it, but
      // tight across it — otherwise a stairwell lifts the floor of the room
      // next door.
      const padX = r.axis === "x" ? 0.45 : 0.04;
      const padZ = r.axis === "z" ? 0.45 : 0.04;
      if (x < r.x0 - padX || x > r.x1 + padX || z < r.z0 - padZ || z > r.z1 + padZ) continue;
      let t;
      if (r.axis === "x") t = (x - r.x0) / (r.x1 - r.x0);
      else t = (z - r.z0) / (r.z1 - r.z0);
      if (r.flip) t = 1 - t;
      const y = TT.lerp(r.yLow, r.yHigh, TT.clamp(t, 0, 1));
      const diff = Math.abs(y - currentY);
      if (diff < bestDiff) { bestDiff = diff; bestY = y; found = true; }
    }
    return found ? { y: bestY, diff: bestDiff } : null;
  }

  TT.floorAt = function (x, z, currentY) {
    const r = rampFloor(x, z, currentY);
    const p = platformFloor(x, z, currentY);
    // If a tread is within one step of your feet you are ON the stairs, and the
    // stairs win outright. Taking max() with the deck platform instead would
    // pin you at the upper level and let you stroll straight over the
    // stairwell — the flight would look walkable and do nothing.
    if (r && r.diff <= STEP_UP + 0.15) return r.y;
    return p;
  };

  // =================================================================== player
  TT.Player = function (camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(44, 27.2, 0);      // start on the bridge
    this.vel = new THREE.Vector3();
    this.yaw = -Math.PI / 2;
    this.pitch = 0;
    this.floorY = 27.2;
    this.onGround = true;
    this.mode = "walk";                              // walk | ghost | exterior
    this.locked = false;
    this.keys = Object.create(null);
    this.bob = 0;
    this.orbit = { dist: 320, yaw: 2.3, pitch: 0.36 };
    this.lookTarget = null;
    this._bind();
  };

  TT.Player.prototype._bind = function () {
    const self = this;

    this.dom.addEventListener("click", () => {
      if (self.locked || TT.game.state !== "playing" || TT.ui.modalOpen) return;
      const r = self.dom.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    });
    document.addEventListener("pointerlockchange", () => {
      self.locked = document.pointerLockElement === self.dom;
      TT.bus.emit("lockchange", self.locked);
    });
    document.addEventListener("mousemove", e => {
      if (!self.locked) return;
      const s = 0.0022 * (TT.settings.sensitivity || 1);
      if (self.mode === "exterior") {
        self.orbit.yaw -= e.movementX * s;
        self.orbit.pitch = TT.clamp(self.orbit.pitch + e.movementY * s, -0.35, 1.35);
      } else {
        self.yaw -= e.movementX * s;
        self.pitch = TT.clamp(self.pitch - e.movementY * s, -1.5, 1.5);
      }
    });
    document.addEventListener("wheel", e => {
      if (self.mode === "exterior")
        self.orbit.dist = TT.clamp(self.orbit.dist + e.deltaY * 0.4, 60, 900);
    }, { passive: true });

    document.addEventListener("keydown", e => {
      self.keys[e.code] = true;
      if (e.code === "Space" && self.mode !== "ghost") e.preventDefault();
    });
    document.addEventListener("keyup", e => { self.keys[e.code] = false; });
  };

  TT.Player.prototype.teleport = function (x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.floorY = y;
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    this.mode = "walk";
  };

  // ---------------------------------------------------------------- movement
  const _wish = new THREE.Vector3();

  TT.Player.prototype.update = function (dt) {
    const k = this.keys;

    if (this.mode === "exterior") { this._updateExterior(dt); return; }

    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const run = k.ShiftLeft || k.ShiftRight;
    const speed = (this.mode === "ghost" ? 34 : (run ? 6.4 : 3.3)) * (TT.settings.walkSpeed || 1);

    // Must match the camera basis exactly, or you walk where you are not looking.
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    _wish.set(-sy * fwd + cy * side, 0, -cy * fwd - sy * side);
    if (_wish.lengthSq() > 0) _wish.normalize().multiplyScalar(speed);

    if (this.mode === "ghost") {
      const up = (k.Space ? 1 : 0) - (k.ControlLeft || k.KeyC ? 1 : 0);
      this.pos.x += _wish.x * dt;
      this.pos.z += _wish.z * dt;
      this.pos.y += up * speed * dt;
      this.floorY = this.pos.y;
      this._applyCamera(0);
      return;
    }

    // Horizontal move with per-axis push-out.
    const feet = this.pos.y;
    this._moveAxis(_wish.x * dt, 0, feet);
    this._moveAxis(0, _wish.z * dt, feet);

    // Vertical: find the floor, fall to it.
    const f = TT.floorAt(this.pos.x, this.pos.z, this.pos.y);
    if (f !== -Infinity && f !== null) {
      if (this.pos.y <= f + 0.02 || (this.onGround && this.pos.y - f < STEP_UP + 0.1)) {
        this.pos.y = f;
        this.vel.y = 0;
        this.onGround = true;
      } else {
        this.vel.y -= GRAVITY * dt;
        this.pos.y += this.vel.y * dt;
        if (this.pos.y <= f) { this.pos.y = f; this.vel.y = 0; this.onGround = true; }
        else this.onGround = false;
      }
      this.floorY = f;
      // Remember the last spot we were genuinely standing on, so a gap in the
      // decking can never strand you.
      if (this.onGround) {
        this._safe = this._safe || new THREE.Vector3();
        this._safe.set(this.pos.x, f, this.pos.z);
      }
    } else if (this.insideHull()) {
      // No deck under you, but you are inside the ship: that is a hole in the
      // decking, not a swim. Put the captain back on his feet.
      this.recover();
    } else {
      // Genuinely over the side.
      this.vel.y -= GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      this.onGround = false;
      if (this.pos.y < TT.WATERLINE_Y - 2 + (TT.dmg ? TT.dmg.sinkDepth : 0)) TT.onOverboard();
    }

    // Head bob while walking.
    const moving = _wish.lengthSq() > 0.1 && this.onGround;
    this.bob += dt * (run ? 13 : 8.5) * (moving ? 1 : 0);
    if (!moving) this.bob *= (1 - dt * 6);
    this._applyCamera(Math.sin(this.bob) * (moving ? 0.045 : 0) * (run ? 1.5 : 1));
  };

  /** Is the capsule overlapping any solid at this spot? */
  function overlaps(x, z, feet) {
    const y1 = feet + HEIGHT;
    const solids = nearbySolids(x, feet + 1, z);
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.y1 <= feet + STEP_UP || s.y0 >= y1) continue;
      if (x + RADIUS <= s.x0 || x - RADIUS >= s.x1) continue;
      if (z + RADIUS <= s.z0 || z - RADIUS >= s.z1) continue;
      return true;
    }
    return false;
  }

  /** True when the player is within the hull envelope and below the weather
      decks — i.e. somewhere that ought to have a deck underfoot. */
  TT.Player.prototype.insideHull = function () {
    const p = this.pos;
    if (p.x < TT.SHIP.STERN_X + 2 || p.x > TT.SHIP.BOW_X - 2) return false;
    if (p.y > 27.6) return false;
    return Math.abs(p.z) < TT.halfBeamAt(p.x, Math.max(p.y, 1)) - 0.2;
  };

  /** Restore to the last surface we were standing on, or failing that, to the
      nearest deck level that has floor at these coordinates. */
  TT.Player.prototype.recover = function () {
    this.vel.set(0, 0, 0);
    if (this._safe) {
      this.pos.copy(this._safe);
      this.floorY = this._safe.y;
      this.onGround = true;
      return;
    }
    for (let i = TT.DECKS.length - 1; i >= 0; i--) {
      const y = TT.DECKS[i].y;
      const f = TT.floorAt(this.pos.x, this.pos.z, y);
      if (f !== -Infinity && f !== null) {
        this.pos.y = f; this.floorY = f; this.onGround = true;
        return;
      }
    }
    this.teleport(41, 27.2, 0);
  };

  TT.Player.prototype._moveAxis = function (dx, dz, feet) {
    if (dx === 0 && dz === 0) return;
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    let blocked = overlaps(nx, nz, feet);

    // If you are already inside something — spawned into a table, or the deck
    // heeled a bulkhead into you — never trap you. Let any move through until
    // you are clear again.
    if (blocked && overlaps(this.pos.x, this.pos.z, feet)) blocked = false;

    if (!blocked && TT.watertightDoors) {
      for (const d of TT.watertightDoors) {
        if (!d.closed) continue;
        if (Math.abs(nx - d.x) > 0.5) continue;
        if (nz < Math.min(d.z0, d.z1) - RADIUS || nz > Math.max(d.z0, d.z1) + RADIUS) continue;
        if (feet < d.y - 0.5 || feet > d.y + d.height) continue;
        blocked = true;
        break;
      }
    }
    if (!blocked) { this.pos.x = nx; this.pos.z = nz; }
  };

  TT.Player.prototype._applyCamera = function (bob) {
    this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  };

  TT.Player.prototype._updateExterior = function (dt) {
    const o = this.orbit;
    const k = this.keys;
    if (k.KeyW) o.dist = Math.max(60, o.dist - dt * 120);
    if (k.KeyS) o.dist = Math.min(900, o.dist + dt * 120);
    if (k.KeyA) o.yaw += dt * 0.6;
    if (k.KeyD) o.yaw -= dt * 0.6;
    const cx = Math.cos(o.pitch) * Math.cos(o.yaw) * o.dist;
    const cz = Math.cos(o.pitch) * Math.sin(o.yaw) * o.dist;
    const cy = Math.sin(o.pitch) * o.dist + 24;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 18, 0);
  };

  // ------------------------------------------------------------ interaction
  const _fwdV = new THREE.Vector3();
  const _toIt = new THREE.Vector3();

  TT.Player.prototype.pickInteractable = function () {
    if (this.mode === "exterior") return null;
    const cp = Math.cos(this.pitch);
    _fwdV.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    let best = null, bestScore = 0;
    const eye = this.pos.y + EYE;
    for (const it of TT.interactables) {
      if (!it.enabled) continue;
      _toIt.set(it.pos.x - this.pos.x, it.pos.y - eye, it.pos.z - this.pos.z);
      const d = _toIt.length();
      if (d > it.radius) continue;
      _toIt.divideScalar(d || 1);
      const dot = _toIt.dot(_fwdV);
      if (dot < 0.45) continue;
      const score = dot / (0.4 + d * 0.12);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  };

  TT.Player.prototype.eyeY = function () { return this.pos.y + EYE; };
  TT.Player.EYE = EYE;

})(window.TT);
