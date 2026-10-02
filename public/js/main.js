(function () {
  var root = document.documentElement;
  root.classList.add("js", "loading");

  // Reduced motion softens the animations rather than removing them. Adding
  // ?motion=full to the URL ignores the system setting, which helps with testing.
  var forceFull = /[?&]motion=full(&|$)/.test(window.location.search);
  var reduceMotion = !forceFull && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (forceFull) root.classList.add("motion-full");

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var header = document.getElementById("site-header");
  var progress = document.getElementById("scroll-progress");
  var hero = document.getElementById("top");
  var art = document.getElementById("hero-art");

  // ------------------------------------------------------------------
  // Mobile menu
  // ------------------------------------------------------------------
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
  // Scroll only triggers animations. It never drives them.
  //
  // Each [data-fx] item plays a fixed-length CSS animation when it enters the
  // screen (the .in class) and is reset once it is fully off screen, so it
  // replays on re-entry. Timing does not depend on how fast you scroll.
  // ------------------------------------------------------------------
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-fx]"));

  // Stagger items that sit in the same row (left to right)
  function staggerRows() {
    var prevTop = null;
    var index = 0;
    items.forEach(function (el) {
      var top = el.offsetTop + (el.offsetParent ? el.offsetParent.offsetTop : 0);
      index = prevTop !== null && Math.abs(top - prevTop) < 4 ? index + 1 : 0;
      prevTop = top;
      el.style.setProperty("--i", index);
    });
  }

  if ("IntersectionObserver" in window) {
    var fxObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.intersectionRatio >= 0.12) {
          entry.target.classList.add("in");
        } else if (entry.intersectionRatio === 0) {
          entry.target.classList.remove("in");
        }
      });
    }, { threshold: [0, 0.12], rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { fxObserver.observe(el); });

    // Active nav link: the section crossing the middle of the screen
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var name = entry.target.getAttribute("data-nav");
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + name);
        });
      });
    }, { rootMargin: "-50% 0px -50% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (s) {
      navObserver.observe(s);
    });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Header border and page progress bar (cheap, no layout reads while scrolling)
  var maxScroll = 1;
  var scrollQueued = false;
  function updateScrollUi() {
    scrollQueued = false;
    var y = window.scrollY;
    header.classList.toggle("scrolled", y > 8);
    progress.style.transform = "scaleX(" + clamp01(y / maxScroll).toFixed(4) + ")";
  }
  function onScroll() {
    if (!scrollQueued) {
      scrollQueued = true;
      window.requestAnimationFrame(updateScrollUi);
    }
  }
  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    staggerRows();
    updateScrollUi();
  }

  // ------------------------------------------------------------------
  // Hero 3D scene
  //
  // A timed intro orbit plays on load (planets whirl in and settle, the camera
  // swings round), then the scene idles with a slow spin. Motion is written
  // straight to element transforms, so the browser never restyles the subtree.
  // Spheres counter-rotate the chain of parent rotations to face the camera.
  // ------------------------------------------------------------------
  var INTRO_MS = reduceMotion ? 1400 : 2600;
  var INTRO_SCALE = reduceMotion ? 0.3 : 1; // how far the intro swings and whirls

  var scene = art.querySelector(".scene");
  var glow = art.querySelector(".glow");
  var core = art.querySelector(".core");
  var cube = art.querySelector(".cube");
  var cubeFaces = Array.prototype.slice.call(cube.children);
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

  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var startTime = null;
  var introArmed = false; // the intro starts once the loading skeleton is gone
  var heroVisible = true;
  var running = false;
  var lastTime = 0;

  function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

  function renderHero(now, intro) {
    var e = easeOutQuart(intro);
    var rest = 1 - e;
    // The idle spin always runs, even with reduced motion on: the planets orbit
    // and the cube turns forever, and the camera sways slowly so the scene
    // never looks frozen.
    var idle = ((now / 40000) * 360) % 360;
    var swayY = Math.sin(now / 3800) * 14;
    var swayX = Math.sin(now / 5200) * 5;
    var rx = lerp(16 + 36 * INTRO_SCALE, 16, e) - pointer.y * 7 + swayX * e;
    var ry = lerp(-24 - 186 * INTRO_SCALE, -24, e) + pointer.x * 9 + swayY * e;
    var fade = clamp01(intro * 2.2);

    scene.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) scale(" + lerp(lerp(1, 0.5, INTRO_SCALE), 1, e).toFixed(3) + ")";
    glow.style.opacity = (fade * 0.9).toFixed(3);

    core.style.transform = "rotateY(" + (-ry).toFixed(2) + "deg) rotateX(" + (-rx).toFixed(2) + "deg)";
    core.style.opacity = fade.toFixed(3);

    orbits.forEach(function (o) {
      // Planets whirl in on the intro, then orbit steadily
      var ang = idle * o.sp + rest * o.turns * 540 * INTRO_SCALE;
      o.arm.style.transform = "rotateZ(" + ang.toFixed(2) + "deg)";
      o.body.style.transform =
        "translateX(" + (o.d / 2) + "cqw) rotateZ(" + (-ang).toFixed(2) + "deg) rotateY(" + (-o.oy) + "deg) rotateX(" + (-o.ox) + "deg) rotateY(" + (-ry).toFixed(2) + "deg) rotateX(" + (-rx).toFixed(2) + "deg)";
      o.body.style.opacity = fade.toFixed(3);
      o.ring.style.opacity = fade.toFixed(3);
    });

    cube.style.transform =
      "translate3d(-34cqw, -30cqw, 18cqw) rotateX(" + (idle * 1.3 + rest * 420 * INTRO_SCALE).toFixed(2) + "deg) rotateY(" + (idle * 1.8 + rest * 600 * INTRO_SCALE).toFixed(2) + "deg)";
    var faceOpacity = (fade * 0.9).toFixed(3);
    cubeFaces.forEach(function (f) { f.style.opacity = faceOpacity; });
  }

  function ease(cur, target, k) {
    return Math.abs(target - cur) < 0.0006 ? target : cur + (target - cur) * k;
  }

  function frame(now) {
    if (introArmed && startTime === null) startTime = now;
    var dt = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;

    var intro = startTime === null ? 0 : clamp01((now - startTime) / INTRO_MS);
    var kPointer = 1 - Math.exp(-dt / 160);
    var moving = introArmed ? intro < 1 : false;

    if (pointer.x !== pointer.tx || pointer.y !== pointer.ty) {
      pointer.x = ease(pointer.x, pointer.tx, kPointer);
      pointer.y = ease(pointer.y, pointer.ty, kPointer);
      moving = true;
    }

    // Only render while the hero is on screen; keep looping for the endless spin
    if (heroVisible) renderHero(now, intro);

    if (moving || heroVisible) {
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

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  measure();
  renderHero(performance.now(), 0);
  kick();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure);
  }


  // ------------------------------------------------------------------
  // Loading skeleton
  //
  // The skeleton in index.html covers the page until the fonts and the page
  // itself are ready, then fades out, and only then do the hero intro and the
  // entrance animations start. Fonts are attached from here instead of a
  // blocking <link>, so a slow font request can never delay the first paint.
  // ------------------------------------------------------------------
  var skeleton = document.getElementById("skeleton");
  var loadingDone = false;

  function finishLoading() {
    if (loadingDone) return;
    loadingDone = true;
    // Two frames so the first real paint is on screen before the skeleton fades
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        root.classList.remove("loading");
        introArmed = true;
        kick();
        if (skeleton) {
          skeleton.classList.add("hide");
          window.setTimeout(function () { skeleton.remove(); }, 700);
        }
      });
    });
  }

  function whenFontsReady(done) {
    var fontsUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontsUrl;
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      // The stylesheet is in; wait for the font files it asked for (or give up)
      var fontsPromise = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      fontsPromise.then(done, done);
    }
    link.onload = settle;
    link.onerror = settle;
    document.head.appendChild(link);
    window.setTimeout(settle, 3500); // slow or blocked fonts never hold the page up
  }

  var pageLoaded = document.readyState === "complete";
  var fontsDone = false;
  function checkReady() {
    if (pageLoaded && fontsDone) finishLoading();
  }
  whenFontsReady(function () { fontsDone = true; checkReady(); });
  if (!pageLoaded) {
    window.addEventListener("load", function () { pageLoaded = true; checkReady(); });
  }
  window.setTimeout(finishLoading, 6000); // hard limit

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
