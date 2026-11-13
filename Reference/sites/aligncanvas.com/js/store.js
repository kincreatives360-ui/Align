// Local storage for user media and saved projects, in IndexedDB (localStorage can't hold blobs).
//
//   media    {id, blob, kind: 'image'|'video', type, name, size, created, updated}
//   projects {id, name, state, thumb: Blob, created, updated, rev}
//
// A project's state names its media by id only, so projects share blobs and a duplicate costs nothing.
// Media no project or working copy refers to is dropped by gc().
//
// Cloud sync (cloud.js): every record carries `updated` and projects a `rev`, and every write goes
// through put()/del() here, which tell onChange() listeners {store, id, op}. A sync module can push those
// changes to the user's account (Supabase table rows + Storage objects named by media id) and write
// pulled records back through the same functions, keeping the newer `updated` on conflict.
const DB = 'aligncanvas', VER = 1;
let dbP = null;
const open = () => dbP || (dbP = new Promise((res, rej) => {
  if (!('indexedDB' in window)){ rej(new Error('IndexedDB is not available')); return; }
  const r = indexedDB.open(DB, VER);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', {keyPath: 'id'});
    if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', {keyPath: 'id'}).createIndex('updated', 'updated');
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.onblocked = () => rej(new Error('Storage is busy in another tab'));
}).catch(e => { dbP = null; throw e; }));

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx(store, mode, fn){
  const d = await open(), t = d.transaction(store, mode), out = await fn(t.objectStore(store));
  if (mode === 'readwrite') await new Promise((res, rej) => { t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error || new Error('Storage write failed')); });
  return out;
}

const subs = new Set();
export const onChange = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = (store, id, op) => subs.forEach(f => { try { f({store, id, op}); } catch (e){} });

export const available = () => open().then(() => true, () => false);
const get = (store, id) => tx(store, 'readonly', s => req(s.get(id)));
const all = store => tx(store, 'readonly', s => req(s.getAll()));
async function put(store, rec){ rec.updated = rec.updated || Date.now(); await tx(store, 'readwrite', s => req(s.put(rec))); emit(store, rec.id, 'put'); return rec; }
async function del(store, id){ await tx(store, 'readwrite', s => req(s.delete(id))); emit(store, id, 'delete'); }

/* ---------- media ---------- */
export const getMedia = id => get('media', id);
export const putMedia = rec => put('media', {created: Date.now(), ...rec, updated: Date.now()});
export const delMedia = id => del('media', id);
export const hasMedia = async id => !!(await tx('media', 'readonly', s => req(s.getKey(id))));

/* ---------- projects ---------- */
// newest first; the list skips state so it stays light
export async function listProjects(){
  const list = await all('projects');
  return list.map(({state, ...p}) => ({...p, count: state?.media?.images?.length || 0})).sort((a, b) => b.updated - a.updated);
}
export const getProject = id => get('projects', id);
export const putProject = p => put('projects', {...p, updated: Date.now(), rev: (p.rev || 0) + 1});
export const delProject = id => del('projects', id);
// a project as it came from the cloud: its own `updated` and `rev` are kept
export const putProjectAsIs = p => put('projects', p);

// media ids a state refers to (uploaded media only; library items are files on the site), and its logo
export const mediaIds = state => [...(state?.media?.images || []).filter(m => !m.lib).map(m => m.id), ...(state?.style?.logo?.id ? [state.style.logo.id] : [])];

// drop media that neither the working copy nor any saved project uses; `keep` is the working copy's ids.
// Only records more than a day old are touched, so media added while it runs is safe.
export async function gc(keep = []){
  // only media older than a day is dropped, and the shared autosave counts as in use, so another open
  // tab's unsaved work never loses its videos or images
  const t0 = Date.now() - 864e5, used = new Set(keep);
  try { mediaIds(JSON.parse(localStorage.getItem('aligncanvas-v1') || 'null')).forEach(id => used.add(id)); } catch (e){}
  (await all('projects')).forEach(p => mediaIds(p.state).forEach(id => used.add(id)));
  // the brand kit's logo and fonts
  try { const b = JSON.parse(localStorage.getItem('ac-brand') || '{}'); [b.logo, ...(b.fonts || []).map(f => f.id)].filter(Boolean).forEach(id => used.add(id)); } catch (e){}
  const ids = await tx('media', 'readonly', s => req(s.getAllKeys()));
  let n = 0;
  for (const id of ids){
    if (used.has(id)) continue;
    const m = await getMedia(id);
    if (m && (m.created || 0) < t0){ await delMedia(id); n++; }
  }
  return n;
}
