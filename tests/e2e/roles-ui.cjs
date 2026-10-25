const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:8080';
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

async function main() {
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ headless: true, channel });
  const contexts = [];
  const errors = [];
  async function enter(name) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button', { name: `Войти как ${name}`, exact: false }).click();
    await page.getByRole('button', { name: 'Выйти', exact: true }).waitFor();
    return page;
  }
  async function request(page, route, method = 'GET', data) {
    const token = await page.evaluate(() => sessionStorage.getItem('credit-cabinet:session'));
    return page.context().request.fetch(`${base}/api${route}`, { method, data, headers: { Authorization: `Bearer ${token}` } });
  }
  async function submit(page, company) {
    await page.getByRole('radio', { name: new RegExp(company) }).click();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/applications') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Отправить заявку', exact: true }).click(),
    ]);
    assert.equal(response.status(), 201);
    return (await response.json()).id;
  }
  try {
    const director = await enter('Директор демо-группы');
    await request(director, '/demo/reset', 'POST');
    const counterId = await submit(director, 'ИП Иванов');
    await director.getByRole('heading', { name: 'Можем одобрить меньшую сумму', exact: true }).waitFor({ timeout: 20000 });
    await director.getByText(/Рейтинг C/).waitFor();
    const bank = await enter('Сотрудник банка');
    await bank.getByRole('heading', { name: 'Рабочее место банка', exact: true }).waitFor();
    await bank.getByRole('region', { name: 'Очередь заявок' }).getByRole('button', { name: new RegExp(counterId) }).click();
    await bank.getByLabel('Комментарий клиенту').fill('Данные проверены: одобряем исходную сумму');
    await bank.getByRole('button', { name: 'Одобрить', exact: true }).click();
    await director.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    await director.getByText('Комментарий банка: Данные проверены: одобряем исходную сумму', { exact: true }).waitFor();
    const reviewed = await (await request(director, `/applications/${counterId}`)).json();
    assert.equal(reviewed.decision.approved_amount, 10000000);
    assert.equal(reviewed.events.at(-1).details.reviewer, 'underwriter');
    await bank.screenshot({ path: path.join(artifacts, 'BANK_WORKSPACE.png'), fullPage: true });
    await bank.getByLabel('Комментарий клиенту').fill('Уточнение: заявка отклонена сотрудником');
    await bank.getByRole('button', { name: 'Отказать', exact: true }).click();
    await director.getByRole('heading', { name: 'Сейчас не можем одобрить кредит', exact: true }).waitFor({ timeout: 20000 });
    assert.equal((await request(director, '/bank/applications')).status(), 403);

    await director.getByRole('button', { name: 'Начать заново', exact: true }).click();
    await submit(director, 'Альфа Ритейл');
    await director.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    const accountant = await enter('Бухгалтер Альфа Ритейл');
    const history = await (await request(accountant, '/applications')).json();
    assert(history.length > 0);
    assert(history.every(item => item.company_name === 'ООО «Альфа Ритейл»'));
    await accountant.getByRole('button', { name: /Альфа Ритейл/ }).last().click();
    await accountant.getByText('Подписать может руководитель', { exact: true }).waitFor();
    assert.equal(await accountant.getByRole('button', { name: 'Подписать договор онлайн', exact: true }).count(), 0);
    assert.equal((await request(accountant, `/applications/${history[0].id}/sign`, 'POST', { code: '1234' })).status(), 403);
    assert.equal((await request(accountant, `/applications/${counterId}`)).status(), 404);
    await accountant.screenshot({ path: path.join(artifacts, 'ACCOUNTANT_VIEW.png'), fullPage: true });

    await director.getByRole('button', { name: 'Изменить условия', exact: true }).click();
    await director.getByRole('button', { name: 'Назад к компании', exact: true }).click();
    await director.getByRole('button', { name: 'Отключить БКИ', exact: true }).click();
    const failureId = await submit(director, 'Альфа Ритейл');
    await director.getByRole('heading', { name: 'Нужна повторная проверка', exact: true }).waitFor({ timeout: 20000 });
    await director.getByRole('button', { name: 'Восстановить БКИ', exact: true }).click();
    await director.getByRole('button', { name: 'Повторить проверку', exact: true }).click();
    await director.getByRole('heading', { name: 'Кредит одобрен', exact: true }).waitFor({ timeout: 20000 });
    assert.equal((await (await request(director, `/applications/${failureId}`)).json()).decision.score, 97);
    await director.screenshot({ path: path.join(artifacts, 'BKI_RECOVERED.png'), fullPage: true });
    const oldToken = await director.evaluate(() => sessionStorage.getItem('credit-cabinet:session'));
    await director.getByRole('button', { name: 'Выйти', exact: true }).click();
    await director.getByRole('heading', { name: 'Вход в кредитный кабинет', exact: true }).waitFor();
    assert.equal((await director.context().request.get(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${oldToken}` } })).status(), 401);
    assert.deepEqual(errors, []);
    console.log('UI OK: login, bank approve/reject, live client update, accountant 403, company isolation, BKI controls and logout');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
