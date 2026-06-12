---
description: Create a lean Product Requirements Document — captures what must be true for success and why, without implementation details.
argument-hint: "<feature name or problem description>"
---

You are writing a PRD. Your job is to capture *what* must be true and *why* — not *how* to build it. Implementation belongs in `/plan`.

## Phase 1 — FRAME

Ask (or infer from context):
- What problem does this solve?
- Who experiences it? (user persona / role)
- What is the pain today without this feature?
- Why now — what is the urgency or forcing function?

## Phase 2 — GROUND

Gather concrete evidence. Do not invent requirements. For any item you cannot confirm, write:
`TBD — needs validation via {method}`

Evidence types:
- User quotes or reported friction
- Observed behaviour (logs, metrics, support tickets)
- Competitive reference (if relevant)

## Phase 3 — DECIDE

Establish:
- **Hypothesis**: "If we build X, then Y users will be able to Z, measurable by W"
- **MVP scope**: minimum slice that validates the hypothesis
- **Out of scope**: explicit exclusions for this iteration
- **Open questions**: unresolved decisions that block or affect scope

## Phase 4 — GENERATE

Write the PRD to `.claude/prds/<feature-name>.prd.md` with this structure:

```markdown
# PRD: <Feature Name>
**Status:** Draft  
**Date:** <today>  
**Author:** <user>

## Problem Statement
<1-2 sentences>

## Users
<Who is affected and how>

## Hypothesis
If we build <X>, then <Y users> will be able to <Z>, measurable by <W>.

## MVP Scope
- [ ] <item>
- [ ] <item>

## Out of Scope
- <item>

## Success Metrics
- <metric>

## Risks & Unknowns
- <risk / TBD item>
```

After writing the file, output:

> PRD written to `.claude/prds/<name>.prd.md`. Run `/plan .claude/prds/<name>.prd.md` to generate the implementation plan.
