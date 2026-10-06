(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  root.classList.add("js");

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // ------------------------------------------------------------------
  // Footer year, open/closed status in Bucharest time, today's row
  // ------------------------------------------------------------------
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  (function hours() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".hours tr"));
    var status = document.getElementById("open-status");
    var parts;
    try {
      parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Bucharest", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(new Date());
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
  })();

  // ------------------------------------------------------------------
  // Scroll-in animations: timed, replay when the item re-enters
  // ------------------------------------------------------------------
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-fx]"));
  var prevTop = null, rowIndex = 0;
  items.forEach(function (el) {
    var top = el.offsetTop;
    rowIndex = prevTop !== null && Math.abs(top - prevTop) < 4 ? rowIndex + 1 : 0;
    prevTop = top;
    el.style.setProperty("--i", rowIndex);
  });
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

  // ------------------------------------------------------------------
  // The 3D wheel: it idles slowly, speeds up and blurs as you scroll
  // ------------------------------------------------------------------
  var scene = document.getElementById("wheel-scene");
  var spinBack = document.getElementById("spin-back");
  var spinFront = document.getElementById("spin-front");
  var faceFront = document.getElementById("face-front");
  if (!scene || !spinBack || !spinFront) return;

  var angle = 0;
  var vel = 0;            // extra degrees per second from scrolling
  var lastY = window.scrollY;
  var last = 0;
  var wheelVisible = true;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    var dy = y - lastY;
    lastY = y;
    if (!reduceMotion) vel = clamp(vel + dy * 14, -2600, 2600);
  }, { passive: true });

  var heroEl = document.querySelector(".hero");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
    heroEl.addEventListener("mousemove", function (e) {
      var r = heroEl.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    heroEl.addEventListener("mouseleave", function () { pointer.tx = 0; pointer.ty = 0; });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      wheelVisible = entries[0].isIntersecting;
    }).observe(heroEl);
  }

  function frame(now) {
    var dt = last ? Math.min(0.064, (now - last) / 1000) : 0.016;
    last = now;

    if (wheelVisible) {
      vel *= Math.exp(-dt / 0.55);
      if (Math.abs(vel) < 1) vel = 0;
      angle = (angle + (24 + vel) * dt) % 360;

      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt / 0.16));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt / 0.16));

      var a = angle.toFixed(2);
      spinBack.style.transform = "rotateZ(" + a + "deg)";
      spinFront.style.transform = "translateZ(20px) rotateZ(" + a + "deg)";
      scene.style.transform = "rotateX(" + (9 - pointer.y * 5).toFixed(2) + "deg) rotateY(" + (-32 + pointer.x * 8).toFixed(2) + "deg)";

      // Motion blur: the faster it spins, the more the spokes smear
      var blur = clamp(Math.abs(vel) / 1500, 0, 1);
      faceFront.style.filter = blur > 0.04 ? "blur(" + (blur * 5).toFixed(2) + "px)" : "none";
      faceFront.style.opacity = (1 - blur * 0.45).toFixed(2);
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
