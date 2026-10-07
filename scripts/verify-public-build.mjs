import { readdir, readFile } from 'node:fs/promises';
const names = await readdir('dist/assets');
for (const name of names.filter((n) => n.endsWith('.js'))) {
  const content = await readFile(`dist/assets/${name}`, 'utf8');
  if (content.includes('/__local-workspaces'))
    throw new Error('Development-only workspace loader leaked into the production build.');
}
if ((await readdir('dist')).includes('local'))
  throw new Error('Private local/ folder leaked into dist.');
console.log('Public build verified: no local workspace endpoint or local/ data folder.');
