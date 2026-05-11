/* Draft Preserve Layer: prevents auto-refresh from wiping in-progress form entry. */
(function(){
  'use strict';
  const KEY='opdash.formdrafts.v1';
  const $=id=>document.getElementById(id);

  const groups={
    employee:['emp_name','emp_role','emp_team','emp_email','emp_tags','emp_active'],
    action:['act_title','act_owner','act_team','act_metric','act_priority','act_due','act_status','act_tags'],
    budget:['bud_name','bud_type','bud_period','bud_rev','bud_gp','bud_opex','bud_scripts'],
    pipeline:['pipe_name','pipe_type','pipe_stage','pipe_gp','pipe_prob','pipe_owner','pipe_next'],
    ownerEconomics:['oe_name','oe_scripts','oe_revenueRx','oe_gpRx','oe_laborRx','oe_deliveryRx','oe_otherRx','oe_rent','oe_corpFeePct','oe_partnerPct'],
    scriptQueue:['sq_id','sq_date','sq_location','sq_doctor','sq_payer','sq_class','sq_status','sq_blocker','sq_gp','sq_owner','sq_next']
  };

  function read(){try{return JSON.parse(sessionStorage.getItem(KEY))||{drafts:{},focus:null}}catch(e){return{drafts:{},focus:null}}}
  function save(s){sessionStorage.setItem(KEY,JSON.stringify(s))}
  function groupFor(id){return Object.entries(groups).find(([g,ids])=>ids.includes(id))?.[0]}
  function isEditable(el){return el&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName)}
  function shouldIgnore(el){return !el||el.type==='password'||el.id==='password'||el.id==='newPassword'||el.id==='confirmPassword'}

  function captureField(el){
    if(!isEditable(el)||shouldIgnore(el))return;
    const group=groupFor(el.id);
    if(!group)return;
    const s=read();
    s.drafts[group]=s.drafts[group]||{};
    s.drafts[group][el.id]=el.value;
    s.focus={id:el.id,start:el.selectionStart||0,end:el.selectionEnd||0,ts:Date.now()};
    save(s);
  }

  function captureAll(){
    Object.values(groups).flat().forEach(id=>{const el=$(id);if(el)captureField(el)});
  }

  function restore(){
    const s=read();
    Object.entries(s.drafts||{}).forEach(([group,draft])=>{
      Object.entries(draft||{}).forEach(([id,value])=>{
        const el=$(id);
        if(!el||shouldIgnore(el))return;
        if(document.activeElement===el)return;
        if(el.value!==String(value??''))el.value=String(value??'');
      });
    });
    restoreFocus(s);
  }

  function restoreFocus(s){
    const f=s.focus;
    if(!f||!f.id||Date.now()-f.ts>15000)return;
    const el=$(f.id);
    if(!el||shouldIgnore(el))return;
    const active=document.activeElement;
    if(active&&active!==document.body&&active!==document.documentElement)return;
    try{
      el.focus({preventScroll:true});
      if(typeof el.setSelectionRange==='function')el.setSelectionRange(f.start||0,f.end||0);
    }catch(e){}
  }

  function clearGroup(group){
    const s=read();
    if(s.drafts)delete s.drafts[group];
    if(s.focus&&groups[group]?.includes(s.focus.id))s.focus=null;
    save(s);
  }

  function bind(){
    if(document.body.dataset.draftPreserveBound)return;
    document.body.dataset.draftPreserveBound='1';
    document.addEventListener('input',e=>captureField(e.target),true);
    document.addEventListener('change',e=>captureField(e.target),true);
    document.addEventListener('focusin',e=>captureField(e.target),true);
  }

  function patchOpsLayer(){
    if(!window.OpsLayer||window.OpsLayer.__draftPatched)return;
    const originalAddEmployee=window.OpsLayer.addEmployee;
    if(typeof originalAddEmployee==='function'){
      window.OpsLayer.addEmployee=function(){captureAll();const out=originalAddEmployee.apply(this,arguments);clearGroup('employee');setTimeout(restore,50);return out;};
    }
    const originalAddAction=window.OpsLayer.addAction;
    if(typeof originalAddAction==='function'){
      window.OpsLayer.addAction=function(){captureAll();const out=originalAddAction.apply(this,arguments);clearGroup('action');setTimeout(restore,50);return out;};
    }
    const originalAddBudget=window.OpsLayer.addBudget;
    if(typeof originalAddBudget==='function'){
      window.OpsLayer.addBudget=function(){captureAll();const out=originalAddBudget.apply(this,arguments);clearGroup('budget');setTimeout(restore,50);return out;};
    }
    const originalAddPipeline=window.OpsLayer.addPipeline;
    if(typeof originalAddPipeline==='function'){
      window.OpsLayer.addPipeline=function(){captureAll();const out=originalAddPipeline.apply(this,arguments);clearGroup('pipeline');setTimeout(restore,50);return out;};
    }
    window.OpsLayer.__draftPatched=true;
  }

  function patchOtherLayers(){
    if(window.OwnerEconomics&&!window.OwnerEconomics.__draftPatched&&typeof window.OwnerEconomics.addModel==='function'){
      const original=window.OwnerEconomics.addModel;
      window.OwnerEconomics.addModel=function(){captureAll();const out=original.apply(this,arguments);clearGroup('ownerEconomics');setTimeout(restore,50);return out;};
      window.OwnerEconomics.__draftPatched=true;
    }
    if(window.ScriptLift&&!window.ScriptLift.__draftPatched&&typeof window.ScriptLift.addScript==='function'){
      const original=window.ScriptLift.addScript;
      window.ScriptLift.addScript=function(){captureAll();const out=original.apply(this,arguments);clearGroup('scriptQueue');setTimeout(restore,50);return out;};
      window.ScriptLift.__draftPatched=true;
    }
  }

  function init(){bind();restore();patchOpsLayer();patchOtherLayers();}
  window.DraftPreserve={restore,captureAll,clearGroup};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,500));
  setInterval(init,700);
})();
