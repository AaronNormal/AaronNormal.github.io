// Hearthwood founding families: calcs and drawings
dash.loader('leads', {
  description: 'Takes the rows out of the database tool\'s wrapped text answer.',
  fn: ({answer}) => {
    const t = typeof answer === 'string' ? answer : (answer && typeof answer.result === 'string' ? answer.result : null);
    if (t == null) { if (Array.isArray(answer)) return answer; throw new Error('Unexpected answer from the database'); }
    const start = t.indexOf('\n<untrusted-data-');
    if (start < 0) throw new Error(t.slice(0, 300));
    const open = t.indexOf('>', start) + 1;
    const close = t.indexOf('</untrusted-data-', open);
    const rows = JSON.parse(t.slice(open, close).trim());
    return rows.map((r) => {
      const o = {...r};
      for (const k of ['ages', 'childhood', 'priorities', 'rooms', 'worry', 'adults_love', 'kids_love']) {
        let v = o[k];
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = [v]; } }
        o[k] = Array.isArray(v) ? v.join(' | ') : null;
      }
      return o;
    });
  }
});

window.HW = (() => {
  const arr = (v) => (v ? String(v).split(' | ').filter(Boolean) : []);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
  const R = 3958.8;
  const miles = (a, b, c, d) => {
    const r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const reachMiles = (m) => (m === 'Up to an hour away' ? 45 : m === 'Up to two hours away' ? 90 : m === 'Anywhere in England' ? Infinity : null);
  return {arr, pct, miles, reachMiles};
})();

const HW_Q = [
  ['budget', 'Budget for a home', false, ['Under £500,000', 'Under £700,000', '£500,000 to £700,000', '£550,000 to £750,000', '£700,000 to £900,000', '£900,000 to £1.2 million', '£1.2 million to £1.5 million', '£1.5 million to £2 million', '£2 million to £3 million', 'Over £3 million', 'Not sure yet']],
  ['children', 'Number of children', false, ['None yet', '1', '2', '3', '4', '5 or more']],
  ['ages', "Children's ages (each child)", true, ['Under 4', '4 to 6', '7 to 10', '11 to 12', '13 to 16', '17 or older']],
  ['childhood', 'The childhood they want', true],
  ['priorities', 'What matters most', true],
  ['worry', 'Worries', true],
  ['move_far', "How far they'd move", false, ['Up to an hour away', 'Up to two hours away', 'Anywhere in England']],
  ['own_home', 'Own their home', false],
  ['estate_charge', 'Fair yearly estate charge', false, ['Under £3,000', '£3,000 to £6,000', '£6,000 to £10,000', '£10,000 to £15,000', 'Over £15,000', 'Not sure yet', 'I wouldn’t pay a yearly charge']],
  ['school_now', 'School now', false],
  ['fees_now', 'School fees now, per year', false, ['None', 'Under £15,000', '£15,000 to £30,000', '£30,000 to £45,000', '£45,000 to £70,000', 'Over £70,000']],
  ['school_planned', "School they'd plan for (no children at school yet)", false],
  ['city_days', 'Days in the city', false, ['Every day', 'Two or three days a week', 'About once a week', 'A few times a month', 'Rarely, we work from home']],
  ['live_now', 'Where they live now', false],
  ['rooms', 'Extra rooms wanted', true],
  ['adults_love', 'What parents would love', true],
  ['kids_love', 'What children would love', true]
];
window.HW_Q = HW_Q;

dash.calc('answers', {
  inputs: ['leads'],
  title: 'Answers to each question',
  description: 'For each question, how many families gave each answer, as a share of families who answered it.',
  fn: (leads) => {
    const out = [];
    for (const [key, label, multi, order] of HW_Q) {
      const counts = new Map();
      let base = 0;
      for (const r of leads) {
        const v = r[key];
        if (v == null || v === '') continue;
        base++;
        // ages lists one entry per child, so count every entry; other multi-picks count once per family
        const vals = multi ? (key === 'ages' ? HW.arr(v) : [...new Set(HW.arr(v))]) : [String(v)];
        for (const a of vals) counts.set(a, (counts.get(a) || 0) + 1);
      }
      const total = key === 'ages' ? [...counts.values()].reduce((a, b) => a + b, 0) : base;
      let rows = [...counts].map(([answer, n]) => ({q: key, question: label, answer, n, base: total, pct: total ? Math.round((1000 * n) / total) / 10 : 0}));
      rows.sort((a, b) => b.n - a.n);
      rows.forEach((r, i) => { r.rank = i + 1; });
      if (order) rows.sort((a, b) => ((order.indexOf(a.answer) + 1) || 99) - ((order.indexOf(b.answer) + 1) || 99));
      out.push(...rows);
    }
    return out;
  }
});

dash.calc('kpi', {
  inputs: ['leads'],
  title: 'Headline numbers',
  description: 'Totals, shares and averages across all founding families.',
  fn: (leads) => {
    const n = leads.length;
    const conf = leads.filter((r) => r.confirmed === true || r.confirmed === 'true').length;
    const score = (s) => leads.filter((r) => r.score === s).length;
    const now = Date.now();
    const last7 = leads.filter((r) => now - new Date(r.joined + ':00Z').getTime() < 7 * 864e5).length;
    const kidsVals = leads.map((r) => r.children).filter((v) => v != null && v !== '').map((v) => (v === 'None yet' ? 0 : parseInt(v, 10))).filter((v) => !isNaN(v));
    const avgKids = kidsVals.length ? Math.round((10 * kidsVals.reduce((a, b) => a + b, 0)) / kidsVals.length) / 10 : null;
    const bands = ['Under £500,000', 'Under £700,000', '£500,000 to £700,000', '£550,000 to £750,000', '£700,000 to £900,000', '£900,000 to £1.2 million', '£1.2 million to £1.5 million', '£1.5 million to £2 million', '£2 million to £3 million', 'Over £3 million'];
    const b = leads.map((r) => bands.indexOf(r.budget)).filter((i) => i >= 0).sort((x, y) => x - y);
    const median = b.length ? bands[b[Math.floor((b.length - 1) / 2)]] : null;
    const budgetBase = leads.filter((r) => r.budget).length;
    const over700 = b.filter((i) => i >= bands.indexOf('£700,000 to £900,000')).length;
    const homeBase = leads.filter((r) => r.own_home).length;
    const equity = leads.filter((r) => r.own_home === 'Yes, with over £500,000 equity').length;
    const schoolBase = leads.filter((r) => r.school_now).length;
    const indep = leads.filter((r) => r.school_now === 'Independent school' || r.school_now === 'A mix of both').length;
    const ms = leads.filter((r) => r.microsoft_email === true || r.microsoft_email === 'true');
    const other = leads.filter((r) => !(r.microsoft_email === true || r.microsoft_email === 'true'));
    const c = (arr) => arr.filter((r) => r.confirmed === true || r.confirmed === 'true').length;
    return [{
      families: n, last7, confirmed: conf, confirmed_pct: HW.pct(conf, n), hot: score('hot'), warm: score('warm'), cold: score('cold'),
      avg_children: avgKids, median_budget: median, over_700k_pct: HW.pct(over700, budgetBase), equity_pct: HW.pct(equity, homeBase),
      indep_pct: HW.pct(indep, schoolBase), with_postcode: leads.filter((r) => r.outcode).length,
      ms_confirm_pct: HW.pct(c(ms), ms.length), other_confirm_pct: HW.pct(c(other), other.length)
    }];
  }
});

dash.calc('places', {
  inputs: ['leads', 'outcodes'],
  title: 'Families by postcode district',
  description: 'Founding families grouped by the first half of their postcode, placed at the middle of that district.',
  fn: (leads, outcodes) => {
    const look = new Map(outcodes.map((o) => [o.outcode, o]));
    const g = new Map();
    for (const r of leads) {
      if (!r.outcode) continue;
      const o = look.get(r.outcode);
      if (!o) continue;
      const k = r.outcode;
      if (!g.has(k)) g.set(k, {outcode: k, town: o.town, area: r.area || o.town, lat: +o.lat, lng: +o.lng, n: 0, move_far: []});
      const x = g.get(k); x.n++; if (r.move_far) x.move_far.push(r.move_far);
      if (r.area) x.area = r.area;
    }
    return [...g.values()].map((x) => ({...x, move_far: x.move_far.join(' | ')}));
  }
});

dash.calc('areas', {
  inputs: ['places'],
  title: 'Families by area',
  description: 'Postcode districts grouped by council area, most families first.',
  fn: (places) => {
    const g = new Map();
    for (const p of places) {
      if (!g.has(p.area)) g.set(p.area, {area: p.area, districts: [], n: 0});
      const x = g.get(p.area); x.n += p.n; x.districts.push(p.outcode);
    }
    return [...g.values()].map((x) => ({...x, districts: x.districts.sort().join(', ')})).sort((a, b) => b.n - a.n || a.area.localeCompare(b.area));
  }
});

dash.calc('daily', {
  inputs: ['leads'],
  title: 'Families joining each day',
  description: 'Founding families by the London date they joined.',
  fn: (leads) => {
    const g = new Map();
    for (const r of leads) { const d = String(r.joined).slice(0, 10); g.set(d, (g.get(d) || 0) + 1); }
    const days = [...g.keys()].sort();
    if (!days.length) return [];
    const out = [];
    for (let t = new Date(days[0] + 'T12:00:00Z'); t.toISOString().slice(0, 10) <= days[days.length - 1]; t = new Date(t.getTime() + 864e5)) {
      const d = t.toISOString().slice(0, 10); out.push({day: d, n: g.get(d) || 0});
    }
    return out;
  }
});

dash.calc('funnel', {
  inputs: ['visitors'],
  title: 'Visit to join, 14 and 15 Nov',
  description: 'Totals over the days with full quiz tracking.',
  fn: (visitors) => {
    const days = visitors.filter((v) => v.quiz_opened !== null && v.quiz_opened !== '');
    const s = (k) => days.reduce((a, v) => a + (+v[k] || 0), 0);
    const vis = s('visitors'), op = s('quiz_opened'), jn = s('joined_digest');
    return [{visitors: vis, opened: op, joined: jn, open_pct: HW.pct(op, vis), join_pct: HW.pct(jn, op)}];
  }
});


dash.calc('reach', {
  inputs: ['places', 'sites'],
  title: 'Families each site could suit',
  description: 'For each possible site: families within about an hour (45 miles) and two hours (90 miles) in a straight line, families whose own "how far would you move" answer covers it, and families for whom it is the closest site.',
  fn: (places, sites) => {
    const S = sites.map((s) => ({...s, lat: +s.lat, lng: +s.lng}));
    const res = S.map((s) => ({site: String(s.site), name: s.name, area: s.area, within_1h: 0, within_2h: 0, would_move: 0, nearest: 0}));
    for (const p of places) {
      const d = S.map((s) => HW.miles(p.lat, p.lng, s.lat, s.lng));
      res[d.indexOf(Math.min(...d))].nearest += p.n;
      const moves = p.move_far ? p.move_far.split(' | ') : [];
      S.forEach((s, i) => {
        if (d[i] <= 45) res[i].within_1h += p.n;
        if (d[i] <= 90) res[i].within_2h += p.n;
        for (const m of moves) { const lim = HW.reachMiles(m); if (lim != null && d[i] <= lim) res[i].would_move++; }
      });
    }
    return res;
  }
});

dash.calc('adstats', {
  inputs: ['spend', 'leads'],
  title: 'Cost per family for each ad',
  description: 'Spend for each ad up to the date in the spend copy, divided by the families who joined from that ad up to the same date.',
  fn: (spend, leads) => {
    const out = [];
    for (const s of spend) {
      const amount = +s.spend;
      if (!(amount > 0) && s.status !== 'Starting') continue;
      // Match on campaign too: Top towns and Launch both use the ad tag ad2_v2.
      const mine = leads.filter((r) => r.ad === s.ad && (r.campaign || '') === s.campaign && String(r.joined).slice(0, 10) <= s.through);
      const fam = mine.length;
      const conf = mine.filter((r) => r.confirmed === true || r.confirmed === 'true').length;
      out.push({ad: s.ad, ad_name: s.ad_name, channel: s.channel, campaign: s.campaign, status: s.status, spend: amount, families: fam, confirmed: conf,
        cpl: fam ? Math.round((100 * amount) / fam) / 100 : null, cost_per_confirmed: conf ? Math.round((100 * amount) / conf) / 100 : null});
    }
    // Verdict against the Meta average cost per family
    const meta = out.filter((a) => a.channel === 'Meta ads');
    const mf = meta.reduce((t, a) => t + a.families, 0);
    const avg = mf ? meta.reduce((t, a) => t + a.spend, 0) / mf : null;
    const order = {scale: 1, more: 2, keep: 3, watch: 4, early: 5, cut: 6, paused: 7};
    for (const a of out) {
      let v;
      if (a.status === 'Starting') v = ['early', 'Just started'];
      else if (a.status === 'Paused' || a.status === 'Off') v = a.families && avg && a.cpl > avg * 2 ? ['paused', 'Paused, too expensive'] : ['paused', 'Paused'];
      else if (avg == null) v = ['early', 'Too early to tell'];
      else if (a.families >= 3) v = a.cpl <= avg ? ['scale', 'Scale up'] : a.cpl <= avg * 1.5 ? ['keep', 'Keep running'] : ['cut', 'Cut back'];
      else if (a.families >= 1) v = a.cpl <= avg ? ['more', 'Give it more spend'] : ['watch', 'Watch'];
      else v = a.spend >= 2 * avg ? ['cut', 'Cut'] : ['early', 'Too early to tell'];
      a.verdict_key = v[0]; a.verdict = v[1]; a.verdict_rank = order[v[0]];
    }
    return out.sort((a, b) => a.verdict_rank - b.verdict_rank || b.families - a.families || (a.cpl ?? 1e9) - (b.cpl ?? 1e9));
  }
});

dash.calc('cost', {
  inputs: ['adstats', 'leads'],
  title: 'Spend and cost per family to date',
  description: 'Totals across every ad with spend, and across Meta ads only. CAC is all ad spend divided by every founding family, free channels included.',
  fn: (ads, leads) => {
    const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
    const meta = ads.filter((a) => a.channel === 'Meta ads');
    const sa = sum(ads, 'spend'), fa = sum(ads, 'families'), sm = sum(meta, 'spend'), fm = sum(meta, 'families');
    const gbp = (v) => '£' + v.toFixed(2);
    const n = leads.length;
    return [{spend_all: gbp(sa), families_paid: fa, cpl_all: fa ? gbp(sa / fa) : '—', spend_meta: gbp(sm), families_meta: fm, cpl_meta: fm ? gbp(sm / fm) : '—',
      spend_other: gbp(sa - sm), families_all: n, cac_all: n ? gbp(sa / n) : '—'}];
  }
});

dash.calc('free', {
  inputs: ['leads'],
  title: 'Families from free channels',
  description: 'Families who came from Instagram, direct visits or shared links, with no ad spend.',
  fn: (leads) => {
    const name = {ig: 'Instagram', direct: 'Direct visits', share: 'Shared links'};
    const g = new Map();
    for (const r of leads) if (name[r.source]) g.set(name[r.source], (g.get(name[r.source]) || 0) + 1);
    return [...g].map(([channel, n]) => ({channel, n})).sort((a, b) => b.n - a.n);
  }
});

// ---------- drawings ----------
window.HW_STATE = window.HW_STATE || {site: null};
const gbp = (v) => (v == null ? '—' : '£' + Number(v).toFixed(2));
const hwKpi = (src, field) => (el) => {
  const k = dash.data(src);
  el.textContent = k.status === 'ok' && k.data && k.data[0] && k.data[0][field] != null ? String(k.data[0][field]) : '—';
};
[['k-families', 'families'], ['k-last7', 'last7'], ['k-conf', 'confirmed_pct'], ['k-confn', 'confirmed'], ['k-hot', 'hot'], ['k-warm', 'warm'], ['k-cold', 'cold'],
 ['k-kids', 'avg_children'], ['k-budget', 'median_budget'], ['k-big', 'over_700k_pct'], ['k-equity', 'equity_pct'], ['k-indep', 'indep_pct'],
 ['m-mapped', 'with_postcode'], ['m-total', 'families'], ['k-ms', 'ms_confirm_pct'], ['k-nonms', 'other_confirm_pct']].forEach(([n, f]) => dash.draw(n, hwKpi('kpi', f)));
[['c-spend2', 'spend_all'], ['c-smeta', 'spend_meta'], ['c-sother', 'spend_other'], ['c-cac', 'cac_all'], ['c-fall', 'families_all'],
 ['c-cplm2', 'cpl_meta'], ['c-cpl', 'cpl_all'], ['c-spend', 'spend_all'], ['c-cplm', 'cpl_meta'], ['c-fm', 'families_meta'], ['c-sm', 'spend_meta']].forEach(([n, f]) => dash.draw(n, hwKpi('cost', f)));
[['f-vis', 'visitors'], ['f-open', 'opened'], ['f-openpct', 'open_pct'], ['f-join', 'joined'], ['f-joinpct', 'join_pct']].forEach(([n, f]) => dash.draw(n, hwKpi('funnel', f)));

dash.draw('c-through', (el) => {
  const d = dash.data('spend');
  const t = d.status === 'ok' && d.data.length ? d.data.map((r) => r.through).sort().pop() : null;
  el.textContent = t ? d3.utcFormat('%-d %b')(new Date(t + 'T00:00:00Z')) : '—';
});

dash.draw('through', (el) => {
  const d = dash.data('spend');
  const t = d.status === 'ok' && d.data.length ? d.data.map((r) => r.through).sort().pop() : null;
  el.textContent = t ? d3.utcFormat('%-d %b')(new Date(t + 'T00:00:00Z')) : '—';
});

dash.draw('takeaway', (el) => {
  const k = dash.data('kpi'), a = dash.data('answers'), r = dash.data('reach'), c = dash.data('cost'), ads = dash.data('adstats');
  if (k.status !== 'ok' || !k.data || !k.data[0]) { el.textContent = '—'; return; }
  const parts = [`${k.data[0].families} families have joined since 5 Nov.`];
  if (c.status === 'ok' && c.data && c.data[0]) parts.push(`Ads have cost ${c.data[0].cpl_all} per family so far.`);
  if (ads.status === 'ok' && ads.data && ads.data.length) {
    const best = ads.data.filter((x) => x.verdict_key === 'scale').sort((x, y) => x.cpl - y.cpl)[0];
    if (best) parts.push(`The best ad is ${best.ad_name.split(' · ').slice(0, 2).join(' ')} at ${gbp(best.cpl)} per family.`);
  }
  if (a.status === 'ok') {
    const top = (q) => (a.data || []).find((x) => x.q === q && x.rank === 1);
    const w = top('worry');
    if (w) parts.push(`Families' biggest worry is ${w.answer.toLowerCase()} (${Math.round(w.pct)}%).`);
  }
  if (r.status === 'ok' && r.data && r.data.length) {
    const b = [...r.data].sort((x, y) => y.would_move - x.would_move)[0];
    if (b.would_move > 0) parts.push(`${b.name} is the site most families would move to.`);
  }
  el.textContent = parts.join(' ');
});

dash.draw('advice', (el) => {
  const d = dash.data('adstats');
  el.replaceChildren();
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const short = (n) => n.split(' · ').slice(0, 2).join(' · ');
  const groups = [
    ['scale', 'Scale up', 'Cheaper than average with enough families to trust. Move budget here first.'],
    ['more', 'Give it more spend', 'A cheap early result, but Meta has barely spent on it. Worth its own budget to find out.'],
    ['keep', 'Keep running', 'Bringing families at close to the average cost.'],
    ['watch', 'Watch', 'One or two families at above-average cost. Too few to judge yet.'],
    ['cut', 'Cut back', 'Costing well over the average per family.'],
    ['paused', 'Paused', 'Not running now.']
  ];
  for (const [key, label, why] of groups) {
    const ads = d.data.filter((a) => a.verdict_key === key);
    if (!ads.length) continue;
    const c = document.createElement('div'); c.className = 'hw-adv';
    const chip = document.createElement('span'); chip.className = 'hw-chip ' + key; chip.textContent = label; chip.style.alignSelf = 'flex-start';
    const p = document.createElement('p'); p.textContent = why;
    const ul = document.createElement('ul');
    for (const a of ads) {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.textContent = a.channel === 'ChatGPT ads' ? 'ChatGPT ad' : short(a.ad_name);
      const v = document.createElement('span'); v.textContent = a.families ? `${gbp(a.cpl)} · ${a.families} ${a.families === 1 ? 'family' : 'families'}` : `${gbp(a.spend)} spent`;
      li.append(n, v); ul.append(li);
    }
    c.append(chip, p, ul); el.append(c);
  }
});

const hwCampaign = (c) => (c.startsWith('cmpn_') ? 'ChatGPT' : c.startsWith('areas_') ? 'Top towns' : {launch: 'Launch', christmas: 'Christmas', reel: 'Reel', areas: 'Areas'}[c] || c);

dash.draw('ad-rows', (tb) => {
  const d = dash.data('adstats');
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  for (const a of d.data) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(a.ad);
    const vc = tr.insertCell(); const chip = document.createElement('span'); chip.className = 'hw-chip ' + a.verdict_key; chip.textContent = a.verdict; vc.append(chip);
    [a.ad_name, hwCampaign(a.campaign), gbp(a.spend), a.families, a.families ? gbp(a.cpl) : 'none yet', a.confirmed]
      .forEach((v, i) => { const td = tr.insertCell(); td.textContent = v; if (i >= 2) td.className = 'num'; if (i === 0) td.className = 'strong'; });
  }
});

