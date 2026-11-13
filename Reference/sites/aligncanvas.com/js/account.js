// Accounts: Supabase sign-in (email link, optionally Google) and the plan on the user's profile row.
// The tool works without an account; signing in is only needed to export. Supabase loads from a CDN,
// so if it can't load (offline, blocked) everything else keeps working.
import { SUPABASE_URL, SUPABASE_KEY, BETA_FREE_UNTIL, FREE_MAX, FREE_IMG_MAX, FREE_FPS, FREE_EXPORTS, PRO_CATS } from './config.js';
import { track, identify, forget } from './analytics.js';

let sb = null, user = null, profile = null, recovering = false;
const listeners = new Set(), recoveryListeners = new Set();
const emit = () => listeners.forEach(f => f({user, profile}));
// link analytics to the account; a first sign-in within ten minutes of the account being created is the sign-up
function seen(){
  if (!user) return;
  const method = user.app_metadata?.provider || 'email';
  identify(user.id, {email: user.email, plan: profile?.plan || 'free', signup_method: method, created_at: user.created_at});
  const key = 'ac-su-' + user.id;
  try { if (!localStorage.getItem(key) && Date.now() - Date.parse(user.created_at) < 6e5){ localStorage.setItem(key, '1'); track('signed_up', {method}); } } catch (e){}
}

export const onAccount = f => { listeners.add(f); f({user, profile}); return () => listeners.delete(f); };
export const currentUser = () => user;
// the Supabase client once it has loaded (null before that, or when it couldn't load), for cloud.js
export const supabase = () => sb;
// the name to show for an account: the name the sign-in provider gave (Google), else the email's first part
const clean = v => typeof v === 'string' && v.trim() && !/^(null|undefined)$/i.test(v.trim()) ? v.trim() : '';
export function displayName(u = user){
  const m = u?.user_metadata || {};
  return clean(m.full_name) || clean(m.name) || clean([clean(m.given_name), clean(m.family_name)].filter(Boolean).join(' ')) || clean(m.user_name)
    || (clean(u?.email) ? u.email.split('@')[0] : 'Your account');
}
// the provider's profile photo (https only), or '' for initials
export const avatarUrl = (u = user) => { const a = clean(u?.user_metadata?.avatar_url) || clean(u?.user_metadata?.picture); return /^https:\/\//.test(a) ? a : ''; };
export const initials = (u = user) => displayName(u).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
export const inBeta = () => Date.now() < Date.parse(BETA_FREE_UNTIL);
export const isLifetime = () => !!profile?.lifetime;
// when a yearly plan's paid period ends (it renews then, unless cancelled)
export const proUntil = () => profile?.pro_until ? new Date(profile.pro_until) : null;
export const isPro = () => !!profile && profile.plan === 'pro' && (!profile.pro_until || Date.parse(profile.pro_until) > Date.now());
// true while the free plan's limits apply: after the launch week, for anyone without Pro
export const limited = () => !inBeta() && !isPro();
// can this account export a video or sequence at `size` pixels (short side), a still at `size`, at `fps`?
export const canExportSize = size => size <= FREE_MAX || !limited();
export const canExportStill = size => size <= FREE_IMG_MAX || !limited();
export const canUseFps = fps => fps <= FREE_FPS || !limited();
export const proTemplate = t => limited() && PRO_CATS.includes(t?.cat);
// free exports left (Infinity with Pro or during the launch week)
export const exportsLeft = () => limited() ? Math.max(0, FREE_EXPORTS - (profile?.exports_used || 0)) : Infinity;
// count one finished export on the server before it's saved; false when the free exports are used up
export async function useExport(){
  if (!limited()) return true;
  const { data } = await sb.auth.getSession(), token = data.session?.access_token;
  if (!token) throw new Error('Please sign in first.');
  const r = await fetch('/api/export', {method: 'POST', headers: {Authorization: `Bearer ${token}`}});
  const out = await r.json().catch(() => ({}));
  if (out.pro){ await loadProfile(); emit(); return true; }
  if (r.status === 402 || out.ok === false){ profile = {...profile, exports_used: FREE_EXPORTS}; emit(); return false; }
  if (!r.ok) throw new Error(out.error || 'Couldn’t reach AlignCanvas to count this export. Please try again.');
  profile = {...profile, exports_used: out.used}; emit();
  return true;
}

async function loadProfile(){
  profile = null;
  if (!user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  profile = data || {plan: 'free'};
}

// safe to call from several places: the first call loads Supabase, the rest share it
let starting = null;
export const initAccount = () => starting || (starting = start());
async function start(){
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}});
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
    await loadProfile(); seen(); emit();
    sb.auth.onAuthStateChange(async (event, session) => {
      // a password-reset link signs the person in and asks for a new password
      if (event === 'PASSWORD_RECOVERY'){ recovering = true; recoveryListeners.forEach(f => f()); }
      const next = session?.user || null;
      if ((next?.id || null) === (user?.id || null) && profile) return;
      user = next; await loadProfile(); seen(); emit();
      if (user && event === 'SIGNED_IN') track('signed_in', {method: user.app_metadata?.provider || 'email'});
    });
  } catch (e){ console.warn('Accounts are unavailable right now:', e); }
  return !!sb;
}

