/* OnPoint Analytics Layer: rolling trends, variance, anomaly detection, leakage, and operating insights. */
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
  let windowDays=30;

  function read(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch(e){return f}}
  function base(){return read(BASE_KEY,{manual:{},targets:{gpRx:40,costRx:10,fillRate:90,adherence:85,costGp:.35,timeToStart:24},imports:{pioneer:[],cash:[],intacct:[],powerbi:[]}})}
  function scripts(){return read(SCRIPT_KEY,{scripts:[],lift:[]})}
  function ops(){return read(OPS_KEY,{actions:[],employees:[],pipeline:[]})}
  function metric(label,value,sub='',cls=''){return`<div class="mini-card"><div class="label">${esc(label)}</div><div class="value ${cls}">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`}
  function badge(text,type){return`<span class="badge ${type||'blue'}">${esc(text)}</span>`}
  function table(headers,rows){if(!rows.length)return`<div class="empty-state"><b>No data yet</b>Enter daily data or import files to see trends.</div>`;return`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  function select(id,opts,val){return`<select id="${esc(id)}">${opts.map(o=>`<option ${String(o)===String(val)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}

  function ensureViews(){const main=document.querySelector('.main');if(!main)return;if(!$('view-analytics')){const s=document.createElement('section');s.id='view-analytics';s.className='view';main.appendChild(s)}}
  function ensureTabs(){const nav=$('nav');if(!nav)return;if(!nav.querySelector('[data-v="analytics"],[data-view="analytics"]')){const b=document.createElement('button');b.dataset.v='analytics';b.textContent='Analytics';b.onclick=()=>show('analytics');nav.appendChild(b)}}
  function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$('view-'+id)?.classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',(b.dataset.v||b.dataset.view)===id));const title=$('pageTitle');if(title)title.textContent='Analytics + Trends';render();window.scrollTo({top:0,behavior:'smooth'})}

  function dailyRows(days=windowDays){
    const b=base(), out=[];
    for(let i=days-1;i>=0;i--){
      const d=addDays(today(),-i), r=(b.manual||{})[d]||{};
      const revenue=n(r.revenue), cogs=n(r.cogs), gp=revenue-cogs, scriptsFilled=n(r.scriptsFilled), scriptsReceived=n(r.scriptsReceived);
      const labor=n(r.labor), delivery=n(r.delivery), storeOpex=n(r.storeOpex), salesCost=n(r.salesCost), techCost=n(r.techCost), enterpriseCost=n(r.enterpriseCost), corpCost=n(r.corpCost);
      const totalCost=labor+delivery+storeOpex+salesCost+techCost+enterpriseCost+corpCost+n(r.dirExposure)+n(r.debtService||r.debtPayment);
      out.push({date:d,revenue,cogs,gp,scriptsFilled,scriptsReceived,patients:n(r.patients),newPatients:n(r.newPatients),activeDoctors:n(r.activeDoctors),newDoctors:n(r.newDoctors),paBacklog:n(r.paBacklog),scriptsReversed:n(r.scriptsReversed),scriptsAbandoned:n(r.scriptsAbandoned),firstFills:n(r.firstFills),secondFills:n(r.secondFills),dsOhRisk:n(r.dsOhRisk),adherence:n(r.adherence),timeToStart:n(r.timeToStart),labor,delivery,storeOpex,salesCost,techCost,enterpriseCost,corpCost,totalCost,ebitda:gp-totalCost,gpRx:scriptsFilled?gp/scriptsFilled:0,costRx:scriptsFilled?totalCost/scriptsFilled:0,fillRate:scriptsReceived?scriptsFilled/scriptsReceived*100:0,secondFillRate:n(r.firstFills)?n(r.secondFills)/n(r.firstFills)*100:0});
    }
    return out;
  }
  function sum(rows,k){return rows.reduce((a,r)=>a+n(r[k]),0)}
  function avg(rows,k){const vals=rows.map(r=>n(r[k])).filter(v=>v!==0);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}
  function split(rows){const mid=Math.floor(rows.length/2);return[rows.slice(0,mid),rows.slice(mid)]}
  function trend(rows,k){const [a,b]=split(rows);const av=avg(a,k), bv=avg(b,k);return{from:av,to:bv,delta:bv-av,pct:av?(bv-av)/Math.abs(av)*100:0}}
  function direction(k,delta){const goodUp=['revenue','gp','scriptsFilled','patients','activeDoctors','newPatients','newDoctors','fillRate','adherence','secondFillRate','gpRx','ebitda'];const badUp=['costRx','paBacklog','scriptsReversed','scriptsAbandoned','dsOhRisk','timeToStart','totalCost'];if(goodUp.includes(k))return delta>=0?'good':'bad';if(badUp.includes(k))return delta<=0?'good':'bad';return 'blue'}

  function trendRows(rows){
    const defs=[['scriptsFilled','Scripts Filled','number'],['gp','Gross Profit','money'],['gpRx','GP/Rx','money'],['costRx','Cost/Rx','money'],['fillRate','Fill Rate','pct'],['paBacklog','PA Backlog','number'],['dsOhRisk','DSOH Risk','number'],['secondFillRate','First→Second Fill','pct'],['timeToStart','Time To Start','number'],['ebitda','Contribution','money']];
    return defs.map(([k,label,type])=>{const t=trend(rows,k);const cls=direction(k,t.delta);return[label,fmt(t.from,type),fmt(t.to,type),badge((t.delta>=0?'+':'')+fmt(t.delta,type),cls),badge((t.pct>=0?'+':'')+pct(t.pct),cls)]});
  }
  function fmt(v,type){if(type==='money')return money(v);if(type==='pct')return pct(v);return num(v)}

  function varianceRows(rows){
    const targets=base().targets||{}, s={gp:sum(rows,'gp'),scripts:sum(rows,'scriptsFilled'),received:sum(rows,'scriptsReceived'),cost:sum(rows,'totalCost'),adherence:avg(rows,'adherence'),timeToStart:avg(rows,'timeToStart')};
    const gpRx=s.scripts?s.gp/s.scripts:0, costRx=s.scripts?s.cost/s.scripts:0, fillRate=s.received?s.scripts/s.received*100:0, costGp=s.gp?s.cost/s.gp:0;
    return [
      ['GP/Rx',money(gpRx),money(targets.gpRx||40),badge(gpRx>=n(targets.gpRx||40)?'On / Above':'Below',gpRx>=n(targets.gpRx||40)?'good':'bad')],
      ['Cost/Rx',money(costRx),money(targets.costRx||10),badge(costRx<=n(targets.costRx||10)?'On / Below':'Above',costRx<=n(targets.costRx||10)?'good':'bad')],
      ['Fill Rate',pct(fillRate),pct(targets.fillRate||90),badge(fillRate>=n(targets.fillRate||90)?'On / Above':'Below',fillRate>=n(targets.fillRate||90)?'good':'bad')],
      ['Adherence',pct(s.adherence),pct(targets.adherence||85),badge(s.adherence>=n(targets.adherence||85)?'On / Above':'Below',s.adherence>=n(targets.adherence||85)?'good':'bad')],
      ['Cost/$GP',money(costGp),money(targets.costGp||.35),badge(costGp<=n(targets.costGp||.35)?'On / Below':'Above',costGp<=n(targets.costGp||.35)?'good':'bad')],
      ['Time To Start',num(s.timeToStart)+'h',num(targets.timeToStart||24)+'h',badge(s.timeToStart<=n(targets.timeToStart||24)?'On / Below':'Above',s.timeToStart<=n(targets.timeToStart||24)?'good':'bad')]
    ];
  }

  function anomalyRows(rows){
    const keys=[['gp','Gross Profit','money'],['gpRx','GP/Rx','money'],['costRx','Cost/Rx','money'],['fillRate','Fill Rate','pct'],['paBacklog','PA Backlog','number'],['scriptsAbandoned','Abandoned Scripts','number'],['dsOhRisk','DSOH Risk','number']];
    const out=[];
    keys.forEach(([k,label,type])=>{
      const vals=rows.map(r=>n(r[k])); const nonzero=vals.filter(v=>v!==0); if(nonzero.length<5)return;
      const mean=nonzero.reduce((a,b)=>a+b,0)/nonzero.length;
      const sd=Math.sqrt(nonzero.reduce((a,b)=>a+Math.pow(b-mean,2),0)/nonzero.length)||0;
      const last=vals[vals.length-1]; if(!sd)return;
      const z=(last-mean)/sd;
      if(Math.abs(z)>=1.5)out.push([badge(z>0?'Spike':'Drop',direction(k,z>0?1:-1)),label,fmt(last,type),'Typical '+fmt(mean,type),'Z '+z.toFixed(1)]);
    });
    if(!out.length)out.push([badge('Clean','good'),'No obvious anomalies','Latest day is not far from trend','Based on local data','']);
    return out;
  }

  function leakageRows(rows){
    const gpRx=avg(rows,'gpRx')||40;
    const abandoned=sum(rows,'scriptsAbandoned'), reversed=sum(rows,'scriptsReversed'), pa=avg(rows,'paBacklog'), ds=sum(rows,'dsOhRisk');
    const potential=sum(rows,'scriptsReceived')*gpRx;
    const realized=sum(rows,'gp');
    const abandonedLoss=abandoned*gpRx, reversedLoss=reversed*gpRx, paAtRisk=pa*gpRx, retentionRisk=ds*(gpRx/2);
    return [
      ['Potential GP',money(potential),'Scripts received × average GP/Rx'],
      ['Realized GP',money(realized),'Actual GP entered/imported'],
      ['Abandonment loss proxy','-'+money(abandonedLoss),abandoned+' scripts × GP/Rx'],
      ['Reversal loss proxy','-'+money(reversedLoss),reversed+' reversals × GP/Rx'],
      ['PA GP at risk','-'+money(paAtRisk),'Average PA backlog × GP/Rx'],
      ['Retention risk proxy','-'+money(retentionRisk),'DSOH risk × partial GP/Rx'],
      ['Leakage Gap',money(Math.max(0,potential-realized)), 'Potential GP minus realized GP']
    ];
  }

  function correlationRows(rows){
    const pairs=[['paBacklog','fillRate','PA vs Fill Rate'],['costRx','ebitda','Cost/Rx vs Contribution'],['dsOhRisk','adherence','DSOH Risk vs Adherence'],['timeToStart','scriptsAbandoned','Time To Start vs Abandonment'],['gpRx','ebitda','GP/Rx vs Contribution']];
    return pairs.map(([a,b,label])=>{const r=corr(rows.map(x=>n(x[a])),rows.map(x=>n(x[b])));return[label,r.toFixed(2),interpretCorr(label,r)]});
  }
  function corr(x,y){const pairs=x.map((v,i)=>[v,y[i]]).filter(p=>p[0]!==0||p[1]!==0);if(pairs.length<3)return 0;const xs=pairs.map(p=>p[0]),ys=pairs.map(p=>p[1]);const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;let num=0,dx=0,dy=0;for(let i=0;i<xs.length;i++){num+=(xs[i]-mx)*(ys[i]-my);dx+=Math.pow(xs[i]-mx,2);dy+=Math.pow(ys[i]-my,2)}return dx&&dy?num/Math.sqrt(dx*dy):0}
  function interpretCorr(label,r){if(Math.abs(r)<.25)return'Weak/no relationship in current window';if(label.includes('PA')&&r<-.25)return'Higher PA backlog appears linked to lower fill rate';if(label.includes('Cost')&&r<-.25)return'Higher cost/Rx appears linked to worse contribution';if(label.includes('DSOH')&&r<-.25)return'Higher DSOH risk appears linked to lower adherence';if(label.includes('Time')&&r>.25)return'Longer time to start appears linked to abandonment';if(label.includes('GP/Rx')&&r>.25)return'Higher GP/Rx appears linked to better contribution';return'Signal worth watching'}

  function insightRows(rows){
    const out=[]; const tr={gp:trend(rows,'gp'),scripts:trend(rows,'scriptsFilled'),costRx:trend(rows,'costRx'),gpRx:trend(rows,'gpRx'),pa:trend(rows,'paBacklog'),ds:trend(rows,'dsOhRisk'),fill:trend(rows,'fillRate'),ebitda:trend(rows,'ebitda')};
    if(tr.gp.pct<0&&tr.scripts.pct>0)out.push([badge('Margin','bad'),'Scripts are up but GP is down','Volume quality or payer/drug mix may be worsening. Review GP/Rx and payer mix.']);
    if(tr.costRx.pct>15)out.push([badge('Cost','bad'),'Cost/Rx is rising fast','Check labor, delivery, corporate cost allocation, and low-volume days.']);
    if(tr.gpRx.pct< -10)out.push([badge('Value','bad'),'GP/Rx is compressing','Look at payer mix, drug mix, rejections, DIR exposure, and Lift opportunities.']);
    if(tr.pa.pct>20)out.push([badge('Ops','warn'),'PA backlog is growing','Prioritize PA Factory. GP is stuck before it becomes cash.']);
    if(tr.ds.pct>20)out.push([badge('Retention','warn'),'DSOH risk is growing','Patients are nearing therapy gaps. Run refill rescue.']);
    if(tr.fill.pct< -5)out.push([badge('Throughput','bad'),'Fill rate is falling','The script machine is leaking. Check PA, payer rejection, patient contact, and inventory.']);
    if(tr.ebitda.pct< -10)out.push([badge('Finance','bad'),'Contribution trend is worsening','Revenue/GP is not covering tracked cost. Use P&L Cost Bridge.']);
    if(!out.length)out.push([badge('Good','good'),'No major negative trend detected','Keep entering consistent daily data and review weekly.']);
    return out;
  }

  function render(){
    ensureViews();ensureTabs();const el=$('view-analytics');if(!el)return;
    const rows=dailyRows(windowDays); const s={revenue:sum(rows,'revenue'),gp:sum(rows,'gp'),scripts:sum(rows,'scriptsFilled'),patients:sum(rows,'patients'),cost:sum(rows,'totalCost'),received:sum(rows,'scriptsReceived')};
    const gpRx=s.scripts?s.gp/s.scripts:0, costRx=s.scripts?s.cost/s.scripts:0, fill=s.received?s.scripts/s.received*100:0;
    const sq=scripts(), os=ops();
    el.innerHTML=`
      <div class="feature-hero"><h2>Analytics + Trends</h2><p>What changed, what is weird, what is leaking, and what should be fixed first.</p></div>
      <div class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap"><div><label>Window</label>${select('analytics_window',['14','30','60','90'],String(windowDays))}</div><button class="btn primary" onclick="AnalyticsLayer.applyWindow()">Apply</button></div>
      <div class="kpi-band">
        ${metric('Scripts',num(s.scripts),windowDays+' day filled')}
        ${metric('Gross Profit',money(s.gp),'GP/Rx '+money(gpRx),s.gp>=0?'good':'bad')}
        ${metric('Cost/Rx',money(costRx),'tracked total cost')}
        ${metric('Fill Rate',pct(fill),'filled / received',fill>=90?'good':'warn')}
        ${metric('Open Script Queue',num((sq.scripts||[]).filter(x=>!['Delivered / Picked Up','Abandoned','Reversed'].includes(x.status)).length),'workflow backlog')}
      </div>
      <h2>Trend vs Prior Half</h2>${table(['Metric','Earlier Avg','Recent Avg','Change','% Change'],trendRows(rows))}
      <h2>Variance vs Targets</h2>${table(['Metric','Actual','Target','Status'],varianceRows(rows))}
      <h2>Anomaly Flags</h2>${table(['Flag','Metric','Latest','Typical','Score'],anomalyRows(rows))}
      <h2>Gross Profit Leakage Waterfall</h2>${table(['Line','Amount','How calculated'],leakageRows(rows))}
      <h2>Correlation Checks</h2>${table(['Relationship','Correlation','Meaning'],correlationRows(rows))}
      <h2>Trend Insights</h2>${table(['Area','Issue','Action'],insightRows(rows))}
      <h2>Data Coverage</h2>${table(['Dataset','Rows / Items','Comment'],[
        ['Daily manual entries',num(Object.keys(base().manual||{}).length),'More days improves trend quality'],
        ['PioneerRx imports',num(((base().imports||{}).pioneer||[]).length),'Improves doctor/payer/drug analysis'],
        ['Script queue',num((sq.scripts||[]).length),'Improves workflow analysis'],
        ['Actions',num((os.actions||[]).length),'Improves accountability analysis']
      ])}
    `;
  }

  window.AnalyticsLayer={render,show,applyWindow(){windowDays=Number($('analytics_window')?.value||30);render()}};
  const old=window.render;if(typeof old==='function'){window.render=function(){const out=old.apply(this,arguments);setTimeout(render,0);return out}}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,1800));
  setInterval(()=>{ensureViews();ensureTabs();},3000);
})();
