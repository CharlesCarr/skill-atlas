import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]

def skill(name, desc, body):
    return {'path': f'.agents/skills/{name}/SKILL.md', 'content': f'---\nname: {name}\ndescription: {desc}\nmetadata:\n  author: Skill Atlas\n  version: "1.0"\n---\n\n{body}\n'}
files = [
skill('campaign-ideation', 'Turn a campaign hypothesis into a selected, versioned strategy before research or preparation begins.', '''# Campaign ideation

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

The selected revision, evidence summary, remaining unknowns, and the next setup action.'''),
skill('campaign-setup', 'Coordinate a selected strategy, bounded research, and proposed copy into a verified campaign draft.', '''# Campaign setup

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
- Keep live recipient data and credentials outside Git.'''),
skill('campaign-research', 'Find and qualify a bounded set of candidate accounts and sourced recipients against a frozen strategy.', '''# Campaign research

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

Stop at a frozen ceiling, exhausted sources, input drift, unavailable required checks, or cancellation. Unknown deliverability remains unknown.'''),
skill('sequence-drafter', 'Prepare a complete, reviewable email sequence using selected claims, tone, and source-backed personalization.', '''# Sequence drafter

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
- Launch remains a manual operator decision.''')]
files += [{'path': '.agents/skills/campaign-ideation/references/handoff.md', 'content': '# Strategy handoff\n\nThe selected snapshot freezes the audience, offer, claims, restrictions, source revision, and research allowance.\n\n## Required fields\n\n- Canonical strategy reference and selected revision\n- Buying account unit and buyer role\n- Hard fit, soft preferences, exclusions, and unknowns\n- Allowed channels and claims\n- Cumulative research allowance\n\nSetup must verify this snapshot against the selected document before preparation.\n'}, {'path': 'AGENTS.md', 'content': '# Repository instructions\n\nThis is a fictional documentation example modeled on a prospecting workflow.\n\n- Preserve the distinction between proposals, observations, and selected decisions.\n- Keep credentials and real recipient information outside Git.\n- Research, drafting, and preparation do not authorize sending.\n'}]
manifest = {'version':1,'title':'Prospecting pipeline','description':'From a campaign hypothesis to a verified draft. Four skills, deliberate handoffs, and a human at the finish line.','steps':[
{'id':'ideation','skill':'campaign-ideation','title':'Calibrate the campaign','phase':'01 · Strategy','inputs':['Campaign hypothesis','Operator feedback'],'outputs':['Selected strategy revision','Execution snapshot']},
{'id':'setup','skill':'campaign-setup','title':'Freeze & coordinate','phase':'02 · Preparation','inputs':['Selected strategy revision'],'outputs':['Frozen criteria','Preparation checkpoint']},
{'id':'research','skill':'campaign-research','title':'Find the right accounts','phase':'03 · Evidence','inputs':['Frozen criteria','Research allowance'],'outputs':['Eligible recipients','Source evidence']},
{'id':'draft','skill':'sequence-drafter','title':'Draft the sequence','phase':'03 · Messaging','inputs':['Selected claims & tone','Source evidence'],'outputs':['Complete sequence proposal']},
{'id':'readback','skill':'campaign-setup','title':'Prepare & verify','phase':'04 · Readback','inputs':['Eligible recipients','Sequence proposal'],'outputs':['Verified draft','Unresolved exceptions']},
{'id':'review','kind':'human','title':'Review before launch','description':'The operator reviews recipients, rendered messages, sender settings, and schedule. Launch is a separate manual action.','phase':'05 · Human decision','inputs':['Verified draft'],'outputs':['Operator decision']}],
'connections':[
{'from':'ideation','to':'setup','label':'Selected revision','type':'handoff'},
{'from':'setup','to':'research','label':'Frozen criteria','type':'handoff'},
{'from':'setup','to':'draft','label':'Claims & voice','type':'handoff'},
{'from':'research','to':'readback','label':'Eligible recipients','type':'handoff'},
{'from':'draft','to':'readback','label':'Sequence proposal','type':'handoff'},
{'from':'research','to':'draft','label':'Source evidence','type':'reference'},
{'from':'readback','to':'review','label':'Verified draft','type':'handoff'}]}
# Keep the sample graph evidence tied to existing fictional instructions.
anchors = [('campaign-ideation', 'Capture the chosen rules'), ('campaign-setup', '2. Ask'), ('campaign-setup', '3. Ask'), ('campaign-research', 'Return eligible recipients'), ('sequence-drafter', 'Return the complete sequence'), ('sequence-drafter', '2. Ground personalization'), ('campaign-setup', 'Return the verified draft')]
for edge, (name, prefix) in zip(manifest['connections'], anchors):
    source = next(f for f in files if f['path'] == f'.agents/skills/{name}/SKILL.md')
    lines = source['content'].splitlines()
    line = next(i for i, text in enumerate(lines, 1) if text.startswith(prefix))
    edge['evidence'] = [{'path': source['path'], 'startLine': line, 'endLine': line, 'quote': lines[line - 1]}]
(root/'examples/prospecting').mkdir(parents=True,exist_ok=True)
for f in files:
    p=root/'examples/prospecting'/f['path']; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(f['content'])
(root/'examples/prospecting/workflow.json').write_text(json.dumps(manifest,indent=2)+'\n')
bundle={'version':1,'id':'prospecting-demo','title':manifest['title'],'description':manifest['description'],'files':files,'manifest':manifest}
# A second example proves that the product isn't tied to a single sales process.
eng=[skill('plan-change','Define the problem, acceptance criteria, and a bounded implementation plan.','# Plan the change\n\n## Define the outcome\n\nRestate the problem, affected users, and acceptance criteria.\n\n## Handoff\n\nPass the selected plan to `$implement-change`.\n\n## Boundaries\n\nDo not start work while consequential requirements are unknown.'),skill('implement-change','Implement a selected plan and verify the affected behavior.','# Implement the change\n\n## Read the plan\n\nConsume the plan from `$plan-change`.\n\n## Implement\n\nMake the smallest complete change. Run meaningful checks and document limitations.\n\n## Handoff\n\nPass the reviewable diff and test evidence to `$review-change`.'),skill('review-change','Review the implementation against its acceptance criteria and evidence.','# Review the change\n\n## Review\n\nRead the selected plan and implementation. Check behavior, regressions, and test evidence.\n\n## Return\n\nReturn actionable findings. If repairs are required, hand back to `$implement-change`.\n\n## Boundaries\n\nReview does not authorize merging or deploying.')]
engbundle={'version':1,'id':'engineering-demo','title':'Plan → build → review','description':'A small engineering loop with an explicit path for feedback.','files':eng,'manifest':{'version':1,'title':'Plan → build → review','steps':[{'id':'plan','skill':'plan-change','phase':'01 · Define'},{'id':'build','skill':'implement-change','phase':'02 · Implement'},{'id':'review','skill':'review-change','phase':'03 · Verify'}],'connections':[{'from':'plan','to':'build','label':'Selected plan','type':'handoff'},{'from':'build','to':'review','label':'Diff & evidence','type':'handoff'},{'from':'review','to':'build','label':'Actionable findings','type':'feedback'}]}}
(root/'src/data/demo.json').write_text(json.dumps([bundle,engbundle],indent=2)+'\n')
