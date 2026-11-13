import { useUi } from '../../state/uiStore';
import type { IconProps } from '../icons/IconBase';
import type { ReactElement } from 'react';

interface Props {
  id: 'templates' | 'controls';
  label: string;
  Icon: (props: IconProps) => ReactElement;
  active: boolean;
}

/** The large icon tab at the top of the Motion panel. */
export function BigTab({ id, label, Icon, active }: Props) {
  return (
    <button
      className={`bigtab${active ? ' on' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={() => useUi.getState().setLeftTab(id)}
    >
      <span className="ic">
        <Icon />
      </span>
      {label}
    </button>
  );
}
