import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Blog posts: one Markdown file per post in src/content/journal/.
// The admin area will create and edit these files.
const journal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journal' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      topic: z.string(),
      excerpt: z.string(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      draft: z.boolean().default(false),
      // Placeholder posts written for the preview; remove before launch.
      sample: z.boolean().default(false),
    }),
});

// Policy pages (privacy, terms, refunds, accessibility): src/content/legal/.
// The file name is the URL, e.g. privacy.md → /privacy/.
const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date(),
    order: z.number(),
  }),
});

export const collections = { journal, legal };
