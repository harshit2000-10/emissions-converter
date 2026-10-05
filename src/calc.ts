import { ELEC, EN, FORMS, FUELS, GAS, KG_C_PER_PPM, KWH, U, VOL, fuelOf } from './data';
import type { ArIdx, ElecKey, Form, GasId, Horizon, MassUnit, UnitKind } from './data';

/* ---------- number formatting ---------- */
export const num = (v: string | number): number => { const x = parseFloat(String(v)); return isFinite(x) ? x : 0; };
/** Quantities and factors cannot be negative. A negative entry counts as zero, and the line shows a warning. */
export const pos = (v: string | number): number => Math.max(0, num(v));

export type NumberStyle = 'intl' | 'in';
let locale = 'en-US';
/** International grouping (1,234,567) or Indian grouping (12,34,567). */
export const setNumberStyle = (s: NumberStyle) => { locale = s === 'in' ? 'en-IN' : 'en-US'; };

/** Significant-figure formatter with thousands separators; exponent form at the extremes. */
export function fmt(x: number, d = 5): string {
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e15 || a < 1e-5) return x.toExponential(d - 1);
  return (+x.toPrecision(d)).toLocaleString(locale, { maximumFractionDigits: 12 });
}

/** A bare number with no grouping, for files and spreadsheets (empty when not a number). */
export const plain = (x: number, d = 8): string => (isFinite(x) ? String(+x.toPrecision(d)) : '');

/* ---------- GWP ---------- */
export const gwp = (g: GasId, ar: ArIdx, h: Horizon): number => GAS[g][h === '100' ? 'a' : 'b'][ar];

/** Express an amount of one gas as another, via CO₂e. */
export function gasToGas(q: number, u: MassUnit, from: GasId, to: GasId, ou: MassUnit, ar: ArIdx, h: Horizon) {
  const co2eKg = q * U[u] * gwp(from, ar, h);
  return { co2eKg, out: co2eKg / gwp(to, ar, h) / U[ou] };
}

/* ---------- carbon / nitrogen forms ---------- */
export const elementKg = (f: Form, v: number, u: MassUnit): number => (f.ppm ? v * KG_C_PER_PPM : v * U[u] * f.k!);
export const fromElementKg = (f: Form, kg: number, u: MassUnit): number => (f.ppm ? kg / KG_C_PER_PPM : kg / (U[u] * f.k!));
export const familyOf = (f: Form): Form[] => FORMS.filter((x) => x.fam === f.fam);

/* ---------- inventory lines ---------- */
type LineType = 'fuel' | 'elec' | 'gas' | 'custom';
export type Scope = 1 | 2 | 3;
export interface Line {
  id: number; type: LineType; key: string; q: string; label: string; open: boolean; fresh: boolean;
  u: string; scope: Scope; ncv: string; d: string; ef: string; ch4: string; n2o: string; ph: boolean;
  /** Market-based electricity factor, kg CO₂/kWh. Empty means use the grid factor. */
  mef: string;
  /** Where a published factor on this line comes from. Cleared when the user changes the factor. */
  src: string;
}
const GAS_FAMS = ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3', 'Other'] as const;
export type Parts = Record<(typeof GAS_FAMS)[number], number>;
const zeroParts = (): Parts => ({ CO2: 0, CH4: 0, N2O: 0, HFCs: 0, PFCs: 0, SF6: 0, NF3: 0, Other: 0 });

let UID = 0;
export const nextId = (): number => ++UID;
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const isLineKeyValid = (type: string, key: string): boolean =>
  type === 'fuel' ? own(FUELS, key) : type === 'elec' ? own(ELEC, key) : type === 'gas' ? own(GAS, key) : type === 'custom';

/** Build a line from a "type:key" source id. */
export function mk(src: string, o: { q?: string; u?: string; label?: string; scope?: Scope; ef?: string | number; ph?: boolean; fresh?: boolean; cite?: string } = {}): Line {
  const [type, key = ''] = src.split(':');
  const b = { id: ++UID, q: o.q ?? '', label: o.label ?? '', open: false, fresh: !!o.fresh, ncv: '', d: '', ef: '', ch4: '', n2o: '', ph: false, src: '', mef: '' };
  if (type === 'fuel') {
    const F = fuelOf(key);
    return { ...b, type, key, u: o.u ?? F.u, scope: o.scope ?? 1, ncv: String(F.ncv), d: F.d != null ? String(F.d) : '', ef: String(F.ef), ch4: String(F.ch4), n2o: String(F.n2o) };
  }
  if (type === 'elec') {
    const E = ELEC[key as ElecKey];
    return { ...b, type, key, u: o.u ?? 'kWh', scope: o.scope ?? 2, ef: String(E.ef), mef: E.mef, ph: E.ph };
  }
  if (type === 'gas') return { ...b, type, key, u: o.u ?? 'kg', scope: o.scope ?? 1 };
  return { ...b, type: 'custom', key: '', u: o.u ?? 'unit', scope: o.scope ?? 3, ef: o.ef != null ? String(o.ef) : '', ph: !!o.ph, src: o.cite ?? '' };
}

