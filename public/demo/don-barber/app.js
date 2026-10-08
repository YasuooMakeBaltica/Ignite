(function () {
  document.documentElement.classList.add("js");

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Open or closed now (Bucharest time)
  (function hours() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".hours tr"));
    var status = document.getElementById("open-status");
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
  })();

  // Fade picker: the line in the ladder moves to where the chosen fade starts
  (function fade() {
    var steps = Array.prototype.slice.call(document.querySelectorAll("#ladder li"));
    var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var note = document.getElementById("fade-note");
    var text = {
      2: "Skin fade: de la piele, tranziție lină. Tuns skin fade, 60 lei.",
      4: "Low fade: începe jos, aproape de ureche. Mai mult păr sus.",
      6: "Mid fade: tranziția pornește la mijlocul capului.",
      8: "High fade: contrast puternic, tranziția începe sus."
    };
    function set(level) {
      steps.forEach(function (li, i) { li.classList.toggle("line", i + 1 === level); li.classList.toggle("short", i + 1 <= level); });
      chips.forEach(function (c) {
        var on = parseInt(c.getAttribute("data-level"), 10) === level;
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (note) note.textContent = text[level];
    }
    chips.forEach(function (c) {
      c.addEventListener("click", function () { set(parseInt(c.getAttribute("data-level"), 10)); });
    });
    set(2);
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
})();
