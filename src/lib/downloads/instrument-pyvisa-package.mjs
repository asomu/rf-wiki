import { readFile, readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { createDeterministicZip, sha256Hex } from './mxg-pyvisa-package.mjs';

const ALLOWED_SOURCE_EXTENSIONS = new Set(['.json', '.md', '.py', '.txt']);

export const INSTRUMENT_PYVISA_PACKAGES = Object.freeze({
  'vna-ena': Object.freeze({
    route: 'vna-ena',
    key: 'e5080b',
    title: 'E5080B PyVISA 예제',
    model: 'Keysight E5080B-2K0',
    identity: 'E5080B',
    packageDirectory: 'examples/e5080b_pyvisa',
    guide: 'docs/E5080B_PYVISA_GUIDE.md',
    archiveName: 'rf-wiki-e5080b-pyvisa.zip',
    archiveRoot: 'rf-wiki-e5080b-pyvisa',
    alias: 'ENA',
    enableFlag: '--rf-on',
    finalStep: 'DUT·path·interlock를 확인한 뒤에만 --rf-on을 별도로 추가합니다.',
    safetySummary: '실제 연결은 --execute, RF source enable은 --rf-on까지 요구합니다. finally에서 OUTP OFF를 query-back합니다.',
  }),
  'sa-mxa': Object.freeze({
    route: 'sa-mxa',
    key: 'n9020b',
    title: 'N9020B PyVISA 예제',
    model: 'Keysight N9020B-526 + B1X + MPB + P26',
    identity: 'N9020B',
    packageDirectory: 'examples/n9020b_pyvisa',
    guide: 'docs/N9020B_PYVISA_GUIDE.md',
    archiveName: 'rf-wiki-n9020b-pyvisa.zip',
    archiveRoot: 'rf-wiki-n9020b-pyvisa',
    alias: 'MXA',
    enableFlag: null,
    finalStep: '외부 coupler/pad/DC block과 input level plan을 확인한 뒤에만 PA RF를 MXA input에 인가하고 single acquisition을 시작합니다.',
    safetySummary: '실제 session은 --execute를 요구합니다. Analyzer software는 이미 입력된 과전력이나 DC를 차단하지 못하므로 물리적 path를 먼저 보호합니다.',
  }),
  'power-sensor': Object.freeze({
    route: 'power-sensor',
    key: 'u2061xa',
    title: 'U2061XA PyVISA 예제',
    model: 'Keysight U2061XA',
    identity: 'U2061XA',
    packageDirectory: 'examples/u2061xa_pyvisa',
    guide: 'docs/U2061XA_PYVISA_GUIDE.md',
    archiveName: 'rf-wiki-u2061xa-pyvisa.zip',
    archiveRoot: 'rf-wiki-u2061xa-pyvisa',
    alias: 'U2061XA',
    enableFlag: null,
    finalStep: 'Upstream RF가 OFF이고 sensor attenuation이 안전한지 확인한 뒤 실제 측정을 시작합니다.',
    safetySummary: '실제 USB session은 --execute를 요구하며, 측정 전 SG RF OFF와 external attenuation 확인을 별도 precondition으로 둡니다.',
  }),
  'power-supply': Object.freeze({
    route: 'power-supply',
    key: 'n6705c',
    title: 'N6705C PyVISA 예제',
    model: 'Keysight N6705C + N6752A-761',
    identity: 'N6705C',
    packageDirectory: 'examples/n6705c_pyvisa',
    guide: 'docs/N6705C_PYVISA_GUIDE.md',
    archiveName: 'rf-wiki-n6705c-pyvisa.zip',
    archiveRoot: 'rf-wiki-n6705c-pyvisa',
    alias: 'N6705C',
    enableFlag: '--output-on',
    finalStep: 'DUT·wiring·protection을 확인한 뒤에만 --output-on을 별도로 추가합니다.',
    safetySummary: '실제 연결은 --execute, DC output enable은 --output-on까지 요구합니다. finally에서 output OFF와 abort를 수행합니다.',
  }),
});

function compareArchivePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function getInstrumentPyvisaPackage(route) {
  return INSTRUMENT_PYVISA_PACKAGES[route];
}

/** Discover an instrument example tree while rejecting symlinks and generated artifacts. */
export async function listInstrumentPyvisaSourceFiles(projectRoot, config) {
  const discovered = [config.guide];
  const packageRoot = resolve(projectRoot, config.packageDirectory);

  async function visit(directory, relativeDirectory = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareArchivePaths(left.name, right.name));
    for (const entry of entries) {
      if (entry.name === '__pycache__' || entry.name === '.DS_Store') continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new TypeError(`${config.identity} package may not contain symlinks: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) throw new TypeError(`Unsupported ${config.identity} package entry: ${relativePath}`);
      if (!ALLOWED_SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        throw new TypeError(`Unexpected ${config.identity} package file type: ${relativePath}`);
      }
      discovered.push(`${config.packageDirectory}/${relativePath}`);
    }
  }

  await visit(packageRoot);
  return Object.freeze(discovered.sort(compareArchivePaths));
}

export async function listInstrumentPyvisaTopLevelFiles(projectRoot, config) {
  const entries = await readdir(resolve(projectRoot, config.packageDirectory), { withFileTypes: true });
  return Object.freeze(entries
    .filter((entry) => entry.isFile() && ALLOWED_SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort(compareArchivePaths));
}

export async function buildInstrumentPyvisaPackage(projectRoot, config) {
  const sourceFiles = await listInstrumentPyvisaSourceFiles(projectRoot, config);
  const entries = await Promise.all(sourceFiles.map(async (sourcePath) => ({
    path: `${config.archiveRoot}/${sourcePath}`,
    data: await readFile(resolve(projectRoot, sourcePath)),
  })));
  const archive = createDeterministicZip(entries);
  const sha256 = sha256Hex(archive);
  const checksumName = `${config.archiveName}.sha256`;
  return {
    archive,
    sha256,
    checksumName,
    checksum: `${sha256}  ${config.archiveName}\n`,
    manifest: Object.freeze(sourceFiles.map((path) => `${config.archiveRoot}/${path}`)),
  };
}
