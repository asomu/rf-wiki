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

export const collections = { lesson, instrumentLesson };
