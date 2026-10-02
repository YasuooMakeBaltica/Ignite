(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  var header = document.getElementById("site-header");
  var progress = document.getElementById("scroll-progress");
  var hero = document.getElementById("top");
  var art = document.getElementById("hero-art");
  var navLinks = [];

  // Mobile menu
  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav");
  navLinks = Array.prototype.slice.call(nav.querySelectorAll("a"));
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

  // ------------------------------------------------------------------
  // Scroll engine. Everything here is driven by scroll position only:
  //   - hero scene progress (--p) while the hero scrolls away
  //   - an entrance progress (--c) for every [data-fx] item
  //   - the page progress bar and the active nav link
  // Targets are recomputed on scroll, then eased a little so motion is smooth.
  // ------------------------------------------------------------------
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-fx]")).map(function (el) {
    return { el: el, c: 0, tc: 0 };
  });
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  var heroState = { p: 0, tp: 0 };
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var running = false;

  function computeTargets() {
    var y = window.scrollY;
    var vh = window.innerHeight;

    header.classList.toggle("scrolled", y > 8);
    var max = document.documentElement.scrollHeight - vh;
    progress.style.setProperty("--page", max > 0 ? clamp01(y / max).toFixed(4) : 0);

    // Hero scene plays only while the hero scrolls away
    heroState.tp = clamp01(y / (hero.offsetHeight * 0.9));

    // Entrance progress per item, staggered across items that share a row
    var prevTop = null;
    var rowIndex = 0;
    items.forEach(function (item) {
      var top = item.el.getBoundingClientRect().top;
      if (prevTop !== null && Math.abs(top - prevTop) < 4) {
        rowIndex += 1;
      } else {
        rowIndex = 0;
      }
      prevTop = top;
      var delay = rowIndex * vh * 0.05;
      item.tc = clamp01((vh * 0.96 - top - delay) / (vh * 0.34));
    });

    // Active nav link: the section crossing the middle of the screen
    var active = null;
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top < vh * 0.5 && r.bottom > vh * 0.5) active = s.getAttribute("data-nav");
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + active);
    });
  }

  function ease(cur, target, rate) {
    return Math.abs(target - cur) < 0.0006 ? target : cur + (target - cur) * rate;
  }

  function frame() {
    var moving = false;
    var rate = reduceMotion ? 1 : 0.18;

    heroState.p = ease(heroState.p, heroState.tp, rate);
    hero.style.setProperty("--p", heroState.p.toFixed(4));
    if (heroState.p !== heroState.tp) moving = true;

    items.forEach(function (item) {
      item.c = ease(item.c, item.tc, rate);
      item.el.style.setProperty("--c", item.c.toFixed(4));
      if (item.c !== item.tc) moving = true;
    });

    if (pointer.x !== pointer.tx || pointer.y !== pointer.ty) {
      pointer.x = ease(pointer.x, pointer.tx, 0.08);
      pointer.y = ease(pointer.y, pointer.ty, 0.08);
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
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (art && finePointer && !reduceMotion) {
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
      kick();
    });
    hero.addEventListener("mouseleave", function () {
      pointer.tx = 0;
      pointer.ty = 0;
      kick();
    });
  }

  // Start from the current scroll position with no easing, so a reload mid-page looks right
  computeTargets();
  heroState.p = heroState.tp;
  hero.style.setProperty("--p", heroState.p.toFixed(4));
  items.forEach(function (item) {
    item.c = item.tc;
    item.el.style.setProperty("--c", item.c.toFixed(4));
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // Discord link: the server redirects back here until an invite is configured
  var note = document.getElementById("discord-note");
  if (note && new URLSearchParams(window.location.search).get("discord") === "soon") {
    note.textContent = "Our Discord server is coming soon. Check back shortly!";
  }

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
