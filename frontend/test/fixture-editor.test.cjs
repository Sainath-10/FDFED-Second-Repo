const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { build } = require('esbuild');
const { competitionOutcome } = require('../src/lib/competitionOutcome.mjs');
let FixtureEditor;
let FixtureBracket;
let PlayoffBracket;
const calls = [];
const api = {
  recordResult: async (...args) => { calls.push(['result', ...args]); return { ok: true, data: { id: args[0], status: 'completed' } }; },
  reschedule: async (...args) => { calls.push(['schedule', ...args]); return { ok: true, data: { id: args[0], scheduledAt: args[1] } }; },
};
before(async () => {
  globalThis.__fixtureTestAPI = api;
  const result = await build({
    entryPoints: [path.join(__dirname, '../src/components/FixtureEditor.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    external: ['react', 'react/jsx-runtime'],
    plugins: [{ name: 'fake-api', setup(builder) {
      builder.onResolve({ filter: /services\/api\.js$/ }, () => ({ path: 'api', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const MatchesAPI = globalThis.__fixtureTestAPI;' }));
    } }],
  });
  const loaded = new Module(path.join(__dirname, 'compiled-editor.cjs'), module);
  loaded.filename = path.join(__dirname, 'compiled-editor.cjs'); loaded.paths = module.paths;
  loaded._compile(result.outputFiles[0].text, loaded.filename);
  FixtureEditor = loaded.exports.default;
  const bracketBundle = await build({ entryPoints: [path.join(__dirname, '../src/components/FixtureBracket.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
  const bracketModule = new Module(path.join(__dirname, 'compiled-bracket.cjs'), module);
  bracketModule.filename = path.join(__dirname, 'compiled-bracket.cjs'); bracketModule.paths = module.paths;
  bracketModule._compile(bracketBundle.outputFiles[0].text, bracketModule.filename);
  FixtureBracket = bracketModule.exports.default;
  const playoffBundle = await build({ entryPoints: [path.join(__dirname, '../src/components/PlayoffBracket.jsx')], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
  const playoffModule = new Module(path.join(__dirname, 'compiled-playoffs.cjs'), module);
  playoffModule.filename = path.join(__dirname, 'compiled-playoffs.cjs'); playoffModule.paths = module.paths;
  playoffModule._compile(playoffBundle.outputFiles[0].text, playoffModule.filename);
  PlayoffBracket = playoffModule.exports.default;
});

const match = { id: 'm1', team1Id: 'a', team2Id: 'b', team1: 'Alpha', team2: 'Beta', status: 'scheduled', durationMinutes: 60, scheduledAt: new Date('2026-02-10T10:00').toISOString() };
const competition = { startDate: '2026-02-01T00:00:00Z', endDate: '2026-02-28T00:00:00Z' };
function mount(extra = {}) {
  calls.length = 0;
  const saved = [];
  const props = { match, matches: [match], competition, isLeague: false, onSaved: (value) => saved.push(value), ...extra };
  let tree;
  act(() => { tree = create(React.createElement(FixtureEditor, props)); });
  const button = (text) => tree.root.findAllByType('button').find((node) => node.children.join('') === text);
  const type = (index, value) => act(() => tree.root.findAllByType('input')[index].props.onChange({ target: { value } }));
  const submit = () => act(async () => { await tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  return { tree, props, saved, button, type, submit };
}

test('scores remain editable across keystrokes and parent refreshes, then save the right winner', async () => {
  const editor = mount();
  act(() => editor.button('Enter result').props.onClick());
  editor.type(0, '1'); editor.type(0, '12'); editor.type(1, '3');
  act(() => editor.tree.update(React.createElement(FixtureEditor, { ...editor.props, match: { ...match } })));
  assert.deepEqual(editor.tree.root.findAllByType('input').map((node) => node.props.value), ['12', '3']);
  await editor.submit();
  assert.deepEqual(calls, [['result', 'm1', 'a', 'Alpha', '12-3']]);
  assert.equal(editor.saved[0].status, 'completed');
  assert.equal(editor.tree.root.findAllByType('form').length, 0);
  act(() => editor.tree.unmount());
});

test('knockout ties require a host choice before sending an API request', async () => {
  const editor = mount();
  act(() => editor.button('Enter result').props.onClick());
  editor.type(0, '2'); editor.type(1, '2'); await editor.submit();
  assert.equal(calls.length, 0);
  assert.match(editor.tree.root.findByProps({ role: 'alert' }).children.join(''), /host/);
  assert.equal(editor.tree.root.findAllByType('input')[0].props.value, '2');
  act(() => editor.tree.unmount());
});

test('rescheduling checks complete durations and sends the chosen local time as UTC', async () => {
  const other = { ...match, id: 'm2', team1: 'Gamma', team2: 'Delta', durationMinutes: 90, scheduledAt: new Date('2026-02-10T12:00').toISOString() };
  const editor = mount({ matches: [match, other] });
  act(() => editor.button('Edit date & time').props.onClick());
  editor.type(0, '2026-02-10T13:00'); await editor.submit();
  assert.equal(calls.length, 0);
  assert.match(editor.tree.root.findByProps({ role: 'alert' }).children.join(''), /Gamma vs Delta/);
  editor.type(0, '2026-02-10T13:30'); await editor.submit();
  assert.deepEqual(calls, [['schedule', 'm1', new Date('2026-02-10T13:30').toISOString()]]);
  act(() => editor.tree.unmount());
});

test('pending teams disable results but allow scheduling', () => {
  const editor = mount({ match: { ...match, team2Id: null, team2: 'Winner of Semifinal 2' } });
  assert.equal(editor.button('Enter result').props.disabled, true);
  assert.equal(editor.button('Edit date & time').props.disabled, false);
  act(() => editor.tree.unmount());
});

test('backend save errors preserve the typed scores for a retry', async () => {
  const original = api.recordResult;
  api.recordResult = async () => ({ ok: false, error: 'Result could not be saved.' });
  try {
    const editor = mount();
    act(() => editor.button('Enter result').props.onClick());
    editor.type(0, '2'); editor.type(1, '0'); await editor.submit();
    assert.equal(editor.saved.length, 0);
    assert.equal(editor.tree.root.findByType('fieldset').props.disabled, false);
    assert.deepEqual(editor.tree.root.findAllByType('input').map((node) => node.props.value), ['2', '0']);
    assert.match(editor.tree.root.findByProps({ role: 'alert' }).children.join(''), /could not be saved/);
    act(() => editor.tree.unmount());
  } finally { api.recordResult = original; }
});

test('legacy fixtures show only final scores and support an offline host choice on a tie', async () => {
  const editor = mount({ match: { ...match, resultRule: 'obsolete-scoring-rule' } });
  act(() => editor.button('Enter result').props.onClick());
  assert.equal(editor.tree.root.findAllByType('input').length, 2);
  editor.type(0, '30'); editor.type(1, '30');
  await editor.submit();
  assert.equal(calls.length, 0);
  assert.match(editor.tree.root.findByProps({ role: 'alert' }).children.join(''), /host/);
  act(() => editor.tree.root.findByProps({ 'aria-label': "Host's offline winner" }).props.onChange({ target: { value: 'b' } }));
  await editor.submit();
  assert.deepEqual(calls[0], ['result', 'm1', 'b', 'Beta', '30-30']);
  assert.equal(editor.saved.length, 1);
  act(() => editor.tree.unmount());
});

test('changing final scores clears a stale host decision', async () => {
  const editor = mount({ match: { ...match, resultRule: 'obsolete-scoring-rule' } });
  act(() => editor.button('Enter result').props.onClick());
  [10,10].forEach((value,index) => editor.type(index,String(value)));
  act(() => editor.tree.root.findByProps({ 'aria-label': "Host's offline winner" }).props.onChange({target:{value:'b'}}));
  editor.type(0,'11');
  assert.equal(editor.tree.root.findAllByType('select').length,0);
  assert.equal(editor.tree.root.findAllByType('input').length,2);
  await editor.submit();
  assert.deepEqual(calls[0], ['result', 'm1', 'a', 'Alpha', '11-10']);
  act(() => editor.tree.unmount());
});

test('bracket columns and winner links render from persisted rounds, positions, and destinations', () => {
  const fixtures = [];
  for (let round=1;round<=3;round++) for(let position=1;position<=2**(3-round);position++) {
    fixtures.push({id:`${round}-${position}`, round:`Stored stage ${round}`, status: round===1 && position===1 ? 'bye' : 'pending', bracket:{version:2,round,position,bracketSize:8,roundCount:3,nextMatchId:round===3?null:`${round+1}-${Math.ceil(position/2)}`,nextSlot:position%2?1:2}});
  }
  const selected=[];
  let tree;
  act(()=>{tree=create(React.createElement(FixtureBracket,{ matches: [...fixtures].reverse(), selectedId:'1-1', onSelect:(id)=>selected.push(id),zoom:1, renderMatch:(match)=>React.createElement('span',null,match.id) }));});
  assert.equal(tree.root.findAllByProps({className:'cd-map-round'}).length,3);
  assert.equal(tree.root.findAllByType('path').length,6);
  const headers=tree.root.findAllByType('h3').map((node)=>node.children.join(''));
  assert.deepEqual(headers,['Stored stage 1','Stored stage 2','Stored stage 3']);
  const link=tree.root.findAllByType('button').find((node)=>node.props['aria-label'].includes('round 1, position 1'));
  act(()=>link.props.onClick());
  assert.deepEqual(selected,['2-1']);
  act(()=>tree.unmount());
});


test('playoff graph renders all four stages with the Q1 loser route', () => {
  const fixtures = [
    { id: 'q1', round: 'Qualifier 1', bracket: { nextMatchId: 'final', loserMatchId: 'q2' } },
    { id: 'e', round: 'Eliminator', bracket: { nextMatchId: 'q2' } },
    { id: 'q2', round: 'Qualifier 2', bracket: { nextMatchId: 'final' } },
    { id: 'final', round: 'Final', bracket: { nextMatchId: null } },
  ];
  let tree;
  act(() => { tree = create(React.createElement(PlayoffBracket, {matches:fixtures, renderMatch:m => React.createElement('button',null,m.id)})); });
  assert.deepEqual(tree.root.findAllByType('h3').map(n => n.children.join('')), ['Qualifier 1','Eliminator','Qualifier 2','Final']);
  assert.equal(tree.root.findAllByType('path').length, 4);
  assert.equal(tree.root.findAllByType('path').filter(n => n.props.strokeDasharray).length, 1);
  act(() => tree.unmount());
});

test('a pending playoff cannot be scored or scheduled', () => {
  const editor = mount({match:{...match,team2Id:null,status:'pending',bracket:{kind:'ipl'}}});
  assert.equal(editor.button('Enter result').props.disabled, true);
  assert.equal(editor.button('Edit date & time').props.disabled, true);
  act(() => editor.tree.unmount());
});

test('single elimination declares the final winner and the other finalist as runner-up', () => {
  const fixtures = [
    { id: 'semi', round: 'Semifinal', status: 'completed', winnerId: 'a', bracket: {version: 2, nextMatchId: 'final'} },
    { id: 'final', round: 'Final', status: 'completed', team1Id: 'a', team1: 'Alpha', team2Id: 'b', team2: 'Beta', winnerId: 'b', winnerName: 'Beta', bracket: {version: 2, nextMatchId: null} },
  ];
  assert.deepEqual(competitionOutcome(fixtures), { winner: 'Beta', runnerUp: 'Alpha', finalId: 'final' });
  fixtures[1].status = 'ready';
  assert.equal(competitionOutcome(fixtures), null);
});

test('league playoff honors a tied final decided by the host, regardless of league rank', () => {
  const fixtures = [
    { id: 'league', round: 'Round 1', status: 'completed', team1: 'Top Seed', winnerId: 'top' },
    { id: 'q1', round: 'Qualifier 1', status: 'completed', bracket: {kind: 'ipl', nextMatchId: 'final'} },
    { id: 'final', round: 'Final', status: 'completed', score: '20-20', team1Id: 'top', team1: 'Top Seed', team2Id: 'lower', team2: 'Lower Seed', winnerId: 'lower', winnerName: 'Lower Seed', bracket: {kind: 'ipl', nextMatchId: null} },
  ];
  assert.deepEqual(competitionOutcome(fixtures), { winner: 'Lower Seed', runnerUp: 'Top Seed', finalId: 'final' });
  fixtures[2].status = 'pending';
  assert.equal(competitionOutcome(fixtures), null);
});
