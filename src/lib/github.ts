import { bundleFromFiles, includedPath, LIMITS, normalizePath, buildWorkspace } from './workspace';
import { githubRepository } from './trust';
import type { Bundle, SourceFile } from './types';

export function repositoryInput(value: string): string {
  const repo =
    githubRepository(value.trim().replace(/\/$/, '') || '') ??
    githubRepository(`https://github.com/${value.trim()}`);
  if (!repo)
    throw new Error(
      'Enter owner/repository or a GitHub repository URL. Set the branch and subfolder separately.',
    );
  return repo;
}
export async function importGithub(
  value: string,
  ref = 'HEAD',
  directory = '',
  signal?: AbortSignal,
): Promise<Bundle> {
  const repository = repositoryInput(value),
    slug = repository.slice('https://github.com/'.length);
  if (/^(?:[\/\\])/.test(directory) || directory.split(/[\/\\]/).includes('..'))
    throw new Error('Subfolder must be a relative repository path.');
  directory = normalizePath(directory.trim());
  const api = `https://api.github.com/repos/${slug}`;
  async function request(path: string) {
    const response = await fetch(api + path, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok)
      throw new Error(
        response.status === 403 || response.status === 429
          ? 'GitHub rate limit reached. Try later or import a local clone with the CLI.'
          : response.status === 404
            ? 'Public repository or revision not found. Use the CLI for private repositories.'
            : `GitHub could not be read (${response.status}). No snapshot was changed.`,
      );
    return response.json();
  }
  // Resolve the branch once. Every subsequent read uses immutable tree/blob IDs.
  const commit = await request(`/commits/${encodeURIComponent(ref.trim() || 'HEAD')}`);
  if (!/^[a-f0-9]{40}$/.test(commit.sha) || !/^[a-f0-9]{40}$/.test(commit.commit?.tree?.sha))
    throw new Error('GitHub returned invalid commit metadata.');
  const tree = await request(`/git/trees/${commit.commit.tree.sha}?recursive=1`);
  if (tree.truncated || !Array.isArray(tree.tree))
    throw new Error('GitHub returned an incomplete tree. Import a local clone instead.');
  const prefix = directory ? directory + '/' : '';
  const entries: { path: string; sha: string; size: number }[] = tree.tree.filter(
    (entry: { type: string; mode: string; path: string }) =>
      entry.type === 'blob' &&
      ['100644', '100755'].includes(entry.mode) &&
      entry.path.startsWith(prefix) &&
      includedPath(entry.path.slice(prefix.length)),
  );
  if (
    entries.length > LIMITS.files ||
    entries.some((e) => e.size > LIMITS.fileBytes) ||
    entries.reduce((sum, e) => sum + e.size, 0) > LIMITS.bytes
  )
    throw new Error('Repository exceeds import limits. Choose a smaller subfolder.');
  const files: SourceFile[] = new Array(entries.length);
  let next = 0,
    total = 0,
    failed = false;
  await Promise.all(
    Array.from({ length: Math.min(4, entries.length) }, async () => {
      while (!failed && next < entries.length) {
        try {
          const i = next++,
            entry = entries[i];
          if (!/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error('Invalid GitHub blob ID.');
          const blob = await request(`/git/blobs/${entry.sha}`);
          if (
            blob.encoding !== 'base64' ||
            blob.sha !== entry.sha ||
            typeof blob.content !== 'string'
          )
            throw new Error('GitHub returned an invalid source blob.');
          const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), (c) =>
            c.charCodeAt(0),
          );
          total += bytes.length;
          if (
            bytes.length !== entry.size ||
            bytes.length > LIMITS.fileBytes ||
            total > LIMITS.bytes
          )
            throw new Error('Source exceeds import limits.');
          const header = new TextEncoder().encode(`blob ${bytes.length}\0`),
            object = new Uint8Array(header.length + bytes.length);
          object.set(header);
          object.set(bytes, header.length);
          const digest = await crypto.subtle.digest('SHA-1', object);
          if (
            [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('') !==
            entry.sha
          )
            throw new Error('Source blob does not match its recorded Git ID.');
          // fatal decoding avoids silently corrupting non-UTF-8 input; retain a UTF-8 BOM.
          files[i] = {
            path: entry.path.slice(prefix.length),
            content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
          };
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  const bundle = bundleFromFiles(files, slug.split('/')[1]);
  const identity = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(repository.toLowerCase() + '\0' + directory),
  );
  bundle.id = `github-${[...new Uint8Array(identity)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20)}`;
  if (!bundle.manifest)
    bundle.description = `Imported from GitHub at ${commit.sha.slice(0, 12)}. The original files are preserved.`;
  bundle.source = {
    kind: 'github',
    repository,
    commit: commit.sha,
    ref: ref.trim() || 'HEAD',
    directory,
    dirty: false,
    importedAt: new Date().toISOString(),
  };
  buildWorkspace(bundle);
  return bundle;
}
