# JollySpaceCow.github.io — Agent Rules

## Service Worker Cache Versioning

The service worker ([`sw.js`](../sw.js)) uses a **date-only cache key** to bust the cache whenever site files change.

### Format

```
jsc-YYYY-MM-DD
```

### Rules

- **No version suffixes** — never append `-v1`, `-v2`, etc. The format is date only.
- **One entry only** — only the `CACHE_NAME` constant at the top of `sw.js` needs changing.
- **Use the current date** — always use today's date in `YYYY-MM-DD` format (AEST/ACST, UTC+9:30 / UTC+10:30).

### How to Update

Whenever you modify any file that is cached by the service worker (HTML, CSS, JS, or assets listed in `PRECACHE_URLS`), update the `CACHE_NAME` in `sw.js`:

```js
// Before
const CACHE_NAME = 'jsc-2026-07-03';

// After (today is 4 July 2026)
const CACHE_NAME = 'jsc-2026-07-04';
```

Do **not** change anything else in `sw.js` for a routine cache bump.

### Files Watched by the Service Worker

The following files are in `PRECACHE_URLS` — bumping the cache name will force browsers to re-fetch all of them:

**Pages**
- `index.html`, `videos.html`, `gallery.html`, `games.html`, `about.html`, `offline.html`

**Styles** (`assets/css/`)
- `style.css`, `components.css`, `hero.css`, `videos.css`, `games.css`, `gallery.css`

**Scripts** (`assets/js/`)
- `app.js`, `cursor.js`, `physics.js`, `npc.js`, `title-engine.js`, `space.js`, `videos.js`, `games.js`, `gallery.js`, `offline.js`, `troll.js`

**Public assets** (`public/`)
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`
