import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const demo = JSON.parse(await readFile(new URL('../src/data/demo.json', import.meta.url), 'utf8'));
test.beforeEach(async ({ page }) => {
  await page.route('**/__local-workspaces', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
});
test('map, inspector, full Markdown, original source and reference navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(
    page.getByRole('heading', { name: 'Prospecting pipeline', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Step by step' }).click();
  await page.locator('.walk-step').first().click();
  await expect(page.getByLabel('Skill inspector')).toBeVisible();
  await expect(page.locator('.markdown')).toContainText('Calibrate the idea');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.locator('.source-code')).toContainText('name: campaign-ideation');
  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await page.locator('.markdown').getByRole('button', { name: 'the handoff contract' }).click();
  await expect(page.locator('.markdown')).toContainText('Strategy handoff');
  expect(errors).toEqual([]);
});
test('search, empty state and source file browsing', async ({ page }) => {
  await page.getByLabel('Search skills and source files').fill('deliverability');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.getByLabel('Search skills and source files').fill('zzzz-no-such-skill');
  await expect(page.getByText('No skills match')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Source files' }).click();
  await expect(page.locator('.source-row')).toHaveCount(6);
  await page.locator('.source-row').filter({ hasText: 'AGENTS.md' }).click();
  await expect(page.locator('.markdown')).toContainText('Repository instructions');
});
test('edits persist across reload and invalid manifest is recoverable', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit workflow' }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('My prospecting map');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My prospecting map', exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'My prospecting map', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit workflow' }).click();
  await page.getByRole('button', { name: 'Manifest JSON', exact: true }).click();
  await page.getByLabel('Version 1 workflow manifest').fill('{invalid');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Close dialog').click();
  await expect(
    page.getByRole('heading', { name: 'My prospecting map', exact: true }),
  ).toBeVisible();
});
test('imports portable bundles, reports missing references, and recovers from bad imports', async ({
  page,
}) => {
  if (await page.getByLabel('Open navigation').isVisible())
    await page.getByLabel('Open navigation').click();
  await page.getByRole('button', { name: 'Import a workflow', exact: true }).first().click();
  const input = page.getByLabel('Import workflow bundle');
  await input.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  const imported = {
    version: 1,
    id: 'imported',
    title: 'Imported skills',
    description: 'Local files',
    files: [
      {
        path: 'skills/test/SKILL.md',
        content:
          '---\nname: test\ndescription: Imported skill\n---\n# Test\n\nHandoff to $missing.\n\n[Missing](../missing.md)',
      },
    ],
  };
  await input.setInputFiles({
    name: 'custom.atlas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.getByRole('heading', { name: 'Imported skills', exact: true })).toBeVisible();
  await expect(page.getByText('These lines show skill references')).toBeVisible();
  await expect(page.getByRole('button', { name: '2 source issues' })).toBeVisible();
});
test('imports a repository folder with the authored manifest', async ({ page }) => {
  if (await page.getByLabel('Open navigation').isVisible())
    await page.getByLabel('Open navigation').click();
  await page.getByRole('button', { name: 'Import a workflow', exact: true }).first().click();
  await page
    .getByLabel('Import skill folder')
    .setInputFiles(fileURLToPath(new URL('../examples/prospecting', import.meta.url)));
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Source references checked' })).toBeVisible();
});
test('exports offline HTML, SVG and portable bundle', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Share & export' }).click();
  const [htmlDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Shareable HTML' }).click(),
  ]);
  const path = await htmlDownload.path();
  const html = await readFile(path!, 'utf8');
  expect(html).toContain('Original source');
  expect(html).toContain('<svg');
  const snapshot = await context.newPage();
  const remote: string[] = [];
  snapshot.on('request', (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await snapshot.setContent(html);
  await expect(
    snapshot.getByRole('heading', { name: 'Prospecting pipeline', exact: true }),
  ).toBeVisible();
  await snapshot.locator('a[href="#step-ideation"]').click();
  expect(remote).toEqual([]);
  await snapshot.close();
  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Workflow diagram' }).click(),
  ]);
  expect(await readFile((await svg.path())!, 'utf8')).toContain('<svg');
  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Portable workspace' }).click(),
  ]);
  const exported = JSON.parse(await readFile((await json.path())!, 'utf8'));
  expect(exported.files).toEqual(demo[0].files);
});
test('responsive view has no page overflow, dialogs retain focus, and diagram direction changes', async ({
  page,
}, info) => {
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  const before = await page.locator('.react-flow__node').first().getAttribute('style');
  await page.getByLabel('Change diagram direction').click();
  await page.waitForTimeout(400);
  const after = await page.locator('.react-flow__node').first().getAttribute('style');
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Share & export' }).click();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-workspace.png`,
    fullPage: true,
  });
});

