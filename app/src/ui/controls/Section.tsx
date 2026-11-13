import { useUi } from '../../state/uiStore';
import { ChevronIcon } from '../icons/ChevronIcon';
import { ResetIcon } from '../icons/ResetIcon';
import type { ReactNode } from 'react';

interface Props {
  /** Accordion key — also where open/closed is remembered. */
  id: string;
  title: string;
  subtitle?: string;
  /** Render an on/off switch in the header. `onToggle` must stop propagation. */
  onToggle?: (next: boolean) => void;
  toggleOn?: boolean;
  /** Show a "reset this group" button. */
  onReset?: () => void;
  /** Surface-style: bigger title, accent when open, card body. */
  flat?: boolean;
  /** True when a control inside differs from its default. */
  modified?: boolean;
  children: ReactNode;
}

/**
 * A collapsible group. Open/closed lives in UI state, never in the DOM and
 * never in the project file.
 */
export function Section({
  id,
  title,
  subtitle,
  onToggle,
  toggleOn,
  onReset,
  flat,
  modified,
  children,
}: Props) {
  const open = useUi(s => !s.closedSections[id]);

  const cls = [
    'sec',
    flat && 'flat',
    open && 'open',
    modified && 'mod',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={cls}>
      <div
        className="sh"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => useUi.getState().toggleSection(id)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            useUi.getState().toggleSection(id);
          }
        }}
      >
        <span className="chev">
          <ChevronIcon />
        </span>
        <div className="tt">
          <div className="t1">{title}</div>
          {subtitle && <div className="t2">{subtitle}</div>}
        </div>

        {onToggle !== undefined && (
          <button
            type="button"
            role="switch"
            aria-checked={!!toggleOn}
            aria-label={title}
            className={`tg${toggleOn ? ' on' : ''}`}
            onClick={e => {
              e.stopPropagation();
              onToggle(!toggleOn);
            }}
          />
        )}

        {onReset && (
          <button
            type="button"
            className="ib ghost sm"
            title={`Reset ${title}`}
            aria-label={`Reset ${title}`}
            onClick={e => {
              e.stopPropagation();
              onReset();
            }}
          >
            <ResetIcon />
          </button>
        )}
      </div>

      {open && <div className="sb">{children}</div>}
    </section>
  );
}
