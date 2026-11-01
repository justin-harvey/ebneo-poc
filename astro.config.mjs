import { defineConfig } from 'astro/config';

// Static output — deploys to Netlify as plain files (publish: dist).
// Sitemap is self-generated at src/pages/sitemap.xml.ts (the @astrojs/sitemap
// integration is incompatible with this Astro version), robots.txt points to it.
export default defineConfig({
  site: 'https://ebneo.org',
  output: 'static',
  build: { format: 'directory' }, // /slug/ URLs, matching current WordPress paths
});
