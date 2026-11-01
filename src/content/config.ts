import { defineCollection, z } from 'astro:content';

// Mirrors the Sveltia CMS `commentaries` schema in FEASIBILITY.md §4.
// Front-matter is produced by prototype_parse.py (M3 migration).
const commentaries = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    publish_date: z.coerce.date().nullable().optional(),
    investigation: z.string().optional().default(''),
    pmid: z.string().optional().default(''),
    doi: z.string().optional().default(''),
    reviewer_email: z.string().optional().default(''),
    status: z.string().optional().default('published'),
  }),
});

// Mirrors the Sveltia CMS `polls` schema in FEASIBILITY.md §4 (M4b voting module).
// One file per monthly ballot; the live tally lives in Netlify Blobs, keyed by `month`.
const polls = defineCollection({
  type: 'content',
  schema: z.object({
    month: z.string(), // "2026-11" — the ballot's key; drives "poll of the month"
    question: z
      .string()
      .default('Which study is most likely to impact neonatal care?'),
    status: z.enum(['open', 'closed']).default('open'),
    // 2–3 candidate studies. The array index is the stable vote id (0,1,2…).
    options: z
      .array(
        z.object({
          title: z.string(),
          authors: z.string().optional().default(''),
          journal: z.string().optional().default(''),
          date: z.string().optional().default(''),
          url: z.string().optional().default(''),
        }),
      )
      .min(2),
    // Optional frozen final tallies (index -> votes). When set on a closed poll the
    // archive renders the result bars statically; otherwise they load from /api/results.
    results: z.record(z.number()).optional(),
  }),
});

export const collections = { commentaries, polls };
