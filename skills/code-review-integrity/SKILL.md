---
name: code-review-integrity
description: Review Campus Gridiron Dynasty code changes for correctness, regression risk, data integrity, test coverage, screenshots, and release hygiene. Use before commits, version bumps, changelog updates, refactors, smoke-test passes, or when acting as a code-review sub-agent for this repo.
---

# Code Review Integrity

## Review Workflow

1. Inspect the diff first with `git status --short`, `git diff --stat`, and targeted `git diff` reads.
2. Identify behavior changes, data-shape changes, persistence implications, and generated artifact churn.
3. Check tests against risk: unit tests for simulation logic, smoke tests for UI flows, screenshots for visible changes, and WebKit/mobile coverage when layout changes.
4. Verify version hygiene when the package version changes: `package.json`, `package-lock.json`, visible app version, smoke expectations, and `CHANGELOG.md` must agree.
5. Report findings first, ordered by severity, with concrete file references and exact validation commands.

## Integrity Checks

- Preserve fictional-only content: no real schools, real players, real coaches, real awards, or licensed marks.
- Protect dynasty invariants: 70 teams, 85-player generated rosters, 20-year length, local-only storage, initial player cap 93, recruit elite entry cap 83.
- Treat saved data changes as compatibility risks. Prefer fallbacks for old local saves when adding required fields.
- Confirm screenshots are regenerated when UI changes affect roster, recruiting, awards, playoffs, program, or mobile dashboard views.
- Keep code review separate from implementation unless explicitly assigned to patch the issue.

## Required Validation

Use the smallest validation set that covers the change, but do not skip:

```bash
npm run build
npm run test
```

Run `npm run smoke` for UI, storage, screenshot, WebKit, mobile, playoff, recruiting, or multi-season changes.

## Output Format

```text
Findings
- [P1] File:line - issue, impact, and suggested fix.
- [P2] File:line - issue, impact, and suggested fix.

Validation
- Command: result.
- Screenshots reviewed or regenerated.

Release Hygiene
- Version/changelog status.
- Any remaining risk.
```
