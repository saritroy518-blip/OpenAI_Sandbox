/* OnPoint Reconciliation + Close Control: tie bank, Sage, cost ledger, and P&L together. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const COST_KEY='opdash.costledger.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const n=x=>Number(String(x??'').replace(/[$,]/g,'').replace(/[()]/g,m=>m==='('?'-':''))||0;
  const money=x=>(n(x)<0?'-$':'$')+Math.abs(Math.round(n(x))).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  let windowDays=30;

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function base(){return read(BASE_KEY,{manual:{},imports:{bank:[],sage:[],intacct:[],cash:[]}})}
  function cost(){return read(COST_KEY,{transactions:[],rules:[]})}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows</b>Nothing to reconcile yet.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  function ensureViews(){const main=document.querySelector('.main');if(!main)return;if(!$('view-reconcile')){const s=document.createElement('section');s.id='view-reconcile';s.className='view';main.appendChild(s)}}
  function ensureTabs(){const nav=$('nav');if(!nav)return;if(!nav.querySelector('[data-v="reconcile"],[data-view="reconcile"]')){const b=document.createElement('button');b.dataset.v='reconcile';b.textContent='Reconcile';b.onclick=()=>show('reconcile');nav.appendChild(b)}}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Reconciliation + Close Control';render();window.scrollTo({top:0,behavior:'smooth'})}

  function asDate(d){const x=new Date((d||today())+'T00:00:00');return isNaN(x)?new Date(today()+'T00:00:00'):x}
  function daysAgo(d){return Math.floor((new Date(today()+'T00:00:00')-asDate(d))/86400000)}
  function inWindow(row){const d=row.date||row.transactionDate||row.postingDate||row.createdDate;return daysAgo(String(d||today()).slice(0,10))<=windowDays}
  function get(r,...ks){for(const k of ks){const h=Object.keys(r||{}).find(x=>x.toLowerCase().replaceAll(' ','').replaceAll('_','')===k.toLowerCase().replaceAll(' ','').replaceAll('_',''));if(h!=null)return r[h]}return''}
  function amountOf(r){const debit=n(get(r,'debit','withdrawal')), credit=n(get(r,'credit','deposit'));if(debit)return -Math.abs(debit);if(credit)return Math.abs(credit);return n(get(r,'amount','transaction amount','net amount'))}
  function memoOf(r){return String(get(r,'memo','description','name','vendor','payee','merchant','transaction description','account name')||'')}
  function dateOf(r){return String(get(r,'date','transaction date','posting date','created date')||r.date||today()).slice(0,10)}
  function imports(src){return (((base().imports||{})[src])||[]).filter(inWindow)}
  function ledgerRows(){return (cost().transactions||[]).filter(inWindow)}
  function outflows(rows){return rows.filter(r=>n(r.amount)<0)}
  function absTotal(rows){return rows.reduce((a,r)=>a+Math.abs(n(r.amount)),0)}
  function normalizeImport(rows,source){return rows.map((r,i)=>({id:source+'-'+i,date:dateOf(r),amount:amountOf(r),memo:memoOf(r),vendor:get(r,'vendor','payee','merchant','name')||memoOf(r),source,raw:r}))}
  function data(){
    const bank=normalizeImport(imports('bank').concat(imports('cash')),'Bank/Cash');
    const sage=normalizeImport(imports('sage').concat(imports('intacct')),'Sage/Intacct');
    const ledger=ledgerRows().map((r,i)=>({id:r.id||'ledger-'+i,date:r.date,amount:n(r.amount),memo:r.memo||r.vendor||'',vendor:r.vendor||r.memo||'',source:r.source||'Cost Ledger',costType:r.costType,object:r.object,team:r.team,status:r.status,raw:r}));
    return{bank,sage,ledger};
  }
  function isClose(a,b){return Math.abs(Math.abs(n(a.amount))-Math.abs(n(b.amount)))<=1 && Math.abs((asDate(a.date)-asDate(b.date))/86400000)<=3}
  function matched(sourceRows,targetRows){const used=new Set(),matches=[];sourceRows.forEach(a=>{const idx=targetRows.findIndex((b,i)=>!used.has(i)&&isClose(a,b));if(idx>=0){used.add(idx);matches.push([a,targetRows[idx]])}});return{matches,used}}
  function duplicates(rows){const seen={},out=[];rows.forEach(r=>{const k=[r.date,Math.round(Math.abs(n(r.amount))),String(r.vendor||r.memo).slice(0,12).toLowerCase()].join('|');seen[k]=seen[k]||[];seen[k].push(r)});Object.values(seen).forEach(g=>{if(g.length>1)out.push(...g)});return out.slice(0,40)}
  function closeSummary(){
    const d=data(), bankOut=outflows(d.bank), sageOut=outflows(d.sage), ledgerOut=outflows(d.ledger);
    const bs=matched(bankOut,sageOut), bl=matched(bankOut,ledgerOut);
    const unmapped=ledgerOut.filter(x=>x.status==='Unassigned'||x.costType==='Unassigned'||x.object==='Unassigned');
    const bankNotSage=bankOut.filter(a=>!bs.matches.find(m=>m[0]===a));
    const bankNotLedger=bankOut.filter(a=>!bl.matches.find(m=>m[0]===a));
    const sageNotBank=sageOut.filter((_,i)=>!bs.used.has(i));
    return{d,bankOut,sageOut,ledgerOut,bankTotal:absTotal(bankOut),sageTotal:absTotal(sageOut),ledgerTotal:absTotal(ledgerOut),bankNotSage,sageNotBank,bankNotLedger,unmapped,dupes:duplicates(d.bank).concat(duplicates(d.sage)).concat(duplicates(d.ledger)).slice(0,60)};
  }
  function issueRows(s){
    const rows=[];
    if(s.bankNotSage.length)rows.push([badge('Bank→Sage','bad'),num(s.bankNotSage.length)+' bank outflows not matched to Sage/Intacct',money(absTotal(s.bankNotSage)),'Post to Sage, map vendor, or mark timing difference.']);
    if(s.sageNotBank.length)rows.push([badge('Sage→Bank','warn'),num(s.sageNotBank.length)+' Sage/Intacct outflows not matched to bank',money(absTotal(s.sageNotBank)),'Check accruals, AP entries, journal entries, or duplicate coding.']);
    if(s.bankNotLedger.length)rows.push([badge('Cost Ledger','bad'),num(s.bankNotLedger.length)+' bank outflows missing from Cost Ledger',money(absTotal(s.bankNotLedger)),'Seed/import into Cost Attribution Ledger and assign.']);
    if(s.unmapped.length)rows.push([badge('Mapping','bad'),num(s.unmapped.length)+' ledger rows unassigned',money(absTotal(s.unmapped)),'Assign cost type, object, team, and notes.']);
    if(s.dupes.length)rows.push([badge('Duplicates','warn'),num(s.dupes.length)+' possible duplicate rows',money(absTotal(s.dupes)),'Review duplicates before trusting totals.']);
    if(!rows.length)rows.push([badge('Clean','good'),'No major reconciliation issue detected',money(0),'Keep checking after every import.']);
    return rows;
  }
  function basicRows(rows){return rows.slice(0,30).map(r=>[esc(r.date),esc(r.source),esc(r.vendor||''),esc(r.memo||''),money(r.amount)])}
  function costBucketTieOut(s){const by={};s.ledgerOut.forEach(r=>{const k=r.costType||'Unassigned';by[k]=by[k]||0;by[k]+=Math.abs(n(r.amount))});return Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[esc(k),money(v),pct(s.ledgerTotal?v/s.ledgerTotal*100:0)])}
  function closeChecklist(s){return[
    ['Bank imported',s.bankOut.length?badge('Done','good'):badge('Missing','bad'),num(s.bankOut.length)+' outflow rows'],
    ['Sage/Intacct imported',s.sageOut.length?badge('Done','good'):badge('Missing','warn'),num(s.sageOut.length)+' outflow rows'],
    ['Cost ledger populated',s.ledgerOut.length?badge('Done','good'):badge('Missing','bad'),num(s.ledgerOut.length)+' outflow rows'],
    ['Bank to Sage matched',s.bankNotSage.length?badge('Open','bad'):badge('Clean','good'),num(s.bankNotSage.length)+' unmatched'],
    ['Bank to Cost Ledger matched',s.bankNotLedger.length?badge('Open','bad'):badge('Clean','good'),num(s.bankNotLedger.length)+' unmatched'],
    ['Cost rows assigned',s.unmapped.length?badge('Open','bad'):badge('Clean','good'),num(s.unmapped.length)+' unassigned'],
    ['Duplicate review',s.dupes.length?badge('Open','warn'):badge('Clean','good'),num(s.dupes.length)+' possible duplicates']
  ]}
  function exportCSV(){const s=closeSummary(),headers=['type','date','source','vendor','memo','amount'],rows=[];s.bankNotSage.forEach(r=>rows.push(['Bank not Sage',r.date,r.source,r.vendor,r.memo,r.amount]));s.sageNotBank.forEach(r=>rows.push(['Sage not Bank',r.date,r.source,r.vendor,r.memo,r.amount]));s.bankNotLedger.forEach(r=>rows.push(['Bank not Cost Ledger',r.date,r.source,r.vendor,r.memo,r.amount]));s.unmapped.forEach(r=>rows.push(['Unmapped Cost Ledger',r.date,r.source,r.vendor,r.memo,r.amount]));s.dupes.forEach(r=>rows.push(['Possible Duplicate',r.date,r.source,r.vendor,r.memo,r.amount]));const csv=headers.join(',')+'\n'+rows.map(r=>r.map(csvCell).join(',')).join('\n');download('onpoint_reconciliation_exceptions_'+today()+'.csv',csv,'text/csv')}
  function score(s){let sc=100;if(s.bankNotSage.length)sc-=20;if(s.bankNotLedger.length)sc-=25;if(s.unmapped.length)sc-=25;if(s.sageNotBank.length)sc-=10;if(s.dupes.length)sc-=10;return Math.max(0,sc)}
  function render(){ensureViews();ensureTabs();const el=$('view-reconcile');if(!el)return;const s=closeSummary(), sc=score(s);el.innerHTML=`
    <div class="feature-hero"><h2>Reconciliation + Close Control</h2><p>Checks whether bank, Sage/Intacct, Cost Ledger, and operating cost buckets agree before you trust the numbers.</p></div>
    <div class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>Window</label>${select('recon_window',['7','14','30','60','90'],String(windowDays))}</div><button class="btn primary" onclick="ReconcileLayer.applyWindow()">Apply</button><button class="btn" onclick="ReconcileLayer.exportCSV()">Export Exceptions</button></div>
    <div class="kpi-band">${metric('Close Readiness',sc+'/100','higher is better',sc>=90?'good':sc>=70?'warn':'bad')}${metric('Bank Outflows',money(s.bankTotal),num(s.bankOut.length)+' rows')}${metric('Sage Outflows',money(s.sageTotal),num(s.sageOut.length)+' rows')}${metric('Cost Ledger Outflows',money(s.ledgerTotal),num(s.ledgerOut.length)+' rows')}${metric('Unmapped Ledger',money(absTotal(s.unmapped)),num(s.unmapped.length)+' rows',s.unmapped.length?'bad':'good')}</div>
    <h2>Close Checklist</h2>${table(['Step','Status','Detail'],closeChecklist(s))}
    <h2>Reconciliation Issues</h2>${table(['Area','Issue','Amount','Fix'],issueRows(s))}
    <div class="feature-grid two"><div><h2>Bank Not In Sage/Intacct</h2>${table(['Date','Source','Vendor','Memo','Amount'],basicRows(s.bankNotSage))}</div><div><h2>Sage/Intacct Not In Bank</h2>${table(['Date','Source','Vendor','Memo','Amount'],basicRows(s.sageNotBank))}</div></div>
    <div class="feature-grid two"><div><h2>Bank Not In Cost Ledger</h2>${table(['Date','Source','Vendor','Memo','Amount'],basicRows(s.bankNotLedger))}</div><div><h2>Unmapped Cost Ledger</h2>${table(['Date','Source','Vendor','Memo','Amount'],basicRows(s.unmapped))}</div></div>
    <h2>Possible Duplicates</h2>${table(['Date','Source','Vendor','Memo','Amount'],basicRows(s.dupes))}
    <h2>Cost Ledger Tie-Out by Cost Type</h2>${table(['Cost Type','Amount','% of Ledger Outflow'],costBucketTieOut(s))}
  `}
  window.ReconcileLayer={render,show,applyWindow(){windowDays=Number($('recon_window')?.value||30);render()},exportCSV};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
