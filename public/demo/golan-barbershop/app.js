(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  root.classList.add("js");
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Open or closed now (Bucharest time): today's row, status line and the door sign
  (function hours() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".hours tr"));
    var status = document.getElementById("open-status");
    var sign = document.getElementById("door-sign");
    var signText = document.getElementById("sign-text");
    var parts;
    try {
      parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    } catch (e) { return; }
    var lookup = {};
    parts.forEach(function (p) { lookup[p.type] = p.value; });
    var dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[lookup.weekday];
    var now = parseInt(lookup.hour, 10) * 60 + parseInt(lookup.minute, 10);
    var openNow = false;
    rows.forEach(function (row) {
      var days = row.getAttribute("data-days").split(",").map(Number);
      if (days.indexOf(dayIndex) === -1) return;
      row.classList.add("today");
      var m = row.querySelector("td").textContent.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
      if (m) {
        var start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        var end = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
        openNow = now >= start && now < end;
      }
    });
    if (status) {
      status.textContent = openNow ? "Deschis acum" : "Închis acum";
      status.classList.add(openNow ? "open" : "closed");
    }
    if (sign && signText) {
      signText.textContent = openNow ? "Deschis" : "Închis";
      sign.classList.add(openNow ? "is-open" : "is-closed");
    }
  })();

  // Timed scroll-in animations, replayed when an item re-enters
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-fx]"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.intersectionRatio >= 0.15) e.target.classList.add("in");
        else if (e.intersectionRatio === 0) e.target.classList.remove("in");
      });
    }, { threshold: [0, 0.15], rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }

  // Barber pole: stripes climb slowly and speed up while you scroll
  var glass = document.getElementById("pole-glass");
  if (!glass) return;
  var PERIOD = 113.14;
  var offset = 0, vel = 0, last = 0, visible = true;
  var lastY = window.scrollY;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    if (!reduceMotion) vel = clamp(vel + (y - lastY) * 6, -900, 900);
    lastY = y;
  }, { passive: true });
  var heroEl = document.querySelector(".hero");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(heroEl);
  }
  function frame(now) {
    var dt = last ? Math.min(0.064, (now - last) / 1000) : 0.016;
    last = now;
    if (visible) {
      vel *= Math.exp(-dt / 0.5);
      if (Math.abs(vel) < 1) vel = 0;
      offset = (offset - (44 + vel) * dt) % PERIOD;
      glass.style.backgroundPosition = "0px " + offset.toFixed(2) + "px";
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
