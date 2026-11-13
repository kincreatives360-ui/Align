import { useRef } from 'react';
import { useProject } from '../../state/store';

/**
 * Background colour: the visible dot plus a hidden native colour picker
 * behind it. Picking updates live; releasing commits once.
 */
export function BackgroundColourButton() {
  const color = useProject(s => s.state.style.bg.c[0]);
  const transparent = useProject(s => s.state.style.bg.transparent);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        className="ib"
        title="Background colour"
        aria-label="Background colour"
        onClick={() => inputRef.current?.click()}
      >
        <span
          className="dot"
          id="bgDot"
          style={
            transparent
              ? {
                  background:
                    'repeating-conic-gradient(#999 0 25%,#ddd 0 50%) 50%/8px 8px',
                }
              : { background: color }
          }
        />
      </button>
      <input
        ref={inputRef}
        type="color"
        aria-label="Background colour"
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        value={color}
        onInput={e => {
          const hex = e.currentTarget.value;
          useProject.getState().mutate(s => ({
            ...s,
            style: { ...s.style, bg: { ...s.style.bg, c: [hex, ...s.style.bg.c.slice(1)], transparent: false } },
          }));
        }}
        onChange={() => useProject.getState().commit()}
      />
    </>
  );
}
