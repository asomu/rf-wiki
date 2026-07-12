#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const suites = [
  'examples/mxg_pyvisa/tests',
  'examples/e5080b_pyvisa/tests',
  'examples/n9020b_pyvisa/tests',
  'examples/u2061xa_pyvisa/tests',
  'examples/n6705c_pyvisa/tests',
];

function run(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('python3', args, {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        PYTHONPYCACHEPREFIX: '/tmp/rf-wiki-pycache',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
      },
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`python3 exited with ${code ?? signal}`));
    });
  });
}

for (const suite of suites) {
  await access(resolve(root, suite));
  await run(['-S', '-m', 'unittest', 'discover', '-s', suite, '-v']);
}

console.log(`Python safety suites OK: ${suites.length} instrument packages.`);
