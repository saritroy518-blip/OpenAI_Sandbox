/* OnPoint Import Fix Layer: stable universal importer for CSV/JSON files. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const COST_KEY='opdash.costledger.v1';
  const SCRIPT_KEY='opdash.scriptqueue.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const n=x=>Number(String(x??'').replace(/[$,]/g,'').replace(/[()]/g,m=>m==='('?'-':''))||0;
  const today=()=>new Date().toISOString().slice(0,10);
  let parsed=[];
  let source='pioneer';

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option value="${esc(o[0])}" ${o[0]===val?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No preview yet</b>Choose a file and click Preview Import.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}

  function ensureViews(){
    const main=document.querySelector('.main');
    if(!main)return;
    if(!$('view-importfix')){const s=document.createElement('section');s.id='view-importfix';s.className='view';main.appendChild(s)}
  }
  function ensureTabs(){
    const nav=$('nav');
    if(!nav)return;
    if(!nav.querySelector('[data-v="importfix"],[data-view="importfix"]')){
      const b=document.createElement('button');b.dataset.v='importfix';b.textContent='Reliable Import';b.onclick=()=>show('importfix');nav.appendChild(b);
    }
  }
  function show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('view-'+id)?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));
    const title=$('pageTitle');if(title)title.textContent='Reliable Import';
    render();window.scrollTo({top:0,behavior:'smooth'});
  }

  function parseCSV(text){
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],nx=text[i+1];
      if(ch==='"'&&q&&nx==='"'){cell+='"';i++;}
      else if(ch==='"'){q=!q;}
      else if(ch===','&&!q){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
    const headers=(rows.shift()||[]).map(x=>String(x||'').trim());
    return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }
  function normalizeJSON(raw){
    if(Array.isArray(raw))return raw;
    if(raw.rows&&Array.isArray(raw.rows))return raw.rows;
    if(raw.data&&Array.isArray(raw.data))return raw.data;
    if(raw.transactions&&Array.isArray(raw.transactions))return raw.transactions;
    if(raw.actions&&Array.isArray(raw.actions))return raw.actions;
    if(raw.employees&&Array.isArray(raw.employees))return raw.employees;
    return [raw];
  }
  function get(r,...ks){for(const k of ks){const h=Object.keys(r||{}).find(x=>x.toLowerCase().replaceAll(' ','').replaceAll('_','')===k.toLowerCase().replaceAll(' ','').replaceAll('_',''));if(h!=null)return r[h]}return''}
  function amountOf(r){const debit=n(get(r,'debit','withdrawal')), credit=n(get(r,'credit','deposit'));if(debit)return -Math.abs(debit);if(credit)return Math.abs(credit);return n(get(r,'amount','transaction amount','net amount'))}
  function memoOf(r){return String(get(r,'memo','description','name','vendor','payee','merchant','transaction description','account name')||'')}
  function dateOf(r){return String(get(r,'date','transaction date','posting date','created date')||today()).slice(0,10)}

  async function preview(){
    const file=$('stable_import_file')?.files?.[0];
    if(!file)return toast('Choose a file first.');
    source=$('stable_import_source')?.value||'pioneer';
    try{
      const text=await file.text();
      if(file.name.toLowerCase().endsWith('.json')) parsed=normalizeJSON(JSON.parse(text));
      else parsed=parseCSV(text);
      if(!Array.isArray(parsed))parsed=[];
      parsed=parsed.filter(r=>r&&Object.keys(r).length);
      renderPreview(file.name);
      toast('Parsed '+parsed.length+' rows');
    }catch(e){
      console.error(e);
      parsed=[];
      renderPreview(file.name);
      toast('Could not parse file. Try CSV or JSON export.');
    }
  }
  function renderPreview(name){
    const box=$('stable_import_preview');if(!box)return;
    const keys=[...new Set(parsed.slice(0,10).flatMap(r=>Object.keys(r||{})))].slice(0,8);
    const rows=parsed.slice(0,20).map(r=>keys.map(k=>String(r[k]??'')));
    box.innerHTML=`<h2>Preview: ${esc(name||'file')}</h2><p class="muted">Rows parsed: <b>${parsed.length}</b>. Showing first 20 rows and first 8 columns.</p>${table(keys,rows)}<button class="btn primary" onclick="StableImport.commit()">Save Import</button> <button class="btn" onclick="StableImport.clear()">Clear</button>`;
  }

  function commit(){
    if(!parsed.length)return toast('Preview a file first.');
    source=$('stable_import_source')?.value||source;
    if(source==='employees')saveEmployees();
    else if(source==='actions')saveActions();
    else if(source==='costledger')saveCostLedger();
    else if(source==='scripts')saveScripts();
    else saveBaseImport(source);
    toast('Saved '+parsed.length+' rows to '+source);
    clear();
  }
  function saveBaseImport(key){
    const b=read(BASE_KEY,{manual:{},targets:{},imports:{}});b.imports=b.imports||{};b.imports[key]=b.imports[key]||[];b.imports[key]=b.imports[key].concat(parsed.map(r=>({...r,_importedAt:new Date().toISOString(),_source:key})));write(BASE_KEY,b);
  }
  function saveEmployees(){
    const s=read(OPS_KEY,{employees:[],actions:[],budgets:[],pipeline:[],settings:{}});s.employees=s.employees||[];
    const existing=new Set(s.employees.map(e=>String(e.email||e.name||'').toLowerCase()));
    parsed.forEach(r=>{const name=get(r,'name','employee','full name')||memoOf(r);const email=get(r,'email','email address');const key=String(email||name).toLowerCase();if(!key||existing.has(key))return;existing.add(key);s.employees.push({name,email,role:get(r,'role','title')||'Pharmacy Ops',team:get(r,'team','department')||'Pharmacy Ops',tags:get(r,'tags')||'',active:get(r,'active')||'Yes',created:new Date().toISOString()})});
    write(OPS_KEY,s);
  }
  function saveActions(){
    const s=read(OPS_KEY,{employees:[],actions:[],budgets:[],pipeline:[],settings:{}});s.actions=s.actions||[];
    parsed.forEach(r=>s.actions.push({title:get(r,'title','action','task')||memoOf(r)||'Imported action',owner:get(r,'owner')||'Unassigned',team:get(r,'team')||'Pharmacy Ops',metric:get(r,'metric')||'',priority:get(r,'priority')||'Medium',due:get(r,'due','due date')||today(),status:get(r,'status')||'Open',tags:get(r,'tags')||'',notes:get(r,'notes','description')||'',created:new Date().toISOString(),source:'Reliable Import'}));
    write(OPS_KEY,s);
  }
  function saveScripts(){
    const s=read(SCRIPT_KEY,{scripts:[],lift:[],filters:{}});s.scripts=s.scripts||[];
    parsed.forEach(r=>s.scripts.push({scriptId:get(r,'scriptId','rx','rx number','prescription')||('RX-'+Date.now()+'-'+Math.random().toString(16).slice(2,6)),status:get(r,'status')||'Received',blocker:get(r,'blocker','reason')||'None',owner:get(r,'owner')||'Unassigned',expectedGp:n(get(r,'expectedGp','gp','gross profit')),doctor:get(r,'doctor','prescriber','provider')||'',location:get(r,'location','store')||'',nextAction:get(r,'nextAction','next action')||'',created:new Date().toISOString(),source:'Reliable Import'}));
    write(SCRIPT_KEY,s);
  }
  function saveCostLedger(){
    const s=read(COST_KEY,{transactions:[],rules:[]});s.transactions=s.transactions||[];
    parsed.forEach(r=>{
      const amount=amountOf(r), memo=memoOf(r), vendor=get(r,'vendor','payee','merchant','name')||memo;
      s.transactions.push({id:'TX-'+Date.now()+'-'+Math.random().toString(16).slice(2),source:'Reliable Import',date:dateOf(r),vendor,memo,account:get(r,'account','gl account','category')||'',amount,direction:amount<0?'Outflow':'Inflow',costType:get(r,'costType','cost type')||'Unassigned',objectType:get(r,'objectType','object type')||'Unassigned',object:get(r,'object')||'Unassigned',team:get(r,'team')||'Unassigned',location:get(r,'location')||'',channel:get(r,'channel')||'',doctor:get(r,'doctor')||'',enterpriseAccount:get(r,'enterpriseAccount','enterprise account')||'',notes:get(r,'notes')||'',status:amount<0?'Unassigned':'Inflow',created:new Date().toISOString()});
    });
    write(COST_KEY,s);
  }
  function clear(){parsed=[];const p=$('stable_import_preview');if(p)p.innerHTML='';const f=$('stable_import_file');if(f)f.value=''}

  function render(){
    ensureViews();ensureTabs();const el=$('view-importfix');if(!el)return;
    const opts=[['pioneer','PioneerRx'],['bank','Bank'],['sage','Sage'],['intacct','Intacct'],['cash','Cash'],['powerbi','Power BI JSON'],['employees','Employees'],['actions','Actions'],['scripts','Script Queue'],['costledger','Cost Ledger']];
    el.innerHTML=`
      <div class="feature-hero"><h2>Reliable Import</h2><p>Stable import path for CSV and JSON files. Preview first, then save to the right dataset.</p></div>
      <div class="card feature-grid form-table">
        <div><label>Import Type</label>${select('stable_import_source',opts,source)}</div>
        <div><label>File</label><input id="stable_import_file" type="file" accept=".csv,.json,.txt"></div>
        <div style="align-self:end"><button class="btn primary" onclick="StableImport.preview()">Preview Import</button></div>
      </div>
      <div id="stable_import_preview"></div>
      <div class="card"><h2>What this fixes</h2><p class="muted">This importer does not depend on the older page-specific import controls. It reads the file directly in the browser, previews rows, and writes them to local storage.</p></div>
    `;
  }

  window.StableImport={render,show,preview,commit,clear};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1500));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
