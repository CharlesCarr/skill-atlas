---
name: campaign-setup
description: Coordinate a selected strategy, bounded research, and proposed copy into a verified campaign draft.
metadata:
  author: Skill Atlas
  version: "1.0"
---

# Campaign setup

This skill owns the preparation checkpoint and brings the two downstream workstreams back together.

## Freeze the input

Read the exact strategy revision selected during `$campaign-ideation`. Record the audience, claims, messaging basis, destination, and authorized bounds. If the document changed, resolve the difference before proceeding.

## Coordinate preparation

1. Check for an existing draft and operation receipt before creating anything.
2. Ask `$campaign-research` for eligible, source-backed recipients under the frozen criteria.
3. Ask `$sequence-drafter` for a complete sequence grounded in the selected claims and tone.
4. Combine the recipient and sequence proposals through the reviewed preparation capability.
5. Read the destination back and compare it to the frozen intent.

## Readback contract

```json
{
  "state": "draft",
  "input_revision": "selected-revision",
  "confirmed": true,
  "sending_enabled": false
}
```

A successful write response is not proof that the whole draft is prepared. Confirm each step and recipient; retain partial or uncertain results for recovery.

## Final operator review

Return the verified draft, selected revision, observation time, and unresolved exceptions. The operator reviews recipients, rendered messages, sender settings, and schedule before any launch.

## Boundaries

- Do not send, launch, schedule, or spend by inference.
- Reconcile uncertain outcomes before retrying.
- Keep live recipient data and credentials outside Git.
