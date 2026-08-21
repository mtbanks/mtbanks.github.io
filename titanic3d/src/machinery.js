/* ============================================================================
   machinery.js — the tank top: six boiler rooms, the coal bunkers, the two
   reciprocating engines, the low-pressure turbine and the shaft tunnel.
   This is the loudest, hottest, most alive part of the ship.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;
  const MACH_X0 = -88, MACH_X1 = 52;      // extent of the machinery spaces
  const HEAD_Y = 10.4;                    // F deck sole forms the deckhead

  // Boiler rooms are numbered from aft forward: BR1 nearest the engines.
  const BOILER_ROOMS = [
    { n: 6, x0: 34,  x1: 50,  boilers: 5, doubleEnded: true },
    { n: 5, x0: 18,  x1: 34,  boilers: 5, doubleEnded: true },
    { n: 4, x0: 2,   x1: 18,  boilers: 5, doubleEnded: true },
    { n: 3, x0: -14, x1: 2,   boilers: 5, doubleEnded: true },
    { n: 2, x0: -30, x1: -14, boilers: 5, doubleEnded: true },
    { n: 1, x0: -48, x1: -30, boilers: 5, doubleEnded: false }
  ];
  TT.BOILER_ROOMS = BOILER_ROOMS;

  TT.furnaceGlows = [];     // meshes dimmed as fires are drawn or drowned
  TT.engineAnim = null;

  // ------------------------------------------------------------------ boilers
  function buildBoiler(c, x, z, doubleEnded) {
    const y = c.y;
    const b = c.b, glow = c.glow;
    const R = 2.35, L = 6.0, cy = y + R + 0.45;

    // Shell, riveted bands, and the saddles it sits on.
    b.cyl(x, cy, z, R, L, 0x2b2724, { z: Math.PI / 2 }, 16);
    TT.collision.addSolid(x - L / 2, y, z - R, x + L / 2, cy + R, z + R);
    for (const dx of [-2.2, -0.75, 0.75, 2.2])
      b.cyl(x + dx, cy, z, R + 0.09, 0.28, 0x1e1b19, { z: Math.PI / 2 }, 16);
    b.box(x, y + 0.22, z, L + 0.6, 0.45, R * 1.7, P.steelDark);

    // Furnace doors: three abreast at each end of a double-ended boiler.
    const ends = doubleEnded ? [-1, 1] : [1];
    for (const s of ends) {
      const fx = x + s * (L / 2 + 0.06);
      for (const dz of [-1.25, 0, 1.25]) {
        b.cyl(fx, y + 1.05, z + dz, 0.42, 0.16, 0x14110f, { z: Math.PI / 2 }, 10);
        const g = new THREE.Mesh(
          new THREE.CircleGeometry(0.33, 12),
          new THREE.MeshBasicMaterial({ color: 0xff6a10 })
        );
        g.position.set(fx + s * 0.1, y + 1.05, z + dz);
        g.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        c.group.add(g);
        TT.furnaceGlows.push(g);
        TT.lightPool.add(fx + s * 0.9, y + 1.1, z + dz, 0xff5a10, 0.7, 7);
      }
      // Fire-door handles and the ash pit below.
      b.box(fx + s * 0.2, y + 0.15, z, 0.5, 0.3, 4.2, 0x1a1614);
    }

    // Steam pipes off the top, heading for the uptake.
    b.cyl(x, cy + R + 0.7, z, 0.34, 1.5, 0x4a4238, null, 10);
    b.cyl(x, cy + R + 1.4, z * 0.4, 0.28, Math.abs(z) * 0.65 + 0.5, 0x4a4238,
          { x: Math.PI / 2 }, 8);
  }

  function buildBoilerRoom(c, room) {
    const y = c.y;
    const b = c.b;
    const xm = (room.x0 + room.x1) / 2;

    c.room(room.x0, -12, room.x1, 12, "Boiler Room No. " + room.n, "machinery");

    // Steel floor plates over the double bottom.
    b.custom(TT.soleGeometry(y, room.x0, room.x1, 1.2, null, 3), new THREE.Matrix4(), 0x35373a);
    for (let x = room.x0 + 1; x < room.x1; x += 2)
      b.box(x, y + 0.02, 0, 1.8, 0.03, 22, 0x2a2c2f);

    // Five boilers abreast.
    const zs = [-9.4, -4.7, 0, 4.7, 9.4];
    for (const z of zs) buildBoiler(c, xm, z, room.doubleEnded);

    // The uptake trunks carrying smoke to the funnel above. They must stop at
    // the deckhead — any taller and they spear up through F deck.
    const upH = (HEAD_Y - 0.2) - (y + 6.4);
    b.cyl(xm, y + 6.4 + upH / 2, 0, 1.6, upH, 0x33302c, null, 12);
    b.cyl(xm, y + 6.4 + upH / 2, -6.5, 1.1, upH, 0x33302c, null, 10);
    b.cyl(xm, y + 6.4 + upH / 2, 6.5, 1.1, upH, 0x33302c, null, 10);

    // Coal bunkers against the transverse bulkheads, port and starboard.
    for (const bx of [room.x0 + 1.6, room.x1 - 1.6]) {
      for (const s of [-1, 1]) {
        b.solid(bx, y + 2.2, s * 12.0, 2.6, 4.4, 4.5, 0x1a1a1e);
        // Loose coal spilling out onto the plates.
        for (let i = 0; i < 5; i++)
          b.sphere(bx + TT.srandRange(-1, 1), y + 0.25, s * (9.6 + TT.srandRange(-0.6, 0.6)),
                   TT.srandRange(0.25, 0.5), P.coal, 0.35);
      }
    }

    // Working lights: caged bulbs slung low over the stokehold plates.
    for (const z of [-11, -4.7, 4.7, 11]) {
      c.lampAt(room.x0 + 3.2, y + 3.3, z, 0xc8dcee, 0.95, 17);
      c.lampAt(room.x1 - 3.2, y + 3.3, z, 0xc8dcee, 0.95, 17);
    }
    c.lampAt(xm, y + 3.6, 0, 0xbfd4e8, 0.7, 14);

    // Stokers work the fires from the stokeholds at either end.
    c.spawn(room.x0 + 3.0, 0, "stoker", 3);
    c.spawn(room.x1 - 3.0, 0, "stoker", 3);
    c.spawn(room.x0 + 3.0, 8, "trimmer", 2);

    // Pressure gauge board — reads live boiler pressure.
    const gauge = new THREE.Group();
    const gb = new TT.Batch("gaugeboard");
    gb.box(0, 0, 0, 0.2, 1.6, 2.4, 0x2a2620);
    gauge.add(gb.mesh());
    gauge.position.set(room.x1 - 0.9, y + 1.8, -11.4);
    c.group.add(gauge);
    TT.interact(room.x1 - 1.4, y + 1.8, -11.4, "Boiler Room " + room.n + " gauge board",
      "Read the gauges", () => {
        const st = TT.nav.state;
        TT.ui.say("Boiler Room " + room.n + " — steam " + st.boilerPressure.toFixed(0)
          + " lb/in². " + (st.stokersOn ? "Fires drawn hard; all furnaces lit."
                                        : "Fires banked.")
          + " Coal remaining " + Math.round(st.coal) + "%.");
      }, 2.6);
  }

  // ---------------------------------------------------- reciprocating engines
  function buildRecipEngine(c, z, side) {
    const y = c.y;
    const b = c.b;
    const xm = -57;
    const group = new THREE.Group();
    const anim = { rods: [], crank: null, phase: side > 0 ? 0 : Math.PI / 2 };

    // Bedplate and the columns that carry the cylinders.
    b.solid(xm, y + 0.6, z, 15.0, 1.2, 6.4, 0x2f3338);
    for (const cx of [-5.4, -1.8, 1.8, 5.4])
      for (const cz of [-2.6, 2.6]) {
        b.cyl(xm + cx, y + 4.4, z + cz, 0.42, 6.6, 0x3d434c, null, 10);
        b.box(xm + cx, y + 1.4, z + cz, 1.2, 0.5, 1.2, 0x3d434c);
      }

    // The four cylinders: HP, IP and two LP, biggest last.
    const cylSpec = [[-5.4, 1.05, "HP"], [-1.8, 1.55, "IP"], [1.8, 1.95, "LP"], [5.4, 1.95, "LP"]];
    for (const [cx, r] of cylSpec) {
      b.cyl(xm + cx, y + 8.4, z, r, 2.6, 0x4a5058, null, 14);
      b.cyl(xm + cx, y + 9.75, z, r + 0.16, 0.35, 0x2f3338, null, 14);
      b.cyl(xm + cx, y + 7.05, z, r + 0.14, 0.3, 0x2f3338, null, 14);
      TT.collision.addSolid(xm + cx - r, y, z - r, xm + cx + r, y + 10, z + r);
    }

    // Piston rods and crossheads — these move.
    cylSpec.forEach(([cx], i) => {
      const rod = new THREE.Group();
      const rb = new TT.Batch("rod");
      rb.cyl(0, 0, 0, 0.22, 4.2, 0xa8aeb6, null, 8);
      rb.box(0, -2.1, 0, 1.1, 0.6, 1.5, 0x6a7078);
      rod.add(rb.mesh());
      rod.position.set(xm + cx, y + 4.8, z);
      group.add(rod);
      anim.rods.push({ mesh: rod, base: y + 4.8, phase: i * Math.PI / 2 });
    });

    // Crankshaft with a big flywheel-like web, turning below.
    const crank = new THREE.Group();
    const cb = new TT.Batch("crank");
    cb.cyl(0, 0, 0, 0.55, 14.0, 0x8a9098, { z: Math.PI / 2 }, 12);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      cb.box(-5.4 + i * 3.6, Math.cos(a) * 0.95, Math.sin(a) * 0.95, 1.0, 1.9, 0.55, 0x6a7078,
             { x: -a });
    }
    crank.add(cb.mesh());
    crank.position.set(xm, y + 1.9, z);
    group.add(crank);
    anim.crank = crank;

    // Starting platform, throttle wheel and the telegraph repeater.
    b.solid(xm - 8.6, y + 2.6, z, 2.2, 0.2, 6.0, 0x555b62);
    for (let i = 0; i < 6; i++) b.box(xm - 8.6, y + 0.3 + i * 0.42, z + 3.2, 1.8, 0.1, 0.3, 0x555b62);
    b.cyl(xm - 8.9, y + 3.6, z - 1.4, 0.7, 0.16, P.brass, { z: Math.PI / 2 }, 14);
    b.cyl(xm - 8.9, y + 3.4, z + 1.4, 0.42, 0.9, P.brass, null, 12);

    c.group.add(group);
    c.spawn(xm - 8.6, z, "engineer", 2);
    return anim;
  }

  function buildEngineRoom(c) {
    const y = c.y;
    const b = c.b;
    c.room(-70, -13, -46, 13, "Reciprocating Engine Room", "machinery");

    b.custom(TT.soleGeometry(y, -70, -46, 1.2, null, 3), new THREE.Matrix4(), 0x35373a);

    TT.engineAnim = [buildRecipEngine(c, 6.5, 1), buildRecipEngine(c, -6.5, -1)];

    // Condensers, pumps and the maze of steam piping.
    for (const z of [-12, 12]) {
      b.solid(-52, y + 1.6, z, 9.0, 3.2, 2.6, 0x3a4048);
      b.cyl(-62, y + 2.0, z, 0.9, 5.0, 0x4a5058, { z: Math.PI / 2 }, 10);
    }
    for (let x = -68; x < -48; x += 4)
      b.cyl(x, y + 9.6, 0, 0.3, 2.0, 0x5a6068, { x: Math.PI / 2 }, 8);

    for (const z of [-12, -6.5, 0, 6.5, 12]) {
      c.lampAt(-50, y + 3.4, z, 0xcfe0f0, 0.95, 18);
      c.lampAt(-58, y + 6.2, z, 0xcfe0f0, 0.8, 18);
      c.lampAt(-67, y + 3.4, z, 0xcfe0f0, 0.95, 18);
    }

    // Engine order telegraph repeater — shows what the bridge has rung down.
    TT.interact(-66, y + 2.0, 0, "Engine order telegraph (repeater)",
      "Check the telegraph", () => {
        TT.ui.say('Repeater reads "' + TT.nav.state.telegraphLabel + '". '
          + "Shaft revolutions " + Math.round(TT.nav.state.rpm) + " per minute.");
      }, 3.0);
  }

  // ------------------------------------------------------------- turbine room
  function buildTurbineRoom(c) {
    const y = c.y;
    const b = c.b;
    c.room(-88, -13, -70, 13, "Turbine Engine Room", "machinery");
    b.custom(TT.soleGeometry(y, -88, -70, 1.2, null, 3), new THREE.Matrix4(), 0x35373a);

    // One enormous Parsons low-pressure turbine on the centre shaft.
    b.solid(-79, y + 3.6, 0, 13.0, 5.6, 6.4, 0x454b53);
    b.cyl(-79, y + 3.6, 0, 3.2, 13.0, 0x51575f, { z: Math.PI / 2 }, 16);
    for (const dx of [-4.5, -1.5, 1.5, 4.5])
      b.cyl(-79 + dx, y + 3.6, 0, 3.35, 0.4, 0x35393f, { z: Math.PI / 2 }, 16);
    TT.collision.addSolid(-86, y, -3.6, -72, y + 7.0, 3.6);
    for (const z of [-9, 9]) {
      b.solid(-79, y + 1.4, z, 8.0, 2.8, 3.0, 0x3a4048);
      c.lampAt(-74, y + 3.4, z, 0xcfe0f0, 0.95, 18);
      c.lampAt(-84, y + 3.4, z, 0xcfe0f0, 0.95, 18);
    }
    c.spawn(-74, 8, "engineer", 2);

    TT.interact(-72, y + 1.7, 0, "Low-pressure turbine",
      "Inspect the turbine", () => {
        TT.ui.say("The centre screw is driven by a Parsons turbine running on the exhaust "
          + "steam from both reciprocating engines. It turns ahead only — it cannot be reversed.");
      }, 3.4);
  }

  // -------------------------------------------------------------- shaft tunnel
  function buildShaftTunnel(c) {
    const y = c.y;
    const b = c.b;
    c.room(-114, -11, -88, 11, "Shaft Tunnel", "machinery");
    b.custom(TT.soleGeometry(y, -114, -88, 1.2, null, 3), new THREE.Matrix4(), 0x35373a);
    const shafts = [];
    for (const z of [-9.5, 0, 9.5]) {
      const g = new THREE.Group();
      const sb = new TT.Batch("shaft");
      sb.cyl(0, 0, 0, 0.55, 26, 0x8a9098, { z: Math.PI / 2 }, 10);
      for (let i = -4; i <= 4; i++) sb.box(i * 3, 0, 0, 0.4, 1.3, 1.3, 0x6a7078);
      g.add(sb.mesh());
      g.position.set(-101, y + 1.5, z);
      c.group.add(g);
      shafts.push(g);
      // Plummer blocks holding the shaft up.
      for (let x = -112; x < -90; x += 5) b.solid(x, y + 0.7, z, 1.6, 1.4, 2.2, 0x3a4048);
    }
    TT.shaftSpins = shafts;
    for (const z of [-9.5, 0, 9.5])
      for (const x of [-94, -101, -109]) c.lampAt(x, y + 3.0, z, 0xbfd0e0, 0.8, 14);
    c.spawn(-95, 5, "engineer", 1);
  }

  // ================================================================== assemble
  TT.buildMachinery = function (c, ctxs) {
    c.h = HEAD_Y - c.y;                    // one tall space, tank top to F deck
    const y = c.y;
    const b = c.b;

    for (const room of BOILER_ROOMS) buildBoilerRoom(c, room);
    buildEngineRoom(c);
    buildTurbineRoom(c);
    buildShaftTunnel(c);

    // ---- transverse watertight bulkheads with their sliding doors
    const bulkheads = [50, 34, 18, 2, -14, -30, -48, -70, -88];
    for (let i = 0; i < bulkheads.length; i++) {
      const x = bulkheads[i];
      const hw = TT.halfBeamAt(x, y + 3) - 1.2;
      c.wallZ(-hw, hw, x, P.rust, [[-1.6, 1.6]], c.h);
      c.watertightDoor(x, -1.6, 1.6, "tank-" + i);
    }

    // ---- deckhead over the machinery, and the shell liner
    const head = TT.soleGeometry(HEAD_Y - 0.09, MACH_X0 - 30, MACH_X1 + 18, 1.2, null, 3, true);
    b.custom(head, new THREE.Matrix4(), 0x2a2c30);
    head.dispose();
    for (let x = -116; x < 60; x += 6) {
      const hw = TT.halfBeamAt(x + 3, y + 2) - 1.1;
      if (hw < 1) continue;
      b.box(x + 3, y + c.h / 2, -hw, 6, c.h, 0.16, P.rust);
      b.box(x + 3, y + c.h / 2, hw, 6, c.h, 0.16, P.rust);
      TT.collision.addSolid(x, y, -hw - 0.4, x + 6, y + c.h, -hw + 0.1);
      TT.collision.addSolid(x, y, hw - 0.1, x + 6, y + c.h, hw + 0.4);
    }

    // ---- the engine room and boiler rooms are open to F deck: rail the well
    if (ctxs && ctxs.f) {
      const f = ctxs.f;
      f.hole(-70, -9, -46, 9, { well: true });
      f.room(-72, -11, -44, 11, "Engine Room Gallery", "machinery");
      f.railWell(-70.2, -9.2, -45.8, 9.2, P.steel);
      for (const z of [-9.2, 9.2]) f.b.box(-58, f.y + 1.05, z, 24.4, 0.1, 0.14, P.steel);
      f.lamp(-58, -10.6, 0xcfe0f0, 0.6, 10);
    }

    // ---- Chief Engineer Bell's station
    TT.interact(-46, y + 1.6, 0, "Engine room log", "Read the log", () => {
      TT.ui.say("Chief Engineer Joseph Bell's log: 159 furnaces lit across five boiler "
        + "rooms. Boiler Room 1 remains banked. Steam for 21 knots and better.");
    }, 3.0);
  };

  // ------------------------------------------------------------------ animate
  TT.animateMachinery = function (dt, rpmFrac) {
    if (TT.engineAnim) {
      for (const e of TT.engineAnim) {
        e.phase += dt * rpmFrac * 7.5;
        for (const r of e.rods)
          r.mesh.position.y = r.base + Math.sin(e.phase + r.phase) * 1.15;
        if (e.crank) e.crank.rotation.x = e.phase;
      }
    }
    if (TT.shaftSpins)
      for (const s of TT.shaftSpins) s.rotation.x += dt * rpmFrac * 9;
    if (TT.propSpins)
      for (const s of TT.propSpins) s.rotation.x += dt * rpmFrac * 7;
  };

})(window.TT);
