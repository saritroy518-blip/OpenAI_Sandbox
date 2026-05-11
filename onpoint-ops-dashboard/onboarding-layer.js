/* OnPoint Onboarding Layer: guided setup, first-week checklist, starter templates, demo data. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const CTRL_KEY='opdash.controlroom.v1';
  const GROWTH_KEY='opdash.growthlayer.v1';
  const ONBOARD_KEY='opdash.onboarding.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,days)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+days);return x.toISOString().slice(0,10)};

  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}}
  function write(key,val){localStorage.setItem(key,JSON.stringify(val))}
  function base(){return read(BASE_KEY,{manual:{},imports:{pioneer:[],cash:[],intacct:[],powerbi:[]},targets:{gpRx:40,costRx:10,fillRate:90,adherence:85,costGp:.35,timeToStart:24},cashForecast:[],teamNotes:{}})}
  function ops(){return read(OPS_KEY,{employees:[],actions:[],budgets:[],pipeline:[],settings:{}})}
  function ctrl(){return read(CTRL_KEY,{risks:[],dictionary:{locations:'',channels:'Doctor Practice, Enterprise, Walk-in, Delivery, Referral, Other',payers:'Commercial, Medicare Part D, Medicaid, Cash, Other',scriptStatuses:'Received, Filled, Reversed, Abandoned, Stuck',stuckReasons:'PA, Patient Contact, Payer Rejection, Inventory, Copay, Doctor Clarification, Insurance Verification, Delivery',drugClasses:'Cardiology, Diabetes, Dermatology, Ophthalmology, Rheumatology, Other'},audit:[]})}
  function growth(){return read(GROWTH_KEY,{scenarios:[],cohorts:[],playbooks:[]})}
  function state(){return read(ONBOARD_KEY,{dismissed:[],demoLoaded:false,started:today()})}
  function saveState(s){write(ONBOARD_KEY,s)}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function safeCalc(){try{return typeof calc==='function'?calc():{}}catch(e){return{}}}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No rows yet</b>Nothing to show.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

  const tabs=[['setup','Setup']];
  function ensureViews(){const main=document.querySelector('.main');if(!main)return;tabs.forEach(([id])=>{if(!$('view-'+id)){const s=document.createElement('section');s.id='view-'+id;s.className='view';main.appendChild(s)}})}
  function ensureTabs(){const nav=$('nav');if(!nav)return;tabs.forEach(([id,label])=>{if(nav.querySelector(`[data-v="${id}"], [data-view="${id}"]`))return;const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.onclick=()=>show(id);nav.appendChild(b)})}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Setup';render();window.scrollTo({top:0,behavior:'smooth'})}

  function checklist(){
    const b=base(),o=ops(),c=ctrl(),g=growth();
    return [
      {id:'safety',label:'Accept data safety rule',done:!!(o.settings&&o.settings.safetyAccepted),why:'No PHI. De-identified operating data only.'},
      {id:'employees',label:'Add employees and owners',done:(o.employees||[]).length>0,why:'Actions need people or they are just wishes.'},
      {id:'dictionary',label:'Define locations, channels, payers, statuses',done:!!((c.dictionary||{}).locations||'').trim(),why:'Standard names prevent fake reporting issues.'},
      {id:'targets',label:'Set targets',done:!!(b.targets&&b.targets.gpRx&&b.targets.costRx),why:'Red/yellow/green needs targets.'},
      {id:'daily',label:'Enter first daily scorecard',done:Object.keys(b.manual||{}).length>0,why:'The operating system starts with daily truth.'},
      {id:'budget',label:'Add first budget row',done:(o.budgets||[]).length>0,why:'Budget vs actual is how management happens.'},
      {id:'pipeline',label:'Add first pipeline opportunity',done:(o.pipeline||[]).length>0,why:'Forward-looking GP matters.'},
      {id:'actions',label:'Create first action item',done:(o.actions||[]).length>0,why:'The dashboard should create accountability.'},
      {id:'backup',label:'Create encrypted backup',done:false,why:'Use Backup tab after setup. Browser storage is not a database.'}
    ];
  }
  function setupScore(){const rows=checklist();return Math.round(rows.filter(x=>x.done).length/rows.length*100)}

  function renderSetup(){
    const el=$('view-setup');if(!el)return;
    const rows=checklist(),score=setupScore(),b=base(),o=ops(),c=safeCalc();
    el.innerHTML=`
      <div class="feature-hero"><h2>Setup Wizard</h2><p>Get from blank app to useful operating system. Do these in order and the dashboard becomes usable by the team.</p></div>
      <div class="kpi-band">
        ${metric('Setup Score',pct(score),'configured',score>=70?'good':score>=40?'warn':'bad')}
        ${metric('Employees',num((o.employees||[]).length),'owners')}
        ${metric('Daily Days',num(Object.keys(b.manual||{}).length),'manual entries')}
        ${metric('Open Actions',num((o.actions||[]).filter(a=>a.status!=='Done').length),'work')}
        ${metric('Current GP',money(c.gp),'selected period')}
      </div>
      <h2>Guided Checklist</h2>
      <div class="action-list">
        ${rows.map(r=>`<div class="action-item ${r.done?'green':'amber'}"><div class="action-title">${r.done?badge('Done','good'):badge('Open','warn')} ${esc(r.label)}</div><div class="action-copy">${esc(r.why)}</div></div>`).join('')}
      </div>
      <h2>Fast Start</h2>
      <div class="feature-grid three">
        <div class="card"><h2 style="margin-top:0">Load Demo Data</h2><p class="muted">Adds de-identified sample data so you can see the app work. Do not use this on your real operating browser unless you are testing.</p><button class="btn primary" onclick="OnboardingLayer.loadDemoData()">Load Demo Data</button></div>
        <div class="card"><h2 style="margin-top:0">Download Templates</h2><p class="muted">Templates for daily scorecard, PioneerRx, Intacct, cash, and Power BI import.</p><button class="btn blue" onclick="OnboardingLayer.downloadTemplates()">Download Templates</button></div>
        <div class="card"><h2 style="margin-top:0">First Week Plan</h2><p class="muted">A simple rollout checklist for you and the team.</p><button class="btn" onclick="OnboardingLayer.downloadFirstWeekPlan()">Download Plan</button></div>
      </div>
      <h2>Recommended First Week</h2>
      ${table(['Day','Focus','Outcome'],firstWeekRows())}
      <h2>Role-Based Rollout</h2>
      ${table(['Role','First Responsibility','Dashboard Area'],roleRows())}
    `;
  }

  function firstWeekRows(){return[
    ['Day 1','CEO sets targets and data safety rule','Everyone agrees this is de-identified operating data only.'],
    ['Day 2','Finance enters cash, AP, AR, revenue, COGS, debt','Finance truth is visible.'],
    ['Day 3','Ops enters scripts, stuck scripts, PA backlog, reversals, delivery, DSOH','Operational leakage becomes visible.'],
    ['Day 4','Sales enters doctors, pipeline, channel activity','Volume-in starts getting managed.'],
    ['Day 5','Enterprise enters account scorecards and open issues','Strategic partners get tracked.'],
    ['Day 6','Create actions and assign owners','Numbers turn into accountability.'],
    ['Day 7','Run Meeting Mode and export report','Weekly operating rhythm begins.']
  ]}
  function roleRows(){return[
    ['CEO','Review CEO Mobile, CEO Brief, Risks, Capital Pack','Run Today / Admin / Finance'],
    ['Finance','Cash, AP, AR, revenue, COGS, budget, close checklist','Finance'],
    ['Pharmacy Ops','Scripts filled, fill rate, PA, DSOH, delivery, leakage','Ops'],
    ['Sales','Doctors, pipeline, silent accounts, channel GP','Sales / Doctors'],
    ['Enterprise','Medical group/pharma/payor scorecards and reports','Enterprise'],
    ['Technology','Improve imports, workflow, cost reduction, product leverage','People / Actions']
  ]}

  function loadDemoData(){
    if(!confirm('Load de-identified demo data into this browser?'))return;
    const b=base(),o=ops(),c=ctrl(),g=growth();
    for(let i=13;i>=0;i--){const d=addDays(today(),-i);b.manual[d]={patients:420+i*3,newPatients:8+i%4,scriptsReceived:170+i*2,scriptsFilled:150+i,scriptsReversed:4+i%3,scriptsAbandoned:3+i%2,refillsDue:90,refillsCaptured:78+i%8,revenue:38000+i*700,cogs:31000+i*500,labor:1800,delivery:520,storeOpex:900,salesCost:250,techCost:200,enterpriseCost:150,corpCost:500,activeDoctors:45,newDoctors:i%3,cash:120000-i*2500,ar:160000,ap:90000,debt:350000,paBacklog:18+i%8,paSubmitted:32,paApproved:24,paDenied:5,firstFills:40,secondFills:28+i%6,dsOhRisk:22+i%10,dirExposure:1200,deliveries:70,deliveryFailures:4,deliveryFirst:61,laborHours:38,adherence:84+i%7,timeToStart:22+i%5,notes:'Demo data'};}
    b.imports=b.imports||{pioneer:[],cash:[],intacct:[],powerbi:[]};
    b.imports.pioneer=b.imports.pioneer||[];
    const doctors=['Dr. Smith','Dr. Patel','Dr. Lee','Dr. Cohen','Dr. Rodriguez'];
    const locs=['Flushing','Brooklyn','Queens','Long Island'];
    const payers=['Commercial A','Medicare D','Medicaid','Cash'];
    for(let i=0;i<80;i++){b.imports.pioneer.push({date:addDays(today(),-Math.floor(i/6)),rxNumber:'DEMO'+i,patientId:'P'+(1000+i),doctor:doctors[i%doctors.length],location:locs[i%locs.length],channel:i%3?'Doctor Practice':'Enterprise',status:i%9===0?'Abandoned':'Filled',revenue:180+(i%5)*30,cogs:120+(i%4)*20,grossProfit:35+(i%6)*8,timeToStartHours:18+i%12,adherencePct:78+i%18,payer:payers[i%payers.length],drugName:'Demo Drug '+(i%8),paStatus:i%4===0?'Submitted':i%5===0?'Denied':'Approved',rejectCode:i%7===0?'PA Required':'',payerType:payers[i%payers.length],drugClass:['Cardiology','Diabetes','Ophthalmology','Dermatology'][i%4],isFirstFill:i%3===0?'yes':'no',isSecondFill:i%5===0?'yes':'no',dsOhDays:i%6===0?5:20});}
    o.employees=o.employees&&o.employees.length?o.employees:[{name:'Amy',role:'Location Manager',team:'Pharmacy Ops',email:'',tags:'Ops, stores, delivery',active:'Yes'},{name:'Mario',role:'Pharmacist',team:'Pharmacy Ops',email:'',tags:'Clinical, PA, revenue cycle',active:'Yes'},{name:'Sara',role:'Sales',team:'Sales',email:'',tags:'Doctors, pipeline',active:'Yes'},{name:'Erin',role:'Finance',team:'Finance',email:'',tags:'Cash, AP, close',active:'Yes'}];
    o.actions=o.actions&&o.actions.length?o.actions:[{title:'Clear top 10 oldest PA items',owner:'Mario',team:'Pharmacy Ops',metric:'PA Backlog',priority:'High',due:today(),status:'Open',tags:'PA',created:today()},{title:'Review AP and cash plan',owner:'Erin',team:'Finance',metric:'Cash',priority:'Critical',due:today(),status:'Open',tags:'cash',created:today()},{title:'Call top 5 silent doctors',owner:'Sara',team:'Sales',metric:'Doctor churn',priority:'Medium',due:addDays(today(),2),status:'Open',tags:'doctor churn',created:today()}];
    o.budgets=o.budgets&&o.budgets.length?o.budgets:[{name:'Flushing',type:'Location',period:today().slice(0,7),revenueBudget:900000,gpBudget:140000,opexBudget:55000,scriptsBudget:4200},{name:'Doctor Channel',type:'Channel',period:today().slice(0,7),revenueBudget:650000,gpBudget:105000,opexBudget:22000,scriptsBudget:3000}];
    o.pipeline=o.pipeline&&o.pipeline.length?o.pipeline:[{name:'Consensus Health Expansion',type:'Medical Group',stage:'Proposal',expectedGp:350000,probability:45,owner:'Sara',nextStep:'Schedule operating review'},{name:'Ophthalmology Pharma Program',type:'Pharma',stage:'Meeting',expectedGp:220000,probability:30,owner:'Sarit',nextStep:'Build partner scorecard'}];
    c.dictionary=c.dictionary||{};c.dictionary.locations='Flushing, Brooklyn, Queens, Long Island';c.dictionary.channels='Doctor Practice, Enterprise, Walk-in, Delivery, Referral, Other';
    c.risks=c.risks&&c.risks.length?c.risks:[{title:'Cash below vendor needs',owner:'Finance',probability:4,impact:5,status:'Mitigating',mitigation:'Weekly cash triage and AP prioritization',created:today()},{title:'PA backlog slows fill rate',owner:'Pharmacy Ops',probability:4,impact:4,status:'Open',mitigation:'Daily PA queue with owners',created:today()}];
    g.scenarios=g.scenarios&&g.scenarios.length?g.scenarios:[{name:'Base Store Target',days:30,scriptsPerDay:140,revenueRx:250,gpRx:40,costRx:12,fixedCost:52000}];
    g.cohorts=g.cohorts&&g.cohorts.length?g.cohorts:[{therapy:'Cardiology',starts:120,retention:72,fillsPerYear:10,gpRx:38},{therapy:'Ophthalmology',starts:80,retention:68,fillsPerYear:8,gpRx:52}];
    o.settings=o.settings||{};o.settings.safetyAccepted=true;
    write(BASE_KEY,b);write(OPS_KEY,o);write(CTRL_KEY,c);write(GROWTH_KEY,g);
    const s=state();s.demoLoaded=true;saveState(s);
    toast('Demo data loaded');setTimeout(()=>location.reload(),700);
  }

  function downloadTemplates(){
    const files={
      'daily_scorecard_template.csv':'date,patients,newPatients,scriptsReceived,scriptsFilled,scriptsReversed,scriptsAbandoned,revenue,cogs,labor,delivery,storeOpex,cash,ar,ap,debt,paBacklog,firstFills,secondFills,dsOhRisk,adherence\n'+today()+',0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n',
      'pioneerrx_template.csv':'date,rxNumber,patientId,doctor,location,channel,status,revenue,cogs,grossProfit,timeToStartHours,adherencePct,payer,drugName,paStatus,rejectCode,payerType,drugClass,isFirstFill,isSecondFill,dsOhDays\n'+today()+',RX1,P1,Doctor One,Location One,Doctor Practice,Filled,125,82,43,18,92,Payer A,Drug A,Approved,,Commercial,Cardiology,yes,no,12\n',
      'sage_intacct_template.csv':'date,location,account,accountType,amount,department,vendor,customer\n'+today()+',Location One,Revenue,revenue,50000,Store,,\n'+today()+',Location One,Drug Cost,cogs,35000,Store,Vendor,\n',
      'cash_template.csv':'date,account,description,amount,category,location,team\n'+today()+',Operating Account,Sample Expense,-100,labor,Location One,Ops\n',
      'powerbi_template.csv':'date,location,channel,doctor,enterpriseAccount,patients,scriptsReceived,scriptsFilled,revenue,cogs,grossProfit,adherencePct,fillRatePct\n'+today()+',Location One,Doctor Practice,Doctor One,Account One,250,330,300,42000,30000,12000,88,91\n'
    };
    Object.entries(files).forEach(([name,text])=>download(name,text,'text/csv'));
    toast('Templates downloaded');
  }

  function downloadFirstWeekPlan(){
    const csv='day,focus,outcome\n'+firstWeekRows().map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
    download('onpoint_first_week_rollout.csv',csv,'text/csv');
  }

  function render(){ensureViews();ensureTabs();renderSetup()}
  window.OnboardingLayer={render,show,loadDemoData,downloadTemplates,downloadFirstWeekPlan};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1900));
  setInterval(render,8000);
})();
