import { parse } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { evidenceFromLines, resolveEvidence } from './trust';
import type {
  Bundle,
  Manifest,
  Skill,
  SourceFile,
  Step,
  Connection,
  Workspace,
  Issue,
  Evidence,
  SourceSnapshot,
} from './types';

export const LIMITS = { files: 1200, skills: 100, bytes: 8_000_000, fileBytes: 1_000_000 };
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workflow';
export const humanize = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('Path escapes the imported folder.');
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}
export function resolvePath(from: string, href: string): string | undefined {
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('#')) return;
  try {
    return normalizePath(
      (href.startsWith('/') ? '' : from.split('/').slice(0, -1).join('/') + '/') +
        decodeURIComponent(href.split(/[?#]/)[0]),
    );
  } catch {
    return;
  }
}
const processor = unified().use(remarkParse).use(remarkGfm);
function nodeText(node: { value?: string; children?: unknown[] }): string {
  return node.value ?? (node.children ?? []).map((c) => nodeText(c as typeof node)).join('');
}
export function parseSkill(file: SourceFile): Skill {
  // Keep the original source untouched; derive display metadata from a separate view.
  const normalized = file.content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const metadata: unknown = match ? parse(match[1], { maxAliasCount: 50 }) : {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    throw new Error('Frontmatter must be a YAML mapping.');
  const frontmatter = metadata as Record<string, unknown>;
  try {
    JSON.stringify(frontmatter);
  } catch {
    throw new Error('Circular YAML metadata is not supported.');
  }
  if (frontmatter.name !== undefined && typeof frontmatter.name !== 'string')
    throw new Error('Skill name must be text.');
  if (frontmatter.description !== undefined && typeof frontmatter.description !== 'string')
    throw new Error('Skill description must be text.');
  const body = match ? normalized.slice(match[0].length) : normalized;
  const tree = processor.parse(body);
  const offset = match ? match[0].split('\n').length - 1 : 0;
  const excerpt = (start: number, end = start) =>
    evidenceFromLines(file, start + offset, end + offset);
  const invocations: Skill['invocations'] = [];
  const sections: Skill['sections'] = [],
    links: Skill['links'] = [],
    mentions = new Set<string>();
  const definitions = new Map<string, { href: string; evidence: Evidence }>();
  visit(tree, 'definition', (n) => {
    definitions.set(n.identifier.toLowerCase(), {
      href: n.url,
      evidence: excerpt(n.position?.start.line ?? 1, n.position?.end.line ?? 1),
    });
  });
  visit(tree, (n) => {
    if (n.type === 'heading')
      sections.push({
        title: nodeText(n),
        depth: n.depth,
        line: (n.position?.start.line ?? 1) + offset,
      });
    if (n.type === 'inlineCode') {
      const invocation = n.value.match(/^\$([a-zA-Z][\w-]*)$/);
      if (invocation) {
        mentions.add(invocation[1]);
        invocations.push({ target: invocation[1], evidence: excerpt(n.position?.start.line ?? 1) });
      }
    }
    if (n.type === 'text')
      for (const m of n.value.matchAll(/\$([a-zA-Z][\w-]*)/g)) {
        mentions.add(m[1]);
        const line =
          (n.position?.start.line ?? 1) + n.value.slice(0, m.index).split('\n').length - 1;
        invocations.push({ target: m[1], evidence: excerpt(line) });
      }
    if (n.type === 'link')
      links.push({
        label: nodeText(n),
        href: n.url,
        line: (n.position?.start.line ?? 1) + offset,
        evidence: [excerpt(n.position?.start.line ?? 1, n.position?.end.line ?? 1)],
      });
    if (n.type === 'linkReference') {
      const definition = definitions.get(n.identifier.toLowerCase());
      if (definition)
        links.push({
          label: nodeText(n),
          href: definition.href,
          line: (n.position?.start.line ?? 1) + offset,
          evidence: [
            excerpt(n.position?.start.line ?? 1, n.position?.end.line ?? 1),
            definition.evidence,
          ],
        });
    }
  });
  const dir = file.path.split('/').at(-2) ?? 'skill';
  const id = String(frontmatter.name || dir);
  const title = sections.find((s) => s.depth === 1)?.title ?? humanize(id);
  return {
    id,
    title,
    description: String(frontmatter.description ?? ''),
    path: file.path,
    source: file.content,
    body,
    frontmatter,
    sections,
    mentions: [...mentions],
    invocations,
    links,
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${field} must be non-empty text.`);
  if (value.length > 5000) throw new Error(`${field} is too long.`);
  return value;
}
export function validateEvidence(value: unknown): Evidence {
  if (!record(value)) throw new Error('Evidence must be a mapping.');
  const path = normalizePath(text(value.path, 'Evidence path'));
  if (
    !path ||
    !Number.isInteger(value.startLine) ||
    !Number.isInteger(value.endLine) ||
    Number(value.startLine) < 1 ||
    Number(value.endLine) < Number(value.startLine) ||
    Number(value.endLine) > 1000000
  )
    throw new Error('Evidence needs a valid path and inclusive line range.');
  if (
    typeof value.quote !== 'string' ||
    !value.quote.trim() ||
    value.quote.length > 20000 ||
    value.quote.replace(/\r\n/g, '\n').split('\n').length !==
      Number(value.endLine) - Number(value.startLine) + 1
  )
    throw new Error('Evidence quote must match its line-range length (up to 20,000 characters).');
  return {
    path,
    startLine: Number(value.startLine),
    endLine: Number(value.endLine),
    quote: value.quote,
  };
}
function validateSource(value: unknown): SourceSnapshot {
  if (!record(value) || !['github', 'git', 'folder'].includes(String(value.kind)))
    throw new Error('Invalid source snapshot.');
  const result: SourceSnapshot = {
    kind: value.kind as SourceSnapshot['kind'],
    importedAt: text(value.importedAt, 'Import date'),
  };
  if (!Number.isFinite(Date.parse(result.importedAt))) throw new Error('Invalid import date.');
  if (value.commit !== undefined) {
    if (typeof value.commit !== 'string' || !/^[a-f0-9]{40,64}$/.test(value.commit))
      throw new Error('Invalid source commit.');
    result.commit = value.commit;
  }
  if (value.repository !== undefined) result.repository = text(value.repository, 'Repository');
  if (value.ref !== undefined) result.ref = text(value.ref, 'Revision');
  if (value.directory !== undefined) {
    if (
      typeof value.directory !== 'string' ||
      value.directory.startsWith('/') ||
      value.directory.split(/[\\/]/).includes('..')
    )
      throw new Error('Invalid source subfolder.');
    result.directory = normalizePath(value.directory);
  }
  if (value.dirty !== undefined) {
    if (typeof value.dirty !== 'boolean') throw new Error('Working tree state must be boolean.');
    result.dirty = value.dirty;
  }
  if (
    result.kind === 'github' &&
    (!result.commit ||
      !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(result.repository ?? '') ||
      result.dirty !== false)
  )
    throw new Error('GitHub snapshots need a repository, commit and clean state.');
  if (result.kind === 'folder' && (result.commit || result.dirty !== undefined))
    throw new Error('Folder snapshots cannot claim a Git revision.');
  return result;
}
export function validateManifest(value: unknown): Manifest {
  if (!record(value) || value.version !== 1)
    throw new Error('Workflow manifest must have version: 1.');
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.length > 150)
    throw new Error('Workflow needs 1–150 steps.');
  if (!Array.isArray(value.connections) || value.connections.length > 600)
    throw new Error('Workflow connections must be an array of at most 600 entries.');
  const steps = value.steps.map((v, i): Step => {
    if (!record(v)) throw new Error(`Step ${i + 1} must be a mapping.`);
    const kind = v.kind ?? 'skill';
    if (kind !== 'human' && kind !== 'skill') throw new Error('Step kind must be skill or human.');
    const step: Step = { id: text(v.id, 'Step id'), kind };
    if (kind === 'skill') step.skill = text(v.skill, 'Step skill');
    for (const key of ['title', 'phase', 'description'] as const)
      if (v[key] !== undefined) step[key] = text(v[key], key);
    for (const key of ['inputs', 'outputs'] as const)
      if (v[key] !== undefined) {
        if (!Array.isArray(v[key]) || v[key].length > 30)
          throw new Error(`${key} must be a short list.`);
        step[key] = v[key].map((item) => text(item, key));
      }
    if (kind === 'human' && !step.title) throw new Error('Human steps need a title.');
    return step;
  });
  const ids = new Set(steps.map((s) => s.id));
  if (ids.size !== steps.length) throw new Error('Workflow step ids must be unique.');
  const pairs = new Set<string>();
  const connections = value.connections.map((v): Connection => {
    if (!record(v) || !ids.has(String(v.from)) || !ids.has(String(v.to)))
      throw new Error('A connection refers to an unknown step.');
    if (!['handoff', 'reference', 'feedback'].includes(String(v.type)))
      throw new Error('Connection type must be handoff, reference or feedback.');
    const key = `${v.from}\0${v.to}\0${v.type}`;
    if (pairs.has(key)) throw new Error('Duplicate connection.');
    pairs.add(key);
    return {
      from: String(v.from),
      to: String(v.to),
      type: v.type as Connection['type'],
      label: text(v.label, 'Connection label'),
      ...(v.evidence === undefined
        ? {}
        : {
            evidence: (() => {
              if (!Array.isArray(v.evidence) || v.evidence.length > 20)
                throw new Error('At most 20 excerpts per connection.');
              return v.evidence.map(validateEvidence);
            })(),
          }),
    };
  });
  return {
    version: 1,
    title: text(value.title, 'Workflow title'),
    description:
      value.description === undefined ? undefined : text(value.description, 'Workflow description'),
    steps,
    connections,
  };
}
export function validateBundle(value: unknown): Bundle {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.files))
    throw new Error('Expected a Skill Atlas version 1 bundle.');
  if (value.files.length > LIMITS.files)
    throw new Error('Too many files. Import a smaller folder.');
  const paths = new Set<string>();
  let bytes = 0;
  const files = value.files.map((f): SourceFile => {
    if (!record(f) || typeof f.content !== 'string')
      throw new Error('Every source file needs a path and text content.');
    const path = normalizePath(text(f.path, 'File path'));
    if (!path || paths.has(path)) throw new Error(`Duplicate or empty file path: ${path}`);
    paths.add(path);
    const size = new TextEncoder().encode(f.content).length;
    bytes += size;
    if (size > LIMITS.fileBytes || bytes > LIMITS.bytes)
      throw new Error('Import exceeds the 8 MB workspace or 1 MB file limit.');
    return { path, content: f.content };
  });
  return {
    version: 1,
    id: text(value.id, 'Workspace id'),
    title: text(value.title, 'Workspace title'),
    description: typeof value.description === 'string' ? value.description : '',
    files,
    ...(value.source === undefined ? {} : { source: validateSource(value.source) }),
    ...(value.review === undefined
      ? {}
      : {
          review: (() => {
            if (
              !record(value.review) ||
              typeof value.review.fingerprint !== 'string' ||
              !/^[a-f0-9]{64}$/.test(value.review.fingerprint) ||
              typeof value.review.reviewedAt !== 'string' ||
              !Number.isFinite(Date.parse(value.review.reviewedAt))
            )
              throw new Error('Invalid review record.');
            return { fingerprint: value.review.fingerprint, reviewedAt: value.review.reviewedAt };
          })(),
        }),
    manifest: value.manifest === undefined ? undefined : validateManifest(value.manifest),
  };
}
export function buildWorkspace(input: Bundle): Workspace {
  const bundle = validateBundle(input),
    issues: Issue[] = [],
    skills: Skill[] = [];
  for (const file of bundle.files.filter((f) => /(^|\/)SKILL\.md$/i.test(f.path))) {
    try {
      const skill = parseSkill(file);
      if (skills.some((s) => s.id === skill.id))
        throw new Error(`Duplicate skill name: ${skill.id}. Rename it before importing.`);
      skills.push(skill);
    } catch (e) {
      issues.push({ severity: 'error', path: file.path, message: String((e as Error).message) });
    }
  }
  if (!skills.length)
    throw new Error('No valid SKILL.md files found. Choose a folder containing skills.');
  if (skills.length > LIMITS.skills) throw new Error('Import at most 100 skills per workspace.');
  const byId = new Map(skills.map((s) => [s.id, s])),
    byPath = new Map(skills.map((s) => [s.path, s]));
  const paths = new Set(bundle.files.map((f) => f.path));
  const references: Connection[] = [];
  for (const skill of skills) {
    const related = new Set(skill.mentions);
    const evidenceByTarget = new Map<string, Evidence[]>();
    for (const invocation of skill.invocations)
      evidenceByTarget.set(invocation.target, [
        ...(evidenceByTarget.get(invocation.target) ?? []),
        invocation.evidence,
      ]);
    for (const link of skill.links) {
      const path = resolvePath(skill.path, link.href);
      if (path) {
        if (!paths.has(path))
          issues.push({
            severity: 'warning',
            path: skill.path,
            message: `Missing linked file: ${link.href}`,
          });
        const target = byPath.get(path);
        if (target) {
          related.add(target.id);
          evidenceByTarget.set(target.id, [
            ...(evidenceByTarget.get(target.id) ?? []),
            ...link.evidence,
          ]);
        }
      }
    }
    for (const target of related) {
      if (target === skill.id) continue;
      if (byId.has(target))
        references.push({
          from: skill.id,
          to: target,
          label: 'References in Markdown',
          type: 'reference',
          evidence: [
            ...new Map(
              (evidenceByTarget.get(target) ?? []).map((e) => [JSON.stringify(e), e]),
            ).values(),
          ].slice(0, 20),
        });
      else
        issues.push({
          severity: 'warning',
          path: skill.path,
          message: `Unresolved skill mention: $${target}`,
        });
    }
  }
  let steps: Step[], connections: Connection[];
  if (bundle.manifest) {
    steps = bundle.manifest.steps;
    connections = bundle.manifest.connections;
    for (const step of steps)
      if (step.kind !== 'human' && !byId.has(step.skill!))
        throw new Error(`Manifest step ${step.id} refers to missing skill ${step.skill}.`);
  } else {
    steps = skills.map((s) => ({ id: s.id, skill: s.id, kind: 'skill' }));
    connections = references;
  }
  for (const connection of connections)
    for (const evidence of connection.evidence ?? []) {
      const status = resolveEvidence(bundle.files, evidence).status;
      if (!['matches', 'moved'].includes(status))
        issues.push({
          severity: 'warning',
          path: evidence.path,
          message: `Connection "${connection.label}" has ${status} source evidence.`,
        });
    }
  return { bundle, skills, steps, connections, issues, authored: !!bundle.manifest };
}
export function bundleFromFiles(files: SourceFile[], title = 'Imported workflow'): Bundle {
  const candidates = files.filter((f) => /(^|\/)workflow\.(yaml|yml|json)$/i.test(f.path));
  const roots = candidates.filter((f) => !f.path.includes('/'));
  if (roots.length > 1 || (!roots.length && candidates.length > 1))
    throw new Error(
      'Multiple workflow manifests found. Import one workflow folder or supply --manifest.',
    );
  const manifestFile = roots[0] ?? candidates[0];
  const manifest = manifestFile
    ? validateManifest(parse(manifestFile.content, { maxAliasCount: 50 }))
    : undefined;
  return validateBundle({
    version: 1,
    id: `${slug(title)}-${crypto.randomUUID().slice(0, 8)}`,
    title: manifest?.title ?? title,
    description:
      manifest?.description ?? 'Imported from local Markdown. The original files are preserved.',
    files,
    manifest,
    source: { kind: 'folder', importedAt: new Date().toISOString() },
  });
}
export const includedPath = (path: string) =>
  !/(^|\/)(node_modules|\.git|dist|build|\.next|\.worktrees|test-results|playwright-report)(\/|$)/.test(
    path,
  ) &&
  (/\.md$/i.test(path) ||
    /(^|\/)(?:\.agents\/skills\/|skills\/)?[^/]+\/(assets|scripts|references)\/.*\.(json|csv|ts|js|py|sh|txt|ya?ml)$/i.test(
      path,
    ) ||
    /(^|\/)agents\/[^/]+\.ya?ml$/i.test(path) ||
    /(^|\/)workflow\.(yaml|yml|json)$/i.test(path));
export function issuesForExport(w: Workspace) {
  return w.issues.length
    ? `${w.issues.length} source issue(s) were present when this snapshot was exported.`
    : 'All imported skill references resolve.';
}
