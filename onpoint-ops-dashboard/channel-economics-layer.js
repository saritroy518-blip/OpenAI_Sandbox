/* OnPoint Channel Economics Layer: ROI by doctor, medical group, pharma, payer, sales rep, location, and channel. */
(function(){
  'use strict';
  const KEY='opdash.channelecon.v1';
  const BASE_KEY='opdash.pages.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  let viewFilter='All';

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function state(){return read(KEY,{channels:[]})}
  function save(s){write(KEY,s)}
  function base(){return read(BASE_KEY,{imports:{pioneer:[]},manual:{}})}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function input(id,val,type='text'){return`<input id="${esc(id)}" type="${type}" value="${esc(val??'')}" class="left">`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No channel data yet</b>Add channels manually or seed from PioneerRx import.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  const TYPES=['Doctor','Medical Group','Pharma','Payor','Sales Rep','Location','Therapy Class','Walk-in','Digital','Hospital / Discharge','Facility','Other'];

  function ensureViews(){const main=document.querySelector('.main');if(!main)return;if(!$('view-channelecon')){const s=document.createElement('section');s.id='view-channelecon';s.className='view';main.appendChild(s)}}
  function ensureTabs(){const nav=$('nav');if(!nav)return;if(!nav.querySelector('[data-v="channelecon"],[data-view="channelecon"]')){const b=document.createElement('button');b.dataset.v='channelecon';b.textContent='Channel Economics';b.onclick=()=>show('channelecon');nav.appendChild(b)}}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Channel Economics';render();window.scrollTo({top:0,behavior:'smooth'})}

  function calc(r){
    const scripts=n(r.scripts), patients=n(r.patients), gp=n(r.gp)||n(r.revenue)-n(r.cogs), acquisition=n(r.acquisitionCost), service=n(r.serviceCost), sales=n(r.salesCost), enterprise=n(r.enterpriseCost), retained=n(r.retainedPatients);
    const totalCost=acquisition+service+sales+enterprise;
    const net=gp-totalCost;
    const gpRx=scripts?gp/scripts:0;
    const costRx=scripts?totalCost/scripts:0;
    const costGp=gp?totalCost/gp:0;
    const cac=patients?acquisition/patients:0;
    const retention=patients?retained/patients*100:0;
    const ltvProxy=retained?gp/Math.max(1,patients)*3:gp/Math.max(1,patients);
    const payback=net>0&&acquisition>0?acquisition/(net/Math.max(1,30)):0;
    const score=Math.max(0,Math.min(100,Math.round((gpRx/40*30)+(retention/100*25)+((1-Math.min(costGp,1))*25)+(net>0?20:0))));
    return{gp,totalCost,net,gpRx,costRx,costGp,cac,retention,ltvProxy,payback,score};
  }
  function visibleRows(){let rows=(state().channels||[]).slice();if(viewFilter!=='All')rows=rows.filter(r=>r.type===viewFilter);return rows}
  function summary(rows){return rows.reduce((a,r)=>{const c=calc(r);a.scripts+=n(r.scripts);a.patients+=n(r.patients);a.gp+=c.gp;a.cost+=c.totalCost;a.net+=c.net;a.channels++;return a},{scripts:0,patients:0,gp:0,cost:0,net:0,channels:0})}
  function qualityLabel(score){if(score>=75)return badge('Scale','good');if(score>=55)return badge('Fix / Grow','warn');if(score>=35)return badge('Question','warn');return badge('Stop / Redesign','bad')}

  function render(){
    ensureViews();ensureTabs();const el=$('view-channelecon');if(!el)return;
    const rows=visibleRows();const s=summary(rows);const best=rows.slice().sort((a,b)=>calc(b).net-calc(a).net).slice(0,5);const worst=rows.slice().sort((a,b)=>calc(a).net-calc(b).net).slice(0,5);
    el.innerHTML=`
      <div class="feature-hero"><h2>Channel Economics</h2><p>Shows which channels create profitable patients/scripts and which ones create cost, leakage, or noise.</p></div>
      <div class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>Channel Type</label>${select('ce_filter',['All'].concat(TYPES),viewFilter)}</div><button class="btn primary" onclick="ChannelEconomics.applyFilter()">Apply</button><button class="btn" onclick="ChannelEconomics.seedFromPioneer()">Seed From PioneerRx</button><button class="btn" onclick="ChannelEconomics.exportCSV()">Export CSV</button></div>
      <div class="kpi-band">
        ${metric('Channels',num(s.channels),'tracked')}
        ${metric('Scripts',num(s.scripts),'from selected channels')}
        ${metric('Gross Profit',money(s.gp),'GP/Rx '+money(s.scripts?s.gp/s.scripts:0),s.gp>=0?'good':'bad')}
        ${metric('Channel Cost',money(s.cost),'Cost/Rx '+money(s.scripts?s.cost/s.scripts:0))}
        ${metric('Net Contribution',money(s.net),'GP minus channel cost',s.net>=0?'good':'bad')}
      </div>
      <h2>Channel ROI Table</h2>${table(['Type','Name','Owner','Patients','Scripts','GP','Cost','Net','GP/Rx','Cost/Rx','Cost/$GP','Retention','Score',''],rows.map((r,i)=>{const c=calc(r),idx=(state().channels||[]).indexOf(r);return[esc(r.type),esc(r.name),esc(r.owner||''),num(r.patients),num(r.scripts),money(c.gp),money(c.totalCost),money(c.net),money(c.gpRx),money(c.costRx),money(c.costGp),pct(c.retention),qualityLabel(c.score),`<button class="btn red" onclick="ChannelEconomics.deleteRow(${idx})">Delete</button>`]}))}
      <div class="feature-grid two"><div><h2>Best Channels</h2>${table(['Channel','Type','Net','GP/Rx','Score'],best.map(r=>{const c=calc(r);return[esc(r.name),esc(r.type),money(c.net),money(c.gpRx),qualityLabel(c.score)]}))}</div><div><h2>Worst Channels</h2>${table(['Channel','Type','Net','Cost/$GP','Action'],worst.map(r=>{const c=calc(r);return[esc(r.name),esc(r.type),money(c.net),money(c.costGp),c.net<0?'Stop, fix, or reprice':'Watch'] }))}</div></div>
      <h2>Add Channel Economics Row</h2>${form()}
      <h2>Management Questions</h2>${table(['Question','Answer'],managementRows(rows))}
    `;
  }

  function form(){return`<div class="card feature-grid form-table">
    <div><label>Type</label>${select('ce_type',TYPES,'Doctor')}</div><div><label>Name</label>${input('ce_name','')}</div><div><label>Owner</label>${input('ce_owner','')}</div><div><label>Period</label>${input('ce_period',today(),'date')}</div>
    <div><label>Patients</label>${input('ce_patients',0,'number')}</div><div><label>Retained Patients</label>${input('ce_retained',0,'number')}</div><div><label>Scripts</label>${input('ce_scripts',0,'number')}</div><div><label>Revenue</label>${input('ce_revenue',0,'number')}</div><div><label>COGS</label>${input('ce_cogs',0,'number')}</div><div><label>GP</label>${input('ce_gp',0,'number')}</div>
    <div><label>Acquisition Cost</label>${input('ce_acq',0,'number')}</div><div><label>Service Cost</label>${input('ce_service',0,'number')}</div><div><label>Sales Cost</label>${input('ce_sales',0,'number')}</div><div><label>Enterprise Cost</label>${input('ce_enterprise',0,'number')}</div>
    <div style="grid-column:1/-1"><label>Notes</label>${input('ce_notes','')}</div><div style="grid-column:1/-1"><button class="btn primary" onclick="ChannelEconomics.addRow()">Add Channel Row</button></div>
  </div>`}

  function managementRows(rows){
    if(!rows.length)return[];
    const byType={};rows.forEach(r=>{const c=calc(r);byType[r.type]=byType[r.type]||{gp:0,cost:0,net:0,scripts:0};byType[r.type].gp+=c.gp;byType[r.type].cost+=c.totalCost;byType[r.type].net+=c.net;byType[r.type].scripts+=n(r.scripts)});
    const bestType=Object.entries(byType).sort((a,b)=>b[1].net-a[1].net)[0];
    const worstType=Object.entries(byType).sort((a,b)=>a[1].net-b[1].net)[0];
    const bestRow=rows.slice().sort((a,b)=>calc(b).score-calc(a).score)[0];
    return[
      ['Which channel type should we scale?',bestType?bestType[0]+' with '+money(bestType[1].net)+' net contribution':'Not enough data'],
      ['Which channel type needs fixing?',worstType?worstType[0]+' with '+money(worstType[1].net)+' net contribution':'Not enough data'],
      ['Best quality channel?',bestRow?bestRow.name+' scored '+calc(bestRow).score+'/100':'Not enough data'],
      ['What is the operating rule?', 'Scale high GP/Rx, high retention, low cost/$GP channels. Fix or stop low GP, high drag channels.']
    ];
  }

  function addRow(){
    const s=state();s.channels=s.channels||[];s.channels.push({type:$('ce_type')?.value||'Other',name:$('ce_name')?.value||'Unnamed',owner:$('ce_owner')?.value||'',period:$('ce_period')?.value||today(),patients:$('ce_patients')?.value||0,retainedPatients:$('ce_retained')?.value||0,scripts:$('ce_scripts')?.value||0,revenue:$('ce_revenue')?.value||0,cogs:$('ce_cogs')?.value||0,gp:$('ce_gp')?.value||0,acquisitionCost:$('ce_acq')?.value||0,serviceCost:$('ce_service')?.value||0,salesCost:$('ce_sales')?.value||0,enterpriseCost:$('ce_enterprise')?.value||0,notes:$('ce_notes')?.value||'',created:new Date().toISOString()});save(s);toast('Channel row added');render();
  }
  function seedFromPioneer(){
    const rows=((base().imports||{}).pioneer||[]);if(!rows.length)return toast('No PioneerRx import rows found.');
    const grouped={};rows.forEach(r=>{const name=r.doctor||r.prescriber||r.provider||'Unknown Doctor';const key='Doctor|'+name;grouped[key]=grouped[key]||{type:'Doctor',name,owner:'',patients:new Set(),retainedPatients:0,scripts:0,revenue:0,cogs:0,gp:0,acquisitionCost:0,serviceCost:0,salesCost:0,enterpriseCost:0,notes:'Seeded from PioneerRx'};grouped[key].scripts++;grouped[key].revenue+=n(r.revenue);grouped[key].cogs+=n(r.cogs);grouped[key].gp+=n(r.grossProfit)||n(r.revenue)-n(r.cogs);if(r.patientId)grouped[key].patients.add(r.patientId)});
    const s=state();s.channels=s.channels||[];Object.values(grouped).forEach(g=>{g.patients=g.patients.size;s.channels.push(g)});save(s);toast('Seeded '+Object.keys(grouped).length+' doctor channels');render();
  }
  function exportCSV(){const rows=state().channels||[];const headers=['type','name','owner','period','patients','retainedPatients','scripts','revenue','cogs','gp','acquisitionCost','serviceCost','salesCost','enterpriseCost','notes'];const csv=headers.join(',')+'\n'+rows.map(r=>headers.map(h=>csvCell(r[h])).join(',')).join('\n');download('onpoint_channel_economics_'+today()+'.csv',csv,'text/csv')}
  function deleteRow(i){if(!confirm('Delete this channel economics row?'))return;const s=state();s.channels.splice(i,1);save(s);render()}

  window.ChannelEconomics={render,show,addRow,seedFromPioneer,exportCSV,deleteRow,applyFilter(){viewFilter=$('ce_filter')?.value||'All';render()}};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
