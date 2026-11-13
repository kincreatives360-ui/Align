// AlignCanvas — app shell: state, render loop, thumbnails, media, history, shortcuts, export.
import { Renderer } from './renderer.js';
import { TEMPLATES, byId, duration } from './templates.js';
import { FONTS_TO_LOAD, loadPhotos } from './faces.js';
import { buildFrame, syncLabels, resetLabels, sizeFor, ASPECTS, clipLength } from './engine.js';
import { newState, applyTemplate, templateStyle, templateParams, deepMerge, STYLE_PRESETS, BG_PALETTES, save, load, upgrade, History } from './state.js';
import { flareDuration } from './flare.js';
import { I, h, setPath, getPath, leftPanel, rightPanel } from './ui.js';
import * as X from './export.js';
import { mulberry } from './math.js';
import { startTour, tourSeen } from './tour.js';
import { initAccount, onAccount, currentUser, displayName, avatarUrl, initials, isPro, isLifetime, proUntil, inBeta, limited, canExportSize, canExportStill, canUseFps, proTemplate, exportsLeft, useExport, signOut, refreshPlan, startCheckout, openBilling } from './account.js';
import { FREE_MAX, FREE_IMG_MAX, FREE_FPS, FREE_EXPORTS, PAYMENTS } from './config.js';
import { openAuth } from './auth-ui.js';
import { track } from './analytics.js';
import { MOD_GROUPS } from './templates.js';
import * as S from './store.js';
import * as M from './media.js';
import * as B from './brand.js';
import * as C from './cloud.js';

// Social presets (Pro): the frame, size and frame rate each platform wants, plus its safe zone guide
export const SOCIAL = {
  reels: {name: 'Reels · TikTok · Shorts', aspect: '9:16', zone: 'reels'},
  story: {name: 'Story', aspect: '9:16', zone: 'story'},
  feed: {name: 'Instagram feed', aspect: '4:5', zone: 'feed'},
  square: {name: 'Square post', aspect: '1:1', zone: ''},
  linkedin: {name: 'LinkedIn · X', aspect: '16:9', zone: ''},
  youtube: {name: 'YouTube · website', aspect: '16:9', zone: '', res: 2160},
  dribbble: {name: 'Dribbble · Behance', aspect: '4:3', zone: ''},
};

// which section of the Controls panel a parameter lives in, for analytics
const GROUP_OF = Object.fromEntries(MOD_GROUPS.flatMap(g => g.params.filter(p => p.key).map(p => [p.key, g.id])));
// every leaf value of an object as path -> value, so two snapshots can be compared
const flat = (o, pre = '', out = {}) => { for (const k in o){ const v = o[k], p = pre + k; if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, p + '.', out); else out[p] = JSON.stringify(v); } return out; };

// Theme follows the browser unless you pick one; picking the browser's own theme goes back to following it.
const systemTheme = () => { try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e){ return 'dark'; } };
const pickedTheme = () => { try { return localStorage.getItem('ac-theme'); } catch (e){ return null; } };

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);

