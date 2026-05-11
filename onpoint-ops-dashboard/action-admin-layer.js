/* Action Admin Layer: edit actions, bulk import/export actions, duplicate protection. */
(function(){
  'use strict';
  const KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>new Date().toISOString().slice(0,10);
  const teams=['Executive','Sales','Enterprise','Pharmacy Ops','Technology','Finance'];
  const priorities=['Critical','High','Medium','Low'];
  const statuses=['Open','In Progress','Blocked','Done'];
  let editingIndex=null;
  let preview=[];

  function state(){try{return JSON.parse(localStorage.getItem(KEY))||{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}catch(e){return{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function owners(){const people=(state().employees||[]).filter(e=>e.active!=='No').map(e=>e.name).filter(Boolean);return ['Unassigned'].concat(people.length?people:['Mario','Amy','Sara','Erin'])}
  function input(id,val,type='text'){return`<input id="${esc(id)}" class="left" type="${type}" value="${esc(val??'')}">`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows yet</b>Upload actions to preview.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}

  function renderPanel(){
    const view=$('view-actions');
    if(!view||!view.classList.contains('active'))return;
    addEditButtons(view);
    if(!$('actionAdminPanel'))insertAdminPanel(view);
    if(editingIndex!==null&&!$('actionEditPanel'))insertEditor(editingIndex);
  }

  function addEditButtons(view){
    const tableBody=view.querySelector('table tbody');
    if(!tableBody)return;
    Array.from(tableBody.querySelectorAll('tr')).forEach((tr,i)=>{
      const last=tr.lastElementChild;
      if(last&&!last.querySelector('.act-edit-btn')){
        const btn=document.createElement('button');
        btn.className='btn blue act-edit-btn';
        btn.textContent='Edit';
        btn.onclick=()=>openEditor(i);
        last.prepend(document.createTextNode(' '));
        last.prepend(btn);
      }
    });
  }

  function insertAdminPanel(view){
    const addHeader=Array.from(view.querySelectorAll('h2')).find(h=>h.textContent.includes('Add Action'));
    const panel=document.createElement('div');
    panel.id='actionAdminPanel';
    panel.className='card';
    panel.style.margin='16px 0';
    panel.innerHTML=`<h2 style="margin-top:0">Bulk Action Tools</h2><p class="muted">Import or export action items. Useful for weekly meetings, assigning work, and cleaning up follow-through.</p><div class="feature-grid form-table"><div><label>Action File</label><input id="act_import_file" type="file" accept=".csv,.json"></div><div style="align-self:end"><button class="btn blue" onclick="ActionAdminLayer.previewImport()">Preview Actions</button> <button class="btn" onclick="ActionAdminLayer.downloadTemplate()">Download Template</button> <button class="btn" onclick="ActionAdminLayer.exportActions('open')">Export Open</button> <button class="btn" onclick="ActionAdminLayer.exportActions('all')">Export All</button></div></div><div id="act_import_preview"></div>`;
    if(addHeader)view.insertBefore(panel,addHeader);else view.appendChild(panel);
  }

  function openEditor(i){editingIndex=i;$('actionEditPanel')?.remove();insertEditor(i);$('actionEditPanel')?.scrollIntoView({behavior:'smooth',block:'center'})}
  function insertEditor(i){
    const view=$('view-actions');if(!view)return;
    const s=state();const a=(s.actions||[])[i];if(!a)return;
    const anchor=$('actionAdminPanel')||view.querySelector('.card');
    const div=document.createElement('div');
    div.id='actionEditPanel';
    div.className='card';
    div.style.margin='16px 0';
    div.innerHTML=`<h2 style="margin-top:0">Edit Action</h2><div class="feature-grid form-table"><div><label>Title</label>${input('edit_act_title',a.title||'')}</div><div><label>Owner</label>${select('edit_act_owner',owners(),a.owner||'Unassigned')}</div><div><label>Team</label>${select('edit_act_team',teams,a.team||'Pharmacy Ops')}</div><div><label>Metric</label>${input('edit_act_metric',a.metric||'')}</div><div><label>Priority</label>${select('edit_act_priority',priorities,a.priority||'Medium')}</div><div><label>Due</label>${input('edit_act_due',a.due||today(),'date')}</div><div><label>Status</label>${select('edit_act_status',statuses,a.status||'Open')}</div><div><label>Tags</label>${input('edit_act_tags',a.tags||'')}</div><div style="grid-column:1/-1"><label>Notes</label><textarea id="edit_act_notes" class="left">${esc(a.notes||'')}</textarea></div></div><button class="btn primary" onclick="ActionAdminLayer.saveEdit()">Save Action</button> <button class="btn" onclick="ActionAdminLayer.cancelEdit()">Cancel</button>`;
    if(anchor)view.insertBefore(div,anchor);else view.prepend(div);
  }

  function saveEdit(){
    if(editingIndex===null)return;
    const s=state();const a=(s.actions||[])[editingIndex];if(!a)return;
    a.title=$('edit_act_title')?.value||'Untitled action';
    a.owner=$('edit_act_owner')?.value||'Unassigned';
    a.team=$('edit_act_team')?.value||'';
    a.metric=$('edit_act_metric')?.value||'';
    a.priority=$('edit_act_priority')?.value||'Medium';
    a.due=$('edit_act_due')?.value||today();
    a.status=$('edit_act_status')?.value||'Open';
    a.tags=$('edit_act_tags')?.value||'';
    a.notes=$('edit_act_notes')?.value||'';
    a.updated=new Date().toISOString();
    save(s);editingIndex=null;$('actionEditPanel')?.remove();toast('Action updated');
    if(window.OpsLayer&&typeof window.OpsLayer.render==='function')window.OpsLayer.render();
    setTimeout(renderPanel,150);
  }
  function cancelEdit(){editingIndex=null;$('actionEditPanel')?.remove()}

  function parseCSV(text){
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){const ch=text[i],nx=text[i+1];if(ch==='"'&&q&&nx==='"'){cell+='"';i++;}else if(ch==='"')q=!q;else if(ch===','&&!q){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}else cell+=ch;}
    row.push(cell);if(row.some(x=>x!==''))rows.push(row);const h=(rows.shift()||[]).map(x=>x.trim());return rows.map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]??''])));
  }
  function get(r,...ks){for(const k of ks){const h=Object.keys(r).find(x=>x.toLowerCase().replaceAll(' ','').replaceAll('_','')===k.toLowerCase().replaceAll(' ','').replaceAll('_',''));if(h!=null)return r[h]}return''}
  function normalize(r){return{title:get(r,'title','action','task'),owner:get(r,'owner')||'Unassigned',team:get(r,'team')||'Pharmacy Ops',metric:get(r,'metric'),priority:get(r,'priority')||'Medium',due:get(r,'due','dueDate')||today(),status:get(r,'status')||'Open',tags:get(r,'tags'),notes:get(r,'notes','description'),created:today(),source:'Action Import'}};

  async function previewImport(){
    const file=$('act_import_file')?.files?.[0];if(!file)return toast('Choose an action file first');
    let raw=[];try{const text=await file.text();raw=file.name.endsWith('.json')?(JSON.parse(text).actions||JSON.parse(text).rows||JSON.parse(text)):parseCSV(text)}catch(e){toast('Could not parse action file');return;}
    const existing=new Set((state().actions||[]).map(a=>String((a.title||'')+'|'+(a.owner||'')+'|'+(a.due||'')).toLowerCase()));
    preview=raw.map(normalize).filter(a=>a.title).map(a=>({...a,duplicate:existing.has(String(a.title+'|'+a.owner+'|'+a.due).toLowerCase())}));
    const rows=preview.map(a=>[esc(a.title),esc(a.owner),esc(a.team),esc(a.metric),esc(a.priority),esc(a.due),esc(a.status),a.duplicate?badge('Duplicate','warn'):badge('New','good')]);
    $('act_import_preview').innerHTML=`<h2>Preview</h2>${table(['Title','Owner','Team','Metric','Priority','Due','Status','Import'],rows)}<button class="btn primary" onclick="ActionAdminLayer.commitImport()">Import New Actions</button> <button class="btn" onclick="ActionAdminLayer.clearPreview()">Cancel</button>`;
  }
  function commitImport(){if(!preview.length)return toast('Preview actions first');const s=state();s.actions=s.actions||[];const clean=preview.filter(a=>!a.duplicate).map(({duplicate,...a})=>a);s.actions=s.actions.concat(clean);save(s);toast('Imported '+clean.length+' actions');preview=[];$('act_import_preview')&&($('act_import_preview').innerHTML='');if(window.OpsLayer&&typeof window.OpsLayer.render==='function')window.OpsLayer.render();setTimeout(renderPanel,200)}
  function clearPreview(){preview=[];$('act_import_preview')&&($('act_import_preview').innerHTML='')}
  function downloadTemplate(){download('onpoint_action_import_template.csv','title,owner,team,metric,priority,due,status,tags,notes\nClear top 10 PA items,Mario,Pharmacy Ops,PA Backlog,High,'+today()+',Open,"PA, stuck scripts",Oldest first\nCall silent doctors,Sara,Sales,Doctor Churn,Medium,'+today()+',Open,"sales, doctors",Top 5 by prior GP\n','text/csv')}
  function exportActions(mode){const rows=(state().actions||[]).filter(a=>mode==='all'||a.status!=='Done');const csv='title,owner,team,metric,priority,due,status,tags,notes\n'+rows.map(a=>[a.title,a.owner,a.team,a.metric,a.priority,a.due,a.status,a.tags,a.notes].map(csvCell).join(',')).join('\n');download('onpoint_actions_'+mode+'_'+today()+'.csv',csv,'text/csv')}

  window.ActionAdminLayer={render:renderPanel,openEditor,saveEdit,cancelEdit,previewImport,commitImport,clearPreview,downloadTemplate,exportActions};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderPanel,1500));
  setInterval(renderPanel,1200);
})();
