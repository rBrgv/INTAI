import { test, expect } from '@playwright/test';

test.describe('Company Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mode');
  });

  test('should complete company mode setup flow', async ({ page }) => {
    // Select company mode
    await page.click('text=Company');
    await expect(page).toHaveURL(/.*\/company/);

    // Step 1: Upload resume
    const resumeText = 'Experienced software engineer with 10+ years in full-stack development. Proficient in JavaScript, TypeScript, React, Node.js, and cloud technologies. Led multiple teams and delivered scalable applications.';
    await page.fill('textarea', resumeText);
    await page.click('button:has-text("Next")');

    // Step 2: Job description
    const jdText = 'We are looking for a Senior Software Engineer with expertise in React, TypeScript, and Node.js. The ideal candidate should have experience with cloud platforms and microservices architecture. Strong problem-solving skills and ability to work in a fast-paced environment are essential.';
    await page.fill('textarea[placeholder*="Job Description"]', jdText);
    await page.click('button:has-text("Next")');

    // Step 3: Skills (should be auto-extracted, but we can add more)
    await page.waitForSelector('text=/Skills|JavaScript|React/i', { timeout: 10000 });
    await page.click('button:has-text("Next")');

    // Step 4: Configuration
    await page.selectOption('select[name*="questionCount"]', '10');
    await page.selectOption('select[name*="difficultyCurve"]', 'balanced');
    await page.click('button:has-text("Next")');

    // Step 5: Review and start
    await page.click('button:has-text("Begin Interview")');

    // Should navigate to interview page
    await expect(page).toHaveURL(/.*\/interview\/.*/, { timeout: 10000 });
  });
});

