/* ==========================================================================
   assets/score-viewer.js — the page viewer for scores, shared by the main page and the Works page.

   Two ways to open it:
     1. In HTML: give any element  data-score-open  and, next to it,
          data-title   shown above the pages (the main page falls back to the <h4> of the same row, or to the card's own title line)
          data-pages   the page pictures, comma separated: "a/p1.webp,a/p2.webp"   (leave empty for blank placeholder pages)
          data-count   (placeholders only) how many blank pages to show
          data-embed   (instead of pages) the address of an outside player, e.g. a MuseScore embed:
                       "https://musescore.com/user/123/scores/456/embed" (unlisted: ".../scores/456/s/SECRET/embed").
                       It opens full screen on the black background; nothing is requested from that site before.
          data-soon    (no value) the viewer shows only "Coming soon" (until pages or an embed exist; delete it then)
          data-image   (instead of pages) one picture, shown whole on the black background: "assets/gallery/photo.webp"
          data-video   (instead of pages) a YouTube video id; the player opens on the black background and starts playing
                       (youtube-nocookie.com; nothing is requested from YouTube before). data-title is shown above it.
          The media tiles of one grid (.gallery-grid) are a group: the viewer then has arrows (and ← →) to step through them.
        (an element that is not a <button> also needs role="button" tabindex="0"; Enter and Space then work too)
     2. In script:  ScoreViewer.open({ title, pages: [...], count, embed, image, video, opener })

   The pages are pictures, never a PDF. The look is in assets/score-viewer.css.
   Two pages side by side (a cover alone on the right first, like a book) or one page. Turn with the arrows,
   the keyboard, the mouse wheel, or by dragging a page with a finger or the mouse.
   ========================================================================== */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  // an upright phone shows one page; a phone on its side is "short" (the pages take the full height)
  const isPhone = () => window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
  const isShort = () => window.matchMedia("(max-height: 560px) and (orientation: landscape)").matches;

  const MARKUP =
    '<div class="sv-bar">' +
      '<span class="sv-title" id="sv-title"></span>' +
      '<div class="sv-modes" role="group" aria-label="Pages shown">' +
        '<button type="button" class="sv-mode" data-mode="one" aria-pressed="false" aria-label="One page"><i></i></button>' +
        '<button type="button" class="sv-mode" data-mode="two" aria-pressed="true" aria-label="Two pages side by side"><i></i><i></i></button>' +
      '</div>' +
      '<button type="button" class="sv-close" id="sv-close" aria-label="Close the score">✕</button>' +
    '</div>' +
    '<div class="sv-stage" id="sv-stage">' +
      '<button type="button" class="sv-arrow sv-prev" id="sv-prev" aria-label="Previous page">' +
        '<svg viewBox="0 0 24 48" aria-hidden="true"><path d="M20 4 L4 24 L20 44"/></svg>' +
      '</button>' +
      '<div class="sv-book" id="sv-book"></div>' +
      '<button type="button" class="sv-arrow sv-next" id="sv-next" aria-label="Next page">' +
        '<svg viewBox="0 0 24 48" aria-hidden="true"><path d="M4 4 L20 24 L4 44"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="sv-foot">' +
      '<label class="sv-count">' +
        '<span class="sv-count-label"><span class="lang-en">Page</span><span class="lang-el">Σελίδα</span><span class="lang-cn">页</span></span>' +
        '<input type="text" id="sv-page" inputmode="numeric" autocomplete="off" aria-label="Go to page">' +
        '<span class="sv-of">/ <b id="sv-total">0</b></span>' +
      '</label>' +
    '</div>';

  let sv, svBook, svStage, svPrev, svNext, svPage, svTotal, svTitle, svEmbed, modeBtns;
  let built = false;

  const V = { group: null, gi: 0, kind: "", pages: [], N: 0, S: 0, s: 0, mode: isPhone() ? "one" : "two", manual: false, busy: false, opener: null, title: "", embed: "" };
  const DRAG_D = 1000;                                  // the leaf's animations are scrubbed on a 0…1000 scale
  const drag = { id: null, x0: 0, y0: 0, on: false, dir: 0, L: null, anims: null, p: 0, range: 300, pts: [], raf: 0 };
  const touches = new Set();                            // fingers down: a pinch is not a page turn
  const wheel = { acc: 0, t: 0, quiet: false };

  let closing = null;                                   // the fade-out animation while the viewer is going away
  const SAFE_MARGIN = 16, SAFE_MARGIN_TOUCH = 22;       // px of room around the controls where a click does not close the viewer (a finger needs more than a mouse)
  const FADE = 260;                                     // ms, the same for fading in and out
  const isOpen = () => !!sv && !sv.hidden && !closing;

  // page numbers shown on the left / right of state s
  const leftPage  = (s) => V.mode === "two" ? 2 * s : 0;
  const rightPage = (s) => V.mode === "two" ? 2 * s + 1 : s + 1;
  const spreads   = () => V.mode === "two" ? Math.ceil((V.N + 1) / 2) : V.N;

  function sheet(n) {
    const el = document.createElement("div");
    el.className = "sheet";
    if (n < 1 || n > V.N) { el.classList.add("is-blank"); return el; }
    const src = V.pages[n - 1];
    if (src) {
      const pic = document.createElement("div");
      pic.className = "pic";
      pic.style.backgroundImage = 'url("' + src + '")';
      el.appendChild(pic);
    } else {                                           // placeholder page
      if (n === 1) el.insertAdjacentHTML("beforeend", '<div class="ph-head"></div>');
      el.insertAdjacentHTML("beforeend", '<div class="ph-tag">Placeholder</div><div class="ph-lines"></div><div class="ph-no">' + n + "</div>");
      const head = $(".ph-head", el);
      if (head) head.textContent = V.title;
    }
    return el;
  }
  const paper = () => { const el = document.createElement("div"); el.className = "sheet"; return el; };

  function pageLabel() {
    const l = leftPage(V.s), r = rightPage(V.s);
    if (V.mode === "one") return String(r);
    if (l < 1) return String(r);
    if (r > V.N) return String(l);
    return l + "–" + r;
  }

  function layout() {
    const w = svStage.clientWidth, h = svStage.clientHeight;
    const cols = V.mode === "two" ? 2 : 1;
    // short screens: pages nearly touch top and bottom, arrows and buttons sit in the margins beside them
    const room = isShort() ? w - 112 : w - (isPhone() ? 16 : 170);
    let ph = Math.max(120, isShort() ? h - 12 : h - (isPhone() ? 16 : 28)), pw = ph / 1.414;
    if (pw * cols > room) { pw = room / cols; ph = pw * 1.414; }
    svBook.style.setProperty("--pw", pw + "px");
    svBook.style.setProperty("--ph", ph + "px");
    svBook.className = "sv-book " + V.mode;
  }

  function render() {
    const l = $(".sv-left", svBook), r = $(".sv-right", svBook);
    l.replaceChildren(sheet(leftPage(V.s)));
    r.replaceChildren(sheet(rightPage(V.s)));
    if (document.activeElement !== svPage) svPage.value = pageLabel();
    svPrev.disabled = V.s <= 0;
    svNext.disabled = V.s >= V.S - 1;
  }

  // sets up the leaf for a turn (what lies under it, and its two faces) and returns its parts
  function buildLeaf(dir) {
    const s2 = V.s + dir;
    const lo = Math.min(V.s, s2);
    const l = $(".sv-left", svBook), r = $(".sv-right", svBook);
    l.replaceChildren(sheet(dir > 0 ? leftPage(V.s) : leftPage(V.s - 1)));      // what lies under the leaf
    r.replaceChildren(sheet(dir > 0 ? rightPage(V.s + 1) : rightPage(V.s)));

    const leaf = document.createElement("div");
    leaf.className = "sv-leaf";
    leaf.style.left = V.mode === "two" ? "var(--pw)" : "0";
    const front = document.createElement("div"), back = document.createElement("div");
    front.className = "face front";
    back.className = "face back";
    front.appendChild(sheet(rightPage(lo)));
    back.appendChild(V.mode === "two" ? sheet(leftPage(lo + 1)) : paper());
    const sf = document.createElement("div"), sb = document.createElement("div");
    sf.className = sb.className = "shade";
    front.appendChild(sf);
    back.appendChild(sb);
    leaf.append(front, back);
    svBook.appendChild(leaf);
    return { leaf, sf, sb, s2 };
  }
  // the three animations of one turn (leaf angle, shade on each face); forward 0 → -180°, back is the same in reverse
  function leafAnims(L, dir, o) {
    const opts = Object.assign({ fill: "both", direction: dir > 0 ? "normal" : "reverse" }, o);
    return [
      L.leaf.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], opts),
      L.sf.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0.5 }], opts),
      L.sb.animate([{ opacity: 0.5 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], opts)
    ];
  }

  // turn one leaf by itself: dir +1 forward, -1 back. The leaf hinges on the spine.
  function flip(dir) {
    if (V.group) { mediaStep(dir); return; }            // in the Gallery's media the arrows go to the neighbouring picture or video
    if (V.busy || V.embed) return;
    const s2 = V.s + dir;
    if (s2 < 0 || s2 >= V.S) return;
    if (reduce.matches) { V.s = s2; render(); return; }
    V.busy = true;
    const L = buildLeaf(dir), leaf = L.leaf;
    const [a] = leafAnims(L, dir, { duration: 800, easing: "cubic-bezier(.45,.05,.25,1)" });
    a.onfinish = () => {
      V.s = s2;
      leaf.remove();
      render();
      V.busy = false;
    };
  }

  function jumpTo(p) {
    if (V.embed) return;
    p = Math.max(1, Math.min(V.N, p));
    const target = V.mode === "two" ? Math.floor(p / 2) : p - 1;
    if (target === V.s) { render(); return; }
    if (Math.abs(target - V.s) === 1) { flip(target - V.s); return; }
    V.s = target;
    render();
    if (!reduce.matches) svBook.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 260 });
  }

  function setMode(mode, manual) {
    if (manual) V.manual = true;
    if (mode === V.mode) return;
    const anchor = Math.min(V.N, Math.max(1, rightPage(V.s)));
    V.mode = mode;
    V.S = spreads();
    V.s = mode === "two" ? Math.floor(anchor / 2) : anchor - 1;
    modeBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    layout();
    render();
  }

  // the Gallery's media: the arrows (and ← →) step through the tiles of the same grid, round and round
  function mediaStep(dir) {
    const g = V.group;
    if (!g || g.length < 2 || !isOpen()) return;
    const i = (V.gi + dir + g.length) % g.length;
    open(Object.assign(fromElement(g[i]), { group: g, index: i, swap: true }));
  }

  function open(o) {
    build();
    o = o || {};
    V.group = o.group && o.group.length > 1 ? o.group : null;     // (only the media tiles of the Gallery pass a group)
    V.gi = o.index || 0;
    V.pages = (o.pages || []).map(x => String(x).trim()).filter(Boolean);
    V.N = V.pages.length || Math.max(1, parseInt(o.count || "8", 10) || 8);
    V.title = o.title || "";
    V.opener = o.opener || null;
    V.embed = /^https:\/\//i.test(o.embed || "") ? o.embed : (o.soon ? "soon" : "");   // an outside player (MuseScore) instead of the pages; "soon" = only the words "coming soon"
    V.kind = "";                                       // "image" / "video": the Gallery's media, shown on the same black screen
    if (o.image) { V.embed = "image"; V.kind = "image"; }
    else if (/^[\w-]{6,20}$/.test(o.video || "")) { V.embed = "https://www.youtube-nocookie.com/embed/" + o.video + "?autoplay=1&rel=0&playsinline=1"; V.kind = "video"; }
    if (closing) { closing.cancel(); closing = null; sv.style.pointerEvents = ""; }   // opened again while still fading out
    V.busy = false;
    if (isPhone()) V.mode = "one";
    else if (!V.manual) V.mode = "two";
    V.S = spreads();
    V.s = 0;
    svTitle.textContent = V.title;
    svTotal.textContent = V.N;
    modeBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === V.mode)));
    sv.classList.toggle("is-embed", !!V.embed);
    sv.classList.toggle("is-soon", V.embed === "soon");
    sv.classList.toggle("is-media", !!V.group);
    svPrev.disabled = svNext.disabled = false;
    sv.classList.toggle("is-image", V.kind === "image");
    sv.classList.toggle("is-video", V.kind === "video");
    sv.setAttribute("aria-label", V.kind ? "Media viewer" : "Score viewer");
    $("#sv-close", sv).setAttribute("aria-label", V.kind ? "Close" : "Close the score");
    svEmbed.replaceChildren();
    if (V.embed === "soon") {
      svBook.replaceChildren();
      const soon = document.createElement("p");
      soon.className = "sv-soon";
      soon.innerHTML = '<span class="lang-en">Coming soon</span><span class="lang-el">Σύντομα</span><span class="lang-cn">即将推出</span>';
      svEmbed.appendChild(soon);
    } else if (V.kind === "image") {
      svBook.replaceChildren();
      const pic = document.createElement("img");
      pic.src = o.image;
      pic.alt = V.title;
      pic.draggable = false;
      svEmbed.appendChild(pic);
    } else if (V.embed) {
      svBook.replaceChildren();
      // nothing is requested from the other site until the score is opened
      const frame = document.createElement("iframe");
      frame.title = V.title;
      frame.src = V.embed;
      frame.allow = V.kind === "video" ? "autoplay; encrypted-media; picture-in-picture; fullscreen" : "autoplay; fullscreen; encrypted-media";
      frame.setAttribute("allowfullscreen", "");
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      svEmbed.appendChild(frame);
    } else {
      svBook.innerHTML = '<div class="sv-slot sv-left"></div><div class="sv-slot sv-right"></div>';
    }
    sv.hidden = false;
    if (!V.embed) { layout(); render(); }
    if (!o.swap) {
      if (!reduce.matches) sv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE });
      (V.embed ? $("#sv-close", sv) : svNext).focus({ preventScroll: true });
    }
  }
  function close() {
    if (!isOpen()) return;
    const o = V.opener;
    cancelAnimationFrame(drag.raf);                     // a turn that was being dragged is dropped
    drag.id = null; drag.on = false; drag.L = null; drag.anims = null;
    sv.classList.remove("is-dragging");
    V.busy = false;
    const done = () => {
      closing = null;
      sv.style.pointerEvents = "";
      sv.hidden = true;
      svBook.replaceChildren();
      svEmbed.replaceChildren();                        // (the player goes, so its sound stops)
    };
    if (o && o.isConnected && o.offsetParent !== null) { try { o.focus({ preventScroll: true }); } catch (e) {} }
    if (reduce.matches) { done(); return; }
    // fade out, then hide; meanwhile the viewer no longer takes clicks or keys
    sv.style.pointerEvents = "none";
    const a = sv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease", fill: "forwards" });
    closing = a;
    a.onfinish = () => { if (closing === a) { a.cancel(); done(); } };
  }

  /* ---------- drag to turn: the leaf follows the finger (or pen, or mouse) and settles when it is let go ---------- */
  function dragSet(p) {
    drag.p = p;
    drag.anims.forEach(a => { a.currentTime = p * DRAG_D; });
  }
  function dragStart(e, dir) {
    const L = buildLeaf(dir);
    drag.L = L; drag.dir = dir; drag.on = true; V.busy = true;
    drag.anims = leafAnims(L, dir, { duration: DRAG_D, easing: "linear" });
    drag.anims.forEach(a => a.pause());
    // a full turn is about one page-width of finger travel (less on a narrow screen)
    const pw = parseFloat(svBook.style.getPropertyValue("--pw")) || 300;
    drag.range = Math.max(160, Math.min(pw * 1.3, window.innerWidth * 0.7));
    dragSet(0);
    sv.classList.add("is-dragging");
    try { svStage.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function dragMove(e) {
    if (drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (V.busy || Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const dir = dx < 0 ? 1 : -1;
      if (V.s + dir < 0 || V.s + dir >= V.S) { drag.id = null; return; }       // nothing to turn to
      if (reduce.matches) return;                                              // (reduced motion: it turns on release instead)
      dragStart(e, dir);
    }
    drag.pts.push([e.timeStamp, e.clientX]);
    if (drag.pts.length > 6) drag.pts.shift();
    dragSet(Math.max(0, Math.min(1, (dx * -drag.dir) / drag.range)));
    e.preventDefault();
  }
  function dragSettle(to) {
    const from = drag.p, L = drag.L, anims = drag.anims;
    const ms = Math.max(120, 460 * Math.abs(to - from)), t0 = performance.now();
    const done = () => {
      drag.on = false; drag.L = null; drag.anims = null;
      sv.classList.remove("is-dragging");
      if (sv.hidden) return;
      anims.forEach(a => a.cancel());
      L.leaf.remove();
      if (to === 1) V.s = L.s2;
      render();
      V.busy = false;
    };
    const step = (now) => {
      if (sv.hidden) { done(); return; }
      const k = Math.min(1, (now - t0) / ms), p = from + (to - from) * (1 - Math.pow(1 - k, 3));
      anims.forEach(a => { a.currentTime = p * DRAG_D; });
      if (k < 1) drag.raf = requestAnimationFrame(step); else done();
    };
    drag.raf = requestAnimationFrame(step);
  }
  function dragEnd(e) {
    touches.delete(e.pointerId);
    if (drag.id !== e.pointerId) return;
    drag.id = null;
    if (!drag.on) return;
    sv.classList.remove("is-dragging");
    // carry on if it went far enough, or was flicked
    const a = drag.pts[0], b = drag.pts[drag.pts.length - 1];
    const v = a && b && b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * -drag.dir : 0;   // px/ms toward the turn
    const keep = e.type !== "pointercancel" && (drag.p > 0.4 || (v > 0.3 && drag.p > 0.03)) && !(v < -0.3);
    dragSettle(keep ? 1 : 0);
  }

  /* ---------- build the viewer once, the first time it is needed ---------- */
  function build() {
    if (built) return;
    built = true;
    sv = document.createElement("div");
    sv.className = "sc-viewer";
    sv.id = "sc-viewer";
    sv.hidden = true;
    sv.setAttribute("role", "dialog");
    sv.setAttribute("aria-modal", "true");
    sv.setAttribute("aria-label", "Score viewer");
    sv.innerHTML = MARKUP;
    document.body.appendChild(sv);                      // the whole screen, header included, so it lives directly in <body>

    svBook = $("#sv-book", sv); svStage = $("#sv-stage", sv);
    svPrev = $("#sv-prev", sv); svNext = $("#sv-next", sv);
    svPage = $("#sv-page", sv); svTotal = $("#sv-total", sv); svTitle = $("#sv-title", sv);
    svEmbed = document.createElement("div");
    svEmbed.className = "sv-embed";
    svStage.appendChild(svEmbed);
    modeBtns = $$(".sv-mode", sv);

    $("#sv-close", sv).addEventListener("click", close);
    svPrev.addEventListener("click", () => flip(-1));
    svNext.addEventListener("click", () => flip(1));
    modeBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode, true)));
    svPage.addEventListener("focus", () => svPage.select());
    svPage.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const p = parseInt(svPage.value, 10); svPage.blur(); if (p) jumpTo(p); else render(); }
      e.stopPropagation();                              // keys typed here are not page-turn keys
      if (e.key === "Escape") { svPage.blur(); render(); }
    });
    svPage.addEventListener("blur", () => { svPage.value = pageLabel(); });

    // Drag to turn. (CSS touch-action on the stage keeps the browser from taking a sideways swipe for itself.)
    svStage.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") touches.add(e.pointerId);
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (V.embed || e.target.closest("button")) return;                        // (the arrows are for clicking)
      if (touches.size > 1 || V.busy) { drag.id = null; return; }
      drag.id = e.pointerId; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.on = false; drag.pts = [];
    });
    window.addEventListener("pointermove", dragMove, { passive: false });
    window.addEventListener("pointerup", dragEnd);
    window.addEventListener("pointercancel", dragEnd);
    // with reduced motion there is no follow-the-finger: a clear sideways swipe turns the page
    window.addEventListener("pointerup", (e) => {
      if (!reduce.matches || drag.id !== e.pointerId || drag.on || sv.hidden) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) flip(dx < 0 ? 1 : -1);
    }, true);

    // Mouse wheel / trackpad: one notch turns one page (down or right = forward, up or left = back).
    // A trackpad sends many small steps (and keeps going after the fingers lift), so those are added up
    // and one swipe of the fingers turns one page, not ten.
    sv.addEventListener("wheel", (e) => {
      e.stopPropagation();                              // (the page behind, e.g. the main page's slides, must not see it)
      if (e.ctrlKey || sv.hidden || V.embed) return;    // (ctrl + wheel is the browser's zoom)
      e.preventDefault();
      if (V.busy) { wheel.t = e.timeStamp; wheel.quiet = true; return; }
      let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) d *= 16;                              // lines → pixels
      else if (e.deltaMode === 2) d *= window.innerHeight;         // pages → pixels
      const gap = e.timeStamp - wheel.t;
      wheel.t = e.timeStamp;
      if (wheel.quiet) { if (gap < 160) return; wheel.quiet = false; wheel.acc = 0; }   // still gliding from the last turn
      if (gap > 220) wheel.acc = 0;
      if (Math.abs(d) >= 50) { wheel.acc = 0; flip(d > 0 ? 1 : -1); wheel.quiet = Math.abs(d) < 100; return; }   // a mouse notch
      wheel.acc += d;
      if (Math.abs(wheel.acc) >= 60) { const dir = wheel.acc > 0 ? 1 : -1; wheel.acc = 0; wheel.quiet = true; flip(dir); }
    }, { passive: false });
    // a click on the black space around the score closes it (but not the end of a drag that began there)
    const press = { x: 0, y: 0, moved: false, touch: false };
    sv.addEventListener("pointerdown", (e) => { press.x = e.clientX; press.y = e.clientY; press.moved = false; press.touch = e.pointerType !== "mouse"; }, true);
    window.addEventListener("pointermove", (e) => {
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press.moved = true;
    });
    sv.addEventListener("click", (e) => {
      if (press.moved || V.busy || drag.on) return;
      if (e.target.closest(".sheet:not(.is-blank), .sv-leaf, button, input, label, .sv-title, .sv-embed img")) return;
      // a little room around the arrows, the buttons and the page number, so a tap that just misses them does not close the score
      const m = press.touch ? SAFE_MARGIN_TOUCH : SAFE_MARGIN;
      const nearControl = $$(".sv-arrow, .sv-mode, .sv-close, .sv-count", sv).some(c => {
        if (c.offsetParent === null) return false;
        const r = c.getBoundingClientRect();
        return e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
      });
      if (nearControl) return;
      close();
    });
    // swipes on the viewer are not swipes on the page behind it
    sv.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    sv.addEventListener("touchend", (e) => e.stopPropagation(), { passive: true });
    // the pages are not offered for saving or dragging (a light deterrent, not a lock)
    sv.addEventListener("contextmenu", (e) => e.preventDefault());
    sv.addEventListener("dragstart", (e) => e.preventDefault());

    window.addEventListener("resize", () => {
      if (sv.hidden || V.embed) return;
      // turning the phone: one page upright, two pages on its side (unless the visitor chose)
      const want = isPhone() ? "one" : "two";
      if (!V.busy && V.mode !== want && (isPhone() || !V.manual)) setMode(want);
      else layout();
    });
  }

  /* ---------- keyboard: runs before the page's own key handling and keeps it from seeing the key ---------- */
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.target === svPage) return;                    // (the page box handles its own keys)
    const k = e.key;
    let used = true;
    if (k === "Escape") close();
    else if (V.group && (k === "ArrowRight" || k === "ArrowLeft")) mediaStep(k === "ArrowRight" ? 1 : -1);
    else if (V.embed && k !== "Tab") used = false;      // (an outside player has its own keys)
    else if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown") flip(1);
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") flip(-1);
    else if (k === "Home") jumpTo(1);
    else if (k === "End") jumpTo(V.N);
    else if (k === "Tab") {                             // Tab stays inside the viewer
      const f = $$("button:not(:disabled), input, iframe", sv).filter(el => el.offsetParent !== null);
      if (f.length) {
        const i = f.indexOf(document.activeElement);
        const next = e.shiftKey ? f[(i <= 0 ? f.length : i) - 1] : f[(i + 1) % f.length];
        next.focus({ preventScroll: true });
      }
    } else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------- anything with data-score-open opens it ---------- */
  function fromElement(el) {
    const row = el.closest(".score-zigzag-row");
    const h4 = row && $("h4", row);
    const cardTitle = $(".score-card-title", el);                  // (the preview cards of the main page's Works section)
    // the title in the language being shown (a title may hold several language spans, and only one is visible)
    const shown = (n) => { const v = $$(".lang-en, .lang-el, .lang-cn", n).find(s => s.offsetParent !== null); return (v || n).textContent.trim(); };
    return {
      title: el.dataset.title || (h4 ? h4.textContent.trim() : cardTitle ? shown(cardTitle) : ""),
      pages: (el.dataset.pages || "").split(","),
      count: el.dataset.count,
      embed: el.dataset.embed,
      image: el.dataset.image,
      video: el.dataset.video,
      soon: el.hasAttribute("data-soon"),
      opener: el
    };
  }
  // a media tile (data-image / data-video) opens together with the other media tiles of its grid, for the arrows
  function openFrom(el) {
    const o = fromElement(el);
    const grid = (o.image || o.video) ? el.closest("[data-media-group], .gallery-grid") : null;
    if (grid) {
      const g = $$("[data-score-open][data-image], [data-score-open][data-video]", grid);
      o.group = g; o.index = g.indexOf(el);
    }
    open(o);
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-score-open]");
    if (el) openFrom(el);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key !== "Enter" && e.key !== " ") || isOpen()) return;
    const el = e.target.closest && e.target.closest("[data-score-open]");
    if (el && el.tagName !== "BUTTON" && el.tagName !== "A") { e.preventDefault(); openFrom(el); }
  });

  window.ScoreViewer = { open, close, isOpen };
})();
