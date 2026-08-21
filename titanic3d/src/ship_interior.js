/* ============================================================================
   ship_interior.js — walkable decks A through G, the orlop and the tank top.
   Each deck builds into three batched meshes: matte (Lambert), glow (unlit
   fixtures) and glass. Rooms are registered as named regions so the HUD can
   tell you where you are standing.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;
  const WALL_T = 0.18;
  const DOOR_W = 1.1;
  const DOOR_H = 2.05;

  TT.rooms = [];
  TT.interactables = [];

  /** Register something the player can look at and press E on. */
  TT.interact = function (x, y, z, label, prompt, fn, radius) {
    const it = {
      pos: new THREE.Vector3(x, y, z),
      label, prompt, fn,
      radius: radius || 2.6,
      enabled: true
    };
    TT.interactables.push(it);
    return it;
  };

  // ------------------------------------------------------------------ context
  function Ctx(deck) {
    this.deck = deck;
    this.y = deck.y;
    this.h = TT.DECK_CLEAR;
    this.b = new TT.Batch(deck.id);
    this.glow = new TT.Batch(deck.id + "-glow");
    this.glass = new TT.Batch(deck.id + "-glass");
    this.holes = [];
    this.group = new THREE.Group();
    this.group.name = "deck-" + deck.id;
  }

  /** Name a region of the deck; the HUD reports the room you are standing in. */
  Ctx.prototype.room = function (x0, z0, x1, z1, name, kind) {
    TT.rooms.push({
      deck: this.deck.id, deckName: this.deck.name, name, kind: kind || "",
      x0: Math.min(x0, x1), x1: Math.max(x0, x1),
      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
      y: this.y
    });
    return this;
  };

  Ctx.prototype.hole = function (x0, z0, x1, z1, opts) {
    this.holes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1),
                      z0: Math.min(z0, z1), z1: Math.max(z0, z1),
                      well: !!(opts && opts.well) });
    return this;
  };

  /** Rail right around a two-deck-high well so nobody walks into the void. */
  Ctx.prototype.railWell = function (x0, z0, x1, z1, color) {
    const y = this.y, col = color || TT.PAL.steel;
    for (let x = x0; x <= x1; x += 2) {
      this.b.box(x, y + 0.55, z0, 1.8, 1.1, 0.12, col);
      this.b.box(x, y + 0.55, z1, 1.8, 1.1, 0.12, col);
    }
    for (let z = z0; z <= z1; z += 2) {
      this.b.box(x0, y + 0.55, z, 0.12, 1.1, 1.8, col);
      this.b.box(x1, y + 0.55, z, 0.12, 1.1, 1.8, col);
    }
    TT.collision.addSolid(x0 - 0.35, y, z0 - 0.35, x1 + 0.35, y + 1.3, z0 + 0.35);
    TT.collision.addSolid(x0 - 0.35, y, z1 - 0.35, x1 + 0.35, y + 1.3, z1 + 0.35);
    TT.collision.addSolid(x0 - 0.35, y, z0 - 0.35, x0 + 0.35, y + 1.3, z1 + 0.35);
    TT.collision.addSolid(x1 - 0.35, y, z0 - 0.35, x1 + 0.35, y + 1.3, z1 + 0.35);
    return this;
  };

  function splitSpan(a, b, gaps) {
    let segs = [[a, b]];
    for (const g of gaps || []) {
      const next = [];
      for (const s of segs) {
        if (g[1] <= s[0] || g[0] >= s[1]) { next.push(s); continue; }
        if (g[0] > s[0]) next.push([s[0], g[0]]);
        if (g[1] < s[1]) next.push([g[1], s[1]]);
      }
      segs = next;
    }
    return segs;
  }

  /** Wall running fore-and-aft at constant z. `doors` are [x0,x1] gaps. */
  Ctx.prototype.wallX = function (x0, x1, z, color, doors, h) {
    h = h || this.h;
    const y = this.y;
    for (const s of splitSpan(x0, x1, doors))
      if (s[1] - s[0] > 0.02)
        this.b.solid((s[0] + s[1]) / 2, y + h / 2, z, s[1] - s[0], h, WALL_T, color);
    for (const d of doors || []) {
      if (h > DOOR_H + 0.05)
        this.b.box((d[0] + d[1]) / 2, y + DOOR_H + (h - DOOR_H) / 2, z,
                   d[1] - d[0], h - DOOR_H, WALL_T, color);
      // jambs
      this.b.box(d[0], y + DOOR_H / 2, z, 0.08, DOOR_H, WALL_T + 0.03, P.teakDark);
      this.b.box(d[1], y + DOOR_H / 2, z, 0.08, DOOR_H, WALL_T + 0.03, P.teakDark);
    }
    return this;
  };

  /** Wall running athwartships at constant x. `doors` are [z0,z1] gaps. */
  Ctx.prototype.wallZ = function (z0, z1, x, color, doors, h) {
    h = h || this.h;
    const y = this.y;
    for (const s of splitSpan(z0, z1, doors))
      if (s[1] - s[0] > 0.02)
        this.b.solid(x, y + h / 2, (s[0] + s[1]) / 2, WALL_T, h, s[1] - s[0], color);
    for (const d of doors || []) {
      if (h > DOOR_H + 0.05)
        this.b.box(x, y + DOOR_H + (h - DOOR_H) / 2, (d[0] + d[1]) / 2,
                   WALL_T, h - DOOR_H, d[1] - d[0], color);
      this.b.box(x, y + DOOR_H / 2, d[0], WALL_T + 0.03, DOOR_H, 0.08, P.teakDark);
      this.b.box(x, y + DOOR_H / 2, d[1], WALL_T + 0.03, DOOR_H, 0.08, P.teakDark);
    }
    return this;
  };

  /** Four walls around a box of space, with a door on a chosen side. */
  Ctx.prototype.enclose = function (x0, z0, x1, z1, color, doors, h) {
    doors = doors || {};
    this.wallX(x0, x1, z0, color, doors.aftZ || doors.z0, h);
    this.wallX(x0, x1, z1, color, doors.fwdZ || doors.z1, h);
    this.wallZ(z0, z1, x0, color, doors.x0, h);
    this.wallZ(z0, z1, x1, color, doors.x1, h);
    return this;
  };

  /** Ceiling lamp: an unlit bright disc plus an entry in the light pool. */
  Ctx.prototype.lamp = function (x, z, color, intensity, dist) {
    const y = this.y + this.h - 0.16;
    this.glow.cyl(x, y, z, 0.17, 0.1, color || 0xffe6bb, null, 8);
    TT.lightPool.add(x, y - 0.25, z, color || P.lampWarm,
                     intensity !== undefined ? intensity : 0.85, dist || 9);
    return this;
  };

  /** A lamp hung at an explicit height — the machinery spaces are 8.8 m tall,
      so their working lights must be slung low to be any use at all. */
  Ctx.prototype.lampAt = function (x, y, z, color, intensity, dist) {
    this.glow.cyl(x, y, z, 0.20, 0.12, color || 0xdcecff, null, 8);
    this.glow.box(x, y + 0.14, z, 0.05, 0.28, 0.05, 0x3a3f46);
    TT.lightPool.add(x, y - 0.3, z, color || 0xcfe0f0,
                     intensity !== undefined ? intensity : 1.0, dist || 16);
    return this;
  };

  /** A run of lamps down a corridor. */
  Ctx.prototype.lampRun = function (x0, x1, z, step, color, intensity) {
    for (let x = x0; x <= x1; x += step) this.lamp(x, z, color, intensity);
    return this;
  };

  // ---------------------------------------------------------------- furniture
  Ctx.prototype.table = function (x, z, w, d, color, legColor) {
    const y = this.y;
    this.b.solid(x, y + 0.76, z, w, 0.08, d, color || P.panelWalnut);
    const lc = legColor || P.teakDark;
    for (const dx of [-w / 2 + 0.15, w / 2 - 0.15])
      for (const dz of [-d / 2 + 0.15, d / 2 - 0.15])
        this.b.box(x + dx, y + 0.38, z + dz, 0.08, 0.76, 0.08, lc);
    return this;
  };

  Ctx.prototype.chair = function (x, z, rot, color) {
    const y = this.y;
    this.b.box(x, y + 0.45, z, 0.46, 0.07, 0.46, color || P.panelWalnut, { y: rot || 0 });
    const bx = Math.sin((rot || 0) + Math.PI) * 0.21, bz = Math.cos((rot || 0) + Math.PI) * 0.21;
    this.b.box(x + bx, y + 0.72, z + bz, 0.46, 0.55, 0.07, color || P.panelWalnut, { y: rot || 0 });
    for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18])
      this.b.box(x + dx, y + 0.22, z + dz, 0.05, 0.44, 0.05, P.teakDark);
    return this;
  };

  Ctx.prototype.roundTable = function (x, z, r, color) {
    const y = this.y;
    this.b.cyl(x, y + 0.76, z, r, 0.07, color || 0xf2ece0, null, 12);
    this.b.cyl(x, y + 0.38, z, 0.09, 0.76, P.teakDark, null, 8);
    this.b.cyl(x, y + 0.03, z, r * 0.5, 0.06, P.teakDark, null, 10);
    TT.collision.addSolid(x - r, y, z - r, x + r, y + 0.8, z + r);
    return this;
  };

  Ctx.prototype.bunk = function (x, z, rot, tiers) {
    const y = this.y;
    for (let t = 0; t < (tiers || 2); t++) {
      const by = y + 0.45 + t * 0.85;
      this.b.solid(x, by, z, 1.95, 0.14, 0.75, P.teakDark, { y: rot || 0 });
      this.b.box(x, by + 0.13, z, 1.85, 0.14, 0.68, 0xd8d2c4, { y: rot || 0 });
      this.b.box(x - 0.75, by + 0.22, z, 0.35, 0.14, 0.5, 0xf0ece2, { y: rot || 0 });
    }
    return this;
  };

  Ctx.prototype.bed = function (x, z, rot) {
    const y = this.y;
    this.b.solid(x, y + 0.3, z, 2.0, 0.6, 1.1, P.panelWalnut, { y: rot || 0 });
    this.b.box(x, y + 0.66, z, 1.95, 0.16, 1.05, 0xe6e0d0, { y: rot || 0 });
    this.b.box(x - 0.78, y + 0.78, z, 0.4, 0.14, 0.7, 0xf4f0e6, { y: rot || 0 });
    this.b.box(x - 1.02, y + 0.65, z, 0.1, 1.3, 1.1, P.panelWalnut, { y: rot || 0 });
    return this;
  };

  Ctx.prototype.column = function (x, z, r, color, fluted) {
    const y = this.y;
    this.b.cyl(x, y + this.h / 2, z, r, this.h, color || P.white, null, 12);
    this.b.box(x, y + 0.08, z, r * 2.6, 0.16, r * 2.6, color || P.white);
    this.b.box(x, y + this.h - 0.1, z, r * 2.6, 0.2, r * 2.6, color || P.white);
    TT.collision.addSolid(x - r, y, z - r, x + r, y + this.h, z + r);
    return this;
  };

  Ctx.prototype.panelling = function (x0, x1, z, color, dado) {
    // Wainscot strip along a wall, purely decorative.
    for (let x = x0; x < x1; x += 1.5)
      this.b.box(x + 0.75, this.y + (dado || 1.0) / 2, z, 1.4, dado || 1.0, 0.05, color);
    this.b.box((x0 + x1) / 2, this.y + (dado || 1.0) + 0.04, z, x1 - x0, 0.08, 0.09, P.teakDark);
    return this;
  };

  Ctx.prototype.porthole = function (x, z, facing) {
    const y = this.y + 1.55;
    this.b.cyl(x, y, z, 0.32, 0.12, P.brass, { x: facing ? Math.PI / 2 : 0, z: facing ? 0 : Math.PI / 2 }, 10);
    this.glass.cyl(x, y, z + (facing ? 0.02 : 0), 0.25, 0.14,
                   0x0a1a2e, { x: facing ? Math.PI / 2 : 0, z: facing ? 0 : Math.PI / 2 }, 10);
    return this;
  };

  Ctx.prototype.watertightDoor = function (x, z0, z1, id) {
    // Heavy sliding door in a transverse bulkhead — closable from the bridge.
    const y = this.y;
    const g = new THREE.Group();
    const b = new TT.Batch("wtd");
    b.box(0, 1.15, 0, 0.22, 2.3, Math.abs(z1 - z0), P.rust);
    b.box(0, 2.4, 0, 0.3, 0.25, Math.abs(z1 - z0) + 0.4, P.steelDark);
    g.add(b.mesh());
    g.position.set(x, y, (z0 + z1) / 2);
    this.group.add(g);
    const door = {
      id, mesh: g, x, z0, z1, y, closed: false, deck: this.deck.id,
      openY: y, height: 2.3
    };
    g.position.y = y - 2.4;                       // stowed below the sill
    TT.watertightDoors.push(door);
    return this;
  };

  // ------------------------------------------------------------------- stairs
  /** One straight flight. axis 'x' or 'z'; the ramp lets the player walk it. */
  Ctx.prototype.flight = function (a0, a1, b0, b1, yLow, yHigh, axis, color) {
    const b = this.b;
    const steps = Math.max(6, Math.round((yHigh - yLow) / 0.19));
    const rise = (yHigh - yLow) / steps;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const y = yLow + rise * i;
      if (axis === "x") {
        const xa = TT.lerp(a0, a1, t0), xb = TT.lerp(a0, a1, t1);
        b.box((xa + xb) / 2, y + rise / 2, (b0 + b1) / 2, xb - xa, rise, Math.abs(b1 - b0), color || P.teakDark);
      } else {
        const za = TT.lerp(a0, a1, t0), zb = TT.lerp(a0, a1, t1);
        b.box((b0 + b1) / 2, y + rise / 2, (za + zb) / 2, Math.abs(b1 - b0), rise, zb - za, color || P.teakDark);
      }
    }
    // Balustrade, and a solid cheek down each side of the flight. Without the
    // cheeks you can walk into the flank of a staircase, find no ramp under
    // you, and stroll straight through the steps at deck level.
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = TT.lerp(yLow, yHigh, t);
      if (axis === "x") {
        const x = TT.lerp(a0, a1, t);
        b.box(x, y + 0.5, b0, 0.06, 1.0, 0.06, P.brass);
        b.box(x, y + 0.5, b1, 0.06, 1.0, 0.06, P.brass);
      } else {
        const z = TT.lerp(a0, a1, t);
        b.box(b0, y + 0.5, z, 0.06, 1.0, 0.06, P.brass);
        b.box(b1, y + 0.5, z, 0.06, 1.0, 0.06, P.brass);
      }
    }
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const e0 = Math.min(b0, b1), e1 = Math.max(b0, b1);
    if (axis === "x") {
      TT.collision.addSolid(lo, yLow, e0 - 0.30, hi, yHigh + 1.15, e0 + 0.02);
      TT.collision.addSolid(lo, yLow, e1 - 0.02, hi, yHigh + 1.15, e1 + 0.30);
    } else {
      TT.collision.addSolid(e0 - 0.30, yLow, lo, e0 + 0.02, yHigh + 1.15, hi);
      TT.collision.addSolid(e1 - 0.02, yLow, lo, e1 + 0.30, yHigh + 1.15, hi);
    }
    TT.collision.addRamp(
      axis === "x"
        ? { x0: Math.min(a0, a1), x1: Math.max(a0, a1), z0: Math.min(b0, b1), z1: Math.max(b0, b1),
            yLow, yHigh, axis: "x", flip: a0 > a1 }
        : { x0: Math.min(b0, b1), x1: Math.max(b0, b1), z0: Math.min(a0, a1), z1: Math.max(a0, a1),
            yLow, yHigh, axis: "z", flip: a0 > a1 }
    );
    return this;
  };

  // ============================================================ shared pieces
  /** Corridor: sole strip, deckhead, two walls with cabin doors, lamps. */
  function corridor(c, x0, x1, zC, width, color, doorsPort, doorsStbd) {
    const hz = width / 2;
    c.wallX(x0, x1, zC - hz, color, doorsPort);
    c.wallX(x0, x1, zC + hz, color, doorsStbd);
    for (let x = x0 + 4; x < x1; x += 8) c.lamp(x, zC, 0xffe0b0, 0.75, 8);
    c.room(x0, zC - hz, x1, zC + hz, "Passageway", "corridor");
  }

  /** A run of cabins opening onto a corridor, with beds and portholes. */
  function cabinRun(c, x0, x1, zIn, zOut, count, kind) {
    const doors = [];
    const w = (x1 - x0) / count;
    const wallColor = kind === "crew" ? P.linoleum : P.panelOak;
    const sign = zOut > zIn ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const a = x0 + i * w, b2 = a + w;
      const dc = a + w / 2;
      doors.push([dc - DOOR_W / 2, dc + DOOR_W / 2]);
      if (i > 0) c.wallZ(Math.min(zIn, zOut), Math.max(zIn, zOut), a, wallColor);
      // furnish
      if (kind === "crew") {
        c.bunk(dc, zOut - sign * 0.7, Math.PI / 2, 2);
      } else {
        c.bed(dc, zOut - sign * 0.9, Math.PI / 2);
        c.b.box(dc + w / 2 - 0.5, c.y + 0.4, zIn + sign * 0.6, 0.5, 0.8, 0.4, P.panelWalnut);
      }
      c.porthole(dc, zOut, false);
      if (i % 2 === 0) c.lamp(dc, (zIn + zOut) / 2, 0xffd8a0, 0.5, 5);
      c.room(a, Math.min(zIn, zOut), b2, Math.max(zIn, zOut),
             kind === "crew" ? "Crew Berth" : "Stateroom", kind);
    }
    return doors;
  }

  TT.corridor = corridor;
  TT.cabinRun = cabinRun;
  TT.DeckCtx = Ctx;
  TT.WALL_T = WALL_T;
  TT.DOOR_W = DOOR_W;
  TT.watertightDoors = [];

  /** Finish a deck: sole, deckhead, and commit the batches to the scene. */
  Ctx.prototype.finish = function (root, opts) {
    opts = opts || {};
    const inset = opts.inset !== undefined ? opts.inset : 0.9;
    // A deck may exist in several disjoint stretches — G deck and the orlop
    // stop where the boiler and engine rooms rise through them.
    const ranges = opts.ranges || [[
      opts.x0 !== undefined ? opts.x0 : -132,
      opts.x1 !== undefined ? opts.x1 : 132
    ]];

    for (const [x0, x1] of ranges) {
      if (!opts.noSole) {
        const sole = TT.soleGeometry(this.y, x0, x1, inset, this.holes, 3);
        this.b.custom(sole, new THREE.Matrix4(), opts.soleColor || P.linoleum);
        sole.dispose();
      }
      if (!opts.noHead) {
        const head = TT.soleGeometry(this.y + this.h, x0, x1, inset, this.holes, 3, true);
        this.b.custom(head, new THREE.Matrix4(), opts.headColor || 0xcfc9ba);
        head.dispose();
      }
      // Shell liner, so you never see daylight through the plating from inside.
      if (!opts.noLiner) {
        for (let x = x0; x < x1; x += 6) {
          const hw = TT.halfBeamAt(x + 3, this.y + 1) - inset + 0.15;
          if (hw < 1) continue;
          this.b.box(x + 3, this.y + this.h / 2, -hw, 6, this.h, 0.16, opts.linerColor || P.steelDark);
          this.b.box(x + 3, this.y + this.h / 2, hw, 6, this.h, 0.16, opts.linerColor || P.steelDark);
          TT.collision.addSolid(x, this.y, -hw - 0.3, x + 6, this.y + this.h, -hw + 0.1);
          TT.collision.addSolid(x, this.y, hw - 0.1, x + 6, this.y + this.h, hw + 0.3);
        }
      }
    }

    if (!this.b.isEmpty()) this.group.add(this.b.mesh({ frustumCulled: false }));
    if (!this.glow.isEmpty()) this.group.add(this.glow.mesh({ basic: true, frustumCulled: false }));
    if (!this.glass.isEmpty())
      this.group.add(this.glass.mesh({ transparent: true, opacity: 0.4, frustumCulled: false }));

    this.group.userData.deckId = this.deck.id;
    root.add(this.group);
    TT.deckGroups[this.deck.id] = this.group;
    return this.group;
  };

  TT.deckGroups = {};

  // ------------------------------------------------------------ deck lookup
  TT.roomAt = function (x, y, z) {
    let best = null, bestArea = Infinity;
    for (const r of TT.rooms) {
      if (Math.abs(r.y - y) > 1.6) continue;
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const area = (r.x1 - r.x0) * (r.z1 - r.z0);
      if (area < bestArea) { bestArea = area; best = r; }
    }
    return best;
  };

  TT.deckAtY = function (y) {
    let best = TT.DECKS[TT.DECKS.length - 1];
    let bd = Infinity;
    for (const d of TT.DECKS) {
      const dd = Math.abs(d.y - y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  };

})(window.TT);
