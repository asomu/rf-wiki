import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const configuredRoot = process.env.RF_WIKI_CONTENT_ROOT;
const root = configuredRoot
  ? pathToFileURL(path.resolve(configuredRoot) + path.sep)
  : new URL('../src/content/lessons/', import.meta.url);
const instrumentRoot = new URL('../src/content/instruments/', import.meta.url);
const dvtRoot = new URL('../src/content/dvt/', import.meta.url);
const minimumReady = Number(process.env.RF_WIKI_MINIMUM_READY ?? 6);
if (!Number.isSafeInteger(minimumReady) || minimumReady < 0) {
  console.error('RF_WIKI_MINIMUM_READY must be a non-negative integer.');
  process.exit(1);
}
let files = [];
try {
  files = (await readdir(root)).filter((file) => /\.mdx?$/.test(file));
} catch {
  console.error('Lesson directory is missing.');
  process.exit(1);
}

async function listContentFiles(directory) {
  const collected = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const resolved = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) collected.push(...await listContentFiles(resolved));
    else if (entry.isFile() && /\.mdx?$/.test(entry.name)) collected.push(resolved);
  }
  return collected;
}

const required = ['references:'];
const expectedLayerOrder = ['intuition', 'bench', 'theory'];
const lessonLayerPattern = /<LessonLayer\b[^>]*\blevel\s*=\s*["'](intuition|bench|theory)["'][^>]*>/g;
const errors = [];
let readyCount = 0;
let draftCount = 0;
for (const file of files) {
  const source = await readFile(new URL(file, root), 'utf8');
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch?.[1]) {
    errors.push(`${path.basename(file)} is missing YAML frontmatter.`);
    continue;
  }

  let frontmatter;
  try {
    frontmatter = parse(frontmatterMatch[1]);
  } catch (error) {
    errors.push(`${path.basename(file)} has invalid YAML frontmatter: ${error.message}`);
    continue;
  }

  const status = frontmatter?.status;
  if (status !== 'ready' && status !== 'draft') {
    errors.push(`${path.basename(file)} must declare status: "draft" or status: "ready".`);
    continue;
  }

  if (status === 'draft') {
    draftCount += 1;
    continue;
  }

  readyCount += 1;
  if (/\bTODO\b/i.test(source)) {
    errors.push(`${path.basename(file)} is ready but still contains TODO content.`);
  }
  const layers = [...source.matchAll(lessonLayerPattern)].map((match) => match[1]);
  if (layers.length !== expectedLayerOrder.length
      || layers.some((layer, index) => layer !== expectedLayerOrder[index])) {
    const found = layers.length > 0 ? layers.join(' → ') : 'none';
    errors.push(
      `${path.basename(file)} must contain exactly one intuition → bench → theory LessonLayer sequence; found ${found}`
    );
  }
  for (const marker of required) {
    if (!source.includes(marker)) errors.push(`${path.basename(file)} is missing ${marker}`);
  }

  if (frontmatter.labId) {
    const labMarker = `<LessonLab labId="${frontmatter.labId}"`;
    if (!source.includes("import LessonLab from '../../components/astro/LessonLab.astro'")) {
      errors.push(`${path.basename(file)} must import LessonLab for its inline simulator.`);
    }
    if (!source.includes(labMarker)) {
      errors.push(`${path.basename(file)} must place ${labMarker} /> in the lesson flow.`);
    }
    if (source.includes('<PredictionChallenge')) {
      errors.push(`${path.basename(file)} duplicates prediction outside LessonLab.`);
    }

    const intuitionStart = source.search(/<LessonLayer\b[^>]*\blevel\s*=\s*["']intuition["']/);
    const intuitionClose = source.indexOf('</LessonLayer>', intuitionStart);
    const benchStart = source.search(/<LessonLayer\b[^>]*\blevel\s*=\s*["']bench["']/);
    const labStart = source.indexOf(labMarker);
    if (intuitionStart < 0 || intuitionClose < 0 || benchStart < 0 || labStart < intuitionStart || labStart > intuitionClose) {
      errors.push(`${path.basename(file)} must place LessonLab inside intuition before bench.`);
    }
  }
}

let instrumentReadyCount = 0;
let cellularReadyCount = 0;
let dvtReadyCount = 0;
if (!configuredRoot) {
  const instrumentContracts = [
    {
      directory: 'n5182b',
      label: 'N5182B',
      instrumentId: 'keysight-n5182b',
      chapters: [
        ['safe-cw', 'mxg-safe-cw'],
        ['waveform-iq', 'mxg-waveform-iq'],
        ['arb-playback', 'mxg-arb-playback'],
        ['scpi-pyvisa', 'mxg-scpi-pyvisa'],
        ['pa-test-program', 'mxg-pa-test-program'],
      ],
    },
    {
      directory: 'n9020b',
      label: 'N9020B',
      instrumentId: 'keysight-n9020b',
      chapters: [
        ['safe-input', 'mxa-safe-input'],
        ['sweep-rbw-detector', 'mxa-sweep-rbw'],
        ['iq-capture-trigger', 'mxa-iq-trigger'],
        ['sa-scpi-measurements', 'mxa-scpi-measurements'],
        ['pa-spectrum-analysis', 'mxa-pa-analysis'],
      ],
    },
    {
      directory: 'e5080b',
      label: 'E5080B',
      instrumentId: 'keysight-e5080b',
      chapters: [
        ['safe-sweep', 'ena-safe-sweep'],
        ['calibration-reference-plane', 'ena-calibration'],
        ['sparameters-smith-time', 'ena-sparameters'],
        ['vna-scpi-data', 'ena-scpi-data'],
        ['pa-characterization', 'ena-pa-characterization'],
      ],
    },
    {
      directory: 'u2061xa',
      label: 'U2061XA',
      instrumentId: 'keysight-u2061xa',
      chapters: [
        ['safe-power', 'sensor-safe-power'],
        ['average-peak-burst', 'sensor-average-peak'],
        ['correction-uncertainty', 'sensor-correction'],
        ['sensor-scpi-trigger', 'sensor-scpi-trigger'],
        ['pa-power-budget', 'sensor-pa-power-budget'],
      ],
    },
    {
      directory: 'n6705c',
      label: 'N6705C',
      instrumentId: 'keysight-n6705c',
      chapters: [
        ['safe-bias', 'psu-safe-bias'],
        ['cv-cc-protection', 'psu-cv-cc'],
        ['remote-sense-wiring', 'psu-remote-sense'],
        ['psu-scpi-sequence', 'psu-scpi-sequence'],
        ['pa-dc-power', 'psu-pa-dc-power'],
      ],
    },
  ];

  for (const contract of instrumentContracts) {
    const expectedInstrumentChapters = new Map(
      contract.chapters.map(([chapter, labId], index) => [chapter, { order: index + 1, labId }]),
    );
    let instrumentFiles = [];
    try {
      instrumentFiles = await listContentFiles(new URL(`${contract.directory}/`, instrumentRoot));
    } catch {
      errors.push(`${contract.label} instrument lesson directory is missing.`);
    }

    if (instrumentFiles.length !== expectedInstrumentChapters.size) {
      errors.push(`Expected exactly ${expectedInstrumentChapters.size} ${contract.label} chapters, found ${instrumentFiles.length}.`);
    }

    const foundChapters = new Set();
    for (const fileUrl of instrumentFiles) {
      const source = await readFile(fileUrl, 'utf8');
      const file = path.basename(fileUrl.pathname);
      const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatterMatch?.[1]) {
        errors.push(`${contract.label}/${file} is missing YAML frontmatter.`);
        continue;
      }

      let frontmatter;
      try {
        frontmatter = parse(frontmatterMatch[1]);
      } catch (error) {
        errors.push(`${contract.label}/${file} has invalid YAML frontmatter: ${error.message}`);
        continue;
      }

      const chapter = frontmatter?.chapter;
      const expected = expectedInstrumentChapters.get(chapter);
      if (!expected) {
        errors.push(`${contract.label}/${file} declares unknown instrument chapter: ${String(chapter)}.`);
        continue;
      }
      if (foundChapters.has(chapter)) errors.push(`${contract.label}/${file} duplicates instrument chapter: ${chapter}.`);
      foundChapters.add(chapter);

      if (path.basename(file, path.extname(file)) !== chapter) {
        errors.push(`${contract.label}/${file} must use its chapter id as the filename: ${chapter}.mdx.`);
      }
      if (frontmatter.instrumentId !== contract.instrumentId) {
        errors.push(`${contract.label}/${file} must declare instrumentId: "${contract.instrumentId}".`);
      }
      if (frontmatter.order !== expected.order) errors.push(`${contract.label}/${file} must declare order: ${expected.order}.`);
      if (frontmatter.labId !== expected.labId) errors.push(`${contract.label}/${file} must declare labId: "${expected.labId}".`);
      if (frontmatter.status !== 'ready') errors.push(`${contract.label}/${file} must be ready; found status: ${String(frontmatter.status)}.`);
      else instrumentReadyCount += 1;
      if (!Array.isArray(frontmatter.references) || frontmatter.references.length === 0) {
        errors.push(`${contract.label}/${file} is missing authoritative references.`);
      }
      if (/\bTODO\b/i.test(source)) errors.push(`${contract.label}/${file} is ready but still contains TODO content.`);

      const layers = [...source.matchAll(lessonLayerPattern)].map((match) => match[1]);
      if (layers.length !== expectedLayerOrder.length || layers.some((layer, index) => layer !== expectedLayerOrder[index])) {
        const found = layers.length > 0 ? layers.join(' → ') : 'none';
        errors.push(`${contract.label}/${file} must contain exactly one intuition → bench → theory LessonLayer sequence; found ${found}`);
      }

      const importMarker = "import InstrumentLab from '../../../components/astro/InstrumentLab.astro'";
      const labMarker = `<InstrumentLab labId="${expected.labId}"`;
      if (!source.includes(importMarker)) errors.push(`${contract.label}/${file} must import the shared InstrumentLab component.`);
      if (!source.includes(labMarker)) errors.push(`${contract.label}/${file} must place ${labMarker} /> in the lesson flow.`);
      if (source.split('<InstrumentLab').length - 1 !== 1) errors.push(`${contract.label}/${file} must contain exactly one inline InstrumentLab.`);
      if (source.includes('<PredictionChallenge')) errors.push(`${contract.label}/${file} duplicates prediction outside InstrumentLab.`);

      const intuitionStart = source.search(/<LessonLayer\b[^>]*\blevel\s*=\s*["']intuition["']/);
      const intuitionClose = source.indexOf('</LessonLayer>', intuitionStart);
      const labStart = source.indexOf(labMarker);
      if (intuitionStart < 0 || intuitionClose < 0 || labStart < intuitionStart || labStart > intuitionClose) {
        errors.push(`${contract.label}/${file} must place InstrumentLab inside intuition before bench.`);
      }
    }

    for (const chapter of expectedInstrumentChapters.keys()) {
      if (!foundChapters.has(chapter)) errors.push(`Missing ${contract.label} instrument chapter: ${chapter}.`);
    }
  }

  const cellularCounts = new Map([
    ['foundations', 8],
    ['pamid', 10],
    ['gsm', 9],
    ['lte', 11],
    ['nr', 11],
    ['diagnostics', 10],
  ]);
  const expectedCellularTotal = [...cellularCounts.values()].reduce((sum, count) => sum + count, 0);
  let cellularLessons = [];
  try {
    cellularLessons = JSON.parse(await readFile(new URL('../src/content/cellular-lessons.json', import.meta.url), 'utf8'));
  } catch (error) {
    errors.push(`Cellular lesson registry is missing or invalid JSON: ${error.message}`);
  }
  const specRegistrySource = await readFile(new URL('../src/data/cellular-specs.ts', import.meta.url), 'utf8');
  const knownReferenceIds = new Set(
    [...specRegistrySource.matchAll(/^\s{2}'([^']+)':\s*\{/gm)].map((match) => match[1]),
  );
  const foundCellularIds = new Set();
  const foundProgressIds = new Set();
  for (const [section, expectedCount] of cellularCounts) {
    const sectionLessons = cellularLessons.filter((lesson) => lesson.section === section);
    if (sectionLessons.length !== expectedCount) {
      errors.push(`Expected ${expectedCount} cellular ${section} lessons, found ${sectionLessons.length}.`);
    }
    const orders = sectionLessons.map((lesson) => lesson.order).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index + 1)) {
      errors.push(`Cellular ${section} lessons must use contiguous order 1…${expectedCount}; found ${orders.join(', ')}.`);
    }
  }
  for (const lesson of cellularLessons) {
    const label = `cellular/${lesson.section}/${lesson.slug}`;
    if (foundCellularIds.has(lesson.id)) errors.push(`${label} duplicates id ${lesson.id}.`);
    foundCellularIds.add(lesson.id);
    if (foundProgressIds.has(lesson.progressId)) errors.push(`${label} duplicates progressId ${lesson.progressId}.`);
    foundProgressIds.add(lesson.progressId);
    if (lesson.status !== 'ready') errors.push(`${label} must be ready; found ${String(lesson.status)}.`);
    else cellularReadyCount += 1;
    if (lesson.progressId !== `cellular:${lesson.section}:${lesson.slug}`) {
      errors.push(`${label} progressId must be cellular:${lesson.section}:${lesson.slug}.`);
    }
    for (const layer of ['intuition', 'bench', 'theory']) {
      if (!lesson[layer]?.title || !lesson[layer]?.lead || !Array.isArray(lesson[layer]?.points) || lesson[layer].points.length < 2) {
        errors.push(`${label} must provide title, lead and at least two points for ${layer}.`);
      }
    }
    if (!lesson.check?.question || !Array.isArray(lesson.check?.options) || lesson.check.options.length !== 3
        || !Number.isSafeInteger(lesson.check?.correctIndex) || lesson.check.correctIndex < 0 || lesson.check.correctIndex > 2
        || !lesson.check?.explanation) {
      errors.push(`${label} must provide a three-option prediction check with explanation.`);
    }
    if (!Array.isArray(lesson.referenceIds) || lesson.referenceIds.length === 0) {
      errors.push(`${label} is missing clause-trace references.`);
    } else {
      for (const referenceId of lesson.referenceIds) {
        if (!knownReferenceIds.has(referenceId)) errors.push(`${label} uses unknown reference id ${referenceId}.`);
      }
    }
    if (lesson.concepts?.includes('scrambling')) {
      const requiredScramblingReferences = lesson.section === 'lte'
        ? ['lte-36-211-5-3-1']
        : lesson.section === 'nr'
          ? ['nr-38-211-6-3-1-1']
          : ['lte-36-211-5-3-1', 'nr-38-211-6-3-1-1'];
      for (const referenceId of requiredScramblingReferences) {
        if (!lesson.referenceIds.includes(referenceId)) {
          errors.push(`${label} discusses scrambling but is missing physical-channel reference ${referenceId}.`);
        }
      }
    }
    if (/\bTODO\b/i.test(JSON.stringify(lesson))) errors.push(`${label} is ready but still contains TODO content.`);
  }
  if (cellularLessons.length !== expectedCellularTotal) {
    errors.push(`Expected exactly ${expectedCellularTotal} cellular lessons, found ${cellularLessons.length}.`);
  }

  const dvtContracts = new Map([
    ['bench-capability', { order: 1, labId: undefined }],
    ['station-qualification', { order: 2, labId: 'station-qualification' }],
    ['synchronized-test-point', { order: 3, labId: 'synchronized-test-point' }],
    ['uncertainty-guardband', { order: 4, labId: 'uncertainty-decision' }],
    ['cw-two-tone-lte', { order: 5, labId: undefined }],
    ['fdd-dvt-conclusion', { order: 6, labId: 'blind-fdd-capstone' }],
  ]);
  let dvtFiles = [];
  try {
    dvtFiles = await listContentFiles(dvtRoot);
  } catch {
    errors.push('DVT lesson directory is missing.');
  }
  if (dvtFiles.length !== dvtContracts.size) {
    errors.push(`Expected exactly ${dvtContracts.size} DVT lessons, found ${dvtFiles.length}.`);
  }

  const foundDvtSlugs = new Set();
  const foundDvtProgressIds = new Set();
  for (const fileUrl of dvtFiles) {
    const source = await readFile(fileUrl, 'utf8');
    const file = path.basename(fileUrl.pathname);
    const slug = path.basename(file, path.extname(file));
    const contract = dvtContracts.get(slug);
    if (!contract) {
      errors.push(`DVT/${file} uses an unplanned lesson slug.`);
      continue;
    }
    if (foundDvtSlugs.has(slug)) errors.push(`DVT/${file} duplicates slug ${slug}.`);
    foundDvtSlugs.add(slug);

    const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch?.[1]) {
      errors.push(`DVT/${file} is missing YAML frontmatter.`);
      continue;
    }
    let frontmatter;
    try {
      frontmatter = parse(frontmatterMatch[1]);
    } catch (error) {
      errors.push(`DVT/${file} has invalid YAML frontmatter: ${error.message}`);
      continue;
    }

    const expectedProgressId = `dvt:${slug}`;
    if (frontmatter.order !== contract.order) errors.push(`DVT/${file} must declare order: ${contract.order}.`);
    if (frontmatter.progressId !== expectedProgressId) errors.push(`DVT/${file} progressId must be ${expectedProgressId}.`);
    if (foundDvtProgressIds.has(frontmatter.progressId)) errors.push(`DVT/${file} duplicates progressId ${String(frontmatter.progressId)}.`);
    foundDvtProgressIds.add(frontmatter.progressId);
    if (frontmatter.topology !== 'lte-fdd-pamid') errors.push(`DVT/${file} must keep topology lte-fdd-pamid.`);
    if (frontmatter.status !== 'ready') errors.push(`DVT/${file} must be ready; found ${String(frontmatter.status)}.`);
    else dvtReadyCount += 1;
    if (!Array.isArray(frontmatter.references) || frontmatter.references.length === 0) {
      errors.push(`DVT/${file} is missing authoritative references.`);
    }
    if (/\bTODO\b/i.test(source)) errors.push(`DVT/${file} is ready but still contains TODO content.`);
    if (/3GPP TS 36\.521-1[^\n]*V17\.7\.0/i.test(source)) {
      errors.push(`DVT/${file} must not reintroduce the unsupported TS 36.521-1 V17.7.0 citation.`);
    }
    if (/3GPP TS 36\.521-1[^\n]*(?:§|clause)\s*6(?!\.)/i.test(source)) {
      errors.push(`DVT/${file} must cite exact TS 36.521-1 clauses, not generic clause 6.`);
    }

    const layers = [...source.matchAll(lessonLayerPattern)].map((match) => match[1]);
    if (layers.length !== expectedLayerOrder.length || layers.some((layer, index) => layer !== expectedLayerOrder[index])) {
      const found = layers.length > 0 ? layers.join(' → ') : 'none';
      errors.push(`DVT/${file} must contain exactly one intuition → bench → theory LessonLayer sequence; found ${found}.`);
    }

    if (contract.labId) {
      const labMarker = `<DvtLab labId="${contract.labId}" progressId="${expectedProgressId}"`;
      if (frontmatter.labId !== contract.labId) errors.push(`DVT/${file} must declare labId: "${contract.labId}".`);
      if (!source.includes("import DvtLab from '../../components/astro/DvtLab.astro'")) errors.push(`DVT/${file} must import DvtLab.`);
      if (!source.includes(labMarker)) errors.push(`DVT/${file} must place ${labMarker} /> in the lesson flow.`);
      if (source.split('<DvtLab').length - 1 !== 1) errors.push(`DVT/${file} must contain exactly one DvtLab.`);
      const intuitionStart = source.search(/<LessonLayer\b[^>]*\blevel\s*=\s*["']intuition["']/);
      const intuitionClose = source.indexOf('</LessonLayer>', intuitionStart);
      const labStart = source.indexOf(labMarker);
      if (intuitionStart < 0 || intuitionClose < 0 || labStart < intuitionStart || labStart > intuitionClose) {
        errors.push(`DVT/${file} must place DvtLab inside intuition before bench.`);
      }
    } else {
      if (frontmatter.labId !== undefined) errors.push(`DVT/${file} must remain a static lesson without labId.`);
      const completionMarker = `<DvtStaticCompletion progressId="${expectedProgressId}"`;
      if (!source.includes("import DvtStaticCompletion from '../../components/astro/DvtStaticCompletion.astro'")) {
        errors.push(`DVT/${file} must import DvtStaticCompletion.`);
      }
      if (!source.includes(completionMarker)) errors.push(`DVT/${file} must include its static completion boundary.`);
      if (source.split('<DvtStaticCompletion').length - 1 !== 1) errors.push(`DVT/${file} must contain exactly one DvtStaticCompletion.`);
    }
  }
  for (const slug of dvtContracts.keys()) {
    if (!foundDvtSlugs.has(slug)) errors.push(`Missing DVT lesson: ${slug}.`);
  }

  const totalLearningItems = readyCount + instrumentReadyCount + cellularReadyCount + dvtReadyCount;
  if (totalLearningItems !== 96) {
    errors.push(`Expected exactly 96 total learning items, found ${totalLearningItems}.`);
  }
}

if (readyCount < minimumReady) {
  errors.push(`Expected at least ${minimumReady} ready lessons, found ${readyCount}.`);
}
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Content contract OK: ${readyCount} ready lessons, ${draftCount} hidden drafts.`);
if (!configuredRoot) {
  console.log(`Instrument content contract OK: ${instrumentReadyCount} ready chapters across 5 Keysight instruments.`);
  console.log(`Cellular content contract OK: ${cellularReadyCount} ready pages across 6 sections.`);
  console.log(`DVT content contract OK: ${dvtReadyCount} ready lessons; 96 total learning items.`);
}
