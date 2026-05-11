/* Employee Edit Layer: edit employees without deleting; protects form drafts during auto-refresh. */
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
  function badge(text,type){return `<span class="badge ${type||'blue'}">${esc(text)}</span>`}

  let editingIndex=null;

  function renderEditor(){
    const people=$('view-people');
    if(!people || !people.classList.contains('active')) return;
    if($('employeeEditPanel')) return;
    const s=state();
    const rows=s.employees||[];
    const table=people.querySelector('table tbody');
    if(table){
      Array.from(table.querySelectorAll('tr')).forEach((tr,i)=>{
        const last=tr.lastElementChild;
        if(last && !last.querySelector('.emp-edit-btn')){
          const btn=document.createElement('button');
          btn.className='btn blue emp-edit-btn';
          btn.textContent='Edit';
          btn.onclick=()=>openEditor(i);
          last.prepend(document.createTextNode(' '));
          last.prepend(btn);
        }
      });
    }
    if(editingIndex!==null) insertPanel(editingIndex);
  }

  function openEditor(i){
    editingIndex=i;
    const existing=$('employeeEditPanel');
    if(existing) existing.remove();
    insertPanel(i);
    const panel=$('employeeEditPanel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function insertPanel(i){
    const people=$('view-people'); if(!people)return;
    const s=state();
    const e=(s.employees||[])[i];
    if(!e)return;
    const anchor=Array.from(people.querySelectorAll('h2')).find(h=>h.textContent.includes('Add Employee')) || people.querySelector('.card.feature-grid');
    const div=document.createElement('div');
    div.id='employeeEditPanel';
    div.className='card';
    div.style.margin='16px 0';
    div.innerHTML=`
      <h2 style="margin-top:0">Edit Employee</h2>
      <div class="feature-grid form-table">
        <div><label>Name</label>${input('edit_emp_name',e.name||'')}</div>
        <div><label>Role</label>${select('edit_emp_role',roles,e.role||'Pharmacist')}</div>
        <div><label>Team</label>${select('edit_emp_team',teams,e.team||'Pharmacy Ops')}</div>
        <div><label>Email</label>${input('edit_emp_email',e.email||'','email')}</div>
        <div><label>Tags</label>${input('edit_emp_tags',e.tags||'')}</div>
        <div><label>Active</label>${select('edit_emp_active',['Yes','No'],e.active||'Yes')}</div>
      </div>
      <button class="btn primary" onclick="EmployeeEditLayer.saveEdit()">Save Employee</button>
      <button class="btn" onclick="EmployeeEditLayer.cancelEdit()">Cancel</button>
    `;
    if(anchor) people.insertBefore(div, anchor); else people.appendChild(div);
  }

  function saveEdit(){
    if(editingIndex===null)return;
    const s=state();
    const e=(s.employees||[])[editingIndex];
    if(!e)return;
    e.name=$('edit_emp_name')?.value||'Unnamed';
    e.role=$('edit_emp_role')?.value||'';
    e.team=$('edit_emp_team')?.value||'';
    e.email=$('edit_emp_email')?.value||'';
    e.tags=$('edit_emp_tags')?.value||'';
    e.active=$('edit_emp_active')?.value||'Yes';
    e.updated=new Date().toISOString();
    save(s);
    editingIndex=null;
    $('employeeEditPanel')?.remove();
    toast('Employee updated');
    if(window.OpsLayer&&typeof window.OpsLayer.render==='function') window.OpsLayer.render();
    setTimeout(renderEditor,150);
  }

  function cancelEdit(){
    editingIndex=null;
    $('employeeEditPanel')?.remove();
  }

  window.EmployeeEditLayer={render:renderEditor,openEditor,saveEdit,cancelEdit};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderEditor,1200));
  setInterval(renderEditor,1200);
})();
