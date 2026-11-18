# r3e-leaderboard-ui
Front end for r3e-leaderboard

Testing guide: see [TESTING.md](docs/TESTING.md)

## Preview locally

From the repository root, run:

```powershell
node scripts\preview-server.cjs
```

Open [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html).
Keep the terminal running while previewing; press Ctrl+C to stop the server.
Reload the page after making changes. The server uses the local cache files and
disables browser caching; some external images or services require internet access.
Other pages are available through the site's navigation or at root URLs such as
`http://127.0.0.1:8765/drivers.html`.
If the page says connection refused, restart the command. If port 8765 is already
in use, stop the existing preview server before starting another.

Disclaimer: all code is written by AI