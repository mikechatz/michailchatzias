/* ==========================================================================
   MICHAÏL CHATZIASEMIDIS — PORTFOLIO SCRIPT
   Stacked Leaf Architecture, Seamless Margins, Restored Top Bar & Navigation
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------------------------------------
  // 1. STACKED LEAF BOOK & NAVIGATION CONTROLLER
  // ------------------------------------------------------------------------
  const panels = [
    document.getElementById("panel-intro"),
    document.getElementById("panel-craft"),
    document.getElementById("panel-works"),
    document.getElementById("panel-gallery"),
    document.getElementById("panel-contact")
  ];

  const introSpine = document.getElementById("panel-intro-spine");
  const panelIntroContent = document.getElementById("panel-intro-content");
  const sectionAbout = document.getElementById("section-about");
  const progress = document.getElementById("slide-progress");
  const totalPanels = panels.length; // 5 panels

  let currentTabIndex = 0;
  let isNavigating = false;
  let introStep = 0; // 0 = Hero, 1 = About

  function updateActiveNav(index, isAboutInView = false) {
    document.querySelectorAll(".nav-tabs a").forEach(tab => tab.classList.remove("active"));
    
    if (index === 0) {
      if (isAboutInView) {
        const aboutTab = document.getElementById("tab-nav-about");
        if (aboutTab) aboutTab.classList.add("active");
      }
    } else {
      const tabIds = ["", "tab-nav-craft", "tab-nav-works", "tab-nav-gallery", "tab-nav-contact"];
      const activeEl = document.getElementById(tabIds[index]);
      if (activeEl) activeEl.classList.add("active");
    }
  }

  function updateAboutMargin() {
    if (!introSpine) return;
    if (currentTabIndex > 0) {
      // Always visible docked on the left for Craft, Works, Gallery, Contact
      introSpine.classList.add("visible");
    } else {
      // In Panel 0: visible when scrolled to About (introStep === 1), hidden in Hero shot
      introSpine.classList.toggle("visible", introStep === 1);
    }
  }

  function updateProgress() {
    if (!progress) return;
    if (currentTabIndex === 0) {
      const scrollY = panelIntroContent ? panelIntroContent.scrollTop : 0;
      // In the hero shot progress is at zero, smoothly progresses down to the about tab (up to 0.20)
      const fraction = Math.min(1, Math.max(0, scrollY / 400));
      const introRatio = fraction * 0.20;
      progress.style.transform = `scaleX(${introRatio})`;
    } else {
      // Craft: 0.40, Works: 0.60, Gallery: 0.80, Contact: 1.00
      const panelRatio = (currentTabIndex + 1) / totalPanels;
      progress.style.transform = `scaleX(${panelRatio})`;
    }
  }

  function goToTab(index, subTarget = null) {
    if (index < 0 || index >= totalPanels) return;
    currentTabIndex = index;

    // Stacked leaves animation:
    // Panels up to index slide into stacked view; subsequent panels slide away to the right
    panels.forEach((panel, i) => {
      if (!panel) return;
      if (i <= index) {
        panel.style.transform = "translateX(0)";
      } else {
        panel.style.transform = "translateX(100vw)";
      }
    });

    if (index === 0) {
      if (subTarget === "about") {
        introStep = 1;
        updateActiveNav(0, true);
        setTimeout(() => {
          scrollToAbout();
          updateAboutMargin();
          updateProgress();
        }, 120);
      } else {
        introStep = 0;
        updateActiveNav(0, false);
        scrollToHero();
        setTimeout(() => {
          updateAboutMargin();
          updateProgress();
        }, 120);
      }
    } else {
      updateActiveNav(index);
      const content = panels[index].querySelector(".leaf-content");
      if (content) content.scrollTop = 0;
      updateAboutMargin();
      updateProgress();
    }
  }

  // Handle clicks on any navigation element with data-tab-index
  // (Both top bar tabs AND stacked margins on the left edge!)
  document.querySelectorAll("[data-tab-index]").forEach(elem => {
    elem.addEventListener("click", (e) => {
      e.preventDefault();
      const targetIndex = parseInt(elem.dataset.tabIndex, 10);
      const subTarget = elem.dataset.subTarget || null;
      goToTab(targetIndex, subTarget);
    });
  });

  // Hero "Scroll Down ↓" button
  const heroScrollBtn = document.getElementById("hero-scroll-btn");
  if (heroScrollBtn) {
    heroScrollBtn.addEventListener("click", () => {
      introStep = 1;
      scrollToAbout();
      updateActiveNav(0, true);
      setTimeout(() => {
        updateAboutMargin();
        updateProgress();
      }, 150);
    });
  }

  // Helper: scroll the intro panel to About section
  function scrollToAbout(animate = true) {
    if (!panelIntroContent || !sectionAbout) return;
    const targetTop = sectionAbout.offsetTop;
    panelIntroContent.scrollTo({ top: targetTop, behavior: animate ? "smooth" : "instant" });
  }

  // Helper: scroll the intro panel back to Hero (top)
  function scrollToHero(animate = true) {
    if (!panelIntroContent) return;
    panelIntroContent.scrollTo({ top: 0, behavior: animate ? "smooth" : "instant" });
  }
  if (panelIntroContent) {
    panelIntroContent.addEventListener("scroll", () => {
      if (currentTabIndex === 0) {
        const isAboutScrolled = panelIntroContent.scrollTop > 80;
        introStep = isAboutScrolled ? 1 : 0;
        updateActiveNav(0, isAboutScrolled);
        updateAboutMargin();
        updateProgress();
      }
    }, { passive: true });
  }

  // Also track wheel events INSIDE panelIntroContent so natural scrolling updates state
  if (panelIntroContent) {
    panelIntroContent.addEventListener("wheel", (e) => {
      // Allow native scrolling inside panel-intro; updateAboutMargin will fire via scroll listener
    }, { passive: true });
  }

  // ------------------------------------------------------------------------
  // UNIFIED NAVIGATION (KEYBOARD + MOUSE WHEEL)
  // ------------------------------------------------------------------------
  function handleGoNext() {
    if (isNavigating) return;

    if (currentTabIndex === 0) {
      if (introStep === 0) {
        // Step 1: Scroll down to About
        isNavigating = true;
        introStep = 1;
        scrollToAbout();
        updateActiveNav(0, true);
        setTimeout(() => {
          updateAboutMargin();
          updateProgress();
          isNavigating = false;
        }, 450);
      } else {
        // Step 2: At About -> Slide to Craft (Leaf 1)
        isNavigating = true;
        goToTab(1);
        setTimeout(() => { isNavigating = false; }, 650);
      }
    } else {
      // In Craft, Works, Gallery, Contact -> keep sliding forward
      if (currentTabIndex < totalPanels - 1) {
        isNavigating = true;
        goToTab(currentTabIndex + 1);
        setTimeout(() => { isNavigating = false; }, 650);
      }
    }
  }

  function handleGoPrev() {
    if (isNavigating) return;

    if (currentTabIndex === 0) {
      if (introStep === 1 || panelIntroContent.scrollTop > 50) {
        // Scroll back up to Hero
        isNavigating = true;
        introStep = 0;
        scrollToHero();
        updateActiveNav(0, false);
        setTimeout(() => {
          updateAboutMargin();
          updateProgress();
          isNavigating = false;
        }, 450);
      }
    } else {
      // Slide back to previous leaf
      isNavigating = true;
      const prev = currentTabIndex - 1;
      goToTab(prev);
      if (prev === 0) {
        introStep = 1;
        setTimeout(() => {
          scrollToAbout();
          updateActiveNav(0, true);
        }, 60);
      }
      setTimeout(() => { isNavigating = false; }, 650);
    }
  }

  // Keyboard Navigation:
  // Right Arrow, Down Arrow, Page Down -> EXACT SAME AS SCROLLING DOWN
  // Left Arrow, Up Arrow, Page Up     -> EXACT SAME AS SCROLLING UP
  window.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      handleGoNext();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      handleGoPrev();
    }
  });

  // Mouse Wheel Navigation
  // When inside panel-intro: natural scrolling drives introStep via scroll listener.
  // handleGoNext/Prev are called only when at the edges (top/bottom of intro content).
  window.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) < 20) return;

    if (currentTabIndex === 0) {
      // Inside intro panel: let the scroll happen naturally; only intercept at boundaries
      if (e.deltaY > 0) {
        // Scrolling down
        if (introStep === 0) {
          // At hero — trigger transition to About
          handleGoNext();
        } else {
          // At About — if at bottom of scroll container, slide to Craft
          const atBottom = panelIntroContent.scrollTop + panelIntroContent.clientHeight >= panelIntroContent.scrollHeight - 20;
          if (atBottom) handleGoNext();
          // else: let native scroll happen
        }
      } else {
        // Scrolling up
        if (introStep === 1) {
          const atTop = panelIntroContent.scrollTop <= 80;
          if (atTop) handleGoPrev();
          // else: let native scroll happen
        }
      }
    } else {
      if (e.deltaY > 0) {
        handleGoNext();
      } else {
        handleGoPrev();
      }
    }
  }, { passive: true });
  
  // ------------------------------------------------------------------------
  // MOBILE NAVIGATION SYSTEM — CSS Snap, minimal JS
  // ------------------------------------------------------------------------
  const isMobile = () => window.innerWidth <= 768;

  const wrapper            = document.querySelector(".book-slider-wrapper");
  const mobileCentreName   = document.getElementById("mobile-centre-name");
  const mobileMenu         = document.getElementById("mobile-menu");
  const mobileMenuBackdrop = document.getElementById("mobile-menu-backdrop");
  const mobileHamburger    = document.getElementById("mobile-hamburger");
  const mobileMenuClose    = document.getElementById("mobile-menu-close");
  const mobileRhomboids    = document.querySelectorAll(".mobile-rhomboid");
  const mobileMenuLinks    = document.querySelectorAll(".mobile-menu-link");
  const mobileBtnEn        = document.getElementById("mobile-btn-lang-en");
  const mobileBtnEl        = document.getElementById("mobile-btn-lang-el");

  /* Snap sections in order — matches rhomboid order */
  const mobileSnapSections = [
    "section-hero",    /* rhomboid hidden */
    "section-about",   /* rhomboid 0 */
    "panel-craft",     /* rhomboid 1 */
    "panel-works",     /* rhomboid 2 */
    "panel-gallery",   /* rhomboid 3 */
    "panel-contact"    /* rhomboid 4 */
  ];

  /* ── Reset desktop transforms on mobile ── */
  function initMobile() {
    if (!isMobile()) return;
    panels.forEach(panel => {
      if (!panel) return;
      panel.style.transform = "none";
      panel.style.position  = "relative";
      panel.style.left      = "0";
      panel.style.width     = "100vw";
      panel.style.height    = "auto";
    });
    if (wrapper) wrapper.scrollTop = 0;
  }

  /* ── Scroll to a section by id ── */
  function mobileGoTo(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el || !wrapper) return;
    el.scrollIntoView({ behavior: "smooth" });
  }

  /* ── Update rhomboids (section index 0=hero,1=about,2=craft...) ── */
  function updateMobileRhomboids(sectionIndex) {
    /* rhomboid 0 = about (index 1), rhomboid 1 = craft (index 2) etc.
       hero (index 0) = no active rhomboid */
    const rhomboidIndex = sectionIndex - 1;
    mobileRhomboids.forEach((r, i) => {
      r.classList.toggle("active", i === rhomboidIndex);
    });
  }

  /* ── Show/hide centre name and rhomboid panel ── */
  function updateMobileCentreName(visible) {
    if (mobileCentreName) mobileCentreName.classList.toggle("visible", visible);
    const prog = document.getElementById("mobile-progress");
    if (prog) prog.classList.toggle("visible", visible);
  }

  /* ── Hamburger ── */
  function openMobileMenu()  {
    if (mobileMenu) mobileMenu.classList.add("open");
    if (mobileMenuBackdrop) mobileMenuBackdrop.classList.add("visible");
  }
  function closeMobileMenu() {
    if (mobileMenu) mobileMenu.classList.remove("open");
    if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove("visible");
  }

  if (mobileHamburger)    mobileHamburger.addEventListener("click", openMobileMenu);
  if (mobileMenuClose)    mobileMenuClose.addEventListener("click", closeMobileMenu);
  if (mobileMenuBackdrop) mobileMenuBackdrop.addEventListener("click", closeMobileMenu);

  /* Menu links: about, craft, works, gallery, contact */
  const menuSectionIds = [
    "section-about",
    "panel-craft",
    "panel-works",
    "panel-gallery",
    "panel-contact"
  ];
  mobileMenuLinks.forEach((link, i) => {
    link.addEventListener("click", () => {
      if (!isMobile()) return;
      closeMobileMenu();
      setTimeout(() => mobileGoTo(menuSectionIds[i]), 350);
    });
  });

  /* Rhomboid clicks: about, craft, works, gallery, contact */
  const rhomboidSectionIds = [
    "section-about",
    "panel-craft",
    "panel-works",
    "panel-gallery",
    "panel-contact"
  ];
  mobileRhomboids.forEach((r, i) => {
    r.addEventListener("click", () => {
      if (!isMobile()) return;
      mobileGoTo(rhomboidSectionIds[i]);
    });
  });

  /* Centre name and M. brand → back to hero */
  if (mobileCentreName) {
    mobileCentreName.addEventListener("click", () => {
      if (isMobile()) mobileGoTo("section-hero");
    });
  }

  const navBrand = document.querySelector(".nav-brand");
  if (navBrand) {
    navBrand.addEventListener("click", (e) => {
      if (!isMobile()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      mobileGoTo("section-hero");
    }, true);
  }

  /* Mirror language buttons in mobile menu */
  if (mobileBtnEn) mobileBtnEn.addEventListener("click", () => setLanguage("en"));
  if (mobileBtnEl) mobileBtnEl.addEventListener("click", () => setLanguage("el"));

  /* ── IntersectionObserver: track which section is visible ── */
  const observerOptions = {
    root: null, /* use viewport as root, works for both snap and non-snap */
    threshold: 0.4
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    if (!isMobile()) return; /* ignore on desktop */
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      const index = mobileSnapSections.indexOf(id);
      if (index < 0) return;
      updateMobileRhomboids(index);
      updateMobileCentreName(index > 0);
    });
  }, observerOptions);

  mobileSnapSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  /* ── Resize: restore desktop on wider screens ── */
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      panels.forEach((panel, i) => {
        if (!panel) return;
        panel.style.position  = "";
        panel.style.width     = "";
        panel.style.height    = "";
        panel.style.left      = "";
        panel.style.transform = i <= currentTabIndex
          ? "translateX(0)"
          : "translateX(100vw)";
      });
    } else {
      initMobile();
    }
  });

  /* ── Boot ── */
  initMobile();

  // ------------------------------------------------------------------------
  // 2. LANGUAGE SWITCHER (EN / ΕΛ / 中文)
  //
  // To add a new language in the future:
  // JS:   1. Add entry to LANG_TITLES: xx: "Page title"
  //       2. Add entry to LANG_BUTTONS: xx: document.getElementById("btn-lang-xx")
  //       Everything else in this block is automatic.
  // HTML: 3. Add <button id="btn-lang-xx"> in the nav switcher
  //       4. Add <span class="lang-xx"> next to every lang-en/lang-el span
  // CSS:  5. Add display rules for body.lang-xx-active in the language block
  // ------------------------------------------------------------------------

  const LANG_TITLES = {
    en: "Michaïl Chatziasemidis — Composer · Orchestrator · Violinist",
    el: "Μιχαήλ Χατζηασεμίδης — Συνθέτης · Ενορχηστρωτής · Βιολονίστας",
    cn: "米哈伊尔·Chatziasemidis — 作曲家 · 管弦乐编曲家 · 小提琴家",
  };

  const LANG_BUTTONS = {
    en: document.getElementById("btn-lang-en"),
    el: document.getElementById("btn-lang-el"),
    cn: document.getElementById("btn-lang-cn"),
  };

  function setLanguage(lang) {
    Object.keys(LANG_BUTTONS).forEach(l => {
      document.body.classList.remove(`lang-${l}-active`);
    });
    document.body.classList.add(`lang-${lang}-active`);
    document.documentElement.lang = lang;

    Object.entries(LANG_BUTTONS).forEach(([l, btn]) => {
      if (btn) btn.classList.toggle("active", l === lang);
    });

    /* Mirror active state to mobile menu buttons too */
    const mEn = document.getElementById("mobile-btn-lang-en");
    const mEl = document.getElementById("mobile-btn-lang-el");
    if (mEn) mEn.classList.toggle("active", lang === "en");
    if (mEl) mEl.classList.toggle("active", lang === "el");

    document.title = LANG_TITLES[lang] || LANG_TITLES.en;
    localStorage.setItem("preferred_lang", lang);

    const placeholders = {
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

    const p = placeholders[lang] || placeholders.en;
    Object.entries(p).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.placeholder = text;
    });
  }

  Object.entries(LANG_BUTTONS).forEach(([lang, btn]) => {
    if (btn) btn.addEventListener("click", () => setLanguage(lang));
  });

  const savedLang = localStorage.getItem("preferred_lang") || "en";
  setLanguage(savedLang);

  // ------------------------------------------------------------------------
  // 4. CONTACT FORM SUBMISSION
  // ------------------------------------------------------------------------
  const contactForm    = document.getElementById("contact-form");
  const formStatus     = document.getElementById("form-status");
  const formSubmitBtn  = document.getElementById("form-submit-btn");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const lang = document.documentElement.lang || "en";

      const i18n = {
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

      const t = i18n[lang] || i18n.en;

      formSubmitBtn.disabled = true;
      formSubmitBtn.textContent = t.sending;
      formStatus.className = "form-status";
      formStatus.style.display = "none";

      const action   = contactForm.getAttribute("action");
      const formData = new FormData(contactForm);

      try {
        if (action && !action.includes("YOUR_FORMSPREE_ID")) {
          const response = await fetch(action, {
            method: "POST",
            body: formData,
            headers: { "Accept": "application/json" }
          });
          if (!response.ok) throw new Error("Submission failed");
        } else {
          await new Promise(res => setTimeout(res, 600));
        }
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

  // Initial Progress Bar boot (0 at Hero)
  updateProgress();

}); // ← closes DOMContentLoaded