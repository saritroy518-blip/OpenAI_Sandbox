/* OnPoint Cost Allocation Engine: allocate shared costs to locations, channels, teams, and operating objects. */
(function(){
  'use strict';
  const KEY='opdash.costallocation.v1';
  const COST_KEY='opdash.costledger.v1';
  const CHAN_KEY='opdash.channelecon.v1';
  const BASE_KEY='opdash.pages.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const n=x=>Number(String(x??'').replace(/[$,]/g,'').replace(/[()]/g,m=>m==='('?'-':''))||0;
  const money=x=>(n(x)<0?'-$':'$')+Math.abs(Math.round(n(x))).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  let view='Summary';

  const DEST_TYPES=['Location','Channel','Team','Doctor','Enterprise Account','Cost Type','Object','Corporate'];
  const METHODS=['Fixed %','By Scripts','By Gross Profit','By Revenue','Equal Split','Manual Amount'];
  const COST_TYPES=['Corporate Overhead','Software / Technology','Accounting / Finance','Insurance','Debt Service','Delivery','Sales / BD','Enterprise / Account Management','Pharmacist Labor','Technician Labor','Rent','Other'];

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function state(){const s=read(KEY,{rules:[],manualDrivers:[]});s.rules=s.rules||[];s.manualDrivers=s.manualDrivers||[];return s}
  function save(s){write(KEY,s)}
  function cost(){return read(COST_KEY,{transactions:[]})}
  function channels(){return read(CHAN_KEY,{channels:[]})}
  function base(){return read(BASE_KEY,{manual:{}})}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option value="${esc(o)}" ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function input(id,val,type='text'){return`<input id="${esc(id)}" type="${type}" value="${esc(val??'')}" class="left">`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows yet</b>Add allocation rules or channel/location drivers.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  function ensureViews(){const main=document.querySelector('.main');if(!main)return;if(!$('view-allocation')){const s=document.createElement('section');s.id='view-allocation';s.className='view';main.appendChild(s)}}
  function ensureTabs(){const nav=$('nav');if(!nav)return;if(!nav.querySelector('[data-v="allocation"],[data-view="allocation"]')){const b=document.createElement('button');b.dataset.v='allocation';b.textContent='Allocation Engine';b.onclick=()=>show('allocation');nav.appendChild(b)}}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Cost Allocation Engine';render();window.scrollTo({top:0,behavior:'smooth'})}

  function ledgerCosts(){return (cost().transactions||[]).filter(x=>n(x.amount)<0).map(x=>({...x,absAmount:Math.abs(n(x.amount))}))}
  function driverRows(){
    const chan=(channels().channels||[]).map(c=>({destType:'Channel',dest:c.name||'Unnamed Channel',scripts:n(c.scripts),gp:n(c.gp)||n(c.revenue)-n(c.cogs),revenue:n(c.revenue),manual:n(c.manualDriver),source:'Channel Economics'}));
    const manual=(state().manualDrivers||[]).map(r=>({...r,scripts:n(r.scripts),gp:n(r.gp),revenue:n(r.revenue),manual:n(r.manual),source:'Manual'}));
    return chan.concat(manual).filter(r=>r.dest);
  }
  function costPool(rule){
    return ledgerCosts().filter(x=>{
      if(rule.costType&&rule.costType!=='All'&&x.costType!==rule.costType)return false;
      if(rule.team&&rule.team!=='All'&&x.team!==rule.team)return false;
      if(rule.objectType&&rule.objectType!=='All'&&x.objectType!==rule.objectType)return false;
      return true;
    }).reduce((a,x)=>a+x.absAmount,0);
  }
  function eligibleDrivers(rule){
    let rows=driverRows();
    if(rule.destType&&rule.destType!=='All')rows=rows.filter(r=>r.destType===rule.destType);
    if(rule.destContains)rows=rows.filter(r=>String(r.dest).toLowerCase().includes(String(rule.destContains).toLowerCase()));
    return rows;
  }
  function allocations(){
    const out=[];
    (state().rules||[]).forEach((rule,ruleIndex)=>{
      const pool=costPool(rule), drivers=eligibleDrivers(rule);
      if(!pool||!drivers.length)return;
      let denom=0;
      if(rule.method==='By Scripts')denom=drivers.reduce((a,r)=>a+n(r.scripts),0);
      else if(rule.method==='By Gross Profit')denom=drivers.reduce((a,r)=>a+n(r.gp),0);
      else if(rule.method==='By Revenue')denom=drivers.reduce((a,r)=>a+n(r.revenue),0);
      else if(rule.method==='Equal Split')denom=drivers.length;
      else if(rule.method==='Manual Amount')denom=drivers.reduce((a,r)=>a+n(r.manual),0);
      drivers.forEach(d=>{
        let share=0;
        if(rule.method==='Fixed %')share=n(rule.fixedPct)/100;
        else if(rule.method==='By Scripts')share=denom?n(d.scripts)/denom:0;
        else if(rule.method==='By Gross Profit')share=denom?n(d.gp)/denom:0;
        else if(rule.method==='By Revenue')share=denom?n(d.revenue)/denom:0;
        else if(rule.method==='Equal Split')share=denom?1/denom:0;
        else if(rule.method==='Manual Amount')share=denom?n(d.manual)/denom:0;
        out.push({ruleIndex,ruleName:rule.name||('Rule '+(ruleIndex+1)),costType:rule.costType||'All',pool,destType:d.destType,dest:d.dest,method:rule.method,share,amount:pool*share,scripts:d.scripts,gp:d.gp,revenue:d.revenue});
      });
    });
    return out;
  }
  function summary(){const a=allocations(), pool=(state().rules||[]).reduce((x,r)=>x+costPool(r),0), allocated=a.reduce((x,r)=>x+n(r.amount),0);return{rules:(state().rules||[]).length,drivers:driverRows().length,pool,allocated,unallocated:Math.max(0,pool-allocated),rows:a.length}}
  function allocationRollup(by){const out={};allocations().forEach(r=>{const k=r[by]||'Unassigned';out[k]=out[k]||{amount:0,scripts:0,gp:0,revenue:0};out[k].amount+=n(r.amount);out[k].scripts+=n(r.scripts);out[k].gp+=n(r.gp);out[k].revenue+=n(r.revenue)});return Object.entries(out).sort((a,b)=>b[1].amount-a[1].amount).map(([k,v])=>[esc(k),money(v.amount),money(v.gp),num(v.scripts),money(v.scripts?v.amount/v.scripts:0)+' / Rx',money(v.gp?v.amount/v.gp:0)+' per $1 GP'])}
  function ruleRows(){return (state().rules||[]).map((r,i)=>[esc(r.name||('Rule '+(i+1))),esc(r.costType||'All'),esc(r.team||'All'),esc(r.objectType||'All'),esc(r.destType||'All'),esc(r.method),r.method==='Fixed %'?pct(n(r.fixedPct)):esc(r.destContains||''),money(costPool(r)),`<button class="btn red" onclick="AllocationEngine.deleteRule(${i})">Delete</button>`])}
  function driverTable(){return driverRows().map((r,i)=>[esc(r.destType),esc(r.dest),num(r.scripts),money(r.gp),money(r.revenue),num(r.manual),esc(r.source),r.source==='Manual'?`<button class="btn red" onclick="AllocationEngine.deleteDriver(${i})">Delete</button>`:''])}
  function addRule(){const s=state();s.rules.push({name:$('alloc_rule_name')?.value||'Allocation Rule',costType:$('alloc_cost_type')?.value||'All',team:$('alloc_team')?.value||'All',objectType:$('alloc_object_type')?.value||'All',destType:$('alloc_dest_type')?.value||'Channel',destContains:$('alloc_dest_contains')?.value||'',method:$('alloc_method')?.value||'By Gross Profit',fixedPct:$('alloc_fixed_pct')?.value||0,created:new Date().toISOString()});save(s);toast('Allocation rule added');render()}
  function addDriver(){const s=state();s.manualDrivers.push({destType:$('driver_dest_type')?.value||'Location',dest:$('driver_dest')?.value||'Unnamed',scripts:$('driver_scripts')?.value||0,gp:$('driver_gp')?.value||0,revenue:$('driver_revenue')?.value||0,manual:$('driver_manual')?.value||0,created:new Date().toISOString()});save(s);toast('Driver added');render()}
  function exportCSV(){const rows=allocations(),headers=['ruleName','costType','pool','destType','dest','method','share','amount','scripts','gp','revenue'];const csv=headers.join(',')+'\n'+rows.map(r=>headers.map(h=>csvCell(r[h])).join(',')).join('\n');download('onpoint_cost_allocations_'+today()+'.csv',csv,'text/csv')}
  function render(){ensureViews();ensureTabs();const el=$('view-allocation');if(!el)return;const s=summary();el.innerHTML=`
    <div class="feature-hero"><h2>Cost Allocation Engine</h2><p>Allocate shared overhead, technology, finance, debt, delivery, sales, and enterprise costs to the operating objects that should carry them.</p></div>
    <div class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>View</label>${select('alloc_view',['Summary','Rules','Drivers','Allocations'],view)}</div><button class="btn primary" onclick="AllocationEngine.applyView()">Apply</button><button class="btn" onclick="AllocationEngine.exportCSV()">Export Allocations</button></div>
    <div class="kpi-band">${metric('Rules',num(s.rules),'allocation logic')}${metric('Drivers',num(s.drivers),'destinations')}${metric('Cost Pool',money(s.pool),'selected ledger cost')}${metric('Allocated',money(s.allocated),num(s.rows)+' rows',s.allocated?'good':'warn')}${metric('Unallocated',money(s.unallocated),'pool less allocations',s.unallocated?'warn':'good')}</div>
    ${view==='Summary'?summaryView():view==='Rules'?rulesView():view==='Drivers'?driversView():allocationsView()}
  `}
  function summaryView(){return`<h2>Allocated Cost by Destination</h2>${table(['Destination','Allocated Cost','GP','Scripts','Allocated Cost/Rx','Allocated Cost/$GP'],allocationRollup('dest'))}<h2>Allocated Cost by Destination Type</h2>${table(['Destination Type','Allocated Cost','GP','Scripts','Allocated Cost/Rx','Allocated Cost/$GP'],allocationRollup('destType'))}<h2>Manager Interpretation</h2>${table(['Question','Answer'],managerRows())}`}
  function rulesView(){return`<h2>Add Allocation Rule</h2><div class="card feature-grid form-table"><div><label>Rule Name</label>${input('alloc_rule_name','Allocate Corporate Overhead')}</div><div><label>Cost Type</label>${select('alloc_cost_type',['All'].concat(COST_TYPES),'Corporate Overhead')}</div><div><label>Team</label>${select('alloc_team',['All','Pharmacy Ops','Sales','Enterprise','Technology','Finance','Executive','Corporate'],'All')}</div><div><label>Object Type</label>${select('alloc_object_type',['All','Corporate','Team','Debt','Vendor','Inventory','Location'],'All')}</div><div><label>Destination Type</label>${select('alloc_dest_type',['All'].concat(DEST_TYPES),'Channel')}</div><div><label>Destination Contains</label>${input('alloc_dest_contains','')}</div><div><label>Method</label>${select('alloc_method',METHODS,'By Gross Profit')}</div><div><label>Fixed %</label>${input('alloc_fixed_pct',0,'number')}</div><div style="grid-column:1/-1"><button class="btn primary" onclick="AllocationEngine.addRule()">Add Rule</button></div></div><h2>Rules</h2>${table(['Name','Cost Type','Team','Object Type','Destination Type','Method','Parameter','Cost Pool',''],ruleRows())}`}
  function driversView(){return`<h2>Add Manual Driver</h2><div class="card feature-grid form-table"><div><label>Destination Type</label>${select('driver_dest_type',DEST_TYPES,'Location')}</div><div><label>Destination</label>${input('driver_dest','')}</div><div><label>Scripts</label>${input('driver_scripts',0,'number')}</div><div><label>GP</label>${input('driver_gp',0,'number')}</div><div><label>Revenue</label>${input('driver_revenue',0,'number')}</div><div><label>Manual Weight</label>${input('driver_manual',0,'number')}</div><div style="grid-column:1/-1"><button class="btn primary" onclick="AllocationEngine.addDriver()">Add Driver</button></div></div><h2>Drivers</h2>${table(['Type','Destination','Scripts','GP','Revenue','Manual Weight','Source',''],driverTable())}`}
  function allocationsView(){return`<h2>Allocation Detail</h2>${table(['Rule','Cost Type','Cost Pool','Destination Type','Destination','Method','Share','Allocated Amount','Scripts','GP'],allocations().map(r=>[esc(r.ruleName),esc(r.costType),money(r.pool),esc(r.destType),esc(r.dest),esc(r.method),pct(r.share*100),money(r.amount),num(r.scripts),money(r.gp)]))}`}
  function managerRows(){const rows=allocationRollup('dest');if(!rows.length)return[['What is missing?','Add cost ledger rows, channel rows, or manual drivers.']];return[['Who carries the most shared cost?',rows[0][0]+' at '+rows[0][1]],['What should I look for?','High allocated cost/Rx or cost/$GP means the destination needs more GP, lower cost, or different allocation logic.'],['Operating rule','Do not judge location/channel profitability until shared costs are allocated.']]}
  function deleteRule(i){const s=state();s.rules.splice(i,1);save(s);render()}
  function deleteDriver(i){const s=state();const manualIndex=i-(channels().channels||[]).length;if(manualIndex>=0)s.manualDrivers.splice(manualIndex,1);save(s);render()}
  window.AllocationEngine={render,show,addRule,addDriver,deleteRule,deleteDriver,exportCSV,applyView(){view=$('alloc_view')?.value||'Summary';render()}};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
