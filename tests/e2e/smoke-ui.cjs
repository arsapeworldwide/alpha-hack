const { signIn } = require('./auth-helpers.cjs');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8080';
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

const cases = [
  { name: 'Альфа Ритейл', heading: 'Кредит одобрен', score: 97,
    outcome: 'APPROVED', amount: 10000000, overpayment: 3196160 },
  { name: 'ИП Иванов', heading: 'Можем одобрить меньшую сумму', score: 46,
    outcome: 'COUNTER_OFFER', amount: 2500000, overpayment: 1030952 },
  { name: 'Вектор', heading: 'Сейчас не можем одобрить кредит', score: 8,
    outcome: 'REJECTED', amount: null, overpayment: null },
];

async function main() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const errors = [];
  const results = [];
  try {
    for (const test of cases) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
        ...(process.env.RECORD_DEMO === '1' ? { recordVideo: { dir: path.join(artifacts, 'video') } } : {}) });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      try {
        await signIn(page, context, base);
        await page.getByRole('radio', { name: new RegExp(test.name) }).click();
        await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
        await page.getByRole('heading', { name: 'Сумма и срок', exact: true }).waitFor();
        const [response] = await Promise.all([
          page.waitForResponse(r => r.url().endsWith('/api/applications') && r.request().method() === 'POST'),
          page.getByRole('button', { name: 'Отправить заявку', exact: true }).click(),
        ]);
        assert.equal(response.status(), 201);
        const created = await response.json();
        assert.equal(created.status, 'SUBMITTED');
        await page.getByRole('heading', { name: test.heading, exact: true }).waitFor({ timeout: 20000 });
        const detail = await (await context.request.get(`${base}/api/applications/${created.id}`)).json();
        assert.equal(detail.decision.score, test.score);
        assert.equal(detail.decision.outcome, test.outcome);
        assert.equal(detail.decision.approved_amount, test.amount);
        assert.equal(detail.decision.overpayment, test.overpayment);
        const text = (await page.locator('body').innerText()).replace(/[\u00a0\u202f]/g, ' ');
        if (test.overpayment !== null) {
          assert(text.includes(test.overpayment.toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ')));
        } else {
          assert(text.includes('Высокая долговая нагрузка') || text.includes('высокая долговая нагрузка'));
        }
        await page.screenshot({ path: path.join(artifacts, `${test.outcome}.png`), fullPage: true });
        if (test.outcome === 'COUNTER_OFFER') {
          await page.getByRole('button', { name: 'Принять новые условия', exact: true }).click();
          await page.getByRole('heading', { name: 'Новые условия приняты', exact: true }).waitFor();
        }
        if (test.outcome !== 'REJECTED') {
          await page.getByRole('button', { name: 'Подписать договор онлайн', exact: true }).click();
          const dialog = page.getByRole('dialog');
          if (test.outcome === 'APPROVED') {
            await dialog.getByLabel('Код', { exact: true }).fill('0000');
            await dialog.getByRole('button', { name: 'Подписать договор', exact: true }).click();
            await dialog.getByRole('alert').waitFor();
            assert((await dialog.getByRole('alert').innerText()).includes('Неверный код'));
            assert((await dialog.getByRole('alert').innerText()).includes('Осталось попыток: 4'));
          }
          await dialog.getByLabel('Код', { exact: true }).fill('1234');
          await dialog.getByRole('button', { name: 'Подписать договор', exact: true }).click();
          await page.getByRole('heading', { name: /Кредит успешно выдан/ }).waitFor({ timeout: 20000 });
          await page.reload();
          await page.getByRole('heading', { name: /Кредит успешно выдан/ }).waitFor({ timeout: 20000 });
          await page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor();
        }
        results.push({ ...test, id: created.id });
        console.log(`UI OK: ${test.name} / ${test.outcome}`);
      } catch (error) {
        await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true });
        throw error;
      } finally {
        await context.close();
        if (page.video()) await page.video().saveAs(path.join(artifacts, `demo-${test.outcome.toLowerCase()}.webm`));
      }
    }
    assert.deepEqual(errors, []);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, context, base);
    const [reset] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/demo/reset') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Сбросить демо', exact: true }).click(),
    ]);
    assert.equal(reset.status(), 200);
    assert.deepEqual(await (await context.request.get(`${base}/api/applications`)).json(), []);
    fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ results, errors }, null, 2));
    await context.close();
    console.log('UI OK: real backend, signing, reload, history and demo reset');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