dash.draw('free', (el) => {
  const d = dash.data('free');
  el.textContent = d.status === 'ok' && d.data.length ? d.data.map((r) => `${r.channel} ${r.n}`).join(', ') : '—';
});

// ----- map -----
const HW_CITIES = [
  ['London', 51.507, -0.128, 1], ['Birmingham', 52.486, -1.89, 1], ['Manchester', 53.48, -2.242, 1], ['Leeds', 53.8, -1.549, 1], ['Bristol', 51.454, -2.588, 1],
  ['Newcastle', 54.978, -1.618, 1], ['Cardiff', 51.481, -3.179, 2], ['Liverpool', 53.408, -2.991, 2], ['Sheffield', 53.381, -1.47, 2], ['Nottingham', 52.954, -1.158, 2],
  ['Leicester', 52.637, -1.14, 2], ['Cambridge', 52.205, 0.122, 2], ['Oxford', 51.752, -1.258, 2], ['Derby', 52.922, -1.477, 2], ['Preston', 53.763, -2.703, 2],
  ['Lancaster', 54.047, -2.801, 2], ['Bath', 51.381, -2.359, 2], ['Crewe', 53.099, -2.441, 2], ['Lincoln', 53.234, -0.538, 2], ['Norwich', 52.63, 1.297, 2],
  ['Southampton', 50.909, -1.404, 2], ['York', 53.96, -1.087, 2], ['Peterborough', 52.573, -0.249, 2], ['Chesterfield', 53.235, -1.421, 2], ['Exeter', 50.718, -3.534, 2],
  ['Brighton', 50.822, -0.137, 2], ['Plymouth', 50.375, -4.143, 2], ['Stoke', 53.003, -2.18, 2], ['Coventry', 52.406, -1.512, 2], ['Milton Keynes', 52.04, -0.759, 2],
  ['Reading', 51.454, -0.978, 2], ['Ipswich', 52.056, 1.148, 2], ['Gloucester', 51.864, -2.238, 2], ['Blackpool', 53.817, -3.05, 2], ['Kendal', 54.328, -2.746, 2]
];
const hwProj = (lat, lng) => {
  const M = window.HW_MAP;
  const yy = (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
  return [(lng + 11) * 60 * M.k, (M.yy0 - yy) * 60 * M.k];
};
const HW_FULL = [168, 300, 285, 385];
// The site Aaron and Eren are focusing on (chosen by Aaron, 16 Nov 2026)
const HW_FOCUS_SITE = '1';

dash.draw('map', {
  mount(el) {
    el.replaceChildren();
    if (!window.HW_MAP) { el.textContent = 'Map outline failed to load'; return null; }
    const svg = d3.select(el).append('svg').attr('viewBox', HW_FULL.join(' ')).attr('preserveAspectRatio', 'xMidYMid meet').attr('role', 'img')
      .attr('aria-label', 'Map of England and Wales showing founding families and the 7 possible Hearthwood sites');
    svg.append('rect').attr('x', -400).attr('y', -400).attr('width', 1400).attr('height', 1600).style('fill', '#eaf0f2');
    svg.append('path').attr('class', 'hw-land ie').attr('d', window.HW_MAP.ie);
    svg.append('path').attr('class', 'hw-land').attr('d', window.HW_MAP.gb);
    const layers = {rings: svg.append('g'), cities: svg.append('g'), fams: svg.append('g'), pins: svg.append('g')};
    const tip = d3.select(el).append('div').attr('class', 'hw-tip').style('display', 'none');
    const reset = () => { window.HW_STATE.site = null; window.HW_STATE.vb = null; dash.draw('map'); dash.draw('sitelist'); dash.draw('sitedetail'); };
    const btn = d3.select(el).append('button').attr('type', 'button').attr('class', 'hw-btn hw-mapbtn').text('Show all of England').style('display', 'none').on('click', reset);
    const made = {svg, layers, tip, btn, vb: HW_FULL.slice(), apply: null, dragged: false};
    const zoomBy = (f) => {
      const vb = made.vb, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
      const w = Math.max(30, Math.min(HW_FULL[2] * 1.15, vb[2] * f)), h = (w * HW_FULL[3]) / HW_FULL[2];
      window.HW_STATE.vb = [cx - w / 2, cy - h / 2, w, h]; dash.draw('map');
    };
    const zc = d3.select(el).append('div').attr('class', 'hw-zoom');
    zc.append('button').attr('type', 'button').attr('class', 'hw-btn').attr('aria-label', 'Zoom in').text('+').on('click', () => zoomBy(0.6));
    zc.append('button').attr('type', 'button').attr('class', 'hw-btn').attr('aria-label', 'Zoom out').text('−').on('click', () => zoomBy(1 / 0.6));
    // drag to move around
    let drag = null;
    const node = svg.node();
    node.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      drag = {x: ev.clientX, y: ev.clientY, vb: made.vb.slice(), moved: false};
      made.dragged = false;
    });
    window.addEventListener('pointermove', (ev) => {
      if (!drag || !made.apply) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true; made.dragged = true; tip.style('display', 'none'); node.classList.add('dragging');
      const r = node.getBoundingClientRect();
      const u = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height);
      const vb = [drag.vb[0] - dx * u, drag.vb[1] - dy * u, drag.vb[2], drag.vb[3]];
      svg.interrupt(); made.vb = vb; made.apply(vb);
    });
    window.addEventListener('pointerup', () => {
      if (drag && drag.moved) { window.HW_STATE.vb = made.vb.slice(); made.btn.style('display', null); setTimeout(() => { made.dragged = false; }, 0); }
      drag = null; node.classList.remove('dragging');
    });
    el.addEventListener('pointerleave', () => tip.style('display', 'none'));
    return made;
  },
  update(el, m) {
    if (!m) return;
    const P = dash.data('places'), Sd = dash.data('sites'), Rd = dash.data('reach');
    const sites = Sd.status === 'ok' ? Sd.data : [];
    const places = P.status === 'ok' ? P.data : [];
    const reach = Rd.status === 'ok' ? new Map(Rd.data.map((r) => [String(r.site), r])) : new Map();
    const sel = sites.find((s) => String(s.site) === String(window.HW_STATE.site));
    const pxPerMile = (hwProj(53, -1.5)[1] - hwProj(54, -1.5)[1]) / 69.0;
    let target = HW_FULL;
    if (window.HW_STATE.vb) target = window.HW_STATE.vb;
    else if (sel) {
      const [cx, cy] = hwProj(+sel.lat, +sel.lng);
      const h = 2 * 100 * pxPerMile, w = h * (HW_FULL[2] / HW_FULL[3]);
      target = [cx - w / 2, cy - h / 2, w, h];
    }
    const showTip = (ev, fill) => {
      const box = el.getBoundingClientRect();
      m.tip.style('display', 'block').html(''); fill(m.tip);
      const tw = m.tip.node().offsetWidth, th = m.tip.node().offsetHeight;
      let x = ev.clientX - box.left + 12, y = ev.clientY - box.top + 12;
      if (x + tw > box.width - 6) x = Math.max(6, ev.clientX - box.left - tw - 12);
      if (y + th > box.height - 6) y = Math.max(6, ev.clientY - box.top - th - 12);
      m.tip.style('left', x + 'px').style('top', y + 'px');
    };
    const pick = (s) => { if (m.dragged) return; window.HW_STATE.site = String(s.site); window.HW_STATE.vb = null; m.tip.style('display', 'none'); dash.draw('map'); dash.draw('sitelist'); dash.draw('sitedetail'); };

    // rings for the chosen site only
    const ringData = sel ? [[90, 'r2', 'about 2 hours'], [45, 'r1', 'about 1 hour']] : [];
    const rp = sel ? hwProj(+sel.lat, +sel.lng) : [0, 0];
    const ringFocus = sel && String(sel.site) === HW_FOCUS_SITE;
    m.layers.rings.selectAll('circle').data(ringData).join('circle').attr('class', (d) => 'hw-ring ' + d[1] + (ringFocus ? ' focus' : ''))
      .attr('cx', rp[0]).attr('cy', rp[1]).attr('r', (d) => d[0] * pxPerMile);
    m.layers.rings.selectAll('text').data(ringData).join('text').attr('class', 'hw-ringlbl').attr('text-anchor', 'middle')
      .attr('x', rp[0]).attr('y', (d) => rp[1] - d[0] * pxPerMile - 2).text((d) => d[2]);

    const cities = m.layers.cities.selectAll('g').data(HW_CITIES).join((en) => { const g = en.append('g').attr('class', 'hw-city'); g.append('circle'); g.append('text'); return g; })
      .attr('transform', (c) => `translate(${hwProj(c[1], c[2])})`);
    cities.select('text').text((c) => c[0]).attr('dy', '-0.5em').attr('text-anchor', 'middle');

    const famDist = (p) => (sel ? HW.miles(p.lat, p.lng, +sel.lat, +sel.lng) : 0);
    m.layers.fams.selectAll('circle').data(places, (p) => p.outcode).join('circle')
      .attr('class', (p) => 'hw-fam' + (sel && famDist(p) > 90 ? ' dim' : ''))
      .attr('cx', (p) => hwProj(p.lat, p.lng)[0]).attr('cy', (p) => hwProj(p.lat, p.lng)[1])
      .on('click pointerenter', (ev, p) => m.dragged ? null : showTip(ev, (t) => {
        t.append('b').text(`${p.outcode} · ${p.area}`);
        t.append('div').text(`${p.n} ${p.n === 1 ? 'family' : 'families'}`);
        if (p.move_far) t.append('div').text(`Would move: ${[...new Set(p.move_far.split(' | '))].join(', ').toLowerCase()}`);
        if (sel) t.append('div').text(`${Math.round(famDist(p))} miles from ${sel.name}`);
      }));

    const pins = m.layers.pins.selectAll('g').data(sites, (s) => s.site).join((en) => {
      const g = en.append('g').attr('class', 'hw-pin').attr('tabindex', 0).attr('role', 'button');
      g.append('rect').attr('class', 'pill'); g.append('text').attr('class', 'n').attr('text-anchor', 'middle').attr('dy', '0.35em');
      return g;
    }).attr('transform', (s) => `translate(${hwProj(+s.lat, +s.lng)})`)
      .classed('sel', (s) => sel && String(s.site) === String(sel.site))
      .classed('focus', (s) => String(s.site) === HW_FOCUS_SITE)
      .attr('aria-label', (s) => `Site ${s.site}, ${s.name}. Zoom in`)
      .on('click', (ev, s) => { ev.stopPropagation(); pick(s); })
      .on('keydown', (ev, s) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(s); } })
      .on('pointerenter', (ev, s) => showTip(ev, (t) => {
        t.append('b').text(`Site ${s.site} · ${s.name}`);
        if (String(s.site) === HW_FOCUS_SITE) t.append('div').style('color', '#b3261e').style('font-weight', '600').text('The site we’re focusing on');
        t.append('div').text(s.area);
        const r = reach.get(String(s.site));
        if (r) t.append('div').text(`${r.would_move} families would move this far`);
        if (!(sel && String(s.site) === String(sel.site))) t.append('div').style('color', '#6b6f66').text('Click to zoom in');
      }));
    pins.select('text.n').text((s) => `Site ${s.site}`);
    pins.filter((s) => String(s.site) === HW_FOCUS_SITE).raise();

    m.btn.style('display', sel || window.HW_STATE.vb ? null : 'none');

    // size everything to the view so it reads the same at any zoom
    const apply = (vb) => {
      m.svg.attr('viewBox', vb.join(' '));
      const k = vb[2] / HW_FULL[2];
      m.layers.cities.selectAll('g').style('display', (c) => (c[3] === 1 || k < 0.75 ? null : 'none'));
      m.layers.cities.selectAll('circle').attr('r', 1.6 * k);
      m.layers.cities.selectAll('text').style('font-size', 8.5 * k + 'px').style('stroke-width', 2.6 * k + 'px');
      m.layers.fams.selectAll('circle').attr('r', (p) => (3.2 + 1.6 * Math.sqrt(p.n)) * k).style('stroke-width', 0.8 * k);
      m.layers.pins.selectAll('rect.pill').attr('x', -12 * k).attr('y', -5 * k).attr('width', 24 * k).attr('height', 10 * k).attr('rx', 5 * k).style('stroke-width', 1.2 * k);
      m.layers.pins.selectAll('text.n').style('font-size', 6.4 * k + 'px');
      m.layers.rings.selectAll('text').style('font-size', 8 * k + 'px').style('stroke-width', 3 * k + 'px');
    };
    m.apply = apply;
    const from = m.vb.slice();
    const same = from.every((v, i) => Math.abs(v - target[i]) < 0.01);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (same || reduce) { apply(target); m.vb = target.slice(); return; }
    const ip = d3.interpolate(from, target);
    m.svg.interrupt().transition().duration(650).ease(d3.easeCubicInOut)
      .tween('zoom', () => (t) => { const v = ip(t); m.vb = v; apply(v); });
  }
});

