(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  var header = document.getElementById("site-header");
  var progress = document.getElementById("scroll-progress");
  var hero = document.getElementById("top");
  var art = document.getElementById("hero-art");

  // Mobile menu
  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("nav");
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll("a"));
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
  // Scroll engine
  //
  // Performance rules this file follows:
  //   1. Layout is measured only on load and resize, never during scrolling.
  //   2. Per frame we only write transform and opacity, which the browser can
  //      composite without repainting or relayout.
  //   3. Hero scene motion is written straight to element styles, not through
  //      CSS variables, so the browser never restyles a whole subtree.
  //   4. Easing is time based, so it feels the same at 60 and 120 Hz.
  // ------------------------------------------------------------------
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-fx]")).map(function (el) {
    return { el: el, top: 0, c: 0, tc: 0, delay: 0, last: -1 };
  });
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-nav]")).map(function (el) {
    return { el: el, name: el.getAttribute("data-nav"), top: 0, bottom: 0 };
  });

  var layout = { vh: window.innerHeight, heroH: 1, maxScroll: 1 };
  var heroState = { p: 0, tp: 0 };
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var heroVisible = true;
  var running = false;
  var lastTime = 0;
  var activeNav = null;

  // Absolute top of an element ignoring transforms (offsetTop does not include them)
  function absTop(el) {
    var y = 0;
    while (el) {
      y += el.offsetTop;
      el = el.offsetParent;
    }
    return y;
  }

  function measure() {
    layout.vh = window.innerHeight;
    layout.heroH = hero.offsetHeight;
    layout.maxScroll = Math.max(1, document.documentElement.scrollHeight - layout.vh);
    var prevTop = null;
    var rowIndex = 0;
    items.forEach(function (item) {
      item.top = absTop(item.el);
      rowIndex = prevTop !== null && Math.abs(item.top - prevTop) < 4 ? rowIndex + 1 : 0;
      prevTop = item.top;
      item.delay = rowIndex * layout.vh * 0.05;
    });
    sections.forEach(function (s) {
      s.top = absTop(s.el);
      s.bottom = s.top + s.el.offsetHeight;
    });
  }

  function computeTargets() {
    var y = window.scrollY;
    var vh = layout.vh;

    header.classList.toggle("scrolled", y > 8);
    progress.style.transform = "scaleX(" + clamp01(y / layout.maxScroll).toFixed(4) + ")";

    // Hero scene plays only while the hero scrolls away
    heroState.tp = clamp01(y / (layout.heroH * 0.9));

    // Entrance progress per item, from its own distance below the fold
    items.forEach(function (item) {
      var top = item.top - y;
      item.tc = clamp01((vh * 0.96 - top - item.delay) / (vh * 0.34));
    });

    // Active nav link: the section crossing the middle of the screen
    var mid = y + vh * 0.5;
    var active = null;
    sections.forEach(function (s) {
      if (mid > s.top && mid < s.bottom) active = s.name;
    });
    if (active !== activeNav) {
      activeNav = active;
      navLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + active);
      });
    }
  }

  // ------------------------------------------------------------------
  // Hero 3D scene: direct style writes
  // ------------------------------------------------------------------
  var scene = art.querySelector(".scene");
  var glow = art.querySelector(".glow");
  var core = art.querySelector(".core");
  var cube = art.querySelector(".cube");
  var cubeFaces = Array.prototype.slice.call(cube.children);
  var copy = hero.querySelector(".hero-copy");
  var copyKids = Array.prototype.slice.call(copy.children);
  var copyShift = [-20, -45, -70, -95, -120, -145];

  var orbits = Array.prototype.slice.call(art.querySelectorAll(".orbit")).map(function (el) {
    return {
      ring: el.querySelector(".ring"),
      arm: el.querySelector(".arm"),
      body: el.querySelector(".body"),
      ox: parseFloat(el.getAttribute("data-ox")),
      oy: parseFloat(el.getAttribute("data-oy")),
      d: parseFloat(el.getAttribute("data-d")),
      sp: parseFloat(el.getAttribute("data-sp")),
      turns: parseFloat(el.getAttribute("data-turns"))
    };
  });

  function renderHero(now) {
    var p = heroState.p;
    var idle = reduceMotion ? 0 : ((now / 60000) * 360) % 360;
    var rx = 16 + p * 34 - pointer.y * 7;
    var ry = -24 + p * 210 + pointer.x * 9;
    var fade = 1 - clamp01((p - 0.82) * 5.5);

    scene.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) scale(" + (1 + p * 0.14).toFixed(3) + ")";
    glow.style.opacity = (fade * (0.6 + p * 0.6)).toFixed(3);

    core.style.transform = "rotateY(" + (-ry).toFixed(2) + "deg) rotateX(" + (-rx).toFixed(2) + "deg)";
    core.style.opacity = fade.toFixed(3);

    orbits.forEach(function (o) {
      var ang = idle * o.sp + p * o.turns * 360;
      o.arm.style.transform = "rotateZ(" + ang.toFixed(2) + "deg)";
      // Counter-rotate the whole chain so the sphere always faces the camera
      o.body.style.transform =
        "translateX(" + (o.d / 2) + "cqw) rotateZ(" + (-ang).toFixed(2) + "deg) rotateY(" + (-o.oy) + "deg) rotateX(" + (-o.ox) + "deg) rotateY(" + (-ry).toFixed(2) + "deg) rotateX(" + (-rx).toFixed(2) + "deg)";
      o.body.style.opacity = fade.toFixed(3);
      o.ring.style.opacity = fade.toFixed(3);
    });

    cube.style.transform =
      "translate3d(-34cqw, -30cqw, 18cqw) rotateX(" + (idle * 1.3 + p * 300).toFixed(2) + "deg) rotateY(" + (idle * 1.8 + p * 420).toFixed(2) + "deg)";
    var faceOpacity = (fade * 0.9).toFixed(3);
    cubeFaces.forEach(function (f) { f.style.opacity = faceOpacity; });

    // Text drifts up and fades as the scene takes over
    copy.style.opacity = (1 - clamp01((p - 0.1) * 1.5)).toFixed(3);
    copyKids.forEach(function (k, i) {
      k.style.translate = "0 " + (p * copyShift[i]).toFixed(1) + "px";
    });
  }

  // ------------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------------
  function ease(cur, target, k) {
    return Math.abs(target - cur) < 0.0006 ? target : cur + (target - cur) * k;
  }

  function frame(now) {
    var dt = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;
    var k = reduceMotion ? 1 : 1 - Math.exp(-dt / 70);
    var kPointer = 1 - Math.exp(-dt / 160);
    var moving = false;

    heroState.p = ease(heroState.p, heroState.tp, k);
    if (heroState.p !== heroState.tp) moving = true;

    if (pointer.x !== pointer.tx || pointer.y !== pointer.ty) {
      pointer.x = ease(pointer.x, pointer.tx, kPointer);
      pointer.y = ease(pointer.y, pointer.ty, kPointer);
      moving = true;
    }

    // The hero scene is only rendered while it is on screen
    if (heroVisible) renderHero(now);

    items.forEach(function (item) {
      item.c = ease(item.c, item.tc, k);
      if (item.c !== item.last) {
        item.el.style.setProperty("--c", item.c.toFixed(4));
        item.last = item.c;
      }
      if (item.c !== item.tc) moving = true;
    });

    // Keep looping while the hero is visible so the idle spin keeps going
    if (moving || (heroVisible && !reduceMotion)) {
      window.requestAnimationFrame(frame);
    } else {
      running = false;
      lastTime = 0;
    }
  }

  function kick() {
    if (!running) {
      running = true;
      window.requestAnimationFrame(frame);
    }
  }

  var scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(function () {
      scrollQueued = false;
      computeTargets();
      kick();
    });
  }

  function remeasure() {
    measure();
    computeTargets();
    kick();
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) kick();
    }).observe(hero);
  }

  // Pointer parallax for the hero scene (eased, desktop only)
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
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
  measure();
  computeTargets();
  heroState.p = heroState.tp;
  items.forEach(function (item) {
    item.c = item.tc;
    item.el.style.setProperty("--c", item.c.toFixed(4));
    item.last = item.c;
  });
  renderHero(performance.now());
  kick();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  if ("ResizeObserver" in window) {
    new ResizeObserver(remeasure).observe(document.body);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
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