const back = () => location.origin + (location.pathname.startsWith('/create') ? '/create' : '/');
// Supabase's messages, in plain words
function friendly(error){
  const m = (error?.message || '').toLowerCase();
  track('auth_error', {message: error?.message || ''});
  if (m.includes('invalid login')) return 'That email and password don’t match. Try again, or reset your password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link we sent.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'There’s already an account with this email. Sign in instead.';
  if (m.includes('password should be') || m.includes('weak')) return 'Choose a longer password: at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a minute and try again.';
  if (m.includes('provider is not enabled')) return 'Google sign-in isn’t switched on yet. Use your email for now.';
  return error?.message || 'Something went wrong. Please try again.';
}
const ready = () => { if (!sb) throw new Error('Sign-in is unavailable right now. Check your connection and try again.'); };
export const onRecovery = f => { recoveryListeners.add(f); if (recovering) f(); return () => recoveryListeners.delete(f); };

export async function signInWithPassword(email, password){
  ready();
  const { error } = await sb.auth.signInWithPassword({email, password});
  if (error) throw new Error(friendly(error));
}
// returns 'signed-in' when the project doesn't ask for email confirmation, otherwise 'confirm'
export async function signUp(email, password){
  ready();
  const { data, error } = await sb.auth.signUp({email, password, options: {emailRedirectTo: back()}});
  if (error) throw new Error(friendly(error));
  // Supabase hides whether an address exists; an existing one comes back with no identities
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(friendly({message: 'already registered'}));
  track('signup_submitted', {method: 'email', needs_confirmation: !data.session});
  return data.session ? 'signed-in' : 'confirm';
}
export async function sendPasswordReset(email){
  ready();
  const { error } = await sb.auth.resetPasswordForEmail(email, {redirectTo: back()});
  if (error) throw new Error(friendly(error));
}
export async function setNewPassword(password){
  ready();
  const { error } = await sb.auth.updateUser({password});
  if (error) throw new Error(friendly(error));
  recovering = false;
}

// email sign-in link; the link brings the person straight back to the page they were on
export async function sendSignInLink(email){
  if (!sb) throw new Error('Sign-in is unavailable right now. Check your connection and try again.');
  const { error } = await sb.auth.signInWithOtp({email, options: {emailRedirectTo: back()}});
  if (error) throw new Error(friendly(error));
  track('signin_link_sent');
}
export async function signInWithGoogle(){
  if (!sb) throw new Error('Sign-in is unavailable right now.');
  track('google_clicked');
  const { error } = await sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: back()}});
  if (error) throw new Error(friendly(error));
}
// re-read the plan, e.g. after returning from Stripe (the webhook can land a few seconds later)
export async function refreshPlan(tries = 1){
  for (let k = 0; k < tries; k++){
    await loadProfile(); emit();
    if (isPro() || k === tries - 1) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return isPro();
}
// call one of the Stripe functions in /api and go to the page it returns
async function stripePage(path, body = {}){
  const { data } = await sb.auth.getSession(), token = data.session?.access_token;
  if (!token) throw new Error('Please sign in first.');
  const r = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, body: JSON.stringify(body)});
  const out = await r.json().catch(() => ({}));
  if (!r.ok || !out.url) throw new Error(out.error || 'Payments are unavailable right now. Please try again in a moment.');
  location.href = out.url;
}
export const startCheckout = plan => stripePage('/api/checkout', {plan});
export const openBilling = () => stripePage('/api/portal');
export async function signOut(){ if (sb) await sb.auth.signOut(); track('signed_out'); forget(); user = null; profile = null; emit(); }
