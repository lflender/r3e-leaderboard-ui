# Skills

This repository uses separate skill files to keep the agent context smaller and more modular.

## Reference Skills

- `skills/code-quality.md`
- `skills/design-tokens.md`
- `skills/test-coverage.md`
- `skills/cache-busting.md`
- `skills/validation.md`
- `skills/encoding-preservation.md`
- `skills/unicode-safety.md`
- `skills/sitemap-lastmod.md`
- `skills/architecture-reuse.md`
- `skills/data-fetching-io.md`
- `skills/responsive-table-fixes.md`

## Required pre-edit checklist

Before making any code or client asset change, read the relevant skill(s) in this folder and confirm the following:

- I reviewed the applicable skill instructions for the file I am editing.
- I checked whether the change touches a static asset or HTML reference that needs cache-busting.
- I bumped version query strings for any changed `*.css`, `*.js`, or other browser-delivered asset references.
- I kept related client assets versioned together when they are loaded as a bundle.
- I verified the changed behavior with the smallest relevant test or functional check.

This repository should treat these checks as mandatory for all edits that affect user-facing pages or browser-delivered assets.
