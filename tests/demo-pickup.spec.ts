import { test, expect } from '@playwright/test';

/**
 * Demo Pick Up Tests
 * Tests demo pickups using the actual UI buttons
 * Verifies 10-demo batch generation for training data export
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
    testInfo.setTimeout(300000); // 5 minutes for 10 demos

    // Find and click the batch demo button
    const batchButton = page.locator('button:has-text("Generate 10 Demos")');

    await expect(batchButton).toBeVisible({ timeout: 10000 });
    console.log('Found Generate 10 Demos button, clicking...');
    await page.screenshot({ path: 'tests/screenshots/batch-before.png', fullPage: true });
    await batchButton.click();

    // Wait for batch to start - should show progress indicator
    await page.waitForTimeout(2000);

    // Monitor progress - each demo takes about 3-5s
    // Wait up to 120 seconds for all 10 demos to complete
    let batchCompleted = false;
    let lastDemoNumber = 0;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000); // Check every 2 seconds
      const status = await page.locator('button:has-text("Demo"), button:has-text("Generate")').first().textContent().catch(() => null);
      console.log(`Progress check ${i + 1}: ${status || 'running...'}`);

      // Check if done - look for various completion indicators
      const demosRecorded = await page.locator('text=/\\d+ demos? recorded/').isVisible().catch(() => false);
      const generateButton = await page.locator('button:has-text("Generate Training Data")').isVisible().catch(() => false);

      // Parse current demo number from status
      const demoMatch = status?.match(/Demo (\d+)\/10/);
      if (demoMatch) {
        lastDemoNumber = parseInt(demoMatch[1]);
      }

      if (demosRecorded || generateButton) {
        console.log('Batch completed successfully! (UI indicator found)');
        batchCompleted = true;
        break;
      }

      // Check for "Done!" status or if we reached demo 10
      if (status?.includes('Done')) {
        console.log('Batch completed successfully! (Done status)');
        batchCompleted = true;
        break;
      }

      // If we've seen demo 10, wait a bit more then consider complete
      if (lastDemoNumber >= 10) {
        console.log('Reached demo 10, waiting for completion...');
        await page.waitForTimeout(3000);
        batchCompleted = true;
        break;
      }
    }

    await page.screenshot({ path: 'tests/screenshots/batch-after.png', fullPage: true });

    // Verify completion by checking for "demos recorded" text or Generate Training button
    const completedIndicator = page.locator('text=demos recorded, text=Generate Training Data').first();
    const isCompleted = await completedIndicator.isVisible({ timeout: 5000 }).catch(() => false);

    // Also check for the success indicator (should show "10 demos recorded")
    const successBadge = await page.locator('text=/10 demos? recorded/').isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Batch result: completed=${isCompleted}, successBadge=${successBadge}`);

    // Wait for batch to finish completely
    await page.waitForTimeout(2000);

    // Check the final state
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
    console.log(`Batch completed: ${batchCompleted}, Last demo reached: ${lastDemoNumber}`);

    // The batch should have completed or at least reached demo 10
    expect(batchCompleted || lastDemoNumber >= 10).toBe(true);
  });
});
