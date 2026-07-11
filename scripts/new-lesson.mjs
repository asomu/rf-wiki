#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MODULES = new Set([
  'foundations',
  'spectrum-iq',
  'ofdm-lte-nr',
  'vna-smith',
  'power-coupling',
  'pa-pull'
]);

const LAB_IDS = new Set([
  'frequency',
  'spectrum',
  'iq',
  'resource-grid',
  'smith',
  'coupler',
  'load-pull',
  'none'
]);

const MODULE_DEFAULTS = {
  foundations: {
    source: 'RF signal generator',
    dut: '50 Ω cable 또는 termination',
    analyzer: 'Keysight X-Series signal analyzer',
    standards: [],
    reference: {
      title: 'Spectrum Analysis Basics, Application Note 150',
      organization: 'Keysight Technologies',
      url: 'https://www.keysight.com/us/en/assets/7018-06714/application-notes/5952-0292.pdf',
      kind: 'application-note'
    }
  },
  'spectrum-iq': {
    source: 'Keysight Signal Studio 또는 vector signal generator',
    dut: '50 Ω cable 또는 connectorized DUT',
    analyzer: 'Keysight X-Series와 PathWave 89600 VSA',
    standards: [],
    reference: {
      title: 'Spectrum Analysis Basics, Application Note 150',
      organization: 'Keysight Technologies',
      url: 'https://www.keysight.com/us/en/assets/7018-06714/application-notes/5952-0292.pdf',
      kind: 'application-note'
    }
  },
  'ofdm-lte-nr': {
    source: 'Keysight Signal Studio LTE/5G NR waveform',
    dut: 'connectorized PA와 fixture',
    analyzer: 'Keysight X-Series 또는 PathWave 89600 VSA',
    standards: ['3GPP TS 38.211 Release 17'],
    reference: {
      title: 'ETSI TS 138 211 V17.5.0 — 5G NR; Physical channels and modulation',
      organization: 'ETSI / 3GPP',
      url: 'https://www.etsi.org/deliver/etsi_ts/138200_138299/138211/17.05.00_60/ts_138211v170500p.pdf',
      kind: 'standard'
    }
  },
  'vna-smith': {
    source: 'Keysight ENA/PNA swept source',
    dut: 'connectorized one-port 또는 two-port DUT',
    analyzer: 'Keysight ENA/PNA vector network analyzer',
    standards: [],
    reference: {
      title: 'Network Analyzer Basics You Need to Know',
      organization: 'Keysight Technologies',
      url: 'https://www.keysight.com/blogs/en/tech/rfmw/2019/03/08/network-analyzer-basics-you-need-to-know',
      kind: 'vendor'
    }
  },
  'power-coupling': {
    source: 'CW 또는 modulated RF source',
    dut: 'directional coupler 또는 multiport DUT',
    analyzer: 'Keysight ENA/PNA와 calibrated power receiver',
    standards: [],
    reference: {
      title: 'Directional Couplers: Their Operation and Application',
      organization: 'Mini-Circuits',
      url: 'https://blog.minicircuits.com/directional-couplers-their-operation-and-application/',
      kind: 'application-note'
    }
  },
  'pa-pull': {
    source: 'Keysight Signal Studio와 calibrated driver chain',
    dut: 'biased connectorized RF power amplifier',
    analyzer: 'Keysight PNA-X/load-pull system과 X-Series/89600 VSA',
    standards: [],
    reference: {
      title: 'Investigating Load Pull and DC Simulations of a Cree FET',
      organization: 'Keysight Technologies',
      url: 'https://www.keysight.com/us/en/assets/7018-04329/application-notes/5991-4154.pdf',
      kind: 'application-note'
    }
  }
};

const HELP = [
  'RF Wiki lesson scaffold',
  '',
  'Usage:',
  '  node scripts/new-lesson.mjs --title "질문형 제목" --module <module> --slug <kebab-case> [options]',
  '',
  'Required:',
  '  --title       Lesson title in Korean',
  '  --module      foundations | spectrum-iq | ofdm-lte-nr | vna-smith | power-coupling | pa-pull',
  '  --slug        Site-wide unique lowercase kebab-case slug',
  '',
  'Options:',
  '  --order       Positive integer; defaults to the next order in the module',
  '  --minutes     Positive integer; defaults to 45',
  '  --lab-id      frequency | spectrum | iq | resource-grid | smith | coupler | load-pull | none',
  '  --output-dir  Destination directory; defaults to src/content/lessons',
  '  --dry-run     Print the target and scaffold without writing',
  '  --help        Show this help'
].join('\n');

