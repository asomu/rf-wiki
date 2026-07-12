import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import {
  INSTRUMENT_PYVISA_PACKAGES,
  buildInstrumentPyvisaPackage,
  getInstrumentPyvisaPackage,
  listInstrumentPyvisaTopLevelFiles,
} from '../../../../lib/downloads/instrument-pyvisa-package.mjs';

export async function getStaticPaths() {
  const paths = [];
  for (const config of Object.values(INSTRUMENT_PYVISA_PACKAGES)) {
    const sourceFiles = await listInstrumentPyvisaTopLevelFiles(process.cwd(), config);
    const bundle = await buildInstrumentPyvisaPackage(process.cwd(), config);
    const guideFile = config.guide.split('/').at(-1);
    for (const file of [...sourceFiles, ...(guideFile ? [guideFile] : []), config.archiveName, bundle.checksumName]) {
      paths.push({ params: { instrument: config.route, file }, props: { instrument: config.route, file } });
    }
  }
  return paths;
}

export const GET: APIRoute = async ({ props }) => {
  const route = String(props.instrument);
  const file = String(props.file);
  const config = getInstrumentPyvisaPackage(route);
  if (!config) return new Response('Not found', { status: 404 });
  const sourceFiles = await listInstrumentPyvisaTopLevelFiles(process.cwd(), config);
  const bundle = await buildInstrumentPyvisaPackage(process.cwd(), config);
  const guideFile = config.guide.split('/').at(-1);
  const allowed = [...sourceFiles, ...(guideFile ? [guideFile] : []), config.archiveName, bundle.checksumName];
  if (!allowed.includes(file)) return new Response('Not found', { status: 404 });

  if (file === config.archiveName || file === bundle.checksumName) {
    const body = file === config.archiveName ? new Uint8Array(bundle.archive) : bundle.checksum;
    return new Response(body, {
      headers: {
        'Content-Type': file === config.archiveName ? 'application/zip' : 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const source = await readFile(
    file === guideFile
      ? resolve(process.cwd(), config.guide)
      : resolve(process.cwd(), config.packageDirectory, file),
  );
  const contentType = file.endsWith('.py') ? 'text/x-python; charset=utf-8' : 'text/plain; charset=utf-8';
  return new Response(source, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${file}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
