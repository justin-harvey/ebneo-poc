import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

// Hand-rolled RSS 2.0 feed of published commentaries, newest first. Mirrors the pattern in
// sitemap.xml.ts (the @astrojs/* integrations are incompatible with this Astro version).
// robots.txt + a <link rel="alternate"> in Base.astro point readers/aggregators here.
export async function GET(context: APIContext) {
  const site = (context.site?.href ?? 'https://ebneo.org/').replace(/\/$/, '');

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );

  const items = (await getCollection('commentaries'))
    .filter((c) => c.data.status !== 'draft')
    .map((c) => ({
      title: c.data.title,
      link: `${site}/${c.slug}/`,
      date: c.data.publish_date ? new Date(c.data.publish_date) : null,
      sort: c.data.publish_date ? +new Date(c.data.publish_date) : 0,
    }))
    .sort((a, b) => b.sort - a.sort);

  const lastBuild = new Date().toUTCString();

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>\n' +
    `  <title>EBNEO, Evidence-Based Neonatology</title>\n` +
    `  <link>${site}/</link>\n` +
    `  <description>Monthly critical appraisals of the best recent neonatal trials, from the International Society for Evidence-Based Neonatology.</description>\n` +
    `  <language>en</language>\n` +
    `  <lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    `  <atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    items
      .map(
        (i) =>
          '  <item>\n' +
          `    <title>${esc(i.title)}</title>\n` +
          `    <link>${esc(i.link)}</link>\n` +
          `    <guid isPermaLink="true">${esc(i.link)}</guid>\n` +
          (i.date ? `    <pubDate>${i.date.toUTCString()}</pubDate>\n` : '') +
          '  </item>',
      )
      .join('\n') +
    '\n</channel>\n</rss>\n';

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
