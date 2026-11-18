"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3300;
const PUBLIC = path.join(__dirname, "public");
const STATIC = { "/": "index.html", "/app.js": "app.js", "/style.css": "style.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const HISTORY = 100;
const MAX_TEXT = 500;

// rooms: name -> { clients: Set<res>, history: [], nextId, touched }
const rooms = new Map();
function room(name) {
  let r = rooms.get(name);
  if (!r) { r = { clients: new Set(), history: [], nextId: 1, touched: Date.now() }; rooms.set(name, r); }
  return r;
}

const lastSent = new Map();
function tooFast(ip) {
  const now = Date.now();
  const prev = lastSent.get(ip) || 0;
  lastSent.set(ip, now);
  return now - prev < 700;
}

function clean(s, max) {
  return String(s || "").replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function push(r, event, data) {
  const line = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
  r.clients.forEach((res) => res.write(line));
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'"
  }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const ip = req.socket.remoteAddress || "";

  if (req.method === "GET" && STATIC[url.pathname]) {
    const file = path.join(PUBLIC, STATIC[url.pathname]);
    return fs.readFile(file, (err, data) => {
      if (err) return send(res, 500, "error");
      send(res, 200, data, { "Content-Type": TYPES[path.extname(file)], "Cache-Control": "no-cache" });
    });
  }

  if (req.method === "GET" && url.pathname === "/events") {
    const name = clean(url.searchParams.get("room"), 24).toLowerCase();
    const nick = clean(url.searchParams.get("nick"), 20);
    if (!/^[a-z0-9-]{1,24}$/.test(name) || !nick) return send(res, 400, "Bad room or nickname.");
    const r = room(name);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "X-Content-Type-Options": "nosniff"
    });
    res.write("retry: 2000\n\n");
    res.write("event: init\ndata: " + JSON.stringify({ history: r.history, online: r.clients.size + 1 }) + "\n\n");
    r.clients.add(res);
    r.touched = Date.now();
    const join = { id: r.nextId++, system: true, text: nick + " joined", time: Date.now() };
    r.history.push(join);
    push(r, "message", join);
    push(r, "online", { online: r.clients.size });
    const beat = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(beat);
      r.clients.delete(res);
      r.touched = Date.now();
      const left = { id: r.nextId++, system: true, text: nick + " left", time: Date.now() };
      r.history.push(left);
      if (r.history.length > HISTORY) r.history.shift();
      push(r, "message", left);
      push(r, "online", { online: r.clients.size });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/send") {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 4096) req.destroy(); else chunks.push(c); });
    req.on("end", () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return send(res, 400, "Bad request."); }
      const name = clean(body.room, 24).toLowerCase();
      const nick = clean(body.nick, 20);
      const text = clean(body.text, MAX_TEXT);
      if (!/^[a-z0-9-]{1,24}$/.test(name) || !nick || !text) return send(res, 400, "Bad message.");
      const r = rooms.get(name);
      if (!r) return send(res, 404, "Room not found.");
      if (tooFast(ip)) return send(res, 429, "Slow down.");
      const msg = { id: r.nextId++, nick, text, time: Date.now() };
      r.history.push(msg);
      if (r.history.length > HISTORY) r.history.shift();
      r.touched = Date.now();
      push(r, "message", msg);
      send(res, 204, "");
    });
    return;
  }

  send(res, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
});

// Forget rooms that nobody has used for an hour
setInterval(() => {
  const now = Date.now();
  rooms.forEach((r, name) => { if (!r.clients.size && now - r.touched > 3600000) rooms.delete(name); });
}, 600000).unref();

server.listen(PORT, () => console.log("Chat room running on http://localhost:" + PORT));
