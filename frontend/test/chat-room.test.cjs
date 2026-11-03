const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { build } = require('esbuild');

let ChatRoom;
const calls = [];
const api = {
  listCompetition: async (...args) => { calls.push(['list-competition', ...args]); return { ok: true, data: [{ id: 'a1', authorUsername: 'owner', body: 'Tournament update', createdAt: '2026-11-03T00:00:00Z' }] }; },
  postCompetition: async (...args) => { calls.push(['post-competition', ...args]); return { ok: true, data: { id: 'new', authorUsername: 'alice', body: args[2], createdAt: '2026-11-03T00:00:01Z' } }; },
  listTeam: async (...args) => { calls.push(['list-team', ...args]); return { ok: true, data: [] }; },
  postTeam: async (...args) => { calls.push(['post-team', ...args]); return { ok: true, data: { id: 'team-new', authorUsername: 'alice', body: args[1], createdAt: '2026-11-03T00:00:01Z' } }; },
};

before(async () => {
  globalThis.__chatTestAPI = api;
  const bundle = await build({
    entryPoints: [path.join(__dirname, '../src/components/ChatRoom.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'],
    plugins: [{ name: 'chat-test-dependencies', setup(builder) {
      builder.onResolve({ filter: /services\/api\.js$/ }, () => ({ path: 'api', namespace: 'mock' }));
      builder.onResolve({ filter: /chat-room\.css$/ }, () => ({ path: 'style', namespace: 'mock' }));
      builder.onLoad({ filter: /^api$/, namespace: 'mock' }, () => ({ contents: 'export const ChatAPI = globalThis.__chatTestAPI;' }));
      builder.onLoad({ filter: /^style$/, namespace: 'mock' }, () => ({ contents: '' }));
    } }],
  });
  const loaded = new Module(path.join(__dirname, 'compiled-chat.cjs'), module);
  loaded.filename = path.join(__dirname, 'compiled-chat.cjs'); loaded.paths = module.paths;
  loaded._compile(bundle.outputFiles[0].text, loaded.filename);
  ChatRoom = loaded.exports.default;
});

test('participants can read announcements but cannot compose one', async () => {
  calls.length = 0;
  let tree;
  await act(async () => { tree = create(React.createElement(ChatRoom, { scope: 'competition', id: 'c1', channel: 'announcements', username: 'alice', canPost: false })); });
  assert.deepEqual(calls[0], ['list-competition', 'c1', 'announcements']);
  assert.equal(tree.root.findAllByType('form').length, 0);
  assert.match(tree.root.findByProps({ role: 'log' }).findAllByType('p')[0].children.join(''), /Tournament update/);
  act(() => tree.unmount());
});

test('general and team messages use distinct endpoints', async () => {
  calls.length = 0;
  let tree;
  await act(async () => { tree = create(React.createElement(ChatRoom, { scope: 'competition', id: 'c1', channel: 'general', username: 'alice' })); });
  act(() => tree.root.findByType('textarea').props.onChange({ target: { value: ' Hello all ' } }));
  await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(calls.at(-1), ['post-competition', 'c1', 'general', 'Hello all']);
  act(() => tree.unmount());

  await act(async () => { tree = create(React.createElement(ChatRoom, { scope: 'team', id: 't1', username: 'alice' })); });
  act(() => tree.root.findByType('textarea').props.onChange({ target: { value: 'Private team message' } }));
  await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(calls.at(-1), ['post-team', 't1', 'Private team message']);
  act(() => tree.unmount());
});

test('rate limit errors keep the draft available to retry', async () => {
  const original = api.postCompetition;
  api.postCompetition = async () => ({ ok: false, status: 429, error: 'General chat limit reached. Try again in 30 seconds.' });
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(ChatRoom, { scope: 'competition', id: 'c1', channel: 'general', username: 'alice' })); });
    act(() => tree.root.findByType('textarea').props.onChange({ target: { value: 'Try later' } }));
    await act(async () => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
    assert.equal(tree.root.findByType('textarea').props.value, 'Try later');
    assert.match(tree.root.findByProps({ role: 'alert' }).children.join(''), /30 seconds/);
  } finally { api.postCompetition = original; act(() => tree?.unmount()); }
});
