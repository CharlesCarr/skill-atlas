import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { validateManifest } from '../lib/workspace';
import type { Workspace, Manifest, Step, Connection } from '../lib/types';
export function WorkflowEditor({
  workspace,
  onSave,
  onReference,
}: {
  workspace: Workspace;
  onSave: (manifest: Manifest) => void;
  onReference: () => void;
}) {
  const [draft, setDraft] = useState<Manifest>({
    version: 1,
    title: workspace.bundle.title,
    description: workspace.bundle.description,
    steps: structuredClone(workspace.steps),
    connections: structuredClone(workspace.connections),
  });
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [json, setJson] = useState(JSON.stringify(draft, null, 2));
  const [error, setError] = useState('');
  const changeStep = (index: number, patch: Partial<Step>) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  const removeStep = (id: string) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.filter((s) => s.id !== id),
      connections: d.connections.filter((e) => e.from !== id && e.to !== id),
    }));
  const move = (index: number, delta: number) =>
    setDraft((d) => {
      const steps = [...d.steps];
      [steps[index], steps[index + delta]] = [steps[index + delta], steps[index]];
      return { ...d, steps };
    });
  const submit = () => {
    try {
      const value = validateManifest(mode === 'json' ? JSON.parse(json) : draft);
      onSave(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="editor">
      <p className="muted">
        Define the actual handoffs. The Markdown files stay untouched. A skill may appear in several
        steps; a human step marks an operator decision.
      </p>
      <div className="segmented">
        <button
          className={mode === 'form' ? 'active' : ''}
          onClick={() => {
            if (mode === 'json') {
              try {
                setDraft(validateManifest(JSON.parse(json)));
                setMode('form');
                setError('');
              } catch (e) {
                setError((e as Error).message);
              }
            }
          }}
        >
          Visual editor
        </button>
        <button
          className={mode === 'json' ? 'active' : ''}
          onClick={() => {
            setJson(JSON.stringify(draft, null, 2));
            setMode('json');
          }}
        >
          Manifest JSON
        </button>
      </div>
      {mode === 'json' ? (
        <label className="field">
          Version 1 workflow manifest
          <textarea
            className="code-editor"
            rows={22}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
        </label>
      ) : (
        <>
          <label className="field">
            Workflow title
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <label className="field">
            Description
            <textarea
              rows={2}
              value={draft.description ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value || undefined }))
              }
            />
          </label>
          <div className="section-heading">
            <h3>Steps</h3>
            <span>{draft.steps.length} in reading order</span>
          </div>
          {draft.steps.map((s, i) => (
            <div className="edit-step" key={s.id}>
              <div className="edit-step-top">
                <code>
                  {String(i + 1).padStart(2, '0')} / {s.id}
                </code>
                <div className="button-group">
                  <button
                    aria-label={`Move ${s.id} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={`Move ${s.id} down`}
                    disabled={i === draft.steps.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button aria-label={`Remove ${s.id}`} onClick={() => removeStep(s.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="form-grid">
                <label className="field">
                  Step title
                  <input
                    aria-label={`Title for ${s.id}`}
                    value={s.title ?? ''}
                    placeholder={
                      workspace.skills.find((k) => k.id === s.skill)?.title ?? 'Human decision'
                    }
                    onChange={(e) => changeStep(i, { title: e.target.value || undefined })}
                  />
                </label>
                <label className="field">
                  Phase
                  <input
                    value={s.phase ?? ''}
                    onChange={(e) => changeStep(i, { phase: e.target.value || undefined })}
                  />
                </label>
              </div>
              {s.kind !== 'human' ? (
                <label className="field">
                  Skill
                  <select
                    value={s.skill}
                    onChange={(e) => changeStep(i, { skill: e.target.value })}
                  >
                    {workspace.skills.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  Human decision
                  <textarea
                    value={s.description ?? ''}
                    onChange={(e) => changeStep(i, { description: e.target.value || undefined })}
                  />
                </label>
              )}
              <div className="form-grid">
                <label className="field">
                  Inputs · one per line
                  <textarea
                    rows={2}
                    value={s.inputs?.join('\n') ?? ''}
                    onChange={(e) =>
                      changeStep(i, { inputs: e.target.value.split('\n').filter(Boolean) })
                    }
                  />
                </label>
                <label className="field">
                  Outputs · one per line
                  <textarea
                    rows={2}
                    value={s.outputs?.join('\n') ?? ''}
                    onChange={(e) =>
                      changeStep(i, { outputs: e.target.value.split('\n').filter(Boolean) })
                    }
                  />
                </label>
              </div>
            </div>
          ))}
          <div className="button-group">
            <button
              className="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  steps: [
                    ...d.steps,
                    {
                      id: `step-${crypto.randomUUID().slice(0, 8)}`,
                      kind: 'skill',
                      skill: workspace.skills[0].id,
                    },
                  ],
                }))
              }
            >
              <Plus size={15} />
              Add skill step
            </button>
            <button
              className="button"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  steps: [
                    ...d.steps,
                    {
                      id: `human-${crypto.randomUUID().slice(0, 8)}`,
                      kind: 'human',
                      title: 'Operator review',
                    },
                  ],
                }))
              }
            >
              <Plus size={15} />
              Add human step
            </button>
          </div>
          <div className="section-heading">
            <h3>Connections</h3>
            <span>Give every handoff a name</span>
          </div>
          {draft.connections.map((edge, i) => (
            <div className="edit-connection" key={i}>
              <div className="form-grid">
                {(['from', 'to'] as const).map((key) => (
                  <label className="field" key={key}>
                    {key === 'from' ? 'From' : 'To'}
                    <select
                      value={edge[key]}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          connections: d.connections.map((v, n) =>
                            n === i ? { ...v, [key]: e.target.value } : v,
                          ),
                        }))
                      }
                    >
                      {draft.steps.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title ?? s.skill ?? s.id} ({s.id})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="connection-fields">
                <label className="field">
                  Label
                  <input
                    value={edge.label}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        connections: d.connections.map((v, n) =>
                          n === i ? { ...v, label: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                </label>
                <label className="field">
                  Relationship
                  <select
                    value={edge.type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        connections: d.connections.map((v, n) =>
                          n === i ? { ...v, type: e.target.value as Connection['type'] } : v,
                        ),
                      }))
                    }
                  >
                    <option value="handoff">Handoff</option>
                    <option value="reference">Reference</option>
                    <option value="feedback">Feedback</option>
                  </select>
                </label>
                <button
                  aria-label={`Remove connection ${i + 1}`}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      connections: d.connections.filter((_, n) => n !== i),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <button
            className="button"
            disabled={draft.steps.length < 2}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                connections: [
                  ...d.connections,
                  { from: d.steps[0].id, to: d.steps[1].id, label: 'Handoff', type: 'handoff' },
                ],
              }))
            }
          >
            <Plus size={15} />
            Add connection
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <div className="editor-footer">
        <button className="text-button" onClick={onReference}>
          Use Markdown reference map
        </button>
        <button className="button primary" onClick={submit}>
          Save workflow
        </button>
      </div>
    </div>
  );
}
