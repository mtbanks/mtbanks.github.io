/* ============================================================================
   main.js — boot, assemble the ship, run the watch.
   ========================================================================== */
(function (TT) {
  "use strict";

  TT.settings = { sensitivity: 1.0, walkSpeed: 1.0 };
  TT.game = {
    state: "title",              // title | playing | ended
    phase: "calm",               // calm | warned | struck | foundering
    nearMisses: 0,
    strikeClock: 0,
    topKnots: 0,
    started: 0
  };

  let renderer, scene, camera, clock;
  let shake = { t: 0, mag: 0 };

  TT.shakeFor = function (t, mag) { shake.t = Math.max(shake.t, t); shake.mag = mag; };

  // -------------------------------------------------------------- lighting fx
  TT.flickerLights = function () {
    const p = TT.lightPool;
    for (const l of p.lights) l.intensity *= 0.25;
    if (TT.hemiLight) TT.hemiLight.intensity = 0.18;
    setTimeout(() => { if (TT.hemiLight) TT.hemiLight.intensity = 0.42; }, 130);
  };

  TT.killLights = function () {
    TT.lightsDead = true;
    for (const l of TT.lightPool.lights) { l.intensity = 0; l.visible = false; }
    if (TT.hemiLight) TT.hemiLight.intensity = 0.07;
    for (const g of TT.furnaceGlows) g.visible = false;
    // Emissive fixtures go dark too.
    scene.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial && /glow/.test(o.name || ""))
        o.visible = false;
    });
  };

  // ------------------------------------------------------- external ladders
  /** Ladders and companionways between the open weather decks. */
  function buildExteriorLadders(root) {
    const b = new TT.Batch("ladders");
    const flights = [
      // [xLow, xHigh, z0, z1, yLow, yHigh]
      [53, 48.5, 5.5, 7.5, 18.8, 21.6],       // forward well deck up to B deck
      [53, 48.5, -7.5, -5.5, 18.8, 21.6],
      [76, 80.5, 5.5, 7.5, 18.8, 22.0],       // well deck up to the forecastle
      [76, 80.5, -7.5, -5.5, 18.8, 22.0],
      [-63, -58.5, 5.5, 7.5, 18.8, 21.6],     // aft well deck up to B deck
      [-63, -58.5, -7.5, -5.5, 18.8, 21.6],
      [-86, -90.5, 5.5, 7.5, 18.8, 21.6],     // aft well deck up to the poop
      [-86, -90.5, -7.5, -5.5, 18.8, 21.6],
      [48.5, 44, 9.5, 11.5, 21.6, 24.4],      // B deck up to the promenade
      [48.5, 44, -11.5, -9.5, 21.6, 24.4],
      [-56, -51.5, 9.5, 11.5, 21.6, 24.4],
      [-56, -51.5, -11.5, -9.5, 21.6, 24.4]
    ];
    for (const [xa, xb, z0, z1, yl, yh] of flights) {
      const steps = Math.round((yh - yl) / 0.2);
      const rise = (yh - yl) / steps;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps;
        const sa = TT.lerp(xa, xb, t0), sb = TT.lerp(xa, xb, t1);
        b.box((sa + sb) / 2, yl + rise * i + rise / 2, (z0 + z1) / 2,
              Math.abs(sb - sa) + 0.02, rise, Math.abs(z1 - z0), TT.PAL.steel);
      }
      for (let i = 0; i <= 6; i++) {
        const t = i / 6, x = TT.lerp(xa, xb, t), y = TT.lerp(yl, yh, t);
        b.box(x, y + 0.55, z0, 0.06, 1.1, 0.06, TT.PAL.white);
        b.box(x, y + 0.55, z1, 0.06, 1.1, 0.06, TT.PAL.white);
      }
      TT.collision.addRamp({
        x0: Math.min(xa, xb), x1: Math.max(xa, xb),
        z0: Math.min(z0, z1), z1: Math.max(z0, z1),
        yLow: yl, yHigh: yh, axis: "x", flip: xa > xb
      });
    }
    // Guard rails along the ends of the B-deck weather deck, where it falls
    // 2.8 m straight into the open wells. Gaps where the ladders come up.
    for (const x of [50, -60]) {
      const hw = TT.halfBeamAt(x, 22) - 0.8;
      let segs = [[-hw, hw]];
      for (const g of [[-8.2, -4.8], [4.8, 8.2]]) {
        const next = [];
        for (const s of segs) {
          if (g[1] <= s[0] || g[0] >= s[1]) { next.push(s); continue; }
          if (g[0] > s[0]) next.push([s[0], g[0]]);
          if (g[1] < s[1]) next.push([g[1], s[1]]);
        }
        segs = next;
      }
      for (const s of segs) {
        if (s[1] - s[0] < 0.1) continue;
        b.box(x, 22.15, (s[0] + s[1]) / 2, 0.1, 1.1, s[1] - s[0], TT.PAL.white);
        TT.collision.addSolid(x - 0.3, 21.6, s[0], x + 0.3, 22.9, s[1]);
      }
    }
    root.add(b.mesh());
  }

  // -------------------------------------------------------------- lifeboats
  function registerLifeboats() {
    for (const g of TT.lifeboats) {
      const bd = g.userData.boat;
      TT.interact(bd.homeX, 28.2, bd.homeZ * 0.86,
        "Lifeboat No. " + bd.number,
        "Swing out and lower Boat " + bd.number,
        () => {
          if (!TT.dmg.struck) {
            TT.ui.say("There is no reason to launch a boat. She is making twenty-two knots "
              + "on a flat calm sea.");
            return;
          }
          TT.launchBoat(g);
        }, 4.2);
    }
  }

  // ----------------------------------------------------------------- deck map
  function openDeckMap() {
    let h = '<p class="mono">She is 269 metres long and ten decks deep. Walk her if you '
          + 'like — or have a steward show you down.</p><ol class="choices">';
    const targets = [
      ["boat",  "Boat Deck — the bridge and the boats",           44, 27.2, 0],
      ["a",     "A / Promenade — lounge, smoke room, café",      -11, 24.4, -7],
      ["b",     "B / Bridge Deck — suites and the restaurant",   -38, 21.6, 3],
      ["c",     "C / Shelter Deck — purser, library, general room", 0, 18.8, 0],
      ["d",     "D / Saloon Deck — the First Class Dining Saloon", 45, 16.0, 6],
      ["e",     "E / Upper Deck — Scotland Road",                  0, 13.2, -8.5],
      ["f",     "F / Middle Deck — third class dining, the baths", 12, 10.4, 0],
      ["g",     "G / Lower Deck — squash court, post office",      75,  7.6, 0],
      ["orlop", "Orlop — cargo holds and the motor car",           68,  4.6, 4],
      ["tank",  "Tank Top — Boiler Room No. 4",                     5,  1.6, 0],
      ["tank2", "Tank Top — Reciprocating Engine Room",           -52,  1.6, 0],
      ["tank3", "Tank Top — Turbine Room and shaft tunnel",       -95,  1.6, 5]
    ];
    targets.forEach((t, i) => {
      h += '<li class="choice" data-i="' + i + '"><b>' + (i + 1 <= 9 ? i + 1 : "·") + "</b> "
         + t[1] + "</li>";
    });
    h += "</ol>";
    TT.ui.openModal("Go below", h, i => { jump(targets[i]); });
    document.querySelectorAll("#modal-body .choice").forEach(node => {
      node.addEventListener("click", () => jump(targets[parseInt(node.dataset.i, 10)]));
    });
    function jump(t) {
      if (!t) return;
      TT.player.teleport(t[2], t[3], t[4]);
      TT.ui.closeModal();
      TT.ui.say("You make your way down to " + t[1].split("—")[0].trim() + ".");
    }
  }

  // -------------------------------------------------------------- end states
  let ended = false;
  function endGame(kind, data) {
    if (ended) return;
    ended = true;
    TT.game.state = "ended";
    TT.ui.showEnd(kind, data || {});
  }
  TT.onFoundered = () => endGame("foundered", TT.dmg.contact || { compartments: 0, knots: 0 });
  TT.onDrowned = () => endGame("drowned", {});
  TT.onOverboard = () => endGame("overboard", {});

  // ------------------------------------------------------------------- ambience
  function ambienceFor(p) {
    if (p.y < 9.5) {
      if (p.x < -88) return "shaft";
      if (p.x < -46) return "engine";
      if (p.x < 52) return "boiler";
      return "inside";
    }
    if (p.y > 26.5) {
      const inHouse = (p.x > 38 && p.x < 48 && Math.abs(p.z) < 7)
                   || (p.x > 26 && p.x < 39 && Math.abs(p.z) < 8)
                   || (p.x > 11 && p.x < 23 && p.z > 3 && p.z < 12);
      return inHouse ? "inside" : "deck";
    }
    if (p.y > 21 && Math.abs(p.z) > 9.5) return "deck";
    return "inside";
  }

  // ==================================================================== boot
  function init() {
    const canvas = document.getElementById("gl");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x02040a);

    scene = TT.scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040810, 0.00085);

    camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 12000);
    TT.camera = camera;

    // ---- world first: sky, sea, stars, lights
    TT.buildWorld(scene);

    // ---- the ship herself, in her own frame so she can heel and go down
    const shipRoot = TT.shipRoot = new THREE.Group();
    shipRoot.position.y = -TT.WATERLINE_Y;
    scene.add(shipRoot);
    shipRoot.add(camera);                       // the camera rides the ship

    TT.lightPool = new TT.LightPool(shipRoot, 8, 0xffd8a0, 0, 10);

    const t0 = performance.now();
    TT.buildExterior(shipRoot);
    TT.buildInterior(shipRoot);
    TT.buildBridge(shipRoot);
    buildExteriorLadders(shipRoot);
    TT.buildFloodWater(shipRoot);
    registerLifeboats();

    TT.registerPlatforms();
    const cells = TT.buildCollisionGrid();
    const buildMs = performance.now() - t0;

    // ---- people
    TT.populate();

    // ---- player and interface
    TT.player = new TT.Player(camera, canvas);
    TT.player.teleport(41, 27.2, 0, -Math.PI / 2);
    TT.ui.init();
    TT.ui.restoreHelp();

    document.getElementById("boot-stats").textContent =
      TT.rooms.length + " named spaces · " + TT.npcs.length + " souls modelled · "
      + TT.collision.solids.length.toLocaleString() + " collision volumes · "
      + cells + " grid cells · built in " + buildMs.toFixed(0) + " ms";

    window.addEventListener("resize", onResize);
    bindKeys();

    clock = new THREE.Clock();
    renderer.setAnimationLoop(frame);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // -------------------------------------------------------------------- keys
  function bindKeys() {
    document.addEventListener("keydown", e => {
      if (TT.game.state === "title") {
        if (e.code === "Enter" || e.code === "Space") startGame();
        return;
      }
      if (TT.ui.modalOpen) return;
      switch (e.code) {
        case "KeyE": {
          const h = TT.ui.hover;
          if (!h) break;
          if (h.kind === "it") h.it.fn();
          else if (h.kind === "npc") {
            const n = h.npc;
            if (n.talkCooldown > 0) break;
            n.talkCooldown = 2.5;
            const line = TT.npcSay(n, TT.game.phase === "foundering" ? "struck" : TT.game.phase);
            TT.ui.dialogue(line.who, line.text);
          }
          break;
        }
        case "KeyT": TT.ui.openTelegraph(); break;
        case "KeyM": openDeckMap(); break;
        case "KeyV":
          TT.player.mode = TT.player.mode === "exterior" ? "walk" : "exterior";
          TT.ui.say(TT.player.mode === "exterior"
            ? "Standing off to look at her. Mouse to orbit, wheel to close."
            : "Back aboard.");
          break;
        case "KeyG":
          TT.player.mode = TT.player.mode === "ghost" ? "walk" : "ghost";
          TT.ui.say(TT.player.mode === "ghost"
            ? "Free look: WASD to fly, Space up, Ctrl down. Walls mean nothing."
            : "Feet back on the deck.");
          break;
        case "KeyH":
          TT.player.teleport(41, 27.2, 0, -Math.PI / 2);
          TT.ui.say("You return to the bridge.");
          break;
        case "KeyN": TT.audio.toggleMute(); break;
        case "KeyF": TT.setWatertightDoors(!TT.nav.state.wtDoorsClosed); break;
      }
    });
  }

  function startGame() {
    TT.game.state = "playing";
    TT.game.started = performance.now();
    document.body.classList.add("playing");
    TT.ui.hideTitle();
    TT.audio.init();
    setTimeout(() => {
      const r = document.getElementById("gl").requestPointerLock();
      if (r && r.catch) r.catch(() => {});     // no gesture yet: the next click gets it
      TT.ui.say("23:30. You have the ship. Course south 86 west, twenty-two and a half knots.");
      TT.ui.say("Steer with ← and →. T rings the engine room. M takes you below.");
    }, 220);
  }
  document.addEventListener("click", e => {
    if (TT.game.state === "title" && !e.target.closest("#title-credits")) startGame();
  });

  // ------------------------------------------------------------------- frame
  let accum = 0;

  function frame() {
    const dtRaw = clock.getDelta();
    const dt = Math.min(dtRaw, 0.05);

    if (TT.game.state === "playing" && !TT.ui.modalOpen) {
      // ---- navigation and the ship
      TT.nav.update(dt, TT.player.keys);
      TT.nav.updateVoyage(dt);
      const st = TT.nav.state;
      TT.game.topKnots = Math.max(TT.game.topKnots, st.knots);

      // ---- the sea moving past
      TT.updateWorld(dt, st.speedMS);
      TT.updateSmoke(dt, TT.dmg.lightsOut ? 0 : TT.clamp(st.rpm / 75, 0, 1.2));

      // ---- ice, damage, boats
      TT.checkIceCollision(dt);
      TT.updateFlooding(dt, dt * st.timeScale / 60);
      TT.updateBoats(dt);

      // ---- player and crew
      TT.player.update(dt);
      TT.updateNPCs(dt, TT.player.pos, TT.game.phase);

      // ---- lights that follow you
      if (!TT.lightsDead) TT.lightPool.update(TT.player.pos);

      // ---- watertight doors sliding
      for (const d of TT.watertightDoors) {
        const target = d.closed ? d.y : d.y - 2.4;
        d.mesh.position.y += (target - d.mesh.position.y) * Math.min(1, dt * 1.6);
      }

      // ---- audio bed
      accum += dt;
      if (accum > 0.35) {
        accum = 0;
        TT.audio.ambience(ambienceFor(TT.player.pos),
                          TT.clamp(Math.abs(st.rpm) / 75, 0, 1.2),
                          TT.dmg.floodFraction());
      }

      TT.ui.update(dt);

      // ---- arrival
      if (st.milesRun >= st.milesTotal && !TT.dmg.struck)
        endGame("arrived", {
          days: (st.clock - (23 * 3600 + 30 * 60)) / 86400 + 4.4,
          topKnots: TT.game.topKnots
        });
    } else if (TT.game.state === "ended") {
      TT.player.update(dt);
      TT.updateWorld(dt, TT.nav.state.speedMS);
      TT.updateFlooding(dt, dt * 14 / 60);
      TT.updateBoats(dt);
      TT.updateNPCs(dt, TT.player.pos, "struck");
    } else {
      // Title screen: a slow drift around the ship.
      TT.player.orbit.yaw += dt * 0.05;
      TT.player.mode = "exterior";
      TT.player.update(dt);
      TT.updateWorld(dt, 11);
      TT.updateSmoke(dt, 1);
    }

    // ---- camera shake
    if (shake.t > 0) {
      shake.t -= dt;
      const m = shake.mag * Math.min(1, shake.t);
      camera.position.x += (Math.random() - 0.5) * m * 0.5;
      camera.position.y += (Math.random() - 0.5) * m * 0.5;
      camera.rotation.z += (Math.random() - 0.5) * m * 0.02;
    }

    renderer.render(scene, camera);
  }

  // Kick off once the DOM and three.js are both present. If the ship fails to
  // build, say so on the title card rather than leaving a black screen.
  function boot() {
    try { init(); }
    catch (err) {
      const el = document.getElementById("boot-stats");
      if (el) {
        el.style.color = "#e2604f";
        el.textContent = "failed to build the ship: " + err.message
          + " — " + (err.stack || "").split("\n")[1];
      }
      throw err;
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();

})(window.TT);
