// Product analytics (PostHog, EU region). Every page loads this module; other modules call track(),
// identify() and forget() from it, and those calls queue until PostHog has loaded.
//
// Consent: until the visitor accepts, and after they decline, PostHog runs cookieless: nothing is stored
// on the device, and PostHog's servers derive a daily anonymous id from the IP and browser (the
// project's "cookieless server hash mode"), so one visit's pages still link up. No session replay.
// Accepting switches on cookies and session replay. The choice is kept in localStorage as `ac-consent`.
// Your images: replays block every canvas, every uploaded image (data:/blob: URLs) and the media
// grid, so no image or rendered frame ever reaches PostHog.
//
// Google Analytics 4 runs alongside, under Google Consent Mode v2: storage is denied until the visitor
// accepts (Google then gets cookieless pings only), and ad storage is always denied. It receives the
// key product events below, never emails or arrays.
const KEY = 'phc_pfXVZQu2WJAEL8H52H4jds5qizCQGC23c2jekNEYyyvo';
const SRC = 'https://cdn.jsdelivr.net/npm/posthog-js@1.438.9/dist/module.js';
const CONSENT = 'ac-consent';
const GA = 'G-TRFGQME47X';
// the events Google Analytics also gets (it can count them as key events / conversions)
const GA_EVENTS = new Set(['editor_opened', 'template_selected', 'images_added', 'look_applied', 'export_started', 'export_completed', 'export_failed',
  'auth_opened', 'signup_submitted', 'signed_up', 'signed_in', 'pro_clicked', 'playground_used']);

const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const getConsent = () => { try { return localStorage.getItem(CONSENT); } catch (e){ return null; } };
const setConsent = v => { try { localStorage.setItem(CONSENT, v); } catch (e){} };

let ph = null;
const queue = [];
const run = f => { if (ph) { try { f(ph); } catch (e){} } else queue.push(f); };

/* ---------- Google Analytics 4 ---------- */
const gtag = function(){ (window.dataLayer = window.dataLayer || []).push(arguments); };
function loadGA(){
  if (local) return;
  const granted = getConsent() === 'yes' ? 'granted' : 'denied';
  gtag('consent', 'default', {analytics_storage: granted, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  gtag('js', new Date());
  gtag('config', GA);
  document.head.append(Object.assign(document.createElement('script'), {async: true, src: 'https://www.googletagmanager.com/gtag/js?id=' + GA}));
}
const gaConsent = v => { if (!local) gtag('consent', 'update', {analytics_storage: v}); };
// GA wants flat, short parameters: keep strings, numbers and booleans, trimmed to its limits
function gaEvent(event, props){
  if (local || !GA_EVENTS.has(event)) return;
  const out = {};
  for (const [k, v] of Object.entries(props)) if (['string', 'number', 'boolean'].includes(typeof v)) out[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 100) : v;
  gtag('event', event, out);
}

export const track = (event, props = {}) => { gaEvent(event, props); run(p => p.capture(event, props)); };
// GA gets the opaque account id only (never the email), so its reports can count users across devices
export const identify = (id, props = {}) => { if (!local) gtag('set', {user_id: id}); run(p => p.identify(id, props)); };
export const forget = () => { if (!local) gtag('set', {user_id: null}); run(p => p.reset()); };
export const consent = getConsent;

async function load(){
  try {
    const { default: posthog } = await import(SRC);
    const choice = getConsent(), yes = choice === 'yes';
    posthog.init(KEY, {
      api_host: 'https://eu.i.posthog.com', ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      // cookieless until the visitor opts in: pending counts as "rejected" for cookieless purposes
      cookieless_mode: 'on_reject', opt_out_capturing_by_default: true,
      persistence: 'localStorage+cookie',
      autocapture: true, capture_pageview: true, capture_pageleave: true,
      enable_heatmaps: true, capture_exceptions: true,
      disable_session_recording: !yes,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '.ph-mask',
        blockSelector: 'canvas, img[src^="data:"], img[src^="blob:"], .media-grid, .mitem, .ph-no-capture',
      },
      // local testing never pollutes the real numbers
      before_send: local ? () => null : undefined,
    });
    if (yes) posthog.opt_in_capturing({captureEventName: false});
    else if (choice === 'no') posthog.opt_out_capturing();
    posthog.register({app_section: location.pathname.startsWith('/create') ? 'editor' : location.pathname === '/' ? 'landing' : 'site',
      theme: document.documentElement.dataset.theme || ''});
    ph = posthog;
    queue.splice(0).forEach(f => { try { f(ph); } catch (e){} });
  } catch (e){ /* blocked or offline: the site works the same without analytics */ }
}

function accept(){
  setConsent('yes');
  gaConsent('granted');
  run(p => { p.opt_in_capturing({captureEventName: 'consent_given'}); p.set_config({disable_session_recording: false}); p.startSessionRecording(); });
}
function decline(){
  setConsent('no');
  gaConsent('denied');
  run(p => { p.stopSessionRecording?.(); p.set_config({disable_session_recording: true}); p.opt_out_capturing(); });
}

/* ---------- the consent card ---------- */
const CSS = `
.ac-consent{position:fixed;left:16px;bottom:16px;z-index:2147483000;width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:16px 16px 14px;border-radius:16px;
  font:400 13px/1.5 Inter,system-ui,sans-serif;color:#111;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 24px 60px -24px rgba(0,0,0,.35);
  transform:translateY(12px);opacity:0;transition:opacity .35s ease,transform .35s cubic-bezier(.2,.7,.1,1)}
.ac-consent.on{transform:none;opacity:1}
[data-theme="dark"] .ac-consent{color:#ececef;background:#161618;border-color:rgba(255,255,255,.09)}
.ac-consent b{display:block;font-weight:600;font-size:14px;margin-bottom:4px}
.ac-consent p{margin:0 0 12px;color:inherit;opacity:.72}
.ac-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.ac-consent .r{display:flex;gap:8px;justify-content:flex-end}
.ac-consent button{font:600 13px Inter,system-ui,sans-serif;border-radius:99px;padding:8px 16px;cursor:pointer;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit}
.ac-consent button.y{background:#0055ff;border-color:#0055ff;color:#fff}`;
function card(){
  if (document.querySelector('.ac-consent')) return;
  if (!document.getElementById('ac-consent-css')) document.head.append(Object.assign(document.createElement('style'), {id: 'ac-consent-css', textContent: CSS}));
  const root = location.pathname.startsWith('/create') ? '../' : '';
  const el = document.createElement('div');
  el.className = 'ac-consent'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Analytics cookies');
  el.innerHTML = `<b>Help us improve AlignCanvas</b><p>We'd like to use analytics cookies (PostHog and Google Analytics) and session replays to see how the site is used. Your images are never recorded. <a href="${root}cookies">Cookie Policy</a></p>
    <div class="r"><button type="button" class="n">Decline</button><button type="button" class="y">Accept</button></div>`;
  const done = f => () => { f(); el.classList.remove('on'); setTimeout(() => el.remove(), 350); };
  el.querySelector('.y').onclick = done(accept);
  el.querySelector('.n').onclick = done(decline);
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
}
// any link or button marked data-consent reopens the choice (the "Cookie settings" footer link)
document.addEventListener('click', e => { const a = e.target.closest?.('[data-consent]'); if (a){ e.preventDefault(); card(); } });

loadGA();
load();
if (!getConsent()) (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', card, {once: true}) : setTimeout(card, 600));
