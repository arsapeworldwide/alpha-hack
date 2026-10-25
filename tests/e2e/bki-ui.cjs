const { signIn } = require('./auth-helpers.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const mode = process.argv[2];
  assert(['fail', 'recover'].includes(mode), 'Use fail or recover');
  const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8080';
  const artifacts = path.join(__dirname, 'artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  const statePath = path.join(artifacts, 'bki-storage.json');
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  try {
    const context = await browser.newContext(mode === 'recover' ? { storageState: statePath } : {});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await signIn(page, context, base);
    if (mode === 'fail') {
      await page.getByRole('radio', { name: /Альфа Ритейл/ }).click();
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.getByRole('checkbox', { name: /Даю согласие на запрос кредитной истории/ }).check();
    await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
      await page.getByRole('heading', { name: 'Нужна повторная проверка', exact: true }).waitFor();
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/retry') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Повторить проверку', exact: true }).click(),
      ]);
      assert.equal(response.status(), 200);
      assert.equal((await response.json()).status, 'CHECKING_BKI');
      await page.getByRole('heading', { name: 'Нужна повторная проверка', exact: true }).waitFor();
      await context.storageState({ path: statePath });
      await page.screenshot({ path: path.join(artifacts, 'BKI_FAILURE.png'), fullPage: true });
      console.log('UI OK: BKI failure is visible; retry is persisted without losing the application');
    } else {
      await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
      const data = await (await context.request.get(`${base}/api/applications`)).json();
      assert(data.some(app => app.status === 'APPROVED'));
      console.log('UI OK: same application recovered after backend restart and BKI restoration');
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
