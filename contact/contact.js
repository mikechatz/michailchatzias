/* ==========================================================================
   contact/contact.js — the "Subject" field: a text box you can type in freely,
   with an arrow at its end that opens a list of prepared subjects.
   Choosing one only fills the box (replacing what was there); the box stays fully editable.
   The suggestions themselves are the <li role="option"> items in contact/index.html.
   ========================================================================== */
(function () {
  "use strict";
  var field  = document.getElementById("subject-field");
  var input  = document.getElementById("form-subject");
  var toggle = document.getElementById("subject-toggle");
  var pop    = document.getElementById("subject-pop");
  var list   = document.getElementById("subject-list");
  if (!field || !input || !toggle || !pop || !list) return;

  var opts = Array.prototype.slice.call(list.querySelectorAll('[role="option"]'));
  var active = -1;
  var isOpen = false;

  // the text inserted is in the language the page is showing
  function lang() {
    var c = document.body.classList;
    return c.contains("lang-el-active") ? "el" : c.contains("lang-cn-active") ? "cn" : "en";
  }
  function textOf(o) { return o.getAttribute("data-" + lang()) || o.getAttribute("data-en") || o.textContent; }

  function setActive(i) {
    active = i;
    opts.forEach(function (o, k) { o.classList.toggle("is-active", k === i); });
    if (i >= 0) {
      input.setAttribute("aria-activedescendant", opts[i].id);
      var o = opts[i], top = o.offsetTop, bottom = top + o.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function markSelected() {
    var v = input.value.trim().toLowerCase();
    opts.forEach(function (o) { o.setAttribute("aria-selected", String(v !== "" && textOf(o).toLowerCase() === v)); });
  }

  function show() {
    if (isOpen) return;
    markSelected();
    pop.classList.remove("up");
    list.style.maxHeight = "";
    pop.hidden = false;
    // open downward when there is room; otherwise upward if that has more room; the list shrinks (and scrolls) to fit
    var r = input.getBoundingClientRect();
    var below = window.innerHeight - r.bottom - 16, above = r.top - 16;
    var chrome = pop.offsetHeight - list.offsetHeight;                // the hint line and borders
    var want = pop.offsetHeight;
    if (want > below && above > below) pop.classList.add("up");
    var room = pop.classList.contains("up") ? above : below;
    if (want > room) list.style.maxHeight = Math.max(120, room - chrome) + "px";
    isOpen = true;
    toggle.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    list.scrollTop = 0;
  }
  function hide() {
    if (!isOpen) return;
    pop.hidden = true;
    isOpen = false;
    toggle.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  }

  function choose(i) {
    input.value = textOf(opts[i]);
    input.dispatchEvent(new Event("input", { bubbles: true }));   // (so the form and any validation notice the change)
    hide();
    input.focus();
    var n = input.value.length;
    try { input.setSelectionRange(n, n); } catch (e) {}           // the cursor waits at the end: carry on typing
  }

  toggle.addEventListener("click", function () { if (isOpen) hide(); else show(); });

  opts.forEach(function (o, i) {
    o.addEventListener("mousedown", function (e) { e.preventDefault(); });   // keep the focus where it is
    o.addEventListener("click", function () { choose(i); });
    o.addEventListener("mousemove", function () { if (active !== i) setActive(i); });
  });

  function onKey(e) {
    var k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) { show(); setActive(k === "ArrowDown" ? 0 : opts.length - 1); return; }
      var n = opts.length;
      setActive(k === "ArrowDown" ? (active + 1) % n : (active - 1 + n) % n);
    } else if (k === "Enter" && isOpen && active >= 0) {
      e.preventDefault();                                         // choose the suggestion instead of sending the form
      choose(active);
    } else if (k === "Escape" && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      hide();
    } else if (k === "Tab") {
      hide();
    }
  }
  input.addEventListener("keydown", onKey);
  toggle.addEventListener("keydown", onKey);

  // typing means "I know what I want": the list steps out of the way (a suggestion being filled in does not count)
  input.addEventListener("input", function (e) { if (e.isTrusted) hide(); });

  document.addEventListener("pointerdown", function (e) { if (isOpen && !field.contains(e.target)) hide(); });
  field.addEventListener("focusout", function (e) { if (isOpen && e.relatedTarget && !field.contains(e.relatedTarget)) hide(); });

  // A link such as contact/?subject=composition arrives with that suggestion already in the box (still editable).
  // Only the keys of the suggestions are accepted; anything else is ignored.
  try {
    var want = new URLSearchParams(window.location.search).get("subject");
    if (want && input.value === "") {
      var hit = opts.filter(function (o) { return o.getAttribute("data-key") === want; })[0];
      if (hit) input.value = textOf(hit);
    }
  } catch (e) {}

  // Switching the language also switches a suggestion that has not been touched (it still reads exactly like one)
  var shownLang = lang();
  new MutationObserver(function () {
    var now = lang();
    if (now === shownLang) return;
    var v = input.value.trim().toLowerCase();
    var hit = v && opts.filter(function (o) { return (o.getAttribute("data-" + shownLang) || "").toLowerCase() === v; })[0];
    shownLang = now;
    if (hit) input.value = textOf(hit);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
