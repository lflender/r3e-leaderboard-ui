(function() {
  'use strict';

  function injectHeader() {
    const el = document.getElementById('site-header');
    if (!el || !window.TemplateLoader) return;
    TemplateLoader.render('header').then(html => {
      el.innerHTML = html;
    }).catch(err => console.error('Failed to render header:', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHeader);
  } else {
    injectHeader();
  }

})();
