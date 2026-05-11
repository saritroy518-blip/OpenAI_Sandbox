/* Grouped Navigation Layer: reorganizes the many tabs into operating sections. */
(function(){
  'use strict';

  const GROUPS = [
    {name:'Run Today', ids:['command','mobileceo','daily','scripts','worklists','actions','bulkops','meeting','forecast','analytics','trends','insights','setup']},
    {name:'Finance', ids:['reconcile','costledger','forecast','pnlcost','ledgers','finance','budget','scenario','close','backup','capitalpack','ownerecon','channelecon']},
    {name:'Sales / Doctors', ids:['channelecon','doctors','doctorprofiles','tiers','pipeline','cohorts']},
    {name:'Enterprise', ids:['enterprise','enterpriseprofiles','reports','partnercard','lift','channelecon']},
    {name:'Ops', ids:['scriptops','bulkops','forecast','pa','retention','delivery','drugs','locations','locationprofiles','leaderboard','playbooks']},
    {name:'People / Actions', ids:['people','actions','bulkops','ownerdash','heatmap','teams']},
    {name:'Reports', ids:['reconcile','forecast','analytics','costledger','channelecon','history','dataqa','importqa','maturity','qatest']},
    {name:'Admin', ids:['search','risks','dictionary','admin','settings','channels','imports']}
  ];

  const LABELS = {
    command:'Command Center', mobileceo:'CEO Mobile', daily:'Daily Entry', scripts:'Script Queue', worklists:'Worklists', actions:'Actions', bulkops:'Bulk Ops', meeting:'Meeting Mode', forecast:'Forecast Engine', analytics:'Analytics + Trends', trends:'Trends', insights:'CEO Brief', setup:'Setup Wizard',
    reconcile:'Reconciliation + Close', costledger:'Cost Attribution Ledger', pnlcost:'P&L Cost Bridge', ledgers:'Finance + Forecast', finance:'Finance', budget:'Budget', scenario:'Scenario', close:'Monthly Close', backup:'Backup', capitalpack:'Capital Pack', ownerecon:'Owner Economics', channelecon:'Channel Economics',
    doctors:'Doctors', doctorprofiles:'Doctor Profiles', tiers:'Doctor Tiers', pipeline:'Pipeline', cohorts:'Cohorts',
    enterprise:'Enterprise', enterpriseprofiles:'Account Profiles', reports:'Reports', partnercard:'Partner Scorecard', lift:'Lift',
    scriptops:'Script Ops', pa:'PA Intelligence', retention:'Retention + DSOH', delivery:'Delivery', drugs:'Drug Mix', locations:'Locations', locationprofiles:'Location Profiles', leaderboard:'Leaderboard', playbooks:'Playbooks',
    people:'People', ownerdash:'Owner Dashboards', heatmap:'Team Heatmap', teams:'Teams + OKRs',
    history:'History', dataqa:'Data QA', importqa:'Import QA', maturity:'Maturity', qatest:'QA Self-Test',
    search:'Search', risks:'Risks', dictionary:'Dictionary', admin:'Admin', settings:'Settings', channels:'Channels', imports:'Import Center'
  };

  function nav(){return document.getElementById('nav')}
  function getId(btn){return btn.dataset.v || btn.dataset.view}
  function allSourceButtons(){const n=nav(); return n ? Array.from(n.querySelectorAll('button[data-v],button[data-view]')).filter(b=>!b.closest('.grouped-nav-shell')) : []}
  function clickOriginal(id){const btn=allSourceButtons().find(b=>getId(b)===id); if(btn) btn.click();}
  function availableIds(){return new Set(allSourceButtons().map(getId).filter(Boolean))}
  function labelFor(id){return LABELS[id] || id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}

  function build(){
    const n=nav(); if(!n) return;
    const ids=availableIds();
    if(!ids.size) return;
    let shell=document.getElementById('groupedNavShell');
    if(!shell){shell=document.createElement('div');shell.id='groupedNavShell';shell.className='grouped-nav-shell';n.prepend(shell);}
    allSourceButtons().forEach(b=>b.classList.add('nav-source-hidden'));
    const active=document.querySelector('#nav button.active');
    const activeId=active ? getId(active) : 'command';
    const activeLabel=labelFor(activeId);
    const groupsHtml=GROUPS.map(group=>{
      const groupIds=[...new Set(group.ids.filter(id=>ids.has(id)))];
      if(!groupIds.length) return '';
      const isActive=groupIds.includes(activeId);
      return `<div class="nav-group ${isActive?'active-group':''}" data-group="${group.name}"><button class="nav-group-title ${isActive?'active':''}" type="button">${group.name}</button><div class="nav-group-menu">${groupIds.map(id=>`<button class="nav-item-btn ${id===activeId?'active':''}" type="button" data-jump="${id}">${labelFor(id)}</button>`).join('')}</div></div>`;
    }).join('');
    shell.innerHTML=`<div class="grouped-nav-toolbar"><div class="quick-search-wrap"><input id="quickNavSearch" class="grouped-nav-search" placeholder="Jump to page..." autocomplete="off" /><div id="quickSearchResults" class="quick-search-results"></div></div><div class="grouped-nav-current">Current: ${activeLabel}</div></div><div class="grouped-nav-grid">${groupsHtml}</div>`;
    shell.querySelectorAll('.nav-group-title').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();const group=btn.closest('.nav-group');shell.querySelectorAll('.nav-group').forEach(g=>{if(g!==group)g.classList.remove('open')});group.classList.toggle('open');};});
    shell.querySelectorAll('[data-jump]').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();clickOriginal(btn.dataset.jump);shell.querySelectorAll('.nav-group').forEach(g=>g.classList.remove('open'));setTimeout(build,50);};});
    document.addEventListener('click', e=>{ if(!e.target.closest('#groupedNavShell')) shell.querySelectorAll('.nav-group').forEach(g=>g.classList.remove('open')); }, {once:true});
    setupQuickSearch(ids);
  }
  function setupQuickSearch(ids){
    const input=document.getElementById('quickNavSearch'), results=document.getElementById('quickSearchResults');
    if(!input||!results) return;
    const items=[];GROUPS.forEach(g=>g.ids.forEach(id=>{if(ids.has(id)&&!items.find(x=>x.id===id))items.push({id,label:labelFor(id),group:g.name})}));
    input.oninput=()=>{const q=input.value.trim().toLowerCase();if(!q){results.classList.remove('open');results.innerHTML='';return;}const matches=items.filter(x=>(x.label+' '+x.group+' '+x.id).toLowerCase().includes(q)).slice(0,12);results.innerHTML=matches.map(x=>`<button class="quick-result" type="button" data-jump="${x.id}"><strong>${x.label}</strong><span>${x.group}</span></button>`).join('') || `<div class="quick-result"><strong>No matches</strong><span>Try a different page name.</span></div>`;results.classList.add('open');results.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>{clickOriginal(btn.dataset.jump);input.value='';results.classList.remove('open');setTimeout(build,50)});};
  }
  const oldRender=window.render;
  if(typeof oldRender==='function'){window.render=function(){const out=oldRender.apply(this,arguments);setTimeout(build,100);return out;};}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(build,1800));
  setInterval(build,5000);
})();
