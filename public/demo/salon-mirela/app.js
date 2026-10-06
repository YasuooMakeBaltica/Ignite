(function () {
  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Highlight today's row and show whether the salon is open, using Bucharest time
  var rows = Array.prototype.slice.call(document.querySelectorAll(".hours tr"));
  var status = document.getElementById("open-status");
  var parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bucharest", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date());
  } catch (e) {
    return; // very old browser: the table still reads fine without the highlight
  }
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
