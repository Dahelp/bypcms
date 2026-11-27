import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const origin = 'http://127.0.0.1:8032';
const mock = 'http://127.0.0.1:8049/control';
const fixture = fileURLToPath(new URL('./checkout-email-fixture.php', import.meta.url));
const php = process.env.BYPCMS_TEST_PHP || 'php';
const token = () => randomBytes(16).toString('hex');
const runFixture = (...args) => execFileSync(php, [fixture, ...args], { stdio: 'pipe' });
runFixture('clear-rates');

const cookie = response => response.headers.getSetCookie().at(-1)?.split(';')[0];
async function send(path, session = {}, { body, status = 200, headers = {} } = {}) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json', Cookie: session.cookie || '',
      'X-CSRF-Token': session.csrf || '', Origin: origin, ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual', signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  assert.equal(response.status, status, data.error || path);
  return { data, cookie: cookie(response) };
}
const api = (action, ...rest) => send('/api/index.php?action=' + action, ...rest);
const commerce = (action, ...rest) => send('/commerce/index.php?action=' + action, ...rest);
const ownerLogin = await api('auth.login', {}, {
  body: { email: 'checkout-owner@example.test', password: 'Checkout-Email-QA-2026' },
});
const owner = { cookie: ownerLogin.cookie, csrf: ownerLogin.data.csrf };
const report = async () => (await api('owner.public-funnel&days=30',owner)).data.report.rows;
const count = (rows, event, keys) => rows.filter(row => row.event === event
  && Object.entries(keys).every(([key, value]) => row[key] === value)).reduce((sum, row) => sum + row.hits, 0);
const before = await report();

const id = token();
const address = `checkout-${id}@example.test`;
const dimensions = { edition: 'commerce', term: 'annual', locale: 'ru' };
const source = { tag: 'commerce.annual.ru', via: 'details' };
const bootstrap = await commerce('bootstrap');
assert.equal(bootstrap.data.checkout_email_available, true);
const buyer = { cookie: bootstrap.cookie, csrf: bootstrap.data.csrf };
const payload = { operation_id: id, accept_privacy: true, legal_version: bootstrap.data.legal.version };
const start = (data = {}, options = {}) => commerce('checkout.email.request', buyer, {
  body: { ...payload, email: address, locale: 'en', comparison_source: source, ...data }, ...options,
});
const verify = (code, session = buyer, options = {}) => commerce('checkout.email.verify', session, {
  body: { ...payload, code }, ...options,
});
async function delivered(email) {
  const data = await (await fetch(mock)).json();
  return data.messages.filter(message => message.includes('To: <' + email + '>'));
}
function getCode(mail) {
  const code = mail?.match(/\r\n(\d{6})\r\n/)?.[1];
  assert.ok(code, 'Expected a six-digit code delivered to the local test mailbox');
  return code;
}

await commerce('checkout.email.request', { ...buyer, csrf: 'invalid' }, {
  body: { ...payload, email: address }, status: 403,
});
await start({ accept_privacy: false }, { status: 422 });
assert.equal((await fetch(origin+'/metrics/index.php',{
  method:'POST',headers:{'Content-Type':'application/json',Origin:origin},
  body:JSON.stringify({event:'checkout_email_verified',...dimensions}),
})).status,422);
await start();
let messages = await delivered(address);
assert.equal(messages.length, 1);
assert.match(messages[0], /Your BYPCMS checkout code/);
const first = getCode(messages[0]);
await start();
assert.equal((await delivered(address)).length, 1);
assert.equal(count(await report(),'checkout_email_started',dimensions),count(before,'checkout_email_started',dimensions)+1);
assert.equal(count(await report(),'checkout_email_verified',dimensions),count(before,'checkout_email_verified',dimensions));

const reload = await commerce('bootstrap&checkout=' + id,buyer);
assert.equal(reload.data.checkout_email_pending.email,address);
assert.ok(reload.data.checkout_email_pending.expires_in > 0);
const otherBootstrap = await commerce('bootstrap&checkout=' + id);
const other = { cookie: otherBootstrap.cookie, csrf: otherBootstrap.data.csrf };
assert.equal(otherBootstrap.data.checkout_email_pending,null);
await verify(first,other,{ status: 422 });
const wrong = first === '000000' ? '000001' : '000000';
for (let attempt = 0; attempt < 5; attempt++) await verify(wrong,buyer,{ status: 422 });
await verify(first,buyer,{ status: 422 });
assert.equal((await commerce('bootstrap&checkout=' + id,buyer)).data.checkout_email_pending.locked,true);

