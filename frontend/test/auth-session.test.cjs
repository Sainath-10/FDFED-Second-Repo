const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function loadService(file, api) {
  globalThis.__sessionTestAPI = api;
  const bundle = await build({
    entryPoints: [path.join(__dirname, '../src/services', file)], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'session-api', setup(builder) {
      builder.onResolve({ filter: /\/api\.js$/ }, () => ({ path: 'api', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const { AuthAPI, getUser, getToken, makeRequest, setUser } = globalThis.__sessionTestAPI;' }));
    } }],
  });
  const loaded = new Module(path.join(__dirname, 'compiled-session.cjs'), module);
  loaded.filename = path.join(__dirname, 'compiled-session.cjs'); loaded.paths = module.paths;
  loaded._compile(bundle.outputFiles[0].text, loaded.filename);
  return loaded.exports;
}

test('a matching demo account cannot bypass a rejected or offline backend login', async () => {
  const values = new Map();
  global.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  global.window = { localStorage: global.localStorage };
  for (const status of [401, 0]) {
    let logouts = 0;
    const auth = await loadService('auth.js', { AuthAPI: { login: async () => ({ ok: false, status, error: 'Rejected' }), logout: () => logouts++ }, getUser: () => null, getToken: () => null });
    values.set('nexus.auth.session', JSON.stringify({ username: 'regular1' }));
    const result = await auth.login({ username: 'regular1', password: 'nexus' });
    assert.equal(result.ok, false);
    assert.equal(logouts, 1);
    assert.equal(values.has('nexus.auth.session'), false);
    if (status === 0) assert.match(result.error, /Cannot reach/);
  }
});

test('forced verification checks never treat cached verification as a valid expired session', async () => {
  let response = { ok: true, data: { verificationStatus: 'verified' } };
  const { VerificationAPI } = await loadService('verificationApi.js', { getUser: () => ({ username: 'alice' }), setUser: () => {}, makeRequest: async () => response });
  await VerificationAPI.status(true);
  response = { ok: false, status: 401 };
  assert.equal((await VerificationAPI.status(true)).status, 401);
  assert.equal((await VerificationAPI.status()).status, 401);
  response = { ok: true, data: { verificationStatus: 'verified' } };
  await VerificationAPI.status(true);
  response = { ok: false, status: 0 };
  assert.equal((await VerificationAPI.status(true)).ok, false);
});
