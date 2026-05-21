# Los Chillangos

> **🚧 Migration in progress.** This repo is being rewritten as a Next.js 15 + Payload CMS 3 app
> (SDD: `migrate-to-next-payload`). The legacy static site below is still the source of truth on
> `main` until the migration lands. New dev commands:
>
> ```bash
> pnpm install
> pnpm dev        # http://localhost:3000
> pnpm typecheck
> pnpm lint
> pnpm build
> ```
>
> The legacy files (`index.html`, `styles.css`, `data.js`, `components/`, `assets/`, `vercel.json`)
> remain in place and will be removed in the final migration PR.

---

CDMX E-Bike & Walking Tours — small-group rides, walking tours, and day trips led by locals.

Static site (HTML + CSS + React via CDN). No build step required.

## Stack

- React 18 (UMD via unpkg, production build)
- Babel Standalone (in-browser JSX transform)
- Plain CSS, Google Fonts (Instrument Serif, DM Sans, JetBrains Mono, Anton)

## Local development

Just open `index.html` with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:3000` (or `:8000`).

## Project layout

```
.
├── index.html              # Entry point
├── styles.css              # All styles
├── data.js                 # i18n strings + tour catalog
├── assets/                 # Logos, images
├── components/
│   ├── App.jsx             # Root + router
│   ├── shared.jsx          # Nav, Footer, TourCard, Logo
│   ├── Home.jsx            # Landing page
│   ├── Detail.jsx          # Tour detail
│   └── Booking.jsx         # 5-step booking flow
└── vercel.json             # Vercel config (caching, SPA rewrites)
```

## Deploy on Vercel

This is a pure static site — no build step.

1. Push to GitHub
2. Import the repo on https://vercel.com/new
3. Framework preset: **Other** (no build command, output dir = root)
4. Deploy

Or via CLI:

```bash
npm i -g vercel
vercel
```

## Notes

- `components/*.jsx` is transformed in-browser by Babel Standalone. Fine for a marketing site at this size; if traffic grows, migrate to Vite for a precompiled bundle.
- Languages: English / Spanish toggle in the nav.
- Routes are client-side (React state, no URL changes). The `vercel.json` rewrite ensures any path falls back to `index.html`.
