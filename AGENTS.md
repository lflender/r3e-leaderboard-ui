# Agent Instructions

## Code Quality

- Follow Clean Code principles: meaningful names, small focused functions, no duplication, clear intent over comments.
- Apply SOLID principles where applicable (single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion).
- Maintain a single source of truth for all data, configuration, and shared logic. Never duplicate state or derive the same value in multiple places.

## Design Tokens (CSS)

All visual values (colors, spacing, radii, font sizes, font weights, z-index, shadows) are centralized in `styles/tokens.css`. When writing or editing CSS:

- **Always use design tokens** — never hardcode colors, spacing, font sizes, font weights, border-radii, z-index, or shadows. Reference existing `var(--token-name)` values from `styles/tokens.css`.
- **Token naming conventions**: `--color-*` (colors), `--space-*` (spacing), `--font-size-*` (type scale), `--font-weight-*` (weights), `--radius-*` (border-radius), `--z-*` (z-index), `--shadow-*` (box-shadow), `--line-height-*` (line heights).
- **No legacy aliases** — do not use old variable names like `--primary-color`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--hover-bg`, `--accent`, `--shadow`. Always use the canonical `--color-*` / `--space-*` / etc. form.
- **Before adding a new token**, check if an existing one already covers the value. Avoid near-duplicates. If a new semantic meaning is genuinely needed, add it to `styles/tokens.css` with a clear category comment.
- **Content-specific pixel values** (e.g. image widths, fixed icon sizes) do not need tokens — only design-system values should be tokenized.

## Test Coverage

- Always add test coverage for new code. Every new function, module, or behavior change must include corresponding tests.
- After any code change, run the full test suite in a visible terminal (`npx vitest run`) so the user can observe test progression. Do not run tests silently or suppress output.
- Never leave failing tests — including pre-existing failures. If you encounter a failing test, investigate and fix it before wrapping up.

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

### Known Unicode Symbols - DO NOT CORRUPT

These literal Unicode characters appear in CSS files and must never be replaced with mojibake sequences:

- U+21C5 (updown arrows) used in: `tables.css` `.results-table th.sortable::after { content: ' [U+21C5]'; }`
- U+25BC (black down-pointing triangle) used in: `tables.css` `.results-table th.sortable.sort-active::after { content: ' [U+25BC]'; }`
- U+2192 (rightwards arrow) used in: `seo.css` `.seo-content ul li::before { content: "[U+2192]"; }` (stored as CSS escape \2192)
- U+25BE (black down-pointing small triangle) used in: `detail.css` `.faq-item summary::after { content: '[U+25BE]'; }`

**CRITICAL**: When editing `tables.css` (or any CSS with `content:` values), always use the `replace_string_in_file` tool directly - never pipe through PowerShell string replacement or any shell command that may re-encode the file. Shell commands default to UTF-16 or corrupt multi-byte sequences. After any edit to this file, visually verify the U+21C5 and U+25BC characters are intact in the diff.
## Sitemap Lastmod Requirement

After any change to a user-facing page or a page-related module, update `sitemap.xml` `lastmod` for the affected page URL(s) in the same change.

- Trigger this when editing:
	- Root page files: `index.html`, `drivers.html`, `leaderboards.html`, `cars.html`, `records.html`, `faq.html`, `detail.html`
	- Page modules: `modules/pages/*.js`
	- Shared modules that directly affect a specific page's content/behavior
- Use the same date format already used in `sitemap.xml`: `YYYY-MM-DD`.
- If one change affects multiple pages, update `lastmod` for all relevant page entries.
- If a change impacts the whole site (global layout/navigation/shared critical behavior), update all sitemap entries.
- Do not skip this step even if the page file itself was not edited.
- Do not add the detail.html page to the sitemap

## Architecture And Reuse

- Never copy/paste logic between modules. Always reuse existing helpers or extract shared logic into a single reusable module.
- Keep a single source of truth for shared behavior, data derivations, and configuration (see also Code Quality above).
- Keep module responsibilities clearly separated (UI rendering, data access, formatting, and domain-specific transforms).
- Never use inline `style` attributes in HTML or JS-generated markup when the styles can be expressed as a CSS class. Define classes in the appropriate stylesheet under `styles/` instead.
- Load secondary/optional data (e.g. inactive MP rankings) asynchronously with concurrent-free (single-flight) promises and display it lazily when ready. Never block the main render path for non-critical data.
- Use the single-flight (concurrent-free) promise pattern for any shared async data fetch: store the in-flight promise and return it on subsequent calls so only one network request is made, regardless of how many callers trigger it concurrently.

## Testing

- Always add test coverage for new code (see also Test Coverage above).
- After any code change, run the full test suite in a visible terminal (`npx vitest run`) so the user can see test progression. Ensure all tests pass before considering the task complete.
- Never leave failing tests — including pre-existing ones. If a change breaks existing tests or you discover pre-existing failures, fix them in the same change.
- When adding new globals or dependencies used by production code, add matching mocks in all affected test files.
- Do not dismiss test failures as "pre-existing" or "unrelated" without investigating and fixing them.

## Responsive Table Fixes

When fixing a table overflow or layout issue for any screen size, always apply the fix at the widest breakpoint where the problem can first occur and let it cascade down. Never fix only the mobile breakpoint if the same issue exists on tablet.

The project breakpoints are:
- `max-width: 1300px` - large screens
- `max-width: 1000px` - tablets (iPad landscape and smaller)
- `max-width: 768px` - small tablets / large phones
- `max-width: 480px` - phones

At `768px`, `.results-table` gets `min-width: 600px` which causes narrow tables (e.g. stats tables with only 3 columns) to overflow. Always override `min-width` on specific table containers at the appropriate breakpoint rather than only at `768px`.
