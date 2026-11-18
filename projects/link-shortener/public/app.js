(function () {
  var form = document.getElementById("form");
  var urlInput = document.getElementById("url");
  var aliasInput = document.getElementById("alias");
  var msg = document.getElementById("msg");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");

  function say(text, ok) { msg.textContent = text; msg.className = ok ? "ok" : ""; }

  function bar(n, max) {
    var i = document.createElement("i");
    var pct = max ? Math.max(10, Math.round((n / max) * 10) * 10) : 10;
    i.className = "h" + pct;
    i.title = n + (n === 1 ? " click" : " clicks");
    return i;
  }

  function row(l) {
    var li = document.createElement("li");
    var left = document.createElement("div");
    var a = document.createElement("a");
    a.className = "short"; a.href = l.short; a.target = "_blank"; a.rel = "noopener"; a.textContent = l.short.replace(/^https?:\/\//, "");
    var orig = document.createElement("div");
    orig.className = "orig"; orig.textContent = l.url; orig.title = l.url;
    left.appendChild(a); left.appendChild(orig);

    var stats = document.createElement("div");
    stats.className = "stats";
    var c = document.createElement("div");
    c.className = "clicks"; c.textContent = l.clicks;
    var small = document.createElement("small");
    small.textContent = l.clicks === 1 ? "click" : "clicks";
    c.appendChild(small);
    var spark = document.createElement("div");
    spark.className = "spark";
    var max = Math.max.apply(null, l.days);
    l.days.forEach(function (n) { spark.appendChild(bar(n, max)); });
    stats.appendChild(c); stats.appendChild(spark);

    var actions = document.createElement("div");
    actions.className = "actions";
    var copy = document.createElement("button");
    copy.type = "button"; copy.textContent = "Copy";
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(l.short).then(done); else done();
    });
    var del = document.createElement("button");
    del.type = "button"; del.className = "del"; del.textContent = "Delete";
    del.addEventListener("click", function () {
      fetch("/api/links/" + encodeURIComponent(l.code), { method: "DELETE" }).then(load);
    });
    actions.appendChild(copy); actions.appendChild(del);

    li.appendChild(left); li.appendChild(stats); li.appendChild(actions);
    return li;
  }

  function load() {
    fetch("/api/links").then(function (r) { return r.json(); }).then(function (links) {
      list.textContent = "";
      links.forEach(function (l) { list.appendChild(row(l)); });
      empty.hidden = links.length > 0;
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    say("");
    fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value, alias: aliasInput.value })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) return say(res.d.error || "Something went wrong.");
        say("Created: " + res.d.short, true);
        urlInput.value = ""; aliasInput.value = "";
        load();
      }).catch(function () { say("Could not reach the server."); });
  });

  load();
  setInterval(load, 15000);
})();
