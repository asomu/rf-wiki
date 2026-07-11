#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { registry as playwrightCoreRegistry } from 'playwright-core/lib/coreBundle';

const root = process.cwd();
const port = 4333;
const origin = `http://127.0.0.1:${port}`;
const executableExtension = process.platform === 'win32' ? '.cmd' : '';
const astro = path.join(root, 'node_modules', '.bin', `astro${executableExtension}`);
const lighthouse = path.join(root, 'node_modules', '.bin', `lighthouse${executableExtension}`);
const outputDirectory = path.join(root, 'output', 'lighthouse');
const headlessShellPath = playwrightCoreRegistry.registry
  .findExecutable('chromium-headless-shell')
  ?.executablePath();

if (!headlessShellPath) {
  throw new Error(
    `Playwright chromium-headless-shell is unavailable. Run ${
      process.platform === 'win32' ? 'npx.cmd' : 'npx'
    } playwright install chromium before the Lighthouse audit.`
  );
}

const routes = [
  { name: 'home-mobile', path: '/' },
  { name: 'spectrum-iq-mobile', path: '/learn/spectrum-iq/' },
  { name: 'nr-resource-grid-mobile', path: '/learn/ofdm-lte-nr/' },
  { name: 'vna-smith-mobile', path: '/learn/vna-smith/' },
  { name: 'pa-load-pull-mobile', path: '/learn/pa-pull/' }
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: options.stdio ?? 'inherit',
      env: options.env ?? process.env
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(command)} exited after signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${path.basename(command)} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready at ${url}`);
}

function percent(score) {
  return Math.round((score ?? 0) * 100);
}

await mkdir(outputDirectory, { recursive: true });

const preview = spawn(astro, ['preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }
});

try {
  await waitForServer(origin);
  const failures = [];

  for (const route of routes) {
    const reportBase = path.join(outputDirectory, route.name);
    await run(
      lighthouse,
      [
        `${origin}${route.path}`,
        '--quiet',
        '--locale=ko',
        '--only-categories=performance,accessibility',
        '--output=json',
        '--output=html',
        `--output-path=${reportBase}`,
        '--chrome-flags=--headless --disable-gpu --no-sandbox'
      ],
      {
        env: {
          ...process.env,
          // Full Chrome for Testing can stop emitting paint trace events when
          // the macOS GUI session is locked. Playwright's dedicated headless
          // shell is the same version and remains independent of GUI occlusion.
          CHROME_PATH: headlessShellPath
        }
      }
    );

    const report = JSON.parse(await readFile(`${reportBase}.report.json`, 'utf8'));
    const performance = report.categories.performance.score ?? 0;
    const accessibility = report.categories.accessibility.score ?? 0;
    const cls = report.audits['cumulative-layout-shift'].numericValue ?? Number.POSITIVE_INFINITY;

    console.log(
      `${route.path} — Performance ${percent(performance)}, Accessibility ${percent(accessibility)}, CLS ${cls.toFixed(4)}`
    );

    if (performance < 0.9) failures.push(`${route.path}: Performance ${percent(performance)} < 90`);
    if (accessibility < 0.95) failures.push(`${route.path}: Accessibility ${percent(accessibility)} < 95`);
    if (cls > 0.1) failures.push(`${route.path}: CLS ${cls.toFixed(4)} > 0.1`);
  }

  if (failures.length > 0) {
    throw new Error(`Lighthouse gate failed:\n${failures.join('\n')}`);
  }
} finally {
  preview.kill('SIGTERM');
}
