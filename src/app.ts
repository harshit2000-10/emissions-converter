import { PRESETS, fmt, kindOf, mk, setNumberStyle } from './calc';
import type { Line } from './calc';
import { UNITS } from './data';
import type { ArIdx, Horizon, Tab } from './data';
import { buildModel } from './model';
import { decodeShare, encodeShare } from './share';
import { fileContents, load, parseImport, save } from './state';
import type { State } from './state';
import { footer, header, hero, nav, panel, statusText, toast } from './view';

/** Patches the existing DOM to match the new markup, so typing keeps focus, caret and scroll. */
function morph(from: Element, to: Element) {
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  const fc = [...from.childNodes], tc = [...to.childNodes];
  tc.forEach((t, i) => {
    const f = fc[i];
    if (!f) from.appendChild(t.cloneNode(true));
    else if (f.nodeType === 3 && t.nodeType === 3) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; }
    else if (f.nodeType === 1 && t.nodeType === 1 && (f as Element).tagName === (t as Element).tagName) morph(f as Element, t as Element);
    else from.replaceChild(t.cloneNode(true), f);
  });
  for (let i = fc.length - 1; i >= tc.length; i--) from.removeChild(fc[i]);
  if (from !== document.activeElement) {
    if (from instanceof HTMLInputElement && from.type !== 'file' && from.value !== (to as HTMLInputElement).value) from.value = (to as HTMLInputElement).value;
    if (from instanceof HTMLSelectElement && from.value !== (to as HTMLSelectElement).value) from.value = (to as HTMLSelectElement).value;
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* blocked */ }
    ta.remove();
    return ok;
  }
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Runs the calculator inside `app`. `status` is a polite live region that announces the total to screen readers. */
export function start(app: HTMLElement, status: HTMLElement) {
  let st: State = load();
  let model = buildModel(st);
  let undoTo: State | null = null;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- drawing ---------- */
  function render() {
    setNumberStyle(st.nf);
    model = buildModel(st);
    const html = `${header(st)}${hero(st, model)}${nav(st, model)}<main id="main" tabindex="-1" class="wrap" style="padding-top:28px;padding-bottom:56px;display:flex;flex-direction:column;gap:24px">${panel(st, model)}</main>${footer()}${toast(st)}`;
    const next = app.cloneNode(false) as HTMLElement; // same id and class, so the root keeps its attributes
    next.innerHTML = html;
    morph(app, next);
    st.lines.forEach((l) => { l.fresh = false; });
    animateNumbers();
    announce();
    save(st);
  }

  /* ---------- headline numbers count up to their new value ---------- */
  const shown = new WeakMap<Element, number>();
  const frames = new WeakMap<Element, number>();
  function animateNumbers() {
    app.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      const to = +el.dataset.count!, suffix = el.dataset.suffix ?? '';
      const from = shown.get(el) ?? 0; // first paint counts up from zero
      cancelAnimationFrame(frames.get(el) ?? 0);
      shown.set(el, to);
      if (reduceMotion || from === to || !isFinite(to)) { el.textContent = fmt(to) + suffix; return; }
      const t0 = performance.now(), dur = 380;
      el.textContent = fmt(from) + suffix;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(k < 1 ? from + (to - from) * e : to) + suffix;
        if (k < 1) frames.set(el, requestAnimationFrame(tick));
      };
      frames.set(el, requestAnimationFrame(tick));
      // animation frames pause in background tabs, so a timer makes sure the final number always lands
      window.setTimeout(() => { if (shown.get(el) === to) el.textContent = fmt(to) + suffix; }, dur + 60);
    });
  }

  /* ---------- screen reader announcement, once the numbers stop changing ---------- */
  let statusTimer: number | undefined, lastStatus = '';
  function announce() {
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      const t = statusText(model);
      if (lastStatus && t !== lastStatus) status.textContent = t;
      lastStatus = t;
    }, 700);
  }

  /* ---------- state changes ---------- */
  const set = (patch: Partial<State>) => { st = { ...st, ...patch }; render(); };
  /** Changing a line means the inventory is no longer the untouched example. Opening its details does not count. */
  const updLine = (id: number, patch: Partial<Line>) => set({ lines: st.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)), ...('open' in patch ? {} : { preset: '' }) });

  let toastTimer: number | undefined;
  function flash(msg: string, undo = false) {
    clearTimeout(toastTimer);
    set({ toast: msg, undo });
    toastTimer = window.setTimeout(() => { undoTo = null; set({ toast: '', undo: false }); }, undo ? 8000 : 3500);
  }
  /** Replaces or removes inventory lines (file, link, example, delete) and keeps the old state so it can be undone. */
  function replaceWith(next: State, msg: string) {
    undoTo = st;
    st = { ...next, copied: '', copyOk: false, toast: '', undo: false };
    render();
    flash(msg, true);
  }

  function changeSrc(id: number, src: string) {
    set({
      preset: '',
      lines: st.lines.map((l) => {
        if (l.id !== id) return l;
        const n = mk(src, { q: l.q, label: l.label });
        n.id = l.id; n.open = l.open;
        if (n.type === l.type) n.scope = l.scope;
        const k = kindOf(n);
        if (k !== 'free' && UNITS[k].includes(l.u)) n.u = l.u;
        return n;
      }),
    });
  }

  let copyTimer: number | undefined;
  async function copy(key: string) {
    const ok = await writeClipboard(model.copy[key]);
    clearTimeout(copyTimer);
    set({ copied: key, copyOk: ok });
    copyTimer = window.setTimeout(() => set({ copied: '' }), 1600);
  }

  async function share() {
    const link = encodeShare(st).then((h) => `${location.origin}${location.pathname}${location.search}#${h}`);
    let ok = false;
    // handing the clipboard a promise keeps the click's permission alive while the link is built (Safari needs this)
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': link.then((u) => new Blob([u], { type: 'text/plain' })) })]); ok = true; } catch { /* try plain text */ }
    }
    const url = await link;
    if (!ok) ok = await writeClipboard(url);
    if (ok) return flash(url.length > 6000 ? 'Share link copied. It is long, so a saved file may be easier to send.' : 'Share link copied');
    history.replaceState(null, '', url.slice(url.indexOf('#'))); // last resort: put it in the address bar to copy by hand
    flash('Could not copy automatically. The link is now in your address bar.');
  }

  async function openFile(file: File) {
    if (file.size > 1_000_000) return flash('That file is too large to be a saved inventory.');
    try {
      const parsed = parseImport(JSON.parse(await file.text()));
      if (!parsed) return flash('That file is not an inventory saved from this calculator.');
      replaceWith(parsed, `Opened ${file.name.slice(0, 60)}.`);
    } catch { flash('That file could not be read as an inventory.'); }
  }

  /* ---------- buttons ---------- */
  function act(a: string, v: string | undefined, id: number) {
    switch (a) {
      case 'ar': return set({ ar: +v! as ArIdx });
      case 'h': return set({ h: v as Horizon });
      case 's2': return set({ s2: v as State['s2'] });
      case 'nf': return set({ nf: v as State['nf'] });
      case 'heroU': return set({ heroU: v as State['heroU'] });
      case 'tab':
        app.querySelector('main')!.innerHTML = ''; // fresh nodes replay the panel's entrance
        return set({ tab: v as Tab });
      case 'preset': return replaceWith({ ...st, lines: PRESETS[v!](), preset: v! }, v === 'blank' ? 'Started a blank inventory.' : 'Loaded the example.');
      case 'swap': return set({ ggFrom: st.ggTo, ggTo: st.ggFrom });
      case 'copy': return void copy(v!);
      case 'csv': return download('emissions-inventory.csv', 'text/csv;charset=utf-8', '﻿' + model.csv);
      case 'save': return download('emissions-inventory.json', 'application/json', fileContents(st));
      case 'share': return void share();
      case 'open': return app.querySelector<HTMLInputElement>('#file')?.click();
      case 'undo': if (undoTo) { const prev = undoTo; undoTo = null; clearTimeout(toastTimer); st = { ...prev, toast: '', undo: false }; render(); } return;
      case 'add': return set({ preset: '', lines: [...st.lines.map((l) => ({ ...l, fresh: false })), mk(v!, { fresh: true })] });
      case 'del': {
        const i = st.lines.findIndex((l) => l.id === id);
        replaceWith({ ...st, preset: '', lines: st.lines.filter((l) => l.id !== id) }, 'Line removed.');
        // keep keyboard focus in the list: the line that moved up, else the last line, else the add button
        const rest = app.querySelectorAll<HTMLElement>('.line [data-a=del]');
        return (rest[Math.min(i, rest.length - 1)] ?? app.querySelector<HTMLElement>('[data-a=add]'))?.focus();
      }
      case 'scope': return updLine(id, { scope: +v! as 1 | 2 | 3 });
      case 'toggle': return updLine(id, { open: !st.lines.find((l) => l.id === id)!.open });
    }
  }

  /* ---------- inputs ---------- */
  function bind(el: HTMLInputElement | HTMLSelectElement) {
    const key = el.dataset.b!, value = el.value;
    if (key === 'line') {
      const id = +el.dataset.id!, f = el.dataset.f!;
      if (f === 'src') return changeSrc(id, value);
      return updLine(id, f === 'ef' ? { ef: value, ph: false, src: '' } : ({ [f]: value } as Partial<Line>));
    }
    set({ [key]: value } as Partial<State>);
  }

  app.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!el) return;
    act(el.dataset.a!, el.dataset.v, +(el.dataset.id ?? 0));
    if (el.dataset.a === 'tab' && el.getAttribute('role') !== 'tab') {
      // a link to a tab from the summary cards or the About page: go to the panel it opened
      const p = app.querySelector<HTMLElement>('#panel')!;
      p.focus({ preventScroll: true });
      p.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  });
  app.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    if (el.dataset?.b) bind(el);
  });
  app.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.id === 'file' && el.files?.[0]) { void openFile(el.files[0]); el.value = ''; }
  });

  /* ---------- keyboard: arrow keys move between the tabs ---------- */
  app.addEventListener('keydown', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[role=tab]');
    if (!t) return;
    const tabs = [...app.querySelectorAll<HTMLElement>('[role=tab]')];
    let i = tabs.indexOf(t);
    if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = tabs.length - 1;
    else return;
    e.preventDefault();
    const next = tabs[i].dataset.v!;
    act('tab', next, 0);
    app.querySelector<HTMLElement>(`#tab-${next}`)?.focus();
  });

  /* ---------- hover a hotspot, line or scope and everything about it lights up ---------- */
  function highlight(t: EventTarget | null, on: boolean) {
    const el = (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-hl]');
    if (el) app.querySelectorAll(`[data-hl="${el.dataset.hl}"]`).forEach((x) => x.classList.toggle('hl', on));
  }
  app.addEventListener('mouseover', (e) => highlight(e.target, true));
  app.addEventListener('mouseout', (e) => highlight(e.target, false));

  /* ---------- start ---------- */
  app.classList.add('intro');
  setTimeout(() => app.classList.remove('intro'), 1400);
  render();
  if (typeof IntersectionObserver !== 'undefined') {
    // compact total in the sticky bar once the hero scrolls away
    new IntersectionObserver(([e]) => app.classList.toggle('past-hero', !e.isIntersecting && e.boundingClientRect.bottom < 0)).observe(app.querySelector('.hero')!);
  }
  if (/^#s=/.test(location.hash)) {
    void decodeShare(location.hash).then((shared) => {
      history.replaceState(null, '', location.pathname + location.search);
      if (shared) replaceWith(shared, 'Loaded the shared inventory.');
      else flash('That share link is damaged, so it was ignored.');
    });
  }

  return { get state() { return st; }, get model() { return model; } };
}
