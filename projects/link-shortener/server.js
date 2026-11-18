"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
const GENERATED_PASSWORD = !process.env.ADMIN_PASSWORD;
const SESSION_MS = 12 * 3600 * 1000;
const MAX_EVENTS = 1000;
const sessions = new Map();

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


function clientIp(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return (req.socket.remoteAddress || "").replace(/^::ffff:/, "");
}
// Keep only the network part of an address, never the full one
function maskIp(ip) {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::";
  const p = ip.split(".");
  return p.length === 4 ? p[0] + "." + p[1] + "." + p[2] + ".0" : "unknown";
}
// A visitor id that changes every day, so people cannot be followed across days
function visitorId(ip, ua) {
  return crypto.createHash("sha256").update(day(0) + "|" + ip + "|" + ua).digest("hex").slice(0, 12);
}
function parseUa(ua) {
  const bot = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|discord|slack|curl|wget|python|headless/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const device = /iPad|Tablet/.test(ua) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { bot, browser, os, device };
}
function refHost(ref) {
  try { return new URL(ref).host || "direct"; } catch (e) { return "direct"; }
}
function cookie(req, name) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? m[1] : "";
}
function authed(req) {
  const t = cookie(req, "sid");
  const exp = t && sessions.get(t);
  if (!exp || exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function samePassword(input) {
  const a = crypto.createHash("sha256").update(String(input)).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
function count(list, key) {
  const out = {};
  list.forEach((e) => { out[e[key]] = (out[e[key]] || 0) + 1; });
  return Object.keys(out).map((k) => ({ name: k, n: out[k] })).sort((a, b) => b.n - a.n).slice(0, 6);
}

const server = http.createServer((req, res) => {
  const ip = clientIp(req);
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

  if (pathname === "/api/login" && req.method === "POST") {
    if (limited("login:" + ip, 5, 60000)) return json(res, 429, { error: "Too many attempts, wait a minute." });
    return readBody(req, (err, body) => {
      if (err || !samePassword(body.password || "")) return json(res, 401, { error: "Wrong password." });
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, Date.now() + SESSION_MS);
      send(res, 200, JSON.stringify({ ok: true }), {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "sid=" + token + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + SESSION_MS / 1000
      });
    });
  }
  if (pathname === "/api/logout" && req.method === "POST") {
    sessions.delete(cookie(req, "sid"));
    return send(res, 200, "{}", { "Content-Type": "application/json", "Set-Cookie": "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (pathname === "/api/me") return json(res, authed(req) ? 200 : 401, { ok: authed(req) });
  if (pathname.startsWith("/api/") && !authed(req)) return json(res, 401, { error: "Log in first." });

  if (pathname === "/privacy" && req.method === "GET") {
    return send(res, 200, "Links on this service count clicks. For each click we keep the time, the website you came from, your browser, system and device type, a daily anonymous visitor code, and the first part of your IP address (the last part is removed). We do not keep your full IP address or any name. Contact the owner of the link to ask about your data.", { "Content-Type": "text/plain; charset=utf-8" });
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

  const st = pathname.match(/^\/api\/links\/([A-Za-z0-9_-]{1,32})\/stats$/);
  if (st && req.method === "GET") {
    const l = db.links[st[1]];
    if (!l) return json(res, 404, { error: "Not found." });
    const ev = l.events || [];
    return json(res, 200, {
      code: l.code, clicks: l.clicks, bots: l.bots || 0,
      unique: new Set(ev.map((e) => e.v)).size,
      referrers: count(ev, "ref"), browsers: count(ev, "browser"), systems: count(ev, "os"),
      devices: count(ev, "device"), networks: count(ev, "net"),
      recent: ev.slice(-8).reverse().map((e) => ({ t: e.t, ref: e.ref, browser: e.browser, os: e.os, net: e.net }))
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
      const ua = String(req.headers["user-agent"] || "").slice(0, 300);
      const info = parseUa(ua);
      if (info.bot) {
        link.bots = (link.bots || 0) + 1;
      } else {
        link.clicks += 1;
        link.last = Date.now();
        const d = day(0);
        link.days[d] = (link.days[d] || 0) + 1;
        link.events = link.events || [];
        link.events.push({ t: Date.now(), ref: refHost(req.headers.referer || ""), browser: info.browser, os: info.os, device: info.device, net: maskIp(ip), v: visitorId(ip, ua) });
        if (link.events.length > MAX_EVENTS) link.events.shift();
      }
      save();
    }
    return send(res, 302, "", { Location: link.url, "Cache-Control": "no-store" });
  }

  send(res, 404, "Not found.", { "Content-Type": "text/plain; charset=utf-8" });
});

server.listen(PORT, () => {
  console.log("Link shortener running on http://localhost:" + PORT);
  if (GENERATED_PASSWORD) console.log("No ADMIN_PASSWORD set. Password for this run: " + ADMIN_PASSWORD);
});
