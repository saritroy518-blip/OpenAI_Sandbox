/* OnPoint Forecast Layer: lightweight operational forecasting from local daily data. */
(function(){
  'use strict';
  const BASE_KEY='opdash.pages.v1';
  const SCRIPT_KEY='opdash.scriptqueue.v1';
  const OPS_KEY='opdash.opslayer.v1';
  const $=id=>document.getElementById(id);
  const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=x=>Number(x)||0;
  const money=x=>'$'+Math.round(n(x)).toLocaleString();
  const num=x=>Math.round(n(x)).toLocaleString();
  const pct=x=>isFinite(x)?Number(x).toFixed(1)+'%':'0.0%';
  const today=()=>new Date().toISOString().slice(0,10);
  const addDays=(d,days)=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+days);return x.toISOString().slice(0,10)};
  let historyDays=30;
  let forecastWeeks=13;

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function base(){return read(BASE_KEY,{manual:{},targets:{gpRx:40,costRx:10},cashForecast:[],imports:{pioneer:[],cash:[],intacct:[]}})}
  function scripts(){return read(SCRIPT_KEY,{scripts:[],lift:[]})}
  function ops(){return read(OPS_KEY,{actions:[],employees:[],pipeline:[]})}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No forecast yet</b>Add daily entries to generate a forecast.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}
  function input(id,val,type='number'){return`<input id="${esc(id)}" type="${type}" value="${esc(val??'')}" class="left">`}
  function download(name,text,type='text/plain'){const b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}
  function csvCell(v){return '"'+String(v??'').replaceAll('"','""')+'"'}

  function ensureViews(){const main=document.querySelector('.main');if(!main)return;if(!$('view-forecast')){const s=document.createElement('section');s.id='view-forecast';s.className='view';main.appendChild(s)}}
  function ensureTabs(){const nav=$('nav');if(!nav)return;if(!nav.querySelector('[data-v="forecast"],[data-view="forecast"]')){const b=document.createElement('button');b.dataset.v='forecast';b.textContent='Forecast';b.onclick=()=>show('forecast');nav.appendChild(b)}}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Forecast Engine';render();window.scrollTo({top:0,behavior:'smooth'})}

  function dailyRows(days=historyDays){
    const b=base(), out=[];
    for(let i=days-1;i>=0;i--){
      const d=addDays(today(),-i), r=(b.manual||{})[d]||{};
      const revenue=n(r.revenue), cogs=n(r.cogs), gp=revenue-cogs, scriptsFilled=n(r.scriptsFilled), scriptsReceived=n(r.scriptsReceived);
      const labor=n(r.labor), delivery=n(r.delivery), storeOpex=n(r.storeOpex), salesCost=n(r.salesCost), techCost=n(r.techCost), enterpriseCost=n(r.enterpriseCost), corpCost=n(r.corpCost), dir=n(r.dirExposure), debt=n(r.debtService||r.debtPayment);
      const totalCost=labor+delivery+storeOpex+salesCost+techCost+enterpriseCost+corpCost+dir+debt;
      out.push({date:d,revenue,cogs,gp,scriptsFilled,scriptsReceived,patients:n(r.patients),refillsDue:n(r.refillsDue),refillsCaptured:n(r.refillsCaptured),paBacklog:n(r.paBacklog),paSubmitted:n(r.paSubmitted),paApproved:n(r.paApproved),dsOhRisk:n(r.dsOhRisk),laborHours:n(r.laborHours),labor,delivery,storeOpex,salesCost,techCost,enterpriseCost,corpCost,dir,debt,totalCost,contribution:gp-totalCost,cash:n(r.cash),ap:n(r.ap),ar:n(r.ar)});
    }
    return out;
  }
  function sum(rows,k){return rows.reduce((a,r)=>a+n(r[k]),0)}
  function avg(rows,k){const vals=rows.map(r=>n(r[k])).filter(v=>v!==0);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}
  function lastNonZero(rows,k){for(let i=rows.length-1;i>=0;i--){if(n(rows[i][k]))return n(rows[i][k])}return 0}
  function slope(rows,k){const vals=rows.map((r,i)=>[i,n(r[k])]).filter(p=>p[1]!==0);if(vals.length<4)return 0;const mx=vals.reduce((a,b)=>a+b[0],0)/vals.length,my=vals.reduce((a,b)=>a+b[1],0)/vals.length;let num=0,den=0;vals.forEach(p=>{num+=(p[0]-mx)*(p[1]-my);den+=Math.pow(p[0]-mx,2)});return den?num/den:0}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function assumptions(){
    const rows=dailyRows(historyDays), recent=rows.slice(-14), all=rows;
    const scriptsPerDay=avg(recent,'scriptsFilled')||avg(all,'scriptsFilled');
    const gpRx=(sum(recent,'scriptsFilled')?sum(recent,'gp')/sum(recent,'scriptsFilled'):0)||(sum(all,'scriptsFilled')?sum(all,'gp')/sum(all,'scriptsFilled'):n(base().targets?.gpRx||40));
    const costRx=(sum(recent,'scriptsFilled')?sum(recent,'totalCost')/sum(recent,'scriptsFilled'):0)||(sum(all,'scriptsFilled')?sum(all,'totalCost')/sum(all,'scriptsFilled'):n(base().targets?.costRx||10));
    const cash=lastNonZero(rows,'cash');
    const ap=lastNonZero(rows,'ap'), ar=lastNonZero(rows,'ar');
    const weeklyScriptTrend=slope(rows,'scriptsFilled')*7;
    const gpRxTrend=slope(rows,'gp')/(avg(rows,'scriptsFilled')||1);
    return{scriptsPerDay,gpRx,costRx,cash,ap,ar,weeklyScriptTrend,gpRxTrend,paBacklog:avg(recent,'paBacklog')||avg(all,'paBacklog'),dsOhRisk:avg(recent,'dsOhRisk')||avg(all,'dsOhRisk'),laborHoursDay:avg(recent,'laborHours')||avg(all,'laborHours')};
  }

  function forecastRows(){
    const a=assumptions();
    const rows=[];
    let cash=a.cash || 0;
    const manualCash=(base().cashForecast||[]);
    for(let w=1;w<=forecastWeeks;w++){
      const trendFactor=1+clamp((a.weeklyScriptTrend*w)/(Math.max(1,a.scriptsPerDay*7)),-.35,.5);
      const scripts=Math.max(0,Math.round(a.scriptsPerDay*7*trendFactor));
      const gpRx=Math.max(0,a.gpRx+(a.gpRxTrend*w));
      const gp=scripts*gpRx;
      const cost=scripts*a.costRx;
      const net=gp-cost;
      const external=manualCash.filter(r=>r.week==w||r.period==w).reduce((x,r)=>x+n(r.amount),0);
      cash+=net+external;
      rows.push({week:w,scripts,gpRx,gp,cost,net,external,cash,paLoad:Math.round(a.paBacklog+Math.max(0,w-1)*.5),dsOhRisk:Math.round(a.dsOhRisk+Math.max(0,w-1)*.4),laborHours:Math.round(a.laborHoursDay*7*trendFactor)});
    }
    return rows;
  }

  function scenarioRows(){
    const a=assumptions();
    const baseWeeklyScripts=a.scriptsPerDay*7;
    const scenarios=[
      ['Base',0,0,0],
      ['GP/Rx -$2',0,-2,0],
      ['Cost/Rx +$2',0,0,2],
      ['Volume +10%',.10,0,0],
      ['Volume -10%',-.10,0,0],
      ['GP/Rx +$3 and cost/Rx -$1',0,3,-1]
    ];
    return scenarios.map(([name,vol,gpDelta,costDelta])=>{
      const scripts=baseWeeklyScripts*(1+vol), gp=scripts*(a.gpRx+gpDelta), cost=scripts*(a.costRx+costDelta), net=gp-cost;
      return[esc(name),num(scripts),money(a.gpRx+gpDelta),money(a.costRx+costDelta),money(gp),money(cost),money(net),badge(net>=0?'Positive':'Negative',net>=0?'good':'bad')];
    });
  }

  function runway(rows){
    const neg=rows.find(r=>r.cash<0);
    if(neg)return 'Week '+neg.week;
    if(!rows.length)return 'Unknown';
    return 'Beyond '+rows.length+' weeks';
  }

  function staffingRows(forecast){
    const a=assumptions();
    const hoursPerRx=a.scriptsPerDay&&a.laborHoursDay?a.laborHoursDay/a.scriptsPerDay:.08;
    return forecast.slice(0,6).map(r=>{
      const needed=r.scripts*hoursPerRx;
      const fte=needed/40;
      return['Week '+r.week,num(r.scripts),num(needed)+' hrs',fte.toFixed(1)+' FTE',r.paLoad>20?badge('PA support','warn'):badge('Normal','good'),r.dsOhRisk>25?badge('Refill rescue','warn'):badge('Normal','good')];
    });
  }

  function riskRows(forecast){
    const out=[];
    const cashNeg=forecast.find(r=>r.cash<0);
    if(cashNeg)out.push([badge('Cash','bad'),'Cash forecast goes negative','Week '+cashNeg.week+' ending cash '+money(cashNeg.cash),'Reduce cash out, collect AR, cut buying leakage, or bring in capital.']);
    const marginDrop=forecast.find(r=>r.gpRx<assumptions().gpRx*.9);
    if(marginDrop)out.push([badge('Margin','warn'),'GP/Rx forecast deteriorates','Week '+marginDrop.week+' GP/Rx '+money(marginDrop.gpRx),'Review payer/drug mix and Lift opportunities.']);
    const paHigh=forecast.find(r=>r.paLoad>25);
    if(paHigh)out.push([badge('Ops','warn'),'PA load may exceed capacity','Week '+paHigh.week+' PA load '+num(paHigh.paLoad),'Assign PA queue owners and use Bulk Ops to create actions.']);
    const dsHigh=forecast.find(r=>r.dsOhRisk>30);
    if(dsHigh)out.push([badge('Retention','warn'),'Refill risk may rise','Week '+dsHigh.week+' DSOH risk '+num(dsHigh.dsOhRisk),'Run retention rescue before patients gap.']);
    if(!out.length)out.push([badge('Good','good'),'No major forecast risk detected','Based on current local data','Keep improving data coverage.']);
    return out;
  }

  function exportCSV(){
    const rows=forecastRows();
    const headers=['week','scripts','gpRx','gp','cost','net','external','cash','paLoad','dsOhRisk','laborHours'];
    const csv=headers.join(',')+'\n'+rows.map(r=>headers.map(h=>csvCell(r[h])).join(',')).join('\n');
    download('onpoint_forecast_'+today()+'.csv',csv,'text/csv');
  }

  function render(){
    ensureViews();ensureTabs();const el=$('view-forecast');if(!el)return;
    const a=assumptions(), f=forecastRows(), totalGp=sum(f,'gp'), totalCost=sum(f,'cost'), totalNet=sum(f,'net');
    el.innerHTML=`
      <div class="feature-hero"><h2>Forecast Engine</h2><p>Forward view of scripts, GP, cost, cash pressure, PA load, refill risk, and staffing pressure.</p></div>
      <div class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <div><label>History Window</label>${select('forecast_history',['14','30','60','90'],String(historyDays))}</div>
        <div><label>Forecast Weeks</label>${select('forecast_weeks',['4','8','13'],String(forecastWeeks))}</div>
        <button class="btn primary" onclick="ForecastLayer.applySettings()">Apply</button>
        <button class="btn" onclick="ForecastLayer.exportCSV()">Export CSV</button>
      </div>
      <div class="kpi-band">
        ${metric('Cash Runway',runway(f),'forecast window',runway(f).startsWith('Week')?'bad':'good')}
        ${metric('Weekly Scripts',num(a.scriptsPerDay*7),'current run rate')}
        ${metric('GP/Rx',money(a.gpRx),'current run rate')}
        ${metric('Cost/Rx',money(a.costRx),'tracked cost')}
        ${metric('Forecast Net',money(totalNet),forecastWeeks+' week contribution',totalNet>=0?'good':'bad')}
      </div>
      <h2>13-Week Operating Forecast</h2>${table(['Week','Scripts','GP/Rx','GP','Cost','Net','External Cash','Ending Cash','PA Load','DSOH Risk','Labor Hours'],f.map(r=>['Week '+r.week,num(r.scripts),money(r.gpRx),money(r.gp),money(r.cost),money(r.net),money(r.external),money(r.cash),num(r.paLoad),num(r.dsOhRisk),num(r.laborHours)]))}
      <h2>Scenario Sensitivity</h2>${table(['Scenario','Weekly Scripts','GP/Rx','Cost/Rx','GP','Cost','Net','Status'],scenarioRows())}
      <h2>Staffing / Queue Pressure</h2>${table(['Period','Scripts','Estimated Labor','FTE Need','PA Signal','Retention Signal'],staffingRows(f))}
      <h2>Forecast Risks</h2>${table(['Area','Risk','Signal','Recommended Action'],riskRows(f))}
      <h2>Assumptions</h2>${table(['Assumption','Value','Source'],[
        ['Scripts/day',num(a.scriptsPerDay),'Recent daily entries'],
        ['Weekly script trend',num(a.weeklyScriptTrend),'Linear trend from history window'],
        ['GP/Rx',money(a.gpRx),'Recent GP divided by scripts'],
        ['Cost/Rx',money(a.costRx),'Recent tracked cost divided by scripts'],
        ['Starting cash',money(a.cash),'Latest non-zero cash entry'],
        ['AP / AR',money(a.ap)+' / '+money(a.ar),'Latest non-zero entries']
      ])}
    `;
  }

  window.ForecastLayer={render,show,applySettings(){historyDays=Number($('forecast_history')?.value||30);forecastWeeks=Number($('forecast_weeks')?.value||13);render()},exportCSV};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
