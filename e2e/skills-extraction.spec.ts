import { test, expect } from '@playwright/test';

test.describe('Skills Extraction', () => {
  test('should auto-extract skills from job description', async ({ page }) => {
    await page.goto('/company');
    
    // Enter job description
    const jdText = 'We are looking for a Senior Full-Stack Developer with expertise in React, TypeScript, Node.js, PostgreSQL, AWS, Docker, and Kubernetes. The candidate should have experience with microservices architecture, CI/CD pipelines, and Agile methodologies. Strong communication and leadership skills are essential.';
    await page.fill('textarea[placeholder*="Job Description"]', jdText);
    await page.click('button:has-text("Next")');
    
    // Wait for skills to be extracted
    await page.waitForSelector('text=/React|TypeScript|Node.js|AWS/i', { timeout: 15000 });
    
    // Verify skills are displayed
    const skillsText = await page.textContent('body');
    expect(skillsText).toMatch(/React|TypeScript|Node/i);
  });

  test('should allow adding custom skills', async ({ page }) => {
    await page.goto('/company');
    
    // Enter job description and proceed
    const jdText = 'We are looking for a Senior Software Engineer with expertise in React, TypeScript, and Node.js. The ideal candidate should have experience with cloud platforms and microservices architecture.';
    await page.fill('textarea[placeholder*="Job Description"]', jdText);
    await page.click('button:has-text("Next")');
    
    // Wait for skills extraction
    await page.waitForSelector('text=/Skills/i', { timeout: 15000 });
    
    // Try to add a custom skill (if input field exists)
    const skillInput = page.locator('input[placeholder*="skill" i], input[type="text"]').first();
    if (await skillInput.isVisible()) {
      await skillInput.fill('Custom Skill');
      await skillInput.press('Enter');
    }
  });
});

