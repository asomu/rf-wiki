import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
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

const instrumentLesson = defineCollection({
  loader: glob({ base: './src/content/instruments', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    instrumentId: z.enum([
      'keysight-n5182b',
      'keysight-n9020b',
      'keysight-e5080b',
      'keysight-u2061xa',
      'keysight-n6705c'
    ]),
    chapter: z.enum([
      'safe-cw',
      'waveform-iq',
      'arb-playback',
      'scpi-pyvisa',
      'pa-test-program',
      'safe-input',
      'sweep-rbw-detector',
      'iq-capture-trigger',
      'sa-scpi-measurements',
      'pa-spectrum-analysis',
      'safe-sweep',
      'calibration-reference-plane',
      'sparameters-smith-time',
      'vna-scpi-data',
      'pa-characterization',
      'safe-power',
      'average-peak-burst',
      'correction-uncertainty',
      'sensor-scpi-trigger',
      'pa-power-budget',
      'safe-bias',
      'cv-cc-protection',
      'remote-sense-wiring',
      'psu-scpi-sequence',
      'pa-dc-power'
    ]),
    order: z.number().int().min(1).max(5),
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(z.string()).default([]),
    outcomes: z.array(z.string()).min(1),
    concepts: z.array(z.string()).min(1),
    equipmentContext: z.object({
      source: z.string(),
      dut: z.string(),
      analyzer: z.string()
    }),
    references: z.array(referenceSchema).min(1),
    labId: z.enum([
      'mxg-safe-cw',
      'mxg-waveform-iq',
      'mxg-arb-playback',
      'mxg-scpi-pyvisa',
      'mxg-pa-test-program',
      'mxa-safe-input',
      'mxa-sweep-rbw',
      'mxa-iq-trigger',
      'mxa-scpi-measurements',
      'mxa-pa-analysis',
      'ena-safe-sweep',
      'ena-calibration',
      'ena-sparameters',
      'ena-scpi-data',
      'ena-pa-characterization',
      'sensor-safe-power',
      'sensor-average-peak',
      'sensor-correction',
      'sensor-scpi-trigger',
      'sensor-pa-power-budget',
      'psu-safe-bias',
      'psu-cv-cc',
      'psu-remote-sense',
      'psu-scpi-sequence',
      'psu-pa-dc-power'
    ]),
    status: z.enum(['ready', 'draft'])
  })
});

const lessonLayerSchema = z.object({
  title: z.string(),
  lead: z.string(),
  points: z.array(z.string()).min(2),
});

const cellularLesson = defineCollection({
  loader: file('./src/content/cellular-lessons.json'),
  schema: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    section: z.enum(['foundations', 'pamid', 'gsm', 'lte', 'nr', 'diagnostics']),
    order: z.number().int().positive(),
    title: z.string(),
    shortTitle: z.string(),
    question: z.string(),
    description: z.string(),
    estimatedMinutes: z.number().int().positive(),
    outcomes: z.array(z.string()).min(2),
    concepts: z.array(z.string()).min(2),
    intuition: lessonLayerSchema,
    bench: lessonLayerSchema,
    theory: lessonLayerSchema.extend({
      formula: z.string().optional(),
    }),
    visual: z.enum(['atlas', 'gsm-time', 'resource-lte', 'resource-nr', 'module-path', 'diagnostic']).optional(),
    visualPreset: z.string().optional(),
    check: z.object({
      question: z.string(),
      options: z.array(z.string()).length(3),
      correctIndex: z.number().int().min(0).max(2),
      explanation: z.string(),
    }),
    referenceIds: z.array(z.string()).min(1),
    crossLinks: z.array(z.object({
      label: z.string(),
      href: z.string().startsWith('/'),
      note: z.string(),
    })).default([]),
    progressId: z.string().regex(/^cellular:[a-z0-9-]+:[a-z0-9-]+$/),
    status: z.enum(['ready', 'draft']),
  }),
});

export const collections = { lesson, instrumentLesson, cellularLesson };
