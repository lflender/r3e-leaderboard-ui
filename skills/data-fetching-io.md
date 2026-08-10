# Skill: Data Fetching & I/O

- Use `R3EUtils.fetchWithTimeout(url, options, timeoutMs)` for network IO.
- For gzip JSON, use `window.CompressedJsonHelper.readGzipJson(response)` or `readGzipText(response)`.
- Implement single-flight caching for shared async loaders.
- Reset failed promises so they can retry.
- Delegate shared fetch logic to `window.dataService`.
- Use `dataService._getIndexCacheVersion()` for stable index/shard/stats/combination cache busting.
- Use `Date.now()` only for data that must never be stale.
- Validate fetch inputs, check `response.ok`, and parse untrusted JSON safely.
