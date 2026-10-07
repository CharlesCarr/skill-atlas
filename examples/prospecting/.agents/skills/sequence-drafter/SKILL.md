---
name: sequence-drafter
description: Prepare a complete, reviewable email sequence using selected claims, tone, and source-backed personalization.
metadata:
  author: Skill Atlas
  version: "1.0"
---

# Sequence drafter

Turn a selected messaging basis into a complete sequence proposal. This skill creates copy; setup owns preparation and readback.

## Read the selected input

Read the frozen strategy from `$campaign-setup`. Use only the selected offer, audience, allowed claims, voice, and desired response. Missing evidence stays missing.

## Write the sequence

1. Give each message one useful point and a proportionate ask.
2. Ground personalization in observed account facts from `$campaign-research`.
3. Include every subject, body, variant, delay, enabled state, and exact-case variable.
4. Specify fallback behavior for missing personalization.
5. Preview rendered messages and check every factual claim.

## Apply feedback

Revise only the passages the operator identifies. Preserve selected wording elsewhere. A material claim or strategy change needs a newly selected input.

## Handoff

Return the complete sequence proposal, selected input revision, factual basis, and uncertainties to `$campaign-setup`.

## Boundaries

- Label proposed copy as a suggestion.
- A draft or export is not evidence of sending.
- Never invent familiarity, urgency, metrics, or customer proof.
- Launch remains a manual operator decision.
