/* OnPoint Insights Layer: trends, anomalies, CEO brief, concentration, payer mix. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  const daysAgo=d=>{let x=new Date();x.setDate(x.getDate()-d);return x.toISOString().slice(0,10)};

  function base(){try{return JSON.parse(localStorage.getItem(BASE_KEY))||{manual:{},imports:{}}}catch(e){return{manual:{},imports:{}}}}
  function ops(){try{return JSON.parse(localStorage.getItem(OPS_KEY))||{actions:[],employees:[],pipeline:[]}}catch(e){return{actions:[],employees:[],pipeline:[]}}}
  function safeCalc(){try{return typeof calc==='function'?calc():{}}catch(e){return{}}}

  function dailyRows(){
    const b=base(), rows=[];
    Object.keys(b.manual||{}).sort().forEach(date=>{
      const r=b.manual[date]||{};
      const revenue=n(r.revenue), cogs=n(r.cogs), gp=revenue-cogs;
      const opsCost=n(r.labor)+n(r.delivery)+n(r.storeOpex);
      const scripts=n(r.scriptsFilled), received=n(r.scriptsReceived);
      rows.push({
        date,revenue,cogs,gp,opsCost,scripts,received,
        fillRate:received?scripts/received*100:0,
        costRx:scripts?opsCost/scripts:0,
        gpRx:scripts?gp/scripts:0,
        adherence:n(r.adherence),
        paBacklog:n(r.paBacklog),
        dsOhRisk:n(r.dsOhRisk),
        cash:n(r.cash),
        reversed:n(r.scriptsReversed),
        abandoned:n(r.scriptsAbandoned),
        newDoctors:n(r.newDoctors),
        activeDoctors:n(r.activeDoctors)
      });
    });
    return rows;
  }

  function importedRows(type){
    const b=base();
    return ((b.imports||{})[type]||[]).filter(Boolean);
  }

  function sumRows(rows){
    const s=rows.reduce((a,r)=>{
      a.revenue+=n(r.revenue);a.gp+=n(r.gp);a.scripts+=n(r.scripts);a.received+=n(r.received);a.opsCost+=n(r.opsCost);a.reversed+=n(r.reversed);a.abandoned+=n(r.abandoned);a.paBacklog+=n(r.paBacklog);a.dsOhRisk+=n(r.dsOhRisk);a.newDoctors+=n(r.newDoctors);return a;
    },{revenue:0,gp:0,scripts:0,received:0,opsCost:0,reversed:0,abandoned:0,paBacklog:0,dsOhRisk:0,newDoctors:0});
    s.fillRate=s.received?s.scripts/s.received*100:0;
    s.gpRx=s.scripts?s.gp/s.scripts:0;
    s.costRx=s.scripts?s.opsCost/s.scripts:0;
    s.gpDay=rows.length?s.gp/rows.length:0;
    s.scriptsDay=rows.length?s.scripts/rows.length:0;
    s.cashEnd=rows.length?n(rows[rows.length-1].cash):0;
    s.adherence=avg(rows.map(r=>r.adherence).filter(Boolean));
    return s;
  }

  function avg(arr){return arr.length?arr.reduce((a,b)=>a+n(b),0)/arr.length:0}
  function windowRows(days){const from=daysAgo(days);return dailyRows().filter(r=>r.date>=from)}
  function delta(now,prior){if(!prior)return 0;return (now-prior)/Math.abs(prior)*100}

  function metric(label,value,sub='',cls=''){
    return `<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
  }
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No data yet</b>Save daily entries or import data to build this trend.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}

  function ensureViews(){
    const main=document.querySelector('.main'); if(!main)return;
    ['trends','insights'].forEach(id=>{if(!$('view-'+id)){const s=document.createElement('section');s.id='view-'+id;s.className='view';main.appendChild(s)}});
  }
  function ensureTabs(){
    const nav=$('nav'); if(!nav)return;
    [['trends','Trends'],['insights','CEO Brief']].forEach(([id,label])=>{
      if(nav.querySelector(`[data-v="${id}"], [data-view="${id}"]`))return;
      const b=document.createElement('button');b.dataset.v=id;b.textContent=label;b.onclick=()=>show(id);nav.appendChild(b);
    });
  }
  function show(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    $('view-'+id)?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));
    const title=$('pageTitle'); if(title)title.textContent=id==='trends'?'Trends':'CEO Brief';
    render(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderTrends(){
    const el=$('view-trends'); if(!el)return;
    const r7=sumRows(windowRows(7)), r30=sumRows(windowRows(30)), r90=sumRows(windowRows(90));
    const all=dailyRows().slice(-30);
    el.innerHTML=`
      <div class="feature-hero"><h2>Operating Trends</h2><p>Momentum matters. The point is not just today’s number — it is whether the machine is getting better or worse.</p></div>
      <div class="kpi-band">
        ${metric('7D GP/Day',money(r7.gpDay),'gross profit velocity',r7.gpDay>=r30.gpDay?'good':'bad')}
        ${metric('7D Scripts/Day',num(r7.scriptsDay),'script velocity',r7.scriptsDay>=r30.scriptsDay?'good':'warn')}
        ${metric('30D GP/Rx',money(r30.gpRx),'value per script')}
        ${metric('30D Cost/Rx',money(r30.costRx),'cost efficiency',r30.costRx<=10?'good':'warn')}
        ${metric('30D Fill Rate',pct(r30.fillRate),'scripts filled / received',r30.fillRate>=90?'good':'bad')}
      </div>
      <h2>7 / 30 / 90 Day Rollup</h2>
      ${table(['Window','Revenue','GP','Scripts','Fill Rate','GP/Rx','Cost/Rx','Adherence','PA Backlog','DSOH Risk'],[
        ['7 days',money(r7.revenue),money(r7.gp),num(r7.scripts),pct(r7.fillRate),money(r7.gpRx),money(r7.costRx),pct(r7.adherence),num(r7.paBacklog),num(r7.dsOhRisk)],
        ['30 days',money(r30.revenue),money(r30.gp),num(r30.scripts),pct(r30.fillRate),money(r30.gpRx),money(r30.costRx),pct(r30.adherence),num(r30.paBacklog),num(r30.dsOhRisk)],
        ['90 days',money(r90.revenue),money(r90.gp),num(r90.scripts),pct(r90.fillRate),money(r90.gpRx),money(r90.costRx),pct(r90.adherence),num(r90.paBacklog),num(r90.dsOhRisk)]
      ])}
      <h2>Daily Trend Table</h2>
      ${table(['Date','Revenue','GP','Scripts','Fill Rate','GP/Rx','Cost/Rx','Adherence','PA','DSOH','Cash'],all.map(r=>[esc(r.date),money(r.revenue),money(r.gp),num(r.scripts),pct(r.fillRate),money(r.gpRx),money(r.costRx),pct(r.adherence),num(r.paBacklog),num(r.dsOhRisk),money(r.cash)]))}
      <h2>Trend Interpretation</h2>
      <div class="action-list">${trendInterpretation(r7,r30).map(x=>`<div class="action-item ${x[0]}"><div class="action-title">${esc(x[1])}</div><div class="action-copy">${esc(x[2])}</div></div>`).join('')}</div>
    `;
  }

  function trendInterpretation(r7,r30){
    const out=[];
    if(r7.gpDay>r30.gpDay)out.push(['green','GP velocity improving',`7-day GP/day is ${money(r7.gpDay)} vs 30-day ${money(r30.gpDay)}.`]);
    else if(r30.gpDay)out.push(['amber','GP velocity slowing',`7-day GP/day is ${money(r7.gpDay)} vs 30-day ${money(r30.gpDay)}. Check volume, GP/Rx, and payer mix.`]);
    if(r7.costRx>r30.costRx && r30.costRx)out.push(['amber','Cost/Rx is worsening',`7-day cost/Rx is ${money(r7.costRx)} vs 30-day ${money(r30.costRx)}. Look at labor, delivery, and low-volume locations.`]);
    if(r7.fillRate<r30.fillRate && r30.fillRate)out.push(['red','Fill rate is slipping',`7-day fill rate is ${pct(r7.fillRate)} vs 30-day ${pct(r30.fillRate)}. Check stuck scripts and PA.`]);
    if(!out.length)out.push(['green','No major negative trend detected','The current trend data does not show obvious deterioration. Keep adding daily data.']);
    return out;
  }

  function renderInsights(){
    const el=$('view-insights'); if(!el)return;
    const c=safeCalc(), rows=dailyRows(), r7=sumRows(windowRows(7)), r30=sumRows(windowRows(30));
    const anomalies=detectAnomalies(c,r7,r30);
    const doctors=doctorConcentration();
    const payers=payerMix();
    el.innerHTML=`
      <div class="feature-hero"><h2>CEO Brief</h2><p>Plain-English operating interpretation. What changed, what is risky, what deserves action, and what to ask the team.</p></div>
      <div class="kpi-band">
        ${metric('Current GP',money(c.gp||0),'current selected period')}
        ${metric('Current Fill Rate',pct(c.fill||c.fillRate||0),'execution')}
        ${metric('Current Cost/Rx',money(c.costRx||0),'efficiency')}
        ${metric('Open Actions',num((ops().actions||[]).filter(a=>a.status!=='Done').length),'accountability')}
        ${metric('Weighted Pipeline',money((ops().pipeline||[]).reduce((a,r)=>a+n(r.expectedGp)*n(r.probability)/100,0)),'future GP')}
      </div>
      <h2>CEO Summary</h2>
      <div class="card"><p>${esc(ceoSummary(c,r7,r30))}</p></div>
      <h2>Anomalies</h2>
      <div class="action-list">${anomalies.map(a=>`<div class="action-item ${a[0]}"><div class="action-title">${esc(a[1])}</div><div class="action-copy">${esc(a[2])}</div></div>`).join('')}</div>
      <h2>Doctor Concentration Risk</h2>
      ${table(['Doctor','Scripts','GP','% of Doctor GP','Risk'],doctors.rows)}
      <h2>Payer Mix</h2>
      ${table(['Payer','Scripts','Revenue','GP','GP/Rx'],payers.rows)}
      <h2>Leakage Waterfall</h2>
      ${leakageWaterfall(c)}
    `;
  }

  function ceoSummary(c,r7,r30){
    const parts=[];
    if(n(c.gp)>0)parts.push(`The business generated ${money(c.gp)} of GP in the selected period at ${money(c.gpRx||0)} GP/Rx.`);
    else parts.push('There is not enough gross profit data yet. Enter daily revenue and COGS or import summary data.');
    if(n(c.fill||c.fillRate)<90)parts.push(`Fill rate is weak at ${pct(c.fill||c.fillRate||0)}, so the first question is where scripts are getting stuck.`);
    if(n(c.costRx)>10)parts.push(`Cost/Rx is ${money(c.costRx)}, so efficiency needs attention before volume hides the problem.`);
    if(n(c.paBacklog)>0)parts.push(`${num(c.paBacklog)} scripts are in PA backlog; this is likely invisible leakage.`);
    if(n(c.dsOhRisk)>0)parts.push(`${num(c.dsOhRisk)} patients are near therapy gap; retention work should happen today.`);
    if(r7.gpDay && r30.gpDay)parts.push(`7-day GP/day is ${money(r7.gpDay)} vs 30-day ${money(r30.gpDay)}.`);
    return parts.join(' ');
  }

  function detectAnomalies(c,r7,r30){
    const out=[];
    if(n(c.revenue)>0 && n(c.gp)<=0)out.push(['red','Revenue without GP','Revenue is showing but GP is zero or negative. Check COGS, import mapping, or low-margin claims.']);
    if(n(c.scriptsReceived)>0 && n(c.scriptsFilled)>n(c.scriptsReceived))out.push(['red','Filled scripts exceed received','This may be legitimate timing, but it usually means the period or import source is mismatched.']);
    if(n(c.gpRx)>0 && n(c.gpRx)<20)out.push(['amber','Low GP/Rx','GP/Rx is below $20. Check payer mix, DIR, reimbursement, and drug mix.']);
    if(n(c.costRx)>n(c.gpRx) && n(c.gpRx)>0)out.push(['red','Cost/Rx exceeds GP/Rx','The operating model is losing money per script before corporate costs.']);
    if(n(c.cash)<(n(c.ap)+n(c.debt)) && (n(c.ap)+n(c.debt)>0))out.push(['red','Cash coverage risk','Cash is below AP plus debt due. Build cash triage immediately.']);
    if(r7.fillRate<r30.fillRate-5 && r30.fillRate)out.push(['amber','Fill-rate trend down','7-day fill rate is more than 5 points below the 30-day rate.']);
    if(!out.length)out.push(['green','No major anomalies','No obvious anomaly from the current data. More daily history will improve this.']);
    return out;
  }

  function doctorConcentration(){
    const rows=importedRows('pioneer');
    const by={};
    rows.forEach(r=>{const k=r.doctor||'Unknown';by[k]=by[k]||{scripts:0,gp:0};by[k].scripts++;by[k].gp+=n(r.grossProfit)||n(r.revenue)-n(r.cogs)});
    const total=Object.values(by).reduce((a,r)=>a+r.gp,0);
    const out=Object.entries(by).sort((a,b)=>b[1].gp-a[1].gp).slice(0,10).map(([k,r])=>{const share=total?r.gp/total*100:0;return[esc(k),num(r.scripts),money(r.gp),pct(share),share>25?badge('High concentration','bad'):share>10?badge('Watch','warn'):badge('Normal','good')]});
    return{rows:out};
  }

  function payerMix(){
    const rows=importedRows('pioneer');
    const by={};
    rows.forEach(r=>{const k=r.payer||r.payerType||'Unknown';by[k]=by[k]||{scripts:0,revenue:0,gp:0};by[k].scripts++;by[k].revenue+=n(r.revenue);by[k].gp+=n(r.grossProfit)||n(r.revenue)-n(r.cogs)});
    const out=Object.entries(by).sort((a,b)=>b[1].gp-a[1].gp).slice(0,12).map(([k,r])=>[esc(k),num(r.scripts),money(r.revenue),money(r.gp),money(r.scripts?r.gp/r.scripts:0)]);
    return{rows:out};
  }

  function leakageWaterfall(c){
    const received=n(c.scriptsReceived), reversed=n(c.scriptsReversed), abandoned=n(c.scriptsAbandoned), filled=n(c.scriptsFilled), stuck=n(c.paBacklog||c.scriptsStuck);
    const rows=[['Scripts received',received,'blue'],['Stuck / PA backlog',stuck,'warn'],['Reversed',reversed,'bad'],['Abandoned',abandoned,'bad'],['Filled',filled,'good']];
    const max=Math.max(...rows.map(r=>r[1]),1);
    return `<div class="funnel-card">${rows.map(([label,val,cls])=>`<div class="funnel-row"><div class="funnel-row-top"><span>${esc(label)}</span><span>${num(val)}</span></div><div class="funnel-bar"><div class="funnel-fill ${cls}" style="width:${Math.max(3,val/max*100)}%"></div></div></div>`).join('')}</div>`;
  }

  function render(){ensureViews();ensureTabs();renderTrends();renderInsights();}
  window.InsightsLayer={render,show};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out;}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,900));
  setInterval(render,5000);
})();
