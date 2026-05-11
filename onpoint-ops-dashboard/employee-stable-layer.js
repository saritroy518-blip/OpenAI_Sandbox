/* Employee Stable Layer: stable add/edit/import controls outside auto-refreshing People content. */
(function(){
  'use strict';
  const KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const roles=['CEO','Sales','Enterprise','Pharmacy Ops','Technology','Finance','Location Manager','Pharmacist','Technician','Delivery','Accounting','Admin'];
  const teams=['Executive','Sales','Enterprise','Pharmacy Ops','Technology','Finance'];

  function state(){try{return JSON.parse(localStorage.getItem(KEY))||{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}catch(e){return{employees:[],actions:[],budgets:[],pipeline:[],settings:{}}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function select(id,opts,val){return `<select id="${esc(id)}">${opts.map(o=>`<option ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function input(id,val,type='text'){return `<input id="${esc(id)}" class="left" type="${type}" value="${esc(val??'')}">`}

  function addStyles(){
    if(document.getElementById('employeeStableStyles'))return;
    const s=document.createElement('style');
    s.id='employeeStableStyles';
    s.textContent=`
      .employee-stable-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:center}
      .employee-stable-toolbar .muted{margin-left:auto;font-size:12px}
      .employee-modal{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:10030;display:grid;place-items:center;padding:16px}
      .employee-modal-card{background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.35);max-width:780px;width:100%;max-height:88vh;overflow:auto;padding:18px}
      .employee-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
      .employee-hidden-original-add{display:none!important}
      @media(max-width:700px){.employee-modal-card{padding:14px}.employee-modal-actions .btn,.employee-stable-toolbar .btn{flex:1}.employee-stable-toolbar .muted{width:100%;margin-left:0}}
    `;
    document.head.appendChild(s);
  }

  function hideOriginalAddForm(view){
    // The original add form lives inside the auto-rendering People page and causes cursor jumps.
    // Hide it and replace with stable modal controls.
    const headers=Array.from(view.querySelectorAll('h2'));
    headers.forEach(h=>{
      if((h.textContent||'').toLowerCase().includes('add employee')){
        h.classList.add('employee-hidden-original-add');
        let node=h.nextElementSibling;
        while(node && !/^H2$/i.test(node.tagName)){
          node.classList.add('employee-hidden-original-add');
          node=node.nextElementSibling;
        }
      }
    });
  }

  function renderToolbar(){
    addStyles();
    const view=$('view-people');
    if(!view||!view.classList.contains('active'))return;
    hideOriginalAddForm(view);
    if(!$('employeeStableToolbar')){
      const toolbar=document.createElement('div');
      toolbar.id='employeeStableToolbar';
      toolbar.className='card employee-stable-toolbar';
      toolbar.innerHTML=`<button class="btn primary" type="button" onclick="EmployeeStableLayer.openAdd()">Add Employee</button><button class="btn blue" type="button" onclick="EmployeeImportLayer&&EmployeeImportLayer.render&&EmployeeImportLayer.render()">Bulk Import</button><span class="muted">Stable controls: these do not disappear while the page refreshes.</span>`;
      const first=view.firstElementChild;
      if(first)view.insertBefore(toolbar,first.nextSibling);else view.prepend(toolbar);
    }
  }

  function openAdd(){
    addStyles();
    $('employeeAddModal')?.remove();
    const modal=document.createElement('div');
    modal.id='employeeAddModal';
    modal.className='employee-modal';
    modal.innerHTML=`
      <div class="employee-modal-card" role="dialog" aria-modal="true">
        <h2 style="margin-top:0">Add Employee</h2>
        <p class="muted">This form stays stable even while the People page refreshes behind it.</p>
        <div class="feature-grid form-table">
          <div><label>Name</label>${input('stable_emp_name','')}</div>
          <div><label>Role</label>${select('stable_emp_role',roles,'Pharmacist')}</div>
          <div><label>Team</label>${select('stable_emp_team',teams,'Pharmacy Ops')}</div>
          <div><label>Email</label>${input('stable_emp_email','','email')}</div>
          <div><label>Tags</label>${input('stable_emp_tags','')}</div>
          <div><label>Active</label>${select('stable_emp_active',['Yes','No'],'Yes')}</div>
        </div>
        <div class="employee-modal-actions">
          <button class="btn" type="button" onclick="EmployeeStableLayer.closeAdd()">Cancel</button>
          <button class="btn primary" type="button" onclick="EmployeeStableLayer.saveAdd()">Save Employee</button>
        </div>
      </div>
    `;
    modal.addEventListener('click',e=>{if(e.target===modal)closeAdd();});
    document.body.appendChild(modal);
    setTimeout(()=>$('stable_emp_name')?.focus(),50);
  }

  function closeAdd(){ $('employeeAddModal')?.remove(); }

  function saveAdd(){
    const name=($('stable_emp_name')?.value||'').trim();
    if(!name){toast('Employee name is required');$('stable_emp_name')?.focus();return;}
    const s=state();
    s.employees=s.employees||[];
    const email=($('stable_emp_email')?.value||'').trim();
    const duplicate=s.employees.some(e=>String(e.email||'').toLowerCase()===email.toLowerCase()&&email || String(e.name||'').toLowerCase()===name.toLowerCase());
    if(duplicate&&!confirm('This looks like a duplicate employee. Add anyway?'))return;
    s.employees.push({
      name,
      role:$('stable_emp_role')?.value||'Pharmacist',
      team:$('stable_emp_team')?.value||'Pharmacy Ops',
      email,
      tags:$('stable_emp_tags')?.value||'',
      active:$('stable_emp_active')?.value||'Yes',
      created:new Date().toISOString()
    });
    save(s);
    closeAdd();
    toast('Employee added');
    if(window.OpsLayer&&typeof window.OpsLayer.render==='function')window.OpsLayer.render();
    setTimeout(renderToolbar,200);
  }

  window.EmployeeStableLayer={render:renderToolbar,openAdd,closeAdd,saveAdd};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderToolbar,900));
  setInterval(renderToolbar,700);
})();
