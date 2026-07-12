#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const instruments = Object.freeze({
  n5182b: {
    instrumentId: 'keysight-n5182b',
    label: 'Keysight N5182B MXG',
    equipment: 'RF Off에서 시작하는 vector signal generator',
    analyzer: 'Calibrated power sensor 또는 signal analyzer',
    reference: {
      title: 'X-Series Signal Generators SCPI Command Reference, N5180-90057',
      url: 'https://www.keysight.com/gb/en/assets/9018-03690/programming-guides/9018-03690.pdf',
    },
    chapters: {
      'safe-cw': ['mxg-safe-cw', 45],
      'waveform-iq': ['mxg-waveform-iq', 55],
      'arb-playback': ['mxg-arb-playback', 60],
      'scpi-pyvisa': ['mxg-scpi-pyvisa', 75],
      'pa-test-program': ['mxg-pa-test-program', 80],
    },
  },
  n9020b: {
    instrumentId: 'keysight-n9020b',
    label: 'Keysight N9020B-526 MXA',
    equipment: '외부 attenuation과 safe front-end state에서 시작하는 signal analyzer',
    analyzer: 'N9020B swept spectrum, IQ acquisition과 power-measurement application',
    reference: {
      title: 'N9020B MXA Signal Analyzer Specifications, 9018-04846',
      url: 'https://www.keysight.com/zz/en/assets/9018-04846/technical-specifications/9018-04846.pdf',
    },
    chapters: {
      'safe-input': ['mxa-safe-input', 55],
      'sweep-rbw-detector': ['mxa-sweep-rbw', 75],
      'iq-capture-trigger': ['mxa-iq-trigger', 75],
      'sa-scpi-measurements': ['mxa-scpi-measurements', 90],
      'pa-spectrum-analysis': ['mxa-pa-analysis', 90],
    },
  },
  e5080b: {
    instrumentId: 'keysight-e5080b',
    label: 'Keysight E5080B-2K0 ENA',
    equipment: 'Source Off와 낮은 power limit에서 시작하는 2-port VNA',
    analyzer: 'E5080B coherent receiver와 외부 power sensor',
    reference: {
      title: 'E5080B / E5081A ENA Vector Network Analyzer Help',
      url: 'https://helpfiles.keysight.com/csg/e5080b/index.htm',
    },
    chapters: {
      'safe-sweep': ['ena-safe-sweep', 55],
      'calibration-reference-plane': ['ena-calibration', 70],
      'sparameters-smith-time': ['ena-sparameters', 75],
      'vna-scpi-data': ['ena-scpi-data', 80],
      'pa-characterization': ['ena-pa-characterization', 85],
    },
  },
  u2061xa: {
    instrumentId: 'keysight-u2061xa',
    label: 'Keysight U2061XA Power Sensor',
    equipment: 'USB peak/average power sensor와 충분한 외부 attenuation',
    analyzer: 'U2061XA detector, trigger와 acquisition path',
    reference: {
      title: '2050/60 X-Series SCPI Programming Guide',
      url: 'https://www.keysight.com/us/en/assets/9018-04755/programming-guides/9018-04755.pdf',
    },
    chapters: {
      'safe-power': ['sensor-safe-power', 50],
      'average-peak-burst': ['sensor-average-peak', 65],
      'correction-uncertainty': ['sensor-correction', 70],
      'sensor-scpi-trigger': ['sensor-scpi-trigger', 75],
      'pa-power-budget': ['sensor-pa-power-budget', 80],
    },
  },
  n6705c: {
    instrumentId: 'keysight-n6705c',
    label: 'Keysight N6705C + N6752A-761',
    equipment: 'Output Off, protection과 hardware interlock에서 시작하는 DC source',
    analyzer: 'N6752A voltage/current readback와 RF power sensor',
    reference: {
      title: 'N6700 Modular Power System Programmer’s Reference',
      url: 'https://www.keysight.com/zz/en/assets/9018-03617/programming-guides/9018-03617.pdf',
    },
    chapters: {
      'safe-bias': ['psu-safe-bias', 55],
      'cv-cc-protection': ['psu-cv-cc', 65],
      'remote-sense-wiring': ['psu-remote-sense', 70],
      'psu-scpi-sequence': ['psu-scpi-sequence', 85],
      'pa-dc-power': ['psu-pa-dc-power', 85],
    },
  },
});

