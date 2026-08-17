# Paint Estimator

A takeoff and pricing tool for interior painting jobs: measure rooms, assign
paint products, and get labor hours, material gallons, and a priced
estimate — matching a hand-built spreadsheet workflow but without the manual
formula work.

## Running it locally

```bash
npm install
npm run dev      # starts the app at http://localhost:5173
npm test         # runs the test suite (vitest)
```

Other useful scripts:

```bash
npm run build       # production build (output in dist/)
npx tsc --noEmit    # type-check without emitting files
```

## Data storage

There is no backend and no account system. Everything — your projects, rate
profile, and price book — is saved in your browser's `localStorage`, scoped
to whatever device and browser you're using. Nothing is synced or uploaded
anywhere.

Because storage is per-device, use the **Export** button to save a project
to a `.json` file and **Import** to load it back in — on the same device, a
different device, or after clearing your browser data. Export/Import is
also the only way to move a project between the Vercel and GitHub Pages
deployments, since they don't share `localStorage`.

## Before you quote a job

The price book ships with every price set to **$0**. That's intentional:
this app's source is compiled straight into the JavaScript bundle it
serves, and a real contractor's negotiated supplier pricing must never be
shipped in there for anyone to read out of dev tools. Real prices are
entered by you in **Settings** and stay only in your own browser's
`localStorage`.

Until you set real prices, any product actually used by your takeoff shows
a hard `UNPRICED_PRODUCT` error on the Takeoff and Results screens — that's
the app refusing to quote off placeholder $0 data. Fill in Settings first.

## Deployment

This app deploys to two places from the same repository:

- **Vercel**, from the repo root, at `/`.
- **GitHub Pages**, via `.github/workflows/deploy-pages.yml`, as a project
  site at `/paint-estimator/`.

`vite.config.ts` picks the right `base` path for each target from the
`GITHUB_PAGES` environment variable, which only the Pages workflow sets.

GitHub Pages on a **private** repository requires a paid GitHub plan
(Pro/Team/Enterprise). Until this repo is made public or the plan is
upgraded, the Pages workflow will run but the deploy step will fail — that
does not affect the Vercel deployment.
