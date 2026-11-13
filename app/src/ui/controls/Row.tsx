import type { ReactNode } from 'react';

interface Props {
  label?: string;
  children: ReactNode;
  /** Rendered under the control, e.g. a hint line. */
  hint?: string;
}

/** The `label` + `.ctl` wrapper every inspector control sits inside. */
export function Row({ label, children, hint }: Props) {
  return (
    <>
      <div className="row">
        {label !== undefined && <label>{label}</label>}
        <div className="ctl">{children}</div>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </>
  );
}
