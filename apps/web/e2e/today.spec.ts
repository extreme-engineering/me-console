import { expect, test } from '@playwright/test';
import { addTodoViaToday, registerAndOpenToday } from './helpers';

test('今日快速添加待办并勾选完成', async ({ page }) => {
  await registerAndOpenToday(page);

  const item = await addTodoViaToday(page, 'e2e 快速待办 A');
  await item.getByRole('button').first().click();
  await expect(item).not.toBeVisible();

  // 完成数落在统计条上（今日数据/已完成计数）
  await expect(page.getByText(/1\s*项已完成/)).toBeVisible();
});
