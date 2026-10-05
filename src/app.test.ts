// @vitest-environment happy-dom
// Drives the real app in a simulated page: typing, clicking, keyboard, saving, sharing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { start } from './app';
import { encodeShare, decodeShare } from './share';
import { defaults, fileContents, parseImport } from './state';

const mount = () => {
  document.body.innerHTML = '<div id="app" class="app"></div><div id="status" class="sr" role="status" aria-live="polite"></div>';
  const app = document.getElementById('app')!;
  return { app, api: start(app, document.getElementById('status')!) };
};
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const type = (el: HTMLInputElement | HTMLSelectElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
const hero = () => $('.hero .num').textContent;

beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); vi.stubGlobal('matchMedia', () => ({ matches: true })); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('page', () => {
  it('keeps its root class and shows the example plant', () => {
    const { app } = mount();
    expect(app.classList.contains('app')).toBe(true);
    expect(hero()).toBe('2,357.2');
    expect($('.s-hdr, header')).toBeTruthy();
  });

  it('keeps focus and the typed value while the totals update', () => {
    mount();
    const q = $<HTMLInputElement>('[data-b=line][data-f=q]');
    q.focus();
    type(q, '10000');
    expect(document.activeElement).toBe(q);
    expect($<HTMLInputElement>('[data-b=line][data-f=q]').value).toBe('10000');
    expect(hero()).toBe('2,370.6'); // 10,000 L of diesel instead of 5,000 L adds 13.4 t
  });

  it('switches basis, Scope 2 method and number style', () => {
    mount();
    $('[data-a=ar][data-v="2"]').click();
    expect(hero()).not.toBe('2,357.2');
    $('[data-a=ar][data-v="1"]').click();
    $('[data-a=nf][data-v=in]').click();
    $('[data-a=copy][data-v=inv]');
    expect(hero()).toBe('2,357.2'); // below 1 lakh, grouping is the same
    $('[data-a=heroU][data-v=kt]').click();
    expect(hero()).toBe('2.3572');
  });

  it('uses Indian grouping for large numbers when asked', () => {
    mount();
    $('[data-a=preset][data-v=blank]').click();
    type($<HTMLInputElement>('[data-b=line][data-f=q]'), '100000000'); // 100 million litres, about 2.7 lakh tonnes
    expect(hero()).toContain(',');
    $('[data-a=nf][data-v=in]').click();
    expect(hero()).toMatch(/^\d,\d{2},\d{3}(\.\d+)?$/);
  });
});

describe('guards', () => {
  it('counts a negative quantity as zero and says so on the line', () => {
    mount();
    type($<HTMLInputElement>('[data-b=line][data-f=q]'), '-5000');
    expect($('.line').textContent).toContain('Negative number counted as zero');
    expect($('.line b.num').textContent).toBe('0 t CO₂e');
    expect(hero()).toBe('2,343.8'); // the example plant without its 13.4 t of diesel
  });

  it('keeps the density box when it is emptied, and warns that the line counts as zero', () => {
    mount();
    $('.line [data-a=toggle]').click();
    type($<HTMLInputElement>('.line [data-f=d]'), '');
    expect($('.line [data-f=d]')).toBeTruthy();
    expect($('.line').textContent).toContain('NCV or density is missing');
  });

  it('lets you undo loading an example or removing a line', () => {
    mount();
    $('[data-a=preset][data-v=blank]').click();
    expect(hero()).toBe('0');
    expect($('.kpi:last-child').textContent).not.toContain('top 0');
    $('[data-a=undo]').click();
    expect(hero()).toBe('2,357.2');
    $('.line [data-a=del]').click();
    expect(hero()).toBe('2,343.8');
    $('[data-a=undo]').click();
    expect(hero()).toBe('2,357.2');
  });

  it('drops the Example data tag once a line is changed, and keeps focus in the list after a removal', () => {
    mount();
    expect($('#panel').textContent).toContain('Example data');
    $('.line [data-a=toggle]').click(); // opening details is not an edit
    expect($('#panel').textContent).toContain('Example data');
    document.querySelectorAll<HTMLElement>('.line [data-a=del]')[1].click();
    expect($('#panel').textContent).not.toContain('Example data');
    expect(document.activeElement).toBe(document.querySelectorAll('.line [data-a=del]')[1]);
  });

  it('counts a negative amount in the converters as zero and says so', () => {
    mount();
    $('#tab-conv').click();
    type($<HTMLInputElement>('[data-b=ggQ]'), '-3');
    type($<HTMLInputElement>('[data-b=cQ]'), '-1');
    expect($('#panel').textContent!.match(/Negative number counted as zero/g)).toHaveLength(2);
    expect($('#panel .num').textContent).toBe('0 t N₂O');
  });

  it('stops a label from running as a spreadsheet formula', () => {
    const { api } = mount();
    $('.line [data-a=toggle]').click();
    type($<HTMLInputElement>('.line [data-f=label]'), '=HYPERLINK("http://x","y")');
    expect(api.model.csv).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(api.model.copy.inv).toContain("\t'=HYPERLINK");
  });

  it('shows text in a custom line’s details', () => {
    mount();
    const custom = [...document.querySelectorAll<HTMLElement>('.line')].at(-1)!;
    custom.querySelector<HTMLElement>('[data-a=toggle]')!.click();
    expect([...document.querySelectorAll('.line')].at(-1)!.textContent).toContain('Emissions = quantity × factor');
  });
});

