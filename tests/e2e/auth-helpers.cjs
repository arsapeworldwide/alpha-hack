const assert = require('node:assert/strict');

async function signIn(page, context, base, login = 'director') {
  const response = await context.request.post(`${base}/api/auth/login`, {
    data: { login, password: 'demo-credit-2026' },
  });
  assert.equal(response.status(), 200);
  const token = (await response.json()).access_token;
  await context.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
  await context.addInitScript(value => sessionStorage.setItem('credit-cabinet:session', value), token);
  await page.goto(base);
  await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
}

module.exports = { signIn };
