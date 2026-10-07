<div align="center">

# Skill Atlas

**Make the handoffs visible.**

A document-first workspace for agent skills and the workflows that connect them.
Import the Markdown. Understand each skill. Share the whole picture.

[Live demo](https://charlescarr.github.io/skill-atlas/) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

</div>

![Skill Atlas workflow canvas](docs/images/workflow.png)

Agent workflows often live across SKILL.md files, repository instructions, and reference documents. A list of skills tells you what exists; it doesn't explain who hands what to whom. Skill Atlas brings both views together without rewriting the source or pretending that a mention proves execution order.

## What the MVP does

- **Interactive workflow maps:** pan, zoom, drag nodes, switch direction, hide reference edges, and inspect a step. Branches, feedback, repeated skills, and human decisions are supported.
- **Full skill reading:** Markdown headings, lists, code, tables, task lists, frontmatter, and original source. Internal references open the imported document; missing references are reported.
- **Workflow editing:** define steps, phases, inputs, outputs, and named handoffs in the visual editor or versioned JSON manifest. Changes persist in the browser.
- **Folder and bundle import:** read Codex skill directories, AGENTS.md, agent interface YAML, and supporting text resources. No account, backend, or AI API is needed.
- **Portable sharing:** self-contained offline HTML, vector SVG diagrams, editable workspace bundles, and workflow manifests.
- **Source checks:** malformed/duplicate skills, unresolved mentions, missing files, invalid manifests, and import limits are surfaced explicitly.
- **Responsive interface:** desktop and mobile layouts, keyboard controls, native modal focus management, and reduced-motion support.

The public examples are fictional: a prospecting pipeline and a plan/build/review loop. Private CLI imports are Git-ignored and absent from the production build. The app documents skills; it does not execute them.

## Run locally

Requires Node.js 22+ and npm.

```sh
git clone https://github.com/CharlesCarr/skill-atlas.git
cd skill-atlas
npm ci
npm run dev
```

Open **http://127.0.0.1:4317**. Choose **Import a workflow**, select a repository folder, and explore. Import the repository root to include linked documents outside the individual skill folders. You can also import an exported `.atlas.json` file.

Import limits: **100 skills, 1,200 source files, 8 MB total, 1 MB per file**. Media and binaries are not imported; supporting skill resources are shown as text and never executed.

### Import a private repository from the terminal

```sh
npm run import:skills -- /path/to/repository --name "My team workflow"
npm run dev
```

This writes a mode-0600 bundle into `local/`, which is excluded from Git and production builds. The development server loads it automatically. To supply an external manifest:

```sh
npm run import:skills -- /path/to/repository \
  --manifest /path/to/workflow.yaml
```

Imports are snapshots. Reimport after the source changes, or restore a portable bundle. No source repository is modified. Browser edits change the current manifest overlay; download the manifest to deliberately update the source repository.

## References versus workflows

With **only SKILL.md files**, the app draws a reference map from Markdown links and `$skill-name` mentions, including the exact inline invocation `` `$skill-name` ``. Fenced code is excluded. Reference arrows mean “mentions,” not “runs next.”

With **workflow.yaml or workflow.json**, the manifest defines reading order, step instances, and actual handoffs. One skill can appear in several steps. A human step can mark a review or decision that should never be mistaken for agent work.

```yaml
version: 1
title: Research to review
description: A small workflow with an explicit operator decision.
steps:
  - id: research
    skill: campaign-research
    title: Find the right accounts
    phase: 01 · Evidence
    inputs: [Selected strategy]
    outputs: [Eligible recipients]
  - id: draft
    skill: sequence-drafter
    phase: 02 · Messaging
    inputs: [Source evidence]
    outputs: [Sequence proposal]
  - id: review
    kind: human
    title: Operator review
    description: Review the evidence and proposal before any execution.
connections:
  - from: research
    to: draft
    label: Source evidence
    type: handoff
  - from: draft
    to: review
    label: Sequence proposal
    type: handoff
```

`skill` must match the name in SKILL.md frontmatter. Step ids must be unique; connection endpoints must exist. Connection types are `handoff`, `reference`, and `feedback`. The `steps` array is the reading order; connections show the graph. Without frontmatter, the containing folder supplies the skill name. The editor produces a valid manifest you can export without hand-writing YAML.

See [the complete prospecting example](examples/prospecting/workflow.json) for a coordinating skill used twice, parallel workstreams, and a human review.

![Full Markdown and workflow context](docs/images/skill.png)

## Share with teammates

Use **Share & export**:

| Format              | Use it for                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Self-contained HTML | Send a complete read-only snapshot with the map, handoffs, full documents, and original source. Opens offline. |
| SVG                 | Put a crisp vector diagram into slides or team documentation.                                                  |
| `.atlas.json`       | Transfer or back up an editable workspace, including all original source files.                                |
| `workflow.json`     | Keep the current authored handoffs next to the skills in Git.                                                  |

Document exports contain the imported source text. SVG uses the automatic layout and current direction; transient dragged positions are not saved. An HTML snapshot has no scripts, font service, CDN, or automatic network requests. External source links remain explicitly clickable.

## Build, test, deploy

```sh
npm run check            # strict types, unit tests, production build
npm run verify:public    # assert private loader is absent from dist
npx playwright install chromium
npm run test:e2e         # desktop and mobile browser tests
npm run preview         # production preview on port 4317
```

CI runs type checks, unit tests, builds, public-build checks, and both browser projects. The **Publish demo** workflow deploys `dist/` to GitHub Pages when manually dispatched. For a fork, select **GitHub Actions** in Settings → Pages and run that workflow. The relative Vite base also supports other static hosts.

Private imports are local to your browser or your development checkout. There is no server-side collaboration or synchronization in this MVP. Share an HTML snapshot for reading or a bundle for editing. Imported raw HTML is discarded, unsafe URL protocols are blocked, and referenced images are not fetched automatically. Markdown and its relationships remain the source of truth.

Built with React, TypeScript, Vite, React Flow, Dagre, YAML, unified, and react-markdown. Interface fonts: DM Sans, Manrope, and IBM Plex Mono, bundled with the app. See [the architecture](docs/ARCHITECTURE.md) for contracts, boundaries, and module responsibilities.
