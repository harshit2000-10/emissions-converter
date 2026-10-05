// HTML for each section, ported from the design mockup. Events are wired by data attributes in main.ts:
//   data-a="action" data-v="value" for buttons, data-b="field" for inputs.
import { DATA_CHECKED, MASS_UNITS, TABS, UNITS, GAS, GAS_IDS, FORMS } from './data';
import type { Tab } from './data';
import { kindOf } from './calc';
import type { Line } from './calc';
import type { buildModel, LineVM } from './model';
import type { State } from './state';

type M = ReturnType<typeof buildModel>;

const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const opts = (items: (string | [string, string])[], sel: string) =>
  items.map((i) => { const [v, l] = typeof i === 'string' ? [i, i] : i; return `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
const massOpts = (sel: string) => opts(MASS_UNITS, sel);
const gasShort = (sel: string) => opts(GAS_IDS.map((k) => [k, GAS[k].f] as [string, string]), sel);

/** Buttons for a segmented control, chip row, etc. */
const btns = (cls: string, act: string, items: { v: string | number; l: string; on: boolean; extra?: string }[]) =>
  items.map((o) => `<button type="button" class="${cls}${o.on ? ' on' : ''}${o.extra ? ' ' + o.extra : ''}" aria-pressed="${o.on}" data-a="${act}" data-v="${o.v}">${esc(o.l)}</button>`).join('');

const copyBtn = (st: State, key: string, label: string, primary: boolean, style = '') => {
  const on = st.copied === key;
  return `<button type="button" class="btn${on && st.copyOk ? ' done' : primary ? ' primary' : ''}" data-a="copy" data-v="${key}"${style ? ` style="${style}"` : ''}>${on ? (st.copyOk ? 'Copied' : 'Copy blocked by browser') : label}</button>`;
};

/* ---------- header, hero, tabs ---------- */
export function header(st: State): string {
  return `<a class="skip" href="#main">Skip to the calculator</a>
<header style="background:#ffffff;border-bottom:1px solid #E1E5DB">
  <div class="wrap" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;padding-top:14px;padding-bottom:14px">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="logo.png" alt="SustivioLabs" width="190" height="38" style="display:block;height:38px;width:auto">
      <span style="font-size:12px;font-weight:800;background:#E7F1E4;color:#2F6C25;padding:3px 10px;border-radius:99px">Emissions Converter</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:700;color:#4A5849">IPCC report</span>
        <div class="seg" role="group" aria-label="IPCC assessment report">${btns('sb', 'ar', ['AR4', 'AR5', 'AR6'].map((l, i) => ({ v: i, l, on: st.ar === i })))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:700;color:#4A5849">GWP horizon</span>
        <div class="seg" role="group" aria-label="GWP horizon">${btns('sb', 'h', [['100', '100-yr'], ['20', '20-yr']].map(([v, l]) => ({ v, l, on: st.h === v })))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:700;color:#4A5849">Numbers</span>
        <div class="seg" role="group" aria-label="Number style">${btns('sb', 'nf', [['intl', '1,234,567'], ['in', '12,34,567']].map(([v, l]) => ({ v, l, on: st.nf === v })))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;font-weight:700;color:#4A5849">Scope 2</span>
        <div class="seg" role="group" aria-label="Scope 2 method">${btns('sb', 's2', [['loc', 'Location'], ['mkt', 'Market']].map(([v, l]) => ({ v, l, on: st.s2 === v })))}</div>
      </div>
    </div>
  </div>
</header>`;
}

export function hero(st: State, m: M): string {
  const h = m.hero;
  return `<section class="hero" style="background:#2F6C25;color:#ffffff;position:relative;overflow:hidden">
  <svg aria-hidden="true" viewBox="0 0 24 24" style="position:absolute;right:-90px;bottom:-120px;width:420px;height:420px;opacity:0.07;pointer-events:none" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18C6 10 10 6 18 6C18 14 14 18 6 18Z" fill="#ffffff"></path><path d="M6 18L13 11" stroke="#2F6C25" stroke-width="1.2"></path></svg>
  <div class="wrap" style="position:relative;display:flex;flex-wrap:wrap;gap:28px 40px;align-items:center;padding-top:36px;padding-bottom:40px">
    <div style="flex:1 1 320px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div style="font-size:12px;font-weight:800;letter-spacing:0.09em;text-transform:uppercase;color:#CFE3C8">Total footprint · ${m.basisTxt}</div>
      <div class="num" data-count="${h.totalRaw}" style="font-size:clamp(46px,6vw,76px);font-weight:800;line-height:1;letter-spacing:-0.035em;overflow-wrap:anywhere">${h.total}</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px">
        <div class="seg seg-dark" role="group" aria-label="Display unit">${btns('sb', 'heroU', ['t', 'kt', 'Mt'].map((u) => ({ v: u, l: u, on: st.heroU === u })))}</div>
        <span style="font-size:15px;font-weight:600;color:#CFE3C8">${h.sub}</span>
      </div>
    </div>
    <div style="flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:28px;flex-wrap:wrap">
      <div style="position:relative;width:168px;height:168px;flex:none">
        <svg class="ring" viewBox="0 0 180 180" width="168" height="168" role="img" aria-label="Share of the footprint: ${h.scopes.map((x) => `${x.name} ${x.pct}%`).join(', ')}" style="display:block;transform:rotate(-90deg)">
          <circle cx="90" cy="90" r="72" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="18"></circle>
          ${['#ffffff', '#F0B95A', '#B5DDA8'].map((c, i) => `<circle data-hl="s${i + 1}" cx="90" cy="90" r="72" fill="none" stroke="${c}" stroke-width="18" style="stroke-dasharray:${h.rings[i].da};stroke-dashoffset:${h.rings[i].off}"></circle>`).join('')}
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
          <span class="num" style="font-size:28px;font-weight:800;line-height:1">${h.s12pct}%</span>
          <span style="font-size:12px;font-weight:700;color:#CFE3C8">Scope 1 + 2</span>
        </div>
      </div>
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;min-width:min(230px,100%)">
        ${h.scopes.map((s) => `<li class="hl-row" data-hl="${s.id}" style="display:flex;align-items:center;gap:12px">
          <span style="width:14px;height:14px;border-radius:5px 2px 5px 2px;flex:none;background:${s.color}"></span>
          <div style="display:flex;flex-direction:column;flex:1;min-width:0">
            <span style="font-size:15px;font-weight:700">${s.name} <span style="font-weight:600;color:#CFE3C8">· ${s.desc}</span></span>
            <span class="num" style="font-size:14px;color:#CFE3C8">${s.val} · ${s.pct}%</span>
          </div></li>`).join('')}
      </ul>
    </div>
    <div style="flex:1 1 100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px">
      ${[['Largest source', h.k1, h.k1s], ['Top three sources', h.k2, h.k2s]].map(([a, b, c]) =>
        `<button type="button" class="kpi" data-a="tab" data-v="inv"><span style="font-size:13px;font-weight:700;color:#CFE3C8">${a}</span><span class="num" style="font-size:24px;font-weight:800;letter-spacing:-0.01em">${esc(b)}</span><span style="font-size:13px;color:#CFE3C8">${esc(c)}</span></button>`).join('')}
    </div>
  </div>
</section>`;
}

export function nav(st: State, m: M): string {
  return `<nav style="position:sticky;top:0;z-index:10;background:rgba(255,255,255,0.94);backdrop-filter:blur(10px);border-bottom:1px solid #E1E5DB">
  <div class="wrap" role="tablist" aria-label="Workbench sections" style="display:flex;gap:4px;overflow-x:auto;padding-top:10px;padding-bottom:10px">
    ${TABS.map(([k, n, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel" tabindex="${st.tab === k ? 0 : -1}" class="tab${st.tab === k ? ' on' : ''}" aria-selected="${st.tab === k}" data-a="tab" data-v="${k}"><span class="tab-n">${n}</span>${l}</button>`).join('')}
    <div class="mini" aria-hidden="true"><b class="num">${m.hero.total}</b> ${m.hero.unitLbl} · ${m.basisTxt}</div>
  </div>
</nav>`;
}

/* ---------- 01 inventory ---------- */
const SRC_GROUPS: [string, [string, string][]][] = [
  ['Fuel · stationary (boilers, generators, furnaces)', [['fuel:diesel', 'Diesel / gas oil'], ['fuel:gasoline', 'Motor gasoline (petrol)'], ['fuel:lpg', 'LPG'], ['fuel:ng', 'Natural gas'], ['fuel:resid', 'Residual fuel oil (furnace oil)'], ['fuel:anth', 'Anthracite'], ['fuel:bit', 'Other bituminous coal'], ['fuel:sub', 'Sub-bituminous coal'], ['fuel:lig', 'Lignite']]],
  ['Fuel · vehicles and aircraft', [['fuel:diesel_road', 'Diesel · road vehicles'], ['fuel:gasoline_road', 'Petrol · road vehicles'], ['fuel:lpg_road', 'LPG · road vehicles'], ['fuel:cng_road', 'CNG · road vehicles'], ['fuel:jet', 'Jet kerosene · aircraft']]],
  ['Fuel · biomass and biofuels (CO₂ reported separately)', [['fuel:wood', 'Wood / wood waste'], ['fuel:charcoal', 'Charcoal'], ['fuel:biodiesel', 'Biodiesel']]],
  ['Purchased electricity', [['elec:in', 'Grid electricity · India (CEA v21)'], ['elec:re', 'Renewable electricity (PPA / REC)'], ['elec:custom', 'Electricity · own grid factor']]],
  ['Gas released directly', [['gas:CO2', 'CO₂ · process or venting'], ['gas:CH4F', 'CH₄ · methane, fossil source (leaks, venting)'], ['gas:CH4', 'CH₄ · methane, biogenic or other'], ['gas:N2O', 'N₂O · nitrous oxide'], ['gas:HFC23', 'HFC-23'], ['gas:HFC32', 'HFC-32 (R-32)'], ['gas:HFC125', 'HFC-125'], ['gas:HFC134a', 'HFC-134a (R-134a)'], ['gas:HFC143a', 'HFC-143a'], ['gas:HFC152a', 'HFC-152a'], ['gas:CF4', 'CF₄ (PFC-14)'], ['gas:C2F6', 'C₂F₆ (PFC-116)'], ['gas:SF6', 'SF₆'], ['gas:NF3', 'NF₃']]],
  ['Any activity', [['custom:', 'Custom emission factor']]],
];
const srcOptions = (sel: string) => SRC_GROUPS.map(([g, items]) => `<optgroup label="${g}">${opts(items, sel)}</optgroup>`).join('');

const warnTag = (w: string) => (w ? `<span class="tag" style="background:#FBE9E7;color:#8C2B1F;border-color:#F0C4BD">${w}</span>` : '');
const inField = (f: string, id: number, attrs: string, style = '') =>
  `<input class="in" data-b="line" data-f="${f}" data-id="${id}" ${attrs}${style ? ` style="${style}"` : ''}>`;
const factorBox = (label: string, f: string, id: number, v: string) =>
  `<label class="fl">${label}<input class="in" type="number" min="0" step="any" value="${esc(v)}" data-b="line" data-f="${f}" data-id="${id}" style="background:#ffffff;min-height:40px"></label>`;

function lineView(vm: LineVM): string {
  const l: Line = vm.l, id = l.id, kind = kindOf(l);
  const unitSel = kind !== 'free' ? `<select class="in" aria-label="Unit" data-b="line" data-f="u" data-id="${id}" style="flex:0 1 130px;width:auto">${opts(UNITS[kind], l.u)}</select>` : '';
  return `<div class="line${l.fresh ? ' enter' : ''}" data-line="${id}" data-hl="${id}">
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
    <div class="seg" role="group" aria-label="GHG Protocol scope" style="padding:2px">
      ${[1, 2, 3].map((s) => `<button type="button" class="sb s${s}${l.scope === s ? ' on' : ''}" aria-pressed="${l.scope === s}" aria-label="Scope ${s}" data-a="scope" data-v="${s}" data-id="${id}" style="padding:0 11px;font-size:13px">S${s}</button>`).join('')}
    </div>
    <select class="in" aria-label="Emission source" data-b="line" data-f="src" data-id="${id}" style="flex:1 1 220px;width:auto">${srcOptions(l.type + ':' + l.key)}</select>
    <button type="button" class="x" aria-label="Remove line: ${esc(l.label || vm.name)}" data-a="del" data-id="${id}">×</button>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px">
    ${vm.isCustom ? inField('label', id, `type="text" aria-label="What is this activity" placeholder="Activity, e.g. purchased steel" value="${esc(l.label)}"`, 'flex:2 1 220px;width:auto') : ''}
    ${inField('q', id, `type="number" min="0" step="any" aria-label="Quantity" placeholder="Quantity" value="${esc(l.q)}"`, 'flex:1 1 140px;width:auto')}
    ${unitSel}
    ${vm.isCustom ? `${inField('u', id, `type="text" aria-label="Unit of the activity" placeholder="unit" value="${esc(l.u)}"`, 'flex:0 1 130px;width:auto')}
      ${inField('ef', id, `type="number" min="0" step="any" aria-label="Emission factor, kg CO2e per unit" placeholder="kg CO₂e per unit" value="${esc(l.ef)}"`, 'flex:1 1 150px;width:auto')}` : ''}
  </div>
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:14px;color:#4A5849">
    <b class="num" style="color:#17231A;font-weight:800;font-size:15px">${vm.t} t CO₂e</b>
    <span class="num">${vm.pctTxt}% of total</span>
    <span>${esc(vm.facSum)}</span>
    ${warnTag(vm.warn)}
    ${vm.bio ? `<span class="tag" style="background:#E7F1E4;color:#245519;border-color:#D1E5CC">+ ${vm.bio} t biogenic CO₂, outside the totals</span>` : ''}
    ${l.ph ? `<span class="tag">${l.src ? 'Published factor · check it fits your case' : 'Example factor · replace with your source'}</span>` : ''}
    <button type="button" class="link" aria-expanded="${l.open}" data-a="toggle" data-id="${id}" style="margin-left:auto">${vm.detailsLbl}</button>
  </div>
  <div class="track" style="height:6px"><div class="barfill" style="width:${vm.pctW}%"></div></div>
  ${l.src ? `<p class="note" style="font-size:13px"><b>Source:</b> ${esc(l.src)}</p>` : ''}
  ${l.open ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;padding:12px;background:#F3F6EF;border-radius:14px">
    ${!vm.isCustom ? `<label class="fl">Label (site, asset)<input class="in" type="text" value="${esc(l.label)}" placeholder="e.g. Plant A boilers" data-b="line" data-f="label" data-id="${id}" style="background:#ffffff;min-height:40px"></label>` : ''}
    ${vm.isFuel ? `${factorBox('NCV, GJ/t', 'ncv', id, l.ncv)}${vm.hasD ? factorBox('Density, kg/m³', 'd', id, l.d) : ''}${factorBox('CO₂, kg/GJ', 'ef', id, l.ef)}${factorBox('CH₄, kg/TJ', 'ch4', id, l.ch4)}${factorBox('N₂O, kg/TJ', 'n2o', id, l.n2o)}` : ''}
    ${vm.isElec ? `${factorBox('Grid factor (location-based), kg CO₂/kWh', 'ef', id, l.ef)}<label class="fl">Market-based factor, kg CO₂/kWh<input class="in" type="number" min="0" step="any" value="${esc(l.mef)}" placeholder="blank = grid factor" data-b="line" data-f="mef" data-id="${id}" style="background:#ffffff;min-height:40px"></label>` : ''}
    <p class="note" style="grid-column:1 / -1;font-size:13px">${esc(vm.factorNote)}</p>
  </div>` : ''}
</div>`;
}

function inventory(st: State, m: M): string {
  const v = m.inv;
  return `<div class="panel" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(500px,100%),1fr));gap:24px;align-items:start">
  <div class="card" style="display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px 12px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Activity data</span><h1 class="ttl">Build the inventory line by line</h1></div>
      ${v.example ? '<span class="tag">Example data</span>' : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
      <span style="font-size:13px;font-weight:700;color:#4A5849;margin-right:4px">Start from</span>
      ${btns('chip', 'preset', [['plant', 'Example plant'], ['office', 'Example office'], ['blank', 'Blank']].map(([k, l]) => ({ v: k, l, on: st.preset === k })))}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${v.lines.map(lineView).join('')}
      ${v.lines.length === 0 ? '<p class="note" style="padding:20px;border:1px dashed #CDD3C4;border-radius:20px;text-align:center">No lines yet. Add a source below.</p>' : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${[['fuel:diesel', '+ Fuel'], ['elec:in', '+ Electricity'], ['gas:HFC134a', '+ Gas release'], ['custom:', '+ Custom factor']].map(([s, l]) => `<button type="button" class="btn" data-a="add" data-v="${s}">${l}</button>`).join('')}
    </div>
    <p class="note">Fuel factors are IPCC 2006 defaults on a net calorific value basis. CH₄ and N₂O come from the table that matches the fuel you pick: stationary combustion, road vehicles or aircraft. Fuel densities are typical values. Every factor is editable, so overwrite with national, supplier or client values. Scope tags default to GHG Protocol practice and can be changed per line.</p>
  </div>
  <div style="display:flex;flex-direction:column;gap:24px;min-width:0">
    <div class="card" style="display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px">
        <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Scope split</span><h2 class="ttl num" data-count="${v.totalRaw}" data-suffix=" ${m.hero.unitLbl}">${v.totalTxt}</h2></div>
        <span style="font-size:14px;font-weight:600;color:#4A5849">${m.basisTxt}</span>
      </div>
      <div style="display:flex;height:20px;border-radius:10px;overflow:hidden;background:#E7F1E4;gap:2px">
        ${['#245519', '#C98A2B', '#9CC78F'].map((c, i) => `<div class="barfill seg-s" data-hl="s${i + 1}" style="width:${v.w[i]}%;background:${c}"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        ${v.legend.map((g) => `<div class="tile" data-hl="s${g.s}" style="border:1px solid #E1E5DB;border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:2px">
          <span style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#4A5849"><span class="badge b${g.s}">S${g.s}</span>${g.desc}</span>
          <span class="num" style="font-size:20px;font-weight:800">${g.val}</span>
          <span class="num" style="font-size:13px;color:#4A5849">${g.pct}% of total</span>
          ${g.sub ? `<span class="num" style="font-size:12px;color:#4A5849">${g.sub}</span>` : ''}</div>`).join('')}
      </div>
      ${v.bio ? `<div style="border:1px dashed #CDD3C4;border-radius:16px;padding:12px 14px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline">
        <b class="num" style="font-size:18px">${v.bio}</b><span style="font-size:14px;font-weight:700;color:#4A5849">biogenic CO₂</span>
        <span class="note" style="font-size:13px">From burning biomass. Reported separately and not included in the total above.</span></div>` : ''}
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px"><span class="eyebrow">Hotspots</span><p class="note">Largest sources first. These are where reduction levers pay back fastest.</p></div>
      <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px">
        ${v.hot.map((h) => `<li class="hl-row" data-hl="${h.id}" style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:baseline;gap:10px;font-size:15px;font-weight:600">
            <span class="num" style="font-size:13px;font-weight:800;color:#2F6C25;width:18px">${h.rank}</span>
            <span class="badge b${h.scope}">S${h.scope}</span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.name)}</span>
            <b class="num" style="font-weight:800">${h.val}</b>
            <span class="num" style="font-size:13px;color:#4A5849;width:3.6em;text-align:right">${h.pct}%</span>
          </div><div class="track"><div class="barfill" style="width:${h.w}%"></div></div></li>`).join('')}
      </ol>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${copyBtn(st, 'inv', 'Copy inventory table', true)}<button type="button" class="btn" data-a="csv">Download CSV</button></div>
      <div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid #E1E5DB;padding-top:14px">
        <span class="eyebrow">Save and share</span>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button type="button" class="btn" data-a="share">Copy share link</button>
          <button type="button" class="btn" data-a="save">Save to file</button>
          <button type="button" class="btn" data-a="open">Open a file</button>
          <input type="file" id="file" accept=".json,application/json" hidden aria-label="Open a saved inventory file">
        </div>
        <p class="note" style="font-size:13px;margin:0">Your work is kept in this browser automatically. A file or link carries it to another device or a colleague. Nothing is uploaded.</p>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Sensitivity</span><h2 class="ttl">Same inventory, every GWP basis</h2></div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th style="text-transform:none;letter-spacing:0">${m.hero.unitLbl}</th><th>GWP-100</th><th>GWP-20</th></tr></thead>
        <tbody>${v.cmp.map((r) => `<tr><td class="${r.cls}">${r.ar}</td><td class="${r.c100}">${r.v100}</td><td class="${r.c20}">${r.v20}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="note">Shows how much the choice of IPCC report and horizon moves the total. Useful when a client’s past figures use a different basis from yours. Electricity and custom factors are fixed per unit and do not change with the basis.</p>
    </div>
  </div>
</div>`;
}

/* ---------- 02 quick converters ---------- */
function converters(st: State, m: M): string {
  return `<div class="panel" style="display:flex;flex-direction:column;gap:24px">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr));gap:24px;align-items:start">
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Gas to gas</span><h1 class="ttl">Express one gas as another</h1></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <label class="fl">Amount<input class="in" type="number" min="0" step="any" value="${esc(st.ggQ)}" data-b="ggQ"></label>
        <label class="fl">Unit<select class="in" data-b="ggU">${massOpts(st.ggU)}</select></label>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:end">
        <label class="fl">From gas<select class="in" data-b="ggFrom">${gasShort(st.ggFrom)}</select></label>
        <button type="button" class="btn" aria-label="Swap gases" data-a="swap" style="padding:0 14px">⇄</button>
        <label class="fl">To gas<select class="in" data-b="ggTo">${gasShort(st.ggTo)}</select></label>
      </div>
      <label class="fl" style="max-width:200px">Show result in<select class="in" data-b="ggOU">${massOpts(st.ggOU)}</select></label>
      ${m.gg.warn ? `<div>${warnTag(m.gg.warn)}</div>` : ''}
      <div style="background:#2F6C25;color:#ffffff;border-radius:32px 6px 32px 6px;padding:22px;display:flex;flex-direction:column;gap:8px">
        <div class="num" style="font-size:clamp(30px,4vw,44px);font-weight:800;letter-spacing:-0.025em;line-height:1.1;overflow-wrap:anywhere">${m.gg.res}</div>
        <span style="font-size:14px;color:#CFE3C8;overflow-wrap:anywhere">${m.gg.via}</span>
        <div>${copyBtn(st, 'gg', 'Copy result', false, 'background:#ffffff;border-color:#ffffff;color:#245519')}</div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Element and compound</span><h2 class="ttl">Carbon, CO₂ and N₂O–N</h2></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));gap:12px">
        <label class="fl">Amount<input class="in" type="number" min="0" step="any" value="${esc(st.cQ)}" data-b="cQ"></label>
        <label class="fl">Mass unit<select class="in" data-b="cU">${massOpts(st.cU)}</select></label>
        <label class="fl">Quantity is<select class="in" data-b="cForm">${opts(FORMS.map((f) => [f.id, ({ C: 'C (carbon)', CO2: 'CO₂ (carbon dioxide)', ppm: 'ppm CO₂ (atmosphere)', N: 'N₂O–N (nitrogen)', N2O: 'N₂O (nitrous oxide)' } as Record<string, string>)[f.id]] as [string, string]), st.cForm)}</select></label>
      </div>
      ${m.cc.warn ? `<div>${warnTag(m.cc.warn)}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:10px">
        ${m.cc.cells.map((c) => `<div class="tile" style="border:1px solid ${c.src ? '#D1E5CC' : '#E1E5DB'};background:${c.src ? '#E7F1E4' : '#ffffff'};border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:2px;min-width:0">
          <span style="font-size:13px;font-weight:700;color:#4A5849">${c.l}</span>
          <b class="num" style="font-size:24px;font-weight:800;letter-spacing:-0.015em;overflow-wrap:anywhere">${c.v}</b>
          <span style="font-size:13px;font-weight:600;color:#4A5849">${c.u}</span></div>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${m.cc.chips.map((t) => `<span class="num" style="font-size:14px;font-weight:700;background:#E7F1E4;color:#2F6C25;border-radius:99px;padding:4px 12px">${t}</span>`).join('')}</div>
      <p class="note">The mass unit applies to every mass result. Starting from ppm, it only sets the output unit.</p>
      <div>${copyBtn(st, 'cc', 'Copy results', false)}</div>
    </div>
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Reference</span><h2 class="ttl">${m.ref.title}</h2></div>
    <div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Gas</th><th>Name</th>${['AR4', 'AR5', 'AR6'].map((a, i) => `<th class="${st.ar === i ? 'on' : ''}">${a}</th>`).join('')}</tr></thead>
      <tbody>${m.ref.rows.map((r) => `<tr><td class="${r.hl ? 'on' : ''}">${r.f}</td><td style="text-align:left;color:#4A5849">${esc(r.n)}</td>${r.v.map((x, i) => `<td class="${st.ar === i || r.hl ? 'on' : ''}">${x}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="note" style="font-size:13px">SF₆ in AR6: the IPCC supplement (Table 7.SM.7) gives 25,200 over 100 years and 18,300 over 20 years, and this site uses those. The GHG Protocol’s August 2024 table lists 24,300. Check which one your client or standard requires.</p>
  </div>
</div>`;
}

/* ---------- 03 about and how to use ---------- */
const STEPS: { t: string; d: string; go?: [Tab, string] }[] = [
  { t: 'Choose your basis', d: 'In the bar at the top, pick the IPCC report and the GWP horizon. Countries report under the Paris Agreement with AR5 and 100-yr, and AR6 is the latest science, so use whichever your client or standard asks for. Gas figures follow this choice. Scope 2 can be shown location-based or market-based, and the scope split shows both. The Numbers switch changes digit grouping between 1,234,567 and the Indian 12,34,567.' },
  { t: 'Build the inventory', d: 'Start from an example or a blank list, then add a line for each fuel, electricity use, gas release or other activity. Enter the quantity and unit, and tag the line Scope 1, 2 or 3. Use “Edit factors” to replace a default with your own. A negative number counts as zero and the line says so.', go: ['inv', 'Open the inventory'] },
  { t: 'Read the result', d: 'The green panel at the top shows the total footprint and its scope split. Hotspots list the biggest sources first. Hover a hotspot, a line or a scope to see where it appears elsewhere.' },
  { t: 'Convert quickly', d: 'Use Quick converters to express one gas as another, or to move between carbon, CO₂, ppm of CO₂ in the air and N₂O–N. It is handy for one-off checks.', go: ['conv', 'Open Quick converters'] },
  { t: 'Save and share', d: `Under the scope split, Download CSV gives a spreadsheet, Save to file keeps a copy you can open again, and Copy share link puts the whole inventory in a link for a colleague. Opening a file, a link or an example replaces what is on screen, and Undo brings it back.`, go: ['inv', 'Open the inventory'] },
];
const TERMS: [string, string][] = [
  ['CO₂e', 'Carbon dioxide equivalent. Every gas is expressed as the amount of CO₂ that warms the climate as much.'],
  ['GWP', 'Global warming potential. The factor that turns a tonne of a gas into tonnes of CO₂e.'],
  ['Emission factor', 'Emissions per unit of activity, for example kg CO₂ per kWh.'],
  ['NCV', 'Net calorific value. The energy in a tonne of fuel.'],
  ['Scope 1', 'Direct emissions from what you own or control: fuel burned on site or in your vehicles, and gases released, such as refrigerant leaks.'],
  ['Scope 2', 'Emissions from making the electricity, steam, heat or cooling you buy.'],
  ['Location-based', 'Scope 2 worked out with the average factor of the grid you draw from.'],
  ['Market-based', 'Scope 2 worked out with the factor of the supplier or certificates you have contracted, such as a PPA or RECs.'],
  ['Scope 3', 'Everything else in the value chain: purchased goods, travel, commuting and more.'],
  ['Biogenic CO₂', 'CO₂ from burning biomass. It is reported separately, outside the three scopes.'],
];
function about(): string {
  return `<div class="panel" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr));gap:24px;align-items:start">
  <div class="card" style="display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">About</span><h1 class="ttl">How to use this calculator</h1></div>
    <p class="note" style="font-size:15px">Work out a footprint and convert between gases. Everything updates as you type, so try values freely.</p>
    <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px">
      ${STEPS.map((s, i) => `<li style="display:flex;gap:14px;align-items:flex-start">
        <span class="num" style="flex:none;width:34px;height:34px;display:grid;place-items:center;background:#2F6C25;color:#fff;font-weight:800;border-radius:12px 4px 12px 4px">${i + 1}</span>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
          <b style="font-size:17px">${s.t}</b>
          <p class="note" style="font-size:15px">${s.d}</p>
          ${s.go ? `<div><button type="button" class="link" data-a="tab" data-v="${s.go[0]}" style="padding-left:0">${s.go[1]} →</button></div>` : ''}
        </div></li>`).join('')}
    </ol>
  </div>
  <div style="display:flex;flex-direction:column;gap:24px;min-width:0">
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Good to know</span><h2 class="ttl">Before you rely on a number</h2></div>
      <ul class="note" style="font-size:15px;margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
        <li><span class="tag">Example data</span> and <span class="tag">Example factor</span> mark placeholders. Replace them with your own figures. The Example data tag goes away once you change a line.</li>
        <li>A <span class="tag">Published factor</span> comes from the source named under the line. It is an average, so check that it fits your case.</li>
        <li>Burning wood, charcoal or biodiesel releases biogenic CO₂. It is shown separately and left out of the total, while the methane and nitrous oxide from it still count.</li>
        <li>Every factor can be edited. Use national, supplier or client values where you have them.</li>
        <li>Scope 2 has built-in factors for electricity only. Add purchased steam, heat or cooling as a custom factor line and tag it Scope 2.</li>
        <li>The copy buttons put a table on your clipboard, ready to paste into Excel or Word. Download CSV gives the same table as a file.</li>
        <li>Your work is saved in this browser and is not sent anywhere. To move it to another device or person, save a file or copy a share link. The link holds the whole inventory, so send it only to people who should see it.</li>
        <li>The reference values were entered by hand and last checked against their sources on ${CHECKED_ON}. Check any figure against its source before a client deliverable or a report.</li>
      </ul>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;flex-direction:column;gap:4px"><span class="eyebrow">Terms</span><h2 class="ttl">Words you will see</h2></div>
      <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:10px 16px;font-size:15px">
        ${TERMS.map(([k, d]) => `<dt style="font-weight:800">${k}</dt><dd class="note" style="margin:0;font-size:15px">${d}</dd>`).join('')}
      </dl>
    </div>
  </div>
</div>`;
}

const PANELS: Record<Tab, (st: State, m: M) => string> = { inv: inventory, conv: converters, about };
export const panel = (st: State, m: M): string =>
  `<div id="panel" role="tabpanel" aria-labelledby="tab-${st.tab}" tabindex="-1" style="display:flex;flex-direction:column;gap:24px">${PANELS[st.tab](st, m)}</div>`;

/** Spoken after the numbers settle, so a screen reader hears the result without every keystroke. */
export const statusText = (m: M): string => `Total footprint ${m.hero.total} ${m.hero.unitLbl}. ${m.basisTxt}.`;

export const toast = (st: State): string =>
  st.toast ? `<div class="toast" role="status"><span>${esc(st.toast)}</span>${st.undo ? '<button type="button" class="link" data-a="undo">Undo</button>' : ''}</div>` : '';

const CHECKED_ON = new Date(DATA_CHECKED).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const footer = (now: number = Date.now()): string => {
  const days = Math.floor((now - Date.parse(DATA_CHECKED)) / 864e5);
  return `<footer style="background:#ffffff;border-top:1px solid #E1E5DB">
  <div class="wrap" style="padding-top:32px;padding-bottom:40px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.6;color:#4A5849">
    <p>GWP values: IPCC AR4 WGI Table 2.14, AR5 WGI Tables 8.7 and 8.A.1 (without climate-carbon feedbacks), AR6 WGI Table 7.15 and Supplementary Table 7.SM.7. Methane is split by origin: AR6 Table 7.15 gives fossil 29.8 (100-yr) and 82.5 (20-yr) and non-fossil 27.0 and 79.7; AR5 fossil is 30 and 85 (note to Table 8.7); AR4 has a single value. Fuel factors: IPCC 2006 Guidelines Vol. 2, Tables 1.2 and 2.3 (stationary combustion in manufacturing), Tables 3.2.1 and 3.2.2 (road transport) and Table 3.6.5 (aviation). Fuel densities are typical values, not IPCC defaults. India grid: CEA CO₂ Baseline Database v21.0, weighted average 0.710 t CO₂/MWh for FY 2024-25 (location-based Scope 2). Biomass and biofuel factors: IPCC 2006 Tables 1.2, 1.4 and 2.3. Electricity: location-based uses the CEA grid factor, market-based uses the factor you enter for a supplier or certificates. Scope 3 examples: worldsteel Sustainability Indicators 2025 and UK DESNZ/DEFRA 2026 conversion factors. Molar masses: C 12.011, N₂ 28.0134, CO₂ 44.0095, N₂O 44.0128; 1 ppm CO₂ = 2.124 Gt C.</p>
    <p>Reference data last checked against its sources on ${CHECKED_ON}.${days > 365 ? ' <span class="tag">More than a year old: check for newer factors, especially the CEA grid factor</span>' : ''}</p>
    <p>These tables were keyed in by hand. Check any figure against its source before it goes into a client deliverable or a report.</p>
  </div>
</footer>`;
};
