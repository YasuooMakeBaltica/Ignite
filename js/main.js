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
    var hero = art.closest(".hero");
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      art.style.setProperty("--mx", (x * 2).toFixed(3));
      art.style.setProperty("--my", (y * 2).toFixed(3));
    });
    hero.addEventListener("mouseleave", function () {
      art.style.setProperty("--mx", 0);
      art.style.setProperty("--my", 0);
    });
  }

  // Contact form (demo only, nothing is sent yet)
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, message) {
    var field = input.closest(".field");
    field.classList.toggle("invalid", Boolean(message));
    field.querySelector(".error").textContent = message || "";
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function validate(input) {
    var value = input.value.trim();
    if (!value) { setError(input, "This field is required."); return false; }
    if (input.type === "email" && !emailPattern.test(value)) {
      setError(input, "Please enter a valid email address.");
      return false;
    }
    setError(input, "");
    return true;
  }

  var inputs = Array.prototype.slice.call(form.querySelectorAll("input, textarea"));
  inputs.forEach(function (input) {
    input.addEventListener("blur", function () { validate(input); });
    input.addEventListener("input", function () {
      if (input.closest(".field").classList.contains("invalid")) validate(input);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var results = inputs.map(validate);
    var firstBad = inputs[results.indexOf(false)];
    if (firstBad) {
      firstBad.focus();
      status.textContent = "";
      return;
    }
    // TODO: connect to a form backend before launch.
    status.textContent = "Thanks! This is a demo form, so nothing was sent yet.";
    form.reset();
  });

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
