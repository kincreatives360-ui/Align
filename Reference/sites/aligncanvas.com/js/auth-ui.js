// The sign-in window, shared by the landing page and the editor: sign in with email and password or
// Google, create an account, reset a forgotten password, set a new one. The left panel plays a live
// template on the real engine. openAuth() resolves true once the person is signed in.
import { track } from './analytics.js';
import { initAccount, onAccount, onRecovery, signInWithPassword, signUp, sendPasswordReset, setNewPassword, signInWithGoogle, sendSignInLink } from './account.js';
import { GOOGLE_SIGN_IN } from './config.js';

const base = new URL('..', import.meta.url).href;
if (!document.querySelector('link[data-auth-css]')){
  document.head.append(Object.assign(document.createElement('link'), {rel: 'stylesheet', href: base + 'css/auth.css'}));
  document.head.lastChild.setAttribute('data-auth-css', '');
}
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v); e.append(...kids.filter(k => k != null)); return e; };
const EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const G = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

let open = null;

/* ---------- the live panel ---------- */
async function art(host){
  try {
    const [{ Renderer }, { buildFrame, clipLength }, { newState, applyTemplate }, { loadPhotos }] = await Promise.all([
      import('./renderer.js'), import('./engine.js'), import('./state.js'), import('./faces.js')]);
    const canvas = el('canvas'); host.prepend(canvas);
    const R = new Renderer(canvas); await loadPhotos();
    const ids = ['crate', 'rubik', 'glass-carousel', 'bloom'], A = {state: newState(), images: new Map(), renderer: R};
    let k = 0, T = 0, last = performance.now(), shown = 0, alive = true;
    const pick = () => { applyTemplate(A.state, ids[k]); A.state.style.labels.on = false; T = 0; shown = 0; };
    pick();
    // layout size (not getBoundingClientRect, which the window's pop-in scale distorts), checked every
    // frame so the panel never draws at stale proportions
    const size = () => { const d = Math.min(2, devicePixelRatio || 1), w = Math.max(2, Math.round(canvas.clientWidth * d)), h = Math.max(2, Math.round(canvas.clientHeight * d));
      if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; } };
    size();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = now => {
      if (!alive || !canvas.isConnected) return;
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!still){ T = (T + dt) % clipLength(A.state); shown += dt; if (shown > 6){ k = (k + 1) % ids.length; pick(); } }
      size();
      R.render(buildFrame(A, T, canvas.width, canvas.height));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return () => { alive = false; };
  } catch (e){ return () => {}; }
}

