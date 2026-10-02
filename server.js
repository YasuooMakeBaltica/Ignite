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
const DEFAULT_INVITE = "https://discord.gg/sxtfMfxtHq";
const rawInvite = (process.env.DISCORD_INVITE_URL || "").trim();
const discordInvite = DISCORD_INVITE_PATTERN.test(rawInvite) ? rawInvite : DEFAULT_INVITE;

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

// Redirects to the Discord server. The button on the page links straight to
// the invite, so this route is a stable short link that also keeps working
// if the invite ever changes (set DISCORD_INVITE_URL to override the default).
app.get("/discord", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.redirect(302, discordInvite);
});

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ["html"],
    // Always revalidate (ETag) so edits to HTML, CSS and JS show up right away.
    setHeaders(res, filePath) {
      if (/\.(html|css|js)$/.test(filePath)) res.setHeader("Cache-Control", "no-cache");
      else res.setHeader("Cache-Control", "public, max-age=3600");
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
  console.log("Discord invite: " + discordInvite);
});
