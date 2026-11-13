import { useState, useEffect, useRef } from 'react';
import { useUi } from '../../state/uiStore';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';

const STEPS = [
  {
    id: 'welcome',
    target: '.app',
    title: 'Welcome to AlignCanvas',
    body: 'Create stunning animated videos from your images. This quick tour will show you the basics.',
    position: 'center',
  },
  {
    id: 'rail',
    target: '.rail',
    title: 'Main Navigation',
    body: 'Switch between Motion (templates/controls), Media (your images), Text (titles/labels), and Project (save/open).',
    position: 'right',
  },
  {
    id: 'templates',
    target: '.lp .bigtab[data-tab="templates"]',
    title: 'Templates',
    body: 'Browse 36 templates across 6 categories. Hover to preview, click to apply. Categories: Classic, Transitions, Carousel, Ring, Stack, Glass.',
    position: 'right',
  },
  {
    id: 'controls',
    target: '.lp .bigtab[data-tab="controls"]',
    title: 'Template Controls',
    body: 'Each template has its own parameters. Adjust speed, layout, timing, and more to customize the animation.',
    position: 'right',
  },
  {
    id: 'visual',
    target: '.rp .tabs button[data-tab="visual"]',
    title: 'Visual Style',
    body: '14 effect groups: Background, Cards, Shadow, Shade, Blur, Glass, Card Glass, Lens, Camera, Effects, Title, Labels, Logo, Animation. Every control is live.',
    position: 'left',
  },
  {
    id: 'media',
    target: '.rail button[data-rail="media"]',
    title: 'Media Library',
    body: 'Drag & drop images/videos, or use the stock library. Reorder with drag-and-drop. Click to remove.',
    position: 'right',
  },
  {
    id: 'timeline',
    target: '.timeline',
    title: 'Timeline',
    body: 'Play/pause (Space), step frame (←/→), jump 10 frames (Shift+←/→), restart (Home). Scrub by dragging.',
    position: 'top',
  },
  {
    id: 'export',
    target: '.rail button[data-rail="project"]',
    title: 'Export & Projects',
    body: 'Export MP4, GIF, PNG, or image sequence. Save projects with media inlined. Autosave to IndexedDB every 1.2s.',
    position: 'left',
  },
  {
    id: 'shortcuts',
    target: '.top .mid',
    title: 'Keyboard Shortcuts',
    body: 'Press ? for all shortcuts. Key ones: Space=Play, ←/→=Step, Shift+←/→=10 frames, G=Guides, F=Fullscreen, T=Theme, R=Surprise, Ctrl+Z=Undo.',
    position: 'bottom',
  },
];

export function Tour() {
  const { modal, closeModal, setModal } = useUi();
  const [stepIndex, setStepIndex] = useState(0);
  const holeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  // Find target element
  const targetEl = step ? document.querySelector(step.target) : null;
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

  const next = () => {
    if (isLast) {
      closeModal();
      setModal(null);
      setStepIndex(0);
    } else {
      setStepIndex(i => i + 1);
    }
  };

  const prev = () => {
    if (!isFirst) setStepIndex(i => i - 1);
  };

  const skip = () => {
    closeModal();
    setModal(null);
    setStepIndex(0);
  };

  return (
    <>
      {modal === 'tour' && (
        <>
          {/* Hole overlay */}
          <div
            ref={holeRef}
            className={`tour-hole ${!rect ? 'none' : ''}`}
            style={{ pointerEvents: rect ? 'auto' : 'none' }}
          />
          {/* Tour card */}
          {rect && (
            <div
              ref={cardRef}
              className="tour-card"
              style={{
                left: `${rect.right + 16}px`,
                top: `${rect.top}px`,
              }}
            >
              <div className="tour-step">{stepIndex + 1} / {STEPS.length}</div>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
              <div className="tour-row">
                <div className="tour-dots">
                  {STEPS.map((_, i) => (
                    <span key={i} className={i === stepIndex ? 'on' : ''} />
                  ))}
                </div>
                <div className="tour-btns">
                  <button className="ib ghost sm" onClick={prev} disabled={isFirst}>
                    <ChevronLeftIcon />
                  </button>
                  <button className="ib ghost sm" onClick={skip}>
                    Skip
                  </button>
                  <button className={isLast ? 'btn-primary' : 'ib'} onClick={next}>
                    {isLast ? 'Finish' : <><span>Next</span> <ChevronRightIcon /></>}
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