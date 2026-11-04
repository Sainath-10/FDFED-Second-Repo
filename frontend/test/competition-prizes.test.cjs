const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

/** Loads the browser data script into a sandbox with a minimal window/localStorage. */
function loadNexusData() {
  const store = new Map();
  const window = {
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    addEventListener() {}, dispatchEvent() {}, location: { href: 'http://localhost/' },
  };
  const sandbox = { window, localStorage: window.localStorage, console, Date, JSON, Math, Number, String, Array, Object, Map, Set, Intl, CustomEvent: class {}, document: { addEventListener() {}, querySelector: () => null } };
  sandbox.globalThis = sandbox;
  const source = fs.readFileSync(path.join(__dirname, '../src/vendor/competitions-data.js'), 'utf8');
  const { code } = transformSync(source, { format: 'iife', loader: 'js' });
  vm.runInNewContext(code, sandbox);
  window.NexusData.__setApi = (api) => { window.NexusAPI = api; };
  return window.NexusData;
}

// Objects created inside the sandbox have another realm's prototypes; compare plain copies.
const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const apiComp = {
  id: 'c1', name: 'Monsoon Cup', status: 'active', createdBy: 'org', prize: 10000,
  prizeDistributionMinor: [600000, 300000, 100000], paymentStatus: 'OPEN_FOR_REGISTRATION', prizePoolPaid: true,
};

test('prize breakdown comes from the server distribution, not the total', () => {
  const { mapApiCompetition } = loadNexusData();
  const mapped = mapApiCompetition(apiComp);
  assert.deepEqual(plain(mapped.prizes), [
    { place: '1st Place', amount: '₹6,000' },
    { place: '2nd Place', amount: '₹3,000' },
    { place: '3rd Place', amount: '₹1,000' },
  ]);
});

test('winner-takes-all and legacy competitions', () => {
  const { mapApiCompetition } = loadNexusData();
  assert.deepEqual(plain(mapApiCompetition({ ...apiComp, prizeDistributionMinor: [1000000] }).prizes), [{ place: '1st Place', amount: '₹10,000' }]);
  assert.equal(mapApiCompetition({ ...apiComp, prizeDistributionMinor: [] }).prizes, undefined);
});

test('a stale cached copy cannot hide fresh server prize and payment data', () => {
  const { mapApiCompetition, mergeCompetitions } = loadNexusData();
  const stale = { id: 'c1', name: 'Monsoon Cup', prizes: [{ place: '1st Place', amount: '₹10,000' }], paymentStatus: 'AWAITING_PLATFORM_FEE', prizePoolPaid: false, teams: [{ name: 'Local team' }] };
  const [merged] = mergeCompetitions([stale], [mapApiCompetition(apiComp)]);
  assert.equal(merged.prizes.length, 3);
  assert.equal(merged.paymentStatus, 'OPEN_FOR_REGISTRATION');
  assert.equal(merged.prizePoolPaid, true);
  assert.equal(merged.teams[0].name, 'Local team'); // non-server fields still come from the local copy
});

test('a cancelled competition stops showing as live', async () => {
  const data = loadNexusData();
  const { mapApiCompetition, mergeCompetitions, isClosedCompetition, isCancelledCompetition } = data;
  const staleActive = { id: 'c1', name: 'Monsoon Cup', status: 'active', badge: 'Active', badgeClass: 'live', paymentStatus: 'OPEN_FOR_REGISTRATION', backendSynced: true };
  const cancelled = mapApiCompetition({ ...apiComp, status: 'cancelled', paymentStatus: 'REFUND_ISSUED', abandonedReason: 'Venue unavailable' });
  assert.equal(cancelled.badge, 'Cancelled');
  const [merged] = mergeCompetitions([staleActive], [cancelled]);
  assert.equal(merged.status, 'cancelled');
  assert.equal(merged.badge, 'Cancelled');
  assert.equal(merged.badgeClass, 'cancelled');
  assert.equal(merged.abandonedReason, 'Venue unavailable');
  assert.equal(isCancelledCompetition(merged), true);
  assert.equal(isClosedCompetition(merged), true);
  assert.equal(isClosedCompetition({ status: 'active', paymentStatus: 'OPEN_FOR_REGISTRATION' }), false);
  assert.equal(isClosedCompetition({ status: 'completed', paymentStatus: 'PRIZE_RELEASED' }), true);
});

test('the active list drops cached server competitions the server no longer lists as active', async () => {
  const data = loadNexusData();
  data.saveCompetitions([
    { id: 'gone', name: 'Cancelled Cup', status: 'active', backendSynced: true },
    { id: 'local-demo', name: 'Showcase', status: 'active' },
  ]);
  globalThis.__activeComps = [{ id: 'live1', name: 'Live Cup', status: 'active', paymentStatus: 'OPEN_FOR_REGISTRATION' }];
  data.__setApi({ Competitions: { getActive: async () => ({ ok: true, data: globalThis.__activeComps }) } });
  const ids = plain((await data.fetchActiveCompetitionsFromAPI()).map((c) => c.id)).sort();
  assert.deepEqual(ids, ['live1', 'local-demo']);
});

test('registration state follows the same rules as the server', () => {
  const { registrationState, mapApiCompetition } = loadNexusData();
  const now = Date.now();
  const hour = 3600000;
  const base = { status: 'active', paymentStatus: 'OPEN_FOR_REGISTRATION', startDate: new Date(now + 48 * hour).toISOString() };
  assert.equal(registrationState(base).open, true);
  assert.equal(registrationState({ ...base, registrationCloseAt: new Date(now + hour).toISOString() }).open, true);
  assert.equal(registrationState({ ...base, registrationCloseAt: new Date(now - hour).toISOString() }).reason, 'closed');
  assert.equal(registrationState({ ...base, registrationOpenAt: new Date(now + hour).toISOString() }).reason, 'not_open');
  assert.equal(registrationState({ ...base, startDate: new Date(now - hour).toISOString() }).reason, 'started');
  assert.equal(registrationState({ ...base, status: 'cancelled', paymentStatus: 'REFUND_ISSUED' }).reason, 'cancelled');
  assert.equal(registrationState({ ...base, paymentStatus: 'AWAITING_PLATFORM_FEE' }).reason, 'draft');
  // An old competition that already started no longer looks open in the list.
  const started = mapApiCompetition({ id: 'old', name: 'Finals', status: 'active', paymentStatus: 'LEGACY', startDate: '2026-10-18T00:00:00Z' });
  assert.equal(started.badge, 'In progress');
  assert.equal(registrationState(started).open, false);
});
