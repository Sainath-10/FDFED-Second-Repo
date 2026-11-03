const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

/** Loads the team workflow script into a sandbox with a fake backend. */
function loadWorkflow(serverNotifications) {
  const store = new Map();
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const window = {
    localStorage, addEventListener() {}, dispatchEvent() {}, location: { href: 'http://localhost/' },
    NexusAPI: {
      Notifications: { getForUser: async () => ({ ok: true, data: serverNotifications }) },
      Teams: { getInvites: async () => ({ ok: true, data: [] }) },
    },
  };
  const sandbox = { window, localStorage, console, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, CustomEvent: class {}, document: { addEventListener() {}, querySelector: () => null } };
  sandbox.globalThis = sandbox;
  const source = fs.readFileSync(path.join(__dirname, '../src/vendor/team-workflow.js'), 'utf8');
  vm.runInNewContext(transformSync(source, { format: 'iife', loader: 'js' }).code, sandbox);
  return window.NexusTeamWorkflow;
}

const note = (id, type, extra = {}) => ({ id, toUsername: 'cap_meera', type, status: 'pending', title: type, body: 'Body', read: false, createdAt: '2026-11-03T18:00:00.000Z', meta: { compId: 'c1' }, ...extra });

test('payouts, refunds and revenue releases reach the notifications page as updates', async () => {
  const workflow = loadWorkflow([
    note('n1', 'winner-payout', { body: 'Your share: ₹650', meta: { compId: 'c1', category: 'payment' } }),
    note('n2', 'registration-refunded', { body: 'Mock: Your registration fee was refunded' }),
    note('n3', 'organizer-revenue-released'),
    note('n4', 'team-invite'),
    note('n5', 'some-unrelated-type'),
    note('n6', 'competition-live', { title: 'Competition live' }),
    note('n7', 'competition-live', { title: 'Your competition "Cup" is live' }),
  ]);
  assert.equal(await workflow.syncServerNotifications('cap_meera'), true);
  const items = JSON.parse(JSON.stringify(workflow.getNotificationsForUser('cap_meera')));
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.deepEqual(Object.keys(byId).sort(), ['n1', 'n2', 'n3', 'n4', 'n7']); // n6 is the old duplicate "live" notice
  for (const id of ['n1', 'n2', 'n3']) assert.equal(byId[id].status, 'info', `${id} must not look like a pending request`);
  assert.equal(byId.n2.body, 'Your registration fee was refunded'); // legacy "Mock: " prefix stripped
  assert.equal(byId.n4.status, 'pending'); // team invites still await an answer
  // A second sync adds nothing new.
  assert.equal(await workflow.syncServerNotifications('cap_meera'), false);
});
