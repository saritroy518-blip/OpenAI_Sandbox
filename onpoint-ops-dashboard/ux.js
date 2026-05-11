/* OnPoint UX overlay. Safe additive layer over the working dashboard. */
(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const money = (x) => '$' + Math.round(Number(x)||0).toLocaleString();
  const num = (x) => Math.round(Number(x)||0).toLocaleString();
  const pct = (x) => isFinite(x) ? Number(x).toFixed(1) + '%' : '0.0%';

  function safeCalc(){
    try { return typeof calc === 'function' ? calc() : {}; } catch(e) { return {}; }
  }

  function htmlEscape(v){
    return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function buildNorthStar(){
    return `
      <div class="northstar-banner" id="uxNorthStar">
        <div class="eyebrow">Company North Star</div>
        <div class="headline">Profitable therapy starts that become retained, adherent patients.</div>
        <div class="subtext">The real win: a patient starts therapy, stays on therapy, the doctor trusts us more, and OnPoint earns fair gross profit at a known unit cost.</div>
      </div>
    `;
  }

  function buildExecStrip(c){
    return `
      <div class="exec-strip" id="uxExecStrip">
        <div class="exec-col"><div class="exec-head bring">Bring In</div>
          <div class="exec-row"><span class="exec-label">New Patients</span><span class="exec-value">${num(c.newPatients||0)}</span></div>
          <div class="exec-row"><span class="exec-label">Scripts In</span><span class="exec-value">${num(c.scriptsReceived||0)}</span></div>
          <div class="exec-row"><span class="exec-label">Active Doctors</span><span class="exec-value">${num(c.activeDoctors||0)}</span></div>
        </div>
        <div class="exec-col"><div class="exec-head out">Get Out</div>
          <div class="exec-row"><span class="exec-label">Scripts Filled</span><span class="exec-value">${num(c.scriptsFilled||0)}</span></div>
          <div class="exec-row"><span class="exec-label">Fill Rate</span><span class="exec-value">${pct(c.fill||c.fillRate||0)}</span></div>
          <div class="exec-row"><span class="exec-label">GP Out</span><span class="exec-value">${money(c.gp||0)}</span></div>
        </div>
        <div class="exec-col"><div class="exec-head keep">Keep</div>
          <div class="exec-row"><span class="exec-label">Adherence</span><span class="exec-value">${pct(c.adherence||0)}</span></div>
          <div class="exec-row"><span class="exec-label">Refill Capture</span><span class="exec-value">${pct(c.refill||c.refillCapture||0)}</span></div>
          <div class="exec-row"><span class="exec-label">DSOH Risk</span><span class="exec-value">${num(c.dsOhRisk||0)}</span></div>
        </div>
        <div class="exec-col"><div class="exec-head cost">Cost</div>
          <div class="exec-row"><span class="exec-label">Cost/Rx</span><span class="exec-value">${money(c.costRx||0)}</span></div>
          <div class="exec-row"><span class="exec-label">Cost/$GP</span><span class="exec-value">${Number(c.costGp||0).toFixed(2)}</span></div>
          <div class="exec-row"><span class="exec-label">Breakeven Rx</span><span class="exec-value">${num(c.breakeven||c.breakevenRx||0)}</span></div>
        </div>
        <div class="exec-col"><div class="exec-head truth">Truth</div>
          <div class="exec-row"><span class="exec-label">Cash</span><span class="exec-value">${money(c.cash||0)}</span></div>
          <div class="exec-row"><span class="exec-label">EBITDA Proxy</span><span class="exec-value">${money(c.ebitda||0)}</span></div>
          <div class="exec-row"><span class="exec-label">AP + Debt</span><span class="exec-value">${money((c.ap||0)+(c.debt||c.debtDue||0))}</span></div>
        </div>
      </div>`;
  }

  const missions = {
    'view-teams': 'Five functions, one operating system: Sales brings it in, Enterprise scales it, Pharmacy Ops gets it out, Technology makes it faster and cheaper, Finance tells the truth.',
    'view-channels': 'Channel quality matters more than channel volume. Find the channels with high GP, high retention, low chaos, and low cost to serve.',
    'view-locations': 'Every location must justify itself with scripts, patients, gross profit, adherence, and contribution after local cost.',
    'view-doctors': 'Doctor relationships are assets. Tier them, protect the top producers, and catch silent churn before it becomes obvious.',
    'view-enterprise': 'Enterprise turns pharmacy execution into strategic value for medical groups, pharma, payors, and risk-bearing partners.',
    'view-imports': 'Import flow should make bad data obvious before it pollutes the dashboard. Export, preview, validate, then save.',
    'view-pa': 'Prior authorization is invisible leakage. If scripts are stuck here, your fill-rate problem is not an ops effort problem.',
    'view-retention': 'A therapy start only matters if the patient makes it to the second fill and keeps going. Retention is the product.',
    'view-finance': 'Finance is the scoreboard and the lie detector. Cash, GP, AP, AR, cost, and contribution are the truth.',
    'view-ledgers': 'Finance is the scoreboard and the lie detector. Cash, GP, AP, AR, cost, and contribution are the truth.',
    'view-drugs': 'Drug mix explains GP/Rx surprises. Know the products and classes that actually drive gross profit.',
    'view-delivery': 'Delivery cost per success matters more than delivery count. Failed attempts are margin leakage.'
  };

  function addMissionCallouts(){
    Object.entries(missions).forEach(([id,text]) => {
      const el = $(id);
      if (!el || el.querySelector('.mission-callout')) return;
      const div = document.createElement('div');
      div.className = 'mission-callout';
      div.textContent = text;
      el.prepend(div);
    });
  }

  function enhanceCommand(){
    const el = $('view-command');
    if (!el) return;
    const c = safeCalc();
    const existingNorth = $('uxNorthStar');
    const existingStrip = $('uxExecStrip');
    if (existingNorth) existingNorth.remove();
    if (existingStrip) existingStrip.remove();
    el.insertAdjacentHTML('afterbegin', buildNorthStar() + buildExecStrip(c));
  }

  function buildMobileNav(){
    if (document.querySelector('.mobile-bottom-nav')) return;
    const items = [
      ['command','Home'],
      ['daily','Daily'],
      ['imports','Import'],
      ['ledgers','Cash'],
      ['meeting','Meeting']
    ];
    const nav = document.createElement('div');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = items.map(([id,label]) => `<button data-mobile-view="${id}">${htmlEscape(label)}</button>`).join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const mainBtn = document.querySelector(`#nav button[data-v="${btn.dataset.mobileView}"], #nav button[data-view="${btn.dataset.mobileView}"]`);
        if (mainBtn) mainBtn.click();
      });
    });
  }

  function syncMobileNav(){
    const active = document.querySelector('#nav button.active');
    const id = active && (active.dataset.v || active.dataset.view);
    document.querySelectorAll('.mobile-bottom-nav button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mobileView === id);
    });
  }

  function addQuickActions(){
    const top = document.querySelector('.top-actions');
    if (!top || document.getElementById('uxQuickBackup')) return;
    const btn = document.createElement('button');
    btn.className = 'btn blue';
    btn.id = 'uxQuickBackup';
    btn.textContent = 'Backup';
    btn.onclick = function(){
      try {
        if (typeof backup === 'function') backup();
        else if (typeof exportBackup === 'function') exportBackup();
      } catch(e) { alert('Backup is not available on this version yet.'); }
    };
    top.appendChild(btn);
  }

  function addOperatingGuide(){
    const settings = $('view-settings');
    if (!settings || settings.querySelector('#uxOperatingGuide')) return;
    const guide = document.createElement('div');
    guide.id = 'uxOperatingGuide';
    guide.className = 'card';
    guide.style.marginTop = '16px';
    guide.innerHTML = `
      <h2 style="margin-top:0">Operating Rhythm</h2>
      <p class="muted"><b>Daily:</b> enter yesterday/today numbers, review red/yellow alerts, clear stuck scripts, chase DSOH risk, save a backup.</p>
      <p class="muted"><b>Weekly:</b> use Meeting Mode. Ask: what came in, what got out, what leaked, what did it cost, and where did the money go?</p>
      <p class="muted"><b>Monthly:</b> review channel quality, location contribution, doctor tiers, enterprise account scorecards, and budget vs actual.</p>
    `;
    settings.appendChild(guide);
  }

  function runUX(){
    try {
      enhanceCommand();
      addMissionCallouts();
      buildMobileNav();
      syncMobileNav();
      addQuickActions();
      addOperatingGuide();
    } catch(e) {
      console.warn('UX overlay skipped:', e);
    }
  }

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function(){
      const out = originalRender.apply(this, arguments);
      setTimeout(runUX, 0);
      return out;
    };
  }

  const originalShow = window.show;
  if (typeof originalShow === 'function') {
    window.show = function(){
      const out = originalShow.apply(this, arguments);
      setTimeout(runUX, 0);
      return out;
    };
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(runUX, 300));
  setInterval(runUX, 2500);
})();
