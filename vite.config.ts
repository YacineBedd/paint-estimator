import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this as a project site at /paint-estimator/, so every
// asset URL in the built HTML/JS must be prefixed with that subpath. Vercel
// (and local dev) serve it at the domain root, where that same prefix would
// break every asset URL. GITHUB_PAGES is set only by
// .github/workflows/deploy-pages.yml's build step — Vercel's build and
// `npm run dev`/`npm run build` locally never set it, so both keep working
// at root without any config changes on their end.
const base = process.env.GITHUB_PAGES === "true" ? "/paint-estimator/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
