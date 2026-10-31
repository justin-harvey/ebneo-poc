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

export const collections = { commentaries };
