/* OnPoint Safety Guard Layer: PHI pattern warning, safer exports, and local data hygiene. */
(function(){
  'use strict';
  const KEY='opdash.safetyguard.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  function read(){try{return JSON.parse(localStorage.getItem(KEY))||{warnings:[],enabled:true}}catch(e){return{warnings:[],enabled:true}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
  function toast(msg){try{window.toast?window.toast(msg):console.warn(msg)}catch(e){}}

  const patterns=[
    {name:'Possible phone number',rx:/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/},
    {name:'Possible SSN',rx:/\b\d{3}-\d{2}-\d{4}\b/},
    {name:'Possible DOB/date of birth',rx:/\b(?:DOB|date of birth|birthdate)\s*[:=]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i},
    {name:'Possible street address',rx:/\b\d{1,6}\s+[A-Za-z0-9.'\-\s]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/i},
    {name:'Possible email address',rx:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i},
    {name:'Patient name label',rx:/\b(patient name|pt name|member name)\s*[:=]/i}
  ];

  function scanValue(value){
    const text=String(value??'');
    if(!text || text.length<6) return [];
    return patterns.filter(p=>p.rx.test(text)).map(p=>p.name);
  }

  function logWarning(kind,value,field){
    const s=read();
    const masked=String(value??'').slice(0,4)+'…'+String(value??'').slice(-2);
    s.warnings=s.warnings||[];
    s.warnings.unshift({date:new Date().toISOString(),kind,field:field||'',sample:masked});
    s.warnings=s.warnings.slice(0,100);
    save(s);
  }

  function warn(kind,value,field){
    logWarning(kind,value,field);
    showWarning(kind,field);
  }

  function showWarning(kind,field){
    if(document.getElementById('phiGuardToast')) return;
    const div=document.createElement('div');
    div.id='phiGuardToast';
    div.className='action-item red';
    div.style.cssText='position:fixed;right:14px;bottom:124px;z-index:10002;max-width:380px;box-shadow:0 18px 44px rgba(0,0,0,.28)';
    div.innerHTML=`<div class="action-title">Possible PHI detected</div><div class="action-copy">${esc(kind)}${field?' in '+esc(field):''}. This app should use de-identified operating data only.</div><div style="margin-top:8px"><button class="btn red" id="phiDismiss">Dismiss</button></div>`;
    document.body.appendChild(div);
    document.getElementById('phiDismiss').onclick=()=>div.remove();
    setTimeout(()=>div.remove(),9000);
  }

  function bindInputs(){
    if(document.body.dataset.phiGuardBound) return;
    document.body.dataset.phiGuardBound='1';
    document.addEventListener('input',e=>{
      const el=e.target;
      if(!el || !['INPUT','TEXTAREA'].includes(el.tagName)) return;
      if(el.type==='password' || el.id==='password' || el.id==='newPassword' || el.id==='confirmPassword') return;
      const hits=scanValue(el.value);
      if(hits.length) warn(hits[0],el.value,el.id||el.name||'field');
    },true);
  }

  function scanStorage(){
    const keys=Object.keys(localStorage).filter(k=>k.startsWith('opdash.'));
    const findings=[];
    keys.forEach(k=>{
      let txt='';
      try{txt=localStorage.getItem(k)||''}catch(e){}
      patterns.forEach(p=>{if(p.rx.test(txt))findings.push({key:k,kind:p.name})});
    });
    return findings;
  }

  function renderPanel(){
    const settings=document.getElementById('view-settings');
    if(!settings || document.getElementById('safetyGuardPanel')) return;
    const s=read();
    const findings=scanStorage();
    const div=document.createElement('div');
    div.id='safetyGuardPanel';
    div.className='card';
    div.style.marginTop='16px';
    div.innerHTML=`<h2 style="margin-top:0">PHI Safety Guard</h2><p class="muted">This browser-side scanner warns on obvious PHI-looking patterns. It is not perfect. The rule stays simple: no patient-identifying data.</p><div class="kpi-band"><div class="mini-card"><div class="label">Stored Warnings</div><div class="value">${(s.warnings||[]).length}</div><div class="sub">recent detections</div></div><div class="mini-card"><div class="label">Storage Findings</div><div class="value ${findings.length?'bad':'good'}">${findings.length}</div><div class="sub">scan result</div></div></div><button class="btn blue" id="runPhiScan">Run Storage Scan</button> <button class="btn red" id="clearPhiWarnings">Clear Warning Log</button><div id="phiScanResults" style="margin-top:12px"></div>`;
    settings.appendChild(div);
    document.getElementById('runPhiScan').onclick=()=>{
      const rows=scanStorage();
      document.getElementById('phiScanResults').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Storage Key</th><th>Finding</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.key)}</td><td>${esc(r.kind)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><b>No obvious PHI patterns found</b>Still do not enter PHI.</div>';
    };
    document.getElementById('clearPhiWarnings').onclick=()=>{const x=read();x.warnings=[];save(x);toast('PHI warning log cleared');div.remove();renderPanel()};
  }

  window.SafetyGuard={scanValue,scanStorage,renderPanel};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{bindInputs();renderPanel()},1500));
  setInterval(renderPanel,6000);
})();
