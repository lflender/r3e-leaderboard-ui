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

  function htmlToTextWithBreaks(html){
    let s = String(html || '');
    // Convert common block/line-break tags to newlines
    s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
    s = s.replace(/<\s*\/p\s*>/gi, '\n');
    s = s.replace(/<\s*p\b[^>]*>/gi, '');
    s = s.replace(/<\s*li\b[^>]*>/gi, '\u2022 '); // bullet "• "
    s = s.replace(/<\s*\/li\s*>/gi, '\n');
    s = s.replace(/<\s*h[1-6]\b[^>]*>/gi, '');
    s = s.replace(/<\s*\/h[1-6]\s*>/gi, '\n');
    s = s.replace(/<\s*div\b[^>]*>/gi, '');
    s = s.replace(/<\s*\/div\s*>/gi, '\n');
    s = s.replace(/<\s*\/?(ul|ol|table|tr|thead|tbody)\b[^>]*>/gi, '\n');
    // Strip remaining tags
    s = s.replace(/<[^>]+>/g, '');
    // Normalize whitespace but keep newlines
    s = s
      .replace(/\u00A0/g, ' ') // nbsp
      .replace(/\r/g, '')
      .replace(/[\t ]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    return s;
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
      const raw = item.description || item.content || '';
      const textWithBreaks = htmlToTextWithBreaks(raw);
      const MAX_LINES = 6;
      const lines = textWithBreaks.split('\n');
      const isTruncated = lines.length > MAX_LINES;
      const preview = lines.slice(0, MAX_LINES).join('\n').trim();
      const excerpt = R3EUtils.escapeHtml(preview);
      const PATCH_THUMB = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/211500/012ec96f1060dc6dc2cfa123ad073ba41c3bd6fa/header.jpg?t=1764085909';
      const thumb = isPatchNotes(item) ? PATCH_THUMB : (item.thumbnail || extractImageUrl(item.content || item.description || ''));
      const thumbHtml = thumb ? `<a href="${R3EUtils.escapeHtml(url)}" target="_blank" rel="noopener" class="news-thumb-link"><img class="news-thumb" src="${R3EUtils.escapeHtml(thumb)}" alt="" loading="lazy"></a>` : '';
      html += `
        <article class="news-item">
          ${thumbHtml}
          <div class="news-body">
            <h2 class="news-title"><a href="${R3EUtils.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></h2>
            <div class="news-meta">${date}</div>
            <div class="news-excerpt">${excerpt}${isTruncated ? '…' : ''}</div>
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