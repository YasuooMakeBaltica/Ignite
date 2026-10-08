(function () {
  document.documentElement.classList.add("js");

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Open or closed now (Bucharest time) and today's bar in the week strip
  (function hours() {
    var status = document.getElementById("open-status");
    var parts;
    try {
      parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    } catch (e) { return; }
    var lookup = {};
    parts.forEach(function (p) { lookup[p.type] = p.value; });
    var day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[lookup.weekday];
    var now = parseInt(lookup.hour, 10) * 60 + parseInt(lookup.minute, 10);
    var openNow = false;
    Array.prototype.forEach.call(document.querySelectorAll("#week li"), function (li) {
      if (parseInt(li.getAttribute("data-day"), 10) !== day) return;
      li.classList.add("today");
      var m = li.querySelector(".t").textContent.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
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

  // Service picker: the ticket follows the selected card
  (function picker() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
    var tName = document.getElementById("t-name");
    var tTime = document.getElementById("t-time");
    var tPrice = document.getElementById("t-price");
    var ticket = document.querySelector(".ticket");
    function select(card) {
      cards.forEach(function (c) {
        var on = c === card;
        c.classList.toggle("on", on);
        c.setAttribute("aria-checked", on ? "true" : "false");
      });
      tName.textContent = card.getAttribute("data-name");
      tTime.textContent = card.getAttribute("data-time");
      tPrice.textContent = card.getAttribute("data-price") + " lei";
      ticket.classList.remove("flip");
      void ticket.offsetWidth;
      ticket.classList.add("flip");
    }
    cards.forEach(function (c) { c.addEventListener("click", function () { select(c); }); });
    var start = document.querySelector('.card[aria-checked="true"]') || cards[0];
    if (start) {
      cards.forEach(function (c) { c.classList.toggle("on", c === start); });
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
})();
