import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMxgPyvisaPackage,
  extractStoredZip,
  listMxgPyvisaSourceFiles,
  MXG_PYVISA_ARCHIVE_NAME,
  MXG_PYVISA_ROOT,
  readStoredZipEntries,
  sha256Hex,
} from '../../src/lib/downloads/mxg-pyvisa-package.mjs';

function runExtractedPython(packageRoot: string, args: readonly string[]) {
  return spawnSync('python3', ['-S', ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONNOUSERSITE: '1',
    },
  });
}

describe('MXG PyVISA download package', () => {
  it('builds one byte-for-byte deterministic ZIP with the exact rooted manifest and checksum', async () => {
    const first = await buildMxgPyvisaPackage(process.cwd());
    const second = await buildMxgPyvisaPackage(process.cwd());

    expect(first.archive.equals(second.archive)).toBe(true);
    expect(first.sha256).toBe(sha256Hex(first.archive));
    expect(first.checksum).toBe(`${first.sha256}  ${MXG_PYVISA_ARCHIVE_NAME}\n`);

    const archivePaths = [...readStoredZipEntries(first.archive).keys()];
    expect(archivePaths).toEqual(first.manifest);
    expect(first.manifest).toEqual(second.manifest);
    expect(archivePaths.every((path) => path.startsWith(`${MXG_PYVISA_ROOT}/`))).toBe(true);
    expect(archivePaths).toContain(`${MXG_PYVISA_ROOT}/docs/MXG_PYVISA_GUIDE.md`);
    expect(archivePaths).toEqual(expect.arrayContaining([
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/identify_and_options.py`,
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/safe_cw_output.py`,
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/upload_iq_waveform.py`,
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/pa_stimulus_sweep.py`,
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/tests/test_examples.py`,
      `${MXG_PYVISA_ROOT}/examples/mxg_pyvisa/tests/test_workflow.py`,
    ]));
  });

  it('extracts into one package root whose dry-run and tests pass with site packages disabled', async () => {
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'rf-wiki-mxg-test-'));
    try {
      const bundle = await buildMxgPyvisaPackage(process.cwd());
      const extractedPaths = await extractStoredZip(bundle.archive, temporaryRoot);
      expect(extractedPaths).toEqual(bundle.manifest);

      const packageRoot = resolve(temporaryRoot, MXG_PYVISA_ROOT);
      const dryRun = runExtractedPython(packageRoot, ['-m', 'examples.mxg_pyvisa']);
      expect(dryRun.status, `${dryRun.stdout}\n${dryRun.stderr}`).toBe(0);
      expect(dryRun.stdout).toContain('DRY RUN: no VISA session will be opened');
      expect(dryRun.stdout).toContain('Session complete; RF OFF was confirmed');

      const tests = runExtractedPython(packageRoot, [
        '-m',
        'unittest',
        'discover',
        '-s',
        'examples/mxg_pyvisa/tests',
        '-v',
      ]);
      expect(tests.status, `${tests.stdout}\n${tests.stderr}`).toBe(0);
      expect(`${tests.stdout}\n${tests.stderr}`).toContain('OK');
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('discovers every allowed source under examples/mxg_pyvisa recursively', async () => {
    const sourceFiles = await listMxgPyvisaSourceFiles(process.cwd());
    expect(sourceFiles[0]).toBe('docs/MXG_PYVISA_GUIDE.md');
    expect(sourceFiles).toContain('examples/mxg_pyvisa/tests/test_cli.py');
    expect(sourceFiles).toContain('examples/mxg_pyvisa/tests/test_workflow.py');
    expect(new Set(sourceFiles).size).toBe(sourceFiles.length);
  });
});
