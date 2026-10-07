import type { Bundle, Connection, Evidence, SourceFile } from './types';

export const sourceLines = (content: string) => content.split(/\r?\n/);
export function evidenceFromLines(file: SourceFile, startLine: number, endLine: number): Evidence {
  const lines = sourceLines(file.content);
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > lines.length
  )
    throw new Error('Choose a valid inclusive source line range.');
  const quote = lines.slice(startLine - 1, endLine).join('\n');
  if (!quote.trim() || quote.length > 20000)
    throw new Error('Choose a non-empty excerpt of at most 20,000 characters.');
  return { path: file.path, startLine, endLine, quote };
}
export type EvidenceResult = {
  status: 'matches' | 'moved' | 'changed' | 'missing' | 'ambiguous';
  startLine?: number;
  endLine?: number;
};
export function resolveEvidence(files: SourceFile[], evidence: Evidence): EvidenceResult {
  const file = files.find((f) => f.path === evidence.path);
  if (!file) return { status: 'missing' };
  const lines = sourceLines(file.content),
    quote = evidence.quote.replace(/\r\n/g, '\n');
  if (lines.slice(evidence.startLine - 1, evidence.endLine).join('\n') === quote)
    return { status: 'matches', startLine: evidence.startLine, endLine: evidence.endLine };
  const length = quote.split('\n').length,
    matches: number[] = [];
  for (let i = 0; i <= lines.length - length; i++)
    if (lines.slice(i, i + length).join('\n') === quote) matches.push(i + 1);
  if (matches.length === 1)
    return { status: 'moved', startLine: matches[0], endLine: matches[0] + length - 1 };
  return { status: matches.length ? 'ambiguous' : 'changed' };
}
export function connectionStatus(files: SourceFile[], connection: Connection) {
  if (!connection.evidence?.length) return 'Uncited';
  const results = connection.evidence.map((e) => resolveEvidence(files, e));
  if (results.some((r) => !['matches', 'moved'].includes(r.status)))
    return 'Evidence needs attention';
  return results.some((r) => r.status === 'moved') ? 'Excerpt relocated' : 'Excerpts match';
}
export type FileChange = {
  path: string;
  kind: 'added' | 'modified' | 'removed';
  before?: string;
  after?: string;
};
export function compareSources(before: Bundle, after: Bundle): FileChange[] {
  const a = new Map(before.files.map((f) => [f.path, f.content])),
    b = new Map(after.files.map((f) => [f.path, f.content]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().flatMap((path) => {
    if (a.get(path) === b.get(path)) return [];
    return [
      {
        path,
        kind: !a.has(path) ? 'added' : !b.has(path) ? 'removed' : 'modified',
        before: a.get(path),
        after: b.get(path),
      },
    ];
  });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export async function fingerprint(bundle: Bundle): Promise<string> {
  // Review covers exact source text and the authored overlay, not just a commit label.
  const content = canonical({
    files: [...bundle.files].sort((a, b) => a.path.localeCompare(b.path)),
    manifest: bundle.manifest
      ? {
          ...bundle.manifest,
          steps: bundle.manifest.steps.map((step) => ({ ...step, kind: step.kind ?? 'skill' })),
        }
      : null,
  });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
export async function reviewStatus(bundle: Bundle): Promise<string> {
  if (!bundle.review) return 'Not reviewed';
  return bundle.review.fingerprint === (await fingerprint(bundle))
    ? 'Reviewed snapshot'
    : 'Needs review';
}
export function githubRepository(repository?: string): string | undefined {
  if (!repository) return;
  const match = repository.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/);
  return match ? `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}` : undefined;
}
export function evidenceUrl(bundle: Bundle, evidence: Evidence): string | undefined {
  const repo = githubRepository(bundle.source?.repository),
    sha = bundle.source?.commit;
  if (!repo || !sha || bundle.source?.dirty !== false) return;
  const result = resolveEvidence(bundle.files, evidence);
  if (!result.startLine) return;
  const path = [bundle.source?.directory, evidence.path]
    .filter(Boolean)
    .join('/')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `${repo}/blob/${sha}/${path}#L${result.startLine}-L${result.endLine}`;
}
