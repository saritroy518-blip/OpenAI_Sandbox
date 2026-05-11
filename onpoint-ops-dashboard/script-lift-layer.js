/* OnPoint Script + Lift Layer: work queue, stuck prioritizer, Lift readiness, actions from scripts. */
(function(){
  'use strict';

  const SCRIPT_KEY = 'opdash.scriptqueue.v1';
  const OPS_KEY = 'opdash.opslayer.v1';
  const BASE_KEY = 'opdash.pages.v1';
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n = x => Number(x) || 0;
  const money = x => '$' + Math.round(n(x)).toLocaleString();
  const num = x => Math.round(n(x)).toLocaleString();
  const pct = x => isFinite(x) ? Number(x).toFixed(1) + '%' : '0.0%';
  const today = () => new Date().toISOString().slice(0,10);
  const daysBetween = (a,b=today()) => {
    if(!a) return 0;
    const x = new Date(a + 'T00:00:00');
    const y = new Date(b + 'T00:00:00');
    return Math.max(0, Math.floor((y - x) / 86400000));
  };

  function seed(){ return { scripts: [], lift: [], filters: { status: 'All', blocker: 'All', sort: 'Priority' } }; }
  function state(){ try { return JSON.parse(localStorage.getItem(SCRIPT_KEY)) || seed(); } catch(e){ return seed(); } }
  function save(s){ localStorage.setItem(SCRIPT_KEY, JSON.stringify(s)); }
  function ops(){ try { return JSON.parse(localStorage.getItem(OPS_KEY)) || { employees: [], actions: [] }; } catch(e){ return { employees: [], actions: [] }; } }
  function saveOps(o){ localStorage.setItem(OPS_KEY, JSON.stringify(o)); }
  function base(){ try { return JSON.parse(localStorage.getItem(BASE_KEY)) || { imports: {} }; } catch(e){ return { imports: {} }; } }
  function toast(msg){ try { window.toast ? window.toast(msg) : alert(msg); } catch(e){} }

  const STATUSES = ['Received','Insurance Verification','PA Needed','PA Submitted','Patient Contact','Doctor Clarification','Lift Review','Ready To Fill','Ready For Delivery','Delivered / Picked Up','Abandoned','Reversed'];
  const BLOCKERS = ['None','PA','Payer Rejection','Patient Unreachable','Copay / Financial Assistance','Inventory','Doctor Clarification','Insurance Verification','Delivery','Lift Review','Other'];
  const tabs = [['scripts','Script Queue'],['lift','Lift'],['scriptops','Script Ops']];

  function ensureViews(){
    const main = document.querySelector('.main');
    if(!main) return;
    tabs.forEach(([id]) => {
      if(!$('view-' + id)){
        const sec = document.createElement('section');
        sec.id = 'view-' + id;
        sec.className = 'view';
        main.appendChild(sec);
      }
    });
  }

  function ensureTabs(){
    const nav = $('nav');
    if(!nav) return;
    tabs.forEach(([id,label]) => {
      if(nav.querySelector(`[data-v="${id}"], [data-view="${id}"]`)) return;
      const b = document.createElement('button');
      b.dataset.v = id;
      b.textContent = label;
      b.onclick = () => show(id);
      nav.appendChild(b);
    });
  }

  function show(id){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-' + id)?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', (b.dataset.v || b.dataset.view) === id));
    const title = $('pageTitle');
    if(title) title.textContent = tabs.find(t => t[0] === id)?.[1] || id;
    render();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function table(headers, rows){
    if(!rows.length) return `<div class="empty-state"><b>No rows yet</b>Add scripts or import Lift opportunities to use this tool.</div>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function metric(label,value,sub='',cls=''){
    return `<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
  }
  function badge(text,type='blue'){
    return `<span class="badge ${type}">${esc(text)}</span>`;
  }
  function input(id,val,type='text'){
    return `<input id="${esc(id)}" type="${type}" value="${esc(val ?? '')}" class="left">`;
  }
  function select(id,opts,val){
    return `<select id="${esc(id)}">${opts.map(o => `<option value="${esc(o)}" ${o===val?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  }

  function ownerOptions(){
    const people = (ops().employees || []).filter(e => e.active !== 'No').map(e => e.name).filter(Boolean);
    return ['Unassigned'].concat(people.length ? people : ['Mario','Amy','Sara','Erin']);
  }

  function scriptAge(s){ return daysBetween(s.receivedDate || s.date || today()); }
  function ageBucket(days){
    if(days <= 1) return '0-24h';
    if(days <= 2) return '24-48h';
    if(days <= 3) return '48-72h';
    return '72h+';
  }
  function statusType(status){
    if(['Delivered / Picked Up','Ready To Fill','Ready For Delivery'].includes(status)) return 'good';
    if(['Abandoned','Reversed'].includes(status)) return 'bad';
    if(['PA Needed','PA Submitted','Patient Contact','Doctor Clarification','Lift Review'].includes(status)) return 'warn';
    return 'blue';
  }
  function priorityScore(s){
    const age = scriptAge(s);
    const gp = n(s.expectedGp);
    const blockerWeight = s.blocker && s.blocker !== 'None' ? 25 : 0;
    const liftWeight = findLiftForScript(s) ? 20 : 0;
    const abandonedPenalty = ['Abandoned','Reversed','Delivered / Picked Up'].includes(s.status) ? -80 : 0;
    return Math.round(age * 12 + gp / 20 + blockerWeight + liftWeight + abandonedPenalty);
  }

  function filteredScripts(){
    const s = state();
    let rows = (s.scripts || []).slice();
    const f = s.filters || {};
    if(f.status && f.status !== 'All') rows = rows.filter(r => r.status === f.status);
    if(f.blocker && f.blocker !== 'All') rows = rows.filter(r => r.blocker === f.blocker);
    if(f.owner && f.owner !== 'All') rows = rows.filter(r => (r.owner || 'Unassigned') === f.owner);
    const sort = f.sort || 'Priority';
    rows.sort((a,b) => {
      if(sort === 'Oldest') return scriptAge(b) - scriptAge(a);
      if(sort === 'Expected GP') return n(b.expectedGp) - n(a.expectedGp);
      if(sort === 'Status') return String(a.status).localeCompare(String(b.status));
      return priorityScore(b) - priorityScore(a);
    });
    return rows;
  }

  function findLiftForScript(script){
    const id = script.scriptId || script.rxId || script.rxNumber;
    if(!id) return null;
    return (state().lift || []).find(l => String(l.scriptId || l.rxId || l.rxNumber || '') === String(id));
  }

  function scriptSummary(){
    const rows = state().scripts || [];
    const open = rows.filter(r => !['Delivered / Picked Up','Abandoned','Reversed'].includes(r.status));
    const stuck = open.filter(r => r.blocker && r.blocker !== 'None');
    const gpAtRisk = stuck.reduce((a,r) => a + n(r.expectedGp), 0);
    const old = open.filter(r => scriptAge(r) >= 3);
    return { total: rows.length, open: open.length, stuck: stuck.length, gpAtRisk, old: old.length, delivered: rows.filter(r => r.status === 'Delivered / Picked Up').length };
  }

  function renderScripts(){
    const el = $('view-scripts'); if(!el) return;
    const s = state();
    const summary = scriptSummary();
    const rows = filteredScripts().map((r,i) => {
      const idx = (s.scripts || []).indexOf(r);
      const age = scriptAge(r);
      const lift = findLiftForScript(r);
      return [
        esc(r.scriptId || ''),
        badge(ageBucket(age), age>=3?'bad':age>=2?'warn':'blue'),
        esc(r.location || ''),
        esc(r.doctor || ''),
        esc(r.payer || ''),
        esc(r.drugClass || ''),
        badge(r.status || 'Received', statusType(r.status)),
        badge(r.blocker || 'None', r.blocker && r.blocker !== 'None' ? 'warn' : 'good'),
        money(r.expectedGp),
        lift ? badge('Lift', 'good') : badge('No Lift','blue'),
        esc(r.owner || 'Unassigned'),
        esc(r.nextAction || ''),
        `<button class="btn" onclick="ScriptLift.updateScript(${idx})">Update</button> <button class="btn blue" onclick="ScriptLift.createActionFromScript(${idx})">Action</button> <button class="btn red" onclick="ScriptLift.deleteScript(${idx})">Delete</button>`
      ];
    });

    el.innerHTML = `
      <div class="feature-hero"><h2>Script Work Queue</h2><p>Every script should have a status, blocker, expected GP, owner, and next action. This is where stuck work becomes visible and assignable.</p></div>
      <div class="kpi-band">
        ${metric('Open Scripts', num(summary.open), 'not delivered / abandoned')}
        ${metric('Stuck Scripts', num(summary.stuck), 'blocker present', summary.stuck?'bad':'good')}
        ${metric('GP At Risk', money(summary.gpAtRisk), 'stuck expected GP', summary.gpAtRisk?'bad':'good')}
        ${metric('72h+ Open', num(summary.old), 'old unresolved scripts', summary.old?'bad':'good')}
        ${metric('Delivered', num(summary.delivered), 'completed output')}
      </div>
      <div class="card script-filter-grid">
        <div><label>Status</label>${select('script_filter_status',['All'].concat(STATUSES), (s.filters||{}).status || 'All')}</div>
        <div><label>Blocker</label>${select('script_filter_blocker',['All'].concat(BLOCKERS), (s.filters||{}).blocker || 'All')}</div>
        <div><label>Owner</label>${select('script_filter_owner',['All'].concat(ownerOptions()), (s.filters||{}).owner || 'All')}</div>
        <div><label>Sort</label>${select('script_filter_sort',['Priority','Oldest','Expected GP','Status'], (s.filters||{}).sort || 'Priority')}</div>
        <div class="filter-actions"><button class="btn primary" onclick="ScriptLift.applyScriptFilters()">Apply</button><button class="btn" onclick="ScriptLift.seedFromPioneer()">Seed From PioneerRx</button></div>
      </div>
      <h2>Work Queue</h2>
      ${table(['Script','Age','Location','Doctor','Payer','Class','Status','Blocker','Expected GP','Lift','Owner','Next Action',''], rows)}
      <h2>Add Script</h2>
      ${scriptForm()}
    `;
  }

  function scriptForm(){
    return `<div class="card feature-grid form-table">
      <div><label>Script ID</label>${input('sq_id','')}</div>
      <div><label>Received Date</label>${input('sq_date',today(),'date')}</div>
      <div><label>Location</label>${input('sq_location','')}</div>
      <div><label>Doctor</label>${input('sq_doctor','')}</div>
      <div><label>Payer</label>${input('sq_payer','')}</div>
      <div><label>Drug Class</label>${input('sq_class','')}</div>
      <div><label>Status</label>${select('sq_status',STATUSES,'Received')}</div>
      <div><label>Blocker</label>${select('sq_blocker',BLOCKERS,'None')}</div>
      <div><label>Expected GP</label>${input('sq_gp',0,'number')}</div>
      <div><label>Owner</label>${select('sq_owner',ownerOptions(),'Unassigned')}</div>
      <div style="grid-column:1/-1"><label>Next Action</label>${input('sq_next','')}</div>
      <div style="grid-column:1/-1"><button class="btn primary" onclick="ScriptLift.addScript()">Add Script</button></div>
    </div>`;
  }

  function addScript(){
    const s = state();
    s.scripts = s.scripts || [];
    s.scripts.push({
      scriptId: $('sq_id')?.value || 'SCRIPT-' + Date.now(),
      receivedDate: $('sq_date')?.value || today(),
      location: $('sq_location')?.value || '',
      doctor: $('sq_doctor')?.value || '',
      payer: $('sq_payer')?.value || '',
      drugClass: $('sq_class')?.value || '',
      status: $('sq_status')?.value || 'Received',
      blocker: $('sq_blocker')?.value || 'None',
      expectedGp: $('sq_gp')?.value || 0,
      owner: $('sq_owner')?.value || 'Unassigned',
      nextAction: $('sq_next')?.value || '',
      created: new Date().toISOString()
    });
    save(s); toast('Script added'); render();
  }

  function updateScript(idx){
    const s = state();
    const r = s.scripts[idx];
    if(!r) return;
    const newStatus = prompt('Status', r.status || 'Received');
    if(newStatus === null) return;
    const newBlocker = prompt('Blocker', r.blocker || 'None');
    if(newBlocker === null) return;
    const next = prompt('Next action', r.nextAction || '');
    if(next === null) return;
    r.status = newStatus;
    r.blocker = newBlocker;
    r.nextAction = next;
    r.updated = new Date().toISOString();
    save(s); toast('Script updated'); render();
  }

  function deleteScript(idx){
    if(!confirm('Delete this script row?')) return;
    const s = state();
    s.scripts.splice(idx,1);
    save(s); render();
  }

  function applyScriptFilters(){
    const s = state();
    s.filters = s.filters || {};
    s.filters.status = $('script_filter_status')?.value || 'All';
    s.filters.blocker = $('script_filter_blocker')?.value || 'All';
    s.filters.owner = $('script_filter_owner')?.value || 'All';
    s.filters.sort = $('script_filter_sort')?.value || 'Priority';
    save(s); render();
  }

  function seedFromPioneer(){
    const b = base();
    const rows = ((b.imports || {}).pioneer || []).slice(-100);
    if(!rows.length) return toast('No PioneerRx import rows found. Use Import QA or Setup demo data first.');
    const s = state();
    const existing = new Set((s.scripts || []).map(x => String(x.scriptId)));
    let added = 0;
    rows.forEach((r, i) => {
      const id = r.rxNumber || r.scriptId || r.rxId || ('PIONEER-' + i + '-' + Date.now());
      if(existing.has(String(id))) return;
      const gp = n(r.grossProfit) || n(r.revenue) - n(r.cogs);
      const status = String(r.status || '').toLowerCase().includes('abandon') ? 'Abandoned' : String(r.status || '').toLowerCase().includes('fill') ? 'Delivered / Picked Up' : r.paStatus ? 'PA Submitted' : 'Received';
      const blocker = r.rejectCode ? 'Payer Rejection' : r.paStatus && r.paStatus !== 'Approved' ? 'PA' : 'None';
      s.scripts.push({ scriptId:id, receivedDate:(r.date || today()).slice(0,10), location:r.location||'', doctor:r.doctor||'', payer:r.payer||r.payerType||'', drugClass:r.drugClass||'', status, blocker, expectedGp:gp, owner:'Unassigned', nextAction:blocker==='None'?'Move to next workflow step':'Resolve ' + blocker, source:'PioneerRx' });
      added++;
    });
    save(s); toast('Seeded ' + added + ' script rows'); render();
  }

  function createActionFromScript(idx){
    const s = state();
    const r = s.scripts[idx];
    if(!r) return;
    const o = ops();
    o.actions = o.actions || [];
    o.actions.push({
      title: 'Resolve script ' + (r.scriptId || ''),
      owner: r.owner || 'Unassigned',
      team: 'Pharmacy Ops',
      metric: 'Script Work Queue',
      priority: scriptAge(r) >= 3 || n(r.expectedGp) >= 100 ? 'High' : 'Medium',
      due: today(),
      status: 'Open',
      tags: [r.location,r.doctor,r.blocker,r.drugClass].filter(Boolean).join(', '),
      created: today(),
      source: 'Script Queue',
      notes: 'Status: ' + (r.status || '') + '. Blocker: ' + (r.blocker || '') + '. Next action: ' + (r.nextAction || '')
    });
    saveOps(o); toast('Action created from script');
  }

  function liftSummary(){
    const rows = state().lift || [];
    const opp = rows.reduce((a,r) => a + n(r.gpDelta), 0);
    const captured = rows.filter(r => r.outcome === 'Accepted' || r.outcome === 'Captured').reduce((a,r) => a + n(r.gpDelta), 0);
    const missed = rows.filter(r => r.outcome === 'Rejected' || r.outcome === 'Ignored').reduce((a,r) => a + n(r.gpDelta), 0);
    const patientSavings = rows.reduce((a,r) => a + Math.max(0, -n(r.patientOopDelta)), 0);
    const payerSavings = rows.reduce((a,r) => a + Math.max(0, -n(r.payerCostDelta)), 0);
    const acceptance = rows.length ? rows.filter(r => r.outcome === 'Accepted' || r.outcome === 'Captured').length / rows.length * 100 : 0;
    return { rows: rows.length, opp, captured, missed, patientSavings, payerSavings, acceptance };
  }

  function renderLift(){
    const el = $('view-lift'); if(!el) return;
    const s = state();
    const m = liftSummary();
    const rows = (s.lift || []).slice().sort((a,b) => n(b.gpDelta) - n(a.gpDelta)).map((r,i) => [
      esc(r.liftId || ''), esc(r.scriptId || ''), esc(r.location || ''), esc(r.doctor || ''), esc(r.originalDrug || ''), esc(r.recommendedDrug || ''),
      money(r.gpDelta), money(r.patientOopDelta), money(r.payerCostDelta), pct(r.confidence || 0), badge(r.outcome || 'Open', liftOutcomeType(r.outcome)), esc(r.reason || ''),
      `<button class="btn" onclick="ScriptLift.updateLift(${i})">Update</button> <button class="btn blue" onclick="ScriptLift.createActionFromLift(${i})">Action</button> <button class="btn red" onclick="ScriptLift.deleteLift(${i})">Delete</button>`
    ]);

    el.innerHTML = `
      <div class="feature-hero"><h2>Lift Opportunity Dashboard</h2><p>Manual Lift import today, API integration later. Track recommendations, GP captured, patient savings, payer savings, and override reasons.</p></div>
      <div class="kpi-band">
        ${metric('Lift Opportunities', num(m.rows), 'recommendations')}
        ${metric('GP Opportunity', money(m.opp), 'total GP delta')}
        ${metric('GP Captured', money(m.captured), 'accepted/captured')}
        ${metric('Patient Savings', money(m.patientSavings), 'negative OOP delta')}
        ${metric('Acceptance Rate', pct(m.acceptance), 'accepted / total', m.acceptance>=60?'good':'warn')}
      </div>
      <div class="feature-grid two">
        <div class="card"><h2 style="margin-top:0">Import Lift CSV/JSON</h2><p class="muted">Expected columns: liftId, scriptId, location, doctor, originalDrug, recommendedDrug, gpDelta, patientOopDelta, payerCostDelta, confidence, outcome, reason.</p><input id="lift_file" type="file" accept=".csv,.json"><button class="btn primary" onclick="ScriptLift.importLift()">Import Lift File</button></div>
        <div class="card"><h2 style="margin-top:0">Add Lift Opportunity</h2>${liftForm()}</div>
      </div>
      <h2>Lift Opportunities</h2>
      ${table(['Lift ID','Script','Location','Doctor','Original','Recommended','GP Δ','Patient OOP Δ','Payer Cost Δ','Confidence','Outcome','Reason',''], rows)}
      <h2>Override Reasons</h2>
      ${renderOverrideReasons()}
    `;
  }

  function liftForm(){
    return `<div class="form-table lift-mini-form">
      <label>Script ID</label>${input('lift_script','')}
      <label>Recommended Drug</label>${input('lift_rec','')}
      <label>GP Delta</label>${input('lift_gp',0,'number')}
      <label>Patient OOP Delta</label>${input('lift_oop',0,'number')}
      <label>Payer Cost Delta</label>${input('lift_payer',0,'number')}
      <label>Confidence %</label>${input('lift_conf',75,'number')}
      <label>Outcome</label>${select('lift_outcome',['Open','Accepted','Captured','Rejected','Ignored'],'Open')}
      <button class="btn blue" onclick="ScriptLift.addLift()">Add Lift</button>
    </div>`;
  }

  function liftOutcomeType(outcome){
    if(['Accepted','Captured'].includes(outcome)) return 'good';
    if(['Rejected','Ignored'].includes(outcome)) return 'bad';
    return 'warn';
  }

  function renderOverrideReasons(){
    const by = {};
    (state().lift || []).forEach(r => {
      if(!['Rejected','Ignored'].includes(r.outcome)) return;
      const k = r.reason || 'No reason captured';
      by[k] = by[k] || { count:0, gp:0 };
      by[k].count++;
      by[k].gp += n(r.gpDelta);
    });
    const rows = Object.entries(by).sort((a,b) => b[1].gp - a[1].gp).map(([k,v]) => [esc(k), num(v.count), money(v.gp)]);
    return table(['Reason','Count','Missed GP'], rows);
  }

  function addLift(){
    const s = state();
    s.lift = s.lift || [];
    s.lift.push({ liftId:'LIFT-' + Date.now(), scriptId:$('lift_script')?.value || '', recommendedDrug:$('lift_rec')?.value || '', gpDelta:$('lift_gp')?.value || 0, patientOopDelta:$('lift_oop')?.value || 0, payerCostDelta:$('lift_payer')?.value || 0, confidence:$('lift_conf')?.value || 0, outcome:$('lift_outcome')?.value || 'Open', date:today() });
    save(s); toast('Lift opportunity added'); render();
  }

  function updateLift(idx){
    const s = state();
    const r = s.lift[idx];
    if(!r) return;
    const outcome = prompt('Outcome: Open, Accepted, Captured, Rejected, Ignored', r.outcome || 'Open');
    if(outcome === null) return;
    const reason = prompt('Reason / override note', r.reason || '');
    if(reason === null) return;
    r.outcome = outcome;
    r.reason = reason;
    r.updated = new Date().toISOString();
    save(s); toast('Lift opportunity updated'); render();
  }

  function deleteLift(idx){
    if(!confirm('Delete this Lift opportunity?')) return;
    const s = state();
    s.lift.splice(idx,1);
    save(s); render();
  }

  function createActionFromLift(idx){
    const s = state();
    const r = s.lift[idx];
    if(!r) return;
    const o = ops();
    o.actions = o.actions || [];
    o.actions.push({ title:'Review Lift opportunity ' + (r.liftId || ''), owner:'Unassigned', team:'Pharmacy Ops', metric:'Lift Opportunity', priority:n(r.gpDelta)>=100?'High':'Medium', due:today(), status:'Open', tags:[r.scriptId,r.doctor,r.location].filter(Boolean).join(', '), created:today(), source:'Lift', notes:'Recommended: ' + (r.recommendedDrug || '') + '. GP delta: ' + money(r.gpDelta) });
    saveOps(o); toast('Action created from Lift opportunity');
  }

  function parseCSV(text){
    const rows=[]; let row=[], cell='', q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], nx=text[i+1];
      if(ch==='"' && q && nx==='"'){ cell+='"'; i++; }
      else if(ch==='"') q=!q;
      else if(ch===',' && !q){ row.push(cell); cell=''; }
      else if((ch==='\n'||ch==='\r') && !q){ if(ch==='\r'&&nx==='\n') i++; row.push(cell); if(row.some(x=>x!=='')) rows.push(row); row=[]; cell=''; }
      else cell+=ch;
    }
    row.push(cell); if(row.some(x=>x!=='')) rows.push(row);
    const h = rows.shift() || [];
    return rows.map(r => Object.fromEntries(h.map((x,i) => [x.trim(), r[i] ?? ''])));
  }
  function get(r,...ks){
    for(const k of ks){ const h = Object.keys(r).find(x => x.toLowerCase().replaceAll(' ','') === k.toLowerCase().replaceAll(' ','')); if(h != null) return r[h]; }
    return '';
  }

  async function importLift(){
    const file = $('lift_file')?.files?.[0];
    if(!file) return toast('Choose a Lift file first');
    let raw=[];
    try{
      const text = await file.text();
      raw = file.name.endsWith('.json') ? (JSON.parse(text).rows || JSON.parse(text).data || JSON.parse(text)) : parseCSV(text);
    } catch(e){ toast('Could not parse Lift file'); return; }
    const rows = raw.map(r => ({ liftId:get(r,'liftId','recommendationId') || 'LIFT-' + Date.now() + '-' + Math.random().toString(16).slice(2), scriptId:get(r,'scriptId','rxId','rxNumber'), location:get(r,'location'), doctor:get(r,'doctor','prescriber'), originalDrug:get(r,'originalDrug','drug'), recommendedDrug:get(r,'recommendedDrug','recommendation'), gpDelta:get(r,'gpDelta','grossProfitDelta'), patientOopDelta:get(r,'patientOopDelta','oopDelta'), payerCostDelta:get(r,'payerCostDelta'), confidence:get(r,'confidence','confidenceScore'), outcome:get(r,'outcome') || 'Open', reason:get(r,'reason','overrideReason'), date:get(r,'date') || today() }));
    const s = state();
    s.lift = (s.lift || []).concat(rows);
    save(s); toast('Imported ' + rows.length + ' Lift opportunities'); render();
  }

  function renderScriptOps(){
    const el = $('view-scriptops'); if(!el) return;
    const s = state();
    const scripts = s.scripts || [];
    const byStatus = countBy(scripts, r => r.status || 'Unknown');
    const byBlocker = countBy(scripts.filter(r => r.blocker && r.blocker !== 'None'), r => r.blocker || 'Unknown');
    const byAge = countBy(scripts.filter(r => !['Delivered / Picked Up','Abandoned','Reversed'].includes(r.status)), r => ageBucket(scriptAge(r)));
    const highGpStuck = scripts.filter(r => r.blocker && r.blocker !== 'None').sort((a,b) => n(b.expectedGp)-n(a.expectedGp)).slice(0,10).map(r => [esc(r.scriptId), esc(r.doctor), badge(r.blocker,'warn'), money(r.expectedGp), esc(r.owner || 'Unassigned'), esc(r.nextAction || '')]);

    el.innerHTML = `
      <div class="feature-hero"><h2>Script Ops Control Tower</h2><p>Where are scripts stuck, what GP is at risk, and what queue should the team attack first?</p></div>
      <div class="feature-grid three">
        <div class="card"><h2 style="margin-top:0">By Status</h2>${simpleBars(byStatus)}</div>
        <div class="card"><h2 style="margin-top:0">By Blocker</h2>${simpleBars(byBlocker)}</div>
        <div class="card"><h2 style="margin-top:0">By Age</h2>${simpleBars(byAge)}</div>
      </div>
      <h2>Highest GP Stuck Scripts</h2>
      ${table(['Script','Doctor','Blocker','Expected GP','Owner','Next Action'], highGpStuck)}
      <h2>Recommended Operating Moves</h2>
      <div class="action-list">${scriptMoves().map(m => `<div class="action-item ${m[0]}"><div class="action-title">${esc(m[1])}</div><div class="action-copy">${esc(m[2])}</div></div>`).join('')}</div>
    `;
  }

  function countBy(rows, fn){
    const out = {};
    rows.forEach(r => { const k = fn(r); out[k] = (out[k] || 0) + 1; });
    return out;
  }
  function simpleBars(obj){
    const entries = Object.entries(obj).sort((a,b) => b[1]-a[1]);
    if(!entries.length) return '<div class="empty-state"><b>No data</b>No matching rows.</div>';
    const max = Math.max(...entries.map(x => x[1]), 1);
    return `<div class="funnel-card">${entries.map(([k,v]) => `<div class="funnel-row"><div class="funnel-row-top"><span>${esc(k)}</span><span>${num(v)}</span></div><div class="funnel-bar"><div class="funnel-fill blue" style="width:${Math.max(3,v/max*100)}%"></div></div></div>`).join('')}</div>`;
  }
  function scriptMoves(){
    const rows = state().scripts || [];
    const pa = rows.filter(r => r.blocker === 'PA').length;
    const patient = rows.filter(r => r.blocker === 'Patient Unreachable').length;
    const high = rows.filter(r => r.blocker && r.blocker !== 'None' && n(r.expectedGp) >= 100).length;
    const old = rows.filter(r => !['Delivered / Picked Up','Abandoned','Reversed'].includes(r.status) && scriptAge(r) >= 3).length;
    const out=[];
    if(high) out.push(['red','Attack high-GP stuck scripts first',`${high} stuck scripts have expected GP of $100+. Assign owners today.`]);
    if(pa) out.push(['amber','Run the PA factory playbook',`${pa} scripts are blocked by PA. Sort by payer and oldest age.`]);
    if(patient) out.push(['amber','Run patient contact rescue',`${patient} scripts are blocked by patient contact. Use call/text/delivery coordination.`]);
    if(old) out.push(['red','Clear 72h+ queue',`${old} open scripts are older than 72 hours. These are at high abandonment risk.`]);
    if(!out.length) out.push(['green','Queue looks clean','No major script queue issue detected. Keep statuses current.']);
    return out;
  }

  function render(){ ensureViews(); ensureTabs(); renderScripts(); renderLift(); renderScriptOps(); }

  window.ScriptLift = { render, show, addScript, updateScript, deleteScript, applyScriptFilters, seedFromPioneer, createActionFromScript, addLift, updateLift, deleteLift, createActionFromLift, importLift };

  const oldRender = window.render;
  if(typeof oldRender === 'function'){
    window.render = function(){ const out = oldRender.apply(this, arguments); setTimeout(render, 0); return out; };
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 2500));
  setInterval(render, 9000);
})();
