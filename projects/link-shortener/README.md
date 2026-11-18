# Link shortener

A tiny link shortener with click stats. No dependencies, just Node 18 or newer.

```bash
node server.js
```

Open http://localhost:3200. Set `PORT` to change the port.

- Paste a link, optionally pick a custom name, and get a short link.
- Each short link counts clicks and shows the last 7 days as small bars.
- Links are saved in `data.json` next to the server.
- Only http and https links are accepted, and creating links is limited to 20 per minute per address.

This version has no login, so anyone who can open the page can create and delete links. Keep it on your own computer, or add a password before putting it online.
