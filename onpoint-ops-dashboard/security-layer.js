/* Security and operating discipline layer: auto-lock, backup reminders, local data warning. */
(function(){
  'use strict';
  const META_KEY='opdash.security.v1';
  const AUTH='opdash.auth.v1';
  const FIFTEEN_MIN=15*60*1000;
  let idleTimer=null;

  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY))||{}}catch(e){return{}}}
  function saveMeta(m){localStorage.setItem(META_KEY,JSON.stringify(m))}
  function toast(msg){try{window.toast?window.toast(msg):console.log(msg)}catch(e){}}

  function lockNow(){
    try{sessionStorage.removeItem(AUTH)}catch(e){}
    location.reload();
  }

  function resetIdle(){
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{
      const m=meta();
      if(m.disableAutoLock) return;
      lockNow();
    }, FIFTEEN_MIN);
  }

  function installIdleWatch(){
    ['click','keydown','touchstart','mousemove','scroll'].forEach(ev=>window.addEventListener(ev,resetIdle,{passive:true}));
    resetIdle();
  }

  function addBackupReminder(){
    const m=meta();
    const last=m.lastBackup||'';
    const today=new Date().toISOString().slice(0,10);
    const days=last?Math.floor((new Date(today)-new Date(last))/86400000):999;
    if(days<7) return;
    setTimeout(()=>{
      const el=document.createElement('div');
      el.className='action-item amber';
      el.style.cssText='position:fixed;left:14px;bottom:14px;z-index:9998;max-width:360px;box-shadow:0 16px 40px rgba(0,0,0,.22)';
      el.innerHTML='<div class="action-title">Backup reminder</div><div class="action-copy">You have not marked a backup in the last 7 days. Export a backup after important updates.</div><div style="margin-top:8px"><button class="btn primary" id="markBackupBtn">Mark Backup Done</button> <button class="btn" id="dismissBackupBtn">Dismiss</button></div>';
      document.body.appendChild(el);
      document.getElementById('markBackupBtn').onclick=()=>{const x=meta();x.lastBackup=today;saveMeta(x);el.remove();toast('Backup reminder reset')};
      document.getElementById('dismissBackupBtn').onclick=()=>el.remove();
    },2500);
  }

  function addSecurityPanel(){
    const settings=document.getElementById('view-settings');
    if(!settings||document.getElementById('securityPanel'))return;
    const m=meta();
    const div=document.createElement('div');
    div.id='securityPanel';
    div.className='card';
    div.style.marginTop='16px';
    div.innerHTML=`
      <h2 style="margin-top:0">Security & Data Discipline</h2>
      <p class="muted"><b>Rule:</b> de-identified operating data only. No patient names, DOBs, phone numbers, addresses, or identifiable prescription records.</p>
      <p class="muted"><b>Auto-lock:</b> enabled after 15 minutes of inactivity.</p>
      <label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:13px"><input id="disableAutoLock" type="checkbox" ${m.disableAutoLock?'checked':''} style="width:auto"> Disable auto-lock on this browser</label>
      <button class="btn blue" id="markBackupManual" style="margin-top:10px">Mark Backup Done Today</button>
    `;
    settings.appendChild(div);
    document.getElementById('disableAutoLock').onchange=e=>{const x=meta();x.disableAutoLock=e.target.checked;saveMeta(x);toast(e.target.checked?'Auto-lock disabled':'Auto-lock enabled')};
    document.getElementById('markBackupManual').onclick=()=>{const x=meta();x.lastBackup=new Date().toISOString().slice(0,10);saveMeta(x);toast('Backup marked done')};
  }

  function init(){installIdleWatch();addBackupReminder();setInterval(addSecurityPanel,2500)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,1000));
})();
