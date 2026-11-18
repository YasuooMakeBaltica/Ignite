(function () {
  var join = document.getElementById("join");
  var joinForm = document.getElementById("join-form");
  var chat = document.getElementById("chat");
  var log = document.getElementById("log");
  var roomName = document.getElementById("room-name");
  var onlineEl = document.getElementById("online");
  var sendForm = document.getElementById("send-form");
  var textInput = document.getElementById("text");
  var statusEl = document.getElementById("status");
  var nickInput = document.getElementById("nick");
  var roomInput = document.getElementById("room");
  var source = null, nick = "", room = "", seen = {};

  try { nickInput.value = localStorage.getItem("chat-nick") || ""; } catch (e) { /* storage blocked */ }
  var fromHash = location.hash.replace(/^#/, "");
  if (/^[A-Za-z0-9-]{1,24}$/.test(fromHash)) roomInput.value = fromHash;

  function colorFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 8;
    return "c" + h;
  }
  function clock(t) { return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

  function add(m) {
    if (seen[m.id]) return;
    seen[m.id] = true;
    var li = document.createElement("li");
    if (m.system) {
      li.className = "sys"; li.textContent = m.text;
    } else {
      li.className = "msg" + (m.nick === nick ? " mine" : "");
      var who = document.createElement("div");
      who.className = "who " + colorFor(m.nick);
      who.textContent = m.nick;
      var when = document.createElement("span");
      when.className = "when"; when.textContent = clock(m.time);
      who.appendChild(when);
      var body = document.createElement("div");
      body.className = "body"; body.textContent = m.text;
      li.appendChild(who); li.appendChild(body);
    }
    var stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 60;
    log.appendChild(li);
    if (stick || m.nick === nick) log.scrollTop = log.scrollHeight;
  }

  function setOnline(n) { onlineEl.textContent = n + " online"; }

  function connect() {
    if (source) source.close();
    seen = {};
    log.textContent = "";
    source = new EventSource("/events?room=" + encodeURIComponent(room) + "&nick=" + encodeURIComponent(nick));
    source.addEventListener("init", function (e) {
      var d = JSON.parse(e.data);
      d.history.forEach(add);
      setOnline(d.online);
      statusEl.textContent = "";
      log.scrollTop = log.scrollHeight;
    });
    source.addEventListener("message", function (e) { add(JSON.parse(e.data)); });
    source.addEventListener("online", function (e) { setOnline(JSON.parse(e.data).online); });
    source.onerror = function () { statusEl.textContent = "Connection lost. Trying to reconnect..."; };
  }

  joinForm.addEventListener("submit", function (e) {
    e.preventDefault();
    nick = nickInput.value.trim();
    room = roomInput.value.trim().toLowerCase();
    if (!nick || !/^[a-z0-9-]{1,24}$/.test(room)) return;
    try { localStorage.setItem("chat-nick", nick); } catch (err) { /* storage blocked */ }
    location.hash = room;
    roomName.textContent = "# " + room;
    join.hidden = true;
    chat.hidden = false;
    connect();
    textInput.focus();
  });

  sendForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = textInput.value.trim();
    if (!text) return;
    textInput.value = "";
    fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: room, nick: nick, text: text })
    }).then(function (r) {
      if (r.status === 429) statusEl.textContent = "Slow down a little.";
      else if (!r.ok) statusEl.textContent = "Message not sent.";
      else statusEl.textContent = "";
    }).catch(function () { statusEl.textContent = "Message not sent."; });
  });

  document.getElementById("leave").addEventListener("click", function () {
    if (source) source.close();
    chat.hidden = true;
    join.hidden = false;
  });
})();
