import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  INSTRUMENT_PYVISA_PACKAGES,
  buildInstrumentPyvisaPackage,
  listInstrumentPyvisaSourceFiles,
} from '../../src/lib/downloads/instrument-pyvisa-package.mjs';
import { extractStoredZip, readStoredZipEntries, sha256Hex } from '../../src/lib/downloads/mxg-pyvisa-package.mjs';

const projectRoot = process.cwd();
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('instrument PyVISA download packages', () => {
  for (const config of Object.values(INSTRUMENT_PYVISA_PACKAGES)) {
    it(`builds a deterministic, complete ${config.identity} package`, async () => {
      const first = await buildInstrumentPyvisaPackage(projectRoot, config);
      const second = await buildInstrumentPyvisaPackage(projectRoot, config);
      expect(first.archive.equals(second.archive)).toBe(true);
      expect(first.sha256).toBe(sha256Hex(first.archive));
      expect(first.checksum).toBe(`${first.sha256}  ${config.archiveName}\n`);

      const entries = readStoredZipEntries(first.archive);
      expect([...entries.keys()].sort()).toEqual([...first.manifest].sort());
      expect(entries.has(`${config.archiveRoot}/${config.guide}`)).toBe(true);
      expect(entries.has(`${config.archiveRoot}/${config.packageDirectory}/README.md`)).toBe(true);
      expect([...entries.keys()].some((path) => path.includes('/tests/test_'))).toBe(true);
      expect([...entries.keys()].every((path) => path.startsWith(`${config.archiveRoot}/`))).toBe(true);

      const temporaryRoot = await mkdtemp(resolve(tmpdir(), `rf-wiki-${config.key}-zip-test-`));
      temporaryRoots.push(temporaryRoot);
      await extractStoredZip(first.archive, temporaryRoot);
      const extractedReadme = await readFile(
        resolve(temporaryRoot, config.archiveRoot, config.packageDirectory, 'README.md'),
        'utf8',
      );
      expect(extractedReadme).toContain(config.identity);
    });

    it(`discovers ${config.identity} sources in a stable order`, async () => {
      const files = await listInstrumentPyvisaSourceFiles(projectRoot, config);
      expect(files).toEqual([...files].sort());
      expect(files[0]).toBe(config.guide);
      expect(files).toContain(`${config.packageDirectory}/driver.py`);
      expect(files).toContain(`${config.packageDirectory}/requirements.txt`);
    });
  }
});
