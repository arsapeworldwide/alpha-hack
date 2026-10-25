const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8080';

async function main() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base);
    const profile = page.getByRole('radio', { name: /Альфа Ритейл/ });
    await profile.click();
    await page.getByRole('button', { name: 'Изменить', exact: true }).click();
    await page.getByLabel('Выручка за год', { exact: true }).fill('900');
    assert((await profile.innerText()).includes('Высокий риск'));
    assert((await profile.innerText()).includes('изменено'));
    await page.getByRole('button', { name: 'Вернуть исходные данные', exact: true }).click();
    assert((await profile.innerText()).includes('Надёжный'));
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByRole('button', { name: 'Назад к компании', exact: true }).click();
    await page.getByRole('heading', { name: 'Кредит для бизнеса', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();

    async function submit() {
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/applications') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Отправить заявку', exact: true }).click(),
      ]);
      assert.equal(response.status(), 201);
      return { app: await response.json(), key: response.request().headers()['idempotency-key'] };
    }

    const first = await submit();
    await page.getByRole('button', { name: 'Отменить и изменить условия', exact: true }).click();
    await page.getByRole('heading', { name: 'Сумма и срок', exact: true }).waitFor();
    const second = await submit();
    assert.notEqual(first.app.id, second.app.id);
    assert(first.key && second.key && first.key !== second.key);
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
    const third = await submit();
    assert.notEqual(third.app.id, second.app.id);
    assert(third.key && third.key !== second.key);
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    const history = await (await context.request.get(`${base}/api/applications`)).json();
    for (const { app } of [first, second, third]) assert(history.some(item => item.id === app.id));
    assert.deepEqual(errors, []);
    console.log('UI OK: edited risk, restore, back navigation, new idempotency keys and preserved history');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
