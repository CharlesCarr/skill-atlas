---
name: campaign-ideation
description: Turn a campaign hypothesis into a selected, versioned strategy before research or preparation begins.
metadata:
  author: Skill Atlas
  version: "1.0"
---

# Campaign ideation

A good campaign starts with a clear hypothesis. This skill makes the audience, offer, and assumptions explicit before any downstream work begins.

## When to use

Use for a new campaign idea or a material targeting change. Run before `$campaign-setup`.

## Calibrate the idea

1. Restate the objective, offer, buying account, geography, buyer role, and desired response. Mark unknowns.
2. Gather a small sample of likely fits, likely non-fits, and uncertain examples from current first-party sources.
3. Separate required facts, soft preferences, exclusions, and discovery questions. A preference is not an exclusion.
4. Give the operator copyable search queries and explain what each tests.
5. Incorporate feedback. Select a strategy revision before handing off.

## Save the selected strategy

Capture the chosen rules and source evidence in a versioned document. Pass only the concise execution fields to `$campaign-setup`.

| Input | Output |
| --- | --- |
| Campaign hypothesis | Calibrated audience |
| Evidence and operator feedback | Selected strategy revision |
| Offer and desired response | Frozen execution snapshot |

See [the handoff contract](references/handoff.md). Repository-wide instructions live in [AGENTS.md](../../../AGENTS.md).

## Boundaries

- Keep proposals separate from selected decisions.
- Never invent evidence, buyer identities, or permission to launch.
- A strategy document alone does not authorize outreach.

## Return

The selected revision, evidence summary, remaining unknowns, and the next setup action.
