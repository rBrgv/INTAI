import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('should handle invalid session ID gracefully', async ({ page }) => {
    const invalidSessionId = 'invalid-session-id-12345';
    await page.goto(`/interview/${invalidSessionId}`);
    
    // Should show error message or redirect
    await expect(page.locator('text=/error|not found|invalid/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/mode');
    await page.click('text=Individual');
    
    // Should show error message
    await expect(page.locator('text=/error|network|connection/i')).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/individual');
    
    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")');
    
    // Should show validation error
    await expect(page.locator('text=/required|invalid|error/i')).toBeVisible({ timeout: 3000 });
  });
});

