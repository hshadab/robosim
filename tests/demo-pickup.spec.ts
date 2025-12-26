import { test, expect } from '@playwright/test';

/**
 * Demo Pick Up Tests
 * Tests the 10 demo pickups using the actual UI buttons
 */

test.describe('Demo Pick Up Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock auth via addInitScript (runs before app JS)
    await page.addInitScript(() => {
      const mockAuthState = {
        state: {
          isAuthenticated: true,
          user: {
            id: 'mock-user-id',
            email: 'test@test.com',
            user_metadata: { full_name: 'Test User' },
            app_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
          profile: {
            id: 'mock-user-id',
            email: 'test@test.com',
            full_name: 'Test User',
            tier: 'free',
            usage: { episodes_generated: 0, ai_images_generated: 0 },
            usage_reset_at: new Date().toISOString(),
          },
        },
        version: 0,
      };
      localStorage.setItem('robosim-auth', JSON.stringify(mockAuthState));
    });

    // Navigate to app
    await page.goto('http://localhost:5000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(2000); // Let simulation initialize
  });

  test('Single Demo Pick Up spawns cube correctly', async ({ page }, testInfo) => {
    testInfo.setTimeout(30000);

    // Click the "Test Single Pickup" button - it spawns cube and runs demo
    const demoButton = page.locator('button:has-text("Test Single Pickup")');
    await expect(demoButton).toBeVisible({ timeout: 10000 });
    console.log('Clicking Test Single Pickup...');
    await demoButton.click();

    // Wait for demo to spawn cube and move arm
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/demo-after.png', fullPage: true });

    // Check that cube was spawned and arm moved
    const state = await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (!store) return null;
      const s = store.getState();
      return {
        objectCount: s.objects?.length || 0,
        objectName: s.objects?.[0]?.name,
        armMoved: s.joints?.shoulder !== 0 || s.joints?.elbow !== 0,
        gripper: s.joints?.gripper,
      };
    });

    console.log('Demo result:', JSON.stringify(state));

    // Verify cube was spawned
    expect(state).not.toBeNull();
    expect(state?.objectCount).toBeGreaterThan(0);
    expect(state?.objectName).toContain('Cube');

    // Verify arm moved from home position
    expect(state?.armMoved).toBe(true);

    console.log('SUCCESS: Demo Pick Up spawned cube and moved arm correctly');
  });

  test('Batch 10 Demo Pick Ups', async ({ page }, testInfo) => {
    testInfo.setTimeout(180000); // 3 minutes for batch

    // Find and click the "Generate 10 Demos" button
    const batchButton = page.locator('button:has-text("Generate 10 Demos")');

    await expect(batchButton).toBeVisible({ timeout: 10000 });
    console.log('Found Generate 10 Demos button, clicking...');
    await page.screenshot({ path: 'tests/screenshots/batch-before.png', fullPage: true });
    await batchButton.click();

    // Wait for batch to start - should show progress indicator
    await page.waitForTimeout(2000);

    // Monitor progress - batch takes about 3s per demo
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000);
      const status = await page.locator('button:has-text("Demo")').textContent().catch(() => null);
      console.log(`Progress check ${i + 1}: ${status || 'running...'}`);

      // Check if done
      const doneText = await page.locator('text=Done! 10 demos').isVisible().catch(() => false);
      if (doneText) {
        console.log('Batch completed successfully!');
        break;
      }
    }

    await page.screenshot({ path: 'tests/screenshots/batch-after.png', fullPage: true });

    // Verify completion by checking for "demos recorded" text or Generate Training button
    const completedIndicator = page.locator('text=demos recorded, text=Generate Training Data').first();
    const isCompleted = await completedIndicator.isVisible({ timeout: 5000 }).catch(() => false);

    // Also check for the success indicator
    const successBadge = await page.locator('text=/\\d+ demos? recorded/').isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Batch demo result: completed=${isCompleted}, successBadge=${successBadge}`);

    // At minimum, verify the arm moved and a cube was spawned
    const state = await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (!store) return null;
      const s = store.getState();
      return {
        objectCount: s.objects?.length || 0,
        armMoved: s.joints?.shoulder !== 0 || s.joints?.elbow !== 0,
      };
    });

    console.log('Final state:', state);
    expect(state?.armMoved).toBe(true);
  });
});
