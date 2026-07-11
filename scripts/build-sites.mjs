import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const server = resolve(dist, 'server');
const metadata = resolve(dist, '.openai');
const astroCli = resolve(root, 'node_modules/astro/bin/astro.mjs');
const pagefindCli = resolve(root, 'node_modules/pagefind/lib/runner/bin.cjs');

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      stdio: 'inherit'
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
  requireFile(resolve(client, 'pagefind/pagefind.js'), 'Pagefind runtime'),
  requireFile(resolve(server, 'index.js'), 'server/index.js'),
  requireFile(resolve(metadata, 'hosting.json'), '.openai/hosting.json')
]);

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