class App {
  constructor(){
    this.canvas = $('canvas');
    this.renderer = new Renderer(this.canvas);
    this.state = load() || newState();
    // id -> drawable element for each media item: an <img>, or a muted looping <video>
    this.social = SOCIAL;
    this.images = new Map(); this.logos = new Map(); this.posters = new Map(); this.thumbUrls = new Map(); this.urls = new Map(); this.stillMap = null;
    // the saved project this working copy belongs to (null: an unsaved draft)
    this.projectId = (() => { try { return localStorage.getItem('ac-project'); } catch (e){ return null; } })();
    this.projList = null; this.projThumbs = new Map(); this.saveState = '';
    let cats = []; try { cats = JSON.parse(localStorage.getItem('ac-cats') || '[]'); } catch (e){}
    this.ui = {rail: 'motion', leftTab: 'templates', rightTab: 'visual', search: '', open: new Set(), closed: new Set(), catClosed: new Set(cats)};
    this.history = new History();
    this.playing = true; this.T = 0; this.last = performance.now(); this.dirty = true; this.exporting = false;
    this.thumbs = new Map(); this.thumbQueue = []; this.hovered = null;
    this.saveT = 0;
  }
  async start(){
    this.state.theme = pickedTheme() || systemTheme();
    document.documentElement.dataset.theme = this.state.theme;
    // follow the browser live; focus and visibility re-check too, for browsers that don't fire the change event
    const follow = () => { if (!pickedTheme() && systemTheme() !== this.state.theme) this.setTheme(systemTheme(), false); };
    try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', follow); } catch (e){}
    addEventListener('focus', follow); document.addEventListener('visibilitychange', follow);
    await Promise.race([Promise.all(FONTS_TO_LOAD.map(f => document.fonts.load(f).catch(() => {}))), new Promise(r => setTimeout(r, 2500))]);
    await Promise.all([this.migrate().then(() => this.restoreMedia()), loadPhotos(), B.registerFonts()]);
    C.watch(e => this.toast(e.message || 'Cloud sync failed. Your work is safe in this browser.', 4000));
    if (this.projectId) S.getProject(this.projectId).then(r => { if (!r) this.setProject(null); this.showSaveState(); }, () => this.setProject(null));
    // media nothing refers to any more (removed, or only in deleted projects) is cleared once things settle
    setTimeout(() => S.gc(S.mediaIds(this.state)).catch(() => {}), 5000);
    // a template link from the landing page: /create#t=rubik
    const linked = location.hash.match(/^#t=([\w-]+)$/);
    if (linked && TEMPLATES.some(t => t.id === linked[1])){ applyTemplate(this.state, linked[1]); this.T = 0; history.replaceState(null, '', location.pathname); }
    // accounts load in the background; the tool never waits for them
    initAccount().then(async () => {
      onAccount(() => { this.updateAccount(); if (this.ui.rail === 'project') this.refreshProjects(); });
      // coming back from Stripe, or from a Get Pro link on the landing page
      // #pro opens the plan picker; #pro-year and #pro-lifetime (the landing page's plan cards) go straight to that checkout
      const pro = new URLSearchParams(location.search).get('pro'), wantPro = location.hash.match(/^#pro(?:-(year|lifetime))?$/);
      if (pro || wantPro) history.replaceState(null, '', location.pathname);
      if (wantPro) this.getPro(wantPro[1]);
      if (pro === 'welcome') this.toast(await refreshPlan(6) ? 'Welcome to Pro. Everything is unlocked.' : 'Payment received. Pro will switch on within a minute.');
      else if (pro === 'cancelled') this.toast('Checkout cancelled. Nothing was charged.');
    });
    this.chrome();
    this.rebuild();
    this.layout();
    track('editor_opened', {template: this.state.template, from_link: !!linked, own_images: this.state.media.images.length, returning: !!load()});
    new ResizeObserver(() => this.layout()).observe($('view'));
    this.history.push(this.state);
    this.queueThumbs();
    requestAnimationFrame(t => this.loop(t));
    // a first visit gets the guided tour, once the panels have laid out
    let seen = true; try { seen = !!localStorage.getItem('ac-seen'); } catch (e){}
    if (!seen && !tourSeen()) setTimeout(() => startTour(this), 900);
  }
  // saves from before IndexedDB kept images as data URLs inside the state: move them into the store
  async migrate(){
    const old = this.state.media.images.filter(m => m.src?.startsWith('data:'));
    if (!old.length || !await S.available()) return;
    for (const m of old){
      try { const blob = await M.dataURLToBlob(m.src); await S.putMedia({id: m.id, blob, kind: 'image', type: blob.type, name: m.name || '', size: blob.size}); m.kind = 'image'; delete m.src; }
      catch (e){ console.warn('Could not move an image into storage', e); }
    }
    save(this.state);
  }
  // make every media item of the state drawable; returns how many couldn't be found or decoded
  async restoreMedia(){
    const want = new Set(this.state.media.images.map(m => m.id));
    for (const id of [...this.images.keys()]) if (!want.has(id)) this.forget(id);
    let missing = 0;
    await Promise.all(this.state.media.images.map(m => this.images.has(m.id) ? null : this.loadMedia(m).catch(() => missing++)));
    await this.loadLogo(this.state.style.logo?.id);
    this.mediaChanged();
    return missing;
  }
  // m: {id, kind, name, lib?} (a library file) | {src} (an old data URL) | otherwise the blob in IndexedDB
  async loadMedia(m, blob){
    let url;
    if (m.lib) url = M.libUrl(m.lib);
    else if (m.src) url = m.src;
    else {
      blob = blob || (await S.getMedia(m.id).catch(() => null))?.blob;
      if (!blob) throw new Error('missing');
      url = URL.createObjectURL(blob); this.urls.set(m.id, url);
    }
    try {
      if (m.kind === 'video'){
        const v = await M.loadVideo(url);
        Object.assign(m, {dur: +v.duration.toFixed(3), w: v.videoWidth, h: v.videoHeight});
        const p = await M.poster(v);
        this.posters.set(m.id, p); this.thumbUrls.set(m.id, URL.createObjectURL(await M.toBlob(p)));
        v.addEventListener('seeked', () => this.dirty = true);
        this.images.set(m.id, v);
      } else {
        const im = await M.loadImage(url);
        m.kind = 'image'; m.w = im.naturalWidth; m.h = im.naturalHeight;
        this.images.set(m.id, im); this.thumbUrls.set(m.id, m.lib && m.thumb ? M.libUrl(m.thumb) : url);
      }
    } catch (e){ this.forget(m.id); throw e; }
  }
  forget(id){
    M.dropVideo(this.images.get(id)); this.images.delete(id); this.posters.delete(id);
    for (const mp of [this.urls, this.thumbUrls]){ const u = mp.get(id); if (u?.startsWith('blob:')) URL.revokeObjectURL(u); mp.delete(id); }
    this.renderer.dropFaces('img:' + id);
  }
  mediaChanged(){ this.stillMap = null; }
  // the logo's image, from IndexedDB
  async loadLogo(id){
    if (!id || this.logos.has(id)) return;
    const rec = await S.getMedia(id).catch(() => null);
    if (!rec) return;
    try { this.logos.set(id, await createImageBitmap(rec.blob)); resetLabels(); this.dirty = true; } catch (e){}
  }
  /* ---------- brand kit, social presets (Pro) ---------- */
  // a Pro feature asked for on the free plan: say so and stop
  needsPro(title, body){ if (!limited()) return false; this.proNeeded({title, body}); return true; }
  async applyBrandKit(){
    if (this.needsPro('The brand kit is a Pro feature', 'Pro saves your colours, fonts and logo, and puts them on any template in one click.')) return;
    const b = B.loadBrand();
    if (!b.colors.length && !b.head && !b.body && !b.logo){ this.toast('Add a colour, font or logo to your brand kit first'); return; }
    await B.registerFonts(b);
    B.applyBrand(this.state.style, b); await this.loadLogo(b.logo);
    track('brand_applied', {colors: b.colors.length, logo: !!b.logo, fonts: b.fonts.length});
    resetLabels(); this.commit(); this.rebuild(); this.dirty = true; this.toast('Brand kit applied');
  }
  applySocial(k){
    const p = SOCIAL[k];
    if (this.needsPro('Social presets are a Pro feature', 'Pro sets the right frame, size and frame rate for each platform in one click, with its safe zones.')) return;
    const ex = this.state.export;
    Object.assign(this.state.frame, {aspect: p.aspect, zone: p.zone, zoneShow: true, social: k});
    Object.assign(ex, {res: p.res || 1080, fps: 30, format: 'mp4', seamless: true});
    track('social_preset', {preset: k});
    this.commit(); this.layout(); this.rebuild(); this.toast(`${p.name}: ${p.aspect}, ${p.res === 2160 ? '4K' : '1080p'} at 30 fps` + (p.zone ? '. Keep key content inside the guides.' : ''), 3200);
  }
  showZone(){ const z = $('zones'), f = this.state.frame; if (z) z.className = 'zones' + (f.zone && f.zoneShow !== false ? ' on z-' + f.zone : ''); }
  // pick a file with a one-off input
  pickFile(accept){ return new Promise(res => { const i = h('input', {type: 'file', accept}); i.onchange = () => res(i.files[0] || null); i.click(); }); }
  async pickLogo(){
    if (this.needsPro('Your logo is a Pro feature', 'Pro puts your logo on every template, in any corner, and can animate it in and out.')) return;
    const f = await this.pickFile('image/png,image/svg+xml,image/jpeg,image/webp'); if (!f) return;
    try {
      const id = await B.addLogo(f);
      this.state.style.logo = {...this.state.style.logo, on: true, id}; await this.loadLogo(id);
      track('logo_added'); this.commit(); this.rebuild(); this.toast('Logo added to your brand kit and this project');
    } catch (e){ this.toast('That image couldn’t be opened. Try a PNG or SVG.'); }
  }
  async pickFont(){
    if (this.needsPro('The brand kit is a Pro feature', 'Pro saves your colours, fonts and logo, and puts them on any template in one click.')) return;
    const f = await this.pickFile('.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2'); if (!f) return;
    try { const name = await B.addFont(f); track('font_added'); this.rebuild(); this.toast(`Added “${name}” to your fonts`); }
    catch (e){ this.toast('That file isn’t a font this browser can read. Try TTF, OTF or WOFF.'); }
  }
  async logoUrl(id){
    this.logoUrls = this.logoUrls || new Map();
    if (!this.logoUrls.has(id)){ const r = await S.getMedia(id).catch(() => null); if (!r) return ''; this.logoUrls.set(id, URL.createObjectURL(r.blob)); }
    return this.logoUrls.get(id);
  }

  videos(){ return [...this.images.values()].filter(M.isVideo); }
  // template thumbnails show a video's poster frame instead of the playing video
  stills(){ return this.stillMap || (this.stillMap = new Map([...this.images].map(([id, el]) => [id, this.posters.get(id) || el]))); }

  /* ---------- state changes ---------- */
  setTheme(v, picked = true){
    if (picked) try { v === systemTheme() ? localStorage.removeItem('ac-theme') : localStorage.setItem('ac-theme', v); } catch (e){}
    // the theme rides along in the autosave, but isn't a change to the project
    this.state.theme = v; document.documentElement.dataset.theme = v; this.dirty = true; save(this.state); this.updateChrome?.();
  }
  set(path, v){ setPath(this.state, path, v); this.changed(); }
  saveUi(){ try { localStorage.setItem('ac-cats', JSON.stringify([...this.ui.catClosed])); } catch (e){} }
  changed(){ this.dirty = true; clearTimeout(this.saveT); this.saveT = setTimeout(() => save(this.state), 400); this.queueProjectSave(); }
  commit(){ this.history.push(this.state); this.changed(); this.updateTimeline(); this.trackChanges(); }
  // one event per commit naming the controls that changed (a slider drag commits once, on release)
  trackChanges(){
    const now = {...flat(this.state.params, 'params.'), ...flat(this.state.style, 'style.')}, was = this.lastFlat, tpl = this.state.template;
    this.lastFlat = now;
    if (!was || was.__tpl !== tpl){ this.lastFlat.__tpl = tpl; return; }
    now.__tpl = tpl;
    const keys = Object.keys(now).filter(k => k !== '__tpl' && now[k] !== was[k]);
    if (!keys.length || keys.length > 12) return;
    track('controls_changed', {template: tpl, keys, sections: [...new Set(keys.map(k => k.startsWith('params.') ? (GROUP_OF[k.slice(7)] || 'template') : 'visual:' + k.split('.')[1]))]});
  }
  rebuild(){
    const keep = ['left', 'right'].map(id => $(id).scrollTop);
    leftPanel(this); rightPanel(this);
    ['left', 'right'].forEach((id, i) => $(id).scrollTop = keep[i]);
    this.updateChrome();
  }
  selectTemplate(id){
    if (this.state.template === id) return;
    applyTemplate(this.state, id);
    track('template_selected', {template: id, category: byId(id).cat});
    this.T = 0; this.commit(); this.layout(); this.rebuild();
  }
  resetParams(){ this.state.params = templateParams(byId(this.state.template)); this.commit(); this.rebuild(); }
  // Signature templates can be previewed on the free plan, but not restyled
  styleLocked(){ if (!proTemplate(byId(this.state.template))) return false; this.proNeeded({title: 'Signature templates are Pro', body: 'Preview it as long as you like. Pro unlocks its controls, looks and exports.'}); return true; }
  applyPreset(k){ if (this.styleLocked()) return; track('look_applied', {look: k, template: this.state.template}); this.state.style = deepMerge(this.state.style, STYLE_PRESETS[k].s); this.commit(); this.rebuild(); this.toast(STYLE_PRESETS[k].name + ' look applied'); }
  resetLook(){ const {labels, logo, anim} = this.state.style; this.state.style = templateStyle(byId(this.state.template)); Object.assign(this.state.style, {labels, logo, anim}); this.commit(); this.rebuild(); this.toast('Look reset to the template default'); }
  surprise(){
    if (this.styleLocked()) return;
    const R = mulberry((Math.random() * 1e9) | 0), pick = a => a[Math.floor(R() * a.length)];
    const st = this.state.style, keys = Object.keys(STYLE_PRESETS);
    this.state.style = deepMerge(st, STYLE_PRESETS[pick(keys)].s);
    const s = this.state.style;
    s.bg.mode = pick(['solid', 'mesh', 'aurora', 'radial', 'holo', 'grid', 'plasma', 'spotlight', 'linear']);
    s.bg.c = pick(BG_PALETTES).slice();
    s.camera.drift = R() < .4 ? .15 + R() * .2 : 0;
    s.card.radius = pick([.02, .06, .1, .16, .5]);
    s.fx.grain = R() < .4 ? R() * .4 : 0;
    track('surprise_used', {template: this.state.template}); this.commit(); this.rebuild(); this.toast('Surprise! Press R for another');
  }
  undo(d){ const s = this.history.step(d, this.state); if (!s) return; this.history.lock = true; const theme = this.state.theme; this.state = upgrade(s); this.state.theme = theme; this.history.lock = false; this.changed(); this.layout(); this.rebuild(); }
  newProject(){
    // an in-page confirmation, since browser dialogs are blocked inside embedded views
    const go = async () => { track('project_new'); this.closeModal(); await this.flushProject(); this.state = newState(); this.setProject(null); await this.restoreMedia(); this.T = 0; this.commit(); this.layout(); this.rebuild(); this.queueThumbs(); this.syncName(); };
    this.modal(h('h3', {}, 'Start a new project?'), h('div', {class: 'hint'}, this.projectId ? 'Your saved project stays in My projects with all its changes.' : 'Your current template settings and media will be replaced. Save it as a project first if you want to keep it.'),
      h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'), h('button', {class: 'btn-primary', onclick: go}, 'Start new')));
  }
  // Project files embed images as data URLs and refer to library items by path. Videos are left out
  // (they'd make the file huge); opening the file in this browser brings them back from storage.
  saveProject(){
    const vids = this.state.media.images.filter(m => m.kind === 'video' && !m.lib).length;
    if (!vids) return this.writeProjectFile();
    this.modal(h('h3', {}, 'Videos aren’t included in project files'),
      h('p', {class: 'mp'}, `The file keeps your settings, images and library picks. Your ${vids > 1 ? vids + ' videos' : 'video'} will be left out: in this browser they come back when you open the file, elsewhere you’ll need to add ${vids > 1 ? 'them' : 'it'} again. To keep everything, use Save project instead.`),
      h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'),
        h('button', {class: 'btn-primary', onclick: () => { this.closeModal(); this.writeProjectFile(); }}, 'Save without videos')));
  }
  async writeProjectFile(){
    track('project_saved');
    try {
      const out = JSON.parse(JSON.stringify(this.state));
      out.media.images = (await Promise.all(out.media.images.map(async m => {
        if (m.lib || m.src) return m;
        if (m.kind === 'video') return {id: m.id, kind: 'video', name: m.name, dur: m.dur, w: m.w, h: m.h};
        const blob = (await S.getMedia(m.id).catch(() => null))?.blob || (this.urls.has(m.id) ? await (await fetch(this.urls.get(m.id))).blob() : null);
        return blob ? {...m, src: await M.blobToDataURL(blob)} : null;
      }))).filter(Boolean);
      const r = await X.download(new Blob([JSON.stringify(out)], {type: 'application/json'}), (this.state.name || 'aligncanvas-project').replace(/[^\w-]+/g, '-') + '.aligncanvas.json');
      this.toast(r === 'declined' ? 'Save cancelled' : 'Project file saved');
    } catch (e){ this.toast(e.message || 'Could not save the project file'); }
  }
  async openProject(file){
    let s;
    try { s = upgrade(JSON.parse(await file.text())); if (!s) throw 0; } catch (e){ this.toast('That file isn’t an AlignCanvas project'); return; }
    const stored = await S.available();
    let gone = 0;
    for (const m of s.media.images){
      m.kind = m.kind || 'image';
      if (stored && m.src?.startsWith('data:')){ try { const blob = await M.dataURLToBlob(m.src); await S.putMedia({id: m.id, blob, kind: m.kind, type: blob.type, name: m.name || '', size: blob.size}); delete m.src; } catch (e){} }
    }
    // videos aren't in the file: keep the ones this browser still has
    s.media.images = (await Promise.all(s.media.images.map(async m => m.kind !== 'video' || m.lib || m.src || (stored && await S.hasMedia(m.id).catch(() => false)) ? m : (gone++, null)))).filter(Boolean);
    await this.flushProject();
    s.theme = this.state.theme; this.state = s; this.setProject(null);
    const missing = await this.restoreMedia();
    this.T = 0; this.commit(); this.layout(); this.rebuild(); this.queueThumbs(); this.syncName();
    this.toast(gone || missing ? `Project opened. ${gone + missing} video${gone + missing > 1 ? 's weren’t' : ' wasn’t'} in the file — add ${gone + missing > 1 ? 'them' : 'it'} again from Media.` : 'Project opened', gone || missing ? 6000 : 2400);
  }

  /* ---------- saved projects: kept in this browser (IndexedDB), autosaved while open ---------- */
  setProject(id){ this.projectId = id; try { id ? localStorage.setItem('ac-project', id) : localStorage.removeItem('ac-project'); } catch (e){} this.showSaveState(); }
  syncName(){ $('projName').value = this.state.name || 'Untitled project'; }
  showSaveState(st = this.saveState){
    this.saveState = st;
    const el = $('saveState'); if (!el) return;
    const named = !!this.projectId;
    el.textContent = !named ? 'Draft' : st === 'saving' ? 'Saving…' : st === 'error' ? 'Not saved' : 'Saved';
    el.title = !named ? 'Not saved as a project yet. Save it from the Project tab.' : st === 'error' ? 'Couldn’t save to this browser’s storage' : 'Changes save automatically to My projects';
    el.className = 'savest' + (named ? ' named' : '') + (st === 'error' ? ' err' : '');
  }
  async projectThumb(){
    const [a, b] = ASPECTS[this.state.frame.aspect] || [16, 9], k = 320 / Math.max(a, b);
    const W = Math.round(a * k / 2) * 2, H = Math.round(b * k / 2) * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').putImageData(this.snapshot(this.T, W, H, {opaque: true}), 0, 0);
    this.dirty = true;
    return M.toBlob(c, 'image/jpeg', .8);
  }
  async writeProject(id, name){
    const rec = (id && await S.getProject(id)) || {id: id || uid(), created: Date.now()};
    rec.name = name || this.state.name || 'Untitled project';
    rec.state = JSON.parse(JSON.stringify({...this.state, name: rec.name}));
    rec.thumb = await this.projectThumb();
    await S.putProject(rec);
    return rec;
  }
  // autosave into the open project: a short while after the last change, one write at a time
  queueProjectSave(){
    if (!this.projectId) return;
    this.showSaveState('saving'); clearTimeout(this.projT);
    this.projT = setTimeout(() => this.flushProject(), 1200);
  }
  async flushProject(){
    clearTimeout(this.projT);
    if (!this.projectId || this.saveState !== 'saving') return;
    if (this.exporting){ this.projT = setTimeout(() => this.flushProject(), 1500); return; }
    if (this.writing){ this.again = true; return this.writing; }
    this.writing = this.writeProject(this.projectId).then(() => this.showSaveState('saved'), e => { console.warn(e); this.showSaveState('error'); });
    await this.writing; this.writing = null;
    if (this.again){ this.again = false; this.showSaveState('saving'); return this.flushProject(); }
    if (this.ui.rail === 'project') this.refreshProjects();
  }
  askName(title, value, ok, then){
    const inp = h('input', {class: 'tin', value, maxlength: 80, 'aria-label': 'Project name'});
    const go = () => { const v = inp.value.trim(); if (!v) return inp.focus(); this.closeModal(); then(v); };
    inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    this.modal(h('h3', {}, title), inp, h('div', {class: 'row', style: 'justify-content:flex-end'},
      h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'), h('button', {class: 'btn-primary', onclick: go}, ok)));
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  // Save project: the open project saves now; a draft asks for a name first
  saveNamed(then){
    if (this.projectId){ this.showSaveState('saving'); this.flushProject().then(() => { this.toast('Project saved'); then?.(); }); return; }
    this.askName('Save project', this.state.name && this.state.name !== 'Untitled project' ? this.state.name : '', 'Save', name => this.createProject(name, then));
  }
  saveAs(){ this.askName('Save as a new project', (this.state.name || 'Untitled project') + ' copy', 'Save copy', name => this.createProject(name)); }
  async createProject(name, then){
    try {
      if (!await S.available()) throw new Error('This browser has no storage for projects (private window?)');
      await this.flushProject();
      const rec = await this.writeProject(null, name);
      this.state.name = name; this.syncName(); save(this.state);
      this.setProject(rec.id); this.showSaveState('saved');
      track('project_stored', {media: this.state.media.images.length});
      this.toast(`Saved “${name}” to My projects`); this.refreshProjects(); then?.();
    } catch (e){ this.toast(e.message || 'Could not save the project'); }
  }
  async refreshProjects(){
    try { this.projList = await S.listProjects(); } catch (e){ this.projList = []; }
    // cloud projects: newer copies of synced projects come down quietly; ones not in this browser are listed to open
    this.cloudList = currentUser() ? await C.list() : [];
    for (const c of this.cloudList){
      const p = this.projList.find(x => x.id === c.id);
      if (p && p.cloud && c.updated > p.updated + 1000 && c.id !== this.projectId){ try { await C.pull(c.id); } catch (e){ console.warn(e); } }
    }
    try { this.projList = await S.listProjects(); } catch (e){}
    const here = new Set(this.projList.map(p => p.id));
    this.cloudOnly = this.cloudList.filter(c => !here.has(c.id));
    for (const p of this.projList){
      const old = this.projThumbs.get(p.id);
      if (old?.updated === p.updated || !p.thumb) continue;
      if (old) URL.revokeObjectURL(old.url);
      this.projThumbs.set(p.id, {updated: p.updated, url: URL.createObjectURL(p.thumb)});
    }
    // don't redraw under someone renaming a project
    if (this.ui.rail === 'project' && !document.activeElement?.matches?.('#left input')) this.rebuild();
  }
  openNamed(id){
    // replacing a draft with work in it: offer to keep it first
    if (!this.projectId && this.history.stack.length > 1 && this.projectId !== id){
      this.modal(h('h3', {}, 'Open this project?'), h('p', {class: 'mp'}, 'Your current work isn’t saved as a project. Opening another one replaces it.'),
        h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'),
          h('button', {class: 'ib', onclick: () => { this.closeModal(); this.saveNamed(() => this.loadNamed(id)); }}, 'Save it first'),
          h('button', {class: 'btn-primary', onclick: () => { this.closeModal(); this.loadNamed(id); }}, 'Open')));
      return;
    }
    this.loadNamed(id);
  }
  async loadNamed(id){
    const rec = await S.getProject(id).catch(() => null);
    const s = rec && upgrade(rec.state);
    if (!s){ this.toast('That project couldn’t be opened'); return; }
    await this.flushProject();
    s.theme = this.state.theme; s.name = rec.name; this.state = s;
    this.setProject(id); this.showSaveState('saved');
    const missing = await this.restoreMedia();
    this.T = 0; this.history = new History(); this.history.push(this.state); save(this.state);
    track('project_opened', {media: s.media.images.length});
    this.layout(); this.rebuild(); this.queueThumbs(); this.syncName(); this.dirty = true;
    this.toast(missing ? `Opened “${rec.name}”. ${missing} media file${missing > 1 ? 's are' : ' is'} missing from this browser.` : `Opened “${rec.name}”`, missing ? 5000 : 2400);
  }
  async renameNamed(id, name){
    const rec = await S.getProject(id).catch(() => null); if (!rec || !name) return;
    rec.name = name; rec.state.name = name; await S.putProject(rec);
    if (id === this.projectId){ this.state.name = name; this.syncName(); save(this.state); }
    this.refreshProjects();
  }
  async duplicateNamed(id){
    const rec = await S.getProject(id).catch(() => null); if (!rec) return;
    const name = rec.name + ' copy';
    await S.putProject({...rec, id: uid(), name, state: {...rec.state, name}, created: Date.now(), rev: 0, cloud: false});
    this.toast(`Duplicated as “${name}”`); this.refreshProjects();
  }
  deleteNamed(id){
    const p = this.projList?.find(x => x.id === id); if (!p) return;
    this.modal(h('h3', {}, `Delete “${p.name}”?`),
      h('p', {class: 'mp'}, (id === this.projectId ? 'It’s open right now: your work stays here as an unsaved draft, but the saved project is removed from this browser.' : 'The project is removed from this browser.') + (p.cloud ? ' It’s also removed from the cloud and your other devices.' : '') + ' This can’t be undone.'),
      h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'),
        h('button', {class: 'btn-primary danger', onclick: async () => {
          this.closeModal();
          if (p.cloud) await C.remove(id).catch(e => this.toast(e.message));
          await S.delProject(id).catch(() => {});
          if (id === this.projectId){ clearTimeout(this.projT); this.saveState = ''; this.setProject(null); }
          const t = this.projThumbs.get(id); if (t){ URL.revokeObjectURL(t.url); this.projThumbs.delete(id); }
          S.gc(S.mediaIds(this.state)).catch(() => {});
          this.toast(`Deleted “${p.name}”`); this.refreshProjects();
        }}, 'Delete')));
  }

  /* ---------- cloud projects: opt-in per project ---------- */
  toggleCloud(id){
    const p = this.projList?.find(x => x.id === id); if (!p) return;
    if (!currentUser()){ this.signIn(() => this.toggleCloud(id)); return; }
    const row = (...kids) => h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: 'ib', onclick: () => this.closeModal()}, 'Cancel'), ...kids);
    if (p.cloud){
      this.modal(h('h3', {}, `Stop syncing “${p.name}”?`), h('p', {class: 'mp'}, 'It stays in this browser, but is removed from the cloud and your other devices.'),
        row(h('button', {class: 'btn-primary', onclick: async () => {
          this.closeModal();
          try { await C.remove(id); const rec = await S.getProject(id); await S.putProjectAsIs({...rec, cloud: false}); track('cloud_off'); this.toast('Kept in this browser only'); }
          catch (e){ this.toast(e.message); }
          this.refreshProjects();
        }}, 'Stop syncing')));
      return;
    }
    this.modal(h('h3', {}, `Sync “${p.name}” to the cloud?`),
      h('p', {class: 'mp'}, 'The project and its images and videos are uploaded to your AlignCanvas account, so you can open it on any device where you sign in. Only you can see them. Your other projects stay in this browser.'),
      row(h('button', {class: 'btn-primary', onclick: async () => {
        this.closeModal(); this.toast('Syncing…', 20000);
        try {
          if (id === this.projectId) await this.flushProject();
          const rec = {...await S.getProject(id), cloud: true};
          const skipped = await C.push(rec); await S.putProjectAsIs(rec);
          track('cloud_on', {media: rec.state?.media?.images?.length || 0});
          this.toast(skipped ? `Synced. ${skipped} file${skipped > 1 ? 's are' : ' is'} over 50 MB and stayed in this browser.` : 'Synced to the cloud', skipped ? 5000 : 2400);
        } catch (e){ this.toast(e.message, 5000); }
        this.refreshProjects();
      }}, 'Sync to cloud')));
  }
  async openCloud(id){
    this.toast('Opening from the cloud…', 20000);
    try {
      const missing = await C.pull(id);
      if (missing) setTimeout(() => this.toast(`${missing} file${missing > 1 ? 's' : ''} couldn’t be downloaded.`, 4000), 2600);
      track('cloud_opened'); await this.refreshProjects(); this.openNamed(id);
    } catch (e){ this.toast(e.message, 5000); }
  }

