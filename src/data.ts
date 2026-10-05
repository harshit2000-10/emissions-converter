// Reference tables. Keyed in by hand: check against the IPCC and CEA sources before client deliverables or a BRSR filing.

/** When every table below was last checked against its source. Update it, and the sources, together (see README). */
export const DATA_CHECKED = '2026-10-05';

export const U = { g: 1e-3, kg: 1, t: 1e3, kt: 1e6, Mt: 1e9, Gt: 1e12, lb: 0.45359237, 'short ton': 907.18474 } as const;
export type MassUnit = keyof typeof U;
export const MASS_UNITS = Object.keys(U) as MassUnit[];

export const AR = ['AR4', 'AR5', 'AR6'] as const;
export type ArIdx = 0 | 1 | 2;
export type Horizon = '100' | '20';

type Triple = readonly [number, number, number];
interface GasDef { f: string; n: string; fam: string; a: Triple; b: Triple }
// a = GWP-100, b = GWP-20; index 0/1/2 = AR4/AR5/AR6
export const GAS = {
  CO2: { f: 'CO₂', n: 'Carbon dioxide', fam: 'CO2', a: [1, 1, 1], b: [1, 1, 1] },
  // Methane splits by origin from AR5/AR6 on. AR4 has one value. AR5 fossil = +2 (100-yr) and +1 (20-yr) per the note to Table 8.7; AR6 from Table 7.15.
  CH4: { f: 'CH₄', n: 'Methane, non-fossil (biogenic and other)', fam: 'CH4', a: [25, 28, 27.0], b: [72, 84, 79.7] },
  CH4F: { f: 'CH₄ (fossil)', n: 'Methane, fossil source (leaks, venting)', fam: 'CH4', a: [25, 30, 29.8], b: [72, 85, 82.5] },
  N2O: { f: 'N₂O', n: 'Nitrous oxide', fam: 'N2O', a: [298, 265, 273], b: [289, 264, 273] },
  HFC23: { f: 'HFC-23', n: 'Trifluoromethane', fam: 'HFCs', a: [14800, 12400, 14600], b: [12000, 10800, 12400] },
  HFC32: { f: 'HFC-32', n: 'Difluoromethane', fam: 'HFCs', a: [675, 677, 771], b: [2330, 2430, 2690] },
  HFC125: { f: 'HFC-125', n: 'Pentafluoroethane', fam: 'HFCs', a: [3500, 3170, 3740], b: [6350, 6090, 6740] },
  HFC134a: { f: 'HFC-134a', n: 'Tetrafluoroethane', fam: 'HFCs', a: [1430, 1300, 1530], b: [3830, 3710, 4140] },
  HFC143a: { f: 'HFC-143a', n: 'Trifluoroethane', fam: 'HFCs', a: [4470, 4800, 5810], b: [5890, 6940, 7840] },
  HFC152a: { f: 'HFC-152a', n: 'Difluoroethane', fam: 'HFCs', a: [124, 138, 164], b: [437, 506, 591] },
  CF4: { f: 'CF₄', n: 'Tetrafluoromethane (PFC-14)', fam: 'PFCs', a: [7390, 6630, 7380], b: [5210, 4880, 5300] },
  C2F6: { f: 'C₂F₆', n: 'Hexafluoroethane (PFC-116)', fam: 'PFCs', a: [12200, 11100, 12400], b: [8630, 8210, 8940] },
  SF6: { f: 'SF₆', n: 'Sulphur hexafluoride', fam: 'SF6', a: [22800, 23500, 25200], b: [16300, 17500, 18300] },
  NF3: { f: 'NF₃', n: 'Nitrogen trifluoride', fam: 'NF3', a: [17200, 16100, 17400], b: [12300, 12800, 13400] },
} satisfies Record<string, GasDef>;
export type GasId = keyof typeof GAS;
export const GAS_IDS = Object.keys(GAS) as GasId[];

