const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');

async function loadForm() {
  const bundle = await build({ entryPoints: [path.join(__dirname, '../src/lib/competitionForm.js')], bundle: true, write: false, platform: 'node', format: 'cjs' });
  const m = new Module(path.join(__dirname, 'compiled-form.cjs'), module);
  m.paths = module.paths;
  m._compile(bundle.outputFiles[0].text, m.id);
  return m.exports;
}

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('registration must close before the competition starts', async () => {
  const { validateSchedule } = await loadForm();
  const errors = validateSchedule({ regOpen: day(0), regClose: day(10), start: day(5), end: day(12) });
  assert.match(errors.regClose, /before the start date/);
});

test('registration cannot close after the competition ends, or open after it', async () => {
  const { validateSchedule } = await loadForm();
  assert.ok(validateSchedule({ regOpen: day(0), regClose: day(20), start: day(5), end: day(8) }).regClose);
  assert.ok(validateSchedule({ regOpen: day(20), regClose: day(21), start: day(5), end: day(8) }).regOpen);
});

test('the end must be at least one day after the start; same-day registration windows are allowed', async () => {
  const { validateSchedule, scheduleToIso } = await loadForm();
  assert.match(validateSchedule({ regOpen: day(1), regClose: day(1), start: day(3), end: day(3) }).end, /at least one day after it starts/);
  assert.deepEqual(validateSchedule({ regOpen: day(1), regClose: day(1), start: day(3), end: day(4) }), {});
  const iso = scheduleToIso({ regOpen: day(1), regClose: day(1), start: day(3), end: day(3) });
  assert.ok(new Date(iso.endDate) > new Date(iso.startDate), 'the end is 23:59:59 on the start day');
  assert.ok(new Date(iso.registrationCloseAt) > new Date(iso.registrationOpenAt), 'registration closes at the end of its day');
});

test('registration closing on the start day closes when play starts', async () => {
  const { scheduleToIso } = await loadForm();
  const iso = scheduleToIso({ regOpen: day(1), regClose: day(3), start: day(3), end: day(4) });
  assert.equal(iso.registrationCloseAt, iso.startDate);
});

test('past dates are rejected', async () => {
  const { validateSchedule } = await loadForm();
  const errors = validateSchedule({ regOpen: day(-3), regClose: day(-1), start: day(-1), end: day(1) });
  assert.ok(errors.regOpen && errors.regClose && errors.start);
});

test('prizes must be whole rupees and descend by place', async () => {
  const { parseRupees, validatePrizes } = await loadForm();
  assert.equal(parseRupees('100').value, 100);
  assert.match(parseRupees('100.75').error, /whole number/);
  assert.deepEqual(validatePrizes([100, 50, 10]), {});
  assert.ok(validatePrizes([100, 0, 500])[2], '3rd cannot pay when 2nd pays nothing');
  assert.ok(validatePrizes([100, 200, 0])[1], '2nd cannot pay more than 1st');
});

test('names and descriptions ignore surrounding spaces', async () => {
  const { validateName, validateDescription } = await loadForm();
  assert.ok(validateName('      '));
  assert.ok(validateName('<b>Cup</b>'));
  assert.equal(validateName('  Monsoon Cup  '), '');
  assert.ok(validateDescription('          '));
});

test('a new competition starts with a valid default schedule', async () => {
  const { defaultSchedule, validateSchedule, todayInput } = await loadForm();
  const schedule = defaultSchedule();
  assert.equal(schedule.regOpen, todayInput());
  assert.ok(schedule.regOpen < schedule.regClose && schedule.regClose < schedule.start && schedule.start < schedule.end);
  assert.deepEqual(validateSchedule(schedule), {}, 'the defaults pass the same rules as the backend');
});

test('prize pools above 10 lakh need complete contact details', async () => {
  const { validateContact, LARGE_PRIZE_POOL, MAX_PRIZE_POOL } = await loadForm();
  assert.equal(LARGE_PRIZE_POOL, 1000000);
  assert.equal(MAX_PRIZE_POOL, 10000000);
  const errors = validateContact({ fullName: 'A', phone: 'abc', email: 'nope', purpose: 'short' });
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'fullName', 'phone', 'purpose']);
  assert.deepEqual(validateContact({ fullName: 'Asha Rao', phone: '+91 98765 43210', email: 'asha@example.com', purpose: 'Sponsored by a hardware brand under a signed agreement.' }), {});
});
