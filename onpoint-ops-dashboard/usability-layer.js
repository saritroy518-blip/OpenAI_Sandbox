/* OnPoint Usability Layer: role mode, favorites, next best action, glossary/help. */
(function(){
  'use strict';
  const KEY='opdash.usability.v1';
  const BASE_KEY='opdash.pages.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function state(){return read(KEY,{role:'CEO',favorites:['mobileceo','daily','actions','insights','finance'],dismissedTips:[]})}
  function save(s){write(KEY,s)}
  function base(){return read(BASE_KEY,{manual:{},imports:{}})}
  function ops(){return read(OPS_KEY,{actions:[],employees:[],pipeline:[]})}
  function safeCalc(){try{return typeof calc==='function'?calc():{}}catch(e){return{}}}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}

  const ROLE_DEFAULTS={
    CEO:['mobileceo','insights','actions','finance','capitalpack'],
    Finance:['finance','budget','close','backup','capitalpack'],
    Ops:['daily','worklists','pa','retention','delivery'],
    Sales:['pipeline','doctorprofiles','tiers','cohorts','actions'],
    Enterprise:['enterpriseprofiles','reports','partnercard','pipeline','actions'],
    Technology:['dataqa','importqa','dictionary','admin','actions']
  };
  const LABELS={mobileceo:'CEO Mobile',daily:'Daily Entry',actions:'Actions',insights:'CEO Brief',finance:'Finance',capitalpack:'Capital Pack',budget:'Budget',close:'Monthly Close',backup:'Backup',worklists:'Worklists',pa:'PA Intelligence',retention:'Retention',delivery:'Delivery',pipeline:'Pipeline',doctorprofiles:'Doctor Profiles',tiers:'Doctor Tiers',cohorts:'Cohorts',enterpriseprofiles:'Account Profiles',reports:'Reports',partnercard:'Partner Scorecard',dataqa:'Data QA',importqa:'Import QA',dictionary:'Dictionary',admin:'Admin'};
  const GLOSSARY=[
    ['GP','Gross profit. Revenue minus COGS.'],['GP/Rx','Gross profit per filled script. A core measure of script value.'],['Cost/Rx','Operating cost per filled script. If it rises faster than GP/Rx, the machine is getting worse.'],['Fill Rate','Filled scripts divided by scripts received.'],['DSOH','Days Supply on Hand. Low DSOH means the patient is close to a therapy gap.'],['PA Backlog','Scripts stuck waiting on prior authorization. Often invisible leakage.'],['DIR Exposure','Estimated Medicare Part D clawback risk.'],['Weighted Pipeline','Expected GP multiplied by probability.'],['Breakeven Rx','Filled scripts needed to cover current cost structure.'],['Adherence','Proxy for patients staying on therapy, often PDC-based.']
  ];

  function clickPage(id){const btn=document.querySelector(`#nav button[data-v="${id}"],#nav button[data-view="${id}"],[data-jump="${id}"]`);if(btn)btn.click();else toast('Page not ready yet: '+id)}
  function nextBestActions(){const c=safeCalc(),o=ops(),out=[];
    if(Object.keys(base().manual||{}).length===0)out.push(['Enter today’s numbers','Start with Daily Entry so the dashboard has truth.','daily','amber']);
    if((o.employees||[]).length===0)out.push(['Add owners','Add employees so actions can be assigned.','people','amber']);
    if((o.actions||[]).filter(a=>a.status!=='Done').length===0)out.push(['Create first action','A dashboard without actions is just expensive wallpaper.','actions','amber']);
    if(n(c.paBacklog)>0)out.push(['Clear PA backlog',`${num(c.paBacklog)} scripts are waiting on PA.`, 'pa','red']);
    if(n(c.dsOhRisk)>0)out.push(['Work DSOH risk',`${num(c.dsOhRisk)} patients are near therapy gap.`, 'retention','red']);
    if(n(c.costRx)>10)out.push(['Review cost/Rx',`Cost/Rx is ${money(c.costRx)}.`, 'finance','amber']);
    if(n(c.fill||c.fillRate)>0&&n(c.fill||c.fillRate)<90)out.push(['Diagnose fill rate',`Fill rate is ${pct(c.fill||c.fillRate)}.`, 'worklists','red']);
    if(!out.length)out.push(['Run weekly meeting','Review meeting mode, actions, and next week priorities.','meeting','green']);
    return out.slice(0,4);
  }

  function renderTop(){
    if(!document.getElementById('appView')||document.getElementById('uxUsabilityBar'))return;
    const main=document.querySelector('.main'); if(!main)return;
    const s=state();
    const bar=document.createElement('div');
    bar.id='uxUsabilityBar';
    bar.className='card usability-bar';
    bar.innerHTML=`
      <div class="usability-row">
        <div><label>Role Mode</label><select id="roleModeSelect">${Object.keys(ROLE_DEFAULTS).map(r=>`<option ${r===s.role?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="fav-wrap" id="favoriteButtons"></div>
        <div><button class="btn blue" id="helpBtn">Help</button></div>
      </div>
      <div id="nextBestActions" class="next-actions"></div>
    `;
    main.insertBefore(bar,main.firstChild.nextSibling);
    document.getElementById('roleModeSelect').onchange=e=>{const x=state();x.role=e.target.value;x.favorites=ROLE_DEFAULTS[x.role]||x.favorites;save(x);renderUsability(true);toast('Role mode set to '+x.role)};
    document.getElementById('helpBtn').onclick=showHelp;
    renderUsability();
  }
  function renderUsability(skipCreate=false){
    if(!skipCreate)renderTop();
    const s=state();
    const fav=document.getElementById('favoriteButtons');
    if(fav)fav.innerHTML=(s.favorites||[]).map(id=>`<button class="btn" onclick="UsabilityLayer.go('${id}')">${esc(LABELS[id]||id)}</button>`).join('');
    const nba=document.getElementById('nextBestActions');
    if(nba)nba.innerHTML=nextBestActions().map(a=>`<button class="next-action ${a[3]}" onclick="UsabilityLayer.go('${a[2]}')"><strong>${esc(a[0])}</strong><span>${esc(a[1])}</span></button>`).join('');
  }
  function showHelp(){
    let modal=document.getElementById('helpModal'); if(modal){modal.remove();return;}
    modal=document.createElement('div');modal.id='helpModal';modal.className='help-modal';
    modal.innerHTML=`<div class="help-card"><button class="btn red help-close" onclick="document.getElementById('helpModal').remove()">Close</button><h2>OnPoint Dashboard Help</h2><p class="muted">Use this as a daily operating system, not a data museum. Enter numbers, review actions, assign owners, and run the meeting.</p><h3>Glossary</h3><table><tbody>${GLOSSARY.map(([k,v])=>`<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')}</tbody></table><h3>Daily rhythm</h3><p>Finance enters cash and economics. Ops enters scripts and stuck work. Sales enters doctor activity and pipeline. Enterprise enters account progress. CEO reviews actions and risks.</p></div>`;
    document.body.appendChild(modal);
  }

  function addStyles(){if(document.getElementById('usabilityStyles'))return;const style=document.createElement('style');style.id='usabilityStyles';style.textContent=`
    .usability-bar{margin-bottom:14px;padding:12px}.usability-row{display:grid;grid-template-columns:160px 1fr auto;gap:10px;align-items:end}.fav-wrap{display:flex;gap:6px;flex-wrap:wrap}.next-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.next-action{border:0;border-left:5px solid #111827;background:#fff;border-radius:12px;padding:10px;text-align:left;box-shadow:0 2px 8px rgba(0,0,0,.04);cursor:pointer}.next-action strong{display:block;font-size:12px}.next-action span{display:block;font-size:11px;color:#667085;margin-top:3px}.next-action.red{border-left-color:#b42318}.next-action.amber{border-left-color:#b54708}.next-action.green{border-left-color:#067647}.help-modal{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:10001;display:grid;place-items:center;padding:18px}.help-card{background:white;border-radius:18px;padding:20px;max-width:760px;max-height:84vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.35)}.help-close{float:right}@media(max-width:900px){.usability-row{grid-template-columns:1fr}.next-actions{grid-template-columns:1fr}.fav-wrap .btn{flex:1;font-size:12px;padding:8px 6px}}
  `;document.head.appendChild(style)}

  window.UsabilityLayer={go:clickPage,render:renderUsability,help:showHelp};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(()=>{addStyles();renderUsability()},200);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{addStyles();renderUsability()},2300));
  setInterval(renderUsability,9000);
})();
