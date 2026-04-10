# PostHog Reverse-Proxy Setup (Ad-Blocker Bypass)

Ad-blockers work by blocking requests to known analytics domains.
Two things need to be first-party to bypass them:

1. **The SDK script** — already handled: `lib/ph-lib.js` is served from your domain.
2. **The ingestion endpoint** — needs a reverse-proxy so requests to `/t/*` on your domain forward to PostHog.

> **Why `/t` and not `/ingest`?** Filter lists like EasyPrivacy specifically block `/ingest/` because it's PostHog's well-known proxy path. Using a short, generic path avoids detection.

Pick the section below that matches your hosting.

---

## Option A — Nginx (VPS / dedicated server)

Add this inside your `server { }` block:

```nginx
# PostHog reverse-proxy  (/t → PostHog EU cloud)
location /t/static/ {
    proxy_pass https://eu-assets.i.posthog.com/static/;
}

location /t/ {
    proxy_pass https://eu.i.posthog.com/;
    proxy_set_header Host eu.i.posthog.com;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then reload nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Option B — Apache

```apache
# PostHog reverse-proxy
SSLProxyEngine On

ProxyPass /t/static/ https://eu-assets.i.posthog.com/static/
ProxyPassReverse /t/static/ https://eu-assets.i.posthog.com/static/

ProxyPass /t/ https://eu.i.posthog.com/
ProxyPassReverse /t/ https://eu.i.posthog.com/
ProxyPreserveHost Off
RequestHeader set Host "eu.i.posthog.com"
```

Enable required modules:
```bash
sudo a2enmod proxy proxy_http ssl headers
sudo systemctl restart apache2
```

---

## Option C — Cloudflare Workers

Create a Worker with this script:

```js
const POSTHOG_HOST = "eu.i.posthog.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Only proxy /t paths
    if (!url.pathname.startsWith("/t")) {
      return new Response("Not found", { status: 404 });
    }
    // Strip /t prefix
    const newPath = url.pathname.replace(/^\/t/, "");
    const target = `https://${POSTHOG_HOST}${newPath}${url.search}`;
    const newRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    newRequest.headers.set("Host", POSTHOG_HOST);
    return fetch(newRequest);
  },
};
```

Then add a Route in Cloudflare: `r3e-leaderboards.info/t/*` → your Worker.

---

## Option D — Netlify (`_redirects` file)

Add to your `_redirects` file (create it in the project root if missing):

```
/t/static/*  https://eu-assets.i.posthog.com/static/:splat  200
/t/*         https://eu.i.posthog.com/:splat                200
```

---

## Option E — Vercel (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/t/static/:path*", "destination": "https://eu-assets.i.posthog.com/static/:path*" },
    { "source": "/t/:path*", "destination": "https://eu.i.posthog.com/:path*" }
  ]
}
```

---

## After setting up the proxy

1. In `modules/analytics.js`, make sure  `PH_API_HOST` is set to `'/t'`  (this is the default).
2. Download the PostHog SDK to serve it locally:
   ```bash
  curl -o lib/ph-lib.js "https://eu-assets.i.posthog.com/static/array.js"
   ```
3. Deploy and verify:
   - Open your site in a browser with an ad-blocker enabled.
   - Open DevTools → Network tab.
   - You should see requests to `/t/e/?...` going to **your domain** (not posthog.com).
   - Check your PostHog dashboard — events should appear within a few minutes.

---

## Quick checklist

- [ ] Created PostHog account and copied project API key
- [ ] Pasted API key into `modules/analytics.js` (`PH_TOKEN`)
- [ ] Downloaded SDK: `curl -o lib/ph-lib.js "https://us-assets.i.posthog.com/static/array.js"`
- [ ] Set up reverse-proxy (Option A/B/C/D/E above)
- [ ] Set `PH_API_HOST = '/t'` in `modules/analytics.js`
- [ ] Deployed and verified events arrive in PostHog dashboard
- [ ] Verified events arrive even with ad-blocker enabled
