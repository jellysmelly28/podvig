// Tiny DOM helpers: element builder, bottom sheet, toast, form fields.
import { DAYS_SHORT } from './dates.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    } else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function openSheet({ title, body, actions = [] }) {
  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 220); };
  const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) close(); } },
    h('div', { class: 'sheet' },
      h('div', { class: 'grip' }),
      h('h2', {}, title),
      body,
      actions.length ? h('div', { class: 'sheet-actions' }, actions.map((a) =>
        h('button', {
          class: 'btn ' + (a.kind || ''),
          onclick: async () => { const r = await a.onClick?.(); if (r !== false) close(); },
        }, a.label))) : null));
  document.body.append(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  return close;
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

export const field = (label, input, hint) =>
  h('label', { class: 'field' }, h('span', { class: 'flabel' }, label), input, hint ? h('span', { class: 'fhint' }, hint) : null);

export function select(options, value) {
  const s = h('select', {}, options.map(([v, label]) => h('option', { value: v }, label)));
  s.value = value;
  return s;
}

// Weekday toggle chips. Returns { el, get }.
export function dayChips(selected = []) {
  const sel = new Set(selected);
  const el = h('div', { class: 'chips' }, DAYS_SHORT.map((d, i) => {
    const b = h('button', { type: 'button', class: 'chip' + (sel.has(i) ? ' on' : '') }, d);
    b.onclick = () => { sel.has(i) ? sel.delete(i) : sel.add(i); b.classList.toggle('on'); el.dispatchEvent(new Event('change')); };
    return b;
  }));
  return { el, get: () => [...sel].sort() };
}

export const num = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isNaN(n) ? null : n; };

// Single-choice chips. options: [[value, label]]. Returns { el, get }.
export function choiceChips(options, value, onChange) {
  let cur = value;
  const el = h('div', { class: 'chips' });
  const draw = () => el.replaceChildren(...options.map(([v, label]) =>
    h('button', { type: 'button', class: 'chip' + (v === cur ? ' on' : ''), onclick: () => { cur = cur === v ? null : v; draw(); onChange?.(cur); } }, label)));
  draw();
  return { el, get: () => cur, set: (v) => { cur = v; draw(); } };
}

const EUR = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur = (n) => EUR.format(n || 0);
export const textarea = (value, placeholder) => h('textarea', { rows: 2, placeholder }, value || '');