dash.draw('sitelist', (el) => {
  const Sd = dash.data('sites'), Rd = dash.data('reach');
  el.replaceChildren();
  if (Sd.status !== 'ok') { el.textContent = '—'; return; }
  const reach = Rd.status === 'ok' ? new Map(Rd.data.map((r) => [String(r.site), r])) : new Map();
  for (const s of Sd.data) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'hw-sitebtn' + (String(window.HW_STATE.site) === String(s.site) ? ' sel' : '') + (String(s.site) === HW_FOCUS_SITE ? ' focus' : '');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = `Site ${s.site}`;
    const t = document.createElement('span'); t.className = 't'; t.textContent = s.name;
    const sm = document.createElement('small'); sm.textContent = String(s.site) === HW_FOCUS_SITE ? `${s.area} · our focus` : s.area; t.append(sm);
    const c = document.createElement('span'); c.className = 'c';
    const r = reach.get(String(s.site)); c.textContent = r ? `${r.would_move} would move` : '';
    b.append(n, t, c);
    b.onclick = () => { window.HW_STATE.vb = null; window.HW_STATE.site = String(window.HW_STATE.site) === String(s.site) ? null : String(s.site); dash.draw('map'); dash.draw('sitelist'); dash.draw('sitedetail'); };
    el.append(b);
  }
});

