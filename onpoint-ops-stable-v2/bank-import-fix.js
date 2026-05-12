/* Stable v2 Bank Import Fix: robust CSV/JSON parsing, bank sign handling, and clearer preview. */
(function(){
  'use strict';
  const KEY='onpoint.ops.stable.v2';
  let previewRows=[];
  let previewNormalized=[];
  const today=()=>new Date().toISOString().slice(0,10);
  const n=x=>{
    if(x===null||x===undefined)return 0;
    let s=String(x).trim();
    if(!s)return 0;
    let neg=/^\(.*\)$/.test(s);
    s=s.replace(/[,$]/g,'').replace(/[()]/g,'').replace(/\s+/g,'');
    let v=Number(s);
    if(!isFinite(v))return 0;
    return neg?-Math.abs(v):v;
  };
  const money=x=>(n(x)<0?'-$':'$')+Math.abs(Math.round(n(x))).toLocaleString();
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=x=>Math.round(n(x)).toLocaleString();
  function getState(){try{return JSON.parse(localStorage.getItem(KEY))||seed()}catch(e){return seed()}}
  function setState(s){localStorage.setItem(KEY,JSON.stringify(s)); if(window.render) window.render();}
  function seed(){return{daily:{},imports:{pioneer:[],bank:[],sage:[],intacct:[],cash:[]},costs:[],people:[],actions:[],rules:[],targets:{gpRx:40,costRx:10,fillRate:90,cashFloor:0,minCostCoverage:90}}}
  function toast(m){try{alert(m)}catch(e){}}
  function getField(row,names){
    const keys=Object.keys(row||{});
    const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    for(const wanted of names){
      const wk=norm(wanted);
      const k=keys.find(x=>norm(x)===wk) || keys.find(x=>norm(x).includes(wk) || wk.includes(norm(x)));
      if(k!==undefined && row[k]!==undefined && row[k]!==null && String(row[k]).trim()!=='') return row[k];
    }
    return '';
  }
  function detectDelimiter(line){
    const c=[',','\t',';','|'];
    return c.map(d=>[d,(line.match(new RegExp(d==='\t'?'\\t':'\\'+d,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0]||',';
  }
  function parseDelimited(text){
    text=String(text||'').replace(/^\uFEFF/,'');
    const first=(text.split(/\r?\n/).find(x=>x.trim())||'');
    const delim=detectDelimiter(first);
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],nx=text[i+1];
      if(ch==='"'&&q&&nx==='"'){cell+='"';i++;}
      else if(ch==='"'){q=!q;}
      else if(ch===delim&&!q){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
    const headers=(rows.shift()||[]).map(x=>String(x||'').trim());
    return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  }
  function normalizeJSON(x){
    if(Array.isArray(x))return x;
    if(x.rows&&Array.isArray(x.rows))return x.rows;
    if(x.data&&Array.isArray(x.data))return x.data;
    if(x.transactions&&Array.isArray(x.transactions))return x.transactions;
    if(x.items&&Array.isArray(x.items))return x.items;
    return [x];
  }
  function bankAmount(row,mode){
    const debit=n(getField(row,['debit','debits','withdrawal','withdrawals','paid out','paidout','money out','moneyout','charge','charges','payment','payments']));
    const credit=n(getField(row,['credit','credits','deposit','deposits','paid in','paidin','money in','moneyin']));
    const amountRaw=getField(row,['amount','transaction amount','transactionamount','net amount','netamount','value','transaction value','transactionvalue']);
    let amount=n(amountRaw);
    const type=String(getField(row,['type','transaction type','transactiontype','debit credit','debitcredit','drcr','dr cr','details'])||'').toLowerCase();
    if(debit) return -Math.abs(debit);
    if(credit) return Math.abs(credit);
    if(mode==='Expenses are positive') return amount>0?-Math.abs(amount):amount;
    if(mode==='Expenses are negative') return amount;
    if(type.includes('debit')||type.includes('withdraw')||type.includes('purchase')||type.includes('payment')||type==='dr') return -Math.abs(amount);
    if(type.includes('credit')||type.includes('deposit')||type==='cr') return Math.abs(amount);
    return amount;
  }
  function bankDate(row){return String(getField(row,['date','transaction date','transactiondate','posting date','postingdate','posted date','posteddate','effective date','effectivedate'])||today()).slice(0,10)}
  function bankMemo(row){return String(getField(row,['memo','description','details','transaction details','transactiondetails','name','payee','merchant','vendor','narrative'])||'')}
  function bankVendor(row){return String(getField(row,['vendor','payee','merchant','name','description','details'])||bankMemo(row)||'Unknown')}
  function applyRules(row,rules){
    if(row.amount>=0)return row;
    const text=[row.vendor,row.memo,row.account].join(' ').toLowerCase();
    const rule=(rules||[]).find(r=>r.contains&&text.includes(String(r.contains).toLowerCase()));
    if(rule){row.costType=rule.costType;row.objectType=rule.objectType||'Rule';row.object=rule.object;row.team=rule.team;row.status='Auto-Mapped'}
    return row;
  }
  function normalizedCost(row,source,mode){
    const amount=bankAmount(row,mode);
    const memo=bankMemo(row);
    return applyRules({
      id:'c'+Date.now()+Math.random().toString(16).slice(2),
      date:bankDate(row),
      source,
      vendor:bankVendor(row),
      memo,
      account:String(getField(row,['account','account name','accountname','category','gl account','glaccount'])||''),
      amount,
      costType:String(getField(row,['cost type','costType'])||'Unassigned'),
      objectType:String(getField(row,['object type','objectType'])||'Unassigned'),
      object:String(getField(row,['object','location','store','channel'])||'Unassigned'),
      team:String(getField(row,['team','department'])||'Unassigned'),
      status:amount<0?'Unassigned':'Inflow'
    }, getState().rules);
  }
  function table(headers,rows){return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="muted">No rows yet.</td></tr>`}</tbody></table></div>`}
  function isBankish(type){return ['bank','cash','sage','intacct','costs'].includes(type)}
  const oldImporter=window.importer;
  window.importer=function(){
    const html=`<div class="card"><h2>Reliable Import</h2><p class="muted">CSV, TSV, pipe-delimited, or JSON. Bank import now shows the parsed amount/sign before saving.</p><div class="form"><div><label>Import Type</label><select id="importType"><option>pioneer</option><option selected>bank</option><option>sage</option><option>intacct</option><option>cash</option><option>costs</option><option>people</option><option>actions</option></select></div><div><label>Bank Amount Convention</label><select id="amountMode"><option>Auto</option><option>Expenses are positive</option><option>Expenses are negative</option></select></div><div><label>File CSV / TSV / JSON</label><input id="importFile" type="file" accept=".csv,.json,.txt,.tsv"></div><div><button class="btn primary" onclick="previewImport()">Preview</button></div><div><button class="btn" onclick="downloadTemplate()">Download Template</button></div></div></div><div id="preview"></div>`;
    document.getElementById('appRoot').innerHTML=html;
  };
  window.previewImport=async function(){
    const file=document.getElementById('importFile')?.files?.[0];
    if(!file)return toast('Choose a file first.');
    const type=document.getElementById('importType')?.value||'bank';
    const mode=document.getElementById('amountMode')?.value||'Auto';
    try{
      const text=await file.text();
      previewRows=file.name.toLowerCase().endsWith('.json')?normalizeJSON(JSON.parse(text)):parseDelimited(text);
      previewRows=previewRows.filter(r=>r&&Object.keys(r).length);
      previewNormalized=isBankish(type)?previewRows.map(r=>normalizedCost(r,type,mode)):previewRows;
      const rawKeys=[...new Set(previewRows.slice(0,10).flatMap(r=>Object.keys(r)))].slice(0,8);
      const rawTable=table(rawKeys,previewRows.slice(0,10).map(r=>rawKeys.map(k=>esc(r[k]))));
      let normalized='';
      if(isBankish(type)){
        normalized=`<h2>How the app will save it</h2>${table(['Date','Vendor','Memo','Amount','Direction','Cost Type','Object','Team','Status'],previewNormalized.slice(0,25).map(r=>[esc(r.date),esc(r.vendor),esc(r.memo),money(r.amount),r.amount<0?'Outflow':'Inflow',esc(r.costType),esc(r.object),esc(r.team),esc(r.status)]))}`;
      }
      document.getElementById('preview').innerHTML=`<div class="card"><h2>Raw Preview: ${esc(file.name)}</h2><p class="muted">Parsed ${num(previewRows.length)} rows. If bank expenses are showing as inflows, change Bank Amount Convention to “Expenses are positive” and preview again.</p>${rawTable}${normalized}<br><button class="btn primary" onclick="saveImport()">Save Import</button></div>`;
    }catch(e){console.error(e);toast('Could not parse file. Export as CSV, TSV, or JSON and try again.');}
  };
  window.saveImport=function(){
    if(!previewRows.length)return toast('Preview a file first.');
    const type=document.getElementById('importType')?.value||'bank';
    const s=getState();
    s.imports=s.imports||{pioneer:[],bank:[],sage:[],intacct:[],cash:[]};
    s.costs=s.costs||[];
    s.people=s.people||[];
    s.actions=s.actions||[];
    if(isBankish(type)){
      if(type!=='costs'){s.imports[type]=s.imports[type]||[];s.imports[type].push(...previewRows)}
      s.costs.push(...previewNormalized);
      setState(s);
      previewRows=[];previewNormalized=[];
      if(window.show)window.show('costs');
      toast('Saved bank/cost import to Cost Ledger.');
      return;
    }
    if(type==='people'){
      previewRows.forEach(r=>s.people.push({name:getField(r,['name','employee','full name']),role:getField(r,['role','title']),team:getField(r,['team','department'])}));
    }else if(type==='actions'){
      previewRows.forEach(r=>s.actions.push({title:getField(r,['title','action','task'])||bankMemo(r)||'Imported action',owner:getField(r,['owner'])||'Unassigned',priority:getField(r,['priority'])||'Medium',status:getField(r,['status'])||'Open'}));
    }else{
      s.imports[type]=s.imports[type]||[];s.imports[type].push(...previewRows);
    }
    setState(s);previewRows=[];previewNormalized=[];if(window.show)window.show('importer');toast('Saved import.');
  };
  window.downloadTemplate=function(){
    const type=document.getElementById('importType')?.value||'bank';
    const headers=isBankish(type)?['Date','Description','Debit','Credit','Amount','Account']:type==='people'?['Name','Role','Team']:type==='actions'?['Title','Owner','Priority','Status']:['Date','RxNumber','PatientId','Doctor','Revenue','COGS','GrossProfit'];
    const blob=new Blob([headers.join(',')+'\n'],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=type+'-template.csv';a.click();
  };
})();
