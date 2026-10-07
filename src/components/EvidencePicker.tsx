import { useState } from 'react';
import type { Connection, SourceFile } from '../lib/types';
import { evidenceFromLines, resolveEvidence, sourceLines } from '../lib/trust';
export function EvidencePicker({
  files,
  connection,
  onChange,
}: {
  files: SourceFile[];
  connection: Connection;
  onChange: (patch: Partial<Connection>) => void;
}) {
  const [path, setPath] = useState(files[0]?.path ?? '');
  const [start, setStart] = useState(1),
    [end, setEnd] = useState(1),
    [error, setError] = useState('');
  const file = files.find((f) => f.path === path);
  let quote = '';
  try {
    if (file) quote = evidenceFromLines(file, start, end).quote;
  } catch {
    /* Show validation on attach. */
  }
  return (
    <details className="citation-editor">
      <summary>Source evidence · {connection.evidence?.length ?? 0} excerpts</summary>
      {connection.evidence?.map((e, i) => (
        <div className="attached-evidence" key={i}>
          <code>
            {e.path}:L{e.startLine}–L{e.endLine}
          </code>
          <span>{resolveEvidence(files, e).status}</span>
          <pre>{e.quote}</pre>
          <button
            className="text-button"
            onClick={() => onChange({ evidence: connection.evidence?.filter((_, n) => n !== i) })}
          >
            Remove excerpt {i + 1}
          </button>
        </div>
      ))}
      <label className="field">
        Evidence file
        <select
          aria-label="Evidence file"
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setStart(1);
            setEnd(1);
          }}
        >
          {files.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          Start line
          <input
            type="number"
            min="1"
            max={file ? sourceLines(file.content).length : 1}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
          />
        </label>
        <label className="field">
          End line
          <input
            type="number"
            min={start}
            max={file ? sourceLines(file.content).length : 1}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </label>
      </div>
      {file ? (
        <details>
          <summary>Browse numbered source</summary>
          <pre className="numbered-preview">
            {sourceLines(file.content)
              .map((line, i) => `${i + 1}  ${line}`)
              .join('\n')}
          </pre>
        </details>
      ) : null}
      <pre className="excerpt-preview">{quote || 'Select a non-empty source line range.'}</pre>
      <button
        className="button"
        disabled={(connection.evidence?.length ?? 0) >= 20}
        onClick={() => {
          try {
            if (!file) throw new Error('Choose a source file.');
            onChange({
              evidence: [...(connection.evidence ?? []), evidenceFromLines(file, start, end)],
            });
            setError('');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Attach source excerpt
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </details>
  );
}
