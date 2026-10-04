import { expect, test } from '@playwright/test';
import { registerAndOpenToday } from './helpers';

// 保存接口指向真实仓库文件（dev 中间件），e2e 一律拦截 fulfill，绝不写盘
test('OKR 文档：在线编辑保存与勾选均写回同一份内容', async ({ page }) => {
  const savedBodies: string[] = [];
  await page.route('**/__okr-doc/**', async (route) => {
    savedBodies.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await registerAndOpenToday(page);
  await page.goto('/#/direction?tab=okrdoc');

  const editor = page.getByLabel('OKR markdown 编辑器');
  await expect(editor).toBeVisible();

  // 编辑 → 预览实时更新 → 保存
  await editor.fill('# E2E OKR 标题\n\n- [ ] e2e 待办项\n');
  await expect(page.getByRole('heading', { name: 'E2E OKR 标题' })).toBeVisible();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('已保存到 docs/目标/2026-10-OPC-OKR.md')).toBeVisible();
  expect(savedBodies.at(-1)).toContain('# E2E OKR 标题');

  // 预览里勾选 checkbox → 自动保存 `- [x]`
  await page.getByRole('checkbox').first().check();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await expect.poll(() => savedBodies.at(-1)).toContain('- [x] e2e 待办项');

  // 切到「目标与项目」，OKR 卡片展示的是编辑后的内容
  await page.getByRole('tab', { name: '目标与项目' }).click();
  await page.getByRole('button', { name: /2026-10 OKR/ }).click();
  await expect(page.getByRole('heading', { name: 'E2E OKR 标题' })).toBeVisible();

  // 卡片里直接取消勾选 → 同样自动保存回文件内容
  await page.getByRole('checkbox').first().uncheck();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  await expect.poll(() => savedBodies.at(-1)).toContain('- [ ] e2e 待办项');
});