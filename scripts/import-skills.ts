import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
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
const root = resolve(source),
  files: SourceFile[] = [];
let total = 0;
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
      files.push({ path, content: await readFile(full, 'utf8') });
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
    'Available with npm run dev. local/ is Git-ignored and excluded from production builds.',
  );
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
