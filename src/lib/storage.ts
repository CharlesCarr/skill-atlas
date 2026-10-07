import { validateBundle } from './workspace';
import type { Bundle } from './types';
const KEY = 'skill-atlas:workspaces:v1';
export function loadSaved(): { bundles: Bundle[]; error?: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { bundles: [] };
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Invalid saved workspace list.');
    return { bundles: data.map(validateBundle) };
  } catch {
    return {
      bundles: [],
      error:
        'Saved workspaces could not be read. The examples are available; import a backup to restore your workspace.',
    };
  }
}
export function saveBundles(bundles: Bundle[]): string | undefined {
  try {
    localStorage.setItem(KEY, JSON.stringify(bundles));
  } catch {
    return 'Browser storage is full or unavailable. Changes work for this session; export a bundle to keep them.';
  }
}
