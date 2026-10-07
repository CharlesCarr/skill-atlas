import { describe, expect, it } from 'vitest';
import {
  buildWorkspace,
  parseSkill,
  resolvePath,
  bundleFromFiles,
  validateBundle,
  validateManifest,
} from '../src/lib/workspace';
import { diagramSvg, snapshotHtml } from '../src/lib/export';
import demo from '../src/data/demo.json';
import type { Bundle } from '../src/lib/types';
const demos = demo as Bundle[];
const file = (name: string, body = '') => ({
  path: `.agents/skills/${name}/SKILL.md`,
  content: `---\nname: ${name}\ndescription: Example skill\n---\n\n# ${name}\n\n${body}`,
});
const bundle = (files = [file('one')]): Bundle => ({
  version: 1,
  id: 'test',
  title: 'Test',
  description: '',
  files,
});
describe('source fidelity and parsing', () => {
  it('preserves BOM and CRLF verbatim while parsing multiline YAML separately', () => {
    const source =
      '\uFEFF---\r\nname: research\r\ndescription: >-\r\n  Research accounts\r\n  with evidence.\r\nallowed-tools: [Read, Web]\r\n---\r\n\r\n# Research\r\n\r\n## Evidence\r\n\r\nText.\r\n';
    const s = parseSkill({ path: '.agents/skills/research/SKILL.md', content: source });
    expect(s.source).toBe(source);
    expect(s.description).toBe('Research accounts with evidence.');
    expect(s.frontmatter['allowed-tools']).toEqual(['Read', 'Web']);
    expect(s.sections[1].title).toBe('Evidence');
  });
  it('reads inline skill invocations and reference links, but ignores fenced code', () => {
    const s = parseSkill(
      file(
        'one',
        'Use `$inline-invocation` for a handoff.\n\nHand off to $two.\n\n[Other][ref]\n\n[ref]: ../two/SKILL.md\n\n```sh\n$not-a-skill\n```',
      ),
    );
    expect(s.mentions).toEqual(['inline-invocation', 'two']);
    expect(s.links[0].href).toBe('../two/SKILL.md');
  });
  it('resolves relative file links literally and prevents escaping the root', () => {
    expect(resolvePath('.agents/skills/one/SKILL.md', '../two/SKILL.md#section')).toBe(
      '.agents/skills/two/SKILL.md',
    );
    expect(resolvePath('SKILL.md', '../private.md')).toBeUndefined();
    expect(resolvePath('SKILL.md', 'https://example.org')).toBeUndefined();
    expect(resolvePath('docs/a.md', '%E0%A4%A')).toBeUndefined();
  });
  it('reports missing mentions and linked files, without inventing steps', () => {
    const w = buildWorkspace(
      bundle([file('one', 'Ask $two. Missing $three. [Ref](missing.md)'), file('two')]),
    );
    expect(w.authored).toBe(false);
    expect(w.connections).toEqual([
      { from: 'one', to: 'two', type: 'reference', label: 'References in Markdown' },
    ]);
    expect(w.issues).toHaveLength(2);
  });
  it('reports malformed and duplicate skills rather than overwriting one', () => {
    const w = buildWorkspace(
      bundle([
        file('one'),
        { path: 'other/SKILL.md', content: file('one').content },
        { path: 'bad/SKILL.md', content: '---\nname: [invalid]\n---\n# Bad' },
      ]),
    );
    expect(w.skills).toHaveLength(1);
    expect(w.issues.filter((i) => i.severity === 'error')).toHaveLength(2);
  });
});
describe('authored workflows and import validation', () => {
  it('supports branching, repeated skills and human decisions with zero demo source issues', () => {
    const w = buildWorkspace(demos[0]);
    expect(w.steps).toHaveLength(6);
    expect(w.skills).toHaveLength(4);
    expect(w.steps.filter((s) => s.skill === 'campaign-setup')).toHaveLength(2);
    expect(w.issues).toEqual([]);
  });
  it('loads an optional YAML manifest', () => {
    const w = buildWorkspace(
      bundleFromFiles([
        file('one'),
        {
          path: 'workflow.yaml',
          content:
            'version: 1\ntitle: Example\nsteps:\n  - id: start\n    skill: one\nconnections: []',
        },
      ]),
    );
    expect(w.authored).toBe(true);
    expect(w.steps[0].id).toBe('start');
  });
  it('rejects dangling steps, duplicate ids, bad edge types and duplicate paths', () => {
    expect(() =>
      validateManifest({
        version: 1,
        title: 'T',
        steps: [{ id: 'a', skill: 'one' }],
        connections: [{ from: 'a', to: 'missing', label: 'x', type: 'handoff' }],
      }),
    ).toThrow('unknown step');
    expect(() =>
      validateManifest({
        version: 1,
        title: 'T',
        steps: [
          { id: 'a', skill: 'one' },
          { id: 'a', skill: 'two' },
        ],
        connections: [],
      }),
    ).toThrow('unique');
    expect(() =>
      buildWorkspace({
        ...bundle(),
        manifest: {
          version: 1,
          title: 'T',
          steps: [{ id: 'a', skill: 'missing' }],
          connections: [],
        },
      }),
    ).toThrow('missing skill');
    expect(() => validateBundle({ ...bundle(), files: [file('one'), file('one')] })).toThrow(
      'Duplicate',
    );
  });
  it('roundtrips a bundle without changing Markdown', () => {
    const b = validateBundle(JSON.parse(JSON.stringify(demos[0])));
    expect(b.files).toEqual(demos[0].files);
    expect(buildWorkspace(b).connections).toEqual(demos[0].manifest!.connections);
  });
  it('rejects workspace escapes and oversized files', () => {
    expect(() => validateBundle(bundle([{ path: '../SKILL.md', content: 'x' }]))).toThrow(
      'escapes',
    );
    expect(() =>
      validateBundle(bundle([{ path: 'SKILL.md', content: 'x'.repeat(1_000_001) }])),
    ).toThrow('limit');
  });
});
it('supports Codex agent YAML and skill supporting text while excluding dependency folders', async () => {
  const { includedPath } = await import('../src/lib/workspace');
  expect(includedPath('.agents/skills/research/agents/openai.yaml')).toBe(true);
  expect(includedPath('.agents/skills/research/assets/brief.example.json')).toBe(true);
  expect(includedPath('.agents/skills/research/scripts/validate.ts')).toBe(true);
  expect(includedPath('node_modules/example/SKILL.md')).toBe(false);
  expect(includedPath('.env')).toBe(false);
});
it('rejects ambiguous manifests and circular YAML metadata', () => {
  expect(() =>
    bundleFromFiles([
      file('one'),
      { path: 'a/workflow.json', content: '{}' },
      { path: 'b/workflow.yaml', content: '{}' },
    ]),
  ).toThrow('Multiple');
  expect(() =>
    parseSkill({
      path: 'one/SKILL.md',
      content: '---\nname: one\nmetadata: &a\n  self: *a\n---\n# One',
    }),
  ).toThrow('Circular');
});
describe('portable exports', () => {
  it('creates an offline HTML with diagram, original source, documents and internal reference links', () => {
    const html = snapshotHtml(buildWorkspace(demos[0]));
    expect(html).toContain('<svg');
    expect(html).toContain('Original source');
    expect(html).toContain('href="#source-4"');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('Review before launch');
  });
  it('escapes hostile source and metadata in HTML and SVG', () => {
    const w = buildWorkspace({
      ...bundle([
        file(
          'one',
          '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n<img src="https://tracker.example/x">',
        ),
      ]),
      title: '</title><script>boom</script>',
    });
    const html = snapshotHtml(w);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    const svg = diagramSvg(w);
    expect(svg).toContain('&lt;/title&gt;');
    expect(svg).not.toContain('<script>');
  });
  it('labels reference maps as references, never as execution history', () => {
    const w = buildWorkspace(bundle());
    expect(snapshotHtml(w)).toContain('no execution order inferred');
    expect(diagramSvg(w, 'TB')).toContain('References only');
  });
});
