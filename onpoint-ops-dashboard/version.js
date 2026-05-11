/* Version badge and cache refresh helper */
(function(){
  'use strict';
  const BUILD = '2026.05.10.3';
  const LABEL = 'UX overlay + version badge';

  function addStyles(){
    if (document.getElementById('versionBadgeStyles')) return;
    const s = document.createElement('style');
    s.id = 'versionBadgeStyles';
    s.textContent = `
      .version-badge{position:fixed;right:14px;top:14px;z-index:9999;background:#111827;color:white;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 10px;font:700 11px Arial, sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.22);display:flex;gap:8px;align-items:center}
      .version-badge button{border:0;background:#fff;color:#111827;border-radius:999px;padding:4px 7px;font:800 10px Arial, sans-serif;cursor:pointer}
      @media(max-width:700px){.version-badge{top:auto;bottom:74px;right:10px;font-size:10px}}
    `;
    document.head.appendChild(s);
  }

  async function forceRefresh(){
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch(e) {}
    const url = new URL(window.location.href);
    url.searchParams.set('v', BUILD + '-' + Date.now());
    window.location.href = url.toString();
  }

  function addBadge(){
    if (document.getElementById('versionBadge')) return;
    addStyles();
    const b = document.createElement('div');
    b.id = 'versionBadge';
    b.className = 'version-badge';
    b.innerHTML = `<span>Build ${BUILD}</span><button type="button">Refresh</button>`;
    b.title = LABEL;
    b.querySelector('button').addEventListener('click', forceRefresh);
    document.body.appendChild(b);
  }

  document.addEventListener('DOMContentLoaded', addBadge);
  setTimeout(addBadge, 1000);
})();
