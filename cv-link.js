/* ==========================================================================
   cv-link.js: the "Download CV" links (main page contact section and contact/ page).
   Each <a class="cv-link" data-cv-base="..."> points at the CV in the active language
   (English for English and Chinese, Greek for Greek) and shows itself only if that PDF really exists,
   so no dead link is ever visible.
   Files: assets/cv/CV-Michail-Chatziasemidis-EN.pdf and ...-EL.pdf
   data-cv-base is the path from the page to the assets/cv/ folder ("assets/cv/" on the main page, "../assets/cv/" in contact/).
   ========================================================================== */
(function () {
  "use strict";
  var links = Array.prototype.slice.call(document.querySelectorAll("a.cv-link[data-cv-base]"));
  if (!links.length) return;
  var known = {};                                   // file -> true / false once checked

  function langNow() { return document.body.classList.contains("lang-el-active") ? "EL" : "EN"; }

  function update(link) {
    var file = link.getAttribute("data-cv-base") + "CV-Michail-Chatziasemidis-" + langNow() + ".pdf";
    link.setAttribute("href", file);
    link.setAttribute("download", file.split("/").pop());
    if (file in known) { link.hidden = !known[file]; return; }
    link.hidden = true;
    fetch(file, { method: "HEAD" }).then(function (r) { known[file] = r.ok; }, function () { known[file] = false; })
      .then(function () { if (link.getAttribute("href") === file) link.hidden = !known[file]; });
  }
  function updateAll() { links.forEach(update); }

  updateAll();
  new MutationObserver(updateAll).observe(document.body, { attributes: true, attributeFilter: ["class"] });
})();
