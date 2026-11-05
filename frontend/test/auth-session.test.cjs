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

test('retired verification fields are removed without losing the account session', async () => {
  const values = new Map();
  global.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  global.window = { localStorage: global.localStorage };
  const auth = await loadService('auth.js', { AuthAPI: { getCurrentUser: () => null }, getUser: () => null, getToken: () => null });
  values.set('nexus.auth.session', JSON.stringify({ username: 'alice', role: 'participant', verificationStatus: 'verified', organizerVerificationStatus: 'verified', verifiedAt: '2026-01-01', aadhaarMasked: 'obsolete' }));
  const session = auth.getSession();
  assert.equal(session.username, 'alice');
  assert.equal(session.role, 'participant');
  for (const field of ['verificationStatus', 'organizerVerificationStatus', 'verifiedAt', 'aadhaarMasked']) {
    assert.equal(Object.hasOwn(session, field), false);
    assert.equal(Object.hasOwn(JSON.parse(values.get('nexus.auth.session')), field), false);
  }
});
