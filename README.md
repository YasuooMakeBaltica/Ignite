# The Ignition Union

**Sparking ideas into websites that work.**

> *Ignite* is the project's codename. **The Ignition Union** is the brand.

## About

The Ignition Union is a website-building business. We design and develop fast, accessible, professionally crafted websites for clients who want a strong presence online. This repository contains the source for The Ignition Union's own website, the home of our brand, our services, and our work.

The site is built with HTML, CSS, and JavaScript, with no frameworks or build step, so it stays lightweight, quick to load, and easy to maintain.

## What We Do

- **Website design and development:** custom sites built around each client's goals
- **Responsive layouts:** pages that look right on phones, tablets, and desktops
- **Performance and accessibility:** semantic markup, optimized assets, and inclusive design
- **Ongoing support:** updates and improvements after launch

## Tech Stack

| Layer     | Technology                               |
| --------- | ---------------------------------------- |
| Frontend  | HTML5, CSS3, vanilla JavaScript (ES6+)   |
| Backend   | Node.js with Express                     |
| Security  | Helmet (security headers, CSP), compression |

The frontend has no framework or build step. The Express server serves the site, adds security headers, and handles the `/discord` invite redirect.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer

### Run locally

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/YasuooMakeBaltica/Ignite.git
   cd Ignite
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm start
   ```

   Then visit <http://localhost:3000>. Use `npm run dev` to restart automatically when files change.

### Configuration

Settings live in `.env` (never committed):

| Variable             | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `PORT`               | Port the server listens on. Defaults to `3000`.                             |
| `DISCORD_INVITE_URL` | Optional. Overrides the default invite used by the `/discord` route.        |

The "Join our Discord" button links straight to the invite (`https://discord.gg/5MKENrrxBB`), so it works on any host, including static ones. If the invite changes, update the link in `public/index.html` and the default in `server.js`. The `/discord` route is a short link that redirects to the same invite.

## Project Structure

```
Ignite/
├── public/             # Everything served to the browser
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/         # Images, logos, fonts
├── server.js           # Express server
├── package.json
├── .env.example        # Template for local configuration
├── .gitignore
└── README.md
```

## Brand

- **Name:** The Ignition Union
- **Codename:** Ignite
- **Tagline:** Sparking ideas into websites that work.

Logo files, colors, and typography will be documented here once they are finalized.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to your branch and open a pull request

## License

All rights reserved © The Ignition Union. A formal license has not been chosen yet.
