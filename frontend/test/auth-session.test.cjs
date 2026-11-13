const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function loadService(api) {
  globalThis.__sessionTestAPI = api;
  const bundle = await build({
    entryPoints: [path.join(__dirname, '../src/services/auth.js')], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'session-api', setup(builder) {
      builder.onResolve({ filter: /\/api\.js$/ }, () => ({ path: 'api', namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const { AuthAPI, getUser, getToken, setUser } = globalThis.__sessionTestAPI;' }));
    } }],
  });
  const loaded = new Module(path.join(__dirname, 'compiled-session.cjs'), module);
  loaded.paths = module.paths;
  loaded._compile(bundle.outputFiles[0].text, loaded.id);
  return loaded.exports;
}

function storage() {
  const values = new Map();
  global.localStorage = { getItem: (k) => (values.has(k) ? values.get(k) : null), setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  global.window = { localStorage: global.localStorage };
  global.sessionStorage = { removeItem() {} };
  return values;
}

test('a rejected or offline login never leaves a session behind', async () => {
  const values = storage();
  for (const status of [401, 0]) {
    let logouts = 0;
    const auth = await loadService({ AuthAPI: { login: async () => ({ ok: false, status, error: 'Rejected' }), logout: () => logouts++ }, getUser: () => null, getToken: () => null });
    values.set('nexus.auth.session', JSON.stringify({ username: 'regular1', role: 'participant' }));
    const result = await auth.login({ username: 'regular1', password: 'nexus' });
    assert.equal(result.ok, false);
    assert.equal(logouts, 1);
    assert.equal(values.has('nexus.auth.session'), false);
    if (status === 0) assert.match(result.error, /Cannot reach/);
  }
});

test('the old plain-text account store is wiped on load', async () => {
  const values = storage();
  values.set('nexus.auth.accounts', JSON.stringify([{ username: 'x', password: 'secret' }]));
  await loadService({ AuthAPI: {}, getUser: () => null, getToken: () => null });
  assert.equal(values.has('nexus.auth.accounts'), false);
});

test('a session exists only while a token exists, and roles come from the server', async () => {
  storage();
  let token = null;
  const auth = await loadService({ AuthAPI: {}, getUser: () => ({ id: 'u1', username: 'alice', role: 'super_admin', email: 'a@x.gg' }), getToken: () => token });
  assert.equal(auth.getSession(), null);
  token = 'jwt';
  const session = auth.getSession();
  assert.equal(session.username, 'alice');
  assert.equal(session.role, 'super-admin');
});

test('a successful login stores the server user and picks the role home', async () => {
  storage();
  const auth = await loadService({
    AuthAPI: { login: async () => ({ ok: true, data: { user: { id: 'u2', username: 'bob', role: 'admin', email: 'b@x.gg' } } }) },
    getUser: () => null, getToken: () => 'jwt',
  });
  const result = await auth.login({ username: 'bob', password: 'pw', roleRoutes: { admin: '/pages/admin/dashboard.html' } });
  assert.equal(result.ok, true);
  assert.equal(result.redirectPath, '/pages/admin/dashboard.html');
  assert.equal(result.user.role, 'admin');
});
