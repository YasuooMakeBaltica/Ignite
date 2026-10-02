(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Header state on scroll
  var header = document.getElementById("site-header");
  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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

  // Reveal on scroll
  var revealEls = document.querySelectorAll(".reveal");
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

  // Active nav link
  var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  // Hero pointer parallax
  var art = document.getElementById("hero-art");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (art && finePointer && !reduceMotion) {
    var heroEl = art.closest(".hero");
    heroEl.addEventListener("mousemove", function (e) {
      var r = heroEl.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      art.style.setProperty("--mx", (x * 2).toFixed(3));
      art.style.setProperty("--my", (y * 2).toFixed(3));
    });
    heroEl.addEventListener("mouseleave", function () {
      art.style.setProperty("--mx", 0);
      art.style.setProperty("--my", 0);
    });
  }

  // Scroll-driven hero and page progress bar
  var hero = document.getElementById("top");
  var progress = document.getElementById("scroll-progress");
  var ticking = false;

  function clamp01(n) { return Math.min(1, Math.max(0, n)); }

  function updateScroll() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.setProperty("--page", max > 0 ? clamp01(window.scrollY / max).toFixed(4) : 0);
    if (!reduceMotion) {
      hero.style.setProperty("--p", clamp01(window.scrollY / (hero.offsetHeight * 0.9)).toFixed(4));
    }
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateScroll);
    }
  }

  updateScroll();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);

  // Discord link: the server redirects back here until an invite is configured
  var note = document.getElementById("discord-note");
  if (note && new URLSearchParams(window.location.search).get("discord") === "soon") {
    note.textContent = "Our Discord server is coming soon. Check back shortly!";
  }

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
