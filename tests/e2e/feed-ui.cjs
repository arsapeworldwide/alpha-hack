const { signIn } = require('./auth-helpers.cjs');
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
    await signIn(page, context, base);
    const section = page.getByRole('region', { name: 'Полезное для бизнеса' });
    const tabs = section.getByRole('group', { name: 'Раздел ленты' });
    const seen = new Set();
    for (const [segment, label] of [
      ['retail', 'Ритейл'], ['services', 'Услуги'],
      ['production', 'Производство'], ['general', 'Для всех'],
    ]) {
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes(`/api/feed?segment=${segment}&context=default`)),
        tabs.getByRole('button', { name: label, exact: true }).click(),
      ]);
      assert.equal(response.status(), 200);
      const feed = await response.json();
      assert.equal(feed.items.length, segment === 'general' ? 4 : 5);
      for (const item of feed.items) {
        await section.getByText(item.title, { exact: true }).waitFor();
        assert(!seen.has(item.id));
        seen.add(item.id);
      }
      assert.equal(await tabs.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
    }
    await page.getByRole('radio', { name: /Вектор/ }).click();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.getByRole('checkbox', { name: /Даю согласие на запрос кредитной истории/ }).check();
    await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
    await page.getByRole('heading', { name: 'Сейчас не можем одобрить кредит', exact: true }).waitFor({ timeout: 20000 });
    const rejected = await (await context.request.get(`${base}/api/feed?segment=production&context=rejected`)).json();
    assert.deepEqual(rejected.items.slice(0, 3).map(item => item.tag), Array(3).fill('Повысить шансы'));
    for (const item of rejected.items) await section.getByText(item.title, { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('UI OK: four feed tabs, 19 distinct articles and three prioritized rejection tips');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
