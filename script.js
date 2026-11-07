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
  // TOUCH SWIPE NAVIGATION (MOBILE)
  // ------------------------------------------------------------------------
  let touchStartY = 0;
  let touchStartX = 0;

  window.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    const deltaY = touchStartY - e.changedTouches[0].clientY;
    const deltaX = touchStartX - e.changedTouches[0].clientX;

  // Ignore horizontal swipes (e.g. accidentally grazing the screen)
  if (Math.abs(deltaX) > Math.abs(deltaY)) return;

  // Ignore tiny movements — must swipe at least 40px to count
  if (Math.abs(deltaY) < 40) return;

  if (deltaY > 0) {
    // Swiped UP (finger moved up = user wants to go forward/down)
    if (currentTabIndex === 0) {
      if (introStep === 0) {
        handleGoNext();
      } else {
        const atBottom = panelIntroContent.scrollTop + panelIntroContent.clientHeight
                         >= panelIntroContent.scrollHeight - 40;
        if (atBottom) handleGoNext();
      }
    } else {
      const content = panels[currentTabIndex].querySelector(".leaf-content");
      const atBottom = content.scrollTop + content.clientHeight >= content.scrollHeight - 40;
      if (atBottom) handleGoNext();
    }
  } else {
    // Swiped DOWN (finger moved down = user wants to go back/up)
    if (currentTabIndex === 0) {
      if (panelIntroContent.scrollTop <= 80) handleGoPrev();
    } else {
      const content = panels[currentTabIndex].querySelector(".leaf-content");
      const atTop = content.scrollTop <= 40;
      if (atTop) handleGoPrev();
    }
    }
  }, { passive: true });



  // ------------------------------------------------------------------------
  // 2. BILINGUAL LANGUAGE SWITCHER (EN / ΕΛ)
  // ------------------------------------------------------------------------
  const btnEn = document.getElementById("btn-lang-en");
  const btnEl = document.getElementById("btn-lang-el");
  //const btnCn = document.getElementById("btn-lang-cn");

  function setLanguage(lang) {
    const isGreek = lang === "el";
    const isEnglish = lang === "en";
    //const isChinese = lang === "cn";

    // 1. Σωστό toggle για το CSS του body (χρειαζόμαστε κλάση για κάθε γλώσσα)
    document.body.classList.toggle("lang-en-active", isEnglish);
    document.body.classList.toggle("lang-el-active", isGreek);
   // document.body.classList.toggle("lang-cn-active", isChinese);
    
    document.documentElement.lang = lang;

    // 2. Σωστό toggle για τα κουμπιά (μόνο 2 ορίσματα επιτρέπονται)
    if (btnEn) btnEn.classList.toggle("active", isEnglish);
    if (btnEl) btnEl.classList.toggle("active", isGreek);
    //if (btnCn) btnCn.classList.toggle("active", isChinese);

    // 3. Σωστός τίτλος για 3 γλώσσες (φωλιασμένος τριαδικός τελεστής)
    document.title = isGreek
      ? "Μιχαήλ Χατζηασεμίδης — Συνθέτης · Ενορχηστρωτής · Βιολονίστας"
      : isChinese
      ? "米哈伊尔·哈齐亚塞米迪斯 — 作曲家 · 管弦乐编曲家 · 小提琴家"
      : "Michaïl Chatziasemidis — Composer · Orchestrator · Violinist";


    localStorage.setItem("preferred_lang", lang);
  }

  if (btnEn) btnEn.addEventListener("click", () => setLanguage("en"));
  if (btnEl) btnEl.addEventListener("click", () => setLanguage("el"));
  //if (btnCn) btnCn.addEventListener("click", () => setLanguage("cn"));

  const savedLang = localStorage.getItem("preferred_lang") || "en";
  setLanguage(savedLang);

  // ------------------------------------------------------------------------
  // 3. PORTRAIT IMAGE DETECTOR
  // ------------------------------------------------------------------------
  const portraitBox = document.getElementById("portrait-box");
  if (portraitBox) {
    const portraitImg = new Image();
    portraitImg.src = "assets/portrait.jpg";
    portraitImg.onload = () => {
      portraitBox.innerHTML = `<img src="assets/portrait.jpg" alt="Michaïl Chatziasemidis" loading="lazy">`;
    };
  }


  // ------------------------------------------------------------------------
  // 4. CONTACT FORM SUBMISSION
  // ------------------------------------------------------------------------
  const contactForm = document.getElementById("contact-form");
  const formStatus = document.getElementById("form-status");
  const formSubmitBtn = document.getElementById("form-submit-btn");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const isGreek = document.body.classList.contains("lang-el-active");

      formSubmitBtn.disabled = true;
      formSubmitBtn.textContent = isGreek ? "ΑΠΟΣΤΟΛΗ..." : "Sending...";
      formStatus.className = "form-status";
      formStatus.style.display = "none";

      const action = contactForm.getAttribute("action");
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

        formStatus.textContent = isGreek 
          ? "Ευχαριστώ! Το μήνυμά σας εστάλη επιτυχώς." 
          : "Thank you! Your message has been sent.";
        formStatus.classList.add("success");
        contactForm.reset();
      } catch (err) {
        formStatus.textContent = isGreek
          ? "Παρουσιάστηκε σφάλμα. Παρακαλώ δοκιμάστε ξανά ή στείλτε απευθείας email."
          : "Oops! There was a problem. Please try again or email directly.";
        formStatus.classList.add("error");
      } finally {
        formSubmitBtn.disabled = false;
        formSubmitBtn.textContent = isGreek ? "ΑΠΟΣΤΟΛΗ ΜΗΝΥΜΑΤΟΣ" : "Send Message";
      }
    });
  }

  // Initial Progress Bar boot (0 at Hero)
  updateProgress();
});
