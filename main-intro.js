/* ==========================================================================
   main-intro.js — the title-screen intro of the main page.

   The page starts as a black screen with the name in the middle. The name then travels to
   its place in the hero (same place, same size) while the black fades slowly into the page.
   If the page is opened somewhere other than the hero (e.g. /#works), the name just stays
   in the middle and fades out together with the black.

   Timings are in milliseconds; change them here.
   ========================================================================== */
(() => {
  "use strict";

  const root    = document.documentElement;
  const overlay = document.getElementById("main-intro");
  const h1      = document.querySelector(".hero-block h1");
  if (!overlay || !h1 || !root.classList.contains("intro-on")) return;

  const HOLD = 150;     // the name sits in the middle this long before it moves
  const MOVE = 900;     // how long it takes to travel to its place
  const FADE = 1100;    // how long the black takes to fade away
  const BIG  = 1.3;     // the name is up to this much bigger on the title screen

  // While the black screen is up, the page underneath must not scroll or slide
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  overlay.addEventListener("wheel", stop, { passive: false });
  overlay.addEventListener("touchmove", stop, { passive: false });

  const finish = () => {
    overlay.removeEventListener("wheel", stop);
    overlay.removeEventListener("touchmove", stop);
    root.classList.add("intro-landed");                // shows the real name, exactly under the word
    overlay.remove();
    setTimeout(() => root.classList.remove("intro-on", "intro-landed"), 1600);   // after the rest of the hero has faded in
  };

  const start = () => {
    const bg = overlay.firstElementChild;

    // the lines of the name that are showing right now (one language at a time)
    const lines = Array.from(h1.querySelectorAll(".name-line"))
      .filter(el => getComputedStyle(el).display !== "none");
    const r  = h1.getBoundingClientRect();
    const cs = getComputedStyle(h1);

    // build a copy of the name, laid out exactly like the real one
    const word = document.createElement("div");
    word.className = "main-intro-word";
    Object.assign(word.style, {
      position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", margin: "0",
      fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: cs.fontSize,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform,
      opacity: "0"
    });
    word.style.textAlign = cs.textAlign;
    word.style.wordBreak = cs.wordBreak;
    lines.forEach(el => {
      const line = document.createElement("span");
      line.className = "intro-line";
      line.textContent = el.textContent;
      line.style.display = getComputedStyle(el).display;     // block or inline, exactly as in the real name
      line.style.textAlign = getComputedStyle(el).textAlign;
      word.appendChild(line);
      word.appendChild(document.createTextNode(" "));        // the space between lines, as in the real markup
    });
    overlay.appendChild(word);

    // where the words really are (the block is wider than the text), to centre the TEXT on the screen
    const range = document.createRange();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    word.querySelectorAll(".intro-line").forEach(line => {
      range.selectNodeContents(line);
      const t = range.getBoundingClientRect();
      left = Math.min(left, t.left); right = Math.max(right, t.right);
      top = Math.min(top, t.top);    bottom = Math.max(bottom, t.bottom);
    });
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const k  = Math.min(BIG, (innerWidth * 0.88) / (right - left));
    const from = "translate(" + (innerWidth / 2 - cx) + "px," + (innerHeight / 2 - cy) + "px) scale(" + k + ")";
    word.style.transformOrigin = (cx - r.left) + "px " + (cy - r.top) + "px";
    word.style.transform = from;

    // is the hero what we land on?
    // (a # in the address, such as /#expertise, means the page is about to slide somewhere else, so never land on the hero then)
    const wantsHero = !location.hash || location.hash === "#hero";
    const onHero = wantsHero && r.top >= -2 && r.bottom <= innerHeight + 2 && r.right > 0 && r.left < innerWidth;

    word.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "forwards" });
    setTimeout(() => {
      if (onHero) {
        word.animate([{ transform: from }, { transform: "none" }],
                     { duration: MOVE, easing: "cubic-bezier(0.65, 0, 0.2, 1)", fill: "forwards" });
        bg.animate([{ opacity: 1 }, { opacity: 0 }],
                   { duration: FADE, delay: 100, easing: "ease-in-out", fill: "forwards" }).onfinish = finish;
      } else {
        word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-in-out", fill: "forwards" });
        bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE, easing: "ease-in-out", fill: "forwards" }).onfinish = finish;
      }
    }, HOLD + 300);
  };

  // The page decides which language is showing a moment after it loads; the name can only be measured after that
  const languageReady = () => new Promise(res => {
    const t0 = Date.now();
    const check = () => {
      if (/lang-\w+-active/.test(document.body.className) || Date.now() - t0 > 1000) res();
      else setTimeout(check, 30);
    };
    check();
  });

  // wait for the fonts and the language, then one layout pass, so the name is measured as it really looks
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise(res => setTimeout(res, 800))
  ]).then(languageReady).then(() => requestAnimationFrame(() => requestAnimationFrame(start)));
})();