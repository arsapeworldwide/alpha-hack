const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { signIn } = require('./auth-helpers.cjs');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8080';
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function main() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const bankContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const bank = await bankContext.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  bank.on('pageerror', e => errors.push(e.message));
  let releasePoll = () => {};
  async function submit() {
    await page.getByRole('checkbox', { name: /Даю согласие на запрос кредитной истории/ }).check();
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/applications') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Отправить заявку', exact: true }).click(),
    ]);
    assert.equal(response.status(), 201);
    return (await response.json()).id;
  }
  try {
    await signIn(page, context, base);
    await context.request.post(`${base}/api/demo/reset`);
    const publicProfile = await (await context.request.get(`${base}/api/companies/lookup?inn=7712345678`)).json();
    assert(!('credit_history' in publicProfile));
    assert(!('monthly_payments' in publicProfile));
    await page.getByRole('radio', { name: /Альфа Ритейл/ }).click();
    assert.equal(await page.getByText('Отличная', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    assert(await page.getByRole('button', { name: 'Отправить заявку', exact: true }).isDisabled());
    await page.getByText('Выберите кредитный продукт', { exact: true }).waitFor();
    const retailId = await submit();
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    const text = (await page.locator('body').innerText()).replace(/[\u00a0\u202f]/g, ' ');
    assert(text.includes('2,67%'));
    assert(text.includes('180 000 000 ₽'));
    assert(text.includes('7 лет'));
    await page.getByRole('button', { name: 'Отключить БКИ', exact: true }).click();
    await page.getByRole('button', { name: 'Восстановить БКИ', exact: true }).click();
    const snapshot = await (await context.request.get(`${base}/api/applications/${retailId}`)).json();
    let pollFinished;
    const pollDone = new Promise(resolve => { pollFinished = resolve; });
    const blocked = new Promise(resolve => {
      const gate = new Promise(release => { releasePoll = release; });
      void page.route(`**/api/applications/${retailId}`, async route => {
        resolve(); await gate; await route.fulfill({ json: snapshot }); pollFinished();
      });
    });
    await blocked;
    await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
    await page.getByRole('heading', { name: 'Сумма и срок', exact: true }).waitFor();
    releasePoll();
    await pollDone;
    await page.unroute(`**/api/applications/${retailId}`);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert(await page.getByRole('heading', { name: 'Сумма и срок', exact: true }).isVisible());
    await page.getByRole('button', { name: 'Назад к компании', exact: true }).click();
    await page.getByRole('radio', { name: /ИП Иванов/ }).click();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const counterId = await submit();
    await page.getByRole('heading', { name: 'Можем одобрить меньшую сумму', exact: true }).waitFor({ timeout: 20000 });
    await signIn(bank, bankContext, base, 'underwriter');
    const queue = bank.getByRole('region', { name: 'Очередь заявок' });
    await queue.getByRole('button', { name: new RegExp(counterId) }).click();
    assert.equal(await queue.getByRole('button', { name: new RegExp(retailId) }).count(), 0);
    await bank.getByLabel('Сумма предложения', { exact: true }).waitFor();
    assert(await bank.getByRole('button', { name: 'Одобрить', exact: true }).isDisabled());
    await bank.getByText(/Исходная сумма превышает платёжную способность/).waitFor();
    await bank.getByLabel('Сумма предложения', { exact: true }).fill('1000000');
    await bank.getByLabel('Срок предложения', { exact: true }).fill('24');
    await bank.getByRole('button', { name: 'Предложить другие условия', exact: true }).click();
    await page.getByText('24 месяца', { exact: true }).waitFor();
    const counter = await (await context.request.get(`${base}/api/applications/${counterId}`)).json();
    assert.equal(counter.decision.approved_amount, 1000000);
    assert.equal(counter.decision.term_months, 24);
    await page.getByRole('button', { name: /Альфа Ритейл/ }).last().click();
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor();
    await bank.getByRole('tab', { name: 'Все заявки', exact: true }).click();
    await queue.getByRole('button', { name: new RegExp(retailId) }).click();
    await bank.getByLabel('Запрашиваемые документы').fill('Выписка');
    await bank.getByRole('button', { name: 'Запросить документы', exact: true }).click();
    await page.getByRole('heading', { name: 'Банк запросил документы', exact: true }).waitFor({ timeout: 20000 });
    await page.getByLabel('Файл PDF, PNG или JPEG, до 10 МБ').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSynthetic bank statement\n%%EOF') });
    await page.getByRole('checkbox', { name: /Даю согласие на повторный запрос БКИ/ }).check();
    await page.getByRole('button', { name: 'Загрузить документ', exact: true }).click();
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    const updated = await (await context.request.get(`${base}/api/applications/${retailId}`)).json();
    const documentId = updated.requested_documents[0].document_id;
    const download = await context.request.get(`${base}/api/applications/${retailId}/documents/${documentId}`);
    assert.equal(download.status(), 200);
    assert((await download.body()).toString().includes('Synthetic bank statement'));
    await page.getByRole('button', { name: 'Изменить условия', exact: true }).click();
    await page.getByRole('button', { name: 'Назад к компании', exact: true }).click();
    await page.getByLabel('ИНН компании или ИП').fill('7734567890');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await page.getByRole('heading', { name: 'ООО «Северный Цех»', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByText('Кредит на оборудование', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Сумма кредита', exact: true }).fill('8000000');
    await page.getByRole('textbox', { name: 'Сумма кредита', exact: true }).press('Tab');
    const manualId = await submit();
    await page.getByRole('heading', { name: 'Заявку рассматривает специалист', exact: true }).waitFor({ timeout: 20000 });
    await bank.getByRole('tab', { name: 'Требуют решения', exact: true }).click();
    await queue.getByRole('button', { name: new RegExp(manualId) }).click();
    await bank.getByLabel('Комментарий клиенту').fill('Документы проверены, оборудование одобрено');
    await bank.getByRole('button', { name: 'Одобрить', exact: true }).click();
    await page.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    await bank.screenshot({ path: path.join(artifacts, 'BANK_AFTER_FIXES.png'), fullPage: true });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(artifacts, 'demo-fixes-report.json'), JSON.stringify({ retailId, counterId, manualId, documentId, base }, null, 2));
    console.log('UI OK: consent/privacy, Russian factors, stale polling, queue tabs, custom offer, documents and manual review');
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, 'demo-fixes-failure.png'), fullPage: true });
    throw error;
  } finally {
    releasePoll(); await context.close(); await bankContext.close(); await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
