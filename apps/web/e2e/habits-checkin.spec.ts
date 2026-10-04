import { expect, test } from '@playwright/test';
import { registerAndOpenToday } from './helpers';

test('习惯：创建后在今日页打卡', async ({ page }) => {
  await registerAndOpenToday(page);

  await page.goto('/#/action?tab=habits');
  await page.getByRole('button', { name: '添加习惯' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('e.g. 冥想').fill('e2e 冥想习惯');
  await dialog.getByRole('button', { name: '创建习惯' }).click();

  await expect(page.locator('text=e2e 冥想习惯')).toBeVisible();

  // 回到今日页，习惯出现在「习惯打卡」区并可打卡
  await page.goto('/#/');
  const habitCard = page.locator('div.card', { hasText: 'e2e 冥想习惯' });
  await expect(habitCard).toBeVisible();
  await habitCard.getByRole('button', { name: '打卡' }).click();
  await expect(habitCard.getByRole('button', { name: '已完成' })).toBeVisible();

  // 今日页顶部打卡统计同步为 1 / 1
  await expect(page.locator('text=/^1\\s*\\/\\s*1$/')).toBeVisible();
});
