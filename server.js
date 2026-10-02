require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// Only allow real Discord invite links, so a typo or bad value can never
// turn /discord into an open redirect.
const DISCORD_INVITE_PATTERN = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/;
const rawInvite = (process.env.DISCORD_INVITE_URL || "").trim();
const discordInvite = DISCORD_INVITE_PATTERN.test(rawInvite) ? rawInvite : null;

if (rawInvite && !discordInvite) {
  console.warn("DISCORD_INVITE_URL is not a valid Discord invite link and will be ignored.");
}

const app = express();
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "https://fonts.googleapis.com"],
        "font-src": ["https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
      },
    },
  })
);
app.use(compression());

app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// Redirects to the Discord server. Until DISCORD_INVITE_URL is set, send
// visitors back to the contact section with a flag the page can react to.
app.get("/discord", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (discordInvite) return res.redirect(302, discordInvite);
  res.redirect(302, "/?discord=soon#contact");
});

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"],
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.use((req, res) => {
  res.status(404).type("text/plain").send("Page not found.");
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type("text/plain").send("Something went wrong.");
});

app.listen(PORT, () => {
  console.log(`The Ignition Union is running at http://localhost:${PORT}`);
  console.log(discordInvite ? "Discord invite: configured" : "Discord invite: not set yet (set DISCORD_INVITE_URL)");
});
