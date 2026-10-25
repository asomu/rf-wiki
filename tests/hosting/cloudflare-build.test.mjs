import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicSiteUrl } from '../../scripts/build-cloudflare.mjs';

test('accepts an https public origin and strips the path', () => {
  assert.equal(validatePublicSiteUrl('https://rf-wiki.pages.dev/'), 'https://rf-wiki.pages.dev');
});

test('requires PUBLIC_SITE_URL', () => {
  assert.throws(() => validatePublicSiteUrl(undefined), /PUBLIC_SITE_URL is required/);
  assert.throws(() => validatePublicSiteUrl(''), /PUBLIC_SITE_URL is required/);
});

test('rejects non-https and local origins', () => {
  assert.throws(() => validatePublicSiteUrl('http://rf-wiki.pages.dev'), /must use https/);
  assert.throws(() => validatePublicSiteUrl('https://localhost:4321'), /local address/);
  assert.throws(() => validatePublicSiteUrl('https://127.0.0.1'), /local address/);
  assert.throws(() => validatePublicSiteUrl('not a url'), /not a valid URL/);
});
