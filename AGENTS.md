# Agent Instructions

## Cache Busting Requirement

After any code change, always bump cache-busting versions for all edited static assets.

- If you edit `*.js` or `*.css` files that are loaded by HTML, update the corresponding version query string(s) in HTML references (for example `style.css?v=...` or `script.js?v=...`).
- If the project uses a central version constant/file for cache busting, increment that version instead of scattered query strings.
- Ensure every edited client-delivered asset has a version change in the same update.
- Do not skip this step, even for small edits.

## Validation

- Confirm that changed asset references now include the bumped version.
- Keep version format consistent with existing project style (numeric or timestamp-based).
