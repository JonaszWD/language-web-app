---
description: Structured implementation planning — searches codebase for patterns, writes a plan artifact, and hard-stops before writing any code until you confirm.
argument-hint: "<feature description or path to .prd.md file>"
---

You are in PLANNING MODE. You will NOT write any code until the user explicitly confirms the plan.

## Step 1 — Restate Requirements

Restate the request in your own words. If given a `.prd.md` file, read it in full and summarise:
- Problem being solved
- Users affected
- Acceptance criteria
- Explicit out-of-scope items

If anything is ambiguous, ask one specific clarifying question before continuing.

## Step 2 — Research the Codebase

Search for existing patterns to mirror, not reinvent. Look for:
- Naming conventions (modules, functions, variables)
- Error handling patterns
- Logging approach
- Data access / ORM patterns
- Test structure and fixtures
- Any existing similar features

Write what you found. If the codebase is empty, state that explicitly.

## Step 3 — Identify Risks and Blockers

List:
- Technical risks (external dependencies, migrations, breaking changes)
- Security considerations (auth, input validation, data exposure)
- Open questions that could block execution

## Step 4 — Write the Plan

Produce a numbered implementation plan with:
- Phase labels (e.g. Phase 1: Data layer, Phase 2: API, Phase 3: Tests)
- Each file that will be created or modified
- Estimated complexity: Quick Fix / Standard / PRD+Sprint
- Validation steps (how to verify each phase is correct)

If a `.prd.md` was provided, write the full plan as a file artifact:

```
.claude/plans/<feature-name>.plan.md
```

Include in the artifact:
- Complexity assessment
- Ordered task list with [ ] checkboxes
- Files to create / modify
- Validation steps per phase
- Risk notes

## Step 5 — Hard Stop

**DO NOT write any code, create any files (other than the plan artifact), or run any commands.**

End with:

> Plan complete. Please review and reply **"confirmed"** (or describe changes) to proceed with implementation.
