/* ============================================================================
   damage.js — contact with the ice, and everything that follows from it.

   Titanic was built to float with any two of her sixteen compartments open to
   the sea, or with the first four. The berg opened six. The bulkheads only ran
   up to E deck, so once she settled by the head the water simply brimmed over
   the top of one bulkhead into the next compartment, like filling an ice tray.
   That failure is modelled here directly.
   ========================================================================== */
(function (TT) {
  "use strict";

  const C = TT.COMPARTMENTS;
  const BULKHEAD_TOP = 13.2;          // E deck: how high the bulkheads reach

  TT.dmg = {
    struck: false,
    sinkDepth: 0,
    pitch: 0,                          // radians, + = bow down
    list: 0,                           // radians, + = list to starboard
    lightsOut: false,
    power: 1,
    breakupT: 0,
    foundered: false,
    contact: null,
    souls: TT.SHIP.SOULS,
    saved: 0,
    boatsAway: 0,
    waterMeshes: []
  };

  const D = TT.dmg;

  // ------------------------------------------------------------ flood volumes
  C.forEach(c => {
    c.len = c.x1 - c.x0;
    // Rough volumetric capacity, tapering at the ends of the ship.
    const hw = TT.halfBeamAt((c.x0 + c.x1) / 2, 6);
    c.capacity = c.len * hw * 2 * 10.0;
    c.water = 0;
    c.breachSize = 0;
  });

  D.floodFraction = function () {
    let w = 0, cap = 0;
    for (const c of C) { w += c.water; cap += c.capacity; }
    return cap > 0 ? w / cap : 0;
  };
  D.floodedCount = function () {
    let n = 0;
    for (const c of C) if (c.water / c.capacity > 0.25) n++;
    return n;
  };

  // --------------------------------------------------------------- water film
  /** A translucent plane per compartment, rising as she fills. */
  TT.buildFloodWater = function (root) {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x1d4a63, transparent: true, opacity: 0.72,
      emissive: 0x061520, side: THREE.DoubleSide, depthWrite: false
    });
    for (const c of C) {
      const hw = TT.halfBeamAt((c.x0 + c.x1) / 2, 8) - 0.8;
      if (hw < 1) { D.waterMeshes.push(null); continue; }
      const g = new THREE.PlaneGeometry(c.len, hw * 2);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set((c.x0 + c.x1) / 2, -50, 0);
      m.visible = false;
      m.renderOrder = 2;
      root.add(m);
      D.waterMeshes.push(m);
    }
  };

  // ---------------------------------------------------------------- collision
  const HULL_MARGIN = 1.5;

  TT.checkIceCollision = function (dt) {
    const st = TT.nav.state;
    for (const b of TT.world.bergs) {
      if (b.hit || b.relFwd === undefined) continue;
      if (b.relFwd > 150 || b.relFwd < -150) continue;

      const hw = TT.halfBeamAt(TT.clamp(b.relFwd, TT.SHIP.STERN_X, TT.SHIP.BOW_X), 8);
      const clearance = Math.abs(b.relStb) - b.radius - hw;
      if (clearance > 0) {
        if (clearance < 22 && !b.nearMissed && b.relFwd < 40) {
          b.nearMissed = true;
          TT.game.nearMisses++;
          TT.ui.flash("Cleared her by " + clearance.toFixed(0) + " metres.", "#9fd8f0");
          TT.audio.rumble(0.5, 1.4);
        }
        continue;
      }

      b.hit = true;
      const speed = Math.abs(st.knots);
      const side = b.relStb > 0 ? 1 : -1;
      // A glancing blow along the side opens a long seam; a square hit crushes
      // the bow. Anything under about six knots merely bumps her.
      const glancing = Math.abs(b.relStb) > hw * 0.55;
      TT.applyIceDamage(b.relFwd, side, speed, b.size, glancing);
      return;
    }
  };

  TT.applyIceDamage = function (contactX, side, knots, bergSize, glancing) {
    const st = TT.nav.state;
    if (knots < 3 && bergSize < 10) {
      TT.ui.flash("A growler bumps along the plating. No damage.", "#9fd8f0");
      TT.audio.rumble(0.8, 2.0);
      return;
    }

    // Severity: how much steel is opened. Scaled by speed and berg mass.
    // The real gash ran about 90 m along the starboard bow and its total open
    // area was only some 1.1 m² — but it crossed six compartments.
    const energy = (knots / 22.5) * (bergSize / 24);
    const seamLength = TT.clamp(glancing ? energy * 105 : energy * 46, 6, 110);
    const maxComp = Math.round(TT.clamp(seamLength / 18, 1, 8));

    // The seam runs AFT from the point of contact. Compartments are indexed
    // stern-to-bow, so walk down the array from wherever she was touched.
    let start = compartmentIndexAt(TT.clamp(contactX, C[0].x0, C[C.length - 1].x1 - 0.1));
    if (start < 0) start = C.length - 1;
    const breached = [];
    for (let i = start; i >= 0 && breached.length < maxComp; i--) {
      const c = C[i];
      if (c.x1 < contactX - seamLength) break;
      c.breached = true;
      c.breachSize = TT.clamp(energy * (glancing ? 0.6 : 1.15), 0.12, 1.6);
      breached.push(c);
    }

    D.struck = true;
    D.contact = { x: contactX, side, knots, glancing, compartments: breached.length };
    TT.game.phase = "struck";
    TT.game.strikeClock = TT.nav.state.clock;
    st.timeScale = 14;                      // the sinking plays out near real time

    TT.audio.impact();
    TT.shakeFor(4.5, 1.0);

    const sideName = side > 0 ? "starboard" : "port";
    TT.ui.impact(breached.length, sideName, knots, glancing);
    TT.bus.emit("struck", D.contact);

    // Word travels: the engine room knows first.
    setTimeout(() => TT.ui.flash("Below: the sound of water coming in.", "#e8b060"), 2500);
    setTimeout(() => {
      TT.ui.andrews(breached.length);
      TT.npcSayAll();
    }, 9000);
  };

  TT.npcSayAll = function () {
    TT.npcs.forEach(n => { if (n.behavior === "wander") n.wait = 0; });
    TT.musterToBoats();
  };

  // ------------------------------------------------------------------ flooding
  TT.updateFlooding = function (dt, simDt) {
    if (!D.struck) return;

    const seaY = TT.WATERLINE_Y + D.sinkDepth;      // sea level in ship coordinates
    const pumpRate = D.power > 0.2 ? 240 : 0;       // m³/min, while the pumps last
    const tanPitch = Math.tan(D.pitch);

    // How far the sea stands above the top of a bulkhead anywhere she is full.
    // Once this is positive the water is over the bulkhead deck and running
    // aft along the alleyways, and nothing can stop it working its way back.
    let overflow = 0;
    for (const c of C) {
      if (c.water / c.capacity < 0.94) continue;
      const ls = seaY + tanPitch * ((c.x0 + c.x1) / 2);
      if (ls - BULKHEAD_TOP > overflow) overflow = ls - BULKHEAD_TOP;
    }
    overflow = TT.clamp(overflow, 0, 6);

    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      // Where the sea stands against this compartment, allowing for her trim.
      const xm = (c.x0 + c.x1) / 2;
      const localSea = seaY + tanPitch * xm;

      let inflow = 0;
      if (c.breached && c.water < c.capacity)
        inflow += c.breachSize * Math.max(0, localSea - 2) * 8 * simDt;

      // THE FATAL FLAW: the bulkheads stopped at E deck. Once she settled far
      // enough by the head, the sea outside stood higher than the top of a
      // bulkhead, and water simply brimmed from a full compartment into the
      // next one aft — and then the next, and the next.
      if (c.water < c.capacity) {
        const fwdFull = C[i + 1] && C[i + 1].water / C[i + 1].capacity > 0.94;
        const aftFull = C[i - 1] && C[i - 1].water / C[i - 1].capacity > 0.94;
        if (fwdFull || aftFull) {
          // Direct spill, where the sea outside is already over this bulkhead.
          const over = localSea - BULKHEAD_TOP;
          if (over > 0) inflow += Math.min(over, 6) * 60 * simDt;
          // Progressive flooding aft over the bulkhead deck. This is slower,
          // but it never stops, and it is what took her down.
          else if (overflow > 0) inflow += overflow * 18 * simDt;
          c.spilling = true;
        }
      }

      c.water += inflow;
      if (c.water > 0 && inflow < pumpRate * simDt * 0.25)
        c.water = Math.max(0, c.water - pumpRate * simDt * 0.06);
      c.water = TT.clamp(c.water, 0, c.capacity);

      // Move the water plane inside the hull.
      const m = D.waterMeshes[i];
      if (m) {
        const f = c.water / c.capacity;
        if (f > 0.01) {
          m.visible = true;
          m.position.y = 1.6 + f * (BULKHEAD_TOP + 2.5 - 1.6);
        } else m.visible = false;
      }
    }

    // ---- trim, list and bodily sinkage from the weight of water aboard
    let total = 0, cap = 0, fwd = 0, aft = 0;
    for (const c of C) {
      total += c.water; cap += c.capacity;
      if ((c.x0 + c.x1) / 2 > 0) fwd += c.water; else aft += c.water;
    }
    // Roughly 5,500 m³ of flooding buys a metre of bodily sinkage.
    D.sinkDepth = TT.clamp(total / 5500, 0, 30);
    const targetPitch = TT.clamp(((fwd - aft) / cap) * 0.62, -0.45, 0.45);
    D.pitch += (targetPitch - D.pitch) * Math.min(1, dt * 0.3);
    // She took a list to port late on, as the water found its way across.
    const targetList = D.contact
      ? TT.clamp(-D.contact.side * D.floodFraction() * 0.16, -0.2, 0.2) : 0;
    D.list += (targetList - D.list) * Math.min(1, dt * 0.2);

    // ---- the lights. The engineers kept them burning almost to the end.
    const f = D.floodFraction();
    if (f > 0.42 && D.power > 0.05) {
      D.power = Math.max(0.05, D.power - dt * 0.05);
      if (Math.random() < dt * 3) TT.flickerLights();
    }
    if (f > 0.60 && !D.lightsOut) {
      D.lightsOut = true;
      TT.killLights();
      TT.ui.flash("The lights blink once — twice — and go out.", "#ff9060");
    }

    // ---- the end
    if (f > 0.66 && !D.foundered) {
      D.foundered = true;
      TT.game.phase = "foundering";
      TT.ui.flash("She is breaking up.", "#ff6a4a");
      TT.audio.groan();
      TT.shakeFor(9, 2.2);
    }
    if (D.foundered) {
      D.breakupT += dt;
      D.pitch = TT.clamp(D.pitch + dt * 0.06, -1.2, 1.2);
      D.sinkDepth += dt * 1.4;
      if (D.sinkDepth > 34) TT.onFoundered();
    }

    // ---- apply to the hull
    if (TT.shipRoot) {
      TT.shipRoot.position.y = -TT.WATERLINE_Y - D.sinkDepth;
      TT.shipRoot.rotation.z = -D.pitch;
      TT.shipRoot.rotation.x = D.list;
    }

    // ---- has the player been caught by the water?
    const p = TT.player.pos;
    const idx = compartmentIndexAt(p.x);
    if (idx >= 0) {
      const c = C[idx];
      const fill = 1.6 + (c.water / c.capacity) * (BULKHEAD_TOP + 3 - 1.6);
      if (c.water / c.capacity > 0.02 && p.y + 1.2 < fill) TT.onDrowned();
    }
  };

  function compartmentIndexAt(x) {
    for (let i = 0; i < C.length; i++) if (x >= C[i].x0 && x < C[i].x1) return i;
    return -1;
  }
  TT.compartmentIndexAt = compartmentIndexAt;

  TT.compartmentNameAt = function (x) {
    const i = compartmentIndexAt(x);
    return i >= 0 ? C[i].name : "—";
  };

  // ------------------------------------------------------------------ boats
  TT.launchBoat = function (boatGroup) {
    const b = boatGroup.userData.boat;
    if (b.launched) return false;
    b.launched = true;
    // How full she goes depends on how much time is left and how organised it is.
    const f = D.floodFraction();
    const fill = D.struck
      ? Math.round(TT.clamp(65 * (0.35 + f * 1.5) * TT.rand(0.7, 1.15), 12, 68))
      : Math.round(TT.rand(20, 40));
    b.souls = fill;
    D.saved += fill;
    D.boatsAway++;
    boatGroup.userData.lowering = { t: 0, z: b.homeZ };
    TT.audio.blip(300, 0.4);
    TT.ui.flash("Boat " + b.number + " is away with " + fill + " aboard. "
      + D.boatsAway + " of 20 launched, " + D.saved + " souls in the boats.", "#9fe0b0");
    return true;
  };

  TT.updateBoats = function (dt) {
    if (!TT.lifeboats) return;
    for (const g of TT.lifeboats) {
      const l = g.userData.lowering;
      if (!l) continue;
      l.t += dt;
      const t = Math.min(1, l.t / 6);
      g.position.z = l.z + Math.sign(l.z) * t * 5.5;
      g.position.y = g.userData.boat.homeY - t * 17.5;
      if (l.t > 9) {
        // Once she is in the water, she drifts away astern.
        g.position.x -= dt * 6;
        g.position.y = -TT.shipRoot.position.y - 0.6;
      }
    }
  };

})(window.TT);
