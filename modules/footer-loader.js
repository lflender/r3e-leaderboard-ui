(function() {
  'use strict';

  function injectFooter() {
    const el = document.getElementById('site-footer');
    if (!el || !window.TemplateLoader) return;
    TemplateLoader.render('footer').then(html => {
      el.innerHTML = html;
    }).catch(err => console.error('Failed to render footer:', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooter);
  } else {
    injectFooter();
  }

})();
