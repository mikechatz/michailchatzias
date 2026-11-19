/* ==========================================================================
   gallery/gallery.js — behaviour of the Gallery page.
   (Language switching is in ../subpage.js, which is loaded before this file.)

   What this file does:
   1. keeps the page just below the fixed header
   2. builds the year buttons from the year panels in the HTML
   3. opens a year: the line slides left, the concerts fade in
   4. makes sure only the right-hand pane scrolls (wheel, finger, arrow keys)
   5. loads a YouTube player only when a tile is clicked
   6. moves between Banner / Performances / Photos, and reads the # in the address
   ========================================================================== */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Rewrite the address bar without adding history entries. "" = no # at all (the banner).
  const writeHash = (h) =>
    history.replaceState(null, "", location.pathname + location.search + (h ? "#" + h : ""));

  const header   = $(".sub-nav");
  const scroller = $("#gal-scroller");
  const perf     = $("#gal-perf");
  const photos   = $("#gal-photos");
  const banner   = $("#gal-banner");
  const clearBtn = $("#gal-clear");
  const yearsEl  = $("#gal-years");
  const pane     = $("#gal-pane");
  const panels   = $$(".year-panel", pane);
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  let current = null;   // the open year, e.g. "2025", or null
  let player  = null;   // the tile that is playing right now, or null

  /* ---------- 1. Stay below the fixed header (its height changes on phones) ---------- */
  function setTop() {
    document.documentElement.style.setProperty("--gal-top", header.offsetHeight + "px");
  }
  setTop();
  window.addEventListener("resize", setTop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setTop);

  /* ---------- 2. Year buttons, built from the panels (newest first) ---------- */
  const years = panels.map(p => p.dataset.year).sort((a, b) => b - a);

  years.forEach(year => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gal-year";
    btn.dataset.year = year;
    const label = document.createElement("span");   // the label moves; the button (the click target) stays put
    label.className = "gal-year-label";
    label.textContent = year;
    btn.appendChild(label);
    btn.setAttribute("aria-pressed", "false");
    yearsEl.appendChild(btn);
  });

  /* ---------- 2b. The dotted line, and the pointer that grows out of it ---------- */
  // The line: dots close together along the years, spreading out and fading beyond the first (newest)
  // and the last (oldest) year. On a phone the line scrolls with the years, so the thinning is
  // there to see as you reach either end.
  // The pointer: when a year is open, the line breaks at that year, bends out toward it in a dotted
  // point (like "<" on desktop, "^" on a phone) and joins the line again.
  const lineCv  = $("#gal-line");
  const lineCtx = lineCv.getContext("2d");
  const LINE_C      = 43;    // px: where the line sits inside the canvas (the room beside it is for the pointer)
  const DOT_MIN_GAP = 5;     // px between dots along the years
  const DOT_MAX_GAP = 40;    // px between dots at the sparsest
  const DOT_CURVE   = 1.5;   // higher = the dots stay dense longer, then thin out faster
  const FADE_FROM   = 1;     // thinning starts this many year-gaps BEFORE the first / last year...
  const FADE_TO     = 1.5;   // ...and is complete this many year-gaps beyond it
  const GROW_OPEN   = 0.45;  // how much bigger the open year is drawn (same as GROW below)
  const yearBtns = $$(".gal-year");
  const ptr = { btn: null, open: 0, D: 24, B: 18, n: 5 };   // D = how far it points out, B = half the width of its base
  let ptrRaf = 0, ptrTimer = 0, lineKey = "";

  function drawLine() {
    const mobile = isMobile();
    const along = mobile ? perf.clientWidth : perf.clientHeight;     // length of the visible line
    if (!along || !yearBtns.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = mobile ? along : 46, H = mobile ? 46 : along;
    const key = W + "x" + H + "@" + dpr;
    if (key !== lineKey) {
      lineKey = key;
      lineCv.width = Math.round(W * dpr);
      lineCv.height = Math.round(H * dpr);
    }
    lineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lineCtx.clearRect(0, 0, W, H);

    const centreOf = (b) => mobile ? b.offsetLeft + b.offsetWidth / 2 : b.offsetTop + b.offsetHeight / 2;
    const offset = mobile ? yearsEl.scrollLeft : 0;                  // phones: the line scrolls with the years
    const total  = mobile ? yearsEl.scrollWidth : along;
    const first = centreOf(yearBtns[0]), last = centreOf(yearBtns[yearBtns.length - 1]);
    const step = yearBtns.length > 1 ? Math.abs(last - first) / (yearBtns.length - 1) : 100;
    const sparse = (p) => {                                          // 0 = dense ... 1 = sparsest
      const v = Math.max(first + FADE_FROM * step - p, p - (last - FADE_FROM * step), 0);
      const t = Math.min(1, v / ((FADE_FROM + FADE_TO) * step));
      return t * t * (3 - 2 * t);
    };
    const gap = (p) => DOT_MIN_GAP + (DOT_MAX_GAP - DOT_MIN_GAP) * Math.pow(sparse(p), DOT_CURVE);
    const at = (a, across) => mobile ? [a, LINE_C + across] : [LINE_C + across, a];   // (along, across) -> canvas x, y

    const open = ptr.btn ? ptr.open : 0;
    const pc = open > 0.001 ? centreOf(ptr.btn) : null;              // where the pointer sits along the line
    const hole = pc === null ? 0 : (ptr.B + 2) * open;               // the line is broken this far either side of it

    const dot = (p) => {
      const a = p - offset;
      if (a < -2 || a > along + 2) return;
      if (pc !== null && Math.abs(p - pc) < hole) return;
      lineCtx.fillStyle = "rgba(138, 133, 122, " + (0.8 - 0.55 * sparse(p)).toFixed(3) + ")";
      lineCtx.beginPath();
      const [x, y] = at(a, 0);
      lineCtx.arc(x, y, 1, 0, Math.PI * 2);
      lineCtx.fill();
    };
    const mid = (first + last) / 2;
    dot(mid);
    for (let p = mid + gap(mid); p < total; p += gap(p)) dot(p);
    for (let p = mid - gap(mid); p > 0; p -= gap(p)) dot(p);

    if (pc !== null) {                                               // the pointer: base, tip, base
      const B = ptr.B * open, D = ptr.D * open;
      const a0 = pc - offset;
      lineCtx.fillStyle = "rgba(138, 133, 122, " + (0.8 - 0.55 * sparse(pc)).toFixed(3) + ")";   // same dots as the line
      const put = (a, across) => {
        const [x, y] = at(a, across);
        lineCtx.beginPath();
        lineCtx.arc(x, y, 1, 0, Math.PI * 2);
        lineCtx.fill();
      };
      for (let i = 0; i <= ptr.n; i++) {
        const k = i / ptr.n;
        put(a0 - B * (1 - k), -D * k);                               // up the first side to the tip...
        if (i < ptr.n) put(a0 + B * (1 - k), -D * k);                // ...and back down the other (the tip is shared)
      }
    }
  }
  drawLine();
  if (window.ResizeObserver) new ResizeObserver(drawLine).observe(perf);
  else window.addEventListener("resize", drawLine);
  yearsEl.addEventListener("scroll", drawLine, { passive: true });   // phones: the line moves with the years
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLine);

  function animatePointer(to, done) {
    cancelAnimationFrame(ptrRaf);
    const from = ptr.open, t0 = performance.now();
    const dur = reduceMotion.matches ? 0 : 420 * Math.abs(to - from);
    (function stepFrame(now) {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      ptr.open = from + (to - from) * (1 - Math.pow(1 - k, 3));
      drawLine();
      if (k < 1) ptrRaf = requestAnimationFrame(stepFrame);
      else if (done) done();
    })(t0);
  }

  // Which year the pointer points at, and how big it is
  function aimPointer() {
    const btn = yearsEl.querySelector(".gal-year.is-selected");
    if (!btn) return false;
    const cs = getComputedStyle(btn.firstChild);
    const rowCs = getComputedStyle(yearsEl), btnCs = getComputedStyle(btn);
    ptr.btn = btn;
    if (!isMobile()) {
      ptr.D = parseFloat(rowCs.paddingRight) + parseFloat(btnCs.paddingRight) - 6;   // stops just short of the word
      ptr.B = 18;
    } else {
      const above = parseFloat(rowCs.paddingBottom) + parseFloat(btnCs.paddingBottom);
      ptr.D = above + parseFloat(cs.fontSize) * (1 + GROW_OPEN) * 0.2 - 7;
      ptr.B = 17;
    }
    ptr.n = Math.max(3, Math.round(Math.hypot(ptr.D, ptr.B) / 5.5));
    return true;
  }

  function showMarker() {
    clearTimeout(ptrTimer);
    const go = () => { if (current && aimPointer()) animatePointer(1); };
    if (ptr.open > 0.02) animatePointer(0, go);      // another year was open: the pointer folds back into the line, then points at the new one
    else ptrTimer = setTimeout(go, 220);             // (let the year finish growing first)
  }
  function hideMarker() {
    clearTimeout(ptrTimer);
    animatePointer(0);
  }

  /* ---------- Years follow the cursor, like the index on a phone ----------
     Run the mouse up or down the years and they bulge out to the LEFT in a smooth curve
     that follows the cursor's height: the year level with the cursor slides out the most,
     its neighbours less, and the ones beyond the reach not at all. The years glide back when the
     cursor leaves. They only slide and grow: no word is turned.
     Only the label moves: the button keeps its place, so clicking still works.
     Mouse and pen only, desktop layout only. */
  const REACH_Y   = 170;   // px: how far above and below the cursor the curve reaches
  const REACH_X   = 320;   // px: the cursor must also be this close sideways to the years
  const PUSH      = 52;    // px: how far the year at the cursor's height slides left
  const GROW      = 0.45;  // how much bigger the year at the cursor gets (0.45 = 45% bigger)
  // Phones: no cursor. The "cursor" is the middle of the screen, the years are scrolled past it,
  // and the year in the middle rises and grows while its neighbours follow the curve.
  const REACH_M   = 170;   // px: how far left and right of the screen's middle the curve reaches
  const PUSH_M    = 32.5;   // px: how far the year in the middle rises
  const TICK_MS   = 10;    // phones: length of the tiny vibration when a new year reaches the middle (0 = off)
  const STIFFNESS = 540;   // how hard each year is pulled toward where the cursor wants it (higher = snappier)
  const DAMPING   = 27;    // how quickly the swing dies out (lower = more bounce, higher = more stiff and calm)

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const yearItems = $$(".gal-year").map(btn => ({ btn, label: btn.firstChild, x: 0, vx: 0, y: 0, vy: 0, z: 1, vz: 0 }));
  let pointer = null;        // {x, y} while the mouse is over the timeline, else null
  let lastTime = 0;
  let running = false;
  let lastCentred = null;    // phones: which year was in the middle last time (for the vibration tick)

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.032);   // seconds, capped so a hiccup can't explode the spring
    lastTime = now;
    const mobile = isMobile();
    // desktop: no cursor effect while the banner is what you are looking at (the top of the timeline only peeks in below it)
    const active = mobile ? !current : (Boolean(pointer) && currentIndex() !== 0);
    // on a phone the loop only runs while the springs are still moving (scrolling wakes it up)
    let busy = active && !mobile;
    const rowBox = mobile ? yearsEl.getBoundingClientRect() : null;
    const middle = rowBox ? rowBox.left + rowBox.width / 2 : 0;
    let nearest = -1, nearestDist = Infinity;

    yearItems.forEach(item => {
      let tx = 0, ty = 0, tz = 1;
      if (active) {
        const r = item.btn.getBoundingClientRect();    // the button never moves
        if (mobile) {
          const dx = r.left + r.width / 2 - middle;
          if (Math.abs(dx) < nearestDist) { nearestDist = Math.abs(dx); nearest = yearItems.indexOf(item); }
          if (Math.abs(dx) < REACH_M) {
            const k = Math.PI * dx / REACH_M;
            const bell  = 0.5 + 0.5 * Math.cos(k);                 // 1 in the middle, 0 at the reach
            ty = -PUSH_M * bell;                                   // straight up
            tz = 1 + GROW * bell;
          }
        } else {
          const dy = r.top + r.height / 2 - pointer.y;
          const dx = r.left + r.width / 2 - pointer.x;

          const side = Math.max(0, 1 - Math.abs(dx) / REACH_X);
          const chosen = item.btn.classList.contains("is-selected");   // the open year stays put
          if (!chosen && Math.abs(dy) < REACH_Y && side > 0) {
            const k = Math.PI * dy / REACH_Y;
            const bell  = 0.5 + 0.5 * Math.cos(k);                 // 1 at the cursor, 0 at the reach
            const s = side * side * (3 - 2 * side);                // fade out when the cursor is far sideways
            tx = -PUSH * bell * s;
            tz = 1 + GROW * bell * s;
          }
        }
      }
      // a spring: each year is pulled toward its target, overshoots a touch, and settles
      item.vx += (STIFFNESS * (tx - item.x) - DAMPING * item.vx) * dt;
      item.x  += item.vx * dt;
      item.vy += (STIFFNESS * (ty - item.y) - DAMPING * item.vy) * dt;
      item.y  += item.vy * dt;
      item.vz += (STIFFNESS * (tz - item.z) - DAMPING * item.vz) * dt;
      item.z  += item.vz * dt;
      const still = Math.abs(tx - item.x) < 0.02 && Math.abs(ty - item.y) < 0.02 && Math.abs(tz - item.z) < 0.001 &&
                    Math.abs(item.vx) < 0.05 && Math.abs(item.vy) < 0.05 && Math.abs(item.vz) < 0.01;
      if (!still) busy = true;
      else if (!active) { item.x = 0; item.y = 0; item.z = 1; item.vx = item.vy = item.vz = 0; }
      item.label.style.translate = item.x.toFixed(2) + "px " + item.y.toFixed(2) + "px";
      item.label.style.scale = item.z.toFixed(3);
      // brightness: every year is quiet, and the one nearest the cursor (or the middle of the screen) glows
      if (item.btn.classList.contains("is-selected")) {
        item.label.style.opacity = "";
      } else {
        const base = current ? 0.3 : (mobile ? 0.4 : 0.5);        // resting brightness
        const near = Math.max(0, Math.min(1, (item.z - 1) / GROW)); // 0 = far, 1 = right at the cursor
        item.label.style.opacity = (base + (1 - base) * near).toFixed(2);
      }
    });

    // a tiny tick each time a different year reaches the middle (Android browsers; iPhones don't allow it)
    if (mobile && active && nearest >= 0) {
      if (lastCentred !== null && nearest !== lastCentred && TICK_MS && navigator.vibrate && !reduceMotion.matches) {
        try { navigator.vibrate(TICK_MS); } catch (e) {}
      }
      lastCentred = nearest;
    } else {
      lastCentred = null;
    }

    if (busy) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (running) return;
    running = true;
    lastTime = 0;
    requestAnimationFrame(frame);
  }

  perf.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || reduceMotion.matches) return;
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  }, { passive: true });
  perf.addEventListener("pointerleave", () => { pointer = null; wake(); });
  yearsEl.addEventListener("scroll", wake, { passive: true });
  scroller.addEventListener("scroll", wake, { passive: true });   // desktop: start/stop the effect as the banner scrolls away   // phones: scrolling the years drives the effect
  window.addEventListener("resize", wake);
  wake();

  yearsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".gal-year");
    if (!btn) return;
    if (btn.dataset.year === current) { clearYear(); return; }     // tapping the open year closes it
    selectYear(btn.dataset.year);
    goTo(perf, true);        // the timeline only peeks in below the banner: snap it up to fill the screen (the banner leaves the shot)
  });

  /* ---------- 3. Open a year ---------- */
  function selectYear(year) {
    if (!years.includes(year) || year === current) return;

    stopPlayer();
    current = year;

    $$(".gal-year").forEach(btn => {
      const on = btn.dataset.year === year;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", String(on));
    });

    // Showing a panel restarts its fade-in; --i staggers the concerts
    const panel = panels.find(p => p.dataset.year === year);
    panels.forEach(p => { p.hidden = p !== panel; });
    $$(".concert", panel).forEach((concert, i) => concert.style.setProperty("--i", i));

    buildTiles(panel);
    pane.scrollTop = 0;
    perf.classList.add("has-year");
    showMarker();
    scroller.classList.add("year-open");          // locks the page: only the pane moves
    writeHash(year);
    wake();
  }

  // The discrete "All years" button: close the open year
  function clearYear() {
    if (!current) return;
    stopPlayer();
    current = null;
    $$(".gal-year").forEach(btn => {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
    });
    perf.classList.remove("has-year");
    hideMarker();
    scroller.classList.remove("year-open");
    // hide the panel only after the pane has faded out
    setTimeout(() => { if (!current) panels.forEach(p => { p.hidden = true; }); }, 700);
    writeHash("performances");
    wake();
  }
  clearBtn.addEventListener("click", clearYear);

  /* ---------- 5. Video tiles ---------- */
  // A tile is only a frame until it is clicked: no YouTube request is made before that.
  // Tiles are built the first time their year is opened, so closed years cost nothing.
  function buildTiles(panel) {
    if (panel.dataset.ready) return;
    panel.dataset.ready = "1";
    $$(".vid", panel).forEach(buildTile);
  }

  function buildTile(tile) {
    tile.textContent = "";
    tile.classList.remove("is-playing");

    const id    = tile.dataset.yt || "";
    const title = tile.dataset.title || "Video";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vid-play";
    btn.setAttribute("aria-label", id ? "Play: " + title : title + " (coming soon)");

    if (tile.dataset.poster) {
      const img = new Image();
      img.src = tile.dataset.poster;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      btn.appendChild(img);
    }

    const ring = document.createElement("span");
    ring.className = "vid-ring";
    ring.setAttribute("aria-hidden", "true");
    btn.appendChild(ring);

    if (!id) {
      tile.classList.add("is-empty");
      const note = document.createElement("span");
      note.className = "vid-note";
      note.innerHTML = '<span class="lang-en">Coming soon</span><span class="lang-el">Σύντομα</span>';
      btn.appendChild(note);
    }

    tile.appendChild(btn);
  }

  pane.addEventListener("click", (e) => {
    const btn = e.target.closest(".vid-play");
    if (!btn) return;
    const tile = btn.parentElement;
    if (tile.dataset.yt) play(tile);
  });

  function play(tile) {
    stopPlayer();                       // only one video at a time
    tile.textContent = "";

    const frame = document.createElement("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(tile.dataset.yt) +
                "?autoplay=1&rel=0&playsinline=1" + (+tile.dataset.start > 0 ? "&start=" + Math.floor(+tile.dataset.start) : "");
    frame.title = tile.dataset.title || "Video";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;

    tile.appendChild(frame);
    tile.classList.add("is-playing");
    player = tile;
  }

  function stopPlayer() {
    if (!player) return;
    buildTile(player);                  // back to its poster
    player = null;
  }

  // On the first hover over any tile, open the connection to YouTube early
  let warmed = false;
  pane.addEventListener("pointerover", (e) => {
    if (warmed || !e.target.closest(".vid")) return;
    warmed = true;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://www.youtube-nocookie.com";
    document.head.appendChild(link);
  }, { passive: true });

  /* ---------- 4. Only the right-hand pane scrolls ---------- */
  const paneOpen = () => Boolean(current);

  // Mouse wheel anywhere on the stage (the pane itself scrolls natively)
  perf.addEventListener("wheel", (e) => {
    if (!paneOpen() || pane.contains(e.target)) return;
    e.preventDefault();
    pane.scrollTop += e.deltaY;
  }, { passive: false });

  // A finger dragging on the years drives the pane too
  let touchY = null;
  let touchX = null;
  perf.addEventListener("touchstart", (e) => {
    if (pane.contains(e.target)) { touchY = null; return; }
    touchY = e.touches[0].clientY;
    touchX = e.touches[0].clientX;
  }, { passive: true });
  perf.addEventListener("touchmove", (e) => {
    if (touchY === null || !paneOpen()) return;
    const t  = e.touches[0];
    const dy = touchY - t.clientY;
    const dx = touchX - t.clientX;
    if (Math.abs(dy) > Math.abs(dx)) pane.scrollTop += dy;   // sideways drags still move the year row
    touchY = t.clientY;
    touchX = t.clientX;
  }, { passive: true });

  /* Mobile, Performances section, no year open. The years scroll past the middle of the screen:
     - a sideways swipe ANYWHERE in the section moves them (on the row itself the browser does it;
       elsewhere we follow the finger ourselves, with a little momentum) and they settle with one
       year centred;
     - only when a swipe STARTS with the row already at its first/last year does it change
       section (last year, swipe left → Photos; first year, swipe right → Banner). */
  const yearCentre   = (i) => yearItems[i].btn.offsetLeft + yearItems[i].btn.offsetWidth / 2;
  const centredIndex = (scrollPos) => {
    const mid = scrollPos + yearsEl.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    yearItems.forEach((_, i) => {
      const dist = Math.abs(yearCentre(i) - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  };
  function centreOn(i) {
    i = Math.max(0, Math.min(yearItems.length - 1, i));
    yearsEl.scrollTo({ left: yearCentre(i) - yearsEl.clientWidth / 2, behavior: "smooth" });
  }

  let swipe = null;   // { x, y, s0, onRow, atStart, atEnd, drag, samples }
  perf.addEventListener("touchstart", (e) => {
    swipe = null;
    if (!isMobile() || current) return;
    const t = e.touches[0];
    const max = yearsEl.scrollWidth - yearsEl.clientWidth;
    swipe = {
      x: t.clientX, y: t.clientY, s0: yearsEl.scrollLeft,
      onRow: yearsEl.contains(e.target),
      atStart: yearsEl.scrollLeft <= 1,
      atEnd: yearsEl.scrollLeft >= max - 1,
      drag: false, samples: []
    };
  }, { passive: true });

  perf.addEventListener("touchmove", (e) => {
    if (!swipe || swipe.onRow) return;               // on the row the browser scrolls it for us
    const t  = e.touches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (!swipe.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      swipe.drag = true;
      yearsEl.classList.add("is-dragging");          // switches the snapping off while the finger is down
    }
    if (!swipe.drag) return;
    e.preventDefault();
    yearsEl.scrollLeft = swipe.s0 - dx;
    swipe.samples.push({ x: t.clientX, t: performance.now() });
    while (swipe.samples.length > 2 && performance.now() - swipe.samples[0].t > 100) swipe.samples.shift();
  }, { passive: false });

  perf.addEventListener("touchend", (e) => {
    const sw = swipe;
    swipe = null;
    if (!sw || current) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - sw.x;
    const dy = t.clientY - sw.y;

    if (sw.onRow) {
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0 && sw.atEnd)   { goTo(photos, true); writeHash("photos"); }
      if (dx > 0 && sw.atStart) { goTo(banner, true); writeHash(""); }
      return;
    }

    if (!sw.drag) return;
    yearsEl.classList.remove("is-dragging");
    if (Math.abs(dx) >= 50) {
      if (dx < 0 && sw.atEnd)   { goTo(photos, true); writeHash("photos"); return; }
      if (dx > 0 && sw.atStart) { goTo(banner, true); writeHash(""); return; }
    }
    // a little momentum, then settle on the nearest year
    const first = sw.samples[0], last = sw.samples[sw.samples.length - 1];
    const v = (last && first && last.t > first.t) ? (last.x - first.x) / (last.t - first.t) : 0;   // px per ms
    centreOn(centredIndex(yearsEl.scrollLeft - v * 220));
  });
  perf.addEventListener("touchcancel", () => {
    if (swipe && swipe.drag) { yearsEl.classList.remove("is-dragging"); centreOn(centredIndex(yearsEl.scrollLeft)); }
    swipe = null;
  });

  /* ---------- Moving between sections with wheel and keys (no year open) ----------
     Mobile layout: in Performances the wheel (either direction) and ← → move the year row,
     exactly like swiping it; only a gesture that STARTS with the row already at its first or
     last year changes section. In Banner / Photos they step to the next section.
     Desktop layout: ↓ PageDown / ↑ PageUp step between sections (the wheel snaps natively). */
  const sections  = [banner, perf, photos];
  const sectionId = ["banner", "performances", "photos"];

  function currentIndex() {
    const mobile = isMobile();
    const pos = mobile ? scroller.scrollLeft : scroller.scrollTop;
    let best = 0, bestDist = Infinity;
    sections.forEach((sec, i) => {
      const dist = Math.abs((mobile ? sec.offsetLeft : sec.offsetTop) - pos);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  function stepSection(dir) {
    const i = currentIndex() + dir;
    if (i < 0 || i >= sections.length) return;
    goTo(sections[i], true);
    writeHash(i === 0 ? "" : sectionId[i]);
  }

  const rowEdges = () => {
    const max = yearsEl.scrollWidth - yearsEl.clientWidth;
    return { start: yearsEl.scrollLeft <= 1, end: yearsEl.scrollLeft >= max - 1 };
  };

  let wheelLast = 0, wheelLock = 0, wheelAcc = 0, wheelStep = 0, wheelEdge = { start: false, end: false };
  scroller.addEventListener("wheel", (e) => {
    if (!isMobile() || current) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();

    const now = Date.now();
    const fresh = now - wheelLast > 300;      // a new wheel gesture, not the tail of the last one
    wheelLast = now;
    if (fresh) wheelAcc = 0;
    if (now < wheelLock) return;

    if (currentIndex() === 1) {
      if (fresh) wheelEdge = rowEdges();
      if (fresh && ((d > 0 && wheelEdge.end) || (d < 0 && wheelEdge.start))) {
        wheelLock = now + 700;
        stepSection(d > 0 ? 1 : -1);
        return;
      }
      wheelAcc += d;                                   // enough wheel = move on by one year
      if (Math.abs(wheelAcc) >= 40 && now >= wheelStep) {
        centreOn(centredIndex(yearsEl.scrollLeft) + (wheelAcc > 0 ? 1 : -1));
        wheelAcc = 0;
        wheelStep = now + 160;
      }
    } else if (fresh) {
      wheelLock = now + 700;
      stepSection(d > 0 ? 1 : -1);
    }
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (current || e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;

    if (isMobile()) {
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (currentIndex() === 1) {
        const edge = rowEdges();
        if ((dir > 0 && edge.end) || (dir < 0 && edge.start)) { if (!e.repeat) stepSection(dir); }
        else centreOn(centredIndex(yearsEl.scrollLeft) + dir);
      } else if (!e.repeat) {
        stepSection(dir);
      }
    } else {
      const dir = (e.key === "ArrowDown" || e.key === "PageDown") ? 1
                : (e.key === "ArrowUp" || e.key === "PageUp") ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (!e.repeat) stepSection(dir);
    }
  });

  /* ---------- 6. Banner / Performances / Photos, and the # in the address ---------- */
  // Sections sit below each other on desktop and side by side on mobile
  function goTo(section, smooth) {
    if (current && section !== perf) clearYear();     // leaving the timeline closes the year
    const behavior = smooth ? "smooth" : "auto";
    scroller.scrollTo(isMobile()
      ? { left: section.offsetLeft, behavior }
      : { top: section.offsetTop, behavior });
  }

  const targets = { performances: perf, photos: photos, banner: banner };

  // Every element with data-go="performances" or data-go="photos" is a button to that section
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-go]");
    if (!el) return;
    e.preventDefault();
    const name = el.dataset.go;
    goTo(targets[name], true);
    writeHash(name === "banner" ? "" : name);
  });

  // The address follows where you are: banner = no #, then #performances (or #2025 with a year open), then #photos
  function syncHash() {
    if (current) { writeHash(current); return; }
    const i = currentIndex();
    writeHash(i === 0 ? "" : sectionId[i]);
  }
  let hashTimer = 0;
  scroller.addEventListener("scroll", () => {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(syncHash, 140);          // wait until the scrolling has settled
  }, { passive: true });

  // gallery/#performances, gallery/#photos, gallery/#2025 (opens that year)
  function fromHash() {
    let hash = location.hash.slice(1);
    if (hash === "videos") hash = "performances";
    if (hash === "photographs") hash = "photos";
    if (/^\d{4}$/.test(hash)) {
      selectYear(hash);
      goTo(perf, false);
    } else if (targets[hash]) {
      goTo(targets[hash], false);
    }
  }
  setTop();
  fromHash();
  window.addEventListener("hashchange", fromHash);

  /* ---------- Title-screen intro ----------
     The page starts as a black screen with GALLERY in the middle. The word then travels to the
     banner's title (same place, same size) while the black fades slowly into the real page.
     Timings are in ms; change them here. */
  (function intro() {
    const root    = document.documentElement;
    const overlay = $("#gal-intro");
    const title   = $(".gal-title");
    if (!overlay || !title || !root.classList.contains("gal-intro-on")) return;

    const HOLD = 150;        // the word sits in the middle for this long before it moves
    const MOVE = 900;        // how long it takes to travel to its place
    const FADE = 1100;       // how long the black takes to fade away (it starts just after the move begins)

    const finish = () => {
      root.classList.add("gal-landed");               // shows the real title, exactly under the word
      overlay.remove();
      setTimeout(() => root.classList.remove("gal-intro-on", "gal-landed"), 2300);   // after the underline and arrows have faded in
    };

    const start = () => {
      const bg = overlay.firstElementChild;
      const atTop = scroller.scrollTop <= 5 && scroller.scrollLeft <= 5;   // the banner is what we land on

      const r    = title.getBoundingClientRect();
      const word = title.cloneNode(true);             // the same text, in the language in use
      word.removeAttribute("id");
      word.className = "gal-intro-word";
      const cs = getComputedStyle(title);               // copy the real title's size, so phone and desktop both match
      Object.assign(word.style, {
        position: "fixed", left: r.left + "px", top: r.top + "px", opacity: "0",
        fontSize: cs.fontSize, letterSpacing: cs.letterSpacing
      });
      overlay.appendChild(word);

      const w  = word.getBoundingClientRect();        // where the word will end up
      const k  = Math.min(1.7, (innerWidth * 0.88) / w.width);   // how much bigger it is on the title screen
      const dx = innerWidth  / 2 - (w.left + w.width  / 2);
      const dy = innerHeight / 2 - (w.top  + w.height / 2);
      const from = "translate(" + dx + "px," + dy + "px) scale(" + k + ")";
      word.style.transform = from;

      word.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" });
      setTimeout(() => {
        if (atTop) {
          // landing on the banner: the word travels to the banner's title while the black fades
          word.animate([{ transform: from }, { transform: "none" }],
                       { duration: MOVE, easing: "cubic-bezier(0.65, 0, 0.2, 1)", fill: "forwards" });
          bg.animate([{ opacity: 1 }, { opacity: 0 }],
                     { duration: FADE, delay: 100, easing: "ease-in-out", fill: "forwards" }).onfinish = finish;
        } else {
          // opened further down (e.g. gallery/#performances): the word stays in the middle and fades out with the black
          word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-in-out", fill: "forwards" });
          bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-in-out", fill: "forwards" }).onfinish = finish;
        }
      }, HOLD + 300);
    };

    // wait for the fonts, so the word is measured in its real typeface (but never longer than 0.8 s)
    Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(res => setTimeout(res, 800))
    ]).then(start);
  })();
  window.addEventListener("resize", () => {            // keep the current section in view on rotate/resize
    const hash = location.hash.slice(1);
    if (targets[hash]) goTo(targets[hash], false);
  });
})();
