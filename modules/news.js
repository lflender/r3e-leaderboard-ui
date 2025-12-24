// Steam News (AppID 211500) via RSS -> JSON (CORS-friendly)
(async function(){
  const container = document.getElementById('news-content');
  if (!container) return;

  // Steam community RSS for the game; converted via rss2json which sends CORS headers
  const rssUrl = 'https://steamcommunity.com/games/211500/rss';
  const endpoint = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);

  function formatDate(dateStr){
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
  }

  function stripHtml(html){
    return String(html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  }

  function extractImageUrl(html){
    const m = String(html).match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
    return m ? m[1] : '';
  }

  function isPatchNotes(item){
    const title = String(item.title || '').toLowerCase();
    const cats = Array.isArray(item.categories) ? item.categories : [];
    const catMatch = cats.some(c => String(c).toLowerCase().includes('patch'));
    return title.includes('patch notes') || catMatch;
  }

  async function renderItems(items){
    if (!items || !items.length){
      container.innerHTML = '<div class="no-results">No Steam news available.</div>';
      return;
    }
    let html = '';
    items.forEach(item => {
      const title = R3EUtils.escapeHtml(item.title || '');
      const url = item.link || item.guid || '';
      const date = formatDate(item.pubDate || new Date().toISOString());
      const excerptSrc = stripHtml(item.description || item.content || '');
      const excerpt = R3EUtils.escapeHtml(excerptSrc).slice(0, 400);
      const PATCH_THUMB = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/211500/012ec96f1060dc6dc2cfa123ad073ba41c3bd6fa/header.jpg?t=1764085909';
      const thumb = isPatchNotes(item) ? PATCH_THUMB : (item.thumbnail || extractImageUrl(item.content || item.description || ''));
      const thumbHtml = thumb ? `<a href="${R3EUtils.escapeHtml(url)}" target="_blank" rel="noopener" class="news-thumb-link"><img class="news-thumb" src="${R3EUtils.escapeHtml(thumb)}" alt="" loading="lazy"></a>` : '';
      html += `
        <article class="news-item">
          ${thumbHtml}
          <div class="news-body">
            <h2 class="news-title"><a href="${R3EUtils.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></h2>
            <div class="news-meta">${date}</div>
            <p class="news-excerpt">${excerpt}${excerptSrc.length > 400 ? '…' : ''}</p>
            <div class="news-actions"><a class="news-link" href="${R3EUtils.escapeHtml(url)}" target="_blank" rel="noopener">Read on Steam →</a></div>
          </div>
        </article>`;
    });
    container.innerHTML = html;
    // Append "More on Steam" link at the end
    container.insertAdjacentHTML('beforeend', '<div class="news-actions" style="text-align: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08);"><a class="news-link" href="https://store.steampowered.com/news/app/211500?l=en" target="_blank" rel="noopener">More on Steam →</a></div>');
  }

  async function fetchJson(url){
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    return resp.json();
  }

  try{
    const json = await fetchJson(endpoint);
    await renderItems(json?.items || []);
  }catch(e){
    console.error('Steam RSS news fetch failed', e);
    container.innerHTML = `
      <div class="error" style="margin-bottom:0.75rem;">
        <strong>Unable to load Steam news in-page.</strong>
        <div style="margin-top:0.5rem;">
          <a class="news-link" href="https://store.steampowered.com/news/app/211500" target="_blank" rel="noopener">Open Steam News →</a>
        </div>
      </div>`;
  }
})();