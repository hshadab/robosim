#!/usr/bin/env node
// Playwright visual test - uses WSLg if available, otherwise uses channel to launch Edge
import { chromium } from '@playwright/test';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log('');
  console.log('================================================================');
  console.log('   PLAYWRIGHT VISUAL TEST - Attempting to open visible browser');
  console.log('================================================================');
  console.log('');

  let browser;
  try {
    // Try to launch with WSLg (requires Windows 11 with WSLg)
    console.log('Launching browser (using WSLg or Edge channel)...');

    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',  // Use Edge from Windows
      args: ['--start-maximized']
    });

    const context = await browser.newContext({
      viewport: null  // Use full window
    });
    const page = await context.newPage();

    console.log('Browser launched! Navigating to app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await wait(3000);

    // Step 1: Get Started
    console.log('Step 1: Clicking Get Started...');
    try {
      await page.getByRole('button', { name: /get started/i }).click({ timeout: 8000 });
    } catch {
      try {
        await page.getByRole('button', { name: /try it/i }).click({ timeout: 3000 });
      } catch {
        console.log('   No Get Started button found');
      }
    }
    await wait(3000);

    // Step 2: Quick Demo Login
    console.log('Step 2: Clicking Quick Demo Login...');
    try {
      await page.getByRole('button', { name: /quick demo/i }).click({ timeout: 8000 });
    } catch {
      console.log('   No Quick Demo button found');
    }
    await wait(4000);

    // Step 3: Skip tutorial
    console.log('Step 3: Dismissing any modals...');
    try {
      await page.getByRole('button', { name: /skip/i }).click({ timeout: 3000 });
    } catch {}
    try {
      await page.getByRole('button', { name: /close/i }).click({ timeout: 2000 });
    } catch {}
    try {
      await page.getByRole('button', { name: /got it/i }).click({ timeout: 2000 });
    } catch {}
    await page.keyboard.press('Escape');
    await wait(2000);

    // Step 4: Add Tennis Ball
    console.log('Step 4: Adding Tennis Ball...');
    try {
      await page.getByRole('button', { name: /standard object/i }).click({ timeout: 5000 });
      await wait(2000);
      await page.getByText('Toys').click({ timeout: 3000 });
      await wait(1000);
      await page.getByText('Tennis Ball').click({ timeout: 3000 });
      await wait(3000);
    } catch (e) {
      console.log('   Could not add ball:', e.message.split('\n')[0]);
    }

    // Step 5: Send pickup command
    console.log('');
    console.log('================================================================');
    console.log('Step 5: SENDING PICKUP COMMAND - WATCH THE ROBOT!');
    console.log('================================================================');
    console.log('');

    try {
      const input = page.locator('input[type="text"]').first();
      await input.click();
      await input.fill('Pick up the tennis ball');
      await page.keyboard.press('Enter');
      console.log('   Command sent! Watch the robot move!');
    } catch (e) {
      console.log('   Could not send command:', e.message.split('\n')[0]);
    }

    console.log('');
    console.log('================================================================');
    console.log('   Browser will stay open. Press Ctrl+C when done watching.');
    console.log('================================================================');

    await wait(300000); // 5 minutes

  } catch (error) {
    console.error('');
    console.error('ERROR:', error.message.split('\n')[0]);

    if (error.message.includes('Executable') || error.message.includes('channel')) {
      console.log('');
      console.log('Edge not available. Opening browser manually...');

      // Fall back to opening browser manually via Windows
      const { execSync } = await import('child_process');
      execSync('cmd.exe /c start http://localhost:5173', { stdio: 'ignore' });

      console.log('');
      console.log('================================================================');
      console.log('  A browser should have opened on your Windows desktop.');
      console.log('');
      console.log('  MANUAL STEPS:');
      console.log('  1. Click "Get Started" button');
      console.log('  2. Click "Quick Demo Login"');
      console.log('  3. Click "Skip" if you see a tutorial');
      console.log('  4. Click "Use Standard Object" > "Toys" > "Tennis Ball"');
      console.log('  5. Type: "Pick up the tennis ball" and press Enter');
      console.log('  6. Watch the robot arm pick up the ball!');
      console.log('================================================================');
    }
  } finally {
    // Keep running for observation
    await wait(60000);
    if (browser) {
      await browser.close();
    }
  }
}

runTest();
