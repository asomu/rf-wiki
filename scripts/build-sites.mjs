import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildMxgPyvisaPackage,
  extractStoredZip,
  MXG_PYVISA_ARCHIVE_NAME,
  MXG_PYVISA_CHECKSUM_NAME,
  MXG_PYVISA_ROOT,
  readStoredZipEntries,
  sha256Hex,
} from '../src/lib/downloads/mxg-pyvisa-package.mjs';
import {
  INSTRUMENT_PYVISA_PACKAGES,
  buildInstrumentPyvisaPackage,
} from '../src/lib/downloads/instrument-pyvisa-package.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const server = resolve(dist, 'server');
const metadata = resolve(dist, '.openai');
const astroCli = resolve(root, 'node_modules/astro/bin/astro.mjs');
const pagefindCli = resolve(root, 'node_modules/pagefind/lib/runner/bin.cjs');

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...options.env },
      stdio: options.stdio ?? 'inherit'
    });

    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function requireFile(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`Sites build is missing ${label}: ${path}`);
  }
}

await rm(dist, { recursive: true, force: true });
await run(process.execPath, [astroCli, 'build', '--outDir', client]);
await run(process.execPath, [pagefindCli, '--site', client]);

await Promise.all([
  mkdir(server, { recursive: true }),
  mkdir(metadata, { recursive: true })
]);
await Promise.all([
  copyFile(resolve(root, 'worker/index.js'), resolve(server, 'index.js')),
  copyFile(resolve(root, '.openai/hosting.json'), resolve(metadata, 'hosting.json'))
]);

await Promise.all([
  requireFile(resolve(client, 'index.html'), 'client/index.html'),
  requireFile(resolve(client, 'learn/spectrum-iq/index.html'), 'Spectrum/IQ lesson'),
  requireFile(resolve(client, 'instruments/sg-mxg/index.html'), 'MXG instrument hub'),
  requireFile(resolve(client, 'instruments/sg-mxg/scpi-pyvisa/index.html'), 'MXG SCPI lesson'),
  requireFile(resolve(client, 'instruments/sg-mxg/python-examples/driver.py'), 'downloadable MXG Python driver'),
  requireFile(resolve(client, 'instruments/sg-mxg/python-examples', MXG_PYVISA_ARCHIVE_NAME), 'complete MXG Python ZIP'),
  requireFile(resolve(client, 'instruments/sg-mxg/python-examples', MXG_PYVISA_CHECKSUM_NAME), 'MXG Python ZIP checksum'),
  requireFile(resolve(client, 'cellular/index.html'), '3GPP/PAMiD learning map'),
  requireFile(resolve(client, 'cellular/gsm/tdma-frame-timeslots/index.html'), 'GSM timeslot lesson'),
  requireFile(resolve(client, 'cellular/lte/bandwidth-rb-location/index.html'), 'LTE resource lesson'),
  requireFile(resolve(client, 'cellular/nr/100mhz-rb100-location0/index.html'), 'NR allocation lesson'),
  requireFile(resolve(client, 'cellular/diagnostics/evm-fail/index.html'), 'PAMiD EVM diagnostic lesson'),
  requireFile(resolve(client, 'pagefind/pagefind.js'), 'Pagefind runtime'),
  requireFile(resolve(server, 'index.js'), 'server/index.js'),
  requireFile(resolve(metadata, 'hosting.json'), '.openai/hosting.json')
]);

const instrumentRequiredRoutes = [
  ['sa-mxa', 'sa-scpi-measurements'],
  ['vna-ena', 'vna-scpi-data'],
  ['power-sensor', 'sensor-scpi-trigger'],
  ['power-supply', 'psu-scpi-sequence'],
];
await Promise.all(instrumentRequiredRoutes.flatMap(([route, scpiChapter]) => {
  const config = INSTRUMENT_PYVISA_PACKAGES[route];
  if (!config) throw new Error(`Missing PyVISA package config for ${route}`);
  const exampleRoot = resolve(client, 'instruments', route, 'python-examples');
  return [
    requireFile(resolve(client, 'instruments', route, 'index.html'), `${config.identity} instrument hub`),
    requireFile(resolve(client, 'instruments', route, scpiChapter, 'index.html'), `${config.identity} SCPI lesson`),
    requireFile(resolve(exampleRoot, 'driver.py'), `downloadable ${config.identity} Python driver`),
    requireFile(resolve(exampleRoot, config.archiveName), `${config.identity} Python ZIP`),
    requireFile(resolve(exampleRoot, `${config.archiveName}.sha256`), `${config.identity} ZIP checksum`),
  ];
}));

