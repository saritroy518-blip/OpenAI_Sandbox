/* Employee Import Layer: bulk add employees from CSV/JSON with preview and duplicate handling. */
(function(){
  'use strict';
  const KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const roles=['CEO','Sales','Enterprise','Pharmacy Ops','Technology','Finance','Location Manager','Pharmacist','Technician','Delivery','Accounting','Admin'];
  const teams=['Executive','Sales','Enterprise','Pharmacy Ops','Technology','Finance'];
  let preview=[];

  function state(){try{return JSON.parse(localStorage.getItem(KEY))||{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}catch(e){return{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows yet</b>Upload a CSV or JSON file to preview employees.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  function parseCSV(text){
    const rows=[]; let row=[], cell='', q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], nx=text[i+1];
      if(ch==='"'&&q&&nx==='"'){cell+='"';i++;}
      else if(ch==='"')q=!q;
      else if(ch===','&&!q){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&nx==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    row.push(cell); if(row.some(x=>x!==''))rows.push(row);
    const h=(rows.shift()||[]).map(x=>x.trim());
    return rows.map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]??''])));
  }
  function get(r,...ks){for(const k of ks){const h=Object.keys(r).find(x=>x.toLowerCase().replaceAll(' ','').replaceAll('_','')===k.toLowerCase().replaceAll(' ','').replaceAll('_',''));if(h!=null)return r[h]}return''}
  function normalize(r){
    const role=get(r,'role')||'Pharmacist';
    const team=get(r,'team')||teamFromRole(role);
    return {name:get(r,'name','employee','fullName'),role:roles.includes(role)?role:role,team:teams.includes(team)?team:team,email:get(r,'email','emailAddress'),tags:get(r,'tags','tag'),active:get(r,'active','status')||'Yes'};
  }
  function teamFromRole(role){
    const r=String(role||'').toLowerCase();
    if(r.includes('sale'))return'Sales';
    if(r.includes('finance')||r.includes('account'))return'Finance';
    if(r.includes('enterprise'))return'Enterprise';
    if(r.includes('tech')||r.includes('it'))return'Technology';
    if(r.includes('ceo'))return'Executive';
    return'Pharmacy Ops';
  }

  function renderPanel(){
    const people=$('view-people');
    if(!people||!people.classList.contains('active'))return;
    if($('employeeImportPanel'))return;
    const addHeader=Array.from(people.querySelectorAll('h2')).find(h=>h.textContent.includes('Add Employee'));
    const panel=document.createElement('div');
    panel.id='employeeImportPanel';
    panel.className='card';
    panel.style.margin='16px 0';
    panel.innerHTML=`<h2 style="margin-top:0">Bulk Employee Import</h2><p class="muted">Upload CSV or JSON with columns: name, role, team, email, tags, active. Existing employees with the same email or name are skipped.</p><div class="feature-grid form-table"><div><label>Employee File</label><input id="emp_import_file" type="file" accept=".csv,.json"></div><div style="align-self:end"><button class="btn blue" onclick="EmployeeImportLayer.previewImport()">Preview Employees</button> <button class="btn" onclick="EmployeeImportLayer.downloadTemplate()">Download Template</button></div></div><div id="emp_import_preview"></div>`;
    if(addHeader) people.insertBefore(panel,addHeader); else people.appendChild(panel);
  }

  async function previewImport(){
    const file=$('emp_import_file')?.files?.[0];
    if(!file)return toast('Choose an employee file first');
    let raw=[];
    try{const text=await file.text();raw=file.name.endsWith('.json')?(JSON.parse(text).employees||JSON.parse(text).rows||JSON.parse(text)):parseCSV(text)}catch(e){toast('Could not parse employee file');return;}
    const existing=state().employees||[];
    const keys=new Set(existing.map(e=>String(e.email||e.name||'').toLowerCase()).filter(Boolean));
    preview=raw.map(normalize).filter(e=>e.name).map(e=>{
      const key=String(e.email||e.name||'').toLowerCase();
      return {...e,duplicate:keys.has(key)};
    });
    const rows=preview.map(e=>[esc(e.name),esc(e.role),esc(e.team),esc(e.email),esc(e.tags),esc(e.active),e.duplicate?badge('Duplicate','warn'):badge('New','good')]);
    $('emp_import_preview').innerHTML=`<h2>Preview</h2>${table(['Name','Role','Team','Email','Tags','Active','Status'],rows)}<button class="btn primary" onclick="EmployeeImportLayer.commitImport()">Import New Employees</button> <button class="btn" onclick="EmployeeImportLayer.clearPreview()">Cancel</button>`;
  }

  function commitImport(){
    if(!preview.length)return toast('Preview employees first');
    const s=state();
    s.employees=s.employees||[];
    const clean=preview.filter(e=>!e.duplicate).map(({duplicate,...e})=>e);
    s.employees=s.employees.concat(clean);
    save(s);
    toast('Imported '+clean.length+' employees');
    preview=[];
    $('emp_import_preview')&&( $('emp_import_preview').innerHTML='' );
    if(window.OpsLayer&&typeof window.OpsLayer.render==='function')window.OpsLayer.render();
    setTimeout(renderPanel,200);
  }
  function clearPreview(){preview=[];$('emp_import_preview')&&( $('emp_import_preview').innerHTML='' );}
  function downloadTemplate(){download('onpoint_employee_import_template.csv','name,role,team,email,tags,active\nMario,Pharmacist,Pharmacy Ops,mario@example.com,"PA, clinical, revenue cycle",Yes\nAmy,Location Manager,Pharmacy Ops,amy@example.com,"stores, delivery, operations",Yes\nSara,Sales,Sales,sara@example.com,"doctors, pipeline",Yes\n','text/csv')}

  window.EmployeeImportLayer={render:renderPanel,previewImport,commitImport,clearPreview,downloadTemplate};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderPanel,1400));
  setInterval(renderPanel,1200);
})();