// Published factors for the Scope 3 examples. Each carries its citation, shown on the line.
const CITE = {
  steel: 'worldsteel, Sustainability Indicators 2025 report (2024 data): global average GHG emissions intensity of crude steel, 2.18 t CO₂e per tonne. A global average, so use your supplier’s figure for the product you buy.',
  air: 'UK DESNZ/DEFRA GHG conversion factors 2026, Business travel – air: international flights to/from non-UK, average passenger, including radiative forcing (0.14253 kg CO₂e per passenger-km; 0.0842 without radiative forcing).',
  bus: 'UK DESNZ/DEFRA GHG conversion factors 2026, Business travel – land: average local bus (0.10151 kg CO₂e per passenger-km). A UK average, so replace it if you have local data.',
};
export const PRESETS: Record<string, () => Line[]> = {
  plant: () => [
    mk('fuel:diesel', { q: '5000', u: 'L', label: 'DG sets' }),
    mk('fuel:ng', { q: '20000', u: 'm³', label: 'Process heat' }),
    mk('fuel:bit', { q: '120', u: 't', label: 'Boiler coal' }),
    mk('gas:HFC134a', { q: '25', u: 'kg', label: 'Chiller top-up' }),
    mk('elec:in', { q: '1200000', u: 'kWh', label: 'Plant and offices' }),
    mk('custom:', { q: '500', u: 't', ef: 2180, ph: true, cite: CITE.steel, label: 'Purchased steel' }),
    mk('custom:', { q: '250000', u: 'passenger-km', ef: 0.14253, ph: true, cite: CITE.air, label: 'Business travel, air' }),
  ],
  office: () => [
    mk('elec:in', { q: '180000', u: 'kWh', label: 'Office floors' }),
    mk('fuel:diesel', { q: '800', u: 'L', label: 'DG backup' }),
    mk('gas:HFC32', { q: '4', u: 'kg', label: 'AC refills' }),
    mk('custom:', { q: '600000', u: 'passenger-km', ef: 0.10151, ph: true, cite: CITE.bus, label: 'Employee commuting by bus' }),
    mk('custom:', { q: '120000', u: 'passenger-km', ef: 0.14253, ph: true, cite: CITE.air, label: 'Business travel, air' }),
  ],
  blank: () => [mk('fuel:diesel', { u: 'L' })],
};

export const srcName = (l: Line): string =>
  l.type === 'fuel' ? fuelOf(l.key).l : l.type === 'elec' ? ELEC[l.key as ElecKey].l : l.type === 'gas' ? GAS[l.key as GasId].f + ' released' : 'Custom factor';
export const kindOf = (l: Line): UnitKind => (l.type === 'fuel' ? fuelOf(l.key).k : l.type === 'elec' ? 'elec' : l.type === 'gas' ? 'mass' : 'free');

/** Energy content in GJ (net calorific value basis). */
function toGJ(l: Line): number {
  const q = pos(l.q);
  if (EN[l.u]) return q * EN[l.u];
  const kg = l.u === 'kg' ? q : l.u === 't' ? q * 1e3 : q * (VOL[l.u] || 0) * pos(l.d);
  return (kg / 1e3) * pos(l.ncv);
}

export type Scope2Method = 'loc' | 'mkt';

/**
 * Emissions of one line in kg CO₂e, split by gas family. Fuels include CH₄ and N₂O at the chosen GWP.
 * Electricity follows the Scope 2 method. For biomass the CO₂ goes to `bio` (reported outside the scopes).
 */
export function calcLine(l: Line, ar: ArIdx, h: Horizon, s2: Scope2Method = 'loc') {
  const parts = zeroParts();
  let kg = 0, gj = 0, bio = 0;
  const q = pos(l.q);
  if (l.type === 'fuel') {
    gj = toGJ(l);
    const co2 = gj * pos(l.ef);
    if (fuelOf(l.key).bio) bio = co2; else parts.CO2 = co2;
    parts.CH4 = (gj * pos(l.ch4)) / 1000 * gwp('CH4', ar, h);
    parts.N2O = (gj * pos(l.n2o)) / 1000 * gwp('N2O', ar, h);
    kg = parts.CO2 + parts.CH4 + parts.N2O;
  } else if (l.type === 'elec') {
    const kwh = q * (KWH[l.u] || 1);
    gj = kwh * 0.0036; kg = kwh * pos(s2 === 'mkt' && l.mef !== '' ? l.mef : l.ef); parts.CO2 = kg;
  } else if (l.type === 'gas') {
    const g = l.key as GasId;
    kg = q * U[l.u as MassUnit] * gwp(g, ar, h);
    parts[GAS[g].fam as keyof Parts] = kg;
  } else {
    kg = q * pos(l.ef); parts.Other = kg;
  }
  return { kg, gj, bio, parts };
}