test('diagram skills can be read from the keyboard and search shortcut works', async ({ page }) => {
  const node = page.getByRole('button', { name: 'Read Calibrate the campaign', exact: true });
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Skill inspector')).toBeVisible();
  await page.getByLabel('Close inspector').click();
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search skills and source files')).toBeFocused();
});
test('development imports do not overwrite browser edits on reload', async ({ page }) => {
  const local = { ...demo[0], id: 'local-fixture', title: 'Local fixture' };
  await page.route('**/__local-workspaces', (r) => r.fulfill({ json: [local] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Local fixture', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit workflow' }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Locally edited workflow');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Locally edited workflow', exact: true }),
  ).toBeVisible();
});
test('storage failures keep the app and export available', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Quota exceeded');
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Browser storage is full or unavailable');
  await page.getByRole('button', { name: 'Share & export' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Portable workspace' }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('.atlas.json');
});

test('source evidence opens exact lines and human review invalidates after a workflow edit', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await expect(page.getByText('7 / 7 cited')).toBeVisible();
  const edge = page.locator('.evidence-card').first();
  await edge.locator('summary').click();
  await expect(edge).toContainText('Exact excerpt matches imported source');
  await edge.getByRole('button', { name: 'Open source lines' }).click();
  await expect(page.locator('.source-line.highlighted')).toContainText(
    'Pass only the concise execution fields',
  );
  await page.getByLabel('Close inspector').click();
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await page.getByRole('button', { name: 'Mark snapshot reviewed' }).click();
  await expect(page.locator('.review-badge')).toHaveText('Reviewed snapshot');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('.source-status-bar')).toContainText('Reviewed snapshot');
  await page.getByRole('button', { name: 'Edit workflow' }).click();
  await page.getByLabel('Workflow title', { exact: true }).fill('Updated workflow');
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(page.locator('.source-status-bar')).toContainText('Needs review');
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-source-review.png`,
    fullPage: true,
  });
});

test('source refresh previews changes, cancels safely, preserves overlay and flags stale citations', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await page.getByRole('button', { name: 'Mark snapshot reviewed' }).click();
  await expect(page.locator('.review-badge')).toHaveText('Reviewed snapshot');
  const updated = structuredClone(demo[0]);
  const path = updated.manifest.connections[0].evidence[0].path;
  const quote = updated.manifest.connections[0].evidence[0].quote;
  updated.files.find((f: { path: string }) => f.path === path).content = updated.files
    .find((f: { path: string }) => f.path === path)
    .content.replace(quote, 'The handoff instruction has changed.');
  updated.manifest.title = 'Incoming workflow';
  async function stage() {
    await page.getByRole('button', { name: 'Compare updated folder or bundle' }).click();
    await page.getByLabel('Import workflow bundle').setInputFiles({
      name: 'updated.atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(updated)),
    });
    await expect(page.getByRole('heading', { name: 'Review source changes.' })).toBeVisible();
    await expect(page.getByText('1 source file changes')).toBeVisible();
  }
  await stage();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'Prospecting pipeline', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.source-status-bar')).toContainText('Reviewed snapshot');
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await stage();
  await page.getByRole('button', { name: 'Apply source update' }).click();
  await expect(
    page.getByRole('heading', { name: 'Prospecting pipeline', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.source-status-bar')).toContainText('Needs review');
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark snapshot reviewed' })).toBeDisabled();
  await expect(page.locator('.evidence-card').first()).toContainText('Evidence needs attention');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('.source-status-bar')).toContainText('Needs review');
});

test('public GitHub import pins a commit and refresh waits for explicit application', async ({
  page,
}) => {
  const { createHash } = await import('node:crypto');
  let revision = 0;
  const contents = [
    '---\nname: example\n---\n# Example\nOriginal instructions.\n',
    '---\nname: example\n---\n# Example\nChanged instructions.\n',
  ];
  const blobs = contents.map((content) => {
    const bytes = Buffer.from(content);
    return {
      content,
      sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      size: bytes.length,
    };
  });
  await page.route('https://api.github.com/repos/fictional/skills/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/commits/')) {
      await route.fulfill({
        json: {
          sha: (revision ? 'b' : 'a').repeat(40),
          commit: { tree: { sha: (revision ? 'd' : 'c').repeat(40) } },
        },
      });
      return;
    }
    if (url.includes('/git/trees/')) {
      const blob = blobs[revision];
      await route.fulfill({
        json: {
          truncated: false,
          tree: [
            { type: 'blob', mode: '100644', path: 'SKILL.md', sha: blob.sha, size: blob.size },
          ],
        },
      });
      return;
    }
    const blob = blobs.find((b) => url.endsWith(b.sha))!;
    await route.fulfill({
      json: {
        encoding: 'base64',
        sha: blob.sha,
        content: Buffer.from(blob.content).toString('base64'),
      },
    });
  });
  if (await page.getByLabel('Open navigation').isVisible())
    await page.getByLabel('Open navigation').click();
  await page.getByRole('button', { name: 'Import a workflow', exact: true }).first().click();
  await page.getByLabel('GitHub repository', { exact: true }).fill('fictional/skills');
  await page.getByLabel('Branch, tag or commit').fill('main');
  await page.getByRole('button', { name: 'Import from GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'skills', exact: true })).toBeVisible();
  await expect(page.locator('.source-status-bar')).toContainText('aaaaaaaaaaaa');
  revision = 1;
  await page.getByRole('button', { name: 'Source review', exact: true }).click();
  await page.getByRole('button', { name: 'Check GitHub for changes' }).click();
  await expect(page.getByRole('heading', { name: 'Review source changes.' })).toBeVisible();
  await expect(page.locator('.revision-comparison')).toContainText('bbbbbbbbbbbb');
  await expect(page.locator('.source-status-bar')).toContainText('aaaaaaaaaaaa');
  await page.getByRole('button', { name: 'Apply source update' }).click();
  await expect(page.locator('.source-status-bar')).toContainText('bbbbbbbbbbbb');
});

test('workflow editor attaches exact evidence and exports it with the manifest', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Edit workflow' }).click();
  const connection = page.locator('.edit-connection').first();
  await connection.locator('.citation-editor > summary').click();
  await connection.getByLabel('Evidence file', { exact: true }).selectOption(demo[0].files[0].path);
  await connection.getByLabel('Start line', { exact: true }).fill('9');
  await connection.getByLabel('End line', { exact: true }).fill('9');
  await connection.getByRole('button', { name: 'Attach source excerpt' }).click();
  await expect(connection.locator('.attached-evidence')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await page.getByRole('button', { name: 'Share & export' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Workflow manifest', exact: false }).click(),
  ]);
  const manifest = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(manifest.connections[0].evidence).toHaveLength(2);
  expect(manifest.connections[0].evidence[1].quote).toBe(demo[0].files[0].content.split('\n')[8]);
});
