/* Forced cache-busting version badge v16 */
(function(){
  'use strict';
  const BUILD='2026.05.10.16';
  const LABEL='Safety guard owner economics smoke tests';
  function styles(){
    if(document.getElementById('versionBadgeStylesV16'))return;
    const s=document.createElement('style');
    s.id='versionBadgeStylesV16';
    s.textContent='.version-badge{position:fixed;right:14px;top:14px;z-index:9999;background:#111827;color:white;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 10px;font:700 11px Arial,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.22);display:flex;gap:8px;align-items:center;max-width:calc(100vw - 24px)}.version-badge button{border:0;background:#fff;color:#111827;border-radius:999px;padding:4px 7px;font:800 10px Arial,sans-serif;cursor:pointer}.version-badge .label{opacity:.75}@media(max-width:700px){.version-badge{top:auto;bottom:74px;right:10px;font-size:10px}.version-badge .label{display:none}}';
    document.head.appendChild(s);
  }
  async function refresh(){
    try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}}catch(e){}
    const u=new URL(location.href);u.searchParams.set('v',BUILD+'-'+Date.now());location.href=u.toString();
  }
  function badge(){
    styles();
    const old=document.getElementById('versionBadge');if(old)old.remove();
    const b=document.createElement('div');b.id='versionBadge';b.className='version-badge';b.innerHTML='<span>Build '+BUILD+'</span><span class="label">'+LABEL+'</span><button>Refresh</button>';
    b.querySelector('button').onclick=refresh;
    document.body.appendChild(b);
  }
  document.addEventListener('DOMContentLoaded',badge);
  setTimeout(badge,1000);
})();
