/* ============================================================================
   navigation.js — the bridge: wheel, engine telegraph, compass, and the
   dynamics of forty-six thousand tons that do not want to change direction.

   The turning figures here are the real ones. From "hard a-starboard" to the
   berg, Titanic had about 37 seconds and turned roughly two points. You will
   find she answers the helm exactly that slowly.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;
  const KTS_TO_MS = 0.514444;
  const TIME_SCALE = 340;              // 1 s of play ≈ 5.7 min of voyage

  const TELEGRAPH = [
    { label: "FULL ASTERN",  rpm: -55, order: "Full Astern"  },
    { label: "HALF ASTERN",  rpm: -35, order: "Half Astern"  },
    { label: "SLOW ASTERN",  rpm: -18, order: "Slow Astern"  },
    { label: "STOP",         rpm: 0,   order: "Stop"         },
    { label: "SLOW AHEAD",   rpm: 22,  order: "Slow Ahead"   },
    { label: "HALF AHEAD",   rpm: 48,  order: "Half Ahead"   },
    { label: "FULL AHEAD",   rpm: 75,  order: "Full Ahead"   },
    { label: "FULL AHEAD",   rpm: 83,  order: "Ahead Full — all boilers" }
  ];

  TT.nav = {
    state: {
      heading: 0,                // radians
      headingDeg: 266,           // shown on the compass card: S 86 W
      wheelAngle: 0,             // spokes turned, -1..1
      rudder: 0,                 // degrees, -35..35 (negative = to port)
      rudderOrdered: 0,
      telegraph: 6,
      telegraphLabel: "FULL AHEAD",
      rpm: 75,
      rpmTarget: 75,
      knots: 22.5,
      speedMS: 22.5 * KTS_TO_MS,
      boilerPressure: 215,
      coal: 100,
      stokersOn: true,
      milesRun: 0,
      milesTotal: 3000,
      timeScale: TIME_SCALE,        // drops sharply once she is holed
      clock: 23 * 3600 + 30 * 60,   // 23:30, 14 April 1912
      atHelm: false,
      wtDoorsClosed: false,
      warnings: 0,
      lookoutCalled: false,
      lastOrder: "Ahead full, steady as she goes"
    },
    events: []
  };

  const st = TT.nav.state;

  // ------------------------------------------------------------- bridge gear
  TT.buildBridge = function (root) {
    const y = 27.2;
    const g = new THREE.Group();

    // ---- the ship's wheel, in its teak binnacle stand
    const stand = new TT.Batch("helmstand");
    stand.box(0, 0.5, 0, 0.9, 1.0, 0.7, P.teakDark);
    stand.box(0, 1.05, 0, 1.0, 0.14, 0.8, P.panelWalnut);
    stand.cyl(0, 1.35, 0, 0.1, 0.6, P.brass, null, 10);
    const standM = stand.mesh();
    standM.position.set(43.6, y, 0);
    g.add(standM);
    TT.collision.addSolid(43.1, y, -0.4, 44.1, y + 1.2, 0.4);

    // The wheel stands athwartships, so the quartermaster faces forward through
    // it. Build it in the local XY plane, then swing the whole thing 90°.
    const wheelG = new THREE.Group();
    const wheelSpin = new THREE.Group();
    const wb = new TT.Batch("wheel");
    const ring = new THREE.TorusGeometry(0.62, 0.055, 8, 26);
    wb.custom(ring, new THREE.Matrix4(), 0x7a4a26);
    ring.dispose();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      wb.box(Math.cos(a) * 0.31, Math.sin(a) * 0.31, 0, 0.055, 0.62, 0.055, 0x7a4a26, { z: a });
      wb.box(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0, 0.05, 0.26, 0.05, 0x8a5a30, { z: a });
    }
    wb.cyl(0, 0, 0, 0.12, 0.16, P.brass, { x: Math.PI / 2 }, 12);
    wheelSpin.add(wb.mesh());
    wheelG.add(wheelSpin);
    wheelG.position.set(43.6, y + 1.55, 0);
    wheelG.rotation.y = Math.PI / 2;
    g.add(wheelG);
    TT.helmWheel = wheelSpin;

    // ---- compass binnacle
    const bn = new TT.Batch("binnacle");
    bn.cyl(0, 0.55, 0, 0.26, 1.1, P.teakDark, null, 12);
    bn.sphere(0, 1.22, 0, 0.3, P.brass, 0.26);
    bn.cyl(0, 1.34, 0, 0.24, 0.06, 0xf0e8d0, null, 14);
    const bnM = bn.mesh();
    bnM.position.set(45.8, y, 0);
    g.add(bnM);
    const card = new THREE.Group();
    const cb = new TT.Batch("card");
    cb.box(0, 0, 0.19, 0.05, 0.02, 0.16, 0xcc2222);
    cb.box(0, 0, -0.19, 0.05, 0.02, 0.16, 0x223344);
    card.add(cb.mesh());
    card.position.set(45.8, y + 1.38, 0);
    g.add(card);
    TT.compassCard = card;

    // ---- engine order telegraphs, port and starboard
    TT.telegraphHandles = [];
    for (const z of [-2.4, 2.4]) {
      const tb = new TT.Batch("telegraph");
      tb.cyl(0, 0.6, 0, 0.2, 1.2, P.brass, null, 12);
      tb.cyl(0, 1.32, 0, 0.42, 0.34, P.brass, null, 16);
      tb.cyl(0, 1.32, 0, 0.36, 0.38, 0xf4ecd4, null, 16);
      const tm = tb.mesh();
      tm.position.set(45.2, y, z);
      g.add(tm);
      TT.collision.addSolid(44.9, y, z - 0.3, 45.5, y + 1.5, z + 0.3);
      const handle = new THREE.Group();
      const hb = new TT.Batch("tgh");
      hb.box(0, 0.22, 0, 0.05, 0.44, 0.05, 0x2a2018);
      hb.sphere(0, 0.46, 0, 0.055, 0x2a2018);
      handle.add(hb.mesh());
      handle.position.set(45.2, y + 1.32, z);
      g.add(handle);
      TT.telegraphHandles.push(handle);
    }

    // ---- watertight door switch on the bridge front
    const sw = new TT.Batch("wtswitch");
    sw.box(0, 0.35, 0, 0.16, 0.7, 0.5, 0x3a2a1a);
    sw.cyl(0.1, 0.5, 0, 0.09, 0.14, 0xcc3322, { z: Math.PI / 2 }, 10);
    const swM = sw.mesh();
    swM.position.set(46.9, y + 1.0, -4.2);
    g.add(swM);

    root.add(g);

    // ---------------------------------------------------------- interactions
    TT.interact(43.6, y + 1.5, 0, "Ship's wheel", "Take the helm", () => {
      st.atHelm = !st.atHelm;
      TT.ui.say(st.atHelm
        ? "You have the helm. Steer with ← and →. She answers slowly — give her time."
        : "You step back from the wheel. The quartermaster holds your last order.");
    }, 3.0);

    TT.interact(45.2, y + 1.4, 2.4, "Engine order telegraph", "Ring down an order", () => {
      TT.ui.openTelegraph();
    }, 2.2);

    TT.interact(45.8, y + 1.4, 0, "Compass binnacle", "Read the compass", () => {
      TT.ui.say("Steering " + TT.nav.compassText() + ". "
        + "Course for the Ambrose Light, New York — " + Math.round(st.milesTotal - st.milesRun)
        + " nautical miles to run.");
    }, 2.2);

    TT.interact(46.9, y + 1.4, -4.2, "Watertight door switch",
      "Throw the watertight door switch", () => {
        TT.setWatertightDoors(!st.wtDoorsClosed);
      }, 2.4);

    TT.interact(40.5, y + 1.0, 4.5, "Chart table", "Study the chart", () => {
      TT.ui.showChart();
    }, 2.4);

    // The Marconi set, one deck house aft.
    TT.interact(35.4, y + 1.4, 5.2, "Marconi wireless set", "Read the message traffic", () => {
      TT.ui.showTelegrams();
    }, 2.6);
  };

  // --------------------------------------------------------- watertight doors
  TT.setWatertightDoors = function (closed) {
    st.wtDoorsClosed = closed;
    for (const d of TT.watertightDoors) d.closed = closed;
    TT.ui.say(closed
      ? "The switch is thrown. Alarm bells ring below, and every watertight door on the "
        + "tank top slides shut. She is divided into sixteen compartments — she will float "
        + "with any two of them open, or the first four."
      : "The watertight doors are raised. The tank top is open end to end again.");
    TT.audio.blip(closed ? 320 : 220, 0.5);
  };

  // ------------------------------------------------------------- compass text
  TT.nav.compassText = function () {
    let d = ((st.headingDeg % 360) + 360) % 360;
    const pts = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW",
                 "WSW", "W", "WNW", "NW", "NNW"];
    return d.toFixed(0).padStart(3, "0") + "° (" + pts[Math.round(d / 22.5) % 16] + ")";
  };

  // ---------------------------------------------------------------- telegraph
  TT.nav.setTelegraph = function (i) {
    i = TT.clamp(i, 0, TELEGRAPH.length - 1);
    st.telegraph = i;
    const t = TELEGRAPH[i];
    st.telegraphLabel = t.label;
    st.rpmTarget = t.rpm;
    st.lastOrder = t.order;
    for (const h of TT.telegraphHandles) h.rotation.x = (i / (TELEGRAPH.length - 1) - 0.5) * 2.2;
    TT.ui.say('Rung down to the engine room: "' + t.order + '."');
    TT.audio.telegraph();
    TT.bus.emit("telegraph", t);
  };
  TT.nav.TELEGRAPH = TELEGRAPH;

  // --------------------------------------------------------------- the clock
  TT.nav.clockText = function () {
    const s = Math.floor(st.clock) % 86400;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  };

  // ------------------------------------------------------------------ update
  TT.nav.update = function (dt, keys) {
    const w = TT.world;

    // ---- helm input
    let steer = 0;
    if (keys.ArrowLeft) steer -= 1;
    if (keys.ArrowRight) steer += 1;
    if (steer !== 0) {
      st.wheelAngle = TT.clamp(st.wheelAngle + steer * dt * 0.85, -1, 1);
    } else if (keys.KeyR) {
      st.wheelAngle *= (1 - dt * 2.2);          // midships
    }
    st.rudderOrdered = st.wheelAngle * 35;
    // The steering engine takes its time moving 78 tons of rudder.
    const rudRate = 2.6;
    const dr = st.rudderOrdered - st.rudder;
    st.rudder += TT.clamp(dr, -rudRate * dt * 12, rudRate * dt * 12);

    // ---- engines
    const spool = st.rpmTarget > st.rpm ? 5.5 : 9.0;    // slower to build than to shed
    st.rpm += TT.clamp(st.rpmTarget - st.rpm, -spool * dt * 6, spool * dt * 6);

    // Boiler pressure follows demand and the state of the fires.
    const demand = Math.abs(st.rpm) / 80;
    const target = st.stokersOn ? 215 - demand * 12 : 120;
    st.boilerPressure += (target - st.boilerPressure) * Math.min(1, dt * 0.35);
    if (st.stokersOn) st.coal = Math.max(0, st.coal - dt * demand * 0.045);
    if (st.coal <= 0) { st.rpmTarget = Math.min(st.rpmTarget, 18); st.stokersOn = false; }

    // Speed lags the screws badly: she is very heavy and very slippery.
    const listDrag = 1 - (TT.dmg ? TT.dmg.floodFraction() * 0.55 : 0);
    // A ninety-second time constant: rung to Stop from full speed she still
    // carries eleven knots a minute later, and runs on for miles.
    const kTarget = (st.rpm / 75) * 22.5 * listDrag;
    st.knots += (kTarget - st.knots) * Math.min(1, dt * 0.012);
    if (Math.abs(st.knots) < 0.05) st.knots = 0;
    st.speedMS = st.knots * KTS_TO_MS;

    // ---- turning. Rate is proportional to rudder angle AND to speed through
    // the water: with no way on, the rudder does nothing at all.
    const speedFactor = TT.clamp(Math.abs(st.knots) / 22.5, 0, 1.2);
    const rateDeg = (st.rudder / 35) * speedFactor * 0.44 * (st.knots < 0 ? -1 : 1);
    st.headingDeg += rateDeg * dt * 3.0;      // ~1.3°/s hard over at full speed
    st.headingDeg = ((st.headingDeg % 360) + 360) % 360;
    w.heading = -st.headingDeg * Math.PI / 180;

    // ---- distance run and the ship's clock
    st.clock += dt * st.timeScale;
    if (st.knots > 0) st.milesRun += st.knots * (dt * st.timeScale / 3600);

    // ---- instrument animation
    if (TT.helmWheel) TT.helmWheel.rotation.z = -st.wheelAngle * 2.6;
    if (TT.compassCard) TT.compassCard.rotation.y = st.headingDeg * Math.PI / 180;
    if (TT.rudderMesh) TT.rudderMesh.rotation.y = -st.rudder * Math.PI / 180 * 0.9;

    TT.animateMachinery(dt, TT.clamp(Math.abs(st.rpm) / 75, 0, 1.4));

    // Furnace glow tracks how hard the fires are being driven.
    const fire = st.stokersOn ? 0.65 + demand * 0.35 : 0.15;
    for (const gmesh of TT.furnaceGlows) {
      gmesh.material.opacity = fire;
      gmesh.visible = fire > 0.05;
    }

    return { speedMS: st.speedMS };
  };

  // -------------------------------------------------------------- ice & watch
  const ICE_WARNINGS = [
    { at: 40,  from: "SS Caronia",    text: "Westbound steamers report bergs, growlers and field ice in 42°N, from 49° to 51°W. April 12." },
    { at: 200, from: "SS Baltic",     text: "Greek steamer Athenai reports passing icebergs and large quantities of field ice today in 41°51'N, 49°52'W." },
    { at: 420, from: "SS Amerika",    text: "Amerika passed two large icebergs in 41°27'N, 50°8'W." },
    { at: 640, from: "SS Mesaba",     text: "Ice report: in latitude 42°N to 41°25', longitude 49° to 50°30'W. Saw much heavy pack ice and great number large icebergs. Also field ice. Weather good, clear." },
    { at: 790, from: "SS Californian", text: "Say old man, we are stopped and surrounded by ice." }
  ];

  TT.nav.telegrams = [];
  let warnIdx = 0;
  let iceSeeded = 0;

  TT.nav.updateVoyage = function (dt) {
    // Marconi traffic arrives as the miles run up.
    while (warnIdx < ICE_WARNINGS.length && st.milesRun >= ICE_WARNINGS[warnIdx].at) {
      const w = ICE_WARNINGS[warnIdx++];
      TT.nav.telegrams.push(w);
      st.warnings++;
      TT.ui.wireless(w.from, w.text);
      TT.audio.blip(1400, 0.08);
      if (TT.game.phase === "calm") TT.game.phase = "warned";
    }

    // The ice field itself. It thickens as you close the Grand Banks.
    const density = st.milesRun < 500 ? 0
                  : st.milesRun < 760 ? 0.35
                  : st.milesRun < 1300 ? 1.0
                  : 0.45;
    if (density > 0 && TT.world.bergs.length < 26 + density * 20) {
      if (Math.random() < dt * density * 0.9) {
        TT.seedIceField(1500, 4200, 1, 1500);
        iceSeeded++;
      }
    }

    // The lookouts. No binoculars — the glasses were left behind at Southampton,
    // so on a moonless night nothing is seen until it is very nearly too late.
    // They only sing out for ice that is genuinely going to hit her.
    if (!st.lookoutCalled) {
      for (const b of TT.world.bergs) {
        if (b.hit || b.called || b.relFwd === undefined) continue;
        if (b.relFwd < 40 || b.relFwd > 950) continue;
        const beam = TT.halfBeamAt(0, 8) + b.radius + 45;
        if (Math.abs(b.relStb) > beam) continue;
        st.lookoutCalled = true;
        b.called = true;
        TT.audio.bell(3);
        TT.ui.lookout(b.growler ? "GROWLER, FINE ON THE BOW!" : "ICEBERG, RIGHT AHEAD!");
        if (TT.player.pos.y < 24)
          setTimeout(() => TT.ui.flash(
            "Three bells, and you are " + Math.round(27.2 - TT.player.pos.y)
            + " metres below the bridge.", "#ff8a5a"), 1200);
        setTimeout(() => { st.lookoutCalled = false; }, 7000);
        break;
      }
    }
  };

  TT.nav.timeScale = TIME_SCALE;

})(window.TT);
