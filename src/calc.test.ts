import { describe, expect, it } from 'vitest';
import { calcLine, elementKg, fmt, fromElementKg, gasToGas, gwp, mk } from './calc';
import { FORMS } from './data';
import { buildModel } from './model';
import { defaults } from './state';

const form = (id: string) => FORMS.find((f) => f.id === id)!;

describe('GWP and conversions', () => {
  it('uses the right GWP per report and horizon', () => {
    expect(gwp('CH4', 1, '100')).toBe(28);
    expect(gwp('CH4', 2, '20')).toBe(79.7);
  });
  it('swaps gases through CO2e', () => {
    expect(gasToGas(10, 't', 'CH4', 'N2O', 't', 1, '100').out).toBeCloseTo(280 / 265, 9);
  });
  it('converts C to CO2 and ppm to Gt C', () => {
    expect(fromElementKg(form('CO2'), elementKg(form('C'), 1, 't'), 't')).toBeCloseTo(3.664, 3);
    expect(fromElementKg(form('C'), elementKg(form('ppm'), 1, 'Gt'), 'Gt')).toBeCloseTo(2.124, 9);
  });
});

describe('GWP table against the IPCC source tables', () => {
  it('matches spot checks from AR4 errata, AR5 Table 8.A.1 and AR6 Table 7.SM.7', () => {
    expect([gwp('HFC134a', 0, '20'), gwp('HFC134a', 1, '20'), gwp('HFC134a', 2, '20')]).toEqual([3830, 3710, 4140]);
    expect([gwp('SF6', 0, '100'), gwp('SF6', 1, '100'), gwp('SF6', 2, '100')]).toEqual([22800, 23500, 25200]);
    expect([gwp('N2O', 1, '20'), gwp('N2O', 1, '100')]).toEqual([264, 265]);
    expect([gwp('CF4', 2, '20'), gwp('NF3', 2, '100')]).toEqual([5300, 17400]);
  });
});

describe('methane split and mobile fuels', () => {
  it('uses the fossil and non-fossil methane values from the IPCC tables', () => {
    expect([gwp('CH4F', 2, '100'), gwp('CH4F', 2, '20'), gwp('CH4', 2, '100')]).toEqual([29.8, 82.5, 27]);
    expect([gwp('CH4F', 1, '100'), gwp('CH4F', 1, '20')]).toEqual([30, 85]);
    expect(gwp('CH4F', 0, '100')).toBe(gwp('CH4', 0, '100')); // AR4 has no split
  });
  it('gives road diesel higher CH4 and N2O than stationary diesel, with the same CO2', () => {
    const st = calcLine(mk('fuel:diesel', { q: '1000', u: 'L' }), 1, '100');
    const rd = calcLine(mk('fuel:diesel_road', { q: '1000', u: 'L' }), 1, '100');
    expect(rd.parts.CO2).toBeCloseTo(st.parts.CO2, 9);
    expect(rd.parts.CH4).toBeCloseTo((st.parts.CH4 * 3.9) / 3, 9);
    expect(rd.parts.N2O).toBeCloseTo((st.parts.N2O * 3.9) / 0.6, 9);
  });
  it('uses the aviation defaults of 0.5 kg CH4 and 2 kg N2O per TJ for jet kerosene', () => {
    const gj = 1000 * 0.8 / 1e3 * 44.1;
    const r = calcLine(mk('fuel:jet', { q: '1000', u: 'L' }), 1, '100');
    expect(r.parts.CH4).toBeCloseTo((gj * 0.5 / 1000) * 28, 9);
    expect(r.parts.N2O).toBeCloseTo((gj * 2 / 1000) * 265, 9);
  });
  it('keeps a citation on published Scope 3 factors', () => {
    const lines = defaults().lines.filter((l) => l.type === 'custom');
    expect(lines.every((l) => l.src.length > 40 && l.ph)).toBe(true);
  });
});

