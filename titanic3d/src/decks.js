/* ============================================================================
   decks.js — the actual rooms, deck by deck, roughly following the 1912
   general arrangement plans. Forward is +X, starboard is +Z.
   ========================================================================== */
(function (TT) {
  "use strict";

  const P = TT.PAL;
  const DW = TT.DOOR_W;
  const door = (c, w) => [c - (w || DW) / 2, c + (w || DW) / 2];

  TT.spawnPoints = [];
  TT.DeckCtx.prototype.spawn = function (x, z, kind, n) {
    for (let i = 0; i < (n || 1); i++)
      TT.spawnPoints.push({
        x: x + TT.srandRange(-2.5, 2.5), y: this.y, z: z + TT.srandRange(-2.5, 2.5),
        kind, deck: this.deck.id
      });
    return this;
  };

  // ============================================================== stairwells
  TT.buildStairwell = function (ctxs, cfg) {
    const ids = cfg.decks, x0 = cfg.x0, x1 = cfg.x1;
    const lanes = [cfg.zA, cfg.zB];
    for (let i = 0; i < ids.length - 1; i++) {
      const lo = ctxs[ids[i]], hi = ctxs[ids[i + 1]];
      if (!lo || !hi) continue;
      const lane = lanes[i % 2];
      const aftUp = (i % 2 === 0);
      const ax = aftUp ? x1 - 1.5 : x0 + 1.5;
      const bx = aftUp ? x0 + 1.5 : x1 - 1.5;
      lo.flight(ax, bx, lane[0], lane[1], lo.y, hi.y, "x", cfg.color || P.teakDark);
      // Exactly the flight's footprint: any wider and you get a strip of
      // hole with no ramp under it — invisible floor you walk on.
      hi.hole(x0 + 1.5, lane[0], x1 - 1.5, lane[1]);
    }
    for (const id of ids) {
      const c = ctxs[id];
      if (!c) continue;
      c.room(x0, Math.min(cfg.zA[0], cfg.zB[0]), x1, Math.max(cfg.zA[1], cfg.zB[1]),
             cfg.name, "stairs");
      c.lamp((x0 + x1) / 2, (cfg.zA[0] + cfg.zB[1]) / 2, cfg.grand ? 0xffe2a8 : 0xd8e4f0,
             cfg.grand ? 1.15 : 0.6, cfg.grand ? 13 : 8);
      if (cfg.grand) {
        // Wrought-iron and gilt balustrade panels around the well.
        for (let x = x0; x < x1; x += 2)
          c.b.box(x + 1, c.y + 0.55, cfg.zB[1] + 0.2, 1.8, 1.1, 0.1, P.brass);
        c.b.box((x0 + x1) / 2, c.y + 1.15, cfg.zB[1] + 0.2, x1 - x0, 0.12, 0.22, P.panelWalnut);
      }
    }
  };

  // ================================================================ BOAT DECK
  function boatDeck(c) {
    const y = c.y;

    // ---- Wheelhouse: the helm. Everything here is interactive.
    c.room(39, -6.6, 47.4, 6.6, "Wheelhouse", "bridge");
    c.b.box(43, y + 0.02, 0, 8.4, 0.06, 13, P.teakDark);            // planked sole
    c.lamp(44, -3.5, 0xcfe0ff, 0.5, 7); c.lamp(44, 3.5, 0xcfe0ff, 0.5, 7);
    c.b.solid(40.5, y + 0.45, 4.5, 1.6, 0.9, 2.2, P.panelWalnut);   // chart table
    c.b.box(40.5, y + 0.92, 4.5, 1.7, 0.05, 2.3, 0xe8e0cc);
    c.b.solid(40.5, y + 0.9, -4.5, 1.2, 1.8, 2.4, P.panelOak);      // signal locker

    c.room(33, -7, 38.4, 0, "Chart Room", "bridge");
    c.room(33, 0, 38.4, 7, "Marconi Wireless Room", "bridge");
    c.wallZ(-7, 7, 38.6, P.panelOak, [door(-3.5), door(3.5)]);
    c.wallX(33, 38.6, 0, P.panelOak, [door(35.8)]);
    c.b.solid(35, y + 0.45, -4.5, 3.5, 0.9, 2.0, P.panelWalnut);
    c.b.solid(35, y + 0.5, 4.6, 3.0, 1.0, 1.6, P.panelWalnut);      // wireless bench
    c.b.box(35, y + 1.25, 5.4, 2.4, 1.4, 0.5, P.steelDark);         // the set itself
    c.glow.box(34.2, y + 1.4, 5.15, 0.3, 0.3, 0.06, 0x88ff99);
    c.glow.box(35.8, y + 1.5, 5.15, 0.2, 0.2, 0.06, 0xffcc44);
    c.lamp(35, -4, 0xffdca8, 0.6, 7); c.lamp(35, 4, 0xffdca8, 0.6, 7);
    c.spawn(35.5, 4.5, "operator", 1);
    c.spawn(41, 2, "officer", 1);
    c.spawn(46, -8.5, "officer", 1);

    // ---- Officers' quarters
    c.room(26, -7.5, 33, 7.5, "Officers' Quarters", "crew");
    c.wallZ(-7.5, 7.5, 26, P.panelOak, [door(0)]);
    c.wallX(26, 33, -2.2, P.panelOak, [door(28), door(31)]);
    c.wallX(26, 33, 2.2, P.panelOak, [door(28), door(31)]);
    c.bed(28, -5, Math.PI / 2); c.bed(31, -5, Math.PI / 2);
    c.bed(28, 5, Math.PI / 2);  c.bed(31, 5, Math.PI / 2);
    c.lampRun(27, 32, 0, 3, 0xffdca8, 0.5);
    c.spawn(29, 0, "officer", 1);

    // ---- Gymnasium (starboard, abreast the second funnel)
    c.room(11, 3.5, 23, 11.5, "Gymnasium", "public");
    c.wallZ(3.5, 11.5, 11, P.white, [door(7.5)]);
    c.wallX(11, 23, 3.5, P.white, [door(20)]);
    c.b.box(17, y + 0.03, 7.5, 11.6, 0.06, 7.6, P.teak);
    for (const [gx, gz] of [[13, 5.5], [13, 9.5], [16, 5.5], [16, 9.5]]) {
      c.b.solid(gx, y + 0.5, gz, 1.4, 1.0, 0.7, P.panelWalnut);      // rowing machines
      c.b.box(gx + 0.6, y + 0.95, gz, 0.5, 0.12, 0.9, P.teakDark);
    }
    // The electric camel and the mechanical horses.
    c.b.solid(20, y + 0.75, 6, 1.8, 1.5, 0.8, P.teakDark);
    c.b.solid(20, y + 0.75, 9.5, 1.8, 1.5, 0.8, P.teakDark);
    c.b.box(20, y + 1.6, 6, 1.2, 0.25, 0.5, 0x6b4326);
    c.b.box(20, y + 1.6, 9.5, 1.2, 0.25, 0.5, 0x6b4326);
    c.lamp(14, 7.5, 0xfff0d0, 0.8, 9); c.lamp(20, 7.5, 0xfff0d0, 0.8, 9);
    c.spawn(15, 7.5, "passenger1", 2);

    // ---- Forward Grand Staircase house and its dome. The enclosing walls are
    // the deckhouse shell; nothing may be built across the shaft itself.
    c.room(14, -10.5, 26, 1.0, "Grand Staircase — Boat Deck", "grand");
    c.wallZ(-10.5, 1.0, 26.2, P.panelOak, [door(-3.7)]);

    // ---- Entrances aft
    c.room(-16, -8, 2, 8, "First Class Entrance", "public");
    c.room(-45, -8, -17, 8, "Second Class Entrance", "public");
    c.wallZ(-8, 8, 2, P.panelOak, [door(0, 2.2)]);
    c.lampRun(-14, 0, 0, 5, 0xffdca8, 0.7);
    c.lampRun(-43, -27, 0, 5, 0xffdca8, 0.7);
    c.spawn(-6, 0, "passenger1", 3);
    c.spawn(-34, 0, "passenger2", 3);

    // Deck strollers, wrapped in coats against the cold.
    c.spawn(0, -14, "passenger1", 4);
    c.spawn(-20, 14, "passenger1", 4);
    c.spawn(28, -12, "crew", 2);
  }

  // ================================================================== A DECK
  function aDeck(c) {
    const y = c.y;
    const promZ = 10.5;

    // Enclosed promenade down both sides.
    c.room(-50, promZ, 46, 15, "Promenade — Starboard", "promenade");
    c.room(-50, -15, 46, -promZ, "Promenade — Port", "promenade");
    c.lampRun(-46, 44, promZ + 2, 8, 0xffe0b0, 0.55);
    c.lampRun(-46, 44, -promZ - 2, 8, 0xffe0b0, 0.55);
    for (let x = -46; x < 44; x += 6) { c.porthole(x, promZ + 3.5, false); }
    c.spawn(20, 12.5, "passenger1", 4);
    c.spawn(-10, -12.5, "passenger1", 4);

    // ---- First Class staterooms, forward
    c.room(30, -promZ, 46, promZ, "First Class Staterooms", "cabins");
    const dA = TT.cabinRun(c, 31, 45, -1.4, -9.5, 4, "first");
    const dB = TT.cabinRun(c, 31, 45, 1.4, 9.5, 4, "first");
    TT.corridor(c, 30, 46, 0, 2.8, P.panelOak, dA, dB);

    // ---- Grand Staircase (forward)
    c.wallZ(-9, 9, 26.5, P.panelOak, [door(0, 2.4)]);

    // ---- Reading & Writing Room
    c.room(-2, -9, 14, 9, "Reading & Writing Room", "public");
    c.wallZ(-9, 9, 14, P.plaster, [door(0, 2.2)]);
    c.wallX(-2, 14, -9, P.plaster, [door(6)]);
    c.wallX(-2, 14, 9, P.plaster, [door(6)]);
    c.b.box(6, y + 0.03, 0, 15.8, 0.06, 17.8, 0xb8b3a2);
    for (const [tx, tz] of [[2, -5], [2, 5], [10, -5], [10, 5], [6, 0]]) {
      c.roundTable(tx, tz, 0.8, 0xe8e2d2);
      c.chair(tx + 1.2, tz, -Math.PI / 2); c.chair(tx - 1.2, tz, Math.PI / 2);
    }
    for (let z = -8; z <= 8; z += 4) c.b.solid(13.4, y + 1.0, z, 0.5, 2.0, 3.4, P.panelWalnut);
    c.lamp(3, 0, 0xfff2d8, 1.0, 12); c.lamp(11, 0, 0xfff2d8, 1.0, 12);
    c.spawn(6, 0, "passenger1", 4);

    // ---- First Class Lounge, Louis Quinze
    c.room(-22, -9, -2, 9, "First Class Lounge", "public");
    c.wallZ(-9, 9, -2, P.panelWalnut, [door(0, 2.6)]);
    c.wallX(-22, -2, -9, P.panelWalnut, [door(-12)]);
    c.wallX(-22, -2, 9, P.panelWalnut, [door(-12)]);
    c.b.box(-12, y + 0.03, 0, 19.8, 0.06, 17.8, P.carpetRed);
    for (const z of [-6.5, 6.5]) { c.column(-6, z, 0.34, 0xe8dfc8); c.column(-18, z, 0.34, 0xe8dfc8); }
    for (const [tx, tz] of [[-6, -4], [-6, 4], [-11, 0], [-16, -4], [-16, 4], [-19, 0]]) {
      c.roundTable(tx, tz, 0.7, P.panelWalnut);
      c.chair(tx + 1.1, tz, -Math.PI / 2, 0x6b2f2c);
      c.chair(tx - 1.1, tz, Math.PI / 2, 0x6b2f2c);
      c.chair(tx, tz + 1.1, Math.PI, 0x6b2f2c);
    }
    c.b.solid(-21.5, y + 1.1, 0, 0.6, 2.2, 4.0, 0x4a2a18);            // carved fireplace
    c.glow.box(-21.2, y + 0.6, 0, 0.15, 0.7, 1.6, 0xff7a2a);
    c.lamp(-8, 0, 0xfff0d0, 1.1, 13); c.lamp(-17, 0, 0xfff0d0, 1.1, 13);
    c.spawn(-12, 0, "passenger1", 6);

    // ---- Smoking Room, mahogany and mother-of-pearl
    c.room(-46, -9, -30, 9, "First Class Smoking Room", "public");
    c.wallZ(-9, 9, -30, 0x4a2a18, [door(0, 2.2)]);
    c.wallZ(-9, 9, -46, 0x4a2a18, [door(0, 2.2)]);
    c.b.box(-38, y + 0.03, 0, 15.8, 0.06, 17.8, 0x5a2320);
    for (let x = -44; x <= -32; x += 4)
      for (const z of [-8.6, 8.6]) c.b.box(x, y + 1.3, z, 3.4, 2.2, 0.08, 0x4a2a18);
    for (const [tx, tz] of [[-34, -5], [-34, 5], [-39, 0], [-43, -5], [-43, 5]]) {
      c.roundTable(tx, tz, 0.65, 0x3a1c10);
      c.chair(tx + 1.0, tz, -Math.PI / 2, 0x2d5a3a);
      c.chair(tx - 1.0, tz, Math.PI / 2, 0x2d5a3a);
    }
    // "Plymouth Harbour" over the mantel, and a coal fire beneath it.
    c.b.solid(-46.3, y + 1.2, 0, 0.5, 2.4, 5.0, 0x3a1c10);
    c.glow.box(-45.9, y + 1.9, 0, 0.1, 1.3, 2.4, 0xc99a4a);
    c.glow.box(-45.9, y + 0.55, 0, 0.12, 0.6, 1.4, 0xff6a1a);
    c.lamp(-36, 0, 0xffcf90, 0.85, 12); c.lamp(-43, 0, 0xffcf90, 0.85, 12);
    c.spawn(-38, 0, "passenger1", 5);

    // ---- Verandah Café and Palm Court
    c.room(-56, -9, -46, 9, "Verandah Café & Palm Court", "public");
    c.b.box(-51, y + 0.03, 0, 9.8, 0.06, 17.8, 0xdad4c2);
    for (const [tx, tz] of [[-49, -5], [-49, 5], [-54, -5], [-54, 5]]) {
      c.roundTable(tx, tz, 0.6, 0xe8e2d2);
      c.chair(tx + 1.0, tz, -Math.PI / 2, 0xd8cfa8);
      c.chair(tx - 1.0, tz, Math.PI / 2, 0xd8cfa8);
    }
    for (const [px, pz] of [[-47, -8], [-47, 8], [-56, -8], [-56, 8]]) {
      c.b.cyl(px, y + 0.35, pz, 0.4, 0.7, 0x8a5a2a, null, 8);
      c.b.sphere(px, y + 1.4, pz, 1.0, 0x2f6b34, 1.2);
    }
    c.lamp(-51, 0, 0xe8f0d8, 0.8, 11);
    c.spawn(-51, 0, "passenger1", 3);
  }

  // ================================================================== B DECK
  function bDeck(c) {
    const y = c.y;

    c.room(28, -12, 48, 12, "First Class Staterooms — Forward", "cabins");
    const d1 = TT.cabinRun(c, 29, 47, -1.4, -10, 5, "first");
    const d2 = TT.cabinRun(c, 29, 47, 1.4, 10, 5, "first");
    TT.corridor(c, 28, 48, 0, 2.8, P.panelOak, d1, d2);

    // The parlour suites with their own private promenades.
    c.room(-8, -12, 14, 12, "Promenade Suites", "cabins");
    const d3 = TT.cabinRun(c, -7, 13, -1.4, -10, 4, "first");
    const d4 = TT.cabinRun(c, -7, 13, 1.4, 10, 4, "first");
    TT.corridor(c, -8, 14, 0, 2.8, P.panelWalnut, d3, d4);
    c.spawn(4, 0, "steward", 2);

    // ---- À la Carte Restaurant
    c.room(-46, -10, -30, 10, "À la Carte Restaurant", "public");
    c.wallZ(-10, 10, -30, 0xc0a878, [door(0, 2.4)]);
    c.b.box(-38, y + 0.03, 0, 15.8, 0.06, 19.8, 0x8a6a3a);
    for (let i = 0; i < 12; i++) {
      const tx = -44 + (i % 4) * 4, tz = -6 + Math.floor(i / 4) * 6;
      c.roundTable(tx, tz, 0.75, 0xf4f0e4);
      for (let k = 0; k < 4; k++)
        c.chair(tx + Math.cos(k * 1.57) * 1.15, tz + Math.sin(k * 1.57) * 1.15, -k * 1.57, 0xa07a4a);
    }
    for (const z of [-9.4, 9.4]) c.panelling(-46, -30, z, 0xc9ab7a, 1.6);
    c.lamp(-34, 0, 0xffeec8, 1.0, 13); c.lamp(-42, 0, 0xffeec8, 1.0, 13);
    c.spawn(-38, 0, "passenger1", 5);
    c.spawn(-36, -8, "steward", 2);

    // ---- Café Parisien: wicker chairs and ivy trellis along the starboard side
    c.room(-58, 2, -46, 11, "Café Parisien", "public");
    c.wallX(-58, -46, 2, 0xd8d0b8, [door(-52, 2.0)]);
    for (let i = 0; i < 5; i++) {
      const tx = -56 + i * 2.4;
      c.roundTable(tx, 6.5, 0.5, 0xefe8d6);
      c.chair(tx, 5.4, 0, 0xd8c898); c.chair(tx, 7.6, Math.PI, 0xd8c898);
    }
    for (let x = -58; x <= -46; x += 1.5) c.b.box(x, y + 1.6, 10.6, 0.09, 2.6, 0.09, 0x3a6b3a);
    c.lamp(-52, 6.5, 0xf0f4d8, 0.75, 10);
    c.spawn(-52, 6.5, "passenger1", 3);
  }

  // ================================================================== C DECK
  function cDeck(c) {
    const y = c.y;

    // Crew under the forecastle — forward of the open well deck, which is at
    // this same level and must stay clear.
    c.room(80, -10, 108, 10, "Seamen's Quarters", "crew");
    const dc1 = TT.cabinRun(c, 82, 106, -1.4, -8, 6, "crew");
    const dc2 = TT.cabinRun(c, 82, 106, 1.4, 8, 6, "crew");
    TT.corridor(c, 80, 108, 0, 2.8, P.linoleum, dc1, dc2);
    c.spawn(94, 0, "crew", 4);

    // Purser and Enquiry Office at the head of the staircase.
    c.room(27, -8, 36, 8, "Purser's Office", "public");
    c.wallZ(-8, 8, 27, P.panelOak, [door(-3), door(3)]);
    c.b.solid(31, y + 0.55, -4, 4.0, 1.1, 1.0, P.panelWalnut);
    c.b.solid(31, y + 0.55, 4, 4.0, 1.1, 1.0, P.panelWalnut);
    c.b.box(31, y + 1.6, -4.4, 4.0, 1.0, 0.15, P.panelWalnut);
    c.lamp(31, 0, 0xffdca8, 0.8, 10);
    c.spawn(31, -2.5, "steward", 2);

    c.room(-20, -12, 14, 12, "First Class Staterooms", "cabins");
    const d1 = TT.cabinRun(c, -19, 13, -1.4, -10, 8, "first");
    const d2 = TT.cabinRun(c, -19, 13, 1.4, 10, 8, "first");
    TT.corridor(c, -20, 14, 0, 2.8, P.panelOak, d1, d2);

    // Second Class Library.
    c.room(-46, -9, -32, 9, "Second Class Library", "public");
    c.wallZ(-9, 9, -32, P.panelOak, [door(0, 2.2)]);
    c.b.box(-39, y + 0.03, 0, 13.8, 0.06, 17.8, 0x3a5a44);
    for (const [tx, tz] of [[-35, -5], [-35, 5], [-40, 0], [-44, -5], [-44, 5]]) {
      c.table(tx, tz, 1.6, 0.9, P.panelWalnut);
      c.chair(tx, tz + 0.9, Math.PI, P.panelWalnut);
      c.chair(tx, tz - 0.9, 0, P.panelWalnut);
    }
    for (let z = -8; z <= 8; z += 3.2) c.b.solid(-46.2, y + 1.1, z, 0.5, 2.2, 2.8, P.panelWalnut);
    c.lamp(-38, 0, 0xffe8c0, 0.9, 12);
    c.spawn(-39, 0, "passenger2", 4);

    // Third Class General Room, right aft over the screws and under the poop —
    // clear of the open aft well deck, which is at this same level.
    c.room(-110, -11, -90, 11, "Third Class General Room", "public");
    c.wallZ(-11, 11, -90, 0xd8cfa8, [door(0, 2.4)]);
    c.b.box(-100, y + 0.03, 0, 19.8, 0.06, 21.8, 0xa89878);
    for (let i = 0; i < 10; i++) {
      const tx = -107 + (i % 5) * 3.6, tz = -5 + Math.floor(i / 5) * 10;
      c.table(tx, tz, 1.8, 0.8, 0xc2a878);
      c.b.solid(tx, y + 0.42, tz + 0.75, 1.8, 0.1, 0.35, 0xc2a878);
      c.b.solid(tx, y + 0.42, tz - 0.75, 1.8, 0.1, 0.35, 0xc2a878);
    }
    c.b.solid(-110.2, y + 0.6, 6, 0.6, 1.2, 2.2, 0x4a3a22);             // upright piano
    c.lamp(-94, 0, 0xffe4b8, 0.85, 13); c.lamp(-105, 0, 0xffe4b8, 0.85, 13);
    c.spawn(-100, 0, "passenger3", 8);
  }

  // ================================================================== D DECK
  function dDeck(c) {
    const y = c.y;

    // ---- First Class Dining Saloon: 114 feet, the full breadth of the ship.
    // It sits forward of the staircase, as on the real ship.
    c.room(30, -13, 60, 13, "First Class Dining Saloon", "grand");
    c.wallZ(-13, 13, 30, 0xe4dcc4, [door(-6, 2.4), door(6, 2.4)]);
    c.wallZ(-13, 13, 60, 0xe4dcc4, [door(0, 2.4)]);
    c.b.box(45, y + 0.03, 0, 29.8, 0.06, 25.8, 0x9a7a4a);            // linoleum tiles
    for (const z of [-9, 9]) for (let x = 34; x <= 56; x += 5.5) c.column(x, z, 0.32, 0xefe8d4);
    // Long refectory tables with their swivel chairs.
    for (let i = 0; i < 18; i++) {
      const tx = 33 + (i % 6) * 4.6, tz = -8 + Math.floor(i / 6) * 8;
      c.table(tx, tz, 2.6, 1.1, 0xf6f2e6, P.panelWalnut);
      for (const s of [-1, 1]) {
        c.chair(tx - 0.7, tz + s * 0.95, s > 0 ? Math.PI : 0, P.panelWalnut);
        c.chair(tx + 0.7, tz + s * 0.95, s > 0 ? Math.PI : 0, P.panelWalnut);
      }
      c.glow.box(tx, y + 0.83, tz, 0.1, 0.16, 0.1, 0xfff0c0);        // table lamp
    }
    for (const z of [-12.4, 12.4]) c.panelling(31, 59, z, 0xefe8d4, 1.8);
    for (let x = 34; x <= 56; x += 7) { c.lamp(x, -6, 0xfff2dc, 1.0, 13); c.lamp(x, 6, 0xfff2dc, 1.0, 13); }
    c.spawn(45, 0, "passenger1", 10);
    c.spawn(38, -10, "steward", 4);

    // ---- Reception Room, at the foot of the Forward Grand Staircase
    c.room(12, -11, 30, 11, "Reception Room", "grand");
    c.b.box(21, y + 0.03, 0, 17.8, 0.06, 21.8, P.carpetRed);
    for (const [tx, tz] of [[16, -8.5], [16, 8.5], [28, -8.5], [28, 8.5], [21, 9]]) {
      if (TT.inStairwell(tx, tz)) continue;
      c.roundTable(tx, tz, 0.7, 0xefe8d4);
      c.chair(tx + 1.1, tz, -Math.PI / 2, 0x7a4a2a);
      c.chair(tx - 1.1, tz, Math.PI / 2, 0x7a4a2a);
    }
    c.b.solid(12.4, y + 0.5, 8, 0.5, 1.0, 3.0, P.panelWalnut);
    c.lamp(21, 8, 0xffeeca, 1.05, 14);
    c.spawn(20, 9, "passenger1", 5);

    // ---- Second Class Dining Saloon, clear of the aft stairwell
    c.room(-46, -11, -32, 11, "Second Class Dining Saloon", "public");
    c.wallZ(-11, 11, -32, 0xe0d8c0, [door(0, 2.2)]);
    c.wallZ(-11, 11, -46, 0xe0d8c0, [door(0, 2.2)]);
    c.b.box(-39, y + 0.03, 0, 13.8, 0.06, 21.8, 0x8a7a5a);
    for (let i = 0; i < 8; i++) {
      const tx = -44 + (i % 4) * 3.4, tz = -6 + Math.floor(i / 4) * 12;
      c.table(tx, tz, 2.4, 1.0, 0xf0ead8, P.panelOak);
      c.b.solid(tx, y + 0.44, tz + 0.85, 2.4, 0.1, 0.35, P.panelOak);
      c.b.solid(tx, y + 0.44, tz - 0.85, 2.4, 0.1, 0.35, P.panelOak);
    }
    c.lamp(-35, 0, 0xffeec8, 0.9, 13); c.lamp(-43, 0, 0xffeec8, 0.9, 13);
    c.spawn(-39, 0, "passenger2", 7);

    // ---- Galley between the two saloons, serving both
    c.room(-62, -10, -48, 10, "Galley", "crew");
    c.wallZ(-10, 10, -48, P.linoleum, [door(-4), door(4)]);
    for (let x = -60; x <= -50; x += 3.2) {
      c.b.solid(x, y + 0.5, -6, 2.4, 1.0, 1.4, 0x9aa2ac);
      c.b.solid(x, y + 0.5, 6, 2.4, 1.0, 1.4, 0x9aa2ac);
    }
    c.b.solid(-55, y + 0.85, 0, 8.0, 1.7, 2.4, 0x5a6068);              // ranges
    c.glow.box(-55, y + 0.5, 1.3, 6.0, 0.35, 0.1, 0xff7a2a);
    c.lampRun(-60, -50, 0, 4, 0xdfe8f0, 0.8);
    c.spawn(-55, 0, "cook", 4);
  }

  // ================================================================== E DECK
  function eDeck(c) {
    const y = c.y;

    // "Scotland Road": the long working alleyway down the port side.
    c.room(-72, -10.5, 64, -6.5, "Scotland Road", "corridor");
    c.wallX(-72, 64, -10.6, P.linoleum, [
      door(-60), door(-46), door(-30), door(-14), door(2), door(18), door(34), door(50)
    ]);
    c.wallX(-72, 64, -6.4, P.linoleum, [
      door(-56), door(-40), door(-24), door(-8), door(8), door(24), door(40), door(56)
    ]);
    for (let x = -70; x < 64; x += 7) c.lamp(x, -8.5, 0xffe0b0, 0.7, 8);
    c.spawn(20, -8.5, "crew", 4);
    c.spawn(-30, -8.5, "steward", 3);

    // Crew berths forward off Scotland Road.
    c.room(38, -6.4, 64, 2, "Firemen's & Trimmers' Quarters", "crew");
    TT.cabinRun(c, 40, 62, -5.5, -1.0, 6, "crew");
    c.spawn(50, -3, "stoker", 4);

    // First and second class cabins amidships, starboard side.
    c.room(-18, 2, 30, 12, "Second Class Staterooms", "cabins");
    const d1 = TT.cabinRun(c, -16, 28, 4.4, 11.5, 10, "first");
    TT.corridor(c, -18, 30, 3.0, 2.8, P.panelOak, null, d1);

    // Third class berths aft.
    c.room(-96, -11, -66, 11, "Third Class Berths", "cabins");
    const d2 = TT.cabinRun(c, -94, -68, -1.4, -9, 7, "crew");
    const d3 = TT.cabinRun(c, -94, -68, 1.4, 9, 7, "crew");
    TT.corridor(c, -96, -66, 0, 2.8, P.linoleum, d2, d3);
    c.spawn(-80, 0, "passenger3", 6);
  }

  // ================================================================== F DECK
  function fDeck(c) {
    const y = c.y;

    // ---- The Swimming Bath: one of the first afloat
    c.room(26, 1, 40, 12, "Swimming Bath", "public");
    c.wallZ(1, 12, 26, 0xdcd6c4, [door(6.5, 2.0)]);
    c.wallX(26, 40, 1, 0xdcd6c4, [door(33, 2.0)]);
    const px0 = 28, px1 = 38, pz0 = 3, pz1 = 10.5;
    c.b.box((px0 + px1) / 2, y + 0.02, (pz0 + pz1) / 2, 13, 0.05, 10.5, 0x2f6f8f);  // tiled surround
    // basin walls
    c.b.solid((px0 + px1) / 2, y - 0.7, pz0 - 0.3, px1 - px0 + 1, 1.5, 0.6, 0x9fd2e2);
    c.b.solid((px0 + px1) / 2, y - 0.7, pz1 + 0.3, px1 - px0 + 1, 1.5, 0.6, 0x9fd2e2);
    c.b.solid(px0 - 0.3, y - 0.7, (pz0 + pz1) / 2, 0.6, 1.5, pz1 - pz0 + 1, 0x9fd2e2);
    c.b.solid(px1 + 0.3, y - 0.7, (pz0 + pz1) / 2, 0.6, 1.5, pz1 - pz0 + 1, 0x9fd2e2);
    c.b.box((px0 + px1) / 2, y - 1.45, (pz0 + pz1) / 2, px1 - px0, 0.1, pz1 - pz0, 0x7fc0d8);
    // the water itself
    c.glass.box((px0 + px1) / 2, y - 0.35, (pz0 + pz1) / 2, px1 - px0, 0.06, pz1 - pz0, 0x3ea8c8);
    TT.poolSurface = { x0: px0, x1: px1, z0: pz0, z1: pz1, y: y - 0.35 };
    c.lamp(30, 6.5, 0xdff0ff, 0.9, 11); c.lamp(36, 6.5, 0xdff0ff, 0.9, 11);
    c.spawn(33, 2, "passenger1", 2);

    // ---- Turkish Baths: the cooling room, in Arabian style
    c.room(26, -12, 40, -1, "Turkish Baths — Cooling Room", "public");
    c.wallZ(-12, -1, 26, 0x7a2a24, [door(-6.5, 2.0)]);
    c.b.box(33, y + 0.03, -6.5, 13.8, 0.06, 10.8, 0x5a1f1a);
    for (let i = 0; i < 6; i++) {
      const cx = 28 + (i % 3) * 4.5, cz = -3.5 - Math.floor(i / 3) * 5;
      c.b.solid(cx, y + 0.35, cz, 1.9, 0.7, 0.8, 0x2a4a6a);           // curtained cubicles
      c.b.box(cx, y + 1.5, cz - 0.5, 2.0, 1.6, 0.08, 0x1f3a5a);
    }
    for (const [cx, cz] of [[27.5, -11], [39, -11], [27.5, -2], [39, -2]])
      c.column(cx, cz, 0.28, 0xc9a24a);
    c.lamp(30, -6.5, 0xffb060, 0.8, 10); c.lamp(37, -6.5, 0xffb060, 0.8, 10);

    // ---- Third Class Dining Saloons, port and starboard of the centreline
    c.room(-8, -12, 22, 12, "Third Class Dining Saloon", "public");
    c.wallZ(-12, 12, -8, 0xe0dac8, [door(0, 2.4)]);
    c.wallZ(-12, 12, 22, 0xe0dac8, [door(-6, 2.0), door(6, 2.0)]);
    c.b.box(7, y + 0.03, 0, 29.8, 0.06, 23.8, 0x9a8a68);
    for (let i = 0; i < 14; i++) {
      const tx = -5 + (i % 7) * 4, tz = -6 + Math.floor(i / 7) * 12;
      c.table(tx, tz, 2.6, 0.85, 0xefe6d0, P.teakDark);
      c.b.solid(tx, y + 0.44, tz + 0.8, 2.6, 0.1, 0.32, P.teakDark);
      c.b.solid(tx, y + 0.44, tz - 0.8, 2.6, 0.1, 0.32, P.teakDark);
    }
    for (let x = -4; x <= 20; x += 8) { c.lamp(x, -6, 0xffe8c0, 0.85, 12); c.lamp(x, 6, 0xffe8c0, 0.85, 12); }
    c.spawn(7, 0, "passenger3", 10);

    // The squash court below is thirty feet high, so F deck opens over it.
    // This well must sit exactly above the court on G, at 62..76.
    c.hole(68, -6, 82, 6, { well: true });
    c.room(66, -8, 84, 8, "Squash Court Gallery", "public");
    c.railWell(67.8, -6.3, 82.2, 6.3, P.brass);
    c.lamp(75, -7.4, 0xdfe8f0, 0.7, 9);

    // Crew and stores aft.
    c.room(-70, -11, -40, 11, "Third Class Berths", "cabins");
    const d1 = TT.cabinRun(c, -68, -42, -1.4, -9, 7, "crew");
    const d2 = TT.cabinRun(c, -68, -42, 1.4, 9, 7, "crew");
    TT.corridor(c, -70, -40, 0, 2.8, P.linoleum, d1, d2);
    c.spawn(-55, 0, "passenger3", 5);
  }

  // ================================================================== G DECK
  // G deck exists only forward of the boiler rooms and abaft the turbine room:
  // amidships, the machinery spaces rise straight through it.
  function gDeck(c) {
    const y = c.y;
    c.h = 2.62;

    // ---- Squash Racquet Court, thirty feet high through two decks.
    // Sits clear of the Firemen's Stair shaft at 54..66.
    c.room(68, -6, 82, 6, "Squash Racquet Court", "public");
    c.b.box(75, y + 0.03, 0, 13.8, 0.06, 11.8, 0xd8cfae);
    c.wallZ(-6, 6, 68, 0xf0ece0, [door(0, 1.6)], 5.4);
    c.wallZ(-6, 6, 82, 0xf0ece0, null, 5.4);
    c.wallX(68, 82, -6, 0xf0ece0, null, 5.4);
    c.wallX(68, 82, 6, 0xf0ece0, null, 5.4);
    c.lamp(71, 0, 0xeef4ff, 0.9, 12); c.lamp(79, 0, 0xeef4ff, 0.9, 12);
    c.spawn(75, 0, "passenger1", 1);

    // ---- Post Office: five clerks sorting 3,400 sacks of mail
    c.room(84, -9, 100, 9, "Post Office & Mail Sorting Room", "crew");
    c.wallZ(-9, 9, 84, P.linoleum, [door(0, 2.0)]);
    for (let i = 0; i < 6; i++) {
      const tx = 86 + (i % 3) * 4.5, tz = -5 + Math.floor(i / 3) * 10;
      c.table(tx, tz, 2.2, 1.0, P.teakDark);
      for (let k = 0; k < 6; k++)
        c.b.box(tx - 0.8 + (k % 3) * 0.8, y + 0.88, tz + (k < 3 ? -0.2 : 0.2), 0.6, 0.16, 0.4, 0xbfa878);
    }
    for (let z = -8; z <= 8; z += 2.5) c.b.solid(100.2, y + 1.2, z, 0.6, 2.4, 2.2, P.teakDark);
    c.lampRun(86, 98, 0, 5, 0xdfe8f0, 0.75);
    c.spawn(91, 0, "crew", 3);

    // ---- Firemen's quarters, with the tunnel leading down to Boiler Room 6
    c.room(102, -8, 114, 8, "Firemen's Quarters", "crew");
    const d1 = TT.cabinRun(c, 103, 113, -1.4, -7, 3, "crew");
    const d2 = TT.cabinRun(c, 103, 113, 1.4, 7, 3, "crew");
    TT.corridor(c, 102, 114, 0, 2.6, P.linoleum, d1, d2);
    c.spawn(108, 0, "stoker", 4);

    // ---- Aft: baggage and provisions over the shaft tunnel
    c.room(-116, -9, -92, 9, "Baggage & Provision Room", "hold");
    for (let x = -114; x < -94; x += 4)
      for (const z of [-6.5, 0, 6.5]) {
        if (TT.inStairwell(x, z, 1.6)) continue;   // never stack cargo on a stair
        c.b.solid(x, y + 0.7, z, 2.2, 1.4, 1.6, 0x7a5a34);
        c.b.box(x, y + 1.45, z, 2.3, 0.1, 1.7, 0x4a3720);
      }
    c.lampRun(-112, -96, 0, 7, 0xbfd0e0, 0.6);
    c.spawn(-104, 0, "crew", 2);
  }

  // ================================================================= ORLOP
  function orlopDeck(c) {
    const y = c.y;
    c.h = 2.72;

    c.room(80, -9, 108, 9, "No. 2 Cargo Hold", "hold");
    for (let x = 82; x < 106; x += 5)
      for (const z of [-6, 0, 6]) {
        if (TT.inStairwell(x, z, 1.6)) continue;
        const hgt = 1.2 + ((x + z) % 3) * 0.4;
        c.b.solid(x, y + hgt / 2, z, 2.6, hgt, 2.2, 0x6f5230);
        c.b.box(x, y + hgt / 2, z, 2.7, 0.12, 2.3, 0x4a3720);
      }
    c.lampRun(84, 104, 0, 9, 0xa8c0d4, 0.55);

    // William Carter's crated Renault — the ship's most famous piece of cargo.
    c.room(58, -9, 78, 9, "No. 3 Hold — Motor Car", "hold");
    c.b.solid(68, y + 0.55, 0, 4.6, 1.1, 2.0, 0x2a1f14);
    c.b.solid(68.6, y + 1.35, 0, 2.2, 0.7, 1.7, 0x1f1a12);
    for (const [wx, wz] of [[66.4, -0.85], [66.4, 0.85], [69.8, -0.85], [69.8, 0.85]])
      c.b.cyl(wx, y + 0.45, wz, 0.42, 0.22, 0x14100c, { x: Math.PI / 2 }, 10);
    for (let x = 60; x < 66; x += 3)
      for (const z of [-6, 6]) {
        if (TT.inStairwell(x, z, 1.6)) continue;
        c.b.solid(x, y + 0.8, z, 2.4, 1.6, 1.8, 0x6f5230);
      }
    c.lamp(68, 0, 0xbfd0e0, 0.7, 10);
    TT.interact(68, y + 1.6, 2.4, "Renault Type CB Coupé de Ville",
                "Examine the motor car", () => {
      TT.ui.say("Crated on the orlop: a 25 hp Renault, shipped by William Carter of "
              + "Philadelphia. Cargo manifest value, $5,000.");
    }, 3.2);

    c.room(-116, -9, -92, 9, "Refrigerated Stores", "hold");
    for (let x = -114; x < -94; x += 4)
      for (const z of [-6, 6]) {
        if (TT.inStairwell(x, z, 1.6)) continue;
        c.b.solid(x, y + 0.9, z, 3.0, 1.8, 2.0, 0x8fa0a8);
      }
    c.lampRun(-112, -96, 0, 8, 0xbfd8e8, 0.5);
    c.spawn(-104, 0, "crew", 2);
  }

  // ============================================================ build it all
  TT.buildInterior = function (root) {
    const ctxs = {};
    for (const d of TT.DECKS) ctxs[d.id] = new TT.DeckCtx(d);

    boatDeck(ctxs.boat);
    aDeck(ctxs.a);
    bDeck(ctxs.b);
    cDeck(ctxs.c);
    dDeck(ctxs.d);
    eDeck(ctxs.e);
    fDeck(ctxs.f);
    gDeck(ctxs.g);
    orlopDeck(ctxs.orlop);
    TT.buildMachinery(ctxs.tank, ctxs);

    // ---- vertical circulation
    TT.STAIRWELLS.forEach(cfg => TT.buildStairwell(ctxs, cfg));

    // ---- commit
    ctxs.boat.finish(root, { noSole: true, noHead: true, noLiner: true });
    ctxs.a.finish(root, { x0: -58, x1: 50, inset: 2.7, noSole: true,
                          headColor: 0xe2dccc, linerColor: 0xd8d2c0 });
    ctxs.b.finish(root, { x0: -60, x1: 50, inset: 1.7, soleColor: P.carpetRed,
                          headColor: 0xe2dccc, linerColor: 0xd8d2c0 });
    ctxs.c.finish(root, { x0: -110, x1: 100, inset: 1.0, soleColor: 0x8a7a62 });
    ctxs.d.finish(root, { x0: -110, x1: 100, inset: 1.0, soleColor: 0x8a7a62 });
    ctxs.e.finish(root, { x0: -112, x1: 92, inset: 1.0, soleColor: P.linoleum });
    ctxs.f.finish(root, { x0: -112, x1: 92, inset: 1.0, soleColor: P.linoleum });
    ctxs.g.finish(root, { ranges: [[-120, -88], [52, 118]], inset: 1.0, soleColor: 0x6f6a5c,
                          headColor: 0x4a4740, linerColor: P.rust });
    ctxs.orlop.finish(root, { ranges: [[-120, -88], [52, 118]], inset: 1.0, soleColor: 0x54504a,
                              headColor: 0x3c3a36, linerColor: P.rust });
    ctxs.tank.finish(root, { x0: -114, x1: 70, inset: 1.2, soleColor: 0x2e2f31,
                             linerColor: P.rust, noHead: true });

    TT.deckCtxs = ctxs;
    return ctxs;
  };

})(window.TT);
