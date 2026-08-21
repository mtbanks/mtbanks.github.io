/* ============================================================================
   audio.js — everything is synthesised at runtime. No files, no downloads.
   The mix changes with where you are standing: wind on the boat deck, the
   roar of 159 furnaces on the tank top, machinery in the engine room.
   ========================================================================== */
(function (TT) {
  "use strict";

  const A = {
    ctx: null, ready: false, master: null,
    nodes: {}, muted: false, currentAmb: ""
  };
  TT.audio = A;

  function noiseBuffer(ctx, seconds, brown) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  function loopSource(ctx, buf, dest, filterType, freq, q) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(dest);
    s.start();
    return { src: s, filter: f, gain: g };
  }

  A.init = function () {
    if (A.ready) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      const ctx = A.ctx = new Ctor();
      const master = A.master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      const brown = noiseBuffer(ctx, 3, true);
      const white = noiseBuffer(ctx, 3, false);

      A.nodes.engine = loopSource(ctx, brown, master, "lowpass", 130);
      A.nodes.furnace = loopSource(ctx, brown, master, "lowpass", 340);
      A.nodes.wind = loopSource(ctx, white, master, "bandpass", 520, 0.7);
      A.nodes.sea = loopSource(ctx, white, master, "lowpass", 780);
      A.nodes.hiss = loopSource(ctx, white, master, "highpass", 2600);
      A.nodes.water = loopSource(ctx, white, master, "bandpass", 900, 1.2);

      // The deep beat of the reciprocating engines.
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 27;
      const og = ctx.createGain();
      og.gain.value = 0;
      osc.connect(og); og.connect(master);
      osc.start();
      A.nodes.thrum = { osc, gain: og };

      A.ready = true;
    } catch (e) { /* audio is a nicety, never a requirement */ }
  };

  function ramp(node, v, t) {
    if (!node) return;
    const g = node.gain ? node.gain.gain : node;
    g.setTargetAtTime(A.muted ? 0 : v, A.ctx.currentTime, t || 0.4);
  }

  /** Set the ambient bed. `where` is one of: deck, inside, boiler, engine, shaft. */
  A.ambience = function (where, rpmFrac, floodFrac) {
    if (!A.ready) return;
    const n = A.nodes;
    const r = TT.clamp(rpmFrac, 0, 1.2);
    const f = floodFrac || 0;
    switch (where) {
      case "deck":
        ramp(n.engine, 0.05 * r, 0.6); ramp(n.furnace, 0, 0.6);
        ramp(n.wind, 0.035 + r * 0.05, 0.6); ramp(n.sea, 0.05 + r * 0.05, 0.6);
        ramp(n.hiss, 0, 0.6); ramp(n.thrum, 0.025 * r, 0.6);
        break;
      case "boiler":
        ramp(n.engine, 0.10 * r, 0.6); ramp(n.furnace, 0.20 + r * 0.14, 0.6);
        ramp(n.wind, 0, 0.6); ramp(n.sea, 0, 0.6);
        ramp(n.hiss, 0.030, 0.6); ramp(n.thrum, 0.075 * r, 0.6);
        break;
      case "engine":
        ramp(n.engine, 0.22 * r, 0.6); ramp(n.furnace, 0.05, 0.6);
        ramp(n.wind, 0, 0.6); ramp(n.sea, 0, 0.6);
        ramp(n.hiss, 0.045, 0.6); ramp(n.thrum, 0.11 * r, 0.6);
        break;
      case "shaft":
        ramp(n.engine, 0.14 * r, 0.6); ramp(n.furnace, 0, 0.6);
        ramp(n.wind, 0, 0.6); ramp(n.sea, 0.03, 0.6);
        ramp(n.hiss, 0.02, 0.6); ramp(n.thrum, 0.09 * r, 0.6);
        break;
      default:                                  // inside the accommodation
        ramp(n.engine, 0.05 * r, 0.6); ramp(n.furnace, 0.012 * r, 0.6);
        ramp(n.wind, 0.006, 0.6); ramp(n.sea, 0.018, 0.6);
        ramp(n.hiss, 0, 0.6); ramp(n.thrum, 0.045 * r, 0.6);
    }
    ramp(n.water, f * 0.13, 1.2);
    if (n.thrum && n.thrum.osc)
      n.thrum.osc.frequency.setTargetAtTime(18 + r * 16, A.ctx.currentTime, 0.5);
  };

  // -------------------------------------------------------------------- cues
  A.blip = function (freq, dur, type, vol) {
    if (!A.ready || A.muted) return;
    const ctx = A.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(A.master);
    o.start(); o.stop(ctx.currentTime + dur);
  };

  /** The crow's nest bell: three strikes means dead ahead. */
  A.bell = function (times) {
    if (!A.ready) return;
    for (let i = 0; i < (times || 1); i++)
      setTimeout(() => {
        A.blip(784, 1.5, "sine", 0.14);
        A.blip(1180, 1.1, "sine", 0.07);
        A.blip(2360, 0.6, "sine", 0.03);
      }, i * 460);
  };

  A.telegraph = function () {
    A.blip(1180, 0.35, "square", 0.05);
    setTimeout(() => A.blip(880, 0.4, "square", 0.045), 150);
  };

  A.impact = function () {
    if (!A.ready) return;
    const ctx = A.ctx;
    // A long tearing rumble, not a bang: she never really shuddered.
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 4, true);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 260; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.42, ctx.currentTime + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.6);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(); s.stop(ctx.currentTime + 4);
    A.blip(48, 2.4, "triangle", 0.12);
  };

  A.groan = function () {
    if (!A.ready) return;
    const ctx = A.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 5);
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 6);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 400;
    o.connect(f); f.connect(g); g.connect(A.master);
    o.start(); o.stop(ctx.currentTime + 6);
  };

  A.rumble = function (vol, dur) {
    if (!A.ready) return;
    const ctx = A.ctx;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 2, true);
    const g = ctx.createGain();
    g.gain.setValueAtTime((vol || 0.4) * 0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 1.2));
    s.connect(g); g.connect(A.master);
    s.start(); s.stop(ctx.currentTime + (dur || 1.2));
  };

  A.toggleMute = function () {
    A.muted = !A.muted;
    if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.85, A.ctx.currentTime, 0.1);
    return A.muted;
  };

})(window.TT);
