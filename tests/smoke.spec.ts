import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Fast sanity checks (~1 minute total)
 * Run these frequently during development.
 * Full batch tests are in demo-pickup.spec.ts for comprehensive testing.
 */

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth and dismiss modals
    await page.addInitScript(() => {
      localStorage.setItem('robosim-auth', JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: 'test', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
          profile: { id: 'test', email: 'test@test.com', tier: 'free', usage: {} },
        },
        version: 0,
      }));
      // Dismiss welcome and onboarding modals
      localStorage.setItem('robosim-welcomed', 'true');
      localStorage.setItem('robosim_onboarding_completed', 'true');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(1500);
  });

  test('App loads with canvas and controls', async ({ page }) => {
    // Canvas should be visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Train Robot panel should be visible
    await expect(page.locator('text=Train Robot')).toBeVisible();

    // Demo buttons should be visible
    await expect(page.locator('button:has-text("Generate")')).toBeVisible();
    await expect(page.locator('button:has-text("Test Single Pickup")')).toBeVisible();
  });

  test('Single demo pickup works', async ({ page }, testInfo) => {
    testInfo.setTimeout(45000);

    // Click single pickup
    const button = page.locator('button:has-text("Test Single Pickup")');
    await button.click();

    // Wait for demo to complete (arm should move)
    await page.waitForTimeout(5000);

    // Verify arm moved and cube exists
    const state = await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (!store) return null;
      const s = store.getState();
      return {
        hasObjects: (s.objects?.length || 0) > 0,
        armMoved: s.joints?.shoulder !== 0 || s.joints?.elbow !== 0,
      };
    });

    expect(state?.hasObjects).toBe(true);
    expect(state?.armMoved).toBe(true);
  });

  test('Quick batch demo (3 demos max)', async ({ page }, testInfo) => {
    testInfo.setTimeout(120000); // 2 minutes max

    // Reset state
    await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store) {
        store.getState().setJoints({
          base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100
        });
        store.getState().clearObjects();
      }
    });

    // Track demos via console
    let demosStarted = 0;
    page.on('console', msg => {
      if (msg.text().includes('Spawning cube at')) {
        demosStarted++;
      }
    });

    // Click batch demo
    const batchButton = page.locator('button').filter({ hasText: /Generate.*Demo/ }).first();
    await batchButton.click();

    // Wait for at least 3 demos to start (enough to verify variety)
    const startTime = Date.now();
    while (demosStarted < 3 && Date.now() - startTime < 90000) {
      await page.waitForTimeout(500);
    }

    console.log(`Quick test: ${demosStarted} demos started`);
    expect(demosStarted).toBeGreaterThanOrEqual(3);
  });
});
