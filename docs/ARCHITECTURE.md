# Architecture

Skill Atlas is a static React application built with Vite and strict TypeScript. React Flow handles interactive diagrams; Dagre computes graph positions. YAML, unified, remark-parse, and remark-gfm read source metadata and Markdown. react-markdown renders documents without raw HTML. Fonts are bundled locally.

## Data flow

```mermaid
flowchart LR
  Files[Local folder / bundle] --> Validate[Validate limits and paths]
  Validate --> Source[Immutable source files]
  Source --> Parse[Frontmatter and Markdown AST]
  Parse --> Skills[Skill library and source issues]
  Skills --> Reference[Reference map]
  Manifest[Optional workflow manifest] --> Authored[Authored steps and handoffs]
  Skills --> Authored
  Reference --> UI[React workspace]
  Authored --> UI
  UI --> Store[Versioned browser storage]
  UI --> Export[Offline HTML / SVG / JSON]
```

A workspace bundle carries the original files and an optional version 1 manifest. `buildWorkspace` derives skills, relationships, and source issues without mutating the originals. A file named SKILL.md identifies a skill. Name and description come from YAML frontmatter, with a directory-name and heading fallback for skills without metadata. Arbitrary frontmatter fields remain available for inspection.

Dollar mentions are extracted from Markdown text nodes, excluding fenced code. An inline code span containing exactly `$skill-name` is treated as a skill reference, matching Codex invocation conventions. Markdown links and reference-style links resolve to imported files. Duplicate names produce an error and omit the ambiguous duplicate. Malformed skills appear in source issues. A workspace with no valid skills is rejected. Missing skill mentions and linked files are warnings.

Without a manifest, every edge is explicitly a reference. With a manifest, ordered steps and labeled connections describe an authored interpretation of the instructions. The manifest can contain repeated uses of the same skill, branches, loops, and human decisions. Reading order is the steps array, not an inferred topological order. Dagre lays out forward handoffs; feedback edges remain visible without affecting forward rank. No diagram describes observed execution.

## Boundaries

Browser imports are local file reads, followed by browser localStorage persistence. There is no backend, telemetry, AI model call, or uploaded document store. Storage failures leave the current session functional and produce an export reminder. Invalid imports do not replace a valid workspace. The dialog uses the native modal focus trap.

The development-only Vite middleware exposes `local/*.json` on the loopback development server. It has no production implementation. The CLI skips symlinks and dependency/build directories, imports Markdown, agent interface YAML, skill supporting text resources, and the workflow manifest, and writes a mode-0600 bundle in Git-ignored `local/`. Production builds contain public examples only; browser imports made after deployment remain in that browser.

Import limits: 1,200 source files, 100 skills, 150 manifest steps, 600 connections, 8 MB of source text per workspace, and 1 MB per file. The parser uses YAML alias limits and rejects circular metadata. Relative paths cannot escape the selected import root.

Markdown raw HTML is discarded. Markdown URL transformation blocks unsafe protocols. Imported images are replaced with descriptive placeholders to avoid automatic external requests. Internal document links open imported files; missing files show a notice. External links open explicitly in a separate tab. Exports escape user-controlled text and render Markdown through the same safe renderer.

## Exports

- **HTML:** a complete read-only snapshot containing a vector diagram, step inputs/outputs, full documents, original source in disclosure panels, and source issues. It has no scripts or external assets and works offline. Links to included documents become anchors. External links require an explicit click.
- **SVG:** a deterministic diagram with the selected horizontal or vertical direction, relationship labels, and a legend. It exports the automatic layout, not transient drag positions.
- **Bundle JSON:** lossless source files and current authored manifest, ready to reimport.
- **Manifest JSON:** workflow metadata only, ready to save as workflow.json alongside the skills.

The workflow editor changes the bundle's current manifest. It never rewrites imported source files, including an originally imported manifest file. Download the current manifest to deliberately update the source repository. Skill text editing and live filesystem watching are outside this MVP.

## Modules

