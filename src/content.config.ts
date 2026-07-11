import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const referenceSchema = z.object({
  title: z.string(),
  organization: z.string(),
  url: z.url(),
  kind: z.enum(['standard', 'vendor', 'textbook', 'application-note'])
});

const lesson = defineCollection({
  loader: glob({ base: './src/content/lessons', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    module: z.enum(['foundations', 'spectrum-iq', 'ofdm-lte-nr', 'vna-smith', 'power-coupling', 'pa-pull']),
    order: z.number().int().positive(),
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(z.string()).default([]),
    outcomes: z.array(z.string()).min(1),
    concepts: z.array(z.string()).min(1),
    equipmentContext: z.object({
      source: z.string(),
      dut: z.string(),
      analyzer: z.string()
    }),
    standards: z.array(z.string()).default([]),
    references: z.array(referenceSchema).min(1),
    labId: z.enum(['frequency', 'spectrum', 'iq', 'resource-grid', 'smith', 'coupler', 'load-pull']).optional(),
    status: z.enum(['ready', 'draft'])
  })
});

export const collections = { lesson };
