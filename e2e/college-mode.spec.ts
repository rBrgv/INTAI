import { test, expect } from '@playwright/test';

test.describe('College Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mode');
  });

  test('should complete college mode setup flow', async ({ page }) => {
    // Select college mode
    await page.click('text=College');
    await expect(page).toHaveURL(/.*\/college/);

    // Step 1: Job Description
    const jdText = 'We are looking for a Senior Software Engineer with expertise in React, TypeScript, and Node.js. The ideal candidate should have experience with cloud platforms and microservices architecture. Strong problem-solving skills and ability to work in a fast-paced environment are essential.';
    await page.fill('textarea[placeholder*="Job Description"]', jdText);
    await page.click('button:has-text("Next")');

    // Step 2: Skills
    await page.waitForSelector('text=/Skills|JavaScript|React/i', { timeout: 10000 });
    await page.click('button:has-text("Next")');

    // Step 3: Configuration
    await page.selectOption('select[name*="questionCount"]', '15');
    await page.selectOption('select[name*="difficultyCurve"]', 'balanced');
    await page.click('button:has-text("Next")');

    // Step 4: Review and create template
    await page.click('button:has-text("Create Template")');

    // Should navigate to dashboard or show success
    await expect(page).toHaveURL(/.*\/college.*/, { timeout: 10000 });
  });
});