dash.draw('sitedetail', (el) => {
  const Sd = dash.data('sites'), Rd = dash.data('reach'), P = dash.data('places');
  el.replaceChildren();
  const s = Sd.status === 'ok' ? Sd.data.find((x) => String(x.site) === String(window.HW_STATE.site)) : null;
  const add = (tag, text, cls) => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; el.append(e); return e; };
  if (!s) {
    add('h3', 'Pick a site');
    add('p', 'Click a numbered pin or a site above to zoom in and see the families around it.', 'hw-muted');
    return;
  }
  const r = Rd.status === 'ok' ? Rd.data.find((x) => String(x.site) === String(s.site)) : null;
  add('h3', `Site ${s.site}: ${s.name}`);
  add('span', `${s.area} · ${s.landowner}`, 'hw-muted');
  add('p', s.travel);
  if (r) add('p', `${r.within_1h} families live within about an hour, ${r.within_2h} within two hours, and ${r.would_move} said they'd move this far. It's the closest site for ${r.nearest}.`);
  if (/Rough/.test(s.precision)) add('span', 'The exact spot isn’t chosen yet, so this pin marks the middle of the area.', 'hw-muted');
  if (P.status === 'ok') {
    const near = P.data.map((p) => ({...p, d: HW.miles(p.lat, p.lng, +s.lat, +s.lng)})).filter((p) => p.d <= 90).sort((a, b) => a.d - b.d);
    if (near.length) {
      add('span', 'Families within two hours', 'hw-muted');
      const ul = document.createElement('ul');
      for (const p of near) { const li = document.createElement('li'); li.textContent = `${p.outcode} ${p.area}: ${Math.round(p.d)} miles, ${p.n} ${p.n === 1 ? 'family' : 'families'}`; ul.append(li); }
      el.append(ul);
    } else add('span', 'No mapped families within two hours yet.', 'hw-muted');
  }
});

