import { useState } from 'react';
export function GithubImport({
  busy,
  onImport,
}: {
  busy: boolean;
  onImport: (repository: string, ref: string, directory: string) => void;
}) {
  const [repository, setRepository] = useState(''),
    [ref, setRef] = useState('HEAD'),
    [directory, setDirectory] = useState('');
  return (
    <form
      className="github-import"
      onSubmit={(e) => {
        e.preventDefault();
        onImport(repository, ref, directory);
      }}
    >
      <h3>Import a public GitHub repository</h3>
      <p className="muted">
        Read directly from GitHub at one recorded commit. Private repositories use the local CLI; no
        token is stored here.
      </p>
      <label className="field">
        GitHub repository
        <input
          required
          placeholder="owner/repository"
          value={repository}
          onChange={(e) => setRepository(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Branch, tag or commit
          <input required value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <label className="field">
          Subfolder (optional)
          <input
            placeholder="examples/prospecting"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
          />
        </label>
      </div>
      <button className="button" disabled={busy}>
        {busy ? 'Reading GitHub…' : 'Import from GitHub'}
      </button>
    </form>
  );
}
