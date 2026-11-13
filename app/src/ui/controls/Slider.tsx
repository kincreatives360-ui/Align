import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Row } from './Row';
import type { RangeControl } from '../../state/controls';

interface Props {
  def: RangeControl;
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
}

const digits = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

function clampSnap(value: number, def: RangeControl): number {
  const { min, max, step } = def;
  const raw = Math.max(min, Math.min(max, value));
  const snapped = Math.round(raw / step) * step;
  return Number(snapped.toFixed(6));
}

function display(value: number, def: RangeControl): string {
  if (value === 0 && def.zeroLabel) return def.zeroLabel;
  switch (def.format) {
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'multiplier':
      return `${value.toFixed(2)}×`;
    case 'degrees':
      return `${Math.round(value)}°`;
    case 'turns':
      return `${value.toFixed(2)} turns`;
    case 'seconds':
      return `${value.toFixed(2)}s`;
    case 'cycles':
      return `${Math.round(value)}× per loop`;
    default:
      return value.toFixed(digits(def.step));
  }
}

/**
 * A slider drawn from three divs, exactly like the reference.
 *
 * Behaviour worth keeping: Shift+drag is 15% sensitivity for fine work,
 * arrow keys nudge by one step (ten with Shift), a double-click opens a box
 * for an exact number, and `onCommit` fires once per gesture so undo sees a
 * single step no matter how far you dragged.
 */
export function Slider({ def, value, onChange, onCommit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { min, max, step } = def;
  const t = max > min ? (value - min) / (max - min) : 0;
  const clamped = Math.max(0, Math.min(1, t));

  /**
   * Keyboard changes arrive one per keypress, but holding an arrow key is
   * ONE gesture to the user. Commit on a short delay instead of immediately,
   * so a burst of presses collapses into a single undo step.
   */
  const scheduleCommit = () => {
    if (commitTimer.current !== null) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      onCommit();
    }, 500);
  };

  const cancelScheduledCommit = () => {
    if (commitTimer.current !== null) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  };

  useEffect(() => cancelScheduledCommit, []);

  const fromX = (clientX: number): number => {
    const el = rootRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return min + frac * (max - min);
  };

  const startEdit = () => {
    setDraft(value.toFixed(digits(step)));
    setEditing(true);
    requestAnimationFrame(() => {
      const input = rootRef.current?.querySelector('input');
      input?.focus();
      input?.select();
    });
  };

  const finishEdit = (ok: boolean) => {
    if (ok) {
      const parsed = parseFloat(draft);
      if (!Number.isNaN(parsed)) {
        const next = def.format === 'percent' && draft.includes('%') ? parsed / 100 : parsed;
        onChange(clampSnap(next, def));
      }
      onCommit();
    }
    setEditing(false);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const el = rootRef.current;
    if (!el) return;

    // The pointer gesture commits itself on release; cancel any pending
    // keyboard commit so it cannot push a second snapshot.
    cancelScheduledCommit();
    el.setPointerCapture(e.pointerId);
    el.focus();

    const startX = e.clientX;
    const startValue = value;
    let moved = false;

    // Native listeners (not React's) so pointer capture on this element
    // keeps delivering moves and the release, even outside it.
    const move = (ev: globalThis.PointerEvent) => {
      moved = moved || Math.abs(ev.clientX - startX) > 2;
      if (ev.shiftKey) {
        const rect = el.getBoundingClientRect();
        const delta = ((ev.clientX - startX) / rect.width) * (max - min) * 0.15;
        onChange(clampSnap(startValue + delta, def));
      } else {
        onChange(clampSnap(fromX(ev.clientX), def));
      }
    };

    const up = (ev: globalThis.PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) onChange(clampSnap(fromX(ev.clientX), def));
      onCommit();
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const big = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      onChange(clampSnap(value + step * big, def));
      e.preventDefault();
      scheduleCommit();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      onChange(clampSnap(value - step * big, def));
      e.preventDefault();
      scheduleCommit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      cancelScheduledCommit();
      startEdit();
    }
  };

  return (
    <Row label={def.label} hint={def.hint}>
      <div
        ref={rootRef}
        className="sl"
        role="slider"
        tabIndex={0}
        aria-label={def.label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display(value, def)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={startEdit}
      >
        <div className="fi" style={{ width: `${clamped * 100}%` }} />
        <div className="kn" style={{ left: `calc(${clamped * 100}% - ${clamped * 2}px)` }} />
        {!editing && <div className="vl">{display(value, def)}</div>}
        {editing && (
          <input
            aria-label={`${def.label} value`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => finishEdit(true)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') finishEdit(true);
              if (e.key === 'Escape') finishEdit(false);
            }}
          />
        )}
      </div>
    </Row>
  );
}
