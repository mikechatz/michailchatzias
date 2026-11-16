/* ==========================================================================
   works/works.js — behaviour of the Works page.

   1. Shelf basics            4. Work Catalogue (filter)
   2. Take an object off      5. Recordings (click to load a player)
      the shelf / put it back 6. Scores and the page viewer
   3. Addresses (#catalogue, #recordings, #scores)

   Animation lengths and the way the object turns are in section 2 (look for DUR_ and the
   keyframes). Nothing here needs editing to add works: that is done in index.html.
   ========================================================================== */
(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const header = $(".sub-nav");
  const main   = $("#wk-main");
  const stage  = $("#wk-stage");
  const items  = $$(".wk-item");

  const VOLS    = ["catalogue", "recordings", "scores"];
  const FILTERS = ["compositions", "orchestration", "sound-design"];   // addresses that open the catalogue already filtered

  /* ---------- 1. Shelf basics ---------- */
  function setTop() {
    document.documentElement.style.setProperty("--wk-top", header.offsetHeight + "px");
  }
  setTop();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setTop);

  // a click on a spine opens its volume; arrow keys move between the spines
  $$("[data-open]").forEach(el => el.addEventListener("click", () => navigate(el.dataset.open)));
  items.forEach((item, i) => item.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = items[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); }
  }));
  $$(".vol-close").forEach(b => b.addEventListener("click", () => navigate(null)));

  /* ---------- 2. Take an object off the shelf, put it back ---------- */
  const DUR_FIRST = 1250;   // ms: the first time in this visit
  const DUR_NEXT  = 800;    // ms: every time after that (a second click while it runs skips ahead)
  // fractions of the whole animation
  const LIFT   = 0.20;      // end of the little pull forward
  const TRAVEL = 0.60;      // end of the turn + the move to the middle of the screen
  const HOLD   = 0.70;      // the volume starts to grow out of the open cover
  const E = 0.0006;         // (the smallest step, used to make a clean cut between two states)

  let openId = null;        // which volume is open ("catalogue" | "recordings" | "scores") or null
  let busy = false;         // an animation is running
  let st = null;            // what belongs to the open volume: { id, vol, item, fly, anims, size }
  let queued = null;        // a request that arrived while busy
  let skipped = false;

  const seen = () => { try { return sessionStorage.getItem("wk-seen") === "1"; } catch (e) { return false; } };
  const markSeen = () => { try { sessionStorage.setItem("wk-seen", "1"); } catch (e) {} };
  const volEl  = (id) => $("#vol-" + id);
  const itemEl = (id) => items.find(i => i.dataset.open === id);

  function flushQueue() {
    if (!queued) return;
    const q = queued;
    queued = null;
    go(q.id, q.filter, q.opts);
  }

  // a REC or SCORE chip of the catalogue: go to that volume, then press the record or the score of the same work
  let pending = null;                                   // { vol, key }
  function runPending(vol) {
    if (!pending || pending.vol !== vol.dataset.vol) return;
    const p = pending;
    pending = null;
    if (p.vol === "recordings") {
      const rec = $('.rec[data-key="' + p.key + '"]', vol);
      if (rec && !rec.classList.contains("is-playing")) rec.click();
    } else if (p.vol === "scores") {
      const card = $('.sc-card[data-key="' + p.key + '"]', vol);
      if (card) card.click();
    }
  }

  // The back button always steps back one address. Arriving from a catalogue chip, that is the catalogue,
  // so then the button says so (a volume opened from the shelf keeps "Back to the shelf").
  const BACK_TO_CATALOGUE = { en: "Back to the work catalogue", el: "Πίσω στον Κατάλογο Έργων", cn: "返回作品目录" };
  function setBackLabel(vol) {
    const btn = $(".vol-close", vol), back = $(".vol-back", vol);
    if (!btn || !back) return;
    const fromCat = !!(history.state && history.state.from === "catalogue" && vol.dataset.vol !== "catalogue");
    ["en", "el", "cn"].forEach(k => {
      const sp = $(".lang-" + k, back);
      if (!sp) return;
      if (sp.dataset.shelf === undefined) sp.dataset.shelf = sp.textContent;
      sp.textContent = fromCat ? BACK_TO_CATALOGUE[k] : sp.dataset.shelf;
    });
    btn.setAttribute("aria-label", fromCat ? BACK_TO_CATALOGUE.en : "Back to the shelf");
  }

  function afterOpen(vol) {
    busy = false;
    const c = $(".vol-close", vol);
    if (c) c.focus({ preventScroll: true });
    runPending(vol);
    flushQueue();
  }

  function openVol(id, opts) {
    opts = opts || {};
    const vol = volEl(id), item = itemEl(id);
    setBackLabel(vol);
    busy = true;
    skipped = false;
    openId = id;
    vol.hidden = false;
    $(".vol-scroll", vol).scrollTop = 0;

    // direct address, or "reduce motion": no object, the volume just fades in
    if (reduce.matches || opts.instant) {
      st = { id, vol, item, fly: null, anims: [], size: [innerWidth, innerHeight] };
      vol.classList.add("is-in");
      if (reduce.matches) { afterOpen(vol); return; }
      const a = vol.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
      a.onfinish = () => afterOpen(vol);
      return;
    }

    // measure the object on the shelf and where it is going
    const r = item.getBoundingClientRect();
    const ratio = parseFloat(getComputedStyle(item).getPropertyValue("--r")) || 0.72;
    const t = r.width, ih = r.height, d = ih * ratio;               // thickness, height, cover width
    const topH = header.offsetHeight, vw = innerWidth, vh = innerHeight - topH;
    const cx0 = r.left + t / 2, cy0 = r.top + ih / 2;
    const cx1 = vw / 2,         cy1 = topH + vh / 2;
    const s = Math.min(vh * 0.72 / ih, vw * 0.84 / d, 1.9);         // how much bigger it is when it faces you
    const dx = cx1 - cx0, dy = cy1 - cy0;

    // a copy of the object, on top of its slot (the slot stays as an empty gap on the shelf)
    const fly = document.createElement("div");
    fly.className = "wk-fly k-" + id;
    fly.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + t + "px;height:" + ih + "px;" +
                        "--t:" + t + "px;--ih:" + ih + "px;--d:" + d + "px;";
    fly.innerHTML =
      '<div class="wk-box">' + item.querySelector(".wk-box").innerHTML + "</div>" +
      '<div class="wk-open">' +
      (id === "recordings" ? '<div class="bk-vinyl"><span class="disc"><span class="disc-label">M.C.</span></span></div>' : "") +
      '<div class="bk-cover"><div class="bk-front">' + item.querySelector(".f-cover").innerHTML + '</div><div class="bk-back"></div></div></div>';
    main.appendChild(fly);
    item.classList.add("is-gone");

    const box = $(".wk-box", fly), cover = $(".bk-cover", fly), vinyl = $(".bk-vinyl", fly), openG = $(".wk-open", fly);
    const D = seen() ? DUR_NEXT : DUR_FIRST;
    const anims = [];
    const add = (el, kf) => { const a = el.animate(kf, { duration: D, fill: "both", easing: "linear" }); anims.push(a); return a; };
    const EASE_A = "cubic-bezier(.3,0,.3,1)", EASE_B = "cubic-bezier(.55,0,.2,1)", EASE_C = "cubic-bezier(.5,0,.25,1)";
    const tz = (z) => "translateZ(" + z + "px)";

    // the whole object: lifts a little, then travels to the middle of the screen
    const lead = add(fly, [
      { transform: "translate(0px,0px) scale(1)", offset: 0, easing: EASE_A },
      { transform: "translate(0px," + (-0.04 * ih) + "px) scale(1.03)", offset: LIFT, easing: EASE_B },
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")", offset: TRAVEL },
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")", offset: 1 }
    ]);
    // the box: comes forward, then turns a quarter turn so the cover faces you (then it is swapped for the flat cover)
    // (no opacity animation on the box: that would flatten its 3D, so it is hidden by shrinking it to nothing instead)
    add(box, [
      { transform: tz(-d / 2) + " rotateY(0deg) scale(1)", offset: 0, easing: EASE_A },
      { transform: tz(-d / 2 + 70) + " rotateY(0deg) scale(1)", offset: LIFT, easing: EASE_B },
      { transform: tz(-t / 2) + " rotateY(-90deg) scale(1)", offset: TRAVEL - E },
      { transform: tz(-t / 2) + " rotateY(-90deg) scale(0)", offset: TRAVEL },
      { transform: tz(-t / 2) + " rotateY(-90deg) scale(0)", offset: 1 }
    ]);
    add(openG, [
      { opacity: 0, offset: 0 }, { opacity: 0, offset: TRAVEL - E }, { opacity: 1, offset: TRAVEL }, { opacity: 1, offset: 1 }
    ]);

    // opening: a book or dossier swings its cover open; a record sleeve slides aside and the vinyl rolls out
    if (id === "recordings") {
      add(cover, [
        { transform: "translateX(0%)", offset: 0 },
        { transform: "translateX(0%)", offset: TRAVEL, easing: EASE_C },
        { transform: "translateX(-66%)", offset: HOLD + 0.04 },
        { transform: "translateX(-66%)", offset: 1 }
      ]);
      add(vinyl, [
        { transform: "translateX(0%) rotate(0deg)", offset: 0 },
        { transform: "translateX(0%) rotate(0deg)", offset: TRAVEL, easing: EASE_C },
        { transform: "translateX(26%) rotate(260deg)", offset: HOLD + 0.1 },
        { transform: "translateX(26%) rotate(330deg)", offset: 1 }
      ]);
    } else {
      add(cover, [
        { transform: "rotateY(0deg)", offset: 0 },
        { transform: "rotateY(0deg)", offset: TRAVEL, easing: EASE_C },
        { transform: "rotateY(-168deg)", offset: HOLD + 0.03 },
        { transform: "rotateY(-168deg)", offset: 1 }
      ]);
    }

    // the volume grows out of the open cover until it fills the screen
    const pw = d * s, ph = ih * s, px = cx1 - pw / 2, py = cy1 - topH - ph / 2;
    const R = "inset(" + py + "px " + (vw - (px + pw)) + "px " + (vh - (py + ph)) + "px " + px + "px)";
    add(vol, [
      { clipPath: R, opacity: 0, offset: 0 },
      { clipPath: R, opacity: 0, offset: TRAVEL - E },
      { clipPath: R, opacity: 1, offset: TRAVEL },
      { clipPath: R, opacity: 1, offset: HOLD, easing: "cubic-bezier(.6,0,.2,1)" },
      { clipPath: "inset(0px 0px 0px 0px)", opacity: 1, offset: 1 }
    ]);
    [$(".vol-bar", vol), $(".vol-scroll", vol)].forEach(el => add(el, [
      { opacity: 0, offset: 0 }, { opacity: 0, offset: HOLD + 0.06 }, { opacity: 1, offset: 1 }
    ]));
    // the object stays on top of the volume while it opens, then fades out as the volume fills the screen
    add(fly, [
      { opacity: 1, offset: 0 }, { opacity: 1, offset: 0.78 }, { opacity: 0, offset: 0.97 }, { opacity: 0, offset: 1 }
    ]);
    // the shelf behind dims while all this happens
    add(stage, [
      { opacity: 1, offset: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.1, offset: TRAVEL }, { opacity: 0.1, offset: 1 }
    ]);

    st = { id, vol, item, fly, anims, size: [innerWidth, innerHeight] };
    setTimeout(() => { if (st && st.vol === vol) vol.classList.add("is-in"); }, D * TRAVEL);
    lead.onfinish = () => { markSeen(); afterOpen(vol); };
  }

  function closeVol(done) {
    const s = st;
    busy = true;
    skipped = false;
    s.vol.classList.remove("is-in");
    stopRec();
    ScoreViewer.close();

    const fin = () => {
      s.anims.forEach(a => a.cancel());
      if (s.fly) s.fly.remove();
      s.vol.hidden = true;
      s.item.classList.remove("is-gone");
      openId = null;
      st = null;
      busy = false;
      try { s.item.focus({ preventScroll: true }); } catch (e) {}
      if (done) done();
      flushQueue();
    };

    // put it back the way it came (if the window changed size meanwhile, just fade)
    if (s.fly && s.size[0] === innerWidth && s.size[1] === innerHeight && !reduce.matches) {
      s.anims.forEach(a => a.reverse());
      s.anims[0].onfinish = fin;
    } else {
      const a = s.vol.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce.matches ? 0 : 240, fill: "forwards" });
      a.onfinish = fin;
    }
  }

  // a click while it runs: hurry up
  function skip() {
    if (!busy || skipped || !st) return;
    skipped = true;
    st.anims.forEach(a => { try { a.updatePlaybackRate(a.playbackRate * 5); } catch (e) {} });
  }
  main.addEventListener("pointerdown", skip);

  function go(id, filter, opts) {
    if (busy) { queued = { id, filter, opts }; skip(); return; }
    if (filter) setFilter(filter);
    if (id === openId) return;
    if (openId) closeVol(() => { if (id) openVol(id, opts); });
    else if (id) openVol(id, opts);
  }

  /* ---------- 3. Addresses ---------- */
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (VOLS.indexOf(h) >= 0) return { vol: h };
    if (h === "work-catalogue") return { vol: "catalogue" };
    if (FILTERS.indexOf(h) >= 0) return { vol: "catalogue", filter: h };
    return { vol: null };
  }
  function hashFor(id, filter) {
    if (!id) return "";
    return "#" + (id === "catalogue" && filter && filter !== "all" ? filter : id);
  }
  // opening pushes an address, so the browser's back button puts the object back
  function navigate(id, filter, from) {
    const base = location.pathname + location.search;
    // some browsers refuse history changes on local files; opening must never depend on it
    if (id) {
      try { history.pushState({ vol: id, from: from || null }, "", base + hashFor(id, filter)); } catch (e) {}
      go(id, filter);
    } else if (history.state && history.state.vol) {
      history.back();
    } else {
      try { history.replaceState(null, "", base); } catch (e) {}
      go(null);
    }
  }
  window.addEventListener("popstate", () => { const h = fromHash(); go(h.vol, h.filter); });

  /* ---------- 4. Work Catalogue ---------- */
  const catBtns = $$(".cat-f");
  const catGroups = $$(".cat-group");
  function setFilter(f) {
    if (f !== "all" && FILTERS.indexOf(f) < 0) f = "all";
    catBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === f)));
    let n = 0;
    catGroups.forEach(group => {                       // each kind of work is a group with its own heading
      const show = f === "all" || group.dataset.cat === f;
      group.hidden = !show;
      if (show) $$(".cat-row", group).forEach(row => row.style.setProperty("--n", n++));
    });
  }
  $$(".chip[data-go]").forEach(chip => chip.addEventListener("click", () => {
    pending = { vol: chip.dataset.go, key: chip.dataset.key };
    if (openId === pending.vol && !busy && st) runPending(st.vol);
    else navigate(chip.dataset.go, undefined, "catalogue");
  }));
  catBtns.forEach(b => b.addEventListener("click", () => {
    setFilter(b.dataset.filter);
    if (openId === "catalogue") { try { history.replaceState(history.state, "", location.pathname + location.search + hashFor("catalogue", b.dataset.filter)); } catch (e) {} }
  }));
  setFilter("all");

  /* ---------- 5. Recordings ---------- */
  const recPlayer = $("#rec-player");
  const recStage = $("#rec-stage");
  const recBar   = $("#rec-bar");
  const recNow   = $("#rec-now-name");
  const recEmpty = $(".rec-empty", recStage);
  const recs = $$(".rec");
  recs.forEach((b, i) => b.style.setProperty("--n", i));

  // the player grows or collapses to its new size instead of jumping
  function morph(change) {
    const h0 = recPlayer.offsetHeight;
    change();
    if (reduce.matches) return;
    const h1 = recPlayer.offsetHeight;
    if (Math.abs(h1 - h0) < 2 || !h0) return;
    recPlayer.style.overflow = "hidden";
    const a = recPlayer.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    a.onfinish = a.oncancel = () => { recPlayer.style.overflow = ""; };
  }

  function stopRec() {
    morph(() => {
      recStage.replaceChildren(recEmpty);                // (the iframe goes, so the sound stops)
      recStage.classList.remove("has-player");
      delete recStage.dataset.kind;
      delete recPlayer.dataset.kind;
      recBar.hidden = true;
      recNow.textContent = "";
    });
    recs.forEach(b => b.classList.remove("is-playing"));
  }
  $("#rec-x").addEventListener("click", stopRec);

  recs.forEach(btn => btn.addEventListener("click", () => {
    if (btn.classList.contains("is-playing")) { stopRec(); return; }      // the record that is playing: click it again to put it away
    const nameEl = $(".rec-name", btn);
    const name = nameEl.textContent.replace(/\s+/g, " ").trim();
    const frame = document.createElement("iframe");
    frame.title = name;
    frame.src = btn.dataset.src;                      // nothing is requested from the other sites until now
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    morph(() => {
      recStage.dataset.kind = recPlayer.dataset.kind = btn.dataset.kind;
      recStage.classList.add("has-player");
      recStage.replaceChildren(frame);
      recNow.innerHTML = nameEl.innerHTML;            // the same name, in whichever language is showing
      recBar.hidden = false;
    });
    recs.forEach(b => b.classList.toggle("is-playing", b === btn));
    recPlayer.scrollIntoView({ block: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
  }));

  /* ---------- 6. Scores and the page viewer ----------
     The viewer itself is shared with the main page: ../assets/score-viewer.js (look: ../assets/score-viewer.css).
     Pages are pictures (data-pages), or placeholders until there are pictures. */
  const cards = $$(".sc-card");
  cards.forEach((c, i) => {
    c.style.setProperty("--n", i);
    c.addEventListener("click", () => ScoreViewer.open({
      title: c.dataset.title || "",
      pages: (c.dataset.pages || "").split(","),
      count: c.dataset.count,
      embed: c.dataset.embed,
      soon: c.hasAttribute("data-soon"),
      opener: c
    }));
  });

  window.addEventListener("resize", setTop);

  /* ---------- Keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || ScoreViewer.isOpen()) return;      // (an open score takes the keys itself)
    if (e.key === "Escape" && openId && !busy) navigate(null);
    else if (e.key === "Escape" && busy) skip();
  });

  /* ---------- Start ---------- */
  const start = fromHash();
  if (start.vol) go(start.vol, start.filter, { instant: true });
})();
