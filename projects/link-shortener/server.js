"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3200;
const DATA = path.join(__dirname, "data.json");
const PUBLIC = path.join(__dirname, "public");
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RESERVED = new Set(["api", "app.js", "style.css", "favicon.ico", "robots.txt"]);
const STATIC = { "/": "index.html", "/app.js": "app.js", "/style.css": "style.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

let db = { links: {} };
try { db = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (e) { /* first run */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DATA + ".tmp", JSON.stringify(db));
    fs.renameSync(DATA + ".tmp", DATA);
  }, 200);
}

const hits = new Map();
function limited(ip, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

function day(offset) {
  const d = new Date(Date.now() - (offset || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

function newCode() {
  for (let tries = 0; tries < 20; tries++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!db.links[code]) return code;
  }
  throw new Error("could not make a code");
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'"
  }, headers));
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
}

function readBody(req, cb) {
  let size = 0;
  const chunks = [];
  req.on("data", (c) => {
    size += c.length;
    if (size > 4096) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on("end", () => {
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { cb(e); }
  });
}

function view(link, base) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(link.days[day(i)] || 0);
  return { code: link.code, short: base + "/" + link.code, url: link.url, clicks: link.clicks, created: link.created, last: link.last, days };
}

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || "";
  const proto = req.headers["x-forwarded-proto"] || "http";
  const base = proto + "://" + (req.headers.host || "localhost");
  const url = new URL(req.url, base);
  const pathname = url.pathname;

  if (req.method === "GET" && STATIC[pathname]) {
    const file = path.join(PUBLIC, STATIC[pathname]);
    return fs.readFile(file, (err, data) => {
      if (err) return send(res, 500, "error");
      send(res, 200, data, { "Content-Type": TYPES[path.extname(file)], "Cache-Control": "no-cache" });
    });
  }

  if (pathname === "/api/links" && req.method === "GET") {
    const list = Object.values(db.links).sort((a, b) => b.created - a.created).slice(0, 200).map((l) => view(l, base));
    return json(res, 200, list);
  }

  if (pathname === "/api/links" && req.method === "POST") {
    if (limited(ip, 20, 60000)) return json(res, 429, { error: "Too many requests, wait a minute." });
    return readBody(req, (err, body) => {
      if (err) return json(res, 400, { error: "Invalid request." });
      let target;
      try { target = new URL(String(body.url || "").trim()); } catch (e) { return json(res, 400, { error: "Enter a full link that starts with http:// or https://" }); }
      if (!/^https?:$/.test(target.protocol) || target.href.length > 2000) return json(res, 400, { error: "Only http and https links up to 2000 characters." });
      if (target.host === (req.headers.host || "")) return json(res, 400, { error: "That link already points to this shortener." });
      let code = String(body.alias || "").trim();
      if (code) {
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) return json(res, 400, { error: "Alias: 3 to 32 letters, numbers, - or _." });
        if (RESERVED.has(code.toLowerCase()) || db.links[code]) return json(res, 409, { error: "That alias is taken." });
      } else {
        code = newCode();
      }
      db.links[code] = { code, url: target.href, clicks: 0, created: Date.now(), last: null, days: {} };
      save();
      json(res, 201, view(db.links[code], base));
    });
  }

  const del = pathname.match(/^\/api\/links\/([A-Za-z0-9_-]{1,32})$/);
  if (del && req.method === "DELETE") {
    if (!db.links[del[1]]) return json(res, 404, { error: "Not found." });
    delete db.links[del[1]];
    save();
    return json(res, 200, { ok: true });
  }

  const m = pathname.match(/^\/([A-Za-z0-9_-]{1,32})$/);
  if (m && (req.method === "GET" || req.method === "HEAD")) {
    const link = db.links[m[1]];
    if (!link) return send(res, 404, "Link not found.", { "Content-Type": "text/plain; charset=utf-8" });
    if (req.method === "GET") {
      link.clicks += 1;
      link.last = Date.now();
      const d = day(0);
      link.days[d] = (link.days[d] || 0) + 1;
      save();
    }
    return send(res, 302, "", { Location: link.url, "Cache-Control": "no-store" });
  }

  send(res, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
});

server.listen(PORT, () => console.log("Link shortener running on http://localhost:" + PORT));
