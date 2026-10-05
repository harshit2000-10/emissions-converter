// Run with `npm run verify-sources`. Downloads the original documents (cached in .cache/sources),
// reads the table rows for every gas and fuel in src/data.ts, and fails if a value in the code is not in its source row.
// The check is deliberately simple: it looks for the expected numbers, in order, inside the gas's row (or the few lines
// of a row that the PDF splits). It catches typing slips such as 3790 for 3710; it does not replace reading the source.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DATA_CHECKED, ELEC, FUELS, GAS } from '../src/data';
import type { GasId } from '../src/data';

const DIR = '.cache/sources';
const SOURCES = {
  ar4: 'https://www.ipcc.ch/site/assets/uploads/2018/05/ar4-wg1-errata.pdf',
  ar5: 'https://www.ipcc.ch/pdf/assessment-report/ar5/wg1/WG1AR5_Chapter08_FINAL.pdf',
  ar6sm: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter_07_Supplementary_Material.pdf',
  ar6ch7: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07.pdf',
  v2c1: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_1_Ch1_Introduction.pdf',
  v2c2: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf',
  v2c3: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_3_Ch3_Mobile_Combustion.pdf',
  cea: 'https://cea.nic.in/wp-content/uploads/baseline/2025/12/User_Guide_V_21.0.pdf',
} as const;
type Doc = keyof typeof SOURCES;
const docs = {} as Record<Doc, string[]>;