/* ---------- the window ---------- */
export function openAuth({mode = 'signin', reason = ''} = {}){
  track('auth_opened', {mode, reason});
  if (open) open.close(false);
  return new Promise(resolve => {
    initAccount();
    const form = el('div', {class: 'au-form'}), x = el('button', {class: 'au-x', 'aria-label': 'Close'}); x.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const panel = el('div', {class: 'au-art'}, el('img', {class: 'au-brand', src: base + 'brand/logo-on-light.svg', alt: 'AlignCanvas'}), el('div', {class: 'au-cap'}, el('span', {}, '126 motion templates'), el('span', {}, 'Seamless loops')));
    const box = el('div', {class: 'au-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sign in to AlignCanvas'}, panel, form, x);
    const root = el('div', {class: 'au'}, box);
    document.body.append(root); requestAnimationFrame(() => root.classList.add('in'));
    let stopArt = () => {}; art(panel).then(f => stopArt = f);
    const prevFocus = document.activeElement;

    const close = (ok) => {
      if (!open) return; open = null; offAcc(); stopArt();
      root.classList.remove('in'); setTimeout(() => root.remove(), 280);
      document.removeEventListener('keydown', onKey); prevFocus?.focus?.();
      resolve(!!ok);
    };
    const onKey = e => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    x.onclick = () => close(false);
    root.addEventListener('mousedown', e => { if (e.target === root) close(false); });
    open = {close};
    // signed in by any route (password, Google, an email link in another tab): done
    let first = true;
    const offAcc = onAccount(({user}) => { if (first){ first = false; return; } if (user && view !== 'reset') close(true); });

    let view = mode;
    const field = (type, ph, ac) => {
      const i = el('input', {type, placeholder: ph, autocomplete: ac, 'aria-label': ph, required: ''});
      const f = el('div', {class: 'au-field'}, i);
      if (type === 'password'){ const b = el('button', {class: 'au-eye', type: 'button', 'aria-label': 'Show password'}); b.innerHTML = EYE; b.onclick = () => { i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); }; f.append(b); }
      return [f, i];
    };
    const link = (text, to) => el('button', {type: 'button', onclick: () => show(to)}, text);
    const busy = async (btn, label, fn, err) => {
      const was = btn.textContent; btn.disabled = true; btn.textContent = label; err.textContent = '';
      try { await fn(); } catch (e){ err.textContent = e.message; btn.disabled = false; btn.textContent = was; }
    };
    const google = () => GOOGLE_SIGN_IN ? [el('button', {class: 'au-g', type: 'button', onclick: () => signInWithGoogle().catch(e => form.querySelector('.au-err').textContent = e.message)}), el('div', {class: 'au-or'}, 'or')] : [];
    const withG = list => { const g = google(); if (g[0]) g[0].innerHTML = G + '<span>Continue with Google</span>'; return [...g, ...list]; };

    function show(v){
      view = v;
      const err = el('p', {class: 'au-err', role: 'alert'}), step = el('form', {class: 'au-step', novalidate: ''}); step.style.display = 'contents';
      let focus;
      if (v === 'signin' || v === 'signup'){
        const up = v === 'signup';
        const [ef, email] = field('email', 'Email', 'email'), [pf, pass] = field('password', up ? 'Create a password (8+ characters)' : 'Password', up ? 'new-password' : 'current-password');
        const go = el('button', {class: 'au-go', type: 'submit'}, up ? 'Create account' : 'Sign in');
        step.onsubmit = e => { e.preventDefault();
          const em = email.value.trim(), pw = pass.value;
          if (!/^\S+@\S+\.\S+$/.test(em)){ err.textContent = 'Enter a valid email address.'; email.focus(); return; }
          if (up && pw.length < 8){ err.textContent = 'Choose a password of at least 8 characters.'; pass.focus(); return; }
          if (!pw){ err.textContent = 'Enter your password.'; pass.focus(); return; }
          busy(go, up ? 'Creating your account…' : 'Signing in…', async () => {
            if (up){ const r = await signUp(em, pw); if (r === 'confirm') show({sent: 'confirm', email: em}); else close(true); }
            else { await signInWithPassword(em, pw); close(true); }
          }, err);
        };
        step.append(el('h2', {}, up ? 'Create your account' : 'Welcome back'),
          el('p', {class: 'au-sub'}, reason || (up ? 'Free forever. Export your first motion in a minute.' : 'Sign in to export and keep your work.')),
          ...withG([ef, pf]), go, err,
          up ? el('div', {class: 'au-links'}, el('span', {class: 'q'}, 'Already have an account? ', link('Sign in', 'signin')))
             : el('div', {class: 'au-links'}, el('span', {class: 'q'}, 'New to AlignCanvas? ', link('Create account', 'signup')), link('Forgot password?', 'forgot')),
          up ? null : el('div', {class: 'au-links'}, link('Email me a sign-in link instead', 'magic')),
          // Google can create an account from either mode, so both show the agreement; the pages open in a new tab to keep the editor
          el('p', {class: 'au-note'}, 'By continuing you agree to our ', el('a', {href: '/terms', target: '_blank', rel: 'noopener'}, 'Terms'), ' and ',
            el('a', {href: '/privacy', target: '_blank', rel: 'noopener'}, 'Privacy Policy'), ', and to emails about your account.'));
        focus = email;
      } else if (v === 'forgot' || v === 'magic'){
        const magic = v === 'magic', [ef, email] = field('email', 'Email', 'email');
        const go = el('button', {class: 'au-go', type: 'submit'}, magic ? 'Email me a sign-in link' : 'Send reset link');
        step.onsubmit = e => { e.preventDefault(); const em = email.value.trim();
          if (!/^\S+@\S+\.\S+$/.test(em)){ err.textContent = 'Enter a valid email address.'; return; }
          busy(go, 'Sending…', async () => { await (magic ? sendSignInLink(em) : sendPasswordReset(em)); show({sent: magic ? 'magic' : 'reset', email: em}); }, err); };
        step.append(el('h2', {}, magic ? 'Sign in with a link' : 'Reset your password'),
          el('p', {class: 'au-sub'}, magic ? 'We’ll email you a link that signs you straight in.' : 'Enter your email and we’ll send you a link to choose a new password.'),
          ef, go, err, el('div', {class: 'au-links'}, link('Back to sign in', 'signin')));
        focus = email;
      } else if (v === 'reset'){
        const [pf, pass] = field('password', 'New password (8+ characters)', 'new-password'), go = el('button', {class: 'au-go', type: 'submit'}, 'Save new password');
        step.onsubmit = e => { e.preventDefault(); if (pass.value.length < 8){ err.textContent = 'Choose a password of at least 8 characters.'; return; }
          busy(go, 'Saving…', async () => { await setNewPassword(pass.value); close(true); }, err); };
        step.append(el('h2', {}, 'Choose a new password'), el('p', {class: 'au-sub'}, 'You’re signed in. Set a new password for next time.'), pf, go, err);
        focus = pass;
      } else {
        const what = {confirm: ['Confirm your email', `We sent a link to ${v.email}. Open it to activate your account; you’ll come straight back here, signed in.`],
          magic: ['Check your inbox', `We sent a sign-in link to ${v.email}. Open it on this device to come back signed in.`],
          reset: ['Check your inbox', `If there’s an account for ${v.email}, a link to choose a new password is on its way.`]}[v.sent];
        step.append(el('h2', {}, what[0]), el('p', {class: 'au-sub'}, what[1]), el('p', {class: 'au-note'}, 'No email after a minute? Check your spam folder.'),
          el('button', {class: 'au-go', type: 'button', onclick: () => close(false)}, 'Done'), el('div', {class: 'au-links'}, link('Back to sign in', 'signin')));
      }
      form.replaceChildren(step);
      setTimeout(() => focus?.focus(), 60);
    }
    show(mode);
  });
}

// a password-reset link lands on any page: ask for the new password there
onRecovery(() => openAuth({mode: 'reset'}));
