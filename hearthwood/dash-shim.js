// Small stand-in for the Claude dashboard runtime (dash.data / calc / loader / draw),
// so the dashboard's own app.js runs unchanged on mockups94.xyz.
(() => {
  const FN = 'https://gifhawpstprajccszavr.supabase.co/functions/v1/dashboard';
  const LISTS = ['ages', 'childhood', 'priorities', 'rooms', 'worry', 'adults_love', 'kids_love'];
  const raw = {};      // id -> {status, data, columns, message}
  const calcs = {};    // id -> {inputs, fn}
  const memo = {};     // calc id -> result
  const draws = {};    // name -> fn | {mount, update}
  const mounted = new WeakMap();
  const pending = {status: 'loading', data: [], columns: [], message: '', refreshing: false, truncated: false, meta: null};

  const parseCsv = (t) => {
    const rows = d3.csvParse(t);
    const cols = rows.columns;
    for (const r of rows) for (const k of cols) if (r[k] === '') r[k] = null;
    return {rows, cols};
  };

  const data = (id) => {
    if (calcs[id]) {
      if (id in memo) return memo[id];
      const ins = calcs[id].inputs.map(data);
      const bad = ins.find((d) => d.status !== 'ok');
      if (bad) return {...pending, status: bad.status, data: null, message: bad.message};
      let v;
      try {
        v = calcs[id].fn(...ins.map((d) => (calcs[d._id] ? d.data : Array.isArray(d.data) ? d.data : [])));
        v = {status: 'ok', data: v, columns: Array.isArray(v) && v[0] ? Object.keys(v[0]) : [], message: '', refreshing: false, truncated: false, meta: null};
      } catch (e) {
        console.error('calc', id, e);
        v = {...pending, status: 'error', data: null, message: String(e.message || e)};
      }
      v._id = id;
      return (memo[id] = v);
    }
    const r = raw[id];
    return r ? {...r, _id: id} : {...pending, _id: id};
  };

  const runDraw = (name) => {
    const d = draws[name];
    if (!d) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      try {
        if (typeof d === 'function') d(el);
        else {
          if (!mounted.has(el)) mounted.set(el, {m: d.mount ? d.mount(el) : null});
          if (d.update) d.update(el, mounted.get(el).m);
        }
      } catch (e) { console.error('draw', name, e); }
    });
  };
  const drawAll = () => Object.keys(draws).forEach(runDraw);

  window.dash = {
    data,
    calc: (id, spec) => { calcs[id] = spec; },
    loader: () => {},
    draw: (name, fn) => { if (fn) draws[name] = fn; else runDraw(name); },
    onData: (fn) => { fn(); window.addEventListener('hw-data', fn); },
    colors: ['#1F3A2E', '#B9772E', '#6E8B74', '#C9A27A', '#3E5C6E', '#9A4F3B'],
    refresh: () => {}, params: () => ({}), setParams: () => {}, resetParams: () => {}, setLink: () => {},
  };

  const setAll = (status, message) => {
    for (const id of ['leads', 'outcodes', 'demo', 'estate', 'hourly', 'sites', 'spend', 'visitors']) raw[id] = {...pending, status, message};
  };
  setAll('loading', '');

  const render = () => { for (const k in memo) delete memo[k]; drawAll(); window.dispatchEvent(new Event('hw-data')); };
  window.HW_RENDER = render;

  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawAll, 150); });

  window.HW_LOAD = async (password) => {
    const res = await fetch(FN, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({password})});
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load data');
    const leads = body.leads.map((r) => {
      const o = {...r};
      for (const k of LISTS) { const v = o[k]; o[k] = Array.isArray(v) ? v.join(' | ') : v == null ? null : String(v); }
      return o;
    });
    raw.leads = {status: 'ok', data: leads, columns: leads[0] ? Object.keys(leads[0]) : [], message: '', refreshing: false, truncated: false, meta: null};
    for (const [id, text] of Object.entries(body.files)) {
      const {rows, cols} = parseCsv(text);
      raw[id] = {status: 'ok', data: rows, columns: cols, message: '', refreshing: false, truncated: false, meta: null};
    }
    const oc = await fetch('outcodes.csv').then((r) => r.text());
    const {rows, cols} = parseCsv(oc);
    raw.outcodes = {status: 'ok', data: rows, columns: cols, message: '', refreshing: false, truncated: false, meta: null};
    return body.ran_at;
  };
})();
