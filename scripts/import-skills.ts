import { readdir, readFile, mkdir, writeFile, stat, realpath } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { githubRepository } from '../src/lib/trust';
import {
  bundleFromFiles,
  buildWorkspace,
  includedPath,
  LIMITS,
  validateManifest,
  slug,
} from '../src/lib/workspace';
import { parse } from 'yaml';
import type { SourceFile, Bundle } from '../src/lib/types';

const args = process.argv.slice(2);
const source = args[0];
if (!source || source.startsWith('--')) {
  console.error(
    'Usage: npm run import:skills -- /path/to/repository [--name "Workflow title"] [--manifest /path/to/workflow.yaml]',
  );
  process.exit(1);
}
const root = await realpath(resolve(source)),
  files: SourceFile[] = [];
let total = 0;
function git(...command: string[]) {
  return execFileSync('git', ['-C', root, ...command], {
    encoding: 'utf8',
    maxBuffer: 8_000_000,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}
let initialCommit: string | undefined;
try {
  initialCommit = git('rev-parse', 'HEAD');
} catch {
  /* A folder without Git remains a folder snapshot. */
}

async function walk(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name),
      path = relative(root, full).replace(/\\/g, '/');
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (
        ![
          '.git',
          'node_modules',
          'dist',
          'build',
          '.next',
          '.worktrees',
          'test-results',
          'playwright-report',
        ].includes(entry.name)
      )
        await walk(full);
    } else if (entry.isFile() && includedPath(path)) {
      const size = (await stat(full)).size;
      total += size;
      if (size > LIMITS.fileBytes || total > LIMITS.bytes || files.length >= LIMITS.files)
        throw new Error('Import exceeds documented workspace limits. Choose a smaller folder.');
      files.push({
        path,
        content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
          await readFile(full),
        ),
      });
    }
  }
}
try {
  await walk(root);
  const nameIdx = args.indexOf('--name'),
    manifestIdx = args.indexOf('--manifest');
  const title = (nameIdx >= 0 ? args[nameIdx + 1] : root.split('/').at(-1)) ?? 'Imported workflow';
  const override =
    manifestIdx >= 0
      ? validateManifest(
          parse(await readFile(resolve(args[manifestIdx + 1]), 'utf8'), { maxAliasCount: 50 }),
        )
      : undefined;
  const bundle: Bundle = override
    ? {
        version: 1,
        id: `${slug(title)}-${crypto.randomUUID().slice(0, 8)}`,
        title: override.title,
        description: override.description ?? '',
        files,
        manifest: override,
      }
    : bundleFromFiles(files, title);
  bundle.source ??= { kind: 'folder', importedAt: new Date().toISOString() };
  if (initialCommit) {
    const gitRoot = git('rev-parse', '--show-toplevel');
    const directory = relative(gitRoot, root).replace(/\\/g, '/');
    const objects = new Map(
      git('ls-tree', '-rz', '--full-tree', 'HEAD')
        .split('\0')
        .map((line) => {
          const match = line.match(/^(?:100644|100755) blob ([a-f0-9]+)\t([\s\S]*)$/);
          return match ? [match[2], match[1]] : ['', ''];
        }),
    );
    // Compare imported bytes with HEAD, including ignored/untracked source files.
    // Changes elsewhere in the repo do not mislabel this source snapshot.
    const prefix = directory ? directory + '/' : '';
    const importedPaths = new Set(files.map((file) => file.path));
    const removed = [...objects.keys()].some(
      (path) =>
        path.startsWith(prefix) &&
        includedPath(path.slice(prefix.length)) &&
        !importedPaths.has(path.slice(prefix.length)),
    );
    const dirty =
      removed ||
      files.some((file) => {
        const bytes = Buffer.from(file.content, 'utf8');
        const object = createHash(initialCommit!.length === 64 ? 'sha256' : 'sha1')
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest('hex');
        return objects.get([directory, file.path].filter(Boolean).join('/')) !== object;
      });
    if (git('rev-parse', 'HEAD') !== initialCommit)
      throw new Error('Git HEAD changed during import. Run the import again.');
    let repository: string | undefined;
    try {
      const remote = git('remote', 'get-url', 'origin');
      repository = githubRepository(
        remote
          .replace(/^git@github\.com:/, 'https://github.com/')
          .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/'),
      );
    } catch {
      /* Do not embed arbitrary remote URLs or credentials in portable files. */
    }
    bundle.source = {
      kind: 'git',
      commit: initialCommit,
      ref: git('rev-parse', '--abbrev-ref', 'HEAD'),
      directory,
      dirty,
      importedAt: new Date().toISOString(),
      ...(repository ? { repository } : {}),
    };
    bundle.id = `${slug(title)}-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`;
  }
  const workspace = buildWorkspace(bundle);
  await mkdir('local', { recursive: true });
  const destination = join('local', `${bundle.id}.json`);
  await writeFile(destination, JSON.stringify(bundle, null, 2) + '\n', { mode: 0o600 });
  console.log(
    `Imported ${workspace.skills.length} skills and ${files.length} source files into ${destination}.`,
  );
  console.log(
    `${workspace.issues.length} source issues. ${workspace.authored ? 'Authored workflow manifest loaded.' : 'Reference map only; no execution order inferred.'}`,
  );
  console.log(
    bundle.source?.commit
      ? `Source commit: ${bundle.source.commit}${bundle.source.dirty ? ' + local source changes' : ' (imported source matches HEAD)'}`
      : 'Folder snapshot; no Git commit recorded.',
  );
  console.log(
    'Available with npm run dev. local/ is Git-ignored and excluded from production builds.',
  );
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