function parseArgs(argv) {
  const options = {};
  const valueFlags = new Set([
    '--title',
    '--module',
    '--slug',
    '--order',
    '--minutes',
    '--lab-id',
    '--output-dir'
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (!valueFlags.has(arg)) {
      throw new Error('Unknown option: ' + arg);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('Missing value for ' + arg);
    }
    options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }

  return options;
}

function requireSingleLine(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('--' + name + ' is required.');
  }
  const normalized = value.trim();
  if (/[\r\n]/.test(normalized)) {
    throw new Error('--' + name + ' must be a single line.');
  }
  return normalized;
}

function positiveInteger(value, name, fallback) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('--' + name + ' must be a positive integer.');
  }
  return Number(value);
}

async function listLessonFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return files;
    throw error;
  }

  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listLessonFiles(resolved));
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(resolved);
    }
  }
  return files;
}

async function nextOrder(directory, module) {
  let highest = 0;
  const files = await listLessonFiles(directory);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const moduleMatch = source.match(/^module:\s*["']?([^"'\n]+)["']?\s*$/m);
    const orderMatch = source.match(/^order:\s*(\d+)\s*$/m);
    if (moduleMatch?.[1] === module && orderMatch?.[1]) {
      highest = Math.max(highest, Number(orderMatch[1]));
    }
  }
  return highest + 1;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function yamlArray(values) {
  if (values.length === 0) return ' []';
  return '\n' + values.map((value) => '  - ' + yamlString(value)).join('\n');
}

