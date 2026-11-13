// Cloud projects: opt-in, one project at a time. A synced project's state is a row in `cloud_projects` and its
// uploaded media (and logo) are files in the private `media` Storage bucket, under <user id>/<media id>.
// Projects that aren't synced, and everything else, stay in this browser only. Last write wins.
import * as S from './store.js';
import { supabase, currentUser } from './account.js';

const BUCKET = 'media', MAX_FILE = 50 * 1048576;
const ready = () => {
  const sb = supabase(), u = currentUser();
  if (!sb || !u) throw new Error('Sign in to keep projects in the cloud.');
  return {sb, u};
};
// media this browser already uploaded, so each file goes up once
const upKey = () => 'ac-cloud-up-' + currentUser()?.id;
const uploaded = () => { try { return new Set(JSON.parse(localStorage.getItem(upKey()) || '[]')); } catch (e){ return new Set(); } };
const remember = set => { try { localStorage.setItem(upKey(), JSON.stringify([...set])); } catch (e){} };
const toDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const fail = (what, error) => new Error(`${what}: ${error?.message || 'please try again'}`);

// upload a project and any of its media the cloud doesn't have yet; returns how many files were too big to sync
export async function push(rec){
  const {sb, u} = ready(), done = uploaded();
  let skipped = 0;
  for (const id of S.mediaIds(rec.state)){
    if (done.has(id)) continue;
    const m = await S.getMedia(id).catch(() => null);
    if (!m) continue;
    if (m.size > MAX_FILE){ skipped++; continue; }
    const { error } = await sb.storage.from(BUCKET).upload(`${u.id}/${id}`, m.blob, {contentType: m.type || 'application/octet-stream', upsert: true});
    if (error) throw fail('Couldn’t upload ' + (m.name || 'a file'), error);
    done.add(id); remember(done);
  }
  const { error } = await sb.from('cloud_projects').upsert({user_id: u.id, id: rec.id, name: rec.name, state: rec.state,
    thumb: rec.thumb ? await toDataURL(rec.thumb) : null, rev: rec.rev || 1, updated: new Date(rec.updated || Date.now()).toISOString()});
  if (error) throw fail('Couldn’t sync the project', error);
  return skipped;
}

// the account's cloud projects, newest first (without their state)
export async function list(){
  const sb = supabase(); if (!sb || !currentUser()) return [];
  const { data, error } = await sb.from('cloud_projects').select('id, name, thumb, rev, updated').order('updated', {ascending: false});
  if (error){ console.warn('Cloud projects are unavailable:', error.message); return []; }
  return data.map(r => ({...r, updated: Date.parse(r.updated)}));
}

const pulling = new Set();
// bring a cloud project into this browser, with any media it's missing
export async function pull(id){
  const {sb, u} = ready();
  const { data: row, error } = await sb.from('cloud_projects').select('*').eq('id', id).maybeSingle();
  if (error || !row) throw fail('Couldn’t open the project from the cloud', error);
  const done = uploaded(), kinds = new Map((row.state?.media?.images || []).map(m => [m.id, m.kind]));
  let missing = 0;
  for (const mid of S.mediaIds(row.state)){
    if (await S.hasMedia(mid).catch(() => false)){ done.add(mid); continue; }
    const { data: blob, error: e } = await sb.storage.from(BUCKET).download(`${u.id}/${mid}`);
    if (e || !blob){ missing++; continue; }
    const kind = kinds.get(mid) || (mid.startsWith('logo-') ? 'logo' : 'image');
    await S.putMedia({id: mid, blob, kind, type: blob.type, name: mid, size: blob.size});
    done.add(mid);
  }
  remember(done);
  const thumb = row.thumb ? await (await fetch(row.thumb)).blob() : null;
  const local = await S.getProject(id).catch(() => null);
  pulling.add(id);
  try { await S.putProjectAsIs({...(local || {created: Date.parse(row.updated)}), id, name: row.name, state: row.state, thumb, rev: row.rev, updated: Date.parse(row.updated), cloud: true}); }
  finally { pulling.delete(id); }
  return missing;
}

// remove a project from the cloud, and any of its files no other cloud project uses
export async function remove(id){
  const {sb, u} = ready();
  const { data: row } = await sb.from('cloud_projects').select('state').eq('id', id).maybeSingle();
  const { error } = await sb.from('cloud_projects').delete().eq('id', id);
  if (error) throw fail('Couldn’t remove it from the cloud', error);
  if (!row) return;
  const { data: rest } = await sb.from('cloud_projects').select('state');
  const keep = new Set((rest || []).flatMap(r => S.mediaIds(r.state)));
  const drop = S.mediaIds(row.state).filter(m => !keep.has(m));
  if (drop.length) await sb.storage.from(BUCKET).remove(drop.map(m => `${u.id}/${m}`));
  const done = uploaded(); drop.forEach(m => done.delete(m)); remember(done);
}

// keep synced projects up to date: a few seconds after a synced project is saved here, push it
const timers = new Map();
export function watch(onError){
  S.onChange(({store, id, op}) => {
    if (store !== 'projects' || op !== 'put' || pulling.has(id) || !currentUser()) return;
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(async () => {
      timers.delete(id);
      const rec = await S.getProject(id).catch(() => null);
      if (rec?.cloud) push(rec).catch(onError);
    }, 2500));
  });
}
