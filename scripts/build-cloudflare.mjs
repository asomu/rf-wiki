import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const localhostPattern = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i;

/** Validates the public origin Cloudflare Pages builds must embed in canonical/og URLs. */
export function validatePublicSiteUrl(value) {
  if (!value) {
    throw new Error('PUBLIC_SITE_URL is required for the Cloudflare build (e.g. https://rf-wiki.pages.dev).');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`PUBLIC_SITE_URL is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`PUBLIC_SITE_URL must use https: ${value}`);
  }
  if (localhostPattern.test(url.origin)) {
    throw new Error(`PUBLIC_SITE_URL must not be a local address: ${value}`);
  }
  return url.origin;
}

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
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

async function main() {
  const origin = validatePublicSiteUrl(process.env.PUBLIC_SITE_URL);
  await run('npm', ['run', 'build'], { PUBLIC_SITE_URL: origin, ASTRO_TELEMETRY_DISABLED: '1' });

  for (const file of ['index.html', '404.html', '_headers', 'pagefind/pagefind.js']) {
    try {
      await access(resolve(dist, file));
    } catch {
      throw new Error(`Cloudflare build is missing dist/${file}`);
    }
  }

  const homeHtml = await readFile(resolve(dist, 'index.html'), 'utf8');
  if (localhostPattern.test(homeHtml)) {
    throw new Error('Cloudflare build must not publish a localhost canonical or og:image URL.');
  }
  if (!homeHtml.includes(`${origin}/og.png`)) {
    throw new Error(`Cloudflare build home page does not reference ${origin}/og.png.`);
  }

  console.log(`Cloudflare Pages build ready in dist/ for ${origin}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
