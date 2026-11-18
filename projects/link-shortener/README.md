# Link shortener

A tiny link shortener with click stats. No dependencies, just Node 18 or newer.

```bash
node server.js
```

Open http://localhost:3200 and log in.

## Private by default

- The page and every `/api` route need a password. Only the short links themselves (`/yourcode`) are public, because they have to work for whoever you send them to.
- Set the password with `ADMIN_PASSWORD`. If you do not, a random one is printed when the server starts.

```bash
ADMIN_PASSWORD="something long and unique" node server.js
```

- Login is limited to 5 attempts a minute, and the session cookie is `HttpOnly` and `SameSite=Strict`.
- Behind a proxy (like a host that adds `X-Forwarded-For`), set `TRUST_PROXY=1` so the real visitor address is used. Do not set it otherwise, because anyone could fake that header.

## What it tracks

For each click it keeps the time, the website the visitor came from, browser, system and device type, the first part of the IP address (the last part is cut off, like `203.0.113.0`) and a visitor code that changes every day. It does not keep the full IP address, and link previews from chat apps and bots are not counted as clicks. The `/privacy` page says the same in plain words.

Why not the full IP: it is personal data under EU rules, so storing it needs a clear reason and a notice, and the stats above already answer the useful questions.

## Location (opt in)

- **Country and city from the host.** When `TRUST_PROXY=1` and the server sits behind Cloudflare or Vercel, the country and city those hosts add as headers are saved with each click. No IP lookup service is used, and nothing is stored when the headers are missing.
- **Ask for location per link.** Tick "Ask visitors to share their approximate location" when you create a link. Visitors then see a short page first with **Share approximate location** and **No thanks, continue**. Both go to the destination. If they share, the browser asks for permission and only a rounded area (about 10 km) is kept, shown as "near Bucharest" for Romanian cities and as plain coordinates elsewhere. If they say no, nothing is stored.
- The stats show how many visitors agreed out of how many were asked.
- Browsers only allow location on `https://` pages (or `localhost`), so use https when it is online.
- Link previews and bots skip the page and get a normal redirect.

## Other details

- Links and stats are saved in `data.json` next to the server. Only the last 1000 clicks per link are kept.
- Only http and https links are accepted, and creating links is limited to 20 per minute per address.
