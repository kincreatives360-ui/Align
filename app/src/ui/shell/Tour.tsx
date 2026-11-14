import { useState, useEffect, useRef } from 'react';
import { useUi } from '../../state/uiStore';

type Rail = 'motion' | 'media' | 'text' | 'project';

interface TourStep {
  sel?: string;
  rail?: Rail;
  title: string;
  text: string;
  last?: boolean;
}

const STEPS: TourStep[] = [
  { title: 'Welcome to AlignCanvas', text: 'Turn your images and videos into 3D motion in a few clicks. This quick tour shows you around; it takes about 30 seconds.' },
  { sel: '#left', rail: 'motion', title: 'Pick a template', text: 'Templates are grouped by style. Click any one to see it play on the canvas straight away.' },
  { sel: '#rail [data-k="media"]', title: 'Add your media', text: 'Upload images or videos, or pick from the AlignCanvas library. You can also drop files anywhere on the page.' },
  { sel: '#view', title: 'Live preview', text: 'This is your composition, rendered in real time. Press Space to play or pause.' },
  { sel: '#timeline', title: 'Timeline', text: 'Scrub through the loop. Every template loops seamlessly, so exports repeat without a jump.' },
  { sel: '#right', title: 'Style it', text: 'One-click looks, backgrounds, liquid glass, blur and more. Changes show instantly.' },
  { sel: '#left .bigtab:nth-child(2)', rail: 'motion', title: 'Fine-tune the motion', text: 'Under Controls: speed, card count, spacing, bend, camera angle and each template\'s own settings.' },
  { sel: '#rail [data-k="project"]', title: 'Save your projects', text: 'Save your work as a project and come back to it any time. Projects stay in this browser.' },
  { sel: '#exportTop', title: 'Export', text: 'When it looks right, export an MP4, GIF, image or PNG sequence.', last: true },
];

const TOUR_KEY = 'ac-tour';
const SEEN_KEY = 'ac-seen';

export function tourSeen(): boolean {
  try { return !!localStorage.getItem(TOUR_KEY); } catch { return true; }
}

export function Tour() {
  const { modal, closeModal, setModal, setRail } = useUi();
  const [stepIndex, setStepIndex] = useState(0);
  const holeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const targetEl = step?.sel ? document.querySelector(step.sel) : null;
  const rect = targetEl?.getBoundingClientRect();

  useEffect(() => {
    if (!step) return;
    if (holeRef.current && rect) {
      holeRef.current.style.left = `${rect.left}px`;
      holeRef.current.style.top = `${rect.top}px`;
      holeRef.current.style.width = `${rect.width}px`;
      holeRef.current.style.height = `${rect.height}px`;
    }
  }, [step, rect]);

  const done = () => {
    holeRef.current?.remove();
    cardRef.current?.remove();
    window.removeEventListener('resize', place);
    window.removeEventListener('keydown', key, true);
    try { localStorage.setItem(TOUR_KEY, '1'); localStorage.setItem(SEEN_KEY, '1'); } catch {}
    closeModal();
    setModal(null);
    setStepIndex(0);
  };

  const go = (d: number) => {
    setStepIndex(i => Math.max(0, Math.min(STEPS.length - 1, i + d)));
  };

  function show() {
    const s = STEPS[stepIndex];
    if (s.rail) {
      setRail(s.rail);
    }
    place();
    const btn = cardRef.current?.querySelector('.btn-primary');
    if (btn instanceof HTMLElement) btn.focus();
  }

  function place() {
    const s = STEPS[stepIndex];
    const el = s.sel ? document.querySelector(s.sel) : null;
    const W = innerWidth, H = innerHeight, cw = Math.min(320, W - 24);
    const card = cardRef.current;
    const hole = holeRef.current;
    if (!card || !hole) return;
    card.style.width = cw + 'px';
    if (!el) {
      hole.className = 'tour-hole none';
      card.style.left = (W - cw) / 2 + 'px';
      card.style.top = Math.max(12, (H - card.offsetHeight) / 2) + 'px';
      return;
    }
    const r = el.getBoundingClientRect(), pad = 6, ch = card.offsetHeight;
    hole.className = 'tour-hole';
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const room = { right: W - r.right, left: r.left, bottom: H - r.bottom, top: r.top }, gap = 16;
    const side = room.right >= cw + gap * 2 ? 'right' : room.left >= cw + gap * 2 ? 'left' : room.bottom >= ch + gap * 2 ? 'bottom' : 'top';
    let x, y;
    if (side === 'right' || side === 'left') { x = side === 'right' ? r.right + gap : r.left - gap - cw; y = r.top + Math.min(r.height, 220) / 2 - ch / 2; }
    else { x = r.left + r.width / 2 - cw / 2; y = side === 'bottom' ? r.bottom + gap : r.top - gap - ch; }
    card.style.left = Math.max(12, Math.min(W - cw - 12, x)) + 'px';
    card.style.top = Math.max(12, Math.min(H - ch - 12, y)) + 'px';
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); STEPS[stepIndex].last ? done() : go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (stepIndex > 1) go(-1); }
  }

  useEffect(() => {
    window.addEventListener('resize', place);
    window.addEventListener('keydown', key, true);
    show();
    return () => { window.removeEventListener('resize', place); window.removeEventListener('keydown', key, true); };
  }, [stepIndex]);

  return (
    <>
      {modal === 'tour' && (
        <>
          <div ref={holeRef} className={`tour-hole ${!rect ? 'none' : ''}`} style={{ pointerEvents: rect ? 'auto' : 'none' }} />
          {rect && (
            <div ref={cardRef} className="tour-card" role="dialog" aria-live="polite">
              <div className="tour-step">{stepIndex} of {STEPS.length - 1}</div>
              <h4>{step.title}</h4>
              <p>{step.text}</p>
              <div className="tour-row">
                <div className="tour-dots">
                  {STEPS.slice(1).map((_, k) => <span key={k} className={k + 1 === stepIndex ? 'on' : ''} />)}
                </div>
                <div className="tour-btns">
                  {step.last ? null : <button className="ib ghost" onClick={done}>{isFirst ? 'Not now' : 'Skip'}</button>}
                  {stepIndex > 1 && <button className="ib" onClick={() => go(-1)}>Back</button>}
                  <button className={isLast ? 'btn-primary' : 'ib'} onClick={() => isLast ? done() : go(1)}>
                    {isLast ? 'Start creating' : isFirst ? 'Show me around' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="modal-backdrop" onClick={() => setModal('tour')} style={{ display: modal === 'tour' ? 'none' : 'block' }} />
    </>
  );
}