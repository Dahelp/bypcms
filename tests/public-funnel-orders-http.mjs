import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Only the isolated comparison fixture can run this payment journey.
const origin = 'http://127.0.0.1:8030';
const fixture = fileURLToPath(new URL('./public-funnel-fixture.php', import.meta.url));
const site = fileURLToPath(new URL('../outputs/edition-comparison/site', import.meta.url));
const php = process.env.BYPCMS_TEST_PHP || 'php';
function fixtureCommand(mode, ...args) {
  return execFileSync(php, [fixture, site, mode, ...args], {encoding: 'utf8'});
}
fixtureCommand('inspect');

const operation = () => randomBytes(16).toString('hex');
async function request(path, options = {}) {
  return fetch(origin + path, {redirect: 'manual', signal: AbortSignal.timeout(30000), ...options});
}
const cookie = response => response.headers.getSetCookie().at(-1)?.split(';')[0];
async function json(path, body, session = {}, expected = 200, headers = {}) {
  const response = await request(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {'Content-Type': 'application/json', Cookie: session.cookie || '', 'X-CSRF-Token': session.csrf || '', ...headers},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.ok([expected].flat().includes(response.status), data.error || path);
  return {data, cookie: cookie(response)};
}
const commerce = (action, ...args) => json('/commerce/index.php?action=' + action, ...args);
const api = (action, ...args) => json('/api/index.php?action=' + action, ...args);
const ownerLogin = await api('auth.login', {
  email: 'comparison-owner@example.test', password: 'Comparison-QA-2026-password',
});
const owner = {cookie: ownerLogin.cookie, csrf: ownerLogin.data.csrf};

function account(prefix, bik, correspondent = false) {
  for (let digit = 0; digit <= 9; digit++) {
    const result = prefix.slice(0, 8) + digit + prefix.slice(9);
    const digits = (correspondent ? '0' + bik.slice(4, 6) : bik.slice(-3)) + result;
    if ([...digits].reduce((sum, number, index) => sum + Number(number) * [7, 1, 3][index % 3], 0) % 10 === 0) return result;
  }
  throw new Error('Synthetic account checksum');
}
const bik = '044525225';
await commerce('owner.bank.settings', {
  enabled: true, recipient: 'Тестовый получатель BYPCMS', inn: '550519989590',
  bank: 'Тестовый банк', bik,
  account: account('40817810000000000000', bik), correspondent: account('30101810000000000000', bik, true),
}, owner);

async function report(days = 30) {
  return (await api('owner.public-funnel&days=' + days, undefined, owner)).data.report.rows;
}
const count = (rows, event, keys = {}) => rows.reduce((sum, row) =>
  row.event === event && Object.entries(keys).every(([key, value]) => row[key] === value)
    ? sum + row.hits : sum, 0);
const dimensions = {edition: 'business', term: 'annual', locale: 'ru', path: 'details'};
const before = await report(90);
const checkout = '/en/order/?edition=Business&term=lifetime&cmp=business.annual.ru&cmp_via=details';
const legal = (await commerce('bootstrap')).data.legal.version;
const token = operation();
const email = 'funnel-order-' + token + '@example.test';
const register = await request('/account/?next=' + encodeURIComponent(checkout));
const csrf = (await register.text()).match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
assert.ok(csrf);
const registration = await request('/account/', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie(register)},
  body: new URLSearchParams({
    csrf, action: 'register', next: checkout, email, name: 'Funnel QA buyer',
    password: 'Funnel-QA-2026-buyers', legal_version: legal, accept_privacy: '1',
  }),
});
assert.equal(registration.status, 302);
assert.equal(registration.headers.get('location'), checkout);
const buyer = {cookie: cookie(registration)};
buyer.csrf = (await commerce('bootstrap', undefined, buyer)).data.csrf;
const orderInput = {
  operation_id: operation(), edition: 'business', term: 'lifetime', modules: [], services: [],
  domain: 'attribution-' + token.slice(0, 8) + '.example.test',
  legal_version: legal, accept_terms: true, accept_privacy: true,
  comparison_source: {tag: 'business.annual.ru', via: 'details'},
};

await commerce('create', orderInput, {...buyer, csrf: 'invalid'}, 403);
const created = (await commerce('create', orderInput, buyer)).data.order;
assert.equal(created.payment_state, 'pending');
assert.equal(created.license_term, 'lifetime');
assert.ok(created.invoice?.accepted_at);
const retry = (await commerce('create', {
  ...orderInput, comparison_source: {tag: 'content.annual.en', via: 'direct'},
}, buyer)).data.order;
assert.equal(retry.id, created.id);
const saved = await report(90);
assert.equal(count(saved, 'order_saved', dimensions), count(before, 'order_saved', dimensions) + 1);
assert.equal(count(saved, 'order_saved'), count(before, 'order_saved') + 1);
assert.equal(count(saved, 'payment_confirmed'), count(before, 'payment_confirmed'));

fixtureCommand('age-order', String(created.id));
assert.equal(count(await report(90), 'order_saved', dimensions), count(before, 'order_saved', dimensions));
const payment = {
  id: created.id, invoice_id: created.invoice.id, operation_id: operation(), source: 'bank',
  amount: (created.amount_minor / 100).toFixed(2), paid_on: new Date().toISOString().slice(0, 10),
  reference: 'LOCAL-QA-' + token, confirmed: true,
};
await commerce('owner.invoice.confirm', payment, buyer, 401);
await commerce('owner.invoice.confirm', {...payment, amount: '1.00'}, owner, 422);
assert.equal(count(await report(90), 'payment_confirmed'), count(before, 'payment_confirmed'));
// This fixture may lack license delivery configuration. The payment must be
// persisted and visible in the report even if delivery needs a retry.
async function confirmPayment() {
  const {data} = await commerce('owner.invoice.confirm', payment, owner, [200, 422]);
  if (!data.ok) assert.match(data.error, /^Оплата подтверждена, но выдача ещё не завершена/);
}
await confirmPayment();
const paid = (await commerce('order&id=' + created.id, undefined, buyer)).data.order;
assert.equal(paid.payment_state, 'paid');
await confirmPayment();
const confirmed = await report(90);
assert.equal(count(confirmed, 'payment_confirmed', dimensions), count(before, 'payment_confirmed', dimensions) + 1);
assert.equal(count(confirmed, 'payment_confirmed'), count(before, 'payment_confirmed') + 1);

await commerce('create', {
  ...orderInput, operation_id: operation(), comparison_source: {tag: 'content.annual.en', via: 'direct'},
}, buyer, 200, {'Sec-GPC': '1'});
await commerce('create', {...orderInput, operation_id: operation(), comparison_source: {tag: '<invalid>'}}, buyer);
assert.equal(count(await report(90), 'order_saved'), count(before, 'order_saved'));

await commerce('create', {
  ...orderInput, operation_id: operation(), comparison_source: {tag: 'content.annual.en', via: 'direct'},
}, buyer);
assert.equal(count(await report(90), 'order_saved', {edition: 'content', locale: 'en', path: 'direct'}),
  count(before, 'order_saved', {edition: 'content', locale: 'en', path: 'direct'}) + 1);
console.log('Order source, login return, delayed invoice payment, repeat requests and privacy checks passed');
