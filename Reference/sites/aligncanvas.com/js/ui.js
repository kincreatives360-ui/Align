// Interface: small bound controls (Surface-style bars, segments, toggles) and the panels built from them.
import { TEMPLATES, CATEGORIES, MOD_GROUPS, byId, controlGroups, defaults } from './templates.js';
import { FLARE_PARAMS } from './flare.js';
import { MEDIA_SETS } from './faces.js';
import { STYLE_PRESETS, BG_PALETTES } from './state.js';
import { ASPECTS, ANIMS, sizeFor, loopLength, clipInfo } from './engine.js';
import * as B from './brand.js';
import { library, libUrl, fmtDur } from './media.js';
import { limited, canExportSize, canExportStill, canUseFps, proTemplate, exportsLeft, currentUser } from './account.js';
import { FREE_MAX, FREE_IMG_MAX, FREE_FPS, FREE_EXPORTS, PAYMENTS } from './config.js';

const svg = (d, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const I = {
  play: svg('<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>'),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  grid: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
  restart: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4M17 5h4"/>', 17),
  motion: svg('<path d="M3 17c3 0 4-10 7-10s3 10 6 10 3-6 5-6"/>', 18),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 18),
  text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', 18),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 18),
  layers: svg('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', 18),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 14),
  back: svg('<path d="M15 6l-6 6 6 6"/>', 14),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4h4"/>', 14),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 14),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 12),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>', 14),
  shuffle: svg('<path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.5 0 2.7-1.3 3.7-3M14.3 10C15.3 8.3 16.5 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3"/>', 14),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', 14),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 14),
  comp: svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', 18),
  sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', 18),
  vplay: '<svg width="9" height="9" viewBox="0 0 24 24"><path d="M6 4v16l14-8z" fill="currentColor"/></svg>',
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 12),
  pen: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', 14),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>', 14),
  crown: '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></svg>',
  cloud: svg('<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z"/>', 14),
  upload: svg('<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>', 14),
  save: svg('<path d="M5 4h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>', 15),
};

export function h(tag, attrs = {}, ...kids){
  const e = document.createElement(tag);
  for (const k in attrs){
    const v = attrs[k];
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e[k.toLowerCase()] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}
export const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
export function setPath(o, p, v){ const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => a[k] ??= {}, o); t[last] = v; }