dash.draw('reach-rows', (tb) => {
  const r = dash.data('reach');
  tb.replaceChildren();
  if (r.status !== 'ok') return;
  const top = [...r.data].sort((a, b) => b.would_move - a.would_move)[0];
  for (const s of [...r.data].sort((a, b) => b.would_move - a.would_move || b.within_1h - a.within_1h)) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(s.site);
    if (s === top) tr.className = 'best';
    [s.site, `${s.name}, ${s.area}`, s.within_1h, s.within_2h, s.would_move, s.nearest].forEach((v, i) => { const td = tr.insertCell(); td.textContent = v; if (i >= 2) td.className = 'num'; });
  }
});

dash.draw('area-rows', (tb) => {
  const r = dash.data('areas');
  tb.replaceChildren();
  if (r.status !== 'ok') return;
  for (const a of r.data) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(a.area);
    [a.area, a.districts, a.n].forEach((v, i) => { const td = tr.insertCell(); td.textContent = v; if (i === 2) td.className = 'num'; });
  }
});

dash.draw('questions', (el) => {
  const a = dash.data('answers');
  if (a.status !== 'ok') { el.textContent = a.status === 'error' ? 'Failed to load' : '—'; return; }
  el.replaceChildren();
  for (const [key, label, multi] of HW_Q) {
    const rows = a.data.filter((x) => x.q === key);
    if (!rows.length) continue;
    const card = document.createElement('div'); card.className = 'hw-q'; card.id = 'q-' + key;
    const h = document.createElement('h3'); h.textContent = label; card.append(h);
    const sub = document.createElement('span'); sub.className = 'hw-muted';
    sub.textContent = key === 'ages' ? `${rows[0].base} children` : `${rows[0].base} families answered${multi ? ', could pick several' : ''}`;
    card.append(sub);
    const bars = document.createElement('div'); bars.className = 'hw-bars';
    const max = Math.max(...rows.map((r) => r.pct));
    for (const r of rows) {
      const b = document.createElement('div'); b.className = 'hw-bar';
      const t = document.createElement('span'); t.className = 't'; t.textContent = r.answer;
      if (r.rank === 1) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Most picked'; t.append(tag); }
      const vv = document.createElement('span'); vv.className = 'v';
      const v = document.createElement('span');
      v.dataset.source = 'answers'; v.dataset.field = 'pct'; v.dataset.where = `q=${encodeURIComponent(r.q)}&answer=${encodeURIComponent(r.answer)}`;
      v.textContent = `${Math.round(r.pct)}%`;
      const n = document.createElement('small'); n.textContent = ` · ${r.n}`;
      vv.append(v, n);
      const track = document.createElement('div'); track.className = 'track';
      const fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = (max ? (100 * r.pct) / max : 0) + '%';
      track.append(fill);
      b.append(t, vv, track); bars.append(b);
    }
    card.append(bars); el.append(card);
  }
});

