import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

const configuredRoot = process.env.RF_WIKI_CONTENT_ROOT;
const root = configuredRoot
  ? pathToFileURL(path.resolve(configuredRoot) + path.sep)
  : new URL('../src/content/lessons/', import.meta.url);
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

if (readyCount < minimumReady) {
  errors.push(`Expected at least ${minimumReady} ready lessons, found ${readyCount}.`);
}
if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Content contract OK: ${readyCount} ready lessons, ${draftCount} hidden drafts.`);
