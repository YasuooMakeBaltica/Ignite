(function () {
  var form = document.getElementById("form");
  var urlInput = document.getElementById("url");
  var aliasInput = document.getElementById("alias");
  var msg = document.getElementById("msg");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var loginView = document.getElementById("login");
  var appView = document.getElementById("app");
  var loginForm = document.getElementById("login-form");
  var loginMsg = document.getElementById("login-msg");
  var pollTimer = null;

  function show(loggedIn) {
    loginView.hidden = loggedIn;
    appView.hidden = !loggedIn;
    if (loggedIn) { load(); clearInterval(pollTimer); pollTimer = setInterval(load, 15000); }
    else clearInterval(pollTimer);
  }
  function api(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && url !== "/api/login") { show(false); throw new Error("auth"); }
      return r;
    });
  }

  function statBlock(title, items) {
    var box = document.createElement("div");
    var h = document.createElement("h3");
    h.textContent = title;
    box.appendChild(h);
    if (!items.length) { var none = document.createElement("div"); none.textContent = "none yet"; box.appendChild(none); }
    items.forEach(function (it) {
      var r = document.createElement("div"); r.className = "row";
      var a1 = document.createElement("span"); a1.textContent = it.name;
      var a2 = document.createElement("span"); a2.textContent = it.n;
      r.appendChild(a1); r.appendChild(a2); box.appendChild(r);
    });
    return box;
  }

  function toggleStats(li, code, btn) {
    var existing = li.querySelector(".panel");
    if (existing) { existing.remove(); btn.textContent = "Stats"; return; }
    api("/api/links/" + encodeURIComponent(code) + "/stats").then(function (r) { return r.json(); }).then(function (s) {
      var p = document.createElement("div");
      p.className = "panel";
      p.appendChild(statBlock("Websites", s.referrers));
      p.appendChild(statBlock("Browsers", s.browsers));
      p.appendChild(statBlock("Systems", s.systems));
      p.appendChild(statBlock("Devices", s.devices));
      p.appendChild(statBlock("Networks (last part hidden)", s.networks));
      p.appendChild(statBlock("Countries", s.countries));
      p.appendChild(statBlock("Cities", s.cities));
      if (s.ask) p.appendChild(statBlock("Shared location (about 10 km)", s.areas));
      var w = document.createElement("div");
      w.className = "wide";
      w.textContent = s.unique + " unique visitors (a new anonymous code each day), " + s.bots + " link previews and bots not counted" + (s.ask ? ". " + s.shared + " of " + s.asked + " visitors agreed to share their location." : "");
      p.appendChild(w);
      li.appendChild(p);
      btn.textContent = "Hide";
    }).catch(function () {});
  }

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
    var tag = null;
    if (l.ask) { tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "asks location"; }
    var orig = document.createElement("div");
    orig.className = "orig"; orig.textContent = l.url; orig.title = l.url;
    left.appendChild(a); if (tag) left.appendChild(tag); left.appendChild(orig);

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
      api("/api/links/" + encodeURIComponent(l.code), { method: "DELETE" }).then(load).catch(function () {});
    });
    var stat = document.createElement("button");
    stat.type = "button"; stat.className = "stat"; stat.textContent = "Stats";
    stat.addEventListener("click", function () { toggleStats(li, l.code, stat); });
    actions.appendChild(stat); actions.appendChild(copy); actions.appendChild(del);

    li.appendChild(left); li.appendChild(stats); li.appendChild(actions);
    return li;
  }

  function load() {
    api("/api/links").then(function (r) { return r.json(); }).then(function (links) {
      list.textContent = "";
      links.forEach(function (l) { list.appendChild(row(l)); });
      empty.hidden = links.length > 0;
    }).catch(function () {});
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    say("");
    api("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value, alias: aliasInput.value, ask: document.getElementById("ask").checked })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) return say(res.d.error || "Something went wrong.");
        say("Created: " + res.d.short, true);
        urlInput.value = ""; aliasInput.value = "";
        load();
      }).catch(function (err) { if (!err || err.message !== "auth") say("Could not reach the server."); });
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginMsg.textContent = "";
    api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { loginMsg.textContent = res.d.error || "Wrong password."; return; }
        document.getElementById("password").value = "";
        show(true);
      });
  });
  document.getElementById("logout").addEventListener("click", function () {
    fetch("/api/logout", { method: "POST" }).then(function () { show(false); });
  });

  fetch("/api/me").then(function (r) { show(r.ok); });
})();
