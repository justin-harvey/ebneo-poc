import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output — deploys to Netlify as plain files (publish: dist).
// Sitemap is self-generated at src/pages/sitemap.xml.ts (the @astrojs/sitemap
// integration is incompatible with this Astro version), robots.txt points to it.
//
// The React integration powers only the /studio admin SPA, which renders
// client:only (no SSR) — so public pages stay pre-rendered HTML and no secret
// ships to the browser. The studio bundle reads the public anon key + magic-link
// session; RLS is the enforcement boundary.
export default defineConfig({
  site: 'https://ebneo.org',
  output: 'static',
  build: { format: 'directory' }, // /slug/ URLs, matching current WordPress paths
  integrations: [react()],
});