const help = `RF Wiki instrument lesson scaffold

Usage:
  node scripts/new-instrument-lesson.mjs --instrument <id> --chapter <chapter> --title "질문형 제목" [--dry-run]

Instruments:
  ${Object.keys(instruments).join(' | ')}

The canonical chapter filenames are fixed. Existing files are never overwritten.`;

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') result.help = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg === '--instrument' || arg === '--chapter' || arg === '--title' || arg === '--output-dir') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      result[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) {
    throw new Error(`--${name} must be a non-empty single line.`);
  }
  return value.trim();
}

function scaffold(title, instrumentKey, instrument, chapter, definition) {
  const [labId, minutes] = definition;
  const chapterOrder = Object.keys(instrument.chapters).indexOf(chapter) + 1;
  return `---
title: ${JSON.stringify(title)}
description: "TODO: 장비 state 변화와 물리 결과를 연결하는 한 문장"
instrumentId: ${JSON.stringify(instrument.instrumentId)}
chapter: ${JSON.stringify(chapter)}
order: ${chapterOrder}
estimatedMinutes: ${minutes}
prerequisites: []
outcomes:
  - ${JSON.stringify(`${title}의 control, SCPI state와 물리 결과를 설명할 수 있다.`)}
concepts:
  - ${JSON.stringify(chapter)}
equipmentContext:
  source: ${JSON.stringify(`${instrument.label} · ${instrument.equipment}`)}
  dut: "50 Ω termination 또는 connectorized PA"
  analyzer: ${JSON.stringify(instrument.analyzer)}
references:
  - title: ${JSON.stringify(instrument.reference.title)}
    organization: "Keysight Technologies"
    url: ${JSON.stringify(instrument.reference.url)}
    kind: "vendor"
labId: ${JSON.stringify(labId)}
status: "draft"
---

import LessonLayer from '../../../components/astro/LessonLayer.astro';
import InstrumentLab from '../../../components/astro/InstrumentLab.astro';
import Definition from '../../../components/astro/Definition.astro';
import FormulaDisclosure from '../../../components/astro/FormulaDisclosure.astro';
import MeasurementNote from '../../../components/astro/MeasurementNote.astro';

TODO: ${instrumentKey} 교육 모델의 범위와 첫 mental model을 작성한다.

<LessonLayer level="intuition" title="TODO: 직관 질문">

TODO: 핵심 직관

<InstrumentLab labId=${JSON.stringify(labId)} />

</LessonLayer>

<LessonLayer level="bench" title="TODO: 조작·해석 질문">

TODO: front panel, SCPI, query-back, error와 안전 종료

</LessonLayer>

<LessonLayer level="theory" title="TODO: 수식·규격 질문">

TODO: 식, convention, model·firmware·option 범위와 공식 reference

</LessonLayer>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(help);
    return;
  }
  const instrumentKey = requireText(options.instrument ?? 'n5182b', 'instrument');
  const instrument = instruments[instrumentKey];
  if (!instrument) throw new Error(`Unknown instrument: ${instrumentKey}`);
  const chapter = requireText(options.chapter, 'chapter');
  const title = requireText(options.title, 'title');
  const definition = instrument.chapters[chapter];
  if (!definition) throw new Error(`Unknown ${instrumentKey} chapter: ${chapter}`);
  const outputDirectory = path.resolve(process.cwd(), options.outputDir ?? `src/content/instruments/${instrumentKey}`);
  const target = path.resolve(outputDirectory, `${chapter}.mdx`);
  if (path.dirname(target) !== outputDirectory) throw new Error('Resolved target escaped the output directory.');
  const content = scaffold(title, instrumentKey, instrument, chapter, definition);
  if (options.dryRun) {
    console.log(`Dry run: ${target}\n\n${content}`);
    return;
  }
  await mkdir(outputDirectory, { recursive: true });
  try {
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite existing chapter: ${target}`);
    throw error;
  }
  console.log(`Created: ${target}`);
  console.log('Replace TODOs, set status to ready, then run npm run check:content.');
}

main().catch((error) => {
  console.error(`new-instrument-lesson: ${error.message}`);
  process.exitCode = 1;
});
