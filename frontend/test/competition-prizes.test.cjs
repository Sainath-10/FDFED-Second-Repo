const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

/** Bundles a frontend module for Node, replacing React and the API client with stubs. */
async function load(file) {
  const bundle = await build({
    entryPoints: [path.join(__dirname, '../src', file)], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'stub' }));
      b.onResolve({ filter: /\/api\.js$/ }, () => ({ path: 'api', namespace: 'stub' }));
      b.onLoad({ filter: /^react$/, namespace: 'stub' }, () => ({ contents: 'export const useState = () => []; export const useEffect = () => {}; export const useCallback = (f) => f;' }));
      b.onLoad({ filter: /^api$/, namespace: 'stub' }, () => ({ contents: 'export const CompetitionsAPI = {}; export const TeamsAPI = {}; export const RevenueAPI = {};' }));
    } }],
  });
  const m = new Module(path.join(__dirname, `compiled-${path.basename(file)}.cjs`), module);
  m.paths = module.paths;
  m._compile(bundle.outputFiles[0].text, m.id);
  return m.exports;
}

const hour = 3600000;
const apiComp = {
  id: 'c1', name: 'Monsoon Cup', status: 'active', createdBy: 'org', prize: 10000, feeType: 'per_team', entryFeeAmount: 200,
  prizeDistributionMinor: [600000, 300000, 100000], paymentStatus: 'OPEN_FOR_REGISTRATION', prizePoolPaid: true,
  startDate: new Date(Date.now() + 48 * hour).toISOString(), endDate: new Date(Date.now() + 72 * hour).toISOString(),
};

test('prize breakdown comes from the server distribution, in rupees', async () => {
  const { mapCompetition } = await load('services/competitions.js');
  assert.deepEqual(mapCompetition(apiComp).prizes, [
    { place: '1st Place', amount: 6000 },
    { place: '2nd Place', amount: 3000 },
    { place: '3rd Place', amount: 1000 },
  ]);
  assert.equal(mapCompetition(apiComp).entryFee, '₹200 / team');
});

test('teams are mapped from the server roster, and inactive teams are separated', async () => {
  const { mapCompetition } = await load('services/competitions.js');
  const comp = mapCompetition(apiComp, [
    { id: 't1', name: 'Alpha', leaderId: 'cap', memberUsernames: ['cap', 'p1'], status: 'approved' },
    { id: 't2', name: 'Bravo', leaderId: 'cap2', memberUsernames: ['cap2'], status: 'disbanded' },
  ]);
  assert.equal(comp.teams.length, 2);
  assert.deepEqual(comp.activeTeams.map((t) => t.id), ['t1']);
  assert.deepEqual(comp.teams[0].members, [{ username: 'cap', role: 'captain' }, { username: 'p1', role: 'player' }]);
});

test('a cancelled competition is closed and labelled cancelled', async () => {
  const { mapCompetition, isClosedCompetition, isCancelledCompetition } = await load('services/competitions.js');
  const cancelled = mapCompetition({ ...apiComp, status: 'cancelled', paymentStatus: 'REFUND_ISSUED' });
  assert.equal(cancelled.badge, 'Cancelled');
  assert.equal(isCancelledCompetition(cancelled), true);
  assert.equal(isClosedCompetition(cancelled), true);
  assert.equal(isClosedCompetition({ status: 'active', paymentStatus: 'OPEN_FOR_REGISTRATION' }), false);
});

test('registration state follows the same rules as the server', async () => {
  const { registrationState } = await load('services/competitions.js');
  const now = Date.now();
  const base = { status: 'active', paymentStatus: 'OPEN_FOR_REGISTRATION', startDate: new Date(now + 48 * hour).toISOString() };
  assert.equal(registrationState(base).open, true);
  assert.equal(registrationState({ ...base, registrationCloseAt: new Date(now - hour).toISOString() }).reason, 'closed');
  assert.equal(registrationState({ ...base, registrationOpenAt: new Date(now + hour).toISOString() }).reason, 'not_open');
  assert.equal(registrationState({ ...base, startDate: new Date(now - hour).toISOString() }).reason, 'started');
  assert.equal(registrationState({ ...base, paymentStatus: 'AWAITING_PLATFORM_FEE' }).reason, 'draft');
  assert.equal(registrationState({ ...base, status: 'suspended' }).reason, 'suspended');
});

test('the platform fee preview matches the server formula', async () => {
  const { calculatePlatformFee } = await load('services/competitions.js');
  const config = { percentage: 7, minCost: 50 };
  assert.equal(calculatePlatformFee(0, config), 50);
  assert.equal(calculatePlatformFee(500, config), 50);
  assert.equal(calculatePlatformFee(10000, config), 700);
  assert.equal(calculatePlatformFee(1001, config), 70.07);
});