runFixture('mail-cooldown',id);
await start({ locale: 'ru', comparison_source: { tag: 'business.lifetime.en', via: 'direct' } });
messages = await delivered(address);
assert.equal(messages.length, 2);
assert.match(messages[1], /=D0=92=D0=B0=D1=88/); // «Ваш» in the Russian mail.
const second = getCode(messages[1]);
runFixture('expire',id);
await verify(second,buyer,{ status: 422 });
await start();
const final = getCode((await delivered(address)).at(-1));
const confirmed = await verify(final);
assert.equal(confirmed.data.customer.email,address);
assert.notEqual(confirmed.cookie,buyer.cookie);
assert.notEqual(confirmed.data.csrf,buyer.csrf);
await verify(final,other,{ status: 422 });
const session = { cookie: confirmed.cookie, csrf: confirmed.data.csrf };
const create = {
  ...payload, accept_terms: true, edition: 'business', term: 'lifetime',
  modules: [], services: ['launch','support'], domain: 'checkout-' + id.slice(0,8) + '.example.test',
  comparison_source: source,
};
const order = (await commerce('create',session,{body:create})).data.order;
assert.equal(order.edition.toLowerCase(),'business');
assert.equal(order.license_term,'lifetime');
assert.deepEqual(order.items.services,['launch','support']);
assert.equal((await commerce('create',session,{body:create})).data.order.id,order.id);
const item = (await commerce('owner.status&source=comparison&order='+order.id,owner)).data.orders[0];
assert.deepEqual([item.comparison_edition,item.comparison_term,item.comparison_locale,item.comparison_path],
  ['commerce','annual','ru','details']);
const after = await report();
assert.equal(count(after,'checkout_email_started',dimensions),count(before,'checkout_email_started',dimensions)+1);
assert.equal(count(after,'checkout_email_verified',dimensions),count(before,'checkout_email_verified',dimensions)+1);
assert.equal(count(after,'order_saved',dimensions),count(before,'order_saved',dimensions)+1);

const journal = (await commerce('owner.status&q='+encodeURIComponent(address),owner)).data.outbox;
const codeMail = journal.find(row => row.template_key === 'checkout_email_code');
assert.ok(codeMail);
const preview = (await commerce('owner.mail&id='+codeMail.id,owner)).data.mail;
assert.equal(preview.html,null);
assert.ok(!preview.message.includes(final));
await commerce('owner.mail.resend',owner,{body:{id:codeMail.id,operation_id:token(),confirmed:true},status:422});

const privacyCheckout = await commerce('bootstrap');
const privacySession = { cookie: privacyCheckout.cookie, csrf: privacyCheckout.data.csrf };
const privateEmail = `checkout-private-${id}@example.test`;
const privatePayload = { ...payload, operation_id: token() };
await commerce('checkout.email.request',privacySession,{
  headers:{'Sec-GPC':'1'},body:{...privatePayload,email:privateEmail,comparison_source:source},
});
const privateCode = getCode((await delivered(privateEmail)).at(-1));
await commerce('checkout.email.verify',privacySession,{headers:{'Sec-GPC':'1'},body:{...privatePayload,code:privateCode}});
const privateReport = await report();
assert.equal(count(privateReport,'checkout_email_started',dimensions),count(after,'checkout_email_started',dimensions));
assert.equal(count(privateReport,'checkout_email_verified',dimensions),count(after,'checkout_email_verified',dimensions));

const legacyAddress = `checkout-legacy-${id}@example.test`;
const registrationPage = await fetch(origin+'/account/');
const accountCsrf = (await registrationPage.text()).match(/name="csrf" value="([a-f0-9]+)"/)?.[1];
assert.ok(accountCsrf);
const registration = await fetch(origin+'/account/',{
  method:'POST',redirect:'manual',headers:{Cookie:cookie(registrationPage)},
  body:new URLSearchParams({
    csrf:accountCsrf,action:'register',email:legacyAddress,name:'Legacy QA',
    password:'Checkout-Legacy-QA-2026',accept_privacy:'1',legal_version:payload.legal_version,
  }),
});
assert.equal(registration.status,302);
const legacySession = {cookie:cookie(registration)};
const legacyCustomer = (await commerce('bootstrap',legacySession)).data.customer;
assert.equal(legacyCustomer.email,legacyAddress);
const alternateBrowser = await commerce('bootstrap');
const alternateSession = {cookie:alternateBrowser.cookie,csrf:alternateBrowser.data.csrf};
const legacyPayload = {...payload,operation_id:token()};
await commerce('checkout.email.request',alternateSession,{body:{...legacyPayload,email:legacyAddress}});
const legacyCode = getCode((await delivered(legacyAddress)).at(-1));
const legacyVerified = await commerce('checkout.email.verify',alternateSession,{body:{...legacyPayload,code:legacyCode}});
assert.equal(legacyVerified.data.customer.id,legacyCustomer.id);
assert.equal(legacyVerified.data.legacy_password_revoked,true);
assert.equal((await commerce('bootstrap',legacySession)).data.customer,null);

async function configureMail(mode) {
  await fetch(mock,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mail:mode})});
}
await configureMail('reject');
try {
  const rejectedEmail = `checkout-rejected-${id}@example.test`;
  const rejectedSession = await commerce('bootstrap');
  const rejected = await commerce('checkout.email.request',{cookie:rejectedSession.cookie,csrf:rejectedSession.data.csrf},{
    body:{...payload,operation_id:token(),email:rejectedEmail},
  });
  assert.equal(rejected.data.pending.delivery_failed,true);
  assert.equal((await delivered(rejectedEmail)).length,0);
} finally {
  await configureMail('accept');
}
console.log('Checkout email: RU/EN SMTP, delivery failure, return to form, wrong and expired codes, resends, consent/CSRF, session isolation, legacy account ownership, attribution, report deduplication and privacy passed');