describe('Scope 2 methods', () => {
  const re = () => mk('elec:re', { q: '1200000', u: 'kWh' });
  it('keeps the grid factor for location-based and zero for market-based on a renewable line', () => {
    expect(calcLine(re(), 1, '100', 'loc').kg / 1e3).toBeCloseTo(852, 6);
    expect(calcLine(re(), 1, '100', 'mkt').kg / 1e3).toBe(0);
  });
  it('falls back to the grid factor when no market-based factor is set', () => {
    const grid = mk('elec:in', { q: '1000', u: 'MWh' });
    expect(calcLine(grid, 1, '100', 'mkt').kg).toBeCloseTo(calcLine(grid, 1, '100', 'loc').kg, 9);
    expect(calcLine({ ...grid, mef: '0.4' }, 1, '100', 'mkt').kg / 1e3).toBeCloseTo(400, 6);
  });
  it('shows both methods side by side and totals the chosen one', () => {
    const st = { ...defaults(), lines: [mk('elec:in', { q: '1000000', u: 'kWh' }), re()] };
    const loc = buildModel({ ...st, s2: 'loc' }), mkt = buildModel({ ...st, s2: 'mkt' });
    expect(loc.totals.S2).toBeCloseTo(1562, 6);
    expect(mkt.totals.S2).toBeCloseTo(710, 6);
    expect(loc.inv.legend[1].sub).toContain('Market 710');
    expect(mkt.inv.legend[1].sub).toContain('Location 1,562');
  });
});

describe('biogenic CO2', () => {
  it('keeps CO2 from wood out of the totals but counts its methane and nitrous oxide', () => {
    const r = calcLine(mk('fuel:wood', { q: '10', u: 't' }), 1, '100');
    const gj = 10 * 15.6;
    expect(r.bio).toBeCloseTo(gj * 112, 6);
    expect(r.kg).toBeCloseTo((gj * 30 / 1000) * 28 + (gj * 4 / 1000) * 265, 6);
  });
  it('reports the biogenic total separately in the model', () => {
    const m = buildModel({ ...defaults(), lines: [mk('fuel:wood', { q: '10', u: 't' })] });
    expect(m.inv.bio).toBe('17.472 t');
    expect(m.totals.tot).toBeCloseTo(0.29640, 4);
  });
});

describe('inventory lines', () => {
  it('prices 5,000 L of diesel at 13.43 t CO2e including CH4 and N2O', () => {
    const r = calcLine(mk('fuel:diesel', { q: '5000', u: 'L' }), 1, '100');
    expect(r.kg / 1e3).toBeCloseTo(13.426, 2);
  });
  it('prices grid electricity per kWh and custom factors per unit', () => {
    expect(calcLine(mk('elec:in', { q: '1200000', u: 'kWh' }), 1, '100').kg / 1e3).toBeCloseTo(852, 6);
    expect(calcLine(mk('custom:', { q: '500', u: 't', ef: 2180 }), 1, '100').kg / 1e3).toBeCloseTo(1090, 6);
  });
});

describe('the example plant (AR5, 100-yr)', () => {
  const m = buildModel(defaults());
  it('splits into the scopes shown in the design', () => {
    expect(m.totals.S1).toBeCloseTo(379.56, 1);
    expect(m.totals.S2).toBeCloseTo(852, 6);
    expect(m.totals.S3).toBeCloseTo(1125.6325, 4); // steel 1,090 t + flights 35.6325 t
    expect(m.totals.tot).toBeCloseTo(2357.2, 1);
  });
  it('reports the hero cards', () => {
    expect(m.hero.k1).toBe('Purchased steel');
    expect(m.hero.k2).toBe('94.9%');
  });
});

describe('helpers', () => {
  it('formats numbers with separators and significant figures', () => {
    expect(fmt(1580.5)).toBe('1,580.5');
    expect(fmt(0.0256633)).toBe('0.025663');
  });
});