async function load(name: Doc): Promise<string[]> {
  mkdirSync(DIR, { recursive: true });
  const pdf = `${DIR}/${name}.pdf`, txt = `${DIR}/${name}.txt`;
  if (!existsSync(txt)) {
    if (!existsSync(pdf)) {
      const res = await fetch(SOURCES[name], { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`Could not download ${SOURCES[name]} (${res.status})`);
      writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
    }
    execFileSync('pdftotext', ['-layout', pdf, txt]);
  }
  return readFileSync(txt, 'utf8').split('\n');
}

/** Numbers on a line, with IPCC thousands spaces and commas removed ("98 300" and "98,300" both give 98300). */
function nums(text: string): number[] {
  let t = text;
  for (let i = 0; i < 3; i++) t = t.replace(/(\d) (\d{3})(?!\d)/g, '$1$2');
  t = t.replace(/(\d),(\d{3})/g, '$1$2');
  return (t.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
}
const inOrder = (have: number[], want: number[]) => { let i = 0; for (const n of have) if (n === want[i]) i++; return i === want.length; };
const find = (lines: string[], re: RegExp, from = 0) => { const i = lines.findIndex((l, k) => k >= from && re.test(l)); if (i < 0) throw new Error(`Row not found: ${re}`); return i; };
const window = (lines: string[], i: number, n: number) => lines.slice(i, i + n + 1).join(' ');

beforeAll(async () => { for (const k of Object.keys(SOURCES) as Doc[]) docs[k] = await load(k); });

describe('reference data stamp', () => {
  it('is a real date that is not in the future', () => {
    expect(Number.isNaN(Date.parse(DATA_CHECKED))).toBe(false);
    expect(Date.parse(DATA_CHECKED)).toBeLessThanOrEqual(Date.now() + 864e5); // a day of slack for time zones
  });
});

/* ---------- GWP: [GWP-20, GWP-100] must appear, in that order, in the gas's row ---------- */
const AR4_ROW: Partial<Record<GasId, RegExp>> = {
  CH4: /^\s*Methane/, N2O: /^\s*Nitrous oxide/, HFC23: /^\s*HFC-23\s/, HFC32: /^\s*HFC-32\s/, HFC125: /^\s*HFC-125\s/, HFC134a: /^\s*HFC-134a\s/,
  HFC143a: /^\s*HFC-143a\s/, HFC152a: /^\s*HFC-152a\s/, CF4: /^\s*PFC-14\s/, C2F6: /^\s*PFC-116\s/, SF6: /^\s*Sulphur hexafluoride/, NF3: /^\s*Nitrogen trifluoride/,
};
const AR5_ROW: Partial<Record<GasId, RegExp>> = {
  HFC23: /^\s*HFC-23\s+CHF3/, HFC32: /^\s*HFC-32\s+CH2F2/, HFC125: /^\s*HFC-125\s+CHF2CF3/, HFC134a: /^\s*HFC-134a\s+CH2FCF3/,
  HFC143a: /^\s*HFC-143a\s+CH3CF3/, HFC152a: /^\s*HFC-152a\s+CH3CHF2/, CF4: /^\s*PFC-14\s+CF4/, C2F6: /^\s*PFC-116\s+C2F6/,
  SF6: /Sulphur hexafluoride\s+SF6/, NF3: /Nitrogen trifluoride\s+NF3/,
};
const AR6_ROW: Partial<Record<GasId, [RegExp, number]>> = { // [row start, lines to read]
  N2O: [/^\s*Nitrous oxide\s+N2O/, 0], HFC23: [/^HFC-23\s+CHF3/, 0], HFC32: [/^HFC-32\s+CH2F2/, 0], HFC125: [/^HFC-125\s+CHF2CF3/, 0], HFC143a: [/^HFC-143a\s+CH3CF3/, 0],
  CF4: [/^PFC-14\s+CF4/, 0], C2F6: [/^PFC-116\s+C2F6/, 0],
  HFC134a: [/^\s*CH2FCF3\s*$/, 25], HFC152a: [/^\s*CH3CHF2\s*$/, 25], SF6: [/^\s*SF6\s*$/, 25], NF3: [/^\s*NF3\s*$/, 25],
};

describe('GWP values match the IPCC tables', () => {
  for (const g of Object.keys(GAS) as GasId[]) {
    if (g === 'CO2') continue;
    const want = (ar: 0 | 1 | 2) => [GAS[g].b[ar], GAS[g].a[ar]];
    it(`${GAS[g].f} · AR4 errata`, () => {
      const re = AR4_ROW[g === 'CH4F' ? 'CH4' : g]!; // AR4 has no fossil split
      expect(inOrder(nums(docs.ar4[find(docs.ar4, re)]), want(0))).toBe(true);
    });
    if (g !== 'CH4' && g !== 'CH4F') {
      if (g !== 'N2O') { // nitrous oxide is in Table 8.7, checked below
        it(`${GAS[g].f} · AR5 Table 8.A.1`, () => {
          expect(inOrder(nums(docs.ar5[find(docs.ar5, AR5_ROW[g]!)]), want(1))).toBe(true);
        });
      }
      it(`${GAS[g].f} · AR6 Table 7.SM.7`, () => {
        const start = find(docs.ar6sm, /Table 7\.SM\.7:/);
        const [re, span] = AR6_ROW[g]!;
        const i = find(docs.ar6sm, re, start);
        expect(inOrder(nums(window(docs.ar6sm, i, span)), want(2))).toBe(true);
      });
    }
  }
  it('Methane · AR5 Table 8.7 (non-fossil) and the note that fossil is +1 and +2', () => {
    const i = find(docs.ar5, /^\s*CH4b\s/);
    expect(inOrder(nums(window(docs.ar5, i, 3)), [GAS.CH4.b[1], GAS.CH4.a[1]])).toBe(true);
    expect(docs.ar5.join(' ').replace(/\s+/g, ' ')).toContain('Values for fossil methane are higher by 1 and 2 for the 20 and 100 year metrics');
    expect([GAS.CH4F.b[1] - GAS.CH4.b[1], GAS.CH4F.a[1] - GAS.CH4.a[1]]).toEqual([1, 2]);
  });
  it('Nitrous oxide · AR5 Table 8.7', () => {
    const i = find(docs.ar5, /^\s*N2O\s+121\.0/);
    expect(inOrder(nums(window(docs.ar5, i, 3)), [GAS.N2O.b[1], GAS.N2O.a[1]])).toBe(true);
  });
  it('Methane · AR6 Table 7.15, fossil and non-fossil', () => {
    const fossil = find(docs.ar6ch7, /^\s*CH4-fossil\s/), non = find(docs.ar6ch7, /^\s*CH4-non fossil\s/);
    expect(inOrder(nums(window(docs.ar6ch7, fossil, 3)), [GAS.CH4F.b[2], GAS.CH4F.a[2]])).toBe(true);
    expect(inOrder(nums(window(docs.ar6ch7, non, 3)), [GAS.CH4.b[2], GAS.CH4.a[2]])).toBe(true);
  });
});

/* ---------- Fuels ---------- */
const ROW_2_3: Record<string, RegExp> = {
  gasoline: /^\s*Motor Gasoline/, diesel: /^\s*Gas\/Diesel Oil/, lpg: /^\s*Liquefied Petroleum Gases/, resid: /^\s*Residual Fuel Oil/, ng: /^\s*Natural Gas\s+\S*\s*\d/,
  anth: /^\s*Anthracite/, bit: /^\s*Other Bituminous Coal/, sub: /^\s*Sub-Bituminous Coal/, lig: /^\s*Lignite\s+[\dnr]/,
  wood: /Wood\s*\/\s*Wood Waste/i, charcoal: /^\s*Charcoal/, biodiesel: /Biodiesels/,
};
const ROW_1_2: Record<string, RegExp> = { ...ROW_2_3, ng: /^\s*Natural Gas\s+\d/, jet: /^\s*Jet Kerosene/, wood: /Wood\/Wood Waste/, diesel: /^\s*Gas\/Diesel Oil/ };

describe('stationary fuel factors match IPCC 2006 Tables 1.2 and 2.3', () => {
  const t12 = () => find(docs.v2c1, /TABLE 1\.2/), t23 = () => find(docs.v2c2, /TABLE 2\.3/);
  for (const [id, re] of Object.entries(ROW_2_3)) {
    const F = FUELS[id as keyof typeof FUELS];
    it(`${F.l}: CO₂ ${F.ef} kg/GJ, CH₄ ${F.ch4} and N₂O ${F.n2o} kg/TJ (Table 2.3), NCV ${F.ncv} GJ/t (Table 1.2)`, () => {
      const row = nums(docs.v2c2[find(docs.v2c2, re, t23())]);
      expect([row[0], row[3], row[6]]).toEqual([F.ef * 1000, F.ch4, F.n2o]);
      expect(nums(docs.v2c1[find(docs.v2c1, ROW_1_2[id], t12())]).slice(0, 3)).toContain(F.ncv);
    });
  }
  it('Jet kerosene: NCV and CO₂ (Tables 1.2 and 2.3)', () => {
    const F = FUELS.jet;
    expect(nums(docs.v2c1[find(docs.v2c1, ROW_1_2.jet, t12())]).slice(0, 3)).toContain(F.ncv);
    expect(nums(docs.v2c2[find(docs.v2c2, /^\s*Jet Kerosene/, t23())])[0]).toBe(F.ef * 1000);
  });
});

describe('vehicle and aircraft factors match IPCC 2006 Chapter 3', () => {
  const t322 = () => find(docs.v2c3, /TABLE 3\.2\.2/), t321 = () => find(docs.v2c3, /TABLE 3\.2\.1/);
  const rows: [keyof typeof FUELS, RegExp][] = [
    ['gasoline_road', /Motor Gasoline\s*-\s*Uncontrolled/], ['diesel_road', /^\s*Gas \/ Diesel Oil/], ['cng_road', /^\s*Natural Gas\s+\d/], ['lpg_road', /^\s*Liquified petroleum gas/],
  ];
  for (const [id, re] of rows) {
    const F = FUELS[id];
    it(`${F.l}: CH₄ ${F.ch4} and N₂O ${F.n2o} kg/TJ (Table 3.2.2)`, () => {
      expect(inOrder(nums(docs.v2c3[find(docs.v2c3, re, t322())]).filter((n) => n !== 1 || F.n2o === 1), [F.ch4, F.n2o])).toBe(true);
    });
  }
  const co2: [keyof typeof FUELS, RegExp][] = [['gasoline_road', /^\s*Motor Gasoline/], ['diesel_road', /^\s*Gas\/ Diesel Oil/], ['lpg_road', /^\s*Liquefied Petroleum Gases/], ['cng_road', /^\s*Compressed Natural Gas/]];
  for (const [id, re] of co2) {
    it(`${FUELS[id].l}: CO₂ ${FUELS[id].ef} kg/GJ (Table 3.2.1)`, () => {
      expect(nums(docs.v2c3[find(docs.v2c3, re, t321())])[0]).toBe(FUELS[id].ef * 1000);
    });
  }
  it('Aircraft: 0.5 kg CH₄ and 2 kg N₂O per TJ for all fuels (Table 3.6.5)', () => {
    const i = find(docs.v2c3, /TABLE 3\.6\.5/);
    expect(inOrder(nums(window(docs.v2c3, i, 14)), [FUELS.jet.ch4, FUELS.jet.n2o, 250])).toBe(true);
  });
});

describe('India grid factor matches the CEA database', () => {
  it(`weighted average ${ELEC.in.ef} t CO₂/MWh`, () => {
    const row = nums(docs.cea[find(docs.cea, /^\s*0\.7\d\d\s+0\.9\d\d/)]);
    expect(row[0]).toBe(ELEC.in.ef);
    expect(docs.cea.join(' ')).toContain('FY 2024-25'); // update the factor, its label and DATA_CHECKED together when CEA publishes a new year
  });
});
