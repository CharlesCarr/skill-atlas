import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
function localWorkspaces(): Plugin {
  return {
    name: 'local-workspaces',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__local-workspaces', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const dir = resolve(server.config.root, 'local');
          const names = await readdir(dir).catch(() => []);
          const data = await Promise.all(
            names
              .filter((n) => n.endsWith('.json'))
              .map(async (n) => JSON.parse(await readFile(resolve(dir, n), 'utf8'))),
          );
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        } catch {
          res.statusCode = 500;
          res.end('{"error":"Cannot read local workspaces"}');
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), localWorkspaces()],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
