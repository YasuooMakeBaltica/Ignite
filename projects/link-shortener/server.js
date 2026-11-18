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
const RESERVED = new Set(["api", "app.js", "style.css", "ask.js", "ask.css", "privacy", "favicon.ico", "robots.txt"]);
const STATIC = { "/": "index.html", "/app.js": "app.js", "/style.css": "style.css", "/ask.js": "ask.js", "/ask.css": "ask.css" };
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
  return { code: link.code, short: base + "/" + link.code, url: link.url, ask: !!link.ask, clicks: link.clicks, created: link.created, last: link.last, days };
}


// Small list used to name an area from rounded coordinates (Romania). Anything farther than 60 km is shown as plain coordinates.
const CITIES = [
  ["Bucharest", 44.43, 26.10], ["Cluj-Napoca", 46.77, 23.59], ["Timisoara", 45.75, 21.23], ["Iasi", 47.16, 27.59],
  ["Constanta", 44.18, 28.63], ["Craiova", 44.32, 23.80], ["Brasov", 45.65, 25.61], ["Galati", 45.44, 28.05],
  ["Ploiesti", 44.94, 26.03], ["Oradea", 47.07, 21.92], ["Braila", 45.27, 27.97], ["Arad", 46.17, 21.31],
  ["Pitesti", 44.86, 24.87], ["Sibiu", 45.79, 24.15], ["Bacau", 46.57, 26.91], ["Targu Mures", 46.54, 24.56],
  ["Baia Mare", 47.66, 23.57], ["Buzau", 45.15, 26.82], ["Satu Mare", 47.79, 22.88], ["Botosani", 47.75, 26.67],
  ["Suceava", 47.65, 26.26], ["Piatra Neamt", 46.93, 26.37], ["Ramnicu Valcea", 45.10, 24.37], ["Drobeta-Turnu Severin", 44.63, 22.66],
  ["Targu Jiu", 45.04, 23.27], ["Tulcea", 45.18, 28.80], ["Alba Iulia", 46.07, 23.58], ["Deva", 45.88, 22.91], ["Resita", 45.30, 21.89]
];
function nearestArea(lat, lng) {
  let best = null, bestKm = Infinity;
  CITIES.forEach((c) => {
    const dLat = (c[1] - lat) * 111;
    const dLng = (c[2] - lng) * 111 * Math.cos(lat * Math.PI / 180);
    const km = Math.sqrt(dLat * dLat + dLng * dLng);
    if (km < bestKm) { bestKm = km; best = c[0]; }
  });
  return bestKm <= 60 ? "near " + best : lat.toFixed(1) + ", " + lng.toFixed(1);
}
// Country and city come from headers added by the host (Cloudflare, Vercel). No IP lookup service is used.
function hostGeo(req) {
  if (!TRUST_PROXY) return { country: "unknown", city: "unknown" };
  const h = req.headers;
  const country = String(h["cf-ipcountry"] || h["x-vercel-ip-country"] || "").toUpperCase().slice(0, 2);
  let city = String(h["cf-ipcity"] || h["x-vercel-ip-city"] || "");
  try { city = decodeURIComponent(city); } catch (e) { /* keep raw */ }
  return { country: /^[A-Z]{2}$/.test(country) ? country : "unknown", city: city.replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 40) || "unknown" };
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function askPage(link) {
  let host = "";
  try { host = new URL(link.url).host; } catch (e) { host = ""; }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>Before you continue</title><link rel="stylesheet" href="/ask.css"></head><body><main>
<h1>Before you continue</h1>
<p>The owner of this link would like to know roughly where visitors are, to understand where they come from and show more relevant content or ads.</p>
<p>If you agree, your browser will ask for your location. We keep it only as a rounded area (about 10 km), not your exact position. If you say no, nothing is stored and you go to <strong>${esc(host)}</strong> just the same.</p>
<div class="buttons"><button id="share" type="button">Share approximate location</button><a id="skip" class="skip" href="${esc(link.url)}" data-code="${esc(link.code)}" data-url="${esc(link.url)}">No thanks, continue</a></div>
<p id="note" role="status"></p>
<p class="small"><a href="/privacy">Privacy</a></p>
</main><script src="/ask.js"></script></body></html>`;
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

  const geoM = pathname.match(/^\/api\/geo\/([A-Za-z0-9_-]{1,32})$/);
  if (geoM && req.method === "POST") {
    if (limited("geo:" + ip, 10, 60000)) return json(res, 429, { error: "Too many requests." });
    const link = db.links[geoM[1]];
    if (!link || !link.ask) return json(res, 404, { error: "Not found." });
    return readBody(req, (err, body) => {
      const lat = Number(body && body.lat), lng = Number(body && body.lng);
      if (err || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return json(res, 400, { error: "Bad location." });
      const area = nearestArea(Math.round(lat * 10) / 10, Math.round(lng * 10) / 10);
      link.areas = link.areas || {};
      link.areas[area] = (link.areas[area] || 0) + 1;
      link.shared = (link.shared || 0) + 1;
      save();
      json(res, 200, { ok: true });
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
    return send(res, 200, "Links on this service count clicks. For each click we keep the time, the website you came from, your browser, system and device type, a daily anonymous visitor code, the first part of your IP address (the last part is removed) and, when the host provides it, your country and city. We do not keep your full IP address or any name. Some links first ask whether you want to share your approximate location. If you agree, your browser asks for permission and we keep only a rounded area of about 10 km. If you say no, nothing is stored and you continue to the link. Contact the owner of the link to ask about your data.", { "Content-Type": "text/plain; charset=utf-8" });
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
      db.links[code] = { code, url: target.href, ask: body.ask === true, clicks: 0, created: Date.now(), last: null, days: {} };
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
      devices: count(ev, "device"), networks: count(ev, "net"), countries: count(ev, "country"), cities: count(ev, "city"),
      ask: !!l.ask, asked: l.asked || 0, shared: l.shared || 0,
      areas: Object.keys(l.areas || {}).map((k) => ({ name: k, n: l.areas[k] })).sort((a, b) => b.n - a.n).slice(0, 6),
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
      const skipAsk = url.searchParams.get("go") === "1";
      if (link.ask && skipAsk) return send(res, 302, "", { Location: link.url, "Cache-Control": "no-store" });
      if (info.bot) {
        link.bots = (link.bots || 0) + 1;
      } else {
        link.clicks += 1;
        link.last = Date.now();
        const d = day(0);
        link.days[d] = (link.days[d] || 0) + 1;
        link.events = link.events || [];
        link.events.push({ t: Date.now(), ref: refHost(req.headers.referer || ""), browser: info.browser, os: info.os, device: info.device, net: maskIp(ip), country: hostGeo(req).country, city: hostGeo(req).city, v: visitorId(ip, ua) });
        if (link.events.length > MAX_EVENTS) link.events.shift();
      }
      if (link.ask && !info.bot) {
        link.asked = (link.asked || 0) + 1;
        save();
        return send(res, 200, askPage(link), { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'" });
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
