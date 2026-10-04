import { expect, test } from '@playwright/test';
import { registerAndOpenToday } from './helpers';

test('每日反思：添加庆祝事项并保存，刷新后仍在', async ({ page }) => {
  await registerAndOpenToday(page);

  await page.goto('/#/reflection?tab=daily');
  await expect(page.getByRole('heading', { name: '每日复盘' })).toBeVisible();

  // 「值得庆祝的事」与「可以改进的」两个区块的输入框同占位符，用区块标题区分
  const celebInput = page
    .locator('div.card', { has: page.getByText('值得庆祝的事') })
    .getByPlaceholder('输入后回车添加');
  await celebInput.fill('e2e 庆祝事项');
  await celebInput.press('Enter');
  await expect(page.getByText('e2e 庆祝事项')).toBeVisible();

  await page.getByPlaceholder('写下你今天的想法和感受...').fill('e2e 反思正文内容');

  await page.getByRole('button', { name: '保存', exact: true }).click();

  // 保存成功：existingId 就位后「删除」按钮才出现
  await expect(page.getByRole('button', { name: '删除' })).toBeVisible();

  // 刷新后数据从存储回读，庆祝事项与正文仍在
  await page.reload();
  await expect(page.getByText('e2e 庆祝事项')).toBeVisible();
  await expect(page.getByPlaceholder('写下你今天的想法和感受...')).toHaveValue('e2e 反思正文内容');
});