| Module                            | Responsibility                                        |
| --------------------------------- | ----------------------------------------------------- |
| src/lib/workspace.ts              | Source parsing, validation, reference resolution      |
| src/lib/types.ts                  | Versioned source, bundle, skill, step, edge contracts |
| src/lib/layout.ts                 | Automatic graph layout and shared dimensions          |
| src/lib/storage.ts                | Browser persistence and failure handling              |
| src/lib/export.tsx                | Escaped, self-contained exports                       |
| src/components/WorkflowMap.tsx    | Interactive canvas, selection, pan/zoom               |
| src/components/WorkflowEditor.tsx | Step/relationship editing and manifest validation     |
| src/components/Markdown.tsx       | Safe Markdown, internal file navigation               |
| src/App.tsx                       | Workspace composition, imports, navigation, inspector |
| scripts/import-skills.ts          | Local filesystem import into private bundles          |

## Verification

Unit tests exercise source fidelity, multiline YAML, reference-style links, code exclusion, missing/duplicate skills, manifest validation, limits, roundtrips, and export injection resistance. Playwright exercises imports, editor persistence, missing references, document navigation, export contents/offline behavior, focus, diagram direction, and desktop/mobile overflow. CI runs these checks and a public-build separation check. No backend or external integration is required.

## Source provenance and change review

Version 1 bundles remain backward-compatible with optional `source` and `review` records. `source` records the import kind, repository URL when known, full commit, selected ref, relative directory, dirty source state, and import time. A folder picker cannot see `.git` and never claims a commit. The CLI compares each imported file’s Git object hash with HEAD, including ignored/untracked source files; it resolves real filesystem paths and rejects a changing HEAD. Dirty state applies to imported text, not unrelated repository changes. Arbitrary remote URLs and embedded credentials are never copied into bundles.

`github.ts` reads only the fixed GitHub API origin. It resolves a branch once, traverses the resulting immutable tree, downloads up to four blobs concurrently, checks Git object SHA-1 hashes against the tree, preserves UTF-8 BOM and CRLF bytes, and rejects truncated trees, symlinks, non-UTF-8 data, rate-limit failures and incomplete imports. It does not use or persist authentication tokens. Its bundle is staged before existing sources are replaced. Private source remains a local CLI import.

`compareSources` compares exact text and reports added, removed and modified paths. The update dialog exposes both versions and the affected cited connections, then lets the operator retain the current manifest overlay or explicitly select the imported definition. Validation occurs before application. Different recorded repository/subfolder identities cannot refresh one another. The development loader offers newer CLI snapshots rather than overwriting browser edits. Checking is manual; no current-source freshness is implied by an old timestamp.

Connections can contain up to 20 evidence records of at most 20,000 characters, each with a literal imported path, inclusive source line range, and excerpt. Markdown AST positions include the frontmatter offset and reference-style link definitions. CRLF is normalized for excerpt matching only; original source files are untouched. `resolveEvidence` checks the recorded range first, relocates a unique complete-line match, and flags changed, missing or ambiguous locations. Excerpt matches establish text presence, not the semantics of authored handoffs. Clean GitHub-origin snapshots can link to immutable commit lines; dirty local snapshots cannot.

Review records contain a timestamp and SHA-256 fingerprint over canonical exact source text and the normalized manifest (including citations). File order and optional default `kind` fields do not invalidate review across serialization; source or manifest edits do. Metadata-only changes do not require review when the imported text is identical. Review is a local human acknowledgment, not an authenticated team attestation or proof of runtime behavior. Broken evidence blocks acknowledgment, while uncited connections remain explicit. Bundle restore recomputes the review status instead of trusting a stored status label.

The source status bar, connection review dialog, numbered source inspector and citation editor are native React controls. Diagram edges and inspector relationship links open evidence. HTML exports include provenance, review status, citations and line anchors without scripts or automatic requests. JSON retains all source/review/evidence fields.

New modules: `src/lib/trust.ts` handles evidence resolution, diffs and review fingerprints; `src/lib/github.ts` reads commit-pinned public repositories; `SourceReview.tsx`, `GithubImport.tsx`, and `EvidencePicker.tsx` provide review/import/authoring controls. Regression tests cover Git metadata, ignored source, BOM/CRLF fidelity, moving refs, blob integrity, ambiguous citations, update cancellation, overlay preservation and review invalidation after reload, on desktop and mobile.
