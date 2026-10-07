# Skill Atlas

A standalone, client-side React app for documenting agent skills and the workflows that connect them. It does not run skills, execute imported scripts, or send imported documents to a server.

## Source contract

- Preserve original source text exactly. Derive display metadata in a separate view.
- A Markdown skill mention or link is a reference, not evidence of execution order.
- The version 1 manifest defines actual steps and handoffs. Repeated skills and human steps are supported.
- Record commit-pinned source honestly; folder imports are unversioned and dirty local sources must never link to unchanged GitHub lines.
- Excerpt matching proves text presence only. Preserve the distinction between matched evidence, human review, and observed execution.
- Stage updates and preserve the current overlay unless the user chooses the incoming definition.
- Resolve paths literally. Report unresolved or invalid references rather than guessing.
- Do not render raw imported HTML or fetch referenced images automatically.
- `local/` contains private CLI imports. Keep it Git-ignored and inaccessible to production builds.
- Examples, screenshots, tests, and commits must contain fictional content only.

## Development

Node 22+, npm, strict TypeScript. Use `npm ci`, `npm run dev`, `npm run check`, and `npm run test:e2e`. Run `npm run verify:public` after building. Material changes to imports, parsing, exports, or persistence need meaningful regression checks. Interface changes need desktop and mobile browser verification.

Keep the UI accessible with native controls, visible focus, readable source text, and reduced-motion support. Documentation belongs in README.md and docs/ARCHITECTURE.md.
