(function () {
  var skip = document.getElementById("skip");
  var share = document.getElementById("share");
  var note = document.getElementById("note");
  var code = skip.getAttribute("data-code");
  // Go to the link through the server so the visit is not counted twice
  var next = "/" + encodeURIComponent(code) + "?go=1";
  function go() { window.location.href = next; }
  skip.addEventListener("click", function (e) { e.preventDefault(); go(); });
  share.addEventListener("click", function () {
    if (!navigator.geolocation) { note.textContent = "Location is not available here. Continuing."; setTimeout(go, 900); return; }
    note.textContent = "Waiting for your browser...";
    navigator.geolocation.getCurrentPosition(function (pos) {
      fetch("/api/geo/" + encodeURIComponent(code), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      }).then(go, go);
    }, function () {
      note.textContent = "No problem, nothing was shared. Continuing.";
      setTimeout(go, 900);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
})();
