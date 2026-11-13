// Brand kit (Pro): your colours, fonts and logo, kept in this browser and applied to any template in one click.
// The logo and any font files are blobs in IndexedDB (store.js, kinds 'logo' and 'font'); localStorage keeps
// only their ids.
import * as S from './store.js';

const KEY = 'ac-brand';
const EMPTY = {colors: [], head: '', body: '', logo: '', fonts: []};
export const BUILT_IN_FONTS = ['Inter', 'Instrument Serif', 'Space Grotesk', 'Syne', 'Unbounded', 'Poppins', 'JetBrains Mono'];

export function loadBrand(){
  try { return {...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}')}; } catch (e){ return {...EMPTY}; }
}
export function saveBrand(b){ try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e){} }
export const brandFonts = b => [...BUILT_IN_FONTS, ...b.fonts.map(f => f.name)];

// make the brand kit's uploaded fonts drawable on the canvas
const registered = new Set();
export async function registerFonts(b = loadBrand()){
  for (const f of b.fonts){
    if (registered.has(f.id)) continue;
    try {
      const rec = await S.getMedia(f.id); if (!rec) continue;
      const face = new FontFace(f.name, await rec.blob.arrayBuffer()); await face.load(); document.fonts.add(face); registered.add(f.id);
    } catch (e){ console.warn('Couldn’t load the font', f.name, e); }
  }
}
export async function addFont(file){
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Brand font';
  const face = new FontFace(name, await file.arrayBuffer());
  await face.load(); // throws on a file that isn't a font
  const id = 'font-' + Math.random().toString(36).slice(2, 10);
  await S.putMedia({id, blob: file, kind: 'font', type: file.type, name: file.name, size: file.size});
  document.fonts.add(face); registered.add(id);
  const b = loadBrand(); b.fonts = [...b.fonts.filter(f => f.name !== name), {id, name}]; saveBrand(b);
  return name;
}
// a logo is resized to 1024 px on its long side and kept as a PNG, so transparency survives
export async function addLogo(file){
  const bmp = await createImageBitmap(file), k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const id = 'logo-' + Math.random().toString(36).slice(2, 10);
  await S.putMedia({id, blob, kind: 'logo', type: 'image/png', name: file.name, size: blob.size});
  const b = loadBrand(); b.logo = id; saveBrand(b);
  return id;
}

// the colour from the kit that reads best on `bg` (falls back to white or black)
const lum = hex => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
export function inkFor(bg, colors){
  return [...colors, '#ffffff', '#111111'].reduce((best, c) => contrast(c, bg) > contrast(best, bg) + .5 ? c : best, colors[1] || '#ffffff');
}

// apply the kit to a style: background colours, title and label fonts, a readable title colour, and the logo
export function applyBrand(style, b = loadBrand()){
  if (b.colors.length){
    const c = b.colors; style.bg.c = [0, 1, 2, 3].map(i => c[i % c.length]);
    style.title.color = inkFor(style.bg.c[0], c.slice(1));
  }
  if (b.head) style.title.font = b.head;
  if (b.body) style.labels.font = b.body;
  if (b.logo) style.logo = {...style.logo, on: true, id: b.logo};
  return style;
}
