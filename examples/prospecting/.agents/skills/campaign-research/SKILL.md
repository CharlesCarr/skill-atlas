---
name: campaign-research
description: Find and qualify a bounded set of candidate accounts and sourced recipients against a frozen strategy.
metadata:
  author: Skill Atlas
  version: "1.0"
---

# Campaign research

Research a similar-account audience using the selected strategy and calibration examples. Keep evidence and uncertainty visible.

## Frozen allowance

Accept the selected strategy from `$campaign-setup`. Freeze candidate, query, page, time, and spend limits before discovery. Resumed work keeps the same cumulative bounds.

## Find, verify, qualify

1. Prefer current first-party pages and record the source and actual check time.
2. Test identity and buying-unit fit against the selected rules.
3. Classify each candidate as **fit**, **not fit**, or **uncertain**.
4. For fits, find a named buyer or permitted published role inbox. Never guess an email pattern.
5. Check duplicates, restrictions, and destination identity near the handoff.

> A fit account without a sourced usable recipient is a research result, not an eligible lead.

## Evidence packet

| Field | Meaning |
| --- | --- |
| Source URL | Where the fact was observed |
| Checked at | When it was actually checked |
| Fit decision | Judgment under the selected rubric |
| Unresolved facts | What still needs review |

## Handoff

Return eligible recipients and sourced personalization to `$campaign-setup`. Preserve omitted discoveries and exceptions. If the request is research-only, return a reviewable result without enrollment.

## Stop conditions

Stop at a frozen ceiling, exhausted sources, input drift, unavailable required checks, or cancellation. Unknown deliverability remains unknown.
