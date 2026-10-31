import { defineConfig } from 'astro/config';

// Static output — deploys to Netlify as plain files (publish: dist).
export default defineConfig({
  site: 'https://ebneo.org',
  output: 'static',
  build: { format: 'directory' }, // /slug/ URLs, matching current WordPress paths
});