const mxgArchivePath = resolve(client, 'instruments/sg-mxg/python-examples', MXG_PYVISA_ARCHIVE_NAME);
const mxgChecksumPath = resolve(client, 'instruments/sg-mxg/python-examples', MXG_PYVISA_CHECKSUM_NAME);
const mxgArchive = await readFile(mxgArchivePath);
const mxgChecksum = (await readFile(mxgChecksumPath, 'utf8')).trim();
const expectedMxgPackage = await buildMxgPyvisaPackage(root);
const expectedChecksumLine = `${sha256Hex(mxgArchive)}  ${MXG_PYVISA_ARCHIVE_NAME}`;
if (mxgChecksum !== expectedChecksumLine) {
  throw new Error(`MXG Python ZIP checksum mismatch: expected ${expectedChecksumLine}, received ${mxgChecksum}`);
}
if (!mxgArchive.equals(expectedMxgPackage.archive)) {
  throw new Error('MXG Python ZIP is not a byte-for-byte deterministic build of the current source tree.');
}

const mxgEntries = readStoredZipEntries(mxgArchive);
const actualMxgManifest = [...mxgEntries.keys()].sort();
const expectedMxgManifest = [...expectedMxgPackage.manifest].sort();
if (JSON.stringify(actualMxgManifest) !== JSON.stringify(expectedMxgManifest)) {
  throw new Error(
    `MXG Python ZIP manifest mismatch.\nExpected: ${expectedMxgManifest.join(', ')}\nActual: ${actualMxgManifest.join(', ')}`
  );
}

const mxgVerificationRoot = await mkdtemp(resolve(tmpdir(), 'rf-wiki-mxg-download-'));
try {
  await extractStoredZip(mxgArchive, mxgVerificationRoot);
  const extractedPackage = resolve(mxgVerificationRoot, MXG_PYVISA_ROOT);
  const offlinePython = {
    cwd: extractedPackage,
    env: { PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1' },
  };
  await run('python3', ['-S', '-m', 'examples.mxg_pyvisa'], offlinePython);
  await run(
    'python3',
    ['-S', '-m', 'unittest', 'discover', '-s', 'examples/mxg_pyvisa/tests', '-v'],
    offlinePython,
  );
} finally {
  await rm(mxgVerificationRoot, { recursive: true, force: true });
}

for (const config of Object.values(INSTRUMENT_PYVISA_PACKAGES)) {
  const downloadRoot = resolve(client, 'instruments', config.route, 'python-examples');
  const archivePath = resolve(downloadRoot, config.archiveName);
  const checksumPath = resolve(downloadRoot, `${config.archiveName}.sha256`);
  const archive = await readFile(archivePath);
  const checksum = (await readFile(checksumPath, 'utf8')).trim();
  const expectedPackage = await buildInstrumentPyvisaPackage(root, config);
  const expectedChecksumLine = `${sha256Hex(archive)}  ${config.archiveName}`;
  if (checksum !== expectedChecksumLine) {
    throw new Error(`${config.identity} Python ZIP checksum mismatch: expected ${expectedChecksumLine}, received ${checksum}`);
  }
  if (!archive.equals(expectedPackage.archive)) {
    throw new Error(`${config.identity} Python ZIP is not a deterministic build of the current source tree.`);
  }

  const entries = readStoredZipEntries(archive);
  const actualManifest = [...entries.keys()].sort();
  const expectedManifest = [...expectedPackage.manifest].sort();
  if (JSON.stringify(actualManifest) !== JSON.stringify(expectedManifest)) {
    throw new Error(`${config.identity} Python ZIP manifest mismatch.`);
  }

  const verificationRoot = await mkdtemp(resolve(tmpdir(), `rf-wiki-${config.key}-download-`));
  try {
    await extractStoredZip(archive, verificationRoot);
    const extractedPackage = resolve(verificationRoot, config.archiveRoot);
    const offlinePython = {
      cwd: extractedPackage,
      env: { PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1' },
    };
    const moduleName = config.packageDirectory.replaceAll('/', '.');
    await run('python3', ['-S', '-m', moduleName], offlinePython);
    await run(
      'python3',
      ['-S', '-m', 'unittest', 'discover', '-s', `${config.packageDirectory}/tests`, '-v'],
      offlinePython,
    );
  } finally {
    await rm(verificationRoot, { recursive: true, force: true });
  }
}

const hosting = JSON.parse(await readFile(resolve(metadata, 'hosting.json'), 'utf8'));
if (hosting.project_id !== undefined && typeof hosting.project_id !== 'string') {
  throw new TypeError('Sites project_id must be an opaque string when present.');
}

const homeHtml = await readFile(resolve(client, 'index.html'), 'utf8');
if (/https?:\/\/localhost(?::\d+)?/i.test(homeHtml)) {
  throw new Error('Sites build must not publish a localhost canonical URL.');
}

const workerUrl = pathToFileURL(resolve(server, 'index.js'));
workerUrl.searchParams.set('build', `${process.pid}-${Date.now()}`);
const { default: builtWorker } = await import(workerUrl.href);
if (typeof builtWorker?.fetch !== 'function') {
  throw new TypeError('Sites Worker must default-export a fetch handler.');
}

console.log('Sites build ready: static client, Pagefind index, Worker entry, and hosting metadata.');
