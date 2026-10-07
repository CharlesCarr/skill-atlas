import { useState } from 'react';
import type { Bundle, Evidence, Workspace } from '../lib/types';
import { compareSources, connectionStatus, evidenceUrl, resolveEvidence } from '../lib/trust';
import { buildWorkspace } from '../lib/workspace';

export function SourceReview({
  workspace,
  status,
  focused,
  busy,
  onRefresh,
  onLocal,
  onReview,
  onOpen,
  onEdit,
}: {
  workspace: Workspace;
  status: string;
  focused?: number;
  busy: boolean;
  onRefresh: () => void;
  onLocal: () => void;
  onReview: () => void;
  onOpen: (evidence: Evidence) => void;
  onEdit: () => void;
}) {
  const { bundle, connections } = workspace,
    snapshot = bundle.source;
  const attention = connections.filter(
    (e) => connectionStatus(bundle.files, e) === 'Evidence needs attention',
  ).length;
  return (
    <div className="source-review">
      <p className="muted">
        A snapshot of the instructions behind this map. Excerpts can match while a handoff still
        needs human review.
      </p>
      <div className="revision-card">
        <div className="eyebrow">SOURCE SNAPSHOT</div>
        <strong>
          {snapshot?.repository ??
            (snapshot?.kind === 'git' ? 'Local Git repository' : 'Local files / example')}
        </strong>
        <code>
          {snapshot?.commit
            ? `${snapshot.commit}${snapshot.dirty ? ' + local source changes' : ''}`
            : 'No Git revision recorded'}
        </code>
        {snapshot?.directory ? <span>Subfolder: {snapshot.directory}</span> : null}
        <span>
          {snapshot?.ref ? `Tracking ${snapshot.ref} · ` : ''}
          {snapshot
            ? `Imported ${new Date(snapshot.importedAt).toLocaleString()}`
            : 'Import source files to record a snapshot.'}
        </span>
        <span className="review-badge">{status}</span>
        {bundle.review ? (
          <small>Last human review: {new Date(bundle.review.reviewedAt).toLocaleString()}</small>
        ) : null}
      </div>
      <div className="button-group">
        {snapshot?.kind === 'github' ? (
          <button className="button" onClick={onRefresh} disabled={busy}>
            {busy ? 'Checking GitHub…' : 'Check GitHub for changes'}
          </button>
        ) : null}
        <button className="button" onClick={onLocal} disabled={busy}>
          Compare updated folder or bundle
        </button>
        <button className="button" onClick={onEdit}>
          Edit connection evidence
        </button>
      </div>
      <div className="section-heading">
        <h3>Connection evidence</h3>
        <span>
          {connections.filter((e) => e.evidence?.length).length} / {connections.length} cited
        </span>
      </div>
      {connections.length ? (
        connections.map((edge, i) => (
          <details className="evidence-card" key={i} open={focused === i ? true : undefined}>
            <summary>
              <strong>{edge.label}</strong>
              <span>{connectionStatus(bundle.files, edge)}</span>
            </summary>
            <p className="muted">
              <code>{edge.from}</code> → <code>{edge.to}</code> · {edge.type}
            </p>
            {edge.evidence?.length ? (
              edge.evidence.map((e, n) => {
                const result = resolveEvidence(bundle.files, e),
                  url = evidenceUrl(bundle, e);
                return (
                  <div className="evidence-excerpt" key={n}>
                    <code>
                      {e.path}:L{result.startLine ?? e.startLine}–L{result.endLine ?? e.endLine}
                    </code>
                    <small>
                      {result.status === 'matches'
                        ? 'Exact excerpt matches imported source'
                        : result.status === 'moved'
                          ? `Exact excerpt relocated from line ${e.startLine}`
                          : result.status === 'missing'
                            ? 'Source file was removed'
                            : result.status === 'ambiguous'
                              ? 'Multiple matching locations; reattach the intended excerpt'
                              : 'Excerpt changed or was removed; reattach after review'}
                    </small>
                    <pre>{e.quote}</pre>
                    <div className="button-group">
                      <button
                        className="text-button"
                        onClick={() => onOpen(e)}
                        disabled={result.status === 'missing'}
                      >
                        Open source lines
                      </button>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          View at recorded commit ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">
                This relationship is authored without a source citation. Add the instruction that
                supports it in the workflow editor.
              </p>
            )}
          </details>
        ))
      ) : (
        <p className="muted">No connections in this workspace.</p>
      )}
      <div className="review-footer">
        <p className="muted">
          Mark reviewed after checking the instructions and handoffs. Any source or workflow edit
          invalidates this review. Uncited connections remain visibly uncited.
        </p>
        <button
          className="button primary"
          disabled={busy || !!attention || status === 'Checking review…'}
          onClick={onReview}
        >
          Mark snapshot reviewed
        </button>
        {attention ? (
          <p role="status">
            Repair {attention} connection(s) with changed, missing, or ambiguous evidence before
            marking reviewed.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ChangeReview({
  before,
  incoming,
  onApply,
}: {
  before: Bundle;
  incoming: Bundle;
  onApply: (bundle: Bundle) => void;
}) {
  const [mode, setMode] = useState<'keep' | 'incoming'>('keep');
  const changes = compareSources(before, incoming);
  const manifestChanged =
    JSON.stringify(before.manifest ?? null) !== JSON.stringify(incoming.manifest ?? null);
  const candidate = {
    ...incoming,
    id: before.id,
    ...(mode === 'keep'
      ? { manifest: before.manifest, title: before.title, description: before.description }
      : {}),
    review: before.review,
  };
  let problem = '';
  try {
    if (
      before.source?.repository &&
      incoming.source?.repository &&
      (before.source.repository !== incoming.source.repository ||
        (before.source.directory ?? '') !== (incoming.source.directory ?? ''))
    )
      throw new Error(
        'This snapshot is from a different repository or subfolder. Import it as a separate workspace.',
      );
    buildWorkspace(candidate);
  } catch (e) {
    problem = (e as Error).message;
  }
  return (
    <div className="change-review">
      <p className="muted">
        Review the incoming snapshot before replacing the current sources. Cancel leaves your
        workspace untouched.
      </p>
      <div className="revision-comparison">
        <div>
          <span>Current</span>
          <code>
            {before.source?.commit?.slice(0, 12) ?? 'Unversioned snapshot'}
            {before.source?.dirty ? ' + local changes' : ''}
          </code>
        </div>
        <div>
          <span>Incoming</span>
          <code>
            {incoming.source?.commit?.slice(0, 12) ?? 'Unversioned snapshot'}
            {incoming.source?.dirty ? ' + local changes' : ''}
          </code>
        </div>
      </div>
      <div className="section-heading">
        <h3>{changes.length} source file changes</h3>
        <span>
          {manifestChanged ? 'Workflow definitions differ' : 'Workflow definition unchanged'}
        </span>
      </div>
      {!changes.length ? (
        <p>
          No imported file contents changed. A newer commit may include changes outside this
          workspace.
        </p>
      ) : null}
      {changes.map((change) => {
        const affected = (before.manifest?.connections ?? []).filter((e) =>
          e.evidence?.some((c) => c.path === change.path),
        );
        return (
          <details className="file-change" key={change.path}>
            <summary>
              <code>{change.path}</code>
              <span>
                {change.kind} · {affected.length} cited connections
              </span>
            </summary>
            <div className="diff-columns">
              <div>
                <h4>Before</h4>
                <pre>{change.before ?? '(file absent)'}</pre>
              </div>
              <div>
                <h4>After</h4>
                <pre>{change.after ?? '(file removed)'}</pre>
              </div>
            </div>
          </details>
        );
      })}
      <fieldset className="workflow-choice">
        <legend>Workflow definition to keep</legend>
        <label>
          <input
            type="radio"
            name="update-mode"
            checked={mode === 'keep'}
            onChange={() => setMode('keep')}
          />{' '}
          Keep my current workflow and its citations
        </label>
        <label>
          <input
            type="radio"
            name="update-mode"
            checked={mode === 'incoming'}
            onChange={() => setMode('incoming')}
          />{' '}
          Use the incoming {incoming.manifest ? 'workflow definition' : 'Markdown reference map'}
        </label>
      </fieldset>
      <p className="muted">
        Changed source or workflow content requires a new human review. Source excerpts are checked
        again after applying.
      </p>
      {problem ? (
        <p className="error" role="alert">
          {problem}
        </p>
      ) : null}
      <button className="button primary" disabled={!!problem} onClick={() => onApply(candidate)}>
        Apply source update
      </button>
    </div>
  );
}
