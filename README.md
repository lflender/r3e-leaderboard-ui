# r3e-leaderboard-ui
Front end for r3e-leaderboard

SEO & Indexing
----------------

This project includes basic SEO and indexing helpers to make the site discoverable:

- `robots.txt` (root) — allows all crawlers.

Before deploying, replace `https://example.com` with your real site URL in the HTML meta tags.

Notes & next steps
------------------

- Add a real `og-image.png` at the site root (recommended size 1200x630).
- Consider server-side rendering (SSR) or prerender steps for dynamic leaderboard pages so crawlers see content.
- Add canonical headers from server responses if serving pages under multiple URLs.