export type UnitKind = 'liq' | 'ng' | 'sol' | 'elec' | 'mass' | 'free';
// ncv GJ/t · d kg/m³ (absent = solid) · ef kg CO2/GJ · ch4, n2o kg/TJ · k = unit kind
// use: where the CH₄ and N₂O factors come from. stationary = IPCC 2006 Table 2.3 (manufacturing), road = Table 3.2.2, air = Table 3.6.5. CO₂ is the same in all three.
// bio: CO₂ from burning biomass is biogenic. It is reported outside the scopes, while CH₄ and N₂O still count.
interface FuelDef { l: string; ncv: number; d?: number; ef: number; ch4: number; n2o: number; u: string; k: UnitKind; use: 'stationary' | 'road' | 'air'; bio?: true }
export const FUELS = {
  diesel: { l: 'Diesel / gas oil · stationary', ncv: 43.0, d: 840, ef: 74.1, ch4: 3, n2o: 0.6, u: 'L', k: 'liq', use: 'stationary' },
  gasoline: { l: 'Motor gasoline · stationary', ncv: 44.3, d: 740, ef: 69.3, ch4: 3, n2o: 0.6, u: 'L', k: 'liq', use: 'stationary' },
  lpg: { l: 'LPG · stationary', ncv: 47.3, d: 540, ef: 63.1, ch4: 1, n2o: 0.1, u: 'kg', k: 'liq', use: 'stationary' },
  ng: { l: 'Natural gas · stationary', ncv: 48.0, d: 0.717, ef: 56.1, ch4: 1, n2o: 0.1, u: 'm³', k: 'ng', use: 'stationary' },
  resid: { l: 'Residual fuel oil', ncv: 40.4, d: 960, ef: 77.4, ch4: 3, n2o: 0.6, u: 'kL', k: 'liq', use: 'stationary' },
  anth: { l: 'Anthracite', ncv: 26.7, ef: 98.3, ch4: 10, n2o: 1.5, u: 't', k: 'sol', use: 'stationary' },
  bit: { l: 'Other bituminous coal', ncv: 25.8, ef: 94.6, ch4: 10, n2o: 1.5, u: 't', k: 'sol', use: 'stationary' },
  sub: { l: 'Sub-bituminous coal', ncv: 18.9, ef: 96.1, ch4: 10, n2o: 1.5, u: 't', k: 'sol', use: 'stationary' },
  lig: { l: 'Lignite', ncv: 11.9, ef: 101.0, ch4: 10, n2o: 1.5, u: 't', k: 'sol', use: 'stationary' },
  diesel_road: { l: 'Diesel · road vehicles', ncv: 43.0, d: 840, ef: 74.1, ch4: 3.9, n2o: 3.9, u: 'L', k: 'liq', use: 'road' },
  gasoline_road: { l: 'Petrol · road vehicles', ncv: 44.3, d: 740, ef: 69.3, ch4: 33, n2o: 3.2, u: 'L', k: 'liq', use: 'road' },
  lpg_road: { l: 'LPG · road vehicles', ncv: 47.3, d: 540, ef: 63.1, ch4: 62, n2o: 0.2, u: 'kg', k: 'liq', use: 'road' },
  cng_road: { l: 'CNG · road vehicles', ncv: 48.0, d: 0.717, ef: 56.1, ch4: 92, n2o: 3, u: 'kg', k: 'ng', use: 'road' },
  // Biomass and biofuels: IPCC 2006 Table 1.2 (NCV), Table 1.4 (CO₂) and Table 2.3 (CH₄, N₂O). Biodiesel density is a typical value.
  wood: { l: 'Wood / wood waste', ncv: 15.6, ef: 112, ch4: 30, n2o: 4, u: 't', k: 'sol', use: 'stationary', bio: true },
  charcoal: { l: 'Charcoal', ncv: 29.5, ef: 112, ch4: 200, n2o: 4, u: 't', k: 'sol', use: 'stationary', bio: true },
  biodiesel: { l: 'Biodiesel', ncv: 27.0, d: 880, ef: 70.8, ch4: 3, n2o: 0.6, u: 'L', k: 'liq', use: 'stationary', bio: true },
  jet: { l: 'Jet kerosene · aircraft', ncv: 44.1, d: 800, ef: 71.5, ch4: 0.5, n2o: 2, u: 'L', k: 'liq', use: 'air' },
} satisfies Record<string, FuelDef>;
export type FuelKey = keyof typeof FUELS;
export const fuelOf = (k: string): FuelDef => FUELS[k as FuelKey];

// ef = location-based (grid average). mef = market-based: '' means no supplier or certificate factor, so use the grid factor.
export const ELEC = {
  in: { l: 'Grid electricity · India', ef: 0.710, mef: '', ph: false },
  re: { l: 'Renewable electricity', ef: 0.710, mef: '0', ph: false },
  custom: { l: 'Grid electricity · own factor', ef: 0.5, mef: '', ph: true },
};
export type ElecKey = keyof typeof ELEC;

export const EN: Record<string, number> = { GJ: 1, MWh: 3.6, kWh: 0.0036, MMBtu: 1.055056 };
export const VOL: Record<string, number> = { L: 1e-3, kL: 1, 'm³': 1, 'US gal': 3.785411784e-3 };
export const KWH: Record<string, number> = { kWh: 1, MWh: 1000, GJ: 1 / 0.0036 };
export const UNITS: Record<Exclude<UnitKind, 'free'>, string[]> = {
  liq: ['L', 'kL', 'm³', 'US gal', 'kg', 't', 'GJ', 'MWh', 'kWh', 'MMBtu'],
  ng: ['m³', 'kg', 't', 'GJ', 'MWh', 'kWh', 'MMBtu'],
  sol: ['t', 'kg', 'GJ', 'MWh', 'kWh', 'MMBtu'],
  elec: ['kWh', 'MWh', 'GJ'],
  mass: [...MASS_UNITS],
};
export const SCOPE_DESC: Record<number, string> = { 1: 'Direct', 2: 'Purchased energy', 3: 'Value chain' };

export const KG_C_PER_PPM = 2.124e12;
export interface Form { id: string; fam: 'C' | 'N'; l: string; d: string; k?: number; ppm?: true }
export const FORMS: Form[] = [
  { id: 'C', fam: 'C', l: 'C', d: 'carbon', k: 1 },
  { id: 'CO2', fam: 'C', l: 'CO₂', d: 'carbon dioxide', k: 12.011 / 44.0095 },
  { id: 'ppm', fam: 'C', l: 'ppm CO₂', d: 'atmospheric concentration', ppm: true },
  { id: 'N', fam: 'N', l: 'N₂O–N', d: 'nitrogen in N₂O', k: 1 },
  { id: 'N2O', fam: 'N', l: 'N₂O', d: 'nitrous oxide', k: 28.0134 / 44.0128 },
];

export type Tab = 'inv' | 'conv' | 'about';
export const TABS: [Tab, string, string][] = [['inv', '01', 'Inventory'], ['conv', '02', 'Quick converters'], ['about', '03', 'About']];
