// First-visit guided tour: a spotlight on one part of the editor at a time, with a short note beside it.
// Opens once for new visitors and again from the help window.
import { h } from './ui.js';

const KEY = 'ac-tour';
const STEPS = [
  {title: 'Welcome to AlignCanvas', text: 'Turn your images and videos into 3D motion in a few clicks. This quick tour shows you around; it takes about 30 seconds.'},
  {sel: '#left', rail: 'motion', title: 'Pick a template', text: 'Templates are grouped by style. Click any one to see it play on the canvas straight away.'},
  {sel: '#rail [data-k="media"]', title: 'Add your media', text: 'Upload images or videos, or pick from the AlignCanvas library. You can also drop files anywhere on the page.'},
  {sel: '#view', title: 'Live preview', text: 'This is your composition, rendered in real time. Press Space to play or pause.'},
  {sel: '#timeline', title: 'Timeline', text: 'Scrub through the loop. Every template loops seamlessly, so exports repeat without a jump.'},
  {sel: '#right', title: 'Style it', text: 'One-click looks, backgrounds, liquid glass, blur and more. Changes show instantly.'},
  {sel: '#left .bigtab:nth-child(2)', rail: 'motion', title: 'Fine-tune the motion', text: 'Under Controls: speed, card count, spacing, bend, camera angle and each template’s own settings.'},
  {sel: '#rail [data-k="project"]', title: 'Save your projects', text: 'Save your work as a project and come back to it any time. Projects stay in this browser.'},
  {sel: '#exportTop', title: 'Export', text: 'When it looks right, export an MP4, GIF, image or PNG sequence.', last: true},
];
export const tourSeen = () => { try { return !!localStorage.getItem(KEY); } catch (e){ return true; } };

export function startTour(app){
  document.querySelector('.tour')?.remove();
  let i = 0;
  const hole = h('div', {class: 'tour-hole'}), card = h('div', {class: 'tour-card', role: 'dialog', 'aria-live': 'polite'});
  const root = h('div', {class: 'tour'}, hole, card);
  document.body.append(root);
  const done = () => { root.remove(); removeEventListener('resize', place); removeEventListener('keydown', key, true); try { localStorage.setItem(KEY, '1'); localStorage.setItem('ac-seen', '1'); } catch (e){} };
  const go = d => { i = Math.max(0, Math.min(STEPS.length - 1, i + d)); show(); };
  function show(){
    const s = STEPS[i];
    if (s.rail && app.ui.rail !== s.rail){ app.ui.rail = s.rail; app.rebuild(); }
    card.replaceChildren(
      i ? h('div', {class: 'tour-step'}, `${i} of ${STEPS.length - 1}`) : h('span', {class: 'badge'}, 'Quick tour'),
      h('h4', {}, s.title), h('p', {}, s.text),
      h('div', {class: 'tour-row'},
        h('div', {class: 'tour-dots'}, ...STEPS.slice(1).map((_, k) => h('span', {class: k + 1 === i ? 'on' : ''}))),
        h('div', {class: 'tour-btns'},
          s.last ? null : h('button', {class: 'ib ghost', onclick: done}, i ? 'Skip' : 'Not now'),
          i > 1 ? h('button', {class: 'ib', onclick: () => go(-1)}, 'Back') : null,
          h('button', {class: 'btn-primary', onclick: () => s.last ? done() : go(1)}, s.last ? 'Start creating' : i ? 'Next' : 'Show me around'))));
    place();
    card.querySelector('.btn-primary')?.focus();
  }
  // the spotlight hugs the target; the note sits on whichever side has the most room
  function place(){
    const s = STEPS[i], el = s.sel && document.querySelector(s.sel), W = innerWidth, H = innerHeight, cw = Math.min(320, W - 24);
    card.style.width = cw + 'px';
    if (!el){ hole.className = 'tour-hole none'; card.style.left = (W - cw) / 2 + 'px'; card.style.top = Math.max(12, (H - card.offsetHeight) / 2) + 'px'; return; }
    const r = el.getBoundingClientRect(), pad = 6, ch = card.offsetHeight;
    hole.className = 'tour-hole';
    Object.assign(hole.style, {left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px'});
    const room = {right: W - r.right, left: r.left, bottom: H - r.bottom, top: r.top}, gap = 16;
    const side = room.right >= cw + gap * 2 ? 'right' : room.left >= cw + gap * 2 ? 'left' : room.bottom >= ch + gap * 2 ? 'bottom' : 'top';
    let x, y;
    if (side === 'right' || side === 'left'){ x = side === 'right' ? r.right + gap : r.left - gap - cw; y = r.top + Math.min(r.height, 220) / 2 - ch / 2; }
    else { x = r.left + r.width / 2 - cw / 2; y = side === 'bottom' ? r.bottom + gap : r.top - gap - ch; }
    card.style.left = Math.max(12, Math.min(W - cw - 12, x)) + 'px';
    card.style.top = Math.max(12, Math.min(H - ch - 12, y)) + 'px';
  }
  function key(e){
    if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); done(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); STEPS[i].last ? done() : go(1); }
    else if (e.key === 'ArrowLeft'){ e.preventDefault(); e.stopPropagation(); if (i > 1) go(-1); }
  }
  addEventListener('resize', place); addEventListener('keydown', key, true);
  show();
}
