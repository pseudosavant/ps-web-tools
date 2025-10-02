/* payments-tracker implementation
 * Internal identifiers use 'payment'.
 * URL schema: repeating ?payments= param values with mini key:value|key:value syntax.
 * Keys: name, amount, day, end, start
 * Calculates remaining and (optionally) paid metrics and renders aggregate + per-payment display.
 */
(function() {
  'use strict';
  const MAX_PAYMENTS = 6;
  const today = new Date();
  clearTime(today);
  let paymentSpecs = [];
  let customTitle = null;
  let editIndex = null;
  function clearTime(d){ d.setHours(0,0,0,0); }
  function parseQuery(search){
    const params = new URLSearchParams(search);
  const raw = params.getAll('payments');
    const title = params.get('title');
    const payments = [];
    const notesGlobal = {clamps:0, skipped:0, truncated:false, startIgnored:0};
    for (let spec of raw){
      if (payments.length >= MAX_PAYMENTS){ notesGlobal.truncated = true; break; }
      const obj = {};
      const pairs = spec.split('|');
      for (let part of pairs){
        const idx = part.indexOf(':'); if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const value = decodeURIComponent(part.slice(idx+1).trim());
        switch(key){
          case 'name': obj.name = value; break;
          case 'amount': obj.amount = parseFloat(value); break;
          case 'day': obj.day = parseInt(value,10); break;
          case 'end': obj.end = parseISO(value); break;
          case 'start': obj.start = parseISO(value); break;
          default: break;
        }
      }
      if (!isFinite(obj.amount) || obj.amount <= 0 || !isValidDate(obj.end) || !Number.isInteger(obj.day)) { notesGlobal.skipped++; continue; }
      if (obj.day < 1) obj.day = 1;
      if (obj.day > 28){ obj.day = 28; notesGlobal.clamps++; }
      if (obj.start && (!isValidDate(obj.start) || obj.start > obj.end)){ obj.start = undefined; notesGlobal.startIgnored++; }
      payments.push(obj);
    }
    return { payments, title, notesGlobal };
  }
  function parseISO(str){ if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date('Invalid'); const [y,m,d]=str.split('-').map(Number); const local = new Date(y,m-1,d); clearTime(local); if(local.getFullYear()!==y||(local.getMonth()+1)!==m||local.getDate()!==d) return new Date('Invalid'); return local; }
  function isValidDate(d){ return d instanceof Date && !isNaN(d.getTime()); }
  function monthIndex(d){ return d.getFullYear()*12 + d.getMonth(); }
  function computeFirstPayment(start, day){ const d=new Date(start.getFullYear(), start.getMonth(), day); clearTime(d); if(d<start){ d.setMonth(d.getMonth()+1); d.setDate(day);} return d; }
  function computeLastPayment(end, day){ const c=new Date(end.getFullYear(), end.getMonth(), day); clearTime(c); if(c>end){ c.setMonth(c.getMonth()-1); c.setDate(day);} return c; }
  function computePaymentsMade(start, end, day, today){ const first=computeFirstPayment(start,day); const last=computeLastPayment(end,day); if(first>last) return {paymentsMade:0,totalScheduled:0}; const lastIdx=monthIndex(last), firstIdx=monthIndex(first); const totalScheduled=lastIdx-firstIdx+1; if(today<first) return {paymentsMade:0,totalScheduled}; if(today>last) return {paymentsMade:totalScheduled,totalScheduled}; const todayIdx=monthIndex(today); let paymentsMade=todayIdx-firstIdx; if(today.getDate()>=day) paymentsMade+=1; return {paymentsMade,totalScheduled}; }
  function computePayment(p){
    const lastPayment=computeLastPayment(p.end,p.day);
    let nextPayment=new Date(today.getFullYear(), today.getMonth(), p.day); clearTime(nextPayment);
    if(today.getDate()>=p.day){ nextPayment.setMonth(nextPayment.getMonth()+1); nextPayment.setDate(p.day); }
    let paymentsRemaining;
    if(nextPayment>lastPayment){ paymentsRemaining=0; }
    else { const lastIdx=monthIndex(lastPayment); const nextIdx=monthIndex(nextPayment); paymentsRemaining=lastIdx-nextIdx+1; }
    let paymentsMade, amountPaid, totalScheduled, progressRatio;
    if(p.start){ const res=computePaymentsMade(p.start,p.end,p.day,today); paymentsMade=res.paymentsMade; totalScheduled=res.totalScheduled; if(totalScheduled>0) progressRatio=paymentsMade/totalScheduled; amountPaid=Math.round(paymentsMade*p.amount); }
    const amountRemaining=Math.round(paymentsRemaining*p.amount);
    return { name:p.name||'', amount:p.amount, day:p.day, end:p.end, start:p.start, paymentsMade, paymentsRemaining, totalScheduled, amountPaid, amountRemaining, progressRatio, notes:[] };
  }
  function formatCurrencyUSD(num){ return '$'+(num||0).toLocaleString('en-US'); }
  function isoDate(d){ return d.toISOString().slice(0,10); }
  function ensureInitialState(){ const params=new URLSearchParams(window.location.search); paymentSpecs=params.getAll('payments'); customTitle=params.get('title'); }
  function rebuildURL(){ const params=new URLSearchParams(); if(customTitle) params.set('title', customTitle); for(const spec of paymentSpecs){ params.append('payments', spec);} const newUrl=window.location.pathname+'?'+params.toString(); window.history.replaceState(null,'',newUrl); }
  function render(){
    const { payments, title, notesGlobal } = parseQuery(window.location.search);
    const computed = payments.map(computePayment);
    if(!document.title) document.title = 'Payments Tracker';
    const paymentsContainer = document.getElementById('payments');
    paymentsContainer.textContent='';
    if(!computed.length){
      paymentsContainer.innerHTML='<div class="empty"><p><strong>No payment series yet.</strong></p><p>Add a recurring monthly payment (e.g. car loan, child support, tuition, subscription, installment plan) with amount, day-of-month, and end date. Optionally include a start date to track progress already made.</p><p>Use the <em>Add Payment</em> button below to begin.</p></div>';
      document.getElementById('aggregate').hidden=true;
    } else {
      computed.forEach((c,i)=>{ if(!c.name) c.name = (computed.length===1)?'Payment':`Payment ${i+1}`; });
      let aggPaymentsRemaining=0, aggAmountRemaining=0, aggPaymentsMade=0, aggAmountPaid=0, paidCount=0, allHavePaid=true;
      for(const c of computed){
        aggPaymentsRemaining += c.paymentsRemaining;
        aggAmountRemaining += c.amountRemaining;
        if(c.amountPaid!=null){ aggAmountPaid += c.amountPaid; aggPaymentsMade += c.paymentsMade; paidCount++; } else { allHavePaid=false; }
      }
      computed.forEach((c,i)=>{
        const card=document.createElement('article'); card.className='payment-card';
        const header=document.createElement('div'); header.className='card-header';
        const h2=document.createElement('h2'); h2.textContent=c.name; header.appendChild(h2);
        const actions=document.createElement('div'); actions.className='icon-actions';
        const editBtn=document.createElement('button'); editBtn.type='button'; editBtn.className='icon-btn edit-btn'; editBtn.title='Edit'; editBtn.innerHTML='<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span class="sr-only">Edit</span>'; editBtn.addEventListener('click', ()=> window.beginEditPayment(i)); actions.appendChild(editBtn);
        const delBtn=document.createElement('button'); delBtn.type='button'; delBtn.className='icon-btn delete-btn'; delBtn.title='Delete'; delBtn.innerHTML='<i class="fa-solid fa-trash" aria-hidden="true"></i><span class="sr-only">Delete</span>'; delBtn.addEventListener('click', ()=> { if(confirm('Delete this payment?')) deletePayment(i); }); actions.appendChild(delBtn);
        header.appendChild(actions);
        card.appendChild(header);
        const list=document.createElement('ul'); list.className='metrics-list';
        if(c.start || c.end){ const startStr=c.start?isoDate(c.start):'\u2014'; const endStr=c.end?isoDate(c.end):'\u2014'; list.appendChild(metricItemHTML('<i class="fa-regular fa-calendar" aria-hidden="true"></i> Dates', `${startStr} \u2192 ${endStr}`)); }
        if(c.amountPaid!=null){
          list.appendChild(metricItemHTML('<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Payments Made', String(c.paymentsMade)));
          list.appendChild(metricItemHTML('<i class="fa-solid fa-circle-dollar-to-slot" aria-hidden="true"></i> Paid Amount', formatCurrencyUSD(c.amountPaid)));
        }
        list.appendChild(metricItemHTML('<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Payments Remaining', String(c.paymentsRemaining)));
        list.appendChild(metricItemHTML('<i class="fa-solid fa-sack-dollar" aria-hidden="true"></i> Remaining Amount', formatCurrencyUSD(c.amountRemaining)));
        card.appendChild(list);
        if(c.progressRatio!=null){ const pb=progressBar(c.progressRatio, `${Math.round(c.progressRatio*100)}%`); pb.classList.add('progress-wrapper'); card.appendChild(pb); }
        paymentsContainer.appendChild(card);
      });
      const aggSection=document.getElementById('aggregate'); aggSection.hidden=false;
      document.getElementById('aggPaymentsRemaining').textContent=aggPaymentsRemaining;
      document.getElementById('aggAmountRemaining').textContent=formatCurrencyUSD(aggAmountRemaining);
      if(paidCount>0){ document.getElementById('aggPaidWrapper').hidden=false; document.getElementById('aggAmountPaid').textContent=formatCurrencyUSD(aggAmountPaid);} else { document.getElementById('aggPaidWrapper').hidden=true; }
      let aggProgressRatio=null; if(paidCount>0){ const denom=aggAmountPaid+aggAmountRemaining; if(denom>0) aggProgressRatio=aggAmountPaid/denom; }
      const aggProgressWrapper=document.getElementById('aggProgressWrapper'); const aggProgressFill=document.getElementById('aggProgressFill'); const aggProgressLabel=document.getElementById('aggProgressLabel');
      if(aggProgressRatio!=null){
        aggProgressWrapper.hidden=false;
        const pct=Math.round(aggProgressRatio*100);
        aggProgressFill.style.width=pct+'%';
        aggProgressFill.setAttribute('aria-valuenow', String(pct));
        aggProgressFill.setAttribute('aria-valuemin','0');
        aggProgressFill.setAttribute('aria-valuemax','100');
        const txt = pct + '% complete' + (allHavePaid ? '' : ' (partial)');
        const span = aggProgressLabel.querySelector('.progress-text');
        if(span) span.textContent = txt; else aggProgressLabel.appendChild(document.createTextNode(' ' + txt));
      } else { aggProgressWrapper.hidden=true; }
      const foot=document.getElementById('footnotes'); const footItems=[];
      if(notesGlobal.clamps) footItems.push(`${notesGlobal.clamps} day value(s) clamped to 28`);
      if(notesGlobal.skipped) footItems.push(`${notesGlobal.skipped} payment(s) skipped due to invalid required fields`);
      if(notesGlobal.startIgnored) footItems.push(`${notesGlobal.startIgnored} start date(s) ignored (start > end or invalid)`);
      if(notesGlobal.truncated) footItems.push(`Additional payments ignored (limit ${MAX_PAYMENTS})`);
      foot.textContent='';
      if(footItems.length){ const ul=document.createElement('ul'); ul.className='footnotes-list'; for(const t of footItems){ const li=document.createElement('li'); li.textContent=t; ul.appendChild(li);} foot.appendChild(ul);}    
    }
  }
  function metricItem(label, value){ const li=document.createElement('li'); li.className='metric-line'; const spanLabel=document.createElement('span'); spanLabel.className='metric-label'; spanLabel.textContent=label; const spanValue=document.createElement('span'); spanValue.className='metric-value'; spanValue.textContent=value; li.append(spanLabel, spanValue); return li; }
  function metricItemHTML(labelHTML, value){ const li=document.createElement('li'); li.className='metric-line'; const spanLabel=document.createElement('span'); spanLabel.className='metric-label'; spanLabel.innerHTML=labelHTML; const spanValue=document.createElement('span'); spanValue.className='metric-value'; spanValue.textContent=value; li.append(spanLabel, spanValue); return li; }
  function progressBar(ratio,label){ const wrapper=document.createElement('div'); wrapper.className='progress-wrapper'; const bar=document.createElement('div'); bar.className='progress-bar'; const fill=document.createElement('div'); fill.className='progress-bar-fill'; const pct=Math.min(100,Math.max(0,Math.round(ratio*100))); fill.style.width=pct+'%'; fill.setAttribute('role','progressbar'); fill.setAttribute('aria-valuenow', String(pct)); fill.setAttribute('aria-valuemin','0'); fill.setAttribute('aria-valuemax','100'); bar.appendChild(fill); const lbl=document.createElement('div'); lbl.className='progress-label'; lbl.textContent=label; wrapper.append(bar,lbl); return wrapper; }
  function attachForm(){
    const form=document.getElementById('paymentForm'); if(!form) return;
    const messageEl=document.getElementById('formMessage');
    const toggleBtn=document.getElementById('toggleFormBtn');
    const section=document.getElementById('addPaymentSection');
    const cancelEditBtn=document.getElementById('cancelEditBtn');
    const submitBtn=document.getElementById('submitBtn');
    const resetBtn=document.getElementById('resetBtn');
    toggleBtn.addEventListener('click', ()=> { const hidden=section.hasAttribute('hidden'); if(hidden){ section.removeAttribute('hidden'); toggleBtn.textContent='Hide Form'; } else { section.setAttribute('hidden',''); toggleBtn.textContent='Add Payment'; clearEditState(); } });
    cancelEditBtn.addEventListener('click', ()=> { clearEditState(); form.reset(); messageEl.textContent='Edit cancelled.'; });
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd=new FormData(form);
      const name=(fd.get('name')||'').toString().trim();
      let amount=parseFloat((fd.get('amount')||'').toString().trim());
      let day=parseInt((fd.get('day')||'').toString().trim(),10);
      const end=(fd.get('end')||'').toString().trim();
      const start=(fd.get('start')||'').toString().trim();
      if(!isFinite(amount) || amount<=0){ messageEl.textContent='Enter a valid positive amount.'; return; }
      if(!Number.isInteger(day) || day<1){ messageEl.textContent='Enter a valid day (1-28).'; return; }
      if(day>28) day=28;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(end)){ messageEl.textContent='Provide a valid end date.'; return; }
      const parts=[]; parts.push(`amount:${amount}`); parts.push(`day:${day}`); parts.push(`end:${end}`); if(name) parts.push(`name:${encodeURIComponent(name)}`); if(start) parts.push(`start:${start}`);
      const spec=parts.join('|');
      if(editIndex!=null){ paymentSpecs[editIndex]=spec; messageEl.textContent='Updated.'; }
      else { if(paymentSpecs.length>=MAX_PAYMENTS){ messageEl.textContent=`Limit of ${MAX_PAYMENTS} payments reached.`; return; } paymentSpecs.push(spec); messageEl.textContent='Added.'; }
      rebuildURL(); render(); if(editIndex==null) form.reset(); if(editIndex!=null) clearEditState();
    });
    resetBtn.addEventListener('click', ()=> { if(editIndex!=null){ messageEl.textContent='Cleared (editing). Set new values or cancel.'; } });
    function clearEditState(){ editIndex=null; submitBtn.textContent='Add'; cancelEditBtn.hidden=true; document.querySelector('#paymentForm legend').textContent='Add Payment'; }
  }
  function beginEditPayment(index){ const form=document.getElementById('paymentForm'); if(!form) return; const section=document.getElementById('addPaymentSection'); const toggleBtn=document.getElementById('toggleFormBtn'); const submitBtn=document.getElementById('submitBtn'); const cancelEditBtn=document.getElementById('cancelEditBtn'); const messageEl=document.getElementById('formMessage'); if(index<0 || index>=paymentSpecs.length) return; editIndex=index; section.removeAttribute('hidden'); toggleBtn.textContent='Hide Form'; submitBtn.textContent='Save'; cancelEditBtn.hidden=false; document.querySelector('#paymentForm legend').textContent='Edit Payment'; messageEl.textContent='Editing payment #' + (index+1); const spec=paymentSpecs[index]; const map={}; spec.split('|').forEach(p=>{ const idx=p.indexOf(':'); if(idx!==-1){ const k=p.slice(0,idx); const v=p.slice(idx+1); map[k]=v; }}); form.name.value=decodeURIComponent(map.name||''); form.amount.value=map.amount||''; form.day.value=map.day||''; form.end.value=map.end||''; form.start.value=map.start||''; window.scrollTo({top:0, behavior:'smooth'}); }
  function deletePayment(index){ if(index<0 || index>=paymentSpecs.length) return; paymentSpecs.splice(index,1); if(editIndex!=null){ if(index===editIndex){ editIndex=null; } else if(index<editIndex){ editIndex -= 1; } } rebuildURL(); render(); }
  window.beginEditPayment = beginEditPayment;
  // Maintain legacy global name for any external references
  window.beginEdit = beginEditPayment;
  window.deletePayment = deletePayment;
  ensureInitialState();
  // Set static heading from initial <title> once
  const h1 = document.getElementById('title');
  if(h1 && !h1.textContent) h1.textContent = document.title || 'Payments Tracker';
  attachForm();
  render();
})();