  /* ---------- media ---------- */
  // images and videos (from the picker, drop or paste): decoded first, then kept in IndexedDB
  async addMedia(files){
    files = [...files]; if (!files.length) return;
    // videos on cards are Pro; images stay free
    if (limited() && files.some(f => M.kindOf(f) === 'video')){
      const n = files.length;
      files = files.filter(f => M.kindOf(f) !== 'video');
      this.proNeeded({title: 'Videos are a Pro feature', body: 'The free plan uses images. Pro puts your videos (MP4, MOV, WebM and more) on every card.'});
      if (!files.length) return;
      track('upload_blocked', {reason: 'pro_video', skipped: n - files.length});
    }
    const added = [], bad = [], stored = await S.available();
    let lost = 0;
    if (files.some(f => M.kindOf(f) === 'video')) this.toast(files.length > 1 ? `Adding ${files.length} files…` : 'Adding video…', 20000);
    for (const f of files){
      const kind = M.kindOf(f);
      if (!kind){ bad.push(f.name); continue; }
      const m = {id: uid(), kind, name: f.name};
      const blob = kind === 'image' ? await M.downscale(f) : f;
      try { await this.loadMedia(m, blob); } catch (e){ bad.push(f.name); continue; }
      try { if (!stored) throw 0; await S.putMedia({id: m.id, blob, kind, type: blob.type || f.type, name: f.name, size: blob.size}); }
      // no storage (or it's full): images fall back to living in the autosave, videos last this session only
      catch (e){ if (kind === 'image') m.src = await M.blobToDataURL(blob); else lost++; }
      this.state.media.images.push(m); added.push(m);
    }
    if (added.length){
      const v = added.filter(m => m.kind === 'video').length, n = added.length - v;
      track('images_added', {count: added.length, videos: v, total: this.state.media.images.length, template: this.state.template});
      this.mediaChanged(); this.commit(); this.rebuild(); this.queueThumbs();
      this.toast([n ? `${n} image${n > 1 ? 's' : ''}` : '', v ? `${v} video${v > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') + ' added to every template');
    }
    if (bad.length) setTimeout(() => this.toast(`Couldn’t open ${bad.length > 2 ? bad.length + ' files' : bad.join(' and ')}: this browser can’t decode ${bad.length > 1 ? 'them' : 'it'}. Try JPG, PNG, WebP, MP4 (H.264) or WebM.`, 6000), added.length ? 2200 : 0);
    else if (lost) setTimeout(() => this.toast('This browser couldn’t store the video, so it will be gone after a reload.', 5000), 2200);
    else if (!added.length) this.toast('');
  }
  // picks from the AlignCanvas library are referenced by path, not copied
  async addLibrary(items){
    if (limited() && items.some(it => it.kind === 'video')){
      items = items.filter(it => it.kind !== 'video');
      this.proNeeded({title: 'Videos are a Pro feature', body: 'The free plan uses images. Pro puts videos on every card.'});
      if (!items.length) return;
    }
    let n = 0;
    for (const it of items){
      const m = {id: uid(), kind: it.kind || 'image', name: it.name, lib: it.src, thumb: it.thumb};
      try { await this.loadMedia(m); this.state.media.images.push(m); n++; } catch (e){}
    }
    if (n){ track('library_added', {count: n, total: this.state.media.images.length, template: this.state.template}); this.mediaChanged(); this.commit(); this.rebuild(); this.queueThumbs(); }
    this.toast(n ? `${n} library item${n > 1 ? 's' : ''} added to every template` : 'Couldn’t load that library item');
    return n;
  }
  removeImage(id){ this.state.media.images = this.state.media.images.filter(m => m.id !== id); this.forget(id); this.mediaChanged(); this.commit(); this.rebuild(); this.queueThumbs(); }
  moveImage(a, b){ const L = this.state.media.images, [m] = L.splice(a, 1); L.splice(b, 0, m); this.commit(); this.rebuild(); }
  clearImages(){ this.state.media.images.forEach(m => this.forget(m.id)); this.state.media.images = []; this.mediaChanged(); this.commit(); this.rebuild(); this.queueThumbs(); }

  /* ---------- video clock ---------- */
  // Preview: videos play natively and follow the composition clock, looping over their own length;
  // they're nudged back only when they drift, and when paused they seek to the exact frame.
  syncVideos(){
    if (this.videoHold) return;
    for (const v of this.videos()){
      if (!v.duration || v.readyState < 1) continue;
      const want = M.videoTime(v, this.T), d = v.duration;
      if (this.playing && !document.hidden){
        if (v.paused) v.play().catch(() => {});
        let diff = v.currentTime - want; diff -= d * Math.round(diff / d);
        if (Math.abs(diff) > .2 && !v.seeking) v.currentTime = want;
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - want) > .004 && !v.seeking) v.currentTime = want;
      }
    }
  }
  // Export: before each frame, seek every video to its time for T and wait for that frame
  async prepareFrame(T){
    const vs = this.videos(); if (!vs.length) return;
    this.videoHold = true; this.renderer.exact = true;
    await Promise.all(vs.map(v => M.seekVideo(v, M.videoTime(v, T)).then(() => v._ver++)));
  }
  releaseFrames(){ this.videoHold = false; this.renderer.exact = false; }

  /* ---------- rendering ---------- */
  previewSize(){
    const v = $('view'), cs = getComputedStyle(v);
    const aw = v.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), ah = v.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const [a, b] = ASPECTS[this.state.frame.aspect] || [16, 9];
    let w = aw, hh = aw * b / a; if (hh > ah){ hh = ah; w = ah * a / b; }
    return [Math.max(40, Math.floor(w)), Math.max(40, Math.floor(hh))];
  }
  layout(){
    if (this.exporting) return;
    const fs = document.fullscreenElement === $('wrap');
    const [a, b] = ASPECTS[this.state.frame.aspect] || [16, 9];
    let cw, ch;
    if (fs){ const W = innerWidth, H = innerHeight; cw = W; ch = W * b / a; if (ch > H){ ch = H; cw = H * a / b; } }
    else [cw, ch] = this.previewSize();
    $('wrap').style.width = cw + 'px'; $('wrap').style.height = ch + 'px';
    const q = this.state.frame.preview, dpr = Math.min(2, devicePixelRatio || 1);
    let k = q === 'draft' ? .6 : q === 'max' ? dpr * 1.25 : dpr;
    const cap = q === 'draft' ? 900 : q === 'max' ? 3000 : 2200;
    k = Math.min(k, cap / Math.max(cw, ch));
    this.canvas.width = Math.round(cw * k / 2) * 2; this.canvas.height = Math.round(ch * k / 2) * 2;
    this.dirty = true;
  }
  draw(T){
    const W = this.canvas.width, H = this.canvas.height;
    const desc = buildFrame(this, T, W, H);
    syncLabels(this, W, H, T);
    this.renderer.render(desc);
  }
  drawExport(T, W, H){
    if (this.canvas.width !== W || this.canvas.height !== H){ this.canvas.width = W; this.canvas.height = H; }
    const desc = buildFrame(this, T, W, H, {resBoost: 1.15});
    syncLabels(this, W, H, T);
    this.renderer.render(desc);
  }
  snapshot(T, W, H, o = {}){
    const bg = this.state.style.bg, was = bg.transparent;
    bg.transparent = o.opaque ? false : (o.transparent || was);
    const desc = buildFrame(this, T, W, H, {resBoost: 1.15});
    syncLabels(this, W, H, T);
    const img = this.renderer.snapshot(desc);
    bg.transparent = was;
    return img;
  }
  loop(now){
    const dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
    if (!this.exporting){
      if (this.playing){ this.T += dt; this.dirty = true; }
      // the preview plays the clip you'll export, so an Animation in replays each time round
      const len = clipLength(this.state);
      if (this.T >= len) this.T = this.T % len;
      this.syncVideos();
      if (this.dirty){ this.draw(this.T); this.dirty = false; this.updateTimeline(); }
      this.thumbTick(now);
      this.perf(now, dt);
    }
    requestAnimationFrame(t => this.loop(t));
  }

  /* ---------- thumbnails ---------- */
  thumbState(t){
    const s = newState();
    s.template = t.id; s.params = templateParams(t); s.style = templateStyle(t); s.style.labels.on = false;
    s.media = this.state.media;
    return s;
  }
  thumbTime(t, s){
    if (t.kind === 'flare'){ const P = s.params; return P.hold + P.antic + P.sweep * .42; }
    return duration(t, s.params) * (t.step ? .32 : .12);
  }
  renderThumb(id, T){
    const t = byId(id), e = this.thumbs.get(id); if (!e) return;
    const s = this.thumbState(t), fake = {state: s, renderer: this.renderer, images: this.stills()};
    const W = 320, H = 256, desc = buildFrame(fake, T ?? this.thumbTime(t, s), W, H, {thumb: true, rate: 1});
    this.renderer.snapshot(desc, e.ctx);
    e.done = true; e.sk?.remove(); e.sk = null;
  }
  thumb(id){
    let e = this.thumbs.get(id);
    if (!e){ const c = document.createElement('canvas'); c.width = 320; c.height = 256; e = {canvas: c, ctx: c.getContext('2d'), done: false}; this.thumbs.set(id, e); }
    if (!e.done && !e.sk){ e.sk = h('div', {class: 'sk'}); }
    const frag = document.createDocumentFragment(); frag.append(e.canvas); if (e.sk) frag.append(e.sk);
    return frag;
  }
  queueThumbs(){ this.thumbs.forEach(e => e.done = false); this.thumbQueue = TEMPLATES.map(t => t.id); }
  hoverThumb(id){ if (this.hovered && this.hovered !== id) this.renderThumb(this.hovered); this.hovered = id; this.hoverStart = performance.now(); }
  thumbTick(now){
    const t0 = performance.now();
    while (this.thumbQueue.length && performance.now() - t0 < 10){ const id = this.thumbQueue.shift(); if (!this.thumbs.has(id)) this.thumb(id); this.renderThumb(id); }
    if (this.hovered && this.thumbs.get(this.hovered)){
      const t = byId(this.hovered), s = this.thumbState(t);
      this.renderThumb(this.hovered, this.thumbTime(t, s) + (now - this.hoverStart) / 1000);
    }
  }

  /* ---------- chrome: top bar, toolbar, timeline ---------- */
  chrome(){
    $('undo').innerHTML = I.undo; $('redo').innerHTML = I.redo;
    $('undo').onclick = () => this.undo(-1); $('redo').onclick = () => this.undo(1);
    const th = $('theme').children; th[0].innerHTML = I.sun; th[1].innerHTML = I.moon;
    [...th].forEach(b => b.onclick = () => this.setTheme(b.dataset.v));
    $('exportTop').innerHTML = I.download + '<span>Export</span>';
    $('exportTop').onclick = () => { this.ui.rightTab = 'export'; this.rebuild(); };
    $('help').onclick = () => this.shortcuts();
    $('surprise').innerHTML = I.sparkle; $('surprise').onclick = () => this.surprise();
    $('projName').value = this.state.name || 'Untitled project';
    $('projName').onchange = e => { this.state.name = e.target.value; this.changed(); };
    this.showSaveState();
    // rail
    const rail = $('rail');
    [['motion', 'Motion', I.motion], ['media', 'Media', I.image], ['text', 'Text', I.text], ['project', 'Project', I.folder]].forEach(([k, n, ic]) => {
      rail.append(h('button', {'data-k': k, onclick: () => { this.ui.rail = k; this.rebuild(); }}, h('span', {class: 'ic', html: ic}), n, k === 'motion' ? h('span', {class: 'badge'}, String(TEMPLATES.length)) : null));
    });
    // toolbar
    const tb = $('toolbar');
    this.playBtn = h('button', {class: 'ib', title: 'Play / pause (Space)', onclick: () => this.togglePlay()});
    const aspect = h('select', {title: 'Frame size'});
    Object.keys(ASPECTS).forEach(k => aspect.append(h('option', {value: k}, k)));
    aspect.onchange = () => { Object.assign(this.state.frame, {aspect: aspect.value, zone: '', social: ''}); this.commit(); this.layout(); this.rebuild(); };
    this.aspectSel = aspect;
    const bgPick = h('input', {type: 'color', style: 'position:absolute;opacity:0;width:0;height:0'});
    const bgDot = h('button', {class: 'ib', title: 'Background colour', onclick: () => bgPick.click()}, h('span', {class: 'dot', id: 'bgDot'}));
    bgPick.oninput = () => { this.state.style.bg.c[0] = bgPick.value; if (this.state.style.bg.transparent) this.state.style.bg.transparent = false; this.changed(); this.updateChrome(); };
    bgPick.onchange = () => { this.commit(); this.rebuild(); };
    this.bgPick = bgPick;
    tb.append(this.playBtn,
      h('button', {class: 'ib', title: 'Restart', html: I.restart, onclick: () => { this.T = 0; this.dirty = true; }}),
      h('button', {class: 'ib', title: 'Fullscreen (F)', html: I.full, onclick: () => this.fullscreen()}),
      h('span', {class: 'sep'}), aspect, h('span', {class: 'sep'}), bgDot, bgPick,
      h('button', {class: 'ib', id: 'safeBtn', title: 'Guides (G)', html: I.grid, onclick: () => { $('safe').classList.toggle('on'); $('safeBtn').classList.toggle('on'); }}),
      h('button', {class: 'ib', title: 'Reset look to template default', html: I.reset, onclick: () => this.resetLook()}));
    // timeline
    this.scrub = h('div', {class: 'scrub'}, h('div', {class: 'tr'}), h('div', {class: 'fi'}), h('div', {class: 'hd'}));
    this.timeEl = h('div', {class: 'time'});
    this.tlPlay = h('button', {class: 'ib ghost', onclick: () => this.togglePlay()});
    $('timeline').append(this.tlPlay, this.scrub, this.timeEl);
    this.scrub.onpointerdown = e => {
      this.scrub.setPointerCapture(e.pointerId); const was = this.playing; this.playing = false;
      const go = ev => { const r = this.scrub.getBoundingClientRect(); this.T = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * clipLength(this.state) * .9999; this.dirty = true; };
      go(e); this.scrub.onpointermove = go; this.scrub.onpointerup = () => { this.scrub.onpointermove = null; this.playing = was; this.updateChrome(); };
    };
    // files & drag-drop
    $('fileImgs').onchange = e => { this.addMedia(e.target.files); e.target.value = ''; };
    $('fileProj').onchange = e => { if (e.target.files[0]) this.openProject(e.target.files[0]); e.target.value = ''; };
    let dn = 0;
    addEventListener('dragenter', e => { if ([...e.dataTransfer.items].some(i => i.kind === 'file')){ dn++; $('drop').classList.add('on'); } });
    addEventListener('dragleave', () => { if (--dn <= 0){ dn = 0; $('drop').classList.remove('on'); } });
    addEventListener('dragover', e => e.preventDefault());
    addEventListener('drop', e => { e.preventDefault(); dn = 0; $('drop').classList.remove('on'); if (e.dataTransfer.files.length) this.addMedia(e.dataTransfer.files); });
    addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) this.addMedia(f); });
    document.addEventListener('fullscreenchange', () => this.layout());
    addEventListener('keydown', e => this.key(e));
  }
  updateChrome(){
    if (!this.playBtn) return;
    this.playBtn.innerHTML = this.playing ? I.pause : I.play; this.tlPlay.innerHTML = this.playing ? I.pause : I.play;
    this.aspectSel.value = this.state.frame.aspect;
    this.showZone();
    const bg = this.state.style.bg;
    $('bgDot').style.background = bg.transparent ? 'repeating-conic-gradient(#999 0 25%,#ddd 0 50%) 50%/8px 8px' : bg.c[0];
    this.bgPick.value = bg.c[0];
    [...$('theme').children].forEach(b => b.classList.toggle('on', b.dataset.v === this.state.theme));
    [...$('rail').children].forEach(b => b.classList.toggle('on', b.dataset.k === this.ui.rail));
    $('undo').disabled = this.history.i <= 0; $('redo').disabled = this.history.i >= this.history.stack.length - 1;
  }
  updateTimeline(){
    if (!this.scrub) return;
    const len = clipLength(this.state), t = ((this.T % len) + len) % len, f = t / len;
    this.scrub.children[1].style.width = (f * 100) + '%'; this.scrub.children[2].style.left = (f * 100) + '%';
    this.timeEl.textContent = `${t.toFixed(2)} / ${len.toFixed(2)}s`;
  }
  togglePlay(){ this.playing = !this.playing; this.updateChrome(); }
  fullscreen(){ const w = $('wrap'); if (document.fullscreenElement) document.exitFullscreen(); else w.requestFullscreen?.(); }
  key(e){
    if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); this.undo(e.shiftKey ? 1 : -1); return; }
    if (mod) return;
    const len = clipLength(this.state);
    switch (e.key){
      case ' ': e.preventDefault(); this.togglePlay(); break;
      case 'ArrowRight': this.playing = false; this.T = (this.T + (e.shiftKey ? 10 : 1) / 60) % len; this.dirty = true; this.updateChrome(); break;
      case 'ArrowLeft': this.playing = false; this.T = ((this.T - (e.shiftKey ? 10 : 1) / 60) % len + len) % len; this.dirty = true; this.updateChrome(); break;
      case 'Home': this.T = 0; this.dirty = true; break;
      case 'f': case 'F': this.fullscreen(); break;
      case 'g': case 'G': $('safe').classList.toggle('on'); break;
      case 'r': case 'R': this.surprise(); break;
      case 't': case 'T': this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark'); break;
      case 'e': case 'E': this.ui.rightTab = 'export'; this.rebuild(); break;
      case '?': this.shortcuts(); break;
      case 'Escape': $('modal').classList.remove('on'); break;
    }
  }

  /* ---------- feedback ---------- */
  toast(msg, ms = 2400){ const t = $('toast'); clearTimeout(this.toastT); if (!msg){ t.classList.remove('on'); return; } t.textContent = msg; t.classList.add('on'); this.toastT = setTimeout(() => t.classList.remove('on'), ms); }
  /* ---------- account ---------- */
  updateAccount(){
    const b = $('account'), u = currentUser();
    if (!b) return;
    b.innerHTML = '';
    if (!u){ b.className = 'ib ghost acct'; b.textContent = 'Sign in'; b.title = 'Sign in or create a free account'; b.onclick = () => this.signIn(); return; }
    b.className = 'ib ghost acct on'; b.title = displayName(u);
    b.append(this.avatar(u), h('span', {class: 'who ph-mask'}, displayName(u).split(/\s+/)[0])); if (isPro()) b.append(h('span', {class: 'badge pro', title: isLifetime() ? 'Pro · lifetime' : 'Pro'}, h('span', {html: I.crown}), 'Pro'));
    b.onclick = () => this.accountMenu();
  }
  // the provider's photo when there is one, otherwise initials
  avatar(u, big){
    const el = h('span', {class: 'av' + (big ? ' big' : '')}, initials(u)), src = avatarUrl(u);
    if (src){ const im = h('img', {alt: '', referrerpolicy: 'no-referrer', src}); im.onerror = () => im.remove(); el.append(im); }
    return el;
  }
  // the shared sign-in window; `then` runs once the person is signed in (e.g. the export they asked for)
  signIn(then, forPro = false){
    openAuth({mode: then && !forPro ? 'signup' : 'signin',
      reason: forPro ? 'Pro is linked to your account. Sign in, or create one.' : then ? 'Exporting is free. Create your account, or sign in.' : ''})
      .then(ok => { if (!ok) return; this.toast('You’re signed in'); then?.(); });
  }
  accountMenu(){
    // a cancelled yearly plan stays Pro until the end of the year already paid for
    const until = proUntil()?.toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
    const u = currentUser(), plan = isLifetime() ? 'Pro · lifetime' : isPro() ? 'Pro · yearly' + (until ? `, paid through ${until}` : '') : inBeta() ? 'Free · everything unlocked during the launch week' : `Free · ${exportsLeft()} of ${FREE_EXPORTS} exports left, up to ${FREE_MAX}p`;
    this.modal(h('div', {class: 'acct-head'}, this.avatar(u, true), h('div', {}, h('h3', {class: 'ph-mask'}, displayName(u)), h('div', {class: 'hint ph-mask'}, u.email || ''))),
      h('div', {class: 'hint'}, 'Plan: ' + plan),
      h('div', {class: 'row', style: 'justify-content:flex-end'},
        h('button', {class: 'ib', onclick: async () => { await signOut(); this.closeModal(); this.toast('Signed out'); }}, 'Sign out'),
        isPro() ? h('button', {class: 'ib', onclick: () => openBilling().catch(e => this.toast(e.message))}, isLifetime() ? 'Billing' : 'Manage subscription')
          : PAYMENTS ? h('button', {class: 'ib', onclick: () => this.getPro()}, 'Get Pro') : null,
        isPro() && !isLifetime() && PAYMENTS ? h('button', {class: 'ib', onclick: () => this.getPro()}, 'Upgrade to lifetime') : null,
        h('button', {class: 'btn-primary', onclick: () => this.closeModal()}, 'Done')));
  }
  // a Pro lock: what it is and Get Pro (while Pro is closed, only that it opens soon)
  proNeeded({title, body}){
    track('pro_prompt', {title, template: this.state.template});
    this.modal(h('h3', {class: 'pro-h'}, h('span', {class: 'crown', html: I.crown}), title), h('p', {class: 'mp'}, PAYMENTS ? body : body + ' Pro opens soon.'),
      h('div', {class: 'row', style: 'justify-content:flex-end'}, h('button', {class: PAYMENTS ? 'ib' : 'btn-primary', onclick: () => this.closeModal()}, 'Not now'),
        PAYMENTS ? h('button', {class: 'btn-primary', onclick: () => this.getPro()}, 'Get Pro') : null));
  }
  // choose a plan, then go to Stripe Checkout (signing in first if needed); with a plan already chosen, go straight there
  getPro(chosen){
    if (!PAYMENTS) return; // Pro is closed: nothing in the editor offers it
    track('pro_clicked', {template: this.state.template, plan: chosen || ''});
    if (!currentUser()){ this.signIn(() => this.getPro(chosen), true); return; }
    if (isLifetime()){ this.toast('You already have Pro.'); return; }
    // a yearly member who clicked Get Pro again sees the picker, which offers only the lifetime upgrade
    if (chosen && !(chosen === 'year' && isPro())){
      this.toast('Opening checkout…');
      startCheckout(chosen).catch(err => this.toast(err.message));
      return;
    }
    const pick = (plan, title, price, note) => h('button', {class: 'plan-opt', onclick: async e => {
      e.currentTarget.disabled = true; e.currentTarget.querySelector('.pn').textContent = 'Opening checkout…';
      try { await startCheckout(plan); } catch (err){ this.toast(err.message); e.currentTarget.disabled = false; e.currentTarget.querySelector('.pn').textContent = note; }
    }}, h('b', {}, title), h('span', {class: 'pp'}, price), h('span', {class: 'pn'}, note));
    this.modal(h('h3', {}, 'AlignCanvas Pro'), h('p', {class: 'mp'}, 'Unlimited exports in 4K at 60 and 120 fps, 8K stills and image sequences, Signature templates, videos on cards, your brand kit, text and logo animation, and social presets with safe zones.'),
      // a yearly subscriber only sees the upgrade to lifetime
      isPro() ? null : pick('year', 'Yearly', '$49 / year', 'Just $4 a month, billed once a year. Cancel any time.'),
      pick('lifetime', 'Lifetime', '$199 once', isPro() ? 'Pay once, keep Pro forever. Your yearly plan stops renewing.' : 'Pay once, keep Pro forever. No renewals.'),
      h('div', {class: 'hint'}, 'Secure checkout by Stripe.'),
      h('button', {class: 'ib ghost', style: 'align-self:flex-end', onclick: () => this.closeModal()}, 'Not now'));
  }
  modal(...kids){ const b = $('modalBox'); b.innerHTML = ''; b.append(...kids); $('modal').classList.add('on'); }
  closeModal(){ $('modal').classList.remove('on'); }
  shortcuts(){
    const k = [['Space', 'Play / pause'], ['← →', 'Step one frame (Shift: 10)'], ['Home', 'Back to start'], ['F', 'Fullscreen preview'], ['G', 'Composition guides'],
      ['R', 'Surprise me — random look'], ['T', 'Light / dark theme'], ['E', 'Open export'], ['⌘Z / ⇧⌘Z', 'Undo / redo'], ['Paste / drop', 'Add images or videos']];
    this.modal(h('h3', {}, 'Keyboard shortcuts'), h('div', {class: 'kbd'}, ...k.flatMap(([a, b]) => [h('kbd', {}, a), h('span', {}, b)])),
      h('div', {class: 'row', style: 'justify-content:flex-end'},
        h('button', {class: 'ib', onclick: () => { this.closeModal(); startTour(this); }}, 'Take the tour'),
        h('button', {class: 'btn-primary', onclick: () => this.closeModal()}, 'Done')));
  }

  // real-device smoothness: average frame rate over 10 s of playback, sent for up to 5 templates a session
  perf(now, dt){
    if (!this.playing || document.hidden || dt >= .1){ this.pf = null; return; }
    const tpl = this.state.template, P = this.state.params;
    if (!this.pf || this.pf.tpl !== tpl){ this.pf = {tpl, t: 0, n: 0}; return; }
    this.pf.t += dt; this.pf.n++;
    this.pfSent = this.pfSent || new Set();
    if (this.pf.t < 10 || this.pfSent.has(tpl) || this.pfSent.size >= 5) return;
    this.pfSent.add(tpl);
    track('editor_performance', {template: tpl, fps: Math.round(this.pf.n / this.pf.t), cards: P.count, thick: +(P.thick || 0), glass: !!this.state.style.glass.on,
      canvas: this.canvas.width + 'x' + this.canvas.height, dpr: devicePixelRatio || 1, cores: navigator.hardwareConcurrency || 0});
  }

  /* ---------- export ---------- */
  async runExport(kind, progEl){
    if (this.exporting) return;
    const ex = this.state.export, asp = this.state.frame.aspect, len = clipLength(this.state);
    // exporting needs a (free) account; sizes above the free limit need Pro once the launch week is over
    const size = kind === 'image' ? +ex.scale : kind === 'video' || kind === 'sequence' ? +ex.res : 0;
    const info = {kind, template: this.state.template, category: byId(this.state.template).cat, aspect: asp, size, format: kind === 'video' ? ex.format : kind === 'image' ? ex.img : kind,
      fps: kind === 'video' ? +ex.fps : kind === 'gif' ? +ex.gifFps : kind === 'sequence' ? +ex.seqFps : 0, seconds: +len.toFixed(2), quality: ex.quality, transparent: !!ex.transparent,
      own_images: this.state.media.images.length, glass: !!this.state.style.glass.on, thick: +(this.state.params.thick || 0), bend: +(this.state.params.bend || 0)};
    if (!currentUser()){ track('export_blocked', {...info, reason: 'signed_out'}); this.signIn(() => this.runExport(kind, progEl)); return; }
    const block = (reason, title, body) => { track('export_blocked', {...info, reason}); this.proNeeded({title, body}); };
    const usedUp = () => block('free_used', `You’ve used your ${FREE_EXPORTS} free exports`, 'Go Pro for unlimited exports in 4K at 60 and 120 fps, plus your brand kit, animated text and logo, and social presets.');
    if (exportsLeft() <= 0) return usedUp();
    if (proTemplate(byId(this.state.template))) return block('pro_template', 'Exporting Signature templates is Pro', 'Pick any other template to export it on the free plan.');
    if (kind === 'sequence' && limited()) return block('pro_sequence', 'Image sequences are a Pro feature', 'Pro exports every frame as a PNG, ready for After Effects, Premiere or Resolve.');
    if ((kind === 'video' || kind === 'sequence') && !canExportSize(size)) return block('pro_size', 'This size is a Pro feature', `The free plan exports video up to ${FREE_MAX}p. Pro unlocks 1440p and 4K.`);
    if (kind === 'image' && !canExportStill(size)) return block('pro_size', 'This size is a Pro feature', `The free plan exports stills up to ${FREE_IMG_MAX}p. Pro unlocks 4K, 6K and 8K.`);
    if (kind === 'video' && !canUseFps(+ex.fps)) return block('pro_fps', `${ex.fps} fps is a Pro feature`, `The free plan exports at up to ${FREE_FPS} fps. Pro unlocks 60 and 120 fps.`);
    if (limited() && this.state.style.anim?.on) return block('pro_anim', 'Text and logo animation is a Pro feature', 'Turn off “Animate text and logo” in Output to export on the free plan, or go Pro to keep it.');
    if (limited() && this.state.style.logo?.on) return block('pro_logo', 'Your logo is a Pro feature', 'Turn off the logo in the Text tab to export on the free plan, or go Pro to keep it.');
    if (limited() && this.state.media.images.some(m => m.kind === 'video')) return block('pro_video', 'Videos are a Pro feature', 'Remove the videos from Your media to export on the free plan, or go Pro to keep them.');
    // the export is counted on the server (useExport) once it's rendered, right before it's saved
    track('export_started', info);
    const base = (this.state.name && this.state.name !== 'Untitled project' ? this.state.name : 'aligncanvas-' + this.state.template).replace(/[^\w-]+/g, '-');
    if (kind === 'copy' || kind === 'image'){
      try {
        const [W, H] = sizeFor(asp, kind === 'copy' ? (limited() ? FREE_MAX : 1080) : +ex.scale);
        if (!await useExport()){ this.releaseFrames(); return usedUp(); }
        if (kind === 'copy'){ await X.copyImage(this, {T: this.T, W, H}); track('export_completed', info); this.toast('Frame copied to clipboard'); }
        else { const b = await X.exportImage(this, {T: this.T, W, H, format: ex.img, transparent: ex.transparent}); track('export_completed', {...info, mb: +(b.size / 1048576).toFixed(2)}); const r = await X.download(b, `${base}-${W}x${H}.${ex.img === 'jpeg' ? 'jpg' : ex.img}`); this.toast(r === 'declined' ? 'Save cancelled' : `Saved a ${W}×${H} ${ex.img.toUpperCase()}`); }
      } catch (e){ track('export_failed', {...info, error: e.message || String(e)}); this.toast(e.message || 'Could not export the image'); }
      this.releaseFrames(); this.layout(); this.rebuild(); this.dirty = true;
      return;
    }
    const ctrl = new AbortController(), bar = h('i'), label = h('div', {class: 'hint'}, 'Preparing…');
    this.modal(h('h3', {}, {video: 'Exporting video', gif: 'Exporting GIF', sequence: 'Exporting PNG sequence'}[kind]), label,
      h('div', {class: 'progress'}, bar), h('button', {class: 'ib', style: 'align-self:flex-end', onclick: () => ctrl.abort()}, 'Cancel'));
    this.exporting = true; this.rebuild();
    const t0 = performance.now();
    const onProgress = f => { bar.style.width = (f * 100) + '%'; const el = (performance.now() - t0) / 1000; label.textContent = `${Math.round(f * 100)}%` + (f > .05 ? ` · about ${Math.max(0, el / f - el).toFixed(0)}s left` : ''); };
    let blocked = false;
    try {
      let blob, name;
      if (kind === 'video'){
        const [W, H] = sizeFor(asp, +ex.res);
        blob = await X.exportVideo(this, {format: ex.format, W, H, fps: +ex.fps, quality: ex.quality, duration: len, onProgress, signal: ctrl.signal});
        name = `${base}-${W}x${H}-${ex.fps}fps.${ex.format}`;
      } else if (kind === 'gif'){
        const [a, b] = ASPECTS[asp], W = +ex.gifWidth, H = Math.round(W * b / a / 2) * 2;
        blob = await X.exportGif(this, {W, H, fps: +ex.gifFps, colors: +ex.gifColors, duration: len, onProgress, signal: ctrl.signal});
        name = `${base}-${W}x${H}.gif`;
      } else {
        const [W, H] = sizeFor(asp, +ex.res);
        blob = await X.exportSequence(this, {W, H, fps: +ex.seqFps, duration: len, transparent: ex.transparent, onProgress, signal: ctrl.signal});
        name = `${base}-${W}x${H}-png-sequence.zip`;
      }
      this.closeModal();
      if (!await useExport()){ blocked = true; return; }
      track('export_completed', {...info, render_seconds: +((performance.now() - t0) / 1000).toFixed(1), mb: +(blob.size / 1048576).toFixed(2)});
      const r = await X.download(blob, name);
      if (r === 'declined') this.toast('Save cancelled'); else this.toast(`Exported ${name} · ${(blob.size / 1048576).toFixed(1)} MB in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e){
      if (e.name !== 'AbortError'){ console.error(e); track('export_failed', {...info, error: e.message || String(e), after_seconds: +((performance.now() - t0) / 1000).toFixed(1)}); this.toast(e.message || 'Export failed'); }
      else { track('export_cancelled', {...info, after_seconds: +((performance.now() - t0) / 1000).toFixed(1)}); this.toast('Export cancelled'); }
    } finally {
      this.exporting = false; this.releaseFrames(); this.closeModal(); this.layout(); this.rebuild(); this.dirty = true;
      if (blocked) usedUp();
    }
  }
}

const app = new App();
window.alignCanvas = app;
app.start().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:auto 20px 20px;padding:14px;border-radius:12px;background:#300;color:#fff;z-index:99">AlignCanvas couldn’t start: ${e.message}</div>`); });
