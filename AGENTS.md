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

## Encoding Preservation Requirement

Preserve file encoding and avoid introducing mojibake/replacement characters.

- Keep existing text files as UTF-8 (no UTF-16/Unicode PowerShell default output).
- If using shell edits, always write with explicit UTF-8 encoding.
- Do not replace valid punctuation/accented characters with `�` or broken sequences.
- After broad path/text replacements, run a quick check for encoding corruption markers (for example `�`, `â€”`, `â€™`, `Ã`) and fix them before finishing.
- If a file already contains legitimate non-ASCII characters, preserve them exactly.

## Sitemap Lastmod Requirement

After any change to a user-facing page or a page-related module, update `sitemap.xml` `lastmod` for the affected page URL(s) in the same change.

- Trigger this when editing:
	- Root page files: `index.html`, `drivers.html`, `tracks.html`, `cars.html`, `stats.html`, `faq.html`, `news.html`, `detail.html`
	- Page modules: `modules/pages/*.js`
	- Shared modules that directly affect a specific page's content/behavior
- Use the same date format already used in `sitemap.xml`: `YYYY-MM-DD`.
- If one change affects multiple pages, update `lastmod` for all relevant page entries.
- If a change impacts the whole site (global layout/navigation/shared critical behavior), update all sitemap entries.
- Do not skip this step even if the page file itself was not edited.

## Architecture And Reuse

- Never copy/paste logic between modules. Always reuse existing helpers or extract shared logic into a single reusable module.
- Keep a single source of truth for shared behavior and data derivations.
- Keep module responsibilities clearly separated (UI rendering, data access, formatting, and domain-specific transforms).
