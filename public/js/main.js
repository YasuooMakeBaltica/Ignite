(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pinQuery = window.matchMedia("(min-width: 901px) and (min-height: 641px)");

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  // Header state on scroll
  var header = document.getElementById("site-header");

  // Mobile menu
  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  // Reveal on scroll for the flowing layout (small screens), staggered by position in each group
  var revealEls = document.querySelectorAll(".reveal");
  revealEls.forEach(function (el) {
    var siblings = Array.prototype.filter.call(el.parentElement.children, function (n) {
      return n.classList.contains("reveal");
    });
    el.style.setProperty("--i", siblings.indexOf(el));
  });
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // ------------------------------------------------------------------
  // Scroll engine: pinned sections, hero scene and progress bar.
  // Targets are computed from the scroll position, then eased toward each frame.
  // ------------------------------------------------------------------
  var progress = document.getElementById("scroll-progress");
  var pins = Array.prototype.slice.call(document.querySelectorAll(".pin")).map(function (el) {
    var inner = el.querySelector(".pin-inner");
    return {
      el: el,
      inner: inner,
      hero: el.classList.contains("pin-hero") ? el.querySelector(".hero") : null,
      noExit: el.classList.contains("pin-contact") || el.classList.contains("pin-hero"),
      nav: el.getAttribute("data-nav"),
      q: 0, out: 0, pre: 0, tq: 0, tout: 0, tpre: 0
    };
  });
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll("a"));

  var heroPin = pins.filter(function (p) { return p.hero; })[0];
  var pinOn = false;
  var running = false;

  function setPinMode() {
    pinOn = pinQuery.matches;
    root.classList.toggle("pin-on", pinOn);
  }

  function computeTargets() {
    var y = window.scrollY;
    var headerH = header.offsetHeight;

    header.classList.toggle("scrolled", y > 8);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty("--page", max > 0 ? clamp01(y / max).toFixed(4) : 0);

    var activeNav = null;
    pins.forEach(function (p) {
      if (pinOn) {
        var top = p.el.getBoundingClientRect().top;
        var dist = p.el.offsetHeight - p.inner.offsetHeight;
        p.tq = dist > 0 ? clamp01((headerH - top) / dist) : 1;
        p.tout = p.noExit ? 0 : clamp01((p.tq - 0.8) / 0.2);
        // Approach progress: 0 while the track is below 80% of the screen, 1 once it reaches the header
        p.tpre = clamp01((window.innerHeight * 0.8 - top) / (window.innerHeight * 0.8 - headerH));
        if (p.nav && top < window.innerHeight * 0.5 && top + p.el.offsetHeight > window.innerHeight * 0.5) {
          activeNav = p.nav;
        }
      } else {
        p.tq = 1;
        p.tout = 0;
        p.tpre = 1;
        if (p === heroPin) {
          // Flowing layout: drive the hero scene from the first screen of scrolling
          p.tq = clamp01(y / (p.el.offsetHeight * 0.9));
        }
      }
    });

    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + activeNav);
    });
  }

  function apply(p) {
    p.el.style.setProperty("--q", p.q.toFixed(4));
    p.el.style.setProperty("--out", p.out.toFixed(4));
    p.el.style.setProperty("--pre", p.pre.toFixed(4));
    if (p.hero) p.hero.style.setProperty("--p", p.q.toFixed(4));
  }

  function frame() {
    var moving = false;
    pins.forEach(function (p) {
      var dq = p.tq - p.q;
      var dout = p.tout - p.out;
      var dpre = p.tpre - p.pre;
      if (reduceMotion) {
        p.q = p.tq;
        p.out = p.tout;
        p.pre = p.tpre;
      } else {
        p.q = Math.abs(dq) < 0.0006 ? p.tq : p.q + dq * 0.13;
        p.out = Math.abs(dout) < 0.0006 ? p.tout : p.out + dout * 0.13;
        p.pre = Math.abs(dpre) < 0.0006 ? p.tpre : p.pre + dpre * 0.13;
      }
      if (p.q !== p.tq || p.out !== p.tout || p.pre !== p.tpre) moving = true;
      apply(p);
    });
    if (pointer.x !== pointer.tx || pointer.y !== pointer.ty) {
      pointer.x = Math.abs(pointer.tx - pointer.x) < 0.001 ? pointer.tx : pointer.x + (pointer.tx - pointer.x) * 0.08;
      pointer.y = Math.abs(pointer.ty - pointer.y) < 0.001 ? pointer.ty : pointer.y + (pointer.ty - pointer.y) * 0.08;
      art.style.setProperty("--mx", pointer.x.toFixed(3));
      art.style.setProperty("--my", pointer.y.toFixed(3));
      moving = true;
    }
    if (moving) {
      window.requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function kick() {
    if (!running) {
      running = true;
      window.requestAnimationFrame(frame);
    }
  }

  function onScroll() {
    computeTargets();
    kick();
  }

  // Pointer parallax for the hero scene (eased, desktop only)
  var art = document.getElementById("hero-art");
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (art && finePointer && !reduceMotion && heroPin) {
    heroPin.el.addEventListener("mousemove", function (e) {
      var r = heroPin.el.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / Math.max(1, Math.min(r.height, window.innerHeight)) - 0.5) * 2;
      kick();
    });
    heroPin.el.addEventListener("mouseleave", function () {
      pointer.tx = 0;
      pointer.ty = 0;
      kick();
    });
  }

  setPinMode();
  computeTargets();
  pins.forEach(function (p) { p.q = p.tq; p.out = p.tout; p.pre = p.tpre; apply(p); });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    setPinMode();
    onScroll();
  });
  if (pinQuery.addEventListener) {
    pinQuery.addEventListener("change", function () { setPinMode(); onScroll(); });
  }

  // Discord link: the server redirects back here until an invite is configured
  var note = document.getElementById("discord-note");
  if (note && new URLSearchParams(window.location.search).get("discord") === "soon") {
    note.textContent = "Our Discord server is coming soon. Check back shortly!";
  }

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