dash.draw('daily', (el) => {
  const d = dash.data('daily');
  el.replaceChildren();
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const W = el.clientWidth || 600, H = 200, m = {t: 18, r: 8, b: 24, l: 28};
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Bar chart of founding families joining each day');
  const x = d3.scaleBand().domain(d.data.map((r) => r.day)).range([m.l, W - m.r]).padding(0.25);
  const y = d3.scaleLinear().domain([0, d3.max(d.data, (r) => r.n) || 1]).nice().range([H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(d3.format('d')))
    .call((g) => { g.select('.domain').remove(); g.selectAll('line').style('stroke', '#ecebe6'); });
  const every = Math.ceil(d.data.length / Math.max(1, Math.floor(W / 60)));
  svg.append('g').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(d.data.filter((_, i) => i % every === 0).map((r) => r.day)).tickFormat((s) => d3.utcFormat('%-d %b')(new Date(s + 'T00:00:00Z'))))
    .call((g) => g.selectAll('line,.domain').style('stroke', '#c9cfc9'));
  svg.append('g').selectAll('rect').data(d.data).join('rect')
    .attr('x', (r) => x(r.day)).attr('width', x.bandwidth()).attr('y', (r) => y(r.n)).attr('height', (r) => y(0) - y(r.n)).attr('rx', 2).style('fill', '#4f7a63');
  svg.append('g').selectAll('text').data(d.data.filter((r) => r.n > 0)).join('text')
    .attr('x', (r) => x(r.day) + x.bandwidth() / 2).attr('y', (r) => y(r.n) - 4).attr('text-anchor', 'middle').style('fill', '#1f3a2e').text((r) => r.n);
});

// ----- spend by hour -----
dash.calc('byhour', {
  inputs: ['hourly', 'leads'],
  title: 'Meta spend and families by hour of day',
  description: 'Meta spend for each hour of the day (UK time) over the dates in the copy, with the families from Meta ads who joined in that hour over the same dates.',
  fn: (hourly, leads) => {
    if (!hourly.length) return [];
    const from = hourly[0].from, to = hourly[0].to;
    return hourly.map((h) => {
      const hr = +h.hour;
      const fam = leads.filter((r) => r.source === 'meta' && String(r.joined).slice(0, 10) >= from && String(r.joined).slice(0, 10) <= to && +String(r.joined).slice(11, 13) === hr).length;
      return {hour: hr, spend: +h.spend, families: fam, from, to};
    });
  }
});

dash.calc('hourblocks', {
  inputs: ['byhour'],
  title: 'Meta spend by time of day',
  description: 'Hourly spend and families grouped into five parts of the day.',
  fn: (rows) => {
    const blocks = [['Midnight to 5am', 0, 5], ['5am to 9am', 5, 9], ['9am to 5pm', 9, 17], ['5pm to 8pm', 17, 20], ['8pm to midnight', 20, 24]];
    const total = rows.reduce((t, r) => t + r.spend, 0);
    return blocks.map(([block, a, b]) => {
      const rs = rows.filter((r) => r.hour >= a && r.hour < b);
      const spend = Math.round(100 * rs.reduce((t, r) => t + r.spend, 0)) / 100;
      const families = rs.reduce((t, r) => t + r.families, 0);
      return {block, spend, spend_txt: '£' + spend.toFixed(2), share: total ? Math.round((100 * spend) / total) + '%' : '—', families, cpl: families ? '£' + (spend / families).toFixed(2) : 'none yet'};
    });
  }
});

