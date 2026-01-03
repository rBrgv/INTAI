import { test, expect } from '@playwright/test';

test.describe('Interview Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the mode selection page
    await page.goto('/mode');
  });

  test('should complete individual mode interview flow', async ({ page }) => {
    // Select individual mode
    await page.click('text=Individual');
    await expect(page).toHaveURL(/.*\/individual/);

    // Fill in role and level
    await page.fill('input[placeholder*="Role"]', 'Software Engineer');
    await page.selectOption('select', 'senior');
    await page.click('button:has-text("Next")');

    // Upload resume (using text input for simplicity)
    const resumeText = 'Experienced software engineer with 10+ years in full-stack development. Proficient in JavaScript, TypeScript, React, Node.js, and cloud technologies. Led multiple teams and delivered scalable applications.';
    await page.fill('textarea', resumeText);
    await page.click('button:has-text("Next")');

    // Start interview
    await page.click('button:has-text("Begin Interview")');

    // Wait for interview page to load
    await expect(page).toHaveURL(/.*\/interview\/.*/);

    // Check that question is displayed
    await expect(page.locator('text=/Question|AI Interviewer/i')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate between questions', async ({ page }) => {
    // This test assumes an interview session is already in progress
    // In a real scenario, you'd set up the session first
    test.skip(); // Skip for now as it requires session setup
  });
});

