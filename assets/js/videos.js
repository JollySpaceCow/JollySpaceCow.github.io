/* ── VIDEOS PAGE LOGIC ── */

(function() {
  const CHANNEL_ID = 'UCpBcikf2fOhwMhp3Czj2CwA';
  const CACHE_KEY  = 'jsc_videos_cache';
  const CACHE_TTL  = 6 * 60 * 60 * 1000; // 6 hours

  const FALLBACK_ITEMS = [
    { title: "I Built the Stargate KAWOOSH in Blender!",         link: "https://www.youtube.com/watch?v=kN0PlQtC3aY", pubDate: new Date(Date.now() -  30 * 86400000).toISOString() },
    { title: "I Finally Solved My Animation Problem",            link: "https://www.youtube.com/watch?v=01x70FeGbEc", pubDate: new Date(Date.now() - 150 * 86400000).toISOString() },
    { title: "This AI Accidentally Fixed My Terrible 3D Character", link: "https://www.youtube.com/watch?v=FQ-VMnV_3dg", pubDate: new Date(Date.now() - 210 * 86400000).toISOString() },
    { title: "My Own Board Game",                                link: "https://www.youtube.com/watch?v=_AAxjL6hE3Y", pubDate: new Date(Date.now() - 240 * 86400000).toISOString() },
    { title: "How I Became an Expert at Blender",               link: "https://www.youtube.com/watch?v=jNl2kTclrio", pubDate: new Date(Date.now() - 365 * 86400000).toISOString() },
  ];

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 3600)    return Math.floor(diff / 60)      + 'm ago';
    if (diff < 86400)   return Math.floor(diff / 3600)    + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400)   + 'd ago';
    if (diff < 31536000)return Math.floor(diff / 2592000) + 'mo ago';
    return Math.floor(diff / 31536000) + 'y ago';
  }

  function getVideoId(link) {
    try { return new URL(link).searchParams.get('v'); } catch { return null; }
  }

  function renderCards(items) {
    return items.slice(0, 6).map(item => {
      const vid      = getVideoId(item.link);
      const thumbSrc = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : '';
      return `
      <a href="${item.link}" class="video-card" target="_blank" rel="noopener">
        <div class="thumb">
          ${thumbSrc
            ? `<img src="${thumbSrc}" alt="${item.title}" loading="lazy">`
            : `<div class="thumb-placeholder">🎬</div>`}
          <div class="play-icon"><span>▶</span></div>
        </div>
        <div class="video-info">
          <h3>${item.title}</h3>
          <span class="video-meta">${timeAgo(item.pubDate)}</span>
        </div>
      </a>`;
    }).join('');
  }

  function parseRSS(xmlText) {
    const xml     = new DOMParser().parseFromString(xmlText, 'text/xml');
    const entries = [...xml.querySelectorAll('entry')];
    return entries
      .map(entry => ({
        title:   entry.querySelector('title')?.textContent        || '',
        link:    entry.querySelector('link')?.getAttribute('href') || '',
        pubDate: entry.querySelector('published')?.textContent    || '',
      }))
      .filter(item => !item.link.includes('/shorts/'));
  }

  async function loadVideos() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;

    // Serve from cache if still fresh
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, items } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          grid.innerHTML = renderCards(items);
          return;
        }
      }
    } catch { /* corrupt cache — fall through to fetch */ }

    // Fetch YouTube RSS directly via CORS proxy
    try {
      const rssUrl   = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(rssUrl)}`;
      const res      = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const items = parseRSS(await res.text());
      if (!items.length) throw new Error('Empty feed');

      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
      grid.innerHTML = renderCards(items);
    } catch {
      grid.innerHTML = renderCards(FALLBACK_ITEMS);
    }
  }

  document.addEventListener('DOMContentLoaded', loadVideos);
})();
