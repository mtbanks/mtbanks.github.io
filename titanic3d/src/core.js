/* ============================================================================
   TITANIC — MAIDEN VOYAGE
   core.js — namespace, ship constants, deck table, materials, helpers
   ----------------------------------------------------------------------------
   Coordinate system (ship-local, metres):
     +X  forward (toward the bow)      -X  aft (toward the stern)
     +Y  up, with Y = 0 at the keel
     +Z  to starboard                  -Z  to port
   The whole ship lives under TT.shipRoot so it can pitch, roll and sink as one.
   ========================================================================== */
window.TT = window.TT || {};

(function (TT) {
  "use strict";

  // -------------------------------------------------------------- dimensions
  // RMS Titanic, as built by Harland & Wolff, Belfast, 1911.
  TT.SHIP = {
    LOA: 269.1,            // length overall, 882 ft 9 in
    BEAM: 28.2,            // 92 ft 6 in
    DRAFT: 10.5,           // 34 ft 7 in loaded
    GRT: 46328,            // gross register tonnage
    BOW_X: 134.5,
    STERN_X: -134.6,
    HALF_BEAM: 14.1,
    SERVICE_KTS: 21,
    MAX_KTS: 24,
    BOILERS: 29,           // 24 double-ended, 5 single-ended
    FURNACES: 159,
    SHP: 46000,            // combined indicated + shaft horsepower
    LIFEBOATS: 20,         // 14 standard, 2 emergency cutters, 4 collapsible
    LIFEBOAT_CAPACITY: 1178,
    SOULS: 2224
  };

  // ------------------------------------------------------------------- decks
  // y = height of the walking surface above the keel.
  TT.DECKS = [
    { id: "boat",  name: "Boat Deck",        y: 27.2, code: "",  blurb: "Lifeboats, bridge, wheelhouse, officers' quarters, gymnasium." },
    { id: "a",     name: "Promenade Deck",   y: 24.4, code: "A", blurb: "First Class lounge, reading & writing room, smoke room." },
    { id: "b",     name: "Bridge Deck",      y: 21.6, code: "B", blurb: "First Class staterooms, à la carte restaurant, Café Parisien." },
    { id: "c",     name: "Shelter Deck",     y: 18.8, code: "C", blurb: "Purser's office, Third Class general room, well decks." },
    { id: "d",     name: "Saloon Deck",      y: 16.0, code: "D", blurb: "First Class Dining Saloon and Reception Room." },
    { id: "e",     name: "Upper Deck",       y: 13.2, code: "E", blurb: "Scotland Road — the long crew and passenger artery." },
    { id: "f",     name: "Middle Deck",      y: 10.4, code: "F", blurb: "Turkish baths, swimming bath, Third Class dining saloons." },
    { id: "g",     name: "Lower Deck",       y:  7.6, code: "G", blurb: "Squash court, post office, cargo and stores." },
    { id: "orlop", name: "Orlop Deck",       y:  4.6, code: "",  blurb: "Cargo holds, refrigerated stores, mail sorting." },
    { id: "tank",  name: "Tank Top",         y:  1.6, code: "",  blurb: "Boiler rooms 1–6, reciprocating engines, turbine room." }
  ];
  TT.DECK_BY_ID = {};
  TT.DECKS.forEach((d, i) => { d.index = i; TT.DECK_BY_ID[d.id] = d; });

  TT.WATERLINE_Y = TT.SHIP.DRAFT;      // still-water surface in ship coords
  TT.DECK_CLEAR  = 2.72;               // headroom between sole and deckhead

  // Sixteen watertight compartments, bulkhead A through P, given as x-ranges.
  TT.COMPARTMENTS = (function () {
    const edges = [-134.6, -108, -86, -66, -48, -30, -14, 2, 18, 34, 50, 64, 78, 92, 105, 120, 134.5];
    const names = ["Aft Peak", "Steering Gear", "Turbine Room", "Engine Room", "Boiler Room 1",
                   "Boiler Room 2", "Boiler Room 3", "Boiler Room 4", "Boiler Room 5",
                   "Boiler Room 6", "Coal Bunker", "Hold No.3", "Hold No.2", "Hold No.1",
                   "Forepeak Tank", "Chain Locker"];
    const out = [];
    for (let i = 0; i < names.length; i++)
      out.push({ i, name: names[i], x0: edges[i], x1: edges[i + 1], flood: 0, breached: false });
    return out;
  })();

  // -------------------------------------------------------------- stairwells
  // One definition, read by BOTH the interior (which builds the flights) and
  // the exterior (which must cut matching openings in the weather decks).
  // Keeping these in one place is what stops a deck opening and the stair
  // under it from drifting apart.
  TT.STAIRWELLS = [
    { name: "Forward Grand Staircase", grand: true,
      x0: 14, x1: 26, zA: [-7.5, -4.2], zB: [-3.6, -0.3],
      decks: ["e", "d", "c", "b", "a", "boat"], color: 0x8a5a2e },
    { name: "Aft Grand Staircase", grand: true,
      x0: -30, x1: -18, zA: [-6.5, -3.2], zB: [-2.6, 0.7],
      // Starts at F: amidships there is no G deck, only Boiler Room No. 2.
      decks: ["f", "e", "d", "c", "b", "a", "boat"], color: 0x8a5a2e },
    { name: "Working Stair — Aft",
      x0: -108, x1: -96, zA: [-5, -2.2], zB: [-1.6, 1.2],
      decks: ["tank", "orlop", "g", "f", "e"], color: 0x3d434c },
    { name: "Firemen's Stair",
      x0: 54, x1: 66, zA: [-5, -2.2], zB: [-1.6, 1.2],
      decks: ["tank", "orlop", "g", "f", "e"], color: 0x3d434c }
  ];

  /** Footprint of the flight that arrives from below into a given deck. */
  TT.stairHolesFor = function (deckId) {
    const out = [];
    for (const s of TT.STAIRWELLS)
      for (let i = 0; i < s.decks.length - 1; i++) {
        if (s.decks[i + 1] !== deckId) continue;
        const lane = (i % 2 === 0) ? s.zA : s.zB;
        out.push({ x0: s.x0 + 1.5, x1: s.x1 - 1.5, z0: lane[0], z1: lane[1] });
      }
    return out;
  };

  /** True if (x,z) lies in any stairwell shaft — used to keep furniture,
      crates and deckhouse walls from being built across a flight. */
  TT.inStairwell = function (x, z, margin) {
    const m = margin || 0.5;
    for (const s of TT.STAIRWELLS) {
      if (x < s.x0 - m || x > s.x1 + m) continue;
      const lo = Math.min(s.zA[0], s.zB[0]) - m, hi = Math.max(s.zA[1], s.zB[1]) + m;
      if (z >= lo && z <= hi) return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ colours
  TT.PAL = {
    hull:        0x14161a,
    boot:        0x6d1b12,
    white:       0xe8e4d8,
    teak:        0x9a6f3f,
    teakDark:    0x6f4e2a,
    brass:       0xd8a441,
    funnel:      0xd6a25c,
    funnelTop:   0x16181c,
    steel:       0x3d434c,
    steelDark:   0x22262c,
    rust:        0x6b3a22,
    carpetRed:   0x7a2b28,
    carpetBlue:  0x27405e,
    panelOak:    0xa8763f,
    panelWalnut: 0x5d3a20,
    plaster:     0xd9d2c0,
    linoleum:    0x8c8778,
    coal:        0x0d0d10,
    fire:        0xff7a1c,
    lampWarm:    0xffd08a,
    seaDeep:     0x050b16,
    seaFoam:     0xbcd6ea,
    iceWhite:    0xf2fbff,
    iceBlue:     0x8fd0e8
  };

  // ---------------------------------------------------------------- materials
  // One shared cache. Interiors use Lambert so the light pool stays cheap.
  const matCache = new Map();
  TT.mat = function (color, opts) {
    opts = opts || {};
    const key = color + "|" + JSON.stringify(opts);
    if (matCache.has(key)) return matCache.get(key);
    let m;
    if (opts.basic) {
      m = new THREE.MeshBasicMaterial({ color });
    } else {
      m = new THREE.MeshLambertMaterial({ color });
    }
    if (opts.emissive !== undefined && m.emissive) m.emissive.setHex(opts.emissive);
    if (opts.emissiveIntensity !== undefined) m.emissiveIntensity = opts.emissiveIntensity;
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity !== undefined ? opts.opacity : 0.5; }
    if (opts.side) m.side = opts.side;
    if (opts.flat) m.flatShading = true;
    if (opts.depthWrite === false) m.depthWrite = false;
    matCache.set(key, m);
    return m;
  };

  // Shared unit geometries — every box in the ship reuses these.
  TT.GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
    cylLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    sphere: new THREE.SphereGeometry(0.5, 12, 8),
    plane: new THREE.PlaneGeometry(1, 1)
  };

  // ------------------------------------------------------------------ helpers
  /** Axis-aligned box mesh. cx/cy/cz is the CENTRE; sx/sy/sz the full size. */
  TT.box = function (parent, cx, cy, cz, sx, sy, sz, material) {
    const m = new THREE.Mesh(TT.GEO.box, material);
    m.position.set(cx, cy, cz);
    m.scale.set(sx, sy, sz);
    if (parent) parent.add(m);
    return m;
  };

  /** Box given by min/max corners instead of centre/size. */
  TT.boxFromTo = function (parent, x0, y0, z0, x1, y1, z1, material) {
    return TT.box(parent, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
                  Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), material);
  };

  TT.cyl = function (parent, x, y, z, radius, height, material, radialSegments) {
    const g = radialSegments && radialSegments !== 16 ? TT.GEO.cylLow : TT.GEO.cyl;
    const m = new THREE.Mesh(g, material);
    m.position.set(x, y, z);
    m.scale.set(radius * 2, height, radius * 2);
    if (parent) parent.add(m);
    return m;
  };

  TT.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  TT.lerp = (a, b, t) => a + (b - a) * t;
  TT.smooth = t => t * t * (3 - 2 * t);
  TT.rand = (a, b) => a + Math.random() * (b - a);
  TT.pick = arr => arr[(Math.random() * arr.length) | 0];

  /** Deterministic pseudo-random so a given voyage lays out the same way. */
  let seed = 19120414;
  TT.srand = function () {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  TT.srandRange = (a, b) => a + TT.srand() * (b - a);

  /** Half-beam of the hull at a given station, used to fit rooms inside. */
  TT.halfBeamAt = function (x, y) {
    const t = TT.clamp((x - TT.SHIP.STERN_X) / (TT.SHIP.BOW_X - TT.SHIP.STERN_X), 0, 1);
    let b;
    if (t < 0.10)      b = TT.lerp(0.04, 0.92, TT.smooth(t / 0.10));
    else if (t < 0.18) b = TT.lerp(0.92, 1.00, TT.smooth((t - 0.10) / 0.08));
    else if (t < 0.72) b = 1.0;
    else if (t < 0.90) b = TT.lerp(1.00, 0.72, TT.smooth((t - 0.72) / 0.18));
    else               b = TT.lerp(0.72, 0.02, TT.smooth((t - 0.90) / 0.10));
    // Narrow toward the keel as well: the turn of the bilge.
    const v = TT.clamp(y / 12, 0, 1);
    const rise = Math.pow(Math.sin(Math.min(1, v * 1.7) * Math.PI / 2), 0.5);
    return TT.SHIP.HALF_BEAM * b * TT.lerp(0.55, 1.0, rise);
  };

  // ------------------------------------------------------- collision registry
  // Solids are AABBs in ship space. Ramps let the player change decks smoothly.
  TT.collision = {
    solids: [],        // {x0,x1,y0,y1,z0,z1}
    ramps:  [],        // {x0,x1,z0,z1,yLow,yHigh,axis,dir,deckLow,deckHigh}
    triggers: [],      // {x0,x1,z0,z1,y0,y1,fn,once,fired,label}

    addSolid(x0, y0, z0, x1, y1, z1) {
      this.solids.push({
        x0: Math.min(x0, x1), x1: Math.max(x0, x1),
        y0: Math.min(y0, y1), y1: Math.max(y0, y1),
        z0: Math.min(z0, z1), z1: Math.max(z0, z1)
      });
    },
    /** Convenience: register the footprint of a mesh built with TT.box. */
    addSolidFromMesh(mesh) {
      const p = mesh.position, s = mesh.scale;
      this.addSolid(p.x - s.x / 2, p.y - s.y / 2, p.z - s.z / 2,
                    p.x + s.x / 2, p.y + s.y / 2, p.z + s.z / 2);
    },
    addRamp(r) { this.ramps.push(r); },
    addTrigger(t) { this.triggers.push(t); },
    reset() { this.solids.length = 0; this.ramps.length = 0; this.triggers.length = 0; }
  };

  /** Walls that a mesh should both render and block. */
  TT.solidBox = function (parent, cx, cy, cz, sx, sy, sz, material) {
    const m = TT.box(parent, cx, cy, cz, sx, sy, sz, material);
    TT.collision.addSolidFromMesh(m);
    return m;
  };

  // --------------------------------------------------------------- light pool
  // Interiors are lit by emissive fixtures plus a small pool of real point
  // lights that follow the player, so hundreds of lamps cost almost nothing.
  TT.LightPool = function (scene, count, color, intensity, distance) {
    this.fixtures = [];                  // {pos:Vector3, color, intensity}
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(color, 0, distance);
      l.visible = false;
      scene.add(l);
      this.lights.push(l);
    }
    this._tmp = new THREE.Vector3();
  };
  TT.LightPool.prototype.add = function (x, y, z, color, intensity, distance) {
    this.fixtures.push({
      pos: new THREE.Vector3(x, y, z),
      color: color !== undefined ? color : TT.PAL.lampWarm,
      intensity: intensity !== undefined ? intensity : 1.0,
      distance: distance !== undefined ? distance : 9
    });
  };
  TT.LightPool.prototype.update = function (playerPos) {
    const f = this.fixtures, n = this.lights.length;
    // Rank by how much light a fixture actually delivers here, not by raw
    // distance. A furnace door with a 7 m falloff seen from 14 m away
    // contributes nothing, and must not occupy a slot that a working light
    // over your head could use.
    const best = [];
    for (let i = 0; i < f.length; i++) {
      const fx = f[i];
      const d2 = fx.pos.distanceToSquared(playerPos);
      if (d2 >= fx.distance * fx.distance) continue;
      const contrib = fx.intensity * (1 - Math.sqrt(d2) / fx.distance);
      if (contrib <= 0.001) continue;
      if (best.length < n) {
        best.push({ c: contrib, f: fx });
        if (best.length === n) best.sort((a, b) => b.c - a.c);
      } else if (contrib > best[n - 1].c) {
        best[n - 1] = { c: contrib, f: fx };
        for (let k = n - 1; k > 0 && best[k].c > best[k - 1].c; k--) {
          const t = best[k]; best[k] = best[k - 1]; best[k - 1] = t;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const l = this.lights[i];
      if (i < best.length) {
        const fx = best[i].f;
        l.visible = true;
        l.position.copy(fx.pos);
        l.color.setHex(fx.color);
        l.intensity = fx.intensity;
        l.distance = fx.distance;
      } else {
        l.visible = false;
        l.intensity = 0;
      }
    }
  };

  // -------------------------------------------------------------- geometry batch
  /* A whole deck is thousands of little boxes. Submitting each as its own mesh
     would cost thousands of draw calls, so everything static is welded into one
     vertex-coloured BufferGeometry per batch and drawn in a single call. */
  TT.Batch = function (name) {
    this.name = name || "batch";
    this._pos = [];
    this._nrm = [];
    this._col = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  };

  TT.Batch.prototype.custom = function (geo, matrix, colorHex) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    this._c.setHex(colorHex);
    const r = this._c.r, gg = this._c.g, b = this._c.b;
    for (let i = 0; i < p.length; i += 3) {
      this._pos.push(p[i], p[i + 1], p[i + 2]);
      this._nrm.push(n[i], n[i + 1], n[i + 2]);
      this._col.push(r, gg, b);
    }
    g.dispose();
    return this;
  };

  TT.Batch.prototype._place = function (geo, x, y, z, sx, sy, sz, rot, colorHex) {
    this._v.set(x, y, z);
    this._s.set(sx, sy, sz);
    if (rot) { this._e.set(rot.x || 0, rot.y || 0, rot.z || 0); this._q.setFromEuler(this._e); }
    else this._q.identity();
    this._m.compose(this._v, this._q, this._s);
    return this.custom(geo, this._m, colorHex);
  };

  TT.Batch.prototype.box = function (cx, cy, cz, sx, sy, sz, colorHex, rot) {
    return this._place(TT.GEO.box, cx, cy, cz, sx, sy, sz, rot, colorHex);
  };
  /** Box given by opposite corners. */
  TT.Batch.prototype.boxFromTo = function (x0, y0, z0, x1, y1, z1, colorHex) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
                    Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), colorHex);
  };
  TT.Batch.prototype.cyl = function (x, y, z, r, h, colorHex, rot, seg) {
    const g = (seg && seg <= 8) ? TT.GEO.cylLow : TT.GEO.cyl;
    return this._place(g, x, y, z, r * 2, h, r * 2, rot, colorHex);
  };
  TT.Batch.prototype.sphere = function (x, y, z, r, colorHex, sy) {
    return this._place(TT.GEO.sphere, x, y, z, r * 2, (sy || r) * 2, r * 2, null, colorHex);
  };
  /** Solid box that also blocks the player. */
  TT.Batch.prototype.solid = function (cx, cy, cz, sx, sy, sz, colorHex, rot) {
    this.box(cx, cy, cz, sx, sy, sz, colorHex, rot);
    TT.collision.addSolid(cx - sx / 2, cy - sy / 2, cz - sz / 2,
                          cx + sx / 2, cy + sy / 2, cz + sz / 2);
    return this;
  };

  TT.Batch.prototype.isEmpty = function () { return this._pos.length === 0; };

  TT.Batch.prototype.mesh = function (opts) {
    opts = opts || {};
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this._pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this._nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this._col, 3));
    g.computeBoundingSphere();
    const matOpts = { vertexColors: true };
    if (opts.side) matOpts.side = opts.side;
    if (opts.transparent) { matOpts.transparent = true; matOpts.opacity = opts.opacity || 0.5; }
    const m = new THREE.Mesh(g, opts.basic ? new THREE.MeshBasicMaterial(matOpts)
                                           : new THREE.MeshLambertMaterial(matOpts));
    m.name = this.name;
    m.frustumCulled = opts.frustumCulled !== false;
    return m;
  };

  /** Horizontal slab that follows the hull, with rectangular holes cut out.
      `flip` makes it face downward, for use as a deckhead. */
  TT.soleGeometry = function (y, x0, x1, inset, holes, step, flip) {
    step = step || 3;
    const pos = [], nrm = [], ny = flip ? -1 : 1;
    function quad(ax, az, bx, bz) {
      if (flip) {
        pos.push(ax, y, az, bx, y, bz, bx, y, az);
        pos.push(ax, y, az, ax, y, bz, bx, y, bz);
      } else {
        pos.push(ax, y, az, bx, y, az, bx, y, bz);
        pos.push(ax, y, az, bx, y, bz, ax, y, bz);
      }
      for (let i = 0; i < 6; i++) nrm.push(0, ny, 0);
    }
    for (let x = x0; x < x1; x += step) {
      const xa = x, xb = Math.min(x1, x + step), xm = (xa + xb) / 2;
      const hw = Math.max(0, TT.halfBeamAt(xm, y) - (inset || 0));
      if (hw <= 0.05) continue;
      // Collect hole spans in z for this strip.
      let spans = [[-hw, hw]];
      if (holes) {
        for (const h of holes) {
          if (xb <= h.x0 || xa >= h.x1) continue;
          const next = [];
          for (const s of spans) {
            if (h.z1 <= s[0] || h.z0 >= s[1]) { next.push(s); continue; }
            if (h.z0 > s[0]) next.push([s[0], h.z0]);
            if (h.z1 < s[1]) next.push([h.z1, s[1]]);
          }
          spans = next;
        }
      }
      for (const s of spans) if (s[1] - s[0] > 0.05) quad(xa, s[0], xb, s[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  };

  // ------------------------------------------------------------------- events
  TT.bus = {
    _h: {},
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); },
    emit(ev, data) { (this._h[ev] || []).forEach(fn => fn(data)); }
  };

})(window.TT);
