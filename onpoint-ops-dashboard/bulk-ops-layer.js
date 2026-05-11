/* Bulk Ops Layer: stable bulk editing for scripts and actions. */
(function(){
  'use strict';
  const SCRIPT_KEY='opdash.scriptqueue.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const today=()=>new Date().toISOString().slice(0,10);
  const STATUSES=['Received','Insurance Verification','PA Needed','PA Submitted','Patient Contact','Doctor Clarification','Lift Review','Ready To Fill','Ready For Delivery','Delivered / Picked Up','Abandoned','Reversed'];
  const BLOCKERS=['None','PA','Payer Rejection','Patient Unreachable','Copay / Financial Assistance','Inventory','Doctor Clarification','Insurance Verification','Delivery','Lift Review','Other'];
  const ACTION_STATUSES=['Open','In Progress','Blocked','Done'];
  const PRIORITIES=['Critical','High','Medium','Low'];
  const TEAMS=['Executive','Sales','Enterprise','Pharmacy Ops','Technology','Finance'];
  let mode='scripts';
  let selectedScripts=new Set();
  let selectedActions=new Set();
  let scriptFilter='Open';
  let actionFilter='Open';

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function scriptState(){return read(SCRIPT_KEY,{scripts:[],lift:[],filters:{}})}
  function saveScriptState(s){write(SCRIPT_KEY,s)}
  function opsState(){return read(OPS_KEY,{employees:[],actions:[],budgets:[],pipeline:[],settings:{}})}
  function saveOpsState(s){write(OPS_KEY,s)}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function owners(){const people=(opsState().employees||[]).filter(e=>e.active!=='No').map(e=>e.name).filter(Boolean);return ['No Change','Unassigned'].concat(people.length?people:['Mario','Amy','Sara','Erin'])}
  function select(id,opts,val){return `<select id="${esc(id)}">${opts.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function input(id,val,type='text'){return `<input id="${esc(id)}" type="${type}" value="${esc(val??'')}" class="left">`}
  function badge(text,type){return `<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  function ensureViews(){
    const main=document.querySelector('.main');if(!main)return;
    if(!$('view-bulkops')){const s=document.createElement('section');s.id='view-bulkops';s.className='view';main.appendChild(s)}
  }
  function ensureTabs(){
    const nav=$('nav');if(!nav)return;
    if(!nav.querySelector('[data-v="bulkops"],[data-view="bulkops"]')){const b=document.createElement('button');b.dataset.v='bulkops';b.textContent='Bulk Ops';b.onclick=()=>show('bulkops');nav.appendChild(b)}
  }
  function show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('view-'+id)?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));
    const title=$('pageTitle');if(title)title.textContent='Bulk Ops';
    render();window.scrollTo({top:0,behavior:'smooth'});
  }

  function addStyles(){
    if($('bulkOpsStyles'))return;
    const s=document.createElement('style');
    s.id='bulkOpsStyles';
    s.textContent=`
      .bulk-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.bulk-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:end}.bulk-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.bulk-table input[type="checkbox"]{width:18px;height:18px}.bulk-row-selected{background:#eff6ff!important}.bulk-sticky{position:sticky;top:0;z-index:10;background:#f8fafc;border-bottom:1px solid #e5e7eb;padding-bottom:10px}@media(max-width:900px){.bulk-grid{grid-template-columns:1fr 1fr}.bulk-actions .btn{flex:1}}@media(max-width:650px){.bulk-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function scriptRows(){
    let rows=(scriptState().scripts||[]).map((r,i)=>({...r,__idx:i}));
    if(scriptFilter==='Open') rows=rows.filter(r=>!['Delivered / Picked Up','Abandoned','Reversed'].includes(r.status));
    else if(scriptFilter==='Stuck') rows=rows.filter(r=>r.blocker&&r.blocker!=='None');
    else if(scriptFilter==='PA') rows=rows.filter(r=>r.blocker==='PA'||r.status==='PA Needed'||r.status==='PA Submitted');
    else if(scriptFilter==='Abandoned') rows=rows.filter(r=>r.status==='Abandoned');
    else if(scriptFilter==='All') rows=rows;
    return rows;
  }
  function actionRows(){
    let rows=(opsState().actions||[]).map((r,i)=>({...r,__idx:i}));
    if(actionFilter==='Open') rows=rows.filter(r=>r.status!=='Done');
    else if(actionFilter==='Overdue') rows=rows.filter(r=>r.status!=='Done'&&(r.due||'')<today());
    else if(actionFilter==='Blocked') rows=rows.filter(r=>r.status==='Blocked');
    else if(actionFilter==='High') rows=rows.filter(r=>['Critical','High'].includes(r.priority));
    return rows;
  }

  function render(){
    ensureViews();ensureTabs();addStyles();
    const el=$('view-bulkops');if(!el)return;
    const scripts=scriptRows();const actions=actionRows();
    const selectedCount=mode==='scripts'?selectedScripts.size:selectedActions.size;
    el.innerHTML=`
      <div class="feature-hero"><h2>Bulk Ops</h2><p>Bulk assign, update, close, export, or clean up scripts and actions. This is where the dashboard starts acting like workflow software.</p></div>
      <div class="bulk-sticky">
        <div class="bulk-tabs"><button class="btn ${mode==='scripts'?'primary':''}" onclick="BulkOps.setMode('scripts')">Scripts</button><button class="btn ${mode==='actions'?'primary':''}" onclick="BulkOps.setMode('actions')">Actions</button><span class="badge blue">Selected: ${selectedCount}</span></div>
        ${mode==='scripts'?scriptToolbar():actionToolbar()}
      </div>
      ${mode==='scripts'?renderScriptsTable(scripts):renderActionsTable(actions)}
    `;
  }

  function scriptToolbar(){
    return `<div class="card"><div class="bulk-grid"><div><label>View</label>${select('bulk_script_filter',['Open','Stuck','PA','Abandoned','All'],scriptFilter)}</div><div><label>Set Owner</label>${select('bulk_script_owner',owners(),'No Change')}</div><div><label>Set Status</label>${select('bulk_script_status',['No Change'].concat(STATUSES),'No Change')}</div><div><label>Set Blocker</label>${select('bulk_script_blocker',['No Change'].concat(BLOCKERS),'No Change')}</div><div><label>Next Action</label>${input('bulk_script_next','','text')}</div></div><div class="bulk-actions"><button class="btn" onclick="BulkOps.applyScriptFilter()">Apply View</button><button class="btn blue" onclick="BulkOps.selectVisibleScripts()">Select Visible</button><button class="btn" onclick="BulkOps.clearScriptSelection()">Clear</button><button class="btn primary" onclick="BulkOps.bulkUpdateScripts()">Bulk Update Scripts</button><button class="btn" onclick="BulkOps.createActionsFromSelectedScripts()">Create Actions</button><button class="btn" onclick="BulkOps.exportSelectedScripts()">Export Selected</button><button class="btn red" onclick="BulkOps.bulkDeleteScripts()">Delete Selected</button></div></div>`;
  }
  function actionToolbar(){
    return `<div class="card"><div class="bulk-grid"><div><label>View</label>${select('bulk_action_filter',['Open','Overdue','Blocked','High','All'],actionFilter)}</div><div><label>Set Owner</label>${select('bulk_action_owner',owners(),'No Change')}</div><div><label>Set Team</label>${select('bulk_action_team',['No Change'].concat(TEAMS),'No Change')}</div><div><label>Set Priority</label>${select('bulk_action_priority',['No Change'].concat(PRIORITIES),'No Change')}</div><div><label>Set Status</label>${select('bulk_action_status',['No Change'].concat(ACTION_STATUSES),'No Change')}</div><div><label>Due Date</label>${input('bulk_action_due','','date')}</div></div><div class="bulk-actions"><button class="btn" onclick="BulkOps.applyActionFilter()">Apply View</button><button class="btn blue" onclick="BulkOps.selectVisibleActions()">Select Visible</button><button class="btn" onclick="BulkOps.clearActionSelection()">Clear</button><button class="btn primary" onclick="BulkOps.bulkUpdateActions()">Bulk Update Actions</button><button class="btn" onclick="BulkOps.markSelectedDone()">Mark Done</button><button class="btn" onclick="BulkOps.exportSelectedActions()">Export Selected</button><button class="btn red" onclick="BulkOps.bulkDeleteActions()">Delete Selected</button></div></div>`;
  }

  function renderScriptsTable(rows){
    if(!rows.length)return `<div class="empty-state"><b>No scripts in this view</b>Change the filter or add scripts in Script Queue.</div>`;
    return `<div class="table-wrap bulk-table"><table><thead><tr><th><input type="checkbox" onchange="BulkOps.toggleAllVisibleScripts(this.checked)"></th><th>Script</th><th>Status</th><th>Blocker</th><th>Owner</th><th>Expected GP</th><th>Doctor</th><th>Location</th><th>Next Action</th></tr></thead><tbody>${rows.map(r=>`<tr class="${selectedScripts.has(r.__idx)?'bulk-row-selected':''}"><td><input type="checkbox" ${selectedScripts.has(r.__idx)?'checked':''} onchange="BulkOps.toggleScript(${r.__idx},this.checked)"></td><td>${esc(r.scriptId)}</td><td>${badge(r.status||'Received','blue')}</td><td>${badge(r.blocker||'None',r.blocker&&r.blocker!=='None'?'warn':'good')}</td><td>${esc(r.owner||'Unassigned')}</td><td>${money(r.expectedGp)}</td><td>${esc(r.doctor||'')}</td><td>${esc(r.location||'')}</td><td>${esc(r.nextAction||'')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderActionsTable(rows){
    if(!rows.length)return `<div class="empty-state"><b>No actions in this view</b>Change the filter or add actions.</div>`;
    return `<div class="table-wrap bulk-table"><table><thead><tr><th><input type="checkbox" onchange="BulkOps.toggleAllVisibleActions(this.checked)"></th><th>Title</th><th>Owner</th><th>Team</th><th>Priority</th><th>Due</th><th>Status</th><th>Metric</th></tr></thead><tbody>${rows.map(r=>`<tr class="${selectedActions.has(r.__idx)?'bulk-row-selected':''}"><td><input type="checkbox" ${selectedActions.has(r.__idx)?'checked':''} onchange="BulkOps.toggleAction(${r.__idx},this.checked)"></td><td>${esc(r.title||'')}</td><td>${esc(r.owner||'Unassigned')}</td><td>${esc(r.team||'')}</td><td>${badge(r.priority||'Medium',r.priority==='Critical'||r.priority==='High'?'bad':r.priority==='Medium'?'warn':'blue')}</td><td>${esc(r.due||'')}</td><td>${badge(r.status||'Open',r.status==='Done'?'good':r.status==='Blocked'?'bad':'blue')}</td><td>${esc(r.metric||'')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function selectedScriptIndexes(){return Array.from(selectedScripts).filter(i=>(scriptState().scripts||[])[i])}
  function selectedActionIndexes(){return Array.from(selectedActions).filter(i=>(opsState().actions||[])[i])}

  window.BulkOps={
    render,show,
    setMode(m){mode=m;render()},
    applyScriptFilter(){scriptFilter=$('bulk_script_filter')?.value||'Open';render()},
    applyActionFilter(){actionFilter=$('bulk_action_filter')?.value||'Open';render()},
    toggleScript(i,checked){checked?selectedScripts.add(i):selectedScripts.delete(i);render()},
    toggleAction(i,checked){checked?selectedActions.add(i):selectedActions.delete(i);render()},
    selectVisibleScripts(){scriptRows().forEach(r=>selectedScripts.add(r.__idx));render()},
    selectVisibleActions(){actionRows().forEach(r=>selectedActions.add(r.__idx));render()},
    clearScriptSelection(){selectedScripts.clear();render()},
    clearActionSelection(){selectedActions.clear();render()},
    toggleAllVisibleScripts(checked){scriptRows().forEach(r=>checked?selectedScripts.add(r.__idx):selectedScripts.delete(r.__idx));render()},
    toggleAllVisibleActions(checked){actionRows().forEach(r=>checked?selectedActions.add(r.__idx):selectedActions.delete(r.__idx));render()},
    bulkUpdateScripts(){const idxs=selectedScriptIndexes();if(!idxs.length)return toast('Select scripts first');const s=scriptState();const owner=$('bulk_script_owner')?.value,status=$('bulk_script_status')?.value,blocker=$('bulk_script_blocker')?.value,next=$('bulk_script_next')?.value;idxs.forEach(i=>{const r=s.scripts[i];if(owner&&owner!=='No Change')r.owner=owner;if(status&&status!=='No Change')r.status=status;if(blocker&&blocker!=='No Change')r.blocker=blocker;if(next)r.nextAction=next;r.updated=new Date().toISOString()});saveScriptState(s);toast('Updated '+idxs.length+' scripts');render()},
    bulkDeleteScripts(){const idxs=selectedScriptIndexes();if(!idxs.length)return toast('Select scripts first');if(!confirm('Delete '+idxs.length+' selected scripts?'))return;const s=scriptState();s.scripts=s.scripts.filter((_,i)=>!selectedScripts.has(i));saveScriptState(s);selectedScripts.clear();toast('Deleted scripts');render()},
    createActionsFromSelectedScripts(){const idxs=selectedScriptIndexes();if(!idxs.length)return toast('Select scripts first');const ss=scriptState(),os=opsState();os.actions=os.actions||[];idxs.forEach(i=>{const r=ss.scripts[i];os.actions.push({title:'Resolve script '+(r.scriptId||''),owner:r.owner||'Unassigned',team:'Pharmacy Ops',metric:'Script Work Queue',priority:n(r.expectedGp)>=100?'High':'Medium',due:today(),status:'Open',tags:[r.location,r.doctor,r.blocker].filter(Boolean).join(', '),notes:'Bulk-created from Script Queue. Next action: '+(r.nextAction||''),created:today(),source:'Bulk Ops'})});saveOpsState(os);toast('Created '+idxs.length+' actions');},
    exportSelectedScripts(){const idxs=selectedScriptIndexes();const rows=idxs.map(i=>scriptState().scripts[i]);const csv='scriptId,status,blocker,owner,expectedGp,doctor,location,nextAction\n'+rows.map(r=>[r.scriptId,r.status,r.blocker,r.owner,r.expectedGp,r.doctor,r.location,r.nextAction].map(csvCell).join(',')).join('\n');download('onpoint_selected_scripts_'+today()+'.csv',csv,'text/csv')},
    bulkUpdateActions(){const idxs=selectedActionIndexes();if(!idxs.length)return toast('Select actions first');const s=opsState();const owner=$('bulk_action_owner')?.value,team=$('bulk_action_team')?.value,priority=$('bulk_action_priority')?.value,status=$('bulk_action_status')?.value,due=$('bulk_action_due')?.value;idxs.forEach(i=>{const a=s.actions[i];if(owner&&owner!=='No Change')a.owner=owner;if(team&&team!=='No Change')a.team=team;if(priority&&priority!=='No Change')a.priority=priority;if(status&&status!=='No Change')a.status=status;if(due)a.due=due;a.updated=new Date().toISOString()});saveOpsState(s);toast('Updated '+idxs.length+' actions');render()},
    markSelectedDone(){const idxs=selectedActionIndexes();if(!idxs.length)return toast('Select actions first');const s=opsState();idxs.forEach(i=>{s.actions[i].status='Done';s.actions[i].completed=new Date().toISOString()});saveOpsState(s);toast('Marked '+idxs.length+' actions done');render()},
    bulkDeleteActions(){const idxs=selectedActionIndexes();if(!idxs.length)return toast('Select actions first');if(!confirm('Delete '+idxs.length+' selected actions?'))return;const s=opsState();s.actions=s.actions.filter((_,i)=>!selectedActions.has(i));saveOpsState(s);selectedActions.clear();toast('Deleted actions');render()},
    exportSelectedActions(){const idxs=selectedActionIndexes();const rows=idxs.map(i=>opsState().actions[i]);const csv='title,owner,team,priority,due,status,metric,tags,notes\n'+rows.map(a=>[a.title,a.owner,a.team,a.priority,a.due,a.status,a.metric,a.tags,a.notes].map(csvCell).join(',')).join('\n');download('onpoint_selected_actions_'+today()+'.csv',csv,'text/csv')}
  };

  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
