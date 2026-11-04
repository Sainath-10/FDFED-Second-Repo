#!/usr/bin/env node
/**
 * Creates the accounts used to test the payment workflow with several people.
 * Safe to run more than once: existing accounts are reused.
 *
 *   node backend/scripts/setup-payment-test-users.mjs            # backend on http://localhost:3000
 *   API_URL=http://localhost:3100 node backend/scripts/setup-payment-test-users.mjs
 *
 * Every account uses the password `test1234`. Uses only public API endpoints
 * (register, login, the simulated Aadhaar check, and Super Admin "add admin"),
 * so it needs the backend running with the seeded `superadmin1` / `nexus` account.
 */
const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PASSWORD = 'test1234';

const USERS = [
  { username: 'org_arjun', role: 'Organizer — creates and runs competitions' },
  { username: 'cap_meera', role: 'Captain of team 1' },
  { username: 'cap_kabir', role: 'Captain of team 2' },
  { username: 'cap_zoya', role: 'Captain of team 3 (gets banned / refunded in the cheat tests)' },
  { username: 'player_dev', role: "Teammate invited to team 1 (prize split check)" },
  { username: 'fin_ravi', role: 'Finance moderator', finance: true },
  { username: 'priya_dual', role: 'Player who is later promoted to finance (conflict-of-interest check)' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path, body, token, retries = 3) {
  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach ${API}. Start the backend first (cd backend && npm run start:dev).`);
  }
  const data = await response.json().catch(() => ({}));
  // Login/register are limited to 15 per minute per IP: wait it out instead of failing.
  if (response.status === 429 && retries > 0) {
    const seconds = Number(/(\d+) seconds/.exec(data.message || '')?.[1] || 30) + 1;
    console.log(`  … rate limited, waiting ${seconds}s`);
    await sleep(seconds * 1000);
    return call(method, path, body, token, retries - 1);
  }
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message || response.statusText;
    throw Object.assign(new Error(`${method} ${path}: ${message}`), { status: response.status });
  }
  return data;
}

const login = async (username, password = PASSWORD) => (await call('POST', '/auth/login', { emailOrUsername: username, password })).access_token;

async function ensureAccount(username, adminToken) {
  const { exists } = await call('GET', `/auth/users/exists?username=${encodeURIComponent(username)}`, null, adminToken);
  if (exists) return 'exists';
  try {
    await call('POST', '/auth/register', { email: `${username}@nexus.test`, username, password: PASSWORD });
    return 'created';
  } catch (error) {
    if (/exist|taken|already/i.test(error.message)) return 'exists';
    throw error;
  }
}

async function ensureVerified(token) {
  const status = await call('GET', '/verification/status', null, token);
  if (status.verificationStatus === 'verified') return 'already verified';
  await call('POST', '/verification/aadhaar/request-otp', { aadhaarNumber: '123412341234' }, token);
  await call('POST', '/verification/aadhaar/verify', { otp: '000000' }, token);
  return 'verified';
}

async function main() {
  console.log(`Setting up payment test users on ${API}\n`);
  const admin = await login('superadmin1', 'nexus').catch(() => {
    throw new Error('Could not log in as superadmin1 / nexus. Is the database seeded?');
  });

  for (const user of USERS) {
    const account = await ensureAccount(user.username, admin);
    let token = await login(user.username);
    // Players and organizers need the simulated Aadhaar check before creating or joining competitions.
    const verification = await ensureVerified(token);
    let role = '';
    if (user.finance) {
      try {
        await call('POST', '/auth/add-admin', { username: user.username, adminType: 'finance_moderator' }, admin);
        role = 'finance_moderator';
      } catch (error) {
        role = /already an admin/i.test(error.message) ? 'finance_moderator (already)' : `role not set: ${error.message}`;
      }
    }
    console.log(`  ${user.username.padEnd(11)} ${account.padEnd(8)} ${verification.padEnd(17)} ${role.padEnd(28)} ${user.role}`);
  }

  console.log(`\nAll passwords: ${PASSWORD}`);
  console.log('Super admin: superadmin1 / nexus');
  console.log('Next: follow docs/PAYMENT_TESTING.md, one browser session per user.');
}

main().catch((error) => { console.error(`\n✖ ${error.message}`); process.exitCode = 1; });
