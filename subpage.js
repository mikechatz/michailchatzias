/* ==========================================================================
   subpage.js — shared by /contact/ and the future /works/ and /gallery/ pages.
   Handles: language switcher (same storage key as the main page) and the contact form.
   The main page's script.js is NOT loaded on subpages (it drives the sliding book).
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const byId = (id) => document.getElementById(id);

  /* ---------- Language switcher ---------- */
  /* Page titles come from data-title-xx on <body>, so every subpage can set its own. */
  const TITLES = {
    en: body.dataset.titleEn,
    el: body.dataset.titleEl,
    cn: body.dataset.titleCn
  };

  /* To add a language: add its button id here, its title in the body data attribute,
     and its strings in PLACEHOLDERS and I18N below. */
  /* Every button with data-lang (top bar and hamburger menu) switches the language. */
  const LANGS = ["en", "el", "cn"];
  const LANG_BTNS = Array.from(document.querySelectorAll(".lang-btn[data-lang]"));

  const PLACEHOLDERS = {
    en: {
      "form-name":    "Name / Ensemble",
      "form-email":   "you@domain.com",
      "form-subject": "Game Audio / Composition Commission",
      "form-message": "Tell me about your project or inquiry..."
    },
    el: {
      "form-name":    "Όνομα / Σύνολο",
      "form-email":   "you@domain.com",
      "form-subject": "Game Audio / Ανάθεση Σύνθεσης",
      "form-message": "Πείτε μου για το έργο ή το αίτημά σας..."
    },
    cn: {
      "form-name":    "姓名 / 乐团",
      "form-email":   "you@domain.com",
      "form-subject": "游戏音频 / 委约作曲",
      "form-message": "请告诉我您的项目或咨询内容..."
    }
  };

  function setLanguage(lang) {
    if (!LANGS.includes(lang)) lang = "en";

    LANGS.forEach(l => body.classList.remove(`lang-${l}-active`));
    body.classList.add(`lang-${lang}-active`);
    document.documentElement.lang = lang;

    LANG_BTNS.forEach(btn => btn.classList.toggle("active", btn.dataset.lang === lang));

    document.title = TITLES[lang] || TITLES.en || document.title;
    try { localStorage.setItem("preferred_lang", lang); } catch (e) {}

    const p = PLACEHOLDERS[lang] || PLACEHOLDERS.en;
    Object.entries(p).forEach(([id, text]) => {
      const el = byId(id);
      if (el) el.placeholder = text;
    });
  }

  LANG_BTNS.forEach(btn => btn.addEventListener("click", () => setLanguage(btn.dataset.lang)));

  /* ---------- Hamburger menu (phones) ---------- */
  const menu     = byId("mobile-menu");
  const backdrop = byId("mobile-menu-backdrop");
  const burger   = byId("mobile-hamburger");
  const closeBtn = byId("mobile-menu-close");

  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("open", open);
    if (backdrop) backdrop.classList.toggle("visible", open);
    menu.setAttribute("aria-hidden", String(!open));
    if (burger) burger.setAttribute("aria-expanded", String(open));
  }
  if (burger)   burger.addEventListener("click", () => setMenu(true));
  if (closeBtn) closeBtn.addEventListener("click", () => setMenu(false));
  if (backdrop) backdrop.addEventListener("click", () => setMenu(false));
  if (menu)     menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  let saved = "en";
  try { saved = localStorage.getItem("preferred_lang") || "en"; } catch (e) {}
  setLanguage(saved);

  /* ---------- Contact form (Formspree) ---------- */
  const contactForm   = byId("contact-form");
  const formStatus    = byId("form-status");
  const formSubmitBtn = byId("form-submit-btn");

  if (contactForm) {
    const I18N = {
      en: {
        sending: "Sending...",
        success: "Thank you! Your message has been sent.",
        error:   "Oops! There was a problem. Please try again or email directly.",
        submit:  "Send Message"
      },
      el: {
        sending: "ΑΠΟΣΤΟΛΗ...",
        success: "Ευχαριστώ! Το μήνυμά σας εστάλη επιτυχώς.",
        error:   "Παρουσιάστηκε σφάλμα. Παρακαλώ δοκιμάστε ξανά ή στείλτε απευθείας email.",
        submit:  "ΑΠΟΣΤΟΛΗ ΜΗΝΥΜΑΤΟΣ"
      },
      cn: {
        sending: "发送中...",
        success: "谢谢！您的消息已成功发送。",
        error:   "发送失败，请重试或直接发送电子邮件。",
        submit:  "发送消息"
      }
    };

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lang = document.documentElement.lang || "en";
      const t = I18N[lang] || I18N.en;

      formSubmitBtn.disabled = true;
      formSubmitBtn.textContent = t.sending;
      formStatus.className = "form-status";
      formStatus.style.display = "none";

      const action   = contactForm.getAttribute("action");
      const formData = new FormData(contactForm);

      try {
        const response = await fetch(action, {
          method: "POST",
          body: formData,
          headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error("Submission failed");

        formStatus.textContent = t.success;
        formStatus.classList.add("success");
        formStatus.style.display = "block";
        contactForm.reset();
      } catch (err) {
        formStatus.textContent = t.error;
        formStatus.classList.add("error");
        formStatus.style.display = "block";
      } finally {
        formSubmitBtn.disabled = false;
        formSubmitBtn.textContent = t.submit;
      }
    });
  }
});