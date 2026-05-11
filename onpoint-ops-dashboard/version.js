/* Version badge and cache refresh helper */
(function(){
  'use strict';
  const FALLBACK = { build: '2026.05.10.4', label: 'People roles actions budget pipeline worklists QA' };
  let current = {...FALLBACK};

  function addStyles(){
    if (document.getElementById('versionBadgeStyles')) return;
    const s = document.createElement('style');
    s.id = 'versionBadgeStyles';
    s.textContent = `
      .version-badge{position:fixed;right:14px;top:14px;z-index:9999;background:#111827;color:white;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 10px;font:700 11px Arial, sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.22);display:flex;gap:8px;align-items:center;max-width:calc(100vw - 24px)}
      .version-badge span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .version-badge button{border:0;background:#fff;color:#111827;border-radius:999px;padding:4px 7px;font:800 10px Arial, sans-serif;cursor:pointer}
      .version-badge .check{background:#d1e9ff;color:#1849a9}
      @media(max-width:700px){.version-badge{top:auto;bottom:74px;right:10px;font-size:10px}.version-badge .label{display:none}}
    `;
    document.head.appendChild(s);
  }

  async function loadVersion(){
    try {
      const res = await fetch('./version.json?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) current = await res.json();
    } catch(e) {}
    updateBadge();
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
    url.searchParams.set('v', (current.build || FALLBACK.build) + '-' + Date.now());
    window.location.href = url.toString();
  }

  function updateBadge(){
    const b = document.getElementById('versionBadge');
    if (!b) return;
    const build = current.build || FALLBACK.build;
    const label = current.label || FALLBACK.label;
    b.querySelector('.build').textContent = 'Build ' + build;
    b.querySelector('.label').textContent = label;
    b.title = label;
  }

  function addBadge(){
    addStyles();
    let b = document.getElementById('versionBadge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'versionBadge';
      b.className = 'version-badge';
      b.innerHTML = `<span class="build">Build ${FALLBACK.build}</span><span class="label">${FALLBACK.label}</span><button class="check" type="button">Check</button><button type="button">Refresh</button>`;
      const buttons = b.querySelectorAll('button');
      buttons[0].addEventListener('click', loadVersion);
      buttons[1].addEventListener('click', forceRefresh);
      document.body.appendChild(b);
    }
    updateBadge();
  }

  document.addEventListener('DOMContentLoaded', () => { addBadge(); loadVersion(); });
  setTimeout(() => { addBadge(); loadVersion(); }, 1000);
  setInterval(loadVersion, 60000);
})();