dash.draw('ans', (el) => {
  const a = dash.data('answers');
  const r = a.status === 'ok' ? a.data.find((x) => x.q === el.dataset.q && x.answer === el.dataset.a) : null;
  el.textContent = r ? `${Math.round(r.pct)}%` : (a.status === 'ok' ? '0%' : '—');
});

dash.draw('blk', (el) => {
  const d = dash.data('hourblocks');
  const r = d.status === 'ok' ? d.data.find((x) => x.block === el.dataset.block) : null;
  el.textContent = r ? String(r[el.dataset.f]) : '—';
});

dash.draw('block-rows', (tb) => {
  const d = dash.data('hourblocks');
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  for (const r of d.data) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(r.block);
    [r.block, r.spend_txt, r.share, r.families, r.cpl].forEach((v, i) => { const td = tr.insertCell(); td.textContent = v; if (i) td.className = 'num'; if (!i) td.className = 'strong'; });
  }
});

dash.draw('hourly', (el) => {
  const d = dash.data('byhour');
  el.replaceChildren();
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  el.style.position = 'relative';
  const W = el.clientWidth || 600, H = 230, m = {t: 22, r: 10, b: 28, l: 40};
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
    .attr('aria-label', 'Bar chart of Meta spend for each hour of the day, with families who joined in each hour');
  const x = d3.scaleBand().domain(d.data.map((r) => r.hour)).range([m.l, W - m.r]).padding(0.18);
  const y = d3.scaleLinear().domain([0, d3.max(d.data, (r) => r.spend) || 1]).nice().range([H - m.b, m.t]);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat((v) => '£' + v))
    .call((g) => { g.select('.domain').remove(); g.selectAll('line').style('stroke', '#ecebe6'); });
  const every = W < 500 ? 6 : 3;
  svg.append('g').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(d.data.filter((r) => r.hour % every === 0).map((r) => r.hour)).tickFormat((h) => (h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : h - 12 + 'pm')))
    .call((g) => g.selectAll('line,.domain').style('stroke', '#c9cfc9'));
  const night = (h) => h < 5;
  const tip = d3.select(el).append('div').attr('class', 'hw-tip').style('display', 'none');
  const hh = (h) => (h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : h - 12 + 'pm');
  svg.append('g').selectAll('rect').data(d.data).join('rect')
    .attr('x', (r) => x(r.hour)).attr('width', x.bandwidth()).attr('y', (r) => y(r.spend)).attr('height', (r) => y(0) - y(r.spend)).attr('rx', 2)
    .style('fill', (r) => (night(r.hour) ? '#c9a77c' : '#4f7a63'))
    .on('pointerenter pointermove click', (ev, r) => {
      const box = el.getBoundingClientRect();
      tip.style('display', 'block').html('');
      tip.append('b').text(`${hh(r.hour)} to ${hh((r.hour + 1) % 24)}`);
      tip.append('div').text(`£${r.spend.toFixed(2)} spent · ${r.families} ${r.families === 1 ? 'family' : 'families'}`);
      const tw = tip.node().offsetWidth;
      let left = ev.clientX - box.left + 12; if (left + tw > box.width - 6) left = ev.clientX - box.left - tw - 12;
      tip.style('left', Math.max(6, left) + 'px').style('top', Math.max(6, ev.clientY - box.top - 50) + 'px');
    })
    .on('pointerleave', () => tip.style('display', 'none'));
  svg.append('g').selectAll('text').data(d.data.filter((r) => r.families > 0)).join('text')
    .attr('x', (r) => x(r.hour) + x.bandwidth() / 2).attr('y', (r) => y(r.spend) - 5).attr('text-anchor', 'middle')
    .style('fill', '#1f3a2e').style('font-weight', '600').text((r) => r.families);
  svg.append('text').attr('x', m.l).attr('y', 12).style('fill', '#6b6f66').text('Bars: £ spent · numbers above: families who joined');
});

