/* OnPoint Owner Economics Layer: pharmacist-owner earnings, corporate fee, store contribution, behavior levers. */
(function(){
  'use strict';
  const KEY='opdash.ownerecon.v1';
  const BASE_KEY='opdash.pages.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function state(){return read(KEY,{models:[]})}
  function save(s){write(KEY,s)}
  function base(){return read(BASE_KEY,{manual:{},imports:{pioneer:[]}})}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows yet</b>Add owner models or import location data.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function input(id,val,type='number'){return`<input id="${esc(id)}" type="${type}" value="${esc(val??'')}" class="left">`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}

  const tabs=[['ownerecon','Owner Economics']];
  function ensureViews(){const main=document.querySelector('.main');if(!main)return;tabs.forEach(([id])=>{if(!$('view-'+id)){const s=document.createElement('section');s.id='view-'+id;s.className='view';main.appendChild(s)}})}
  function ensureTabs(){const nav=$('nav');if(!nav)return;tabs.forEach(([id,label])=>{if(nav.querySelector(`[data-v="${id}"], [data-view="${id}"]`))return;const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.onclick=()=>show(id);nav.appendChild(b)})}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Owner Economics';render();window.scrollTo({top:0,behavior:'smooth'})}

  function calcModel(m){
    const scripts=n(m.scripts), gpRx=n(m.gpRx), revenueRx=n(m.revenueRx), laborRx=n(m.laborRx), deliveryRx=n(m.deliveryRx), otherRx=n(m.otherRx), rent=n(m.rent), corpFeePct=n(m.corpFeePct)/100, partnerPct=n(m.partnerPct)/100;
    const revenue=scripts*revenueRx;
    const gp=scripts*gpRx;
    const variableCost=scripts*(laborRx+deliveryRx+otherRx);
    const localContribution=gp-variableCost-rent;
    const corpFee=Math.max(0,localContribution*corpFeePct);
    const storeProfit=localContribution-corpFee;
    const partnerEarnings=storeProfit*partnerPct;
    const platformShare=storeProfit-partnerEarnings+corpFee;
    return{revenue,gp,variableCost,localContribution,corpFee,storeProfit,partnerEarnings,platformShare,costRx:scripts?(variableCost+rent)/scripts:0,costGp:gp?(variableCost+rent)/gp:0};
  }

  function render(){ensureViews();ensureTabs();const el=$('view-ownerecon');if(!el)return;const s=state();const rows=s.models.map((m,i)=>{const c=calcModel(m);return[esc(m.name),num(m.scripts),money(m.gpRx),money(c.gp),money(c.localContribution),money(c.corpFee),money(c.partnerEarnings),money(c.platformShare),money(c.costRx),`<button class="btn red" onclick="OwnerEconomics.delModel(${i})">Delete</button>`]});const total=s.models.reduce((a,m)=>{const c=calcModel(m);a.gp+=c.gp;a.partner+=c.partnerEarnings;a.platform+=c.platformShare;a.contrib+=c.localContribution;return a},{gp:0,partner:0,platform:0,contrib:0});el.innerHTML=`<div class="feature-hero"><h2>Pharmacist-Owner Economics</h2><p>Show pharmacist-owners how scripts, GP/Rx, labor/Rx, delivery/Rx, rent, and corporate fee translate into partner earnings and platform economics.</p></div><div class="kpi-band">${metric('Modeled GP',money(total.gp),'all models')}${metric('Local Contribution',money(total.contrib),'before corporate fee')}${metric('Partner Earnings',money(total.partner),'owner share')}${metric('Platform Share',money(total.platform),'corporate + residual')}${metric('Models',num(s.models.length),'locations / stores')}</div><h2>Owner Models</h2>${table(['Name','Scripts','GP/Rx','GP','Local Contribution','Corp Fee','Partner Earnings','Platform Share','Cost/Rx',''],rows)}<h2>Add Owner Model</h2><div class="card feature-grid form-table"><div><label>Name</label>${input('oe_name','Model Store','text')}</div><div><label>Scripts / Period</label>${input('oe_scripts',3000)}</div><div><label>Revenue / Rx</label>${input('oe_revenueRx',250)}</div><div><label>GP / Rx</label>${input('oe_gpRx',40)}</div><div><label>Labor / Rx</label>${input('oe_laborRx',7)}</div><div><label>Delivery / Rx</label>${input('oe_deliveryRx',2)}</div><div><label>Other Cost / Rx</label>${input('oe_otherRx',3)}</div><div><label>Rent / Fixed Cost</label>${input('oe_rent',15000)}</div><div><label>Corporate Fee %</label>${input('oe_corpFeePct',15)}</div><div><label>Partner Share %</label>${input('oe_partnerPct',33)}</div></div><button class="btn primary" onclick="OwnerEconomics.addModel()">Add Model</button><h2>Behavior Levers</h2>${table(['Lever','Impact','Owner Behavior'],[['Increase GP/Rx','Raises partner earnings without more scripts','Use Lift, payer mix awareness, better script optimization'],['Reduce labor/Rx','Improves local contribution','Better workflow, scheduling, tech adoption'],['Reduce delivery failure','Cuts wasted cost','Confirm address/contact, route discipline'],['Improve fill rate','Captures GP already in pipeline','Clear PA, patient contact, payer rejections'],['Improve retention','Creates repeat GP without reacquisition','DSOH rescue and refill capture']])}`}
  window.OwnerEconomics={render,show,addModel(){const s=state();s.models.push({name:$('oe_name')?.value||'Model Store',scripts:$('oe_scripts')?.value||0,revenueRx:$('oe_revenueRx')?.value||0,gpRx:$('oe_gpRx')?.value||0,laborRx:$('oe_laborRx')?.value||0,deliveryRx:$('oe_deliveryRx')?.value||0,otherRx:$('oe_otherRx')?.value||0,rent:$('oe_rent')?.value||0,corpFeePct:$('oe_corpFeePct')?.value||0,partnerPct:$('oe_partnerPct')?.value||0});save(s);toast('Owner model added');render()},delModel(i){const s=state();s.models.splice(i,1);save(s);render()}};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,2600));
  setInterval(render,9000);
})();
