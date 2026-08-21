/* ============================================================================
   ui.js — heads-up display, message log, modals and the end cards.
   Plain DOM over the canvas; the styling lives in index.html.
   ========================================================================== */
(function (TT) {
  "use strict";

  const $ = id => document.getElementById(id);
  const UI = { modalOpen: false, logItems: [] };
  TT.ui = UI;

  let el = {};

  UI.init = function () {
    el = {
      hudLoc:    $("hud-loc"),
      hudRoom:   $("hud-room"),
      hudComp:   $("hud-comp"),
      clock:     $("hud-clock"),
      date:      $("hud-date"),
      barFill:   $("bar-fill"),
      barShip:   $("bar-ship"),
      barMiles:  $("bar-miles"),
      heading:   $("i-heading"),
      helmNeedle:$("i-helm-needle"),
      rudder:    $("i-rudder"),
      telegraph: $("i-telegraph"),
      knots:     $("i-knots"),
      rpm:       $("i-rpm"),
      steam:     $("i-steam"),
      coal:      $("i-coal"),
      prompt:    $("prompt"),
      banner:    $("banner"),
      log:       $("log"),
      modal:     $("modal"),
      modalBody: $("modal-body"),
      damage:    $("damage"),
      dmgList:   $("dmg-list"),
      dmgBar:    $("dmg-bar"),
      vignette:  $("vignette"),
      title:     $("title"),
      endCard:   $("end"),
      endBody:   $("end-body"),
      endTitle:  $("end-title"),
      compass:   $("compass-strip"),
      help:      $("help"),
      helpToggle:$("help-toggle")
    };

    document.addEventListener("keydown", e => {
      if (e.code === "Escape" && UI.modalOpen) { UI.closeModal(); e.preventDefault(); }
      if (UI.modalOpen && /^Digit[1-8]$/.test(e.code)) {
        const i = parseInt(e.code.slice(5), 10) - 1;
        if (UI.modalPick) UI.modalPick(i);
      }
    });
    $("modal-close").addEventListener("click", () => UI.closeModal());

    // Controls card, bottom right. Nobody remembers twelve hotkeys.
    el.helpToggle.addEventListener("click", () => UI.toggleHelp());
    document.addEventListener("keydown", e => {
      if (UI.modalOpen) return;
      if (e.key === "?" || e.key === "/") { UI.toggleHelp(); e.preventDefault(); }
    });
  };

  UI.toggleHelp = function (force) {
    const collapsed = force !== undefined ? !force : !el.help.classList.contains("collapsed");
    el.help.classList.toggle("collapsed", collapsed);
    el.helpToggle.querySelector(".chev").textContent = collapsed ? "+" : "–";
    try { localStorage.setItem("tt-help", collapsed ? "0" : "1"); } catch (_) {}
  };

  UI.restoreHelp = function () {
    let want = "1";
    try { want = localStorage.getItem("tt-help") || "1"; } catch (_) {}
    UI.toggleHelp(want === "1");
  };

  // -------------------------------------------------------------------- log
  UI.say = function (text, cls) {
    const d = document.createElement("div");
    d.className = "log-item" + (cls ? " " + cls : "");
    d.textContent = text;
    el.log.appendChild(d);
    UI.logItems.push(d);
    while (UI.logItems.length > 7) {
      const old = UI.logItems.shift();
      if (old.parentNode) old.parentNode.removeChild(old);
    }
    setTimeout(() => { d.classList.add("fade"); }, 11000);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 13000);
  };

  UI.flash = function (text, color) {
    const d = document.createElement("div");
    d.className = "log-item flashy";
    if (color) d.style.borderLeftColor = color;
    d.textContent = text;
    el.log.appendChild(d);
    UI.logItems.push(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 13000);
  };

  UI.banner = function (text, sub, ms) {
    el.banner.innerHTML = '<div class="banner-main">' + text + "</div>"
      + (sub ? '<div class="banner-sub">' + sub + "</div>" : "");
    el.banner.classList.add("show");
    clearTimeout(UI._bannerT);
    UI._bannerT = setTimeout(() => el.banner.classList.remove("show"), ms || 4200);
  };

  UI.lookout = function (call) {
    UI.banner(call, "Three bells from the crow's nest — hard over, and pray she answers", 6000);
    el.vignette.classList.add("alarm");
    setTimeout(() => el.vignette.classList.remove("alarm"), 2600);
  };

  UI.wireless = function (from, text) {
    UI.flash("⚡ WIRELESS — " + from + ": " + text, "#7fc8e8");
  };

  UI.impact = function (n, side, knots, glancing) {
    UI.banner(glancing ? "SHE HAS STRUCK" : "COLLISION",
      glancing
        ? "A grinding shudder down the " + side + " side at " + knots.toFixed(1) + " knots"
        : "Square on the bow at " + knots.toFixed(1) + " knots", 7000);
    el.vignette.classList.add("alarm");
    setTimeout(() => el.vignette.classList.remove("alarm"), 5000);
    el.damage.classList.add("show");
  };

  UI.andrews = function (n) {
    const fatal = n >= 5;
    UI.flash("Thomas Andrews has been below with the carpenter. " + n
      + (n === 1 ? " compartment is" : " compartments are") + " open to the sea.", "#e8a060");
    setTimeout(() => {
      UI.flash(fatal
        ? '"She is made of iron, sir — she will go down. It is a mathematical certainty. '
          + 'An hour and a half, perhaps two."'
        : '"She will swim, sir. Down by the head, but she will swim. Get the pumps on her."',
        fatal ? "#ff8060" : "#9fe0b0");
    }, 5200);
  };

  // ------------------------------------------------------------------ modals
  UI.openModal = function (title, html, picker) {
    el.modalBody.innerHTML = '<h2>' + title + "</h2>" + html;
    el.modal.classList.add("show");
    UI.modalOpen = true;
    UI.modalPick = picker || null;
    if (document.pointerLockElement) document.exitPointerLock();
  };

  UI.closeModal = function () {
    el.modal.classList.remove("show");
    UI.modalOpen = false;
    UI.modalPick = null;
  };

  UI.openTelegraph = function () {
    const T = TT.nav.TELEGRAPH;
    let h = '<p class="mono">The engine order telegraph. Ring an order down to the engine '
          + 'room and the engineers will answer it — but forty-six thousand tons take '
          + 'their own sweet time about obeying.</p><ol class="choices">';
    T.forEach((t, i) => {
      const cur = i === TT.nav.state.telegraph ? " current" : "";
      h += '<li class="choice' + cur + '" data-i="' + i + '"><b>' + (i + 1) + "</b> "
         + t.order + '<span class="dim">' + (t.rpm >= 0 ? "+" : "") + t.rpm + " rpm</span></li>";
    });
    h += "</ol>";
    UI.openModal("Engine Order Telegraph", h, i => {
      TT.nav.setTelegraph(i);
      UI.closeModal();
    });
    el.modalBody.querySelectorAll(".choice").forEach(node => {
      node.addEventListener("click", () => {
        TT.nav.setTelegraph(parseInt(node.dataset.i, 10));
        UI.closeModal();
      });
    });
  };

  UI.showChart = function () {
    const st = TT.nav.state;
    const remaining = Math.max(0, st.milesTotal - st.milesRun);
    const hrs = st.knots > 0.5 ? remaining / st.knots : Infinity;
    UI.openModal("Chart Room", '<div class="mono">'
      + row("Departed", "Southampton, 10 April 1912")
      + row("Bound for", "New York — Pier 54, North River")
      + row("Distance run", st.milesRun.toFixed(1) + " nautical miles")
      + row("Distance to run", remaining.toFixed(1) + " nautical miles")
      + row("Course", TT.nav.compassText())
      + row("Speed", st.knots.toFixed(1) + " knots")
      + row("Estimated arrival", isFinite(hrs)
          ? (hrs / 24).toFixed(1) + " days at present speed" : "— (stopped)")
      + row("Ice warnings received", String(st.warnings))
      + row("Watertight doors", st.wtDoorsClosed ? "CLOSED" : "open")
      + "</div>");
  };

  function row(a, b) {
    return '<div class="krow"><span>' + a + "</span><span>" + b + "</span></div>";
  }

  UI.showTelegrams = function () {
    const t = TT.nav.telegrams;
    let h = '<p class="mono">The Marconi room handles passenger traffic to Cape Race. '
          + 'Ice reports are passed to the bridge when there is time for them.</p>';
    if (!t.length) h += '<p class="dim">No ice reports logged yet this watch.</p>';
    t.slice().reverse().forEach(m => {
      h += '<div class="wire"><div class="wire-from">' + m.from + "</div><div>" + m.text + "</div></div>";
    });
    UI.openModal("Marconi Wireless Log", h);
  };

  UI.dialogue = function (who, text) {
    UI.flash("“" + text + "”  — " + who, "#d8c890");
  };

  // -------------------------------------------------------------------- HUD
  let lastRoom = "";

  UI.update = function (dt) {
    const st = TT.nav.state;
    const p = TT.player;

    // --- where am I
    const deck = TT.deckAtY(p.pos.y);
    const room = TT.roomAt(p.pos.x, p.pos.y, p.pos.z);
    el.hudLoc.textContent = deck ? (deck.code ? deck.code + " — " + deck.name : deck.name) : "—";
    const rn = room ? room.name : (p.pos.y > 26 ? "Boat Deck, open air" : "Passageway");
    if (rn !== lastRoom) { lastRoom = rn; el.hudRoom.textContent = rn; }
    const cName = TT.compartmentNameAt(p.pos.x);
    const ci = TT.compartmentIndexAt(p.pos.x);
    const cw = ci >= 0 ? TT.COMPARTMENTS[ci].water / TT.COMPARTMENTS[ci].capacity : 0;
    el.hudComp.textContent = (p.pos.y <= 13.4 ? "Compartment: " : "Over: ") + cName
      + (cw > 0.01 ? "  —  " + Math.round(cw * 100) + "% flooded" : "");

    // --- clock
    el.clock.textContent = TT.nav.clockText();
    el.date.textContent = st.clock >= 86400 ? "15 April 1912" : "14 April 1912";

    // --- voyage bar
    const frac = TT.clamp(st.milesRun / st.milesTotal, 0, 1);
    el.barFill.style.width = (frac * 100).toFixed(2) + "%";
    el.barShip.style.left = (frac * 100).toFixed(2) + "%";
    el.barMiles.textContent = Math.floor(st.milesRun) + " / " + st.milesTotal + " nm";

    // --- instruments
    el.heading.textContent = TT.nav.compassText();
    el.helmNeedle.style.transform = "rotate(" + (st.wheelAngle * 140) + "deg)";
    const rud = st.rudder;
    el.rudder.textContent = Math.abs(rud) < 0.5 ? "MIDSHIPS"
      : (Math.abs(rud).toFixed(0) + "° " + (rud < 0 ? "to port" : "to starboard"));
    el.telegraph.textContent = st.telegraphLabel;
    el.telegraph.className = "big " + (st.telegraph >= 6 ? "warn" : st.telegraph <= 2 ? "astern" : "");
    el.knots.textContent = st.knots.toFixed(1);
    el.rpm.textContent = Math.round(st.rpm);
    el.steam.textContent = Math.round(st.boilerPressure);
    el.coal.textContent = Math.round(st.coal) + "%";

    // --- compass strip
    if (el.compass) el.compass.style.backgroundPosition = (-st.headingDeg * 4) + "px 0";

    // --- damage panel
    if (TT.dmg.struck) {
      const C = TT.COMPARTMENTS;
      let h = "";
      for (let i = C.length - 1; i >= 0; i--) {
        const c = C[i];
        const f = TT.clamp(c.water / c.capacity, 0, 1);
        h += '<div class="cmp' + (c.breached ? " breached" : "") + '" title="' + c.name + '">'
           + '<i style="height:' + (f * 100).toFixed(0) + '%"></i></div>';
      }
      el.dmgList.innerHTML = h;
      const ff = TT.dmg.floodFraction();
      el.dmgBar.style.width = (ff * 100).toFixed(1) + "%";
      el.dmgBar.parentNode.setAttribute("data-label",
        TT.dmg.floodedCount() + " compartments flooding · "
        + TT.dmg.boatsAway + "/20 boats away · " + TT.dmg.saved + " in the boats");
    }

    // --- interaction prompt
    const it = p.pickInteractable();
    const npc = (!it && p.mode === "walk")
      ? TT.nearestNPC(p.pos, p.yaw, 3.2) : null;
    if (it) {
      el.prompt.innerHTML = "<b>E</b> " + it.prompt + '<span class="dim">' + it.label + "</span>";
      el.prompt.classList.add("show");
      UI.hover = { kind: "it", it };
    } else if (npc) {
      el.prompt.innerHTML = "<b>E</b> Speak to " + npc.name;
      el.prompt.classList.add("show");
      UI.hover = { kind: "npc", npc };
    } else {
      el.prompt.classList.remove("show");
      UI.hover = null;
    }
  };

  // -------------------------------------------------------------- end cards
  UI.showEnd = function (kind, data) {
    const st = TT.nav.state;
    let title, body;
    if (kind === "arrived") {
      title = "NEW YORK";
      body = "<p>The Ambrose Light fine on the starboard bow, and tugs coming out to meet you. "
           + "Three thousand nautical miles from Southampton, and every one of the "
           + TT.SHIP.SOULS.toLocaleString() + " souls aboard is going to walk down the gangway "
           + "at Pier 54.</p>"
           + "<p class='dim'>History records that she never arrived. You have just made her.</p>"
           + stats(["Crossing time", data.days.toFixed(2) + " days"],
                   ["Ice warnings received", String(st.warnings)],
                   ["Bergs cleared", String(TT.game.nearMisses)],
                   ["Top speed held", data.topKnots.toFixed(1) + " knots"],
                   ["Souls landed", TT.SHIP.SOULS.toLocaleString()]);
    } else if (kind === "foundered") {
      title = "SHE IS GONE";
      const lost = TT.SHIP.SOULS - TT.dmg.saved;
      body = "<p>At 02:20 she went down by the head, and the noise of it carried for miles "
           + "across a sea like glass. The boats pulled away into the dark.</p>"
           + "<p class='dim'>In 1912, 710 people were saved and 1,514 were lost. "
           + "There was room in the boats for 1,178, and they left with 712.</p>"
           + stats(["Compartments open to the sea", String(data.compartments)],
                   ["Struck at", data.knots.toFixed(1) + " knots"],
                   ["Boats got away", TT.dmg.boatsAway + " of 20"],
                   ["Saved", TT.dmg.saved.toLocaleString()],
                   ["Lost", Math.max(0, lost).toLocaleString()],
                   ["Miles short of New York",
                    Math.round(st.milesTotal - st.milesRun).toLocaleString()]);
    } else if (kind === "survived") {
      title = "SHE SWIMS";
      body = "<p>Down by the head, pumps running, but she swims. The bulkheads have held "
           + "and the water has stopped where it is.</p>"
           + stats(["Compartments open", String(data.compartments)],
                   ["Ring for Half Ahead when ready", "—"]);
    } else if (kind === "overboard") {
      title = "OVERBOARD";
      body = "<p>The water is at 28°F. You have perhaps fifteen minutes, and no one saw "
           + "you go.</p>";
    } else {
      title = "DROWNED";
      body = "<p>The water came through the alleyway faster than a man can run. "
           + "It reached you in " + (TT.compartmentNameAt(TT.player.pos.x)) + ".</p>";
    }
    el.endTitle.textContent = title;
    el.endBody.innerHTML = body
      + '<div class="end-actions"><button id="btn-restart">Sail again</button>'
      + '<button id="btn-look">Stay and watch</button></div>';
    el.endCard.classList.add("show");
    if (document.pointerLockElement) document.exitPointerLock();
    $("btn-restart").addEventListener("click", () => location.reload());
    $("btn-look").addEventListener("click", () => {
      el.endCard.classList.remove("show");
      TT.player.mode = "exterior";
      TT.game.state = "playing";
    });
  };

  function stats() {
    let h = '<div class="stats">';
    for (const [a, b] of arguments) h += "<div><span>" + a + "</span><span>" + b + "</span></div>";
    return h + "</div>";
  }

  UI.hideTitle = function () { el.title.classList.add("gone"); };

})(window.TT);
