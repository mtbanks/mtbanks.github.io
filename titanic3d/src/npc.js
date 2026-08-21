/* ============================================================================
   npc.js — the 2,224 souls, or as many of them as a browser will carry.
   Each person is three shared-geometry meshes (body, two legs) so they can
   walk, shovel and turn to face you without costing a fortune in draw calls.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;

  // -------------------------------------------------------------- wardrobe
  const OUTFITS = {
    officer:   { coat: 0x1b2436, trouser: 0x1b2436, skin: 0xc9a184, hat: 0x101720, cap: true,  trim: 0xd8c078 },
    captain:   { coat: 0x141a26, trouser: 0x141a26, skin: 0xd8b494, hat: 0x0c1018, cap: true,  trim: 0xe8c86a, beard: true },
    crew:      { coat: 0x2b3a4a, trouser: 0x22262c, skin: 0xc09070, hat: 0x2b3a4a, cap: true },
    steward:   { coat: 0xe8e4d6, trouser: 0x1e2126, skin: 0xc9a184, hat: 0,        cap: false },
    stoker:    { coat: 0x3a3128, trouser: 0x2a241c, skin: 0x8a6a4a, hat: 0x241d16, cap: true,  bare: true },
    trimmer:   { coat: 0x2f2820, trouser: 0x241f18, skin: 0x7d6047, hat: 0x1e1812, cap: true,  bare: true },
    engineer:  { coat: 0x2c3a3a, trouser: 0x2c3a3a, skin: 0xc09070, hat: 0,        cap: false },
    cook:      { coat: 0xefece0, trouser: 0xd8d4c8, skin: 0xc09070, hat: 0xf4f2e8, cap: true },
    operator:  { coat: 0xd8dae0, trouser: 0x2a2f38, skin: 0xd0a888, hat: 0,        cap: false },
    passenger1:{ coat: 0x14161c, trouser: 0x14161c, skin: 0xd8b494, hat: 0x101216, cap: true,  trim: 0xf0f0e8 },
    lady1:     { coat: 0x5a2740, trouser: 0x5a2740, skin: 0xe0bc9c, hat: 0,        cap: false, skirt: true },
    passenger2:{ coat: 0x4a4436, trouser: 0x39352a, skin: 0xd0a888, hat: 0x39352a, cap: true },
    passenger3:{ coat: 0x5a4a38, trouser: 0x3f382c, skin: 0xc09878, hat: 0x4a3f30, cap: true },
    lady3:     { coat: 0x6a5a44, trouser: 0x6a5a44, skin: 0xd8b090, hat: 0,        cap: false, skirt: true }
  };

  const geoCache = {};

  function buildOutfit(name) {
    if (geoCache[name]) return geoCache[name];
    const o = OUTFITS[name] || OUTFITS.crew;

    const body = new TT.Batch("npc-body");
    // Torso, from the hips up. Local origin sits at the hip joint.
    if (o.skirt) {
      const sk = new THREE.CylinderGeometry(0.16, 0.36, 0.62, 10, 1, true);
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(0, 0.05, 0), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      body.custom(sk, m, o.coat);
      sk.dispose();
    }
    body.box(0, 0.62, 0, 0.40, 0.62, 0.24, o.coat);
    if (o.trim) body.box(0.0, 0.62, 0.115, 0.10, 0.58, 0.03, o.trim);
    body.box(0, 0.30, 0, 0.36, 0.30, 0.22, o.trouser);
    // Arms
    for (const s of [-1, 1]) {
      body.box(s * 0.27, 0.62, 0, 0.13, 0.60, 0.15, o.bare ? o.skin : o.coat);
      body.sphere(s * 0.27, 0.30, 0, 0.065, o.skin);
    }
    // Neck and head
    body.box(0, 0.98, 0, 0.11, 0.09, 0.11, o.skin);
    body.sphere(0, 1.12, 0, 0.115, o.skin, 0.135);
    if (o.beard) body.box(0, 1.05, 0.06, 0.14, 0.10, 0.08, 0xd8d4cc);
    if (o.cap) {
      body.cyl(0, 1.235, 0, 0.135, 0.075, o.hat, null, 10);
      body.cyl(0, 1.20, 0.09, 0.14, 0.03, o.hat, null, 10);
      if (o.trim) body.box(0, 1.245, 0.10, 0.10, 0.04, 0.04, o.trim);
    } else if (!o.skirt) {
      body.sphere(0, 1.19, 0, 0.12, o.coat, 0.05);
    }

    const legs = [];
    for (const s of [-1, 1]) {
      const L = new TT.Batch("npc-leg");
      L.box(0, -0.40, 0, 0.145, 0.80, 0.165, o.skirt ? o.skin : o.trouser);
      L.box(0, -0.81, 0.03, 0.15, 0.07, 0.24, 0x1a1712);
      legs.push(L.mesh().geometry);
    }
    geoCache[name] = { body: body.mesh().geometry, legL: legs[0], legR: legs[1] };
    return geoCache[name];
  }

  const npcMat = new THREE.MeshLambertMaterial({ vertexColors: true });

  // ----------------------------------------------------------------- lines
  const LINES = {
    calm: {
      officer: ["Course south 86 west, sir. Making twenty-two and a half knots.",
                "Cold enough to freeze the brass, Captain.",
                "No moon tonight. Flat calm — not a ripple to break on them."],
      captain: ["A fine, clear night, isn't it. Bitterly cold, mind.",
                "In all my years at sea I have never been in an accident worth speaking of."],
      crew:    ["Evening, sir.", "Lookouts have no glasses in the nest. Went missing at Southampton.",
                "Fifteen degrees and falling. Sea temperature's near freezing."],
      steward: ["Can I bring you anything, sir?", "The lounge is still open, sir.",
                "Third class are having a proper party down below."],
      stoker:  ["Thirty ton a watch, and the fires never full.",
                "You'll want to mind the clinker, sir. It'll take the skin off you.",
                "They've got us driving her hard. Twenty-four furnaces on this room alone."],
      trimmer: ["Bunker's near empty. There was a coal fire smouldering in six for days.",
                "We wheel it forward, they burn it. That's the whole of it."],
      engineer:["She's turning seventy-five revolutions. Sweet as anything.",
                "Two reciprocating engines and a turbine on the middle shaft."],
      cook:    ["Six hundred covers for dinner tonight.", "Mind the ranges, sir, they're murder."],
      operator:["I've a backlog of passenger telegrams for Cape Race, sir.",
                "The Californian cut in — I told him to keep out, I'm working Cape Race."],
      passenger1: ["Have you seen the staircase? Extraordinary craftsmanship.",
                   "They say she cannot sink. I find that a great comfort.",
                   "The smoking room until all hours, I expect."],
      passenger2: ["Second class here is finer than first on most ships.",
                   "We're bound for a new life in America."],
      passenger3: ["Bit of a squeeze down here, but the food's good and hot.",
                   "There's a fiddle going in the general room if you fancy it."]
    },
    warned: {
      officer: ["Three ice warnings since noon, sir. Mesaba, Baltic, Californian.",
                "Shall I have the lookouts double the watch, sir?"],
      captain: ["Keep a sharp lookout for ice. That's all we can do at this speed.",
                "I'd not reduce for ice on a night this clear — but it is your ship now."],
      operator:["Another one, sir. Heavy pack ice and bergs, latitude 42 north."],
      crew:    ["Word is there's ice ahead, sir."],
      stoker:  ["We felt nothing down here. What's the word up top?"]
    },
    struck: {
      officer: ["She's making water forward, sir. Five compartments.",
                "The mail room's flooding. The bags are afloat already."],
      captain: ["Mr Andrews gives her an hour and a half. Two at the outside.",
                "Get the boats uncovered. Women and children first."],
      crew:    ["All hands! Uncover the boats!", "Get the passengers up, lifebelts on!"],
      steward: ["Lifebelts on, please! Up to the boat deck!",
                "Everyone up top, please, no need to run."],
      stoker:  ["Water's over the plates in six! Get out, all of you!",
                "The bunker door gave way. She came in like a wall."],
      trimmer: ["She's away! Everybody out!"],
      engineer:["We're keeping the lights on. Whatever it takes, we keep the lights on.",
                "Pumps are running full. It's not enough — she's taking it faster than we can throw it out."],
      passenger1: ["What on earth was that grinding noise?",
                   "They tell us it is only a precaution."],
      passenger2: ["Are the boats being lowered? Truly?"],
      passenger3: ["The gates are shut. They won't let us up!"]
    }
  };

  function lineFor(role, phase) {
    const pool = LINES[phase] && LINES[phase][role];
    if (pool) return TT.pick(pool);
    const fall = LINES.calm[role] || LINES.calm.crew;
    return TT.pick(fall);
  }

  // ------------------------------------------------------------------ names
  const CREW_NAMES = {
    captain:  ["Captain Edward J. Smith"],
    officer:  ["First Officer Murdoch", "Second Officer Lightoller", "Fourth Officer Boxhall",
               "Sixth Officer Moody", "Third Officer Pitman"],
    operator: ["Senior Operator Phillips", "Junior Operator Bride"],
    engineer: ["Chief Engineer Bell", "Engineer Hesketh", "Greaser Ranger"],
    stoker:   ["Fireman Barrett", "Fireman Beauchamp", "Fireman Hendrickson", "Fireman Dilley"],
    trimmer:  ["Trimmer Dillon", "Trimmer Hunt"],
    steward:  ["Steward Hart", "Stewardess Bissett", "Steward Etches", "Stewardess Sloan"],
    crew:     ["Lookout Fleet", "Lookout Lee", "Quartermaster Hichens", "Seaman Osman",
               "Quartermaster Rowe", "Bosun's Mate Haines"],
    cook:     ["Chief Baker Joughin", "Cook Maynard"],
    passenger1: ["Mr Thomas Andrews", "Colonel Gracie", "Mrs Brown", "Mr Guggenheim",
                 "Mr & Mrs Straus", "Miss Elizabeth Shutes", "Mr Beesley"],
    passenger2: ["Mr Lawrence Beesley", "Mrs Esther Hart", "Mr Charles Aldworth"],
    passenger3: ["Mr Daniel Buckley", "Miss Kate Gilnagh", "Mr Eugene Daly"],
    lady1:      ["Mrs J. J. Astor", "Lady Duff-Gordon", "Miss Helen Candee"],
    lady3:      ["Mrs Anna Sjöblom", "Miss Bertha Mulvihill"]
  };
  const nameCount = {};
  function nameFor(role) {
    const pool = CREW_NAMES[role];
    if (!pool) return "Passenger";
    const i = (nameCount[role] = (nameCount[role] || 0)) % pool.length;
    nameCount[role]++;
    return pool[i];
  }

  // ------------------------------------------------------------------- NPC
  TT.npcs = [];

  function makeNPC(x, y, z, role, behavior) {
    // Some roles have a female variant.
    let outfit = role;
    if (role === "passenger1" && Math.random() < 0.45) outfit = "lady1";
    if (role === "passenger3" && Math.random() < 0.40) outfit = "lady3";
    if (role === "passenger2" && Math.random() < 0.40) outfit = "lady3";
    const g = buildOutfit(OUTFITS[outfit] ? outfit : "crew");

    const grp = new THREE.Group();
    const body = new THREE.Mesh(g.body, npcMat);
    const legL = new THREE.Mesh(g.legL, npcMat);
    const legR = new THREE.Mesh(g.legR, npcMat);
    legL.position.set(-0.10, 0, 0);
    legR.position.set(0.10, 0, 0);
    grp.add(body, legL, legR);
    grp.position.set(x, y + 0.82, z);
    const scale = TT.srandRange(0.94, 1.06);
    grp.scale.setScalar(scale);

    const npc = {
      role, outfit, mesh: grp, body, legL, legR,
      home: new THREE.Vector3(x, y, z),
      target: new THREE.Vector3(x, y, z),
      yaw: TT.srandRange(0, 6.28),
      phase: TT.srandRange(0, 6.28),
      speed: TT.srandRange(0.7, 1.25),
      behavior: behavior || "wander",
      wait: TT.srandRange(0, 4),
      walking: false,
      name: nameFor(outfit === "lady1" ? "lady1" : outfit === "lady3" ? "lady3" : role),
      talkCooldown: 0,
      deckY: y,
      panic: 0
    };
    TT.npcs.push(npc);
    TT.shipRoot.add(grp);
    return npc;
  }
  TT.makeNPC = makeNPC;

  // --------------------------------------------------------------- populate
  TT.populate = function () {
    const spawns = TT.spawnPoints;
    for (const s of spawns) {
      const behavior = (s.kind === "stoker" || s.kind === "trimmer") ? "shovel"
                     : (s.kind === "engineer") ? "tend"
                     : (s.kind === "operator") ? "sit"
                     : "wander";
      makeNPC(s.x, s.y, s.z, s.kind, behavior);
    }

    // The named few, placed deliberately.
    TT.captain = makeNPC(45.5, 27.2, -3.0, "captain", "command");
    TT.captain.name = "Captain Edward J. Smith";
    TT.officerAtHelm = makeNPC(43.6, 27.2, 1.4, "crew", "helm");
    TT.officerAtHelm.name = "Quartermaster Hichens";
    TT.lookouts = [];
    // Two lookouts in the crow's nest, without binoculars.
    for (const dz of [-0.6, 0.6]) {
      const lk = makeNPC(64, 49.2, dz, "crew", "lookout");
      lk.name = dz < 0 ? "Lookout Frederick Fleet" : "Lookout Reginald Lee";
      TT.lookouts.push(lk);
    }
    TT.bus.emit("populated", TT.npcs.length);
    return TT.npcs.length;
  };

  // ----------------------------------------------------------------- update
  const _d = new THREE.Vector3();

  TT.updateNPCs = function (dt, playerPos, phase) {
    const near = 42 * 42;
    for (let i = 0; i < TT.npcs.length; i++) {
      const n = TT.npcs[i];
      const dx = n.mesh.position.x - playerPos.x;
      const dz = n.mesh.position.z - playerPos.z;
      const dy = n.mesh.position.y - playerPos.y;
      const dist2 = dx * dx + dy * dy * 4 + dz * dz;

      // Anything far away is frozen: no animation, no thinking.
      if (dist2 > near) {
        if (n.mesh.visible && dist2 > 160 * 160) n.mesh.visible = false;
        continue;
      }
      n.mesh.visible = true;
      if (n.talkCooldown > 0) n.talkCooldown -= dt;
      n.phase += dt;

      const agitated = phase === "struck" || phase === "sinking";
      const spd = n.speed * (agitated ? 1.9 : 1);

      switch (n.behavior) {
        case "shovel": {
          // Bend to the coal, swing to the furnace, and back again.
          const s = Math.sin(n.phase * (agitated ? 4.5 : 2.6));
          n.body.rotation.x = 0.42 + s * 0.42;
          n.body.position.y = -0.10 - Math.abs(s) * 0.10;
          n.legL.rotation.x = 0.18; n.legR.rotation.x = -0.22;
          break;
        }
        case "tend": {
          n.body.rotation.x = Math.sin(n.phase * 1.4) * 0.10;
          n.mesh.rotation.y = n.yaw + Math.sin(n.phase * 0.5) * 0.3;
          break;
        }
        case "sit": {
          n.body.rotation.x = 0.22 + Math.sin(n.phase * 3.2) * 0.06;
          n.legL.rotation.x = -1.35; n.legR.rotation.x = -1.35;
          n.mesh.position.y = n.home.y + 0.42;
          break;
        }
        case "lookout": {
          n.mesh.rotation.y = Math.PI / 2 + Math.sin(n.phase * 0.35) * 0.55;
          n.body.rotation.x = -0.06;
          break;
        }
        case "helm": {
          n.mesh.rotation.y = Math.PI / 2;
          n.body.rotation.x = 0.10;
          n.body.rotation.z = (TT.nav ? TT.nav.state.wheelAngle : 0) * 0.06;
          break;
        }
        case "command": {
          n.mesh.rotation.y = Math.PI / 2 + Math.sin(n.phase * 0.3) * 0.5;
          n.body.rotation.x = 0;
          break;
        }
        default: {
          // Wander inside a small patch of the room they belong to.
          n.wait -= dt;
          if (n.wait <= 0) {
            const r = agitated ? 5.0 : 3.0;
            n.target.set(n.home.x + TT.rand(-r, r), n.home.y, n.home.z + TT.rand(-r, r));
            n.wait = agitated ? TT.rand(0.6, 2.0) : TT.rand(2.5, 8);
            n.walking = agitated || Math.random() < 0.72;
          }
          if (n.walking) {
            _d.set(n.target.x - n.mesh.position.x, 0, n.target.z - n.mesh.position.z);
            const d = _d.length();
            if (d < 0.25) { n.walking = false; }
            else {
              _d.divideScalar(d);
              n.mesh.position.x += _d.x * spd * dt;
              n.mesh.position.z += _d.z * spd * dt;
              n.yaw = Math.atan2(_d.x, _d.z);
            }
          }
          n.mesh.rotation.y = n.yaw;
          const sw = n.walking ? Math.sin(n.phase * 8.5 * spd) : 0;
          n.legL.rotation.x = sw * 0.62;
          n.legR.rotation.x = -sw * 0.62;
          n.body.rotation.x = n.walking ? 0.06 : (agitated ? Math.sin(n.phase * 5) * 0.10 : 0);
          n.mesh.position.y = n.home.y + 0.82 + (n.walking ? Math.abs(sw) * 0.035 : 0);
        }
      }
    }
  };

  /** Nearest person you could speak to. */
  TT.nearestNPC = function (playerPos, yaw, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (const n of TT.npcs) {
      const dx = n.mesh.position.x - playerPos.x;
      const dz = n.mesh.position.z - playerPos.z;
      const dy = n.mesh.position.y - playerPos.y - 1.0;
      if (Math.abs(dy) > 1.8) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 > bestD) continue;
      const d = Math.sqrt(d2) || 1;
      if ((dx / d) * fx + (dz / d) * fz < 0.4) continue;
      bestD = d2; best = n;
    }
    return best;
  };

  TT.npcSay = function (npc, phase) {
    const role = npc.role === "captain" ? "captain" : npc.role;
    return { who: npc.name, text: lineFor(role, phase) };
  };

  /** After the collision, boats fill and the decks crowd. */
  TT.musterToBoats = function () {
    let moved = 0;
    for (const n of TT.npcs) {
      if (moved > 46) break;
      if (n.behavior === "helm" || n.behavior === "command" || n.behavior === "lookout") continue;
      if (n.home.y > 24) continue;
      if (Math.random() < 0.55) continue;
      const bx = TT.rand(-40, 44), bz = TT.rand(-14, 14) > 0 ? TT.rand(9, 14) : TT.rand(-14, -9);
      n.home.set(bx, 27.2, bz);
      n.mesh.position.set(bx, 28.02, bz);
      n.deckY = 27.2;
      n.behavior = "wander";
      moved++;
    }
    return moved;
  };

})(window.TT);
