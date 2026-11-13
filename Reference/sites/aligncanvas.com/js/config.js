// Site-wide settings. Supabase's URL and publishable key are public by design: they only allow what the
// database's row-level security rules allow. Never put a secret or service-role key in this file.
export const SUPABASE_URL = 'https://jqrumbbdscezcbflftat.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_HDWmE5jBnxAD6K9P_F-VhA_1Yxz0FQW';

// Show "Continue with Google" (the Google provider is switched on in Supabase, Authentication → Providers).
export const GOOGLE_SIGN_IN = true;

// Payments: false keeps Get Pro as "coming soon" for everyone. To try checkout before then, open any page with
// ?payments=preview once (?payments=off to stop). Until PAYMENTS_OPEN is set in Vercel, the server only lets
// the PAYMENTS_TESTERS emails check out, with Stripe's test cards (see README).
const PAYMENTS_LAUNCHED = true;
const preview = (() => {
  try {
    const q = new URLSearchParams(location.search).get('payments');
    if (q === 'preview') localStorage.setItem('ac-payments', 'preview');
    if (q === 'off') localStorage.removeItem('ac-payments');
    return localStorage.getItem('ac-payments') === 'preview';
  } catch (e){ return false; }
})();
export const PAYMENTS = PAYMENTS_LAUNCHED || preview;

// Launch week: until this moment everything was free, 4K included. It ended early, on 3 November 2026; since then
// the free plan has the limits below.
export const BETA_FREE_UNTIL = '2026-11-03T00:00:00Z';
// The free plan: videos up to 1080p at 30 fps, stills up to 1440p, images only (no videos on cards), no Signature
// templates, brand kit, text and logo animation, social presets, image sequences or embeds, and 5 exports in all.
// /api/export keeps the count on the server.
export const FREE_MAX = 1080;
export const FREE_IMG_MAX = 1440;
export const FREE_FPS = 30;
export const FREE_EXPORTS = 5;
export const PRO_CATS = ['signature'];
