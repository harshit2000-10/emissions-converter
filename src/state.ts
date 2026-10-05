import { PRESETS, isLineKeyValid, kindOf, nextId } from './calc';
import type { Line, NumberStyle, Scope } from './calc';
import { ELEC, FORMS, GAS, TABS, U, UNITS, fuelOf } from './data';
import type { ArIdx, GasId, Horizon, MassUnit, Tab } from './data';

export interface State {
  tab: Tab; ar: ArIdx; h: Horizon; s2: 'loc' | 'mkt'; nf: NumberStyle; heroU: 't' | 'kt' | 'Mt'; lines: Line[];
  /** The example the inventory was started from. Empty once the user has changed a line. */
  preset: string;
  ggQ: string; ggU: MassUnit; ggFrom: GasId; ggTo: GasId; ggOU: MassUnit; cQ: string; cU: MassUnit; cForm: string;
  /** Short-lived UI messages. Never saved. */
  copied: string; copyOk: boolean; toast: string; undo: boolean;
}

export const defaults = (): State => ({
  tab: 'inv', ar: 1, h: '100', s2: 'loc', nf: 'intl', heroU: 't', lines: PRESETS.plant(), preset: 'plant',
  ggQ: '10', ggU: 't', ggFrom: 'CH4', ggTo: 'N2O', ggOU: 't', cQ: '1', cU: 'Gt', cForm: 'C',
  copied: '', copyOk: false, toast: '', undo: false,
});

const KEY = 'emissions-workbench:v1';
const MAX_LINES = 200;

/* ---------- cleaning untrusted input (saved work, files and share links) ---------- */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '');
/** A number as typed: digits with an optional sign, decimal point and exponent. Anything else becomes empty. */
const numText = (v: unknown): string => { const t = typeof v === 'number' ? String(v) : text(v, 24).trim(); return /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? t : ''; };

/** Rebuilds one saved line from scratch. Returns null when it cannot be a real line. */
function cleanLine(raw: unknown): Line | null {
  if (!isObj(raw)) return null;
  const type = raw.type, key = typeof raw.key === 'string' ? raw.key : '';
  if (type !== 'fuel' && type !== 'elec' && type !== 'gas' && type !== 'custom') return null;
  if (!isLineKeyValid(type, key)) return null;
  const scope = ([1, 2, 3] as number[]).includes(raw.scope as number) ? (raw.scope as Scope) : null;
  if (!scope) return null;
  const l: Line = {
    id: nextId(), type, key: type === 'custom' ? '' : key, q: numText(raw.q), label: text(raw.label, 80), open: false, fresh: false,
    u: text(raw.u, 40), scope, ncv: numText(raw.ncv), d: numText(raw.d), ef: numText(raw.ef), ch4: numText(raw.ch4), n2o: numText(raw.n2o),
    ph: raw.ph === true, src: text(raw.src, 500), mef: numText(raw.mef),
  };
  // units outside the allowed list for this kind of line fall back to the default
  const kind = kindOf(l);
  if (kind !== 'free' && !UNITS[kind].includes(l.u)) l.u = type === 'fuel' ? fuelOf(key).u : kind === 'elec' ? 'kWh' : kind === 'mass' ? 'kg' : UNITS[kind][0];
  if (kind === 'free' && l.u === '') l.u = 'unit';
  if (type === 'fuel') {
    const F = fuelOf(key);
    l.ncv ||= String(F.ncv); l.ef ||= String(F.ef); l.ch4 ||= String(F.ch4); l.n2o ||= String(F.n2o);
    if (F.d != null) l.d ||= String(F.d); else l.d = '';
  }
  if (type === 'elec') {
    const E = ELEC[key as keyof typeof ELEC];
    // older saves stored zero as the renewable line's grid factor and had no market-based factor
    if (key === 're' && l.ef === '0') l.ef = String(ELEC.in.ef);
    if (raw.mef === undefined) l.mef = E.mef;
    l.ef ||= String(E.ef);
  }
  return l;
}

/** Merges saved values over the defaults, keeping only what still makes sense. */
function parseState(s: unknown): State {
  const st = defaults();
  if (!isObj(s)) return st;
  const pick = <K extends keyof State>(k: K, ok: (v: unknown) => boolean) => { if (k in s && ok(s[k])) (st[k] as unknown) = s[k]; };
  const inU = (v: unknown) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(U, v);
  pick('tab', (v) => TABS.some((t) => t[0] === v));
  pick('ar', (v) => v === 0 || v === 1 || v === 2);
  pick('h', (v) => v === '100' || v === '20');
  pick('s2', (v) => v === 'loc' || v === 'mkt');
  pick('nf', (v) => v === 'intl' || v === 'in');
  pick('heroU', (v) => v === 't' || v === 'kt' || v === 'Mt');
  pick('ggU', inU); pick('ggOU', inU); pick('cU', inU);
  pick('ggFrom', (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(GAS, v));
  pick('ggTo', (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(GAS, v));
  pick('cForm', (v) => FORMS.some((f) => f.id === v));
  for (const k of ['ggQ', 'cQ'] as const) if (k in s) st[k] = numText(s[k]) || st[k];
  if (typeof s.preset === 'string' && ['plant', 'office', 'blank', ''].includes(s.preset)) st.preset = s.preset;
  if (Array.isArray(s.lines)) {
    const lines = s.lines.slice(0, MAX_LINES).map(cleanLine).filter((l): l is Line => l !== null);
    if (lines.length || s.lines.length === 0) st.lines = lines;
  }
  return st;
}

/** A saved file or share link must hold an inventory. Returns null when it does not. */
export function parseImport(raw: unknown): State | null {
  const body = isObj(raw) && isObj(raw.state) ? raw.state : raw;
  return isObj(body) && Array.isArray(body.lines) ? parseState(body) : null;
}

/** What is written to a file or a link: everything except the short-lived messages. */
export function snapshot(st: State) {
  const { copied: _c, copyOk: _o, toast: _t, undo: _u, ...rest } = st;
  return rest;
}
export const fileContents = (st: State): string => JSON.stringify({ app: 'emissions-converter', version: 1, state: snapshot(st) }, null, 2);

export function load(): State {
  try { return parseState(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return defaults(); }
}
export function save(st: State) {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot(st))); } catch { /* private mode */ }
}