describe('tabs', () => {
  it('follows the tab pattern: roving tabindex, panel labelled by the tab, arrow keys', () => {
    mount();
    expect($('#tab-inv').getAttribute('tabindex')).toBe('0');
    expect($('#tab-conv').getAttribute('tabindex')).toBe('-1');
    expect($('#panel').getAttribute('aria-labelledby')).toBe('tab-inv');
    $('#tab-inv').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect($('#panel').getAttribute('aria-labelledby')).toBe('tab-conv');
    expect(document.activeElement?.id).toBe('tab-conv');
    $('#tab-conv').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect($('#panel').getAttribute('aria-labelledby')).toBe('tab-about');
    $('#tab-about').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect($('#panel').getAttribute('aria-labelledby')).toBe('tab-inv'); // wraps round
  });

  it('has a skip link and a labelled chart', () => {
    mount();
    expect($('a.skip').getAttribute('href')).toBe('#main');
    expect($('svg.ring').getAttribute('role')).toBe('img');
    expect($('svg.ring').getAttribute('aria-label')).toContain('Scope 1');
  });
});

describe('saving and sharing', () => {
  it('saves to the browser and restores after a reload', () => {
    const { app } = mount();
    $('[data-a=preset][data-v=office]').click();
    const total = hero();
    app.remove();
    mount();
    expect(hero()).toBe(total);
  });

  it('round-trips through a file and refuses files that are not inventories', () => {
    const st = { ...defaults(), s2: 'mkt' as const };
    const back = parseImport(JSON.parse(fileContents(st)))!;
    expect(back.s2).toBe('mkt');
    expect(back.lines.map((l) => l.key)).toEqual(st.lines.map((l) => l.key));
    expect(parseImport({ hello: 'world' })).toBeNull();
    expect(parseImport(null)).toBeNull();
    expect(parseImport([1, 2])).toBeNull();
  });

  it('cleans hostile or damaged input instead of trusting it', () => {
    const evil = {
      lines: [
        { type: 'fuel', key: 'diesel', q: '<img src=x onerror=alert(1)>', u: 'constructor', scope: 1, label: 'a\tb\u0007<script>', ef: '74.1' },
        { type: 'fuel', key: '__proto__', q: '5', u: 'L', scope: 1 },
        { type: 'gas', key: 'SF6', q: '1', u: 'kg', scope: 9 },
        'not a line',
        { type: 'custom', key: '', q: '2', u: 'x'.repeat(500), scope: 3, ef: '1e400', src: 'y'.repeat(2000) },
      ],
      ggFrom: 'nope', tab: 'secret', ar: 7,
    };
    const st = parseImport(evil)!;
    expect(st.lines).toHaveLength(2); // the bad ones are dropped
    expect(st.lines[0].q).toBe(''); // markup in a number field is thrown away
    expect(st.lines[0].u).toBe('L'); // an unknown unit falls back to the default
    expect(st.lines[0].label).not.toMatch(/[\t\u0007]/);
    expect(st.lines[1].u.length).toBeLessThanOrEqual(40);
    expect(st.lines[1].src.length).toBeLessThanOrEqual(500);
    expect(st.ggFrom).toBe('CH4'); expect(st.tab).toBe('inv'); expect(st.ar).toBe(1);
  });

  it('never puts markup from a saved label on the page', () => {
    localStorage.setItem('emissions-workbench:v1', JSON.stringify({ lines: [{ type: 'custom', key: '', q: '1', u: 't', scope: 3, ef: '1', label: '"><img id=pwned src=x>' }] }));
    mount();
    expect(document.getElementById('pwned')).toBeNull();
  });

  it('turns a share link back into the same inventory', async () => {
    const st = { ...defaults(), nf: 'in' as const };
    const hash = await encodeShare(st);
    expect(hash).toMatch(/^s=[zj][A-Za-z0-9_-]+$/);
    const back = await decodeShare('#' + hash);
    expect(back?.nf).toBe('in');
    expect(back?.lines.length).toBe(st.lines.length);
    expect(await decodeShare('#s=zbroken')).toBeNull();
    expect(await decodeShare('#other')).toBeNull();
  });

  it('opens a shared link on load and lets you undo it', async () => {
    const shared = { ...defaults(), lines: defaults().lines.slice(0, 2) };
    history.replaceState(null, '', '/#' + (await encodeShare(shared)));
    mount();
    await vi.waitFor(() => expect($('.toast')?.textContent).toContain('Loaded the shared inventory'));
    expect($('.mini b').textContent).not.toBe('2,357.2');
    expect(location.hash).toBe('');
    $('[data-a=undo]').click();
    expect(hero()).toBe('2,357.2');
  });

  it('puts the link in the address bar when the browser refuses to copy', async () => {
    mount();
    vi.stubGlobal('ClipboardItem', undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true });
    document.execCommand = () => false;
    $('[data-a=share]').click();
    await vi.waitFor(() => expect($('.toast')?.textContent).toContain('address bar'));
    expect(location.hash).toMatch(/^#s=[zj]/);
  });

  it('downloads a CSV with plain numbers that spreadsheets can read', () => {
    mount();
    let blob: Blob | undefined;
    (URL as unknown as Record<string, unknown>).createObjectURL = (b: Blob) => { blob = b; return 'blob:test'; };
    (URL as unknown as Record<string, unknown>).revokeObjectURL = () => {};
    $('[data-a=csv]').click();
    expect(blob?.type).toContain('text/csv');
    return blob!.text().then((t) => {
      expect(t.startsWith('﻿')).toBe(true);
      expect(t).toContain('Scope 2 market-based');
      expect(t).toMatch(/Total \(Scope 2 location-based\),,,,,,2357\.\d+,/); // no thousands separator
    });
  });
});