function buildScaffold({ title, module, slug, order, minutes, labId }) {
  const defaults = MODULE_DEFAULTS[module];
  const reference = defaults.reference;
  const lines = [
    '---',
    'title: ' + yamlString(title),
    'description: ' + yamlString('TODO: 설정 변화와 화면 결과를 연결하는 한 문장 설명'),
    'module: ' + yamlString(module),
    'order: ' + order,
    'estimatedMinutes: ' + minutes,
    'prerequisites: []',
    'outcomes:',
    '  - ' + yamlString(title + '의 설정 변화와 화면 결과를 자기 말로 설명할 수 있다.'),
    'concepts:',
    '  - ' + yamlString(slug),
    'equipmentContext:',
    '  source: ' + yamlString(defaults.source),
    '  dut: ' + yamlString(defaults.dut),
    '  analyzer: ' + yamlString(defaults.analyzer),
    'standards:' + yamlArray(defaults.standards),
    'references:',
    '  - title: ' + yamlString(reference.title),
    '    organization: ' + yamlString(reference.organization),
    '    url: ' + yamlString(reference.url),
    '    kind: ' + yamlString(reference.kind)
  ];

  if (labId && labId !== 'none') lines.push('labId: ' + yamlString(labId));
  lines.push(
    'status: "draft"',
    '---',
    '',
    "import LessonLayer from '../../components/astro/LessonLayer.astro';",
    "import LessonLab from '../../components/astro/LessonLab.astro';",
    "import Definition from '../../components/astro/Definition.astro';",
    "import FormulaDisclosure from '../../components/astro/FormulaDisclosure.astro';",
    "import MeasurementNote from '../../components/astro/MeasurementNote.astro';",
    '',
    '이 lesson은 교육용 계산 모델이며 실제 장비 정확도나 compliance 판정을 대신하지 않는다.',
    '',
    '<LessonLayer level="intuition" title="TODO: 사용자가 먼저 그릴 물리적 장면은 무엇인가?">',
    '',
    '## 관찰할 질문',
    '',
    'TODO: 한 개의 원인, 한 개의 움직이는 대상, 한 개의 화면 결과로 설명한다.',
    '',
    '<Definition term="TODO: 핵심 용어">',
    'TODO: 장비 화면에서 보이는 의미와 물리적 의미를 함께 정의한다.',
    '</Definition>',
    '',
    ...(labId && labId !== 'none' ? [`<LessonLab labId="${labId}" />`, ''] : []),
    '</LessonLayer>',
    '',
    '<LessonLayer level="bench" title="TODO: Keysight-style bench에서 무엇을 어떤 순서로 바꿀까?">',
    '',
    '## Signal Spine과 초기 조건',
    '',
    'TODO: Source → DUT → Acquisition → DSP/Math → Display의 기준값과 reference plane을 기록한다.',
    '',
    '## 조작과 Cause/Effect Ledger',
    '',
    '- **변경:** TODO',
    '- **직접 효과:** TODO',
    '- **화면 결과:** TODO',
    '- **비용/한계:** TODO',
    '',
    '<MeasurementNote title="TODO: calibration·bandwidth·mismatch 중 핵심 측정 조건" kind="uncertainty">',
    'TODO: 숫자가 유효한 reference plane, convention과 uncertainty를 적는다.',
    '</MeasurementNote>',
    '',
    '</LessonLayer>',
    '',
    '<LessonLayer level="theory" title="TODO: 어떤 식과 규격으로 관찰을 검증할까?">',
    '',
    '<FormulaDisclosure title="TODO: 식의 이름" formula="TODO: 단위와 기준이 보이는 식">',
    'TODO: 변수, 단위, normalization, 적용 범위와 깨지는 조건을 설명한다.',
    '</FormulaDisclosure>',
    '',
    '## 규격·장비 문서와의 연결',
    '',
    'TODO: normative statement는 Release 17 조항, 계측 동작은 공식 vendor 문서로 연결한다.',
    '',
    '</LessonLayer>',
    '',
    '## 완료 전 자기 설명',
    '',
    '1. 어떤 control이 어느 Signal Spine stage를 직접 바꿨는가?',
    '2. linked view에서 함께 움직인 값은 무엇인가?',
    '3. 결과가 유효한 reference plane, bandwidth, calibration과 convention은 무엇인가?',
    ''
  );

  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  const title = requireSingleLine(options.title, 'title');
  const module = requireSingleLine(options.module, 'module');
  const slug = requireSingleLine(options.slug, 'slug');

  if (!MODULES.has(module)) {
    throw new Error('Unknown module: ' + module);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('--slug must be lowercase kebab-case using a-z, 0-9 and single hyphens.');
  }
  if (title.length > 120) {
    throw new Error('--title must be 120 characters or fewer.');
  }

  const labId = options.labId === undefined ? undefined : requireSingleLine(options.labId, 'lab-id');
  if (labId !== undefined && !LAB_IDS.has(labId)) {
    throw new Error('Unknown --lab-id: ' + labId);
  }

  const outputDirectory = path.resolve(
    process.cwd(),
    options.outputDir ?? 'src/content/lessons'
  );
  const target = path.resolve(outputDirectory, slug + '.mdx');
  if (path.dirname(target) !== outputDirectory) {
    throw new Error('Resolved lesson target escaped the output directory.');
  }

  const order = positiveInteger(
    options.order,
    'order',
    await nextOrder(outputDirectory, module)
  );
  const minutes = positiveInteger(options.minutes, 'minutes', 45);
  const scaffold = buildScaffold({ title, module, slug, order, minutes, labId });
  const canonicalUrl = '/learn/' + slug + '/';

  if (options.dryRun) {
    console.log('Dry run: no files written.');
    console.log('Target: ' + target);
    console.log('Planned canonical URL after status becomes ready: ' + canonicalUrl);
    console.log('');
    console.log(scaffold);
    return;
  }

  await mkdir(outputDirectory, { recursive: true });
  try {
    await writeFile(target, scaffold, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error('Refusing to overwrite existing lesson: ' + target);
    }
    throw error;
  }

  console.log('Created: ' + target);
  console.log('Planned canonical URL after status becomes ready: ' + canonicalUrl);
  console.log('Next: replace TODOs, verify references, set status to ready, then run npm run check:content.');
}

main().catch((error) => {
  console.error('new-lesson: ' + error.message);
  process.exitCode = 1;
});
