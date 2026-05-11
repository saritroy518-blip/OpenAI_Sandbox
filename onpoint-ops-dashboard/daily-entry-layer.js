/* OnPoint Daily Entry Layer: role-based daily entry replaces giant form while preserving same data model. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,days)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+days);return x.toISOString().slice(0,10)};
  let activeRole='Finance';

  function db(){try{return JSON.parse(localStorage.getItem(BASE_KEY))||seed()}catch(e){return seed()}}
  function seed(){return{manual:{},imports:{pioneer:[],cash:[],intacct:[],powerbi:[]},targets:{gpRx:40,costRx:10,fillRate:90,adherence:85,costGp:.35,timeToStart:24},cashForecast:[],teamNotes:{}}}
  function saveDb(d){localStorage.setItem(BASE_KEY,JSON.stringify(d))}
  function toast(msg){try{window.toast?window.toast(msg):alert(msg)}catch(e){}}
  function date(){return $('rangeEnd')?.value || today()}
  function row(){const d=db();return d.manual[date()]||{}}
  function field(id,label,why,type='number'){const r=row();return `<div class="entry-field"><label>${esc(label)}</label><input id="de_${id}" type="${type}" value="${esc(r[id]??0)}" ${type==='text'?'class="left"':''}><div class="field-help">${esc(why)}</div></div>`}
  function textField(id,label,why){const r=row();return `<div class="entry-field wide"><label>${esc(label)}</label><textarea id="de_${id}" class="left">${esc(r[id]||'')}</textarea><div class="field-help">${esc(why)}</div></div>`}

  const roles={
    Finance:{
      mission:'Finance enters the truth: revenue, COGS, cash, AP, AR, debt, and cost. No vibes, just math.',
      fields:[
        ['revenue','Revenue','Total prescription revenue for the day.'],['cogs','COGS','Drug cost tied to filled scripts.'],['cash','Cash','Current cash available.'],['ar','AR','Receivables / PBM cash still coming.'],['ap','AP','Payables / vendor obligations.'],['debt','Debt','Debt or lender obligations.'],['dirExposure','DIR Exposure','Estimated Medicare Part D clawback exposure.'],['storeOpex','Store Opex','Rent, utilities, supplies, local store overhead.'],['corpCost','Corporate Cost','Shared corporate/admin cost allocation.']
      ]
    },
    Ops:{
      mission:'Ops enters what came in, what got out, what got stuck, and what leaked.',
      fields:[
        ['patients','Active Patients','Patients served / active for the period.'],['newPatients','New Patients','New patients brought into the system.'],['scriptsReceived','Scripts Received','Scripts entering the machine.'],['scriptsFilled','Scripts Filled','Scripts that actually got out.'],['scriptsReversed','Scripts Reversed','Scripts reversed after billing or attempted processing.'],['scriptsAbandoned','Scripts Abandoned','Patients/scripts that fell out.'],['paBacklog','PA Backlog','Scripts waiting on prior authorization.'],['paSubmitted','PA Submitted','PA cases submitted.'],['paApproved','PA Approved','PA cases approved.'],['paDenied','PA Denied','PA cases denied.'],['timeToStart','Time To Start Hours','Hours from script received to therapy started.']
      ]
    },
    Retention:{
      mission:'Retention tracks whether therapy starts turn into continuing patients.',
      fields:[
        ['refillsDue','Refills Due','Patients expected to refill.'],['refillsCaptured','Refills Captured','Refills actually captured.'],['firstFills','First Fills','Therapy starts.'],['secondFills','Second Fills','Patients who made it to second fill.'],['dsOhRisk','DSOH Risk','Patients near zero days supply.'],['adherence','Adherence %','PDC/adherence proxy.'],['deliveries','Deliveries','Successful delivery attempts or completed deliveries.'],['deliveryFailures','Delivery Failures','Failed delivery attempts.'],['deliveryFirst','First Attempt Deliveries','Delivered successfully on first attempt.']
      ]
    },
    Sales:{
      mission:'Sales enters volume-in signals: doctors, patients, opportunities, and channel quality.',
      fields:[
        ['activeDoctors','Active Doctors','Doctors sending scripts in the period.'],['newDoctors','New Doctors','New doctors activated.'],['salesCost','Sales Cost','Cost of bringing volume in.'],['enterpriseAccounts','Enterprise Accounts','Strategic accounts active or touched.']
      ]
    },
    Tech:{
      mission:'Tech enters leverage: cost reduction, automation, product work, and notes on what broke.',
      fields:[
        ['techCost','Technology Cost','Tech cost for the period.'],['enterpriseCost','Enterprise Cost','Cost to support larger accounts/channels.'],['labor','Labor Cost','Labor cost when not imported from finance.'],['laborHours','Labor Hours','Total labor hours.'],['delivery','Delivery Cost','Delivery cost for the period.']
      ]
    }
  };

  function currentMetrics(r){
    const gp=n(r.revenue)-n(r.cogs), ops=n(r.labor)+n(r.delivery)+n(r.storeOpex), filled=n(r.scriptsFilled), received=n(r.scriptsReceived);
    const total=ops+n(r.salesCost)+n(r.techCost)+n(r.enterpriseCost)+n(r.corpCost);
    return {gp,ops,total,ebitda:gp-total,fill:received?filled/received*100:0,gpRx:filled?gp/filled:0,costRx:filled?ops/filled:0,refill:n(r.refillsDue)?n(r.refillsCaptured)/n(r.refillsDue)*100:0,firstSecond:n(r.firstFills)?n(r.secondFills)/n(r.firstFills)*100:0,breakeven:filled&&gp?Math.ceil(total/(gp/filled)):0};
  }

  function render(){
    const el=$('view-daily'); if(!el) return;
    if(!document.body.classList.contains('role-daily-enabled')) document.body.classList.add('role-daily-enabled');
    const r=row(), m=currentMetrics(r);
    const role=roles[activeRole]||roles.Finance;
    el.innerHTML=`
      <div class="feature-hero"><h2>Role-Based Daily Entry</h2><p>Each team enters only what it owns. Same underlying scorecard, less spreadsheet punishment.</p></div>
      <div class="daily-toolbar card">
        <div><label>Entry Date</label><input id="de_date" type="date" value="${esc(date())}"></div>
        <div class="daily-role-tabs">${Object.keys(roles).map(k=>`<button class="btn ${k===activeRole?'primary':''}" onclick="DailyEntryLayer.setRole('${k}')">${k}</button>`).join('')}</div>
        <div class="daily-actions"><button class="btn blue" onclick="DailyEntryLayer.copyYesterday()">Copy Yesterday</button><button class="btn red" onclick="DailyEntryLayer.clearDay()">Clear Day</button><button class="btn primary" onclick="DailyEntryLayer.saveDay()">Save Day</button></div>
      </div>
      <div class="kpi-band">
        ${mini('GP',money(m.gp),'revenue - COGS',m.gp>=0?'good':'bad')}
        ${mini('EBITDA Proxy',money(m.ebitda),'GP - costs',m.ebitda>=0?'good':'bad')}
        ${mini('Fill Rate',pct(m.fill),'filled / received',m.fill>=90?'good':'warn')}
        ${mini('GP/Rx',money(m.gpRx),'value per filled script')}
        ${mini('Cost/Rx',money(m.costRx),'ops cost / script',m.costRx<=10?'good':'warn')}
      </div>
      <div class="mission-callout"><b>${esc(activeRole)} Entry:</b> ${esc(role.mission)}</div>
      <div class="role-entry-grid card">
        ${role.fields.map(f=>field(f[0],f[1],f[2])).join('')}
        ${activeRole==='Tech'?textField('notes','Daily Notes','What broke, what got fixed, what needs follow-up.'):''}
      </div>
      <h2>Preview / Validation</h2>
      <div class="action-list">${validation(r,m).map(v=>`<div class="action-item ${v[0]}"><div class="action-title">${esc(v[1])}</div><div class="action-copy">${esc(v[2])}</div></div>`).join('')}</div>
      <h2>Role Handoff</h2>
      ${handoffTable(r)}
    `;
    setTimeout(bind,0);
  }

  function mini(l,v,s,cls){return `<div class="mini-card"><div class="label">${esc(l)}</div><div class="value ${cls||''}">${esc(v)}</div><div class="sub">${esc(s)}</div></div>`}
  function bind(){
    const d=$('de_date'); if(d){d.onchange=()=>{const re=$('rangeEnd'); if(re) re.value=d.value; render();};}
    document.querySelectorAll('[id^="de_"]').forEach(inp=>{if(inp.id!=='de_date')inp.oninput=()=>saveDraft(false)});
  }
  function collect(){const r={...row()};document.querySelectorAll('[id^="de_"]').forEach(inp=>{const k=inp.id.replace('de_','');if(k!=='date')r[k]=inp.value});return r}
  function saveDraft(showToast=true){const d=db(),dt=$('de_date')?.value||date();d.manual=d.manual||{};d.manual[dt]={...d.manual[dt],...collect()};saveDb(d);if(showToast)toast('Daily entry saved');}
  function saveDay(){saveDraft(true);render();}
  function copyYesterday(){const d=db(),dt=$('de_date')?.value||date(),y=addDays(dt,-1);if(!d.manual[y])return toast('No yesterday data to copy');d.manual[dt]={...d.manual[y],notes:'Copied from '+y};saveDb(d);toast('Copied yesterday');render();}
  function clearDay(){if(!confirm('Clear this day?'))return;const d=db(),dt=$('de_date')?.value||date();delete d.manual[dt];saveDb(d);toast('Day cleared');render();}

  function validation(r,m){const out=[];
    if(n(r.scriptsFilled)>n(r.scriptsReceived)&&n(r.scriptsReceived)>0)out.push(['amber','Filled exceeds received','This may be timing, but check date range or entry.']);
    if(n(r.revenue)>0&&n(r.cogs)===0)out.push(['amber','Revenue without COGS','Finance should enter COGS or GP/Rx will be inflated.']);
    if(m.gp<0)out.push(['red','Negative GP','COGS exceeds revenue. Check data or reimbursement issue.']);
    if(n(r.paBacklog)>0&&n(r.paSubmitted)===0)out.push(['amber','PA backlog with no PA submissions','Ops should break down whether these are waiting to submit or waiting for payer.']);
    if(n(r.firstFills)>0&&n(r.secondFills)===0)out.push(['amber','First fills without second-fill conversion','Retention will be blind unless second fills are tracked.']);
    if(m.costRx>m.gpRx&&m.gpRx>0)out.push(['red','Cost/Rx exceeds GP/Rx','The unit economics are upside down for this day.']);
    if(!out.length)out.push(['green','Looks usable','No obvious validation issues for the fields entered so far.']);
    return out;
  }
  function handoffTable(r){const rows=[
    ['Finance',complete(r,['revenue','cogs','cash','ap','ar']),'Revenue, COGS, cash, AP, AR'],
    ['Ops',complete(r,['scriptsReceived','scriptsFilled','paBacklog']),'Scripts in/out, PA backlog'],
    ['Retention',complete(r,['firstFills','secondFills','dsOhRisk','adherence']),'First/second fill, DSOH, adherence'],
    ['Sales',complete(r,['activeDoctors','newDoctors']),'Doctor activity'],
    ['Tech',complete(r,['techCost','notes']),'Tech cost and operational notes']
  ];
    return `<div class="table-wrap"><table><thead><tr><th>Team</th><th>Status</th><th>Owns</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function complete(r,keys){const ok=keys.some(k=>String(r[k]??'').trim()!==''&&String(r[k]??'0')!=='0');return ok?'<span class="badge good">Started</span>':'<span class="badge warn">Missing</span>'}

  window.DailyEntryLayer={render,setRole(role){activeRole=role;render();},saveDay,copyYesterday,clearDay};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,2100));
  setInterval(()=>{if($('view-daily')?.classList.contains('active'))render()},9000);
})();