/* ---------- controls ---------- */
const fmtNum = (v, step) => { const d = step >= 1 ? 0 : step >= .1 ? 1 : 2; return Number(v).toFixed(d); };
export function row(label, ...ctl){ return h('div', {class: 'row'}, label != null ? h('label', {}, label) : null, h('div', {class: 'ctl'}, ...ctl)); }
export function slider(app, label, path, o = {}){
  const {min = 0, max = 1, step = .01, fmt, unit = '', percent} = o;
  const el = h('div', {class: 'sl', tabindex: 0, role: 'slider', 'aria-label': label});
  const fi = h('div', {class: 'fi'}), kn = h('div', {class: 'kn'}), vl = h('div', {class: 'vl'});
  el.append(fi, kn, vl);
  const get = () => Number(getPath(app.state, path) ?? min);
  const show = () => {
    const v = get(), t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    fi.style.width = (t * 100) + '%'; kn.style.left = `calc(${t * 100}% - ${t * 2}px)`;
    vl.textContent = fmt ? fmt(v) : percent ? Math.round(v * 100) + '%' : fmtNum(v, step) + unit;
  };
  const setV = v => { v = Math.round(Math.max(min, Math.min(max, v)) / step) * step; v = +v.toFixed(6); if (v !== get()){ app.set(path, v, o); show(); } };
  const fromX = e => { const r = el.getBoundingClientRect(); return min + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (max - min); };
  el.onpointerdown = e => {
    if (e.target.tagName === 'INPUT') return;
    el.setPointerCapture(e.pointerId); el.focus();
    const startX = e.clientX, startV = get(); let moved = false;
    el.onpointermove = ev => { moved = moved || Math.abs(ev.clientX - startX) > 2;
      // shift = fine control
      if (ev.shiftKey){ const r = el.getBoundingClientRect(); setV(startV + (ev.clientX - startX) / r.width * (max - min) * .15); } else setV(fromX(ev)); };
    el.onpointerup = ev => { el.onpointermove = null; if (!moved) setV(fromX(ev)); app.commit(); };
  };
  el.onkeydown = e => {
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp'){ setV(get() + step * big); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown'){ setV(get() - step * big); e.preventDefault(); }
    if (e.key === 'Enter') edit();
  };
  // double-click to type an exact value
  const edit = () => {
    const inp = h('input', {value: fmtNum(get(), step)});
    el.append(inp); inp.focus(); inp.select();
    const done = ok => { if (ok){ const v = parseFloat(inp.value); if (!isNaN(v)) setV(percent ? (inp.value.includes('%') ? v / 100 : v) : v); app.commit(); } inp.remove(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
    inp.onblur = () => done(true);
  };
  el.ondblclick = edit;
  show();
  return row(label, el);
}
export function seg(app, label, path, options, o = {}){
  const g = h('div', {class: 'sg'});
  const draw = () => { g.innerHTML = ''; for (const k in options){ const v = getPath(app.state, path);
    const lk = o.locked?.(k);
    g.append(h('button', {class: (String(v) === k ? 'on' : '') + (lk ? ' pro' : ''), title: lk ? 'Pro' : null, onclick: () => { if (lk){ o.onLocked?.(k); return; } app.set(path, isNaN(+k) || k === '' ? k : (typeof v === 'number' ? +k : k), o); app.commit(); draw(); if (o.rebuild) app.rebuild(); }}, options[k], lk ? h('span', {class: 'crown', html: I.crown}) : null)); } };
  draw();
  return row(label, g);
}
export function toggleEl(app, path, o = {}){
  const b = h('button', {class: 'tg' + (getPath(app.state, path) ? ' on' : ''), 'aria-label': o.label || 'Toggle', role: 'switch'});
  b.onclick = e => { e.stopPropagation(); const v = !getPath(app.state, path); app.set(path, v, o); app.commit(); b.classList.toggle('on', v); if (o.rebuild) app.rebuild(); };
  return b;
}
export const toggle = (app, label, path, o) => row(label, h('div', {style: 'flex:1'}), toggleEl(app, path, o));
// a switch for a Pro feature: on the free plan it shows a crown and explains Pro instead of switching
export function proToggleEl(app, path, o, why){
  if (!limited()) return toggleEl(app, path, o);
  return h('button', {class: 'tg pro', 'aria-label': (o.label || 'Toggle') + ' (Pro)', onclick: e => { e.stopPropagation(); app.proNeeded(why); }}, h('span', {class: 'crown', html: I.crown}));
}
export function select(app, label, path, options, o = {}){
  const s = h('select', {class: 'sel'});
  for (const k in options) s.append(h('option', {value: k, selected: String(getPath(app.state, path)) === k}, options[k]));
  s.onchange = () => { const cur = getPath(app.state, path); app.set(path, typeof cur === 'number' ? +s.value : s.value, o); app.commit(); if (o.rebuild) app.rebuild(); };
  return row(label, s);
}
export function color(app, label, path, o = {}){
  const c = h('input', {type: 'color', value: getPath(app.state, path)}), t = h('input', {class: 'txt', value: getPath(app.state, path)});
  c.oninput = () => { t.value = c.value; app.set(path, c.value, o); };
  c.onchange = () => app.commit();
  t.onchange = () => { if (/^#[0-9a-f]{6}$/i.test(t.value)){ c.value = t.value; app.set(path, t.value, o); app.commit(); } };
  return row(label, h('div', {class: 'col'}, c, t));
}
export function text(app, label, path){
  const t = h('input', {class: 'txt', value: getPath(app.state, path) ?? ''});
  t.oninput = () => app.set(path, t.value); t.onchange = () => app.commit();
  return row(label, t);
}
export function section(app, id, title, sub, o = {}, ...kids){
  const open = app.ui.open.has(id) || (o.open && !app.ui.closed.has(id));
  const s = h('div', {class: 'sec' + (open ? ' open' : '') + (o.flat ? ' flat' : '')});
  const head = h('div', {class: 'sh'},
    h('div', {class: 'tt'}, h('div', {class: 't1'}, title, o.pro ? h('span', {class: 'badge pro'}, h('span', {html: I.crown}), 'Pro') : o.isNew ? h('span', {class: 'badge'}, 'New') : o.soon ? h('span', {class: 'badge'}, 'Soon') : null), sub ? h('div', {class: 't2'}, sub) : null),
    o.toggle ? toggleEl(app, o.toggle, {rebuild: false}) : null,
    o.action || null,
    h('span', {class: 'chev', html: I.chev}));
  head.onclick = () => { const on = !s.classList.contains('open'); s.classList.toggle('open', on); if (on){ app.ui.open.add(id); app.ui.closed.delete(id); } else { app.ui.open.delete(id); app.ui.closed.add(id); } };
  s.append(head, h('div', {class: 'sb'}, ...kids));
  return s;
}

/* ---------- left: motion (templates + controls) ---------- */
export function leftPanel(app){
  const el = $('left'); el.innerHTML = '';
  const r = app.ui.rail;
  if (r === 'motion') el.append(motionPanel(app));
  if (r === 'media') el.append(mediaPanel(app));
  if (r === 'text') el.append(textPanel(app));
  if (r === 'project') el.append(projectPanel(app));
}
const $ = id => document.getElementById(id);

function motionPanel(app){
  const wrap = h('div', {class: 'lp'});
  const tab = app.ui.leftTab;
  wrap.append(h('div', {class: 'lp-head'},
    h('button', {class: 'bigtab' + (tab === 'templates' ? ' on' : ''), onclick: () => { app.ui.leftTab = 'templates'; leftPanel(app); }}, h('span', {class: 'ic', html: I.comp}), 'Templates'),
    h('button', {class: 'bigtab' + (tab === 'controls' ? ' on' : ''), onclick: () => { app.ui.leftTab = 'controls'; leftPanel(app); }}, h('span', {class: 'ic', html: I.sliders}), 'Controls')));
  if (tab === 'templates') wrap.append(templateBrowser(app)); else wrap.append(controlsPanel(app));
  return wrap;
}
function templateBrowser(app){
  const box = h('div', {style: 'display:flex;flex-direction:column;gap:10px'});
  const q = h('input', {placeholder: `Search ${TEMPLATES.length} templates`, value: app.ui.search || ''});
  const list = h('div', {style: 'display:flex;flex-direction:column;gap:4px'});
  const closed = app.ui.catClosed;
  const allBtn = h('button', {class: 'ib ghost', style: 'font-size:11.5px;padding:0 8px;width:auto;white-space:nowrap'});
  const draw = () => {
    list.innerHTML = '';
    const term = (app.ui.search || '').toLowerCase();
    allBtn.textContent = CATEGORIES.every(([k]) => closed.has(k)) ? 'Expand all' : 'Collapse all';
    for (const [ck, cn] of CATEGORIES){
      const ts = TEMPLATES.filter(t => t.cat === ck && (!term || (t.name + ' ' + cn + ' ' + (t.desc || '')).toLowerCase().includes(term)));
      if (!ts.length) continue;
      // a search always shows its matches; otherwise each group opens and closes on its own
      const open = term ? true : !closed.has(ck), active = ts.some(t => t.id === app.state.template);
      const head = h('button', {class: 'cat-h' + (open ? ' open' : ''), 'aria-expanded': String(open), onclick: () => { if (term) return; closed.has(ck) ? closed.delete(ck) : closed.add(ck); app.saveUi(); draw(); }},
        h('span', {class: 'chev', html: I.chev}), h('span', {class: 'nm'}, cn), active && !open ? h('span', {class: 'dot-on'}) : null, h('span', {class: 'ct'}, String(ts.length)));
      list.append(head);
      if (!open) continue;
      const g = h('div', {class: 'tgrid'});
      ts.forEach(t => {
        const th = h('div', {class: 'th'}, app.thumb(t.id), proTemplate(t) ? h('span', {class: 'badge pro', title: 'Pro template'}, h('span', {html: I.crown}), 'Pro') : t.isNew ? h('span', {class: 'badge'}, 'New') : null);
        g.append(h('div', {class: 'tpl' + (app.state.template === t.id ? ' on' : ''), title: t.desc || t.name, onclick: () => app.selectTemplate(t.id),
          onmouseenter: () => app.hoverThumb(t.id), onmouseleave: () => app.hoverThumb(null)}, th, h('div', {class: 'nm'}, t.name)));
      });
      list.append(g);
    }
    if (!list.children.length) list.append(h('div', {class: 'hint', style: 'padding:20px 4px'}, 'No templates match that search.'));
    else if (!term) list.append(h('div', {class: 'soon-card'}, h('span', {class: 'badge'}, 'Soon'), h('div', {}, h('b', {}, 'New templates coming soon'), h('span', {}, 'Fresh motion is added regularly.'))));
  };
  allBtn.onclick = () => { const shut = !CATEGORIES.every(([k]) => closed.has(k)); CATEGORIES.forEach(([k]) => shut ? closed.add(k) : closed.delete(k)); app.saveUi(); draw(); };
  q.oninput = () => { app.ui.search = q.value; draw(); };
  box.append(h('div', {class: 'row', style: 'gap:6px'}, h('div', {class: 'search', style: 'flex:1', html: I.search}, q), allBtn), list);
  draw();
  return box;
}
function paramControl(app, p){
  const path = 'params.' + p.key;
  if (p.type === 'range'){
    const fmt = v => (p.off && !v) ? 'off' : (p.auto && !v) ? 'auto' : p.percent ? Math.round(v * 100) + '%'
      : p.unit === '°' ? Math.round(v) + '°' : p.unit === '×' ? (p.step >= 1 ? v + '×' : v.toFixed(2) + '×') : p.unit === ' turns' ? (v > 0 ? '+' : '') + v + (Math.abs(v) === 1 ? ' turn' : ' turns')
      : p.unit === 's' ? v.toFixed(2) + 's' : fmtNum(v, p.step);
    const r = slider(app, p.label, path, {min: p.min, max: p.max, step: p.step, fmt});
    if (p.hint) r.title = p.hint;
    return r;
  }
  if (p.type === 'seg') return seg(app, p.label, path, p.options, {rebuild: p.rebuild});
  if (p.type === 'select') return select(app, p.label, path, p.options);
  if (p.type === 'toggle') return toggle(app, p.label, path, {rebuild: true});
  if (p.type === 'color') return color(app, p.label, path);
}
function controlsPanel(app){
  const t = byId(app.state.template), P = app.state.params;
  const box = h('div', {style: 'display:flex;flex-direction:column;gap:6px'});
  const resetAll = h('button', {class: 'ib ghost', title: 'Reset all controls', html: I.reset, onclick: e => { e.stopPropagation(); app.resetParams(); }});
  box.append(h('div', {class: 'row', style: 'padding:0 2px'}, h('div', {style: 'flex:1;font-weight:600;font-size:13px'}, t.name), resetAll));
  if (t.desc) box.append(h('div', {class: 'hint', style: 'padding:0 2px 4px'}, t.desc));
  if (proTemplate(t)){ box.append(proCard(app, 'Signature templates are Pro', 'Preview it as long as you like. Pro unlocks its controls and exports.')); return box; }
  if (t.kind === 'flare'){
    const kids = [];
    for (const p of FLARE_PARAMS){ if (p.group) kids.push(h('div', {class: 'grp-h'}, p.group)); else kids.push(paramControl(app, p)); }
    box.append(section(app, 'c-flare', 'Motion', null, {open: true, flat: true}, ...kids));
  } else {
    const D = defaults(t);
    for (const g of controlGroups(t, P)){
      // the group's full key list, so its reset also covers controls hidden right now
      const keys = (g.id === 'template' ? g.params : (MOD_GROUPS.find(m => m.id === g.id)?.params || g.params)).map(p => p.key).filter(Boolean);
      const changed = keys.some(k => k in D && String(P[k]) !== String(D[k]));
      const reset = h('button', {class: 'ib ghost sm', title: 'Reset ' + g.title, html: I.reset, onclick: e => { e.stopPropagation(); keys.forEach(k => { if (k in D) P[k] = D[k]; }); app.commit(); app.rebuild(); }});
      const kids = g.params.map(p => p.group ? h('div', {class: 'grp-h2'}, p.group) : paramControl(app, p));
      const sec = section(app, 'c-' + g.id, g.title, null, {open: g.id === 'template', flat: true, action: reset}, ...kids);
      if (changed) sec.classList.add('mod');
      box.append(sec);
    }
  }
  const ci = clipInfo(app.state);
  box.append(h('div', {class: 'hint', style: 'margin-top:6px'}, `One loop: ${ci.loop.toFixed(2)}s · clip ${ci.clip.toFixed(1)}s · double-click a value to type it · Shift-drag for fine control.`));
  return box;
}

/* ---------- left: media ---------- */
function mediaPanel(app){
  const st = app.state, box = h('div', {class: 'lp'}), L = st.media.images, nv = L.filter(m => m.kind === 'video').length;
  box.append(h('div', {style: 'font-weight:600;font-size:13px;padding:2px'}, 'Media'));
  // your media: uploads and library picks, images and videos
  const grid = h('div', {class: 'media-grid'});
  L.forEach((m, i) => {
    const url = app.thumbUrls.get(m.id), vid = m.kind === 'video', ok = app.images.has(m.id);
    const it = h('div', {class: 'mitem ph-no-capture' + (ok ? '' : ' missing'), draggable: true, title: (m.name || '') + (ok ? '' : ' — not found in this browser')},
      url ? h('img', {src: url, alt: m.name || '', loading: 'lazy'}) : h('span', {class: 'miss'}, ok ? '' : 'Missing'),
      vid ? h('span', {class: 'mbadge'}, h('span', {html: I.vplay}), m.dur ? fmtDur(m.dur) : 'Video') : null,
      h('button', {html: I.x, title: 'Remove', 'aria-label': 'Remove ' + (m.name || 'item'), onclick: e => { e.stopPropagation(); app.removeImage(m.id); }}));
    it.ondragstart = e => { e.dataTransfer.setData('text/x-ac', String(i)); it.classList.add('drag'); };
    it.ondragend = () => it.classList.remove('drag');
    it.ondragover = e => e.preventDefault();
    it.ondrop = e => { e.preventDefault(); e.stopPropagation(); const from = +e.dataTransfer.getData('text/x-ac'); if (!isNaN(from)) app.moveImage(from, i); };
    grid.append(it);
  });
  const count = L.length ? [L.length - nv ? `${L.length - nv} image${L.length - nv > 1 ? 's' : ''}` : '', nv ? `${nv} video${nv > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') : '';
  box.append(section(app, 'm-yours', 'Your media', L.length ? `${count} — drag to reorder` : 'Images and videos, used on every template', {open: true,
      action: h('button', {class: 'ib ghost', title: 'Add images or videos', html: I.plus, onclick: e => { e.stopPropagation(); $('fileImgs').click(); }})},
    h('div', {class: 'dropzone', onclick: () => $('fileImgs').click()}, 'Drop images or videos here, or click to upload'),
    L.length ? grid : null,
    L.length ? h('button', {class: 'ib', style: 'width:100%', onclick: () => app.clearImages()}, 'Remove all') : null));
  box.append(seg(app, 'Order', 'media.order', {in: 'In order', scatter: 'Scatter'}));
  if (st.media.order === 'scatter') box.append(row('', h('button', {class: 'ib', style: 'flex:1', html: I.shuffle + ' Reshuffle', onclick: () => { app.set('media.seed', (st.media.seed || 1) + 1); app.commit(); }})));
  box.append(libraryPanel(app));
  // the bundled photo set, shown whenever you haven't added media of your own
  const built = h('div', {class: 'media-grid'});
  for (let i = 1; i <= MEDIA_SETS.photos.count; i++) built.append(h('div', {class: 'mitem', style: 'cursor:default'}, h('img', {src: new URL(`../media/photo-${String(i).padStart(2, '0')}.jpg`, import.meta.url).href, alt: '', loading: 'lazy'})));
  box.append(section(app, 'm-sets', 'Built-in photos', L.length ? 'Shown again if you remove your media' : `${MEDIA_SETS.photos.count} photos on every template`, {open: false}, built));
  return box;
}
// The AlignCanvas library (media/library/manifest.json): search, tags, pick several, add them in one go.
// Thumbnails load lazily and the grid grows a page at a time, so a large library stays quick.
const LIB_PAGE = 48;
function libraryPanel(app){
  const u = app.ui, body = h('div', {style: 'display:flex;flex-direction:column;gap:8px'});
  u.libSel = u.libSel || new Map();
  const sec = section(app, 'm-lib', 'Library', app.lib ? (app.lib.length ? `${app.lib.length} images from AlignCanvas` : 'Nothing here yet') : 'Images from AlignCanvas', {open: true}, body);
  if (!app.lib){
    body.append(h('div', {class: 'hint', style: 'padding:6px 2px'}, 'Loading the library…'));
    library().then(items => { app.lib = items; if (app.ui.rail === 'media') app.rebuild(); });
    return sec;
  }
  if (!app.lib.length){ body.append(h('div', {class: 'hint', style: 'padding:6px 2px'}, 'The library is empty right now. Check back soon.')); return sec; }
  const tags = [...new Set(app.lib.flatMap(i => i.tags))].sort();
  const used = new Set(app.state.media.images.filter(m => m.lib).map(m => m.lib));
  const q = h('input', {placeholder: 'Search the library', value: u.libQ || '', 'aria-label': 'Search the library'});
  const chips = tags.length ? h('div', {class: 'chips lib-tags'}) : null;
  const grid = h('div', {class: 'lib-grid'}), more = h('button', {class: 'ib', style: 'width:100%'});
  const bar = h('div', {class: 'lib-bar'}), addBtn = h('button', {class: 'btn-primary', style: 'flex:1;justify-content:center'}), clr = h('button', {class: 'ib', title: 'Clear selection'}, 'Clear');
  bar.append(addBtn, clr);
  const sync = () => { const n = u.libSel.size; bar.style.display = n ? 'flex' : 'none'; addBtn.textContent = `Add ${n} to project`; };
  const draw = () => {
    const term = (u.libQ || '').trim().toLowerCase();
    const list = app.lib.filter(i => (!u.libTag || i.tags.includes(u.libTag)) && (!term || (i.name + ' ' + i.tags.join(' ')).toLowerCase().includes(term)));
    grid.innerHTML = '';
    list.slice(0, u.libN || LIB_PAGE).forEach(i => {
      const b = h('button', {class: 'litem' + (u.libSel.has(i.src) ? ' picked' : '') + (used.has(i.src) ? ' in' : ''), title: i.name + (used.has(i.src) ? ' · in your media' : ''), 'aria-pressed': String(u.libSel.has(i.src)),
        onclick: () => { u.libSel.has(i.src) ? u.libSel.delete(i.src) : u.libSel.set(i.src, i); b.classList.toggle('picked'); b.setAttribute('aria-pressed', String(u.libSel.has(i.src))); sync(); },
        ondblclick: () => { u.libSel.delete(i.src); sync(); app.addLibrary([i]); }},
        h('img', {src: libUrl(i.thumb || i.src), alt: i.name, loading: 'lazy', decoding: 'async'}),
        i.kind === 'video' ? h('span', {class: 'mbadge'}, h('span', {html: I.vplay}), 'Video') : null,
        h('span', {class: 'ck', html: I.check}));
      grid.append(b);
    });
    if (!list.length) grid.append(h('div', {class: 'hint', style: 'grid-column:1/-1;padding:8px 2px'}, 'Nothing matches that search.'));
    more.style.display = list.length > (u.libN || LIB_PAGE) ? '' : 'none';
    more.textContent = `Show more (${list.length - (u.libN || LIB_PAGE)})`;
    chips?.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', (c.dataset.t || '') === (u.libTag || '')));
  };
  if (chips) ['', ...tags].forEach(t => chips.append(h('button', {class: 'chip', 'data-t': t, onclick: () => { u.libTag = t; u.libN = LIB_PAGE; draw(); }}, t || 'All')));
  q.oninput = () => { u.libQ = q.value; u.libN = LIB_PAGE; draw(); };
  more.onclick = () => { u.libN = (u.libN || LIB_PAGE) + LIB_PAGE; draw(); };
  addBtn.onclick = async () => { const items = [...u.libSel.values()]; u.libSel.clear(); sync(); addBtn.disabled = true; await app.addLibrary(items); addBtn.disabled = false; };
  clr.onclick = () => { u.libSel.clear(); grid.querySelectorAll('.picked').forEach(b => b.classList.remove('picked')); sync(); };
  if (app.lib.length > 8) body.append(h('div', {class: 'search', html: I.search}, q));
  if (chips && tags.length > 1) body.append(chips);
  body.append(h('div', {class: 'hint'}, 'Click to select, double-click to add one straight away.'), grid, more, bar);
  draw(); sync();
  return sec;
}

/* ---------- left: text ---------- */
function textPanel(app){
  const box = h('div', {class: 'lp'}), st = app.state;
  box.append(h('div', {style: 'font-weight:600;font-size:13px;padding:2px'}, 'Text'));
  box.append(section(app, 't-title', 'Title', 'Large text in the middle of the frame', {open: true, toggle: 'style.title.on'},
    text(app, 'Text', 'style.title.text'),
    select(app, 'Font', 'style.title.font', Object.fromEntries(B.brandFonts(B.loadBrand()).map(f => [f, f]))),
    seg(app, 'Weight', 'style.title.weight', {'400': 'Regular', '600': 'Semibold', '700': 'Bold'}),
    slider(app, 'Size', 'style.title.size', {min: .3, max: 3, step: .01}),
    slider(app, 'Position', 'style.title.y', {min: .1, max: .9, step: .005, percent: true}),
    color(app, 'Colour', 'style.title.color')));
  box.append(section(app, 't-labels', 'Corner labels', 'Four small captions on the frame', {open: true, toggle: 'style.labels.on'},
    text(app, 'Top left', 'style.labels.tl'), toggle(app, 'Logo mark', 'style.labels.mark'),
    text(app, 'Top right', 'style.labels.tr'), text(app, 'Bottom left', 'style.labels.bl'), text(app, 'Bottom right', 'style.labels.br'),
    slider(app, 'Size', 'style.labels.size', {min: .5, max: 2.5, step: .01}),
    seg(app, 'Colour', 'style.labels.color', {auto: 'Auto', '#ffffff': 'White', '#111111': 'Black'})));
  // your logo, from the brand kit (Pro)
  const brand = B.loadBrand(), Lg = st.style.logo, logoWhy = {title: 'Your logo is a Pro feature', body: 'Pro puts your logo on every template, in any corner, and can animate it in and out.'};
  const logoKids = !brand.logo && !Lg.id
    ? [h('div', {class: 'hint', style: 'line-height:1.5'}, 'Add your logo once and it’s ready on every template.'),
      h('button', {class: 'ib', style: 'width:100%', onclick: () => app.pickLogo()}, limited() ? h('span', {class: 'crown', html: I.crown}) : h('span', {html: I.upload}), 'Upload logo')]
    : [select(app, 'Position', 'style.logo.pos', {tl: 'Top left', tr: 'Top right', center: 'Centre', bl: 'Bottom left', br: 'Bottom right'}),
      slider(app, 'Size', 'style.logo.size', {min: .04, max: .6, step: .005, percent: true}),
      slider(app, 'Opacity', 'style.logo.opacity', {min: .1, max: 1, step: .01, percent: true}),
      h('button', {class: 'ib', style: 'width:100%', onclick: () => app.pickLogo()}, h('span', {html: I.upload}), 'Replace logo')];
  box.append(section(app, 't-logo', 'Logo', 'Your logo on the frame', {open: true, pro: limited(), action: proToggleEl(app, 'style.logo.on', {rebuild: true, label: 'Logo'}, logoWhy)}, ...logoKids));
  box.append(h('div', {class: 'hint', style: 'padding:4px 2px;line-height:1.6'}, 'To animate the title, labels and logo, switch on “Animate text and logo” in Export → Output.'));
  return box;
}

/* ---------- brand kit (Pro) ---------- */
function brandSection(app){
  const b = B.loadBrand(), lock = limited(), why = {title: 'The brand kit is a Pro feature', body: 'Pro saves your colours, fonts and logo, and puts them on any template in one click.'};
  const save = () => { B.saveBrand(b); rightPanel(app); };
  const sw = h('div', {class: 'brand-sw'});
  b.colors.forEach((c, i) => {
    const inp = h('input', {type: 'color', value: c, 'aria-label': 'Brand colour ' + (i + 1)});
    inp.onchange = () => { b.colors[i] = inp.value; save(); };
    sw.append(h('div', {class: 'bsw'}, inp, h('button', {class: 'bx', title: 'Remove colour', html: I.x, onclick: () => { b.colors.splice(i, 1); save(); }})));
  });
  if (b.colors.length < 5) sw.append(h('button', {class: 'ib ghost sm add', title: 'Add a colour', html: I.plus, onclick: () => { b.colors.push(b.colors.length ? '#ffffff' : app.state.style.bg.c[0]); save(); }}));
  const fonts = Object.fromEntries([['', 'Template default'], ...B.brandFonts(b).map(f => [f, f])]);
  const fsel = (label, key) => { const s = h('select', {class: 'sel'}); for (const k in fonts) s.append(h('option', {value: k, selected: b[key] === k}, fonts[k])); s.onchange = () => { b[key] = s.value; save(); }; return row(label, s); };
  const logoThumb = b.logo ? h('img', {class: 'blogo', alt: 'Your logo', src: ''}) : null;
  if (logoThumb) app.logoUrl(b.logo).then(u => { if (u) logoThumb.src = u; });
  const body = h('div', {class: lock ? 'locked' : '', inert: lock},
    row('Colours', sw),
    fsel('Headings', 'head'), fsel('Labels', 'body'),
    h('div', {class: 'row'}, h('label', {}, 'Logo'), h('div', {class: 'ctl', style: 'gap:8px'}, logoThumb,
      h('button', {class: 'ib sm', onclick: () => app.pickLogo(true)}, h('span', {html: I.upload}), b.logo ? 'Replace' : 'Upload'),
      b.logo ? h('button', {class: 'ib ghost sm', title: 'Remove logo', html: I.trash, onclick: () => { b.logo = ''; save(); }}) : null)),
    h('button', {class: 'ib', style: 'width:100%', onclick: () => app.pickFont()}, h('span', {html: I.upload}), 'Upload a font (TTF, OTF, WOFF)'),
    h('button', {class: 'btn-primary', style: 'width:100%;justify-content:center', onclick: () => app.applyBrandKit()}, 'Apply to this project'));
  return section(app, 'v-brand', 'Brand kit', 'Your colours, fonts and logo', {pro: lock, isNew: !lock},
    lock ? proCard(app, why.title, why.body) : null, body);
}

/* ---------- left: project ---------- */
const when = t => { const d = new Date(t), now = new Date(), day = 864e5, tm = d.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  if (d.toDateString() === now.toDateString()) return 'Today ' + tm;
  if (d.toDateString() === new Date(now - day).toDateString()) return 'Yesterday, ' + tm;
  return d.toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'}); };
function projectPanel(app){
  const box = h('div', {class: 'lp'}), named = !!app.projectId;
  box.append(h('div', {style: 'font-weight:600;font-size:13px;padding:2px'}, 'Project'));
  box.append(h('div', {class: 'row', style: 'gap:6px'},
    h('button', {class: 'btn-primary', style: 'flex:1;justify-content:center', onclick: () => app.saveNamed()}, h('span', {html: I.save}), 'Save project'),
    h('button', {class: 'ib', style: 'flex:1', onclick: () => app.saveAs()}, 'Save as…')));
  box.append(h('div', {class: 'hint', style: 'padding:0 2px'}, named ? 'Open from My projects. Changes save automatically.' : 'This is a draft: it autosaves here, but isn’t in My projects yet.'));
  // my projects
  const list = h('div', {class: 'plist'});
  if (!app.projList){ list.append(h('div', {class: 'hint', style: 'padding:6px 2px'}, 'Loading…')); app.refreshProjects(); }
  else if (!app.projList.length) list.append(h('div', {class: 'hint', style: 'padding:6px 2px;line-height:1.5'}, 'No saved projects yet. Save project keeps this one here with its settings, images and videos, so you can come back to it.'));
  else app.projList.forEach(p => {
    const nm = h('div', {class: 'pn'}, p.name), cur = p.id === app.projectId, th = app.projThumbs.get(p.id);
    const rename = () => {
      const inp = h('input', {class: 'txt', value: p.name, maxlength: 80, 'aria-label': 'Project name'});
      nm.replaceWith(inp); inp.focus(); inp.select();
      let done = false; const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== p.name) app.renameNamed(p.id, v); else inp.replaceWith(nm); };
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); };
      inp.onclick = e => e.stopPropagation(); inp.onblur = () => fin(true);
    };
    const act = (ic, title, fn) => h('button', {class: 'ib ghost sm', title, 'aria-label': title + ' ' + p.name, html: ic, onclick: e => { e.stopPropagation(); fn(); }});
    list.append(h('div', {class: 'pitem' + (cur ? ' on' : ''), role: 'button', tabindex: 0, title: cur ? 'Open now' : 'Open ' + p.name,
        onclick: () => { if (!cur) app.openNamed(p.id); }, onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget && !cur) app.openNamed(p.id); }},
      h('div', {class: 'pt ph-no-capture'}, th ? h('img', {src: th.url, alt: ''}) : null),
      h('div', {class: 'pm'}, nm, h('div', {class: 'pd'}, cur ? h('span', {class: 'badge'}, 'Open') : null, p.cloud ? h('span', {class: 'cloud-tag', html: I.cloud}) : null, when(p.updated) + (p.count ? ` · ${p.count} item${p.count > 1 ? 's' : ''}` : ''))),
      h('div', {class: 'pa'}, h('button', {class: 'ib ghost sm cloudb' + (p.cloud ? ' on' : ''), title: p.cloud ? 'Synced to the cloud. Click to stop syncing.' : 'Sync to the cloud', 'aria-label': (p.cloud ? 'Stop syncing ' : 'Sync ') + p.name, html: I.cloud, onclick: e => { e.stopPropagation(); app.toggleCloud(p.id); }}), act(I.pen, 'Rename', rename), act(I.copy, 'Duplicate', () => app.duplicateNamed(p.id)), act(I.trash, 'Delete', () => app.deleteNamed(p.id)))));
  });
  const nc = app.projList?.filter(p => p.cloud).length || 0;
  box.append(section(app, 'p-mine', 'My projects', app.projList?.length ? `${app.projList.length} saved` + (nc ? `, ${nc} synced to the cloud` : ' in this browser') : 'Saved in this browser', {open: true}, list));
  // cloud projects from your other devices that aren't in this browser yet
  if (app.cloudOnly?.length){
    const cl = h('div', {class: 'plist'});
    app.cloudOnly.forEach(c => cl.append(h('div', {class: 'pitem', role: 'button', tabindex: 0, title: 'Open ' + c.name, onclick: () => app.openCloud(c.id), onkeydown: e => { if (e.key === 'Enter') app.openCloud(c.id); }},
      h('div', {class: 'pt ph-no-capture'}, c.thumb ? h('img', {src: c.thumb, alt: ''}) : null),
      h('div', {class: 'pm'}, h('div', {class: 'pn'}, c.name), h('div', {class: 'pd'}, h('span', {class: 'cloud-tag', html: I.cloud}), when(c.updated))))));
    box.append(section(app, 'p-cloud', 'In the cloud', 'From your other devices', {open: true}, cl));
  }
  box.append(section(app, 'p-file', 'Project file', 'Move a project to another browser', {},
    h('button', {class: 'ib', style: 'width:100%;justify-content:flex-start', onclick: () => $('fileProj').click()}, 'Open project file…'),
    h('button', {class: 'ib', style: 'width:100%;justify-content:flex-start', onclick: () => app.saveProject()}, 'Save project file'),
    h('div', {class: 'hint'}, 'Files include settings and images. Videos aren’t included.')));
  box.append(h('button', {class: 'ib', style: 'width:100%;justify-content:flex-start', onclick: () => app.newProject()}, 'New project'));
  box.append(section(app, 'p-opts', 'Options', null, {open: true},
    row('Keep my look', h('div', {class: 'hint', style: 'flex:1'}, 'when switching templates'), toggleEl(app, 'keepStyle')),
    seg(app, 'Preview', 'frame.preview', {draft: 'Draft', auto: 'Sharp', max: 'Max'})));
  box.append(h('div', {class: 'hint', style: 'margin-top:6px;line-height:1.6'}, currentUser() ? 'Projects stay in this browser unless you sync one to the cloud (the cloud button on a project). Everything renders locally with WebGL.' : 'Projects stay in this browser. Sign in to sync a project to the cloud and open it on any device. Everything renders locally with WebGL.'));
  return box;
}

/* ---------- right: visual + export ---------- */
export function rightPanel(app){
  const el = $('right'); el.innerHTML = '';
  const box = h('div', {class: 'rp'});
  const tab = app.ui.rightTab;
  box.append(h('div', {class: 'tabs'},
    h('button', {class: tab === 'visual' ? 'on' : '', onclick: () => { app.ui.rightTab = 'visual'; rightPanel(app); }}, 'Visual'),
    h('button', {class: tab === 'export' ? 'on' : '', onclick: () => { app.ui.rightTab = 'export'; rightPanel(app); }}, 'Export')));
  if (tab === 'visual'){
    if (proTemplate(byId(app.state.template))){
      box.append(proCard(app, 'Signature templates are Pro', 'Its look, camera and effects open with Pro.'));
      const rest = h('div', {class: 'locked', inert: true}); visualPanel(app, rest); box.append(rest);
    } else visualPanel(app, box);
  } else exportPanel(app, box);
  el.append(box);
}
const pct = {percent: true};
function visualPanel(app, box){
  const st = app.state;
  // looks
  const presets = h('div', {class: 'presets'});
  const pvBg = {clean: 'linear-gradient(135deg,#f4f4f6,#dcdde3)', liquid: 'linear-gradient(90deg,#7ef9ff,#ffffff 30%,#ffffff 70%,#ff9cf3)', prism: 'conic-gradient(from 90deg,#ff5f6d,#ffc371,#43e97b,#38f9d7,#7b2ff7,#ff5f6d)',
    frosted: 'radial-gradient(circle at 50% 50%,#ffffff,#cfd8ff)', noir: 'linear-gradient(135deg,#000,#3a3a40)', holo: 'linear-gradient(120deg,#c8f7ff,#f9d1ff,#fff6c8,#c8ffe0)',
    dreamy: 'linear-gradient(135deg,#ffd6e7,#cfe6ff,#ffe9c7)', film: 'linear-gradient(135deg,#3d3328,#8a7356)', neon: 'linear-gradient(135deg,#05050a,#ff2bd6,#3b5bff)'};
  for (const k in STYLE_PRESETS) presets.append(h('button', {class: 'preset', onclick: () => app.applyPreset(k)}, h('div', {class: 'pv', style: `background:${pvBg[k]}`}), STYLE_PRESETS[k].name));
  box.append(section(app, 'v-styles', 'Styles', 'One-click looks', {open: true, isNew: true}, presets));
  box.append(brandSection(app));

  // background
  const bg = st.style.bg;
  const pals = h('div', {class: 'swatches'});
  BG_PALETTES.forEach(pl => pals.append(h('button', {class: 'swatch' + (pl.join() === bg.c.join() ? ' on' : ''), title: 'Palette', onclick: () => { app.set('style.bg.c', pl.slice()); app.commit(); rightPanel(app); }}, ...pl.map(c => h('i', {style: `background:${c}`})))));
  const modes = {solid: 'Solid', linear: 'Linear', radial: 'Radial', mesh: 'Mesh', aurora: 'Aurora', grid: 'Grid', dots: 'Dots', holo: 'Holo', spotlight: 'Spotlight', plasma: 'Plasma'};
  const used = {solid: 1, linear: 2, radial: 2, mesh: 4, aurora: 4, grid: 3, dots: 3, holo: 1, spotlight: 2, plasma: 3}[bg.mode] || 1;
  box.append(section(app, 'v-bg', 'Background', bg.transparent ? 'Transparent' : modes[bg.mode], {open: true},
    select(app, 'Type', 'style.bg.mode', modes, {rebuild: true}),
    row('Palette', pals),
    ...Array.from({length: used}, (_, i) => color(app, ['Base', 'Colour 2', 'Colour 3', 'Colour 4'][i], 'style.bg.c.' + i)),
    ['mesh', 'aurora', 'holo', 'plasma'].includes(bg.mode) ? slider(app, 'Motion', 'style.bg.cycles', {min: 1, max: 4, step: 1, fmt: v => v + '× per loop'}) : null,
    ['radial', 'mesh', 'grid', 'dots', 'plasma'].includes(bg.mode) ? slider(app, 'Scale', 'style.bg.scale', {min: .3, max: 3, step: .01}) : null,
    ['aurora', 'grid', 'dots', 'holo', 'spotlight'].includes(bg.mode) ? slider(app, 'Intensity', 'style.bg.amt', {min: 0, max: 2, step: .01}) : null,
    bg.mode === 'linear' ? slider(app, 'Angle', 'style.bg.angle', {min: 0, max: 6.28, step: .01, fmt: v => Math.round(v * 57.3) + '°'}) : null,
    toggle(app, 'Transparent', 'style.bg.transparent', {rebuild: true})));

  // cards
  box.append(section(app, 'v-cards', 'Cards', 'Shape and finish', {},
    select(app, 'Aspect', 'style.card.aspect', {auto: 'Template default', '1:1': '1 : 1', '4:5': '4 : 5', '3:4': '3 : 4', '2:3': '2 : 3', '9:16': '9 : 16', '16:9': '16 : 9', '8:5': '8 : 5'}),
    slider(app, 'Corners', 'style.card.radius', {min: 0, max: .5, step: .005, ...pct}),
    slider(app, 'Rim light', 'style.card.border', {min: 0, max: 1, step: .01, ...pct}),
    slider(app, 'Brightness', 'style.card.brightness', {min: .3, max: 1.6, step: .01, ...pct}),
    slider(app, 'Opacity', 'style.card.opacity', {min: 0, max: 1, step: .01, ...pct}),
    seg(app, 'Back side', 'style.card.back', {mirror: 'Mirrored', solid: 'Solid'}),
    color(app, 'Back colour', 'style.card.backColor'),
    color(app, 'Tint', 'style.card.tint'), slider(app, 'Tint amount', 'style.card.tintA', {min: 0, max: 1, step: .01, ...pct})));
  box.append(section(app, 'v-shadow', 'Shadow', 'Drop shadow', {toggle: 'style.shadow.on'},
    slider(app, 'Opacity', 'style.shadow.alpha', {min: 0, max: 1, step: .01, ...pct}), slider(app, 'Softness', 'style.shadow.soft', {min: .02, max: .6, step: .01, ...pct}),
    slider(app, 'Offset', 'style.shadow.offset', {min: 0, max: .4, step: .005, ...pct}), color(app, 'Colour', 'style.shadow.color')));
  box.append(section(app, 'v-shade', 'Shade', 'Edge shading and glare', {toggle: 'style.shade.on'},
    slider(app, 'Shading', 'style.shade.amount', {min: 0, max: 1, step: .01, ...pct}), slider(app, 'Glare', 'style.shade.glare', {min: 0, max: 2, step: .01, ...pct}),
    toggle(app, 'Glare sweep', 'style.shade.sweep')));
  box.append(section(app, 'v-blur', 'Blur', 'Depth of field and edge blur', {toggle: 'style.blur.on'},
    slider(app, 'Depth blur', 'style.blur.depth', {min: 0, max: 1.5, step: .01, ...pct}), slider(app, 'Focus', 'style.blur.focus', {min: -3, max: 3, step: .01}),
    slider(app, 'Edge blur', 'style.blur.edge', {min: 0, max: 1, step: .01, ...pct})));
  const g = st.style.glass;
  box.append(section(app, 'v-glass', 'Glass', 'Liquid-glass edge distortion', {toggle: 'style.glass.on', isNew: true},
    seg(app, 'Edges', 'style.glass.mode', {all: 'All', per: 'Per edge'}, {rebuild: true}),
    ...(g.mode === 'all' ? [slider(app, 'Amount', 'style.glass.amount', {min: 0, max: 1, step: .01, ...pct})]
      : ['top', 'bottom', 'left', 'right'].map(k => slider(app, k[0].toUpperCase() + k.slice(1), 'style.glass.' + k, {min: 0, max: 1, step: .01, fmt: v => v ? Math.round(v * 100) + '%' : 'off'}))),
    slider(app, 'Width', 'style.glass.width', {min: .03, max: .6, step: .01, ...pct}), slider(app, 'Smear', 'style.glass.refraction', {min: 0, max: 1.5, step: .01, ...pct}),
    slider(app, 'Stretch', 'style.glass.stretch', {min: 0, max: 6, step: .05, fmt: v => v.toFixed(2)}),
    slider(app, 'Bulge', 'style.glass.bulge', {min: 0, max: 2, step: .01, ...pct}),
    seg(app, 'Curve', 'style.glass.curve', {panel: 'Panel', lens: 'Lens', wave: 'Wave'}),
    slider(app, 'Dispersion', 'style.glass.dispersion', {min: 0, max: 1.5, step: .01, ...pct}), slider(app, 'Soften', 'style.glass.soften', {min: 0, max: 1, step: .01, ...pct}),
    slider(app, 'Feather', 'style.glass.feather', {min: 0, max: 1, step: .01, ...pct}), slider(app, 'Haze', 'style.glass.highlight', {min: 0, max: 1, step: .01, ...pct})));
  box.append(section(app, 'v-cglass', 'Card glass', 'Refraction on each card’s rim', {toggle: 'style.cardGlass.on'},
    slider(app, 'Width', 'style.cardGlass.width', {min: .02, max: 1, step: .01, ...pct}), slider(app, 'Refraction', 'style.cardGlass.refraction', {min: 0, max: 1.5, step: .01, ...pct}),
    slider(app, 'Dispersion', 'style.cardGlass.dispersion', {min: 0, max: 1.5, step: .01, ...pct})));
  const L = st.style.lens;
  box.append(section(app, 'v-lens', 'Liquid lens', L.mode === 'hole' ? 'Black hole' : 'A floating glass lens', {toggle: 'style.lens.on', isNew: true},
    seg(app, 'Type', 'style.lens.mode', {glass: 'Glass', hole: 'Black hole'}, {rebuild: true}),
    L.mode === 'glass' ? seg(app, 'Shape', 'style.lens.shape', {pill: 'Pill', circle: 'Circle', square: 'Squircle'}) : null,
    select(app, 'Motion', 'style.lens.motion', {static: 'Static', drift: 'Drift', sweep: 'Sweep', orbit: 'Orbit'}),
    slider(app, 'Position X', 'style.lens.x', {min: 0, max: 1, step: .005, ...pct}), slider(app, 'Position Y', 'style.lens.y', {min: 0, max: 1, step: .005, ...pct}),
    slider(app, L.mode === 'hole' ? 'Size' : 'Width', 'style.lens.w', {min: .05, max: 1.6, step: .005, ...pct}),
    L.mode === 'glass' && L.shape !== 'circle' ? slider(app, 'Height', 'style.lens.h', {min: .05, max: 1, step: .005, ...pct}) : null,
    slider(app, L.mode === 'hole' ? 'Swirl' : 'Refraction', 'style.lens.refraction', {min: 0, max: 1.5, step: .01, ...pct}),
    slider(app, 'Frost', 'style.lens.frost', {min: 0, max: 1, step: .01, ...pct}),
    L.mode === 'glass' ? slider(app, 'Dispersion', 'style.lens.dispersion', {min: 0, max: 1.5, step: .01, ...pct}) : null,
    L.mode === 'glass' ? slider(app, 'Bevel', 'style.lens.bevel', {min: .05, max: 1, step: .01, ...pct}) : null,
    L.mode === 'glass' ? slider(app, 'Magnify', 'style.lens.magnify', {min: -.3, max: .4, step: .005, ...pct}) : null,
    slider(app, 'Highlight', 'style.lens.highlight', {min: 0, max: 1.5, step: .01, ...pct}),
    L.mode === 'glass' ? slider(app, 'Shadow', 'style.lens.shadow', {min: 0, max: 1.5, step: .01, ...pct}) : null,
    L.mode === 'glass' ? color(app, 'Tint', 'style.lens.tint') : null,
    L.mode === 'glass' ? slider(app, 'Tint amount', 'style.lens.tintA', {min: 0, max: 1, step: .01, ...pct}) : null));
  box.append(section(app, 'v-cam', 'Camera', 'Perspective and movement', {},
    slider(app, 'Perspective', 'style.camera.fov', {min: 10, max: 75, step: .5, fmt: v => Math.round(v) + '°'}),
    slider(app, 'Zoom', 'style.camera.zoom', {min: .4, max: 2.5, step: .01, fmt: v => v.toFixed(2) + '×'}),
    slider(app, 'Orbit', 'style.camera.orbit', {min: -1.5, max: 1.5, step: .01, fmt: v => Math.round(v * 57.3) + '°'}),
    slider(app, 'Tilt', 'style.camera.tilt', {min: -1, max: 1, step: .01, fmt: v => Math.round(v * 57.3) + '°'}),
    slider(app, 'Drift', 'style.camera.drift', {min: 0, max: .6, step: .01, ...pct})));
  box.append(section(app, 'v-fx', 'Effects', 'Finishing touches', {},
    slider(app, 'Grain', 'style.fx.grain', {min: 0, max: 1, step: .01, ...pct}), slider(app, 'Vignette', 'style.fx.vignette', {min: 0, max: 1, step: .01, ...pct}),
    slider(app, 'Bloom', 'style.fx.bloom', {min: 0, max: 1.5, step: .01, ...pct}), slider(app, 'Chromatic', 'style.fx.chroma', {min: 0, max: 1.5, step: .01, ...pct}),
    slider(app, 'Contrast', 'style.fx.contrast', {min: .5, max: 1.6, step: .01, ...pct}), slider(app, 'Saturation', 'style.fx.saturation', {min: 0, max: 2, step: .01, ...pct}),
    slider(app, 'Exposure', 'style.fx.exposure', {min: .4, max: 1.8, step: .01, ...pct})));
}

// a card that explains a Pro lock, with Get Pro
export function proCard(app, title, text){
  return h('div', {class: 'pro-card'}, h('div', {class: 'pc-t'}, h('span', {class: 'crown', html: I.crown}), title), h('div', {class: 'hint'}, text),
    h('button', {class: 'btn-primary', onclick: () => app.getPro()}, PAYMENTS ? 'Get Pro' : 'Pro opens soon'));
}
const RES = {480: '480', 720: '720', 1080: '1080', 1440: '1440', 2160: '4K'};
const IMG_RES = {1080: '1080', 1440: '1440', 2160: '4K', 3240: '6K', 4320: '8K'};
function exportPanel(app, box){
  const st = app.state, ex = st.export, asp = st.frame.aspect, busy = app.exporting;
  // on the free plan, settings left on a Pro value (the defaults, or from the launch week) drop to the free maximum
  if (limited()){
    if (+ex.res > FREE_MAX) ex.res = FREE_MAX;
    if (+ex.fps > FREE_FPS) ex.fps = FREE_FPS;
    if (+ex.scale > FREE_IMG_MAX) ex.scale = FREE_IMG_MAX;
  }
  const pro = what => k => app.proNeeded(what(k));
  const tplLocked = proTemplate(byId(st.template)), left = exportsLeft(), noneLeft = left <= 0, stop = busy || tplLocked || noneLeft;
  if (tplLocked) box.append(proCard(app, 'Exporting Signature templates is Pro', 'Pick any other template to export it on the free plan.'));
  else if (noneLeft) box.append(proCard(app, `You’ve used your ${FREE_EXPORTS} free exports`, 'Go Pro for unlimited exports in 4K at 60 and 120 fps, plus your brand kit, animated text and logo, and social presets.'));
  else if (left !== Infinity) box.append(h('div', {class: 'free-left'}, h('b', {}, `${left} of ${FREE_EXPORTS}`), ' free exports left', h('button', {class: 'lnk', onclick: () => app.getPro()}, 'Go unlimited')));
  const dims = s => sizeFor(asp, s).join('×');
  const ci = clipInfo(st), gif = ex.format === 'gif';
  const prog = h('div', {class: 'progress', style: 'display:none'}, h('i'));
  // Duration: drag to set the clip length; "Auto" is exactly one loop of the template
  const dur = slider(app, 'Duration', 'export.duration', {min: .5, max: 60, step: .1, fmt: v => (v ? v : ci.loop).toFixed(1) + 's' + (v ? '' : ' · auto')});
  const autoBtn = h('button', {class: 'ib ghost sm', title: 'One loop of the template', onclick: () => { app.set('export.duration', 0); app.commit(); app.rebuild(); }}, 'Auto');
  dur.querySelector('.ctl').append(autoBtn);
  dur.querySelector('.sl').addEventListener('pointerup', () => setTimeout(() => app.rebuild(), 0));
  const fpsOpts = gif ? {15: '15', 20: '20', 25: '25', 50: '50'} : {24: '24', 30: '30', 60: '60', 120: '120'};
  const fpsPath = gif ? 'export.gifFps' : 'export.fps', fps = gif ? ex.gifFps : ex.fps;
  const [W, H] = gif ? (() => { const [a, b] = ASPECTS[asp]; return [+ex.gifWidth, Math.round(ex.gifWidth * b / a / 2) * 2]; })() : sizeFor(asp, +ex.res);
  const note = ex.seamless && Math.abs(ci.rate - 1) > .005 ? `Motion runs at ${ci.rate.toFixed(2)}× so ${ci.loops} loop${ci.loops > 1 ? 's' : ''} fit exactly.` : ex.seamless ? `${ci.loops} full loop${ci.loops > 1 ? 's' : ''}, ends where it starts.` : `${ci.loops.toFixed(2)} loops; the end won't match the start.`;
  // social presets (Pro): one click sets the frame, size and frame rate, and shows the platform's safe zones
  const soc = h('div', {class: 'social'});
  for (const k in app.social) { const p = app.social[k], [a, b] = ASPECTS[p.aspect];
    soc.append(h('button', {class: 'soc' + (st.frame.social === k ? ' on' : ''), onclick: () => app.applySocial(k)},
      h('i', {style: `aspect-ratio:${a}/${b}`}), h('span', {}, p.name), h('small', {}, p.aspect))); }
  box.append(section(app, 'e-social', 'Social presets', st.frame.social ? app.social[st.frame.social]?.name : 'The right size for each platform', {open: !st.frame.social, pro: limited(), isNew: !limited()},
    soc, st.frame.zone ? toggle(app, 'Safe zone guides', 'frame.zoneShow', {rebuild: true}) : null));
  box.append(h('div', {class: 'xh'}, 'Video'));
  box.append(section(app, 'e-out', 'Output', null, {open: true},
    gif ? select(app, 'Width', 'export.gifWidth', {320: '320 px', 480: '480 px', 640: '640 px', 800: '800 px', 1080: '1080 px'}, {rebuild: true})
      : seg(app, 'Resolution', 'export.res', RES, {rebuild: true, locked: k => !canExportSize(+k), onLocked: pro(k => ({title: `${RES[k] === '4K' ? '4K' : k + 'p'} video is a Pro feature`, body: `The free plan exports video up to ${FREE_MAX}p. Pro unlocks 1440p and 4K.`}))}),
    seg(app, 'Format', 'export.format', {mp4: 'MP4', webm: 'WebM', gif: 'GIF'}, {rebuild: true}),
    seg(app, 'Frame rate', fpsPath, fpsOpts, {rebuild: true, locked: k => !gif && !canUseFps(+k), onLocked: pro(k => ({title: `${k} fps is a Pro feature`, body: `The free plan exports at up to ${FREE_FPS} fps. Pro unlocks silky 60 and 120 fps.`}))}),
    gif ? seg(app, 'Colours', 'export.gifColors', {64: '64', 128: '128', 256: '256'}) : seg(app, 'Quality', 'export.quality', {low: 'Low', medium: 'Med', high: 'High', max: 'Max'}),
    toggle(app, 'Seamless loop', 'export.seamless', {rebuild: true}),
    row('Animate text and logo', h('div', {style: 'flex:1'}), proToggleEl(app, 'style.anim.on', {rebuild: true, label: 'Animate text and logo'}, {title: 'Text and logo animation is a Pro feature', body: 'Pro animates your title, labels and logo in at the start and out at the end of every loop.'})),
    st.style.anim.on && !limited() ? seg(app, 'Animation', 'style.anim.kind', ANIMS) : null,
    st.style.anim.on && !limited() && !(st.style.title.on || st.style.labels.on || st.style.logo.on) ? h('div', {class: 'hint'}, 'Turn on a title, corner labels or your logo in the Text tab to see it.') : null,
    dur,
    h('div', {class: 'hint'}, note),
    h('div', {class: 'summary'}, `Output ${gif ? 'GIF' : ex.format.toUpperCase()} · ${W}×${H} · ${fps}fps · ${ci.clip.toFixed(1)}s · ${asp}`),
    h('button', {class: 'btn-primary exp-big', disabled: stop, onclick: () => app.runExport(gif ? 'gif' : 'video', prog)}, h('span', {html: I.download}), busy ? 'Exporting…' : gif ? 'Export GIF' : 'Export video'),
    prog));
  box.append(h('div', {class: 'xh'}, 'Static'));
  box.append(section(app, 'e-img', 'Frame', 'The current frame as a still', {open: true},
    seg(app, 'Still format', 'export.img', {png: 'PNG', jpeg: 'JPEG', webp: 'WebP'}),
    seg(app, 'Size', 'export.scale', IMG_RES, {rebuild: true, locked: k => !canExportStill(+k), onLocked: pro(k => ({title: `${IMG_RES[k]} stills are a Pro feature`, body: `The free plan exports stills up to ${FREE_IMG_MAX}p. Pro unlocks 4K, 6K and 8K.`}))}),
    h('div', {class: 'hint'}, dims(+ex.scale) + ' px'),
    toggle(app, 'Transparent background', 'export.transparent'),
    h('div', {class: 'row'}, h('button', {class: 'btn-primary', style: 'flex:1', disabled: stop, onclick: () => app.runExport('image')}, h('span', {html: I.download}), 'Export frame'),
      h('button', {class: 'ib', disabled: stop, title: 'Copy frame', onclick: () => app.runExport('copy')}, h('span', {html: I.copy})))));
  const seqPro = limited();
  box.append(section(app, 'e-seq', 'Image sequence', 'Every frame as PNG in a ZIP', {pro: seqPro},
    seg(app, 'Frame rate', 'export.seqFps', {12: '12', 24: '24', 30: '30', 60: '60'}),
    h('div', {class: 'hint'}, `Uses the video resolution (${dims(ex.res)}), the duration above and the transparency setting.`),
    seqPro ? h('button', {class: 'ib exp-big', disabled: busy, onclick: () => app.proNeeded({title: 'Image sequences are a Pro feature', body: 'Pro exports every frame as a PNG, ready for After Effects, Premiere or Resolve.'})}, h('span', {class: 'crown', html: I.crown}), 'Unlock with Pro')
      : h('button', {class: 'ib exp-big', disabled: stop, onclick: () => app.runExport('sequence', prog)}, h('span', {html: I.download}), 'Export PNG sequence')));
  // Embed is announced, not built yet: the snippet is a preview and the button stays disabled
  box.append(h('div', {class: 'xh'}, 'Web'));
  box.append(section(app, 'e-embed', 'Embed on your website', 'Live motion, one line of code', {open: true, soon: !limited(), pro: limited()},
    h('div', {class: 'hint', style: 'line-height:1.6'}, 'Paste one line into Webflow, Framer, Wix, Shopify or any site, and your motion plays live there: sharp at any size, lighter than a video, and it updates when you edit it here. Embeds are part of Pro.'),
    h('pre', {class: 'embed-code', 'aria-hidden': 'true'}, '<iframe src="https://aligncanvas.com/embed/…"></iframe>'),
    h('button', {class: 'ib exp-big', disabled: true}, h('span', {html: I.copy}), 'Coming soon')));
  box.append(h('div', {class: 'hint', style: 'padding:4px 2px;line-height:1.6'}, 'Exports render each frame one by one, so they never drop frames — even at 4K or 120 fps. Everything happens on your device.'));
}
