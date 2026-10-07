import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Blocks,
  Workflow,
  BookOpen,
  FolderOpen,
  Plus,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Upload,
  Download,
  FileText,
  GitBranch,
  Users,
  X,
  Code2,
  Check,
  Pencil,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Layers,
  AlertCircle,
  Menu,
  Copy,
  HelpCircle,
} from 'lucide-react';
import { Markdown } from './components/Markdown';
import { Modal } from './components/Modal';
import { WorkflowEditor } from './components/WorkflowEditor';
import {
  bundleFromFiles,
  buildWorkspace,
  includedPath,
  validateBundle,
  slug,
  LIMITS,
} from './lib/workspace';
import { loadSaved, saveBundles } from './lib/storage';
import type { Bundle, Manifest, SourceFile } from './lib/types';
import type { Direction } from './lib/layout';
import demo from './data/demo.json';
const WorkflowMap = lazy(() =>
  import('./components/WorkflowMap').then((m) => ({ default: m.WorkflowMap })),
);
const defaults = demo as Bundle[];
type View = 'map' | 'walkthrough' | 'library' | 'sources';
type Dialog = 'import' | 'export' | 'edit' | 'help' | 'remove' | null;
const viewNames: Record<View, string> = {
  map: 'Workflow map',
  walkthrough: 'Step by step',
  library: 'Skill library',
  sources: 'Source files',
};
const savedAtStart = loadSaved();
export default function App() {
  const [bundles, setBundles] = useState<Bundle[]>(() => [
    ...defaults.filter((d) => !savedAtStart.bundles.some((s) => s.id === d.id)),
    ...savedAtStart.bundles,
  ]);
  const [activeId, setActiveId] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('workflow') ?? defaults[0].id,
  );
  const [view, setView] = useState<View>('map');
  const [selected, setSelected] = useState('');
  const [docPath, setDocPath] = useState('');
  const [raw, setRaw] = useState(false);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(savedAtStart.error ?? '');
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<Direction>('LR');
  const [mobileNav, setMobileNav] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target as HTMLElement).closest('input,textarea,select,dialog,[contenteditable]')
      ) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.search-box input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const bundle = bundles.find((b) => b.id === activeId) ?? bundles[0];
  const workspace = useMemo(() => buildWorkspace(bundle), [bundle]);
  const step = workspace.steps.find((s) => s.id === selected);
  const skill = workspace.skills.find((s) => s.path === docPath || s.id === step?.skill);
  const agentFile = skill
    ? workspace.bundle.files.find(
        (f) => f.path === skill.path.replace(/SKILL\.md$/i, 'agents/openai.yaml'),
      )
    : undefined;
  const source =
    workspace.bundle.files.find((f) => f.path === docPath) ??
    (skill ? { path: skill.path, content: skill.source } : undefined);
  const inspector = !!(step || source);
  const search = query.toLowerCase().trim();
  const filteredSkills = workspace.skills.filter((s) =>
    `${s.title} ${s.id} ${s.description} ${s.source}`.toLowerCase().includes(search),
  );
  const filteredFiles = bundle.files.filter((f) =>
    `${f.path} ${f.content}`.toLowerCase().includes(search),
  );
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const id = setTimeout(() => setStorageError(saveBundles(bundles) ?? ''), 350);
    return () => clearTimeout(id);
  }, [bundles]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    fetch('/__local-workspaces')
      .then((r) => {
        if (!r.ok) throw new Error('Local workspaces could not be loaded.');
        return r.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('Invalid local workspace data.');
        const imports = data.map(validateBundle);
        imports.forEach(buildWorkspace);
        if (!cancelled && imports.length) {
          setBundles((prev) => [
            ...prev,
            ...imports.filter((v) => !prev.some((b) => b.id === v.id)),
          ]);
          if (!location.hash) setActiveId(imports[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) setNotice(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  function switchWorkspace(id: string) {
    setActiveId(id);
    setSelected('');
    setDocPath('');
    setRaw(false);
    setQuery('');
    setMobileNav(false);
    history.replaceState(
      null,
      '',
      `${location.pathname}${location.search}#workflow=${encodeURIComponent(id)}`,
    );
  }
  function selectStep(id: string) {
    setSelected(id);
    setDocPath('');
    setRaw(false);
  }
  function openDoc(path: string, fragment?: string) {
    if (!bundle.files.some((f) => f.path === path)) {
      setNotice(
        `This file was not imported: ${path}. Import the repository root to include references.`,
      );
      return;
    }
    setDocPath(path);
    setSelected('');
    setRaw(false);
    if (fragment)
      setTimeout(() => {
        let target: string;
        try {
          target = decodeURIComponent(fragment).replace(/-/g, ' ').toLowerCase();
        } catch {
          return;
        }
        const heading = [...(docRef.current?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? [])].find(
          (el) => el.textContent?.toLowerCase() === target,
        );
        heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
  }
  function navigate(v: View) {
    setView(v);
    setSelected('');
    setDocPath('');
    setMobileNav(false);
  }
  function addBundle(imported: Bundle) {
    buildWorkspace(imported);
    setBundles((bs) => [...bs.filter((b) => b.id !== imported.id), imported]);
    switchWorkspace(imported.id);
    setView('map');
    setDialog(null);
    setNotice('Workspace imported. Original Markdown preserved.');
  }
  async function importFiles(fileList: FileList | null, folder: boolean) {
    if (!fileList?.length) return;
    setBusy(true);
    setError('');
    try {
      if (!folder) {
        if (fileList[0].size > LIMITS.bytes * 2) throw new Error('Bundle is too large.');
        addBundle(validateBundle(JSON.parse(await fileList[0].text())));
      } else {
        const picked = [...fileList].filter((f) => includedPath(f.webkitRelativePath || f.name));
        if (
          picked.length > LIMITS.files ||
          picked.reduce((sum, f) => sum + f.size, 0) > LIMITS.bytes ||
          picked.some((f) => f.size > LIMITS.fileBytes)
        )
          throw new Error('Import exceeds limits: 1,200 files, 8 MB total, 1 MB per file.');
        const files: SourceFile[] = await Promise.all(
          picked.map(async (f) => ({
            path: f.webkitRelativePath.split('/').slice(1).join('/') || f.name,
            content: await f.text(),
          })),
        );
        addBundle(
          bundleFromFiles(
            files,
            fileList[0].webkitRelativePath.split('/')[0] || 'Imported workflow',
          ),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saveManifest(manifest?: Manifest) {
    try {
      const changed = {
        ...bundle,
        title: manifest?.title ?? bundle.title,
        description: manifest?.description ?? bundle.description,
        manifest,
      };
      buildWorkspace(changed);
      setBundles((bs) => bs.map((b) => (b.id === bundle.id ? changed : b)));
      setDialog(null);
      setSelected('');
      setDocPath('');
      setNotice(
        manifest ? 'Workflow saved in this browser.' : 'Showing references found in the Markdown.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function doExport(kind: 'html' | 'svg' | 'json' | 'manifest') {
    try {
      const { download, diagramSvg, snapshotHtml } = await import('./lib/export');
      const name = slug(bundle.title);
      if (kind === 'html')
        download(snapshotHtml(workspace, direction), `${name}.html`, 'text/html');
      if (kind === 'svg')
        download(diagramSvg(workspace, direction), `${name}.svg`, 'image/svg+xml');
      if (kind === 'json')
        download(JSON.stringify(bundle, null, 2), `${name}.atlas.json`, 'application/json');
      if (kind === 'manifest')
        download(
          JSON.stringify(
            bundle.manifest ?? {
              version: 1,
              title: bundle.title,
              description: bundle.description,
              steps: workspace.steps,
              connections: workspace.connections,
            },
            null,
            2,
          ),
          'workflow.json',
          'application/json',
        );
      setNotice('Export downloaded.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside
        className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            switchWorkspace(defaults[0].id);
            navigate('map');
          }}
        >
          <div className="brand-icon">
            <Blocks size={21} />
          </div>
          <span>
            skill atlas<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="avatar">C</span>
          <div>
            CYMBA LABS<small>Workflow workspace</small>
          </div>
          <span className="local-pill">LOCAL</span>
        </div>
        <nav className="main-nav">
          {(
            [
              { id: 'map', icon: Workflow },
              { id: 'library', icon: BookOpen },
              { id: 'sources', icon: FolderOpen },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              className={
                view === v.id || (v.id === 'map' && view === 'walkthrough')
                  ? 'nav-item active'
                  : 'nav-item'
              }
              onClick={() => navigate(v.id)}
            >
              <v.icon size={18} />
              {v.id === 'map' ? 'Workflows' : viewNames[v.id]}
              {v.id === 'library' ? <span>{workspace.skills.length}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-section">
          <span>YOUR WORKFLOWS</span>
          <button
            aria-label="Import a workflow"
            onClick={() => {
              setError('');
              setDialog('import');
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="workflow-list">
          {bundles.map((b) => (
            <button
              key={b.id}
              onClick={() => switchWorkspace(b.id)}
              className={`workflow-item ${b.id === bundle.id ? 'selected' : ''}`}
            >
              <span className={`workflow-dot ${b.id === 'engineering-demo' ? 'slate' : ''}`} />
              <span>{b.title}</span>
              {b.id === bundle.id ? <ChevronRight size={13} /> : null}
            </button>
          ))}
        </div>
        <button
          className="import-sidebar"
          onClick={() => {
            setError('');
            setDialog('import');
          }}
        >
          <Plus size={16} />
          Import a workflow
        </button>
        <div className="sidebar-bottom">
          <div className="source-note">
            <div className="source-note-icon">
              <FileText size={17} />
            </div>
            <strong>Markdown is the source.</strong>
            <p>
              Your skills, as written.
              <br />
              Their connections, made clear.
            </p>
          </div>
          <button className="nav-item" onClick={() => setDialog('help')}>
            <HelpCircle size={17} />
            How it works
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-footer">
            OPEN SOURCE <span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobileNav((v) => !v)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{bundle.title}</strong>
          </div>
          <div className="topbar-right">
            <span className="privacy">
              <ShieldCheck size={14} />
              Stays in your browser
            </span>
            <button className="icon-button" aria-label="Help" onClick={() => setDialog('help')}>
              <HelpCircle size={18} />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <section className="workspace-header">
            <div className="eyebrow">
              <span className="status-dot" />
              THE WORKFLOW, IN CONTEXT
            </div>
            <div className="title-row">
              <h1>
                {view === 'library'
                  ? 'Every skill. A clear purpose.'
                  : view === 'sources'
                    ? 'Straight from the source.'
                    : bundle.title}
              </h1>
              <div className="header-actions">
                <button
                  className="button"
                  onClick={() => {
                    setError('');
                    setDialog('edit');
                  }}
                >
                  <Pencil size={15} />
                  Edit workflow
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    setError('');
                    setDialog('export');
                  }}
                >
                  <Upload size={15} />
                  Share & export
                </button>
              </div>
            </div>
            <p className="workspace-description">
              {view === 'library'
                ? 'Understand each skill on its own, then see where it fits in the bigger picture.'
                : view === 'sources'
                  ? 'Original Markdown and supporting documents, preserved exactly as imported.'
                  : bundle.description}
            </p>
            <div className="workspace-meta">
              <span>
                <Blocks size={14} />
                {workspace.skills.length} skills
              </span>
              <span>
                <GitBranch size={14} />
                {workspace.connections.length} connections
              </span>
              <span>
                <Users size={14} />
                {workspace.steps.filter((s) => s.kind === 'human').length} human steps
              </span>
              <span className="metadata-badge">
                <FileText size={12} />
                {workspace.authored
                  ? 'Defined in workflow manifest'
                  : 'References found in Markdown'}
              </span>
            </div>
          </section>
          {storageError ? (
            <div className="banner warning" role="alert">
              <AlertCircle size={16} />
              {storageError}
            </div>
          ) : null}
          {!workspace.authored ? (
            <div className="banner">
              <GitBranch size={16} />
              These lines show skill references, not execution order. Use “Edit workflow” to define
              the handoffs.
            </div>
          ) : null}
          <div className="view-bar">
            <div className="tabs" role="tablist" aria-label="Workspace view">
              {(['map', 'walkthrough', 'library', 'sources'] as const).map((v) => (
                <button
                  role="tab"
                  aria-selected={view === v}
                  className={view === v ? 'active' : ''}
                  onClick={() => navigate(v)}
                  key={v}
                >
                  {v === 'map' ? (
                    <Workflow size={15} />
                  ) : v === 'walkthrough' ? (
                    <Layers size={15} />
                  ) : v === 'library' ? (
                    <BookOpen size={15} />
                  ) : (
                    <Code2 size={15} />
                  )}
                  <span>{viewNames[v]}</span>
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={15} />
              <input
                aria-label="Search skills and source files"
                placeholder="Search skills & source…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (view === 'map' || view === 'walkthrough') setView('library');
                }}
              />
              {query ? (
                <button aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={12} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
          </div>
          <div className={`workspace-content ${inspector ? 'with-inspector' : ''}`}>
            <div className="content-primary">
              {view === 'map' ? (
                <Suspense fallback={<div className="loading">Preparing the workflow canvas…</div>}>
                  <WorkflowMap
                    key={bundle.id}
                    workspace={workspace}
                    selected={selected}
                    onSelect={selectStep}
                    direction={direction}
                    setDirection={setDirection}
                  />
                </Suspense>
              ) : null}
              {view === 'walkthrough' ? (
                <div className="walkthrough">
                  <div className="content-intro">
                    <h2>A closer look at the handoffs.</h2>
                    <p>
                      Reading order comes from the manifest. Branches and return paths remain
                      visible on the map.
                    </p>
                  </div>
                  {workspace.steps.map((s, i) => {
                    const sk = workspace.skills.find((k) => k.id === s.skill);
                    return (
                      <button
                        className={`walk-step ${selected === s.id ? 'active' : ''}`}
                        key={s.id}
                        onClick={() => selectStep(s.id)}
                      >
                        <span className="walk-number">{String(i + 1).padStart(2, '0')}</span>
                        <div>
                          <div className="eyebrow">
                            {s.phase ?? (s.kind === 'human' ? 'Human decision' : 'Skill')}
                          </div>
                          <h3>{s.title ?? sk?.title ?? s.id}</h3>
                          <p>{s.description ?? sk?.description}</p>
                          <div className="handoff-tags">
                            {workspace.connections
                              .filter((e) => e.from === s.id)
                              .map((e, n) => (
                                <span key={n}>
                                  <ArrowRight size={12} />
                                  {e.label} <small>({e.type})</small>
                                </span>
                              ))}
                          </div>
                        </div>
                        <ArrowUpRight size={17} />
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {view === 'library' ? (
                <div className="library">
                  <div className="content-intro">
                    <h2>{filteredSkills.length} skills in this workspace</h2>
                    <p>
                      Select a skill to read the full instructions and its place in the workflow.
                    </p>
                  </div>
                  <div className="library-grid">
                    {filteredSkills.map((s, i) => (
                      <button
                        className={`library-card tone-${['graphite', 'slate', 'stone', 'mist'][i % 4]}`}
                        key={s.id}
                        onClick={() => openDoc(s.path)}
                      >
                        <div className="library-card-top">
                          <span className="skill-icon">
                            <FileText size={19} />
                          </span>
                          <ArrowUpRight size={17} />
                        </div>
                        <code>{s.id}</code>
                        <h3>{s.title}</h3>
                        <p>{s.description || 'No description in frontmatter.'}</p>
                        <div className="library-card-footer">
                          <span>{s.sections.filter((v) => v.depth === 2).length} sections</span>
                          <span>
                            {workspace.steps.filter((v) => v.skill === s.id).length} workflow steps
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!filteredSkills.length ? (
                    <div className="empty-state">
                      <Search size={24} />
                      <h3>No skills match “{query}”</h3>
                      <p>Try a skill name, an instruction, or a handoff.</p>
                      <button className="button" onClick={() => setQuery('')}>
                        Clear search
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {view === 'sources' ? (
                <div className="sources">
                  <div className="content-intro">
                    <h2>{filteredFiles.length} original files</h2>
                    <p>
                      Import the repository root to include AGENTS.md and linked reference
                      documents.
                    </p>
                  </div>
                  {filteredFiles.map((f) => (
                    <button
                      className={`source-row ${source?.path === f.path ? 'active' : ''}`}
                      key={f.path}
                      onClick={() => openDoc(f.path)}
                    >
                      <FileText size={17} />
                      <div>
                        <strong>{f.path.split('/').at(-1)}</strong>
                        <code>{f.path}</code>
                      </div>
                      <span>{new TextEncoder().encode(f.content).length.toLocaleString()} B</span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                  {!filteredFiles.length ? (
                    <div className="empty-state">No files match this search.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {inspector ? (
              <aside className="inspector" aria-label="Skill inspector">
                <div className="inspector-header">
                  <span>
                    {step?.kind === 'human'
                      ? 'HUMAN DECISION'
                      : source && !skill
                        ? 'REFERENCE DOCUMENT'
                        : 'SKILL DETAILS'}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Close inspector"
                    onClick={() => {
                      setSelected('');
                      setDocPath('');
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="inspector-body" ref={docRef}>
                  <div className="eyebrow">{step?.phase ?? 'Source document'}</div>
                  <h2>{step?.title ?? skill?.title ?? source?.path.split('/').at(-1)}</h2>
                  {step?.description || skill?.description ? (
                    <p className="inspector-description">
                      {step?.description ?? skill?.description}
                    </p>
                  ) : null}
                  {step ? (
                    <div className="io-grid">
                      {(['inputs', 'outputs'] as const).map((key) =>
                        step[key]?.length ? (
                          <div key={key}>
                            <h4>{key === 'inputs' ? 'Comes in' : 'Goes out'}</h4>
                            {step[key]!.map((v) => (
                              <span key={v}>{v}</span>
                            ))}
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                  {step || skill ? (
                    <div className="relationships">
                      <h4>In the workflow</h4>
                      {workspace.steps
                        .filter((s) => s.id === step?.id || (!step && s.skill === skill?.id))
                        .map((s) => (
                          <div key={s.id}>
                            {!step ? (
                              <button
                                className="step-jump"
                                onClick={() => {
                                  selectStep(s.id);
                                  setView('map');
                                }}
                              >
                                {s.title ?? s.skill}
                                <ArrowUpRight size={12} />
                              </button>
                            ) : null}
                            {workspace.connections
                              .filter((e) => e.from === s.id || e.to === s.id)
                              .map((e, i) => {
                                const incoming = e.to === s.id;
                                const target = workspace.steps.find(
                                  (v) => v.id === (incoming ? e.from : e.to),
                                );
                                return (
                                  <button
                                    className="relationship"
                                    key={i}
                                    onClick={() => selectStep(target!.id)}
                                  >
                                    <span>{incoming ? '←' : '→'}</span>
                                    <div>
                                      <strong>{e.label}</strong>
                                      <small>
                                        {target?.title ?? target?.skill} · {e.type}
                                      </small>
                                    </div>
                                    <ChevronRight size={12} />
                                  </button>
                                );
                              })}
                          </div>
                        ))}
                      {!step && !workspace.steps.some((s) => s.skill === skill?.id) ? (
                        <p className="muted">
                          This skill is not in the authored workflow. Add it in the editor.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {source ? (
                    <>
                      <div className="document-toolbar">
                        <span>
                          <FileText size={13} />
                          {skill ? 'SKILL.md' : source.path.split('/').at(-1)}
                        </span>
                        <div className="segmented">
                          <button className={!raw ? 'active' : ''} onClick={() => setRaw(false)}>
                            Read
                          </button>
                          <button className={raw ? 'active' : ''} onClick={() => setRaw(true)}>
                            Source
                          </button>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Copy original source"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(source.content)
                              .then(() => setNotice('Original source copied.'))
                              .catch(() =>
                                setNotice('Clipboard unavailable. Download the source instead.'),
                              )
                          }
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Download original source"
                          onClick={async () => {
                            const { download } = await import('./lib/export');
                            download(
                              source.content,
                              source.path.split('/').at(-1)!,
                              'text/markdown',
                            );
                          }}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <code className="source-path">{source.path}</code>
                      {raw || !/\.md$/i.test(source.path) ? (
                        <pre className="source-code">
                          <code>{source.content}</code>
                        </pre>
                      ) : (
                        <>
                          {skill && Object.keys(skill.frontmatter).length ? (
                            <details className="frontmatter">
                              <summary>Frontmatter metadata</summary>
                              <pre>{JSON.stringify(skill.frontmatter, null, 2)}</pre>
                            </details>
                          ) : null}
                          {agentFile ? (
                            <details className="frontmatter">
                              <summary>Codex agent interface · openai.yaml</summary>
                              <pre>{agentFile.content}</pre>
                            </details>
                          ) : null}
                          {skill?.sections.filter((s) => s.depth === 2).length ? (
                            <details className="toc">
                              <summary>
                                In this skill · {skill.sections.filter((s) => s.depth === 2).length}{' '}
                                sections
                              </summary>
                              {skill.sections
                                .filter((s) => s.depth === 2)
                                .map((s, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      const h = [
                                        ...(docRef.current?.querySelectorAll('.markdown h2') ?? []),
                                      ].find((h) => h.textContent === s.title);
                                      h?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                  >
                                    {s.title}
                                  </button>
                                ))}
                            </details>
                          ) : null}
                          <Markdown
                            content={skill?.body ?? source.content}
                            path={source.path}
                            files={bundle.files}
                            onOpen={openDoc}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <div className="human-note">
                      <Users size={20} />
                      <h3>The operator takes it from here.</h3>
                      <p>
                        This is a documented decision point. Skill Atlas does not run skills or
                        launch campaigns.
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            ) : null}
          </div>
          <div className="workspace-footer">
            <span>
              <ShieldCheck size={13} />
              Original Markdown preserved · no skills are executed
            </span>
            <button
              className={workspace.issues.length ? 'issues-button has-issues' : 'issues-button'}
              onClick={() => setDialog('help')}
            >
              {workspace.issues.length ? <AlertCircle size={13} /> : <Check size={13} />}{' '}
              {workspace.issues.length
                ? `${workspace.issues.length} source issues`
                : 'Source references checked'}
            </button>
            <button className="text-button remove-workspace" onClick={() => setDialog('remove')}>
              <Trash2 size={12} />
              Remove workspace
            </button>
          </div>
        </main>
      </div>
      {notice ? (
        <div role="status" className="toast">
          <Check size={16} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      ) : null}
      {dialog === 'import' ? (
        <Modal title="Bring your skills into view." onClose={() => setDialog(null)}>
          <p className="muted">
            Choose a repository folder with SKILL.md files, or restore a portable Skill Atlas
            bundle. Files are read locally.
          </p>
          <label className={`import-option ${busy ? 'disabled' : ''}`}>
            <span className="import-icon">
              <FolderOpen size={23} />
            </span>
            <strong>Import a skill folder</strong>
            <p>
              Skill Markdown, AGENTS.md, agent interface YAML, supporting text resources, and an
              optional workflow manifest.
            </p>
            <span className="button primary">
              {busy ? 'Reading files…' : 'Choose folder'}
              <ArrowRight size={14} />
            </span>
            <input
              type="file"
              multiple
              {...{ webkitdirectory: '' }}
              aria-label="Import skill folder"
              disabled={busy}
              onChange={(e) => void importFiles(e.target.files, true)}
            />
          </label>
          <label className="import-option compact">
            <FileText size={22} />
            <div>
              <strong>Restore a workflow bundle</strong>
              <p>Import a .atlas.json file exported by Skill Atlas.</p>
            </div>
            <input
              type="file"
              accept=".json"
              aria-label="Import workflow bundle"
              disabled={busy}
              onChange={(e) => void importFiles(e.target.files, false)}
            />
            <ChevronRight size={17} />
          </label>
          <div className="banner">
            <ShieldCheck size={15} />
            No server upload, account, or AI API required. Up to 100 skills / 8 MB per workspace.
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {dialog === 'export' ? (
        <Modal title="A workflow worth sharing." onClose={() => setDialog(null)}>
          <p className="muted">
            Exports are snapshots of <strong>{bundle.title}</strong>. Document exports include the
            original imported text.
          </p>
          <div className="export-options">
            <button onClick={() => void doExport('html')}>
              <span className="export-icon">
                <ExternalLink size={22} />
              </span>
              <div>
                <strong>Shareable HTML</strong>
                <p>Diagram, handoffs, and full documents. Opens offline in any browser.</p>
                <small>SELF-CONTAINED · READ-ONLY</small>
              </div>
              <Download size={18} />
            </button>
            <button onClick={() => void doExport('svg')}>
              <span className="export-icon">
                <Workflow size={22} />
              </span>
              <div>
                <strong>Workflow diagram</strong>
                <p>A crisp SVG for slides, docs, and team conversations.</p>
                <small>VECTOR · EXPORTS CURRENT DIRECTION</small>
              </div>
              <Download size={18} />
            </button>
            <button onClick={() => void doExport('json')}>
              <span className="export-icon">
                <Blocks size={22} />
              </span>
              <div>
                <strong>Portable workspace</strong>
                <p>All source files and the manifest. Import it to keep editing.</p>
                <small>VERSION 1 · .ATLAS.JSON</small>
              </div>
              <Download size={18} />
            </button>
            <button onClick={() => void doExport('manifest')}>
              <span className="export-icon">
                <Code2 size={22} />
              </span>
              <div>
                <strong>Workflow manifest</strong>
                <p>Keep your handoffs alongside the skills in Git.</p>
                <small>WORKFLOW.JSON · NO SKILL CONTENT</small>
              </div>
              <Download size={18} />
            </button>
          </div>
          {workspace.issues.length ? (
            <div className="banner warning">
              {workspace.issues.length} source issues will be recorded in the HTML snapshot.
            </div>
          ) : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {dialog === 'edit' ? (
        <Modal title="Define the workflow." onClose={() => setDialog(null)} wide>
          <WorkflowEditor
            workspace={workspace}
            onSave={saveManifest}
            onReference={() => saveManifest()}
          />
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
      {dialog === 'remove' ? (
        <Modal title="Remove this workspace?" onClose={() => setDialog(null)}>
          <p>
            This removes “{bundle.title}” from this browser. Export a portable bundle first if you
            want to keep edits. Example workflows return on reload; CLI imports remain on disk.
          </p>
          <div className="button-group">
            <button className="button" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                setBundles((bs) => {
                  const rest = bs.filter((b) => b.id !== bundle.id);
                  return rest.length ? rest : defaults;
                });
                switchWorkspace(defaults[0].id);
                setDialog(null);
              }}
            >
              Remove workspace
            </button>
          </div>
        </Modal>
      ) : null}
      {dialog === 'help' ? (
        <Modal title="Skills, understood together." onClose={() => setDialog(null)} wide>
          <div className="help-copy">
            <p>
              Skill Atlas is a documentation workspace for agent skills. It reads files, reveals
              references, and lets you define the actual handoffs.
            </p>
            <ol>
              <li>
                <strong>Import the source.</strong> Choose the repository root to include SKILL.md,
                AGENTS.md, and Markdown references. Frontmatter is parsed; the original text remains
                unchanged.
              </li>
              <li>
                <strong>Define the workflow.</strong> With no manifest, arrows only mean “this skill
                mentions that skill.” Use the editor to define steps, repeated skills, branches,
                feedback, inputs, outputs, and human decisions.
              </li>
              <li>
                <strong>Share the context.</strong> Export a self-contained HTML snapshot, SVG map,
                or editable bundle. Files remain in browser storage unless you explicitly export
                them.
              </li>
            </ol>
            <p>
              The included public examples are fictional. Your local imports are not part of the
              public repository. There is no account, analytics, backend, or skill execution.
            </p>
            <h3>Import from a terminal</h3>
            <pre className="source-code">
              npm run import:skills -- /path/to/repo --name "My workflow"{`\n`}npm run dev
            </pre>
            <p>
              CLI imports live in Git-ignored <code>local/</code> and are available only on the
              development server. Production builds include the fictional examples.
            </p>
            <h3>Source checks</h3>
            {workspace.issues.length ? (
              <div className="issue-list">
                {workspace.issues.map((i, n) => (
                  <div key={n}>
                    <span className={`issue-severity ${i.severity}`}>{i.severity}</span>
                    <strong>{i.message}</strong>
                    <code>{i.path}</code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="success">
                <Check size={15} />
                All skill references resolve in this workspace.
              </p>
            )}
            <p>
              Relative paths are resolved as written. Missing files are reported; their location or
              meaning is never silently guessed. Malformed skills are reported and omitted from the
              diagram. Diagrams describe instructions, not observed execution.
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
