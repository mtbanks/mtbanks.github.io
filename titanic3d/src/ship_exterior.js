/* ============================================================================
   ship_exterior.js — hull, decks, superstructure, funnels, masts, boats.
   Everything is procedural. Static geometry is welded into a handful of
   batched meshes; only things that move get their own object.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;
  const S = TT.SHIP;

  /** Sheer line: top edge of the hull plating, higher at bow and stern. */
  function sheerY(t) {
    const fwd = Math.max(0, (t - 0.62) / 0.38);
    const aft = Math.max(0, (0.30 - t) / 0.30);
    return 20.4 + 3.4 * fwd * fwd + 1.7 * aft * aft;
  }
  TT.sheerY = sheerY;
  TT.sheerAtX = x => sheerY(TT.clamp((x - S.STERN_X) / (S.BOW_X - S.STERN_X), 0, 1));

  // -------------------------------------------------------------------- hull
  function buildHull(root) {
    const NX = 110, NV = 20;
    const stations = [];
    for (let i = 0; i < NX; i++) {
      const t = i / (NX - 1);
      const x = TT.lerp(S.STERN_X, S.BOW_X, t);
      const sheer = sheerY(t);
      const row = [];
      for (let k = 0; k < NV; k++) {
        const v = k / (NV - 1);
        const y = Math.pow(v, 1.12) * sheer;
        const hw = TT.halfBeamAt(x, y);
        let dx = 0;
        if (t > 0.88) dx = ((t - 0.88) / 0.12) * y * 0.34;                    // raked stem
        if (t < 0.07) dx = -((0.07 - t) / 0.07) * Math.max(0, y - 11) * 0.75; // counter stern
        row.push({ x: x + dx, y, hw, sheer });
      }
      stations.push(row);
    }

    const ring = NV * 2;
    const pos = new Float32Array(NX * ring * 3);
    const col = new Float32Array(NX * ring * 3);
    const cHull = new THREE.Color(P.hull);
    const cBoot = new THREE.Color(P.boot);
    const cGold = new THREE.Color(0xc9a24a);

    let p = 0;
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < ring; j++) {
        const port = j < NV;
        const k = port ? (NV - 1 - j) : (j - NV);
        const s = stations[i][k];
        pos[p] = s.x; pos[p + 1] = s.y; pos[p + 2] = port ? -s.hw : s.hw;
        // Livery: red boot topping below the load line, black plating above,
        // and the thin gold sheer stripe along the top strake.
        let c = cHull;
        if (s.y < S.DRAFT - 0.2) c = cBoot;
        else if (s.y > s.sheer - 0.5) c = cGold;
        col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
        p += 3;
      }
    }

    const idx = [];
    for (let i = 0; i < NX - 1; i++)
      for (let j = 0; j < ring - 1; j++) {
        const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const hull = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      vertexColors: true, side: THREE.DoubleSide
    }));
    hull.name = "hull";
    root.add(hull);
    return hull;
  }

  // ---------------------------------------------------- open weather decks
  /** Planked deck following the hull outline, optionally railed and blocked. */
  function weatherDeck(b, x0, x1, y, colorHex, inset, railing, holes) {
    // Planked surface, plus a downward-facing underside 12 cm below it. A
    // single up-facing sheet is invisible from underneath — you can see the sea
    // straight through the deck from the space below, or from any angle where
    // the camera dips beneath it.
    const geo = TT.soleGeometry(y, x0, x1, inset, holes, 3);
    b.custom(geo, new THREE.Matrix4(), colorHex);
    geo.dispose();
    const under = TT.soleGeometry(y - 0.12, x0, x1, inset, holes, 3, true);
    b.custom(under, new THREE.Matrix4(), 0x2a2f36);
    under.dispose();
    // Close the raw edge all the way round so the deck reads as a solid slab.
    for (let x = x0; x < x1; x += 3) {
      const xm = Math.min(x1, x + 3);
      const hw = Math.max(0, TT.halfBeamAt((x + xm) / 2, y) - inset);
      if (hw <= 0.05) continue;
      b.box((x + xm) / 2, y - 0.06, -hw, xm - x, 0.13, 0.1, 0x2a2f36);
      b.box((x + xm) / 2, y - 0.06, hw, xm - x, 0.13, 0.1, 0x2a2f36);
    }

    // Plank seams, every couple of metres, for a bit of texture.
    for (let x = x0; x < x1; x += 6) {
      const hw = Math.max(0, TT.halfBeamAt(x, y) - inset);
      for (let z = -hw; z < hw; z += 2.2)
        b.box(x + 3, y + 0.015, z, 5.8, 0.02, 0.09, TT.PAL.teakDark);
    }

    if (!railing) return;
    const N = 34;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), x = TT.lerp(x0, x1, t);
        const hw = (Math.max(0.2, TT.halfBeamAt(x, y) - inset)) * side;
        b.box(x, y + 0.56, hw, 0.07, 1.12, 0.07, P.white);
      }
      for (let i = 0; i < N - 1; i++) {
        const xa = TT.lerp(x0, x1, i / (N - 1)), xb = TT.lerp(x0, x1, (i + 1) / (N - 1));
        const xm = (xa + xb) / 2;
        const hw = (Math.max(0.2, TT.halfBeamAt(xm, y) - inset)) * side;
        for (const h of [0.40, 0.76, 1.10]) b.box(xm, y + h, hw, xb - xa, 0.055, 0.055, P.white);
        TT.collision.addSolid(xa, y, hw - side * 0.4, xb, y + 1.4, hw + side * 0.6);
      }
    }
  }
  TT.weatherDeck = weatherDeck;

  // -------------------------------------------------------------- deckhouses
  // Deckhouses used to be solid boxes, which sealed their own interiors off and
  // — in the case of the Grand Staircase house — capped the staircase itself.
  // They are shells now: perimeter walls with door openings, and a roof.
  const HOUSE_T = 0.32, LINTEL = 2.15;

  function splitRun(a, b, gaps) {
    let segs = [[a, b]];
    for (const g of gaps || []) {
      const next = [];
      for (const seg of segs) {
        if (g[1] <= seg[0] || g[0] >= seg[1]) { next.push(seg); continue; }
        if (g[0] > seg[0]) next.push([seg[0], g[0]]);
        if (g[1] < seg[1]) next.push([g[1], seg[1]]);
      }
      segs = next;
    }
    return segs;
  }

  /** Wall running fore-and-aft at constant z. */
  function houseWallX(b, x0, x1, z, yBase, h, color, gaps) {
    for (const seg of splitRun(x0, x1, gaps))
      if (seg[1] - seg[0] > 0.02)
        b.solid((seg[0] + seg[1]) / 2, yBase + h / 2, z, seg[1] - seg[0], h, HOUSE_T, color);
    for (const g of gaps || [])
      if (h > LINTEL + 0.05)
        b.box((g[0] + g[1]) / 2, yBase + LINTEL + (h - LINTEL) / 2, z,
              g[1] - g[0], h - LINTEL, HOUSE_T, color);
  }

  /** Wall running athwartships at constant x. */
  function houseWallZ(b, z0, z1, x, yBase, h, color, gaps) {
    for (const seg of splitRun(z0, z1, gaps))
      if (seg[1] - seg[0] > 0.02)
        b.solid(x, yBase + h / 2, (seg[0] + seg[1]) / 2, HOUSE_T, h, seg[1] - seg[0], color);
    for (const g of gaps || [])
      if (h > LINTEL + 0.05)
        b.box(x, yBase + LINTEL + (h - LINTEL) / 2, (g[0] + g[1]) / 2,
              HOUSE_T, h - LINTEL, g[1] - g[0], color);
  }

  // ----------------------------------------------------------------- funnels
  function buildFunnel(root, x, dummy) {
    const g = new THREE.Group();
    const b = new TT.Batch("funnel");
    const baseY = 30.4, topY = 30.4 + 18.6, mid = (baseY + topY) / 2;

    const tube = new THREE.CylinderGeometry(1, 1, 1, 26, 1, true);
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(0, mid, 0), new THREE.Quaternion(),
              new THREE.Vector3(3.75, topY - baseY, 2.95));
    b.custom(tube, m, P.funnel);
    m.compose(new THREE.Vector3(0, topY - 2.0, 0), new THREE.Quaternion(),
              new THREE.Vector3(3.84, 4.0, 3.04));
    b.custom(tube, m, P.funnelTop);
    tube.dispose();

    // Guy wires down to the deckhouse roof.
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const dz = Math.cos(a), dx = Math.sin(a);
      b.cyl(dx * 4.2, topY - 10.5, dz * 4.6, 0.045, 15.5, P.steelDark,
            { x: dz * 0.30, z: -dx * 0.30 }, 6);
    }
    // White casing where the funnel meets the boat deck.
    b.solid(0, 28.9, 0, 9.8, 3.3, 8.4, P.white);
    b.box(0, 30.6, 0, 10.2, 0.3, 8.8, P.white);

    g.add(b.mesh());
    g.position.x = x;
    g.rotation.z = 0.04;                     // Titanic's funnels raked aft
    g.userData.dummy = !!dummy;
    g.userData.smokeAnchor = new THREE.Vector3(x, topY, 0);
    root.add(g);
    return g;
  }

  // --------------------------------------------------------------- lifeboats
  function buildLifeboat(root, x, z, number) {
    const g = new THREE.Group();
    const b = new TT.Batch("boat" + number);

    const hullGeo = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(0, 1.15, 0),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
              new THREE.Vector3(9.2, 2.5, 2.9));
    b.custom(hullGeo, m, 0xdcd6c6);
    hullGeo.dispose();
    b.box(0, 1.08, 0, 9.1, 0.16, 2.8, 0x4a3a26);                  // canvas cover
    for (let i = -3; i <= 3; i++) b.box(i * 1.25, 0.86, 0, 0.11, 0.52, 2.7, 0x8a7a58);
    b.box(0, 1.24, 0, 9.3, 0.1, 0.35, 0x6f5a3a);

    // Welin quadrant davits fore and aft of the boat.
    for (const dx of [-3.8, 3.8]) {
      const dz = z > 0 ? -1.75 : 1.75;
      b.cyl(dx, 1.45, dz, 0.14, 2.9, P.steel, null, 8);
      b.cyl(dx + 0.5, 2.95, dz, 0.12, 1.7, P.steel, { z: -0.95 }, 8);
      b.cyl(dx + 1.05, 2.35, dz, 0.035, 1.7, P.steelDark, null, 6);
    }
    g.add(b.mesh());
    g.position.set(x, 27.4, z);
    g.userData.boat = { number, launched: false, homeX: x, homeZ: z, homeY: 27.4, souls: 0 };
    root.add(g);
    TT.collision.addSolid(x - 4.7, 27.2, z - 1.5, x + 4.7, 28.8, z + 1.5);
    return g;
  }

  // -------------------------------------------------------------- ventilators
  function cowlVent(b, x, y, z, h, facing) {
    b.cyl(x, y + h / 2, z, 0.55, h, P.white, null, 12);
    const bell = new THREE.CylinderGeometry(0.9, 0.55, 1.5, 12, 1, true);
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x + facing * 0.65, y + h, z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, facing * -1.3)),
              new THREE.Vector3(1, 1, 1));
    b.custom(bell, m, P.white);
    bell.dispose();
    TT.collision.addSolid(x - 0.7, y, z - 0.7, x + 0.7, y + h, z + 0.7);
  }

  // -------------------------------------------------------------------- masts
  function buildMast(root, x, height, crowsNest) {
    const g = new THREE.Group();
    const b = new TT.Batch("mast");
    b.cyl(0, height / 2, 0, 0.45, height, P.teakDark, null, 10);
    b.cyl(0, height * 0.80, 0, 0.22, height * 0.5, P.teakDark, null, 8);
    b.cyl(0, height * 0.70, 0, 0.15, 15, P.teakDark, { x: Math.PI / 2 }, 8);

    if (crowsNest) {
      const nestY = 28.0;
      const ring = new THREE.CylinderGeometry(1.55, 1.35, 1.7, 14, 1, true);
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(0, nestY, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      b.custom(ring, m, P.white);
      ring.dispose();
      b.cyl(0, nestY - 0.8, 0, 1.55, 0.16, P.white, null, 14);
      for (let y = 1.6; y < nestY - 1.2; y += 0.55) b.box(0, y, 0.52, 0.55, 0.05, 0.05, P.steel);
      g.userData.nestWorldY = 22.0 + nestY;
    }
    g.add(b.mesh());
    g.position.set(x, 22.0, 0);
    root.add(g);
    return g;
  }

  // =================================================================== assemble
  TT.buildExterior = function (root) {
    const ext = new THREE.Group();
    ext.name = "exterior";
    root.add(ext);

    buildHull(ext);

    const b = new TT.Batch("exterior-static");
    const glass = new TT.Batch("exterior-glass");

    // Stair openings in the weather decks. A deck and the Boat Deck have no
    // sole of their own — these planked decks ARE their floors — so the
    // openings must be cut to exactly the flights that arrive there.
    const aHoles = TT.stairHolesFor("a");
    const boatHoles = TT.stairHolesFor("boat");

    // ---- weather decks, bow to stern
    weatherDeck(b, 78, 133, 22.0, P.teak, 0.7, true);            // forecastle
    weatherDeck(b, 50, 78, 18.8, P.teak, 0.7, false);            // forward well deck
    weatherDeck(b, -60, 50, 21.6, P.teak, 0.7, false);           // B / bridge deck
    weatherDeck(b, -88, -60, 18.8, P.teak, 0.7, false);          // aft well deck
    weatherDeck(b, -133, -88, 21.6, P.teak, 0.7, true);          // poop deck

    // Bulwarks around the open wells.
    for (const [a, c, y] of [[50, 78, 18.8], [-88, -60, 18.8]]) {
      for (let x = a; x < c; x += 3) {
        const hw = TT.halfBeamAt(x + 1.5, y) - 0.45;
        b.solid(x + 1.5, y + 0.85, -hw, 3, 1.7, 0.32, P.hull);
        b.solid(x + 1.5, y + 0.85, hw, 3, 1.7, 0.32, P.hull);
      }
    }

    // ---- B-deck house; its roof is A deck, the promenade
    for (let x = -58; x < 52; x += 4) {
      const hw = TT.halfBeamAt(x + 2, 22) - 1.6;
      b.solid(x + 2, 23.0, -hw, 4, 2.8, 0.36, P.white);
      b.solid(x + 2, 23.0, hw, 4, 2.8, 0.36, P.white);
      glass.box(x + 2, 23.2, -hw + 0.22, 3.0, 1.3, 0.06, 0x25384d);
      glass.box(x + 2, 23.2, hw - 0.22, 3.0, 1.3, 0.06, 0x25384d);
    }
    weatherDeck(b, -58, 52, 24.4, P.teak, 1.6, false, aHoles);

    // ---- A-deck promenade house; its roof is the boat deck
    for (let x = -52; x < 48; x += 4) {
      const hw = TT.halfBeamAt(x + 2, 25) - 2.7;
      b.solid(x + 2, 25.8, -hw, 4, 2.8, 0.32, P.white);
      b.solid(x + 2, 25.8, hw, 4, 2.8, 0.32, P.white);
      if (x < 12) {                                    // forward half glazed in 1912
        glass.box(x + 2, 26.1, -hw + 0.2, 3.4, 1.6, 0.06, 0x2b3d52);
        glass.box(x + 2, 26.1, hw - 0.2, 3.4, 1.6, 0.06, 0x2b3d52);
      }
    }
    weatherDeck(b, -52, 48, 27.2, P.teak, 2.7, true, boatHoles);   // BOAT DECK

    // ---- navigating bridge, wheelhouse and wings
    b.solid(47.5, 28.9, 0, 1.0, 3.2, 21.0, P.white);               // forward screen
    glass.box(47.5, 29.5, 0, 0.9, 1.5, 20.6, 0x1b2b3d);
    b.solid(38.5, 28.9, 0, 1.0, 3.2, 13.0, P.white);               // after bulkhead
    b.solid(43, 28.9, -6.6, 10, 3.2, 1.0, P.white);
    b.solid(43, 28.9, 6.6, 10, 3.2, 1.0, P.white);
    b.box(43, 30.65, 0, 11.5, 0.32, 14.5, P.white);                // wheelhouse roof
    b.box(47.5, 30.65, 0, 2.5, 0.32, 21.5, P.white);
    for (const z of [-10.4, 10.4]) {                               // wing cabs
      b.solid(46, 28.9, z, 5.0, 3.2, 0.9, P.white);
      b.box(46, 30.65, z, 5.6, 0.3, 3.6, P.white);
    }

    // ---- boat-deck houses, as hollow shells you can walk into
    const HY = 27.25, HH = 3.3, ROOF = HY + HH + 0.15;

    // Officers' quarters, chart room and Marconi house. Fore and aft walls are
    // built by the deck layout, so only the sides belong here.
    houseWallX(b, 26, 38.6, -7.5, HY, HH, P.white);
    houseWallX(b, 26, 38.6, 7.5, HY, HH, P.white);
    b.box(32.3, ROOF, 0, 13.0, 0.3, 15.4, P.white);

    // Gymnasium.
    houseWallX(b, 11, 23, 11.5, HY, HH, P.white);
    houseWallZ(b, 3.5, 11.5, 23, HY, HH, P.white);
    b.box(17, ROOF, 7.5, 12.4, 0.3, 8.4, P.white);

    // Grand Staircase house. It must clear the whole stairwell — both lanes and
    // the full run — or it becomes a lid on the staircase.
    houseWallX(b, 14, 26.2, -10.5, HY, HH, P.white);
    houseWallX(b, 14, 26.2, 1.0, HY, HH, P.white, [[19.6, 22.4]]);
    houseWallZ(b, -10.5, 1.0, 14, HY, HH, P.white);
    b.box(20.1, ROOF, -4.75, 12.9, 0.3, 11.9, P.white);

    // First Class entrance and forward engine casing.
    houseWallX(b, -16, 2, -8.5, HY, HH, P.white);
    houseWallX(b, -16, 2, 8.5, HY, HH, P.white);
    houseWallZ(b, -8.5, 8.5, -16, HY, HH, P.white);
    b.box(-7, ROOF, 0, 18.4, 0.3, 17.4, P.white);

    // Second Class entrance, carried forward to x=-17 so it encloses the aft
    // staircase rather than cutting across it.
    houseWallX(b, -45, -17, -8, HY, HH, P.white);
    houseWallX(b, -45, -17, 8, HY, HH, P.white);
    houseWallZ(b, -8, 8, -45, HY, HH, P.white);
    houseWallZ(b, -8, 8, -17, HY, HH, P.white, [[-1.3, 1.3]]);
    b.box(-31, ROOF, 0, 28.4, 0.3, 16.4, P.white);

    // Grand Staircase dome over the forward staircase.
    const domeGeo = new THREE.SphereGeometry(3.3, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dm = new THREE.Matrix4();
    dm.compose(new THREE.Vector3(21, 30.5, -6), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    glass.custom(domeGeo, dm, 0x4a6a88);
    domeGeo.dispose();

    // ---- ventilators, hatches, derricks
    [[62, 18.8, -7.5], [62, 18.8, 7.5], [72, 22.0, -6], [72, 22.0, 6],
     [-70, 18.8, -7.5], [-70, 18.8, 7.5], [-98, 21.6, -6], [-98, 21.6, 6],
     [26, 27.2, -11], [26, 27.2, 11], [-16, 27.2, -12], [-16, 27.2, 12]]
      .forEach(([x, y, z]) => cowlVent(b, x, y, z, 3.4, z > 0 ? 1 : -1));

    for (const [x, y] of [[56, 18.8], [68, 22.0], [-66, 18.8], [-100, 21.6]]) {
      b.solid(x, y + 0.45, 0, 8, 0.9, 11, P.teakDark);
      for (const z of [-7.5, 7.5]) {
        b.cyl(x, y + 4, z, 0.36, 8, P.steel, null, 8);
        b.cyl(x + 4.2, y + 6.4, z, 0.22, 10, P.steel, { z: -1.05 }, 8);
      }
    }

    // Anchors laid in their bow pockets.
    for (const z of [-13.4, 13.4]) {
      b.box(118, 17.6, z, 3.6, 0.55, 0.55, P.steelDark);
      b.box(116.5, 17.6, z, 0.5, 0.5, 3.4, P.steelDark);
    }
    b.box(96, 22.6, 0, 4, 1.2, 4, P.steelDark);                    // capstan / windlass
    b.solid(-104, 22.7, 0, 3, 2.1, 12, P.white);                   // docking bridge
    b.box(-104, 23.85, 0, 3.4, 0.2, 12.6, P.white);

    // Aft docking / third-class railings on the poop.
    ext.add(b.mesh());
    ext.add(glass.mesh({ transparent: true, opacity: 0.45 }));

    // ---- funnels (the fourth was a dummy, venting the galleys)
    TT.funnels = [34, 8, -20, -46].map((x, i) => buildFunnel(ext, x, i === 3));

    // ---- masts
    TT.foreMast = buildMast(ext, 64, 26, true);
    buildMast(ext, -78, 22, false);

    // ---- twenty lifeboats: nowhere near enough for 2,224 souls
    const boats = [];
    [44, 36, 15, 6, -3, -12, -22, -32].forEach((x, i) => {
      boats.push(buildLifeboat(ext, x, 13.2, i * 2 + 1));    // starboard: odd numbers
      boats.push(buildLifeboat(ext, x, -13.2, i * 2 + 2));   // port: even numbers
    });
    TT.lifeboats = boats;

    // ---- screws and rudder
    const drive = new THREE.Group();
    const spins = [];
    for (const [x, z, r] of [[-126, -9.5, 3.9], [-124.5, 0, 2.7], [-126, 9.5, 3.9]]) {
      const sb = new TT.Batch("screw");
      sb.cyl(0, 0, 0, 0.65, 1.6, P.brass, { z: Math.PI / 2 }, 10);
      const blade = new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      const mm = new THREE.Matrix4();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        mm.compose(new THREE.Vector3(0, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55),
                   new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0, 0.35)),
                   new THREE.Vector3(0.45, r * 1.1, r * 1.6));
        sb.custom(blade, mm, P.brass);
      }
      blade.dispose();
      const g = new THREE.Group();
      g.add(sb.mesh());
      g.position.set(x, 4.6, z);
      drive.add(g);
      spins.push(g);
    }
    TT.propSpins = spins;

    const rb = new TT.Batch("rudder");
    rb.box(0, 0, 0, 3.4, 13, 0.8, P.hull);
    TT.rudderMesh = new THREE.Group();
    TT.rudderMesh.add(rb.mesh());
    TT.rudderMesh.position.set(-130.5, 6.5, 0);
    drive.add(TT.rudderMesh);
    ext.add(drive);

    TT.exterior = ext;
    return ext;
  };

})(window.TT);
