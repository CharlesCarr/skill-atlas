import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Bundle } from '../src/lib/types';
import { buildWorkspace, validateBundle, validateManifest, parseSkill } from '../src/lib/workspace';
import {
  compareSources,
  evidenceFromLines,
  resolveEvidence,
  fingerprint,
  reviewStatus,
  evidenceUrl,
} from '../src/lib/trust';
import { importGithub, repositoryInput } from '../src/lib/github';
import { snapshotHtml } from '../src/lib/export';
const file = {
  path: 'skills/one/SKILL.md',
  content: '---\nname: one\ndescription: Example\n---\n# One\n\nRun $two after review.\n',
};
const second = { path: 'skills/two/SKILL.md', content: '---\nname: two\n---\n# Two\n' };
const bundle = (): Bundle => ({
  version: 1,
  id: 'test',
  title: 'Test',
  description: '',
  files: [file, second],
});
afterEach(() => vi.unstubAllGlobals());
describe('source evidence and review lifecycle', () => {
  it('captures actual source lines including frontmatter and CRLF offsets, excluding fenced code', () => {
    const one = {
      ...file,
      content:
        '\uFEFF' + file.content.replaceAll('\n', '\r\n') + '\r\n```sh\r\n$ignored\r\n```\r\n',
    };
    const w = buildWorkspace({ ...bundle(), files: [one, second] });
    expect(w.connections[0].evidence).toEqual([
      { path: file.path, startLine: 7, endLine: 7, quote: 'Run $two after review.' },
    ]);
    expect(resolveEvidence(w.bundle.files, w.connections[0].evidence![0]).status).toBe('matches');
    expect(w.bundle.files[0].content).toBe(one.content);
    expect(parseSkill(one).links).toEqual([]);
  });
  it('includes the definition behind reference-style Markdown links', () => {
    const w = buildWorkspace({
      ...bundle(),
      files: [
        { ...file, content: file.content + '\n[Next][next]\n\n[next]: ../two/SKILL.md\n' },
        second,
      ],
    });
    const evidence = w.connections[0].evidence!;
    expect(evidence.some((e) => e.quote === '[next]: ../two/SKILL.md')).toBe(true);
    expect(evidence.every((e) => resolveEvidence(w.bundle.files, e).status === 'matches')).toBe(
      true,
    );
  });
  it('relocates a unique exact excerpt but flags changed, missing and ambiguous excerpts', () => {
    const e = evidenceFromLines(file, 7, 7);
    expect(resolveEvidence([{ ...file, content: '\n' + file.content }], e)).toEqual({
      status: 'moved',
      startLine: 8,
      endLine: 8,
    });
    expect(
      resolveEvidence(
        [{ ...file, content: file.content.replace('after review', 'without review') }],
        e,
      ).status,
    ).toBe('changed');
    expect(resolveEvidence([], e).status).toBe('missing');
    expect(
      resolveEvidence([{ ...file, content: '\n' + file.content + '\nRun $two after review.\n' }], e)
        .status,
    ).toBe('ambiguous');
  });
  it('detects added/removed/changed files by contents, regardless of claimed commit or file order', () => {
    const after = {
      ...bundle(),
      files: [
        { ...file, content: file.content + 'Changed' },
        { path: 'new.md', content: 'New' },
      ],
    };
    expect(compareSources(bundle(), after).map((c) => [c.path, c.kind])).toEqual([
      ['new.md', 'added'],
      [file.path, 'modified'],
      [second.path, 'removed'],
    ]);
    expect(compareSources(bundle(), { ...bundle(), files: [...bundle().files].reverse() })).toEqual(
      [],
    );
  });
  it('invalidates review after source or authored workflow changes and survives export/reimport', async () => {
    const b = bundle();
    expect(await reviewStatus(b)).toBe('Not reviewed');
    b.manifest = {
      version: 1,
      title: 'Original workflow',
      steps: [{ id: 'one', skill: 'one' }],
      connections: [],
    };
    b.review = { fingerprint: await fingerprint(b), reviewedAt: new Date().toISOString() };
    expect(await reviewStatus(validateBundle(JSON.parse(JSON.stringify(b))))).toBe(
      'Reviewed snapshot',
    );
    expect(
      await reviewStatus({ ...b, files: [{ ...file, content: file.content + 'edit' }, second] }),
    ).toBe('Needs review');
    expect(
      await reviewStatus({
        ...b,
        manifest: {
          version: 1,
          title: 'Workflow',
          steps: [{ id: 'one', skill: 'one' }],
          connections: [],
        },
      }),
    ).toBe('Needs review');
    expect(await reviewStatus({ ...b, files: [...b.files].reverse() })).toBe('Reviewed snapshot');
  });
  it('validates evidence ranges and backward-compatible version 1 bundles', () => {
    expect(validateBundle(bundle()).source).toBeUndefined();
    const manifest = {
      version: 1,
      title: 'T',
      steps: [
        { id: 'one', skill: 'one' },
        { id: 'two', skill: 'two' },
      ],
      connections: [
        {
          from: 'one',
          to: 'two',
          label: 'Handoff',
          type: 'handoff',
          evidence: [{ path: '../../escape.md', startLine: 0, endLine: 1, quote: 'x' }],
        },
      ],
    };
    expect(() => validateManifest(manifest)).toThrow();
    expect(() => evidenceFromLines(file, 9, 2)).toThrow();
    expect(() =>
      validateBundle({
        ...bundle(),
        source: { kind: 'folder', commit: 'a'.repeat(40), importedAt: new Date().toISOString() },
      }),
    ).toThrow();
  });
  it('creates immutable GitHub line links only for clean matching or relocated source', () => {
    const b = {
        ...bundle(),
        source: {
          kind: 'git' as const,
          repository: 'https://github.com/example/repo',
          commit: 'a'.repeat(40),
          directory: 'team',
          dirty: false,
          importedAt: new Date().toISOString(),
        },
      },
      e = evidenceFromLines(file, 7, 7);
    expect(evidenceUrl(b, e)).toBe(
      `https://github.com/example/repo/blob/${'a'.repeat(40)}/team/skills/one/SKILL.md#L7-L7`,
    );
    expect(evidenceUrl({ ...b, source: { ...b.source, dirty: true } }, e)).toBeUndefined();
    expect(evidenceUrl({ ...b, source: { ...b.source, dirty: undefined } }, e)).toBeUndefined();
    expect(evidenceUrl({ ...b, files: [second] }, e)).toBeUndefined();
    expect(
      evidenceUrl({ ...b, source: { ...b.source, repository: 'javascript:alert(1)' } }, e),
    ).toBeUndefined();
  });
  it('preserves broken citation warnings, revision and evidence in an offline export', () => {
    const b = bundle(),
      e = evidenceFromLines(file, 7, 7);
    b.manifest = {
      version: 1,
      title: 'T',
      steps: [
        { id: 'one', skill: 'one' },
        { id: 'two', skill: 'two' },
      ],
      connections: [
        {
          from: 'one',
          to: 'two',
          label: 'Handoff',
          type: 'handoff',
          evidence: [{ ...e, quote: 'Old instruction.' }],
        },
      ],
    };
    const w = buildWorkspace(b),
      html = snapshotHtml(w);
    expect(w.issues.some((i) => i.message.includes('changed source evidence'))).toBe(true);
    expect(html).toContain('Evidence needs attention');
    expect(html).toContain('Old instruction.');
    expect(html).toContain('No Git revision recorded');
    expect(html).not.toContain('<script');
  });
});
function githubFixture(truncated = false, tampered = false) {
  const calls: string[] = [],
    bytes = Buffer.from('\uFEFF' + file.content),
    sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/commits/'))
        return Response.json({ sha: 'a'.repeat(40), commit: { tree: { sha: 'b'.repeat(40) } } });
      if (url.includes('/git/trees/'))
        return Response.json({
          truncated,
          tree: [
            { type: 'blob', mode: '100644', path: 'team/' + file.path, size: bytes.length, sha },
            { type: 'blob', mode: '120000', path: 'team/SKILL.md', size: 4, sha },
          ],
        });
      return Response.json({
        sha,
        encoding: 'base64',
        content: (tampered ? Buffer.from('x'.repeat(bytes.length)) : bytes).toString('base64'),
      });
    }),
  );
  return { calls, sha };
}
describe('GitHub commit-pinned imports', () => {
  it('resolves a moving branch once, checks blob integrity, excludes symlinks, and preserves BOM', async () => {
    const { calls, sha } = githubFixture();
    const b = await importGithub('example/repo', 'feature/skills', 'team');
    expect(b.source?.commit).toBe('a'.repeat(40));
    expect(b.source?.ref).toBe('feature/skills');
    expect(b.files).toEqual([{ ...file, content: '\uFEFF' + file.content }]);
    expect(calls).toEqual([
      `https://api.github.com/repos/example/repo/commits/feature%2Fskills`,
      `https://api.github.com/repos/example/repo/git/trees/${'b'.repeat(40)}?recursive=1`,
      `https://api.github.com/repos/example/repo/git/blobs/${sha}`,
    ]);
  });
  it('rejects incomplete repository trees and corrupted blob contents', async () => {
    githubFixture(true);
    await expect(importGithub('example/repo', 'main', 'team')).rejects.toThrow('incomplete tree');
    githubFixture(false, true);
    await expect(importGithub('example/repo', 'main', 'team')).rejects.toThrow('Git ID');
  });
  it('handles rate limits and avoids sending tokens or importing arbitrary URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    );
    await expect(importGithub('example/repo')).rejects.toThrow('rate limit');
    expect(() => repositoryInput('https://evil.example/repo')).toThrow();
    expect(() => repositoryInput('https://github.com/example/repo/tree/main')).toThrow();
    await expect(importGithub('example/repo', 'main', '../private')).rejects.toThrow('relative');
  });
});
it('local CLI records HEAD and flags changed or ignored source bytes, with stable refresh IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'atlas-git-test-')),
    repo = join(dir, 'repo');
  await mkdir(repo);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init');
    await writeFile(join(repo, 'SKILL.md'), file.content);
    await writeFile(join(repo, '.gitignore'), 'ignored.md\n');
    git('add', '.');
    git(
      '-c',
      'user.name=Atlas Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-m',
      'Fictional fixture',
    );
    const run = () =>
      execFileSync(
        process.execPath,
        [
          '--import',
          resolve('node_modules/tsx/dist/loader.mjs'),
          resolve('scripts/import-skills.ts'),
          repo,
        ],
        { cwd: dir, stdio: 'pipe' },
      );
    run();
    const filename = (await readdir(join(dir, 'local')))[0];
    const read = async () =>
      JSON.parse(await readFile(join(dir, 'local', filename), 'utf8')) as Bundle;
    const clean = await read();
    expect(clean.source?.commit).toBe(git('rev-parse', 'HEAD'));
    expect(clean.source?.dirty).toBe(false);
    await mkdir(join(repo, 'team'));
    await writeFile(
      join(repo, 'team', 'SKILL.md'),
      file.content.replace('name: one', 'name: nested'),
    );
    git('add', '.');
    git(
      '-c',
      'user.name=Atlas Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-m',
      'Nested fictional skill',
    );
    execFileSync(
      process.execPath,
      [
        '--import',
        resolve('node_modules/tsx/dist/loader.mjs'),
        resolve('scripts/import-skills.ts'),
        join(repo, 'team'),
      ],
      { cwd: dir, stdio: 'pipe' },
    );
    const nestedName = (await readdir(join(dir, 'local'))).find((n) => n !== filename)!;
    const nested = JSON.parse(await readFile(join(dir, 'local', nestedName), 'utf8')) as Bundle;
    expect(nested.source?.directory).toBe('team');
    expect(nested.source?.dirty).toBe(false);
    await rm(join(repo, 'team'), { recursive: true });
    run();
    expect((await read()).source?.dirty).toBe(true);

    await writeFile(join(repo, 'ignored.md'), 'Ignored source document');
    run();
    expect((await read()).source?.dirty).toBe(true);
    await rm(join(repo, 'ignored.md'));
    await writeFile(join(repo, 'SKILL.md'), file.content + 'Local edit\n');
    run();
    const changed = await read();
    expect(changed.id).toBe(clean.id);
    expect(changed.source?.dirty).toBe(true);
    expect(changed.files[0].content).toBe(file.content + 'Local edit\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
