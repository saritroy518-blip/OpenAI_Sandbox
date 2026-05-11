/* OnPoint QA Layer: lightweight self-test for loaded modules and common data structures. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const tabs=[['qatest','QA Self-Test']];
  const MODULES=['ScriptLift','DailyEntryLayer','OnboardingLayer','UsabilityLayer','ControlRoom','ProfilesLayer','GrowthLayer','DataTools','InsightsLayer','OpsLayer'];
  const STORAGE=['opdash.pages.v1','opdash.opslayer.v1','opdash.scriptqueue.v1','opdash.growthlayer.v1','opdash.profiles.v1','opdash.controlroom.v1'];
  function badge(text,type){return `<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function ensureViews(){const main=document.querySelector('.main');if(!main)return;tabs.forEach(([id])=>{if(!$('view-'+id)){const s=document.createElement('section');s.id='view-'+id;s.className='view';main.appendChild(s)}})}
  function ensureTabs(){const nav=$('nav');if(!nav)return;tabs.forEach(([id,label])=>{if(nav.querySelector(`[data-v="${id}"], [data-view="${id}"]`))return;const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.onclick=()=>show(id);nav.appendChild(b)})}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='QA Self-Test';render();window.scrollTo({top:0,behavior:'smooth'})}
  function safeParse(key){try{return {ok:true,value:JSON.parse(localStorage.getItem(key)||'null')}}catch(e){return {ok:false,error:e.message}}}
  function runTests(){
    const rows=[];
    MODULES.forEach(m=>rows.push(['Module: '+m, window[m] ? badge('Loaded','good') : badge('Missing','bad'), window[m] ? 'Global object is available.' : 'Layer may not have loaded or script tag is missing.']));
    ['view-command','view-daily','view-scripts','view-lift','view-scriptops','view-qatest'].forEach(id=>rows.push(['View: '+id, document.getElementById(id)?badge('Found','good'):badge('Missing','bad'), 'Required section element.']));
    STORAGE.forEach(k=>{const r=safeParse(k);rows.push(['Storage: '+k, r.ok?badge('Valid JSON','good'):badge('Invalid JSON','bad'), r.ok?'Parsed successfully.':r.error]);});
    const navButtons=document.querySelectorAll('#nav button[data-v],#nav button[data-view]').length;
    rows.push(['Navigation buttons', navButtons>0?badge('Found','good'):badge('Missing','bad'), String(navButtons)+' source buttons detected.']);
    const grouped=document.getElementById('groupedNavShell');
    rows.push(['Grouped navigation', grouped?badge('Found','good'):badge('Missing','warn'), grouped?'Grouped nav rendered.':'May render after other modules load.']);
    return rows;
  }
  function render(){const el=$('view-qatest');if(!el)return;const rows=runTests();const fails=rows.filter(r=>String(r[1]).includes('bad')).length;el.innerHTML=`<div class="feature-hero"><h2>QA Self-Test</h2><p>Lightweight browser-side sanity check after releases. It confirms layers are loaded, views exist, and localStorage JSON is valid.</p></div><div class="kpi-band"><div class="mini-card"><div class="label">Checks</div><div class="value">${rows.length}</div><div class="sub">total</div></div><div class="mini-card"><div class="label">Failures</div><div class="value ${fails?'bad':'good'}">${fails}</div><div class="sub">should be zero</div></div></div>${table(['Check','Status','Comment'],rows)}<button class="btn primary" onclick="QaLayer.render()">Run Again</button>`}
  window.QaLayer={render,show,runTests};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ensureViews();ensureTabs();render()},2700));
  setInterval(()=>{ensureViews();ensureTabs();},7000);
})();
