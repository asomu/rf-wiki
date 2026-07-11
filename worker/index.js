/** Cloudflare Worker entry point for the static RF Wiki Sites build. */
const allowedMethods = new Set(['GET', 'HEAD']);

const worker = {
  async fetch(request, env) {
    if (!allowedMethods.has(request.method)) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' }
      });
    }

    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Static asset binding is unavailable.', { status: 500 });
    }

    return env.ASSETS.fetch(request);
  }
};

export default worker;
