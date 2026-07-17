#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const root = process.cwd();
const snapshotDirectory = path.join(root, 'tests', 'e2e', 'visual.spec.ts-snapshots');
const responsiveScenarios = [
  'home-bench',
  'home-track-index',
  'spectrum-iq',
  'nr-resource-grid',
  'vna-smith',
  'power-coupler',
  'pa-load-pull',
  'pa-load-pull-linearity',
  'search-glossary',
  'cellular-hub',
  'cellular-signal-journey',
  'cellular-coding-chain',
  'cellular-envelope-papr',
  'cellular-dpd-flow',
  'cellular-lte-constellation',
  'cellular-nr-pi2-bpsk',
  'cellular-receiver-recovery',
  'cellular-gsm-timeslot',
  'cellular-gsm-pvt',
  'cellular-nr-allocation',
  'cellular-evm-diagnostic',
  'dvt-station-qualification',
  'dvt-uncertainty-decision',
  'dvt-blind-capstone',
  'instrument-mxg',
  'mxg-scpi',
  'instrument-mxa',
  'mxa-sweep',
  'instrument-ena',
  'ena-calibration',
  'instrument-power-sensor',
  'power-sensor-burst',
  'instrument-psu',
  'psu-cv-cc',
];
const viewports = {
  1440: { width: 1440, height: 1000 },
  1024: { width: 1024, height: 900 },
  390: { width: 390, height: 844 },
};
const expected = new Map();

for (const scenario of responsiveScenarios) {
  for (const [name, size] of Object.entries(viewports)) {
    expected.set(`${scenario}-${name}-chromium-darwin.png`, size);
  }
}
for (const name of [
  'iq-linked-results-390-chromium-darwin.png',
  'vna-network-results-390-chromium-darwin.png',
  'search-results-390-chromium-darwin.png',
]) {
  expected.set(name, viewports[390]);
}

const actual = (await readdir(snapshotDirectory))
  .filter((name) => name.endsWith('.png'))
  .sort();
const errors = [];

for (const name of actual) {
  if (!expected.has(name)) errors.push(`Unexpected baseline: ${name}`);
}
for (const [name, size] of expected) {
  if (!actual.includes(name)) {
    errors.push(`Missing baseline: ${name}`);
    continue;
  }

  const file = path.join(snapshotDirectory, name);
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== size.width || info.height !== size.height) {
    errors.push(`${name}: ${info.width}×${info.height}, expected ${size.width}×${size.height}`);
  }

  // Precision Lab's darkest intentional surface is #10191B. Any RGB pixel
  // below 12 in every channel is therefore an unpainted black compositor tile,
  // not a valid token color.
  let unexplainedBlackPixels = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] < 12 && data[index + 1] < 12 && data[index + 2] < 12) {
      unexplainedBlackPixels += 1;
    }
  }
  if (unexplainedBlackPixels > 0) {
    errors.push(`${name}: ${unexplainedBlackPixels} unexplained near-black pixels`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Visual baseline contract OK: ${actual.length} PNGs, expected dimensions, zero compositor-black pixels.`);
