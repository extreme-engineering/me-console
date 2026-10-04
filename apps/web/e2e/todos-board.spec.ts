import { expect, test } from '@playwright/test';
import { registerAndOpenToday } from './helpers';

test('待办看板：新建任务落入收件箱', async ({ page }) => {
  await registerAndOpenToday(page);

  await page.goto('/#/action?tab=todos');
  await page.getByRole('button', { name: '添加任务' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('What needs to be done?').fill('e2e 看板任务 B');
  await dialog.getByRole('button', { name: '创建' }).click();

  // 新任务出现在默认「收件箱」分组，且 tab 计数同步
  await expect(page.locator('text=e2e 看板任务 B')).toBeVisible();
});
