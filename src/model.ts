// Turns the saved state into everything the screen shows. Pure: no DOM, easy to test.
import { calcLine, elementKg, familyOf, fmt, fromElementKg, gasToGas, gwp, num, plain, pos, srcName } from './calc';
import type { Line } from './calc';
import { AR, FORMS, GAS, GAS_IDS, KG_C_PER_PPM, SCOPE_DESC, U, fuelOf } from './data';
import type { GasId } from './data';
import type { State } from './state';

export interface LineVM {
  l: Line; name: string; t: string; bio: string; pctTxt: string; pctW: string; facSum: string; factorNote: string; warn: string;
  isFuel: boolean; isElec: boolean; isCustom: boolean; hasD: boolean; detailsLbl: string;
}
export function buildModel(st: State) {
  const { ar, h } = st;
  const basisTxt = `${AR[ar]} · GWP-${h}`;
  const HU = { t: 1, kt: 1e3, Mt: 1e6 }[st.heroU];
  const fmtT = (x: number) => fmt(x / HU, 5);
  const unitLbl = st.heroU + ' CO₂e';

  const NEG = 'Negative number counted as zero';

  /* ---------- inventory ---------- */
  const res = st.lines.map((l) => calcLine(l, ar, h, st.s2));
  const S: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  st.lines.forEach((l, i) => { S[l.scope] += res[i].kg / 1e3; });
  const tot = S[1] + S[2] + S[3], s12 = S[1] + S[2];
  const pctOf = (v: number) => (tot ? (v / tot) * 100 : 0);

  const lines: LineVM[] = st.lines.map((l, i) => {
    const r = res[i], t = r.kg / 1e3, p = pctOf(t);
    let facSum = '', factorNote = '';
    if (l.type === 'fuel') {
      facSum = `${l.ef} kg CO₂/GJ · NCV ${l.ncv}` + (l.d !== '' ? ` · ${l.d} kg/m³` : '');
      const use = fuelOf(l.key).use;
      factorNote = `${fmt(r.gj, 4)} GJ of fuel. CO₂ ${r.bio > 0 ? `${fmt(r.bio / 1e3, 4)} t (biogenic, outside the totals)` : `${fmt(r.parts.CO2 / 1e3, 4)} t`}, CH₄ ${fmt(r.parts.CH4 / 1e3, 3)} t CO₂e, N₂O ${fmt(r.parts.N2O / 1e3, 3)} t CO₂e. ` +
        (use === 'stationary' ? 'CH₄ and N₂O are IPCC 2006 Table 2.3 defaults for stationary combustion in manufacturing. For vehicles, choose a road-vehicle fuel instead.'
          : use === 'road' ? 'CH₄ and N₂O are IPCC 2006 Table 3.2.2 road-transport defaults (uncontrolled petrol vehicle, heavy-duty diesel, LPG and CNG vehicles). Replace them if you know your fleet.'
          : 'CH₄ and N₂O are the IPCC 2006 Table 3.6.5 aviation defaults (0.5 and 2 kg per TJ for all fuels). Radiative forcing is not included.');
    } else if (l.type === 'elec') {
      facSum = `${l.ef} kg CO₂/kWh grid` + (l.mef !== '' ? ` · ${l.mef} market-based` : '');
      const tdl = ' Losses in transmission and distribution are Scope 3, category 3, not Scope 2.';
      factorNote = (l.key === 'in' ? 'Location-based factor: CEA CO₂ Baseline Database v21.0, weighted average for FY 2024-25. CEA publishes one factor for the whole integrated Indian grid, not state-level factors. For the market-based method, enter a supplier or certificate factor in the market-based box.'
        : l.key === 're' ? 'Location-based still uses the grid factor. Market-based is zero when the power is backed by PPAs or RECs, so keep the certificates as evidence.'
        : 'Enter your own grid factor (location-based) and, if you have one, a supplier or residual-mix factor (market-based). The default is a placeholder.') + tdl +
        (st.s2 === 'mkt' && l.mef === '' ? ' No market-based factor is set, so this line uses the grid factor.' : '');
    } else if (l.type === 'gas') {
      facSum = `GWP ${fmt(gwp(l.key as GasId, ar, h))} (${basisTxt})`;
      factorNote = `${GAS[l.key as GasId].n}. Mass of gas released × GWP. For refrigerants, use the mass topped up or lost in the year.` +
        (l.key === 'CH4F' ? ' GHG Protocol: use the fossil value for leaks and venting from fossil-fuel systems and industrial processes.' : l.key === 'CH4' ? ' GHG Protocol: use the non-fossil value for all other methane, including combustion.' : '');
    } else {
      facSum = `${l.ef === '' ? '?' : l.ef} kg CO₂e per ${l.u || 'unit'}`;
      factorNote = 'Emissions = quantity × factor. Enter the factor in kg CO₂e for one unit of the activity, and keep a note of where it comes from. Changing the factor removes the published source shown on the line.';
    }
    // a silent zero or a negative entry would understate the inventory, so say why the line is not counting
    const typed = l.type === 'fuel' ? [l.q, l.ncv, l.d, l.ef, l.ch4, l.n2o] : l.type === 'elec' ? [l.q, l.ef, l.mef] : l.type === 'gas' ? [l.q] : [l.q, l.ef];
    const warn = typed.some((v) => num(v) < 0) ? NEG
      : l.type === 'fuel' && num(l.q) > 0 && r.gj === 0 ? 'NCV or density is missing, so this line counts as zero' : '';
    return {
      l, warn, name: l.label || srcName(l), t: fmt(t, 4), bio: r.bio > 0 ? fmt(r.bio / 1e3, 4) : '', pctTxt: p.toFixed(1), pctW: p.toFixed(2), facSum, factorNote,
      isFuel: l.type === 'fuel', isElec: l.type === 'elec', isCustom: l.type === 'custom',
      hasD: l.type === 'fuel' && fuelOf(l.key).d != null,
      detailsLbl: l.open ? 'Hide details' : l.type === 'custom' ? 'Details' : 'Edit factors',
    };
  });

  const hot = st.lines.map((l, i) => ({ l, t: res[i].kg / 1e3 })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t).slice(0, 6)
    .map((x, i) => ({ id: x.l.id, raw: pctOf(x.t), rank: i + 1, name: x.l.label || srcName(x.l), scope: x.l.scope, val: `${fmtT(x.t)} ${st.heroU}`, pct: pctOf(x.t).toFixed(1), w: pctOf(x.t).toFixed(2) }));

  const cmp = ([0, 1, 2] as const).map((a) => {
    const v = (hh: '100' | '20') => st.lines.reduce((s, l) => s + calcLine(l, a, hh, st.s2).kg, 0) / 1e3;
    return { ar: AR[a], cls: a === ar ? 'on' : '', v100: fmtT(v('100')), v20: fmtT(v('20')), c100: a === ar && h === '100' ? 'on' : '', c20: a === ar && h === '20' ? 'on' : '' };
  });

  // the other Scope 2 method, so both can be shown side by side (GHG Protocol dual reporting)
  const other = st.s2 === 'loc' ? 'mkt' : 'loc';
  const s2other = st.lines.reduce((s, l) => s + (l.scope === 2 ? calcLine(l, ar, h, other).kg / 1e3 : 0), 0);
  const s2loc = st.s2 === 'loc' ? S[2] : s2other, s2mkt = st.s2 === 'mkt' ? S[2] : s2other;
  const bioT = res.reduce((s, r) => s + r.bio, 0) / 1e3;
  const s2Name = st.s2 === 'loc' ? 'location-based' : 'market-based';

  // text starting with = + - or @ would run as a formula when a spreadsheet opens it, so it gets a leading apostrophe
  const noFormula = (c: string) => (/^[=+\-@]/.test(c) && !isFinite(+c) ? "'" + c : c);
  // one table feeds the clipboard (tab-separated) and the download (CSV); numbers carry no grouping so spreadsheets read them
  const table: string[][] = [
    ['Source', 'Label', 'Scope', 'Quantity', 'Unit', 'Factor', `t CO2e (${basisTxt}; Scope 2 ${s2Name})`, 'Biogenic CO2 t (outside the scopes)', 'Factor source'],
    ...st.lines.map((l, i) => [srcName(l), l.label, 'Scope ' + l.scope, l.q, l.u, lines[i].facSum, plain(res[i].kg / 1e3), plain(res[i].bio / 1e3), l.src]),
    ['Scope 1', '', '', '', '', '', plain(S[1]), '', ''],
    ['Scope 2 location-based', '', '', '', '', '', plain(s2loc), '', ''],
    ['Scope 2 market-based', '', '', '', '', '', plain(s2mkt), '', ''],
    ['Scope 3', '', '', '', '', '', plain(S[3]), '', ''],
    [`Total (Scope 2 ${s2Name})`, '', '', '', '', '', plain(tot), '', ''],
    ['Biogenic CO2 (outside the scopes)', '', '', '', '', '', '', plain(bioT), ''],
  ].map((r) => r.map((c) => String(c).replace(/[\t\r\n]+/g, ' ')).map(noFormula));
  const invTsv = table.map((r) => r.join('\t')).join('\n');
  const csvCell = (c: string) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const invCsv = table.map((r) => r.map(csvCell).join(',')).join('\r\n');

  const inv = {
    lines, example: st.preset === 'plant' || st.preset === 'office', totalTxt: `${fmtT(tot)} ${unitLbl}`, totalRaw: tot / HU,
    w: [pctOf(S[1]).toFixed(2), pctOf(S[2]).toFixed(2), pctOf(S[3]).toFixed(2)],
    legend: [1, 2, 3].map((s) => ({
      s, desc: s === 2 ? `${SCOPE_DESC[2]} · ${s2Name}` : SCOPE_DESC[s], val: `${fmtT(S[s])} ${st.heroU}`, pct: pctOf(S[s]).toFixed(1),
      sub: s === 2 ? `Location ${fmtT(s2loc)} · Market ${fmtT(s2mkt)} ${st.heroU}` : '',
    })),
    bio: bioT > 0 ? `${fmtT(bioT)} ${st.heroU}` : '',
    hot, cmp,
  };

  /* ---------- quick converters ---------- */
  const ggq = pos(st.ggQ);
  const gg2 = gasToGas(ggq, st.ggU, st.ggFrom, st.ggTo, st.ggOU, ar, h);
  const ggTxt = `${fmt(ggq, 8)} ${st.ggU} ${GAS[st.ggFrom].f} = ${fmt(gg2.out, 8)} ${st.ggOU} ${GAS[st.ggTo].f} (${basisTxt}; via ${fmt(gg2.co2eKg / U[st.ggU], 8)} ${st.ggU} CO2e)`;
  const gg = {
    warn: num(st.ggQ) < 0 ? NEG : '',
    res: `${fmt(gg2.out)} ${st.ggOU} ${GAS[st.ggTo].f}`,
    via: `${fmt(ggq)} ${st.ggU} ${GAS[st.ggFrom].f} = ${fmt(gg2.co2eKg / U[st.ggU])} ${st.ggU} CO₂e · GWP ${fmt(gwp(st.ggFrom, ar, h))} → ${fmt(gwp(st.ggTo, ar, h))} · ${basisTxt}`,
  };
  const src = FORMS.find((f) => f.id === st.cForm) ?? FORMS[0];
  const ckg = elementKg(src, pos(st.cQ), st.cU), fam = familyOf(src);
  const [fa, fb] = fam.filter((f) => !f.ppm);
  const chips = [`1 ${fa.l} = ${fmt(fa.k! / fb.k!, 5)} ${fb.l}`, `1 ${fb.l} = ${fmt(fb.k! / fa.k!, 5)} ${fa.l}`];
  if (src.fam === 'C') chips.push(`1 ppm = ${fmt(KG_C_PER_PPM / 1e12)} Gt C = ${fmt(KG_C_PER_PPM / 1e12 / FORMS[1].k!)} Gt CO₂`);
  const cc = {
    warn: num(st.cQ) < 0 ? NEG : '',
    cells: fam.map((f) => ({ l: `${f.l} · ${f.d}`, v: fmt(fromElementKg(f, ckg, st.cU)), u: f.ppm ? 'ppm' : st.cU, src: f === src })),
    chips,
  };
  const ccTxt = fam.map((f) => `${f.l}\t${plain(fromElementKg(f, ckg, st.cU))}\t${f.ppm ? 'ppm' : st.cU}`).join('\n');
  const ref = {
    title: `GWP-${h} by IPCC report`,
    rows: GAS_IDS.map((k) => ({ k, f: GAS[k].f, n: GAS[k].n, hl: k === st.ggFrom || k === st.ggTo, v: [0, 1, 2].map((a) => fmt(gwp(k, a as 0 | 1 | 2, h))) })),
  };

  /* ---------- hero ---------- */
  const C = 2 * Math.PI * 72;
  let acc = 0;
  const seg = (v: number) => { const len = tot ? (v / tot) * C : 0; const gap = len > 4 ? 3 : 0; const o = { da: Math.max(0, len - gap).toFixed(2) + ' ' + C.toFixed(2), off: (-acc).toFixed(2) }; acc += len; return o; };
  const rings = [seg(S[1]), seg(S[2]), seg(S[3])];
  const hero = {
    total: fmtT(tot), totalRaw: tot / HU, unitLbl, sub: `${unitLbl} · ${st.lines.length} ${st.lines.length === 1 ? 'source' : 'sources'}`,
    rings, s12pct: tot ? Math.round((s12 / tot) * 100) : 0,
    scopes: [1, 2, 3].map((s, i) => ({ name: 'Scope ' + s, desc: s === 2 ? `${SCOPE_DESC[2]} · ${s2Name}` : SCOPE_DESC[s], id: 's' + s, color: ['#ffffff', '#F0B95A', '#B5DDA8'][i], val: `${fmtT(S[s])} ${st.heroU}`, pct: pctOf(S[s]).toFixed(1) })),
    k1: hot[0] ? hot[0].name : '—', k1s: hot[0] ? `${hot[0].val} · ${hot[0].pct}% of the footprint` : 'Add a line to the inventory',
    k2: hot.length ? `${hot.slice(0, 3).reduce((x, h) => x + h.raw, 0).toFixed(1)}%` : '—',
    k2s: hot.length ? `of the footprint comes from the top ${Math.min(3, hot.length)} ${hot.length === 1 ? 'source' : 'sources'}` : 'Enter a quantity to see where emissions concentrate',
  };

  return {
    basisTxt, hero, inv, gg, cc, ref,
    copy: { inv: invTsv, gg: ggTxt, cc: ccTxt } as Record<string, string>,
    csv: invCsv,
    // exported for tests
    totals: { S1: S[1], S2: S[2], S3: S[3], tot },
  };
}

