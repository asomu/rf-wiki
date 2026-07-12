import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { APIRoute } from 'astro';
import {
  buildMxgPyvisaPackage,
  MXG_PYVISA_ARCHIVE_NAME,
  MXG_PYVISA_CHECKSUM_NAME,
} from '../../../../lib/downloads/mxg-pyvisa-package.mjs';

const sourceFiles = [
  'README.md',
  'requirements.txt',
  '__init__.py',
  '__main__.py',
  'cli.py',
  'driver.py',
  'identify_and_options.py',
  'safe_cw_output.py',
  'transport.py',
  'upload_iq_waveform.py',
  'pa_stimulus_sweep.py',
  'waveform.py',
  'workflow.py',
] as const;
const files = [...sourceFiles, MXG_PYVISA_ARCHIVE_NAME, MXG_PYVISA_CHECKSUM_NAME] as const;

export function getStaticPaths() {
  return files.map((file) => ({ params: { file }, props: { file } }));
}

export const GET: APIRoute = async ({ props }) => {
  const file = String(props.file);
  if (!files.includes(file as (typeof files)[number])) return new Response('Not found', { status: 404 });
  if (file === MXG_PYVISA_ARCHIVE_NAME || file === MXG_PYVISA_CHECKSUM_NAME) {
    const bundle = await buildMxgPyvisaPackage(process.cwd());
    const body = file === MXG_PYVISA_ARCHIVE_NAME
      ? new Uint8Array(bundle.archive)
      : bundle.checksum;
    return new Response(body, {
      headers: {
        'Content-Type': file === MXG_PYVISA_ARCHIVE_NAME
          ? 'application/zip'
          : 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  const source = await readFile(resolve(process.cwd(), 'examples/mxg_pyvisa', file));
  const contentType = file.endsWith('.py') ? 'text/x-python; charset=utf-8' : 'text/plain; charset=utf-8';
  return new Response(source, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${file}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
