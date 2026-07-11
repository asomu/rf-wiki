import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../worker/index.js';

function createAssetBinding(response = new Response('asset', { status: 200 })) {
  const requests = [];
  return {
    requests,
    binding: {
      async fetch(request) {
        requests.push(request);
        return response.clone();
      }
    }
  };
}

test('forwards static lesson and Pagefind requests to the ASSETS binding', async () => {
  const assets = createAssetBinding();
  const lessonRequest = new Request('https://rf-wiki.example/learn/spectrum-iq/');
  const pagefindRequest = new Request('https://rf-wiki.example/pagefind/pagefind.js');

  assert.equal((await worker.fetch(lessonRequest, { ASSETS: assets.binding })).status, 200);
  assert.equal((await worker.fetch(pagefindRequest, { ASSETS: assets.binding })).status, 200);
  assert.deepEqual(
    assets.requests.map((request) => new URL(request.url).pathname),
    ['/learn/spectrum-iq/', '/pagefind/pagefind.js']
  );
});

test('preserves the asset binding response and supports HEAD', async () => {
  const assets = createAssetBinding(new Response(null, {
    status: 404,
    headers: { 'cache-control': 'public, max-age=60' }
  }));
  const response = await worker.fetch(
    new Request('https://rf-wiki.example/missing', { method: 'HEAD' }),
    { ASSETS: assets.binding }
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
});

test('rejects write methods and reports a missing asset binding', async () => {
  const rejected = await worker.fetch(
    new Request('https://rf-wiki.example/', { method: 'POST' }),
    {}
  );
  const missing = await worker.fetch(new Request('https://rf-wiki.example/'), {});

  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('allow'), 'GET, HEAD');
  assert.equal(missing.status, 500);
});
