import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1080 },
  deviceScaleFactor: 1,
});
await page.route('**/__local-workspaces', (r) => r.fulfill({ json: [] }));
await page.goto('http://127.0.0.1:4317');
await page.locator('.react-flow__node').first().waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/images/workflow.png', fullPage: true });
await page.getByRole('tab', { name: 'Skill library', exact: true }).click();
await page.locator('.library-card').first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/images/skill.png', fullPage: true });
await browser.close();
