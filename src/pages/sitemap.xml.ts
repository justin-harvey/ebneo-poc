import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

// Self-generated sitemap (static endpoint -> dist/sitemap.xml). Covers the static pages,
// the preserved legacy video post, and every published commentary. /admin and the /api
// function routes are intentionally omitted. robots.txt points crawlers here.
export async function GET(context: APIContext) {
  const site = (context.site?.href ?? 'https://ebneo.org/').replace(/\/$/, '');

  const staticPaths = [
    '/',
    '/about/',
    '/reviews/',
    '/vote/',
    '/impact/',
    '/authors/',
    '/author-instructions/',
    '/contact/',
    '/2016/01/ebneo-2015-conference-video-series-gordon-guyatt/',
  ];

  const commentaries = (await getCollection('commentaries')).filter(
    (c) => c.data.status !== 'draft',
  );

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );

  const urls: { loc: string; lastmod?: string }[] = [
    ...staticPaths.map((p) => ({ loc: site + p })),
    ...commentaries.map((c) => ({
      loc: `${site}/${c.slug}/`,
      lastmod: c.data.publish_date
        ? new Date(c.data.publish_date).toISOString().slice(0, 10)
        : undefined,
    })),
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
      )
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