// ----- who sees the ads -----
const hwDemo = (key, order) => (rows) => {
  const total = rows.reduce((t, r) => t + +r.spend, 0);
  const g = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!g.has(k)) g.set(k, {group: k, spend: 0, impressions: 0, leads: 0});
    const x = g.get(k); x.spend += +r.spend; x.impressions += +r.impressions; x.leads += +r.meta_leads;
  }
  return [...g.values()].map((x) => ({group: x.group, spend: Math.round(100 * x.spend) / 100, spend_share: total ? Math.round((100 * x.spend) / total) : 0,
    impressions: x.impressions, leads: x.leads, cpl: x.leads ? '£' + (x.spend / x.leads).toFixed(2) : 'none yet'}))
    .sort((a, b) => (order ? order.indexOf(a.group) - order.indexOf(b.group) : b.spend - a.spend));
};
dash.calc('demo_gender', {inputs: ['demo'], title: 'Meta spend by gender', description: "Spend, impressions and Meta's own lead count by gender, all campaigns.", fn: (demo) => hwDemo('gender', ['Female', 'Male', 'Unknown'])(demo)});
dash.calc('demo_age', {inputs: ['demo'], title: 'Meta spend by age group', description: "Spend, impressions and Meta's own lead count by age group, all campaigns.", fn: (demo) => hwDemo('age', ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'])(demo)});
const hwDemoRows = (id) => (tb) => {
  const d = dash.data(id);
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  for (const r of d.data) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(r.group);
    const a = tr.insertCell(); a.className = 'strong'; a.textContent = r.group === 'Unknown' ? 'Not known' : r.group.replace('-', ' to ');
    const b = tr.insertCell(); const bar = document.createElement('div'); bar.className = 'hw-sharebar';
    const trk = document.createElement('div'); trk.className = 'tr'; const fl = document.createElement('div'); fl.className = 'fl'; fl.style.width = r.spend_share + '%'; trk.append(fl);
    const s = document.createElement('span'); s.textContent = r.spend_share + '%'; bar.append(trk, s); b.append(bar);
    [`£${r.spend.toFixed(2)}`, r.leads, r.cpl].forEach((v) => { const td = tr.insertCell(); td.className = 'num'; td.textContent = v; });
  }
};
dash.draw('demo-gender', hwDemoRows('demo_gender'));
dash.draw('demo-age', hwDemoRows('demo_age'));
dash.draw('demo-note', (el) => {
  const a = dash.data('demo_age'), g = dash.data('demo_gender');
  if (a.status !== 'ok' || g.status !== 'ok') { el.textContent = '—'; return; }
  const parts = [];
  const f = g.data.find((x) => x.group === 'Female');
  if (f) parts.push(`Women get ${f.spend_share}% of the spend.`);
  const top = [...a.data].sort((x, y) => y.spend - x.spend)[0];
  if (top) parts.push(`${top.group.replace('-', ' to ')} year olds get the most (${top.spend_share}%).`);
  const best = a.data.filter((x) => x.leads >= 3).sort((x, y) => x.spend / x.leads - y.spend / y.leads)[0];
  if (best && best !== top) parts.push(`${best.group.replace('-', ' to ')} year olds are the cheapest per family (${best.cpl}).`);
  const old = a.data.filter((x) => x.group === '55-64' || x.group === '65+');
  const os = old.reduce((t, x) => t + x.spend, 0), ol = old.reduce((t, x) => t + x.leads, 0);
  if (os > 0) parts.push(`Over-55s took £${os.toFixed(2)} for ${ol} ${ol === 1 ? 'family' : 'families'}.`);
  parts.push("These are housing ads, so Meta doesn't allow targeting by age or gender. The way to steer it is the ads themselves: show parents in their 30s and 40s with young children, and Meta finds more people like them. Only 3 days of data, so treat this as early signs.");
  el.textContent = parts.join(' ');
});

// ----- estate charge -----
dash.draw('estate-rows', (tb) => {
  const d = dash.data('estate');
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  const gbp = (v) => '£' + Number(v).toLocaleString('en-GB');
  for (const r of d.data) {
    const tr = tb.insertRow(); tr.dataset.key = encodeURIComponent(r.home);
    if (r.home.startsWith('All')) tr.className = 'best';
    [r.home, r.homes, gbp(r.estate_fee), gbp(r.club), gbp(r.heat), gbp(r.total), gbp(r.per_month)].forEach((v, i) => {
      const td = tr.insertCell(); td.textContent = v; if (i) td.className = 'num'; if (!i) td.className = 'strong';
    });
  }
});
dash.draw('estate-fair', (el) => {
  const a = dash.data('answers');
  if (a.status !== 'ok') { el.textContent = '—'; return; }
  const rows = a.data.filter((x) => x.q === 'estate_charge');
  const base = rows.length ? rows[0].base : 0;
  const n = (labels) => rows.filter((x) => labels.includes(x.answer)).reduce((t, x) => t + x.n, 0);
  const under3 = n(['Under £3,000']), mid = n(['£3,000 to £6,000']), over6 = n(['£6,000 to £10,000', '£10,000 to £15,000']);
  el.textContent = `Of ${base} families who answered, ${under3 + mid} (${Math.round((100 * (under3 + mid)) / base)}%) said under £6,000 a year is fair, and ${over6} said £6,000 or more. The planned charge for the smallest home is £7,450 a year, so the gap is the main thing to test.`;
});

// ----- 19 Nov (Aaron): every figure day by day, up or down -----
window.HW_TREND = window.HW_TREND || 'visitors';
const HW_TREND_M = [
  {k: 'visitors', l: 'Visitors', pct: false},
  {k: 'opened', l: 'Opened the quiz', pct: false},
  {k: 'open_pct', l: 'Open rate', pct: true},
  {k: 'families', l: 'Families joined', pct: false},
  {k: 'join_pct', l: 'Join rate', pct: true},
  {k: 'confirm_pct', l: 'Confirmed email', pct: true},
];
dash.calc('trend', {
  inputs: ['visitors', 'leads'],
  title: 'Every figure, day by day',
  description: 'Visitors and quiz opens from the 9am Slack digest; families and confirmations live from the database (follow the quiz switch at the top). Rates: opened ÷ visitors, families ÷ opened, confirmed ÷ families.',
  fn: (visitors, leads) => {
    const fam = new Map(), conf = new Map();
    for (const r of leads) { const d = String(r.joined).slice(0, 10); fam.set(d, (fam.get(d) || 0) + 1); if (r.confirmed === true || r.confirmed === 'true') conf.set(d, (conf.get(d) || 0) + 1); }
    const vis = new Map(visitors.map((v) => [v.day, v]));
    const days = [...new Set([...vis.keys(), ...fam.keys()])].filter((d) => d >= '2026-11-13').sort();
    const r1 = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
    return days.map((d) => {
      const v = vis.get(d) || {}, n = fam.get(d) || 0, c = conf.get(d) || 0;
      const visitors_ = v.visitors == null || v.visitors === '' ? null : +v.visitors;
      const opened = v.quiz_opened == null || v.quiz_opened === '' ? null : +v.quiz_opened;
      return {day: d, visitors: visitors_, opened, open_pct: opened != null && visitors_ ? r1(opened, visitors_) : null,
        families: n, join_pct: opened ? r1(n, opened) : null, confirmed: c, confirm_pct: n ? r1(c, n) : null};
    });
  }
});
const hwFmt = (v, pct) => (v == null ? '—' : pct ? v.toFixed(0) + '%' : String(v));
dash.draw('trend-pick', (el) => {
  el.replaceChildren();
  for (const m of HW_TREND_M) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = m.l; b.setAttribute('aria-pressed', String(window.HW_TREND === m.k));
    b.onclick = () => { window.HW_TREND = m.k; dash.draw('trend-pick'); dash.draw('trend'); };
    el.append(b);
  }
});
dash.draw('trend', (el) => {
  const d = dash.data('trend');
  el.replaceChildren();
  if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const m = HW_TREND_M.find((x) => x.k === window.HW_TREND) || HW_TREND_M[0];
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/London'}).format(new Date());
  const pts = d.data.filter((r) => r[m.k] != null && r.day !== today);
  if (!pts.length) { el.textContent = 'No data yet for this figure.'; return; }
  const W = el.clientWidth || 600, H = 220, mg = {t: 22, r: 14, b: 24, l: 34};
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `Line chart of ${m.l} each day`);
  const x = d3.scalePoint().domain(d.data.filter((r) => r.day !== today).map((r) => r.day)).range([mg.l + 10, W - mg.r - 10]);
  const y = d3.scaleLinear().domain([0, (d3.max(pts, (r) => r[m.k]) || 1) * 1.15]).nice().range([H - mg.b, mg.t]);
  svg.append('g').attr('transform', `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - mg.l - mg.r)).tickFormat((v) => (m.pct ? v + '%' : d3.format('d')(v))))
    .call((g) => { g.select('.domain').remove(); g.selectAll('line').style('stroke', '#ecebe6'); });
  svg.append('g').attr('transform', `translate(0,${H - mg.b})`).call(d3.axisBottom(x).tickFormat((s) => d3.utcFormat('%-d %b')(new Date(s + 'T00:00:00Z'))))
    .call((g) => g.selectAll('line,.domain').style('stroke', '#c9cfc9'));
  svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', '#1f3a2e').attr('stroke-width', 2).attr('d', d3.line().x((r) => x(r.day)).y((r) => y(r[m.k])));
  svg.append('g').selectAll('circle').data(pts).join('circle').attr('cx', (r) => x(r.day)).attr('cy', (r) => y(r[m.k])).attr('r', 4).style('fill', '#1f3a2e');
  svg.append('g').selectAll('text').data(pts).join('text').attr('x', (r) => x(r.day)).attr('y', (r) => y(r[m.k]) - 9).attr('text-anchor', 'middle').style('fill', '#1f3a2e').style('font-weight', 600).text((r) => hwFmt(r[m.k], m.pct));
});
dash.draw('trend-rows', (tb) => {
  const d = dash.data('trend');
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  const rows = d.data.slice().reverse();
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/London'}).format(new Date());
  rows.forEach((r, i) => {
    const prev = rows[i + 1];
    const tr = document.createElement('tr');
    const td = (html, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.innerHTML = html; tr.append(c); };
    td(d3.utcFormat('%a %-d %b')(new Date(r.day + 'T00:00:00Z')) + (r.day === today ? ' <span class="hw-muted">so far</span>' : ''));
    for (const m of HW_TREND_M) {
      const v = r[m.k], p = prev ? prev[m.k] : null;
      let arrow = '';
      if (r.day !== today && v != null && p != null && v !== p) arrow = v > p ? ' <span class="hw-up" aria-label="up">▲</span>' : ' <span class="hw-down" aria-label="down">▼</span>';
      td(hwFmt(v, m.pct) + arrow, 'num');
    }
    tb.append(tr);
  });
});
